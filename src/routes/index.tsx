import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Landing } from "@/components/landing";
import { bangs } from "@/lib/bangs/hashbang";
import { DEFAULT_BANG_SHORTCUT, LS_KEYS } from "@/lib/constants";
import { readCustomBangs } from "@/lib/custom-bangs";
import { addToSearchHistory } from "@/lib/history";
import { BANG_STRIP_RE, resolveBangRedirect } from "@/lib/redirect";
import { storage } from "@/lib/storage";

interface Search {
  q?: string;
}

const IndexRoute = () => {
  const { q } = useSearch({ from: "/" });
  const [showLanding, setShowLanding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const redirect = () => {
      try {
        const query = q ?? "";
        const defaultBangShortcut =
          storage.get(LS_KEYS.DEFAULT_BANG) ?? DEFAULT_BANG_SHORTCUT;
        const customBangs = readCustomBangs();
        if (cancelled) {
          return;
        }
        const result = resolveBangRedirect({
          bangs,
          customBangs,
          defaultBangShortcut,
          query,
        });

        if (result.kind === "landing" || result.kind === "notfound") {
          setShowLanding(true);
          return;
        }

        const prev = Math.trunc(
          Number(storage.get(LS_KEYS.SEARCH_COUNT) ?? "0")
        );
        const count = ((Number.isNaN(prev) ? 0 : prev) + 1).toString();
        storage.set(LS_KEYS.SEARCH_COUNT, count);

        if (storage.get(LS_KEYS.HISTORY_ENABLED) === "true") {
          addToSearchHistory(query.replace(BANG_STRIP_RE, "").trim(), {
            bang: result.bangShortcut,
            name: result.bang.s,
          });
        }

        window.location.replace(result.url);
      } catch (error) {
        console.error("Failed to resolve redirect", error);
        if (!cancelled) {
          setShowLanding(true);
        }
      }
    };
    redirect();
    return () => {
      cancelled = true;
    };
  }, [q]);

  if (!showLanding) {
    return null;
  }
  return <Landing />;
};

export const Route = createFileRoute("/")({
  component: IndexRoute,
  validateSearch: (raw: Record<string, unknown>): Search => ({
    q: typeof raw.q === "string" ? raw.q : undefined,
  }),
});
