import { performance } from 'node:perf_hooks';
import { CONFIG } from '../src/data/config';
import { SANDBOX } from '../src/data/missions/sandbox';
import type { ForceDef, MissionDef, UnitKind } from '../src/data/schema';
import { createBattle } from '../src/sim';
CONFIG.maxUnits = 400;
const MIX: [UnitKind, number][] = [['rifle',0.45],['lmg',0.1],['assault',0.12],['mortar',0.05],['sniper',0.04],['medic',0.05],['at',0.05],['flame',0.05],['aa',0.02],['tank',0.02],['lightTank',0.02],['apc',0.01],['commander',0.01]];
function forcesFor(n: number, x0: number, dir: number): ForceDef[] {
  const out: ForceDef[] = []; let placed = 0;
  for (let k = 0; k < MIX.length; k++) { const [kind, frac] = MIX[k]; let c = Math.max(1, Math.round(n*frac)); if (k===MIX.length-1) c = Math.max(1, n-placed); if (placed+c>n) c=n-placed; if (c<=0) continue;
    for (let g = 0; g < Math.min(c,4); g++) { const cc = Math.floor(c/Math.min(c,4)) + (g < c % Math.min(c,4) ? 1 : 0); if (cc>0) out.push({ kind, count: cc, x: x0 - dir*(g*80+k*6), behaviour: 'assault' }); }
    placed += c; }
  return out;
}
const rounds = Number(process.argv[2] ?? 3);
for (let r = 0; r < rounds; r++) {
for (const n of [25, 80, 100, 140]) {
  const mission: MissionDef = { ...SANDBOX, events: [], start: [{ ...SANDBOX.start[0], forces: forcesFor(n,3550,1), sappers: 0, supplies: 0 }, { ...SANDBOX.start[1], forces: forcesFor(n,4450,-1), sappers: 0, supplies: 0 }] };
  const b = createBattle({ mission, difficulty: 'normal', seed: 11, upgrades: {}, commanders: ['human','human'] });
  const spikes: string[] = []; let sum = 0; let cnt = 0;
  for (let i = 0; i < 900 && !b.state.over; i++) {
    const t0 = performance.now(); b.step(); const dt = performance.now() - t0; sum += dt; cnt++;
    if (dt > 3) { const types: Record<string, number> = {}; for (let j = 0; j < b.events.count; j++) { const t = b.events.items[j].type; types[t] = (types[t] ?? 0) + 1; }
      spikes.push(`t${i}:${dt.toFixed(1)}ms ${JSON.stringify(types)}`); }
  }
  console.log(`round ${r} N=${n}: mean ${(sum/cnt).toFixed(3)} ms, ${spikes.length} spikes >3ms`); for (const s of spikes.slice(0, 8)) console.log('   ', s);
}}
