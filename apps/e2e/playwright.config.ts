import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: 1,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173',
    viewport: { width: 390, height: 844 },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    extraHTTPHeaders: {
      'x-device-hash': 'e2e-test-device-hash',
    },
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        isMobile: false,
      },
    },
    {
      name: 'webkit',
      use: {
        ...devices['iPhone 14'],
      },
    },
  ],

  webServer: {
    command: 'echo "Expecting web on :5173 and api on :3001 — start them manually with npm run dev:web / npm run dev:api"',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 5_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
