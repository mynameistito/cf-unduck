import { useEffect, useRef, useState } from "react";

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
  MAX_HISTORY,
} from "@/lib/constants";
import { clearSearchHistory, getSearchHistory } from "@/lib/history";
import { syncPrefsCookie } from "@/lib/prefs-cookie";
import { encodeShare } from "@/lib/share-bangs";
import type { Bang, BangMap } from "@/lib/types";

interface Props {
  audio: AudioController;
  onClose: () => void;
  open: boolean;
  reducedMotion: boolean;
}

const SEARCH_DEBOUNCE_MS = 150;
const STRIP_BANG_PREFIX_RE = /^!+/u;
const KAGI_SEARCH_SUFFIX_RE = /\s*\(Kagi Search\)\s*$/iu;
const STRIP_WWW_RE = /^www\./iu;
const HAS_PROTOCOL_RE = /^https?:\/\//iu;

const deriveBaseDomain = (searchUrl: string): string => {
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
};

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

const BangForm = ({
  fields,
  onChange,
  firstFieldRef,
  idPrefix,
}: {
  fields: BangFormFields;
  onChange: (next: BangFormFields) => void;
  firstFieldRef?: React.Ref<HTMLInputElement>;
  idPrefix: string;
}) => {
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
};

const ALL_FIELDS_REQUIRED = "All fields required";

const FOCUSABLE_SEL =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const getFocusables = (root: HTMLElement | null): HTMLElement[] => {
  if (!root) {
    return [];
  }
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE_SEL)].filter(
    (el) => !el.hasAttribute("aria-hidden")
  );
};

const handleTrapTab = (e: KeyboardEvent, list: HTMLElement[]): void => {
  const [firstEl] = list;
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
};

const useFocusTrap = (
  active: boolean,
  ref: React.RefObject<HTMLElement | null>,
  onEscape: () => void
): void => {
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
};

const cleanBangFields = (
  fields: BangFormFields
): {
  shortcut: string;
  bang: Bang;
} | null => {
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
    bang: { d: trimmedBase, s: trimmedName, u: trimmedSearch },
    shortcut: cleanShortcut,
  };
};

const EMPTY_FIELDS: BangFormFields = {
  baseUrl: "",
  name: "",
  searchUrl: "",
  shortcut: "",
};

const DefaultBangSection = ({
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
}) => (
  <div className={sectionCls}>
    <h3 className={sectionHeadingCls}>Bangs</h3>
    <label
      className="text-fg block"
      htmlFor="default-bang"
      id="bang-description"
    >
      Default Bang: {bang?.s ?? "Unknown bang"}
    </label>
    <div className="relative mt-1.5">
      <input
        aria-labelledby="bang-description"
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
      <span className="text-fg-muted pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
        ↵
      </span>
    </div>
    <p className="text-fg-muted mt-2 text-sm">
      The best way to add new bangs is by submitting them on{" "}
      <a
        className="text-fg-muted hover:text-fg-strong underline"
        href="https://duckduckgo.com/newbang"
        rel="noreferrer"
        target="_blank"
      >
        DuckDuckGo
      </a>{" "}
      but you can also add them below
    </p>
  </div>
);

