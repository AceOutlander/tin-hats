/**
 * Equal-cost matchups (src/sim/matchup.ts): the counter relationships of DESIGN section 6, the
 * trench's edge against bullets, armour that shrugs off bullets but not explosives or rockets, and
 * that a sensible mixed army beats any one-kind spam.
 *
 * "x beats y" in the open means: over MATCHUP.seeds duels with x as side 0 and as many with x as
 * side 1 (both sides advancing), x wins at least two thirds of them.
 */
import { describe, expect, it } from 'vitest';
import { MATCHUP } from '../../src/data/balance';
import type { UnitKind } from '../../src/data/schema';
import { UNITS } from '../../src/data/units';
import { armyCost, compare, equalCounts, monoArmy, runMatchup, type MatchupGround, type MatchupResult } from '../../src/sim';

const SEEDS = MATCHUP.seeds;
const OPEN_DUELS = 2 * SEEDS;
const CLEAR = Math.ceil((2 / 3) * OPEN_DUELS);

const cache = new Map<string, MatchupResult>();
/** Kind a (side 0, the attacker on the trench ground) against kind b, cached. */
function duel(a: UnitKind, b: UnitKind, ground: MatchupGround): MatchupResult {
  const key = `${ground}:${a}:${b}`;
  let r = cache.get(key);
  if (!r) {
    r = runMatchup(a, b, ground, SEEDS);
    cache.set(key, r);
  }
  return r;
}

/** Duels won by x and by y in the open, over both orderings. */
function openWins(x: UnitKind, y: UnitKind): [number, number] {
  const asA = duel(x, y, 'open');
  const asB = duel(y, x, 'open');
  return [asA.winsA + asB.winsB, asA.winsB + asB.winsA];
}

/** Mean fraction of x's starting value left against y in the open, over both orderings. */
function openLeft(x: UnitKind, y: UnitKind): number {
  return (duel(x, y, 'open').leftA + duel(y, x, 'open').leftB) / 2;
}

function expectBeats(x: UnitKind, y: UnitKind): void {
  const [mine, theirs] = openWins(x, y);
  expect(mine, `${x} should beat ${y} in the open (won ${mine}, lost ${theirs} of ${OPEN_DUELS})`).toBeGreaterThanOrEqual(CLEAR);
}

/** The attacker x against defender y dug into a trench: duels won by the attacker and by the defender. */
function trenchWins(x: UnitKind, y: UnitKind): [number, number] {
  const r = duel(x, y, 'trench');
  return [r.winsA, r.winsB];
}

/**
 * Every equal-cost matchup of kind k against another kind, across both tables: in the open (both
 * orderings together), attacking each kind's trench and holding its own trench against each kind.
 */
