import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Landing } from "~/components/landing";
import { DEFAULT_BANG_SHORTCUT, LS_KEYS } from "~/lib/constants";
import { addToSearchHistory, getCustomBangs } from "~/lib/history";
import { resolveBangRedirect } from "~/lib/redirect";
import { storage } from "~/lib/storage";

interface Search {
  q?: string;
}

const HISTORY_BANG_STRIP_RE = /!\S+\s*|^(\S+!|!\S+)$/i;

export const Route = createFileRoute("/")({
  validateSearch: (raw: Record<string, unknown>): Search => ({
    q: typeof raw.q === "string" ? raw.q : undefined,
  }),
  component: IndexComponent,
});

function IndexComponent() {
  const { q } = Route.useSearch();
  const [showLanding, setShowLanding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const query = q ?? "";
      const defaultBangShortcut =
        storage.get(LS_KEYS.DEFAULT_BANG) ?? DEFAULT_BANG_SHORTCUT;
      const customBangs = getCustomBangs();
      const { bangs } = await import("~/lib/bangs/hashbang");
      if (cancelled) {
        return;
      }
      const result = resolveBangRedirect({
        query,
        bangs,
        customBangs,
        defaultBangShortcut,
      });

      if (result.kind === "landing" || result.kind === "notfound") {
        setShowLanding(true);
        return;
      }

      const count = (
        Number.parseInt(storage.get(LS_KEYS.SEARCH_COUNT) ?? "0", 10) + 1
      ).toString();
      storage.set(LS_KEYS.SEARCH_COUNT, count);

      if (storage.get(LS_KEYS.HISTORY_ENABLED) === "true") {
        addToSearchHistory(query.replace(HISTORY_BANG_STRIP_RE, "").trim(), {
          bang: result.bangShortcut,
          name: result.bang.s,
        });
      }

      window.location.replace(result.url);
    })();
    return () => {
      cancelled = true;
    };
  }, [q]);

  if (!showLanding) {
    return null;
  }
  return <Landing />;
}
