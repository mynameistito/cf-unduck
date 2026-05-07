import { lazy, Suspense, useState } from "react";
import { useAudio } from "@/hooks/use-audio";
import {
  useLocalStorageBool,
  useLocalStorageString,
} from "@/hooks/use-local-storage";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { LS_KEYS } from "@/lib/constants";
import { getSearchHistory } from "@/lib/history";
import { SITE } from "@/site.config";
import { CopyUrl } from "./copy-url";
import { Cutie } from "./cutie";
import { TopBar } from "./top-bar";

const SettingsModal = lazy(() =>
  import("./settings-modal").then((m) => ({ default: m.SettingsModal }))
);

export function Landing() {
  const reducedMotion = usePrefersReducedMotion();
  const [soundEnabled] = useLocalStorageBool(LS_KEYS.SOUND_ENABLED, true);
  const audio = useAudio(!reducedMotion && soundEnabled);
  const [searchCount] = useLocalStorageString(LS_KEYS.SEARCH_COUNT, "0");
  const [historyEnabled] = useLocalStorageBool(LS_KEYS.HISTORY_ENABLED, false);
  const [open, setOpen] = useState(false);

  const history = historyEnabled ? getSearchHistory() : [];

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

        {historyEnabled ? (
          <>
            <h2 className="mt-6">Recent Searches</h2>
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
        <a
          href={`https://github.com/${SITE.githubUser}`}
          rel="noopener"
          target="_blank"
        >
          {SITE.githubUser}
        </a>{" "}
        — forked from{" "}
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