function record(k: UnitKind): { won: string[]; lost: string[] } {
  const won: string[] = [];
  const lost: string[] = [];
  for (const o of MATCHUP.kinds) {
    if (o === k) continue;
    const [mine, theirs] = openWins(k, o);
    if (mine > theirs) won.push(`open ${o}`);
    else if (theirs > mine) lost.push(`open ${o}`);
    const attack = duel(k, o, 'trench').verdict;
    if (attack > 0) won.push(`attacking ${o}`);
    else if (attack < 0) lost.push(`attacking ${o}`);
    const hold = duel(o, k, 'trench').verdict;
    if (hold < 0) won.push(`holding against ${o}`);
    else if (hold > 0) lost.push(`holding against ${o}`);
  }
  return { won, lost };
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

  it('riflemen screen the specialists: they beat snipers and anti-tank teams', () => {
    expectBeats('rifle', 'sniper');
    expectBeats('rifle', 'at');
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

describe('armour', () => {
  it('anti-tank teams beat tanks in the open', () => {
    expectBeats('at', 'tank');
  });

  it('massed anti-tank teams dug in beat a tank attack', () => {
    const [attacker, defender] = trenchWins('tank', 'at');
    expect(defender, `tanks attacking anti-tank teams dug in: attacker ${attacker}, defender ${defender}`).toBeGreaterThanOrEqual(SEEDS - 1);
  });

  it('tanks beat riflemen, machine guns, assault troops, mortars and snipers that have no anti-tank support', () => {
    for (const k of ['rifle', 'lmg', 'assault', 'mortar', 'sniper'] as const) expectBeats('tank', k);
  });

  it('tanks shrug off bullets: against riflemen, machine guns and snipers they keep at least 85 percent of their value', () => {
    for (const k of ['rifle', 'lmg', 'sniper'] as const) {
      expect(openLeft('tank', k), `tank value left against ${k}`).toBeGreaterThanOrEqual(0.85);
    }
  });

  it('mortars and grenades threaten tanks: mortar crews and assault troops cost them at least a quarter of their value', () => {
    for (const k of ['mortar', 'assault'] as const) {
      expect(openLeft('tank', k), `tank value left against ${k}`).toBeLessThanOrEqual(0.75);
    }
  });

  it('mortars outrange a tank line that only holds', () => {
    const [attacker, defender] = trenchWins('mortar', 'tank');
    expect(attacker, `mortars attacking holding tanks: attacker ${attacker}, defender ${defender}`).toBeGreaterThanOrEqual(SEEDS - 1);
  });

  it('a mono-tank army loses to a mixed army of the same cost that includes anti-tank teams', () => {
    const mixed = MATCHUP.mixedArmy;
    expect(mixed.some((e) => e.kind === 'at' && e.count >= 2)).toBe(true);
    const tanks = monoArmy('tank', armyCost(mixed));
    expect(tanks[0].count).toBeGreaterThanOrEqual(3);
    const asA = compare(mixed, tanks, 'open', SEEDS);
    const asB = compare(tanks, mixed, 'open', SEEDS);
    const won = asA.winsA + asB.winsB;
    expect(won, `mixed army against ${tanks[0].count} tanks: won ${won} of ${OPEN_DUELS}`).toBeGreaterThanOrEqual(CLEAR);
  });
});

describe('anti-tank teams', () => {
  it('are not helpless against infantry: in the open they beat at least one infantry kind besides tanks', () => {
    const beaten = MATCHUP.kinds.filter((o) => {
      if (o === 'at' || o === 'tank') return false;
      const [mine, theirs] = openWins('at', o);
      return mine > theirs;
    });
    expect(beaten.length, 'infantry kinds beaten by anti-tank teams in the open').toBeGreaterThanOrEqual(1);
  });

  it('wreck pillboxes and tanks but stay poor against infantry: riflemen, assault troops and snipers beat them', () => {
    expectBeats('rifle', 'at');
    expectBeats('assault', 'at');
    expectBeats('sniper', 'at');
  });
});

describe('every unit kind has counters and victims', () => {
  for (const k of MATCHUP.kinds) {
    it(`${k} loses at least two and wins at least two equal-cost matchups across both tables`, () => {
      const { won, lost } = record(k);
      expect(lost.length, `${k} loses only ${lost.join(', ') || 'nothing'}`).toBeGreaterThanOrEqual(2);
      expect(won.length, `${k} wins only ${won.join(', ') || 'nothing'}`).toBeGreaterThanOrEqual(2);
    });
  }
});

describe('trenches', () => {
  it('give their defenders a clear edge against bullet units', () => {
    for (const k of ['rifle', 'lmg', 'sniper'] as const) {
      const [attacker, defender] = trenchWins(k, k);
      expect(defender, `${k} attacking ${k} dug in: attacker ${attacker}, defender ${defender}`).toBeGreaterThanOrEqual(SEEDS - 1);
      expect(defender).toBeGreaterThan(attacker);
      const dug = duel(k, k, 'trench');
      const open = duel(k, k, 'open');
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
