/**
 * The frame probe and the quality levels in the built game (window.__THPERF, only with ?debug=1). The heavy
 * measurements belong to tools/perf.ts; this checks that the hooks are wired and that a pinned low quality level
 * really lowers the canvas resolution while the battle keeps running.
 */
import type { Page } from '@playwright/test';
import type { PerfHook } from '../../src/render/view';
import { expect, open, setTimeScale, startMission, state, test, waitForState } from './helpers';

type Probed = { __THPERF?: PerfHook };

const stats = (page: Page) => page.evaluate(() => (window as unknown as Probed).__THPERF?.stats());

test.describe('performance hooks', () => {
  test('the probe reports every phase of the frame while a battle runs', async ({ page }) => {
    await open(page, '?debug=1');
    expect(await startMission(page, 1)).toBe(true);
    await page.evaluate(() => (window as unknown as Probed).__THPERF?.reset());
    await waitForState(page, '10 battle seconds', (s) => s.inBattle && s.time >= 10, 120_000);
    const report = await page.evaluate(() => (window as unknown as Probed).__THPERF?.report());
    expect(report, 'window.__THPERF.report()').toBeTruthy();
    if (!report) return;
    expect(report.frames).toBeGreaterThan(20);
    for (const phase of [report.sim, report.after, report.render, report.hud, report.js, report.draw, report.interval]) {
      expect(Number.isFinite(phase.avg)).toBe(true);
      expect(phase.max).toBeGreaterThanOrEqual(phase.avg);
      expect(phase.p95).toBeLessThanOrEqual(phase.max);
    }
    // The picture is laid out every frame, so render costs something; the phases add up to the total.
    expect(report.render.avg).toBeGreaterThan(0);
    expect(report.js.avg).toBeCloseTo(report.sim.avg + report.after.avg + report.render.avg + report.hud.avg, 3);
    const layers = await page.evaluate(() => (window as unknown as Probed).__THPERF?.layers());
    expect(layers?.some((l) => l.total > 0)).toBe(true);
    const quality = await page.evaluate(() => (window as unknown as Probed).__THPERF?.quality());
    // Under browser automation the governor is off and the game stays at full quality.
    expect(quality?.level).toBe(0);
  });

  test('a pinned low quality level lowers the canvas resolution and the battle keeps running', async ({ page }) => {
    await open(page, '?debug=1&quality=0');
    const full = await stats(page);
    expect(full?.quality).toBe(0);
    expect(full?.dpr).toBe(2);

    await page.goto('/?debug=1&quality=2');
    await page.waitForFunction(() => (window as unknown as { __TH?: { ready?: boolean } }).__TH?.ready === true, null, { timeout: 60_000 });
    const low = await stats(page);
    expect(low?.quality).toBe(2);
    expect(low?.dpr).toBe(1.5);
    expect(low && full ? low.canvasW / full.canvasW : 0).toBeCloseTo(0.75, 1);

    expect(await startMission(page, 1)).toBe(true);
    await setTimeScale(page, 4);
    const s = await waitForState(page, '20 battle seconds at the lowest quality', (x) => x.inBattle && x.time >= 20, 120_000);
    expect(s.tick).toBeGreaterThan(100);
    expect((await state(page)).inBattle).toBe(true);
  });
});
