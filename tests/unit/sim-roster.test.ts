import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/data/config';
import type { ForceDef, MissionDef, UnitKind, UpgradeDef } from '../../src/data/schema';
import { UNITS } from '../../src/data/units';
import { WEAPONS } from '../../src/data/weapons';
import type { Battle } from '../../src/sim';
import { checkInvariants, collect, eventsOf, makeBattle, run, runUntil, testMission, unitsOf, type Seen } from './sim-helpers';

const DT = 1 / CONFIG.tickRate;

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

/** A unit posted at x that holds there whatever the order and fires at whatever is in range. */
const posted = (kind: UnitKind, x: number, count = 1): ForceDef => ({ kind, count, x, behaviour: 'guard' });

/** Stationary side-1 sappers (a side with no HQ never moves them), `count` at a time every `every` seconds. */
function targets(shooters: ForceDef[], x: number, count = 1, every = 1.5, extra: Partial<MissionDef> = {}): MissionDef {
  return testMission({
    length: 3000,
    ...extra,
    a: { forces: shooters },
    b: { hasHq: false },
    events: [{ type: 'wave', when: { every, from: 0 }, side: 1, forces: [{ kind: 'sapper', count, x }] }],
  });
}

/** The aim point of the first shot a weapon of side 0 fires. */
function firstAim(b: Battle, weapon: string, seconds: number): number {
  const shot = collect(b, seconds, 'shot').find((e) => e.side === 0 && e.weapon === weapon);
  expect(shot).toBeDefined();
  return shot?.x2 ?? NaN;
}

describe('machine gun', () => {
  it('sets up (deploy) after it stops before it can aim, then fires bursts', () => {
    const mission = testMission({ length: 3000, a: { forces: [{ kind: 'lmg', count: 1 }] }, b: { hqHpMul: 50 } });
    const b = makeBattle({ mission, ...tough('lmg') });
    b.command(0, { type: 'order', order: 'advance' });
    let stopped = -1;
    let deployed = -1;
    let fired = -1;
    runUntil(b, 60, () => {
      const u = unitsOf(b, 0, 'lmg')[0];
      if (stopped < 0 && b.state.time > 1 && u.velX === 0) stopped = b.state.time;
      if (stopped >= 0 && deployed < 0 && u.action === 'deploy') deployed = b.state.time;
      if (fired < 0 && eventsOf(b, 'shot').some((e) => e.weapon === 'lmg')) fired = b.state.time;
      return fired >= 0;
    });
    const w = WEAPONS.lmg;
    expect(stopped).toBeGreaterThan(0);
    expect(deployed - stopped).toBeLessThanOrEqual(DT + 1e-9);
    expect(fired - stopped).toBeGreaterThanOrEqual(w.setupTime + w.aimTime - DT - 1e-9);
    expect(fired - stopped).toBeLessThanOrEqual(w.setupTime + w.aimTime + 3 * DT);
  });
});

describe('assault troops', () => {
  it('throw grenades at a trench: the throw action, then the release after throwReleaseTime', () => {
    const mission = testMission({
      length: 3000,
      trenches: [{ id: 1, x: 1400, width: 120, slots: 6, owner: 1 }],
      a: { forces: [{ kind: 'assault', count: 2 }] },
      b: { forces: [{ kind: 'rifle', count: 4, trenchId: 1 }] },
    });
    const b = makeBattle({ mission, ...tough('assault') });
    b.command(0, { type: 'order', order: 'advance' });
    const throwStart = new Map<number, number>();
    let releases = 0;
    const hits: Seen[] = [];
    run(b, 40, () => {
      for (const u of unitsOf(b, 0, 'assault')) if (u.action === 'throw' && u.actionTime === 0) throwStart.set(u.id, b.state.time);
      for (const e of eventsOf(b, 'projectile')) {
        if (e.weapon !== 'grenade') continue;
        releases++;
        // The grenade leaves the hand throwReleaseTime into this unit's latest throw.
        const start = throwStart.get(e.unitId) ?? -Infinity;
        expect(b.state.time - start).toBeGreaterThanOrEqual(CONFIG.throwReleaseTime - 1e-6);
        expect(b.state.time - start).toBeLessThanOrEqual(CONFIG.throwReleaseTime + DT + 1e-6);
        expect(unitsOf(b, 0, 'assault').find((u) => u.id === e.unitId)?.action).toBe('throw');
        // While the trench is held, that is where they go (afterwards the assault moves on to the HQ).
        if (b.state.trenches[0].occupants > 0) expect(Math.abs(e.x2 - 1400)).toBeLessThan(60 + 4 * WEAPONS.grenade.scatter);
      }
      hits.push(...eventsOf(b, 'unitHit').filter((e) => e.side === 1 && e.cause === 'explosive'));
    });
    expect(releases).toBeGreaterThan(0);
    expect(hits.length + b.state.sides[0].stats.kills).toBeGreaterThan(0);
  });

  it('keep their grenades for trenches, pillboxes and the HQ: never at men in the open, lone or bunched', () => {
    for (const count of [1, 4]) {
      const open = makeBattle({ mission: targets([{ kind: 'assault', count: 1 }], 1300, count, 30) });
      open.command(0, { type: 'order', order: 'advance' });
      const shots = collect(open, 20, 'shot');
      expect(shots.some((e) => e.weapon === 'smg')).toBe(true);
      expect(shots.some((e) => e.weapon === 'grenade')).toBe(false);
    }

    const box = makeBattle({
      mission: testMission({ length: 3000, a: { forces: [{ kind: 'assault', count: 1 }] }, pillboxes: [{ id: 1, x: 1300, side: 1, hpMul: 1 }] }),
      ...tough('assault'),
    });
    box.command(0, { type: 'order', order: 'advance' });
    const grenades = collect(box, 30, 'shot').filter((e) => e.weapon === 'grenade');
    expect(grenades.length).toBeGreaterThan(0);
    expect(grenades.every((e) => e.target === 'pillbox')).toBe(true);
  });
});

