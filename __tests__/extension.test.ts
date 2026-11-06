import { describe, expect, test } from "bun:test";

import { resolveExtensionNavigation } from "../extension/navigation";
import { createSerialQueue } from "../extension/serial-queue";
import { parseExtensionPreferences } from "../src/lib/extension-preferences";
import { defaultExtensionPreferences } from "../src/lib/extension-protocol";
import type { BangMap } from "../src/lib/types";

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
      for (const field of ["u", "d", "ad"]) {
        expect(
          parseExtensionPreferences({
            ...defaultExtensionPreferences(),
            customBangs: { bad: { ...customBangs.gpt, [field]: destination } },
          })
        ).toBeNull();
      }
    }
  });
  test("malformed snapshots are rejected and prototype keys cannot enter storage", () => {
    expect(parseExtensionPreferences({ customBangs: [] })).toBeNull();

    for (const key of ["__proto__", "constructor", "prototype"]) {
      const parsed = parseExtensionPreferences({
        ...defaultExtensionPreferences(),
        customBangs: { [key]: customBangs.gpt },
      });

      expect(Object.hasOwn(parsed?.customBangs ?? {}, key)).toBe(false);
      expect(
        parseExtensionPreferences({
          ...defaultExtensionPreferences(),
          defaultBangShortcut: key,
        })
      ).toBeNull();
    }
  });
  test("inherited map properties are never destinations or defaults", () => {
    for (const key of Object.getOwnPropertyNames(Object.prototype)) {
      const query = `!${key} hello`;
      expect(
        resolveExtensionNavigation(
          query,
          defaultExtensionPreferences(),
          bangs,
          site
        )
      ).toBe(`${site}/?q=${encodeURIComponent(query)}`);
      expect(
        resolveExtensionNavigation(
          "hello",
          { ...defaultExtensionPreferences(), defaultBangShortcut: key },
          bangs,
          site
        )
      ).toBe(`${site}/?q=hello`);
    }

    const inheritedBangs: BangMap = {};
    Object.setPrototypeOf(inheritedBangs, { ddg: customBangs.gpt });

    expect(
      resolveExtensionNavigation(
        "hello",
        {
          ...defaultExtensionPreferences(),
          customBangs: inheritedBangs,
        },
        bangs,
        site
      )
    ).toBe("https://duckduckgo.com/?q=hello");
    expect(
      resolveExtensionNavigation(
        "!tostring hello",
        {
          ...defaultExtensionPreferences(),
          customBangs: { tostring: customBangs.gpt },
        },
        bangs,
        site
      )
    ).toBe("https://chatgpt.com/?prompt=hello");
  });
});

test("queued syncs read the latest settings without overlapping cache writes", async () => {
  const enqueue = createSerialQueue();
  let release: (() => void) | undefined;

  // oxlint-disable-next-line promise/avoid-new -- Explicitly control completion of the first cache write without timers.
  const delayedWrite = new Promise<void>((resolve) => {
    release = resolve;
  });

  let current = 1;
  const snapshots: number[] = [];

  const first = enqueue(async () => {
    snapshots.push(current);
    await delayedWrite;
  });

  await Promise.resolve();
  current = 2;

  const second = enqueue(async () => {
    snapshots.push(current);

    await Promise.resolve();
  });

  current = 3;

  const third = enqueue(async () => {
    snapshots.push(current);

    await Promise.resolve();
  });

  expect(snapshots).toEqual([1]);
  release?.();
  await Promise.all([first, second, third]);
  expect(snapshots).toEqual([1, 3, 3]);
});

test("a failed cache write does not block the next sync", async () => {
  const enqueue = createSerialQueue();

  const first = enqueue(async () => {
    await Promise.reject(new Error("Storage unavailable"));
  });

  let saved = false;

  const second = enqueue(async () => {
    saved = true;

    await Promise.resolve();
  });

  let failure: unknown;

  try {
    await first;
  } catch (error) {
    failure = error;
  }

  expect(failure).toBeInstanceOf(Error);
  expect(failure).toHaveProperty("message", "Storage unavailable");
  await second;
  expect(saved).toBe(true);
});
