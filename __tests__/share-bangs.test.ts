import { describe, expect, it } from "bun:test";

import { isValidBangMap } from "@/lib/share-bangs";
import type { BangMap } from "@/lib/types";

describe("isValidBangMap", () => {
  it("rejects shared maps with non-web search destinations", () => {
    const unsafeBangs: BangMap = {
      unsafe: {
        d: "example.com",
        s: "Unsafe",
        u: "ftp://example.com/?q={{{s}}}",
      },
    };

    expect(isValidBangMap(unsafeBangs)).toBe(false);
  });

  it("accepts HTTP(S) and scheme-less search destinations", () => {
    const validBangs: BangMap = {
      http: { d: "example.com", s: "HTTP", u: "http://example.com/?q={{{s}}}" },
      https: {
        d: "example.com",
        s: "HTTPS",
        u: "https://example.com/?q={{{s}}}",
      },
      implicit: {
        d: "example.com",
        s: "Implicit",
        u: "example.com/?q={{{s}}}",
      },
    };

    expect(isValidBangMap(validBangs)).toBe(true);
  });
});
