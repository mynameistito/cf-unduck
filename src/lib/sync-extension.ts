import { LS_KEYS } from "./constants";
import { EXTENSION_REQUEST } from "./extension-protocol";
import { storage } from "./storage";

const request = (): void =>
  window.postMessage(EXTENSION_REQUEST, window.location.origin);

/** Notify an optional extension after site settings change; no extension is required. */
export const startExtensionSync = (): void => {
  for (const key of [
    LS_KEYS.DEFAULT_BANG,
    LS_KEYS.CUSTOM_BANGS,
    LS_KEYS.HISTORY_ENABLED,
    LS_KEYS.SOUND_ENABLED,
  ]) {
    storage.subscribe(key, request);
  }
  request();
};
