import { expect, test } from "@playwright/test";
import type { Page, Route } from "@playwright/test";

const readBrowserValue = ({
  store,
  key,
  remove,
}: {
  store: "preferences" | "counts";
  key: string;
  remove?: boolean;
}): Promise<string | null> =>
  // oxlint-disable-next-line promise/avoid-new -- Browser IDB events are the test's public persistence boundary.
  new Promise<string | null>((resolve, reject) => {
    const opening = indexedDB.open("unduck-redirects", 1);
    opening.addEventListener("error", () => reject(opening.error));
    opening.addEventListener("success", () => {
      const db: IDBDatabase = opening.result;
      const objectStore = db
        .transaction(store, remove ? "readwrite" : "readonly")
        .objectStore(store);
      const request = remove ? objectStore.delete(key) : objectStore.get(key);
      request.addEventListener("error", () => {
        db.close();
        reject(request.error);
      });
      request.addEventListener("success", () => {
        const result: unknown = request.result;
        db.close();
        resolve(JSON.stringify(result) ?? null);
      });
    });
  });

const readStoredValue = (
  page: Page,
  store: "preferences" | "counts",
  key: string
): Promise<string | null> => page.evaluate(readBrowserValue, { store, key });
const chatgptPattern = "https://chatgpt.com/**";
const helloQuery = "/?q=!chatgpt+hello";
const helloDestination = "https://chatgpt.com/?prompt=hello";
const readAppCount = (page: Page): Promise<string | null> =>
  page.evaluate(() => localStorage.getItem("search-count"));
const fulfillChatgpt = async (route: Route): Promise<void> => {
  await route.fulfill({ body: "ChatGPT destination" });
};

const install = async (page: Page): Promise<void> => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await expect
    .poll(() => readStoredValue(page, "preferences", "current"))
    .toContain('"historyEnabled":false');
  await expect(
    page.getByRole("button", { name: "Open settings", exact: true })
  ).toBeVisible();
};

const enableHistory = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    localStorage.setItem("history-enabled", "true");
  });
  await page.reload();
  await expect
    .poll(() => readStoredValue(page, "preferences", "current"))
    .toContain('"historyEnabled":true');
};

test("redirects offline without loading React and preserves the search count", async ({
  page,
  context,
}) => {
  await context.route(chatgptPattern, fulfillChatgpt);
  await install(page);
  const scripts: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "script") {
      scripts.push(request.url());
    }
  });
  await context.setOffline(true);
  await page.goto(helloQuery, { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(helloDestination);
  expect(scripts).toEqual([]);
  await context.setOffline(false);
  await page.goto("/");
  await expect.poll(() => readStoredValue(page, "counts", "total")).toBe("1");
  await expect(
    page.getByRole("link", { name: "1 search", exact: true })
  ).toBeVisible();
  await enableHistory(page);
  await page.goto(helloQuery, { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(helloDestination);
  await page.goto("/");
  expect(await readStoredValue(page, "counts", "total")).toBe("1");
  expect(await readAppCount(page)).toBe("1");
  await expect(
    page.getByRole("link", { name: "2 searches", exact: true })
  ).toBeVisible();
});

test("persists full custom bangs and defaults across a worker restart", async ({
  page,
  context,
}) => {
  await context.route(chatgptPattern, fulfillChatgpt);
  await install(page);
  await page.evaluate(() => {
    localStorage.setItem("default-bang", "gpt");
    localStorage.setItem(
      "custom-bangs",
      JSON.stringify({
        gpt: {
          d: "chatgpt.com",
          s: `ChatGPT ${"x".repeat(5000)}`,
          u: "https://chatgpt.com/?prompt={{{s}}}",
        },
      })
    );
  });
  await page.reload();
  await expect
    .poll(() => readStoredValue(page, "preferences", "current"))
    .toContain('"defaultBangShortcut":"gpt"');
  const session = await context.newCDPSession(page);
  await session.send("ServiceWorker.enable");
  await session.send("ServiceWorker.stopAllWorkers");
  await session.detach();
  await context.setOffline(true);
  await page.goto("/search/?q=hello+world", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL("https://chatgpt.com/?prompt=hello%20world");
});

test("keeps history-enabled searches on the app path and records them once", async ({
  page,
  context,
}) => {
  await context.route(chatgptPattern, fulfillChatgpt);
  await install(page);
  await enableHistory(page);
  await page.goto("/search?q=!chatgpt+remember+this", {
    waitUntil: "domcontentloaded",
  });
  await expect(page).toHaveURL("https://chatgpt.com/?prompt=remember%20this");
  await page.goto("/");
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("search-history") ?? "[]")
    )
  ).toMatchObject([{ bang: "chatgpt", query: "remember this" }]);
  expect(await readAppCount(page)).toBe("1");
  expect(await readStoredValue(page, "counts", "total")).toBeNull();
});

test("settings and unknown bangs still show the app", async ({ page }) => {
  await install(page);
  await page.goto("/?q=!settings");
  await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();
  await page.goto("/?q=!unknown-bang-xyz");
  await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();
  expect(await readStoredValue(page, "counts", "total")).toBeNull();
});

test("missing preferences fall back to the app resolver", async ({
  page,
  context,
}) => {
  await context.route(chatgptPattern, fulfillChatgpt);
  await install(page);
  await page.evaluate(readBrowserValue, {
    store: "preferences" as const,
    key: "current",
    remove: true,
  });
  await page.goto(helloQuery, { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(helloDestination);
  await page.goto("/");
  expect(await readStoredValue(page, "counts", "total")).toBeNull();
  expect(await readAppCount(page)).toBe("1");
});

test("missing app and dictionary caches fall back to the network", async ({
  page,
  context,
}) => {
  await context.route(chatgptPattern, fulfillChatgpt);
  const edgeResponse = await page.request.get(helloQuery, { maxRedirects: 0 });
  expect(edgeResponse.status()).toBe(302);
  expect(edgeResponse.headers().location).toBe(helloDestination);
  await install(page);
  await enableHistory(page);
  await page.evaluate(async () => {
    const cacheKeys = await caches.keys();
    await Promise.all(cacheKeys.map((key) => caches.delete(key)));
  });
  await page.goto(helloQuery, { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(helloDestination);
  await page.goto("/");
  expect(await readStoredValue(page, "counts", "total")).toBeNull();
  expect(await readAppCount(page)).toBe("1");
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("search-history") ?? "[]")
    )
  ).toMatchObject([{ bang: "chatgpt", query: "hello" }]);
});
