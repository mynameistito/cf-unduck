#!/usr/bin/env bun
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

const BANGS_URL =
  "https://raw.githubusercontent.com/kagisearch/bangs/refs/heads/main/data/bangs.json";

interface RawBang {
  ad?: string;
  d?: string;
  s?: string;
  t?: string;
  ts?: string[];
  u?: string;
}

interface RuntimeBang {
  ad?: string;
  d: string;
  s: string;
  u: string;
}

const RESERVED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const isSafeBangKey = (key: string): boolean =>
  key.trim().length > 0 && !RESERVED_KEYS.has(key);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const isCompleteBang = (
  bang: RawBang
): bang is RawBang & { d: string; s: string; t: string; u: string } => {
  if (!isNonEmptyString(bang.t) || !isNonEmptyString(bang.u)) {
    return false;
  }

  if (!isNonEmptyString(bang.s) || !isNonEmptyString(bang.d)) {
    return false;
  }

  return isSafeBangKey(bang.t);
};

const curatedSeed = {
  assistant: {
    d: "kagi.com",
    s: "Kagi Assistant",
    u: "https://kagi.com/assistant?q={{{s}}}",
  },
  fastgpt: {
    d: "kagi.com",
    s: "Kagi FastGPT",
    u: "https://kagi.com/fastgpt?q={{{s}}}",
  },
  image: {
    d: "duckduckgo.com",
    s: "Duckduckgo images",
    u: "https://duckduckgo.com/?q={{{s}}}&ia=images&iax=images&atb=v375-1",
  },
  k: {
    d: "kagi.com",
    s: "Kagi Search",
    u: "https://kagi.com/search?q={{{s}}}",
  },
  ka: {
    d: "kagi.com",
    s: "Kagi Assistant",
    u: "https://kagi.com/assistant?q={{{s}}}",
  },
  kagi: {
    d: "kagi.com",
    s: "Kagi Search",
    u: "https://kagi.com/search?q={{{s}}}",
  },
  kagii: {
    d: "kagi.com",
    s: "Kagi Images",
    u: "https://kagi.com/images?q={{{s}}}",
  },
  kagim: {
    d: "kagi.com",
    s: "Kagi Maps",
    u: "https://kagi.com/maps?q={{{s}}}",
  },
  kagin: {
    d: "kagi.com",
    s: "Kagi News",
    u: "https://kagi.com/news?q={{{s}}}",
  },
  kagip: {
    d: "kagi.com",
    s: "Kagi Podcasts",
    u: "https://kagi.com/podcasts?q={{{s}}}",
  },
  kagiv: {
    d: "kagi.com",
    s: "Kagi Videos",
    u: "https://kagi.com/videos?q={{{s}}}",
  },
  kf: {
    d: "kagi.com",
    s: "Kagi FastGPT",
    u: "https://kagi.com/fastgpt?q={{{s}}}",
  },
  ki: {
    d: "kagi.com",
    s: "Kagi Images",
    u: "https://kagi.com/images?q={{{s}}}",
  },
  km: { d: "kagi.com", s: "Kagi Maps", u: "https://kagi.com/maps?q={{{s}}}" },
  kn: { d: "kagi.com", s: "Kagi News", u: "https://kagi.com/news?q={{{s}}}" },
  kp: {
    d: "kagi.com",
    s: "Kagi Podcasts",
    u: "https://kagi.com/podcasts?q={{{s}}}",
  },
  kv: {
    d: "kagi.com",
    s: "Kagi Videos",
    u: "https://kagi.com/videos?q={{{s}}}",
  },
  m2: {
    d: "meta.dunkirk.sh",
    s: "metasearch2",
    u: "https://meta.dunkirk.sh/search?q={{{s}}}",
  },
  t3: {
    d: "www.t3.chat",
    s: "T3 Chat",
    u: "https://www.t3.chat/new?q={{{s}}}",
  },
  tiktok: {
    d: "www.tiktok.com",
    s: "TikTok",
    u: "https://www.tiktok.com/search?q={{{s}}}",
  },
} satisfies Record<string, RuntimeBang>;

const rawBangSchema = z.object({
  ad: z.string().optional(),
  d: z.string().optional(),
  s: z.string().optional(),
  t: z.string().optional(),
  ts: z.array(z.string()).optional(),
  u: z.string().optional(),
});

const addBang = (
  hashbang: Record<string, RuntimeBang>,
  bang: RawBang
): boolean => {
  if (!isCompleteBang(bang)) {
    return false;
  }

  const entry: RuntimeBang = { d: bang.d, s: bang.s, u: bang.u };

  if (bang.ad !== undefined && bang.ad !== "") {
    entry.ad = bang.ad;
  }

  hashbang[bang.t] = entry;

  for (const trigger of bang.ts ?? []) {
    if (isSafeBangKey(trigger)) {
      hashbang[trigger] = entry;
    }
  }

  return true;
};

const main = async (): Promise<void> => {
  console.log(`fetching ${BANGS_URL}`);
  const res = await fetch(BANGS_URL);

  if (!res.ok) {
    throw new Error(`fetch failed: ${res.status} ${res.statusText}`);
  }

  const text = await res.text();

  if (text.length < 1000) {
    throw new Error(`response suspiciously small: ${text.length} bytes`);
  }

  let raw: unknown;

  try {
    raw = JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`invalid JSON: ${message}`, {
      cause: error,
    });
  }

  if (!Array.isArray(raw)) {
    throw new TypeError("expected array at root");
  }

  const candidates = z.array(z.unknown()).parse(raw);
  const hashbang = Object.fromEntries(Object.entries(curatedSeed));
  let skipped = 0;

  for (const candidate of candidates) {
    const bang = rawBangSchema.safeParse(candidate);

    if (!bang.success || !addBang(hashbang, bang.data)) {
      skipped += 1;
    }
  }

  const outDir = path.join(process.cwd(), "public", "assets");
  await mkdir(outDir, { recursive: true });

  const jsonPath = path.join(outDir, "hashbang.json");
  // codeql[js/http-to-file-access] Fixed-path JSON output from validated bang records.
  await writeFile(jsonPath, JSON.stringify(hashbang));

  console.log(
    `wrote ${Object.keys(hashbang).length} bangs (${skipped} skipped) to ${jsonPath}`
  );
};

await main();
