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

/**
 * Mirrored roster. heavyTank is the non-trainable King Tiger (an elite squad with veteran escorts).
 * apc = armoured personnel carrier (machine gun only, bullet-proof, carries one squad), flame = flamethrower,
 * commander = officer with a damage aura (one per side), aa = anti-aircraft gun team,
 * lightTank = the enemy-only early-war Panzer III Ausf. E.
 */
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
  | 'heavyTank'
  | 'apc'
  | 'flame'
  | 'commander'
  | 'aa'
  | 'lightTank';

export type DamageType = 'bullet' | 'explosive' | 'antiTank';

/** Columns of the damage matrix. `hq` is separate from `fortification` so HQ durability can be tuned on its own. */
export type TargetClass = 'infantryOpen' | 'infantryTrench' | 'fortification' | 'vehicle' | 'hq';

export type Order = 'fallBack' | 'hold' | 'advance';
/** bomber = bombing run over a large area, fighter = strafing run, recon = reveals enemy health in a radius. */
export type SupportKind = 'artillery' | 'smoke' | 'airStrike' | 'bomber' | 'fighter' | 'recon';
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
  /*
   * The fields below are required (not optional) so that every weapon object has the same shape:
   * the sim reads weapons in its hot loop and mixed shapes would make those reads allocate.
   */
  /** Crew weapons: seconds the unit spends setting up (action 'deploy') after it stops moving, before it can aim. 0 = none. */
  setupTime: number;
  /**
   * Area weapons. 'prefer': units in trenches, units in a cluster (config.clusterMin within
   * config.clusterRadius) and fortifications rank ahead of everything not in `prefer`.
   * 'only': engage nothing else (units in the open only when clustered). 'none': no such preference.
   */
  dugIn: 'none' | 'prefer' | 'only';
  /** Fortifications and the HQ rank ahead of units not in `prefer` (anti-tank rockets). */
  preferStructures: boolean;
  /** Thrown by hand: the unit plays 'throw' and the round leaves after config.throwReleaseTime. */
  thrown: boolean;
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
  /**
   * Support troops (mortar, medic): under Advance they stay formationDepth behind the leading
   * line unit instead of leading, and they never count as the line themselves.
   */
  followsLine: boolean;

  /*
   * New-unit fields (optional; absent = the plain behaviour). Read once when tables are built, not per tick.
   */
  /**
   * Vehicles: damage multipliers by the side of the vehicle a hit comes from (front = the way it faces).
   * Absent = 1 from both sides. The King Tiger has a thick front and a weak rear.
   */
  armour?: { front: number; rear: number };
  /** APC: infantry it carries to the front (one squad), unloaded where it stops. */
  carries?: number;
  /** Commander: friendly soldiers within `radius` wu deal `damageMul` x damage. Does not stack. */
  aura?: { radius: number; damageMul: number };
  /** Commander: a side may have only one alive or queued at a time. */
  uniquePerSide?: boolean;
  /** Flamethrower: a bullet hit from behind ignites the fuel tank and kills instantly with a small explosion. */
  rearIgnite?: boolean;
  /** Anti-aircraft team: can engage planes. */
  antiAir?: boolean;
  /** Enemy-only (Panzer III, King Tiger): never trainable by, nor sold to, the player. */
  enemyOnly?: boolean;
}

/** Commander speech bubbles (src/data/speech.ts): short text lines per faction and per order. */
export type SpeechTable = Record<FactionId, Record<Order, readonly string[]>>;

export type DamageMatrix =Record<DamageType, Record<TargetClass, number>>;

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
  /** Short labels for the training buttons where the name is too long to fit (others show the name's first word). */
  buttonNames: Partial<Record<UnitKind, string>>;
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
  /**
   * Seconds before the first round at which `supportIncoming` is announced (with the time left).
   * At or above `delay` it is announced on the call itself.
   */
  warning: number;
  /** Each round starts this far behind its landing point, toward the caller's side (shell arc, aircraft run-in). */
  launchOffset: number;
  /** Multiplier on this call-in's damage to an HQ, so a barrage cannot stand in for an army. */
  hqDamageMul: number;
  /** Multiplier on this call-in's damage to vehicles (the air strike's anti-tank punch). */
  vehicleDamageMul: number;
  /**
   * Where the rounds land: 'scatter' = at random within x +- spread (artillery); 'sweep' = evenly along
   * the strip from x - dir * spread to x + dir * spread in the caller's direction (an aircraft's run).
   */
  pattern: 'scatter' | 'sweep';
}

