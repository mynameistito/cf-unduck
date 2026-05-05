import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { SITE } from "./src/site.config";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)));

const TITLE_RE = /<title>.*?<\/title>/;
const OPENSEARCH_LINK_RE = /title=".*?"\s+href="\/opensearch\.xml"/;

function siteConfigPlugin(): Plugin {
  return {
    name: "site-config",
    generateBundle() {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>${SITE.name}</ShortName>
  <Description>Fast DuckDuckGo bang redirects</Description>
  <InputEncoding>UTF-8</InputEncoding>
  <Image width="16" height="16" type="image/x-icon">https://${SITE.domain}/goose.gif</Image>
  <Url type="text/html" template="https://${SITE.domain}/?q={searchTerms}"/>
</OpenSearchDescription>`;

      this.emitFile({
        type: "asset",
        fileName: "opensearch.xml",
        source: xml,
      });
    },
    transformIndexHtml(html) {
      return html
        .replace(TITLE_RE, `<title>${SITE.name}</title>`)
        .replace(
          OPENSEARCH_LINK_RE,
          `title="${SITE.name}"\n      href="/opensearch.xml"`
        );
    },
  };
}

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(root, "src"),
    },
  },
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/routeTree.gen.ts",
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
  build: {
    target: "esnext",
    sourcemap: false,
    chunkSizeWarningLimit: 1600,
  },
});
