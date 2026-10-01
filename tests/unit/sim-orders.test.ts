import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/data/config';
import type { UpgradeDef } from '../../src/data/schema';
import { UNITS } from '../../src/data/units';
import { WEAPONS } from '../../src/data/weapons';
import {
  collect,
  eventsOf,
  makeBattle,
  run,
  runUntil,
  testMission,
  unitsOf,
  type MissionOverrides,
} from './sim-helpers';

/** The distance at which a rifleman standing in the open stops to fire, at best and at worst jitter. */
const ENGAGE_HI = WEAPONS.rifle.range * UNITS.rifle.engageFrac;
const ENGAGE_LO = ENGAGE_HI - CONFIG.engageSpread;
/** One tick of walking, the most a unit can overshoot a stopping distance by. */
const STEP = UNITS.rifle.speed / CONFIG.tickRate;

const FIGHTING = ['aim', 'fire', 'reload'];

/** A long field with riflemen trained or placed on side 0. */
function field(over: MissionOverrides = {}): MissionOverrides {
  return { length: 3000, ...over };
}

describe('Hold', () => {
  it('puts the line holdLineOffset in front of the HQ when there is no trench', () => {
    const b = makeBattle({ mission: testMission() });
    const [s0, s1] = b.state.sides;
    expect(s0.order).toBe('hold');
    expect(s0.holdLineX).toBeCloseTo(CONFIG.hqInset + CONFIG.holdLineOffset, 6);
    expect(s1.holdLineX).toBeCloseTo(b.state.length - CONFIG.hqInset - CONFIG.holdLineOffset, 6);
  });

  it('forms new troops up behind the line, each in its own place', () => {
    const b = makeBattle({ mission: testMission({ a: { supplies: 1000 }, b: { supplies: 1000 } }) });
    for (let i = 0; i < CONFIG.maxQueue; i++) {
      b.command(0, { type: 'train', kind: 'rifle' });
      b.command(1, { type: 'train', kind: 'rifle' });
    }
    run(b, CONFIG.maxQueue * UNITS.rifle.trainTime + 20);
    for (const side of [0, 1] as const) {
      const line = b.state.sides[side].holdLineX;
      const dir = side === 0 ? 1 : -1;
      const troops = unitsOf(b, side, 'rifle');
      expect(troops).toHaveLength(CONFIG.maxQueue);
      const places = new Set<string>();
      for (const u of troops) {
        expect((u.x - line) * dir).toBeLessThanOrEqual(1e-6); // never in front of the line
        expect((line - u.x) * dir).toBeLessThan(CONFIG.formationColumns * CONFIG.spacing);
        expect(u.velX).toBe(0);
        expect(u.row).toBeGreaterThanOrEqual(0);
        expect(u.row).toBeLessThan(CONFIG.rows);
        places.add(`${u.row}:${Math.round(u.x * 10)}`);
      }
      expect(places.size).toBe(troops.length);
      // The first rank stands on the line itself.
      expect(Math.max(...troops.map((u) => (u.x - line) * dir))).toBeCloseTo(0, 6);
    }
  });

  it('keeps kinds at their own depth behind the rifles', () => {
    const mission = testMission({
      a: { forces: [{ kind: 'rifle', count: 4 }, { kind: 'mortar', count: 1 }, { kind: 'sniper', count: 1 }] },
    });
    const b = makeBattle({ mission });
    run(b, 5);
    const line = b.state.sides[0].holdLineX;
    const rifleFront = Math.max(...unitsOf(b, 0, 'rifle').map((u) => u.x));
    const sniper = unitsOf(b, 0, 'sniper')[0];
    const mortar = unitsOf(b, 0, 'mortar')[0];
    expect(rifleFront).toBeLessThanOrEqual(line);
    expect(line - sniper.x).toBeGreaterThanOrEqual(UNITS.sniper.formationDepth - 1);
    expect(line - mortar.x).toBeGreaterThanOrEqual(UNITS.mortar.formationDepth - 1);
  });

  it('fires at what is in range but does not chase what is not', () => {
    const mission = testMission({
      length: 4000,
      a: { forces: [{ kind: 'rifle', count: 6 }] },
      // Sappers with no HQ stand still. One is within rifle range of the line, one is well beyond it.
      b: { hasHq: false, forces: [{ kind: 'sapper', count: 1, x: 850 + 200 }, { kind: 'sapper', count: 1, x: 850 + 700 }] },
    });
    const b = makeBattle({ mission });
    let farthest = 0;
    run(b, 40, () => {
      for (const u of unitsOf(b, 0, 'rifle')) farthest = Math.max(farthest, u.x);
    });
    const left = unitsOf(b, 1, 'sapper');
    expect(left).toHaveLength(1);
    expect(left[0].x).toBeCloseTo(850 + 700, 6);
    expect(left[0].hp).toBe(UNITS.sapper.hp);
    expect(b.state.sides[0].stats.kills).toBe(1);
    expect(farthest).toBeLessThanOrEqual(b.state.sides[0].holdLineX + 1e-6);
  });

  it('sends a unit that wandered in front of the line back without fighting', () => {
    const mission = testMission({
      length: 4000,
      a: { forces: [{ kind: 'rifle', count: 1, x: 850 + 200 }] },
      b: { hasHq: false, forces: [{ kind: 'sapper', count: 1, x: 850 + 400 }] },
    });
    const b = makeBattle({ mission });
    const rifle = unitsOf(b, 0, 'rifle')[0];
    run(b, 1);
    expect(rifle.velX).toBeLessThan(0);
    expect(rifle.action).toBe('move');
    expect(b.state.sides[0].stats.kills).toBe(0);
    run(b, 10);
    expect(rifle.x).toBeLessThanOrEqual(b.state.sides[0].holdLineX + 1e-6);
  });

  it('lets sappers keep working', () => {
    const b = makeBattle({ mission: testMission({ a: { sappers: 2 } }) });
    expect(collect(b, 30, 'supplyDelivered').length).toBeGreaterThan(0);
  });
});

