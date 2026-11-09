/**
 * Supplies and training: the passive HQ trickle, the per-kind training
 * queues, and the income estimate shown in the HUD. (Sapper deliveries happen
 * in orders.ts where the sappers walk.)
 */
import { CONFIG } from '../data/config';
import type { Side, UnitKind } from '../data/schema';
import { KIND_COUNT, KIND_DEFS, KIND_LIST, KIND_SAPPER, KIND_SQUAD } from './tables';
import { spawnUnit } from './units';
import { orderFor, type World } from './world';

/** The value setProgress() stores (a typed array, so the fraction is not boxed on the way). */
const PROGRESS = new Float64Array(1);

/**
 * progress[KIND_LIST[k]] = PROGRESS[0], with a named store per kind: a keyed store over ten
 * different names goes megamorphic and allocates a heap number for every fraction it writes.
 */
function setProgress(p: Record<UnitKind, number>, k: number): void {
  const v = PROGRESS[0];
  switch (KIND_LIST[k]) {
    case 'sapper':
      p.sapper = v;
      break;
    case 'rifle':
      p.rifle = v;
      break;
    case 'conscript':
      p.conscript = v;
      break;
    case 'lmg':
      p.lmg = v;
      break;
    case 'assault':
      p.assault = v;
      break;
    case 'mortar':
      p.mortar = v;
      break;
    case 'sniper':
      p.sniper = v;
      break;
    case 'medic':
      p.medic = v;
      break;
    case 'at':
      p.at = v;
      break;
    case 'tank':
      p.tank = v;
      break;
    case 'heavyTank':
      p.heavyTank = v;
      break;
    case 'apc':
      p.apc = v;
      break;
    case 'flame':
      p.flame = v;
      break;
    case 'commander':
      p.commander = v;
      break;
    case 'aa':
      p.aa = v;
      break;
    case 'lightTank':
      p.lightTank = v;
      break;
  }
}

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
      const slot = si * KIND_COUNT + k;
      let left = w.trainLeft[slot] - dt;
      if (left <= 0) {
        // A finished order sends out its whole squad (one man for most kinds; UnitDef.squad for conscripts).
        if (w.squadLeft[slot] <= 0) w.squadLeft[slot] = KIND_SQUAD[k];
        // Under Fall Back (army-wide or for its kind) the new men stay inside with the garrison.
        const inside = orderFor(side, kind) === 'fallBack';
        while (w.squadLeft[slot] > 0) {
          const u = spawnUnit(w, si as Side, k, hq.doorX, 'army', inside, true);
          if (!u) break;
          w.squadLeft[slot]--;
          side.stats.trained++;
          const e = w.events.emit('trainDone');
          e.side = si;
          e.kind = kind;
          e.unit = u.index;
          e.unitId = u.id;
        }
        if (w.squadLeft[slot] === 0) {
          side.queue[kind]--;
          // The next order starts where this one finished, so the leftover fraction of a tick is not lost.
          left = side.queue[kind] > 0 ? trainTime + left : 0;
        } else {
          // Unit pool full: keep the rest of the finished order waiting and try again next tick.
          left = 0;
        }
      }
      w.trainLeft[slot] = left;
      PROGRESS[0] = side.queue[kind] > 0 && trainTime > 0 ? 1 - left / trainTime : 0;
      setProgress(side.progress, k);
    }

    // Income estimate: the trickle plus what the working sappers bring in over a full round trip.
    const sapper = KIND_DEFS[KIND_SAPPER];
    const working = orderFor(side, 'sapper') === 'fallBack' ? 0 : side.alive.sapper;
    const trip = (2 * CONFIG.dumpDistance) / (sapper.speed * mods.sapperSpeed) + CONFIG.sapperLoadTime;
    side.income = passive + (working * CONFIG.sapperCarry * mods.sapperCarry * mods.income) / trip;
  }
}