const BangSearchSection = ({ customBangs }: { customBangs: BangMap }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<[string, Bang][]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    const q = query.trim().toLowerCase();
    timerRef.current = setTimeout(() => {
      if (!q) {
        setResults([]);
        return;
      }
      const all: BangMap = { ...bangs, ...customBangs };
      const filtered = Object.entries(all)
        .filter(([shortcut, b]) =>
          `${shortcut} ${b.s} ${b.d}`.toLowerCase().includes(q)
        )
        .toSorted(([sa, ba], [sb, bb]) => {
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
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, [query, customBangs]);

  return (
    <div className={sectionCls}>
      <h3 className={sectionHeadingCls}>Search Bangs</h3>
      <label className="sr-only" htmlFor="bang-search">
        Search bangs
      </label>
      <input
        aria-label="Search bangs"
        className={inputCls}
        id="bang-search"
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search bangs by name or shortcut..."
        type="text"
        value={query}
      />
      {(query && results.length === 0) || results.length > 0 ? (
        <div className="border-border mt-2.5 max-h-[220px] overflow-y-auto rounded-md border">
          {query && results.length === 0 ? (
            <div className="bg-bg-muted text-fg-muted p-3 text-center">
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
                  className="border-border bg-bg-muted flex items-center gap-3 border-b px-3 py-2 last:border-b-0"
                  key={shortcut}
                >
                  <code className="bg-bg-active min-w-[60px] rounded px-1.5 py-0.5 text-xs">
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
};

const EditBangPopup = ({
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
}) => {
  const [fields, setFields] = useState<BangFormFields>({
    baseUrl: bang.d,
    name: bang.s,
    searchUrl: bang.u,
    shortcut,
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
    onSave({ bang: cleaned.bang, key: cleaned.shortcut });
  };

  return (
    <dialog
      aria-labelledby={titleId}
      aria-modal="true"
      className="text-fg fixed inset-0 z-[1100] flex h-full w-full max-w-none items-center justify-center border-0 bg-transparent p-0"
      open
    >
      <button
        aria-label="Cancel edit"
        className="absolute inset-0 h-full w-full cursor-default bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
        type="button"
      />
      <div className="border-border bg-bg relative w-[calc(100%-2rem)] max-w-[420px] rounded-lg border px-5 py-4 shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
        <button
          aria-label="Cancel edit"
          className="text-fg-muted hover:bg-bg-hover hover:text-fg absolute top-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-md leading-none transition"
          onClick={onCancel}
          type="button"
        >
          &times;
        </button>
        <h3
          className="border-border text-fg mb-3 border-b pb-2 text-base font-semibold"
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
    </dialog>
  );
};

const CustomBangsSection = ({
  audio,
  customBangs,
  onChange,
}: {
  audio: AudioController;
  customBangs: BangMap;
  onChange: (next: BangMap) => void;
}) => {
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
    audio.play("click", { from: 0.1, rate: 2 });
    onChange({ ...customBangs, [cleaned.shortcut]: cleaned.bang });
    setFields(EMPTY_FIELDS);
  };

  const remove = (key: string) => {
    audio.play("warning");
    const rest: BangMap = Object.fromEntries(
      Object.entries(customBangs).filter(([entryKey]) => entryKey !== key)
    );
    onChange(rest);
  };

  const saveEdit = (originalKey: string, next: { key: string; bang: Bang }) => {
    audio.play("click", { from: 0.1, rate: 2 });
    const rest: BangMap = Object.fromEntries(
      Object.entries(customBangs).filter(
        ([entryKey]) => entryKey !== originalKey
      )
    );
    onChange({ ...rest, [next.key]: next.bang });
    setEditingKey(null);
  };

  return (
    <div className={sectionCls}>
      <h3 className={sectionHeadingCls}>Add Custom Bang</h3>
      <div className="border-border bg-bg-muted flex flex-col gap-1.5 rounded-md border p-2">
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
          <h4 className="text-fg mt-4 mb-2 text-sm font-semibold">
            Your Custom Bangs
          </h4>
          <div className="flex flex-col gap-2">
            {Object.entries(customBangs).map(([key, b]) => (
              <div
                className="border-border bg-bg-muted flex flex-col gap-1.5 rounded-md border p-2"
                key={key}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-medium">{b.s}</span>
                  <code className="bg-bg-active rounded px-1.5 py-0.5 text-xs">
                    !{key}
                  </code>
                  <span className="text-fg-muted text-sm">{b.d}</span>
                </div>
                <div className="text-fg-muted text-sm break-all">{b.u}</div>
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
};

const SoundSection = ({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: (checked: boolean) => void;
}) => (
  <div className={sectionCls}>
    <h3 className={sectionHeadingCls}>Sound</h3>
    <label
      className="text-fg flex cursor-pointer items-center justify-between gap-2.5"
      htmlFor="sound-toggle"
    >
      <span>Enable sounds</span>
      <input
        aria-label="Enable sounds"
        checked={enabled}
        className="toggle"
        id="sound-toggle"
        onChange={(e) => onToggle(e.target.checked)}
        type="checkbox"
      />
    </label>
  </div>
);

const HistorySection = ({
  enabled,
  historyCount,
  onToggle,
  onClear,
}: {
  enabled: boolean;
  historyCount: number;
  onToggle: (checked: boolean) => void;
  onClear: () => void;
}) => (
  <div className={sectionCls}>
    <h3 className={sectionHeadingCls}>
      Search History ({historyCount}/{MAX_HISTORY})
    </h3>
    <div className="flex items-center justify-between gap-3">
      <label
        className="text-fg flex cursor-pointer items-center gap-2.5"
        htmlFor="history-toggle"
      >
        <span>Enable Search History</span>
        <input
          aria-label="Enable Search History"
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

type ImportValue = string | null | undefined | "true" | "false";

interface ImportData {
  customBangs?: ImportValue;
  defaultBang?: ImportValue;
  historyEnabled?: ImportValue;
  soundEnabled?: ImportValue;
}

const isBoolString = (v: ImportValue): v is "true" | "false" =>
  v === "true" || v === "false";

const isMissing = (v: ImportValue): boolean => v === undefined || v === null;

const isStringValue = (v: ImportValue): v is string =>
  Object.prototype.toString.call(v) === "[object String]";

const sanitizeBangMap = (value: BangMap): BangMap | null => {
  const bangsMap: BangMap = {};
  for (const [shortcut, bang] of Object.entries(value)) {
    if (!(shortcut && bang)) {
      return null;
    }
    const { ad, d, s, u } = bang;
    if (!(d && s && u)) {
      return null;
    }
    if (ad !== undefined && !ad) {
      return null;
    }
    bangsMap[shortcut] = ad === undefined ? { d, s, u } : { ad, d, s, u };
  }
  return bangsMap;
};

const parseCustomBangs = (value: string): BangMap | null => {
  try {
    const parsed: BangMap = JSON.parse(value);
    return sanitizeBangMap(parsed);
  } catch {
    return null;
  }
};

const validateImport = (d: ImportData): string | null => {
  if (!isMissing(d.defaultBang) && !isStringValue(d.defaultBang)) {
    return "Invalid defaultBang";
  }
  if (!isMissing(d.customBangs) && !isStringValue(d.customBangs)) {
    return "Invalid customBangs";
  }
  if (
    isStringValue(d.customBangs) &&
    d.customBangs &&
    !parseCustomBangs(d.customBangs)
  ) {
    return "Invalid customBangs shape";
  }
  if (!(isMissing(d.historyEnabled) || isBoolString(d.historyEnabled))) {
    return "Invalid historyEnabled";
  }
  if (!(isMissing(d.soundEnabled) || isBoolString(d.soundEnabled))) {
    return "Invalid soundEnabled";
  }
  return null;
};

const applyImport = (data: ImportData): string | null => {
  const err = validateImport(data);
  const d = data;
  if (err) {
    return err;
  }
  if (isStringValue(d.defaultBang)) {
    localStorage.setItem(LS_KEYS.DEFAULT_BANG, d.defaultBang);
  }
  if (isStringValue(d.customBangs)) {
    const parsed = parseCustomBangs(d.customBangs);
    if (!parsed) {
      return "Invalid customBangs shape";
    }
    localStorage.setItem(LS_KEYS.CUSTOM_BANGS, JSON.stringify(parsed));
  }
  if (isBoolString(d.historyEnabled)) {
    localStorage.setItem(LS_KEYS.HISTORY_ENABLED, d.historyEnabled);
  }
  if (isBoolString(d.soundEnabled)) {
    localStorage.setItem(LS_KEYS.SOUND_ENABLED, d.soundEnabled);
  }
  return null;
};

const onExport = () => {
  const settingsData = {
    customBangs: localStorage.getItem(LS_KEYS.CUSTOM_BANGS),
    defaultBang: localStorage.getItem(LS_KEYS.DEFAULT_BANG),
    exportDate: new Date().toISOString(),
    historyEnabled: localStorage.getItem(LS_KEYS.HISTORY_ENABLED),
    soundEnabled: localStorage.getItem(LS_KEYS.SOUND_ENABLED),
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

const ImportExportSection = () => {
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
      map = JSON.parse(raw);
    } catch {
      setImportError("Custom bangs corrupt");
      return;
    }
    if (Object.keys(map).length === 0) {
      setImportError("No custom bangs to share");
      return;
    }
    let token: string;
    try {
      token = await encodeShare(map);
    } catch {
      setImportError("Failed to encode share link");
      return;
    }
    const url = `${window.location.origin}/#bangs=${token}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      setImportError("Clipboard blocked — copy URL manually");
      return;
    }
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 1500);
  };

  const onImport = async (file: File) => {
    let data: ImportData;
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
          aria-label="Import settings file"
          className="hidden"
          id="import-file"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) {
              setImportError(null);
              try {
                await onImport(f);
              } catch {
                setImportError("Import failed");
              }
            }
          }}
          ref={fileRef}
          type="file"
        />
      </div>
      {importError ? (
        <p className="text-danger mt-2 text-sm" role="alert">
          {importError}
        </p>
      ) : null}
    </div>
  );
};

export const SettingsModal = ({
  open,
  onClose,
  audio,
  reducedMotion,
}: Props) => {
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
    setBangInput(shortcut);
    syncPrefsCookie();
    audio.play("click");
  };

  const history = open ? getSearchHistory() : [];

  const backdropRef = useRef<HTMLDialogElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(open, dialogRef, onClose);

  if (!open) {
    return null;
  }

  return (
    <dialog
      aria-labelledby="settings-title"
      aria-modal="true"
      className="text-fg fixed inset-0 z-[1000] h-full w-full max-w-none border-0 bg-transparent p-0"
      open
      ref={backdropRef}
    >
      <button
        aria-label="Close settings"
        className="absolute inset-0 h-full w-full cursor-default bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        type="button"
      />
      <div
        className="themed-scrollbar border-border bg-bg text-fg relative mx-auto my-[5vh] max-h-[90vh] w-[calc(100%-2rem)] max-w-[480px] overflow-y-auto rounded-lg border px-5 py-4 shadow-[0_20px_60px_rgba(0,0,0,0.4)]"
        ref={dialogRef}
      >
        <button
          aria-label="Close settings"
          className="text-fg-muted hover:bg-bg-hover hover:text-fg absolute top-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-md leading-none transition"
          onClick={onClose}
          type="button"
        >
          &times;
        </button>
        <h2
          className="border-border text-fg mb-3 border-b pb-2 text-lg font-semibold"
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
    </dialog>
  );
};
