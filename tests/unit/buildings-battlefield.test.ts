/**
 * Buildings on the long-map battlefield (FOUNDATIONS.md 4.2, 4.3 and 4.5, where the two features meet): a fallen
 * building's footprint becomes rubble ground, a capture point held through a building, a point named by `{ point }`
 * in the `contested` loss, the Stalingrad points that are buildings, and the same battle twice with both features.
 */
import { describe, expect, it } from 'vitest';
import { GROUND, GROUND_CELL, GROUND_IDS } from '../../src/data/ground';
import { getMission } from '../../src/data/missions';
import type { BuildingDef, CapturePointDef, MissionEventDef } from '../../src/data/schema';
import type { Battle } from '../../src/sim';
import { buildingTrenchId, infantryInside } from '../../src/sim/buildings';
import { setOwner } from '../../src/sim/director';
import type { World } from '../../src/sim/world';
import { collect, makeBattle, run, snapshot, testMission, unitsOf } from './sim-helpers';

const world = (b: Battle): World => b as unknown as World;
const RUBBLE = GROUND_IDS.indexOf('rubble');
const GRASS = GROUND_IDS.indexOf('grass');

const house = (over: Partial<BuildingDef> = {}): BuildingDef => ({
  id: 1,
  x: 1500,
  width: 180,
  floors: 2,
  slotsPerFloor: 4,
  hpMul: 0.25,
  owner: 0,
  look: 'house',
  ...over,
});

const point = (over: Partial<CapturePointDef> = {}): CapturePointDef => ({
  id: 'P1',
  x: 1500,
  width: 300,
  label: 'The house',
  owner: 0,
  captureTime: 0,
  spawn: true,
  contestRadius: 600,
  ...over,
});

function bombs(side: 0 | 1, x: number, rounds: number): MissionEventDef {
  return { type: 'barrage', when: { at: 1 }, side, x, spread: 0, rounds, duration: rounds * 0.5, weapon: 'heavyBomb' };
}

/** The cells whose centres lie in [from, to). */
function cells(from: number, to: number): number[] {
  const out: number[] = [];
  for (let c = Math.ceil(from / GROUND_CELL - 0.5); (c + 0.5) * GROUND_CELL < to; c++) out.push(c);
  return out;
}

describe('a building that falls', () => {
  it('turns its footprint to rubble ground on a map with sectors, and leaves the rest as it was', () => {
    const mission = testMission({ sectors: [{ from: 0, to: 6000, ground: 'grass' }], buildings: [house()], events: [bombs(1, 1500, 3)] });
    const b = makeBattle({ mission });
    const g = world(b).ground!;
    for (const c of cells(1410, 1590)) expect(g.ground[c]).toBe(GRASS);
    const fell = collect(b, 4, 'structureDestroyed').filter((e) => e.target === 'building');
    expect(fell).toHaveLength(1);
    expect(b.state.buildings[0].rubble).toBe(true);
    const foot = cells(1410, 1590);
    expect(foot.length).toBeGreaterThan(0);
    for (const c of foot) {
      expect(g.ground[c]).toBe(RUBBLE);
      expect(g.cover[c]).toBeCloseTo(GROUND.rubble.bulletCover, 6);
    }
    expect(g.ground[foot[0] - 2]).toBe(GRASS);
    expect(g.ground[foot[foot.length - 1] + 2]).toBe(GRASS);
  });

  it('gives a map with no sectors its ground tables then, rubble under it and even ground elsewhere', () => {
    const mission = testMission({ buildings: [house()], events: [bombs(1, 1500, 3)] });
    const b = makeBattle({ mission });
    expect(world(b).ground).toBeNull();
    run(b, 4);
    expect(b.state.buildings[0].rubble).toBe(true);
    const g = world(b).ground!;
    expect(g).not.toBeNull();
    for (const c of cells(1410, 1590)) expect(g.ground[c]).toBe(RUBBLE);
    const far = Math.floor(4000 / GROUND_CELL);
    expect(g.cover[far]).toBe(1);
    expect(g.height[far]).toBe(1);
  });

  it('that never falls (no shells) leaves a map without sectors on no ground tables at all', () => {
    const b = makeBattle({ mission: testMission({ buildings: [house()] }) });
    run(b, 5);
    expect(world(b).ground).toBeNull();
  });
});

describe('a capture point that is a building', () => {
  it('resolves to the building\'s slot record and goes with it under setOwner, by either ref', () => {
    const mission = testMission({ buildings: [house({ hpMul: 1 })], capturePoints: [point({ structure: { building: 1 } })] });
    const b = makeBattle({ mission });
    const s = b.state;
    const p = s.points[0];
    expect(s.trenches[p.trench].id).toBe(buildingTrenchId(1));
    expect(s.trenches[p.trench].building).toBe(0);
    expect(p.owner).toBe(0);
    setOwner(world(b), { point: 'P1' }, 1);
    expect(s.trenches[p.trench].owner).toBe(1);
    expect(p.owner).toBe(1);
    setOwner(world(b), { building: 1 }, 0);
    run(b, 0.1);
    expect(p.owner).toBe(0);
  });

  it('counts the other side\'s men inside it for the contested loss, by point or by building', () => {
    const mission = testMission({
      buildings: [house({ hpMul: 1 })],
      capturePoints: [point({ structure: { building: 1 } }), point({ id: 'P2', x: 3000, width: 400, owner: 0 })],
      b: {
        forces: [
          { kind: 'rifle', count: 2, x: 1500, leash: 0 },
          { kind: 'rifle', count: 3, x: 3100, leash: 0 },
        ],
      },
    });
    const b = makeBattle({ mission });
    const s = b.state;
    expect(unitsOf(b, 1, 'rifle')).toHaveLength(5);
    // The building's span is its own width (180), not the point's zone.
    expect(infantryInside(s, { building: 1 }, 1)).toBe(2);
    expect(infantryInside(s, { point: 'P1' }, 1)).toBe(2);
    // An open-ground point counts its zone.
    expect(infantryInside(s, { point: 'P2' }, 1)).toBe(3);
    expect(infantryInside(s, { point: 'P9' }, 1)).toBe(0);
  });
});

describe('the Stalingrad points that are buildings', () => {
  it.each([
    [1004, 'P1', 2],
    [1005, 'P2', 2],
    [1008, 'P2', 3],
    [1009, 'P2', 2],
  ])('mission %i\'s %s is held through building B%i', (id, pid, bid) => {
    const m = getMission(id)!;
    const def = m.capturePoints!.find((p) => p.id === pid)!;
    expect(def.structure).toEqual({ building: bid });
    const b = makeBattle({ mission: m, commanders: ['bot', 'ai'] });
    const s = b.state;
    const p = s.points.find((q) => q.id === pid)!;
    const rec = s.trenches[p.trench];
    expect(rec.id).toBe(buildingTrenchId(bid));
    expect(s.buildings[rec.building].id).toBe(bid);
    expect(p.owner).toBe(rec.owner);
  });

  it('replay the same with buildings, rubble and points together (1004)', () => {
    const play = (): string => {
      const b = makeBattle({ mission: getMission(1004)!, commanders: ['bot', 'ai'], seed: 7 });
      run(b, 90);
      return snapshot(b);
    };
    expect(play()).toBe(play());
  });
});
