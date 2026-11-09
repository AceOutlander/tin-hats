/**
 * Sim time budget: a heavy headless battle (100 a side, every kind of unit, both armies in contact) must stay well
 * inside its share of a frame, so lag cannot creep back into the simulation unnoticed.
 *
 * The sim is deterministic, so the same battle is replayed REPLAYS times and each tick keeps its fastest time: other
 * programs on a loaded machine (or other test files running alongside) only ever make a tick slower, so the minimum
 * is close to the real cost and the test does not flake. The budgets are generous (measured on a desktop: about
 * 0.1 ms mean per tick at 100 a side after the countClusters sweep, 0.2 ms before it); they catch an order-of-magnitude
 * regression such as an accidental O(n^2) or O(n^3) loop, not a few percent.
 */
import { performance } from 'node:perf_hooks';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/data/config';
import { getMission } from '../../src/data/missions';
import { SANDBOX } from '../../src/data/missions/sandbox';
import type { ForceDef, MissionDef, UnitKind } from '../../src/data/schema';
import { createBattle, type Battle } from '../../src/sim';

const PER_SIDE = 100;
const TICKS = 600; // 20 s of battle
const REPLAYS = 5;
/** Milliseconds per tick, on the per-tick minimum of the replays. A 30 Hz tick has 33 ms; a frame at 60 fps 16.7 ms. */
const BUDGET_MEAN_MS = 1.5;
const BUDGET_P95_MS = 3;
const BUDGET_MAX_MS = 12;

/** The army mix of the perf audit (.perf/sim-min.ts): mostly riflemen, a bit of everything else. */
const MIX: [UnitKind, number][] = [
  ['rifle', 0.45],
  ['lmg', 0.1],
  ['assault', 0.12],
  ['mortar', 0.05],
  ['sniper', 0.04],
  ['medic', 0.05],
  ['at', 0.05],
  ['flame', 0.05],
  ['aa', 0.02],
  ['tank', 0.02],
  ['lightTank', 0.02],
  ['apc', 0.01],
  ['commander', 0.01],
];

function forcesFor(n: number, x0: number, dir: number): ForceDef[] {
  const out: ForceDef[] = [];
  let placed = 0;
  for (let k = 0; k < MIX.length; k++) {
    const [kind, frac] = MIX[k];
    let c = k === MIX.length - 1 ? n - placed : Math.max(1, Math.round(n * frac));
    if (placed + c > n) c = n - placed;
    if (c <= 0) continue;
    const groups = Math.min(c, 4);
    for (let g = 0; g < groups; g++) {
      const count = Math.floor(c / groups) + (g < c % groups ? 1 : 0);
      if (count > 0) out.push({ kind, count, x: x0 - dir * (g * 80 + k * 6), behaviour: 'army' });
    }
    placed += c;
  }
  return out;
}

function heavyBattle(): Battle {
  const start = SANDBOX.start;
  const mission: MissionDef = {
    ...SANDBOX,
    events: [],
    start: [
      { ...start[0], forces: forcesFor(PER_SIDE, 3550, 1), sappers: 0, supplies: 0 },
      { ...start[1], forces: forcesFor(PER_SIDE, 4450, -1), sappers: 0, supplies: 0 },
    ],
  };
  const b = createBattle({ mission, difficulty: 'normal', seed: 11, upgrades: {}, commanders: ['human', 'human'] });
  b.command(0, { type: 'order', order: 'advance' });
  b.command(1, { type: 'order', order: 'advance' });
  return b;
}

function aliveOn(b: Battle): [number, number] {
  const s = b.state;
  let a = 0;
  let c = 0;
  for (let i = 0; i < s.unitCount; i++) {
    const u = s.units[i];
    if (!u.alive) continue;
    if (u.side === 0) a++;
    else c++;
  }
  return [a, c];
}

