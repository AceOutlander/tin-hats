/**
 * Buildings, rubble and cover props (FOUNDATIONS.md 4.3; src/sim/buildings.ts): window slots floor by floor, capture
 * by entering empty, no vehicles inside, garrisons, the floor bonuses, walls that lose their floors to shells and fall
 * to rubble, the director's building refs and the contested loss, and the same battle twice.
 */
import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '../../src/data/buildings';
import { DAMAGE, FIRE_DAMAGE } from '../../src/data/damage';
import { getMission } from '../../src/data/missions';
import { WEAPONS } from '../../src/data/weapons';
import type { BuildingDef, MissionDef, MissionEventDef, UnitKind, UpgradeDef } from '../../src/data/schema';
import { SLOT_SEALED, buildingTrenchId, rubbleSlotCount } from '../../src/sim/buildings';
import { CLASS_BUILDING, CLASS_RUBBLE, unitClass } from '../../src/sim/tables';
import { collect, makeBattle, run, runUntil, snapshot, testMission, unitsOf, checkInvariants } from './sim-helpers';
import type { Battle } from '../../src/sim';

/** Side 0's riflemen and anti-tank teams a hundred times as tough, so shells on their house hurt the walls, not the test. */
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

const house = (over: Partial<BuildingDef> = {}): BuildingDef => ({
  id: 1,
  x: 1500,
  width: 180,
  floors: 3,
  slotsPerFloor: 4,
  hpMul: 1,
  owner: 0,
  look: 'apartment',
  ...over,
});

/** Slot record of the first building, its slot range and the world internals the tests read. */
function internals(b: Battle): { slotUnit: Int32Array; slotFloor: Int8Array; trenchSlot0: Int32Array; trenchTaken: Int32Array } {
  return b as unknown as { slotUnit: Int32Array; slotFloor: Int8Array; trenchSlot0: Int32Array; trenchTaken: Int32Array };
}

function bombs(side: 0 | 1, x: number, rounds: number, at = 1): MissionEventDef {
  return { type: 'barrage', when: { at }, side, x, spread: 0, rounds, duration: rounds * 0.5, weapon: 'heavyBomb' };
}

