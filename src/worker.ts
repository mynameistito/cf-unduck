import { bangs } from "./lib/bangs/hashbang";
import { DEFAULT_BANG_SHORTCUT } from "./lib/constants";
import { readPrefsFromCookieHeader } from "./lib/prefs-cookie";
import { resolveBangRedirect } from "./lib/redirect";

interface WorkerEnv {
  ASSETS: Fetcher;
}

const SUGGEST_UPSTREAM = "https://duckduckgo.com/ac/?type=list&q=";

function isHandledPath(path: string): string | null {
  if (path === "/") {
    return "/";
  }
  if (path === "/search" || path === "/search/") {
    return "/search";
  }
  return null;
}

async function handleSuggest(url: URL): Promise<Response> {
  const q = url.searchParams.get("q") ?? "";
  if (!q) {
    return new Response("[]", {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=60",
      },
    });
  }
  const upstream = await fetch(SUGGEST_UPSTREAM + encodeURIComponent(q), {
    cf: { cacheTtl: 60, cacheEverything: true },
  });
  const body = await upstream.text();
  return new Response(body, {
    status: upstream.status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=60",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export default {
  fetch(request: Request, env: WorkerEnv): Response | Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return env.ASSETS.fetch(request);
    }

    const url = new URL(request.url);

    if (url.pathname === "/suggest" || url.pathname === "/suggest/") {
      return handleSuggest(url);
    }

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
        Vary: "Cookie",
        "Referrer-Policy": "no-referrer",
      },
    });
  },
};
