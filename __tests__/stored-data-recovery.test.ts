import { expect, it } from "bun:test";

import {
  bangMapSchema,
  parseBangMap,
  parseStoredBangMap,
} from "@/lib/bangs/schema";
import { LS_KEYS } from "@/lib/constants";
import { readCustomBangs } from "@/lib/custom-bangs";
import { getSearchHistory } from "@/lib/history";
import { readPrefsFromCookieHeader } from "@/lib/prefs-cookie";
import { resolveBangRedirect } from "@/lib/redirect";
import { isValidBangMap } from "@/lib/share-bangs";
import { storage } from "@/lib/storage";

const validBang = {
  d: "example.com",
  s: "Example",
  u: "https://example.com/?q={{{s}}}",
};

const unsafeScriptUrl = ["java", "script:alert(1)"].join("");

const mixedBangs = { good: validBang, broken: { u: 12 } };
const storedMap = JSON.stringify(mixedBangs);

it("recovers usable stored shortcuts while keeping imports strict", () => {
  const recovered = parseStoredBangMap(storedMap);

  expect(recovered).toEqual({ good: validBang });
  expect(() => parseBangMap(storedMap)).toThrow();
  expect(
    resolveBangRedirect({
      bangs: {},
      customBangs: recovered,
      defaultBangShortcut: "good",
      query: "hello",
    })
  ).toMatchObject({ kind: "redirect", url: "https://example.com/?q=hello" });
});

it("recovers valid cookie shortcuts and preserves an independent default", () => {
  const cookie = `udprefs=${encodeURIComponent(JSON.stringify({ c: mixedBangs, d: "good" }))}`;

  expect(readPrefsFromCookieHeader(cookie)).toEqual({
    c: { good: validBang },
    d: "good",
  });
  const invalidDefault = `udprefs=${encodeURIComponent(JSON.stringify({ c: { good: validBang }, d: 12 }))}`;
  expect(readPrefsFromCookieHeader(invalidDefault)).toEqual({
    c: { good: validBang },
  });
});

it("retains valid history and custom bangs beside invalid stored entries", () => {
  const validHistory = {
    bang: "good",
    name: "Example",
    query: "hello",
    timestamp: 1,
  };

  const previousGet = storage.get;
  storage.get = (key) => {
    if (key === LS_KEYS.SEARCH_HISTORY) {
      return JSON.stringify([
        validHistory,
        { bang: "bad", timestamp: "invalid" },
      ]);
    }

    return key === LS_KEYS.CUSTOM_BANGS ? storedMap : null;
  };

  try {
    expect(getSearchHistory()).toEqual([validHistory]);
    expect(readCustomBangs()).toEqual({ good: validBang });
  } finally {
    storage.get = previousGet;
  }
});

it.each([unsafeScriptUrl, "data:text/html,unsafe", "file:///tmp/test"])(
  "rejects %s in each custom destination without losing valid neighbors",
  (unsafe) => {
    for (const field of ["u", "d", "ad"] as const) {
      const invalidBang = { ...validBang, [field]: unsafe };
      const mixed = { good: validBang, broken: invalidBang };
      const serialized = JSON.stringify(mixed);
      const cookie = `udprefs=${encodeURIComponent(JSON.stringify({ c: mixed, d: "good" }))}`;

      expect(parseStoredBangMap(serialized)).toEqual({ good: validBang });
      expect(readPrefsFromCookieHeader(cookie)).toEqual({
        c: { good: validBang },
        d: "good",
      });
      expect(() => parseBangMap(serialized)).toThrow();
      expect(isValidBangMap(mixed)).toBe(false);

      const previousGet = storage.get;
      storage.get = () => serialized;

      try {
        expect(readCustomBangs()).toEqual({ good: validBang });
      } finally {
        storage.get = previousGet;
      }
    }
  }
);

it("keeps scheme-less custom domains and relative built-in Kagi URLs", () => {
  expect(parseBangMap(JSON.stringify({ good: validBang }))).toEqual({
    good: validBang,
  });
  expect(
    bangMapSchema.safeParse({
      kagi: {
        d: "kagi.com",
        s: "Kagi Search",
        u: "/search?q={{{s}}}+site:example.com",
      },
    }).success
  ).toBe(true);
});

it("falls back to a built-in shortcut when a stored override has an unsafe destination", () => {
  const customBangs = parseStoredBangMap(
    JSON.stringify({ good: { ...validBang, u: unsafeScriptUrl } })
  );

  expect(
    resolveBangRedirect({
      bangs: { good: validBang },
      customBangs,
      defaultBangShortcut: "good",
      query: "hello",
    })
  ).toMatchObject({ kind: "redirect", url: "https://example.com/?q=hello" });
});
