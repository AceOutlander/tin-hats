import type { FactionId, SupportKind, UnitKind, UpgradeDef } from './schema';

/**
 * How Quartermaster upgrades look in battle. Each look track follows one upgrade's level (0 to 3) and names the
 * style drawn at that level, per nation, so a new nation only adds a row here (and its art styles). Unit health and
 * damage upgrades add small pieces of gear to that unit kind instead (GEAR_STEPS). Upgrades apply to the player's
 * side only; a side without upgrades (the enemy) is drawn at its nation's `enemy` stages, its established positions.
 */

/** Upgrade levels 0 (none bought) to 3. */
export type LookStage = 0 | 1 | 2 | 3;
export type Stages<T> = readonly [T, T, T, T];

/**
 * HQ building styles. Tent styles take the nation's canvas tint; the bunkers are one nation's own. The Red Army's four
 * (NATIONS.md section 3): a tent of buttoned rain capes, the zemlyanka (an earth-covered dugout), the log dugout under
 * a roof of three courses of logs, and the concrete DOT.
 */
export type HqStyle = 'tent' | 'bigTent' | 'dugout' | 'bunkerBritish' | 'bunkerGerman' | 'capeTent' | 'zemlyanka' | 'logDugout' | 'bunkerSoviet';
/** HQ machine-gun positions, drawn on the ground in front of the HQ (the gun model and helmets follow the nation). */
export type HqGunStyle = 'gunner' | 'emplacement' | 'tripod' | 'nest';
/** Supply dump styles. */
export type DumpStyle = 'crates' | 'stacked' | 'drums' | 'truck';
/** How sappers move supplies: a crate in the arms, a bigger load, a handcart, a small supply truck. */
export type SapperStyle = 'crate' | 'bigLoad' | 'handcart' | 'truck';

/**
 * Where a sapper's hands grip the handcart's handle, in wu from the figure's origin (on the ground between the feet,
 * +x = facing). The cart sprite's anchor is the ground point straight below its handle grip, so the renderer places the
 * cart at x = figure x + facing * x and on the ground line, and the figure's hands reach (x, y).
 */
export const SAPPER_CART_HANDLE = { x: 15, y: -30 } as const;

export type LookTrack = 'hq' | 'hqGun' | 'dump' | 'sapper';
export const LOOK_TRACKS: readonly LookTrack[] = ['hq', 'hqGun', 'dump', 'sapper'];

/** The Quartermaster upgrade (id in src/data/upgrades.ts) whose level picks each track's stage. */
export const LOOK_UPGRADE: Record<LookTrack, string> = {
  hq: 'hqHealth',
  hqGun: 'hqGun',
  dump: 'hqIncome',
  sapper: 'sapperDrill',
};

export interface NationLooks {
  hq: Stages<HqStyle>;
  hqGun: Stages<HqGunStyle>;
  dump: Stages<DumpStyle>;
  sapper: Stages<SapperStyle>;
  /** Stages drawn for a side that has no Quartermaster upgrades (the enemy). */
  enemy: Record<LookTrack, LookStage>;
}

export const NATION_LOOKS: Record<FactionId, NationLooks> = {
  british: {
    hq: ['tent', 'bigTent', 'dugout', 'bunkerBritish'],
    hqGun: ['gunner', 'emplacement', 'tripod', 'nest'],
    dump: ['crates', 'stacked', 'drums', 'truck'],
    sapper: ['crate', 'bigLoad', 'handcart', 'truck'],
    enemy: { hq: 3, hqGun: 3, dump: 2, sapper: 0 },
  },
  german: {
    hq: ['tent', 'bigTent', 'dugout', 'bunkerGerman'],
    hqGun: ['gunner', 'emplacement', 'tripod', 'nest'],
    dump: ['crates', 'stacked', 'drums', 'truck'],
    sapper: ['crate', 'bigLoad', 'handcart', 'truck'],
    // The Germans hold prepared positions: a concrete bunker, a fortified gun nest and a well-stocked dump.
    enemy: { hq: 3, hqGun: 3, dump: 2, sapper: 0 },
  },
  // Soviet stages (NATIONS.md section 3): rain-cape tent, zemlyanka, log dugout, concrete DOT.
  soviet: {
    hq: ['capeTent', 'zemlyanka', 'logDugout', 'bunkerSoviet'],
    hqGun: ['gunner', 'emplacement', 'tripod', 'nest'],
    dump: ['crates', 'stacked', 'drums', 'truck'],
    sapper: ['crate', 'bigLoad', 'handcart', 'truck'],
    enemy: { hq: 3, hqGun: 3, dump: 2, sapper: 0 },
  },
};

