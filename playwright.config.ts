import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', workers: 1, timeout: 60_000,
  expect: { timeout: 10_000 },
  use: { baseURL: 'http://127.0.0.1:5188', channel: 'chrome', viewport: { width: 1440, height: 900 }, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'npm run dev -- --port 5188', url: 'http://127.0.0.1:5188', reuseExistingServer: true, timeout: 30_000 },
  projects: [{ name: 'desktop-chrome' }],
});
