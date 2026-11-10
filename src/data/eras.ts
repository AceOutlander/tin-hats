/**
 * Era-correct forces by date (docs/campaigns/FOUNDATIONS.md 5.1): each nation's names and looks for the mission's date
 * and climate, as data. A mission with `dateIso` resolves, for each nation, the eras whose date range holds that date
 * and whose climate list (if any) holds the mission's climate; they merge over the nation's defaults (FACTIONS in
 * ./factions and the default looks), the first matching era winning each field, so the list is ordered most specific
 * first (a winter era ahead of the year's). A mission without `dateIso` (the proving ground,
 * Basic Training) gets every nation's defaults: today's names and looks, unchanged.
 *
 * Names and art only: stats stay mirrored by role (src/data/units.ts). ForceDef.look picks a vehicle variant or an
 * infantry look inside the era (a `kv2` among the KV-1s, a `stug3f` among the Panzer IIIs, the `romanian` look).
 * Service windows of every look are in ./equipment; tests/unit/eras.test.ts holds every Stalingrad mission to them.
 * Sources: docs/campaigns/NATIONS.md (names by era), HISTORY.md (equipment by date), STALINGRAD.md (per mission).
 */
import { AIRCRAFT_LOOKS, VEHICLE_LOOK_EXTRA, type AircraftLook, type VehicleLook } from './artLayout';
import { FACTIONS } from './factions';
import type { WeaponModel } from './figure';
import type { FigureClothing, FigureHeadgear } from './looksGear';
import type { Climate, FactionId, ForceLookId, MissionDef, Side, SupportKind, UnitKind } from './schema';

/** A cap or clothing per kind, or `default` for every infantry kind the era does not name; null = the plain helmet or body. */
export type PerKind<T> = Partial<Record<UnitKind | 'default', T | null>>;

export interface EraLook {
  headgear?: PerKind<FigureHeadgear>;
  clothing?: PerKind<FigureClothing>;
  /** Small arms in place of the nation's (src/data/figure.ts FIGURE_LOADOUT). */
  weapon?: Partial<Record<UnitKind, WeaponModel>>;
  /** The anti-tank hand item held while making ready and thrown (the Tank Hunters' bottle). */
  rocketItem?: Partial<Record<UnitKind, 'molotov'>>;
  /** The vehicle kinds' looks (src/data/artLayout.ts VehicleLook). */
  vehicle?: Partial<Record<VehicleKind, VehicleLook>>;
  /** Call-in aircraft in place of the nation's usual type. */
  aircraft?: Partial<Record<SupportKind, AircraftLook>>;
}

export interface NationEraDef {
  /** For logs and tests: 'soviet-1941'. */
  id: string;
  /** 'YYYY-MM', both inclusive. */
  from: string;
  to: string;
  /** Only in these climates (absent = any). */
  climate?: readonly Climate[];
  names?: Partial<Record<UnitKind, string>>;
  buttonNames?: Partial<Record<UnitKind, string>>;
  blurbs?: Partial<Record<UnitKind, string>>;
  supportNames?: Partial<Record<SupportKind, string>>;
  /**
   * Sim weapons in place of the kind's (UnitDef.weapon, src/data/weapons.ts): the anti-tank rifle or the Tank Hunters'
   * bundles for the anti-tank kind (DECISIONS 455). The art and the sim read the same era, so what is drawn is what fires.
   */
  arms?: Partial<Record<UnitKind, string>>;
  look?: EraLook;
}

/**
 * Each nation's sim weapons by kind when no era replaces them (a mission without a date): the Red Army's anti-tank kind
 * is the AT Rifle Team with the PTRD (its round, not a rocket; DECISIONS 455). The British PIAT and the German
 * Panzerschreck fire the kind's own rocket (UnitDef.weapon).
 */
export const DEFAULT_ARMS: Record<FactionId, Partial<Record<UnitKind, string>>> = {
  british: {},
  german: {},
  soviet: { at: 'atRifle' },
};

export type VehicleKind = 'tank' | 'heavyTank' | 'lightTank' | 'apc';
export const VEHICLE_KINDS: readonly VehicleKind[] = ['tank', 'heavyTank', 'lightTank', 'apc'];

export function isVehicleKind(kind: UnitKind): kind is VehicleKind {
  return (VEHICLE_KINDS as readonly string[]).includes(kind);
}

