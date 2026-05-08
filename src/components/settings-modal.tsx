import { useEffect, useMemo, useRef, useState } from "react";
import type { AudioController } from "@/hooks/use-audio";
import {
  useLocalStorage,
  useLocalStorageBool,
  useLocalStorageString,
} from "@/hooks/use-local-storage";
import { bangs } from "@/lib/bangs/hashbang";
import {
  ANIMATION_DURATION_MS,
  DEFAULT_BANG_SHORTCUT,
  LS_KEYS,
} from "@/lib/constants";
import { clearSearchHistory, getSearchHistory } from "@/lib/history";
import { syncPrefsCookie } from "@/lib/prefs-cookie";
import type { Bang, BangMap } from "@/lib/types";

interface Props {
  audio: AudioController;
  onClose: () => void;
  open: boolean;
  reducedMotion: boolean;
}

const SEARCH_DEBOUNCE_MS = 150;
const STRIP_BANG_PREFIX_RE = /^!+/;
const KAGI_SEARCH_SUFFIX_RE = /\s*\(Kagi Search\)\s*$/i;
const STRIP_WWW_RE = /^www\./i;
const HAS_PROTOCOL_RE = /^https?:\/\//i;

function deriveBaseDomain(searchUrl: string): string {
  const trimmed = searchUrl.trim();
  if (!trimmed) {
    return "";
  }
  try {
    const withProtocol = HAS_PROTOCOL_RE.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;
    const { hostname } = new URL(withProtocol);
    return hostname.replace(STRIP_WWW_RE, "");
  } catch {
    return "";
  }
}

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
const formInputCls = `${inputCls} bg-bg`;

interface BangFormFields {
  baseUrl: string;
  name: string;
  searchUrl: string;
  shortcut: string;
}

const FIELD_LABEL_CLS = "text-fg-muted text-xs";

function BangForm({
  fields,
  onChange,
  firstFieldRef,
  idPrefix,
}: {
  fields: BangFormFields;
  onChange: (next: BangFormFields) => void;
  firstFieldRef?: React.Ref<HTMLInputElement>;
  idPrefix: string;
}) {
  const set = <K extends keyof BangFormFields>(
    key: K,
    value: BangFormFields[K]
  ) => onChange({ ...fields, [key]: value });

  const nameId = `${idPrefix}-name`;
  const shortcutId = `${idPrefix}-shortcut`;
  const searchUrlId = `${idPrefix}-search-url`;
  const baseUrlId = `${idPrefix}-base-url`;

  return (
    <>
      <label className={FIELD_LABEL_CLS} htmlFor={nameId}>
        Name
      </label>
      <input
        aria-label="Bang name"
        className={formInputCls}
        id={nameId}
        onChange={(e) => set("name", e.target.value)}
        placeholder="Bang name"
        ref={firstFieldRef}
        type="text"
        value={fields.name}
      />
      <label className={FIELD_LABEL_CLS} htmlFor={shortcutId}>
        Shortcut
      </label>
      <input
        aria-label="Bang shortcut"
        className={formInputCls}
        id={shortcutId}
        onChange={(e) => set("shortcut", e.target.value)}
        placeholder="Shortcut (e.g. !ddg)"
        type="text"
        value={fields.shortcut}
      />
      <label className={FIELD_LABEL_CLS} htmlFor={searchUrlId}>
        Search URL
      </label>
      <input
        aria-label="Bang search URL"
        className={formInputCls}
        id={searchUrlId}
        onBlur={() => {
          if (!fields.baseUrl.trim()) {
            const derived = deriveBaseDomain(fields.searchUrl);
            if (derived) {
              set("baseUrl", derived);
            }
          }
        }}
        onChange={(e) => set("searchUrl", e.target.value)}
        placeholder="Search URL with {{{s}}}"
        type="text"
        value={fields.searchUrl}
      />
      <label className={FIELD_LABEL_CLS} htmlFor={baseUrlId}>
        Base domain
      </label>
      <input
        aria-label="Bang base domain"
        className={formInputCls}
        id={baseUrlId}
        onChange={(e) => set("baseUrl", e.target.value)}
        placeholder="Base domain (auto-detected)"
        type="text"
        value={fields.baseUrl}
      />
    </>
  );
}

const ALL_FIELDS_REQUIRED = "All fields required";

const FOCUSABLE_SEL =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusables(root: HTMLElement | null): HTMLElement[] {
  if (!root) {
    return [];
  }
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SEL)).filter(
    (el) => !el.hasAttribute("aria-hidden")
  );
}

