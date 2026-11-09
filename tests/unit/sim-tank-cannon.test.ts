/**
 * Tank cannon (owner's change 3, DECISIONS 424): a long reload, a hard hit by calibre, a blast that throws men in the
 * open and blows men dug in out of their slots, and heavy damage to fortifications.
 */
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/data/config';
import { OBSTACLES } from '../../src/data/obstacles';
import type { ForceDef, MissionDef } from '../../src/data/schema';
import { TANK_GUNS, vehicleGun } from '../../src/data/tankGuns';
import { UNITS } from '../../src/data/units';
import { WEAPONS } from '../../src/data/weapons';
import { LAUNCH, launch } from '../../src/sim/projectiles';
import { weaponIndex } from '../../src/sim/tables';
import type { World } from '../../src/sim/world';
import type { Battle } from '../../src/sim';
import { collect, makeBattle, run, testMission, unitsOf } from './sim-helpers';

const CANNON = ['gun20', 'lightTankGun', 'gun50L', 'tankGun', 'gun75L', 'heavyGun', 'gun152'] as const;
const posted = (kind: ForceDef['kind'], x: number, look?: ForceDef['look']): ForceDef => ({ kind, count: 1, x, behaviour: 'guard', ...(look ? { look } : {}) });

/** Nobody of side 0 on the field and no HQs, so only the rounds the test fires do anything. */
function quiet(over: Parameters<typeof testMission>[0] = {}, forces: ForceDef[] = []): MissionDef {
  return testMission({ length: 4000, ...over, a: { hasHq: false }, b: { hasHq: false, forces } });
}

/** Fire one round of `weapon` for side 0 so that it lands at x, then step until it has gone off. */
function shell(b: Battle, weapon: string, x: number): void {
  const w = b as unknown as World;
  LAUNCH[0] = x - 120;
  LAUNCH[1] = x;
  LAUNCH[2] = 1;
  LAUNCH[3] = 0;
  LAUNCH[4] = 1;
  LAUNCH[5] = 1;
  LAUNCH[6] = 0;
  expect(launch(w, 0, weaponIndex(weapon), 1, -1, null, 'none')).toBeGreaterThanOrEqual(0);
  for (let t = 0; t < CONFIG.tickRate && b.state.projectiles.some((p) => p.alive); t++) b.step();
  b.step();
}

describe('the cannon by calibre', () => {
  it('every tank gun but the 20 mm reloads slowly, hits hard, throws men and wrecks fortifications', () => {
    for (const id of CANNON) {
      const g = WEAPONS[id];
      expect(g.damageType, id).toBe('explosive');
      if (id === 'gun20') continue;
      expect(g.cooldown, id).toBeGreaterThanOrEqual(6);
      expect(g.damage, id).toBeGreaterThanOrEqual(100);
      expect(g.knockback, id).toBeGreaterThan(0);
      expect(g.fortMul, id).toBeGreaterThan(1);
    }
  });

  it('scales with calibre: the KV-2 152 mm hits hardest and reloads slowest, the T-60 20 mm stays a light autocannon', () => {
    const big = WEAPONS.gun152;
    for (const id of CANNON) {
      if (id === 'gun152') continue;
      expect(WEAPONS[id].damage, id).toBeLessThan(big.damage);
      expect(WEAPONS[id].cooldown, id).toBeLessThan(big.cooldown);
      expect(WEAPONS[id].splashRadius, id).toBeLessThan(big.splashRadius);
    }
    expect(WEAPONS.lightTankGun.damage).toBeLessThan(WEAPONS.tankGun.damage);
    expect(WEAPONS.tankGun.damage).toBeLessThan(WEAPONS.heavyGun.damage);
    const t60 = WEAPONS.gun20;
    expect(t60.knockback).toBe(0);
    expect(t60.fortMul).toBe(1);
    expect(t60.burst).toBeGreaterThan(1);
    expect(t60.splashRadius).toBeLessThan(WEAPONS.lightTankGun.splashRadius);
    // Every weapon that is no tank gun keeps the plain blast.
    for (const w of Object.values(WEAPONS)) if (!(CANNON as readonly string[]).includes(w.id)) expect([w.id, w.knockback, w.fortMul]).toEqual([w.id, 0, 1]);
  });

  it('each vehicle look carries its own gun; the others keep their kind`s, and the APC its machine gun', () => {
    expect(vehicleGun('heavyTank', 'kv2')).toBe('gun152');
    expect(vehicleGun('heavyTank', 'kv1')).toBe('tankGun');
    expect(vehicleGun('lightTank', 't60')).toBe('gun20');
    expect(vehicleGun('tank', 'panzer3l')).toBe('gun50L');
    expect(vehicleGun('tank', 'panzer4g')).toBe('gun75L');
    expect(vehicleGun('tank', 'stug3f')).toBe('gun75L');
    expect(vehicleGun('tank', 'panzer4')).toBe('tankGun');
    expect(vehicleGun('tank', 't34')).toBe('tankGun');
    expect(vehicleGun('heavyTank', 'kingTiger')).toBe('heavyGun');
    expect(vehicleGun('lightTank', 'bt7')).toBe('lightTankGun');
    expect(vehicleGun('apc', 'halftrack')).toBe(UNITS.apc.weapon);
    for (const id of Object.values(TANK_GUNS)) expect(WEAPONS[id as string], id).toBeDefined();
  });

  it('the sim arms a unit with its force look`s gun, or its era`s', () => {
    const b = makeBattle({
      mission: testMission({
        dateIso: '1942-09-01',
        units: [
          ['tank', 'heavyTank', 'lightTank'],
          ['tank', 'heavyTank', 'lightTank'],
        ],
        a: { faction: 'soviet', forces: [posted('heavyTank', 600, 'kv2'), posted('lightTank', 700)] },
        b: { forces: [posted('tank', 5400)] },
      }),
    });
    expect(unitsOf(b, 0, 'heavyTank')[0].mount.weapon?.id).toBe('gun152');
    expect(unitsOf(b, 0, 'lightTank')[0].mount.weapon?.id).toBe('gun20');
    // The German 1942 era's tank is the Panzer III Ausf. L with the long 5 cm.
    expect(unitsOf(b, 1, 'tank')[0].mount.weapon?.id).toBe('gun50L');
    // The coaxial machine guns are untouched.
    expect(unitsOf(b, 0, 'heavyTank')[0].mount2.weapon?.id).toBe('coaxMg');
  });
});

