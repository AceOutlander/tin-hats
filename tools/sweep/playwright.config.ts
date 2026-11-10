import { defineConfig } from '@playwright/test';

/**
 * The screenshot sweep (tools/sweep/sweep.spec.ts): every Stalingrad screen and battle, for looking at by eye. Not a test
 * suite (it asserts nothing but that the screens open); run it after `npm run build`:
 *
 *   x.cmd npx playwright test -c tools/sweep/playwright.config.ts
 *
 * Pictures go to docs/screenshots/sweep/ (git-ignored), or docs/screenshots/sweep-<SWEEP_TAG>/ with SWEEP_TAG set.
 */
const PORT = 4173;

export default defineConfig({
  testDir: '.',
  outputDir: '../../test-results/sweep',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 1_800_000,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
    trace: 'off',
    launchOptions: {
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
    },
  },
  webServer: {
    command: 'npm run preview',
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