/** The infantry kinds that wear headgear and clothing (every kind but the vehicles). */
const INFANTRY_KINDS: readonly UnitKind[] = ['sapper', 'rifle', 'lmg', 'assault', 'mortar', 'sniper', 'medic', 'at', 'flame', 'commander', 'aa', 'conscript'];

/** The kinds that wear a cap rather than a helmet in summer 1941 and 1942 (the pilotka; NATIONS.md section 3, eras). */
const SOVIET_CAPS = { sapper: 'pilotka', mortar: 'pilotka', medic: 'pilotka', commander: 'pilotka', conscript: 'pilotka' } as const;

export const NATION_ERAS: Record<FactionId, readonly NationEraDef[]> = {
  // The British names and looks are the defaults (FACTIONS.british); no date changes them yet (no British campaign yet).
  british: [{ id: 'british-1939-1945', from: '1939-09', to: '1945-12' }],
  german: [
    // Winter 1942 to 1943 outside the pocket (mission 1009): helmets under white snow covers and, for the front-line
    // riflemen, gunners, assault troops and snipers, the white side of the reversible winter suit.
    {
      id: 'german-winter-1942',
      from: '1942-11',
      to: '1942-12',
      climate: ['winter'],
      look: {
        headgear: { default: 'helmetCover' },
        clothing: { rifle: 'snowSmock', lmg: 'snowSmock', assault: 'snowSmock', sniper: 'snowSmock' },
      },
    },
    // The Sixth Army in the pocket (mission 1010): greatcoats and improvised wear, whitewashed or covered helmets; the new
    // winter suits did not reach it (STALINGRAD.md, enemy roster: "greatcoats and improvised winter wear").
    { id: 'german-pocket-1943', from: '1943-01', to: '1943-02', climate: ['winter'], look: { headgear: { default: 'helmetCover' } } },
    // Winter 1941 to 1942 (missions 1003, 1004) has no era of its own: the army had no winter clothing (STALINGRAD.md).
    //
    // Mid-1942 on (Stalingrad, missions 1005 to 1010): the later Panzer III (Ausf. L, long 5 cm, spaced armour) is the
    // era's tank; the Panzer IV Ausf. G and the StuG III Ausf. F are per-force looks (ForceDef.look).
    {
      id: 'german-1942',
      from: '1942-06',
      to: '1943-06',
      names: { tank: 'Panzer III Ausf. L', lightTank: 'Panzer III Ausf. H' },
      look: { vehicle: { tank: 'panzer3l', lightTank: 'panzer3h' } },
    },
    // Barbarossa and the drive on Moscow (missions 1001 to 1004): the short Panzer IV and the Panzer III Ausf. E (the
    // owner's window, 1939 to 1941); the Ausf. H with the short 5 cm and the StuG III Ausf. B are per-force looks.
    {
      id: 'german-1939-1941',
      from: '1939-09',
      to: '1941-12',
      names: { tank: 'Panzer IV Ausf. E', lightTank: 'Panzer III Ausf. E' },
      look: { vehicle: { tank: 'panzer4', lightTank: 'panzer3' } },
    },
    // No Panzerschreck before November 1943 (HISTORY.md): the anti-tank kind is the PzB 39 rifle team. The Pak gun
    // crews of the brief wait for a gun-crew look.
    {
      id: 'german-at-rifle',
      from: '1939-09',
      to: '1943-10',
      names: { at: 'PzB 39 Team' },
      buttonNames: { at: 'PzB 39' },
      blurbs: { at: 'A heavy anti-tank rifle. Holes light tanks and hurts heavier ones from the side. Poor against infantry.' },
      look: { weapon: { at: 'pzb39' } },
      arms: { at: 'atRifle' },
    },
  ],
  soviet: [
    // Snipers and scouts in the snow: the white two-piece smock with its hood over the helmet.
    {
      id: 'soviet-winter-smock',
      from: '1941-10',
      to: '1943-03',
      climate: ['winter'],
      look: { headgear: { sniper: 'snowHood' }, clothing: { sniper: 'snowSmock' } },
    },
    // Winters 1941 to 1942 and 1942 to 1943 (missions 1003, 1004, 1009, 1010): the ushanka (under the helmet at the
    // front) and the quilted telogreika.
    {
      id: 'soviet-winter',
      from: '1941-10',
      to: '1943-03',
      climate: ['winter'],
      look: {
        headgear: { default: 'helmetUshanka', sapper: 'ushanka', mortar: 'ushanka', medic: 'ushanka', commander: 'ushanka', conscript: 'ushanka', aa: 'ushanka' },
        clothing: { default: 'telogreika' },
      },
    },
    // The Tank Hunters (grenade bundles and petrol bottles, thrown from close up) until the PTRD reached the front in
    // November 1941 (DECISIONS 455): no anti-tank rifle and no rocket. From then on, the AT Rifle Team (FACTIONS.soviet).
    {
      id: 'soviet-tank-hunters',
      from: '1941-06',
      to: '1941-10',
      names: { at: 'Tank Hunters' },
      buttonNames: { at: 'AT Bundle' },
      blurbs: { at: 'Grenade bundles and petrol bottles, thrown from close up: the tank burns where they land. They must let it come near. Poor against infantry.' },
      look: { weapon: { at: 'mosin' }, rocketItem: { at: 'molotov' } },
      arms: { at: 'atGrenades' },
    },
    // Summer 1941 (missions 1001, 1002): the BT-7 is the light tank (the T-26 a per-force look) until the T-60 arrives.
    { id: 'soviet-summer-1941', from: '1941-06', to: '1941-09', names: { lightTank: 'BT-7' }, look: { vehicle: { lightTank: 'bt7' } } },
    // 1941 (missions 1001 to 1004): the PPD, the militia battalions, the ROKS-2 and the I-16; the pilotka in summer.
    {
      id: 'soviet-1941',
      from: '1941-06',
      to: '1941-12',
      names: { assault: 'PPD Trooper', conscript: 'Militia Squad', flame: 'ROKS-2 Flamethrower' },
      buttonNames: { conscript: 'Militia' },
      blurbs: {
        assault: 'Fast, with a drum-fed PPD and grenades. Clears trenches and hurts pillboxes.',
        conscript: 'A whole squad of hastily trained militia (opolchenie) per order: cheap and many. Machine guns and mortars cut them down.',
      },
      supportNames: { fighter: 'I-16 Fighter' },
      look: { headgear: SOVIET_CAPS, weapon: { assault: 'ppd' }, aircraft: { fighter: 'i16' } },
    },
    // 1942 to early 1943 (missions 1005 to 1010): today's names (FACTIONS.soviet), the ROKS-3, the pilotka in summer.
    { id: 'soviet-summer-1942', from: '1942-04', to: '1942-10', climate: ['temperate', 'city'], look: { headgear: SOVIET_CAPS } },
    { id: 'soviet-1942', from: '1942-01', to: '1943-06', names: { flame: 'ROKS-3 Flamethrower' } },
  ],
};

