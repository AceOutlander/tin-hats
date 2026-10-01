/**
 * Scripted waves under the population cap (the reserve) and garrisons that hold a rear trench.
 */
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/data/config';
import type { ForceDef, MissionDef } from '../../src/data/schema';
import { UNITS } from '../../src/data/units';
import { killUnit } from '../../src/sim/units';
import type { World } from '../../src/sim/world';
import type { Battle } from '../../src/sim';
import { checkInvariants, collect, makeBattle, run, testMission, unitsOf } from './sim-helpers';

const FAR = 50; // hqHpMul large enough that no HQ falls by accident

/** Kill `n` living units of a side (of one kind), as if shot. */
function kill(b: Battle, side: 0 | 1, kind: 'rifle' | 'tank', n: number): void {
  const w = b as unknown as World;
  for (const u of unitsOf(b, side, kind).slice(0, n)) killUnit(w, u, 0, 1, 1 - side);
}

/** Side 1 starts with `start` riflemen far back (rich, nobody commanding), then the given wave arrives at 1 s. */
function capped(start: number, wave: ForceDef[]): MissionDef {
  return testMission({
    length: 4000,
    a: { hqHpMul: FAR },
    b: { hqHpMul: FAR, supplies: 1000, forces: [{ kind: 'rifle', count: start, x: 3300 }] },
    events: [{ type: 'wave', when: { at: 1 }, side: 1, forces: wave, announce: 'Counter-attack' }],
  });
}

describe('scripted waves and the population cap', () => {
  it('sends in what fits, keeps the rest waiting at the HQ, and lets them out as room frees up', () => {
    const cap = CONFIG.popCap;
    const b = makeBattle({ mission: capped(cap - 2, [{ kind: 'rifle', count: 5 }]) });
    const side = b.state.sides[1];
    const waves = collect(b, 1.1, 'wave');
    expect(waves).toHaveLength(1);
    expect(waves[0].value).toBe(2);
    expect(side.pop).toBe(cap);
    expect(side.reservePop).toBe(3 * UNITS.rifle.pop);

    // Training cannot take the room the reserve is waiting for.
    b.command(1, { type: 'train', kind: 'rifle' });
    run(b, 0.2, checkInvariants);
    expect(side.queue.rifle).toBe(0);

    // Three fall: the three waiting walk out of the HQ door on the next tick.
    kill(b, 1, 'rifle', 3);
    const door = side.hq?.doorX ?? 0;
    const before = b.state.tick;
    run(b, 1 / CONFIG.tickRate, checkInvariants);
    expect(b.state.tick).toBe(before + 1);
    expect(side.reservePop).toBe(0);
    expect(side.pop).toBe(cap);
    const fresh = unitsOf(b, 1, 'rifle').filter((u) => Math.abs(u.x - door) < CONFIG.spacing * 2);
    expect(fresh.length).toBeGreaterThanOrEqual(3);

    // With the reserve gone, training works again once there is room.
    kill(b, 1, 'rifle', 1);
    b.command(1, { type: 'train', kind: 'rifle' });
    run(b, 0.2, checkInvariants);
    expect(side.queue.rifle).toBe(1);
  });

  it('keeps the scripted order: a waiting tank is not overtaken by riflemen scripted after it', () => {
    const cap = CONFIG.popCap;
    const tankPop = UNITS.tank.pop;
    const b = makeBattle({
      mission: capped(cap, [
        { kind: 'tank', count: 1 },
        { kind: 'rifle', count: 2 },
      ]),
    });
    const side = b.state.sides[1];
    run(b, 1.1, checkInvariants);
    expect(side.reservePop).toBe(tankPop + 2 * UNITS.rifle.pop);
    expect(unitsOf(b, 1, 'tank')).toHaveLength(0);

    // Room for the riflemen but not the tank: nobody comes out.
    kill(b, 1, 'rifle', tankPop - 1);
    run(b, 0.5, checkInvariants);
    expect(unitsOf(b, 1, 'tank')).toHaveLength(0);
    expect(side.pop).toBe(cap - (tankPop - 1));

    // Room for the tank: it comes first, the riflemen follow as more room frees.
    kill(b, 1, 'rifle', 1);
    run(b, 0.2, checkInvariants);
    expect(unitsOf(b, 1, 'tank')).toHaveLength(1);
    expect(side.reservePop).toBe(2 * UNITS.rifle.pop);
    kill(b, 1, 'rifle', 2);
    run(b, 0.2, checkInvariants);
    expect(side.reservePop).toBe(0);
    expect(side.pop).toBe(cap);
  });

  it('does not cap a side with no HQ (survival attackers have no economy)', () => {
    const mission = testMission({
      length: 4000,
      mode: 'survival',
      timer: { seconds: 600, onExpire: 'win', label: 'Hold on' },
      a: { hqHpMul: FAR },
      b: { hasHq: false, forces: [{ kind: 'rifle', count: CONFIG.popCap, x: 3700 }] },
      events: [{ type: 'wave', when: { at: 1 }, side: 1, forces: [{ kind: 'rifle', count: 4 }] }],
    });
    const b = makeBattle({ mission });
    const waves = collect(b, 1.1, 'wave');
    expect(waves[0].value).toBe(4);
    expect(b.state.sides[1].reservePop).toBe(0);
    expect(unitsOf(b, 1)).toHaveLength(CONFIG.popCap + 4);
  });
});

