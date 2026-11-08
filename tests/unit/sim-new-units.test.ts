/**
 * The job-7 units and aircraft in the sim: hit-facing armour, the commander's aura and speech,
 * the flamethrower's flush and fuel tank, the APC's carry and unload, aircraft passes, anti-aircraft
 * fire, recon, money costs, veterans, the boss warning, and determinism with all of them in play.
 */
import { describe, expect, it } from 'vitest';
import { CONFIG, SPECIALS } from '../../src/data/config';
import type { ForceDef, UnitKind } from '../../src/data/schema';
import { SUPPORTS, SUPPORT_COST } from '../../src/data/supports';
import { UNITS } from '../../src/data/units';
import { WEAPONS } from '../../src/data/weapons';
import type { Battle } from '../../src/sim';
import { KIND_COUNT, KIND_INDEX } from '../../src/sim/tables';
import { killUnit } from '../../src/sim/units';
import type { World } from '../../src/sim/world';
import { checkInvariants, collect, eventsOf, makeBattle, run, runUntil, testMission, unitsOf } from './sim-helpers';

const NEW_KINDS: UnitKind[] = ['apc', 'flame', 'commander', 'aa'];

function field(a: ForceDef[], b: ForceDef[], extra: Parameters<typeof testMission>[0] = {}) {
  return testMission({
    units: [['sapper', 'rifle', ...NEW_KINDS], ['sapper', 'rifle', ...NEW_KINDS]],
    supports: [
      ['bomber', 'fighter', 'recon'],
      ['bomber', 'fighter', 'recon'],
    ],
    ...extra,
    a: { forces: a, supplies: 3000, ...extra.a },
    b: { forces: b, supplies: 3000, ...extra.b },
  });
}

/** Damage of every unitHit / unitDied on `kind` over `seconds`, with the hit's travel direction. */
function hitsOn(b: Battle, seconds: number, kind: UnitKind): { value: number; dir: number }[] {
  const out: { value: number; dir: number }[] = [];
  run(b, seconds, () => {
    for (let i = 0; i < b.events.count; i++) {
      const e = b.events.items[i];
      if (e.type === 'unitHit' && e.kind === kind) out.push({ value: e.value, dir: e.dir });
    }
  });
  return out;
}

describe('hit-facing armour', () => {
  it('makes the King Tiger nearly proof from the front and weak from behind, by the side the shot comes from', () => {
    const rocket = WEAPONS.rocket.damage * 2; // antiTank x vehicle in the matrix
    const armour = UNITS.heavyTank.armour!;
    // Side 1's tank faces -x. Front: a team in front of it (lower x). Rear: a team past it.
    const front = makeBattle({
      mission: field([{ kind: 'at', count: 1, x: 3000, behaviour: 'guard' }], [{ kind: 'heavyTank', count: 1, x: 3250, behaviour: 'guard' }]),
    });
    const rear = makeBattle({
      mission: field([{ kind: 'at', count: 1, x: 3500, behaviour: 'guard' }], [{ kind: 'heavyTank', count: 1, x: 3250, behaviour: 'guard' }]),
    });
    const f = hitsOn(front, 6, 'heavyTank');
    const r = hitsOn(rear, 6, 'heavyTank');
    expect(f.length).toBeGreaterThan(0);
    expect(r.length).toBeGreaterThan(0);
    expect(unitsOf(front, 1, 'heavyTank')[0].facing).toBe(-1);
    expect(unitsOf(rear, 1, 'heavyTank')[0].facing).toBe(-1);
    expect(Math.max(...f.map((h) => h.value))).toBeCloseTo(rocket * armour.front, 6);
    expect(Math.max(...r.map((h) => h.value))).toBeCloseTo(rocket * armour.rear, 6);
    expect(armour.front).toBeLessThan(0.5);
    expect(armour.rear).toBeGreaterThan(1);
  });

  it('does not apply to bombs from above, and leaves vehicles without armour data alone', () => {
    const b = makeBattle({ mission: field([{ kind: 'rifle', count: 1, x: 600, behaviour: 'guard' }], [{ kind: 'heavyTank', count: 1, x: 3250, behaviour: 'guard' }]) });
    b.command(0, { type: 'support', kind: 'bomber', x: 3250 });
    const hits = hitsOn(b, 12, 'heavyTank');
    expect(hits.length).toBeGreaterThan(0);
    const bomb = WEAPONS.aerialBomb.damage * SUPPORTS.bomber.vehicleDamageMul * 0.5;
    for (const h of hits) expect(h.value).toBeLessThanOrEqual(bomb + 1e-6);
    expect(Math.max(...hits.map((h) => h.value))).toBeGreaterThan(bomb * UNITS.heavyTank.armour!.front);
    expect(UNITS.tank.armour).toBeUndefined();
  });
});

