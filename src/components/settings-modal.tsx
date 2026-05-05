import { useEffect, useMemo, useRef, useState } from "react";
import type { AudioController } from "~/hooks/use-audio";
import {
  useLocalStorage,
  useLocalStorageString,
} from "~/hooks/use-local-storage";
import { bangs } from "~/lib/bangs/hashbang";
import {
  ANIMATION_DURATION_MS,
  DEFAULT_BANG_SHORTCUT,
  LS_KEYS,
} from "~/lib/constants";
import { clearSearchHistory, getSearchHistory } from "~/lib/history";
import type { Bang, BangMap } from "~/lib/types";

interface Props {
  audio: AudioController;
  onClose: () => void;
  open: boolean;
  reducedMotion: boolean;
}

const SEARCH_DEBOUNCE_MS = 150;
const STRIP_BANG_PREFIX_RE = /^!+/;
const KAGI_SEARCH_SUFFIX_RE = /\s*\(Kagi Search\)\s*$/i;

const sectionCls =
  "border-b border-border pb-3 mb-3 last:border-b-0 last:pb-0 last:mb-0";
const sectionHeadingCls =
  "text-xs font-semibold uppercase tracking-wide text-fg-muted mb-1.5";
const inputCls =
  "w-full rounded-md border border-border bg-bg-muted text-fg px-2.5 py-1.5 text-sm outline-none focus:outline-2 focus:outline-fg-muted placeholder:text-fg-muted";
const primaryBtnCls =
  "rounded-md bg-fg px-3 py-1.5 text-sm font-medium text-bg transition hover:brightness-90 active:scale-[0.97]";
const secondaryBtnCls =
  "rounded-md border border-border bg-bg-muted px-3 py-1.5 text-sm font-medium text-fg transition hover:bg-bg-hover active:scale-[0.97]";
const dangerBtnCls =
  "rounded-md bg-danger px-3 py-1.5 text-sm font-medium text-white transition hover:brightness-110 active:scale-[0.97]";

export function SettingsModal({ open, onClose, audio, reducedMotion }: Props) {
  const [defaultBang, setDefaultBang] = useLocalStorageString(
    LS_KEYS.DEFAULT_BANG,
    DEFAULT_BANG_SHORTCUT
  );
  const [historyEnabled, setHistoryEnabled] = useLocalStorageString(
    LS_KEYS.HISTORY_ENABLED,
    "false"
  );
  const [customBangs, setCustomBangs] = useLocalStorage<BangMap>(
    LS_KEYS.CUSTOM_BANGS,
    {}
  );

  const [bangInput, setBangInput] = useState(defaultBang);
  const [bangError, setBangError] = useState(false);

  useEffect(() => {
    setBangInput(defaultBang);
  }, [defaultBang]);

  const currentBang =
    customBangs[defaultBang] ?? bangs[defaultBang] ?? undefined;

  const onDefaultBangChange = (raw: string) => {
    const shortcut = raw.replace(STRIP_BANG_PREFIX_RE, "").toLowerCase();
    const found = customBangs[shortcut] ?? bangs[shortcut];
    if (!found) {
      setBangError(true);
      audio.play("warning");
      setTimeout(() => setBangError(false), 300);
      return;
    }
    setDefaultBang(shortcut);
    audio.play("click");
  };

  const history = useMemo(() => (open ? getSearchHistory() : []), [open]);

  const backdropRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[1000] h-full w-full text-fg"
      ref={backdropRef}
      role="dialog"
    >
      <button
        aria-label="Close settings"
        className="absolute inset-0 h-full w-full cursor-default bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        type="button"
      />
      <div className="relative mx-auto my-[5vh] max-h-[90vh] w-[calc(100%-2rem)] max-w-[480px] overflow-y-auto rounded-lg border border-border bg-bg px-5 py-4 text-fg shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
        <button
          aria-label="Close settings"
          className="absolute top-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-md text-fg-muted leading-none transition hover:bg-bg-hover hover:text-fg"
          onClick={onClose}
          type="button"
        >
          &times;
        </button>
        <h2 className="mb-3 border-border border-b pb-2 font-semibold text-fg text-lg">
          Settings
        </h2>

        <DefaultBangSection
          bang={currentBang}
          error={bangError}
          onChange={onDefaultBangChange}
          onValueChange={setBangInput}
          value={bangInput}
        />

        <BangSearchSection customBangs={customBangs} />

        <CustomBangsSection
          audio={audio}
          customBangs={customBangs}
          onChange={setCustomBangs}
          reducedMotion={reducedMotion}
        />

        <HistorySection
          audio={audio}
          enabled={historyEnabled === "true"}
          historyCount={history.length}
          onClear={() => {
            audio.play("warning");
            clearSearchHistory();
            if (reducedMotion) {
              window.location.reload();
            } else {
              setTimeout(() => window.location.reload(), ANIMATION_DURATION_MS);
            }
          }}
          onToggle={(checked) => {
            setHistoryEnabled(checked.toString());
            audio.play(checked ? "toggleOn" : "toggleOff");
          }}
        />

        <ImportExportSection />
      </div>
    </div>
  );
}