export type UpgradeEffect =
  | { stat: 'sapperSpeed' | 'sapperCarry' | 'hqIncome' | 'hqHealth' | 'hqGunDamage' | 'hqGunRate'; mul: number }
  | { stat: 'unitHealth' | 'unitDamage' | 'unitHeal'; unit: UnitKind; mul: number }
  /**
   * Call-ins of one kind: supportRate divides the cooldown (1.25 = ready again in 80% of the time), supportReach
   * multiplies the area (a strike's spread, the recon plane's reveal radius), supportTime the time the effect lasts
   * (the recon plane's reveal, a smoke cloud).
   */
  | { stat: 'supportRate' | 'supportReach' | 'supportTime'; support: SupportKind; mul: number };

export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  /** Unit this upgrade belongs to, for grouping in the Quartermaster; null for HQ, sapper and call-in upgrades. */
  unit: UnitKind | null;
  /** Call-in this upgrade belongs to (grouped under it in the Quartermaster); absent for every other upgrade. */
  support?: SupportKind;
  /** One entry per level (3 levels); each level lists its cumulative effects. */
  levels: UpgradeEffect[][];
  /** Medals for each level when levelCosts is absent. */
  costPerLevel: number;
  /** Medals for level 1, 2, 3 (the price of buying that level); overrides costPerLevel. */
  levelCosts?: number[];
}

export type UpgradeLevels = Record<string, number>;

export interface DifficultyDef {
  id: Difficulty;
  name: string;
  /** Multiplier on the AI side's supply income (passive, sappers and scripted). */
  aiIncomeMul: number;
  /** Multiplier on AI aggression: scales attack thresholds and timings, never unit stats. */
  aiAggression: number;
  /** Multiplier on the unit counts of scripted waves sent by an AI side (rounded, at least 1 per group). */
  aiWaveMul: number;
  /**
   * Multiplier on an AI side's population cap (rounded). Scripted waves never take a side over its cap (the
   * rest wait in the reserve), so a bigger wave only adds strength if the army it joins may be bigger too.
   */
  aiPopCapMul: number;
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
  /** A standing unit sets off again only when its goal is further than this (no shuffling behind a creeping line). */
  moveDeadband: number;

  /** Seconds a unit stays in the `fire` action after its last shot. */
  firePoseTime: number;
  /** Seconds between checks for a more preferred target (weapons with a `prefer` list). */
  retargetInterval: number;
  /**
   * Fire distribution: when choosing among targets of the same rank, each shooter adds its own
   * fixed 0..this many wu to each target's distance, so a firing line spreads its fire over the
   * enemies near the front instead of all shooting the single nearest man.
   */
  targetSpread: number;
  /** A weapon swinging from one target straight to the next settles for this fraction of its aimTime. */
  switchAimFrac: number;

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
  /** Gap between the rear edge of a hold-line trench and the first rank of the formation behind it. */
  trenchFormGap: number;
  /** Footprint of a pillbox along x (centred on its x), for splash. */
  pillboxWidth: number;

  /** Scatter of direct and lobbed rounds is weapon.scatter x (distance / range), but never below this fraction of it. */
  scatterMinFrac: number;
  /** Area weapons treat a unit as part of a cluster when at least this many of its side (itself included) stand within clusterRadius. */
  clusterMin: number;
  clusterRadius: number;
  /** Thrown weapons: seconds from the start of the 'throw' action to the release, and the whole action. */
  throwReleaseTime: number;
  throwPoseTime: number;
  /** A guard that was hit by something it cannot reach chases toward the enemy (inside its leash) for this long. */
  guardAlertTime: number;

  /** Veteran infantry (ForceDef.veteran, the King Tiger's escort): multipliers on health and on hit chance. */
  veteran: { hpMul: number; accuracyMul: number };

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
  /**
   * Advance regardless of the ratio when population reaches attackFullPop * popCapAttackFrac, where attackFullPop is
   * attackArmyPop scaled by the difficulty's AI population multiplier and never above the side's cap. The AI judges a
   * "full" army by this fixed size, so raising the population cap does not make it wait longer to attack.
   */
  popCapAttackFrac: number;
  attackArmyPop: number;
  /** After this many seconds of Hold (divided by aggression) the AI attacks at the lower impatientRatio. */
  impatienceAfter: number;
  impatientRatio: number;
  /** An armed enemy within this distance of the hold line counts as "at the hold line". */
  threatDistance: number;
  /** The AI keeps at most this many units of one kind queued. */
  maxQueueDepth: number;
  /** With the build plan satisfied and at least this many supplies banked, train extra units in plan proportions. */
  surplusSupplies: number;
  /** Past a full-sized army (see attackArmyPop) the AI trains only while at least this many supplies stay banked. */
  reserveSupplies: number;
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

