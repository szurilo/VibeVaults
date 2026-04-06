import { defineConfig, devices } from '@playwright/test';

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Ignore non-test files in the tests directory */
  testIgnore: ['**/global-setup.ts', '**/fixtures/**', '**/utils/**', '**/*.html'],
  /* Run test files sequentially (some tests mutate shared DB state).
   * Tests within a single file can still run in parallel unless the file opts into serial mode. */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Single worker — tests mutate shared DB state (trial, subscription, etc.) */
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',

  /* Runs once before all tests: creates an authenticated browser session. */
  globalSetup: require.resolve('./tests/global-setup.ts'),
  /* Runs once after all tests: removes E2E test users from the local DB. */
  globalTeardown: require.resolve('./tests/global-teardown.ts'),

  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    baseURL: 'http://127.0.0.1:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Default auth state for all tests — uses the owner session.
     * Individual tests can override with member/client sessions via test.use(). */
    storageState: 'tests/.auth/owner.json',
  },

  /* Only run Chromium in CI to keep the suite fast and reliable. */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // Firefox and WebKit run locally only.
    // To include them: npx playwright test --project=firefox
    ...(!process.env.CI ? [
      {
        name: 'firefox',
        use: { ...devices['Desktop Firefox'] },
      },
      {
        name: 'webkit',
        use: { ...devices['Desktop Safari'] },
      },
    ] : []),
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
  },
});
