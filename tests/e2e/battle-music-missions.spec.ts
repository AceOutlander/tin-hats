/**
 * The battle music of every mission in the built game, one mission after another as a player would go through them:
 * nothing renders at startup; each mission's own track renders after its battle has started (the battle runs
 * meanwhile), within the memory and time budgets, without a long main-thread task; only that mission's music stays
 * in memory (V8 backing stores after a forced GC do not grow from mission to mission); every piece starts from silence
 * and has died away by its end; the player's seams and crossfades add no click; and every track sits under the army
 * of 80. A second test does the render on a 4x slowed CPU (a phone-like estimate), a third plays a real battle with
 * the autopilot and checks which layer the battle asked for, and when.
 */
import type { CDPSession, Page } from '@playwright/test';
import type { BattleSeamReport } from '../../src/app/debug';
import type { LayerChange } from '../../src/app/musicIntensity';
import type { BattleMusicStats } from '../../src/audio';
import type { BattleMixReport } from '../../src/audio/music/battleMix';
import { MISSIONS } from '../../src/data/missions';
import { MUSIC_BATTLE } from '../../src/data/musicBattle';
import { expect, open, setTimeScale, state, test, type Hooked } from './helpers';

const battle = (page: Page): Promise<BattleMusicStats> => page.evaluate(() => (window as unknown as Hooked).__TH?.battleMusic.stats() as BattleMusicStats);
const db = (x: number): number => 20 * Math.log10(Math.max(x, 1e-9));
const mb = (b: number): string => (b / 1e6).toFixed(1);

/** Longest main-thread task seen since `from` (performance.now() ms), from the page's long-task observer. */
async function longestTaskSince(page: Page, from: number): Promise<number> {
  return page.evaluate((t) => {
    const list = (window as unknown as { __long?: { start: number; dur: number }[] }).__long ?? [];
    return list.filter((e) => e.start + e.dur >= t).reduce((m, e) => Math.max(m, e.dur), 0);
  }, from);
}

async function watchLongTasks(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __long?: { start: number; dur: number }[] };
    w.__long = [];
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) w.__long?.push({ start: e.startTime, dur: e.duration });
    }).observe({ type: 'longtask', buffered: true });
  });
}

/** V8 heap and ArrayBuffer backing stores (where AudioBuffer samples live) after a forced garbage collection. */
async function heap(cdp: CDPSession): Promise<{ used: number; backing: number }> {
  await cdp.send('HeapProfiler.collectGarbage');
  await cdp.send('HeapProfiler.collectGarbage');
  const u = (await cdp.send('Runtime.getHeapUsage')) as { usedSize: number; backingStorageSize?: number };
  return { used: u.usedSize, backing: u.backingStorageSize ?? 0 };
}

async function touchTheField(page: Page): Promise<void> {
  const size = page.viewportSize();
  if (!size) throw new Error('no viewport');
  await page.touchscreen.tap(24, size.height - 24);
}

interface Rendered {
  stats: BattleMusicStats;
  /** Battle seconds played before the music was all rendered. */
  battleTimeBefore: number;
  longestTask: number;
}

/** Start a mission and wait for its music: the battle must be running while the music still renders. */
async function startAndRender(page: Page, id: number): Promise<Rendered> {
  await page.evaluate((k) => (window as unknown as Hooked).__TH?.startMission(k), id);
  await expect.poll(async () => (await state(page)).screen).toBe('battle');
  const first = await battle(page);
  expect(first.track).toBe(MISSIONS.find((m) => m.id === id)?.music);
  expect(['waiting', 'rendering'], 'the music renders after the battle starts').toContain(first.state);
  let battleTimeBefore = 0;
  await expect
    .poll(
      async () => {
        const [s, b] = await Promise.all([state(page), battle(page)]);
        if (b.state !== 'ready') battleTimeBefore = Math.max(battleTimeBefore, s.time);
        return b.state;
      },
      { timeout: 300_000, intervals: [250] },
    )
    .toBe('ready');
  const stats = await battle(page);
  const readyAt = await page.evaluate(() => performance.now());
  const longestTask = await longestTaskSince(page, readyAt - stats.renderMs - 500);
  return { stats, battleTimeBefore, longestTask };
}

