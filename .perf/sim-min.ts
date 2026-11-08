/**
 * Noise-robust tick timing: the sim is deterministic, so the same battle is replayed R times and the
 * per-tick MINIMUM is kept (removes OS preemption from other processes on a shared machine).
 *   node --import tsx .perf/sim-min.ts [repeats=5] [ticks=900] [behaviour=assault|army]
 */
import { performance } from 'node:perf_hooks';
import { CONFIG } from '../src/data/config';
import { SANDBOX } from '../src/data/missions/sandbox';
import type { ForceDef, MissionDef, UnitKind } from '../src/data/schema';
import { createBattle, type Battle } from '../src/sim';
CONFIG.maxUnits = 400;
const R = Number(process.argv[2] ?? 5);
const TICKS = Number(process.argv[3] ?? 900);
const BEH = (process.argv[4] ?? 'assault') as 'assault' | 'army';
const MIX: [UnitKind, number][] = [['rifle',0.45],['lmg',0.1],['assault',0.12],['mortar',0.05],['sniper',0.04],['medic',0.05],['at',0.05],['flame',0.05],['aa',0.02],['tank',0.02],['lightTank',0.02],['apc',0.01],['commander',0.01]];
function forcesFor(n: number, x0: number, dir: number): ForceDef[] {
  const out: ForceDef[] = []; let placed = 0;
  for (let k = 0; k < MIX.length; k++) { const [kind, frac] = MIX[k]; let c = Math.max(1, Math.round(n*frac)); if (k===MIX.length-1) c = Math.max(1, n-placed); if (placed+c>n) c=n-placed; if (c<=0) continue;
    const g0 = Math.min(c,4); for (let g = 0; g < g0; g++) { const cc = Math.floor(c/g0) + (g < c % g0 ? 1 : 0); if (cc>0) out.push({ kind, count: cc, x: x0 - dir*(g*80+k*6), behaviour: BEH }); }
    placed += c; }
  return out;
}
function mk(n: number): Battle {
  const mission: MissionDef = { ...SANDBOX, events: [], start: [{ ...SANDBOX.start[0], forces: forcesFor(n,3550,1), sappers: 0, supplies: 0 }, { ...SANDBOX.start[1], forces: forcesFor(n,4450,-1), sappers: 0, supplies: 0 }] };
  const b = createBattle({ mission, difficulty: 'normal', seed: 11, upgrades: {}, commanders: ['human','human'] });
  if (BEH === 'army') { b.command(0, { type: 'order', order: 'advance' }); b.command(1, { type: 'order', order: 'advance' }); }
  return b;
}
// warm up
for (let r = 0; r < 3; r++) { const b = mk(100); for (let i = 0; i < 900 && !b.state.over; i++) b.step(); }
console.log(`per-tick min over ${R} replays, ${TICKS} ticks, behaviour ${BEH}`);
console.log('N/side | all ticks: mean   p95    max  | ticks with >=0.8N alive/side: n  mean   p95   max | ticks to <0.8N');
for (const n of [25, 50, 80, 100, 140]) {
  let mins: number[] = [];
  let aliveArr: number[] = [];
  for (let r = 0; r < R; r++) {
    const b = mk(n); const times: number[] = []; const al: number[] = [];
    for (let i = 0; i < TICKS && !b.state.over; i++) {
      const t0 = performance.now(); b.step(); times.push(performance.now() - t0);
      if (r === 0) { let a = 0, c = 0; const s = b.state; for (let k = 0; k < s.unitCount; k++) { const u = s.units[k]; if (u.alive) { if (u.side===0) a++; else c++; } } al.push(Math.min(a, c)); }
    }
    if (r === 0) { mins = times; aliveArr = al; } else for (let i = 0; i < mins.length; i++) mins[i] = Math.min(mins[i], times[i] ?? Infinity);
  }
  const st = (xs: number[]) => { const s = [...xs].sort((a,b)=>a-b); return { mean: xs.reduce((a,b)=>a+b,0)/Math.max(1,xs.length), p95: s[Math.floor(0.95*s.length)] ?? 0, max: s[s.length-1] ?? 0, n: xs.length }; };
  const all = st(mins);
  const heavy = st(mins.filter((_, i) => aliveArr[i] >= 0.8 * n));
  const firstThin = aliveArr.findIndex((a) => a < 0.8 * n);
  console.log(`${String(n).padStart(5)}  | ${all.mean.toFixed(3)}  ${all.p95.toFixed(3)}  ${all.max.toFixed(3)} | ${String(heavy.n).padStart(4)}  ${heavy.mean.toFixed(3)}  ${heavy.p95.toFixed(3)}  ${heavy.max.toFixed(3)} | ${firstThin}`);
}
