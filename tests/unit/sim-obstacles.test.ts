/**
 * Obstacles and water (FOUNDATIONS.md 4.4, 4.6 and 4.8): tank traps and road blocks, minefields, sandbags, the sappers'
 * Clear job, rivers, bridges and their demolition, the pontoon, and the ferry. Every battle is the 6,000 wu test field
 * with a few placed units and silent commanders unless a test says otherwise.
 */
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/data/config';
import { GROUND } from '../../src/data/ground';
import { MINES, OBSTACLES, WATER } from '../../src/data/obstacles';
import { PREP } from '../../src/data/prep';
import type { BridgeDef, CapturePointDef, ForceDef, MinefieldDef, MissionDef, ObstacleDef, SectorDef } from '../../src/data/schema';
import { UNITS } from '../../src/data/units';
import { TARGET_UNIT, type Battle } from '../../src/sim';
import { structureGone, structureHealth } from '../../src/sim/director';
import { splashMines } from '../../src/sim/mines';
import { splashObstacles } from '../../src/sim/obstacles';
import { groundCell, type World } from '../../src/sim/world';
import { checkInvariants, collect, makeBattle, run, runUntil, snapshot, testMission, unitsOf, type MissionOverrides } from './sim-helpers';

const world = (b: Battle): World => b as unknown as World;

function field(over: MissionOverrides, a: ForceDef[] = [], b: ForceDef[] = []): MissionDef {
  return testMission({ ...over, a: { forces: a, ...over.a }, b: { forces: b, ...over.b } });
}

const trap = (x: number, owner: 0 | 1, kind: ObstacleDef['kind'] = 'tankTrap'): ObstacleDef => ({ id: 1, x, width: 80, owner, kind });
const mines = (over: Partial<MinefieldDef> = {}): MinefieldDef => ({ id: 1, x: 3000, width: 300, owner: 0, mines: 'ap', density: 1, marked: false, ...over });
const RIVER: SectorDef[] = [
  { from: 0, to: 3000, ground: 'grass' },
  { from: 3000, to: 3500, ground: 'water' },
  { from: 3500, to: 6000, ground: 'grass' },
];

