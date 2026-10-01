/**
 * Fairness of the whole game: the AI against itself on the mirrored proving ground
 * (SANDBOX_MIRROR: same trench, wire, garrison, supplies, build plan and supports on both sides)
 * wins about as often from either side, and almost every battle is decided.
 */
import { describe, expect, it } from 'vitest';
import { SANDBOX_MIRROR } from '../../src/data/missions/sandbox';
import { runBattle } from '../../src/sim';

/** Battles (seeds 1..SEEDS); at least 60 by the brief. */
const SEEDS = 120;
/** A battle still running after this long is undecided (the ground expects 4 to 30 minutes). */
const MAX_SECONDS = SANDBOX_MIRROR.expectedMinutes[1] * 60;

describe('mirrored AI against AI on the proving ground', () => {
  it(`wins 40 to 60 percent from either side over ${SEEDS} seeds, with under 10 percent undecided`, () => {
    const wins = [0, 0];
    let undecided = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
      const r = runBattle(
        { mission: SANDBOX_MIRROR, difficulty: 'normal', seed, upgrades: {}, commanders: ['ai', 'ai'] },
        MAX_SECONDS,
      );
      if (r.winner === 0 || r.winner === 1) wins[r.winner]++;
      else undecided++;
    }
    const decided = wins[0] + wins[1];
    const share = wins[0] / decided;
    const summary = `side 0 ${wins[0]}, side 1 ${wins[1]}, undecided ${undecided} of ${SEEDS}`;
    expect(undecided / SEEDS, summary).toBeLessThan(0.1);
    expect(share, summary).toBeGreaterThanOrEqual(0.4);
    expect(share, summary).toBeLessThanOrEqual(0.6);
  });
});
