import { z } from "zod";

import { customBangMapSchema } from "./bangs/schema";
import type { BangMap } from "./types";

const sharedBangTuple = z.tuple([
  z.string(),
  z.string(),
  z.string(),
  z.string(),
]);

const B64_PLUS_RE = /\+/gu;
const B64_SLASH_RE = /\//gu;

const bytesToB64Url = (bytes: Uint8Array): string => {
  let bin = "";
  const CHUNK = 0x80_00;

  // Chunked index loop (not for...of) so we can spread `bytes.subarray(i, i + CHUNK)`
  // into String.fromCharCode in fixed-size CHUNK windows — avoids per-byte function
  // calls and stays under the JS arg-count limit on large payloads.
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCodePoint(...bytes.subarray(i, i + CHUNK));
  }

  let encoded = btoa(bin)
    .replaceAll(B64_PLUS_RE, "-")
    .replaceAll(B64_SLASH_RE, "_");

  while (encoded.endsWith("=")) {
    encoded = encoded.slice(0, -1);
  }

  return encoded;
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

/** Encode shortcuts for sharing.
 * @param map - Shortcuts to encode.
 * @returns A compressed URL-safe token.
 */
export const encodeShare = async (map: BangMap): Promise<string> => {
  const tuples: [string, string, string, string][] = [];

  for (const [t, b] of Object.entries(map)) {
    tuples.push([t, b.s, b.u, b.d]);
  }

  const json = new TextEncoder().encode(JSON.stringify(tuples));

  return bytesToB64Url(await gzip(json));
};

/** Decode a shared shortcut token.
 * @param token - URL-safe compressed token.
 * @returns Decoded shortcuts, or null for invalid input.
 */
export const decodeShare = async (token: string): Promise<BangMap | null> => {
  try {
    const bytes = b64UrlToBytes(token);
    const json = new TextDecoder().decode(await gunzip(bytes));
    const parsed: unknown = JSON.parse(json);

    if (!Array.isArray(parsed)) {
      return null;
    }

    const out: BangMap = {};

    for (const row of parsed) {
      const tuple = sharedBangTuple.safeParse(row);

      if (!tuple.success) {
        return null;
      }

      const [t, s, u, d] = tuple.data;
      out[t] = { d, s, u };
    }

    return out;
  } catch {
    return null;
  }
};

/** Check that shortcut destinations contain valid web URLs.
 * @param m - Shortcut map to validate.
 * @returns Whether every shortcut is valid.
 */
export const isValidBangMap = (m: BangMap): boolean =>
  customBangMapSchema.safeParse(m).success;
