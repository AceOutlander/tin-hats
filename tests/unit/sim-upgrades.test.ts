/**
 * Quartermaster upgrades: the table in src/data/upgrades.ts and their effect on a battle. Each
 * effect kind must change the right stat of side 0 and leave side 1 alone.
 */
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/data/config';
import { DAMAGE } from '../../src/data/damage';
import type { SupportKind, UnitKind, UpgradeDef, UpgradeEffect } from '../../src/data/schema';
import { UNITS } from '../../src/data/units';
import { MEDALS } from '../../src/data/medals';
import { SUPPORTS, SUPPORT_KINDS } from '../../src/data/supports';
import { UPGRADE_LEVEL_MEDALS, UPGRADES, upgradableKinds, upgradableSupports } from '../../src/data/upgrades';
import { WEAPONS } from '../../src/data/weapons';
import type { Battle } from '../../src/sim';
import { KIND_INDEX } from '../../src/sim/tables';
import { createSideMods, type SideMods, type World } from '../../src/sim/world';
import { collect, makeBattle, run, testMission, unitsOf, type Seen } from './sim-helpers';

const COMBAT: UnitKind[] = ['rifle', 'lmg', 'assault', 'mortar', 'sniper', 'medic', 'at', 'tank'];
const MAX = 3;
/** HQ health multiplier large enough that no HQ falls during a test. */
const FAR = 50;

function byId(id: string): UpgradeDef {
  const def = UPGRADES.find((u) => u.id === id);
  if (!def) throw new Error(`no upgrade ${id}`);
  return def;
}

function mul(def: UpgradeDef, level: number, stat: UpgradeEffect['stat']): number {
  const effect = def.levels[level - 1].find((e) => e.stat === stat);
  if (!effect) throw new Error(`${def.id} has no ${stat}`);
  return effect.mul;
}

function mods(b: Battle): [SideMods, SideMods] {
  return (b as unknown as World).mods;
}

/** Every multiplier of a SideMods, flattened with readable names. */
function flat(m: SideMods): Record<string, number> {
  const out: Record<string, number> = {
    sapperSpeed: m.sapperSpeed,
    sapperCarry: m.sapperCarry,
    hqIncome: m.hqIncome,
    hqHealth: m.hqHealth,
    hqGunDamage: m.hqGunDamage,
    hqGunRate: m.hqGunRate,
    income: m.income,
    airdrop: m.airdrop,
    wave: m.wave,
  };
  m.unitHealth.forEach((v, i) => (out[`unitHealth${i}`] = v));
  m.unitDamage.forEach((v, i) => (out[`unitDamage${i}`] = v));
  m.unitHeal.forEach((v, i) => (out[`unitHeal${i}`] = v));
  m.supportRate.forEach((v, i) => (out[`supportRate${i}`] = v));
  m.supportReach.forEach((v, i) => (out[`supportReach${i}`] = v));
  m.supportTime.forEach((v, i) => (out[`supportTime${i}`] = v));
  return out;
}

describe('the upgrade table', () => {
  it('has sapper drill, HQ income, health and gun, and a health and a damage (or healing) upgrade per combat unit', () => {
    const ids = UPGRADES.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ['sapperDrill', 'hqIncome', 'hqHealth', 'hqGun']) expect(byId(id).unit).toBeNull();
    for (const kind of COMBAT) {
      const own = UPGRADES.filter((u) => u.unit === kind);
      expect(own, kind).toHaveLength(2);
      const stats = own.flatMap((u) => u.levels[0].map((e) => e.stat)).sort();
      expect(stats, kind).toEqual(kind === 'medic' ? ['unitHeal', 'unitHealth'] : ['unitDamage', 'unitHealth']);
      for (const u of own) for (const level of u.levels) for (const e of level) expect('unit' in e && e.unit).toBe(kind);
    }
    // Four HQ and sapper upgrades, two per unit type the player can field, one per plane call-in in the Armoury.
    expect(UPGRADES).toHaveLength(4 + 2 * upgradableKinds().length + upgradableSupports().length);
  });

  it('gives every upgrade three levels at one price each (in medals), a name and a description, with modest growing effects', () => {
    for (const u of UPGRADES) {
      expect(u.levels, u.id).toHaveLength(MAX);
      expect(u.levelCosts, u.id).toEqual([...UPGRADE_LEVEL_MEDALS]);
      expect(u.name.length, u.id).toBeGreaterThan(3);
      expect(u.description.length, u.id).toBeGreaterThan(15);
      for (let l = 0; l < MAX; l++) {
        expect(u.levels[l].map((e) => e.stat), u.id).toEqual(u.levels[0].map((e) => e.stat));
        u.levels[l].forEach((e, i) => {
          const before = l === 0 ? 1 : u.levels[l - 1][i].mul;
          const step = e.mul / before - 1;
          expect(step, `${u.id} level ${l + 1} ${e.stat}`).toBeGreaterThanOrEqual(0.04);
          expect(step, `${u.id} level ${l + 1} ${e.stat}`).toBeLessThanOrEqual(0.13);
        });
      }
    }
  });
});

