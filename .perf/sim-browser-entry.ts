// Browser entry: min-of-replays per-tick timing, exposed as window.__simBench(n, R, ticks).
import { CONFIG } from '../src/data/config';
import { SANDBOX } from '../src/data/missions/sandbox';
import type { ForceDef, MissionDef, UnitKind } from '../src/data/schema';
import { createBattle } from '../src/sim';
CONFIG.maxUnits = 400;
const MIX: [UnitKind, number][] = [['rifle',0.45],['lmg',0.1],['assault',0.12],['mortar',0.05],['sniper',0.04],['medic',0.05],['at',0.05],['flame',0.05],['aa',0.02],['tank',0.02],['lightTank',0.02],['apc',0.01],['commander',0.01]];
function forcesFor(n: number, x0: number, dir: number): ForceDef[] {
  const out: ForceDef[] = []; let placed = 0;
  for (let k = 0; k < MIX.length; k++) { const [kind, frac] = MIX[k]; let c = Math.max(1, Math.round(n*frac)); if (k===MIX.length-1) c = Math.max(1, n-placed); if (placed+c>n) c=n-placed; if (c<=0) continue;
    const g0 = Math.min(c,4); for (let g = 0; g < g0; g++) { const cc = Math.floor(c/g0) + (g < c % g0 ? 1 : 0); if (cc>0) out.push({ kind, count: cc, x: x0 - dir*(g*80+k*6), behaviour: 'army' }); }
    placed += c; }
  return out;
}
function mk(n: number) {
  const mission: MissionDef = { ...SANDBOX, events: [], start: [{ ...SANDBOX.start[0], forces: forcesFor(n,3550,1), sappers: 0, supplies: 0 }, { ...SANDBOX.start[1], forces: forcesFor(n,4450,-1), sappers: 0, supplies: 0 }] };
  const b = createBattle({ mission, difficulty: 'normal', seed: 11, upgrades: {}, commanders: ['human','human'] });
  b.command(0, { type: 'order', order: 'advance' }); b.command(1, { type: 'order', order: 'advance' });
  return b;
}
(window as unknown as Record<string, unknown>).__simBench = (n: number, R: number, ticks: number) => {
  let mins: number[] = []; const al: number[] = [];
  for (let r = 0; r < R + 1; r++) {
    const b = mk(n); const times: number[] = [];
    for (let i = 0; i < ticks && !b.state.over; i++) {
      const t0 = performance.now(); b.step(); times.push(performance.now() - t0);
      if (r === 1) { let a = 0, c = 0; const s = b.state; for (let k = 0; k < s.unitCount; k++) { const u = s.units[k]; if (u.alive) { if (u.side===0) a++; else c++; } } al.push(Math.min(a, c)); }
    }
    if (r === 0) continue;
    if (r === 1) mins = times; else for (let i = 0; i < mins.length; i++) mins[i] = Math.min(mins[i], times[i] ?? Infinity);
  }
  const heavy = mins.filter((_, i) => al[i] >= 0.8 * n).sort((a, b) => a - b);
  const all = [...mins].sort((a, b) => a - b);
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  return { n, heavyTicks: heavy.length, heavyMean: mean(heavy), heavyP95: heavy[Math.floor(heavy.length * 0.95)], heavyMax: heavy[heavy.length - 1], allMean: mean(all), allMax: all[all.length - 1] };
};
(window as unknown as Record<string, unknown>).__simOnce = (n: number, ticks: number) => {
  const b = mk(n); const batches: number[] = []; let t0 = performance.now(); let worst = 0;
  for (let i = 0; i < ticks && !b.state.over; i++) {
    const a = performance.now(); b.step(); const d = performance.now() - a; if (d > worst) worst = d;
    if ((i + 1) % 30 === 0) { batches.push((performance.now() - t0) / 30); t0 = performance.now(); }
  }
  return { batches, worst };
};