describe('the commander', () => {
  it('gives nearby friendly soldiers 5 percent more damage, not more with a second commander, and not out of range', () => {
    const rifle = WEAPONS.rifle.damage;
    const damageWith = (commanders: ForceDef[]): number[] => {
      const b = makeBattle({
        mission: field([{ kind: 'rifle', count: 1, x: 3000, behaviour: 'guard' }, ...commanders], [{ kind: 'heavyTank', count: 0, x: 3300 }, { kind: 'rifle', count: 1, x: 3250, behaviour: 'guard' }]),
      });
      return hitsOn(b, 8, 'rifle')
        .filter((h) => h.dir === 1)
        .map((h) => h.value);
    };
    const none = damageWith([]);
    const one = damageWith([{ kind: 'commander', count: 1, x: 2900, behaviour: 'guard' }]);
    const two = damageWith([{ kind: 'commander', count: 2, x: 2900, behaviour: 'guard' }]);
    const far = damageWith([{ kind: 'commander', count: 1, x: 3000 - UNITS.commander.aura!.radius - 50, behaviour: 'guard' }]);
    expect(none[0]).toBeCloseTo(rifle, 9);
    expect(one[0]).toBeCloseTo(rifle * 1.05, 9);
    expect(two[0]).toBeCloseTo(rifle * 1.05, 9);
    expect(far[0]).toBeCloseTo(rifle, 9);
  });

  it('is one per side: training refuses a second while one is alive or queued', () => {
    const b = makeBattle({ mission: field([], []) });
    b.command(0, { type: 'train', kind: 'commander' });
    b.command(0, { type: 'train', kind: 'commander' });
    run(b, 0.1);
    expect(b.state.sides[0].queue.commander).toBe(1);
    runUntil(b, 30, () => unitsOf(b, 0, 'commander').length === 1);
    b.command(0, { type: 'train', kind: 'commander' });
    run(b, 0.1);
    expect(b.state.sides[0].queue.commander).toBe(0);
    expect(unitsOf(b, 0, 'commander')).toHaveLength(1);
  });

  it('speaks once per army-wide order change, for the AI as for the player, with a line index', () => {
    const b = makeBattle({
      mission: field([{ kind: 'commander', count: 1, x: 900, behaviour: 'guard' }], [{ kind: 'commander', count: 1, x: 5100, behaviour: 'guard' }]),
    });
    b.command(0, { type: 'order', order: 'advance' });
    b.command(1, { type: 'order', order: 'fallBack' });
    b.command(0, { type: 'order', order: 'advance' }); // no change: no second line
    const speech = collect(b, 0.2, 'speech');
    expect(speech).toHaveLength(2);
    expect(speech.map((e) => [e.side, e.order, e.kind])).toEqual([
      [0, 'advance', 'commander'],
      [1, 'fallBack', 'commander'],
    ]);
    for (const e of speech) expect(Number.isInteger(e.value) && e.value >= 0).toBe(true);
    // A kind's own order is not a speech; a side without a commander says nothing.
    b.command(0, { type: 'order', order: 'hold', kind: 'rifle' });
    expect(collect(b, 0.2, 'speech')).toHaveLength(0);
    const quiet = makeBattle({ mission: field([], []) });
    quiet.command(0, { type: 'order', order: 'advance' });
    expect(collect(quiet, 0.2, 'speech')).toHaveLength(0);
  });
});

