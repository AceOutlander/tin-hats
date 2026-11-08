/**
 * Headless sim tick benchmark (throwaway, not part of the build).
 *
 *   node --import tsx .perf/sim-bench.ts [scenario] [--ticks N]
 *   node --cpu-prof --cpu-prof-dir=.perf/prof --import tsx .perf/sim-bench.ts sustain
 *
 * Scenarios:
 *   sweep    N units per side (25..140) placed 900 wu apart on the proving ground, 'assault'
 *            behaviour (always advance), no AI: pure unit cost as the armies grow.
 *   sustain  bot vs bot on the proving ground with unlimited supplies and a build plan that
 *            fills the 100 pop cap; time series of tick cost bucketed by units alive.
 *   all      both (default).
 */
import { PerformanceObserver, performance } from 'node:perf_hooks';
import { CONFIG } from '../src/data/config';
import { SANDBOX } from '../src/data/missions/sandbox';
import type { ForceDef, MissionAiPlan, MissionDef, UnitKind } from '../src/data/schema';
import { UNITS } from '../src/data/units';
import { createBattle, type Battle } from '../src/sim';

const args = process.argv.slice(2);
const scenario = args.find((a) => !a.startsWith('--')) ?? 'all';
const ticksArg = args.indexOf('--ticks');
const TICKS = ticksArg >= 0 ? Number(args[ticksArg + 1]) : 900;

// Pool large enough for 140 a side (CONFIG.maxUnits is 160 in total in the game).
const ORIGINAL_MAX = CONFIG.maxUnits;
CONFIG.maxUnits = 400;

let gcCount = 0;
let gcMs = 0;
const obs = new PerformanceObserver((list) => {
  for (const e of list.getEntries()) {
    gcCount++;
    gcMs += e.duration;
  }
});
obs.observe({ entryTypes: ['gc'] });

/** A 100-pop style mix, scaled to `n` units. Fractions of the unit count. */
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
    let count = Math.max(1, Math.round(n * frac));
    if (k === MIX.length - 1) count = Math.max(1, n - placed);
    if (placed + count > n) count = n - placed;
    if (count <= 0) continue;
    // Spread each kind over several x positions so the army is ~300 wu deep.
    const groups = Math.min(count, 4);
    for (let g = 0; g < groups; g++) {
      const c = Math.floor(count / groups) + (g < count % groups ? 1 : 0);
      if (c > 0) out.push({ kind, count: c, x: x0 - dir * (g * 80 + k * 6), behaviour: 'assault' });
    }
    placed += count;
  }
  return out;
}

function popOf(forces: ForceDef[]): number {
  return forces.reduce((a, f) => a + UNITS[f.kind].pop * f.count, 0);
}

interface Stats {
  mean: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
}
function stats(xs: number[]): Stats {
  const s = [...xs].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { mean: xs.reduce((a, b) => a + b, 0) / xs.length, p50: q(0.5), p95: q(0.95), p99: q(0.99), max: s[s.length - 1] };
}
const f = (x: number) => x.toFixed(3);