describe('a building\'s window slots', () => {
  it('are a slot record per building after the mission\'s trenches, floor by floor', () => {
    const mission = testMission({ trenches: [{ id: 1, x: 900, width: 120, slots: 5, owner: 0 }], buildings: [house()] });
    const b = makeBattle({ mission });
    const s = b.state;
    expect(s.trenches.map((t) => [t.id, t.slots, t.building])).toEqual([
      [1, 5, -1],
      [buildingTrenchId(1), 12, 0],
    ]);
    expect(s.buildings[0]).toMatchObject({ id: 1, floors: 3, floorsLeft: 3, owner: 0, rubble: false, prop: false, trench: 1 });
    expect(s.buildings[0].maxHp).toBe(BUILDINGS.hp);
    const w = internals(b);
    const first = w.trenchSlot0[1];
    expect(Array.from(w.slotFloor.subarray(first, first + 12))).toEqual([0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2]);
    // The trench's own slots are on the ground.
    expect(Array.from(w.slotFloor.subarray(0, 5))).toEqual([0, 0, 0, 0, 0]);
  });

  it('take riflemen from the ground floor up and send the anti-tank team to the top floor', () => {
    const mission = testMission({
      buildings: [house()],
      a: {
        forces: [
          { kind: 'rifle', count: 6, buildingId: 1 },
          { kind: 'at', count: 1, buildingId: 1 },
        ],
      },
    });
    const b = makeBattle({ mission });
    const rifles = unitsOf(b, 0, 'rifle');
    const at = unitsOf(b, 0, 'at')[0];
    expect(rifles.map((u) => u.floor).sort()).toEqual([0, 0, 0, 0, 1, 1]);
    for (const u of [...rifles, at]) {
      expect(u.trenchId).toBe(buildingTrenchId(1));
      expect(unitClass(u)).toBe(CLASS_BUILDING);
    }
    expect(at.floor).toBe(2);
    expect(b.state.buildings[0].occupants).toBe(7);
  });

  it('give floor 2 and up the range bonus and a tall building\'s top floor the shot down onto a tank', () => {
    const mission = testMission({
      buildings: [house(), house({ id: 2, x: 2200, floors: 2 })],
      a: {
        forces: [
          { kind: 'rifle', count: 6, buildingId: 1 },
          { kind: 'at', count: 1, buildingId: 1 },
          { kind: 'at', count: 1, buildingId: 2 },
        ],
      },
    });
    const b = makeBattle({ mission });
    for (const u of unitsOf(b, 0, 'rifle')) {
      expect(u.mount.rangeMul).toBe(u.floor >= 1 ? BUILDINGS.upperFloorRange : 1);
      expect(u.mount.vehicleMul).toBe(1);
    }
    const [tall, low] = unitsOf(b, 0, 'at');
    expect(tall.floor).toBe(2);
    expect(tall.mount.vehicleMul).toBe(BUILDINGS.topFloorVsVehicles);
    expect(tall.mount.rangeMul).toBe(BUILDINGS.upperFloorRange);
    // Two floors are not enough for the roof shot.
    expect(low.floor).toBe(1);
    expect(low.mount.vehicleMul).toBe(1);
  });

  it('let a man on the upper floor reach a target past his weapon\'s range', () => {
    // A rifleman on floor 2 against a lone enemy just beyond the rifle's range from the ground.
    const range = 330;
    const mission = testMission({
      buildings: [house({ floors: 2, slotsPerFloor: 1 })],
      a: { forces: [{ kind: 'rifle', count: 2, buildingId: 1 }] },
      b: { forces: [{ kind: 'rifle', count: 1, x: 1500 + range * 1.04, behaviour: 'guard', leash: 0 }] },
    });
    const b = makeBattle({ mission });
    const upper = unitsOf(b, 0, 'rifle').find((u) => u.floor === 1);
    const ground = unitsOf(b, 0, 'rifle').find((u) => u.floor === 0);
    expect(upper && ground).toBeTruthy();
    const shots = collect(b, 6, 'shot').filter((e) => e.side === 0);
    expect(shots.some((e) => e.unitId === upper?.id)).toBe(true);
    expect(shots.some((e) => e.unitId === ground?.id)).toBe(false);
  });
});

