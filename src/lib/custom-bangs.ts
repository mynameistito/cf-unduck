import { LS_KEYS } from "./constants";
import { storage } from "./storage";
import type { BangMap } from "./types";

const UNSAFE_KEYS = new Set(["__proto__", "prototype", "constructor"]);

const isBang = (v: unknown): v is BangMap[string] => {
  if (!v || typeof v !== "object") {
    return false;
  }
  const o = v as Record<string, unknown>;
  return (
    typeof o.s === "string" &&
    typeof o.u === "string" &&
    typeof o.d === "string"
  );
};

export const readCustomBangs = (): BangMap => {
  try {
    const raw = JSON.parse(storage.get(LS_KEYS.CUSTOM_BANGS) ?? "{}") as Record<
      string,
      unknown
    >;
    const out = Object.create(null) as BangMap;
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
    return Object.create(null) as BangMap;
  }
};