/**
 * Infantry looks a force may name (ForceDef.look): the Romanian line of mission 1009 fields as German troops (no
 * Romanian nation yet) in the Romanian khaki-brown greatcoat and the Adrian helmet, under Romanian names; the Red
 * Army's ski troops (mission 1004) go in white snow smocks and hoods.
 */
export const INFANTRY_LOOKS: Record<
  'romanian' | 'skiTroops',
  { nation: FactionId; headgear: FigureHeadgear; clothing: FigureClothing; names: Partial<Record<UnitKind, string>>; buttonNames?: Partial<Record<UnitKind, string>> }
> = {
  skiTroops: { nation: 'soviet', headgear: 'snowHood', clothing: 'snowSmock', names: { assault: 'Ski Trooper', rifle: 'Ski Trooper' } },
  romanian: {
    nation: 'german',
    headgear: 'adrian',
    clothing: 'greatcoatRomanian',
    names: { rifle: 'Infanterist (Romanian)', lmg: 'ZB vz. 30 Gunner (Romanian)', assault: 'Grenadier (Romanian)', mortar: 'Mortar Team (Romanian)', at: 'Anti-tank Team (Romanian)', sniper: 'Lunetist (Romanian)', medic: 'Sanitar (Romanian)' },
    // Short enough for a unit button at every phone size (tests/e2e/hud-labels.spec.ts), should a look reach one.
    buttonNames: { rifle: 'Soldat', lmg: 'ZB Gunner', assault: 'Grenadier', mortar: 'Mortar', at: 'Anti-tank', sniper: 'Lunetist', medic: 'Sanitar' },
  },
};

