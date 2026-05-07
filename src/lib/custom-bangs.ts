import { LS_KEYS } from "./constants";
import { storage } from "./storage";
import type { BangMap } from "./types";

export function readCustomBangs(): BangMap {
  try {
    const raw = JSON.parse(storage.get(LS_KEYS.CUSTOM_BANGS) ?? "{}") as Record<
      string,
      unknown
    >;
    const out: BangMap = {};
    for (const [k, v] of Object.entries(raw)) {
      if (isBang(v)) {
        out[k.toLowerCase()] = v;
      }
    }
    return out;
  } catch {
    return {};
  }
}

function isBang(v: unknown): v is BangMap[string] {
  if (!v || typeof v !== "object") {
    return false;
  }
  const o = v as Record<string, unknown>;
  return (
    typeof o.s === "string" &&
    typeof o.u === "string" &&
    typeof o.d === "string"
  );
}
