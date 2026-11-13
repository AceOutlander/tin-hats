/**
 * Startup budget of the BUILT game (npm run test:perf, after npm run build), on a CPU slowed 4x (roughly a mid-range
 * phone), so the game can never again freeze the browser while it loads.
 *
 * The owner's report (2026-11-12): the live game sat on LOADING and Chrome showed "Page Unresponsive". Building the
 * sprite atlas copied the whole atlas page four times for every sprite, in one piece of work: 54 s at this speed.
 * This test fails if startup ever holds the browser for more than half a second at a time, if the title takes more
 * than a few seconds to appear, or if the loading bar does not move.
 *
 * Two starts are measured, each the plain page a player opens (no debug hooks):
 * - a first visit: a fresh browser profile, no save, no service worker;
 * - a returning player: a save with everything unlocked, the service worker installed and in charge.
 * Each is measured RUNS times and the best run counts, so a moment of outside load on the machine does not fail it
 * (a long task is measured in wall time). The browser is watched for a while after the title too: the menu music and
 * anything else prepared in the background must not hold it either.
 */
import { expect, test, type Browser, type BrowserContext } from '@playwright/test';
import type { DebugApi } from '../../src/app/debug';
import { STARTUP_MARKS } from '../../src/app/startup';

type Hooked = { __TH?: DebugApi };
type Watched = { __longTasks: [number, number][]; __bar: number[] };

const CPU_THROTTLE = 4;
const RUNS = 3;
/** The longest the browser may be held at a time (ms). Measured when written: 370 to 380 (the game's script starting). */
const MAX_BLOCK_MS = 500;
/** The title must be up this soon after the page is opened (ms). Measured when written: 2000 to 2150. */
const MAX_TITLE_MS = 4000;
/** How long the page is watched after the title appears (ms). */
const SETTLE_MS = 6000;
/** The loading bar must be seen at this many different widths at least. */
const MIN_BAR_STEPS = 6;

interface Start {
  title: number;
  longest: number;
  tasks: [number, number][];
  marks: Record<string, number>;
  bar: number[];
  problems: string[];
}

function newContext(browser: Browser, baseURL: string): Promise<BrowserContext> {
  return browser.newContext({ baseURL, viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
}

/** Record every long task and every width of the loading bar, from the first moment of each page. */
async function watch(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const w = window as unknown as Watched;
    w.__longTasks = [];
    w.__bar = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) w.__longTasks.push([Math.round(e.startTime), Math.round(e.duration)]);
    }).observe({ type: 'longtask', buffered: true });
    const follow = (): void => {
      const bar = document.getElementById('boot-bar');
      if (!bar) {
        if (document.readyState !== 'complete') requestAnimationFrame(follow);
        return;
      }
      const read = (): void => {
        const v = Number(bar.getAttribute('aria-valuenow'));
        if (w.__bar[w.__bar.length - 1] !== v) w.__bar.push(v);
      };
      read();
      new MutationObserver(read).observe(bar, { attributes: true, attributeFilter: ['aria-valuenow'] });
    };
    follow();
  });
}

