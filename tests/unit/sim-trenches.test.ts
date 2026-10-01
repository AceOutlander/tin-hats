import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/data/config';
import { DAMAGE } from '../../src/data/damage';
import { WEAPONS } from '../../src/data/weapons';
import { checkInvariants, collect, eventsOf, makeBattle, run, runUntil, testMission, unitsOf, type Seen } from './sim-helpers';

describe('trench cover', () => {
  it('cuts bullet damage to men in a trench to the infantryTrench column, and seats a garrison in its slots', () => {
    const mission = testMission({
      length: 3000,
      trenches: [{ id: 1, x: 1150, width: 120, slots: 6, owner: 1 }],
      a: { forces: [{ kind: 'rifle', count: 6 }] },
      b: { forces: [{ kind: 'rifle', count: 3, trenchId: 1 }] },
    });
    const b = makeBattle({ mission });
    const trench = b.state.trenches[0];
    const garrison = unitsOf(b, 1, 'rifle');
    expect(trench.occupants).toBe(3);
    expect(new Set(garrison.map((u) => u.x)).size).toBe(3);
    for (const u of garrison) {
      expect(u.trenchId).toBe(1);
      expect(Math.abs(u.x - trench.x)).toBeLessThanOrEqual(trench.width / 2);
    }

    const hits = collect(b, 25, 'unitHit');
    const onTrench = hits.filter((e) => e.side === 1 && e.cause === 'bullet');
    const onOpen = hits.filter((e) => e.side === 0 && e.cause === 'bullet');
    expect(onTrench.length).toBeGreaterThan(3);
    expect(onOpen.length).toBeGreaterThan(3);
    for (const e of onTrench) expect(e.value).toBeCloseTo(WEAPONS.rifle.damage * DAMAGE.bullet.infantryTrench, 9);
    for (const e of onOpen) expect(e.value).toBeCloseTo(WEAPONS.rifle.damage * DAMAGE.bullet.infantryOpen, 9);
    expect(DAMAGE.bullet.infantryTrench).toBeLessThan(DAMAGE.bullet.infantryOpen);
  });
});

describe('holding a trench', () => {
  it('fills the hold-line trench with trench-capable infantry and forms everyone else up behind it', () => {
    const mission = testMission({
      length: 3000,
      trenches: [{ id: 1, x: 1300, width: 96, slots: 4, owner: 0 }],
      a: { forces: [{ kind: 'rifle', count: 6 }, { kind: 'mortar', count: 1 }, { kind: 'medic', count: 1 }] },
    });
    const b = makeBattle({ mission });
    run(b, 25, checkInvariants);
    const s = b.state;
    const trench = s.trenches[0];
    expect(s.sides[0].holdLineX).toBe(1300);
    const rear = trench.x - trench.width / 2;
    const rifles = unitsOf(b, 0, 'rifle');
    const seated = rifles.filter((u) => u.trenchId === 1);
    expect(seated).toHaveLength(4);
    expect(trench.occupants).toBe(4);
    expect(new Set(seated.map((u) => u.x)).size).toBe(4);
    for (const u of seated) expect(Math.abs(u.x - trench.x)).toBeLessThanOrEqual(trench.width / 2);
    // The overflow and the kinds that do not use trenches wait behind the trench, clear of it.
    const behind = [...rifles.filter((u) => u.trenchId < 0), ...unitsOf(b, 0, 'mortar'), ...unitsOf(b, 0, 'medic')];
    expect(behind).toHaveLength(4);
    for (const u of behind) {
      expect(u.trenchId).toBe(-1);
      expect(u.x).toBeLessThanOrEqual(rear - CONFIG.trenchFormGap + 1e-6);
    }
    for (const u of unitsOf(b, 0)) expect(u.velX).toBe(0);
  });

  it('leaves the trench on Advance and returns to it on Hold; Fall Back empties it', () => {
    const mission = testMission({
      length: 3000,
      trenches: [{ id: 1, x: 1300, width: 120, slots: 6, owner: 0 }],
      a: { forces: [{ kind: 'rifle', count: 4, trenchId: 1 }] },
    });
    const b = makeBattle({ mission });
    const trench = b.state.trenches[0];
    expect(trench.occupants).toBe(4);
    b.command(0, { type: 'order', order: 'advance' });
    run(b, 2);
    expect(trench.occupants).toBe(0);
    for (const u of unitsOf(b, 0, 'rifle')) {
      expect(u.trenchId).toBe(-1);
      expect(u.velX).toBeGreaterThan(0);
    }
    b.command(0, { type: 'order', order: 'hold' });
    run(b, 20);
    expect(trench.occupants).toBe(4);
    expect(unitsOf(b, 0, 'rifle').every((u) => u.trenchId === 1)).toBe(true);
    b.command(0, { type: 'order', order: 'fallBack' });
    run(b, 1);
    expect(trench.occupants).toBe(0);
    expect(trench.owner).toBe(0); // ownership persists while it is empty
  });

  it('seats only as many as there are slots at mission start; the rest stand behind the trench', () => {
    const mission = testMission({
      length: 3000,
      trenches: [{ id: 4, x: 1400, width: 60, slots: 2, owner: -1 }],
      a: { forces: [{ kind: 'rifle', count: 4, trenchId: 4 }, { kind: 'mortar', count: 1, trenchId: 4 }] },
    });
    const b = makeBattle({ mission });
    // A garrison placed by the mission holds its trench without a capture.
    expect(eventsOf(b, 'trenchCaptured')).toHaveLength(0);
    const trench = b.state.trenches[0];
    expect(trench.owner).toBe(0);
    expect(trench.capturedAt).toBe(-1);
    expect(trench.occupants).toBe(2);
    const outside = unitsOf(b, 0).filter((u) => u.trenchId < 0);
    expect(outside).toHaveLength(3);
    for (const u of outside) expect(u.x).toBeLessThan(trench.x - trench.width / 2);
  });
});

