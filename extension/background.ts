import bangs from "../public/assets/hashbang.json";
import { parseExtensionPreferences } from "../src/lib/extension-preferences";
import { defaultExtensionPreferences } from "../src/lib/extension-protocol";
import { resolveExtensionNavigation } from "./navigation";
import { createSerialQueue } from "./serial-queue";

declare const EXTENSION_SITE_ORIGIN: string;

const siteOrigin = EXTENSION_SITE_ORIGIN;
const enqueueWrite = createSerialQueue();

type UntrustedMessage = Parameters<typeof parseExtensionPreferences>[0];

const onMessage = (
  message: UntrustedMessage,
  sender: chrome.runtime.MessageSender,
  respond: (response?: { ok: boolean }) => void
): boolean => {
  if (
    sender.id !== chrome.runtime.id ||
    sender.url === undefined ||
    sender.url === "" ||
    sender.frameId !== 0
  ) {
    return false;
  }

  if (new URL(sender.url).origin !== siteOrigin) {
    return false;
  }

  const preferences = parseExtensionPreferences(message);

  if (!preferences) {
    respond({ ok: false });

    return false;
  }

  void enqueueWrite(async () => {
    try {
      await chrome.storage.local.set({ preferences });
      respond({ ok: true });
    } catch {
      respond({ ok: false });
    }
  });

  return true;
};

// oxlint-disable-next-line typescript/strict-void-return -- Chrome requires a true return to keep sendResponse open; @types/chrome declares void.
chrome.runtime.onMessage.addListener(onMessage);

const search = async (
  query: string,
  disposition: "currentTab" | "newForegroundTab" | "newBackgroundTab"
): Promise<void> => {
  let url = `${siteOrigin}/?q=${encodeURIComponent(query)}`;

  try {
    const stored = await chrome.storage.local.get("preferences");

    const preferences =
      parseExtensionPreferences(stored.preferences) ??
      defaultExtensionPreferences();

    url = resolveExtensionNavigation(query, preferences, bangs, siteOrigin);
  } catch {
    // The site remains a usable fallback if extension storage is unavailable.
  }

  if (disposition === "currentTab") {
    await chrome.tabs.update({ url });

    return;
  }

  await chrome.tabs.create({ active: disposition === "newForegroundTab", url });
};

chrome.omnibox.onInputEntered.addListener((query, disposition) => {
  void (async () => {
    try {
      await search(query, disposition);
    } catch {
      // Navigation may be cancelled when the current tab closes.
    }
  })();
});

chrome.action.onClicked.addListener(() => {
  void chrome.tabs.create({ url: `${siteOrigin}/?q=!settings` });
});

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") {
    void chrome.tabs.create({ url: `${siteOrigin}/?q=!settings` });
  }
});
