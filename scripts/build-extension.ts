import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { SITE } from "../src/site.config";

const configuredSite = new URL(
  process.env.EXTENSION_SITE_URL ?? `https://${SITE.domain}`
);
if (
  configuredSite.protocol !== "https:" &&
  !(
    configuredSite.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(configuredSite.hostname)
  )
) {
  throw new Error(
    "The extension site must use HTTPS (HTTP is allowed on localhost)."
  );
}
const outdir = path.resolve("dist-extension");
await mkdir(outdir, { recursive: true });
const result = await Bun.build({
  entrypoints: ["extension/background.ts", "extension/content.ts"],
  outdir,
  target: "browser",
  format: "iife",
  minify: true,
  define: { EXTENSION_SITE_ORIGIN: JSON.stringify(configuredSite.origin) },
});
if (!result.success) {
  throw new AggregateError(result.logs, "Extension build failed");
}
await writeFile(
  path.resolve(outdir, "manifest.json"),
  JSON.stringify(
    {
      manifest_version: 3,
      name: `${SITE.name} — local bangs`,
      version: "0.1.0",
      description:
        "Search with locally cached bangs. Manage your preferences on the Unduck site.",
      permissions: ["storage"],
      background: { service_worker: "background.js" },
      omnibox: { keyword: "!" },
      action: { default_title: "Open Unduck settings" },
      content_scripts: [
        {
          matches: [`${configuredSite.protocol}//${configuredSite.host}/*`],
          js: ["content.js"],
          run_at: "document_idle",
        },
      ],
    },
    null,
    2
  )
);
