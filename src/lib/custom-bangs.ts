import { parseStoredBangMap } from "./bangs/schema";
import { LS_KEYS } from "./constants";
import { storage } from "./storage";
import type { BangMap } from "./types";

/** Read locally saved custom shortcuts.
 * @returns The custom shortcut dictionary.
 */
export const readCustomBangs = (): BangMap => {
  try {
    return parseStoredBangMap(storage.get(LS_KEYS.CUSTOM_BANGS) ?? "{}");
  } catch {
    return {};
  }
};
