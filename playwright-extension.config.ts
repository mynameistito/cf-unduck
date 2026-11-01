import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "extension.e2e.ts",
  workers: 1,
  webServer: {
    command: "bun e2e/server.ts",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
  },
});
