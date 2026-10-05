import type { Bang, BangMap } from "./types";

export const BANG_STRIP_RE = /!\S+\s*|^(?<bang>\S+!|!\S+)$/iu;
const KAGI_SITE_BANG_RE = /^\/search\?q=\{\{\{s\}\}\}\+site:/u;
const KAGI_SITE_EXTRACT_RE = /\+site:(?<site>[^\s&]+)/u;
const TRAILING_SLASH_RE = /\/$/u;
const ENCODE_SLASH_RE = /%2F/gu;

export interface RedirectInput {
  bangs: BangMap;
  customBangs: BangMap;
  defaultBangShortcut: string;
  query: string;
}

export type RedirectResult =
  | { kind: "redirect"; url: string; bangShortcut: string; bang: Bang }
  | { kind: "landing" }
  | { kind: "notfound" };

/**
 * Normalize a search destination to an HTTP(S) URL.
 *
 * Scheme-less destinations default to HTTPS; other schemes and malformed URLs
 * are rejected.
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
  encodeURIComponent(query).replace(ENCODE_SLASH_RE, "/");

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
  if (!normalizedUrl) {
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
  return alternateDomain ? (bang.ad ?? bang.d) : bang.d;
};

const resolveKagiSiteRedirect = (
  selectedBang: Bang,
  defaultBang: Bang | undefined,
  bangShortcut: string,
  cleanQuery: string
): RedirectResult | null => {
  const isKagiSiteBang =
    selectedBang.s.includes("(Kagi Search)") &&
    KAGI_SITE_BANG_RE.test(selectedBang.u);
  if (!(isKagiSiteBang && defaultBang?.u)) {
    return null;
  }

  const site = selectedBang.u.match(KAGI_SITE_EXTRACT_RE)?.groups?.site;
  if (!site) {
    return null;
  }

  const queryWithSite = `${cleanQuery} site:${site}`;
  return redirectResult(
    selectedBang,
    bangShortcut,
    defaultBang.u.replace("{{{s}}}", encodeQuery(queryWithSite))
  );
};

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
    input.customBangs[bangShortcut] ?? input.bangs[bangShortcut];
  const defaultBang =
    input.customBangs[input.defaultBangShortcut] ??
    input.bangs[input.defaultBangShortcut];

  const cleanQuery = matchedShortcut
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