function DefaultBangSection({
  bang,
  error,
  onChange,
  value,
  onValueChange,
}: {
  bang: Bang | undefined;
  error: boolean;
  onChange: (raw: string) => void;
  value: string;
  onValueChange: (raw: string) => void;
}) {
  return (
    <div className={sectionCls}>
      <h3 className={sectionHeadingCls}>Bangs</h3>
      <label
        className="block text-fg"
        htmlFor="default-bang"
        id="bang-description"
      >
        Default Bang: {bang?.s ?? "Unknown bang"}
      </label>
      <div className="relative mt-1.5">
        <input
          className={`${inputCls} pr-9 ${error ? "shake flash-red" : ""}`}
          id="default-bang"
          onBlur={(e) => onChange(e.target.value)}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onChange(e.currentTarget.value);
            }
          }}
          type="text"
          value={value}
        />
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-fg-muted">
          ↵
        </span>
      </div>
      <p className="mt-2 text-fg-muted text-sm">
        The best way to add new bangs is by submitting them on{" "}
        <a
          className="text-fg-muted underline hover:text-fg-strong"
          href="https://duckduckgo.com/newbang"
          rel="noopener"
          target="_blank"
        >
          DuckDuckGo
        </a>{" "}
        but you can also add them below
      </p>
    </div>
  );
}

