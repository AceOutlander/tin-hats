import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/data/config';
import type { UnitKind, UpgradeDef } from '../../src/data/schema';
import { UNITS } from '../../src/data/units';
import { WEAPONS } from '../../src/data/weapons';
import { SIM_FEATURES, type Battle, type UnitState } from '../../src/sim';
import { DT, checkInvariants, collect, eventsOf, makeBattle, run, runUntil, testMission, unitsOf, type MissionOverrides } from './sim-helpers';

/** A hundred times the health for side 0's units of these kinds. */
function tough(...kinds: UnitKind[]): { upgrades: Record<string, number>; upgradeDefs: UpgradeDef[] } {
  const def: UpgradeDef = {
    id: 'tough',
    name: '',
    description: '',
    unit: null,
    levels: [kinds.map((unit) => ({ stat: 'unitHealth' as const, unit, mul: 100 }))],
    costPerLevel: 1,
  };
  return { upgrades: { tough: 1 }, upgradeDefs: [def] };
}

function field(over: MissionOverrides, ...toughKinds: UnitKind[]): Battle {
  return makeBattle({ mission: testMission({ length: 6000, ...over }), ...tough(...toughKinds) });
}

function take(b: Battle, u: UnitState): void {
  b.command(0, { type: 'control', unit: u.id });
}

function stick(b: Battle, moveX: number, fire = false, ability = false): void {
  b.command(0, { type: 'controlInput', moveX, fire, ability });
}

