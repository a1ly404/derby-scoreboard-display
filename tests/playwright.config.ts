import { defineConfig } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: '.',
  testMatch: ['**/*.spec.ts'],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // tests share a server
  retries: 1,
  workers: 1, // single WS server
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  use: {
    screenshot: 'on',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  outputDir: path.join(__dirname, 'artifacts', 'results'),
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        viewport: { width: 1920, height: 1080 },
      },
    },
  ],
});
