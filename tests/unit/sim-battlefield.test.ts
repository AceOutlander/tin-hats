/**
 * The long-map battlefield (FOUNDATIONS.md 4.1, 4.2 and 4.5): ground sectors and the per-cell speed, cover and height
 * tables; ski troops; capture points (the timer, contesting, structure points, the director's point refs); forward
 * deploy; the hold line on a point; rally Fall Back; the AI deploying forward. Every battle here is the 6,000 wu test
 * field with a few placed units and human (silent) commanders unless a test says otherwise.
 */
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/data/config';
import { GROUND, GROUND_CELL, GROUND_IDS, POINT_RULES } from '../../src/data/ground';
import type { CapturePointDef, ForceDef, MissionDef, SectorDef } from '../../src/data/schema';
import { UNITS } from '../../src/data/units';
import { WEAPONS } from '../../src/data/weapons';
import { DEPLOY_AUTO, DEPLOY_HQ, TARGET_NONE, type Battle } from '../../src/sim';
import { killUnit } from '../../src/sim/units';
import { setGround, type World } from '../../src/sim/world';
import { FIELD } from './fixtures';
import { checkInvariants, collect, makeBattle, run, snapshot, testMission, unitsOf, type MissionOverrides } from './sim-helpers';

const world = (b: Battle): World => b as unknown as World;

function field(sectors: SectorDef[] | undefined, a: ForceDef[] = [], b: ForceDef[] = [], over: MissionOverrides = {}): MissionDef {
  return testMission({ sectors, ...over, a: { forces: a, ...over.a }, b: { forces: b, ...over.b } });
}

const ALL = (ground: SectorDef['ground'], extra: Partial<SectorDef> = {}): SectorDef[] => [{ from: 0, to: 6000, ground, ...extra }];

/** Distance a lone unit covers in `seconds` walking toward the far end (side 0 Advance, side 1 Advance). */
function walked(sectors: SectorDef[] | undefined, force: ForceDef, side: 0 | 1, seconds: number): number {
  const m = side === 0 ? field(sectors, [force]) : field(sectors, [], [force]);
  const b = makeBattle({ mission: m });
  b.command(side, { type: 'order', order: 'advance' });
  run(b, 0.5);
  const u = unitsOf(b, side).find((x) => x.kind === force.kind)!;
  const x0 = u.x;
  run(b, seconds);
  return Math.abs(u.x - x0);
}