describe('the flamethrower', () => {
  it('dies at once with an ignite and an explosion when a bullet hits his back', () => {
    // Side 0's flamethrower walks home (Fall Back) with his back to a rifleman of side 1.
    const b = makeBattle({ mission: field([{ kind: 'flame', count: 1, x: 3150 }], [{ kind: 'rifle', count: 4, x: 3300, behaviour: 'guard' }]) });
    b.command(0, { type: 'order', order: 'fallBack' });
    const events = collect(b, 10, 'ignite', 'unitDied', 'explosion', 'unitHit');
    const ignite = events.findIndex((e) => e.type === 'ignite');
    expect(ignite).toBeGreaterThanOrEqual(0);
    expect(events[ignite].kind).toBe('flame');
    expect(events[ignite + 1].type).toBe('unitDied');
    expect(events[ignite + 1].kind).toBe('flame');
    expect(events[ignite + 2].type).toBe('explosion');
    expect(events[ignite + 2].value).toBe(SPECIALS.igniteRadius);
    // No wound first: the first hit on him was the fatal one.
    expect(events.slice(0, ignite).some((e) => e.type === 'unitHit' && e.kind === 'flame')).toBe(false);
  });

  it('survives bullets from the front', () => {
    const b = makeBattle({ mission: field([{ kind: 'flame', count: 1, x: 3000, behaviour: 'guard' }], [{ kind: 'rifle', count: 1, x: 3250, behaviour: 'guard' }]) });
    const events = collect(b, 8, 'ignite', 'unitHit');
    expect(events.some((e) => e.type === 'unitHit' && e.kind === 'flame')).toBe(true);
    expect(events.some((e) => e.type === 'ignite')).toBe(false);
  });

  it('burns men out of their trench slots, and they stay out for a while', () => {
    const trenches = [{ id: 1, x: 3300, width: 130, slots: 4, owner: 1 as const }];
    const b = makeBattle({
      mission: field([{ kind: 'flame', count: 2, x: 3150, behaviour: 'guard' }], [{ kind: 'rifle', count: 4, trenchId: 1, behaviour: 'garrison' }], { trenches }),
    });
    expect(unitsOf(b, 1, 'rifle').every((u) => u.trenchId >= 0)).toBe(true);
    let flushed = false;
    run(b, 6, (bb) => {
      checkInvariants(bb);
      if (unitsOf(bb, 1, 'rifle').some((u) => u.trenchId < 0 && u.flushedUntil > bb.state.time)) flushed = true;
    });
    expect(flushed).toBe(true);
  });
});

describe('the APC', () => {
  it('takes on nearby infantry on Hold and unloads them near the front on Advance', () => {
    const b = makeBattle({
      mission: field(
        [
          { kind: 'apc', count: 1 },
          { kind: 'rifle', count: 6 },
        ],
        [{ kind: 'rifle', count: 2, x: 4600, behaviour: 'guard' }],
      ),
    });
    run(b, 3, checkInvariants);
    const apc = unitsOf(b, 0, 'apc')[0];
    expect(apc.passengers).toBe(UNITS.apc.carries);
    const aboard = unitsOf(b, 0, 'rifle').filter((u) => u.carrier === apc.index);
    expect(aboard).toHaveLength(UNITS.apc.carries!);
    for (const u of aboard) {
      expect(u.inside).toBe(true);
      expect(u.action).toBe('inside');
    }
    expect(b.state.sides[0].hq!.garrison).toBe(0);
    b.command(0, { type: 'order', order: 'advance' });
    const unload: { x: number; front: number; value: number }[] = [];
    let spawnedAfter = 0;
    run(b, 60, (bb) => {
      checkInvariants(bb);
      for (let i = 0; i < bb.events.count; i++) {
        const e = bb.events.items[i];
        if (e.type === 'apcUnload') unload.push({ x: e.x, front: 4600, value: e.value });
        if (e.type === 'unitSpawned' && unload.length > 0 && e.kind === 'rifle') spawnedAfter++;
      }
      // While aboard they ride with the carrier.
      for (const u of unitsOf(bb, 0, 'rifle')) if (u.carrier >= 0) expect(u.x).toBe(bb.state.units[u.carrier].x);
    });
    expect(unload).toHaveLength(1);
    expect(unload[0].value).toBe(UNITS.apc.carries);
    expect(spawnedAfter).toBe(UNITS.apc.carries);
    expect(unload[0].x).toBeGreaterThan(3000);
    expect(apc.passengers).toBe(0);
  });

  it('drives faster than a tank and shrugs off bullets', () => {
    expect(UNITS.apc.speed).toBeGreaterThan(UNITS.tank.speed);
    expect(UNITS.apc.class).toBe('vehicle');
    expect(WEAPONS.apcMg.targets).not.toContain('vehicle');
  });

  it('lets its passengers out alive when it is destroyed', () => {
    const b = makeBattle({ mission: field([{ kind: 'apc', count: 1 }, { kind: 'rifle', count: 2 }], [{ kind: 'at', count: 3, x: 1150, behaviour: 'guard' }]) });
    run(b, 0.5);
    const apc = unitsOf(b, 0, 'apc')[0];
    expect(apc.passengers).toBe(2);
    runUntil(b, 60, () => unitsOf(b, 0, 'apc').length === 0);
    expect(unitsOf(b, 0, 'apc')).toHaveLength(0);
    for (const u of unitsOf(b, 0, 'rifle')) expect(u.carrier).toBe(-1);
    checkInvariants(b);
  });
});

