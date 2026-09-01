import { LS_KEYS } from "./constants";
import { storage } from "./storage";
import type { BangMap } from "./types";

const UNSAFE_KEYS = new Set(["__proto__", "prototype", "constructor"]);

const isBang = (v: BangMap[string]): boolean => Boolean(v.s && v.u && v.d);

export const readCustomBangs = (): BangMap => {
  try {
    const raw: BangMap = JSON.parse(storage.get(LS_KEYS.CUSTOM_BANGS) ?? "{}");
    const out: BangMap = {};
    for (const [k, v] of Object.entries(raw)) {
      const key = k.toLowerCase();
      if (UNSAFE_KEYS.has(key)) {
        continue;
      }
      if (isBang(v)) {
        out[key] = v;
      }
    }
    return out;
  } catch {
    return {};
  }
};