describe('ground sectors', () => {
  it('leave a mission without them on even ground: no tables, and the same battle as before', () => {
    expect(world(makeBattle({ mission: FIELD })).ground).toBeNull();
    // Sectors of even ground everywhere give multipliers of exactly 1: the battle is the very same.
    const one = makeBattle({ mission: FIELD, commanders: ['bot', 'ai'], seed: 5 });
    const two = makeBattle({ mission: { ...FIELD, sectors: ALL('grass') }, commanders: ['bot', 'ai'], seed: 5 });
    for (let i = 0; i < 6; i++) {
      run(one, 30);
      run(two, 30);
      expect(snapshot(two)).toBe(snapshot(one));
    }
  });

  it('build one cell per 50 wu, sector by sector, even ground where no sector reaches', () => {
    const b = makeBattle({ mission: field([{ from: 1000, to: 2000, ground: 'deepSnow', heightBonus: 1.1 }]) });
    const g = world(b).ground!;
    expect(GROUND_CELL).toBe(50);
    expect(g.count).toBe(6000 / 50);
    expect(g.ground[25]).toBe(GROUND_IDS.indexOf('deepSnow'));
    expect(g.speed[25 * 6]).toBeCloseTo(GROUND.deepSnow.infantry, 6);
    expect(g.height[25]).toBeCloseTo(1.1, 6);
    expect(g.speed[10 * 6]).toBe(1);
    expect(g.height[10]).toBe(1);
    expect(g.speed[45 * 6]).toBe(1);
  });

  it('slow infantry and vehicles by the ground table', () => {
    const rifle: ForceDef = { kind: 'rifle', count: 1, x: 1000 };
    const tank: ForceDef = { kind: 'tank', count: 1, x: 1000 };
    const even = walked(undefined, rifle, 0, 4);
    expect(even).toBeCloseTo(UNITS.rifle.speed * 4, 0);
    expect(walked(ALL('deepSnow'), rifle, 0, 4) / even).toBeCloseTo(GROUND.deepSnow.infantry, 2);
    expect(walked(ALL('rubble'), rifle, 0, 4) / even).toBeCloseTo(GROUND.rubble.infantry, 2);
    const tankEven = walked(undefined, tank, 0, 4);
    expect(walked(ALL('rubble'), tank, 0, 4) / tankEven).toBeCloseTo(GROUND.rubble.vehicle, 2);
    expect(walked(ALL('cobble'), tank, 0, 4) / tankEven).toBeCloseTo(GROUND.cobble.vehicle, 2);
    expect(walked(ALL('cobble'), rifle, 0, 4) / even).toBeCloseTo(1, 6);
  });

  it('make a slope slow going up and quick coming down', () => {
    const up: ForceDef = { kind: 'rifle', count: 1, x: 2000 };
    const down: ForceDef = { kind: 'rifle', count: 1, x: 4000 };
    const even0 = walked(undefined, up, 0, 4);
    const even1 = walked(undefined, down, 1, 4);
    // slopeUp rises toward +x: side 0 climbs it, side 1 comes down it.
    expect(walked(ALL('slopeUp'), up, 0, 4) / even0).toBeCloseTo(GROUND.slopeUp.infantry, 2);
    expect(walked(ALL('slopeUp'), down, 1, 4) / even1).toBeCloseTo(GROUND.slopeUp.infantryDown, 2);
    expect(walked(ALL('slopeDown'), up, 0, 4) / even0).toBeCloseTo(GROUND.slopeDown.infantry, 2);
    expect(GROUND.slopeUp.infantry).toBeLessThan(1);
    expect(GROUND.slopeUp.infantryDown).toBeGreaterThan(1);
  });

  it('do not slow ski troops in deep snow (ForceDef.tags)', () => {
    const skis: ForceDef = { kind: 'assault', count: 1, x: 1000, tags: ['skis'] };
    const boots: ForceDef = { kind: 'assault', count: 1, x: 1000 };
    const even = walked(undefined, boots, 0, 4);
    expect(walked(ALL('deepSnow'), skis, 0, 4) / even).toBeCloseTo(1, 2);
    expect(walked(ALL('deepSnow'), boots, 0, 4) / even).toBeCloseTo(GROUND.deepSnow.infantry, 2);
    const b = makeBattle({ mission: field(ALL('deepSnow'), [skis, boots]) });
    expect(unitsOf(b, 0).map((u) => u.skis)).toEqual([true, false]);
  });

  it('can be rewritten during the battle (rubble), on a mission that had none', () => {
    const b = makeBattle({ mission: field(undefined, [{ kind: 'rifle', count: 1, x: 1000 }]) });
    setGround(world(b), 0, 6000, 'rubble');
    b.command(0, { type: 'order', order: 'advance' });
    run(b, 0.5);
    const u = unitsOf(b, 0)[0];
    const x0 = u.x;
    run(b, 4);
    expect((u.x - x0) / (UNITS.rifle.speed * 4)).toBeCloseTo(GROUND.rubble.infantry, 2);
  });

  it('give infantry in the open cover from bullets in forest and rubble, not on open ground', () => {
    const firstHit = (ground: SectorDef['ground']): number => {
      const m = field(ALL(ground), [{ kind: 'rifle', count: 1, x: 2000, leash: 0 }], [{ kind: 'rifle', count: 1, x: 2200, leash: 0 }]);
      const b = makeBattle({ mission: m, seed: 2 });
      const hits = collect(b, 20, 'unitHit').filter((e) => e.side === 1);
      return hits[0].value;
    };
    const open = firstHit('grass');
    // The tables are Float32Arrays: the same to six figures.
    expect(firstHit('forest')).toBeCloseTo(open * GROUND.forest.bulletCover, 4);
    expect(firstHit('rubble')).toBeCloseTo(open * GROUND.rubble.bulletCover, 4);
    expect(GROUND.forest.bulletCover).toBe(0.85);
    expect(firstHit('snow')).toBeCloseTo(open, 6);
  });

  it('let weapons on a crest reach further (heightBonus)', () => {
    const reach = WEAPONS.rifle.range;
    const crest: SectorDef[] = [{ from: 1900, to: 2100, ground: 'rock', heightBonus: 1.1 }];
    const forces = (): [ForceDef[], ForceDef[]] => [
      [{ kind: 'rifle', count: 1, x: 2000, leash: 0 }],
      [{ kind: 'rifle', count: 1, x: 2000 + reach * 1.05, leash: 0 }],
    ];
    const [a, b] = forces();
    const high = makeBattle({ mission: field(crest, a, b) });
    run(high, 1);
    expect(unitsOf(high, 0)[0].mount.targetType).not.toBe(TARGET_NONE);
    // The man below is out of reach of the crest.
    expect(unitsOf(high, 1)[0].mount.targetType).toBe(TARGET_NONE);
    const flat = makeBattle({ mission: field(undefined, ...forces()) });
    run(flat, 1);
    expect(unitsOf(flat, 0)[0].mount.targetType).toBe(TARGET_NONE);
  });
});

