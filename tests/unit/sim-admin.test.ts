/**
 * The admin panel's battle actions (Battle.admin, src/sim/admin.ts): spawning any kind for either side (enemy-only
 * kinds and veterans included), kill, heal, invincibility for a unit, a side and an HQ, taking units over, ending
 * the battle, held supplies, instant training, filling to the cap and firing scripted events. All of them work between
 * ticks, and none is in force in a normal battle.
 */
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/data/config';
import { UNITS } from '../../src/data/units';
import type { Battle, UnitState } from '../../src/sim';
import { makeBattle, testMission } from './sim-helpers';

function living(b: Battle, side?: 0 | 1): UnitState[] {
  const out: UnitState[] = [];
  const s = b.state;
  for (let i = 0; i < s.unitCount; i++) if (s.units[i].alive && (side === undefined || s.units[i].side === side)) out.push(s.units[i]);
  return out;
}

function eventTypes(b: Battle): string[] {
  const out: string[] = [];
  for (let i = 0; i < b.events.count; i++) out.push(b.events.items[i].type);
  return out;
}

function steps(b: Battle, n: number): void {
  for (let i = 0; i < n; i++) b.step();
}

describe('admin panel actions on a battle', () => {
  it('starts every battle with every cheat off', () => {
    const b = makeBattle();
    for (const side of b.state.sides) expect(side.cheats).toEqual({ invincible: false, hqInvincible: false, holdSupplies: -1, instantTrain: false });
  });

  it('spawns a King Tiger and the enemy-only Panzer III for either side, at the tapped spot, with their events', () => {
    const b = makeBattle();
    expect(b.admin({ type: 'spawn', side: 1, kind: 'heavyTank', x: 3000, count: 1 })).toBe(1);
    expect(eventTypes(b)).toEqual(['unitSpawned', 'bossArrived']);
    const tiger = living(b, 1)[0];
    expect(tiger.kind).toBe('heavyTank');
    expect(tiger.x).toBe(3000);
    expect(b.admin({ type: 'spawn', side: 0, kind: 'lightTank', x: 1500, count: 2 })).toBe(2);
    const mine = living(b, 0);
    expect(mine.map((u) => u.kind)).toEqual(['lightTank', 'lightTank']);
    expect(mine[0].faction).toBe('british');
    expect(b.state.sides[0].alive.lightTank).toBe(2);
    expect(b.state.sides[0].pop).toBe(2 * UNITS.lightTank.pop);
  });

  it('spawns veterans, ignores the population cap and stops only at the unit pool', () => {
    const b = makeBattle();
    expect(b.admin({ type: 'spawn', side: 1, kind: 'rifle', x: 4000, count: 3, veteran: true })).toBe(3);
    for (const u of living(b, 1)) {
      expect(u.veteran).toBe(true);
      expect(u.maxHp).toBeCloseTo(UNITS.rifle.hp * CONFIG.veteran.hpMul);
    }
    const n = b.admin({ type: 'spawn', side: 0, kind: 'rifle', x: 2000, count: 500 });
    expect(n).toBe(CONFIG.maxUnits - 3);
    expect(b.state.sides[0].pop).toBeGreaterThan(b.state.sides[0].popCap);
    steps(b, 30); // a crowded field still steps
  });

  it('kills and heals one unit, a side, or everyone', () => {
    const b = makeBattle();
    b.admin({ type: 'spawn', side: 0, kind: 'rifle', x: 2000, count: 3 });
    b.admin({ type: 'spawn', side: 1, kind: 'rifle', x: 4000, count: 2 });
    const target = living(b, 1)[0];
    target.hp = 1;
    expect(b.admin({ type: 'heal', side: -1, unit: target.id })).toBe(1);
    expect(target.hp).toBe(target.maxHp);
    expect(b.admin({ type: 'kill', side: 1, unit: target.id })).toBe(1);
    expect(eventTypes(b)).toEqual(['unitDied']);
    expect(living(b, 1)).toHaveLength(1);
    expect(b.admin({ type: 'kill', side: 0 })).toBe(3);
    expect(living(b, 0)).toHaveLength(0);
    expect(b.state.sides[0].pop).toBe(0);
    expect(b.admin({ type: 'kill', side: -1 })).toBe(1);
    expect(living(b)).toHaveLength(0);
    expect(b.admin({ type: 'kill', side: -1, unit: 999999 })).toBe(0);
  });

  it('keeps an invincible unit, side or HQ from taking damage, and lets it be killed by hand', () => {
    // Both groups hold their ground in range of each other.
    const mission = testMission({
      a: { forces: [{ kind: 'rifle', count: 4, x: 3000, behaviour: 'guard' }] },
      b: { forces: [{ kind: 'lmg', count: 4, x: 3250, behaviour: 'guard' }] },
    });
    const b = makeBattle({ mission });
    const [one, ...rest] = living(b, 0);
    b.admin({ type: 'invincible', side: 0, unit: one.id, on: true });
    expect(one.invincible).toBe(true);
    steps(b, 30 * 20);
    expect(one.alive).toBe(true);
    expect(one.hp).toBe(one.maxHp);
    expect(rest.some((u) => !u.alive || u.hp < u.maxHp)).toBe(true);

    const c = makeBattle({ mission });
    expect(c.admin({ type: 'invincible', side: 0, on: true })).toBe(1);
    expect(c.state.sides[0].cheats.invincible).toBe(true);
    steps(c, 30 * 20);
    for (const u of living(c, 0)) expect(u.hp).toBe(u.maxHp);
    expect(living(c, 0)).toHaveLength(4);
    expect(c.admin({ type: 'kill', side: 0 })).toBe(4);

    const d = makeBattle({ mission: testMission({ a: { hqHpMul: 0.01 }, b: { forces: [{ kind: 'tank', count: 2, x: 1200 }] } }), commanders: ['human', 'ai'] });
    d.admin({ type: 'hqInvincible', side: 0, on: true });
    d.command(1, { type: 'order', order: 'advance' });
    steps(d, 30 * 40);
    const hq = d.state.sides[0].hq;
    expect(hq?.hp).toBe(hq?.maxHp);
    expect(d.state.over).toBe(false);
  });

  it('takes enemy units over where they stand, keeping their share of health', () => {
    const b = makeBattle({ mission: testMission({ b: { forces: [{ kind: 'tank', count: 1, x: 3000 }, { kind: 'rifle', count: 2, x: 3400 }] } }) });
    const tank = living(b, 1).find((u) => u.kind === 'tank') as UnitState;
    tank.hp = tank.maxHp / 2;
    const x = tank.x;
    expect(b.admin({ type: 'takeOver', side: 0, unit: tank.id })).toBe(1);
    expect(eventTypes(b)).toEqual(['unitSpawned']);
    const mine = living(b, 0);
    expect(mine).toHaveLength(1);
    expect(mine[0].kind).toBe('tank');
    expect(mine[0].x).toBe(x);
    expect(mine[0].hp).toBeCloseTo(mine[0].maxHp / 2);
    expect(b.state.sides[1].alive.tank).toBe(0);
    expect(b.state.sides[1].stats.lost).toBe(0);
    expect(b.admin({ type: 'takeOver', side: 0 })).toBe(2);
    expect(living(b, 1)).toHaveLength(0);
    expect(b.state.sides[1].pop).toBe(0);
    expect(b.state.sides[0].alive.rifle).toBe(2);
    steps(b, 60);
  });

  it('ends the battle for either side, and does nothing more once it is over', () => {
    const b = makeBattle();
    expect(b.admin({ type: 'end', winner: 0 })).toBe(1);
    expect(eventTypes(b)).toEqual(['battleEnded']);
    expect(b.state).toMatchObject({ over: true, winner: 0, endReason: 'admin' });
    expect(b.admin({ type: 'spawn', side: 0, kind: 'rifle', x: 100, count: 1 })).toBe(0);
    const c = makeBattle();
    c.admin({ type: 'end', winner: 1 });
    expect(c.state).toMatchObject({ over: true, winner: 1, endReason: 'admin' });
  });

  it('sets supplies, freezes them, holds them high and lets them run again', () => {
    const b = makeBattle({ mission: testMission({ a: { supplies: 100 } }) });
    b.admin({ type: 'setSupplies', side: 0, amount: 1234 });
    expect(b.state.sides[0].supplies).toBe(1234);
    b.admin({ type: 'setSupplies', side: 0, amount: -5 });
    expect(b.state.sides[0].supplies).toBe(0);
    b.admin({ type: 'holdSupplies', side: 0, amount: 500 });
    b.command(0, { type: 'train', kind: 'rifle' });
    steps(b, 90);
    expect(b.state.sides[0].supplies).toBe(500);
    expect(b.state.sides[0].queue.rifle + b.state.sides[0].alive.rifle).toBe(1);
    b.admin({ type: 'holdSupplies', side: 0, amount: null });
    steps(b, 30);
    expect(b.state.sides[0].supplies).toBeGreaterThan(500);
    expect(b.state.sides[0].cheats.holdSupplies).toBe(-1);
  });

  it('trains instantly while instant training is on', () => {
    const b = makeBattle({ mission: testMission({ a: { supplies: 5000 } }) });
    b.admin({ type: 'instantTrain', side: 0, on: true });
    for (let i = 0; i < 3; i++) b.command(0, { type: 'train', kind: 'rifle' });
    steps(b, 4);
    expect(b.state.sides[0].alive.rifle).toBe(3);
    b.admin({ type: 'instantTrain', side: 0, on: false });
    b.command(0, { type: 'train', kind: 'rifle' });
    steps(b, 4);
    expect(b.state.sides[0].alive.rifle).toBe(3);
    expect(b.state.sides[0].queue.rifle).toBe(1);
  });

  it('fills an army up to its cap', () => {
    const b = makeBattle();
    const n = b.admin({ type: 'fillArmy', side: 1, kind: 'rifle' });
    const side = b.state.sides[1];
    expect(n).toBe(side.popCap / UNITS.rifle.pop);
    expect(side.pop).toBe(side.popCap);
    expect(b.admin({ type: 'fillArmy', side: 1, kind: 'rifle' })).toBe(0);
  });

  it('fires a scripted event by hand, once for a one-shot event', () => {
    const mission = testMission({
      events: [
        { type: 'airdrop', when: { at: 50 }, side: 0, supplies: 200 },
        { type: 'wave', when: { at: 60 }, side: 1, forces: [{ kind: 'rifle', count: 2 }] },
      ],
    });
    const b = makeBattle({ mission });
    expect(b.admin({ type: 'fireEvent', index: 0 })).toBe(1);
    expect(b.state.sides[0].supplies).toBe(200);
    expect(b.admin({ type: 'fireEvent', index: 1 })).toBe(1);
    expect(eventTypes(b)).toEqual(['unitSpawned', 'unitSpawned', 'wave']);
    expect(b.admin({ type: 'fireEvent', index: 7 })).toBe(0);
    steps(b, 30 * 65);
    expect(b.state.sides[0].supplies).toBeLessThan(400);
    expect(b.state.sides[1].alive.rifle).toBe(2);
  });

  it('reports what an AI commander is doing, and nothing for a human side', () => {
    const b = makeBattle({ commanders: ['human', 'ai'], mission: testMission({ b: { supplies: 500 } }) });
    steps(b, 30 * 3);
    expect(b.inspectAi(0)).toBeNull();
    const ai = b.inspectAi(1);
    expect(ai).not.toBeNull();
    expect(ai?.commander).toBe('ai');
    expect(ai?.order).toBe(b.state.sides[1].order);
    expect(ai?.firstAttackAfter).toBe(b.config.mission.ai.firstAttackAfter);
  });
});
