/**
 * Shared vocabulary and data-definition types for Tin Hats.
 *
 * Pure types only: no logic and no imports. Every tunable number in the game
 * lives in a src/data/*.ts file typed by this schema. The simulation track owns
 * this file: fields may be ADDED, but existing names must not be renamed or
 * removed without updating every user.
 */

/** 0 = the side whose HQ is at the left edge (the player in the campaign); 1 = right edge. */
export type Side = 0 | 1;

export type FactionId = 'british' | 'german';

/** Mirrored roster. heavyTank is the non-trainable boss tank (King Tiger). */
export type UnitKind =
  | 'sapper'
  | 'rifle'
  | 'lmg'
  | 'assault'
  | 'mortar'
  | 'sniper'
  | 'medic'
  | 'at'
  | 'tank'
  | 'heavyTank';

export type DamageType = 'bullet' | 'explosive' | 'antiTank';

/** Columns of the damage matrix. `hq` is separate from `fortification` so HQ durability can be tuned on its own. */
export type TargetClass = 'infantryOpen' | 'infantryTrench' | 'fortification' | 'vehicle' | 'hq';

export type Order = 'fallBack' | 'hold' | 'advance';
export type SupportKind = 'artillery' | 'smoke' | 'airStrike';
export type Difficulty = 'normal' | 'hard' | 'insane';
export type TheatreId = 'france' | 'desert' | 'sicily' | 'italy' | 'normandy' | 'holland' | 'germany';
export type TimeOfDay = 'dawn' | 'day' | 'overcast' | 'dusk' | 'night';
export type MissionMode = 'assault' | 'survival';

/**
 * What a unit is doing this tick. The view maps these to animations.
 * move = walking/running, load = sapper picking up a crate at the dump,
 * deploy = setting up a crew weapon, inside = garrisoned in the HQ (not drawn).
 */
export type UnitAction =
  | 'idle'
  | 'move'
  | 'aim'
  | 'fire'
  | 'reload'
  | 'throw'
  | 'load'
  | 'heal'
  | 'deploy'
  | 'inside';

/** How a weapon delivers damage. hitscan = instant tracer; direct = fast flat projectile; lob = arcing indirect shell. */
export type Delivery = 'hitscan' | 'direct' | 'lob';

export interface WeaponDef {
  id: string;
  damageType: DamageType;
  /** Damage per hit, or at the centre of the splash. */
  damage: number;
  /** Maximum range in world units (wu). */
  range: number;
  /** Minimum range (wu); 0 for none. */
  minRange: number;
  /** Seconds to settle on a new target before the first shot. */
  aimTime: number;
  /** Seconds between shots, or between bursts. */
  cooldown: number;
  /** Shots per burst (1 = single shot). */
  burst: number;
  /** Seconds between shots inside a burst. */
  burstInterval: number;
  /** Hit chance at point-blank and at maximum range (linear in between). Lobbed and direct shells use scatter instead. */
  accuracyNear: number;
  accuracyFar: number;
  delivery: Delivery;
  /** Horizontal projectile speed in wu/s for direct and lob weapons. */
  projectileSpeed: number;
  /** Splash radius in wu; 0 = single target. Damage falls off linearly to the edge. */
  splashRadius: number;
  /** Landing error (wu, one standard deviation) at maximum range for direct and lob weapons. */
  scatter: number;
  /** Target classes this weapon may engage. */
  targets: TargetClass[];
  /** Unit kinds this weapon prefers when several targets are in range (first = most preferred). */
  prefer: UnitKind[];
  /** True if the unit may keep moving while this weapon fires. */
  moveAndFire: boolean;
  /** View hints. */
  tracer: 'rifle' | 'mg' | 'smg' | 'sniper' | 'none';
  projectileLook: 'none' | 'grenade' | 'mortar' | 'rocket' | 'shell' | 'bomb';
  /** Sound played when the weapon fires: a one-shot name from src/data/sounds.ts, or 'none' for silence. */
  sound: string;
}