const P = (over: Partial<CapturePointDef> = {}): CapturePointDef => ({
  id: 'P1',
  x: 3000,
  width: 300,
  label: 'The crossroads',
  owner: -1,
  captureTime: 10,
  spawn: true,
  contestRadius: 600,
  ...over,
});

function pointField(points: CapturePointDef[], a: ForceDef[] = [], b: ForceDef[] = [], over: MissionOverrides = {}): MissionDef {
  return field(undefined, a, b, { capturePoints: points, ...over });
}

describe('capture points', () => {
  it('change hands after a side holds the zone alone for captureTime, with one pointCaptured', () => {
    const b = makeBattle({ mission: pointField([P()], [{ kind: 'rifle', count: 1, x: 3000, leash: 0 }]) });
    const early = collect(b, 9.8, 'pointCaptured');
    expect(early).toEqual([]);
    expect(b.state.points[0].owner).toBe(-1);
    expect(b.state.points[0].capturing).toBe(0);
    expect(b.state.points[0].progress).toBeGreaterThan(0.95);
    const events = collect(b, 0.5, 'pointCaptured');
    expect(events.map((e) => [e.side, e.targetIndex, e.value, e.text])).toEqual([[0, 0, -1, 'The crossroads']]);
    expect(b.state.points[0].owner).toBe(0);
    expect(b.state.points[0].capturedAt).toBeCloseTo(10, 1);
  });

  it('are taken at once with captureTime 0, and not by sappers or the unarmed', () => {
    const b = makeBattle({ mission: pointField([P({ captureTime: 0 })], [{ kind: 'rifle', count: 1, x: 3000, leash: 0 }]) });
    run(b, 0.1);
    expect(b.state.points[0].owner).toBe(0);
    const medic = makeBattle({ mission: pointField([P({ captureTime: 0 })], [{ kind: 'medic', count: 1, x: 3000, leash: 0 }]) });
    run(medic, 2);
    expect(medic.state.points[0].owner).toBe(-1);
  });

  it('stand still while both sides are in the zone, and drain once the taker leaves', () => {
    const both = makeBattle({
      mission: pointField([P()], [{ kind: 'rifle', count: 1, x: 2950, leash: 0 }], [{ kind: 'rifle', count: 1, x: 3050, leash: 0, behaviour: 'guard' }]),
    });
    for (const u of unitsOf(both, 0).concat(unitsOf(both, 1))) u.invincible = true;
    run(both, 15);
    expect(both.state.points[0].owner).toBe(-1);
    expect(both.state.points[0].progress).toBe(0);

    const left = makeBattle({ mission: pointField([P()], [{ kind: 'rifle', count: 1, x: 3000, leash: 0 }]) });
    run(left, 5);
    const half = left.state.points[0].progress;
    expect(half).toBeGreaterThan(0.4);
    killUnit(world(left), unitsOf(left, 0)[0], 0, 1, -1);
    run(left, 8);
    expect(left.state.points[0].owner).toBe(-1);
    expect(left.state.points[0].progress).toBeLessThan(half);
  });

  it('that are a structure go with it (a building id held through its stand-in trench)', () => {
    const trench = { id: 4, x: 3000, width: 160, slots: 6, owner: 1 as const };
    const m = pointField([P({ structure: { building: 4 }, captureTime: 30 })], [{ kind: 'rifle', count: 3, x: 2700 }], [], { trenches: [trench] });
    const b = makeBattle({ mission: m });
    expect(b.state.points[0].trench).toBe(0);
    expect(b.state.points[0].owner).toBe(1);
    b.command(0, { type: 'order', order: 'advance' });
    const events = collect(b, 15, 'pointCaptured', 'trenchCaptured');
    expect(events.map((e) => e.type)).toEqual(['trenchCaptured', 'pointCaptured']);
    expect(events[0].time).toBe(events[1].time);
    expect(b.state.points[0].owner).toBe(0);
  });

  it('serve the director: capture objectives, pointCaptured triggers, setOwner and waves `at` a point', () => {
    const m = pointField([P({ captureTime: 2 }), P({ id: 'P2', x: 4200, owner: 0, label: 'Forward post' })], [{ kind: 'rifle', count: 1, x: 3000, leash: 0 }], [], {
      mode: 'special',
      phases: [
        { id: 'take', title: 'Take the crossroads', objectives: [{ id: 'take', type: 'capture', point: { point: 'P1' } }], next: 'wait' },
        { id: 'wait', title: 'Wait', objectives: [{ id: 'wait', type: 'survive', seconds: 1 }], next: null },
      ],
      events: [
        { type: 'announce', when: { pointCapturedBy: 0, point: { point: 'P1' } }, text: 'Ours' },
        { type: 'wave', when: { at: 1 }, side: 0, forces: [{ kind: 'lmg', count: 2, at: { point: 'P2' } }] },
        { type: 'setOwner', when: { at: 1.5 }, ref: { point: 'P2' }, owner: 1 },
      ],
    });
    const b = makeBattle({ mission: m });
    const seen = collect(b, 1.1, 'unitSpawned');
    const lmgs = seen.filter((e) => e.kind === 'lmg');
    expect(lmgs.map((e) => e.x)).toEqual([4200 - 150, 4200 - 150 - CONFIG.spacing]);
    run(b, 0.5);
    expect(b.state.points[1].owner).toBe(1);
    const after = collect(b, 2, 'announce', 'battleEnded');
    expect(after.map((e) => e.type)).toContain('announce');
    expect(b.state.over).toBe(true);
    expect(b.state.winner).toBe(0);
  });

  it('are contested by an armed enemy within contestRadius', () => {
    const b = makeBattle({ mission: pointField([P({ owner: 0 })], [], [{ kind: 'rifle', count: 1, x: 3500, leash: 0 }]) });
    run(b, 0.1);
    expect(b.state.points[0].contested).toBe(true);
    const far = makeBattle({ mission: pointField([P({ owner: 0 })], [], [{ kind: 'rifle', count: 1, x: 3700, leash: 0 }]) });
    run(far, 0.1);
    expect(far.state.points[0].contested).toBe(false);
  });
});

