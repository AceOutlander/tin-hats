import { describe, expect, it } from 'vitest';
import { DAMAGE } from '../../src/data/damage';
import type { DamageType, ForceDef, MissionDef, TargetClass, UnitKind, UpgradeDef } from '../../src/data/schema';
import { WEAPONS } from '../../src/data/weapons';
import { collect, makeBattle, testMission, type Seen } from './sim-helpers';

/** A hundred times the health for side 0's shooters, so they outlast the return fire. */
function tough(kind: UnitKind): { upgrades: Record<string, number>; upgradeDefs: UpgradeDef[] } {
  const def: UpgradeDef = {
    id: 'tough',
    name: '',
    description: '',
    unit: null,
    levels: [[{ stat: 'unitHealth', unit: kind, mul: 100 }]],
    costPerLevel: 1,
  };
  return { upgrades: { tough: 1 }, upgradeDefs: [def] };
}

const posted = (kind: UnitKind, x: number, count = 1): ForceDef => ({ kind, count, x, behaviour: 'guard' });

/** The kind of target each column is tested against, on a 3000 wu field with side 0's line at 850. */
function targetSide(cls: TargetClass, x: number): Pick<MissionDef, 'trenches' | 'pillboxes' | 'buildings' | 'props'> & { b: object } {
  const none = { trenches: [], pillboxes: [] };
  switch (cls) {
    case 'infantryOpen':
      // Riflemen posted in the open, tough enough (100) to live through a full-strength shell.
      return { ...none, b: { forces: [posted('rifle', x, 3)] } };
    case 'infantryTrench':
      return { ...none, trenches: [{ id: 1, x, width: 120, slots: 6, owner: 1 }], b: { forces: [{ kind: 'rifle', count: 4, trenchId: 1 }] } };
    case 'fortification':
      return { ...none, pillboxes: [{ id: 1, x, side: 1, hpMul: 5 }], b: {} };
    case 'vehicle':
      return { ...none, b: { forces: [posted('tank', x)] } };
    case 'hq':
      return { ...none, b: { hqHpMul: 50 } };
    case 'infantryBuilding':
      // Walls tough enough that no floor falls in the test.
      return {
        ...none,
        buildings: [{ id: 1, x, width: 120, floors: 1, slotsPerFloor: 6, hpMul: 50, owner: 1, look: 'house' }],
        b: { forces: [{ kind: 'rifle', count: 4, buildingId: 1 }] },
      };
    case 'rubbleCover':
      // A cover prop is rubble cover from the start.
      return { ...none, props: [{ id: 1, x, width: 120, slots: 6, look: 'wagons', owner: 1 }], b: { forces: [{ kind: 'rifle', count: 4, buildingId: 1 }] } };
  }
}

interface Cell {
  dtype: DamageType;
  cls: TargetClass;
  weapon: string;
  shooter: ForceDef;
  /** Where the target stands (ignored for the HQ, whose door is at 2780). */
  x: number;
  advance?: boolean;
}

