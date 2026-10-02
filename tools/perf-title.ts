/**
 * Title screen cost: the title with its storm on and off, at several window sizes and CPU throttles, in headless
 * Chromium (software WebGL, so Phaser's draw time is informational; the JS cost and the main-thread CPU are what count).
 *
 *   x.cmd npx tsx tools/perf-title.ts [--dist[=dist]] [--seconds=6] [--warmup=3] [--sizes=1920x1080@1,844x390@2] [--cpu=1,4]
 *
 * For every size and throttle it reports, storm off then on: frames per second, the frame handler's JS ms per frame
 * (window.__THPERF: everything the app and the view do for a frame, the storm included), Phaser's draw, the
 * main-thread CPU per frame (CDP ThreadTime: script, style, layout, paint), the game objects in the scene and the
 * storm's own counts. --dist serves a production build (default: the Vite dev server on the sources, what the owner
 * runs with npm run dev). --budget=N exits 1 when the storm adds more than N ms of JS per frame anywhere.
 */
import { chromium, type CDPSession, type Page } from '@playwright/test';
import { createServer as createNetServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, preview } from 'vite';
import type { DebugApi } from '../src/app/debug';
import type { PerfHook } from '../src/render/view';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

type Hooked = { __TH: DebugApi; __THPERF: PerfHook };

function flagsOf(): Map<string, string> {
  const flags = new Map<string, string>();
  for (const a of process.argv.slice(2)) {
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq < 0) flags.set(a.slice(2), 'true');
    else flags.set(a.slice(2, eq), a.slice(eq + 1));
  }
  return flags;
}

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

const sleep = (ms: number): Promise<void> => new Promise((ok) => setTimeout(ok, ms));

async function threadTime(cdp: CDPSession): Promise<number> {
  const { metrics } = await cdp.send('Performance.getMetrics');
  return metrics.find((m) => m.name === 'ThreadTime')?.value ?? 0;
}

interface Measure {
  fps: number;
  jsAvg: number;
  jsP95: number;
  renderAvg: number;
  drawAvg: number;
  intervalAvg: number;
  cpuPerFrame: number;
  images: number;
  visible: number;
  drops: number[];
  splashes: number;
  canvas: string;
}

async function measure(page: Page, cdp: CDPSession, seconds: number): Promise<Measure> {
  await page.evaluate(() => (window as unknown as Hooked).__THPERF.reset());
  const t0 = await threadTime(cdp);
  await sleep(seconds * 1000);
  const t1 = await threadTime(cdp);
  return page.evaluate(
    ([secs, cpu]) => {
      const w = window as unknown as Hooked;
      const r = w.__THPERF.report();
      const s = w.__THPERF.stats();
      const m = w.__TH.menuStorm.stats();
      return {
        fps: r.frames / secs,
        jsAvg: r.js.avg,
        jsP95: r.js.p95,
        renderAvg: r.render.avg,
        drawAvg: r.draw.avg,
        intervalAvg: r.interval.avg,
        cpuPerFrame: (cpu * 1000) / Math.max(1, r.frames),
        images: s.images,
        visible: s.imagesVisible,
        drops: m.running ? m.drops : [0, 0, 0],
        splashes: m.running ? m.splashes : 0,
        canvas: `${s.canvasW}x${s.canvasH}`,
      };
    },
    [seconds, t1 - t0] as [number, number],
  );
}

function line(label: string, m: Measure): string {
  const f = (n: number, d = 2): string => n.toFixed(d).padStart(6);
  return (
    `  ${label.padEnd(9)} ${f(m.fps, 1)} fps  JS ${f(m.jsAvg)} ms (p95 ${f(m.jsP95)}, view ${f(m.renderAvg)})  draw ${f(m.drawAvg)}  ` +
    `interval ${f(m.intervalAvg, 1)}  main-thread CPU ${f(m.cpuPerFrame)} ms/frame  objects ${m.images} (${m.visible} visible)  ` +
    `drops ${m.drops.join('+')} splashes ${m.splashes}  canvas ${m.canvas}`
  );
}