describe('Advance', () => {
  it('sends the army forward until the enemy HQ is in range, then stops to fire', () => {
    const b = makeBattle({ mission: testMission(field({ a: { forces: [{ kind: 'rifle', count: 6 }] } })) });
    const door = b.state.sides[1].hq?.doorX ?? 0;
    b.command(0, { type: 'order', order: 'advance' });
    run(b, 10);
    for (const u of unitsOf(b, 0, 'rifle')) {
      expect(u.x).toBeGreaterThan(b.state.sides[0].holdLineX + CONFIG.holdLineTolerance);
      expect(u.velX).toBeGreaterThan(0);
      expect(u.action).toBe('move');
    }

    const settled = runUntil(b, 60, () => {
      const troops = unitsOf(b, 0, 'rifle');
      return troops.length > 0 && troops.every((u) => u.velX === 0 && FIGHTING.includes(u.action));
    });
    expect(settled).toBe(true);
    for (const u of unitsOf(b, 0, 'rifle')) {
      const d = door - u.x;
      expect(d).toBeLessThanOrEqual(ENGAGE_HI + 1e-6);
      expect(d).toBeGreaterThanOrEqual(ENGAGE_LO - STEP);
      expect(u.aimX).toBeCloseTo(door, 6);
      expect(u.facing).toBe(1);
    }
    const stoppedAt = unitsOf(b, 0, 'rifle').map((u) => u.x);
    run(b, 3);
    expect(unitsOf(b, 0, 'rifle').map((u) => u.x)).toEqual(stoppedAt);

    // And the shooting is real: tracers at the HQ, and the HQ takes damage.
    const shots = collect(b, 10, 'shot', 'structureHit');
    expect(shots.some((e) => e.type === 'shot' && e.source === 'unit' && e.target === 'hq' && e.side === 0)).toBe(true);
    expect(b.state.sides[1].hq?.hp ?? 0).toBeLessThan(b.state.sides[1].hq?.maxHp ?? 0);
  });

  it('stops at firing range from an enemy unit instead of walking into it', () => {
    const mission = testMission(
      field({
        a: { forces: [{ kind: 'rifle', count: 8 }] },
        // A tank standing guard cannot be hurt by rifles, so the fight lasts.
        b: { forces: [{ kind: 'tank', count: 1, x: 2150, behaviour: 'guard' }] },
      }),
    );
    const b = makeBattle({ mission });
    b.command(0, { type: 'order', order: 'advance' });
    const settled = runUntil(b, 60, () => {
      const troops = unitsOf(b, 0, 'rifle');
      return troops.length > 0 && troops.every((u) => u.velX === 0 && FIGHTING.includes(u.action));
    });
    expect(settled).toBe(true);
    const tank = unitsOf(b, 1, 'tank')[0];
    expect(tank.x).toBe(2150);
    for (const u of unitsOf(b, 0, 'rifle')) {
      const d = tank.x - u.x;
      expect(d).toBeLessThanOrEqual(ENGAGE_HI + 1e-6);
      expect(d).toBeGreaterThanOrEqual(ENGAGE_LO - STEP);
      expect(u.aimX).toBe(tank.x);
    }
  });

  it('keeps going when nothing can be engaged, but never closer than the contact gap to a blocker', () => {
    // A sniper cannot hurt a pillbox, so it just walks up to it. The pillbox's machine gun fires on it
    // all the way, so this sniper is given a hundred times its health to survive the walk.
    const toughen: UpgradeDef = {
      id: 'tough',
      name: '',
      description: '',
      unit: 'sniper',
      levels: [[{ stat: 'unitHealth', unit: 'sniper', mul: 100 }]],
      costPerLevel: 1,
    };
    const mission = testMission(
      field({
        a: { forces: [{ kind: 'sniper', count: 1 }] },
        pillboxes: [{ id: 1, x: 2000, side: 1, hpMul: 1 }],
      }),
    );
    const b = makeBattle({ mission, upgrades: { tough: 1 }, upgradeDefs: [toughen] });
    b.command(0, { type: 'order', order: 'advance' });
    let farthest = 0;
    run(b, 40, () => {
      farthest = Math.max(farthest, unitsOf(b, 0, 'sniper')[0].x);
    });
    const sniper = unitsOf(b, 0, 'sniper')[0];
    expect(farthest).toBeLessThanOrEqual(2000 - CONFIG.contactGap + 1e-6);
    expect(sniper.x).toBeCloseTo(2000 - CONFIG.contactGap, 6);
    expect(sniper.velX).toBe(0);
  });

  it('never lets the two lines pass through each other', () => {
    const mission = testMission(
      field({
        a: { forces: [{ kind: 'assault', count: 6 }] },
        b: { forces: [{ kind: 'sapper', count: 1, x: 2200 }], hasHq: false },
      }),
    );
    const b = makeBattle({ mission });
    b.command(0, { type: 'order', order: 'advance' });
    let closest = Infinity;
    run(b, 60, () => {
      const enemy = unitsOf(b, 1);
      for (const u of unitsOf(b, 0)) for (const e of enemy) closest = Math.min(closest, e.x - u.x);
    });
    // Whoever is left stands at least a contact gap (less one tick of walking) from the other side.
    expect(closest).toBeGreaterThanOrEqual(CONFIG.contactGap - UNITS.assault.speed / CONFIG.tickRate);
  });

  it('is obeyed by units trained after the order was given', () => {
    const b = makeBattle({ mission: testMission(field({ a: { supplies: 200 } })) });
    b.command(0, { type: 'order', order: 'advance' });
    b.command(0, { type: 'train', kind: 'rifle' });
    run(b, UNITS.rifle.trainTime + 8);
    const rifle = unitsOf(b, 0, 'rifle')[0];
    expect(rifle.x).toBeGreaterThan(b.state.sides[0].hq?.doorX ?? Infinity);
    expect(rifle.velX).toBeGreaterThan(0);
  });

  it('reports every change of order, and none when the order stays the same', () => {
    const b = makeBattle();
    b.command(0, { type: 'order', order: 'hold' });
    b.step();
    expect(eventsOf(b, 'orderChanged')).toHaveLength(0);
    b.command(0, { type: 'order', order: 'advance' });
    b.step();
    const changed = eventsOf(b, 'orderChanged');
    expect(changed).toHaveLength(1);
    expect(changed[0].side).toBe(0);
    expect(changed[0].order).toBe('advance');
    expect(b.state.sides[1].order).toBe('hold');
  });
});