describe('tank traps and road blocks', () => {
  it("stop the other side's vehicles at their edge, and let infantry and their own side's vehicles through", () => {
    const m = field(
      { obstacles: [trap(3000, 0)] },
      [{ kind: 'tank', count: 1, x: 2500 }],
      [
        { kind: 'tank', count: 1, x: 3600 },
        { kind: 'rifle', count: 1, x: 3700 },
      ],
    );
    const b = makeBattle({ mission: m });
    b.command(1, { type: 'order', order: 'advance' });
    run(b, 25);
    const enemyTank = unitsOf(b, 1, 'tank')[0];
    expect(enemyTank.x).toBeCloseTo(3000 + 40 + UNITS.tank.width / 2, 3);
    // The rifleman walked straight through the hedgehogs.
    expect(unitsOf(b, 1, 'rifle')[0].x).toBeLessThan(2960);
    // The tank held there works it loose meanwhile.
    expect(b.state.obstacles[0].hp).toBeLessThan(OBSTACLES.kinds.tankTrap.hp);
    // Side 0's own tank drives through its own trap.
    const b2 = makeBattle({ mission: field({ obstacles: [trap(3000, 0)] }, [{ kind: 'tank', count: 1, x: 2500 }]) });
    b2.command(0, { type: 'order', order: 'advance' });
    run(b2, 25);
    expect(unitsOf(b2, 0, 'tank')[0].x).toBeGreaterThan(3100);
  });

  it('give way to the vehicles held at them in the end, which then drive on', () => {
    const b = makeBattle({ mission: field({ obstacles: [trap(3000, 0)] }, [], [{ kind: 'tank', count: 2, x: 3600 }]) });
    b.command(1, { type: 'order', order: 'advance' });
    const seen = collect(b, 80, 'obstacleDestroyed');
    expect(seen).toHaveLength(1);
    expect(seen[0].text).toBe('breached');
    // Two tanks at 8 hp/s each wear 900 hp down in about a minute (the second reaches it a little later).
    expect(seen[0].time).toBeGreaterThan(OBSTACLES.kinds.tankTrap.hp / (2 * OBSTACLES.breachDps));
    run(b, 10);
    expect(Math.max(...unitsOf(b, 1, 'tank').map((u) => u.x))).toBeLessThan(2900);
  });

  it("slow the other side's infantry like wire, as a road block", () => {
    const walk = (obstacles: ObstacleDef[]): number => {
      const b = makeBattle({ mission: field({ obstacles }, [], [{ kind: 'rifle', count: 1, x: 3100 }]) });
      b.command(1, { type: 'order', order: 'advance' });
      run(b, 1);
      const u = unitsOf(b, 1)[0];
      const x0 = u.x;
      run(b, 1);
      return x0 - u.x;
    };
    const open = walk([]);
    expect(walk([{ ...trap(3000, 0, 'roadBlock'), width: 400 }]) / open).toBeCloseTo(CONFIG.wireSlow, 2);
    expect(walk([{ ...trap(3000, 0, 'tankTrap'), width: 400 }]) / open).toBeCloseTo(1, 6);
  });

  it('are worn down by explosive splash, steel hedgehogs taking only a share', () => {
    const b = makeBattle({ mission: field({ obstacles: [trap(2000, 0, 'roadBlock'), { ...trap(4000, 0), id: 2 }] }) });
    splashObstacles(world(b), 2000, 50, 100);
    splashObstacles(world(b), 4000, 50, 100);
    expect(b.state.obstacles[0].hp).toBeCloseTo(OBSTACLES.kinds.roadBlock.hp - 100, 6);
    expect(b.state.obstacles[1].hp).toBeCloseTo(OBSTACLES.kinds.tankTrap.hp - 100 * OBSTACLES.kinds.tankTrap.blastMul, 6);
    splashObstacles(world(b), 2000, 50, 1000);
    expect(b.state.obstacles[0].alive).toBe(false);
    expect(structureGone(b.state, { obstacle: 1 }, 0)).toBe(true);
    expect(structureHealth(b.state, { obstacle: 2 })).toBeLessThan(1);
  });

  it("come down under a sapper's Clear job, and the sapper goes back to hauling", () => {
    const b = makeBattle({ mission: field({ obstacles: [trap(1600, 1)] }, [], []) });
    const m2 = field({ obstacles: [trap(1600, 1)], a: { sappers: 1 } });
    const c = makeBattle({ mission: m2 });
    void b;
    c.command(0, { type: 'clear', x: 1600 });
    run(c, 0.2);
    expect(c.state.clears).toHaveLength(1);
    const sapper = unitsOf(c, 0, 'sapper')[0];
    expect(sapper.site).toBe(c.state.clears[0].id);
    // A second order on the same target is dropped.
    c.command(0, { type: 'clear', x: 1610 });
    run(c, 0.2);
    expect(c.state.clears).toHaveLength(1);
    const done = runUntil(c, 120, (x) => !x.state.obstacles[0].alive);
    expect(done).toBe(true);
    run(c, 0.2);
    expect(c.state.clears).toHaveLength(0);
    expect(sapper.site).toBe(-1);
  });
});