function BangSearchSection({ customBangs }: { customBangs: BangMap }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<[string, Bang][]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(timerRef.current);
    const q = query.trim().toLowerCase();
    if (!q) {
      setResults([]);
      return;
    }
    timerRef.current = setTimeout(() => {
      const all: BangMap = { ...bangs, ...customBangs };
      const filtered = Object.entries(all)
        .filter(([shortcut, b]) =>
          `${shortcut} ${b.s} ${b.d}`.toLowerCase().includes(q)
        )
        .sort(([sa, ba], [sb, bb]) => {
          const aStart = sa.startsWith(q) || ba.s.toLowerCase().startsWith(q);
          const bStart = sb.startsWith(q) || bb.s.toLowerCase().startsWith(q);
          if (aStart && !bStart) {
            return -1;
          }
          if (!aStart && bStart) {
            return 1;
          }
          return sa.length - sb.length;
        })
        .slice(0, 20);
      setResults(filtered);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timerRef.current);
  }, [query, customBangs]);

  return (
    <div className={sectionCls}>
      <h3 className={sectionHeadingCls}>Search Bangs</h3>
      <input
        className={inputCls}
        id="bang-search"
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search bangs by name or shortcut..."
        type="text"
        value={query}
      />
      {(query && results.length === 0) || results.length > 0 ? (
        <div className="mt-2.5 max-h-[220px] overflow-y-auto rounded-md border border-border">
          {query && results.length === 0 ? (
            <div className="bg-bg-muted p-3 text-center text-fg-muted">
              No bangs found
            </div>
          ) : (
            results.map(([shortcut, b]) => {
              const display = b.s.replace(
                KAGI_SEARCH_SUFFIX_RE,
                " (default search)"
              );
              return (
                <div
                  className="flex items-center gap-3 border-border border-b bg-bg-muted px-3 py-2 last:border-b-0"
                  key={shortcut}
                >
                  <code className="min-w-[60px] rounded bg-bg-active px-1.5 py-0.5 text-xs">
                    !{shortcut}
                  </code>
                  <span className="flex-1 font-medium">{display}</span>
                  <span className="text-fg-muted text-xs">{b.d}</span>
                </div>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}

function CustomBangsSection({
  audio,
  customBangs,
  onChange,
  reducedMotion,
}: {
  audio: AudioController;
  customBangs: BangMap;
  onChange: (next: BangMap) => void;
  reducedMotion: boolean;
}) {
  const [name, setName] = useState("");
  const [shortcut, setShortcut] = useState("");
  const [searchUrl, setSearchUrl] = useState("");
  const [baseUrl, setBaseUrl] = useState("");

  const reload = () => {
    if (reducedMotion) {
      window.location.reload();
    } else {
      setTimeout(() => window.location.reload(), ANIMATION_DURATION_MS);
    }
  };

  const add = () => {
    const trimmedName = name.trim();
    const cleanShortcut = shortcut
      .trim()
      .replace(STRIP_BANG_PREFIX_RE, "")
      .toLowerCase();
    const trimmedSearch = searchUrl.trim();
    const trimmedBase = baseUrl.trim();
    if (!(trimmedName && trimmedSearch && trimmedBase && cleanShortcut)) {
      return;
    }
    audio.play("click", { rate: 2, from: 0.1 });
    onChange({
      ...customBangs,
      [cleanShortcut]: { s: trimmedName, u: trimmedSearch, d: trimmedBase },
    });
    reload();
  };

  const remove = (key: string) => {
    audio.play("warning");
    const { [key]: _removed, ...rest } = customBangs;
    onChange(rest);
    reload();
  };

  const formInputCls = `${inputCls} bg-bg`;

  return (
    <div className={sectionCls}>
      <h3 className={sectionHeadingCls}>Add Custom Bang</h3>
      <div className="flex flex-col gap-1.5 rounded-md border border-border bg-bg-muted p-2">
        <input
          aria-label="Bang name"
          className={formInputCls}
          onChange={(e) => setName(e.target.value)}
          placeholder="Bang name"
          type="text"
          value={name}
        />
        <input
          aria-label="Bang shortcut"
          className={formInputCls}
          onChange={(e) => setShortcut(e.target.value)}
          placeholder="Shortcut (e.g. !ddg)"
          type="text"
          value={shortcut}
        />
        <input
          aria-label="Bang search URL"
          className={formInputCls}
          onChange={(e) => setSearchUrl(e.target.value)}
          placeholder="Search URL with {{{s}}}"
          type="text"
          value={searchUrl}
        />
        <input
          aria-label="Bang base domain"
          className={formInputCls}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="Base domain"
          type="text"
          value={baseUrl}
        />
        <div className="flex justify-end">
          <button className={primaryBtnCls} onClick={add} type="button">
            Add Bang
          </button>
        </div>
      </div>
      {Object.keys(customBangs).length > 0 ? (
        <>
          <h4 className="mt-4 mb-2 font-semibold text-fg text-sm">
            Your Custom Bangs
          </h4>
          <div className="flex flex-col gap-2">
            {Object.entries(customBangs).map(([key, b]) => (
              <div
                className="flex flex-col gap-1.5 rounded-md border border-border bg-bg-muted p-2"
                key={key}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-medium">{b.s}</span>
                  <code className="rounded bg-bg-active px-1.5 py-0.5 text-xs">
                    !{key}
                  </code>
                  <span className="text-fg-muted text-sm">{b.d}</span>
                </div>
                <div className="break-all text-fg-muted text-sm">{b.u}</div>
                <div className="flex justify-end">
                  <button
                    className={`${dangerBtnCls} px-3 py-1 text-sm`}
                    onClick={() => remove(key)}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function HistorySection({
  enabled,
  historyCount,
  onToggle,
  onClear,
}: {
  audio: AudioController;
  enabled: boolean;
  historyCount: number;
  onToggle: (checked: boolean) => void;
  onClear: () => void;
}) {
  return (
    <div className={sectionCls}>
      <h3 className={sectionHeadingCls}>Search History ({historyCount}/500)</h3>
      <div className="flex items-center justify-between gap-3">
        <label
          className="flex cursor-pointer items-center gap-2.5 text-fg"
          htmlFor="history-toggle"
        >
          <span>Enable Search History</span>
          <input
            checked={enabled}
            className="toggle"
            id="history-toggle"
            onChange={(e) => onToggle(e.target.checked)}
            type="checkbox"
          />
        </label>
        <button className={dangerBtnCls} onClick={onClear} type="button">
          Clear History
        </button>
      </div>
    </div>
  );
}

function ImportExportSection() {
  const fileRef = useRef<HTMLInputElement>(null);

  const onExport = () => {
    const settingsData = {
      defaultBang: localStorage.getItem(LS_KEYS.DEFAULT_BANG),
      customBangs: localStorage.getItem(LS_KEYS.CUSTOM_BANGS),
      historyEnabled: localStorage.getItem(LS_KEYS.HISTORY_ENABLED),
      exportDate: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(settingsData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cf-unduck-settings-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImport = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data.defaultBang) {
        localStorage.setItem(LS_KEYS.DEFAULT_BANG, data.defaultBang);
      }
      if (data.customBangs) {
        localStorage.setItem(LS_KEYS.CUSTOM_BANGS, data.customBangs);
      }
      if (data.historyEnabled !== undefined) {
        localStorage.setItem(LS_KEYS.HISTORY_ENABLED, data.historyEnabled);
      }
      window.location.reload();
    } catch (err) {
      console.error("import failed", err);
    }
  };

  return (
    <div className={sectionCls}>
      <h3 className={sectionHeadingCls}>Settings Import/Export</h3>
      <div className="mt-2 flex gap-2">
        <button className={secondaryBtnCls} onClick={onExport} type="button">
          Export Settings
        </button>
        <button
          className={secondaryBtnCls}
          onClick={() => fileRef.current?.click()}
          type="button"
        >
          Import Settings
        </button>
        <input
          accept=".json"
          className="hidden"
          id="import-file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              onImport(f).catch((err: unknown) => {
                console.error("import failed", err);
              });
            }
          }}
          ref={fileRef}
          type="file"
        />
      </div>
    </div>
  );
}