describe('Fall Back', () => {
  const crowd = testMission({ a: { sappers: 2, forces: [{ kind: 'rifle', count: 6 }] }, b: { sappers: 1 } });

  it('empties the field: every unit, sappers included, runs to the HQ and goes inside', () => {
    const b = makeBattle({ mission: crowd });
    const hq = b.state.sides[0].hq;
    expect(hq).not.toBeNull();
    if (!hq) return;
    b.command(0, { type: 'order', order: 'fallBack' });
    const inside = runUntil(b, 20, () => unitsOf(b, 0).every((u) => u.inside));
    expect(inside).toBe(true);
    const mine = unitsOf(b, 0);
    expect(mine).toHaveLength(8);
    expect(hq.garrison).toBe(8);
    for (const u of mine) {
      expect(u.action).toBe('inside');
      expect(u.x).toBeCloseTo(hq.doorX, 6);
      expect(u.velX).toBe(0);
    }
    // The other side is untouched.
    expect(unitsOf(b, 1).every((u) => !u.inside)).toBe(true);
  });

  it('runs faster than the walk', () => {
    const b = makeBattle({ mission: crowd });
    b.command(0, { type: 'order', order: 'fallBack' });
    run(b, 1);
    const rifle = unitsOf(b, 0, 'rifle')[0];
    expect(Math.abs(rifle.velX)).toBeCloseTo(UNITS.rifle.speed * CONFIG.fallBackSpeedMul, 3);
    expect(rifle.velX).toBeLessThan(0);
  });

  it('lets units come back out, one at a time, when the order changes', () => {
    const b = makeBattle({ mission: crowd });
    const hq = b.state.sides[0].hq;
    b.command(0, { type: 'order', order: 'fallBack' });
    runUntil(b, 20, () => unitsOf(b, 0).every((u) => u.inside));
    expect(hq?.garrison).toBe(8);

    b.command(0, { type: 'order', order: 'hold' });
    const outsideAt: number[] = [];
    run(b, 4, () => {
      outsideAt.push(unitsOf(b, 0).filter((u) => !u.inside).length);
    });
    expect(hq?.garrison).toBe(0);
    expect(unitsOf(b, 0).every((u) => u.action !== 'inside')).toBe(true);
    // At most one more unit steps out per doorInterval.
    const perTick = CONFIG.doorInterval * CONFIG.tickRate;
    for (let i = 0; i < outsideAt.length; i++) {
      expect(outsideAt[i]).toBeLessThanOrEqual(1 + Math.floor(i / perTick) + 1);
    }
    expect(outsideAt[outsideAt.length - 1]).toBe(8);
    expect(outsideAt[0]).toBeLessThanOrEqual(2);
  });

  it('sends the army back to its positions and the sappers back to work', () => {
    const b = makeBattle({ mission: crowd });
    b.command(0, { type: 'order', order: 'fallBack' });
    run(b, 15);
    b.command(0, { type: 'order', order: 'hold' });
    const delivered = collect(b, 40, 'supplyDelivered').filter((e) => e.side === 0);
    expect(delivered.length).toBeGreaterThan(0);
    const line = b.state.sides[0].holdLineX;
    const rifles = unitsOf(b, 0, 'rifle');
    expect(rifles).toHaveLength(6);
    expect(Math.max(...rifles.map((u) => u.x))).toBeGreaterThan(line - 2 * CONFIG.spacing);
    expect(Math.max(...rifles.map((u) => u.x))).toBeLessThanOrEqual(line + 1e-6);
  });

  it('hands over the crate a sapper was carrying', () => {
    const b = makeBattle({ mission: testMission({ a: { sappers: 1 } }) });
    const sapper = unitsOf(b, 0, 'sapper')[0];
    runUntil(b, 20, () => sapper.carrying > 0);
    expect(sapper.carrying).toBeGreaterThan(0);
    const before = b.state.sides[0].stats.suppliesGathered;
    b.command(0, { type: 'order', order: 'fallBack' });
    runUntil(b, 20, () => sapper.inside);
    expect(sapper.carrying).toBe(0);
    expect(b.state.sides[0].stats.suppliesGathered - before).toBeGreaterThanOrEqual(CONFIG.sapperCarry);
  });

  it('keeps the HQ machine gun firing while every unit is inside, and the garrison cannot be hit', () => {
    const mission = testMission({
      length: 3000,
      a: { forces: [{ kind: 'rifle', count: 4 }] },
      // Three enemy riflemen stand within reach of the HQ and its gun, and attack.
      b: { forces: [{ kind: 'rifle', count: 3, x: 450 }] },
    });
    const b = makeBattle({ mission });
    const hq = b.state.sides[0].hq;
    expect(hq).not.toBeNull();
    if (!hq) return;
    b.command(0, { type: 'order', order: 'fallBack' });
    b.command(1, { type: 'order', order: 'advance' });
    const allInside = runUntil(b, 30, () => unitsOf(b, 0).every((u) => u.inside));
    expect(allInside).toBe(true);
    const killedBefore = b.state.sides[0].stats.lost;
    const killsBefore = b.state.sides[0].stats.kills;
    // Health as they went in (the enemy may have winged one on the way back).
    const hpInside = unitsOf(b, 0).map((u) => [u.id, u.hp]);

    const events = collect(b, 25, 'shot', 'unitDied');
    const gunShots = events.filter((e) => e.type === 'shot' && e.source === 'hq' && e.side === 0);
    expect(gunShots.length).toBeGreaterThan(5);
    for (const shot of gunShots) {
      expect(shot.weapon).toBe(CONFIG.hqGunWeapon);
      expect(shot.x).toBeCloseTo(hq.gunX, 6);
      expect(shot.dir).toBe(1);
    }
    // The gun does the killing...
    const enemyDeaths = events.filter((e) => e.type === 'unitDied' && e.side === 1);
    expect(enemyDeaths.length).toBeGreaterThan(0);
    expect(b.state.sides[0].stats.kills - killsBefore).toBe(enemyDeaths.length);
    // ...while the men inside take nothing, and the HQ is what is shot at.
    expect(b.state.sides[0].stats.lost).toBe(killedBefore);
    expect(unitsOf(b, 0).map((u) => [u.id, u.hp])).toEqual(hpInside);
  });
});

describe('Guards and assault troops', () => {
  it('guard units ignore the order and hold their post; assault units always advance', () => {
    const mission = testMission(
      field({
        a: { forces: [{ kind: 'rifle', count: 2, behaviour: 'assault' }] },
        b: { forces: [{ kind: 'tank', count: 1, x: 2600, behaviour: 'guard' }] },
      }),
    );
    const b = makeBattle({ mission });
    b.command(1, { type: 'order', order: 'advance' });
    run(b, 10);
    const tank = unitsOf(b, 1, 'tank')[0];
    expect(tank.x).toBe(2600);
    for (const u of unitsOf(b, 0, 'rifle')) {
      expect(u.x).toBeGreaterThan(b.state.sides[0].holdLineX + 2 * CONFIG.holdLineTolerance);
    }
    expect(b.state.sides[0].order).toBe('hold');
  });
});
