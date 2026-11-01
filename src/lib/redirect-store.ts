import { openDB } from "idb";
import type { DBSchema, IDBPDatabase } from "idb";

import { resolveBangRedirect } from "./redirect";
import type { RedirectResult } from "./redirect";
import type { BangMap } from "./types";

/** Browser preferences needed to resolve a search without loading the app. */
export interface RedirectPreferences {
  customBangs: BangMap;
  defaultBangShortcut: string;
  historyEnabled: boolean;
}

interface RedirectDatabase extends DBSchema {
  preferences: { key: string; value: RedirectPreferences };
  counts: { key: string; value: number };
}

const DATABASE_NAME = "unduck-redirects";
const DATABASE_VERSION = 1;
const OPEN_TIMEOUT_MS = 250;

const connect = async (
  name: string
): Promise<IDBPDatabase<RedirectDatabase> | null> => {
  let expired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const opening = openDB<RedirectDatabase>(name, DATABASE_VERSION, {
      upgrade(db) {
        db.createObjectStore("preferences");
        db.createObjectStore("counts");
      },
      async blocking() {
        // Let a future application version upgrade without waiting for this tab.
        const db = await opening;
        db.close();
      },
    });
    const ready = (async () => {
      const db = await opening;
      if (expired) {
        db.close();
        return null;
      }
      return db;
    })();
    return await Promise.race([
      ready,
      // oxlint-disable-next-line promise/avoid-new -- Adapt the browser timer to bound blocked IndexedDB opens.
      new Promise<null>((resolve) => {
        timer = setTimeout(() => {
          expired = true;
          resolve(null);
        }, OPEN_TIMEOUT_MS);
      }),
    ]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};

/** Create the persistent service-worker preferences and redirect counter store. */
export const createRedirectStore = (name = DATABASE_NAME) => ({
  async sync(preferences: RedirectPreferences): Promise<boolean> {
    const db = await connect(name);
    if (!db) {
      return false;
    }
    try {
      await db.put("preferences", preferences, "current");
      return true;
    } catch {
      return false;
    } finally {
      db.close();
    }
  },

  async readCount(): Promise<number | null> {
    const db = await connect(name);
    if (!db) {
      return null;
    }
    try {
      return (await db.get("counts", "total")) ?? 0;
    } catch {
      return null;
    } finally {
      db.close();
    }
  },

  async resolve(url: URL, bangs: BangMap): Promise<RedirectResult | null> {
    const db = await connect(name);
    if (!db) {
      return null;
    }
    try {
      // Serialize preference reads and counter updates across tabs/navigations.
      const tx = db.transaction(["preferences", "counts"], "readwrite");
      const preferences = await tx.objectStore("preferences").get("current");
      if (!preferences || preferences.historyEnabled) {
        await tx.done;
        return null;
      }
      const result = resolveBangRedirect(
        {
          ...preferences,
          bangs,
          query: url.searchParams.get("q") ?? "",
        },
        url.pathname
      );
      if (result.kind === "redirect") {
        const counts = tx.objectStore("counts");
        await counts.put(((await counts.get("total")) ?? 0) + 1, "total");
      }
      await tx.done;
      return result;
    } catch {
      return null;
    } finally {
      db.close();
    }
  },
});

/** Shared browser store; opening a database is deferred until an operation. */
export const redirectStore = createRedirectStore();
