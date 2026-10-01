/**
 * Commander behaviour added in the balance phase: no Fall Back the length of the map from a far
 * forward line, a race against a losing deadline, and scripted reinforcements that had to wait for
 * room under the population cap arriving at their scripted post rather than at the HQ door.
 */
import { describe, expect, it } from 'vitest';
import { AI, AI_RECOVERY } from '../../src/data/ai';
import { CONFIG } from '../../src/data/config';
import type { MissionAiPlan } from '../../src/data/schema';
import type { Battle } from '../../src/sim';
import { killUnit } from '../../src/sim/units';
import type { World } from '../../src/sim/world';
import { checkInvariants, collect, makeBattle, run, testMission, unitsOf } from './sim-helpers';

const HOLD_ONLY: MissionAiPlan = { sappers: 0, build: [], firstAttackAfter: 100_000 };

describe('Fall Back', () => {
  it('holds a trench far forward of its HQ against a bigger force instead of running home', () => {
    const mission = testMission({
      length: 9000,
      ai: HOLD_ONLY,
      trenches: [{ id: 1, x: 3000, width: 160, slots: 6, owner: 1 }],
      a: { forces: [{ kind: 'rifle', count: 14, x: 2300 }] },
      b: { forces: [{ kind: 'rifle', count: 3, trenchId: 1 }] },
    });
    const b = makeBattle({ mission, commanders: ['human', 'ai'] });
    const door = b.state.sides[1].hq?.doorX ?? 0;
    expect(door - 3000).toBeGreaterThan(AI_RECOVERY.homeLineReach);
    b.command(0, { type: 'order', order: 'advance' });
    const changes = collect(b, 20, 'orderChanged').filter((e) => e.side === 1);
    expect(changes.filter((e) => e.order === 'fallBack')).toHaveLength(0);
    expect(b.state.sides[1].order).toBe('hold');
  });
});

describe('a losing deadline', () => {
  it('makes the side that loses at the clock attack with what it has once the end is near', () => {
    const seconds = 200;
    const mission = testMission({
      length: 6000,
      timer: { seconds, onExpire: 'lose', label: 'Deadline' },
      bot: { sappers: 0, build: [], firstAttackAfter: 0 },
      ai: HOLD_ONLY,
      trenches: [{ id: 1, x: 4500, width: 200, slots: 8, owner: 1 }],
      a: { forces: [{ kind: 'rifle', count: 6, x: 1500 }] },
      b: { forces: [{ kind: 'rifle', count: 8, trenchId: 1 }] },
    });
    // Far too weak to attack on its own judgement: only the clock can send it in.
    expect(6 * 45).toBeGreaterThanOrEqual(AI.minAttackStrength);
    const b = makeBattle({ mission, commanders: ['bot', 'ai'] });
    const changes = collect(b, seconds - AI_RECOVERY.deadlineRush + 5, 'orderChanged').filter((e) => e.side === 0);
    const advance = changes.find((e) => e.order === 'advance');
    expect(advance, 'the bot advances once the clock is short').toBeDefined();
    expect(advance?.time ?? 0).toBeGreaterThanOrEqual(seconds - AI_RECOVERY.deadlineRush);
  });
});

/** Kill `n` living riflemen of a side, as if shot. */
function kill(b: Battle, side: 0 | 1, n: number): void {
  const w = b as unknown as World;
  for (const u of unitsOf(b, side, 'rifle').slice(0, n)) killUnit(w, u, 0, 1, 1 - side);
}

describe('reinforcements that waited for room', () => {
  function capped(postX: number): Battle {
    const mission = testMission({
      length: 6000,
      trenches: [{ id: 1, x: 2000, width: 160, slots: 6, owner: 0 }],
      a: { hqHpMul: 50, forces: [{ kind: 'rifle', count: CONFIG.popCap, x: 1900 }] },
      b: { hqHpMul: 50 },
      events: [{ type: 'wave', when: { at: 1 }, side: 0, forces: [{ kind: 'rifle', count: 3, x: postX }] }],
    });
    const b = makeBattle({ mission });
    run(b, 1.1, checkInvariants);
    expect(b.state.sides[0].reservePop).toBe(3);
    kill(b, 0, 3);
    run(b, 2 / CONFIG.tickRate, checkInvariants);
    expect(b.state.sides[0].reservePop).toBe(0);
    return b;
  }

  it('arrive at their scripted post when it lies behind the hold line', () => {
    const b = capped(1500);
    const near = unitsOf(b, 0, 'rifle').filter((u) => Math.abs(u.x - 1500) <= CONFIG.spacing * 3);
    expect(near.length).toBeGreaterThanOrEqual(3);
  });

  it('come out of the HQ door when their post lies beyond the hold line', () => {
    const b = capped(3500);
    const door = b.state.sides[0].hq?.doorX ?? 0;
    const atDoor = unitsOf(b, 0, 'rifle').filter((u) => Math.abs(u.x - door) <= CONFIG.spacing * 2);
    expect(atDoor.length).toBeGreaterThanOrEqual(3);
  });
});
