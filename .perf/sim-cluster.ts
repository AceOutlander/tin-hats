/** countClusters (structures.ts:44-61) cost vs an O(n) sorted sweep on real heavy-battle states; checks identical results. */
import { performance } from 'node:perf_hooks';
import { CONFIG } from '../src/data/config';
import { SANDBOX } from '../src/data/missions/sandbox';
import type { ForceDef, MissionDef, UnitKind } from '../src/data/schema';
import { createBattle, type BattleState } from '../src/sim';
CONFIG.maxUnits = 400;
const MIX: [UnitKind, number][] = [['rifle',0.45],['lmg',0.1],['assault',0.12],['mortar',0.05],['sniper',0.04],['medic',0.05],['at',0.05],['flame',0.05],['aa',0.02],['tank',0.02],['lightTank',0.02],['apc',0.01],['commander',0.01]];
function forcesFor(n: number, x0: number, dir: number): ForceDef[] {
  const out: ForceDef[] = []; let placed = 0;
  for (let k = 0; k < MIX.length; k++) { const [kind, frac] = MIX[k]; let c = Math.max(1, Math.round(n*frac)); if (k===MIX.length-1) c = Math.max(1, n-placed); if (placed+c>n) c=n-placed; if (c<=0) continue;
    const g0 = Math.min(c,4); for (let g = 0; g < g0; g++) { const cc = Math.floor(c/g0) + (g < c % g0 ? 1 : 0); if (cc>0) out.push({ kind, count: cc, x: x0 - dir*(g*80+k*6), behaviour: 'army' }); }
    placed += c; }
  return out;
}
const R = CONFIG.clusterRadius;
function quadratic(s: BattleState, out: Uint8Array) {
  const units = s.units;
  for (let i = 0; i < s.unitCount; i++) { const u = units[i]; if (!u.alive || u.inside) { out[i] = 0; continue; }
    let n = 0; for (let j = 0; j < s.unitCount; j++) { const v = units[j]; if (!v.alive || v.inside || v.side !== u.side) continue; const d = v.x > u.x ? v.x - u.x : u.x - v.x; if (d <= R) n++; }
    out[i] = n > 255 ? 255 : n; }
}
// Persistent per-side index lists, insertion-sorted by x each tick (nearly sorted already), then a two-pointer window.
const idx = [new Int32Array(400), new Int32Array(400)]; const len = new Int32Array(2); const xs = new Float64Array(400);
function sweep(s: BattleState, out: Uint8Array) {
  const units = s.units; len[0] = 0; len[1] = 0;
  for (let i = 0; i < s.unitCount; i++) { const u = units[i]; out[i] = 0; if (!u.alive || u.inside) continue; idx[u.side][len[u.side]++] = i; xs[i] = u.x; }
  for (let side = 0; side < 2; side++) {
    const a = idx[side]; const n = len[side];
    for (let i = 1; i < n; i++) { const v = a[i]; const x = xs[v]; let j = i - 1; while (j >= 0 && xs[a[j]] > x) { a[j + 1] = a[j]; j--; } a[j + 1] = v; }
    let lo = 0; let hi = 0;
    for (let i = 0; i < n; i++) { const x = xs[a[i]]; while (xs[a[lo]] < x - R) lo++; if (hi < i) hi = i; while (hi + 1 < n && xs[a[hi + 1]] <= x + R) hi++; const c = hi - lo + 1; out[a[i]] = c > 255 ? 255 : c; }
  }
}
for (const N of [50, 100, 140]) {
  const mission: MissionDef = { ...SANDBOX, events: [], start: [{ ...SANDBOX.start[0], forces: forcesFor(N,3550,1), sappers: 0, supplies: 0 }, { ...SANDBOX.start[1], forces: forcesFor(N,4450,-1), sappers: 0, supplies: 0 }] };
  const b = createBattle({ mission, difficulty: 'normal', seed: 11, upgrades: {}, commanders: ['human','human'] });
  b.command(0, { type: 'order', order: 'advance' }); b.command(1, { type: 'order', order: 'advance' });
  const qa = new Uint8Array(400); const sa = new Uint8Array(400);
  let tq = Infinity, ts = Infinity, tstep = 0, nstep = 0, mismatch = 0;
  for (let i = 0; i < 200; i++) {
    const t0 = performance.now(); b.step(); tstep += performance.now() - t0; nstep++;
    let bq = Infinity, bs = Infinity;
    for (let r = 0; r < 5; r++) { let t = performance.now(); quadratic(b.state, qa); bq = Math.min(bq, performance.now() - t); t = performance.now(); sweep(b.state, sa); bs = Math.min(bs, performance.now() - t); }
    if (i === 150) { tq = bq; ts = bs; }
    for (let k = 0; k < b.state.unitCount; k++) if (qa[k] !== sa[k]) mismatch++;
  }
  let alive = 0; for (let k = 0; k < b.state.unitCount; k++) if (b.state.units[k].alive) alive++;
  console.log(`N=${N}/side (alive at tick 150 ~${alive}): countClusters O(n^2) ${(tq * 1000).toFixed(1)} us, sorted sweep ${(ts * 1000).toFixed(1)} us, mismatches over 200 ticks: ${mismatch}; mean full tick ${(tstep / nstep).toFixed(3)} ms`);
}
