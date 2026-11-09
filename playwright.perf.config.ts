import { defineConfig } from '@playwright/test';

// The frame-time budget test (npm run test:perf): the BUILT game (npm run build first) in a headless, phone-sized
// landscape page, CPU-throttled 4x. Kept apart from the smoke tests (playwright.config.ts) because it is slow and
// measures time; it has its own port so it can run while they do.
const PORT = 4183;

export default defineConfig({
  testDir: 'tests/perf',
  outputDir: 'test-results/perf',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 420_000,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    screenshot: 'off',
    trace: 'off',
    launchOptions: {
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
    },
  },
  webServer: {
    command: `npx vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
