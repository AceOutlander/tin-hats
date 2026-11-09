/**
 * Frame-time budget of a heavy battle in the BUILT game (npm run test:perf, after npm run build), so lag cannot
 * sneak back in unnoticed.
 *
 * The proving ground (every unit and support on both sides) is fast-forwarded with the test bot playing the player
 * side, both sides fed, until the armies are big and in contact; then it plays at real speed with the CPU throttled
 * 4x (roughly a mid-range phone) while the game's frame probe (window.__THPERF) records every frame.
 *
 * What is judged is the main-thread WORK of a frame (the game's JS plus Phaser's draw call, measured inside the frame),
 * not the time between frames: headless software WebGL and a busy machine stretch the gaps between frames, not the
 * work. The main thread's CPU time per frame (CDP ThreadTime, real CPU time, so other programs do not inflate it) is
 * checked too. Each window is measured WINDOWS times and the best one is kept, so a moment of outside load does not
 * fail the run. Budgets are generous: they catch a real regression (a new O(n^2) per frame, an allocation storm, an
 * effect that never stops), not a few percent.
 */
import type { CDPSession, Page } from '@playwright/test';
import type { DebugApi } from '../../src/app/debug';
import type { PerfReport } from '../../src/render/perf';
import type { PerfHook } from '../../src/render/view';
import { expect, open, test } from '../e2e/helpers';

type Hooked = { __TH: DebugApi; __THPERF: PerfHook };

const CPU_THROTTLE = 4;
/** Real seconds per measured window, and windows measured (the best one counts). */
const WINDOW_SECONDS = 10;
const WINDOWS = 2;
/** The scene is heavy once this many units are alive, this many fight, and the fronts are this close (wu). */
const HEAVY_UNITS = 70;
const HEAVY_FIGHTING = 4;
const HEAVY_GAP = 450;
/**
 * Budgets, at CPU x4. Measured when the test was written (2026-11-08, headless SwiftShader, 58-75 units, a busy
 * machine, four windows): 20-46% of frames over 33 ms of work and work p95 58-129 ms (wall time, so these swing with the
 * machine's load), but a steady 5.0-6.3 ms of main-thread CPU per frame. The wall-time budgets leave room for a busy machine;
 * the CPU-time budget is the tight one: about double today's cost fails, which is what a real regression looks like.
 */
const MAX_SLOW_SHARE = 0.6; // frames whose work is over 33 ms (a missed 30 fps frame)
const BUDGET_WORK_P95_MS = 160;
const BUDGET_CPU_MS_PER_FRAME = 12; // real (unthrottled) CPU time of the main thread, per frame

interface Window {
  report: PerfReport;
  cpuMsPerFrame: number;
  units: number;
}

async function threadSeconds(cdp: CDPSession): Promise<number> {
  const { metrics } = await cdp.send('Performance.getMetrics');
  return metrics.find((m) => m.name === 'ThreadTime')?.value ?? 0;
}

/** Feed the player's bot, and point the camera at the middle of the fighting; returns the units alive and fighting. */
function follow(page: Page): Promise<{ units: number; fighting: number; gap: number; over: boolean }> {
  return page.evaluate(() => {
    const th = (window as unknown as Hooked).__TH;
    th.grantSupplies(3000);
    const st = th.state();
    let units = 0;
    for (const side of [0, 1] as const) for (const k of Object.keys(st.units[side])) units += (st.units[side] as Record<string, number>)[k];
    const xs: number[] = [];
    const all = th.units();
    for (const u of all) if (u.action === 'aim' || u.action === 'fire' || u.action === 'reload') xs.push(u.x);
    const fighting = xs.length;
    if (xs.length === 0) for (const u of all) if (!u.inside) xs.push(u.x);
    if (xs.length > 0) {
      xs.sort((p, q) => p - q);
      th.lookAt(xs[Math.floor(xs.length / 2)]);
    }
    return { units, fighting, gap: th.field()?.gap ?? 99999, over: st.over };
  });
}

async function startProvingGround(page: Page): Promise<void> {
  await page.evaluate(() => {
    const th = (window as unknown as Hooked).__TH;
    th.autopilot(true);
    th.unlockAll();
    th.startSandbox(1);
    th.grantPopulation(80);
  });
  await page.waitForFunction(() => (window as unknown as Hooked).__TH.state().inBattle, null, { timeout: 30_000 });
}