describe('capturing trenches', () => {
  it('takes an empty enemy trench by walking into it, moves the hold line up and fires its mission trigger', () => {
    const mission = testMission({
      length: 4000,
      trenches: [{ id: 7, x: 1500, width: 120, slots: 6, owner: 1 }],
      a: { forces: [{ kind: 'rifle', count: 4 }] },
      events: [{ type: 'hint', when: { trenchCapturedBy: 0, trenchId: 7, delay: 1 }, text: 'Taken' }],
    });
    const b = makeBattle({ mission });
    expect(b.state.sides[1].holdLineX).toBe(1500);
    b.command(0, { type: 'order', order: 'advance' });
    const events = collect(b, 20, 'trenchCaptured', 'hint');
    const captured = events.filter((e) => e.type === 'trenchCaptured');
    expect(captured).toHaveLength(1);
    expect(captured[0]).toMatchObject({ side: 0, targetIndex: 7, x: 1500, value: 1 });
    const trench = b.state.trenches[0];
    expect(trench.owner).toBe(0);
    expect(trench.capturedAt).toBeCloseTo(captured[0].time, 6);
    const hint = events.find((e) => e.type === 'hint');
    expect(hint?.text).toBe('Taken');
    expect(hint?.time ?? 0).toBeGreaterThanOrEqual(captured[0].time + 1 - 1e-9);
    // The captured trench is now the side's hold line, and Hold fills it.
    expect(b.state.sides[0].holdLineX).toBe(1500);
    expect(b.state.sides[1].holdLineX).toBeCloseTo(b.state.length - CONFIG.hqInset - CONFIG.holdLineOffset, 6);
    b.command(0, { type: 'order', order: 'hold' });
    run(b, 40);
    expect(unitsOf(b, 0, 'rifle').every((u) => u.trenchId === 7)).toBe(true);
  });

  it('cannot enter a trench while living enemies hold it, and takes it once they are gone', () => {
    const mission = testMission({
      length: 3000,
      trenches: [{ id: 1, x: 1300, width: 120, slots: 6, owner: 0 }],
      a: { forces: [{ kind: 'rifle', count: 3, trenchId: 1 }] },
      b: { forces: [{ kind: 'assault', count: 8 }] },
    });
    const b = makeBattle({ mission });
    b.command(1, { type: 'order', order: 'advance' });
    const trench = b.state.trenches[0];
    let closestWhileHeld = Infinity;
    const captured: Seen[] = [];
    const done = runUntil(b, 120, () => {
      checkInvariants(b);
      if (trench.occupants > 0) {
        for (const u of unitsOf(b, 1)) closestWhileHeld = Math.min(closestWhileHeld, u.x - (trench.x + trench.width / 2));
      }
      captured.push(...eventsOf(b, 'trenchCaptured'));
      return trench.owner === 1;
    });
    expect(done).toBe(true);
    // While the garrison lived, no attacker stood inside: the far edge of the trench was the front.
    expect(closestWhileHeld).toBeGreaterThan(0);
    expect(unitsOf(b, 0, 'rifle')).toHaveLength(0);
    expect(captured).toHaveLength(1);
    expect(captured[0]).toMatchObject({ side: 1, targetIndex: 1, value: 0 });
  });

  it('lets tanks drive over a trench without occupying or capturing it', () => {
    const mission = testMission({
      length: 4000,
      trenches: [{ id: 1, x: 1500, width: 120, slots: 6, owner: 1 }],
      a: { forces: [{ kind: 'tank', count: 1 }] },
    });
    const b = makeBattle({ mission });
    b.command(0, { type: 'order', order: 'advance' });
    const captures = collect(b, 30, 'trenchCaptured');
    const tank = unitsOf(b, 0, 'tank')[0];
    expect(tank.x).toBeGreaterThan(1500 + 60);
    expect(tank.trenchId).toBe(-1);
    expect(captures).toHaveLength(0);
    expect(b.state.trenches[0].owner).toBe(1);
  });
});