describe('the reload', () => {
  it('fires the main gun no faster than its reload, and the machine gun keeps firing in between', () => {
    const b = makeBattle({
      mission: testMission({
        length: 3000,
        a: { forces: [posted('tank', 700)] },
        b: { hasHq: false },
        events: [{ type: 'wave', when: { every: 1.5, from: 0 }, side: 1, forces: [{ kind: 'sapper', count: 2, x: 1000 }] }],
      }),
    });
    const shots = collect(b, 40, 'shot');
    const main = shots.filter((e) => e.weapon === 'tankGun').map((e) => e.time);
    expect(main.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < main.length; i++) expect(main[i] - main[i - 1]).toBeGreaterThanOrEqual(WEAPONS.tankGun.cooldown - 1e-6);
    const between = shots.filter((e) => e.weapon === 'coaxMg' && e.time > main[0] && e.time < main[1]);
    expect(between.length, 'machine-gun rounds between two main-gun shots').toBeGreaterThan(0);
  });

  it('shows its progress in weaponCharge: 0 just after a shot, back to 1 when ready', () => {
    // A side-0 tank close to one target: it fires, then reloads.
    const m = testMission({ length: 3000, a: { forces: [posted('tank', 700)] }, b: { hasHq: false, forces: [posted('sapper', 950)] } });
    const t = makeBattle({ mission: m });
    const charge: number[] = [];
    run(t, 14, () => charge.push(unitsOf(t, 0, 'tank')[0].weaponCharge));
    const low = charge.indexOf(Math.min(...charge));
    expect(charge[low]).toBeLessThan(0.05);
    // It climbs back steadily over the reload and reaches 1.
    expect(charge.slice(low).some((c) => c === 1)).toBe(true);
    const later = charge[low + Math.round((WEAPONS.tankGun.cooldown / 2) * CONFIG.tickRate)];
    expect(later).toBeGreaterThan(0.4);
    expect(later).toBeLessThan(0.6);
  });
});

