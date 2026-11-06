import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { chromium, expect, test } from "@playwright/test";
import type { Worker } from "@playwright/test";

import { parseExtensionPreferences } from "../src/lib/extension-preferences";

const readPreferences = async (worker: Worker) => {
  const raw = await worker.evaluate(async () => {
    const stored = await chrome.storage.local.get("preferences");

    return stored.preferences;
  });

  return parseExtensionPreferences(raw);
};

test("site settings sync to the real extension and survive a browser restart", async () => {
  const profile = await mkdtemp(path.join(tmpdir(), "unduck-extension-"));
  const extension = path.resolve("dist-extension");

  const launch = async () =>
    await chromium.launchPersistentContext(profile, {
      channel: "chromium",
      headless: true,
      args: [
        `--disable-extensions-except=${extension}`,
        `--load-extension=${extension}`,
      ],
    });

  const syncInput = {
    key: "custom-bangs",
    message: "cf-unduck:sync-extension",
    updatedUrl: "https://chatgpt.com/?q={{{s}}}",
  };

  let context = await launch();

  try {
    const worker =
      context.serviceWorkers()[0] ??
      (await context.waitForEvent("serviceworker"));

    const page = await context.newPage();
    await page.goto("http://127.0.0.1:4173/?q=!settings");
    await expect(
      page.getByText(
        "Extension connected. Your bangs and settings are cached on this device."
      )
    ).toBeVisible();
    await page.evaluate(({ key, message }) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          gpt: {
            d: "chatgpt.com",
            s: "ChatGPT",
            u: "https://chatgpt.com/?prompt={{{s}}}",
          },
        })
      );
      localStorage.setItem("default-bang", "gpt");
      window.postMessage(message, window.location.origin);
    }, syncInput);
    await expect
      .poll(async () => {
        const preferences = await readPreferences(worker);

        return preferences?.defaultBangShortcut;
      })
      .toBe("gpt");
    await page.reload();
    await expect(
      page.getByText(
        "Extension connected. Your bangs and settings are cached on this device."
      )
    ).toBeVisible();
    await page.getByRole("checkbox", { name: "Enable Search History" }).check();
    await expect
      .poll(async () => {
        const preferences = await readPreferences(worker);

        return preferences?.historyEnabled;
      })
      .toBe(true);
    await page.evaluate(({ key, message, updatedUrl }) => {
      const exampleDomain = "example.com";
      const exampleUrl = "https://example.com/?q={{{s}}}";

      localStorage.setItem(
        key,
        JSON.stringify({
          GPT: {
            d: "chatgpt.com",
            s: "Updated ChatGPT",
            u: updatedUrl,
          },
          "": {
            d: exampleDomain,
            s: "Empty",
            u: exampleUrl,
          },
          "   ": {
            d: exampleDomain,
            s: "Whitespace",
            u: exampleUrl,
          },
          broken: { d: exampleDomain, s: "Broken", u: "data:text/html,unsafe" },
        })
      );
      localStorage.setItem("sound-enabled", "false");
      window.postMessage(message, window.location.origin);
    }, syncInput);
    await expect
      .poll(async () => {
        const preferences = await readPreferences(worker);

        return {
          destination: preferences?.customBangs.gpt?.u,
          broken: preferences?.customBangs.broken ?? null,
          empty: preferences?.customBangs[""] ?? null,
          soundEnabled: preferences?.soundEnabled,
        };
      })
      .toEqual({
        destination: syncInput.updatedUrl,
        broken: null,
        empty: null,
        soundEnabled: false,
      });
    await page.evaluate(({ key, message }) => {
      localStorage.setItem(key, "broken-json");
      window.postMessage(message, window.location.origin);
    }, syncInput);
    await expect(page.getByText(/settings could not sync/u)).toBeVisible();
    const preserved = await readPreferences(worker);
    expect(preserved?.customBangs.gpt?.u).toBe(syncInput.updatedUrl);
    await page.goto("about:blank");
    await context.close();
    context = await launch();

    const restarted =
      context.serviceWorkers()[0] ??
      (await context.waitForEvent("serviceworker"));

    const persisted = await readPreferences(restarted);
    expect(persisted?.defaultBangShortcut).toBe("gpt");
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});

test("without the extension, the settings site remains usable", async ({
  page,
}) => {
  await page.goto("http://127.0.0.1:4173/?q=%20!settings%20");
  await expect(page.getByText(/The site works on its own/u)).toBeVisible();
  await page.getByRole("checkbox", { name: "Enable Search History" }).check();
  expect(
    await page.evaluate(() => localStorage.getItem("history-enabled"))
  ).toBe("true");
});
