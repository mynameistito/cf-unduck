import { Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useAudio } from "@/hooks/use-audio";
import {
  useLocalStorageBool,
  useLocalStorageString,
} from "@/hooks/use-local-storage";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { LS_KEYS } from "@/lib/constants";
import { readCustomBangs } from "@/lib/custom-bangs";
import { getSearchHistory } from "@/lib/history";
import { syncPrefsCookie } from "@/lib/prefs-cookie";
import { decodeShare, isValidBangMap } from "@/lib/share-bangs";
import { storage } from "@/lib/storage";
import type { BangMap } from "@/lib/types";
import { SITE } from "@/site.config";
import { BangTester } from "./bang-tester";
import { CopyUrl } from "./copy-url";
import { Cutie } from "./cutie";
import { TopBar } from "./top-bar";

const SettingsModal = lazy(() =>
  import("./settings-modal").then((m) => ({ default: m.SettingsModal }))
);

function shouldIgnoreShortcut(e: KeyboardEvent): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) {
    return true;
  }
  if (e.target instanceof HTMLElement) {
    return (
      e.target.tagName === "INPUT" ||
      e.target.tagName === "TEXTAREA" ||
      e.target.isContentEditable
    );
  }
  return false;
}

export function Landing() {
  const reducedMotion = usePrefersReducedMotion();
  const [soundEnabled] = useLocalStorageBool(LS_KEYS.SOUND_ENABLED, true);
  const audio = useAudio(!reducedMotion && soundEnabled);
  const [searchCount] = useLocalStorageString(LS_KEYS.SEARCH_COUNT, "0");
  const [historyEnabled] = useLocalStorageBool(LS_KEYS.HISTORY_ENABLED, false);
  const [open, setOpen] = useState(false);

  const history = historyEnabled ? getSearchHistory() : [];

  const [shareImport, setShareImport] = useState<{
    map: BangMap;
    count: number;
  } | null>(null);

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith("#bangs=")) {
      return;
    }
    let cancelled = false;
    (async () => {
      const map = await decodeShare(hash.slice("#bangs=".length));
      if (cancelled || !(map && isValidBangMap(map))) {
        return;
      }
      const count = Object.keys(map).length;
      if (count === 0) {
        return;
      }
      setShareImport({ map, count });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const acceptShareImport = () => {
    if (!shareImport) {
      return;
    }
    const existing = readCustomBangs();
    const merged = { ...existing, ...shareImport.map };
    storage.set(LS_KEYS.CUSTOM_BANGS, JSON.stringify(merged));
    syncPrefsCookie();
    setShareImport(null);
    window.location.hash = "";
  };

  const dismissShareImport = () => {
    setShareImport(null);
    window.location.hash = "";
  };

  const testerInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (open || shouldIgnoreShortcut(e)) {
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        testerInputRef.current?.focus();
      } else if (e.key === "s" && !e.shiftKey) {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="flex h-screen flex-col items-center justify-center">
      <TopBar searchCount={searchCount}>
        <button
          aria-label="Open settings"
          className={["settings-button", open ? "rotate" : ""]
            .filter(Boolean)
            .join(" ")}
          onClick={() => setOpen(true)}
          onMouseEnter={() => audio.play("spin")}
          onMouseLeave={() => audio.reset("spin")}
          type="button"
        >
          <img
            alt=""
            className="settings"
            height={24}
            src="/gear.svg"
            width={24}
          />
        </button>
      </TopBar>

      <div className="content-container">
        <Cutie reducedMotion={reducedMotion} />
        <p>
          DuckDuckGo's bang redirects are too slow. Add the following URL as a
          custom search engine to your browser. Enables{" "}
          <a
            href="https://duckduckgo.com/bang.html"
            rel="noopener"
            target="_blank"
          >
            all of DuckDuckGo's bangs.
          </a>
        </p>
        <CopyUrl audio={audio} reducedMotion={reducedMotion} />
        {shareImport ? (
          <div
            className="mt-4 flex flex-col gap-2 rounded-md border border-border bg-bg-muted p-3 text-left text-sm"
            role="alert"
          >
            <span>
              Import {shareImport.count} shared custom bang
              {shareImport.count === 1 ? "" : "s"}?
            </span>
            <div className="flex justify-end gap-2">
              <button
                className="rounded-md border border-border bg-bg px-3 py-1 text-fg text-sm transition hover:bg-bg-hover"
                onClick={dismissShareImport}
                type="button"
              >
                Dismiss
              </button>
              <button
                className="rounded-md bg-fg px-3 py-1 text-bg text-sm transition hover:brightness-90"
                onClick={acceptShareImport}
                type="button"
              >
                Import
              </button>
            </div>
          </div>
        ) : null}
        <BangTester inputRef={testerInputRef} />
        <p className="mt-2 text-fg-muted text-xs">
          Shortcuts: <kbd>/</kbd> focus tester · <kbd>s</kbd> settings
        </p>

        {historyEnabled ? (
          <>
            <h2 className="mt-6">
              <Link
                className="hover:text-fg-strong hover:underline"
                to="/history"
              >
                Recent Searches
              </Link>
            </h2>
            <div className="history-scroll max-h-[300px] overflow-y-auto text-left">
              {history.length === 0 ? (
                <div className="p-2 text-center">No search history</div>
              ) : (
                history.map((s) => (
                  <div className="border-border border-b p-2" key={s.timestamp}>
                    <a href={`?q=!${s.bang} ${s.query}`}>
                      {s.name}: {s.query}
                    </a>
                    <span className="float-right text-fg-muted">
                      {new Date(s.timestamp).toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </>
        ) : null}
      </div>

      <footer className="footer">
        made with ♥ by{" "}
        <a href={SITE.author.url} rel="noopener" target="_blank">
          {SITE.author.name}
        </a>{" "}
        —{" "}
        <a
          href={`https://github.com/${SITE.githubUser}/${SITE.repo}`}
          rel="noopener"
          target="_blank"
        >
          source
        </a>
        , forked from{" "}
        <a
          href="https://github.com/taciturnaxolotl/unduckified"
          rel="noopener"
          target="_blank"
        >
          unduckified
        </a>
      </footer>

      {open ? (
        <Suspense fallback={null}>
          <SettingsModal
            audio={audio}
            onClose={() => setOpen(false)}
            open={open}
            reducedMotion={reducedMotion}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
