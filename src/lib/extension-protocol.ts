import { DEFAULT_BANG_SHORTCUT } from "./constants";
import type { BangMap } from "./types";

export const EXTENSION_REQUEST = "cf-unduck:sync-extension";
export const EXTENSION_STATUS = "cf-unduck:extension-status";

/** Settings owned by the site and cached by the browser extension. */
export interface ExtensionPreferences {
  customBangs: BangMap;
  defaultBangShortcut: string;
  historyEnabled: boolean;
  soundEnabled: boolean;
}

/** Create preferences for a new installation.
 * @returns Default extension preferences.
 */
export const defaultExtensionPreferences = (): ExtensionPreferences => ({
  customBangs: {},
  defaultBangShortcut: DEFAULT_BANG_SHORTCUT,
  historyEnabled: false,
  soundEnabled: true,
});
