import { bangs } from "./lib/bangs/hashbang";
import { DEFAULT_BANG_SHORTCUT } from "./lib/constants";
import { readPrefsFromCookieHeader } from "./lib/prefs-cookie";
import { resolveBangRedirect } from "./lib/redirect";

export interface WorkerEnv {
  ASSETS: Pick<Fetcher, "fetch">;
}

const SUGGEST_UPSTREAM =
  "https://suggestqueries.google.com/complete/search?client=firefox&q=";
const SUGGESTION_CACHE_TTL_SECONDS = 60;
const SUGGESTION_FETCH_TIMEOUT_MS = 1500;
const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

const isHandledPath = (path: string): string | null => {
  if (path === "/") {
    return "/";
  }
  if (path === "/search" || path === "/search/") {
    return "/search";
  }
  return null;
};

const emptySuggestions = (status: number): Response =>
  new Response("[]", {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
      "Content-Type": JSON_CONTENT_TYPE,
    },
    status,
  });

const handleSuggest = async (url: URL): Promise<Response> => {
  const q = url.searchParams.get("q") ?? "";
  if (!q) {
    return new Response("[]", {
      headers: {
        "Cache-Control": `public, max-age=${SUGGESTION_CACHE_TTL_SECONDS}`,
        "Content-Type": JSON_CONTENT_TYPE,
      },
    });
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, SUGGESTION_FETCH_TIMEOUT_MS);
  try {
    const upstream = await fetch(SUGGEST_UPSTREAM + encodeURIComponent(q), {
      cf: {
        cacheEverything: true,
        cacheTtl: SUGGESTION_CACHE_TTL_SECONDS,
      },
      signal: controller.signal,
    });
    if (!upstream.ok) {
      return emptySuggestions(upstream.status);
    }
    const body = await upstream.text();
    return new Response(body, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": `public, max-age=${SUGGESTION_CACHE_TTL_SECONDS}`,
        "Content-Type": JSON_CONTENT_TYPE,
      },
      status: upstream.status,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return emptySuggestions(504);
    }
    return emptySuggestions(502);
  } finally {
    clearTimeout(timeout);
  }
};

const PREFS_COOKIE_RE = /(?:^|;\s*)udprefs=/u;
const REDIRECT_EDGE_TTL_SECONDS = 86_400;

export default {
  async fetch(
    request: Request,
    env: WorkerEnv,
    ctx: Pick<ExecutionContext, "waitUntil">
  ): Promise<Response> {
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

    const cookieHeader = request.headers.get("Cookie");
    const hasPrefs = cookieHeader ? PREFS_COOKIE_RE.test(cookieHeader) : false;
    const cache =
      "caches" in globalThis ? await caches.open("redirects") : null;

    if (!hasPrefs && cache) {
      const cached = await cache.match(request);
      if (cached) {
        return cached;
      }
    }

    const prefs = readPrefsFromCookieHeader(cookieHeader);
    const defaultBangShortcut = prefs.d || DEFAULT_BANG_SHORTCUT;

    const result = resolveBangRedirect(
      { bangs, customBangs: prefs.c ?? {}, defaultBangShortcut, query: q },
      handledPath
    );

    if (result.kind !== "redirect") {
      return env.ASSETS.fetch(request);
    }

    const headers = new Headers({
      Location: result.url,
      "Referrer-Policy": "no-referrer",
    });
    if (hasPrefs) {
      // Vary on Cookie so any intermediate cache keys per-user; combined with
      // no-store this is defense-in-depth.
      headers.set("Cache-Control", "private, no-store");
      headers.set("Vary", "Cookie");
    } else {
      // Redirect target depends only on (path, query) for cookieless users —
      // omit Vary so unrelated cookies (analytics etc.) don't fragment the
      // edge cache key.
      headers.set(
        "Cache-Control",
        `public, s-maxage=${REDIRECT_EDGE_TTL_SECONDS}, max-age=0`
      );
    }

    const response = new Response(null, { headers, status: 302 });

    if (!hasPrefs && cache) {
      ctx.waitUntil(cache.put(request, response.clone()));
    }
    return response;
  },
};
