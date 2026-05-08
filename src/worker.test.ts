import { describe, expect, it, mock } from "bun:test";
import worker from "./worker";

function makeEnv() {
  return {
    ASSETS: {
      fetch: mock(
        (req: Request) =>
          new Response(`asset:${new URL(req.url).pathname}`, { status: 200 })
      ),
    },
  };
}

const ctx = {
  waitUntil: () => {
    /* noop */
  },
  passThroughOnException: () => {
    /* noop */
  },
} as unknown as ExecutionContext;

function req(url: string, init?: RequestInit): Request {
  return new Request(url, init);
}

describe("worker fetch", () => {
  it("redirects on /?q=!g foo", async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      req("https://x.test/?q=!g foo"),
      env as never,
      ctx
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("google.com");
    expect(res.headers.get("Vary")).toBeNull();
    expect(res.headers.get("Cache-Control")).toContain("public");
  });

  it("redirects on /search?q=!g foo", async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      req("https://x.test/search?q=!g foo"),
      env as never,
      ctx
    );
    expect(res.status).toBe(302);
  });

  it("falls through to ASSETS for /?q empty", async () => {
    const env = makeEnv();
    const res = await worker.fetch(req("https://x.test/"), env as never, ctx);
    expect(env.ASSETS.fetch).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it("falls through for unknown path", async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      req("https://x.test/random?q=foo"),
      env as never,
      ctx
    );
    expect(env.ASSETS.fetch).toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it("non-GET passes through to ASSETS", async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      req("https://x.test/?q=!g+foo", { method: "POST" }),
      env as never,
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
      env as never,
      ctx
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("google.com");
    expect(res.headers.get("Vary")).toBe("Cookie");
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });

  it("/suggest returns json with empty query", async () => {
    const env = makeEnv();
    const res = await worker.fetch(
      req("https://x.test/suggest"),
      env as never,
      ctx
    );
    expect(res.headers.get("Content-Type")).toContain("application/json");
    expect(await res.text()).toBe("[]");
  });
});
