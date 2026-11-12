import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';

const cwd = resolve(__dirname, '../../..');

export default defineConfig({
  testDir: '.',
  testMatch: ['dashboard-menu.spec.ts', 'dashboard-layout.spec.ts', 'dashboard-reservations.spec.ts'],
  workers: 1,
  retries: 0,
  reporter: 'list',
  outputDir: '../../../.local/menu-browser-results',
  use: { baseURL: 'http://127.0.0.1:3100', trace: 'off', screenshot: 'off', video: 'off' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    { cwd, command: 'rtk proxy node apps/web/e2e/menu-api-fixture.cjs', url: 'http://127.0.0.1:3311/health', reuseExistingServer: false, timeout: 15000 },
    { cwd, command: 'rtk proxy node apps/web/node_modules/next/dist/bin/next start apps/web --hostname 127.0.0.1 --port 3100', url: 'http://127.0.0.1:3100', reuseExistingServer: false, timeout: 60000, env: { API_ORIGIN: 'http://127.0.0.1:3311', STAFF_ORIGIN: 'http://127.0.0.1:3100', DATABASE_URL: 'postgres://127.0.0.1:1/offline_test' } },
  ],
});
