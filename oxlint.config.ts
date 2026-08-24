import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import react from "ultracite/oxlint/react";
import tanstack from "ultracite/oxlint/tanstack";
import tanstackJsPlugins from "ultracite/oxlint/tanstack/js-plugins";
import antiSlop from "ultracite/oxlint/anti-slop";
import { jsPluginSettings, selectJsPlugins } from "ultracite/oxlint/js-plugins";

export default defineConfig({
  extends: [
    core,
    react,
    tanstack,
    tanstackJsPlugins,
    antiSlop,
    selectJsPlugins(["github", "sonarjs", "react-doctor"]),
  ],
  ignorePatterns: core.ignorePatterns,
  settings: jsPluginSettings,
});
