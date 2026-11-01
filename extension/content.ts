import { DEFAULT_BANG_SHORTCUT, LS_KEYS } from "../src/lib/constants";
import {
  extensionResponseSchema,
  parseExtensionPreferences,
} from "../src/lib/extension-preferences";
import {
  EXTENSION_REQUEST,
  EXTENSION_STATUS,
} from "../src/lib/extension-protocol";

declare const EXTENSION_SITE_ORIGIN: string;

const sync = async (): Promise<void> => {
  if (window.location.origin !== EXTENSION_SITE_ORIGIN) {
    return;
  }
  let ok = false;
  try {
    const preferences = parseExtensionPreferences({
      customBangs: JSON.parse(
        localStorage.getItem(LS_KEYS.CUSTOM_BANGS) ?? "{}"
      ),
      defaultBangShortcut:
        localStorage.getItem(LS_KEYS.DEFAULT_BANG) ?? DEFAULT_BANG_SHORTCUT,
      historyEnabled: localStorage.getItem(LS_KEYS.HISTORY_ENABLED) === "true",
      soundEnabled: localStorage.getItem(LS_KEYS.SOUND_ENABLED) !== "false",
    });
    if (preferences) {
      const response: unknown = await chrome.runtime.sendMessage(preferences);
      const parsed = extensionResponseSchema.safeParse(response);
      ok = parsed.success && parsed.data.ok;
    }
  } catch {
    // Report failures on the site and preserve the last working cached snapshot.
  }
  window.postMessage({ type: EXTENSION_STATUS, ok }, window.location.origin);
};

window.addEventListener("message", (event: MessageEvent<unknown>) => {
  if (
    event.source === window &&
    event.origin === window.location.origin &&
    event.data === EXTENSION_REQUEST
  ) {
    void sync();
  }
});
window.addEventListener("storage", () => {
  void sync();
});
window.addEventListener("focus", () => {
  void sync();
});
void sync();