const CELLS: Cell[] = [
  { dtype: 'bullet', cls: 'infantryOpen', weapon: 'rifle', shooter: { kind: 'rifle', count: 4 }, x: 1100 },
  { dtype: 'bullet', cls: 'infantryTrench', weapon: 'rifle', shooter: { kind: 'rifle', count: 4 }, x: 1150 },
  { dtype: 'bullet', cls: 'fortification', weapon: 'rifle', shooter: { kind: 'rifle', count: 4 }, x: 1300, advance: true },
  { dtype: 'bullet', cls: 'vehicle', weapon: 'rifle', shooter: { kind: 'rifle', count: 6 }, x: 1150 },
  { dtype: 'bullet', cls: 'hq', weapon: 'rifle', shooter: { kind: 'rifle', count: 4 }, x: 0, advance: true },
  { dtype: 'explosive', cls: 'infantryOpen', weapon: 'mortar', shooter: posted('mortar', 700), x: 1100 },
  { dtype: 'explosive', cls: 'infantryTrench', weapon: 'mortar', shooter: posted('mortar', 700), x: 1250 },
  { dtype: 'explosive', cls: 'fortification', weapon: 'mortar', shooter: posted('mortar', 700), x: 1200 },
  { dtype: 'explosive', cls: 'vehicle', weapon: 'tankGun', shooter: posted('tank', 700), x: 1050 },
  { dtype: 'explosive', cls: 'hq', weapon: 'mortar', shooter: posted('mortar', 2180), x: 0 },
  { dtype: 'antiTank', cls: 'infantryOpen', weapon: 'rocket', shooter: { kind: 'at', count: 2 }, x: 1050 },
  { dtype: 'antiTank', cls: 'infantryTrench', weapon: 'rocket', shooter: { kind: 'at', count: 2 }, x: 1030 },
  { dtype: 'antiTank', cls: 'fortification', weapon: 'rocket', shooter: { kind: 'at', count: 2 }, x: 1050 },
  { dtype: 'antiTank', cls: 'vehicle', weapon: 'rocket', shooter: { kind: 'at', count: 2 }, x: 1050 },
  { dtype: 'antiTank', cls: 'hq', weapon: 'rocket', shooter: posted('at', 2530), x: 0 },
  { dtype: 'bullet', cls: 'infantryBuilding', weapon: 'rifle', shooter: { kind: 'rifle', count: 4 }, x: 1150 },
  { dtype: 'explosive', cls: 'infantryBuilding', weapon: 'mortar', shooter: posted('mortar', 700), x: 1250 },
  { dtype: 'antiTank', cls: 'infantryBuilding', weapon: 'rocket', shooter: { kind: 'at', count: 2 }, x: 1030 },
  { dtype: 'bullet', cls: 'rubbleCover', weapon: 'rifle', shooter: { kind: 'rifle', count: 4 }, x: 1150 },
  { dtype: 'explosive', cls: 'rubbleCover', weapon: 'mortar', shooter: posted('mortar', 700), x: 1250 },
  { dtype: 'antiTank', cls: 'rubbleCover', weapon: 'rocket', shooter: { kind: 'at', count: 2 }, x: 1030 },
];

/** The hits of this cell's damage type on this cell's target class. */
function cellHits(events: Seen[], cell: Cell): number[] {
  return events
    .filter((e) => {
      if (e.cause !== cell.dtype) return false;
      switch (cell.cls) {
        case 'infantryOpen':
        case 'infantryTrench':
        case 'infantryBuilding':
        case 'rubbleCover':
          return e.type === 'unitHit' && e.side === 1 && e.kind === 'rifle';
        case 'vehicle':
          return e.type === 'unitHit' && e.side === 1 && e.kind === 'tank';
        case 'fortification':
          return e.type === 'structureHit' && e.target === 'pillbox';
        case 'hq':
          return e.type === 'structureHit' && e.target === 'hq' && e.side === 1;
      }
    })
    .map((e) => e.value);
}

describe('the damage matrix', () => {
  it('lists the factor of every damage type against every target class', () => {
    for (const cell of CELLS) expect(DAMAGE[cell.dtype][cell.cls]).toBeGreaterThan(0);
    expect(CELLS).toHaveLength(21);
  });

  for (const cell of CELLS) {
    it(`${cell.dtype} against ${cell.cls}: ${cell.weapon} does damage x ${DAMAGE[cell.dtype][cell.cls]}`, () => {
      const target = targetSide(cell.cls, cell.x);
      const mission = testMission({ length: 3000, ...target, a: { forces: [cell.shooter] }, b: target.b });
      const b = makeBattle({ mission, ...tough(cell.shooter.kind) });
      if (cell.advance) b.command(0, { type: 'order', order: 'advance' });
      const hits = cellHits(collect(b, 40, 'unitHit', 'structureHit'), cell);
      const weapon = WEAPONS[cell.weapon];
      expect(weapon.damageType).toBe(cell.dtype);
      const full = weapon.damage * DAMAGE[cell.dtype][cell.cls];
      expect(hits.length).toBeGreaterThan(0);
      if (weapon.delivery === 'hitscan') {
        for (const v of hits) expect(v).toBeCloseTo(full, 9);
      } else {
        // Splash falls off from the full value, which a round landing on the target's footprint deals.
        for (const v of hits) expect(v).toBeLessThanOrEqual(full + 1e-9);
        expect(Math.max(...hits)).toBeCloseTo(full, 6);
      }
    });
  }
});
