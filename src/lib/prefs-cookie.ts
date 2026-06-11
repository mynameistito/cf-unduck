import { LS_KEYS } from "./constants";
import { readCustomBangs } from "./custom-bangs";
import type { BangMap } from "./types";

const PREFS_COOKIE = "udprefs";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
const MAX_COOKIE_BYTES = 4000;

const setCookie = (
  name: string,
  value: string,
  options: { maxAge: number; path: string; sameSite: "Lax" }
): void => {
  const parts = [
    `${name}=${value}`,
    `path=${options.path}`,
    `max-age=${options.maxAge}`,
    `SameSite=${options.sameSite}`,
  ];
  // oxlint-disable-next-line unicorn/no-document-cookie -- Cookie Store API is not available in all browsers; this cookie is read by the edge Worker.
  document.cookie = parts.join("; ");
};

export interface Prefs {
  c?: BangMap;
  d?: string;
}

export const readPrefsFromCookieHeader = (
  cookieHeader: string | null
): Prefs => {
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
};

export const syncPrefsCookie = (): void => {
  if (typeof document === "undefined") {
    return;
  }
  const d = localStorage.getItem(LS_KEYS.DEFAULT_BANG) ?? undefined;
  const customBangs = readCustomBangs();
  const payload: Prefs = {};
  if (d) {
    payload.d = d;
  }
  if (Object.keys(customBangs).length > 0) {
    payload.c = customBangs;
  }
  let value = encodeURIComponent(JSON.stringify(payload));
  if (value.length > MAX_COOKIE_BYTES) {
    const fallback: Prefs = {};
    if (d) {
      fallback.d = d;
    }
    value = encodeURIComponent(JSON.stringify(fallback));
    if (value.length > MAX_COOKIE_BYTES) {
      value = encodeURIComponent(JSON.stringify({}));
    }
  }
  setCookie(PREFS_COOKIE, value, {
    maxAge: ONE_YEAR_SECONDS,
    path: "/",
    sameSite: "Lax",
  });
};
