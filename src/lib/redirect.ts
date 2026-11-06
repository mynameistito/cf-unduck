import type { Bang, BangMap } from "./types";

export const BANG_STRIP_RE = /!\S+\s*|^(?<bang>\S+!|!\S+)$/iu;
const KAGI_SITE_EXTRACT_RE = /\+site:(?<site>[^\s&]+)/u;
const TRAILING_SLASH_RE = /\/$/u;
const ENCODE_SLASH_RE = /%2F/gu;

/** Inputs used to resolve a search redirect. */
export interface RedirectInput {
  bangs: BangMap;
  customBangs: BangMap;
  defaultBangShortcut: string;
  query: string;
}

/** Possible outcomes of resolving a search. */
export type RedirectResult =
  | { kind: "redirect"; url: string; bangShortcut: string; bang: Bang }
  | { kind: "landing" }
  | { kind: "notfound" };

/**
 * Normalize a search destination to an HTTP(S) URL.
 *
 * Scheme-less destinations default to HTTPS; other schemes and malformed URLs
 * are rejected.
 * @param url - Destination supplied by a shortcut.
 * @returns A normalized URL, or null for an invalid destination.
 */
export const normalizeWebUrl = (url: string): string | null => {
  try {
    const parsed = new URL(url);

    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.href
      : null;
  } catch {
    try {
      const parsed = new URL(`https://${url}`);

      return parsed.protocol === "https:" ? parsed.href : null;
    } catch {
      return null;
    }
  }
};

const encodeQuery = (query: string): string =>
  encodeURIComponent(query).replaceAll(ENCODE_SLASH_RE, "/");

const getBangShortcut = (query: string): string | undefined => {
  if (query.startsWith("!") && query.length > 1) {
    let end = 1;

    while (end < query.length && query.charAt(end).trim() !== "") {
      end += 1;
    }

    if (end > 1) {
      return query.slice(1, end).toLowerCase();
    }
  }

  const lastBang = query.lastIndexOf("!");

  if (lastBang === -1) {
    return undefined;
  }

  const suffix = query.slice(lastBang + 1);

  if (!suffix) {
    return undefined;
  }

  for (const character of suffix) {
    if (character.trim() === "") {
      return undefined;
    }
  }

  return suffix.toLowerCase();
};

const redirectResult = (
  bang: Bang,
  bangShortcut: string,
  url: string
): RedirectResult => {
  const normalizedUrl = normalizeWebUrl(url);

  if (normalizedUrl === null) {
    return { kind: "landing" };
  }

  return {
    bang,
    bangShortcut,
    kind: "redirect",
    url: normalizedUrl,
  };
};

const getBangBaseUrl = (bang: Bang): string => {
  const alternateDomain = bang.ad?.trim();

  return alternateDomain !== undefined && alternateDomain !== ""
    ? (bang.ad ?? bang.d)
    : bang.d;
};

const findBang = (bangs: BangMap, shortcut: string): Bang | undefined =>
  // oxlint-disable-next-line prefer-object-has-own -- Shared with the extension; avoid requiring the newer Object.hasOwn runtime API.
  Object.prototype.hasOwnProperty.call(bangs, shortcut)
    ? bangs[shortcut]
    : undefined;

const resolveKagiSiteRedirect = (
  selectedBang: Bang,
  defaultBang: Bang | undefined,
  bangShortcut: string,
  cleanQuery: string
): RedirectResult | null => {
  const isKagiSiteBang =
    selectedBang.s.includes("(Kagi Search)") &&
    selectedBang.u.startsWith("/search?q={{{s}}}+site:");

  if (!isKagiSiteBang || defaultBang === undefined || defaultBang.u === "") {
    return null;
  }

  const site = KAGI_SITE_EXTRACT_RE.exec(selectedBang.u)?.groups?.site;

  if (site === undefined || site === "") {
    return null;
  }

  const queryWithSite = `${cleanQuery} site:${site}`;

  return redirectResult(
    selectedBang,
    bangShortcut,
    defaultBang.u.replace("{{{s}}}", encodeQuery(queryWithSite))
  );
};

/** Resolve a search query to a shortcut destination.
 * @param input - Query and available shortcuts.
 * @param pathname - Request path.
 * @returns The resolved navigation outcome.
 */
export const resolveBangRedirect = (
  input: RedirectInput,
  pathname = "/"
): RedirectResult => {
  const cleanPath = pathname.replace(TRAILING_SLASH_RE, "");

  if (cleanPath !== "" && cleanPath !== "/search") {
    return { kind: "notfound" };
  }

  const query = input.query.trim();

  if (!query || query === "!" || query === "!settings") {
    return { kind: "landing" };
  }

  const matchedShortcut = getBangShortcut(query);
  const bangShortcut = matchedShortcut ?? input.defaultBangShortcut;

  const selectedBang =
    findBang(input.customBangs, bangShortcut) ??
    findBang(input.bangs, bangShortcut);

  const defaultBang =
    findBang(input.customBangs, input.defaultBangShortcut) ??
    findBang(input.bangs, input.defaultBangShortcut);

  const cleanQuery =
    matchedShortcut !== undefined && matchedShortcut !== ""
      ? query.replace(BANG_STRIP_RE, "").trim()
      : query;

  if (!selectedBang) {
    return { kind: "landing" };
  }

  if (!cleanQuery) {
    return redirectResult(
      selectedBang,
      bangShortcut,
      getBangBaseUrl(selectedBang)
    );
  }

  const kagiSiteRedirect = resolveKagiSiteRedirect(
    selectedBang,
    defaultBang,
    bangShortcut,
    cleanQuery
  );

  if (kagiSiteRedirect) {
    return kagiSiteRedirect;
  }

  return redirectResult(
    selectedBang,
    bangShortcut,
    selectedBang.u.replace("{{{s}}}", encodeQuery(cleanQuery))
  );
};
