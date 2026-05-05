import { bangs } from "./lib/bangs/hashbang";
import { DEFAULT_BANG_SHORTCUT } from "./lib/constants";
import { readPrefsFromCookieHeader } from "./lib/prefs-cookie";
import { resolveBangRedirect } from "./lib/redirect";

interface WorkerEnv {
  ASSETS: Fetcher;
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
    const defaultBangShortcut = prefs.d || DEFAULT_BANG_SHORTCUT;

    const result = resolveBangRedirect(
      { query: q, bangs, customBangs: prefs.c ?? {}, defaultBangShortcut },
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
