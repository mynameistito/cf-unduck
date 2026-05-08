import { type RefObject, useEffect, useState } from "react";
import {
  useLocalStorage,
  useLocalStorageString,
} from "@/hooks/use-local-storage";
import { DEFAULT_BANG_SHORTCUT, LS_KEYS } from "@/lib/constants";
import { type RedirectResult, resolveBangRedirect } from "@/lib/redirect";
import type { BangMap } from "@/lib/types";

function PreviewLine({ preview }: { preview: RedirectResult }) {
  if (preview.kind === "redirect") {
    return (
      <p className="mt-2 break-all text-fg-muted text-xs">
        <span className="text-fg">→</span> {preview.url}
      </p>
    );
  }
  if (preview.kind === "landing") {
    return (
      <p className="mt-2 break-all text-fg-muted text-xs">
        (landing page — type a query)
      </p>
    );
  }
  return <p className="mt-2 break-all text-fg-muted text-xs">(no match)</p>;
}

interface Props {
  inputRef?: RefObject<HTMLInputElement | null>;
}

export function BangTester({ inputRef }: Props) {
  const [query, setQuery] = useState("");
  const [bangs, setBangs] = useState<BangMap | null>(null);
  const [defaultBang] = useLocalStorageString(
    LS_KEYS.DEFAULT_BANG,
    DEFAULT_BANG_SHORTCUT
  );
  const [customBangs] = useLocalStorage<BangMap>(LS_KEYS.CUSTOM_BANGS, {});

  useEffect(() => {
    let cancelled = false;
    import("@/lib/bangs/hashbang")
      .then((m) => {
        if (!cancelled) {
          setBangs(m.bangs);
        }
      })
      .catch((err) => {
        console.error("Failed to load bangs", err);
        if (!cancelled) {
          setBangs({});
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const preview = bangs
    ? resolveBangRedirect({
        query,
        bangs,
        customBangs,
        defaultBangShortcut: defaultBang,
      })
    : null;

  const onSubmit = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (!query.trim()) {
      return;
    }
    window.location.href = `/?q=${encodeURIComponent(query)}`;
  };

  return (
    <form className="bang-tester mt-4 w-full" onSubmit={onSubmit}>
      <div className="flex gap-2">
        <input
          aria-label="Test a bang query"
          autoComplete="off"
          className="flex-1 rounded-md border border-border bg-bg-muted px-3 py-2 text-fg outline-none focus:outline-2 focus:outline-fg-muted"
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Try it: !gh react"
          ref={inputRef}
          spellCheck={false}
          type="text"
          value={query}
        />
        <button
          aria-label="Run query"
          className="rounded-md bg-fg px-3 py-2 font-medium text-bg text-sm transition hover:brightness-90 active:scale-[0.97] disabled:opacity-50"
          disabled={!query.trim()}
          type="submit"
        >
          Go
        </button>
      </div>
      {query.trim() && preview ? <PreviewLine preview={preview} /> : null}
    </form>
  );
}