describe('forward deploy (the "Deploy at" chip)', () => {
  function trained(b: Battle, side: 0 | 1, seconds: number): number[] {
    return collect(b, seconds, 'unitSpawned')
      .filter((e) => e.side === side && e.value === 1 && e.kind !== 'sapper')
      .map((e) => e.x);
  }

  it('sends trained units out of the forward-most available spawn point by default, sappers out of the HQ', () => {
    const m = pointField([P({ owner: 0 }), P({ id: 'P2', x: 2000, owner: 0 }), P({ id: 'P3', x: 4000, owner: 0, spawn: false })], [], [], { a: { supplies: 500 } });
    const b = makeBattle({ mission: m });
    expect(b.state.sides[0].deploy).toBe(DEPLOY_AUTO);
    run(b, 0.1);
    expect(b.state.sides[0].deployPoint).toBe(0);
    b.command(0, { type: 'train', kind: 'rifle' });
    b.command(0, { type: 'train', kind: 'sapper' });
    const out = collect(b, 20, 'unitSpawned')
      .filter((e) => e.side === 0 && e.value === 1)
      .map((e) => [e.kind, e.x]);
    const door = b.state.sides[0].hq!.doorX;
    expect(out.sort()).toEqual([
      ['rifle', 3000 - 150 - POINT_RULES.deployBehind],
      ['sapper', door],
    ]);
  });

  it('falls back to the HQ while the point is contested, and obeys an explicit choice', () => {
    const m = pointField([P({ owner: 0 }), P({ id: 'P2', x: 2000, owner: 0 })], [], [{ kind: 'rifle', count: 1, x: 3400, leash: 0 }], { a: { supplies: 500 } });
    const b = makeBattle({ mission: m });
    for (const u of unitsOf(b, 1)) u.invincible = true;
    run(b, 0.1);
    // P1 is contested: the next one back.
    expect(b.state.sides[0].deployPoint).toBe(1);
    b.command(0, { type: 'deploy', at: 'hq' });
    run(b, 0.1);
    expect(b.state.sides[0].deploy).toBe(DEPLOY_HQ);
    expect(b.state.sides[0].deployPoint).toBe(-1);
    b.command(0, { type: 'train', kind: 'rifle' });
    expect(trained(b, 0, 20)).toEqual([b.state.sides[0].hq!.doorX]);
    b.command(0, { type: 'deploy', at: 1 });
    run(b, 0.1);
    expect(b.state.sides[0].deployPoint).toBe(1);
    // Asking for the contested one keeps the wish but uses the best available meanwhile.
    b.command(0, { type: 'deploy', at: 0 });
    run(b, 0.1);
    expect(b.state.sides[0].deploy).toBe(0);
    expect(b.state.sides[0].deployPoint).toBe(1);
  });

  it('is what the AI does: it deploys at its forward-most safe point', () => {
    const m = pointField([P({ x: 3600, owner: 1 })], [], [], { b: { supplies: 400 } });
    const b = makeBattle({ mission: m, commanders: ['idle', 'ai'] });
    const xs = trained(b, 1, 60);
    expect(xs.length).toBeGreaterThan(0);
    for (const x of xs) expect(x).toBe(3600 + 150);
  });
});

