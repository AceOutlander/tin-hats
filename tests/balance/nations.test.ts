/**
 * Counters of the Soviet signature conscripts (docs/campaigns/NATIONS.md section 2: "Conscripts (cheap, 5 per
 * order, weaker aim): LMG and mortar"), in the equal-cost matchup harness. The Katyusha's counter (spreading out)
 * is tested in tests/unit/sim-soviet.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { MATCHUP } from '../../src/data/balance';
import type { UnitKind } from '../../src/data/schema';
import { runMatchup, type MatchupResult } from '../../src/sim';
import { HEAVY } from './helpers';

const SEEDS = MATCHUP.seeds;
const OPEN_DUELS = 2 * SEEDS;
const CLEAR = Math.ceil((2 / 3) * OPEN_DUELS);

const cache = new Map<string, MatchupResult>();
function duel(a: UnitKind, b: UnitKind, ground: 'open' | 'trench'): MatchupResult {
  const key = `${ground}:${a}:${b}`;
  let r = cache.get(key);
  if (!r) {
    r = runMatchup(a, b, ground, SEEDS);
    cache.set(key, r);
  }
  return r;
}

/** Duels won by x in the open over both orderings. */
function openWins(x: UnitKind, y: UnitKind): number {
  return duel(x, y, 'open').winsA + duel(y, x, 'open').winsB;
}

describe('Soviet conscripts', () => {
  it('are many men for the money: about twice the riflemen an equal budget buys', () => {
    const r = duel('conscript', 'rifle', 'open');
    expect(r.counts[0]).toBeGreaterThanOrEqual(r.counts[1] * 1.6);
    expect(Math.abs(r.cost[0] - r.cost[1]) / r.cost[1]).toBeLessThan(0.1);
  });

  it('trade evenly with riflemen at equal cost in the open: worth fielding, not a better rifleman', HEAVY, () => {
    const won = openWins('conscript', 'rifle');
    expect(won, `conscripts won ${won} of ${OPEN_DUELS} against riflemen`).toBeGreaterThanOrEqual(Math.floor(OPEN_DUELS / 4));
    expect(won, `conscripts won ${won} of ${OPEN_DUELS} against riflemen`).toBeLessThanOrEqual(Math.ceil((3 * OPEN_DUELS) / 4));
  });

  it('are cut down by machine guns in the open, in a trench and attacking one', HEAVY, () => {
    const won = openWins('lmg', 'conscript');
    expect(won, `machine guns won ${won} of ${OPEN_DUELS} in the open`).toBeGreaterThanOrEqual(CLEAR);
    expect(duel('conscript', 'lmg', 'trench').winsB, 'machine guns holding a trench').toBeGreaterThanOrEqual(SEEDS - 1);
    expect(duel('lmg', 'conscript', 'trench').winsA, 'machine guns attacking conscripts dug in').toBeGreaterThanOrEqual(SEEDS - 1);
  });

  it('are shelled out of a trench by mortars, where riflemen cannot shift them', HEAVY, () => {
    const mortar = duel('mortar', 'conscript', 'trench');
    const rifle = duel('rifle', 'conscript', 'trench');
    expect(mortar.winsA, `mortars attacking conscripts dug in: ${mortar.winsA} of ${SEEDS}`).toBeGreaterThanOrEqual(SEEDS - 1);
    expect(rifle.winsA).toBeLessThan(mortar.winsA);
  });
});
