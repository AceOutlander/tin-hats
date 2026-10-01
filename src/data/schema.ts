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
