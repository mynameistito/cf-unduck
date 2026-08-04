import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

import { SITE } from "./src/site.config.ts";

const root = path.resolve(import.meta.dirname);
const CHUNK_SIZE_WARNING_LIMIT_KB = 1600;

const XML_ENTITIES: ReadonlyMap<string, string> = new Map([
  ["&", "&amp;"],
  ["<", "&lt;"],
  [">", "&gt;"],
  ['"', "&quot;"],
  ["'", "&apos;"],
]);

const escapeXml = (str: string): string => {
  let out = "";
  for (const ch of str) {
    out += XML_ENTITIES.get(ch) ?? ch;
  }
  return out;
};

const TITLE_RE = /<title>.*?<\/title>/u;
const OPENSEARCH_LINK_RE = /<link\b[^>]*?\brel="search"[\s\S]*?>/u;
const TITLE_ATTR_RE = /title="[^"]*"/u;
const CANONICAL_RE = /<link\b[^>]*?\brel="canonical"[\s\S]*?>/u;
const OG_URL_RE = /<meta\b[^>]*?\bproperty="og:url"[\s\S]*?>/u;
const OG_IMAGE_RE = /<meta\b[^>]*?\bproperty="og:image"[\s\S]*?>/u;
const OG_TITLE_RE = /<meta\b[^>]*?\bproperty="og:title"[\s\S]*?>/u;
const TWITTER_TITLE_RE = /<meta\b[^>]*?\bname="twitter:title"[\s\S]*?>/u;

const replaceOrThrow = (
  html: string,
  re: RegExp,
  replacement: string | ((m: string) => string),
  label: string
): string => {
  if (!re.test(html)) {
    throw new Error(`site-config: ${label} did not match index.html`);
  }
  return typeof replacement === "function"
    ? html.replace(re, replacement)
    : html.replace(re, replacement);
};

const siteConfigPlugin = (): Plugin => {
  const safeName = escapeXml(SITE.name);
  const safeDomain = escapeXml(SITE.domain);

  return {
    generateBundle() {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>${safeName}</ShortName>
  <Description>Fast DuckDuckGo bang redirects</Description>
  <InputEncoding>UTF-8</InputEncoding>
  <Image width="16" height="16" type="image/x-icon">https://${safeDomain}/goose.gif</Image>
  <Url type="text/html" template="https://${safeDomain}/?q={searchTerms}"/>
</OpenSearchDescription>`;

      this.emitFile({
        fileName: "opensearch.xml",
        source: xml,
        type: "asset",
      });
    },
    name: "site-config",
    transformIndexHtml(html) {
      let out = replaceOrThrow(
        html,
        TITLE_RE,
        `<title>${safeName}</title>`,
        "TITLE_RE"
      );
      out = replaceOrThrow(
        out,
        OPENSEARCH_LINK_RE,
        (match) =>
          replaceOrThrow(
            match,
            TITLE_ATTR_RE,
            `title="${safeName}"`,
            "OPENSEARCH title attr"
          ),
        "OPENSEARCH_LINK_RE"
      );
      out = replaceOrThrow(
        out,
        CANONICAL_RE,
        `<link rel="canonical" href="https://${safeDomain}/">`,
        "CANONICAL_RE"
      );
      out = replaceOrThrow(
        out,
        OG_URL_RE,
        `<meta property="og:url" content="https://${safeDomain}/">`,
        "OG_URL_RE"
      );
      out = replaceOrThrow(
        out,
        OG_IMAGE_RE,
        `<meta property="og:image" content="https://${safeDomain}/og.svg">`,
        "OG_IMAGE_RE"
      );
      out = replaceOrThrow(
        out,
        OG_TITLE_RE,
        `<meta property="og:title" content="${safeName}">`,
        "OG_TITLE_RE"
      );
      out = replaceOrThrow(
        out,
        TWITTER_TITLE_RE,
        `<meta name="twitter:title" content="${safeName}">`,
        "TWITTER_TITLE_RE"
      );
      return out;
    },
  };
};

export default defineConfig({
  build: {
    chunkSizeWarningLimit: CHUNK_SIZE_WARNING_LIMIT_KB,
    sourcemap: false,
    target: "esnext",
  },
  plugins: [
    tanstackRouter({
      autoCodeSplitting: true,
      generatedRouteTree: "./src/routeTree.gen.ts",
      routesDirectory: "./src/routes",
      target: "react",
    }),
    viteReact(),
    tailwindcss(),
    siteConfigPlugin(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,opus,gif}"],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(root, "src"),
    },
  },
});