describe('minefields', () => {
  const crossing = (field1: MinefieldDef, kind: ForceDef['kind'] = 'rifle', count = 6, seed = 3): Battle => {
    const b = makeBattle({ mission: field({ minefields: [field1] }, [], [{ kind, count, x: 3400 }]), seed });
    b.command(1, { type: 'order', order: 'advance' });
    return b;
  };

  it("blast the other side's men walking through, on the battle RNG, and thin out as they do", () => {
    const b = crossing(mines());
    const blasts = collect(b, 40, 'mineBlast');
    expect(blasts.length).toBeGreaterThan(0);
    const f = b.state.minefields[0];
    expect(f.blasts).toBe(blasts.length);
    expect(f.density).toBeCloseTo(1 - blasts.length * MINES.blastDensity, 6);
    // The same seed plays the same blasts.
    const again = crossing(mines());
    run(again, 40);
    expect(snapshot(again)).toBe(snapshot(b));
    expect(again.state.minefields[0].blasts).toBe(f.blasts);
    checkInvariants(b);
  });

  it('let their own side walk through untouched, and never touch the RNG for a field nobody enters', () => {
    const own = makeBattle({ mission: field({ minefields: [mines({ owner: 1 })] }, [], [{ kind: 'rifle', count: 6, x: 3400 }]) });
    own.command(1, { type: 'order', order: 'advance' });
    expect(collect(own, 30, 'mineBlast')).toHaveLength(0);
    const plain = makeBattle({ mission: field({}, [{ kind: 'rifle', count: 3, x: 1500 }], [{ kind: 'rifle', count: 3, x: 4500 }]), seed: 9 });
    const withField = makeBattle({ mission: field({ minefields: [mines({ x: 5500, width: 100 })] }, [{ kind: 'rifle', count: 3, x: 1500 }], [{ kind: 'rifle', count: 3, x: 4500 }]), seed: 9 });
    for (const x of [plain, withField]) {
      x.command(0, { type: 'order', order: 'advance' });
      x.command(1, { type: 'order', order: 'advance' });
    }
    run(plain, 60);
    run(withField, 60);
    expect(snapshot(withField)).toBe(snapshot(plain));
  });

  it('hurt by type: AT mines ignore infantry, AP mines barely scratch a tank', () => {
    expect(collect(crossing(mines({ mines: 'at' })), 40, 'mineBlast')).toHaveLength(0);
    const tankWalk = crossing(mines({ mines: 'ap', density: 1, width: 600 }), 'tank', 1, 4);
    const blasts = collect(tankWalk, 40, 'mineBlast');
    const tank = unitsOf(tankWalk, 1, 'tank')[0];
    expect(tank.maxHp - tank.hp).toBeCloseTo(blasts.length * MINES.damage.ap.vehicle, 3);
    const at = crossing(mines({ mines: 'at', density: 1, width: 600 }), 'tank', 1, 4);
    const atBlasts = collect(at, 40, 'mineBlast');
    expect(atBlasts.length).toBeGreaterThan(0);
  });

  it('are seen by their owner, and by the other side once marked, set off, shelled or flown over', () => {
    const b = makeBattle({ mission: field({ minefields: [mines(), mines({ id: 2, x: 1500, marked: true })] }) });
    expect(b.state.minefields[0].known).toEqual([true, false]);
    expect(b.state.minefields[1].known).toEqual([true, true]);
    splashMines(world(b), 1, 3000, 90, 100);
    expect(b.state.minefields[0].known[1]).toBe(true);
    // The shells broke mines over the share of the field their splash covered.
    expect(b.state.minefields[0].density).toBeCloseTo(1 - (MINES.splashDensity * 100 * (180 / 300)) / 100, 6);
    const c = crossing(mines());
    expect(c.state.minefields[0].known[1]).toBe(false);
    runUntil(c, 40, (x) => x.state.minefields[0].blasts > 0);
    expect(c.state.minefields[0].known[1]).toBe(true);
    const r = makeBattle({ mission: field({ minefields: [mines({ owner: 1 })], supports: [['recon'], []], a: { supplies: 1000 } }) });
    r.command(0, { type: 'support', kind: 'recon', x: 3000 });
    expect(runUntil(r, 30, (x) => x.state.minefields[0].known[0])).toBe(true);
  });

  it('are cleared by sappers from the near edge in, without setting them off', () => {
    const m = field({ minefields: [mines({ owner: 1, x: 1800, width: 120, marked: true })], a: { sappers: 1 } });
    const b = makeBattle({ mission: m });
    b.command(0, { type: 'clear', x: 1800 });
    let blasts = 0;
    const done = runUntil(b, 150, (x) => {
      for (let i = 0; i < x.events.count; i++) if (x.events.items[i].type === 'mineBlast') blasts++;
      return !x.state.minefields[0].alive;
    });
    expect(done).toBe(true);
    expect(blasts).toBe(0);
    expect(structureGone(b.state, { minefield: 1 }, 0)).toBe(true);
  });

  it("can't be cleared by a side that has not seen them", () => {
    const b = makeBattle({ mission: field({ minefields: [mines({ owner: 1, x: 1800 })], a: { sappers: 1 } }) });
    b.command(0, { type: 'clear', x: 1800 });
    run(b, 0.2);
    expect(b.state.clears).toHaveLength(0);
  });
});