describe('taking a building', () => {
  it('is done by entering it empty; vehicles never enter or take it', () => {
    const empty = house({ x: 1300, owner: -1 });
    const foot = makeBattle({ mission: testMission({ buildings: [empty], a: { forces: [{ kind: 'rifle', count: 2, x: 1100 }] } }) });
    foot.command(0, { type: 'order', order: 'advance' });
    const captured = collect(foot, 20, 'trenchCaptured');
    expect(captured.some((e) => e.targetIndex === buildingTrenchId(1) && e.side === 0)).toBe(true);
    expect(foot.state.buildings[0].owner).toBe(0);

    const tanks = makeBattle({ mission: testMission({ buildings: [empty], a: { forces: [{ kind: 'tank', count: 1, x: 1100, buildingId: 1 }] } }) });
    expect(unitsOf(tanks, 0, 'tank')[0].trenchId).toBe(-1);
    tanks.command(0, { type: 'order', order: 'advance' });
    run(tanks, 20);
    expect(unitsOf(tanks, 0, 'tank')[0].x).toBeGreaterThan(1300 + 90);
    expect(tanks.state.buildings[0].owner).toBe(-1);
  });

  it('cannot be entered while the enemy holds it; its garrison stays whatever the order', () => {
    const mission = testMission({
      buildings: [house({ x: 1500, owner: 1, floors: 2 })],
      a: { forces: [{ kind: 'rifle', count: 4, x: 1100 }] },
      b: { forces: [{ kind: 'rifle', count: 3, buildingId: 1, behaviour: 'garrison' }] },
    });
    const b = makeBattle({ mission, ...tough('rifle') });
    b.command(0, { type: 'order', order: 'advance' });
    b.command(1, { type: 'order', order: 'advance' });
    run(b, 30, (battle) => {
      checkInvariants(battle);
      const bl = battle.state.buildings[0];
      if (bl.occupants > 0 && bl.owner === 1) {
        for (const u of unitsOf(battle, 0)) expect(u.x).toBeLessThan(bl.x - bl.width / 2);
      }
    });
    // Side 0 is a hundred times as tough, so the house falls to it in the end; until then its men stayed in.
    const garrison = unitsOf(b, 1, 'rifle');
    for (const u of garrison) expect(u.trenchId).toBe(buildingTrenchId(1));
  });

  it('is contested while the other side\'s infantry stand inside it', () => {
    const mission = testMission({
      buildings: [house({ x: 1500, owner: 0, floors: 1, slotsPerFloor: 6 })],
      a: { forces: [{ kind: 'rifle', count: 3, buildingId: 1, behaviour: 'garrison' }] },
      b: { forces: [{ kind: 'rifle', count: 1, x: 1560, behaviour: 'guard', leash: 0 }] },
      phases: [
        {
          id: 'p',
          title: 'Hold the house',
          objectives: [{ id: 's', type: 'survive', seconds: 100 }],
          lose: [{ type: 'contested', point: { building: 1 } }],
          next: null,
        },
      ],
    });
    const b = makeBattle({ mission });
    b.step();
    expect(b.state.buildings[0].contested).toBe(true);
    expect(b.state.buildings[0].inside[1]).toBe(1);
    run(b, 1);
    expect(b.state.over).toBe(true);
    expect(b.state.winner).toBe(1);
    expect(b.state.endReason).toBe('objectiveFailed');
  });
});