export interface UnitDef {
  kind: UnitKind;
  class: 'infantry' | 'vehicle';
  /** False for sappers and medics. */
  armed: boolean;
  cost: number;
  pop: number;
  trainTime: number;
  hp: number;
  /** Movement speed in wu/s. */
  speed: number;
  /** Primary weapon id (src/data/weapons.ts) or null. */
  weapon: string | null;
  /** Secondary weapon id: grenade for assault troops, coaxial MG for tanks. */
  secondary: string | null;
  /** True if the player may train it (false for the boss tank). */
  trainable: boolean;
  /** True if it can occupy trench slots. */
  usesTrench: boolean;
  /** Preferred distance behind the hold line when not in a trench (wu). */
  formationDepth: number;
  /** Under Advance the unit closes until its target is within range * engageFrac. */
  engageFrac: number;
  /** True if driving over wire destroys it. */
  crushesWire: boolean;
  /** True if the player may take direct control of it. */
  controllable: boolean;
  /** Medic only: hit points healed per second, range in wu. */
  healRate: number;
  healRange: number;
  /** Footprint along x used for spacing and splash (wu). */
  width: number;
}

export type DamageMatrix = Record<DamageType, Record<TargetClass, number>>;

export interface FactionLook {
  helmet: 'brodie' | 'stahlhelm';
  /** Uniform / helmet tint and a darker shade, CSS hex colours. */
  tint: string;
  tintDark: string;
  flag: 'unionJack' | 'balkenkreuz';
  tank: 'churchill' | 'panzer4';
  heavyTank: 'churchill' | 'kingTiger';
}

export interface FactionDef {
  id: FactionId;
  name: string;
  adjective: string;
  unitNames: Record<UnitKind, string>;
  /** One-line role text for briefings and the Quartermaster. */
  unitBlurbs: Record<UnitKind, string>;
  supportNames: Record<SupportKind, string>;
  look: FactionLook;
}

export interface SupportDef {
  kind: SupportKind;
  cooldown: number;
  /** Seconds between the call and the first effect. */
  delay: number;
  /** Shells / bombs delivered (artillery, air strike). */
  rounds: number;
  /** Seconds over which the rounds land. */
  duration: number;
  /** Half-width of the target area in wu. */
  spread: number;
  /** Weapon id used for each round (artillery, air strike); null for smoke. */
  weapon: string | null;
  /** Smoke only: cloud radius (wu) and lifetime (s). */
  smokeRadius: number;
  smokeTime: number;
}

export type UpgradeEffect =
  | { stat: 'sapperSpeed' | 'sapperCarry' | 'hqIncome' | 'hqHealth' | 'hqGunDamage' | 'hqGunRate'; mul: number }
  | { stat: 'unitHealth' | 'unitDamage' | 'unitHeal'; unit: UnitKind; mul: number };

export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  /** Unit this upgrade belongs to, for grouping in the Quartermaster; null for HQ and sapper upgrades. */
  unit: UnitKind | null;
  /** One entry per level (3 levels); each level lists its cumulative effects. */
  levels: UpgradeEffect[][];
  /** Upgrade points per level. */
  costPerLevel: number;
}

export type UpgradeLevels = Record<string, number>;

export interface DifficultyDef {
  id: Difficulty;
  name: string;
  /** Multiplier on the AI side's supply income (passive, sappers and scripted). */
  aiIncomeMul: number;
  /** Multiplier on AI aggression: scales attack thresholds and wave strength, never unit stats. */
  aiAggression: number;
  /** Seconds between AI decisions. */
  aiThinkInterval: number;
}

/** Global rules and tunables (src/data/config.ts). Distances in wu, times in seconds. */
export interface GameConfig {
  /** Simulation ticks per second. DT = 1 / tickRate. */
  tickRate: number;
  /** Population cap per side (living units plus queued units). */
  popCap: number;
  /** Most units of one kind that may wait in a training queue. */
  maxQueue: number;

  /** Base HQ health before mission and upgrade multipliers. */
  hqHp: number;
  /** Passive supplies per second from a living HQ. */
  hqIncomePerSec: number;
  /** Distance of the HQ centre from its own map edge. */
  hqInset: number;
  /** Footprint of the HQ bunker along x (centred on the HQ x). For art, picking and splash. */
  hqWidth: number;
  /** Distance from the HQ centre forward to its door: units spawn and retreat here, enemies aim and are blocked here. */
  hqDoorOffset: number;
  /** Distance from the HQ centre forward to the machine-gun muzzle. */
  hqGunOffset: number;
  /** Weapon id of the HQ machine gun. */
  hqGunWeapon: string;
  /** Seconds between units walking out of the HQ door after Fall Back ends. */
  doorInterval: number;

