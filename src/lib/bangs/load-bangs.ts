import type { BangMap } from "../types";
import { bangMapSchema } from "./schema";

let bangsPromise: Promise<BangMap> | null = null;
const BANGS_URL = "/assets/hashbang.json";

/** Load and cache the generated search shortcut dictionary.
 * @returns The shared in-flight or completed dictionary request.
 */
// oxlint-disable-next-line typescript/promise-function-async -- Returning the cached promise directly preserves identity for concurrent callers.
export const loadBangs = (): Promise<BangMap> => {
  if (bangsPromise !== null) {
    return bangsPromise;
  }

  const promise = (async () => {
    const response = await fetch(BANGS_URL);

    if (!response.ok) {
      throw new Error(`Failed to load bangs: ${response.status}`);
    }

    const value: unknown = await response.json();

    return bangMapSchema.parse(value);
  })();

  bangsPromise = promise;

  void (async () => {
    try {
      await promise;
    } catch {
      if (bangsPromise === promise) {
        bangsPromise = null;
      }
    }
  })();

  return promise;
};