describe('a building\'s walls', () => {
  it('lose their top floor to shells; its men drop to a floor below and the floor\'s slots are gone', () => {
    // 900 hp: below 600 the third floor falls, below 300 the second; one heavy bomb takes 462 (220 x 0.35 x 6).
    const bomb = 220 * BUILDINGS.wallDamage.explosive * (BUILDINGS.wallWeaponMul.heavyBomb ?? 1);
    expect(bomb).toBeGreaterThan(300);
    expect(bomb).toBeLessThan(600);
    const mission = testMission({
      buildings: [house({ hpMul: 900 / BUILDINGS.hp })],
      a: {
        forces: [
          { kind: 'rifle', count: 4, buildingId: 1 },
          { kind: 'at', count: 1, buildingId: 1 },
        ],
      },
      events: [bombs(1, 1500, 1)],
    });
    const b = makeBattle({ mission, ...tough('rifle', 'at') });
    const at = unitsOf(b, 0, 'at')[0];
    expect(at.floor).toBe(2);
    const seen = collect(b, 4, 'floorCollapsed', 'structureHit', 'unitHit');
    const bl = b.state.buildings[0];
    expect(bl.floorsLeft).toBe(2);
    expect(bl.hp).toBeCloseTo(900 - bomb, 6);
    expect(seen.filter((e) => e.type === 'floorCollapsed')).toHaveLength(1);
    expect(seen.some((e) => e.type === 'structureHit' && e.target === 'building')).toBe(true);
    // The anti-tank team was hurt by the fall and now holds the highest floor left, without the roof shot (2 floors).
    const crushed = BUILDINGS.collapseDamage * DAMAGE.explosive.infantryBuilding;
    expect(seen.some((e) => e.type === 'unitHit' && e.unitId === at.id && Math.abs(e.value - crushed) < 1e-9)).toBe(true);
    run(b, 2);
    expect(at.trenchId).toBe(buildingTrenchId(1));
    expect(at.floor).toBe(1);
    expect(at.mount.vehicleMul).toBe(1);
    const w = internals(b);
    const first = w.trenchSlot0[bl.trench];
    for (let g = first + 8; g < first + 12; g++) expect(w.slotUnit[g]).toBe(SLOT_SEALED);
  });

  it('fall to rubble at 0 hp: everyone is thrown out, and half the slots shelter men again as rubble cover', () => {
    const mission = testMission({
      buildings: [house({ hpMul: 0.25 })],
      a: { forces: [{ kind: 'rifle', count: 6, buildingId: 1 }] },
      events: [bombs(1, 1500, 3)],
    });
    const b = makeBattle({ mission, ...tough('rifle') });
    const fell = collect(b, 4, 'structureDestroyed').filter((e) => e.target === 'building');
    expect(fell).toHaveLength(1);
    const bl = b.state.buildings[0];
    expect(bl).toMatchObject({ rubble: true, floorsLeft: 0, hp: 0 });
    const room = rubbleSlotCount(3, 4);
    expect(room).toBe(6);
    const w = internals(b);
    expect(w.trenchTaken[bl.trench]).toBeLessThanOrEqual(12);
    // The men, still holding the line there, take the rubble's slots again: rubble cover, on the ground.
    run(b, 8, checkInvariants);
    const men = unitsOf(b, 0, 'rifle').filter((u) => u.trenchId === buildingTrenchId(1));
    expect(men.length).toBe(room);
    for (const u of men) {
      expect(unitClass(u)).toBe(CLASS_RUBBLE);
      expect(u.floor).toBe(0);
      expect(u.mount.rangeMul).toBe(1);
    }
    expect(bl.occupants).toBe(room);
  });

  it('take no harm from their own side\'s shells, and a cover prop takes none at all', () => {
    const mission = testMission({
      buildings: [house()],
      props: [{ id: 2, x: 2400, width: 120, slots: 5, look: 'wagons', owner: 0 }],
      a: { forces: [{ kind: 'rifle', count: 4, buildingId: 2 }] },
      events: [bombs(0, 1500, 2), bombs(1, 2400, 2)],
    });
    const b = makeBattle({ mission, ...tough('rifle') });
    const prop = b.state.buildings[1];
    expect(prop).toMatchObject({ prop: true, rubble: true, breakable: false, owner: 0 });
    for (const u of unitsOf(b, 0, 'rifle')) expect(unitClass(u)).toBe(CLASS_RUBBLE);
    run(b, 4);
    expect(b.state.buildings[0].hp).toBe(b.state.buildings[0].maxHp);
    expect(prop.rubble).toBe(true);
    expect(prop.hp).toBe(0);
  });

  it('of 1008\'s machine shops lose their upper floor, not the hall, to the heavy bomb (from full health)', () => {
    const m = getMission(1008);
    const shops = m?.buildings?.find((x) => x.id === 3);
    const ev = m?.events.find((e) => e.id === 'heavyBomb');
    if (!shops || !ev || ev.type !== 'barrage') throw new Error('1008 data');
    const mission = testMission({
      length: 9000,
      buildings: [{ ...shops, owner: 0 }],
      a: { forces: [{ kind: 'rifle', count: 4, buildingId: 3 }] },
      events: [{ ...ev, when: { at: 1 } }],
    });
    const b = makeBattle({ mission, ...tough('rifle') });
    run(b, 1 + ev.duration + 3);
    expect(b.state.buildings[0]).toMatchObject({ floorsLeft: shops.floors - 1, rubble: false });
  });

  it('ignore every shell when the building cannot collapse', () => {
    const mission = testMission({ buildings: [house({ collapse: 'none', owner: -1 })], events: [bombs(1, 1500, 4)] });
    const b = makeBattle({ mission });
    run(b, 4);
    expect(b.state.buildings[0]).toMatchObject({ floorsLeft: 3, rubble: false });
    expect(b.state.buildings[0].hp).toBe(b.state.buildings[0].maxHp);
  });
});