describe('the hold line and rally Fall Back', () => {
  it('holds at the forward-most owned point, unless a trench in or ahead of its zone is the stronger line', () => {
    const b = makeBattle({ mission: pointField([P({ owner: 0 })], [{ kind: 'rifle', count: 4 }]) });
    expect(b.state.sides[0].holdLineX).toBe(3000);
    run(b, 40);
    for (const u of unitsOf(b, 0, 'rifle')) expect(Math.abs(u.x - 3000)).toBeLessThanOrEqual(150 + 1e-6);
    const trench = { id: 1, x: 3100, width: 160, slots: 6, owner: 0 as const };
    const t = makeBattle({ mission: pointField([P({ owner: 0 })], [], [], { trenches: [trench] }) });
    expect(t.state.sides[0].holdLineX).toBe(3100);
    const rear = { ...trench, x: 2000 };
    const r = makeBattle({ mission: pointField([P({ owner: 0 })], [{ kind: 'rifle', count: 2, trenchId: 1 }], [], { trenches: [rear] }) });
    expect(r.state.sides[0].holdLineX).toBe(3000);
    // Men in the rear trench leave it to hold the point.
    run(r, 30);
    for (const u of unitsOf(r, 0, 'rifle')) expect(u.trenchId).toBe(-1);
  });

  it('sends men far from the HQ to the nearest rally point behind them, and men near it into the HQ', () => {
    const near = 220 + POINT_RULES.rallyHqReach - 400;
    const m = pointField([P({ x: 3500, owner: 0 })], [
      { kind: 'rifle', count: 1, x: 5000 },
      { kind: 'rifle', count: 1, x: near },
    ]);
    const b = makeBattle({ mission: m });
    const [farMan, nearMan] = unitsOf(b, 0, 'rifle');
    b.command(0, { type: 'order', order: 'fallBack' });
    run(b, 30);
    expect(nearMan.inside).toBe(true);
    expect(farMan.inside).toBe(false);
    expect(farMan.rally).toBe(0);
    expect(Math.abs(farMan.x - 3500)).toBeLessThanOrEqual(150 + 1e-6);
    // Hold again: the rally is forgotten.
    b.command(0, { type: 'order', order: 'hold' });
    run(b, 1);
    expect(farMan.rally).toBe(-1);
  });

  it('goes into the HQ when no rally point is behind (or the rally point is lost)', () => {
    const m = pointField([P({ x: 4500, owner: 0 })], [{ kind: 'rifle', count: 1, x: 4000 }]);
    const b = makeBattle({ mission: m });
    const man = unitsOf(b, 0, 'rifle')[0];
    b.command(0, { type: 'order', order: 'fallBack' });
    run(b, 50);
    expect(man.inside).toBe(true);
  });

  it('keeps every invariant and replays the same on a field of sectors and points (bot against AI)', () => {
    const m = field(
      [
        { from: 0, to: 1500, ground: 'snow' },
        { from: 1500, to: 2600, ground: 'forest' },
        { from: 2600, to: 3400, ground: 'rubble', heightBonus: 1.1 },
        { from: 3400, to: 6000, ground: 'slopeDown' },
      ],
      [{ kind: 'rifle', count: 3 }],
      [{ kind: 'rifle', count: 3 }],
      { capturePoints: [P({ x: 2400, owner: 0 }), P({ id: 'P2', x: 3700, owner: 1 })], a: { supplies: 300 }, b: { supplies: 300 } },
    );
    const one = makeBattle({ mission: m, commanders: ['bot', 'ai'], seed: 9 });
    const two = makeBattle({ mission: m, commanders: ['bot', 'ai'], seed: 9 });
    for (let i = 0; i < 8; i++) {
      run(one, 30, checkInvariants);
      run(two, 30);
      expect(snapshot(two)).toBe(snapshot(one));
      expect(JSON.stringify(two.state.points)).toBe(JSON.stringify(one.state.points));
    }
  });
});
