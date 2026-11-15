/**
 * Scripted waves placed at a fixed x (src/sim/mission.ts spawnForce): a wave never appears behind the other side's
 * line, so the two lines never pass through each other; with no ground left in front of the enemy it never arrives.
 */
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/data/config';
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

describe('a side with no HQ comes on over its map edge', () => {
  it('an army sent forward stops short of that edge, so the waves still arrive (CONFIG.entryKeepOut)', () => {
    const base = testMission();
    const m = testMission({
      trenches: [],
      pillboxes: [],
      wire: [],
      a: { forces: [{ kind: 'rifle', count: 4, x: base.length - CONFIG.entryKeepOut - 150 }] },
      b: { hasHq: false },
      events: [{ type: 'wave', when: { at: 12 }, side: 1, forces: [{ kind: 'rifle', count: 3 }] }],
    });
    const b = makeBattle({ mission: m });
    b.command(0, { type: 'order', order: 'advance' });
    const line = m.length - CONFIG.entryKeepOut;
    let furthest = 0;
    run(b, 12.05, () => {
      checkInvariants(b);
      for (const u of unitsOf(b, 0)) furthest = Math.max(furthest, u.x);
    });
    // They walked up to the line and no further; before the fix they stood on the map edge and every wave was cut off.
    expect(furthest).toBeGreaterThan(line - 5);
    expect(furthest).toBeLessThanOrEqual(line);
    const theirs = unitsOf(b, 1);
    expect(theirs).toHaveLength(3);
    for (const u of theirs) expect(u.x).toBeGreaterThan(line + CONFIG.contactGap);
  });
});
