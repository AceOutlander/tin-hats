/**
 * Screenshot helper for looking at the game or a dev preview page.
 *
 *   x.cmd npx tsx tools/shot.ts <urlPath> <out.png> [flags]
 *
 * urlPath   path served by Vite, e.g. "dev/art-figures.html?anim=run" or "index.html?debug=1"
 * --dist    serve the production build in dist/ (default: Vite dev server on the sources)
 * --w=844 --h=390 --dsf=2   viewport size (CSS px) and device scale factor
 * --touch   emulate a touch phone (hasTouch + isMobile)
 * --ready   wait for window.__ready === true before shooting (up to 30 s)
 * --wait=500        extra milliseconds to wait before the screenshot
 * --evalFile=x.js   run this JS file's contents in the page before the screenshot (may be async)
 * --strict  exit 1 if the page logged console errors, threw, or had failed requests
 * --timeout=30000  how long the first page load may take (the dev server's first load can be slow)
 *
 * Starts its own server on a free port and shuts everything down afterwards,
 * so several can run at once and nothing is left running.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { createServer as createNetServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, preview } from 'vite';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function freePort(): Promise<number> {
  return new Promise((ok, fail) => {
    const srv = createNetServer();
    srv.once('error', fail);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => ok(port));
    });
  });
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const positional = args.filter((a) => !a.startsWith('--'));
  const flags = new Map<string, string>();
  for (const a of args.filter((x) => x.startsWith('--'))) {
    const eq = a.indexOf('=');
    if (eq < 0) flags.set(a.slice(2), 'true');
    else flags.set(a.slice(2, eq), a.slice(eq + 1));
  }
  const urlPath = positional[0];
  const out = positional[1];
  if (!urlPath || !out) {
    console.error('usage: tsx tools/shot.ts <urlPath> <out.png> [--dist] [--w=844] [--h=390] [--dsf=2] [--touch] [--ready] [--wait=500] [--evalFile=x.js] [--strict]');
    return 2;
  }
  const width = Number(flags.get('w') ?? 844);
  const height = Number(flags.get('h') ?? 390);
  const dsf = Number(flags.get('dsf') ?? 2);
  const wait = Number(flags.get('wait') ?? 500);
  const port = await freePort();

  let close: () => Promise<void>;
  if (flags.has('dist')) {
    const srv = await preview({
      root: ROOT,
      logLevel: 'error',
      preview: { port, strictPort: true, host: '127.0.0.1' },
    });
    close = () => new Promise<void>((ok) => srv.httpServer.close(() => ok()));
  } else {
    const srv = await createServer({
      root: ROOT,
      logLevel: 'error',
      clearScreen: false,
      cacheDir: resolve(ROOT, '.tools', 'vite-cache', `shot-${process.pid}`),
      server: { port, strictPort: true, host: '127.0.0.1', hmr: false },
    });
    await srv.listen();
    close = () => srv.close();
  }

  const problems: string[] = [];
  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
  });
  try {
    const touch = flags.has('touch');
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: dsf,
      hasTouch: touch,
      isMobile: touch,
    });
    const page = await context.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') problems.push(`console.error: ${msg.text()}`);
    });
    page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
    page.on('requestfailed', (req) => problems.push(`requestfailed: ${req.url()} ${req.failure()?.errorText ?? ''}`));
    page.on('response', (res) => {
      if (res.status() >= 400) problems.push(`http ${res.status()}: ${res.url()}`);
    });

    await page.goto(`http://127.0.0.1:${port}/${urlPath.replace(/^\//, '')}`, { waitUntil: 'load', timeout: Number(flags.get('timeout') ?? 30_000) });
    if (flags.has('ready')) {
      await page.waitForFunction('window.__ready === true', undefined, { timeout: 30_000 });
    }
    const evalFile = flags.get('evalFile');
    if (evalFile) {
      const code = readFileSync(resolve(ROOT, evalFile), 'utf8');
      await page.evaluate(`(async () => { ${code}\n })()`);
    }
    await page.waitForTimeout(wait);
    const outPath = resolve(ROOT, out);
    mkdirSync(dirname(outPath), { recursive: true });
    await page.screenshot({ path: outPath });
    console.log(`saved ${outPath} (${width}x${height} @${dsf}x)`);
  } finally {
    await browser.close();
    await close();
  }
  if (problems.length > 0) {
    console.log(`page problems (${problems.length}):`);
    for (const p of problems.slice(0, 40)) console.log(`  ${p}`);
    if (flags.has('strict')) return 1;
  } else {
    console.log('page problems: none');
  }
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(err);
    process.exit(1);
  },
);
