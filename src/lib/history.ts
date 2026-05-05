import { LS_KEYS, MAX_HISTORY } from "./constants";
import { storage } from "./storage";
import type { SearchHistoryEntry } from "./types";

export function getSearchHistory(): SearchHistoryEntry[] {
  try {
    return JSON.parse(storage.get(LS_KEYS.SEARCH_HISTORY) ?? "[]");
  } catch {
    return [];
  }
}

export function addToSearchHistory(
  query: string,
  bang: { bang: string; name: string }
): void {
  const history = getSearchHistory();
  history.unshift({
    query,
    bang: bang.bang,
    name: bang.name,
    timestamp: Date.now(),
  });
  history.splice(MAX_HISTORY);
  storage.set(LS_KEYS.SEARCH_HISTORY, JSON.stringify(history));
}

export function clearSearchHistory(): void {
  storage.set(LS_KEYS.SEARCH_HISTORY, "[]");
}

export function getCustomBangs(): Record<
  string,
  { d: string; ad?: string; s: string; u: string }
> {
  try {
    const raw = JSON.parse(storage.get(LS_KEYS.CUSTOM_BANGS) ?? "{}");
    return Object.fromEntries(
      Object.entries(raw).map(([k, v]) => [k.toLowerCase(), v])
    ) as Record<string, { d: string; ad?: string; s: string; u: string }>;
  } catch {
    return {};
  }
}
