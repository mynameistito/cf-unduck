import { useEffect, useState } from "react";
import type { RefObject } from "react";

import {
  useLocalStorage,
  useLocalStorageString,
} from "@/hooks/use-local-storage";
import { DEFAULT_BANG_SHORTCUT, LS_KEYS } from "@/lib/constants";
import { resolveBangRedirect } from "@/lib/redirect";
import type { RedirectResult } from "@/lib/redirect";
import type { BangMap } from "@/lib/types";

const PreviewLine = ({ preview }: { preview: RedirectResult }) => {
  if (preview.kind === "redirect") {
    return (
      <p className="text-fg-muted mt-2 text-xs break-all">
        <span className="text-fg">→</span> {preview.url}
      </p>
    );
  }
  if (preview.kind === "landing") {
    return (
      <p className="text-fg-muted mt-2 text-xs break-all">
        (landing page — type a query)
      </p>
    );
  }
  return <p className="text-fg-muted mt-2 text-xs break-all">(no match)</p>;
};

interface Props {
  inputRef?: RefObject<HTMLInputElement | null>;
}

export const BangTester = ({ inputRef }: Props) => {
  const [query, setQuery] = useState("");
  const [bangs, setBangs] = useState<BangMap | null>(null);
  const [defaultBang] = useLocalStorageString(
    LS_KEYS.DEFAULT_BANG,
    DEFAULT_BANG_SHORTCUT
  );
  const [customBangs] = useLocalStorage<BangMap>(LS_KEYS.CUSTOM_BANGS, {});

  useEffect(() => {
    let cancelled = false;
    const loadBangs = async () => {
      try {
        const m = await import("@/lib/bangs/hashbang");
        if (!cancelled) {
          setBangs(m.bangs);
        }
      } catch (error) {
        console.error("Failed to load bangs", error);
        if (!cancelled) {
          setBangs({});
        }
      }
    };
    void loadBangs();
    return () => {
      cancelled = true;
    };
  }, []);

  const preview = bangs
    ? resolveBangRedirect({
        bangs,
        customBangs,
        defaultBangShortcut: defaultBang,
        query,
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
          className="border-border bg-bg-muted text-fg focus:outline-fg-muted flex-1 rounded-md border px-3 py-2 outline-none focus:outline-2"
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Try it: !gh react"
          ref={inputRef}
          spellCheck={false}
          type="text"
          value={query}
        />
        <button
          aria-label="Run query"
          className="bg-fg text-bg rounded-md px-3 py-2 text-sm font-medium transition hover:brightness-90 active:scale-[0.97] disabled:opacity-50"
          disabled={!query.trim()}
          type="submit"
        >
          Go
        </button>
      </div>
      {query.trim() && preview ? <PreviewLine preview={preview} /> : null}
    </form>
  );
};
