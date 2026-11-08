/** Bytes allocated per tick (heapUsed delta with no GC in between).  node --expose-gc --import tsx .perf/sim-alloc.ts */
import { CONFIG } from '../src/data/config';
import { SANDBOX } from '../src/data/missions/sandbox';
import type { ForceDef, MissionAiPlan, MissionDef, UnitKind } from '../src/data/schema';
import { createBattle } from '../src/sim';
CONFIG.maxUnits = 400;
const gc = (globalThis as unknown as { gc: () => void }).gc;
const MIX: [UnitKind, number][] = [['rifle',0.45],['lmg',0.1],['assault',0.12],['mortar',0.05],['sniper',0.04],['medic',0.05],['at',0.05],['flame',0.05],['aa',0.02],['tank',0.02],['lightTank',0.02],['apc',0.01],['commander',0.01]];
function forcesFor(n: number, x0: number, dir: number): ForceDef[] {
  const out: ForceDef[] = []; let placed = 0;
  for (let k = 0; k < MIX.length; k++) { const [kind, frac] = MIX[k]; let c = Math.max(1, Math.round(n*frac)); if (k===MIX.length-1) c = Math.max(1, n-placed); if (placed+c>n) c=n-placed; if (c<=0) continue;
    const g0 = Math.min(c,4); for (let g = 0; g < g0; g++) { const cc = Math.floor(c/g0) + (g < c % g0 ? 1 : 0); if (cc>0) out.push({ kind, count: cc, x: x0 - dir*(g*80+k*6), behaviour: 'army' }); }
    placed += c; }
  return out;
}
const PLAN: MissionAiPlan = { sappers: 4, build: [{ kind: 'rifle', count: 60, after: 0 }, { kind: 'lmg', count: 8, after: 0 }, { kind: 'mortar', count: 4, after: 0 }, { kind: 'flame', count: 4, after: 0 }], firstAttackAfter: 0 };
const mission: MissionDef = { ...SANDBOX, events: [], ai: PLAN, bot: PLAN, start: [
  { ...SANDBOX.start[0], forces: forcesFor(100,3550,1), supplies: 1e6 }, { ...SANDBOX.start[1], forces: forcesFor(100,4450,-1), supplies: 1e6 }] };
for (let r = 0; r < 4; r++) {
  const b = createBattle({ mission, difficulty: 'normal', seed: 4, upgrades: {}, commanders: ['bot', 'bot'] });
  for (let i = 0; i < 30; i++) b.step();
  const windows: string[] = [];
  for (let k = 0; k < 6; k++) {
    gc(); const h0 = process.memoryUsage().heapUsed;
    for (let i = 0; i < 300 && !b.state.over; i++) b.step();
    const h1 = process.memoryUsage().heapUsed;
    windows.push(((h1 - h0) / 300).toFixed(0));
  }
  console.log(`run ${r}: bytes/tick per 300-tick window: ${windows.join(', ')}`);
}