describe('mortars', () => {
  it('prefer pillboxes, trenches and clusters to a lone man in the open', () => {
    const lone: ForceDef = { kind: 'sapper', count: 1, x: 1000 };
    const pillbox = makeBattle({
      mission: testMission({
        length: 3000,
        a: { forces: [posted('mortar', 700)] },
        b: { hasHq: false, forces: [lone] },
        pillboxes: [{ id: 1, x: 1300, side: 1, hpMul: 1 }],
      }),
    });
    expect(firstAim(pillbox, 'mortar', 10)).toBe(1300);

    const trench = makeBattle({
      mission: testMission({
        length: 3000,
        a: { forces: [posted('mortar', 700)] },
        b: { forces: [{ ...lone, behaviour: 'guard' }, { kind: 'rifle', count: 2, trenchId: 1 }] },
        trenches: [{ id: 1, x: 1350, width: 120, slots: 6, owner: 1 }],
      }),
    });
    expect(Math.abs(firstAim(trench, 'mortar', 10) - 1350)).toBeLessThanOrEqual(60);

    const cluster = makeBattle({
      mission: testMission({
        length: 3000,
        a: { forces: [posted('mortar', 700)] },
        b: { hasHq: false, forces: [lone, { kind: 'sapper', count: 4, x: 1300 }] },
      }),
    });
    expect(firstAim(cluster, 'mortar', 10)).toBeGreaterThanOrEqual(1300);
  });

  it('and medics stay behind the line on Advance, never leading it', () => {
    const mission = testMission({
      length: 4000,
      a: { forces: [{ kind: 'rifle', count: 4 }, { kind: 'mortar', count: 1 }, { kind: 'medic', count: 1 }] },
      b: { hqHpMul: 50 },
    });
    const b = makeBattle({ mission, ...tough('rifle', 'mortar', 'medic') });
    b.command(0, { type: 'order', order: 'advance' });
    run(b, 60, () => {
      const front = Math.max(...unitsOf(b, 0, 'rifle').map((u) => u.x));
      for (const kind of ['mortar', 'medic'] as const) {
        for (const u of unitsOf(b, 0, kind)) expect(u.x).toBeLessThan(front);
      }
    });
    const front = Math.max(...unitsOf(b, 0, 'rifle').map((u) => u.x));
    const mortar = unitsOf(b, 0, 'mortar')[0];
    expect(mortar.x).toBeGreaterThan(b.state.sides[0].holdLineX + 500); // it did come forward
    expect(front - mortar.x).toBeGreaterThanOrEqual(UNITS.mortar.formationDepth - CONFIG.moveDeadband - 1e-6);
  });
});

describe('snipers', () => {
  it('pick off priority targets first', () => {
    const mission = testMission({
      length: 3000,
      a: { forces: [{ kind: 'sniper', count: 1 }] },
      b: { forces: [posted('rifle', 1150), posted('lmg', 1300)] },
    });
    const b = makeBattle({ mission });
    const events = collect(b, 30, 'shot', 'unitDied');
    expect(events.find((e) => e.weapon === 'sniperRifle')?.x2).toBe(1300);
    // The machine gunner, further away, falls first.
    expect(events.find((e) => e.type === 'unitDied' && e.side === 1)?.kind).toBe('lmg');
  });
});

describe('medics', () => {
  it('heal the most wounded man in reach, never above his maximum', () => {
    const mission = testMission({ length: 3000, a: { forces: [{ kind: 'rifle', count: 3 }, { kind: 'medic', count: 1 }] } });
    const b = makeBattle({ mission });
    const [worst, hurt, whole] = unitsOf(b, 0, 'rifle');
    const medic = unitsOf(b, 0, 'medic')[0];
    expect(Math.abs(worst.x - medic.x)).toBeLessThanOrEqual(UNITS.medic.healRange);
    expect(Math.abs(hurt.x - medic.x)).toBeLessThanOrEqual(UNITS.medic.healRange);
    worst.hp = 30;
    hurt.hp = 60;
    run(b, 1);
    expect(worst.hp).toBeCloseTo(30 + UNITS.medic.healRate, 6);
    expect(hurt.hp).toBe(60);
    expect(whole.hp).toBe(whole.maxHp);
    expect(medic.action).toBe('heal');
    expect(medic.aimX).toBe(worst.x);
    run(b, 20);
    for (const u of unitsOf(b, 0, 'rifle')) expect(u.hp).toBe(u.maxHp);
    expect(medic.action).toBe('idle');
  });
});