function handleTrapTab(e: KeyboardEvent, list: HTMLElement[]): void {
  const firstEl = list[0];
  const lastEl = list.at(-1);
  if (!(firstEl && lastEl)) {
    return;
  }
  if (e.shiftKey && document.activeElement === firstEl) {
    e.preventDefault();
    lastEl.focus();
  } else if (!e.shiftKey && document.activeElement === lastEl) {
    e.preventDefault();
    firstEl.focus();
  }
}

function useFocusTrap(
  active: boolean,
  ref: React.RefObject<HTMLElement | null>,
  onEscape: () => void
): void {
  const onEscapeRef = useRef(onEscape);
  useEffect(() => {
    onEscapeRef.current = onEscape;
  });
  useEffect(() => {
    if (!active) {
      return;
    }
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    getFocusables(ref.current)[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onEscapeRef.current();
        return;
      }
      if (e.key === "Tab") {
        handleTrapTab(e, getFocusables(ref.current));
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, [active, ref]);
}

function cleanBangFields(fields: BangFormFields): {
  shortcut: string;
  bang: Bang;
} | null {
  const trimmedName = fields.name.trim();
  const cleanShortcut = fields.shortcut
    .trim()
    .replace(STRIP_BANG_PREFIX_RE, "")
    .toLowerCase();
  const trimmedSearch = fields.searchUrl.trim();
  const trimmedBase = fields.baseUrl.trim() || deriveBaseDomain(trimmedSearch);
  if (!(trimmedName && trimmedSearch && trimmedBase && cleanShortcut)) {
    return null;
  }
  return {
    shortcut: cleanShortcut,
    bang: { s: trimmedName, u: trimmedSearch, d: trimmedBase },
  };
}

const EMPTY_FIELDS: BangFormFields = {
  name: "",
  shortcut: "",
  searchUrl: "",
  baseUrl: "",
};

export function SettingsModal({ open, onClose, audio, reducedMotion }: Props) {
  const [defaultBang, setDefaultBang] = useLocalStorageString(
    LS_KEYS.DEFAULT_BANG,
    DEFAULT_BANG_SHORTCUT
  );
  const [historyEnabled, setHistoryEnabled] = useLocalStorageBool(
    LS_KEYS.HISTORY_ENABLED,
    false
  );
  const [soundEnabled, setSoundEnabled] = useLocalStorageBool(
    LS_KEYS.SOUND_ENABLED,
    true
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
      setTimeout(() => setBangError(false), ANIMATION_DURATION_MS);
      return;
    }
    setDefaultBang(shortcut);
    syncPrefsCookie();
    audio.play("click");
  };

  const history = useMemo(() => (open ? getSearchHistory() : []), [open]);

  const backdropRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(open, dialogRef, onClose);

  if (!open) {
    return null;
  }

  return (
    <div
      aria-labelledby="settings-title"
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
      <div
        className="themed-scrollbar relative mx-auto my-[5vh] max-h-[90vh] w-[calc(100%-2rem)] max-w-[480px] overflow-y-auto rounded-lg border border-border bg-bg px-5 py-4 text-fg shadow-[0_20px_60px_rgba(0,0,0,0.4)]"
        ref={dialogRef}
      >
        <button
          aria-label="Close settings"
          className="absolute top-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-md text-fg-muted leading-none transition hover:bg-bg-hover hover:text-fg"
          onClick={onClose}
          type="button"
        >
          &times;
        </button>
        <h2
          className="mb-3 border-border border-b pb-2 font-semibold text-fg text-lg"
          id="settings-title"
        >
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
        />

        <SoundSection
          enabled={soundEnabled}
          onToggle={(checked) => {
            setSoundEnabled(checked);
            audio.play(checked ? "toggleOn" : "toggleOff", { force: true });
          }}
        />

        <HistorySection
          enabled={historyEnabled}
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
            setHistoryEnabled(checked);
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
}: {
  audio: AudioController;
  customBangs: BangMap;
  onChange: (next: BangMap) => void;
}) {
  const [fields, setFields] = useState<BangFormFields>(EMPTY_FIELDS);
  const [addError, setAddError] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const updateFields = (next: BangFormFields) => {
    setAddError(null);
    setFields(next);
  };

  const add = () => {
    const cleaned = cleanBangFields(fields);
    if (!cleaned) {
      setAddError(ALL_FIELDS_REQUIRED);
      audio.play("warning");
      return;
    }
    setAddError(null);
    audio.play("click", { rate: 2, from: 0.1 });
    onChange({ ...customBangs, [cleaned.shortcut]: cleaned.bang });
    setFields(EMPTY_FIELDS);
  };

  const remove = (key: string) => {
    audio.play("warning");
    const { [key]: _removed, ...rest } = customBangs;
    onChange(rest);
  };

  const saveEdit = (originalKey: string, next: { key: string; bang: Bang }) => {
    audio.play("click", { rate: 2, from: 0.1 });
    const { [originalKey]: _removed, ...rest } = customBangs;
    onChange({ ...rest, [next.key]: next.bang });
    setEditingKey(null);
  };

  return (
    <div className={sectionCls}>
      <h3 className={sectionHeadingCls}>Add Custom Bang</h3>
      <div className="flex flex-col gap-1.5 rounded-md border border-border bg-bg-muted p-2">
        <BangForm fields={fields} idPrefix="add-bang" onChange={updateFields} />
        {addError ? (
          <p className="text-danger text-sm" role="alert">
            {addError}
          </p>
        ) : null}
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
                <div className="flex justify-end gap-2">
                  <button
                    className={`${secondaryBtnCls} px-3 py-1 text-sm`}
                    onClick={() => setEditingKey(key)}
                    type="button"
                  >
                    Edit
                  </button>
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
      {editingKey !== null && customBangs[editingKey] ? (
        <EditBangPopup
          bang={customBangs[editingKey]}
          existingKeys={Object.keys(customBangs)}
          onCancel={() => setEditingKey(null)}
          onSave={(next) => saveEdit(editingKey, next)}
          shortcut={editingKey}
        />
      ) : null}
    </div>
  );
}

function EditBangPopup({
  bang,
  shortcut,
  existingKeys,
  onSave,
  onCancel,
}: {
  bang: Bang;
  shortcut: string;
  existingKeys: string[];
  onSave: (next: { key: string; bang: Bang }) => void;
  onCancel: () => void;
}) {
  const [fields, setFields] = useState<BangFormFields>({
    name: bang.s,
    shortcut,
    searchUrl: bang.u,
    baseUrl: bang.d,
  });
  const [error, setError] = useState<string | null>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const titleId = "edit-bang-title";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        onCancel();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onCancel]);

  useEffect(() => {
    firstFieldRef.current?.focus();
    firstFieldRef.current?.select();
  }, []);

  const submit = () => {
    const cleaned = cleanBangFields(fields);
    if (!cleaned) {
      setError(ALL_FIELDS_REQUIRED);
      return;
    }
    if (
      cleaned.shortcut !== shortcut &&
      existingKeys.includes(cleaned.shortcut)
    ) {
      setError("Shortcut already exists");
      return;
    }
    onSave({ key: cleaned.shortcut, bang: cleaned.bang });
  };

  return (
    <div
      aria-labelledby={titleId}
      aria-modal="true"
      className="fixed inset-0 z-[1100] flex h-full w-full items-center justify-center text-fg"
      role="dialog"
    >
      <button
        aria-label="Cancel edit"
        className="absolute inset-0 h-full w-full cursor-default bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
        type="button"
      />
      <div className="relative w-[calc(100%-2rem)] max-w-[420px] rounded-lg border border-border bg-bg px-5 py-4 shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
        <button
          aria-label="Cancel edit"
          className="absolute top-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-md text-fg-muted leading-none transition hover:bg-bg-hover hover:text-fg"
          onClick={onCancel}
          type="button"
        >
          &times;
        </button>
        <h3
          className="mb-3 border-border border-b pb-2 font-semibold text-base text-fg"
          id={titleId}
        >
          Edit Custom Bang
        </h3>
        <div className="flex flex-col gap-1.5">
          <BangForm
            fields={fields}
            firstFieldRef={firstFieldRef}
            idPrefix="edit-bang"
            onChange={(next) => {
              setError(null);
              setFields(next);
            }}
          />
          {error ? (
            <p className="text-danger text-sm" role="alert">
              {error}
            </p>
          ) : null}
          <div className="mt-1 flex justify-end gap-2">
            <button
              className={secondaryBtnCls}
              onClick={onCancel}
              type="button"
            >
              Cancel
            </button>
            <button className={primaryBtnCls} onClick={submit} type="button">
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SoundSection({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: (checked: boolean) => void;
}) {
  return (
    <div className={sectionCls}>
      <h3 className={sectionHeadingCls}>Sound</h3>
      <label
        className="flex cursor-pointer items-center justify-between gap-2.5 text-fg"
        htmlFor="sound-toggle"
      >
        <span>Enable sounds</span>
        <input
          checked={enabled}
          className="toggle"
          id="sound-toggle"
          onChange={(e) => onToggle(e.target.checked)}
          type="checkbox"
        />
      </label>
    </div>
  );
}

function HistorySection({
  enabled,
  historyCount,
  onToggle,
  onClear,
}: {
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

function isBoolString(v: unknown): v is "true" | "false" {
  return v === "true" || v === "false";
}

function isMissing(v: unknown): boolean {
  return v === undefined || v === null;
}

function validateImport(d: Record<string, unknown>): string | null {
  if (!isMissing(d.defaultBang) && typeof d.defaultBang !== "string") {
    return "Invalid defaultBang";
  }
  if (!isMissing(d.customBangs) && typeof d.customBangs !== "string") {
    return "Invalid customBangs";
  }
  if (typeof d.customBangs === "string" && d.customBangs) {
    try {
      const parsed = JSON.parse(d.customBangs) as unknown;
      if (!parsed || typeof parsed !== "object") {
        return "Invalid customBangs shape";
      }
    } catch {
      return "Invalid customBangs JSON";
    }
  }
  if (!(isMissing(d.historyEnabled) || isBoolString(d.historyEnabled))) {
    return "Invalid historyEnabled";
  }
  if (!(isMissing(d.soundEnabled) || isBoolString(d.soundEnabled))) {
    return "Invalid soundEnabled";
  }
  return null;
}

function applyImport(data: unknown): string | null {
  if (!data || typeof data !== "object") {
    return "Invalid file";
  }
  const d = data as Record<string, unknown>;
  const err = validateImport(d);
  if (err) {
    return err;
  }
  if (typeof d.defaultBang === "string") {
    localStorage.setItem(LS_KEYS.DEFAULT_BANG, d.defaultBang);
  }
  if (typeof d.customBangs === "string") {
    localStorage.setItem(LS_KEYS.CUSTOM_BANGS, d.customBangs);
  }
  if (isBoolString(d.historyEnabled)) {
    localStorage.setItem(LS_KEYS.HISTORY_ENABLED, d.historyEnabled);
  }
  if (isBoolString(d.soundEnabled)) {
    localStorage.setItem(LS_KEYS.SOUND_ENABLED, d.soundEnabled);
  }
  return null;
}

const B64_PLUS_RE = /\+/g;
const B64_SLASH_RE = /\//g;
const B64_PAD_RE = /=+$/;

function encodeShare(map: BangMap): string {
  const bytes = new TextEncoder().encode(JSON.stringify(map));
  let bin = "";
  for (const b of bytes) {
    bin += String.fromCharCode(b);
  }
  return btoa(bin)
    .replace(B64_PLUS_RE, "-")
    .replace(B64_SLASH_RE, "_")
    .replace(B64_PAD_RE, "");
}

function ImportExportSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  const onShare = async () => {
    const raw = localStorage.getItem(LS_KEYS.CUSTOM_BANGS);
    if (!raw) {
      setImportError("No custom bangs to share");
      return;
    }
    let map: BangMap;
    try {
      map = JSON.parse(raw) as BangMap;
    } catch {
      setImportError("Custom bangs corrupt");
      return;
    }
    if (Object.keys(map).length === 0) {
      setImportError("No custom bangs to share");
      return;
    }
    const url = `${window.location.origin}/#bangs=${encodeShare(map)}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      setImportError("Clipboard blocked — copy URL manually");
      return;
    }
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 1500);
  };

  const onExport = () => {
    const settingsData = {
      defaultBang: localStorage.getItem(LS_KEYS.DEFAULT_BANG),
      customBangs: localStorage.getItem(LS_KEYS.CUSTOM_BANGS),
      historyEnabled: localStorage.getItem(LS_KEYS.HISTORY_ENABLED),
      soundEnabled: localStorage.getItem(LS_KEYS.SOUND_ENABLED),
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
    let data: unknown;
    try {
      data = JSON.parse(await file.text());
    } catch {
      setImportError("Invalid JSON");
      return;
    }
    const err = applyImport(data);
    if (err) {
      setImportError(err);
      return;
    }
    window.location.reload();
  };

  return (
    <div className={sectionCls}>
      <h3 className={sectionHeadingCls}>Settings Import/Export</h3>
      <div className="mt-2 flex flex-wrap gap-2">
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
        <button className={secondaryBtnCls} onClick={onShare} type="button">
          {shareCopied ? "Link copied!" : "Share custom bangs"}
        </button>
        <input
          accept=".json"
          className="hidden"
          id="import-file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              setImportError(null);
              onImport(f).catch(() => setImportError("Import failed"));
            }
          }}
          ref={fileRef}
          type="file"
        />
      </div>
      {importError ? (
        <p className="mt-2 text-danger text-sm" role="alert">
          {importError}
        </p>
      ) : null}
    </div>
  );
}
