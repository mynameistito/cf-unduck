import { z } from "zod";

import { storedBangMapSchema } from "./bangs/schema";
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

/** Preferences shared with the edge worker. */
export interface Prefs {
  c?: BangMap;
  d?: string;
}

const prefsSchema = z.object({
  c: z.unknown().optional(),
  d: z.unknown().optional(),
});

const getCookiePart = (cookieHeader: string): string | null =>
  cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${PREFS_COOKIE}=`)) ?? null;

/** Read shared preferences from a cookie header.
 * @param cookieHeader - Raw request cookie header.
 * @returns Decoded preferences or an empty object.
 */
export const readPrefsFromCookieHeader = (
  cookieHeader: string | null
): Prefs => {
  if (cookieHeader === null || cookieHeader === "") {
    return {};
  }

  const part = getCookiePart(cookieHeader);

  if (part === null || part === "") {
    return {};
  }

  const eq = part.indexOf("=");

  if (eq === -1) {
    return {};
  }

  try {
    const value: unknown = JSON.parse(decodeURIComponent(part.slice(eq + 1)));
    const prefs = prefsSchema.safeParse(value);

    if (!prefs.success) {
      return {};
    }

    const result: Prefs = {};
    const customBangs = storedBangMapSchema.safeParse(prefs.data.c);
    const defaultBang = z.string().safeParse(prefs.data.d);

    if (customBangs.success) {
      result.c = customBangs.data;
    }

    if (defaultBang.success) {
      result.d = defaultBang.data;
    }

    return result;
  } catch {
    return {};
  }
};

/** Synchronize local preferences to the worker cookie. */
export const syncPrefsCookie = (): void => {
  if (!("document" in globalThis)) {
    return;
  }

  const d = localStorage.getItem(LS_KEYS.DEFAULT_BANG) ?? undefined;
  const customBangs = readCustomBangs();
  const payload: Prefs = {};

  if (d !== undefined && d !== "") {
    payload.d = d;
  }

  if (Object.keys(customBangs).length > 0) {
    payload.c = customBangs;
  }

  let value = encodeURIComponent(JSON.stringify(payload));

  if (value.length > MAX_COOKIE_BYTES) {
    const fallback: Prefs = {};

    if (d !== undefined && d !== "") {
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
