import type { UnitKind, UpgradeDef, UpgradeEffect } from './schema';

/**
 * Quartermaster upgrades. Three levels each, one point per level, applied to the player's side
 * only when a battle is created. Each level lists its cumulative effect (level 2 replaces level 1),
 * so the multipliers below are totals: roughly +10% per level.
 */

/** Total multipliers at levels 1, 2 and 3. */
const HEALTH: readonly number[] = [1.1, 1.2, 1.3];
const DAMAGE: readonly number[] = [1.08, 1.16, 1.25];
const HEALING: readonly number[] = [1.12, 1.24, 1.36];
const SAPPER_SPEED: readonly number[] = [1.08, 1.16, 1.24];
const SAPPER_CARRY: readonly number[] = [1.1, 1.2, 1.3];
const HQ_INCOME: readonly number[] = [1.1, 1.2, 1.3];
const HQ_HEALTH: readonly number[] = [1.12, 1.24, 1.36];
const HQ_GUN_DAMAGE: readonly number[] = [1.08, 1.16, 1.25];
const HQ_GUN_RATE: readonly number[] = [1.05, 1.1, 1.15];

const POINTS_PER_LEVEL = 1;

function levels(build: (i: number) => UpgradeEffect[]): UpgradeEffect[][] {
  return [build(0), build(1), build(2)];
}

function unitHealth(id: string, unit: UnitKind, name: string, what: string): UpgradeDef {
  return {
    id,
    name,
    description: what,
    unit,
    levels: levels((i) => [{ stat: 'unitHealth', unit, mul: HEALTH[i] }]),
    costPerLevel: POINTS_PER_LEVEL,
  };
}

function unitDamage(id: string, unit: UnitKind, name: string, what: string): UpgradeDef {
  return {
    id,
    name,
    description: what,
    unit,
    levels: levels((i) => [{ stat: 'unitDamage', unit, mul: DAMAGE[i] }]),
    costPerLevel: POINTS_PER_LEVEL,
  };
}

/** In Quartermaster order: HQ and sapper upgrades first, then two per combat unit. */
export const UPGRADES: readonly UpgradeDef[] = [
  {
    id: 'sapperDrill',
    name: 'Sapper Drill',
    description: 'Sappers march faster and carry more per trip.',
    unit: null,
    levels: levels((i) => [
      { stat: 'sapperSpeed', mul: SAPPER_SPEED[i] },
      { stat: 'sapperCarry', mul: SAPPER_CARRY[i] },
    ]),
    costPerLevel: POINTS_PER_LEVEL,
  },
  {
    id: 'hqIncome',
    name: 'Requisition Orders',
    description: 'The HQ draws more supplies from the rear.',
    unit: null,
    levels: levels((i) => [{ stat: 'hqIncome', mul: HQ_INCOME[i] }]),
    costPerLevel: POINTS_PER_LEVEL,
  },
  {
    id: 'hqHealth',
    name: 'Sandbagged HQ',
    description: 'Extra sandbags and timber on the command post.',
    unit: null,
    levels: levels((i) => [{ stat: 'hqHealth', mul: HQ_HEALTH[i] }]),
    costPerLevel: POINTS_PER_LEVEL,
  },
  {
    id: 'hqGun',
    name: 'HQ Vickers Gun',
    description: 'A better-served HQ machine gun: it hits harder and fires faster.',
    unit: null,
    levels: levels((i) => [
      { stat: 'hqGunDamage', mul: HQ_GUN_DAMAGE[i] },
      { stat: 'hqGunRate', mul: HQ_GUN_RATE[i] },
    ]),
    costPerLevel: POINTS_PER_LEVEL,
  },
  unitHealth('rifleHealth', 'rifle', 'Rifleman Fieldcraft', 'Riflemen keep their heads down.'),
  unitDamage('rifleDamage', 'rifle', 'Rifleman Musketry', 'Riflemen train on the range until every round counts.'),
  unitHealth('lmgHealth', 'lmg', 'Bren Gun Pits', 'Bren gunners dig in faster and deeper.'),
  unitDamage('lmgDamage', 'lmg', 'Bren Gun Drill', 'Faster magazine changes and tighter bursts.'),
  unitHealth('assaultHealth', 'assault', 'Assault Conditioning', 'Assault Troopers are hardened by battle school.'),
  unitDamage('assaultDamage', 'assault', 'Close Quarter Battle', 'Assault Troopers hit harder with gun and grenade.'),
  unitHealth('mortarHealth', 'mortar', 'Mortar Pit Drill', 'Mortar crews site their pits under cover.'),
  unitDamage('mortarDamage', 'mortar', 'Mortar Ranging', 'Mortar crews bracket the target sooner.'),
  unitHealth('sniperHealth', 'sniper', 'Sniper Camouflage', 'Snipers use scrim and ghillie to stay alive.'),
  unitDamage('sniperDamage', 'sniper', 'Telescopic Sights', 'Better optics for the sniper rifle.'),
  unitHealth('medicHealth', 'medic', 'Medic Armbands', 'Medics learn to move between cover.'),
  {
    id: 'medicHealing',
    name: 'Field Dressings',
    description: 'Medics carry better kit and patch men up faster.',
    unit: 'medic',
    levels: levels((i) => [{ stat: 'unitHeal', unit: 'medic', mul: HEALING[i] }]),
    costPerLevel: POINTS_PER_LEVEL,
  },
  unitHealth('atHealth', 'at', 'PIAT Team Cover', 'PIAT teams stalk from better cover.'),
  unitDamage('atDamage', 'at', 'PIAT Bomb Drill', 'PIAT teams aim for the weak spots.'),
  unitHealth('tankHealth', 'tank', 'Appliqué Armour', 'Extra plates bolted to the Churchill.'),
  unitDamage('tankDamage', 'tank', 'Tank Gunnery School', 'Churchill crews lay their guns faster and truer.'),
];
