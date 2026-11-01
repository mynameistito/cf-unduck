import { describe, expect, it } from "bun:test";

import { resolveBangRedirect } from "@/lib/redirect";
import type { BangMap } from "@/lib/types";

const bangs: BangMap = {
  ddg: {
    d: "duckduckgo.com",
    s: "DuckDuckGo",
    u: "https://duckduckgo.com/?q={{{s}}}",
  },
  g: { d: "google.com", s: "Google", u: "https://google.com/search?q={{{s}}}" },
  ghr: {
    d: "github.com",
    s: "GitHub Repo",
    u: "https://github.com/{{{s}}}",
  },
  kgh: {
    d: "github.com",
    s: "GitHub (Kagi Search)",
    u: "/search?q={{{s}}}+site:github.com",
  },
  yt: {
    d: "youtube.com",
    s: "YouTube",
    u: "https://youtube.com/results?search_query={{{s}}}",
  },
};

const base = {
  bangs,
  customBangs: {},
  defaultBangShortcut: "ddg",
};

describe("resolveBangRedirect", () => {
  it("renders landing when query empty", () => {
    expect(resolveBangRedirect({ ...base, query: "" }).kind).toBe("landing");
  });

  it("renders landing when query is '!'", () => {
    expect(resolveBangRedirect({ ...base, query: "!" }).kind).toBe("landing");
  });

  it("renders landing when query is '!settings'", () => {
    expect(resolveBangRedirect({ ...base, query: "!settings" }).kind).toBe(
      "landing"
    );
  });

  it.each([
    ["hello world", "ddg", "https://duckduckgo.com/?q=hello%20world"],
    ["!g foo", "g", "https://google.com/search?q=foo"],
    ["foo !g", "g", "https://google.com/search?q=foo"],
    ["foo !g bar", "ddg", "https://duckduckgo.com/?q=foo%20!g%20bar"],
    ["!yt", "yt", "https://youtube.com/"],
    ["!ghr foo/bar", "ghr", "https://github.com/foo/bar"],
    [
      "!kgh react",
      "kgh",
      "https://duckduckgo.com/?q=react%20site%3Agithub.com",
    ],
  ])("resolves %s using %s", (query, bangShortcut, url) => {
    expect(resolveBangRedirect({ ...base, query })).toMatchObject({
      kind: "redirect",
      bangShortcut,
      url,
    });
  });

  it("404s on unknown path", () => {
    const r = resolveBangRedirect({ ...base, query: "" }, "/random");
    expect(r.kind).toBe("notfound");
  });

  it("custom bang overrides built-in", () => {
    const customBangs: BangMap = {
      g: {
        d: "example.com",
        s: "Custom G",
        u: "https://example.com/?q={{{s}}}",
      },
    };
    const r = resolveBangRedirect({
      ...base,
      customBangs,
      query: "!g foo",
    });
    expect(r.kind).toBe("redirect");
    if (r.kind === "redirect") {
      expect(r.url).toBe("https://example.com/?q=foo");
    }
  });

  it("works on /search path", () => {
    const r = resolveBangRedirect({ ...base, query: "!g foo" }, "/search");
    expect(r.kind).toBe("redirect");
  });

  it("trims trailing slash on path", () => {
    const r = resolveBangRedirect({ ...base, query: "!g foo" }, "/");
    expect(r.kind).toBe("redirect");
  });

  it("falls back to landing when bang unknown and no default present", () => {
    const r = resolveBangRedirect({
      ...base,
      defaultBangShortcut: "nonexistent",
      query: "hello",
    });
    expect(r.kind).toBe("landing");
  });

  it("handles uses ad (alt domain) over d when present", () => {
    const customBangs: BangMap = {
      alt: {
        ad: "alt.com",
        d: "primary.com",
        s: "Alt",
        u: "https://primary.com/?q={{{s}}}",
      },
    };
    const r = resolveBangRedirect({ ...base, customBangs, query: "!alt" });
    expect(r.kind).toBe("redirect");
    if (r.kind === "redirect") {
      expect(r.url).toBe("https://alt.com/");
    }
  });

  it("rejects explicit non-web schemes, including custom bang paths", () => {
    const customBangs: BangMap = {
      unsafe: {
        d: "example.com",
        s: "Unsafe",
        u: "ftp://example.com/?q={{{s}}}",
      },
    };
    expect(
      resolveBangRedirect({ ...base, customBangs, query: "!unsafe search" })
    ).toEqual({ kind: "landing" });
    expect(
      resolveBangRedirect({ ...base, customBangs, query: "!unsafe" })
    ).toMatchObject({ kind: "redirect", url: "https://example.com/" });
  });

  it("allows HTTP, HTTPS, and scheme-less custom bang destinations", () => {
    const customBangs: BangMap = {
      http: {
        d: "example.com",
        s: "HTTP",
        u: "http://example.com/?q={{{s}}}",
      },
      https: {
        d: "example.com",
        s: "HTTPS",
        u: "https://example.com/?q={{{s}}}",
      },
      implicit: {
        d: "example.com",
        s: "Implicit",
        u: "EXAMPLE.com/search?q={{{s}}}",
      },
    };
    const httpResult = resolveBangRedirect({
      ...base,
      customBangs,
      query: "!http search",
    });
    const httpsResult = resolveBangRedirect({
      ...base,
      customBangs,
      query: "!https search",
    });
    const implicitResult = resolveBangRedirect({
      ...base,
      customBangs,
      query: "!implicit two words",
    });

    expect(httpResult.kind === "redirect" && httpResult.url).toBe(
      "http://example.com/?q=search"
    );
    expect(httpsResult.kind === "redirect" && httpsResult.url).toBe(
      "https://example.com/?q=search"
    );
    expect(implicitResult.kind === "redirect" && implicitResult.url).toBe(
      "https://example.com/search?q=two%20words"
    );
  });
});
