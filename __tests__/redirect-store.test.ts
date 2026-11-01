import "fake-indexeddb/auto";
import { describe, expect, it } from "bun:test";

import { createRedirectStore } from "@/lib/redirect-store";
import type { RedirectPreferences } from "@/lib/redirect-store";
import type { BangMap } from "@/lib/types";

const bangs: BangMap = {
  ddg: {
    d: "duckduckgo.com",
    s: "DuckDuckGo",
    u: "https://duckduckgo.com/?q={{{s}}}",
  },
  chatgpt: {
    d: "chatgpt.com",
    s: "ChatGPT",
    u: "https://chatgpt.com/?prompt={{{s}}}",
  },
};
const defaults: RedirectPreferences = {
  customBangs: {},
  defaultBangShortcut: "ddg",
  historyEnabled: false,
};
const createStore = () =>
  createRedirectStore(`redirect-test-${crypto.randomUUID()}`);
const query = (q: string, path = "/") =>
  new URL(`${path}?q=${encodeURIComponent(q)}`, "https://unduck.test");

describe("persistent browser redirects", () => {
  it("falls back until the app has synced its preferences", async () => {
    const store = createStore();
    expect(await store.resolve(query("!chatgpt hello"), bangs)).toBeNull();
    expect(await store.readCount()).toBe(0);
  });

  it("substitutes encoded queries and counts successful redirects", async () => {
    const store = createStore();
    expect(await store.sync(defaults)).toBe(true);
    expect(
      await store.resolve(query("!chatgpt hello & goodbye", "/search/"), bangs)
    ).toMatchObject({
      kind: "redirect",
      url: "https://chatgpt.com/?prompt=hello%20%26%20goodbye",
    });
    expect(await store.resolve(query("!chatgpt"), bangs)).toMatchObject({
      kind: "redirect",
      url: "https://chatgpt.com/",
    });
    expect(await store.readCount()).toBe(2);
  });

  it("keeps custom bangs and counters after the worker restarts", async () => {
    const name = `redirect-test-${crypto.randomUUID()}`;
    const store = createRedirectStore(name);
    await store.sync({
      ...defaults,
      customBangs: {
        gpt: bangs.chatgpt ?? {
          d: "chatgpt.com",
          s: "ChatGPT",
          u: "https://chatgpt.com/?prompt={{{s}}}",
        },
      },
      defaultBangShortcut: "gpt",
    });
    await store.resolve(query("!gpt first"), bangs);
    const restarted = createRedirectStore(name);
    expect(await restarted.resolve(query("second"), bangs)).toMatchObject({
      url: "https://chatgpt.com/?prompt=second",
    });
    expect(await restarted.readCount()).toBe(2);
  });

  it("lets the app record history when history is enabled", async () => {
    const store = createStore();
    await store.sync({ ...defaults, historyEnabled: true });
    expect(
      await store.resolve(query("!chatgpt private search"), bangs)
    ).toBeNull();
    expect(await store.readCount()).toBe(0);
    await store.sync(defaults);
    expect(await store.resolve(query("!chatgpt hello"), bangs)).toMatchObject({
      kind: "redirect",
    });
  });

  it("does not count settings, unknown bangs, or unrelated paths", async () => {
    const store = createStore();
    await store.sync(defaults);
    const results = await Promise.all(
      ["", "!", "!settings", "!unknown"].map((q) =>
        store.resolve(query(q), bangs)
      )
    );
    for (const result of results) {
      expect(result).toMatchObject({
        kind: "landing",
      });
    }
    expect(
      await store.resolve(query("!chatgpt", "/other"), bangs)
    ).toMatchObject({ kind: "notfound" });
    expect(await store.readCount()).toBe(0);
  });

  it("serializes concurrent navigations without losing counts", async () => {
    const store = createStore();
    await store.sync(defaults);
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        store.resolve(query("!chatgpt hello"), bangs)
      )
    );
    expect(results.every((result) => result?.kind === "redirect")).toBe(true);
    expect(await store.readCount()).toBe(10);
  });

  it("falls back safely when IndexedDB is unavailable", async () => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, "indexedDB");
    Object.defineProperty(globalThis, "indexedDB", {
      configurable: true,
      get() {
        throw new Error("Storage blocked");
      },
    });
    try {
      const store = createStore();
      expect(await store.sync(defaults)).toBe(false);
      expect(await store.resolve(query("!chatgpt hello"), bangs)).toBeNull();
      expect(await store.readCount()).toBeNull();
    } finally {
      if (previous) {
        Object.defineProperty(globalThis, "indexedDB", previous);
      }
    }
  });
});