describe('upgrades in a battle', () => {
  it('apply each upgrade to exactly its own stats on side 0, never side 1, by default from UPGRADES', () => {
    const base = flat(createSideMods());
    for (const u of UPGRADES) {
      const b = makeBattle({ upgrades: { [u.id]: MAX } });
      const [m0, m1] = mods(b).map(flat);
      const expected = { ...base };
      for (const e of u.levels[MAX - 1]) {
        const key = 'unit' in e ? `${e.stat}${KIND_INDEX[e.unit]}` : 'support' in e ? `${e.stat}${SUPPORT_KINDS.indexOf(e.support)}` : e.stat;
        expected[key] = e.mul;
      }
      expect(m0, u.id).toEqual(expected);
      expect(m1, u.id).toEqual(base);
    }
  });

  it('ignore unknown ids, zero levels and levels past the top', () => {
    const top = makeBattle({ upgrades: { rifleHealth: 99, nonsense: 3, hqHealth: 0 } });
    expect(mods(top)[0].unitHealth[KIND_INDEX.rifle]).toBe(mul(byId('rifleHealth'), MAX, 'unitHealth'));
    expect(mods(top)[0].hqHealth).toBe(1);
    expect(makeBattle({ upgrades: { rifleHealth: 3 }, upgradeDefs: [] }).state.sides[0].hq?.maxHp).toBe(CONFIG.hqHp);
  });

  it('raise unit health and HQ health for side 0 only', () => {
    const forces = COMBAT.map((kind) => ({ kind, count: 1 }));
    const mission = testMission({ length: 8000, a: { forces }, b: { forces } });
    const levels: Record<string, number> = { hqHealth: 2 };
    for (const kind of COMBAT) levels[`${kind}Health`] = MAX;
    const b = makeBattle({ mission, upgrades: levels });
    for (const kind of COMBAT) {
      expect(unitsOf(b, 0, kind)[0].maxHp, kind).toBeCloseTo(UNITS[kind].hp * mul(byId(`${kind}Health`), MAX, 'unitHealth'), 9);
      expect(unitsOf(b, 1, kind)[0].maxHp, kind).toBe(UNITS[kind].hp);
    }
    expect(b.state.sides[0].hq?.maxHp).toBeCloseTo(CONFIG.hqHp * mul(byId('hqHealth'), 2, 'hqHealth'), 9);
    expect(b.state.sides[1].hq?.maxHp).toBe(CONFIG.hqHp);
  });

  it('raise unit damage and the HQ machine gun damage for side 0 only', () => {
    // Two riflemen of each side posted (guard) under the other side's HQ: rifles hit only the HQs
    // and the HQ guns hit only those riflemen, so every hit can be told apart.
    const mission = testMission({
      length: 3000,
      a: { forces: [{ kind: 'rifle', count: 2, x: 2550, behaviour: 'guard' }], hqHpMul: FAR },
      b: { forces: [{ kind: 'rifle', count: 2, x: 450, behaviour: 'guard' }], hqHpMul: FAR },
    });
    const b = makeBattle({ mission, upgrades: { rifleDamage: MAX, hqGun: MAX } });
    const hits = collect(b, 15, 'structureHit', 'unitHit');
    const rifle = WEAPONS.rifle.damage * DAMAGE.bullet.hq;
    const gun = WEAPONS[CONFIG.hqGunWeapon].damage * DAMAGE.bullet.infantryOpen;
    const expected: [string, 0 | 1, number][] = [
      ['structureHit', 1, rifle * mul(byId('rifleDamage'), MAX, 'unitDamage')],
      ['structureHit', 0, rifle],
      ['unitHit', 1, gun * mul(byId('hqGun'), MAX, 'hqGunDamage')],
      ['unitHit', 0, gun],
    ];
    for (const [type, side, value] of expected) {
      const these = hits.filter((e) => e.type === type && e.side === side);
      expect(these.length, `${type} on side ${side}`).toBeGreaterThan(0);
      for (const e of these) expect(e.value, `${type} on side ${side}`).toBeCloseTo(value, 9);
    }
  });

  it('speed up and load up sappers, and raise passive HQ income, for side 0 only', () => {
    const mission = testMission({ a: { sappers: 1 }, b: { sappers: 1 } });
    const drill = byId('sapperDrill');
    const b = makeBattle({ mission, upgrades: { sapperDrill: MAX, hqIncome: MAX } });
    const deliveries = collect(b, 40, 'supplyDelivered');
    const ours = deliveries.filter((e) => e.side === 0);
    const theirs = deliveries.filter((e) => e.side === 1);
    expect(ours[0].value).toBeCloseTo(CONFIG.sapperCarry * mul(drill, MAX, 'sapperCarry'), 9);
    expect(theirs[0].value).toBe(CONFIG.sapperCarry);
    // The faster sapper makes its first round trip sooner.
    expect(ours[0].time).toBeLessThan(theirs[0].time);
    const passive = (side: 0 | 1): number => b.state.sides[side].stats.suppliesGathered - deliveries.filter((e) => e.side === side).reduce((a, e) => a + e.value, 0);
    expect(passive(0)).toBeCloseTo(CONFIG.hqIncomePerSec * 40 * mul(byId('hqIncome'), MAX, 'hqIncome'), 4);
    expect(passive(1)).toBeCloseTo(CONFIG.hqIncomePerSec * 40, 4);
  });

  it('make medics heal faster for side 0 only', () => {
    // Both sides stand in their starting formation, each medic within reach of its rifleman.
    const forces = [
      { kind: 'rifle' as const, count: 1 },
      { kind: 'medic' as const, count: 1 },
    ];
    const b = makeBattle({ mission: testMission({ length: 3000, a: { forces }, b: { forces } }), upgrades: { medicHealing: MAX } });
    const patients = [unitsOf(b, 0, 'rifle')[0], unitsOf(b, 1, 'rifle')[0]];
    for (const p of patients) p.hp = 10;
    run(b, 1);
    expect(patients[0].hp).toBeCloseTo(10 + UNITS.medic.healRate * mul(byId('medicHealing'), MAX, 'unitHeal'), 6);
    expect(patients[1].hp).toBeCloseTo(10 + UNITS.medic.healRate, 6);
  });
});