/** Side 1 holds a front trench (id 1) with an army squad and a rear trench (id 2) with the given behaviour. */
function lines(rear: 'army' | 'garrison'): MissionDef {
  return testMission({
    length: 5000,
    a: { hqHpMul: FAR },
    b: {
      hqHpMul: FAR,
      forces: [
        { kind: 'rifle', count: 2, trenchId: 1 },
        { kind: 'rifle', count: 3, trenchId: 2, behaviour: rear },
        { kind: 'mortar', count: 1, trenchId: 2, behaviour: rear },
      ],
    },
    trenches: [
      { id: 1, x: 3000, width: 160, slots: 6, owner: 1 },
      { id: 2, x: 3700, width: 130, slots: 4, owner: 1 },
    ],
  });
}

describe('garrisons', () => {
  it('rear-trench riflemen of the army walk up to the forward line on Hold', () => {
    const b = makeBattle({ mission: lines('army') });
    run(b, 20, checkInvariants);
    const front = b.state.trenches[0].id;
    expect(unitsOf(b, 1, 'rifle').filter((u) => u.trenchId === front)).toHaveLength(5);
  });

  it('a garrison holds its rear trench under Hold, Advance and Fall Back', () => {
    const b = makeBattle({ mission: lines('garrison') });
    const rear = b.state.trenches[1];
    const garrison = () => unitsOf(b, 1).filter((u) => u.behaviour === 'garrison');
    expect(garrison()).toHaveLength(4);
    run(b, 15, checkInvariants);
    expect(garrison().filter((u) => u.trenchId === rear.id)).toHaveLength(3);
    const mortar = unitsOf(b, 1, 'mortar')[0];
    const post = mortar.x;
    expect(Math.abs(post - rear.x)).toBeLessThan(200);

    for (const [order, seconds] of [
      ['advance', 5],
      ['fallBack', 60],
    ] as const) {
      b.command(1, { type: 'order', order });
      run(b, seconds, checkInvariants);
      expect(garrison().filter((u) => u.trenchId === rear.id)).toHaveLength(3);
      expect(mortar.x).toBe(post);
      expect(mortar.inside).toBe(false);
    }
    // The army squad did obey: it is in the HQ.
    expect(unitsOf(b, 1, 'rifle').filter((u) => u.behaviour === 'army' && u.inside)).toHaveLength(2);
  });

  it('survivors of a garrison whose trench has fallen join the army', () => {
    const b = makeBattle({ mission: lines('garrison') });
    run(b, 5, checkInvariants);
    const rear = b.state.trenches[1];
    // The riflemen in the trench fall; the trench then changes hands (as a capture would make it).
    kill(b, 1, 'rifle', 5);
    rear.owner = 0;
    run(b, 0.2, checkInvariants);
    const mortar = unitsOf(b, 1, 'mortar')[0];
    expect(mortar.behaviour).toBe('army');
    b.command(1, { type: 'order', order: 'fallBack' });
    run(b, 60, checkInvariants);
    expect(mortar.inside).toBe(true);
  });
});