describe('direct control', () => {
  it('is switched on', () => {
    expect(SIM_FEATURES.directControl).toBe(true);
  });

  it('takes one unit at a time, by id, and only a controllable unit of its own side on the field', () => {
    const b = field({
      a: { sappers: 1, forces: [{ kind: 'rifle', count: 2, x: 1000 }, { kind: 'medic', count: 1, x: 900 }] },
      b: { forces: [{ kind: 'rifle', count: 1, x: 5000 }] },
    });
    const [r1, r2] = unitsOf(b, 0, 'rifle');
    const sapper = unitsOf(b, 0, 'sapper')[0];
    const medic = unitsOf(b, 0, 'medic')[0];
    const enemy = unitsOf(b, 1, 'rifle')[0];
    const side = b.state.sides[0];

    take(b, r1);
    b.step();
    expect(side.controlled).toBe(r1.index);
    expect(r1.controlled).toBe(true);

    // Another unit: the first is let go.
    take(b, r2);
    b.step();
    expect(side.controlled).toBe(r2.index);
    expect(r1.controlled).toBe(false);
    expect(r2.controlled).toBe(true);

    // Refused: a sapper, an enemy, an unknown id. Control stays where it was.
    expect(UNITS.sapper.controllable).toBe(false);
    for (const id of [sapper.id, enemy.id, 99999]) {
      b.command(0, { type: 'control', unit: id });
      b.step();
      expect(side.controlled).toBe(r2.index);
    }
    expect(sapper.controlled || enemy.controlled).toBe(false);
    expect(b.state.sides[1].controlled).toBe(-1);

    // A medic may be taken; -1 lets go.
    take(b, medic);
    b.step();
    expect(side.controlled).toBe(medic.index);
    b.command(0, { type: 'control', unit: -1 });
    b.step();
    expect(side.controlled).toBe(-1);
    expect(unitsOf(b, 0).some((u) => u.controlled)).toBe(false);

    // Nobody in the HQ can be taken.
    b.command(0, { type: 'order', order: 'fallBack' });
    runUntil(b, 30, () => r1.inside);
    take(b, r1);
    b.step();
    expect(side.controlled).toBe(-1);
  });

  it('walks with the stick at its speed, ignores the order and still stops at the front clamp', () => {
    const b = field(
      {
        a: { forces: [{ kind: 'rifle', count: 2, x: 1000 }] },
        b: { forces: [{ kind: 'rifle', count: 1, x: 2000, behaviour: 'guard' }] },
      },
      'rifle',
    );
    const [u, other] = unitsOf(b, 0, 'rifle');
    take(b, u);
    stick(b, 1);
    b.step(); // control and stick land at the start of this step
    const x0 = u.x;
    run(b, 3);
    expect(u.x - x0).toBeCloseTo(UNITS.rifle.speed * 3, 0);

    // Fall Back: the other rifleman runs for the HQ, the controlled one walks on.
    b.command(0, { type: 'order', order: 'fallBack' });
    run(b, 25, () => checkInvariants(b));
    expect(other.inside).toBe(true);
    expect(u.inside).toBe(false);
    const guard = unitsOf(b, 1, 'rifle')[0];
    expect(u.x).toBeCloseTo(guard.x - CONFIG.contactGap, 6);

    // Half a stick backwards: half speed, facing the way it walks.
    stick(b, -0.5);
    b.step();
    const x1 = u.x;
    run(b, 2);
    expect(x1 - u.x).toBeCloseTo(UNITS.rifle.speed * 0.5 * 2, 0);
    expect(u.facing).toBe(-1);
    expect(u.action).toBe('move');
  });

  it('keeps its aim on the nearest target but fires only while the button is held, with the damage and reload buffs', () => {
    const door = 6000 - CONFIG.hqInset - CONFIG.hqDoorOffset;
    const b = field({ a: { forces: [{ kind: 'rifle', count: 1, x: door - 250 }] }, b: { hqHpMul: 100 } }, 'rifle');
    const u = unitsOf(b, 0, 'rifle')[0];
    take(b, u);
    stick(b, 0, false);
    const idle = collect(b, 3, 'shot').filter((e) => e.source === 'unit');
    expect(idle).toHaveLength(0);
    expect(u.action).toBe('aim');
    expect(u.aimX).toBeCloseTo(door, 6);

    stick(b, 0, true);
    const pressedAt = b.state.time;
    const shots = collect(b, 12, 'shot', 'structureHit');
    const own = shots.filter((e) => e.type === 'shot' && e.source === 'unit');
    expect(own.length).toBeGreaterThan(4);
    // The aim had settled: the first shot goes at once.
    expect(own[0].time - pressedAt).toBeLessThanOrEqual(2 * DT + 1e-9);
    const reload = WEAPONS.rifle.cooldown / CONFIG.controlReloadMul;
    for (let i = 1; i < own.length; i++) expect(Math.abs(own[i].time - own[i - 1].time - reload)).toBeLessThanOrEqual(1.5 * DT);
    const hits = shots.filter((e) => e.type === 'structureHit' && e.side === 1);
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) expect(h.value).toBeCloseTo(WEAPONS.rifle.damage * 0.35 * CONFIG.controlDamageMul, 6);

    // Released, it is an ordinary rifleman again (no buff on the reload).
    stick(b, 0, false);
    b.command(0, { type: 'control', unit: -1 });
    b.step();
    expect(u.controlled).toBe(false);
    expect(u.mount.trigger).toBe(true);
  });

  it('throws its grenade on the ability button and not otherwise', () => {
    const b = field(
      {
        trenches: [{ id: 1, x: 3000, width: 120, slots: 6, owner: 1 }],
        a: { forces: [{ kind: 'assault', count: 1, x: 2880 }] },
        b: { forces: [{ kind: 'rifle', count: 4, trenchId: 1 }] },
      },
      'assault',
    );
    const u = unitsOf(b, 0, 'assault')[0];
    take(b, u);
    stick(b, 0, false);
    const quiet = collect(b, 6, 'projectile').filter((e) => e.weapon === 'grenade');
    expect(quiet).toHaveLength(0);
    stick(b, 0, false, true);
    const thrown = collect(b, 2, 'projectile').filter((e) => e.weapon === 'grenade');
    expect(thrown).toHaveLength(1);
    expect(thrown[0].unitId).toBe(u.id);
    expect(Math.abs(thrown[0].x2 - 3000)).toBeLessThan(120);
    // One press, one grenade.
    expect(collect(b, 8, 'projectile').filter((e) => e.weapon === 'grenade')).toHaveLength(0);
  });

  it('takes a free slot in a trench it stands in that is not enemy-held, and leaves it when it walks on', () => {
    const b = field({ trenches: [{ id: 7, x: 1500, width: 120, slots: 6, owner: 0 }], a: { forces: [{ kind: 'rifle', count: 1, x: 1300 }] } });
    const u = unitsOf(b, 0, 'rifle')[0];
    take(b, u);
    stick(b, 1);
    runUntil(b, 10, () => u.x >= 1480);
    stick(b, 0);
    expect(runUntil(b, 3, () => u.trenchId === 7)).toBe(true);
    expect(b.state.trenches[0].occupants).toBe(1);
    stick(b, 1);
    b.step();
    b.step();
    expect(u.trenchId).toBe(-1);
    expect(b.state.trenches[0].occupants).toBe(0);
  });

  it('finds no slot in a full trench and cannot walk into one the enemy holds', () => {
    const b = field(
      {
        trenches: [
          { id: 1, x: 1500, width: 120, slots: 2, owner: 0 },
          { id: 2, x: 2500, width: 120, slots: 6, owner: 1 },
        ],
        a: { forces: [{ kind: 'rifle', count: 2, trenchId: 1 }, { kind: 'rifle', count: 1, x: 1300 }] },
        b: { forces: [{ kind: 'rifle', count: 3, trenchId: 2 }] },
      },
      'rifle',
    );
    const u = unitsOf(b, 0, 'rifle').find((r) => r.trenchId < 0) as UnitState;
    take(b, u);
    stick(b, 1);
    runUntil(b, 10, () => u.x >= 1500);
    stick(b, 0);
    run(b, 2);
    expect(u.trenchId).toBe(-1);
    expect(b.state.trenches[0].occupants).toBe(2);
    stick(b, 1);
    run(b, 20, () => checkInvariants(b));
    expect(u.x).toBeCloseTo(2500 - 60 - CONFIG.contactGap, 6);
    expect(u.trenchId).toBe(-1);
  });

  it('reports controlLost when the controlled unit dies, and the side has no unit under control afterwards', () => {
    const b = field({ a: { forces: [{ kind: 'rifle', count: 1, x: 3000 }] }, b: { forces: [{ kind: 'lmg', count: 3, x: 3500, behaviour: 'guard' }] } });
    const u = unitsOf(b, 0, 'rifle')[0];
    const id = u.id;
    take(b, u);
    stick(b, 1);
    const lost = collect(b, 40, 'controlLost', 'unitDied');
    const ctrl = lost.filter((e) => e.type === 'controlLost');
    expect(ctrl).toHaveLength(1);
    expect(ctrl[0]).toMatchObject({ side: 0, unitId: id, kind: 'rifle' });
    expect(lost.some((e) => e.type === 'unitDied' && e.unitId === id)).toBe(true);
    expect(b.state.sides[0].controlled).toBe(-1);
  });

  it('goes back to its orders when released', () => {
    const b = field({ a: { forces: [{ kind: 'rifle', count: 1 }] } });
    const u = unitsOf(b, 0, 'rifle')[0];
    const home = u.x;
    take(b, u);
    stick(b, 1);
    run(b, 5);
    expect(u.x).toBeGreaterThan(home + 300);
    b.command(0, { type: 'control', unit: -1 });
    run(b, 10);
    expect(u.controlled).toBe(false);
    expect(Math.abs(u.x - home)).toBeLessThan(CONFIG.moveDeadband + 1);
  });

  it('ends when the battle ends', () => {
    // The controlled rifleman himself shoots down an enemy HQ that is all but gone.
    const door = 6000 - CONFIG.hqInset - CONFIG.hqDoorOffset;
    const b = field({ a: { forces: [{ kind: 'rifle', count: 1, x: door - 250 }] }, b: { hqHpMul: 0.001 } }, 'rifle');
    const u = unitsOf(b, 0, 'rifle')[0];
    take(b, u);
    stick(b, 0, true);
    runUntil(b, 60, () => b.state.over);
    expect(b.state.over).toBe(true);
    expect(b.state.winner).toBe(0);
    expect(u.alive).toBe(true);
    expect(b.state.sides[0].controlled).toBe(-1);
    expect(unitsOf(b, 0).some((r) => r.controlled)).toBe(false);
    expect(eventsOf(b, 'controlLost')).toHaveLength(0);
  });
});
