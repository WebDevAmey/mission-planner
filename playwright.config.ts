import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end suite (tests/e2e). Runs against a production build:
 *
 *   pnpm build && pnpm test:e2e
 *
 * Needs a migrated and seeded database (`pnpm db:migrate && pnpm db:sign && pnpm db:seed`)
 * in DATABASE_URL; the seed user demo@example.com / password1234 signs in for most specs.
 *
 * E2E_BASE_URL points the suite at a server that is already running (nothing is started).
 * Otherwise `next start` is launched on E2E_PORT (default 3100).
 * PW_CHROMIUM_PATH selects a preinstalled Chromium binary instead of Playwright's download.
 */
const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: './tests/e2e',
  // Specs share the seeded demo account (sessions, profile name), so run them one at a time.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    acceptDownloads: true,
    // The map draws with WebGL; headless Chromium needs SwiftShader for it.
    launchOptions: {
      executablePath: process.env.PW_CHROMIUM_PATH || undefined,
      args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `pnpm exec next start -p ${port}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: 'pipe',
      },
});
