/**
 * PWA checks on the production build: the manifest and its icons, the service worker (installs, takes control,
 * precaches the whole build), offline play (a reload with the network cut still boots to the title screen and a mission
 * runs), and the update flow (a new version waits while a battle runs and takes over at the next launch).
 * Needs `npm run build` first, like the other browser specs.
 */
import { copyFileSync, createReadStream, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import type { Page } from '@playwright/test';
import { arrived, expect, open, setTimeScale, startMission, state, test, waitForState } from './helpers';

/** The build under test (a copy of it is served in the update test). TH_DIST lets a run use a build made elsewhere. */
const DIST = resolve(process.env.TH_DIST ?? 'dist');
const INK = '#14150f';

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}
interface Manifest {
  name: string;
  short_name: string;
  start_url: string;
  scope: string;
  display: string;
  display_override?: string[];
  orientation: string;
  theme_color: string;
  background_color: string;
  icons: ManifestIcon[];
}

/** Width and height from a PNG's header (and the PNG signature check). */
function pngSize(bytes: Buffer): { w: number; h: number } {
  expect(bytes.subarray(0, 8).toString('hex'), 'PNG signature').toBe('89504e470d0a1a0a');
  return { w: bytes.readUInt32BE(16), h: bytes.readUInt32BE(20) };
}

/** Every file below `dir` as a '/'-separated path relative to it. */
function listFiles(dir: string, prefix = ''): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listFiles(full, `${prefix}${name}/`));
    else out.push(`${prefix}${name}`);
  }
  return out;
}

/** Wait until a service worker controls the page. */
async function controlled(page: Page): Promise<void> {
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });
}

test.describe('PWA', () => {
  test('the manifest is served and valid, and every icon exists at its size', async ({ page }) => {
    await open(page);
    const res = await page.request.get('/manifest.webmanifest');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type'] ?? '').toMatch(/manifest|json/);
    const manifest = (await res.json()) as Manifest;
    expect(manifest.name).toBe('Tin Hats');
    expect(manifest.short_name.length).toBeGreaterThan(0);
    expect(manifest.short_name.length).toBeLessThanOrEqual(12);
    expect(manifest.orientation).toBe('landscape');
    expect(['fullscreen', 'standalone']).toContain(manifest.display);
    expect(manifest.display_override ?? []).toContain('fullscreen');
    // Relative, so the build works from any sub-path and inside a Capacitor webview.
    expect(manifest.start_url).toBe('./');
    expect(manifest.scope).toBe('./');
    expect(manifest.theme_color).toBe(INK);
    expect(manifest.background_color).toBe(INK);

    const has = (size: string, purpose: string): boolean => manifest.icons.some((i) => i.sizes === size && (i.purpose ?? 'any') === purpose && i.type === 'image/png');
    expect(has('192x192', 'any')).toBe(true);
    expect(has('512x512', 'any')).toBe(true);
    expect(has('512x512', 'maskable')).toBe(true);
    for (const icon of manifest.icons) {
      const url = new URL(icon.src, new URL('/manifest.webmanifest', page.url())).href;
      const r = await page.request.get(url);
      expect(r.status(), icon.src).toBe(200);
      expect(r.headers()['content-type'] ?? '', icon.src).toContain('image/png');
      const { w, h } = pngSize(await r.body());
      expect(`${w}x${h}`, icon.src).toBe(icon.sizes);
    }

    // The page links the manifest and an iOS home screen icon of 180 px.
    const links = await page.evaluate(() => ({
      manifest: document.querySelector('link[rel="manifest"]')?.getAttribute('href') ?? '',
      apple: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href') ?? '',
      theme: document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? '',
    }));
    expect(links.manifest).toContain('manifest.webmanifest');
    expect(links.theme).toBe(INK);
    const apple = await page.request.get(new URL(links.apple, page.url()).href);
    expect(apple.status()).toBe(200);
    expect(pngSize(await apple.body())).toEqual({ w: 180, h: 180 });
  });

  test('the service worker installs, takes control and precaches the whole build', async ({ page }) => {
    await open(page);
    await controlled(page);
    const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
    expect(scope).toBe(`${new URL(page.url()).origin}/`);

    const cached = await page.evaluate(async () => {
      const paths: string[] = [];
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        for (const req of await cache.keys()) paths.push(new URL(req.url).pathname);
      }
      return paths;
    });
    const expected = listFiles(DIST).filter((f) => f !== 'sw.js' && !/^workbox-.*\.js$/.test(f));
    expect(expected.length).toBeGreaterThan(8);
    const missing = expected.filter((f) => !cached.includes(`/${f}`) && !(f === 'index.html' && cached.includes('/')));
    expect(missing, 'built files that are not in the offline cache').toEqual([]);
    // Phaser has a chunk of its own, apart from the game.
    expect(expected.some((f) => /^assets\/phaser-.*\.js$/.test(f))).toBe(true);
  });

  test('offline: a reload boots to the title screen, a mission starts and runs, and no request fails', async ({ page, context, problems }) => {
    await open(page);
    await controlled(page);
    await context.setOffline(true);
    try {
      await page.reload();
      await page.waitForFunction(() => (window as unknown as { __TH?: { ready?: boolean } }).__TH?.ready === true, null, { timeout: 60_000 });
      await expect(arrived(page, 'title')).toBeVisible();
      expect(await startMission(page, 1002)).toBe(true);
      await setTimeScale(page, 4);
      const s = await waitForState(page, 'the battle running for 30 seconds', (x) => x.inBattle && x.time >= 30, 120_000);
      expect(s.inBattle).toBe(true);
      expect(s.tick).toBeGreaterThan(100);
      expect(problems).toEqual([]);
    } finally {
      await context.setOffline(false);
    }
  });

  test('the worker never skips the wait by itself (a new version cannot interrupt a battle)', async ({ page }) => {
    const res = await page.request.get('/sw.js');
    expect(res.status()).toBe(200);
    const text = await res.text();
    const calls = [...text.matchAll(/skipWaiting\(\)/g)];
    expect(calls.length).toBeGreaterThan(0);
    // Every call sits inside the SKIP_WAITING message handler, which only the page's launch code sends.
    for (const m of calls) {
      const before = text.slice(Math.max(0, (m.index ?? 0) - 90), m.index ?? 0);
      expect(before).toContain('SKIP_WAITING');
    }
  });
});