async function reachHeavy(page: Page): Promise<void> {
  const deadline = Date.now() + 240_000;
  await page.evaluate(() => (window as unknown as Hooked).__TH.setTimeScale(8));
  let a = await follow(page);
  while (a.units < HEAVY_UNITS || a.fighting < HEAVY_FIGHTING || a.gap > HEAVY_GAP) {
    expect(Date.now(), `the battle never became heavy (${a.units} units, ${a.fighting} fighting, gap ${a.gap.toFixed(0)})`).toBeLessThan(deadline);
    if (a.over) await startProvingGround(page);
    else await page.waitForTimeout(200);
    a = await follow(page);
  }
  await page.evaluate(() => (window as unknown as Hooked).__TH.setTimeScale(1));
}

async function measure(page: Page, cdp: CDPSession): Promise<Window> {
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });
  await page.evaluate(() => (window as unknown as Hooked).__THPERF.reset());
  const cpu0 = await threadSeconds(cdp);
  let units = 0;
  for (let s = 0; s < WINDOW_SECONDS; s++) {
    const a = await follow(page);
    units = Math.max(units, a.units);
    await page.waitForTimeout(1000);
  }
  const cpu1 = await threadSeconds(cdp);
  const report = await page.evaluate(() => (window as unknown as Hooked).__THPERF.report());
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  return { report, cpuMsPerFrame: ((cpu1 - cpu0) * 1000) / Math.max(1, report.frames), units };
}

const ms = (n: number): string => `${n.toFixed(1)} ms`;

test.describe('frame-time budget', () => {
  test(`a heavy proving-ground battle at CPU x${CPU_THROTTLE} keeps its frames inside the budget`, async ({ page, context }) => {
    await open(page, '?debug=1&quality=0');
    const cdp = await context.newCDPSession(page);
    await cdp.send('Performance.enable');
    await startProvingGround(page);
    await reachHeavy(page);
    // Real-time warm-up: effect pools grow and the JIT settles.
    for (let s = 0; s < 3; s++) {
      await follow(page);
      await page.waitForTimeout(1000);
    }

    const windows: Window[] = [];
    for (let w = 0; w < WINDOWS; w++) {
      const m = await measure(page, cdp);
      const r = m.report;
      console.log(
        `window ${w + 1}: ${r.frames} frames in ${r.seconds.toFixed(1)} s (${(r.frames / Math.max(0.001, r.seconds)).toFixed(1)} fps), up to ${m.units} units; ` +
          `work avg ${ms(r.work.avg)} p95 ${ms(r.work.p95)} max ${ms(r.work.max)}, ${r.slowWork} frames over 33 ms of work; ` +
          `js p95 ${ms(r.js.p95)}, draw p95 ${ms(r.draw.p95)}; interval p95 ${ms(r.interval.p95)}, ${r.hitches} gaps over 33 ms; ` +
          `main-thread CPU ${ms(m.cpuMsPerFrame)} per frame`,
      );
      windows.push(m);
    }

    for (const m of windows) {
      expect(m.report.frames, 'frames recorded in a window').toBeGreaterThan(WINDOW_SECONDS * 5);
      expect(m.units, 'units alive in the window').toBeGreaterThanOrEqual(HEAVY_UNITS * 0.6);
    }
    const best = (f: (m: Window) => number): number => Math.min(...windows.map(f));
    const slowShare = best((m) => m.report.slowWork / Math.max(1, m.report.frames));
    const workP95 = best((m) => m.report.work.p95);
    const cpuPerFrame = best((m) => m.cpuMsPerFrame);
    expect(slowShare, `share of frames over 33 ms of work (best window)`).toBeLessThanOrEqual(MAX_SLOW_SHARE);
    expect(workP95, `p95 of the work per frame (best window)`).toBeLessThanOrEqual(BUDGET_WORK_P95_MS);
    expect(cpuPerFrame, `main-thread CPU time per frame (best window)`).toBeLessThanOrEqual(BUDGET_CPU_MS_PER_FRAME);
  });
});
