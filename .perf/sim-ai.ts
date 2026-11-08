/** AI think cost: bot vs bot with 100 per side placed in contact; per-tick min over R replays, think ticks vs others.
 *   node --import tsx .perf/sim-ai.ts [n=100] [R=5] [difficulty=normal] [cmd=bot|ai]
 */
import { performance } from 'node:perf_hooks';
import { CONFIG } from '../src/data/config';
import { SANDBOX } from '../src/data/missions/sandbox';
import type { Difficulty, ForceDef, MissionAiPlan, MissionDef, UnitKind } from '../src/data/schema';
import { createBattle } from '../src/sim';
CONFIG.maxUnits = 400;
const N = Number(process.argv[2] ?? 100); const R = Number(process.argv[3] ?? 5); const DIFF = (process.argv[4] ?? 'normal') as Difficulty; const CMD = (process.argv[5] ?? 'bot') as 'bot' | 'ai';
const MIX: [UnitKind, number][] = [['rifle',0.45],['lmg',0.1],['assault',0.12],['mortar',0.05],['sniper',0.04],['medic',0.05],['at',0.05],['flame',0.05],['aa',0.02],['tank',0.02],['lightTank',0.02],['apc',0.01],['commander',0.01]];
function forcesFor(n: number, x0: number, dir: number): ForceDef[] {
  const out: ForceDef[] = []; let placed = 0;
  for (let k = 0; k < MIX.length; k++) { const [kind, frac] = MIX[k]; let c = Math.max(1, Math.round(n*frac)); if (k===MIX.length-1) c = Math.max(1, n-placed); if (placed+c>n) c=n-placed; if (c<=0) continue;
    const g0 = Math.min(c,4); for (let g = 0; g < g0; g++) { const cc = Math.floor(c/g0) + (g < c % g0 ? 1 : 0); if (cc>0) out.push({ kind, count: cc, x: x0 - dir*(g*80+k*6), behaviour: 'army' }); }
    placed += c; }
  return out;
}
const PLAN: MissionAiPlan = { sappers: 4, build: [{ kind: 'rifle', count: 60, after: 0 }, { kind: 'lmg', count: 8, after: 0 }, { kind: 'assault', count: 10, after: 0 }, { kind: 'mortar', count: 4, after: 0 }, { kind: 'at', count: 4, after: 0 }, { kind: 'flame', count: 4, after: 0 }], firstAttackAfter: 0 };
const mission: MissionDef = { ...SANDBOX, events: [], ai: PLAN, bot: PLAN, start: [
  { ...SANDBOX.start[0], forces: forcesFor(N,3550,1), supplies: 1e6 }, { ...SANDBOX.start[1], forces: forcesFor(N,4450,-1), supplies: 1e6 }] };
const TICKS = 1800;
let mins: number[] = []; let think: boolean[] = []; let alive: number[] = [];
for (let r = 0; r < R + 2; r++) {
  const b = createBattle({ mission, difficulty: DIFF, seed: 4, upgrades: {}, commanders: [CMD, CMD] });
  const times: number[] = [];
  for (let i = 0; i < TICKS && !b.state.over; i++) {
    const t0 = performance.now(); b.step(); times.push(performance.now() - t0);
    if (r === 2) { const s = b.state; let n = 0; for (let k = 0; k < s.unitCount; k++) if (s.units[k].alive) n++; alive.push(n); think.push(b.state.tick % Math.max(1, Math.round((CMD === 'bot' ? 1 : ({normal:1,hard:0.7,insane:0.5,easy:1.5} as Record<string,number>)[DIFF] ?? 1) * 30)) === 0); }
  }
  if (r < 2) continue; // warm-up
  if (r === 2) mins = times; else for (let i = 0; i < mins.length; i++) mins[i] = Math.min(mins[i], times[i] ?? Infinity);
}
const st = (xs: number[]) => { const s = [...xs].sort((a,b)=>a-b); return `n=${xs.length} mean ${(xs.reduce((a,b)=>a+b,0)/xs.length).toFixed(3)} p95 ${(s[Math.floor(0.95*s.length)]).toFixed(3)} max ${s[s.length-1].toFixed(3)}`; };
console.log(`${CMD} ${DIFF} N=${N}: all ticks ${st(mins)}`);
console.log(`  think ticks:  ${st(mins.filter((_, i) => think[i]))}`);
console.log(`  other ticks:  ${st(mins.filter((_, i) => !think[i]))}`);
console.log(`  alive: start ${alive[0]} min ${Math.min(...alive)} max ${Math.max(...alive)} end ${alive[alive.length-1]}`);
