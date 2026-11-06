import { defineConfig } from "oxlint";
import antiSlop from "ultracite/oxlint/anti-slop";
import core from "ultracite/oxlint/core";
import { jsPluginSettings, selectJsPlugins } from "ultracite/oxlint/js-plugins";
import react from "ultracite/oxlint/react";
import shadcn from "ultracite/oxlint/shadcn";
import tanstack from "ultracite/oxlint/tanstack";
import tanstackJsPlugins from "ultracite/oxlint/tanstack/js-plugins";

const jsPlugins = selectJsPlugins([
  "github",
  "jsdoc-js",
  "sonarjs",
  "tsdoc",
  "react-doctor",
]);

export default defineConfig({
  env: core.env,
  extends: [
    antiSlop,
    core,
    react,
    shadcn,
    tanstack,
    tanstackJsPlugins,
    jsPlugins,
  ],
  ignorePatterns: [...core.ignorePatterns, "src/lib/bangs/hashbang.ts"],
  jsPlugins: [...jsPlugins.jsPlugins, ...shadcn.jsPlugins],
  options: { typeAware: true },
  settings: jsPluginSettings,
});
