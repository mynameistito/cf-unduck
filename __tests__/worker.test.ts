import { describe, expect, it, mock } from "bun:test";

import worker from "@/worker";
import type { WorkerEnv } from "@/worker";

const makeEnv = (): WorkerEnv => ({
  ASSETS: {
    fetch: mock((request: Request) =>
      Promise.resolve(
        new Response(`asset:${new URL(request.url).pathname}`, {
          status: 200,
        })
      )
    ),
  },
});

const ctx = {
  waitUntil: () => {},
} satisfies Pick<ExecutionContext, "waitUntil">;

const req = (url: string, init?: RequestInit): Request =>
  new Request(url, init);

const requestKey = (request: RequestInfo | URL): string =>
  request instanceof Request ? request.url : String(request);

const installCache = (cachedResponse?: Response) => {
  const priorCaches = Object.getOwnPropertyDescriptor(globalThis, "caches");
  const puts: { request: RequestInfo | URL; response: Response }[] = [];
  const matches: (RequestInfo | URL)[] = [];
  const storedResponses = new Map<string, Response>();
  const cache = {
    match: mock((request: RequestInfo | URL) => {
      matches.push(request);
      const response =
        cachedResponse ?? storedResponses.get(requestKey(request));
      return Promise.resolve(response?.clone());
    }),
    put: mock((request: RequestInfo | URL, response: Response) => {
      puts.push({ request, response });
      storedResponses.set(requestKey(request), response.clone());
      return Promise.resolve();
    }),
  };
  const cacheStorage = {
    open: mock(() => Promise.resolve(cache)),
  };

  Object.defineProperty(globalThis, "caches", {
    configurable: true,
    value: cacheStorage,
  });

  return {
    cache,
    matches,
    puts,
    restore: () => {
      if (priorCaches) {
        Object.defineProperty(globalThis, "caches", priorCaches);
      } else {
        Reflect.deleteProperty(globalThis, "caches");
      }
    },
  };
};

const makeCapturingCtx = () => {
  const pending: Promise<unknown>[] = [];
  return {
    ctx: {
      waitUntil: (promise: Promise<unknown>) => pending.push(promise),
    } satisfies Pick<ExecutionContext, "waitUntil">,
    flush: () => Promise.all(pending),
    pending,
  };
};

describe("worker fetch", () => {
  it("redirects on /?q=!g foo", async () => {
    const env = makeEnv();
    const res = await worker.fetch(req("https://x.test/?q=!g foo"), env, ctx);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("google.com");
    expect(res.headers.get("Vary")).toBeNull();
    expect(res.headers.get("Cache-Control")).toContain("public");
  });

  it("redirects on /search?q=!g foo", async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      req("https://x.test/search?q=!g foo"),
      env,
      ctx
    );
    expect(res.status).toBe(302);
  });

  it("falls through to ASSETS for /?q empty", async () => {
    const env = makeEnv();
    const res = await worker.fetch(req("https://x.test/"), env, ctx);
    expect(env.ASSETS.fetch).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it("falls through for unknown path", async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      req("https://x.test/random?q=foo"),
      env,
      ctx
    );
    expect(env.ASSETS.fetch).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it("non-GET passes through to ASSETS", async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      req("https://x.test/?q=!g+foo", { method: "POST" }),
      env,
      ctx
    );
    expect(env.ASSETS.fetch).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it("respects cookie default bang", async () => {
    const env = makeEnv();
    const cookie = `udprefs=${encodeURIComponent(JSON.stringify({ d: "g" }))}`;
    const res = await worker.fetch(
      req("https://x.test/?q=hello", { headers: { Cookie: cookie } }),
      env,
      ctx
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("google.com");
    expect(res.headers.get("Vary")).toBe("Cookie");
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });

  it("returns a cookieless cached redirect without fetching ASSETS", async () => {
    const cachedResponse = new Response(null, {
      headers: { Location: "https://cached.test/" },
      status: 302,
    });
    const fake = installCache(cachedResponse);

    try {
      const env = makeEnv();
      const res = await worker.fetch(req("https://x.test/?q=!g+foo"), env, ctx);

      expect(res.headers.get("Location")).toBe("https://cached.test/");
      expect(fake.matches).toHaveLength(1);
      expect(fake.puts).toHaveLength(0);
      expect(env.ASSETS.fetch).not.toHaveBeenCalled();
    } finally {
      fake.restore();
    }
  });

  it("writes a cookieless redirect to cache after a miss", async () => {
    const fake = installCache();
    const captured = makeCapturingCtx();

    try {
      const env = makeEnv();
      const res = await worker.fetch(
        req("https://x.test/?q=!g+foo"),
        env,
        captured.ctx
      );
      await captured.flush();

      expect(res.status).toBe(302);
      expect(res.headers.get("Cache-Control")).toContain("public");
      expect(fake.matches).toHaveLength(1);
      expect(fake.puts).toHaveLength(1);
      expect(fake.puts[0]?.response).not.toBe(res);
      expect(fake.puts[0]?.response.headers.get("Location")).toBe(
        res.headers.get("Location")
      );
      expect(captured.pending).toHaveLength(1);
      expect(env.ASSETS.fetch).not.toHaveBeenCalled();
    } finally {
      fake.restore();
    }
  });

  it("bypasses redirect cache for preferences and keeps their redirect private", async () => {
    const fake = installCache();

    try {
      const env = makeEnv();
      const url = "https://x.test/?q=hello";
      const cookie = `udprefs=${encodeURIComponent(JSON.stringify({ d: "g" }))}`;
      const personalized = await worker.fetch(
        req(url, { headers: { Cookie: cookie } }),
        env,
        ctx
      );
      const cookieless = await worker.fetch(req(url), env, ctx);

      expect(personalized.headers.get("Location")).toContain("google.com");
      expect(personalized.headers.get("Cache-Control")).toBe(
        "private, no-store"
      );
      expect(personalized.headers.get("Vary")).toBe("Cookie");
      expect(fake.matches).toHaveLength(1);
      expect(fake.puts).toHaveLength(1);
      expect(cookieless.headers.get("Location")).toContain("duckduckgo.com");
      expect(cookieless.headers.get("Location")).not.toBe(
        personalized.headers.get("Location")
      );
    } finally {
      fake.restore();
    }
  });

  it("/suggest returns json with empty query", async () => {
    const env = makeEnv();
    const res = await worker.fetch(req("https://x.test/suggest"), env, ctx);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    expect(await res.text()).toBe("[]");
  });
});
