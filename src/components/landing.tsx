import { lazy, Suspense, useState } from "react";
import { useAudio } from "~/hooks/use-audio";
import { useLocalStorageString } from "~/hooks/use-local-storage";
import { usePrefersReducedMotion } from "~/hooks/use-prefers-reduced-motion";
import { LS_KEYS } from "~/lib/constants";
import { getSearchHistory } from "~/lib/history";
import { CopyUrl } from "./copy-url";
import { Cutie } from "./cutie";

const SettingsModal = lazy(() =>
  import("./settings-modal").then((m) => ({ default: m.SettingsModal }))
);

export function Landing() {
  const reducedMotion = usePrefersReducedMotion();
  const audio = useAudio(!reducedMotion);
  const [searchCount] = useLocalStorageString(LS_KEYS.SEARCH_COUNT, "0");
  const [historyEnabled] = useLocalStorageString(
    LS_KEYS.HISTORY_ENABLED,
    "false"
  );
  const [open, setOpen] = useState(false);

  const history = historyEnabled === "true" ? getSearchHistory() : [];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
      }}
    >
      <header style={{ position: "absolute", top: "1rem", width: "100%" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "0 1rem",
          }}
        >
          <span>
            {searchCount} {searchCount === "1" ? "search" : "searches"}
          </span>
          <button
            aria-label="Open settings"
            className={`settings-button${open ? "rotate" : ""}`}
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
        </div>
      </header>

      <div className="content-container">
        <Cutie />
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

        {historyEnabled === "true" ? (
          <>
            <h2 style={{ marginTop: 24 }}>Recent Searches</h2>
            <div
              style={{
                maxHeight: 200,
                overflowY: "auto",
                textAlign: "left",
              }}
            >
              {history.length === 0 ? (
                <div style={{ padding: 8, textAlign: "center" }}>
                  No search history
                </div>
              ) : (
                history.map((s) => (
                  <div
                    key={s.timestamp}
                    style={{
                      padding: 8,
                      borderBottom: "1px solid var(--border-color)",
                    }}
                  >
                    <a href={`?q=!${s.bang} ${s.query}`}>
                      {s.name}: {s.query}
                    </a>
                    <span
                      style={{
                        float: "right",
                        color: "var(--text-color-secondary)",
                      }}
                    >
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
          href="https://github.com/mynameistito"
          rel="noopener"
          target="_blank"
        >
          mynameistito
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