describe('the director and buildings', () => {
  it('captures a building point, and knows its owner and health', () => {
    const mission: MissionDef = testMission({
      buildings: [house({ x: 1300, owner: -1 })],
      a: { forces: [{ kind: 'rifle', count: 3, x: 1100 }] },
      phases: [
        { id: 'take', title: 'Take the house', objectives: [{ id: 'take', type: 'capture', point: { building: 1 } }], next: 'hold' },
        { id: 'hold', title: 'Hold it', objectives: [{ id: 'hold', type: 'hold', point: { building: 1 }, seconds: 5 }], next: null },
      ],
    });
    const b = makeBattle({ mission });
    b.command(0, { type: 'order', order: 'advance' });
    expect(runUntil(b, 30, (battle) => battle.state.director.phaseId === 'hold')).toBe(true);
    b.command(0, { type: 'order', order: 'hold' });
    run(b, 8);
    expect(b.state.over).toBe(true);
    expect(b.state.winner).toBe(0);
  });

  it('seats a wave in a building and spawns one at a building it holds', () => {
    const mission = testMission({
      buildings: [house({ x: 2000, owner: 0 })],
      events: [
        { type: 'wave', when: { at: 1 }, side: 0, forces: [{ kind: 'rifle', count: 2, buildingId: 1 }] },
        { type: 'wave', when: { at: 2 }, side: 0, forces: [{ kind: 'lmg', count: 1, at: { building: 1 } }] },
      ],
    });
    const b = makeBattle({ mission });
    const spawned = collect(b, 3, 'unitSpawned');
    const seated = unitsOf(b, 0, 'rifle').filter((u) => u.trenchId === buildingTrenchId(1));
    expect(seated).toHaveLength(2);
    // The machine gunner comes in just behind the house (then walks to its windows like the rest).
    const lmg = spawned.find((e) => e.kind === 'lmg');
    expect(lmg).toBeDefined();
    expect(lmg?.x).toBeLessThan(2000 - 90);
    expect(lmg?.x).toBeGreaterThan(2000 - 200);
  });
});