describe('sim time budget, heavy battle', () => {
  // The shipped pool (CONFIG.maxUnits) is for both sides together and does not fit 100 a side yet; the test
  // battle gets a big enough pool and the setting is put back afterwards.
  const pool = CONFIG.maxUnits;
  beforeAll(() => {
    CONFIG.maxUnits = Math.max(pool, 2 * PER_SIDE + 16);
  });
  afterAll(() => {
    CONFIG.maxUnits = pool;
  });

  it(`keeps the per-tick minimum of ${REPLAYS} replays at ${PER_SIDE} a side under ${BUDGET_MEAN_MS} ms mean, ${BUDGET_P95_MS} ms p95`, () => {
    // Warm the JIT up first, so the first replay is not judged on interpreted code.
    const warm = heavyBattle();
    for (let i = 0; i < TICKS && !warm.state.over; i++) warm.step();

    const best = new Float64Array(TICKS).fill(Infinity);
    let ticks = TICKS;
    let finalTick = -1;
    let finalAlive: [number, number] = [0, 0];
    let peakAlive = 0;
    for (let r = 0; r < REPLAYS; r++) {
      const b = heavyBattle();
      const [a0, a1] = aliveOn(b);
      peakAlive = Math.max(peakAlive, Math.min(a0, a1));
      let i = 0;
      for (; i < TICKS && !b.state.over; i++) {
        const t0 = performance.now();
        b.step();
        const ms = performance.now() - t0;
        if (ms < best[i]) best[i] = ms;
      }
      ticks = Math.min(ticks, i);
      // Every replay is the same battle.
      if (r === 0) {
        finalTick = b.state.tick;
        finalAlive = aliveOn(b);
      } else {
        expect(b.state.tick).toBe(finalTick);
        expect(aliveOn(b)).toEqual(finalAlive);
      }
    }
    // The battle really was heavy: both armies at full strength at the start, and they fought.
    expect(peakAlive).toBeGreaterThanOrEqual(0.9 * PER_SIDE);
    expect(finalAlive[0] + finalAlive[1]).toBeLessThan(2 * peakAlive);
    expect(ticks).toBeGreaterThan(TICKS / 2);

    const times = Array.from(best.subarray(0, ticks)).sort((p, q) => p - q);
    const mean = times.reduce((x, y) => x + y, 0) / times.length;
    const p95 = times[Math.floor(times.length * 0.95)];
    const max = times[times.length - 1];
    console.log(`sim budget: ${PER_SIDE} a side, ${ticks} ticks, min of ${REPLAYS}: mean ${mean.toFixed(3)} ms, p95 ${p95.toFixed(3)} ms, max ${max.toFixed(3)} ms`);
    expect(mean).toBeLessThan(BUDGET_MEAN_MS);
    expect(p95).toBeLessThan(BUDGET_P95_MS);
    expect(max).toBeLessThan(BUDGET_MAX_MS);
  });
});

describe('sim time budget, the longest campaign map with the mission director', () => {
  // Operation Uranus (1009) is 30,000 wu with four phases, scripted barrages, a Katyusha raid and side objectives: the
  // director's checks (objectives, losses, side objectives, triggers) run every tick there, on top of the battle.
  it(`keeps 1009 played by the bot against the AI under ${BUDGET_MEAN_MS} ms mean per tick`, () => {
    const m = getMission(1009);
    if (!m) throw new Error('mission 1009 missing');
    const play = (): number[] => {
      const b = createBattle({ mission: m, difficulty: 'normal', seed: 2, upgrades: {}, commanders: ['bot', 'ai'] });
      const out: number[] = [];
      for (let i = 0; i < 9000 && !b.state.over; i++) {
        const t0 = performance.now();
        b.step();
        out.push(performance.now() - t0);
      }
      return out;
    };
    play(); // warm the JIT up
    const best = play();
    const again = play();
    for (let i = 0; i < Math.min(best.length, again.length); i++) best[i] = Math.min(best[i], again[i]);
    const mean = best.reduce((x, y) => x + y, 0) / best.length;
    console.log(`sim budget 1009: ${best.length} ticks, mean ${mean.toFixed(3)} ms`);
    expect(best.length).toBe(9000);
    expect(mean).toBeLessThan(BUDGET_MEAN_MS);
  });
});