export type InfantryLookId = keyof typeof INFANTRY_LOOKS;

/** Display names of the vehicle looks, for a unit whose look is not its era's default (a KV-2 among the KV-1s). */
export const VEHICLE_LOOK_NAMES: Partial<Record<VehicleLook, string>> = {
  t26: 'T-26',
  bt7: 'BT-7',
  t60: 'T-60',
  t34: 'T-34',
  kv1: 'KV-1',
  kv2: 'KV-2',
  panzer3: 'Panzer III Ausf. E',
  panzer3h: 'Panzer III Ausf. H',
  panzer3l: 'Panzer III Ausf. L',
  panzer4: 'Panzer IV',
  panzer4g: 'Panzer IV Ausf. G',
  stug3b: 'StuG III Ausf. B',
  stug3f: 'StuG III Ausf. F',
};

/** True for a ForceDef.look that names a vehicle look (the rest are INFANTRY_LOOKS). */
export function isVehicleForceLook(look: ForceLookId | string): look is VehicleLook & ForceLookId {
  return !(look in INFANTRY_LOOKS);
}

/** A nation's names and looks for one date and climate (resolveEra). */
export interface ResolvedEra {
  nation: FactionId;
  /** The eras that matched, in order (empty = the defaults). */
  eras: string[];
  names: Record<UnitKind, string>;
  buttonNames: Partial<Record<UnitKind, string>>;
  blurbs: Record<UnitKind, string>;
  supportNames: Record<SupportKind, string>;
  /** Per infantry kind: the cap or clothing worn (absent = the nation's helmet and plain body). */
  headgear: Partial<Record<UnitKind, FigureHeadgear>>;
  clothing: Partial<Record<UnitKind, FigureClothing>>;
  weapon: Partial<Record<UnitKind, WeaponModel>>;
  rocketItem: Partial<Record<UnitKind, 'molotov'>>;
  vehicle: Record<VehicleKind, VehicleLook>;
  /** Sim weapons that replace the kind's own (the anti-tank rifle, the Tank Hunters' bundles); absent = UnitDef.weapon. */
  arms: Partial<Record<UnitKind, string>>;
  aircraft: Partial<Record<SupportKind, AircraftLook>>;
}

/** A nation's default vehicle looks (the ones every mission without a date shows). */
export function defaultVehicleLooks(nation: FactionId): Record<VehicleKind, VehicleLook> {
  const f = FACTIONS[nation].look;
  return { tank: f.tank, heavyTank: f.heavyTank, lightTank: VEHICLE_LOOK_EXTRA[nation].lightTank, apc: VEHICLE_LOOK_EXTRA[nation].apc };
}

/** True if the era holds the date ('YYYY-MM-DD') and the climate. */
export function eraMatches(era: NationEraDef, dateIso: string, climate: Climate): boolean {
  const month = dateIso.slice(0, 7);
  return month >= era.from && month <= era.to && (era.climate === undefined || era.climate.includes(climate));
}

function pick<T>(table: PerKind<T> | undefined, kind: UnitKind): T | null | undefined {
  if (!table) return undefined;
  if (kind in table) return table[kind];
  return 'default' in table ? table.default : undefined;
}

const CACHE = new Map<string, ResolvedEra>();

/**
 * A nation's names and looks on a date ('YYYY-MM-DD') in a climate; null date = the defaults. The result is shared
 * and must not be changed.
 */