describe('the armies and buildings', () => {
  it('a side holding a building forms its line in it', () => {
    const mission = testMission({
      length: 6000,
      buildings: [house({ x: 4200, owner: 1, floors: 2, slotsPerFloor: 5 })],
      b: { forces: [{ kind: 'rifle', count: 6 }] },
    });
    const b = makeBattle({ mission });
    run(b, 40);
    expect(b.state.buildings[0].occupants).toBe(6);
    expect(b.state.sides[1].holdLineX).toBe(4200);
  });

  it('burns men out of a building\'s windows with fire (x FIRE_DAMAGE, not the matrix), and they stay out a while', () => {
    const mission = testMission({
      buildings: [house({ x: 1500, owner: 1, floors: 1, slotsPerFloor: 4, hpMul: 50 })],
      a: { forces: [{ kind: 'flame', count: 2, x: 1330, behaviour: 'guard' }] },
      b: { forces: [{ kind: 'rifle', count: 4, buildingId: 1, behaviour: 'garrison' }] },
    });
    const b = makeBattle({ mission, ...tough('flame') });
    expect(unitsOf(b, 1, 'rifle').every((u) => unitClass(u) === CLASS_BUILDING)).toBe(true);
    let flushed = false;
    const hits: number[] = [];
    run(b, 8, (bb) => {
      checkInvariants(bb);
      if (unitsOf(bb, 1, 'rifle').some((u) => u.trenchId < 0 && u.flushedUntil > bb.state.time)) flushed = true;
    });
    expect(flushed).toBe(true);
    const again = makeBattle({ mission, ...tough('flame') });
    for (const e of collect(again, 8, 'unitHit')) if (e.side === 1 && e.cause === 'explosive') hits.push(e.value);
    const fire = WEAPONS.flamer.damage * (FIRE_DAMAGE.infantryBuilding ?? 0);
    expect(hits.some((v) => Math.abs(v - fire) < 1e-9)).toBe(true);
    expect(fire).toBeGreaterThan(WEAPONS.flamer.damage * DAMAGE.explosive.infantryBuilding);
  });

  it('the test bot takes a building the enemy holds (it clears it and moves in)', () => {
    const mission = testMission({
      length: 5000,
      buildings: [house({ x: 2600, owner: 1, floors: 1, slotsPerFloor: 4 })],
      a: { supplies: 600, forces: [{ kind: 'rifle', count: 8 }, { kind: 'lmg', count: 2 }, { kind: 'mortar', count: 2 }, { kind: 'flame', count: 1 }] },
      b: { forces: [{ kind: 'rifle', count: 3, buildingId: 1, behaviour: 'garrison' }] },
      phases: [{ id: 'take', title: 'Take the house', objectives: [{ id: 'take', type: 'capture', point: { building: 1 } }], next: null }],
    });
    const b = makeBattle({ mission, seed: 3, commanders: ['bot', 'idle'] });
    expect(unitsOf(b, 1, 'rifle').every((u) => u.trenchId === buildingTrenchId(1))).toBe(true);
    expect(runUntil(b, 240, (battle) => battle.state.buildings[0].owner === 0)).toBe(true);
    // Taken by a man of side 0 entering it once its garrison was cleared out; that wins the one-phase mission.
    expect(b.state.buildings[0].inside[0]).toBeGreaterThan(0);
    expect(unitsOf(b, 1, 'rifle').filter((u) => u.alive)).toHaveLength(0);
    expect(b.state.over).toBe(true);
    expect(b.state.winner).toBe(0);
  });

  it('leaves a mission without buildings exactly as before (no slot records, no building state)', () => {
    const plain = testMission({ trenches: [{ id: 1, x: 2000, width: 120, slots: 5, owner: -1 }], a: { forces: [{ kind: 'rifle', count: 6 }, { kind: 'mortar', count: 1 }] } });
    const empty = { ...plain, buildings: [], props: [] };
    const play = (m: MissionDef): string => {
      const b = makeBattle({ mission: m, seed: 11, commanders: ['bot', 'ai'] });
      run(b, 60);
      return snapshot(b);
    };
    const b = makeBattle({ mission: plain });
    expect(b.state.buildings).toHaveLength(0);
    expect(b.state.trenches.every((t) => t.building === -1)).toBe(true);
    expect(play(empty)).toBe(play(plain));
  });

  it('plays the same battle twice', () => {
    const mission = testMission({
      buildings: [house({ x: 2600, owner: -1, hpMul: 0.4 }), house({ id: 2, x: 3400, owner: 1, floors: 4, slotsPerFloor: 3 })],
      props: [{ id: 3, x: 2000, width: 100, slots: 4, look: 'ju52Wreck' }],
      a: { supplies: 400, forces: [{ kind: 'rifle', count: 8 }, { kind: 'mortar', count: 2 }, { kind: 'tank', count: 1 }] },
      b: { forces: [{ kind: 'rifle', count: 6, buildingId: 2, behaviour: 'garrison' }, { kind: 'at', count: 2, buildingId: 2 }] },
      events: [bombs(1, 2600, 2, 20)],
    });
    const play = (): string => {
      const b = makeBattle({ mission, seed: 7, commanders: ['bot', 'ai'] });
      b.command(0, { type: 'order', order: 'advance' });
      run(b, 90, checkInvariants);
      return snapshot(b) + JSON.stringify(b.state.buildings);
    };
    expect(play()).toBe(play());
  });
});
