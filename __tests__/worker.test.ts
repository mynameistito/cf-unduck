import { describe, expect, it, mock } from "bun:test";

import worker from "@/worker";
import type { WorkerEnv } from "@/worker";

const makeEnv = (): WorkerEnv => ({
  ASSETS: {
    fetch: mock(
      async (request: Request) =>
        await Promise.resolve(
          new Response(`asset:${new URL(request.url).pathname}`, {
            status: 200,
          })
        )
    ),
  },
});

const req = (url: string, init?: RequestInit): Request =>
  new Request(url, init);

describe("worker fetch", () => {
  it("redirects on /?q=!g foo", async () => {
    const env = makeEnv();
    const res = await worker.fetch(req("https://x.test/?q=!g foo"), env);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("google.com");
    expect(res.headers.get("Vary")).toBeNull();
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("redirects on /search?q=!g foo", async () => {
    const env = makeEnv();
    const res = await worker.fetch(req("https://x.test/search?q=!g foo"), env);
    expect(res.status).toBe(302);
  });

  it("falls through to ASSETS for /?q empty", async () => {
    const env = makeEnv();
    const res = await worker.fetch(req("https://x.test/"), env);
    expect(env.ASSETS.fetch).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it("falls through for unknown path", async () => {
    const env = makeEnv();
    const res = await worker.fetch(req("https://x.test/random?q=foo"), env);
    expect(env.ASSETS.fetch).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it("non-GET passes through to ASSETS", async () => {
    const env = makeEnv();

    const res = await worker.fetch(
      req("https://x.test/?q=!g+foo", { method: "POST" }),
      env
    );

    expect(env.ASSETS.fetch).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it("respects cookie default bang", async () => {
    const env = makeEnv();
    const cookie = `udprefs=${encodeURIComponent(JSON.stringify({ d: "g" }))}`;

    const res = await worker.fetch(
      req("https://x.test/?q=hello", { headers: { Cookie: cookie } }),
      env
    );

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("google.com");
    expect(res.headers.get("Vary")).toBe("Cookie");
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });

  it("/suggest returns json with empty query", async () => {
    const env = makeEnv();
    const res = await worker.fetch(req("https://x.test/suggest"), env);
    expect(res.headers.get("Content-Type")).toContain("application/json");
    expect(await res.text()).toBe("[]");
  });

  it("resolves redirects even when cache storage is unavailable", async () => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, "caches");
    Object.defineProperty(globalThis, "caches", {
      configurable: true,
      get: () => {
        throw new Error("Cache storage unavailable");
      },
    });

    try {
      const response = await worker.fetch(
        req("https://x.test/?q=!chatgpt+hello"),
        makeEnv()
      );

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe(
        "https://chatgpt.com/?prompt=hello"
      );
      expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    } finally {
      if (previous) {
        Object.defineProperty(globalThis, "caches", previous);
      } else {
        Reflect.deleteProperty(globalThis, "caches");
      }
    }
  });

  it("keeps personalized destinations isolated from later cookieless requests", async () => {
    const cookie = `udprefs=${encodeURIComponent(JSON.stringify({ d: "g" }))}`;

    const personalized = await worker.fetch(
      req("https://x.test/?q=hello", { headers: { Cookie: cookie } }),
      makeEnv()
    );

    const cookieless = await worker.fetch(
      req("https://x.test/?q=hello"),
      makeEnv()
    );

    expect(personalized.headers.get("Location")).toContain("google.com");
    expect(cookieless.headers.get("Location")).toContain("duckduckgo.com");
    expect(cookieless.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns a bodyless redirect for HEAD requests", async () => {
    const response = await worker.fetch(
      req("https://x.test/search/?q=!chatgpt", { method: "HEAD" }),
      makeEnv()
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("https://chatgpt.com/");
    expect(await response.text()).toBe("");
  });
});