test.describe('battle music, every mission', () => {
  test('each mission renders its own track after the battle starts, holds only its own music, and stays clean', async ({ page, problems }) => {
    test.setTimeout(1_500_000);
    const cdp = await page.context().newCDPSession(page);
    await open(page);
    await touchTheField(page);
    await watchLongTasks(page);
    // Nothing of the battle music at startup.
    const idle = await battle(page);
    expect(idle.state).toBe('idle');
    expect(idle.prepared).toBe(0);
    expect(idle.bytes).toBe(0);
    // The baseline once the start-up sound has settled: the sound effects and the menu theme rendered.
    await expect.poll(async () => (await page.evaluate(() => (window as unknown as Hooked).__TH?.music.stats().render)), { timeout: 120_000 }).toBe('ready');
    let rendered = -1;
    await expect
      .poll(
        async () => {
          const n = (await page.evaluate(() => (window as unknown as Hooked).__TH?.audio().rendered)) ?? 0;
          const settled = n === rendered;
          rendered = n;
          return settled;
        },
        { timeout: 120_000, intervals: [3000] },
      )
      .toBe(true);
    const base = await heap(cdp);
    const menuBytes = (await page.evaluate(() => (window as unknown as Hooked).__TH?.music.stats().bytes)) ?? 0;
    const rows: string[] = [`baseline: backing stores ${mb(base.backing)} MB, heap ${mb(base.used)} MB, menu theme ${mb(menuBytes)} MB, ${rendered} sound buffers`];
    const held: number[] = [];
    for (const m of MISSIONS) {
      const r = await startAndRender(page, m.id);
      const s = r.stats;
      expect(s.piecesReady).toBe(s.piecesTotal);
      expect(s.bytes).toBe(s.budgetBytes);
      expect(s.bytes).toBeLessThanOrEqual(MUSIC_BATTLE.budget.maxBytes);
      expect(s.renderMs).toBeLessThanOrEqual(MUSIC_BATTLE.budget.maxRenderMs);
      expect(s.buildMs, 'no long graph build').toBeLessThanOrEqual(MUSIC_BATTLE.budget.maxBuildMs);
      expect(r.longestTask, 'no long main-thread task while the music renders').toBeLessThanOrEqual(200);
      expect(r.battleTimeBefore, 'the battle runs while the music renders').toBeGreaterThan(1);
      expect(db(s.peak)).toBeLessThanOrEqual(MUSIC_BATTLE.mix.maxPeakDb);
      // Every piece: music in it, starting from silence, died away by its end (no cut-off tail at the seam).
      const pieces = (await page.evaluate(() => (window as unknown as Hooked).__TH?.battleMusic.analyse() ?? null)) ?? [];
      expect(pieces.length).toBe(s.piecesTotal);
      let worstEnd = -200;
      let worstStart = 0;
      for (const p of pieces) {
        expect(p.rmsDb, `${m.music} ${p.section} ${p.layer}`).toBeGreaterThan(-45);
        expect(p.startAbs, `${m.music} ${p.section} ${p.layer} starts from silence`).toBeLessThan(1e-3);
        expect(p.endPeakDb, `${m.music} ${p.section} ${p.layer} has died away at its end`).toBeLessThan(-54);
        worstEnd = Math.max(worstEnd, p.endPeakDb);
        worstStart = Math.max(worstStart, p.startAbs);
      }
      // The player's seams and crossfades, run offline over these pieces.
      const seam = (await page.evaluate(() => (window as unknown as Hooked).__TH?.battleMusic.seams(150) ?? null)) as BattleSeamReport | null;
      expect(seam).not.toBeNull();
      if (!seam) return;
      expect(seam.crossfades).toBeGreaterThanOrEqual(4);
      expect(seam.sections).toBeGreaterThanOrEqual(4);
      expect(seam.seamRatio, `${m.music}: a click at ${seam.seamAt.toFixed(2)} s`).toBeLessThanOrEqual(Math.max(2, seam.barRatio * 1.25));
      // The mix against the army of 80.
      const mix = (await page.evaluate(() => (window as unknown as Hooked).__TH?.battleMusic.mix() ?? null)) as BattleMixReport | null;
      expect(mix).not.toBeNull();
      if (!mix) return;
      for (const l of mix.layers) {
        const [lo, hi] = MUSIC_BATTLE.mix.armyOverLayer[l.layer];
        for (const v of [l.armyOverFull, l.armyOverPhone]) {
          expect(v, `${m.music} ${l.layer}: the battle stays on top`).toBeGreaterThanOrEqual(lo);
          expect(v, `${m.music} ${l.layer}: the music is still there`).toBeLessThanOrEqual(hi);
        }
      }
      expect(mix.failures).toEqual([]);
      const h = await heap(cdp);
      // What the page holds beyond this track's own samples: steady from mission to mission if nothing leaks.
      held.push(h.backing - base.backing - s.bytes);
      rows.push(
        `${String(m.id).padStart(2)} ${m.music.padEnd(10)} ${s.piecesTotal} pieces ${mb(s.bytes)} MB; backing stores +${mb(h.backing - base.backing)} MB, heap +${mb(h.used - base.used)} MB; ` +
          `render ${(s.renderMs / 1000).toFixed(1)} s, first ${s.firstMs.toFixed(0)} ms, build max ${s.buildMs.toFixed(0)} ms, longest task ${r.longestTask.toFixed(0)} ms; ` +
          `battle ${r.battleTimeBefore.toFixed(1)} s in before ready; peak ${db(s.peak).toFixed(1)} dBFS; tails <= ${worstEnd.toFixed(0)} dBFS, starts <= ${worstStart.toExponential(1)}; ` +
          `seams ${seam.seamRatio.toFixed(2)} (bar lines ${seam.barRatio.toFixed(2)}, ${seam.seams} seams, ${seam.crossfades} fades); ` +
          `army over ${mix.layers.map((l) => `${l.layer} ${l.armyOverFull.toFixed(1)}/${l.armyOverPhone.toFixed(1)}`).join(' ')} LU`,
      );
      console.log(rows[rows.length - 1]);
      // Only this mission's music is held: what the engine counts, and what the page really holds.
      expect(h.backing - base.backing, `${m.music}: backing stores hold this track and little else`).toBeLessThanOrEqual(s.bytes + 8e6);
    }
    console.log(rows.join('\n'));
    // No growth from mission to mission: the last three missions hold no more beyond their tracks than the first three
    // (a leaked track would add 25 MB a mission).
    const tracks = MISSIONS.length;
    expect(held.length).toBe(tracks);
    const mean = (a: number[]): number => a.reduce((x, y) => x + y, 0) / a.length;
    const growth = mean(held.slice(-3)) - mean(held.slice(0, 3));
    console.log(`beyond each track: ${held.map(mb).join(', ')} MB; growth over the campaign ${mb(growth)} MB`);
    expect(growth, 'memory does not grow across missions').toBeLessThanOrEqual(5e6);
    const end = await battle(page);
    expect(end.prepared).toBe(tracks);
    expect(end.released).toBe(tracks - 1);
    expect(problems).toEqual([]);
  });

  test('renders on a 4x slowed CPU without long tasks, and the battle starts first', async ({ page, problems }) => {
    test.setTimeout(1_200_000);
    const cdp = await page.context().newCDPSession(page);
    await open(page);
    await touchTheField(page);
    await watchLongTasks(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const rows: string[] = [];
    for (const id of [1001, 1002, 1006, 1010]) {
      const r = await startAndRender(page, id);
      const s = r.stats;
      rows.push(
        `${(MISSIONS.find((m) => m.id === id)?.music ?? '').padEnd(10)} 4x CPU: render ${(s.renderMs / 1000).toFixed(1)} s, first piece ${s.firstMs.toFixed(0)} ms, build max ${s.buildMs.toFixed(0)} ms ` +
          `(${s.buildMsTotal.toFixed(0)} ms in all), longest task ${r.longestTask.toFixed(0)} ms, battle ${r.battleTimeBefore.toFixed(1)} s in before ready`,
      );
      expect(s.piecesReady).toBe(s.piecesTotal);
      expect(r.longestTask, 'no long main-thread task while the music renders').toBeLessThanOrEqual(250);
      expect(r.battleTimeBefore).toBeGreaterThan(1);
      expect(s.player?.started).toBe(true);
    }
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    console.log(rows.join('\n'));
    expect(problems).toEqual([]);
  });

  test('a real battle: combat never below 20 a side close together, tense only under threat, no flipping, a sting at the end', async ({ page, problems }) => {
    test.setTimeout(1_200_000);
    await open(page);
    await touchTheField(page);
    await page.evaluate(() => (window as unknown as Hooked).__TH?.autopilot(true));
    const R = MUSIC_BATTLE.intensity;
    const log: string[] = [];
    let combats = 0;
    // The symmetric proving ground (two big armies, the player's played by the bot), then the first survival mission (a
    // clock: Brest, as Arnhem was before the British missions were removed).
    const survival = MISSIONS.find((m) => m.mode === 'survival');
    if (!survival) throw new Error('no survival mission');
    const battles: { name: string; start: () => Promise<unknown> }[] = [
      { name: 'proving ground', start: () => page.evaluate(() => (window as unknown as Hooked).__TH?.startSandbox(11, true)) },
      { name: `mission ${survival.id} (${survival.music})`, start: () => page.evaluate((id) => (window as unknown as Hooked).__TH?.startMission(id), survival.id) },
    ];
    for (const fight of battles) {
      await fight.start();
      await expect.poll(async () => (await state(page)).screen).toBe('battle');
      await expect.poll(async () => (await battle(page)).state, { timeout: 300_000 }).toBe('ready');
      // Event sounds (the sting) only play up to this speed.
      await setTimeScale(page, 4);
      let peak: [number, number] = [0, 0];
      const deadline = Date.now() + 360_000;
      while (Date.now() < deadline) {
        const s = await state(page);
        const i = await page.evaluate(() => (window as unknown as Hooked).__TH?.battleMusic.intensity() ?? null);
        if (i) peak = [Math.max(peak[0], i.fighting[0]), Math.max(peak[1], i.fighting[1])];
        if (s.over) break;
        await page.waitForTimeout(500);
      }
      const s = await state(page);
      const changes = ((await page.evaluate(() => (window as unknown as Hooked).__TH?.battleMusic.intensity()?.changes ?? null)) ?? []) as LayerChange[];
      const b = await battle(page);
      log.push(
        `${fight.name}: ${s.time.toFixed(0)} s of battle, over ${s.over}, winner ${s.winner}; most in the fight ${peak[0]} / ${peak[1]}; ` +
          `sting ${b.player?.sting ?? 'none'}; changes: ` +
          changes.map((c) => `${c.time.toFixed(0)}s ${c.from}->${c.to} [${c.fighting.join('/')}${c.hit ? ' hit' : ''}${c.near ? ' near' : ''}${c.clock ? ' clock' : ''}]`).join(', '),
      );
      for (const c of changes) {
        if (c.to === 'combat' && c.from !== 'tense') {
          // Entering combat from calm: 20 or more a side in the fight at that check.
          expect(Math.min(...c.fighting), `combat at ${c.time} s`).toBeGreaterThanOrEqual(R.combat.enter);
          combats++;
        }
        if (c.to === 'combat' && c.from === 'tense') expect(Math.min(...c.fighting)).toBeGreaterThanOrEqual(R.combat.exit);
        if (c.to === 'tense') expect(c.hit || c.near || c.clock, `tense at ${c.time} s has a reason`).toBe(true);
      }
      for (let k = 1; k < changes.length; k++) {
        const gap = changes[k].time - changes[k - 1].time;
        expect(gap, `changes at ${changes[k - 1].time} and ${changes[k].time}`).toBeGreaterThanOrEqual(R.escalateHold - 1e-6);
        // Back to the layer it just left: only after the full hold of the layer in between.
        if (changes[k].to === changes[k - 1].from) expect(gap).toBeGreaterThanOrEqual(R.hold[changes[k - 1].to] - 1e-6);
      }
      if (s.over) {
        expect(b.player?.ended).toBe(true);
        expect(b.player?.sting, 'the battle music played its sting').toBe(s.winner === 0 ? 'victory' : 'defeat');
      }
      await setTimeScale(page, 1);
    }
    // The autopilot's battles (seen: at most 17 and 9 a side in the fight) may never reach the combat threshold; how
    // many times combat was entered is logged, not required.
    log.push(`combat entered ${combats} times`);
    console.log(log.join('\n'));
    expect(problems).toEqual([]);
  });
});
