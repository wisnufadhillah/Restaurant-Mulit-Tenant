import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./apps/web/e2e",
  workers: 1,
  retries: 0,
  reporter: "list",
  outputDir: ".local/browser-results",
  use: { baseURL: "http://127.0.0.1:3100", trace: "off", screenshot: "off", video: "off" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: { command: "node apps/web/node_modules/next/dist/bin/next start apps/web --hostname 127.0.0.1 --port 3100", url: "http://127.0.0.1:3100", reuseExistingServer: false, timeout: 60000 },
});
