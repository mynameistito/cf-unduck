import { LS_KEYS } from "./constants";
import { redirectStore } from "./redirect-store";

const isBrowser = "window" in globalThis;
let serviceWorkerCount = 0;

type Listener = () => void;

const listeners = new Map<string, Set<Listener>>();

const notify = (key: string): void => {
  const set = listeners.get(key);

  if (!set) {
    return;
  }

  for (const fn of set) {
    fn();
  }
};

if (isBrowser) {
  window.addEventListener("storage", (e) => {
    if (e.key !== null && e.key !== "") {
      notify(e.key);
    }
  });
}

export const storage = {
  get: (key: string): string | null => {
    if (!isBrowser) {
      return null;
    }

    const value = localStorage.getItem(key);

    if (key === LS_KEYS.SEARCH_COUNT) {
      const count = Number(value ?? "0");

      return String((Number.isFinite(count) ? count : 0) + serviceWorkerCount);
    }

    return value;
  },
  set: (key: string, value: string): void => {
    if (!isBrowser) {
      return;
    }

    const storedValue =
      key === LS_KEYS.SEARCH_COUNT
        ? String(Number(value) - serviceWorkerCount)
        : value;

    localStorage.setItem(key, storedValue);
    notify(key);
  },
  subscribe: (key: string, listener: Listener): (() => void) => {
    let set = listeners.get(key);

    if (!set) {
      set = new Set();
      listeners.set(key, set);
    }

    set.add(listener);

    return () => {
      set?.delete(listener);
    };
  },
};

/** Refresh the persistent fast-path count without copying it into localStorage. */
export const refreshServiceWorkerCount = async (): Promise<void> => {
  const count = await redirectStore.readCount();

  if (count !== null && count !== serviceWorkerCount) {
    serviceWorkerCount = count;
    notify(LS_KEYS.SEARCH_COUNT);
  }
};
