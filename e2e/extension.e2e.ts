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
  const launch = () =>
    chromium.launchPersistentContext(profile, {
      channel: "chromium",
      headless: true,
      args: [
        `--disable-extensions-except=${extension}`,
        `--load-extension=${extension}`,
      ],
    });
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
    await page.evaluate(() => {
      localStorage.setItem(
        "custom-bangs",
        JSON.stringify({
          gpt: {
            d: "chatgpt.com",
            s: "ChatGPT",
            u: "https://chatgpt.com/?prompt={{{s}}}",
          },
        })
      );
      localStorage.setItem("default-bang", "gpt");
      window.postMessage("cf-unduck:sync-extension", window.location.origin);
    });
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
    await page.evaluate(() => {
      localStorage.setItem("custom-bangs", "broken-json");
      window.postMessage("cf-unduck:sync-extension", window.location.origin);
    });
    await expect(page.getByText(/settings could not sync/u)).toBeVisible();
    const preserved = await readPreferences(worker);
    expect(preserved?.customBangs.gpt?.u).toBe(
      "https://chatgpt.com/?prompt={{{s}}}"
    );
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
  await page.goto("http://127.0.0.1:4173/?q=!settings");
  await expect(page.getByText(/The site works on its own/u)).toBeVisible();
  await page.getByRole("checkbox", { name: "Enable Search History" }).check();
  expect(
    await page.evaluate(() => localStorage.getItem("history-enabled"))
  ).toBe("true");
});