describe('the prep builds', () => {
  const prepField = (buildables: MissionDef['prep']): MissionDef =>
    testMission({ trenches: [], pillboxes: [], wire: [], prep: buildables, a: { supplies: 2000, sappers: 4 }, buildings: [{ id: 1, x: 1400, width: 160, floors: 2, slotsPerFloor: 4, hpMul: 1, owner: 0, look: 'house' }] });

  it('make tank traps, road blocks, AP minefields and sandbags, walls in the open and bags in held windows', () => {
    const b = makeBattle({ mission: prepField({ seconds: 120, buildables: ['tankTrap', 'roadBlock', 'minefield', 'sandbags'] }) });
    const p = b.state.prep!;
    const x = (f: number): number => p.zoneFrom + (p.zoneTo - p.zoneFrom) * f;
    b.command(0, { type: 'build', kind: 'tankTrap', x: x(0.9) });
    b.command(0, { type: 'build', kind: 'roadBlock', x: x(0.75) });
    b.command(0, { type: 'build', kind: 'minefield', x: x(0.55) });
    b.command(0, { type: 'build', kind: 'sandbags', x: 1400 });
    b.command(0, { type: 'build', kind: 'sandbags', x: x(0.3) });
    run(b, 0.2);
    expect(b.state.sites.map((s) => s.kind)).toEqual(['tankTrap', 'roadBlock', 'minefield', 'sandbags', 'sandbags']);
    // Sandbags placed on the building fill its footprint.
    expect(b.state.sites[3].x).toBe(1400);
    expect(b.state.sites[3].width).toBe(160);
    expect(runUntil(b, 110, (y) => y.state.sites.length === 0)).toBe(true);
    expect(b.state.obstacles.map((o) => o.kind)).toEqual(['tankTrap', 'roadBlock']);
    expect(b.state.minefields).toHaveLength(1);
    expect(b.state.minefields[0].mines).toBe('ap');
    expect(b.state.minefields[0].density).toBe(MINES.prepDensity);
    expect(b.state.minefields[0].known).toEqual([true, false]);
    expect(b.state.sandbags).toHaveLength(2);
    const inWindows = b.state.sandbags.find((s) => s.building >= 0)!;
    expect(b.state.trenches[inWindows.trench].building).toBe(0);
    const wall = b.state.sandbags.find((s) => s.building < 0)!;
    expect(b.state.trenches[wall.trench].slots).toBe(PREP.buildables.sandbags.slots);
    checkInvariants(b);
  });

  it('are offered only where a mission lists them: the default menu stays the first four', () => {
    expect(PREP.order).toEqual(['wire', 'foxhole', 'trench', 'pillbox']);
    const b = makeBattle({ mission: prepField({ seconds: 30 }) });
    b.command(0, { type: 'build', kind: 'tankTrap', x: (b.state.prep!.zoneFrom + b.state.prep!.zoneTo) / 2 });
    run(b, 0.2);
    expect(b.state.sites).toHaveLength(0);
  });

  it('put sandbags in the windows that take a share off bullets and shells', () => {
    const shot = (sandbags: boolean): number => {
      const m = testMission({
        trenches: [],
        pillboxes: [],
        wire: [],
        prep: { seconds: 200, buildables: ['sandbags'] },
        a: { supplies: 2000, sappers: 2, forces: [{ kind: 'rifle', count: 1, buildingId: 1 }] },
        buildings: [{ id: 1, x: 1400, width: 160, floors: 1, slotsPerFloor: 4, hpMul: 1, owner: 0, look: 'house' }],
      });
      const b = makeBattle({ mission: m });
      if (sandbags) b.command(0, { type: 'build', kind: 'sandbags', x: 1400 });
      runUntil(b, 150, (y) => y.state.sites.length === 0 && y.state.sandbags.length === (sandbags ? 1 : 0));
      const u = unitsOf(b, 0, 'rifle')[0];
      const hp = u.hp;
      world(b).damage.push(TARGET_UNIT, u.index, u.id, 10, 1, 0, 1, 0);
      run(b, 1 / CONFIG.tickRate);
      return hp - u.hp;
    };
    expect(shot(true) / shot(false)).toBeCloseTo(OBSTACLES.sandbagBullet, 6);
  });
});

