import { z } from "zod";

import { LS_KEYS, MAX_HISTORY } from "./constants";
import { storage } from "./storage";
import type { SearchHistoryEntry } from "./types";

const historySchema = z.array(
  z.object({
    bang: z.string(),
    name: z.string(),
    query: z.string(),
    timestamp: z.number(),
  })
);

/** Read saved search history.
 * @returns Saved entries, or an empty list when unavailable.
 */
export const getSearchHistory = (): SearchHistoryEntry[] => {
  try {
    const raw: unknown = JSON.parse(
      storage.get(LS_KEYS.SEARCH_HISTORY) ?? "[]"
    );

    const parsed = historySchema.safeParse(raw);

    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
};

/** Save a search at the front of the history.
 * @param query - Search query.
 * @param bang - Selected shortcut and name.
 */
export const addToSearchHistory = (
  query: string,
  bang: { bang: string; name: string }
): void => {
  const history = getSearchHistory();
  history.unshift({
    bang: bang.bang,
    name: bang.name,
    query,
    timestamp: Date.now(),
  });
  history.splice(MAX_HISTORY);
  storage.set(LS_KEYS.SEARCH_HISTORY, JSON.stringify(history));
};

/** Remove saved search history. */
export const clearSearchHistory = (): void => {
  storage.set(LS_KEYS.SEARCH_HISTORY, "[]");
};
