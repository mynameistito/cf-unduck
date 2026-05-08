import type { Bang, BangMap } from "./types";

const BANG_MATCH_RE = /^!(\S+)|!(\S+)$/i;
export const BANG_STRIP_RE = /!\S+\s*|^(\S+!|!\S+)$/i;
const KAGI_SITE_BANG_RE = /^\/search\?q=\{\{\{s\}\}\}\+site:/;
const KAGI_SITE_EXTRACT_RE = /\+site:([^\s&]+)/;
const TRAILING_SLASH_RE = /\/$/;
const ENCODE_SLASH_RE = /%2F/g;

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

function ensureProtocol(url: string, defaultProtocol = "https://"): string {
  try {
    return new URL(url).href;
  } catch {
    return `${defaultProtocol}${url}`;
  }
}

function encodeQuery(query: string): string {
  return encodeURIComponent(query).replace(ENCODE_SLASH_RE, "/");
}

export function resolveBangRedirect(
  input: RedirectInput,
  pathname = "/"
): RedirectResult {
  const cleanPath = pathname.replace(TRAILING_SLASH_RE, "");
  if (cleanPath !== "" && cleanPath !== "/search") {
    return { kind: "notfound" };
  }

  const query = input.query.trim();
  if (!query || query === "!" || query === "!settings") {
    return { kind: "landing" };
  }

  const match = query.match(BANG_MATCH_RE);
  const bangShortcut = match
    ? (match[1] ?? match[2] ?? input.defaultBangShortcut).toLowerCase()
    : input.defaultBangShortcut;

  const selectedBang =
    input.customBangs[bangShortcut] ?? input.bangs[bangShortcut];
  const defaultBang =
    input.customBangs[input.defaultBangShortcut] ??
    input.bangs[input.defaultBangShortcut];

  const cleanQuery = match ? query.replace(BANG_STRIP_RE, "").trim() : query;

  if (!selectedBang) {
    return { kind: "landing" };
  }

  if (!cleanQuery && selectedBang.d) {
    return {
      kind: "redirect",
      url: ensureProtocol(selectedBang.ad ?? selectedBang.d),
      bangShortcut,
      bang: selectedBang,
    };
  }

  const isKagiSiteBang =
    selectedBang.s.includes("(Kagi Search)") &&
    KAGI_SITE_BANG_RE.test(selectedBang.u);

  if (isKagiSiteBang && defaultBang?.u) {
    const siteMatch = selectedBang.u.match(KAGI_SITE_EXTRACT_RE);
    if (siteMatch?.[1]) {
      const queryWithSite = `${cleanQuery} site:${siteMatch[1]}`;
      const redirectUrl = defaultBang.u.replace(
        "{{{s}}}",
        encodeQuery(queryWithSite)
      );
      return {
        kind: "redirect",
        url: ensureProtocol(redirectUrl),
        bangShortcut,
        bang: selectedBang,
      };
    }
  }

  const redirectUrl = selectedBang.u.replace(
    "{{{s}}}",
    encodeQuery(cleanQuery)
  );
  return {
    kind: "redirect",
    url: ensureProtocol(redirectUrl),
    bangShortcut,
    bang: selectedBang,
  };
}