/** Gear pieces a unit kind's health and damage upgrades add. Level 0 is the unit's normal look. */
export type GearPiece = 'fullPack' | 'helmetNet' | 'helmetScrim' | 'fullPouches' | 'bandolier' | 'grenades';
/** Tank pieces: health adds armour on the hull, damage adds stowage and a better gun on the turret. */
export type TankGearPiece = 'trackLinks' | 'applique' | 'sandbags' | 'stowage' | 'cupolaMg' | 'longGun';

export type GearSource = 'health' | 'damage';

export interface GearStep<P> {
  piece: P;
  source: GearSource;
  /** Shown from this level of the source upgrade on. */
  level: 1 | 2 | 3;
}

/**
 * Infantry gear by upgrade level. A later piece of the same slot replaces an earlier one (helmet netting, then scrim
 * on the netting; full pouches, then grenades on the belt). The medic's healing upgrade counts as its damage track.
 */
export const GEAR_STEPS: readonly GearStep<GearPiece>[] = [
  { piece: 'fullPack', source: 'health', level: 1 },
  { piece: 'helmetNet', source: 'health', level: 2 },
  { piece: 'helmetScrim', source: 'health', level: 3 },
  { piece: 'fullPouches', source: 'damage', level: 1 },
  { piece: 'bandolier', source: 'damage', level: 2 },
  { piece: 'grenades', source: 'damage', level: 3 },
];

export const TANK_GEAR_STEPS: readonly GearStep<TankGearPiece>[] = [
  { piece: 'trackLinks', source: 'health', level: 1 },
  { piece: 'applique', source: 'health', level: 2 },
  { piece: 'sandbags', source: 'health', level: 3 },
  { piece: 'stowage', source: 'damage', level: 1 },
  { piece: 'cupolaMg', source: 'damage', level: 2 },
  { piece: 'longGun', source: 'damage', level: 3 },
];

/** A unit kind's two gear levels (0 to 3 each). */
export interface GearLevels {
  health: LookStage;
  damage: LookStage;
}

/** Every look a side shows: one stage per track and gear levels per unit kind. */
export interface SideLooks {
  faction: FactionId;
  stage: Record<LookTrack, LookStage>;
  gear: Partial<Record<UnitKind, GearLevels>>;
  /** Plane gear level per call-in (0 to 3). */
  support: Partial<Record<SupportKind, LookStage>>;
}

/**
 * Plane call-in gear, one piece per level of the call-in's upgrade (they add up): invasion stripes (British) or a
 * theatre band (German) round the rear fuselage, then a drop tank under the belly, then a painted nose and a row of
 * mission tallies under the cockpit. Positions per plane type are in src/data/looksGear.ts.
 */
export type PlaneGearPiece = 'stripes' | 'dropTank' | 'nose';

export const PLANE_GEAR_STEPS: readonly { piece: PlaneGearPiece; level: 1 | 2 | 3 }[] = [
  { piece: 'stripes', level: 1 },
  { piece: 'dropTank', level: 2 },
  { piece: 'nose', level: 3 },
];

/**
 * How an upgrade shows in battle: a look track (HQ, gun, dump, sappers), a unit's gear on its health or damage
 * source, or a call-in plane's gear. Every Quartermaster upgrade must have one, and each of its levels must look
 * different from the one before (tests/unit/upgrade-visuals.test.ts).
 */
export type UpgradeVisual =
  | { type: 'track'; track: LookTrack }
  | { type: 'gear'; unit: UnitKind; source: GearSource }
  | { type: 'plane'; support: SupportKind };

/** The call-ins that fly a plane the gear is drawn on. */
export const PLANE_SUPPORTS: readonly SupportKind[] = ['bomber', 'fighter', 'recon'];

/** The visual of one upgrade, from its data; null if it has none (a new kind of upgrade must add one here). */
export function upgradeVisual(def: UpgradeDef): UpgradeVisual | null {
  for (const t of LOOK_TRACKS) if (LOOK_UPGRADE[t] === def.id) return { type: 'track', track: t };
  if (def.support !== undefined) return PLANE_SUPPORTS.includes(def.support) ? { type: 'plane', support: def.support } : null;
  if (def.unit === null || def.unit === 'sapper') return null;
  const stats = def.levels[0] ?? [];
  // The medic's healing upgrade counts as his damage track.
  if (stats.some((e) => e.stat === 'unitHealth')) return { type: 'gear', unit: def.unit, source: 'health' };
  if (stats.some((e) => e.stat === 'unitDamage' || e.stat === 'unitHeal')) return { type: 'gear', unit: def.unit, source: 'damage' };
  return null;
}
