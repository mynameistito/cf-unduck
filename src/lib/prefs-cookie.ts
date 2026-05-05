import { LS_KEYS } from "./constants";

export const PREFS_COOKIE = "udprefs";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export interface Prefs {
  c?: string[];
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
  let c: string[] | undefined;
  try {
    const raw = localStorage.getItem(LS_KEYS.CUSTOM_BANGS);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const keys = Object.keys(parsed).map((k) => k.toLowerCase());
      if (keys.length > 0) {
        c = keys;
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