  /** Distance from the HQ door forward to the supply dump. */
  dumpDistance: number;
  /** Sappers spread over this width at the dump so they do not stack. */
  dumpSpread: number;
  /** Seconds a sapper spends loading at the dump. */
  sapperLoadTime: number;
  /** Supplies a sapper carries per trip. */
  sapperCarry: number;

  /** Distance from the HQ centre forward to the hold line when the side owns no trench. */
  holdLineOffset: number;
  /** A unit under Hold that is further than this in front of the hold line walks back without fighting. */
  holdLineTolerance: number;
  /** No ground unit may come closer than this to the nearest enemy blocker ahead of it. */
  contactGap: number;
  /** Distance between formation columns; also the general "do not stack" spacing. */
  spacing: number;
  /** Number of formation columns behind the hold line. */
  formationColumns: number;
  /** Depth rows used for visual spread (must equal VIEW.rows). */
  rows: number;
  /** Order in which the rows of one formation column are filled. */
  formationRowOrder: number[];
  /** Units stop between range * engageFrac and that minus this much, so a firing line is not a single stack. */
  engageSpread: number;
  /** Units keep at least this far from both map edges. */
  mapMargin: number;
  /** Speed multiplier while running to the HQ under Fall Back. */
  fallBackSpeedMul: number;

  /** Seconds a unit stays in the `fire` action after its last shot. */
  firePoseTime: number;
  /** Seconds between checks for a more preferred target (weapons with a `prefer` list). */
  retargetInterval: number;

  /** Direct control buffs. */
  controlDamageMul: number;
  controlReloadMul: number;
  /** Guard units stay within this distance of their post. */
  guardLeash: number;

  /** Speed multiplier for enemy infantry inside wire. */
  wireSlow: number;
  wireHp: number;
  /** Base pillbox health before the mission multiplier. */
  pillboxHp: number;
  /** Weapon id of the pillbox machine gun. */
  pillboxGunWeapon: string;
  /** Spacing between the slots of a trench. */
  trenchSlotSpacing: number;
  /** A shooter this close to its target ignores smoke. */
  smokePointBlank: number;

  /** Pool sizes. Units and projectiles are hard caps; the event, command and damage buffers grow if exceeded. */
  maxUnits: number;
  maxProjectiles: number;
  maxSmokes: number;
  maxEvents: number;
  maxCommands: number;
}

/**
 * Tunables of the AI commander (src/data/ai.ts). Strength = summed supply cost of living armed units.
 * "Group" strength counts only the units gathered within groupRadius of the hold line (while holding)
 * or of the leading unit (while advancing), so stragglers and reinforcements still on the road do not count.
 */
export interface AiDef {
  /** Advance when group strength >= visible enemy strength * attackRatio (divided by difficulty aggression). */
  attackRatio: number;
  /** While advancing, drop back to Hold when group strength < enemy strength * holdRatio. */
  holdRatio: number;
  /** Fall Back when the enemy is at the hold line and group strength < enemy strength * retreatRatio. */
  retreatRatio: number;
  /** Leave Fall Back when total own strength >= enemy strength * returnRatio, or the enemy has left. */
  returnRatio: number;
  /** Minimum seconds between order changes. */
  minOrderInterval: number;
  /** Never advance with less group strength than this. */
  minAttackStrength: number;
  /** While advancing, regroup (Hold) when group strength falls below minAttackStrength * regroupFrac. */
  regroupFrac: number;
  /** Radius of the "group" around the hold line or the leading unit. */
  groupRadius: number;
  /** Advance regardless of the ratio when population reaches popCap * popCapAttackFrac. */
  popCapAttackFrac: number;
  /** After this many seconds of Hold (divided by aggression) the AI attacks at the lower impatientRatio. */
  impatienceAfter: number;
  impatientRatio: number;
  /** An armed enemy within this distance of the hold line counts as "at the hold line". */
  threatDistance: number;
  /** The AI keeps at most this many units of one kind queued. */
  maxQueueDepth: number;
  /** With the build plan satisfied and at least this many supplies banked, train extra units in plan proportions. */
  surplusSupplies: number;
  /** Seconds between decisions of the test bot (the AI uses the difficulty's interval). */
  botThinkInterval: number;
  /** Reactions: anti-tank teams added per visible enemy tank. */
  atPerTank: number;
  /** Reactions: mortars and assault troops added when the enemy is dug in ahead. */
  mortarsVsDugIn: number;
  assaultVsDugIn: number;
  /** Reactions: one machine gun added per this many enemy infantry in the open (0 = never). */
  infantryPerLmg: number;
  /** Reactions never add more than this many units of one kind. */
  maxReaction: number;
}

