import { DEFAULT_BANG_SHORTCUT, LS_KEYS } from "./constants";
import { readCustomBangs } from "./custom-bangs";
import { redirectStore } from "./redirect-store";
import { refreshServiceWorkerCount, storage } from "./storage";

/** Mirror full preferences for worker restarts, including cookie-sized overflows. */
const syncRedirectPreferences = async (): Promise<void> => {
  await redirectStore.sync({
    customBangs: readCustomBangs(),
    defaultBangShortcut:
      storage.get(LS_KEYS.DEFAULT_BANG) ?? DEFAULT_BANG_SHORTCUT,
    historyEnabled: storage.get(LS_KEYS.HISTORY_ENABLED) === "true",
  });
};

const sync = (): void => {
  void syncRedirectPreferences();
};

/** Keep the service worker aligned with settings and reflect its search count. */
export const startRedirectSync = (): void => {
  for (const key of [
    LS_KEYS.CUSTOM_BANGS,
    LS_KEYS.DEFAULT_BANG,
    LS_KEYS.HISTORY_ENABLED,
  ]) {
    storage.subscribe(key, sync);
  }

  sync();
  void refreshServiceWorkerCount();
  window.addEventListener("focus", () => {
    void refreshServiceWorkerCount();
  });
  navigator.serviceWorker?.addEventListener(
    "message",
    (event: MessageEvent<unknown>) => {
      if (event.data === "redirect-count-changed") {
        void refreshServiceWorkerCount();
      }
    }
  );
};
