import type { BangMap } from "../types";

let bangsPromise: Promise<BangMap> | undefined;
const BANGS_URL = "/assets/hashbang.json";

export const loadBangs = (): Promise<BangMap> => {
  if (!bangsPromise) {
    bangsPromise = (async () => {
      const response = await fetch(BANGS_URL);
      if (!response.ok) {
        throw new Error(`Failed to load bangs: ${response.status}`);
      }
      // SAFETY: fetch-bangs.ts generates this asset from validated bang records.
      return (await response.json()) as BangMap;
    })();
  }
  return bangsPromise;
};
