import { FACTIONS } from './factions';
import { MEDALS } from './medals';
import type { SupportKind, UnitKind, UpgradeDef, UpgradeEffect } from './schema';
import { GENERAL_UPGRADE_TEXT, UNIT_UPGRADE_TEXT, type TrackText } from './upgradeText';
import { UNITS } from './units';

/**
 * Quartermaster upgrades. Three levels each, bought with upgrade points, applied to the player's side
 * only when a battle is created. Each level lists its cumulative effect (level 2 replaces level 1),
 * so the multipliers below are totals: roughly +10% per level.
 *
 * The unit and call-in tracks are generated from the data: every unit type the player has for free or can unlock in
 * the Armoury (MEDALS.free, MEDALS.units) gets a health track and a damage track (a healing track for a unit that
 * heals instead of fighting), and every plane call-in (UPGRADABLE_SUPPORTS) gets one track. A new unit type or call-in
 * therefore gets its upgrades without a line here; src/data/upgradeText.ts gives them their names, per nation.
 * Saved levels are keyed by id: never rename an id (`${kind}Health`, `${kind}Damage`, `${kind}Healing` and
 * SUPPORT_TRACKS[kind].id, or `${kind}Upgrade` without one).
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
/** Call-ins: rate divides the cooldown (1.1, 1.2, 1.3 = 9%, 17% and 23% shorter), reach and time grow the effect. */
const SUPPORT_RATE: readonly number[] = [1.1, 1.2, 1.3];
const SUPPORT_REACH: readonly number[] = [1.1, 1.2, 1.3];
const SUPPORT_TIME: readonly number[] = [1.12, 1.24, 1.36];

/**
 * Price in upgrade points of level 1, 2 and 3 of every upgrade. Upgrade points are the Quartermaster's own currency
 * again (owner, 2026-11-09: Stick War: Legacy's economy, 1 point a level; MEDALS.points says how they are earned).
 */
export const UPGRADE_LEVEL_POINTS: readonly number[] = [1, 1, 1];

/** The call-ins with a Quartermaster track (the plane call-ins sold in the Armoury before version 11; ids are saved). */
export const UPGRADABLE_SUPPORTS: readonly SupportKind[] = ['recon', 'fighter', 'bomber'];

function levels(build: (i: number) => UpgradeEffect[]): UpgradeEffect[][] {
  return [build(0), build(1), build(2)];
}

/**
 * Names of the unit tracks: each unit type's British text (src/data/upgradeText.ts, where every nation has its own;
 * these are the upgrades' default words). A unit type missing there still gets its tracks, named after the unit.
 */
/** Unit types with Quartermaster tracks, in Quartermaster order: the free types, then MEDALS.units (data order). */
export function upgradableKinds(): UnitKind[] {
  const out: UnitKind[] = [];
  const kinds: UnitKind[] = [...MEDALS.free];
  for (const u of MEDALS.units) kinds.push(u.kind);
  for (const kind of kinds) {
    const def = UNITS[kind];
    // Sappers have Sapper Drill instead; enemy-only types are never the player's.
    if (kind === 'sapper' || def.enemyOnly === true || !def.trainable || out.includes(kind)) continue;
    out.push(kind);
  }
  return out;
}

/** Plane call-ins with a Quartermaster track, in the Armoury's order. */
export function upgradableSupports(): SupportKind[] {
  return [...UPGRADABLE_SUPPORTS];
}

/** True for a unit that heals instead of fighting: its second track is healing, not damage. */
function heals(kind: UnitKind): boolean {
  return !UNITS[kind].armed && UNITS[kind].healRate > 0;
}

function text(id: string, kind: UnitKind, what: string): TrackText {
  const own = UNIT_UPGRADE_TEXT.british[kind];
  if (own) return id === `${kind}Health` ? own.health : own.second;
  const name = FACTIONS.british.unitNames[kind];
  return { name: `${name} ${what}`, description: `Better training and kit for every ${name}.` };
}

/** The health track and the damage (or healing) track of one unit type. */
function unitTracks(kind: UnitKind): UpgradeDef[] {
  const healthId = `${kind}Health`;
  const health = text(healthId, kind, 'Toughness');
  const out: UpgradeDef[] = [
    {
      id: healthId,
      ...health,
      unit: kind,
      levels: levels((i) => [{ stat: 'unitHealth', unit: kind, mul: HEALTH[i] }]),
      costPerLevel: UPGRADE_LEVEL_POINTS[0],
      levelCosts: [...UPGRADE_LEVEL_POINTS],
    },
  ];
  if (heals(kind)) {
    const id = `${kind}Healing`;
    out.push({
      id,
      ...text(id, kind, 'Kit'),
      unit: kind,
      levels: levels((i) => [{ stat: 'unitHeal', unit: kind, mul: HEALING[i] }]),
      costPerLevel: UPGRADE_LEVEL_POINTS[0],
      levelCosts: [...UPGRADE_LEVEL_POINTS],
    });
  } else {
    const id = `${kind}Damage`;
    out.push({
      id,
      ...text(id, kind, 'Drill'),
      unit: kind,
      levels: levels((i) => [{ stat: 'unitDamage', unit: kind, mul: DAMAGE[i] }]),
      costPerLevel: UPGRADE_LEVEL_POINTS[0],
      levelCosts: [...UPGRADE_LEVEL_POINTS],
    });
  }
  return out;
}

