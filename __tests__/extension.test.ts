import { describe, expect, test } from "bun:test";

import { resolveExtensionNavigation } from "../extension/navigation";
import { parseExtensionPreferences } from "../src/lib/extension-preferences";
import { defaultExtensionPreferences } from "../src/lib/extension-protocol";

const site = "https://unduck.example";
const bangs = {
  ddg: {
    d: "duckduckgo.com",
    s: "DuckDuckGo",
    u: "https://duckduckgo.com/?q={{{s}}}",
  },
};
const customBangs = {
  gpt: {
    d: "chatgpt.com",
    s: "ChatGPT",
    u: "https://chatgpt.com/?prompt={{{s}}}",
  },
};

describe("extension searches", () => {
  test("custom bangs go straight to the destination", () => {
    expect(
      resolveExtensionNavigation(
        "!gpt hello world",
        { ...defaultExtensionPreferences(), customBangs },
        bangs,
        site
      )
    ).toBe("https://chatgpt.com/?prompt=hello%20world");
  });
  test("queries use the cached default", () => {
    expect(
      resolveExtensionNavigation(
        "hello",
        {
          ...defaultExtensionPreferences(),
          customBangs,
          defaultBangShortcut: "gpt",
        },
        bangs,
        site
      )
    ).toBe("https://chatgpt.com/?prompt=hello");
  });
  test("history-enabled searches retain the site history path", () => {
    expect(
      resolveExtensionNavigation(
        "!gpt hello",
        { ...defaultExtensionPreferences(), customBangs, historyEnabled: true },
        bangs,
        site
      )
    ).toBe(`${site}/?q=!gpt%20hello`);
  });
  test("settings and unknown bangs fall back to the site", () => {
    for (const query of ["!settings", "!missing hello", ""]) {
      expect(
        resolveExtensionNavigation(
          query,
          defaultExtensionPreferences(),
          bangs,
          site
        )
      ).toBe(`${site}/?q=${encodeURIComponent(query)}`);
    }
  });
  test("unsafe synced destinations cannot be stored", () => {
    for (const destination of [
      // oxlint-disable-next-line no-script-url -- Malicious input is a regression fixture, never executed.
      "javascript:alert(1)",
      "data:text/html,test",
      "file:///tmp/test",
    ]) {
      expect(
        parseExtensionPreferences({
          ...defaultExtensionPreferences(),
          customBangs: { bad: { d: "example.com", s: "Bad", u: destination } },
        })
      ).toBeNull();
    }
  });
  test("malformed snapshots are rejected and prototype keys cannot enter storage", () => {
    expect(parseExtensionPreferences({ customBangs: [] })).toBeNull();
    const parsed = parseExtensionPreferences({
      ...defaultExtensionPreferences(),
      customBangs: JSON.parse(
        '{"__proto__":{"d":"example.com","s":"Bad","u":"https://example.com"}}'
      ),
    });
    expect(Object.hasOwn(parsed?.customBangs ?? {}, "__proto__")).toBe(false);
  });
});
