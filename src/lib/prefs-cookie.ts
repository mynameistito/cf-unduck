import { LS_KEYS } from "./constants";
import type { BangMap } from "./types";

export const PREFS_COOKIE = "udprefs";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export interface Prefs {
  c?: BangMap;
  d?: string;
}

export function readPrefsFromCookieHeader(cookieHeader: string | null): Prefs {
  if (!cookieHeader) {
    return {};
  }
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) {
      continue;
    }
    const name = part.slice(0, eq).trim();
    if (name !== PREFS_COOKIE) {
      continue;
    }
    try {
      return JSON.parse(decodeURIComponent(part.slice(eq + 1).trim())) as Prefs;
    } catch {
      return {};
    }
  }
  return {};
}

export function syncPrefsCookie(): void {
  if (typeof document === "undefined") {
    return;
  }
  const d = localStorage.getItem(LS_KEYS.DEFAULT_BANG) ?? undefined;
  let c: BangMap | undefined;
  try {
    const raw = localStorage.getItem(LS_KEYS.CUSTOM_BANGS);
    if (raw) {
      const parsed = JSON.parse(raw) as BangMap;
      const lowered: BangMap = {};
      for (const [k, v] of Object.entries(parsed)) {
        lowered[k.toLowerCase()] = v;
      }
      if (Object.keys(lowered).length > 0) {
        c = lowered;
      }
    }
  } catch {
    /* ignore */
  }
  const payload: Prefs = {};
  if (d) {
    payload.d = d;
  }
  if (c) {
    payload.c = c;
  }
  const value = encodeURIComponent(JSON.stringify(payload));
  // biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API not available in all browsers; this cookie is read by the edge Worker
  document.cookie = `${PREFS_COOKIE}=${value}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
}
