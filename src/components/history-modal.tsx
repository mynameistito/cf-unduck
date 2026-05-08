import { useEffect, useMemo, useRef } from "react";
import { getSearchHistory } from "@/lib/history";

interface Props {
  onClose: () => void;
}

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

export function HistoryModal({ onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const history = useMemo(() => getSearchHistory(), []);

  useEffect(() => {
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") {
        return;
      }
      const focusables = getFocusables(dialogRef.current);
      const firstEl = focusables[0];
      const lastEl = focusables.at(-1);
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
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      aria-labelledby="history-title"
      aria-modal="true"
      className="fixed inset-0 z-[1000] flex h-full w-full items-center justify-center text-fg"
      role="dialog"
    >
      <button
        aria-label="Close history"
        className="absolute inset-0 h-full w-full cursor-default bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        type="button"
      />
      <div
        className="themed-scrollbar relative flex max-h-[90vh] w-[calc(100%-2rem)] max-w-[640px] flex-col rounded-lg border border-border bg-bg px-5 py-4 text-fg shadow-[0_20px_60px_rgba(0,0,0,0.4)]"
        ref={dialogRef}
        tabIndex={-1}
      >
        <button
          aria-label="Close history"
          className="absolute top-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-md text-fg-muted leading-none transition hover:bg-bg-hover hover:text-fg"
          onClick={onClose}
          type="button"
        >
          &times;
        </button>
        <h2
          className="mb-3 border-border border-b pb-2 font-semibold text-fg text-lg"
          id="history-title"
        >
          Recent Searches ({history.length})
        </h2>
        <div className="flex-1 overflow-y-auto text-left">
          {history.length === 0 ? (
            <div className="p-2 text-center text-fg-muted">
              No search history
            </div>
          ) : (
            history.map((s) => (
              <div className="border-border border-b p-2" key={s.timestamp}>
                <a href={`/?q=${encodeURIComponent(`!${s.bang} ${s.query}`)}`}>
                  {s.name}: {s.query}
                </a>
                <span className="float-right text-fg-muted">
                  {new Date(s.timestamp).toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
