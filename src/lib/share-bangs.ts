import type { BangMap } from "./types";

const B64_PLUS_RE = /\+/gu;
const B64_SLASH_RE = /\//gu;
const B64_PAD_RE = /=+$/u;

const bytesToB64Url = (bytes: Uint8Array): string => {
  let bin = "";
  const CHUNK = 0x80_00;
  // Chunked index loop (not for...of) so we can spread `bytes.subarray(i, i + CHUNK)`
  // into String.fromCharCode in fixed-size CHUNK windows — avoids per-byte function
  // calls and stays under the JS arg-count limit on large payloads.
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCodePoint(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin)
    .replace(B64_PLUS_RE, "-")
    .replace(B64_SLASH_RE, "_")
    .replace(B64_PAD_RE, "");
};

const b64UrlToBytes = (token: string): Uint8Array => {
  const b64 = token.replaceAll("-", "+").replaceAll("_", "/");
  const padded = b64 + "===".slice((b64.length + 3) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  let i = 0;
  for (const ch of bin) {
    out[i] = ch.codePointAt(0) ?? 0;
    i += 1;
  }
  return out;
};

const source = (data: Uint8Array): ReadableStream<BufferSource> => {
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  return new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(copy);
      controller.close();
    },
  });
};

const gzip = async (data: Uint8Array): Promise<Uint8Array> => {
  const stream = source(data).pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

const gunzip = async (data: Uint8Array): Promise<Uint8Array> => {
  const stream = source(data).pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

export const encodeShare = async (map: BangMap): Promise<string> => {
  const tuples: [string, string, string, string][] = [];
  for (const [t, b] of Object.entries(map)) {
    tuples.push([t, b.s, b.u, b.d]);
  }
  const json = new TextEncoder().encode(JSON.stringify(tuples));
  return bytesToB64Url(await gzip(json));
};

export const decodeShare = async (token: string): Promise<BangMap | null> => {
  try {
    const bytes = b64UrlToBytes(token);
    const json = new TextDecoder().decode(await gunzip(bytes));
    const parsed: unknown[] = JSON.parse(json);
    if (!Array.isArray(parsed)) {
      return null;
    }
    const out: BangMap = {};
    for (const row of parsed) {
      if (!Array.isArray(row) || row.length !== 4) {
        return null;
      }
      // Index loop (not .some) — .some skips holes in sparse arrays, which would
      // let `undefined` slip through into the decoded map.
      for (let i = 0; i < 4; i += 1) {
        if (Object.prototype.toString.call(row[i]) !== "[object String]") {
          return null;
        }
      }
      const [t, s, u, d] = row;
      out[t] = { d, s, u };
    }
    return out;
  } catch {
    return null;
  }
};

export const isValidBangMap = (m: BangMap): boolean => {
  for (const v of Object.values(m)) {
    if (!(v.d && v.s && v.u)) {
      return false;
    }
  }
  return true;
};