/** What a call-in's track improves, in data. */
export interface SupportTrackDef {
  id: string;
  name: string;
  description: string;
  stats: readonly ('supportRate' | 'supportReach' | 'supportTime')[];
}

/** Per plane call-in. One missing here gets `${kind}Upgrade`: a shorter cooldown. */
export const SUPPORT_TRACKS: Partial<Record<SupportKind, SupportTrackDef>> = {
  recon: {
    id: 'reconOptics',
    ...GENERAL_UPGRADE_TEXT.british.reconOptics,
    stats: ['supportReach', 'supportTime'],
  },
  fighter: {
    id: 'fighterTurnaround',
    ...GENERAL_UPGRADE_TEXT.british.fighterTurnaround,
    stats: ['supportRate'],
  },
  bomber: {
    id: 'bomberTurnaround',
    ...GENERAL_UPGRADE_TEXT.british.bomberTurnaround,
    stats: ['supportRate'],
  },
};

const SUPPORT_MULS: Record<SupportTrackDef['stats'][number], readonly number[]> = {
  supportRate: SUPPORT_RATE,
  supportReach: SUPPORT_REACH,
  supportTime: SUPPORT_TIME,
};

function supportTrack(kind: SupportKind): UpgradeDef {
  const own = SUPPORT_TRACKS[kind];
  const name = FACTIONS.british.supportNames[kind];
  const t: SupportTrackDef = own ?? {
    id: `${kind}Upgrade`,
    name: `${name} Turnaround`,
    description: `The ${name} is ready to fly again sooner.`,
    stats: ['supportRate'],
  };
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    unit: null,
    support: kind,
    levels: levels((i) => t.stats.map((stat) => ({ stat, support: kind, mul: SUPPORT_MULS[stat][i] }))),
    costPerLevel: UPGRADE_LEVEL_POINTS[0],
    levelCosts: [...UPGRADE_LEVEL_POINTS],
  };
}

/** In Quartermaster order: HQ and sapper upgrades first, then two per unit type, then one per plane call-in. */
export const UPGRADES: readonly UpgradeDef[] = [
  {
    id: 'sapperDrill',
    ...GENERAL_UPGRADE_TEXT.british.sapperDrill,
    unit: null,
    levels: levels((i) => [
      { stat: 'sapperSpeed', mul: SAPPER_SPEED[i] },
      { stat: 'sapperCarry', mul: SAPPER_CARRY[i] },
    ]),
    costPerLevel: UPGRADE_LEVEL_POINTS[0],
    levelCosts: [...UPGRADE_LEVEL_POINTS],
  },
  {
    id: 'hqIncome',
    ...GENERAL_UPGRADE_TEXT.british.hqIncome,
    unit: null,
    levels: levels((i) => [{ stat: 'hqIncome', mul: HQ_INCOME[i] }]),
    costPerLevel: UPGRADE_LEVEL_POINTS[0],
    levelCosts: [...UPGRADE_LEVEL_POINTS],
  },
  {
    id: 'hqHealth',
    ...GENERAL_UPGRADE_TEXT.british.hqHealth,
    unit: null,
    levels: levels((i) => [{ stat: 'hqHealth', mul: HQ_HEALTH[i] }]),
    costPerLevel: UPGRADE_LEVEL_POINTS[0],
    levelCosts: [...UPGRADE_LEVEL_POINTS],
  },
  {
    id: 'hqGun',
    ...GENERAL_UPGRADE_TEXT.british.hqGun,
    unit: null,
    levels: levels((i) => [
      { stat: 'hqGunDamage', mul: HQ_GUN_DAMAGE[i] },
      { stat: 'hqGunRate', mul: HQ_GUN_RATE[i] },
    ]),
    costPerLevel: UPGRADE_LEVEL_POINTS[0],
    levelCosts: [...UPGRADE_LEVEL_POINTS],
  },
  ...upgradableKinds().flatMap(unitTracks),
  ...upgradableSupports().map(supportTrack),
];