describe('anti-tank teams', () => {
  it('go for tanks first, then fortifications, before infantry', () => {
    const tank = makeBattle({
      mission: testMission({ length: 3000, a: { forces: [{ kind: 'at', count: 1 }] }, b: { forces: [posted('rifle', 1000), posted('tank', 1050)] } }),
      ...tough('at'),
    });
    expect(firstAim(tank, 'rocket', 10)).toBe(1050);

    const pillbox = makeBattle({
      mission: testMission({
        length: 3000,
        a: { forces: [{ kind: 'at', count: 1 }] },
        b: { forces: [posted('rifle', 1000)] },
        pillboxes: [{ id: 1, x: 1060, side: 1, hpMul: 1 }],
      }),
      ...tough('at'),
    });
    expect(firstAim(pillbox, 'rocket', 10)).toBe(1060);
  });

  it('beat a tank of the same cost', () => {
    const count = Math.round(UNITS.tank.cost / UNITS.at.cost);
    const mission = testMission({ length: 3000, a: { forces: [{ kind: 'tank', count: 1 }] }, b: { forces: [{ kind: 'at', count }] } });
    for (const seed of [1, 2, 3]) {
      const b = makeBattle({ mission, seed });
      b.command(0, { type: 'order', order: 'advance' });
      runUntil(b, 120, () => unitsOf(b, 0, 'tank').length === 0);
      expect(unitsOf(b, 0, 'tank')).toHaveLength(0);
      expect(unitsOf(b, 1, 'at').length).toBeGreaterThan(0);
    }
  });
});

describe('tanks', () => {
  it('beat infantry without anti-tank weapons of the same cost', () => {
    const count = Math.round(UNITS.tank.cost / UNITS.rifle.cost);
    const mission = testMission({ length: 3000, a: { forces: [{ kind: 'tank', count: 1 }] }, b: { forces: [{ kind: 'rifle', count }] } });
    for (const seed of [1, 2, 3]) {
      const b = makeBattle({ mission, seed });
      b.command(0, { type: 'order', order: 'advance' });
      const cleared = runUntil(b, 120, () => unitsOf(b, 1, 'rifle').length === 0);
      expect(cleared).toBe(true);
      const tank = unitsOf(b, 0, 'tank')[0];
      expect(tank).toBeDefined();
      expect(tank.hp).toBeGreaterThan(tank.maxHp / 2);
    }
  });

  it('fire the coaxial machine gun on the move and the main gun only when stopped', () => {
    const b = makeBattle({ mission: targets([{ kind: 'tank', count: 1 }], 1500, 1, 3) });
    b.command(0, { type: 'order', order: 'advance' });
    let coaxMoving = 0;
    let gun = 0;
    run(b, 30, () => {
      const tank = unitsOf(b, 0, 'tank')[0];
      for (const e of eventsOf(b, 'shot')) {
        if (e.unitId !== tank.id) continue;
        if (e.weapon === 'coaxMg' && tank.velX !== 0) coaxMoving++;
        if (e.weapon === 'tankGun') {
          gun++;
          expect(tank.velX).toBe(0);
        }
      }
    });
    expect(coaxMoving).toBeGreaterThan(0);
    expect(gun).toBeGreaterThan(0);
  });

  it('as guards ignore orders, chase what hurts them only within the leash, then go back to their post', () => {
    const post = 1450;
    const mission = testMission({
      length: 3000,
      a: { forces: [posted('mortar', 700)] },
      b: { hasHq: false, forces: [posted('heavyTank', post)] },
      events: [{ type: 'wave', when: { every: 2, from: 0, until: 60 }, side: 1, forces: [{ kind: 'sapper', count: 2, x: post - 30 }] }],
    });
    const b = makeBattle({ mission });
    b.command(1, { type: 'order', order: 'advance' });
    let nearest = post;
    run(b, 90, () => {
      checkInvariants(b);
      const tank = unitsOf(b, 1, 'heavyTank')[0];
      nearest = Math.min(nearest, tank.x);
    });
    const tank = unitsOf(b, 1, 'heavyTank')[0];
    expect(nearest).toBeLessThan(post - 100);
    expect(nearest).toBeGreaterThanOrEqual(post - CONFIG.guardLeash - 1e-6);
    expect(unitsOf(b, 0, 'mortar')).toHaveLength(0);
    expect(Math.abs(tank.x - post)).toBeLessThanOrEqual(CONFIG.moveDeadband);
  });
});
