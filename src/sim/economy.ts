/**
 * Supplies and training: the passive HQ trickle, the per-kind training
 * queues, and the income estimate shown in the HUD. (Sapper deliveries happen
 * in orders.ts where the sappers walk.)
 */
import { CONFIG } from '../data/config';
import type { Side } from '../data/schema';
import { KIND_COUNT, KIND_DEFS, KIND_LIST, KIND_SAPPER } from './tables';
import { spawnUnit } from './units';
import type { World } from './world';

export function updateEconomy(w: World): void {
  const s = w.state;
  const dt = w.dt;
  for (let si = 0; si < 2; si++) {
    const side = s.sides[si];
    const hq = side.hq;
    if (!side.hasHq || !hq || !hq.alive) {
      side.income = 0;
      continue;
    }
    const mods = w.mods[si];

    const passive = CONFIG.hqIncomePerSec * mods.hqIncome * mods.income;
    const gain = passive * dt;
    side.supplies += gain;
    side.stats.suppliesGathered += gain;

    // Every kind has its own queue and trains one unit at a time, in parallel with the others.
    for (let k = 0; k < KIND_COUNT; k++) {
      const kind = KIND_LIST[k];
      if (side.queue[kind] <= 0) continue;
      const trainTime = KIND_DEFS[k].trainTime;
      let left = side.trainLeft[kind] - dt;
      if (left <= 0) {
        // Under Fall Back the new unit stays inside with the garrison.
        const u = spawnUnit(w, si as Side, k, hq.doorX, 'army', side.order === 'fallBack', true);
        if (u) {
          side.queue[kind]--;
          side.stats.trained++;
          const e = w.events.emit('trainDone');
          e.side = si;
          e.kind = kind;
          e.unit = u.index;
          e.unitId = u.id;
          left = side.queue[kind] > 0 ? trainTime : 0;
        } else {
          // Unit pool full: keep the finished unit waiting and try again next tick.
          left = 0;
        }
      }
      side.trainLeft[kind] = left;
      side.progress[kind] = side.queue[kind] > 0 && trainTime > 0 ? 1 - left / trainTime : 0;
    }

    // Income estimate: the trickle plus what the working sappers bring in over a full round trip.
    const sapper = KIND_DEFS[KIND_SAPPER];
    const working = side.order === 'fallBack' ? 0 : side.alive.sapper;
    const trip = (2 * CONFIG.dumpDistance) / (sapper.speed * mods.sapperSpeed) + CONFIG.sapperLoadTime;
    side.income = passive + (working * CONFIG.sapperCarry * mods.sapperCarry * mods.income) / trip;
  }
}