/** The ids of the hand-written table the generated one replaced, in their order: saved levels are keyed by them. */
const LEGACY_IDS = [
  'sapperDrill',
  'hqIncome',
  'hqHealth',
  'hqGun',
  'rifleHealth',
  'rifleDamage',
  'lmgHealth',
  'lmgDamage',
  'assaultHealth',
  'assaultDamage',
  'mortarHealth',
  'mortarDamage',
  'sniperHealth',
  'sniperDamage',
  'medicHealth',
  'medicHealing',
  'atHealth',
  'atDamage',
  'tankHealth',
  'tankDamage',
];

/** Every unit type the player can field (MEDALS.units), sappers left out. */
function buyableKinds(): UnitKind[] {
  const kinds = MEDALS.units.map((u) => u.kind);
  return kinds.filter((k) => k !== 'sapper' && UNITS[k].trainable && !UNITS[k].enemyOnly);
}

function buyableSupports(): SupportKind[] {
  return MEDALS.armoury.map((i) => i.id);
}

describe('the generated upgrade tracks', () => {
  it('keep every pre-existing id, in its old place', () => {
    expect(UPGRADES.slice(0, LEGACY_IDS.length).map((u) => u.id)).toEqual(LEGACY_IDS);
    const ids = UPGRADES.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('give every buyable or free unit type a health track and a damage (or healing) track of three levels', () => {
    const kinds = buyableKinds();
    expect(kinds).toEqual(expect.arrayContaining(['apc', 'flame', 'commander', 'aa', ...COMBAT]));
    expect(upgradableKinds()).toEqual(kinds);
    for (const kind of kinds) {
      const own = UPGRADES.filter((u) => u.unit === kind);
      const health = own.filter((u) => u.levels[0].some((e) => e.stat === 'unitHealth'));
      const second = own.filter((u) => u.levels[0].some((e) => e.stat === (kind === 'medic' ? 'unitHeal' : 'unitDamage')));
      expect(health, kind).toHaveLength(1);
      expect(second, kind).toHaveLength(1);
      for (const u of [...health, ...second]) {
        expect(u.levels, u.id).toHaveLength(3);
        expect(u.levelCosts, u.id).toEqual([...UPGRADE_LEVEL_MEDALS]);
      }
      // The same multipliers as the original units' tracks.
      expect(health[0].levels.map((l) => l[0].mul), kind).toEqual(byId('rifleHealth').levels.map((l) => l[0].mul));
      if (kind !== 'medic') expect(second[0].levels.map((l) => l[0].mul), kind).toEqual(byId('rifleDamage').levels.map((l) => l[0].mul));
    }
    // Enemy-only types never get a track.
    for (const kind of Object.keys(UNITS) as UnitKind[]) {
      if (UNITS[kind].enemyOnly) expect(UPGRADES.some((u) => u.unit === kind), kind).toBe(false);
    }
  });

  it('give every plane call-in sold in the Armoury one track of three levels', () => {
    const kinds = buyableSupports();
    expect(kinds).toEqual(expect.arrayContaining(['bomber', 'fighter', 'recon']));
    expect(upgradableSupports()).toEqual(kinds);
    for (const kind of kinds) {
      const own = UPGRADES.filter((u) => u.support === kind);
      expect(own, kind).toHaveLength(1);
      expect(own[0].unit).toBeNull();
      expect(own[0].levels).toHaveLength(3);
      for (const level of own[0].levels) for (const e of level) expect('support' in e && e.support).toBe(kind);
    }
    expect(byId('bomberTurnaround').levels[0].map((e) => e.stat)).toEqual(['supportRate']);
    expect(byId('fighterTurnaround').levels[0].map((e) => e.stat)).toEqual(['supportRate']);
    expect(byId('reconOptics').levels[0].map((e) => e.stat)).toEqual(['supportReach', 'supportTime']);
  });
});

describe('the new unit tracks in a battle', () => {
  const NEW: UnitKind[] = ['apc', 'flame', 'commander', 'aa'];

  it('raise the new units health for side 0 only', () => {
    const forces = NEW.map((kind) => ({ kind, count: 1 }));
    const mission = testMission({ length: 8000, units: [['sapper', 'rifle', ...NEW], ['sapper', 'rifle', ...NEW]], a: { forces }, b: { forces } });
    const levels: Record<string, number> = {};
    for (const kind of NEW) levels[`${kind}Health`] = MAX;
    const b = makeBattle({ mission, upgrades: levels });
    for (const kind of NEW) {
      expect(unitsOf(b, 0, kind)[0].maxHp, kind).toBeCloseTo(UNITS[kind].hp * mul(byId(`${kind}Health`), MAX, 'unitHealth'), 9);
      expect(unitsOf(b, 1, kind)[0].maxHp, kind).toBe(UNITS[kind].hp);
    }
  });

  it('raise the damage of the new units (the Lieutenant his own revolver) for side 0 only, the same on every run', () => {
    for (const kind of NEW) {
      // Each side's unit stands in reach of an enemy medic (unarmed, so nothing shoots back at it): hits on the
      // medics tell the two sides' damage apart.
      const mission = testMission({
        length: 3000,
        units: [
          ['rifle', 'medic', kind],
          ['rifle', 'medic', kind],
        ],
        a: {
          forces: [
            { kind, count: 1, x: 1400, behaviour: 'guard' },
            { kind: 'medic', count: 1, x: 1580, behaviour: 'guard' },
          ],
          hqHpMul: FAR,
        },
        b: {
          forces: [
            { kind, count: 1, x: 1700, behaviour: 'guard' },
            { kind: 'medic', count: 1, x: 1520, behaviour: 'guard' },
          ],
          hqHpMul: FAR,
        },
      });
      const hits = (): number[][] => {
        const b = makeBattle({ mission, upgrades: { [`${kind}Damage`]: MAX } });
        const all = collect(b, 20, 'unitHit').filter((e) => e.kind === 'medic');
        // side = the side of the medic hit: [hits by side 1, hits by side 0].
        return [0, 1].map((side) => all.filter((e) => e.side === side).map((e) => e.value));
      };
      const [onOurs, onTheirs] = hits();
      expect(onTheirs.length, kind).toBeGreaterThan(0);
      expect(onOurs.length, kind).toBeGreaterThan(0);
      expect(Math.max(...onTheirs) / Math.max(...onOurs), kind).toBeCloseTo(mul(byId(`${kind}Damage`), MAX, 'unitDamage'), 6);
      expect(hits(), `${kind} deterministic`).toEqual([onOurs, onTheirs]);
    }
  });

  it('leave the Lieutenant aura at its data value whatever his damage level', () => {
    const b = makeBattle({ upgrades: { commanderDamage: MAX } });
    expect(mods(b)[0].unitDamage[KIND_INDEX.commander]).toBe(mul(byId('commanderDamage'), MAX, 'unitDamage'));
    expect(UNITS.commander.aura?.damageMul).toBe(1.05);
    expect(byId('commanderDamage').levels.flat().every((e) => e.stat === 'unitDamage')).toBe(true);
  });
});

describe('call-in tracks in a battle', () => {
  const field = (): ReturnType<typeof testMission> =>
    testMission({
      length: 7000,
      supports: [
        ['bomber', 'fighter', 'recon'],
        ['bomber', 'fighter', 'recon'],
      ],
      a: { supplies: 5000, hqHpMul: FAR },
      b: { supplies: 5000, hqHpMul: FAR },
    });

  it('shorten the bomber and fighter cooldowns of side 0 only', () => {
    for (const kind of ['bomber', 'fighter'] as const) {
      const def = byId(`${kind}Turnaround`);
      const b = makeBattle({ mission: field(), upgrades: { [def.id]: MAX } });
      const full = SUPPORTS[kind].cooldown / mul(def, MAX, 'supportRate');
      expect(b.state.sides[0].supportCooldownFull[kind]).toBeCloseTo(full, 9);
      expect(b.state.sides[1].supportCooldownFull[kind]).toBe(SUPPORTS[kind].cooldown);
      b.command(0, { type: 'support', kind, x: 3500 });
      b.command(1, { type: 'support', kind, x: 3500 });
      run(b, 1);
      expect(b.state.sides[0].supportCooldown[kind]).toBeCloseTo(full - 1, 6);
      expect(b.state.sides[1].supportCooldown[kind]).toBeCloseTo(SUPPORTS[kind].cooldown - 1, 6);
    }
  });

  it('widen the recon reveal and make it last longer for side 0 only, the same on every run', () => {
    const def = byId('reconOptics');
    const reveals = (): Seen[] => {
      const b = makeBattle({ mission: field(), upgrades: { reconOptics: MAX } });
      b.command(0, { type: 'support', kind: 'recon', x: 3500 });
      b.command(1, { type: 'support', kind: 'recon', x: 3500 });
      return collect(b, 10, 'reconReveal');
    };
    const seen = reveals();
    const ours = seen.filter((e) => e.side === 0);
    const theirs = seen.filter((e) => e.side === 1);
    expect(ours).toHaveLength(1);
    expect(theirs).toHaveLength(1);
    expect(ours[0].value).toBeCloseTo(SUPPORTS.recon.spread * mul(def, MAX, 'supportReach'), 9);
    expect(ours[0].x2).toBeCloseTo(SUPPORTS.recon.duration * mul(def, MAX, 'supportTime'), 9);
    expect(theirs[0].value).toBe(SUPPORTS.recon.spread);
    expect(theirs[0].x2).toBe(SUPPORTS.recon.duration);
    expect(reveals()).toEqual(seen);
  });
});
