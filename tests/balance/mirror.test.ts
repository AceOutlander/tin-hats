/**
 * Fairness of the whole game: the AI against itself on the mirrored proving ground
 * (SANDBOX_MIRROR: same trench, wire, garrison, supplies, build plan and supports on both sides)
 * wins about as often from either side, and almost every battle is decided.
 *
 * Over n fair battles side 0's share has a standard deviation of 0.5 / sqrt(n): a 45 to 55 percent
 * band is only about one deviation wide at 100 battles, so the test plays CAMPAIGN_RUNS.mirrorSeeds
 * (at least 100, in practice several hundred) to keep the band a real test of fairness.
 */
import { describe, expect, it } from 'vitest';
import { CAMPAIGN_RUNS } from '../../src/data/balance';
import { runMirror } from '../../src/sim';
import { HEAVY } from './helpers';

describe('mirrored AI against AI on the proving ground', () => {
  it(`wins 45 to 55 percent from either side over ${CAMPAIGN_RUNS.mirrorSeeds} seeds, with under 5 percent undecided`, HEAVY, () => {
    expect(CAMPAIGN_RUNS.mirrorSeeds).toBeGreaterThanOrEqual(100);
    const r = runMirror(CAMPAIGN_RUNS.mirrorSeeds);
    const summary = `side 0 ${r.wins[0]}, side 1 ${r.wins[1]}, undecided ${r.undecided} of ${r.seeds}`;
    expect(r.undecided / r.seeds, summary).toBeLessThan(0.05);
    expect(r.share, summary).toBeGreaterThanOrEqual(0.45);
    expect(r.share, summary).toBeLessThanOrEqual(0.55);
  });
});