export function resolveEra(nation: FactionId, dateIso: string | null, climate: Climate = 'temperate'): ResolvedEra {
  const cacheKey = `${nation}|${dateIso ?? ''}|${climate}`;
  const hit = CACHE.get(cacheKey);
  if (hit) return hit;
  const F = FACTIONS[nation];
  const matched = dateIso === null ? [] : NATION_ERAS[nation].filter((e) => eraMatches(e, dateIso, climate));
  // Merge from the last match to the first, so the first match wins each field.
  const rev = [...matched].reverse();
  const out: ResolvedEra = {
    nation,
    eras: matched.map((e) => e.id),
    names: { ...F.unitNames },
    buttonNames: { ...F.buttonNames },
    blurbs: { ...F.unitBlurbs },
    supportNames: { ...F.supportNames },
    headgear: {},
    clothing: {},
    weapon: {},
    rocketItem: {},
    arms: { ...DEFAULT_ARMS[nation] },
    vehicle: defaultVehicleLooks(nation),
    aircraft: {},
  };
  for (const e of rev) {
    Object.assign(out.names, e.names);
    Object.assign(out.buttonNames, e.buttonNames);
    Object.assign(out.blurbs, e.blurbs);
    Object.assign(out.supportNames, e.supportNames);
    Object.assign(out.weapon, e.look?.weapon);
    Object.assign(out.rocketItem, e.look?.rocketItem);
    Object.assign(out.arms, e.arms);
    Object.assign(out.vehicle, e.look?.vehicle);
    Object.assign(out.aircraft, e.look?.aircraft);
  }
  // Caps and clothing per kind: the first era that names the kind, or failing that gives a default, decides.
  for (const kind of INFANTRY_KINDS) {
    for (const [field, target] of [
      ['headgear', out.headgear],
      ['clothing', out.clothing],
    ] as const) {
      for (const e of matched) {
        const v = pick<string>(e.look?.[field] as PerKind<string> | undefined, kind);
        if (v === undefined) continue;
        if (v !== null) (target as Record<string, string>)[kind] = v;
        break;
      }
    }
  }
  CACHE.set(cacheKey, out);
  return out;
}

/** The era a mission gives a nation (its date and climate; the defaults when it has no `dateIso`). */
export function missionEra(m: MissionDef, nation: FactionId): ResolvedEra {
  return resolveEra(nation, m.dateIso ?? null, m.climate ?? 'temperate');
}

/** The era of a side's own nation in a mission. */
export function sideEra(m: MissionDef, side: Side): ResolvedEra {
  return missionEra(m, m.start[side].faction);
}

/** The vehicle look a unit draws with: its force's look if it names a vehicle, else its era's for the kind. */
export function unitVehicleLook(era: ResolvedEra, kind: VehicleKind, look: string): VehicleLook {
  return look !== '' && isVehicleForceLook(look) ? (look as VehicleLook) : era.vehicle[kind];
}

/** A unit's name: its force look's name (a KV-2, a Romanian rifleman) if it has one, else its era's name for the kind. */
export function unitDisplayName(era: ResolvedEra, kind: UnitKind, look: string): string {
  if (look !== '') {
    if (look in INFANTRY_LOOKS) return INFANTRY_LOOKS[look as InfantryLookId].names[kind] ?? era.names[kind];
    if (isVehicleKind(kind)) {
      const v = look as VehicleLook;
      if (v !== era.vehicle[kind]) return VEHICLE_LOOK_NAMES[v] ?? era.names[kind];
    }
  }
  return era.names[kind];
}

/** The infantry look a force names, or null. */
export function infantryLookOf(look: string): (typeof INFANTRY_LOOKS)[InfantryLookId] | null {
  return look !== '' && look in INFANTRY_LOOKS ? INFANTRY_LOOKS[look as InfantryLookId] : null;
}

/** Every aircraft look's support kind (for the plane pool): the look flies in place of that call-in's plane. */
export function aircraftKindOf(look: AircraftLook): (typeof AIRCRAFT_LOOKS)[AircraftLook]['kind'] {
  return AIRCRAFT_LOOKS[look].kind;
}

/**
 * The second man drawn beside a kind that is a crew of two, by the sim weapon it carries and its nation: the PTRD's
 * number two with his rifle (the Soviet AT Rifle Team is a two-man team; DECISIONS 455). Names and art only: the
 * team is one unit in the sim. The German PzB 39 was a one-man weapon, the Tank Hunters went singly.
 */
export const TEAM_MATES: Partial<Record<string, Partial<Record<FactionId, UnitKind>>>> = {
  atRifle: { soviet: 'rifle' },
};

/** The kind of the second man drawn with a unit of `kind` in an era, or null for a one-man unit. */
export function teamMateOf(era: ResolvedEra, kind: UnitKind): UnitKind | null {
  const arms = era.arms[kind];
  return arms !== undefined ? (TEAM_MATES[arms]?.[era.nation] ?? null) : null;
}