async function main(): Promise<number> {
  const flags = flagsOf();
  const seconds = Number(flags.get('seconds') ?? 6);
  const warmup = Number(flags.get('warmup') ?? 3);
  const budget = flags.has('budget') ? Number(flags.get('budget')) : Infinity;
  const sizes = (flags.get('sizes') ?? '1920x1080@1,844x390@2').split(',').map((s) => {
    const m = /^(\d+)x(\d+)@([\d.]+)$/.exec(s.trim());
    if (!m) throw new Error(`bad size ${s}`);
    return { w: Number(m[1]), h: Number(m[2]), dsf: Number(m[3]) };
  });
  const cpus = (flags.get('cpu') ?? '1,4').split(',').map(Number);
  const port = await freePort();
  let close: () => Promise<void>;
  if (flags.has('dist')) {
    const outDir = flags.get('dist') === 'true' ? 'dist' : (flags.get('dist') as string);
    const srv = await preview({ root: ROOT, logLevel: 'error', build: { outDir }, preview: { port, strictPort: true, host: '127.0.0.1' } });
    close = () => new Promise<void>((ok) => srv.httpServer.close(() => ok()));
  } else {
    const srv = await createServer({
      root: ROOT,
      logLevel: 'error',
      clearScreen: false,
      cacheDir: resolve(ROOT, '.tools', 'vite-cache', `perf-title-${process.pid}`),
      server: { port, strictPort: true, host: '127.0.0.1', hmr: false },
    });
    await srv.listen();
    close = () => srv.close();
  }
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  let worst = 0;
  const problems: string[] = [];
  try {
    console.log(`title screen, ${flags.has('dist') ? 'production build' : 'Vite dev server'}, ${seconds} s per measurement after ${warmup} s`);
    for (const size of sizes) {
      for (const cpu of cpus) {
        const mobile = flags.has('mobile') ? flags.get('mobile') !== 'false' : size.w < 1200;
        const context = await browser.newContext({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: size.dsf, hasTouch: mobile, isMobile: mobile });
        const page = await context.newPage();
        page.on('console', (m) => {
          if (m.type() === 'error') problems.push(`console error: ${m.text()}`);
        });
        page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
        await page.goto(`http://127.0.0.1:${port}/?debug=1`);
        await page.waitForFunction(() => (window as unknown as Hooked).__TH?.ready === true, null, { timeout: 90_000 });
        const cdp = await context.newCDPSession(page);
        await cdp.send('Performance.enable');
        if (flags.has('quality')) await page.evaluate((q) => (window as unknown as Hooked).__THPERF.forceQuality(q), Number(flags.get('quality')));
        if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
        // Storm off first (it fades out, then the scene comes down), then on.
        await page.evaluate(() => (window as unknown as Hooked).__TH.menuStorm.enable(false));
        await sleep(warmup * 1000);
        const off = await measure(page, cdp, seconds);
        await page.evaluate(() => (window as unknown as Hooked).__TH.menuStorm.enable(true));
        await sleep(warmup * 1000);
        const on = await measure(page, cdp, seconds);
        const added = on.jsAvg - off.jsAvg;
        worst = Math.max(worst, added);
        console.log(`${size.w}x${size.h} dsf ${size.dsf}, cpu x${cpu}: the storm adds ${added.toFixed(2)} ms of JS and ${(on.cpuPerFrame - off.cpuPerFrame).toFixed(2)} ms of main-thread CPU per frame`);
        console.log(line('storm off', off));
        console.log(line('storm on', on));
        await context.close();
      }
    }
  } finally {
    await browser.close();
    await close();
  }
  if (problems.length > 0) console.log(`PAGE PROBLEMS:\n  ${problems.slice(0, 20).join('\n  ')}`);
  if (Number.isFinite(budget)) {
    const pass = worst <= budget;
    console.log(`${pass ? 'PASS' : 'FAIL'}: the storm adds at most ${worst.toFixed(2)} ms of JS per frame (budget ${budget} ms)`);
    if (!pass) return 1;
  }
  return problems.length > 0 ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(err);
    process.exit(2);
  },
);
