const isBrowser = typeof window !== "undefined";

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
    if (e.key) {
      notify(e.key);
    }
  });
}

export const storage = {
  get: (key: string): string | null => {
    if (!isBrowser) {
      return null;
    }
    return localStorage.getItem(key);
  },
  set: (key: string, value: string): void => {
    if (!isBrowser) {
      return;
    }
    localStorage.setItem(key, value);
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