function alive(b: Battle): [number, number] {
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

function sweepMission(n: number): MissionDef {
  const a = forcesFor(n, 3550, 1);
  const b = forcesFor(n, 4450, -1);
  return {
    ...SANDBOX,
    events: [],
    start: [
      { ...SANDBOX.start[0], forces: a, sappers: 0, supplies: 0 },
      { ...SANDBOX.start[1], forces: b, sappers: 0, supplies: 0 },
    ],
  };
}

function warm(): void {
  // JIT warm-up: run a mid-size battle once so the timed runs see optimised code.
  const b = createBattle({ mission: sweepMission(60), difficulty: 'normal', seed: 7, upgrades: {}, commanders: ['human', 'human'] });
  for (let i = 0; i < 900 && !b.state.over; i++) b.step();
}

function sweep(): void {
  console.log(`\n== sweep: N per side placed 900 wu apart, assault, no AI, ${TICKS} ticks (${TICKS / 30}s) ==`);
  console.log('N/side  pop/side  ms/tick mean   p50     p95     p99     max   | alive@end  shots/tick  gc(n,ms)');
  for (const n of [25, 50, 80, 100, 140]) {
    const mission = sweepMission(n);
    const b = createBattle({ mission, difficulty: 'normal', seed: 11, upgrades: {}, commanders: ['human', 'human'] });
    const times: number[] = [];
    let shots = 0;
    const g0 = gcCount;
    const gm0 = gcMs;
    // Only the first 15 s are "heavy" (armies thin out fast); time them all and report.
    for (let i = 0; i < TICKS && !b.state.over; i++) {
      const t0 = performance.now();
      b.step();
      times.push(performance.now() - t0);
      const ev = b.events;
      for (let j = 0; j < ev.count; j++) if (ev.items[j].type === 'shot') shots++;
    }
    const st = stats(times);
    const [a, c] = alive(b);
    console.log(
      `${String(n).padStart(5)}  ${String(popOf(mission.start[0].forces)).padStart(8)}   ${f(st.mean)}  ${f(st.p50)}  ${f(st.p95)}  ${f(st.p99)}  ${f(st.max)} | ${a}/${c}   ${(shots / times.length).toFixed(1)}   ${gcCount - g0},${(gcMs - gm0).toFixed(1)}`,
    );
  }
}

/** Static contact: both armies 'army' behaviour and Hold order, placed in range, so the count stays high. */
function contact(): void {
  console.log(`\n== contact (first 5 s only, full armies): ms/tick by N per side ==`);
  for (const n of [50, 80, 100, 140]) {
    const mission = sweepMission(n);
    const b = createBattle({ mission, difficulty: 'normal', seed: 3, upgrades: {}, commanders: ['human', 'human'] });
    // skip approach: run until first shot
    let i = 0;
    for (; i < 900; i++) {
      b.step();
      let shot = false;
      for (let j = 0; j < b.events.count; j++) if (b.events.items[j].type === 'shot') shot = true;
      if (shot) break;
    }
    const times: number[] = [];
    for (let k = 0; k < 150 && !b.state.over; k++) {
      const t0 = performance.now();
      b.step();
      times.push(performance.now() - t0);
    }
    const st = stats(times);
    const [a, c] = alive(b);
    console.log(`N=${n}: contact at tick ${i}; mean ${f(st.mean)} p95 ${f(st.p95)} max ${f(st.max)} ms; alive after 5s ${a}/${c}`);
  }
}

const BIG_PLAN: MissionAiPlan = {
  sappers: 4,
  build: [
    { kind: 'rifle', count: 40, after: 0 },
    { kind: 'lmg', count: 8, after: 0 },
    { kind: 'assault', count: 10, after: 0 },
    { kind: 'medic', count: 4, after: 0 },
    { kind: 'mortar', count: 4, after: 0 },
    { kind: 'at', count: 4, after: 0 },
    { kind: 'flame', count: 4, after: 0 },
    { kind: 'sniper', count: 3, after: 0 },
    { kind: 'aa', count: 1, after: 0 },
    { kind: 'tank', count: 1, after: 0 },
    { kind: 'lightTank', count: 1, after: 0 },
  ],
  firstAttackAfter: 60,
};

function sustain(): void {
  const seconds = Math.max(TICKS / 30, 240);
  console.log(`\n== sustain: bot vs bot, proving ground, unlimited supplies, ${seconds}s ==`);
  const mission: MissionDef = {
    ...SANDBOX,
    ai: BIG_PLAN,
    bot: BIG_PLAN,
    start: [
      { ...SANDBOX.start[0], supplies: 1e6 },
      { ...SANDBOX.start[1], supplies: 1e6 },
    ],
  };
  CONFIG.maxUnits = ORIGINAL_MAX; // the real pool
  const b = createBattle({ mission, difficulty: 'normal', seed: 5, upgrades: {}, commanders: ['bot', 'bot'] });
  const buckets = new Map<number, number[]>();
  const all: number[] = [];
  let maxAlive = 0;
  let poolFullTicks = 0;
  const g0 = gcCount;
  const gm0 = gcMs;
  const ticks = seconds * 30;
  let shots = 0;
  let peakEvents = 0;
  const tStart = performance.now();
  for (let i = 0; i < ticks && !b.state.over; i++) {
    const t0 = performance.now();
    b.step();
    const dt = performance.now() - t0;
    all.push(dt);
    const [a, c] = alive(b);
    const n = a + c;
    if (n > maxAlive) maxAlive = n;
    if (n >= CONFIG.maxUnits) poolFullTicks++;
    const key = Math.floor(n / 20) * 20;
    let arr = buckets.get(key);
    if (!arr) buckets.set(key, (arr = []));
    arr.push(dt);
    if (b.events.count > peakEvents) peakEvents = b.events.count;
    for (let j = 0; j < b.events.count; j++) if (b.events.items[j].type === 'shot') shots++;
    if (i % 900 === 0) {
      const s = b.state;
      console.log(
        `  t=${(s.time).toFixed(0)}s alive ${a}/${c} pop ${s.sides[0].pop}/${s.sides[1].pop} orders ${s.sides[0].order}/${s.sides[1].order} front ${s.sides[0].holdLineX.toFixed(0)}..${s.sides[1].holdLineX.toFixed(0)}`,
      );
    }
  }
  const wall = performance.now() - tStart;
  const st = stats(all);
  console.log(`overall: ${all.length} ticks, mean ${f(st.mean)} p50 ${f(st.p50)} p95 ${f(st.p95)} p99 ${f(st.p99)} max ${f(st.max)} ms`);
  console.log(`max alive ${maxAlive} (pool ${CONFIG.maxUnits}), pool-full ticks ${poolFullTicks}, shots/tick ${(shots / all.length).toFixed(2)}, peak events/tick ${peakEvents}`);
  console.log(`gc: ${gcCount - g0} collections, ${(gcMs - gm0).toFixed(1)} ms over ${(wall / 1000).toFixed(1)} s wall`);
  console.log('alive bucket  ticks   mean    p95     max');
  for (const k of [...buckets.keys()].sort((a, b) => a - b)) {
    const s2 = stats(buckets.get(k)!);
    console.log(`  ${String(k).padStart(3)}-${String(k + 19).padStart(3)}  ${String(buckets.get(k)!.length).padStart(5)}  ${f(s2.mean)}  ${f(s2.p95)}  ${f(s2.max)}`);
  }
  if (b.state.over) console.log(`ended at ${b.state.time.toFixed(0)}s: winner ${b.state.winner} ${b.state.endReason}`);
}

warm();
if (scenario === 'sweep' || scenario === 'all') {
  sweep();
  contact();
}
if (scenario === 'sustain' || scenario === 'all') sustain();
obs.disconnect();