export interface TrenchDef {
  id: number;
  x: number;
  width: number;
  slots: number;
  /** Starting owner; -1 = empty and unowned. */
  owner: Side | -1;
}

export interface PillboxDef {
  id: number;
  x: number;
  side: Side;
  /** Multiplier on the base pillbox health in config. */
  hpMul: number;
}

export interface WireDef {
  id: number;
  x: number;
  width: number;
  /** The side that laid it; only the other side's infantry are slowed. */
  owner: Side;
}

/** A group of units placed at mission start or spawned by an event. */
export interface ForceDef {
  kind: UnitKind;
  count: number;
  /** World x to place at; omitted = at the side's HQ door, or the map edge for sides with no HQ. */
  x?: number;
  /** Place into this trench's slots instead. */
  trenchId?: number;
  /** guard = stay within config.guardLeash of the spawn point (boss tank); assault = always advance (waves). */
  behaviour?: 'army' | 'guard' | 'assault';
}

export interface SideStart {
  faction: FactionId;
  /** False in survival missions for side 1: no HQ, no economy, units arrive as waves. */
  hasHq: boolean;
  supplies: number;
  /** Multiplier on the base HQ health in config. */
  hqHpMul: number;
  /** Multiplier on passive and sapper income for this side in this mission. */
  incomeMul: number;
  sappers: number;
  forces: ForceDef[];
}

/**
 * When a scripted mission event fires. Times are battle seconds.
 * at = once at that time; every = repeatedly from `from` until `until` (or the end);
 * trenchCapturedBy = once, `delay` seconds after that side takes the trench;
 * hqHpBelow = once, when that side's HQ health drops below this fraction (0..1) of its maximum.
 */
export type MissionTrigger =
  | { at: number }
  | { every: number; from: number; until?: number }
  | { trenchCapturedBy: Side; trenchId: number; delay?: number }
  | { hqHpBelow: number; side: Side };

export type MissionEventDef =
  | { type: 'wave'; when: MissionTrigger; side: Side; forces: ForceDef[]; announce?: string }
  | { type: 'airdrop'; when: MissionTrigger; side: Side; supplies: number }
  | { type: 'hint'; when: MissionTrigger; text: string }
  | { type: 'announce'; when: MissionTrigger; text: string };

/** One step of an AI build plan: keep `count` of `kind` alive once `after` seconds have passed. */
export interface BuildStep {
  kind: UnitKind;
  count: number;
  after: number;
}

export interface MissionAiPlan {
  sappers: number;
  build: BuildStep[];
  /** Seconds before the AI may issue its first Advance. */
  firstAttackAfter: number;
}

export interface MissionDef {
  id: number;
  key: string;
  title: string;
  location: string;
  date: string;
  /** Position on the campaign map in degrees. */
  mapPos: { lon: number; lat: number };
  briefing: string[];
  objective: string;
  theatre: TheatreId;
  timeOfDay: TimeOfDay;
  mode: MissionMode;
  /** Battlefield length in wu (1000 wu is about one screen). */
  length: number;
  newUnit: UnitKind | null;
  newSupport: SupportKind | null;
  /** Units and supports each side may use: index 0 = side 0 (player), 1 = side 1. */
  units: [UnitKind[], UnitKind[]];
  supports: [SupportKind[], SupportKind[]];
  start: [SideStart, SideStart];
  trenches: TrenchDef[];
  pillboxes: PillboxDef[];
  wire: WireDef[];
  /** Survival: win when it expires. Deadline: lose when it expires. */
  timer: { seconds: number; onExpire: 'win' | 'lose'; label: string } | null;
  events: MissionEventDef[];
  /** Build plan for the AI on side 1. */
  ai: MissionAiPlan;
  /** Build plan the scripted "reasonable player" test bot follows on side 0. */
  bot: MissionAiPlan;
  /** Intended mission length in minutes [min, max], checked by the balance tests. */
  expectedMinutes: [number, number];
}
