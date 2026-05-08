import type { BangMap } from "./types";

export function decodeShare(token: string): BangMap | null {
  try {
    const b64 = token.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "===".slice((b64.length + 3) % 4);
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
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
  for (const v of Object.values(m)) {
    if (
      !(
        v &&
        typeof v === "object" &&
        typeof v.s === "string" &&
        typeof v.u === "string" &&
        typeof v.d === "string"
      )
    ) {
      return false;
    }
  }
  return true;
}
