import { bangs } from "./lib/bangs/hashbang";
import { DEFAULT_BANG_SHORTCUT } from "./lib/constants";
import { readPrefsFromCookieHeader } from "./lib/prefs-cookie";
import { resolveBangRedirect } from "./lib/redirect";

interface WorkerEnv {
  ASSETS: Fetcher;
}

const BANG_MATCH_RE = /^!(\S+)|!(\S+)$/i;

function shortcutFromQuery(query: string, fallback: string): string {
  const m = query.trim().toLowerCase().match(BANG_MATCH_RE);
  if (!m) {
    return fallback;
  }
  return m[1] ?? m[2] ?? fallback;
}

function isHandledPath(path: string): string | null {
  if (path === "/") {
    return "/";
  }
  if (path === "/search" || path === "/search/") {
    return "/search";
  }
  return null;
}

export default {
  fetch(request: Request, env: WorkerEnv): Response | Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return env.ASSETS.fetch(request);
    }

    const url = new URL(request.url);
    const handledPath = isHandledPath(url.pathname);
    const q = url.searchParams.get("q");

    if (!(handledPath && q)) {
      return env.ASSETS.fetch(request);
    }

    const prefs = readPrefsFromCookieHeader(request.headers.get("Cookie"));
    const customSet = new Set((prefs.c ?? []).map((s) => s.toLowerCase()));
    const defaultBangShortcut = prefs.d || DEFAULT_BANG_SHORTCUT;
    const targetShortcut = shortcutFromQuery(q, defaultBangShortcut);

    if (customSet.has(targetShortcut)) {
      return env.ASSETS.fetch(request);
    }

    const result = resolveBangRedirect(
      { query: q, bangs, customBangs: {}, defaultBangShortcut },
      handledPath
    );

    if (result.kind !== "redirect") {
      return env.ASSETS.fetch(request);
    }

    return new Response(null, {
      status: 302,
      headers: {
        Location: result.url,
        "Cache-Control": "private, no-store",
      },
    });
  },
};
