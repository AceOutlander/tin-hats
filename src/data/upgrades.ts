import { FACTIONS } from './factions';
import { MEDALS } from './medals';
import type { SupportKind, UnitKind, UpgradeDef, UpgradeEffect } from './schema';
import { UNITS } from './units';

/**
 * Quartermaster upgrades. Three levels each, bought with upgrade points, applied to the player's side
 * only when a battle is created. Each level lists its cumulative effect (level 2 replaces level 1),
 * so the multipliers below are totals: roughly +10% per level.
 *
 * The unit and call-in tracks are generated from the data: every unit type the player has for free or can unlock in
 * the Armoury (MEDALS.free, MEDALS.units) gets a health track and a damage track (a healing track for a unit that
 * heals instead of fighting), and every plane call-in (UPGRADABLE_SUPPORTS) gets one track. A new unit type or call-in
 * therefore gets its upgrades without a line here; UNIT_TRACK_TEXT and SUPPORT_TRACKS only give them their names.
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

/** Name and one-line text of one generated unit track. */
interface TrackText {
  name: string;
  description: string;
}

/**
 * Names of the unit tracks, by upgrade id. A unit type missing here still gets its tracks, named after the unit
 * (see unitTracks). The ids of the first eight units are those of the hand-written table they replaced.
 */
export const UNIT_TRACK_TEXT: Readonly<Record<string, TrackText>> = {
  rifleHealth: { name: 'Rifleman Fieldcraft', description: 'Riflemen keep their heads down.' },
  rifleDamage: { name: 'Rifleman Musketry', description: 'Riflemen train on the range until every round counts.' },
  lmgHealth: { name: 'Bren Gun Pits', description: 'Bren gunners dig in faster and deeper.' },
  lmgDamage: { name: 'Bren Gun Drill', description: 'Faster magazine changes and tighter bursts.' },
  assaultHealth: { name: 'Assault Conditioning', description: 'Assault Troopers are hardened by battle school.' },
  assaultDamage: { name: 'Close Quarter Battle', description: 'Assault Troopers hit harder with gun and grenade.' },
  mortarHealth: { name: 'Mortar Pit Drill', description: 'Mortar crews site their pits under cover.' },
  mortarDamage: { name: 'Mortar Ranging', description: 'Mortar crews bracket the target sooner.' },
  sniperHealth: { name: 'Sniper Camouflage', description: 'Snipers use scrim and ghillie to stay alive.' },
  sniperDamage: { name: 'Telescopic Sights', description: 'Better optics for the sniper rifle.' },
  medicHealth: { name: 'Medic Armbands', description: 'Medics learn to move between cover.' },
  medicHealing: { name: 'Field Dressings', description: 'Medics carry better kit and patch men up faster.' },
  atHealth: { name: 'PIAT Team Cover', description: 'PIAT teams stalk from better cover.' },
  atDamage: { name: 'PIAT Bomb Drill', description: 'PIAT teams aim for the weak spots.' },
  tankHealth: { name: 'Appliqué Armour', description: 'Extra plates bolted to the Churchill.' },
  tankDamage: { name: 'Tank Gunnery School', description: 'Churchill crews lay their guns faster and truer.' },
  apcHealth: { name: 'Carrier Armour', description: 'Spare track and sandbags turn more bullets off the Carrier.' },
  apcDamage: { name: 'Carrier Gunnery', description: 'More ammunition and a second gun for the Carrier crew.' },
  flameHealth: { name: 'Flamer Protection', description: 'Flamethrowers learn to work from cover in heat-proof kit.' },
  flameDamage: { name: 'Fuel Mixture', description: 'A thicker fuel that clings and burns hotter.' },
  commanderHealth: { name: 'Officer Training', description: 'The Lieutenant keeps low and leads from cover.' },
  commanderDamage: { name: 'Revolver Practice', description: 'The Lieutenant shoots straighter with his own revolver. His aura is unchanged.' },
  aaHealth: { name: 'Gun Pit Revetment', description: 'Bofors crews dig their gun pit deeper.' },
  aaDamage: { name: 'Predictor Drill', description: 'Bofors crews lead their targets and hit harder.' },
};

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
  const own = UNIT_TRACK_TEXT[id];
  if (own) return own;
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
    name: 'Long-Range Cameras',
    description: 'Better cameras and a longer loiter: the recon plane sees a wider area for longer.',
    stats: ['supportReach', 'supportTime'],
  },
  fighter: {
    id: 'fighterTurnaround',
    name: 'Fighter Turnaround',
    description: 'Ground crews rearm and refuel the fighters faster: the strafing run is ready sooner.',
    stats: ['supportRate'],
  },
  bomber: {
    id: 'bomberTurnaround',
    name: 'Bomber Turnaround',
    description: 'Faster bombing-up on the airfield: the bomber is ready to fly again sooner.',
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
    name: 'Sapper Drill',
    description: 'Sappers march faster and carry more per trip.',
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
    name: 'Requisition Orders',
    description: 'The HQ draws more money from the rear.',
    unit: null,
    levels: levels((i) => [{ stat: 'hqIncome', mul: HQ_INCOME[i] }]),
    costPerLevel: UPGRADE_LEVEL_POINTS[0],
    levelCosts: [...UPGRADE_LEVEL_POINTS],
  },
  {
    id: 'hqHealth',
    name: 'Sandbagged HQ',
    description: 'Extra sandbags and timber on the command post.',
    unit: null,
    levels: levels((i) => [{ stat: 'hqHealth', mul: HQ_HEALTH[i] }]),
    costPerLevel: UPGRADE_LEVEL_POINTS[0],
    levelCosts: [...UPGRADE_LEVEL_POINTS],
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
    costPerLevel: UPGRADE_LEVEL_POINTS[0],
    levelCosts: [...UPGRADE_LEVEL_POINTS],
  },
  ...upgradableKinds().flatMap(unitTracks),
  ...upgradableSupports().map(supportTrack),
];
