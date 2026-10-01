/**
 * Equal-cost matchups (src/sim/matchup.ts): the counter relationships of DESIGN section 6, the
 * trench's edge against bullets, and that a sensible mixed army beats any one-kind spam.
 *
 * "x beats y" in the open means: over MATCHUP.seeds duels with x as side 0 and as many with x as
 * side 1 (both sides advancing), x wins at least two thirds of them.
 */
import { describe, expect, it } from 'vitest';
import { MATCHUP } from '../../src/data/balance';
import type { UnitKind } from '../../src/data/schema';
import { UNITS } from '../../src/data/units';
import { armyCost, compare, equalCounts, monoArmy, runMatchup } from '../../src/sim';

const SEEDS = MATCHUP.seeds;
const OPEN_DUELS = 2 * SEEDS;
const CLEAR = Math.ceil((2 / 3) * OPEN_DUELS);

/** Duels won by x and by y in the open, over both orderings. */
const openCache = new Map<string, [number, number]>();
function openWins(x: UnitKind, y: UnitKind): [number, number] {
  const key = `${x}:${y}`;
  const hit = openCache.get(key);
  if (hit) return hit;
  const asA = runMatchup(x, y, 'open', SEEDS);
  const asB = runMatchup(y, x, 'open', SEEDS);
  const out: [number, number] = [asA.winsA + asB.winsB, asA.winsB + asB.winsA];
  openCache.set(key, out);
  openCache.set(`${y}:${x}`, [out[1], out[0]]);
  return out;
}

function expectBeats(x: UnitKind, y: UnitKind): void {
  const [mine, theirs] = openWins(x, y);
  expect(mine, `${x} should beat ${y} in the open (won ${mine}, lost ${theirs} of ${OPEN_DUELS})`).toBeGreaterThanOrEqual(CLEAR);
}

/** The attacker x against defender y dug into a trench: duels won by the attacker and by the defender. */
function trenchWins(x: UnitKind, y: UnitKind): [number, number] {
  const r = runMatchup(x, y, 'trench', SEEDS);
  return [r.winsA, r.winsB];
}

describe('the matchup harness', () => {
  it('pits armies of (nearly) equal cost against each other', () => {
    for (const a of MATCHUP.kinds) {
      for (const b of MATCHUP.kinds) {
        const [na, nb] = equalCounts(a, b);
        const ca = na * UNITS[a].cost;
        const cb = nb * UNITS[b].cost;
        expect(ca).toBeGreaterThanOrEqual(MATCHUP.budgetMin);
        expect(ca).toBeLessThanOrEqual(MATCHUP.budgetMax);
        // Whole units cannot always match exactly: within half the dearer unit's cost.
        expect(Math.abs(ca - cb)).toBeLessThanOrEqual(Math.max(UNITS[a].cost, UNITS[b].cost) / 2);
      }
    }
  });

  it('is deterministic', () => {
    const one = runMatchup('rifle', 'lmg', 'open', 2);
    const two = runMatchup('rifle', 'lmg', 'open', 2);
    expect(two).toEqual(one);
  });
});

describe('counters in the open (DESIGN section 6)', () => {
  it('machine guns beat infantry in the open', () => {
    expectBeats('lmg', 'rifle');
    expectBeats('lmg', 'assault');
  });

  it('assault troops beat mortars', () => {
    expectBeats('assault', 'mortar');
  });

  it('mortars beat machine guns', () => {
    expectBeats('mortar', 'lmg');
  });

  it('snipers beat machine guns and mortars', () => {
    expectBeats('sniper', 'lmg');
    expectBeats('sniper', 'mortar');
  });

  it('anti-tank teams beat tanks', () => {
    expectBeats('at', 'tank');
  });

  it('tanks beat riflemen, machine guns and assault troops that have no anti-tank support', () => {
    expectBeats('tank', 'rifle');
    expectBeats('tank', 'lmg');
    expectBeats('tank', 'assault');
  });

  it('no unit wins every equal-cost matchup in the open', () => {
    for (const k of MATCHUP.kinds) {
      const losesOrTies = MATCHUP.kinds.filter((o) => {
        if (o === k) return false;
        const [mine, theirs] = openWins(k, o);
        return theirs >= mine;
      });
      expect(losesOrTies, `${k} wins every matchup`).not.toHaveLength(0);
    }
  });
});

describe('trenches', () => {
  it('give their defenders a clear edge against bullet units', () => {
    for (const k of ['rifle', 'lmg', 'sniper'] as const) {
      const [attacker, defender] = trenchWins(k, k);
      expect(defender, `${k} attacking ${k} dug in: attacker ${attacker}, defender ${defender}`).toBeGreaterThanOrEqual(SEEDS - 1);
      expect(defender).toBeGreaterThan(attacker);
      const dug = runMatchup(k, k, 'trench', SEEDS);
      const open = runMatchup(k, k, 'open', SEEDS);
      // Dug in, the defender keeps much more of itself than the same side does in the open.
      expect(dug.leftB, `${k} defender value left`).toBeGreaterThan(open.leftB + 0.2);
    }
  });

  it('do not save their defenders from mortars and grenades', () => {
    for (const [attacker, defender] of [
      ['mortar', 'rifle'],
      ['mortar', 'lmg'],
      ['assault', 'rifle'],
    ] as const) {
      const [a, d] = trenchWins(attacker, defender);
      expect(a, `${attacker} attacking ${defender} dug in: attacker ${a}, defender ${d}`).toBeGreaterThanOrEqual(SEEDS - 1);
    }
  });
});

describe('a mixed army', () => {
  const mixed = MATCHUP.mixedArmy;
  const budget = armyCost(mixed);

  it('is a sensible army: every combat kind and a medic', () => {
    const kinds = new Set(mixed.map((e) => e.kind));
    for (const k of MATCHUP.kinds) expect(kinds.has(k), k).toBe(true);
    expect(kinds.has('medic')).toBe(true);
  });

  for (const kind of MATCHUP.kinds) {
    it(`beats a spam of ${kind} of the same cost`, () => {
      const mono = monoArmy(kind, budget);
      expect(Math.abs(armyCost(mono) - budget)).toBeLessThanOrEqual(UNITS[kind].cost / 2);
      const asA = compare(mixed, mono, 'open', SEEDS);
      const asB = compare(mono, mixed, 'open', SEEDS);
      const won = asA.winsA + asB.winsB;
      const lost = asA.winsB + asB.winsA;
      expect(won, `mixed army against ${kind} spam: won ${won}, lost ${lost} of ${OPEN_DUELS}`).toBeGreaterThanOrEqual(CLEAR);
    });
  }
});