describe('the blast', () => {
  it('hurts men inside the splash, throws men in the open out to twice its radius, and leaves the rest alone', () => {
    const g = WEAPONS.tankGun;
    const half = UNITS.sapper.width / 2;
    const x = 2000;
    const lethal = x + g.splashRadius / 2 + half;
    const thrown = x + g.splashRadius + 12 + half;
    const far = x + g.splashRadius * CONFIG.knockReach + 30 + half;
    const b = makeBattle({ mission: quiet({}, [posted('sapper', lethal), posted('sapper', thrown), posted('sapper', far), posted('sapper', x - 50)]) });
    const before = unitsOf(b, 1).map((u) => [u.id, u.x, u.hp] as const);
    shell(b, 'tankGun', x);
    run(b, 1);
    const at = (id: number) => b.state.units.find((u) => u.id === id)!;
    const [l, t, f, back] = before;
    // Inside the splash: wounded (or killed).
    expect(!at(l[0]).alive || at(l[0]).hp < l[2]).toBe(true);
    // Past the splash but within its reach: thrown away from the burst, unhurt.
    expect(at(t[0]).hp).toBe(t[2]);
    const expectedThrow = g.knockback * (1 - (thrown - half - x) / (g.splashRadius * CONFIG.knockReach));
    expect(at(t[0]).x - t[1]).toBeCloseTo(expectedThrow, 6);
    // The one on the other side is thrown the other way.
    expect(at(back[0]).x).toBeLessThan(back[1]);
    // Beyond the reach: untouched.
    expect(at(f[0]).x).toBe(f[1]);
    expect(at(f[0]).hp).toBe(f[2]);
  });

  it('does not throw vehicles, and a gun without knockback throws nobody', () => {
    const b = makeBattle({ mission: quiet({ units: [['tank'], ['tank', 'sapper']] }, [posted('tank', 2080), posted('sapper', 2000 + WEAPONS.mortar.splashRadius + 20)]) });
    const tank = unitsOf(b, 1, 'tank')[0];
    const sapper = unitsOf(b, 1, 'sapper')[0];
    const [tx, sx] = [tank.x, sapper.x];
    shell(b, 'heavyGun', 2000 - WEAPONS.heavyGun.splashRadius - 40);
    expect(tank.x).toBe(tx);
    shell(b, 'mortar', 2000);
    run(b, 0.5);
    expect(sapper.x).toBe(sx);
    expect(sapper.knock).toBe(0);
  });

  it('blows men in a trench near the burst out of their slots; men further off stay put', () => {
    const b = makeBattle({
      mission: quiet({ trenches: [{ id: 1, x: 2000, width: 220, slots: 8, owner: 1 }] }, [{ kind: 'rifle', count: 8, trenchId: 1, behaviour: 'garrison' }]),
    });
    run(b, 1);
    const men = unitsOf(b, 1, 'rifle').filter((u) => u.slot >= 0);
    expect(men.length).toBeGreaterThan(3);
    const x = Math.min(...men.map((u) => u.x));
    const g = WEAPONS.tankGun;
    shell(b, 'tankGun', x);
    const reach = g.splashRadius * CONFIG.knockReach * CONFIG.knockDugIn;
    for (const u of men) {
      if (!u.alive) continue;
      const d = Math.abs(u.x - x) - u.def.width / 2;
      if (d <= reach) expect(u.slot, `man ${d.toFixed(0)} wu from the burst`).toBe(-1);
    }
    expect(men.some((u) => u.alive && u.slot >= 0), 'men further down the trench keep their slots').toBe(true);
  });

  it('is deterministic', () => {
    const go = (): string => {
      const b = makeBattle({ mission: quiet({}, [posted('sapper', 2060), posted('rifle', 2090), posted('rifle', 1940)]) });
      shell(b, 'gun152', 2000);
      run(b, 1);
      return JSON.stringify(unitsOf(b, 1).map((u) => [u.id, u.alive, u.x, u.hp]));
    };
    expect(go()).toBe(go());
  });
});

describe('fortifications', () => {
  it('take fortMul times the blast: wire, road blocks and tank traps, pillboxes and building walls', () => {
    const g = WEAPONS.tankGun;
    const build = () =>
      makeBattle({
        mission: quiet({
          wire: [{ id: 1, x: 1000, width: 60, owner: 1 }],
          obstacles: [
            { id: 1, x: 1600, width: 40, owner: 1, kind: 'roadBlock' },
            { id: 2, x: 2200, width: 40, owner: 1, kind: 'tankTrap' },
          ],
          pillboxes: [{ id: 1, x: 2800, side: 1, hpMul: 3 }],
          buildings: [{ id: 1, x: 3400, width: 180, floors: 2, slotsPerFloor: 4, hpMul: 1, owner: 1, look: 'house' }],
        }),
      });
    const hit = (weapon: string) => {
      const b = build();
      const wire0 = b.state.wires[0].hp;
      const pill0 = b.state.pillboxes[0].hp;
      const house0 = b.state.buildings[0].hp;
      for (const x of [1000, 1600, 2200, 2800, 3400]) shell(b, weapon, x);
      return {
        wire: wire0 - b.state.wires[0].hp,
        block: OBSTACLES.kinds.roadBlock.hp - b.state.obstacles[0].hp,
        trap: OBSTACLES.kinds.tankTrap.hp - b.state.obstacles[1].hp,
        pill: pill0 - b.state.pillboxes[0].hp,
        house: house0 - b.state.buildings[0].hp,
      };
    };
    const tank = hit('tankGun');
    const mortar = hit('mortar');
    const ratio = (g.damage * g.fortMul) / WEAPONS.mortar.damage;
    expect(tank.block).toBeCloseTo(Math.min(OBSTACLES.kinds.roadBlock.hp, g.damage * g.fortMul * OBSTACLES.kinds.roadBlock.blastMul), 6);
    expect(tank.trap).toBeCloseTo(g.damage * g.fortMul * OBSTACLES.kinds.tankTrap.blastMul, 6);
    expect(tank.trap / mortar.trap).toBeCloseTo(ratio, 6);
    expect(tank.pill / mortar.pill).toBeCloseTo(ratio, 6);
    expect(tank.house / mortar.house).toBeCloseTo(ratio, 6);
    // The wire is gone in one round (its health is far below the blast).
    expect(tank.wire).toBeGreaterThanOrEqual(mortar.wire);
    // The road block too.
    expect(tank.block).toBe(OBSTACLES.kinds.roadBlock.hp);
  });
});