// --- the update flow, on a throw-away copy of the build ------------------------------------------------------------

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
};

function copyTree(from: string, to: string): void {
  mkdirSync(to, { recursive: true });
  for (const name of readdirSync(from)) {
    const src = join(from, name);
    if (statSync(src).isDirectory()) copyTree(src, join(to, name));
    else copyFileSync(src, join(to, name));
  }
}

/** The worker answers 'version' messages with its own tag, so the test can tell which build controls the page. */
function tagWorker(dir: string, tag: string): void {
  const file = join(dir, 'sw.js');
  const marker = '\n;/*tag*/';
  const text = readFileSync(file, 'utf8');
  const at = text.indexOf(marker);
  const body = at >= 0 ? text.slice(0, at) : text;
  writeFileSync(file, `${body}${marker}self.addEventListener('message',(e)=>{if(e.data==='version'&&e.ports[0])e.ports[0].postMessage('${tag}')});\n`);
}
function serve(dir: string): Promise<{ server: Server; origin: string }> {
  return new Promise((ok) => {
    const server = createServer((req, res) => {
      const path = decodeURIComponent((req.url ?? '/').split('?')[0]);
      let file = join(dir, path.endsWith('/') ? `${path}index.html` : path);
      if (!existsSync(file) || statSync(file).isDirectory()) file = join(dir, 'index.html');
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
      createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => ok({ server, origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}` }));
  });
}

/** Which build controls the page: the tag its worker answers with (see tagWorker). */
async function workerTag(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      new Promise<string>((done) => {
        const c = navigator.serviceWorker.controller;
        if (!c) {
          done('none');
          return;
        }
        const channel = new MessageChannel();
        channel.port1.onmessage = (e: MessageEvent) => done(String(e.data));
        c.postMessage('version', [channel.port2]);
      }),
  );
}
test.describe('PWA update', () => {
  test('a new version waits while a battle runs and takes over at the next launch', async ({ browser }) => {
    const dir = mkdtempSync(join(tmpdir(), 'tinhats-pwa-'));
    const { server, origin } = await serve(dir);
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
    try {
      copyTree(DIST, dir);
      tagWorker(dir, 'v1');
      const first = await context.newPage();
      const failures: string[] = [];
      first.on('pageerror', (e) => failures.push(e.message));
      await first.goto(`${origin}/?debug=1`);
      await first.waitForFunction(() => (window as unknown as { __TH?: { ready?: boolean } }).__TH?.ready === true, null, { timeout: 60_000 });
      await controlled(first);
      expect(await workerTag(first)).toBe('v1');

      // A battle is running when the new version is published.
      expect(await startMission(first, 1002)).toBe(true);
      await first.evaluate(() => Reflect.set(window, '__stillHere', true));
      const before = await state(first);
      tagWorker(dir, 'v2');
      await first.evaluate(async () => {
        const reg = await navigator.serviceWorker.ready;
        await reg.update();
      });
      await first.waitForFunction(async () => (await navigator.serviceWorker.ready).waiting !== null, null, { timeout: 30_000 });

      // The new worker is installed and waiting; the battle goes on under the old one, with no reload.
      await first.waitForTimeout(1500);
      const during = await state(first);
      expect(during.inBattle).toBe(true);
      expect(during.tick).toBeGreaterThan(before.tick);
      expect(await first.evaluate(() => Reflect.get(window, '__stillHere'))).toBe(true);
      expect(await workerTag(first)).toBe('v1');

      // Next launch: close the page, open the game again. The new version is in charge, within seconds.
      await first.close();
      const second = await context.newPage();
      second.on('pageerror', (e) => failures.push(e.message));
      await second.goto(`${origin}/?debug=1`);
      await second.waitForFunction(() => (window as unknown as { __TH?: { ready?: boolean } }).__TH?.ready === true, null, { timeout: 60_000 });
      const deadline = Date.now() + 30_000;
      let tag = await workerTag(second);
      while (tag !== 'v2' && Date.now() < deadline) {
        await second.waitForTimeout(300);
        tag = await workerTag(second).catch(() => 'reloading');
      }
      expect(tag).toBe('v2');
      expect(failures).toEqual([]);
    } finally {
      await context.close();
      await new Promise<void>((done) => server.close(() => done()));
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
