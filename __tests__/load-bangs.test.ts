import { afterAll, expect, it, mock } from "bun:test";

import { loadBangs } from "@/lib/bangs/load-bangs";
import type { BangMap } from "@/lib/types";

const originalFetch = globalThis.fetch;

afterAll(() => {
  globalThis.fetch = originalFetch;
});

it("shares the cached promise and turns synchronous fetch failures into rejections", async () => {
  const fetchImplementation = Object.assign(
    () => {
      throw new Error("Fetch failed synchronously");
    },
    { preconnect: originalFetch.preconnect }
  );

  globalThis.fetch = Object.assign(mock(fetchImplementation), {
    preconnect: originalFetch.preconnect,
  });

  const first = loadBangs();
  const second = loadBangs();
  expect(second).toBe(first);

  let failure: unknown;

  try {
    await first;
  } catch (error) {
    failure = error;
  }

  expect(failure).toBeInstanceOf(Error);
  expect(failure).toHaveProperty("message", "Fetch failed synchronously");
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
    async (
      _input: RequestInfo | URL,
      _init?: RequestInit
    ): Promise<Response> => {
      await Promise.resolve();
      requestCount += 1;

      if (requestCount === 1) {
        return new Response(null, { status: 503 });
      }

      if (requestCount === 2) {
        return Response.json({ broken: { u: 42 } });
      }

      return Response.json(bangs);
    },
    { preconnect: originalFetch.preconnect }
  );

  const fetchMock = mock(fetchImplementation);
  globalThis.fetch = Object.assign(fetchMock, {
    preconnect: originalFetch.preconnect,
  });

  let failure: unknown;

  try {
    await loadBangs();
  } catch (error) {
    failure = error;
  }

  expect(failure).toBeInstanceOf(Error);
  expect(failure).toHaveProperty("message", "Failed to load bangs: 503");

  let validationFailure: unknown;

  try {
    await loadBangs();
  } catch (error) {
    validationFailure = error;
  }

  expect(validationFailure).toBeInstanceOf(Error);
  expect(await loadBangs()).toEqual(bangs);
  expect(fetchMock).toHaveBeenCalledTimes(3);
});
