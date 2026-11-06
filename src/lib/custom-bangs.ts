import { z } from "zod";

import { bangSchema } from "./bangs/schema";
import { LS_KEYS } from "./constants";
import { storage } from "./storage";
import type { BangMap } from "./types";

const UNSAFE_KEYS = new Set(["__proto__", "prototype", "constructor"]);

const storedBangsSchema = z.record(z.string(), z.unknown());

/** Read locally saved custom shortcuts.
 * @returns The custom shortcut dictionary.
 */
export const readCustomBangs = (): BangMap => {
  try {
    const raw: unknown = JSON.parse(storage.get(LS_KEYS.CUSTOM_BANGS) ?? "{}");
    const parsed = storedBangsSchema.safeParse(raw);

    if (!parsed.success) {
      return {};
    }

    const out: BangMap = {};

    for (const [k, v] of Object.entries(parsed.data)) {
      const key = k.toLowerCase();

      if (UNSAFE_KEYS.has(key)) {
        continue;
      }

      const bang = bangSchema.safeParse(v);

      if (bang.success) {
        out[key] = bang.data;
      }
    }

    return out;
  } catch {
    return {};
  }
};
