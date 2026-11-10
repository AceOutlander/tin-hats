/**
 * Scripted waves placed at a fixed x (src/sim/mission.ts spawnForce): a wave never appears behind the other side's
 * line, so the two lines never pass through each other; with no ground left in front of the enemy it never arrives.
 */
import { describe, expect, it } from 'vitest';
import { checkInvariants, makeBattle, run, testMission, unitsOf } from './sim-helpers';

describe('waves at a fixed x', () => {
  it('come in just ahead of the enemy line when the enemy already stands past that x', () => {
    const m = testMission({
      trenches: [],
      pillboxes: [],
      wire: [],
      a: { forces: [{ kind: 'rifle', count: 3, x: 3000 }] },
      events: [{ type: 'wave', when: { at: 2 }, side: 1, forces: [{ kind: 'rifle', count: 3, x: 1500 }] }],
    });
    const b = makeBattle({ mission: m });
    run(b, 3, checkInvariants);
    const mine = Math.max(...unitsOf(b, 0).filter((u) => !u.inside).map((u) => u.x));
    const theirs = unitsOf(b, 1).filter((u) => !u.inside);
    expect(theirs.length).toBeGreaterThanOrEqual(3);
    for (const u of theirs) expect(u.x).toBeGreaterThan(mine);
  });

  it('as placed when the ground is free', () => {
    const m = testMission({
      trenches: [],
      pillboxes: [],
      wire: [],
      events: [{ type: 'wave', when: { at: 1 }, side: 1, forces: [{ kind: 'rifle', count: 1, x: 3500 }] }],
    });
    const b = makeBattle({ mission: m });
    run(b, 1.05);
    const theirs = unitsOf(b, 1).filter((u) => !u.inside);
    expect(theirs).toHaveLength(1);
    expect(Math.abs(theirs[0].x - 3500)).toBeLessThan(30);
  });
});
