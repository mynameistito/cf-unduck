import { afterAll, expect, it, mock } from "bun:test";

import { loadBangs } from "@/lib/bangs/load-bangs";
import type { BangMap } from "@/lib/types";

const originalFetch = globalThis.fetch;

afterAll(() => {
  globalThis.fetch = originalFetch;
});

it("retries after a failed request", async () => {
  let requestCount = 0;
  const bangs: BangMap = {
    example: {
      d: "example.com",
      s: "Example",
      u: "https://example.com/?q={{{s}}}",
    },
  };
  const fetchImplementation = Object.assign(
    (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
      requestCount += 1;
      if (requestCount === 1) {
        return Promise.resolve(new Response(null, { status: 503 }));
      }
      return Promise.resolve(Response.json(bangs));
    },
    { preconnect: originalFetch.preconnect }
  );
  const fetchMock = mock(fetchImplementation);
  globalThis.fetch = Object.assign(fetchMock, {
    preconnect: originalFetch.preconnect,
  });

  await expect(loadBangs()).rejects.toThrow("Failed to load bangs: 503");
  expect(await loadBangs()).toEqual(bangs);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
