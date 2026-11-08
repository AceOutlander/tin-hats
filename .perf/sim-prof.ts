/** Profile driver: repeat the heavy phase (first 250 ticks) of an N-per-side battle many times.
 *   node --cpu-prof --cpu-prof-dir=.perf/prof --cpu-prof-interval 100 --import tsx .perf/sim-prof.ts [n=100] [reps=60] [mode=assault|bot]
 */
import { CONFIG } from '../src/data/config';
import { SANDBOX } from '../src/data/missions/sandbox';
import type { ForceDef, MissionAiPlan, MissionDef, UnitKind } from '../src/data/schema';
import { createBattle } from '../src/sim';
CONFIG.maxUnits = 400;
const N = Number(process.argv[2] ?? 100); const REPS = Number(process.argv[3] ?? 60); const MODE = process.argv[4] ?? 'assault';
const MIX: [UnitKind, number][] = [['rifle',0.45],['lmg',0.1],['assault',0.12],['mortar',0.05],['sniper',0.04],['medic',0.05],['at',0.05],['flame',0.05],['aa',0.02],['tank',0.02],['lightTank',0.02],['apc',0.01],['commander',0.01]];
function forcesFor(n: number, x0: number, dir: number, beh: 'assault' | 'army'): ForceDef[] {
  const out: ForceDef[] = []; let placed = 0;
  for (let k = 0; k < MIX.length; k++) { const [kind, frac] = MIX[k]; let c = Math.max(1, Math.round(n*frac)); if (k===MIX.length-1) c = Math.max(1, n-placed); if (placed+c>n) c=n-placed; if (c<=0) continue;
    const g0 = Math.min(c,4); for (let g = 0; g < g0; g++) { const cc = Math.floor(c/g0) + (g < c % g0 ? 1 : 0); if (cc>0) out.push({ kind, count: cc, x: x0 - dir*(g*80+k*6), behaviour: beh }); }
    placed += c; }
  return out;
}
const PLAN: MissionAiPlan = { sappers: 4, build: [{ kind: 'rifle', count: 60, after: 0 }, { kind: 'lmg', count: 8, after: 0 }, { kind: 'assault', count: 10, after: 0 }, { kind: 'mortar', count: 4, after: 0 }, { kind: 'at', count: 4, after: 0 }, { kind: 'flame', count: 4, after: 0 }], firstAttackAfter: 0 };
const t0 = Date.now();
for (let r = 0; r < REPS; r++) {
  const bot = MODE === 'bot';
  const mission: MissionDef = { ...SANDBOX, events: [], ai: PLAN, bot: PLAN, start: [
    { ...SANDBOX.start[0], forces: forcesFor(N,3550,1, bot ? 'army' : 'assault'), sappers: bot ? 4 : 0, supplies: bot ? 1e6 : 0 },
    { ...SANDBOX.start[1], forces: forcesFor(N,4450,-1, bot ? 'army' : 'assault'), sappers: bot ? 4 : 0, supplies: bot ? 1e6 : 0 }] };
  const b = createBattle({ mission, difficulty: 'normal', seed: 11 + r, upgrades: {}, commanders: bot ? ['bot','bot'] : ['human','human'] });
  for (let i = 0; i < (bot ? 1800 : 250) && !b.state.over; i++) b.step();
}
console.log(`done in ${Date.now() - t0} ms`);
