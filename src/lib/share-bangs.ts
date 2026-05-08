import type { BangMap } from "./types";

export function decodeShare(token: string): BangMap | null {
  try {
    const b64 = token.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "===".slice((b64.length + 3) % 4);
    const bin = atob(padded);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed as BangMap;
  } catch {
    return null;
  }
}

export function isValidBangMap(m: BangMap): boolean {
  if (!m || typeof m !== "object" || Array.isArray(m)) {
    return false;
  }
  const proto = Object.getPrototypeOf(m);
  if (proto !== null && proto !== Object.prototype) {
    return false;
  }
  for (const v of Object.values(m)) {
    if (
      !(
        v &&
        typeof v === "object" &&
        !Array.isArray(v) &&
        typeof (v as { s?: unknown }).s === "string" &&
        typeof (v as { u?: unknown }).u === "string" &&
        typeof (v as { d?: unknown }).d === "string"
      )
    ) {
      return false;
    }
  }
  return true;
}
