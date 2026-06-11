import { LS_KEYS, MAX_HISTORY } from "./constants";
import { storage } from "./storage";
import type { SearchHistoryEntry } from "./types";

export const getSearchHistory = (): SearchHistoryEntry[] => {
  try {
    const raw = JSON.parse(storage.get(LS_KEYS.SEARCH_HISTORY) ?? "[]");
    return Array.isArray(raw) ? (raw as SearchHistoryEntry[]) : [];
  } catch {
    return [];
  }
};

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

export const clearSearchHistory = (): void => {
  storage.set(LS_KEYS.SEARCH_HISTORY, "[]");
};
