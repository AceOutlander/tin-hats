/**
 * countClusters is a sorted sweep; it must give exactly what the old all-pairs count gave,
 * on random layouts (ties, exact-radius gaps, deaths, units going inside, pool slots reused)
 * and inside a real heavy battle.
 */
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/data/config';
import { Rng } from '../../src/sim';
import { countClusters } from '../../src/sim/structures';
import type { BattleState } from '../../src/sim/types';
import type { World } from '../../src/sim/world';
import { makeBattle, testMission } from './sim-helpers';

/** The all-pairs count countClusters replaced (src/sim/structures.ts before the sweep). */
function allPairs(s: BattleState, out: Uint8Array): void {
  const units = s.units;
  const radius = CONFIG.clusterRadius;
  for (let i = 0; i < s.unitCount; i++) {
    const u = units[i];
    if (!u.alive || u.inside) {
      out[i] = 0;
      continue;
    }
    let n = 0;
    for (let j = 0; j < s.unitCount; j++) {
      const v = units[j];
      if (!v.alive || v.inside || v.side !== u.side) continue;
      const d = v.x > u.x ? v.x - u.x : u.x - v.x;
      if (d <= radius) n++;
    }
    out[i] = n > 255 ? 255 : n;
  }
}

function mismatches(w: World, ref: Uint8Array): number {
  allPairs(w.state, ref);
  let bad = 0;
  for (let i = 0; i < w.state.unitCount; i++) if (w.cluster[i] !== ref[i]) bad++;
  return bad;
}

function freshWorld(): World {
  return makeBattle({ mission: testMission({ length: 4000 }) }) as unknown as World;
}

describe('countClusters (sorted sweep)', () => {
  it('matches the all-pairs count on random layouts over many ticks', () => {
    const w = freshWorld();
    const s = w.state;
    const rng = new Rng(1234);
    const ref = new Uint8Array(s.units.length);
    const cap = s.units.length;
    let total = 0;
    for (let layout = 0; layout < 60; layout++) {
      s.unitCount = 1 + rng.int(cap);
      const clumps = 1 + rng.int(6);
      for (let i = 0; i < s.unitCount; i++) {
        const u = s.units[i];
        u.alive = rng.next() < 0.85;
        u.inside = rng.next() < 0.1;
        u.side = rng.next() < 0.5 ? 0 : 1;
        const centre = 400 + 600 * rng.int(clumps);
        // Half on a 25 px grid (ties and gaps of exactly clusterRadius), half anywhere.
        u.x = rng.next() < 0.5 ? centre + 25 * (rng.int(9) - 4) : centre + rng.range(-160, 160);
      }
      for (let tick = 0; tick < 25; tick++) {
        countClusters(w);
        total += mismatches(w, ref);
        // Move everyone a little; some die, revive into a reused slot, step inside or out.
        for (let i = 0; i < s.unitCount; i++) {
          const u = s.units[i];
          u.x += rng.range(-30, 30);
          const r = rng.next();
          if (r < 0.03) u.alive = !u.alive;
          else if (r < 0.05) u.inside = !u.inside;
          else if (r < 0.06) u.side = u.side === 0 ? 1 : 0;
          else if (r < 0.08) u.x = Math.round(u.x / 25) * 25;
        }
      }
    }
    expect(total).toBe(0);
  });

  it('caps a crowd at 255', () => {
    const w = freshWorld();
    const s = w.state;
    expect(s.units.length).toBeGreaterThan(0);
    for (let i = 0; i < s.units.length; i++) {
      const u = s.units[i];
      u.alive = true;
      u.inside = false;
      u.side = 0;
      u.x = 1000;
    }
    s.unitCount = s.units.length;
    countClusters(w);
    const ref = new Uint8Array(s.units.length);
    expect(mismatches(w, ref)).toBe(0);
    expect(w.cluster[0]).toBe(Math.min(255, s.units.length));
  });

  it('matches the all-pairs count every tick of a heavy battle', () => {
    const mission = testMission({
      length: 4000,
      a: { forces: [{ kind: 'rifle', count: 40, x: 1700 }, { kind: 'lmg', count: 10, x: 1600 }, { kind: 'mortar', count: 6, x: 1400 }] },
      b: { forces: [{ kind: 'rifle', count: 40, x: 2300 }, { kind: 'lmg', count: 10, x: 2400 }, { kind: 'mortar', count: 6, x: 2600 }] },
    });
    const b = makeBattle({ mission });
    b.command(0, { type: 'order', order: 'advance' });
    b.command(1, { type: 'order', order: 'advance' });
    const w = b as unknown as World;
    const ref = new Uint8Array(w.state.units.length);
    let total = 0;
    let deaths = 0;
    for (let t = 0; t < 600; t++) {
      // The step counts clusters before anyone moves, on the positions the last step left.
      allPairs(w.state, ref);
      b.step();
      for (let i = 0; i < w.state.unitCount; i++) if (w.cluster[i] !== ref[i]) total++;
      deaths += w.state.unitCount - w.state.units.slice(0, w.state.unitCount).filter((u) => u.alive).length > 0 ? 1 : 0;
    }
    expect(total).toBe(0);
    expect(deaths).toBeGreaterThan(0); // the armies did meet
  });
});