describe('rivers and bridges', () => {
  it('stop vehicles at the bank; infantry wade at the water speed', () => {
    const b = makeBattle({ mission: field({ sectors: RIVER }, [{ kind: 'tank', count: 1, x: 2700 }, { kind: 'rifle', count: 1, x: 2950 }]) });
    b.command(0, { type: 'order', order: 'advance' });
    run(b, 1.5);
    const rifle = unitsOf(b, 0, 'rifle')[0];
    const x0 = rifle.x;
    run(b, 2);
    expect(rifle.x - x0).toBeCloseTo(UNITS.rifle.speed * 2 * GROUND.water.infantry, 0);
    run(b, 20);
    const tank = unitsOf(b, 0, 'tank')[0];
    expect(tank.x).toBeLessThan(3000);
    expect(tank.x).toBeGreaterThan(2990);
    expect(rifle.x).toBeGreaterThan(3000);
  });

  it('carry vehicles and everyone at road speed while they stand', () => {
    const bridge: BridgeDef = { id: 1, x0: 3000, x1: 3500, owner: 0 };
    const b = makeBattle({ mission: field({ sectors: RIVER, bridges: [bridge] }, [{ kind: 'tank', count: 1, x: 2700 }]) });
    const g = world(b).ground!;
    expect(g.block[groundCell(g, 3250)]).toBe(0);
    expect(g.speed[groundCell(g, 3250) * 6 + 2]).toBeCloseTo(GROUND.road.vehicle, 6);
    b.command(0, { type: 'order', order: 'advance' });
    run(b, 30);
    expect(unitsOf(b, 0, 'tank')[0].x).toBeGreaterThan(3500);
  });

  it('fall to the demolish event, dropping the vehicles on them into the river', () => {
    const bridge: BridgeDef = { id: 1, x0: 3000, x1: 3500, owner: 1, demolition: { side: 1, wired: true } };
    const m = field(
      { sectors: RIVER, bridges: [bridge], events: [{ type: 'demolish', when: { at: 2 }, bridge: 1 }] },
      [{ kind: 'tank', count: 1, x: 3250 }],
    );
    const b = makeBattle({ mission: m });
    const blown = collect(b, 3, 'bridgeBlown');
    expect(blown).toHaveLength(1);
    expect(b.state.bridges[0].standing).toBe(false);
    expect(structureGone(b.state, { bridge: 1 }, 0)).toBe(true);
    const g = world(b).ground!;
    expect(g.block[groundCell(g, 3250)]).toBe(1);
    expect(unitsOf(b, 0, 'tank')).toHaveLength(0);
  });

  it("are not blown once the other side holds their point: holding it cuts the wires", () => {
    const point: CapturePointDef = { id: 'B', x: 3250, width: 500, label: 'The bridge', owner: 1, captureTime: 2, spawn: false, contestRadius: 300 };
    const bridge: BridgeDef = { id: 1, x0: 3000, x1: 3500, owner: 1, point: 'B', demolition: { side: 1, wired: true } };
    const m = field({ sectors: RIVER, bridges: [bridge], capturePoints: [point], events: [{ type: 'demolish', when: { at: 10 }, bridge: 1 }] }, [{ kind: 'rifle', count: 2, x: 3250 }]);
    const b = makeBattle({ mission: m });
    run(b, 5);
    expect(b.state.bridges[0].owner).toBe(0);
    expect(b.state.bridges[0].wired).toBe(false);
    run(b, 8);
    expect(b.state.bridges[0].standing).toBe(true);
  });

  it('go up with the bridge event: a pontoon across the water', () => {
    const pontoon: BridgeDef = { id: 2, x0: 3000, x1: 3500, owner: 0, standing: false, look: 'pontoon' };
    const b = makeBattle({ mission: field({ sectors: RIVER, bridges: [pontoon], events: [{ type: 'bridge', when: { at: 5 }, bridge: 2 }] }) });
    const g = world(b).ground!;
    expect(g.block[groundCell(g, 3250)]).toBe(1);
    expect(collect(b, 6, 'bridgeBuilt')).toHaveLength(1);
    expect(g.block[groundCell(g, 3250)]).toBe(0);
    expect(structureHealth(b.state, { bridge: 2 })).toBe(1);
  });

  it('keep the AI commander\'s tanks out of the water', () => {
    const m = field(
      { sectors: RIVER, a: { supplies: 0 }, b: { supplies: 3000, sappers: 2 }, units: [['sapper', 'rifle'], ['sapper', 'rifle', 'tank']] },
      [{ kind: 'rifle', count: 4, x: 2000 }],
      [{ kind: 'tank', count: 3, x: 4000 }],
    );
    const b = makeBattle({ mission: m, commanders: ['idle', 'ai'] });
    const g = world(b).ground!;
    run(b, 240, (x) => {
      for (const u of unitsOf(x, 1)) if (u.def.class === 'vehicle') expect(g.block[groundCell(g, u.x)]).toBe(0);
    });
  });
});

