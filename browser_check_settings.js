import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./browser_checks",
  outputDir: "./test-results",
  use: {
    baseURL: "http://127.0.0.1:4174",
    browserName: "chromium",
    channel: process.env.VOTIC_BROWSER_CHANNEL || undefined,
    headless: true,
  },
  webServer: {
    command: "node votic_server.js",
    port: 4174,
    env: { PORT: "4174" },
    reuseExistingServer: true,
  },
});
