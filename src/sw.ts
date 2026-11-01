/// <reference lib="webworker" />

import { clientsClaim } from "workbox-core";
import {
  cleanupOutdatedCaches,
  matchPrecache,
  precacheAndRoute,
} from "workbox-precaching";
import type { PrecacheEntry } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

import { redirectStore } from "./lib/redirect-store";
import type { BangMap } from "./lib/types";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: (PrecacheEntry | string)[];
};

void self.skipWaiting();
clientsClaim();
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

let bangsPromise: Promise<BangMap | null> | null = null;

const readCachedBangs = (): Promise<BangMap | null> => {
  bangsPromise ??= (async () => {
    const response = await matchPrecache("/assets/hashbang.json");
    if (!response) {
      return null;
    }
    // SAFETY: the build precaches this generated dictionary of validated bangs.
    return (await response.json()) as BangMap;
  })();
  return bangsPromise;
};

registerRoute(
  new NavigationRoute(async (options) => {
    const { url, event } = options;
    const isSearch =
      (url.pathname === "/" ||
        url.pathname === "/search" ||
        url.pathname === "/search/") &&
      url.searchParams.has("q");
    if (isSearch) {
      try {
        const bangs = await readCachedBangs();
        const result = bangs ? await redirectStore.resolve(url, bangs) : null;
        if (result?.kind === "redirect") {
          event.waitUntil(
            (async () => {
              for (const client of await self.clients.matchAll({
                type: "window",
              })) {
                // oxlint-disable-next-line unicorn/require-post-message-target-origin -- ServiceWorker Client.postMessage has no targetOrigin argument.
                client.postMessage("redirect-count-changed");
              }
            })()
          );
          return new Response(null, {
            status: 302,
            headers: {
              Location: result.url,
              "Cache-Control": "private, no-store",
              "Referrer-Policy": "no-referrer",
            },
          });
        }
      } catch {
        bangsPromise = null;
        // Cache/IDB failures use the existing app resolver and localStorage prefs.
      }
    }
    try {
      const appShell = await matchPrecache("index.html");
      if (appShell) {
        return appShell;
      }
    } catch {
      // Cache storage can be unavailable, for example in private browsing.
    }
    // Preserve the original query so the edge Worker can resolve it directly.
    return fetch(options.request);
  })
);