/** Open the plain game in a new page of `context` on the slowed CPU and measure its start. */
async function start(context: BrowserContext): Promise<Start> {
  const page = await context.newPage();
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`console error: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });
  await page.goto('/', { waitUntil: 'commit' });
  await page.waitForFunction(() => performance.getEntriesByName('th:title').length > 0, null, { timeout: 120_000, polling: 100 });
  // The title is really there: the loading screen is gone and the title screen's own parts are in the page.
  expect(await page.evaluate(() => document.getElementById('boot') === null)).toBe(true);
  await expect(page.getByTestId('title-helmet')).toBeVisible();
  // The page asks for the two big scripts as soon as it is read (vite.config.ts, preloadBigScripts), so the loader can
  // start them one after the other without fetching them one after the other.
  const preloads = await page.evaluate(() => Array.from(document.querySelectorAll('link[rel="modulepreload"]'), (l) => l.getAttribute('href') ?? ''));
  for (const name of ['phaser', 'boot']) expect(preloads.some((h) => new RegExp(`assets/${name}-[^/]+\\.js$`).test(h)), `a modulepreload link for ${name} (${preloads.join(', ')})`).toBe(true);
  await page.waitForTimeout(SETTLE_MS);
  const got = await page.evaluate((names) => {
    const w = window as unknown as Watched;
    const marks: Record<string, number> = {};
    for (const n of names) {
      const e = performance.getEntriesByName(n)[0];
      if (e) marks[n] = Math.round(e.startTime);
    }
    return { tasks: w.__longTasks, bar: w.__bar, marks };
  }, STARTUP_MARKS as readonly string[]);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await page.close();
  return {
    title: got.marks['th:title'] ?? Number.POSITIVE_INFINITY,
    longest: got.tasks.reduce((m, t) => Math.max(m, t[1]), 0),
    tasks: got.tasks,
    marks: got.marks,
    bar: got.bar,
    problems,
  };
}

function judge(label: string, runs: Start[]): void {
  for (const [i, r] of runs.entries()) {
    console.log(
      `${label} run ${i + 1}: title at ${r.title} ms, longest block ${r.longest} ms, blocks over 100 ms ${JSON.stringify(r.tasks.filter((t) => t[1] >= 100))}, ` +
        `marks ${JSON.stringify(r.marks)}, bar ${r.bar.length} steps`,
    );
  }
  for (const r of runs) {
    expect(r.problems, 'problems reported by the page').toEqual([]);
    // Every step of the boot sequence was reached, in order.
    const times = STARTUP_MARKS.map((n) => r.marks[n]);
    expect(times.every((t) => typeof t === 'number'), `every boot mark is set (${JSON.stringify(r.marks)})`).toBe(true);
    expect([...times].sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual(times);
    // The loading bar shows real progress: many steps, never backwards, full by the end.
    expect(r.bar.length, `the loading bar moved (${r.bar.join(',')})`).toBeGreaterThanOrEqual(MIN_BAR_STEPS);
    expect([...r.bar].sort((a, b) => a - b)).toEqual(r.bar);
    expect(r.bar[r.bar.length - 1]).toBeGreaterThanOrEqual(90);
  }
  const longest = Math.min(...runs.map((r) => r.longest));
  const title = Math.min(...runs.map((r) => r.title));
  expect(longest, `${label}: the longest time the browser was held (ms), best of ${runs.length} runs`).toBeLessThanOrEqual(MAX_BLOCK_MS);
  expect(title, `${label}: time to the title screen (ms), best of ${runs.length} runs`).toBeLessThanOrEqual(MAX_TITLE_MS);
}

test.describe('startup on a phone-speed CPU', () => {
  test('a first visit reaches the title in a few seconds and never holds the browser for half a second', async ({ browser, baseURL }) => {
    const runs: Start[] = [];
    for (let i = 0; i < RUNS; i++) {
      // A fresh profile every time: no save, no service worker, nothing cached.
      const context = await newContext(browser, baseURL ?? '');
      await watch(context);
      runs.push(await start(context));
      await context.close();
    }
    judge('first visit', runs);
  });

  test('a returning player with a save and the installed game starts as fast', async ({ browser, baseURL }) => {
    const context = await newContext(browser, baseURL ?? '');
    // An earlier visit: everything unlocked and saved, and the service worker installed and in charge of the page.
    const first = await context.newPage();
    await first.goto('/?debug=1');
    await first.waitForFunction(() => (window as unknown as Hooked).__TH?.ready === true, null, { timeout: 60_000 });
    const saved = await first.evaluate(async () => {
      const th = (window as unknown as Hooked).__TH as DebugApi;
      // A save with progress in it: medals are written to the save at once.
      th.giveMedals(25);
      th.unlockAll();
      await navigator.serviceWorker.ready;
      return Object.keys(window.localStorage).filter((k) => k.startsWith('tinhats.')).length;
    });
    expect(saved, 'the first visit left a save').toBeGreaterThan(0);
    await first.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 60_000 });
    await first.close();

    await watch(context);
    const runs: Start[] = [];
    for (let i = 0; i < RUNS; i++) runs.push(await start(context));
    judge('returning player', runs);
    await context.close();
  });
});
