import type { BangMap } from "./types";

const B64_PLUS_RE = /\+/g;
const B64_SLASH_RE = /\//g;
const B64_PAD_RE = /=+$/;

function bytesToB64Url(bytes: Uint8Array): string {
  let bin = "";
  const CHUNK = 0x80_00;
  // Chunked index loop (not for...of) so we can spread `bytes.subarray(i, i + CHUNK)`
  // into String.fromCharCode in fixed-size CHUNK windows — avoids per-byte function
  // calls and stays under the JS arg-count limit on large payloads.
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin)
    .replace(B64_PLUS_RE, "-")
    .replace(B64_SLASH_RE, "_")
    .replace(B64_PAD_RE, "");
}

function b64UrlToBytes(token: string): Uint8Array {
  const b64 = token.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "===".slice((b64.length + 3) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

function source(data: Uint8Array): ReadableStream<BufferSource> {
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  return new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(copy);
      controller.close();
    },
  });
}

async function gzip(data: Uint8Array): Promise<Uint8Array> {
  const stream = source(data).pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzip(data: Uint8Array): Promise<Uint8Array> {
  const stream = source(data).pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function encodeShare(map: BangMap): Promise<string> {
  const tuples: [string, string, string, string][] = [];
  for (const [t, b] of Object.entries(map)) {
    tuples.push([t, b.s, b.u, b.d]);
  }
  const json = new TextEncoder().encode(JSON.stringify(tuples));
  return bytesToB64Url(await gzip(json));
}

export async function decodeShare(token: string): Promise<BangMap | null> {
  try {
    const bytes = b64UrlToBytes(token);
    const json = new TextDecoder().decode(await gunzip(bytes));
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }
    const out = Object.create(null) as BangMap;
    for (const row of parsed) {
      if (!Array.isArray(row) || row.length !== 4) {
        return null;
      }
      // Index loop (not .some) — .some skips holes in sparse arrays, which would
      // let `undefined` slip through into the decoded map.
      for (let i = 0; i < 4; i++) {
        if (typeof row[i] !== "string") {
          return null;
        }
      }
      const [t, s, u, d] = row as [string, string, string, string];
      out[t] = { s, u, d };
    }
    return out;
  } catch {
    return null;
  }
}

export function isValidBangMap(m: BangMap): boolean {
  if (!m || typeof m !== "object" || Array.isArray(m)) {
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