describe('the ferry', () => {
  const ferryMission = (events: MissionDef['events'] = []): MissionDef =>
    field({
      sectors: [
        { from: 0, to: 2000, ground: 'sand' },
        { from: 2000, to: 3000, ground: 'water' },
        { from: 3000, to: 6000, ground: 'sand' },
      ],
      capturePoints: [
        { id: 'L', x: 3300, width: 200, label: 'Landing', owner: 0, captureTime: 0, spawn: true, contestRadius: 300, batchEvery: 30, ferry: { from: 1950, crossSeconds: 10, hitShare: 0.5 } },
      ],
      a: { supplies: 1000 },
      events,
    });

  it('carries trained men and waves over together, a boat every batchEvery seconds', () => {
    const b = makeBattle({ mission: ferryMission([{ type: 'wave', when: { at: 1 }, side: 0, forces: [{ kind: 'rifle', count: 3, at: { point: 'L' } }] }]) });
    b.command(0, { type: 'train', kind: 'rifle' });
    run(b, 15);
    const waiting = unitsOf(b, 0, 'rifle');
    expect(waiting.length).toBe(4);
    for (const u of waiting) {
      expect(u.inside).toBe(true);
      expect(u.ferry).toBe(0);
    }
    checkInvariants(b);
    // The first boat puts out at 20 s (batchEvery 30, crossing 10) and lands them all at 30 s.
    run(b, 6);
    expect(b.state.ferries[0].sailing).toBe(true);
    expect(b.state.ferries[0].load).toBe(4);
    const landed = collect(b, 10, 'ferryLanded');
    expect(landed).toHaveLength(1);
    expect(landed[0].value).toBe(4);
    expect(landed[0].time).toBeCloseTo(30, 1);
    for (const u of unitsOf(b, 0, 'rifle')) {
      expect(u.inside).toBe(false);
      expect(u.x).toBeGreaterThan(3000);
    }
    checkInvariants(b);
  });

  it("loses hitShare of a load to a round landing on the boat, and counts the load lost", () => {
    const m = ferryMission([
      { type: 'wave', when: { at: 1 }, side: 0, forces: [{ kind: 'rifle', count: 6, at: { point: 'L' } }] },
      { type: 'barrage', when: { at: 23 }, side: 1, x: 2575, spread: 30, rounds: 6, duration: 2, weapon: 'artilleryShell' },
    ]);
    const outcomes: number[] = [];
    for (const seed of [1, 2]) {
      const b = makeBattle({ mission: m, seed });
      const hits = collect(b, 31, 'ferryHit');
      expect(hits).toHaveLength(1);
      expect(hits[0].value).toBe(3);
      expect(b.state.ferries[0].loadsLost).toBe(1);
      expect(unitsOf(b, 0, 'rifle')).toHaveLength(3);
      expect(b.state.sides[0].stats.lost).toBe(3);
      outcomes.push(unitsOf(b, 0, 'rifle').map((u) => u.id).reduce((a, x) => a * 31 + x, 7));
    }
    // Which three go down is the battle RNG's, so it can differ by seed but is the same for the same seed.
    const again = makeBattle({ mission: m, seed: 1 });
    run(again, 31);
    expect(unitsOf(again, 0, 'rifle').map((u) => u.id).reduce((a, x) => a * 31 + x, 7)).toBe(outcomes[0]);
  });

  it('feeds the ferryLoads loss: a side objective fails at the count', () => {
    const m: MissionDef = {
      ...ferryMission([
        { type: 'wave', when: { every: 30, from: 1 }, side: 0, forces: [{ kind: 'rifle', count: 4, at: { point: 'L' } }] },
        { type: 'barrage', when: { at: 23 }, side: 1, x: 2575, spread: 30, rounds: 6, duration: 2, weapon: 'artilleryShell' },
        { type: 'barrage', when: { at: 53 }, side: 1, x: 2575, spread: 30, rounds: 6, duration: 2, weapon: 'artilleryShell' },
      ]),
      phases: [
        {
          id: 'one',
          title: 'Hold',
          objectives: [{ id: 'hold', type: 'survive', seconds: 600 }],
          sideObjectives: [{ id: 'boats', text: 'The boats over', failIf: { type: 'ferryLoads', point: 'L', count: 2 }, bonus: 0.1 }],
          next: null,
        },
      ],
    };
    const b = makeBattle({ mission: m });
    run(b, 40);
    expect(b.state.director.side[0].status).toBe('open');
    run(b, 30);
    expect(b.state.ferries[0].loadsLost).toBe(2);
    expect(b.state.director.side[0].status).toBe('failed');
  });

  it('sends nobody across a landing the side has lost: they walk out on the home bank', () => {
    const b = makeBattle({ mission: ferryMission([{ type: 'wave', when: { at: 1 }, side: 0, forces: [{ kind: 'rifle', count: 2, at: { point: 'L' } }] }]) });
    run(b, 2);
    b.state.points[0].owner = 1;
    run(b, 20);
    for (const u of unitsOf(b, 0, 'rifle')) {
      expect(u.inside).toBe(false);
      expect(u.x).toBeLessThan(2000);
    }
    expect(WATER.ferryHitRadius).toBeGreaterThan(0);
  });
});