describe('aircraft and anti-aircraft guns', () => {
  it('cost money, start their cooldown, and cross the battle in one planePass with a duration', () => {
    const b = makeBattle({ mission: field([], []) });
    const before = b.state.sides[0].supplies;
    b.command(0, { type: 'support', kind: 'fighter', x: 3000 });
    const events = collect(b, 8, 'supportCalled', 'planePass', 'projectile');
    expect(SUPPORT_COST.fighter).toBeGreaterThan(0);
    expect(b.state.sides[0].supplies).toBeCloseTo(before - SUPPORT_COST.fighter + 8 * CONFIG.hqIncomePerSec, 6);
    expect(b.state.sides[0].supportCooldown.fighter).toBeGreaterThan(0);
    const pass = events.filter((e) => e.type === 'planePass');
    expect(pass).toHaveLength(1);
    expect(pass[0].support).toBe('fighter');
    expect(pass[0].dir).toBe(1);
    expect(pass[0].x2).toBeGreaterThan(pass[0].x);
    expect(pass[0].value).toBeGreaterThan(SUPPORTS.fighter.duration);
    expect(events.filter((e) => e.type === 'projectile' && e.weapon === 'strafeMg')).toHaveLength(SUPPORTS.fighter.rounds);
    // Not without the money.
    const poor = makeBattle({ mission: field([], [], { a: { supplies: SUPPORT_COST.bomber - 1 } }) });
    poor.command(0, { type: 'support', kind: 'bomber', x: 3000 });
    expect(collect(poor, 1, 'supportCalled')).toHaveLength(0);
  });

  it('anti-aircraft guns shoot at planes in reach and can bring one down (planeDown), ending its run', () => {
    const b = makeBattle({ mission: field([], [{ kind: 'aa', count: 4, x: 3300, behaviour: 'guard' }]) });
    b.command(0, { type: 'support', kind: 'bomber', x: 3200 });
    const events = collect(b, 12, 'planeDown', 'shot', 'projectile');
    const flak = events.filter((e) => e.type === 'shot' && e.kind === 'aa' && e.target === 'none');
    expect(flak.length).toBeGreaterThan(0);
    const down = events.filter((e) => e.type === 'planeDown');
    expect(down).toHaveLength(1);
    expect(down[0].side).toBe(0);
    expect(down[0].support).toBe('bomber');
    const bombs = events.filter((e) => e.type === 'projectile' && e.weapon === 'aerialBomb');
    expect(bombs.length).toBeLessThan(SUPPORTS.bomber.rounds);
  });

  it('recon reveals enemy health in a large radius for a while (reconReveal)', () => {
    const b = makeBattle({ mission: field([], []) });
    b.command(0, { type: 'support', kind: 'recon', x: 3500 });
    const reveal = collect(b, 10, 'reconReveal');
    expect(reveal).toHaveLength(1);
    expect(reveal[0]).toMatchObject({ side: 0, x: 3500, value: SUPPORTS.recon.spread, x2: SUPPORTS.recon.duration });
  });

  it('a recon plane driven off or shot down reveals nothing', () => {
    const b = makeBattle({ mission: field([], [{ kind: 'aa', count: 6, x: 3000, behaviour: 'guard' }]) });
    b.command(0, { type: 'support', kind: 'recon', x: 3300 });
    expect(collect(b, 10, 'reconReveal')).toHaveLength(0);
  });

  it('the AI answers enemy aircraft with anti-aircraft guns', () => {
    const mission = field([], [], { b: { supplies: 3000 }, ai: { sappers: 0, build: [{ kind: 'rifle', count: 2, after: 0 }], firstAttackAfter: 9999 } });
    const b = makeBattle({ mission, commanders: ['human', 'ai'] });
    b.command(0, { type: 'support', kind: 'recon', x: 5000 });
    let trained = false;
    run(b, 40, (bb) => {
      for (const e of eventsOf(bb, 'trainStarted')) if (e.side === 1 && e.kind === 'aa') trained = true;
    });
    expect(trained).toBe(true);
  });
});