  /** Enemy infantry in a trench count this many times their cost when the AI weighs an attack. */
  dugInWeight: number;
  /** Strength a living enemy pillbox adds to the enemy when the AI weighs an attack. */
  pillboxValue: number;
  /**
   * The HQ is under threat (Fall Back is allowed, and kept) while an armed enemy is within this distance
   * of the HQ door or within threatDistance of the hold line.
   */
  hqThreatDistance: number;
  /** Strength the enemy HQ's machine gun adds to the enemy once the leading unit is within hqThreatDistance of it. */
  hqValue: number;
  /** An Advance is not called off before it has run this many seconds (the army needs time to arrive). */
  minAdvanceTime: number;
  /** Leave Fall Back straight for Advance when total own strength >= enemy strength * commitRatio. */
  commitRatio: number;
  /**
   * Hold with this much more total strength than the visible enemy (own >= enemy * advantageRatio)
   * and the AI advances even if its group at the line is still small (no sheltering while ahead).
   */
  advantageRatio: number;

  /** Supports: targets only within this distance ahead of its own leading unit (or behind it), never deep in enemy country. */
  supportReach: number;
  /** Supports: seconds between two call-ins of its own (so it does not drop everything on one cluster). */
  supportGap: number;
  /** Supports: value (summed supply cost) of enemies within artilleryRadius worth an artillery barrage. */
  artilleryRadius: number;
  artilleryMinValue: number;
  /** Supports: value within artilleryRadius worth an air strike when no enemy tank is on the field. */
  airStrikeMinValue: number;
  /** Supports: smoke is laid while advancing when the enemy line is between these distances ahead of the leading unit. */
  smokeMinGap: number;
  smokeMaxGap: number;
}

/** One group of an army in the matchup harness and the balance tests. */
export interface ArmyEntry {
  kind: UnitKind;
  count: number;
}

/** Tunables of the headless matchup harness (src/sim/matchup.ts, src/data/balance.ts). */
export interface MatchupDef {
  /** Unit kinds in the matchup tables (combat units only). */
  kinds: UnitKind[];
  /** Each side's budget in supplies lies in this range; unit counts are picked so both sides cost (nearly) the same. */
  budgetMin: number;
  budgetMax: number;
  /** Battles per pairing (seeds 1..seeds). */
  seeds: number;
  /** A duel still running after this many seconds is undecided. */
  maxSeconds: number;
  /** Field length. */
  length: number;
  /** Open field: x of side 0's and of side 1's leading unit at the start (both advance). */
  openX: [number, number];
  /** Trench test: centre and width of the defenders' trench (side 1, one slot per defender) and the attackers' start x. */
  trenchX: number;
  trenchWidth: number;
  attackX: number;
  /** A sensible mixed army; at equal total cost it must beat a mono-spam of every unit kind. */
  mixedArmy: ArmyEntry[];
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
  /**
   * guard = stay within config.guardLeash of the spawn point (boss tank); assault = always advance (waves);
   * garrison = with `trenchId`, hold that trench whatever the order until it falls, then join the army.
   */
  behaviour?: 'army' | 'guard' | 'assault' | 'garrison';
  /** Veteran infantry (the King Tiger's escort): health and hit chance scaled by config.veteran. */
  veteran?: boolean;
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
  /** `about`: the unit or call-in a "New:" hint introduces; dropped when the player already had it before this mission. */
  | { type: 'hint'; when: MissionTrigger; text: string; about?: UnitKind | SupportKind }
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

/**
 * The battle music tracks (src/data/musicTracks/index.ts registers one definition for each name). A new mission
 * track adds its name here and its file there.
 */
export type BattleTrackName = 'arras' | 'dunkirk' | 'crusader' | 'alamein' | 'hill112' | 'arnhem' | 'reichswald' | 'primosole' | 'cassino' | 'sword';

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
  /**
   * Further unit types this mission unlocks (newUnit is the first). Reaching a mission unlocks newUnit, these and
   * every type in its own unit list, for every mission after it in any campaign (owner, 2026-11-09).
   */
  unlocks?: UnitKind[];
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
  /** The battle music (src/data/musicTracks): the track this mission plays. */
  music: BattleTrackName;
}
