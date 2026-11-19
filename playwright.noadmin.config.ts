import { defineConfig } from '@playwright/test';

// The game built WITHOUT the admin panel (docs/PLATFORM.md, "A build without the admin panel"), in a headless,
// phone-sized landscape page. The server command makes that build itself (tools/no-admin-preview.ts: the switch in
// the environment, then the game's own build), so nothing needs building first and dist is not touched. It has its
// own port so it can run beside the other configs.
//
//   x.cmd npx playwright test -c playwright.noadmin.config.ts
const PORT = 4193;

export default defineConfig({
  testDir: 'tests/noadmin',
  outputDir: 'test-results/noadmin',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 240_000,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    screenshot: 'only-on-failure',
    trace: 'off',
    launchOptions: {
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
    },
  },
  webServer: {
    command: `npx tsx tools/no-admin-preview.ts ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