describe('veterans and the King Tiger squad', () => {
  it('counts the living escort per side and kind, so the AI plans its army without it', () => {
    const b = makeBattle({ mission: field([], [{ kind: 'rifle', count: 3, x: 5000, behaviour: 'guard', veteran: true }, { kind: 'rifle', count: 2, x: 4800, behaviour: 'guard' }]) });
    const w = b as unknown as World;
    const slot = KIND_COUNT + KIND_INDEX.rifle;
    expect(w.escorts[slot]).toBe(3);
    expect(w.escorts[KIND_INDEX.rifle]).toBe(0);
    const [vet, , , plain] = unitsOf(b, 1, 'rifle');
    killUnit(w, plain, 0, 1, 0);
    expect(w.escorts[slot]).toBe(3);
    killUnit(w, vet, 0, 1, 0);
    expect(w.escorts[slot]).toBe(2);
    expect(b.state.sides[1].alive.rifle - w.escorts[slot]).toBe(1);
  });

  it('veteran escorts get config.veteran health and hit chance', () => {
    const b = makeBattle({ mission: field([], [{ kind: 'rifle', count: 2, x: 5000, behaviour: 'guard', veteran: true }, { kind: 'rifle', count: 1, x: 4800, behaviour: 'guard' }]) });
    const [vet1, vet2, plain] = unitsOf(b, 1, 'rifle');
    for (const v of [vet1, vet2]) {
      expect(v.veteran).toBe(true);
      expect(v.maxHp).toBeCloseTo(UNITS.rifle.hp * CONFIG.veteran.hpMul, 9);
      expect(v.hp).toBe(v.maxHp);
      expect(v.accuracy).toBe(CONFIG.veteran.accuracyMul);
    }
    expect(plain.veteran).toBe(false);
    expect(plain.maxHp).toBe(UNITS.rifle.hp);
    expect(plain.accuracy).toBe(1);
  });

  it('the King Tiger entering the field raises bossArrived', () => {
    const b = makeBattle({ mission: field([], [{ kind: 'heavyTank', count: 1, x: 5000, behaviour: 'guard' }]) });
    const arrived = eventsOf(b, 'bossArrived');
    expect(arrived).toHaveLength(1);
    expect(arrived[0]).toMatchObject({ side: 1, kind: 'heavyTank' });
  });

  it('the player can train the new kinds where a mission lists them, but never the enemy-only tanks', () => {
    for (const k of NEW_KINDS) expect(UNITS[k].trainable, k).toBe(true);
    for (const k of ['lightTank', 'heavyTank'] as const) {
      expect(UNITS[k].trainable, k).toBe(false);
      expect(UNITS[k].enemyOnly, k).toBe(true);
    }
    const b = makeBattle({ mission: field([], []) });
    for (const k of NEW_KINDS) b.command(0, { type: 'train', kind: k });
    b.command(0, { type: 'train', kind: 'lightTank' });
    run(b, 0.1);
    for (const k of NEW_KINDS) expect(b.state.sides[0].queue[k], k).toBe(1);
    expect(b.state.sides[0].queue.lightTank).toBe(0);
  });

  it('the Panzer III is lighter, faster and weaker-gunned than the Panzer IV equivalent', () => {
    expect(UNITS.lightTank.hp).toBeLessThan(UNITS.tank.hp);
    expect(UNITS.lightTank.speed).toBeGreaterThan(UNITS.tank.speed);
    expect(WEAPONS.lightTankGun.damage).toBeLessThan(WEAPONS.tankGun.damage);
    expect(UNITS.heavyTank.speed).toBeLessThan(UNITS.tank.speed);
    expect(WEAPONS.heavyGun.range).toBeGreaterThan(WEAPONS.rocket.range);
    expect(WEAPONS.heavyGun.aimTime).toBeGreaterThan(WEAPONS.tankGun.aimTime);
  });
});

describe('determinism with the new units and aircraft', () => {
  function trace(seed: number): string {
    const forces: ForceDef[] = [
      { kind: 'apc', count: 1 },
      { kind: 'rifle', count: 6 },
      { kind: 'flame', count: 3 },
      { kind: 'commander', count: 1 },
      { kind: 'aa', count: 1 },
    ];
    const b = makeBattle({ seed, mission: field(forces, [...forces, { kind: 'heavyTank', count: 1, x: 5000, behaviour: 'guard' }]) });
    b.command(0, { type: 'order', order: 'advance' });
    b.command(1, { type: 'order', order: 'advance' });
    b.command(0, { type: 'support', kind: 'bomber', x: 4000 });
    b.command(1, { type: 'support', kind: 'fighter', x: 2000 });
    const out: string[] = [];
    run(b, 90, (bb) => {
      checkInvariants(bb);
      for (let i = 0; i < bb.events.count; i++) {
        const e = bb.events.items[i];
        if (e.type !== 'shot') out.push(`${bb.state.tick}:${e.type}:${e.side}:${e.unitId}:${e.x.toFixed(3)}:${e.value.toFixed(3)}`);
      }
    });
    return out.join('\n');
  }

  it('gives the same battle for the same seed, and another for another seed', () => {
    const one = trace(3);
    expect(trace(3)).toBe(one);
    expect(trace(4)).not.toBe(one);
  });
});
