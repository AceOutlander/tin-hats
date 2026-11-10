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

/**
 * Nations as data (docs/campaigns/FOUNDATIONS.md section 5). FactionId becomes NationId once the other nations land;
 * NationId is the alias new code should use.
 */
export type FactionId = 'british' | 'german' | 'soviet';
export type NationId = FactionId;

/**
 * Mirrored roster. heavyTank is the non-trainable King Tiger (an elite squad with veteran escorts).
 * apc = armoured personnel carrier (machine gun only, bullet-proof, carries one squad), flame = flamethrower,
 * commander = officer with a damage aura (one per side), aa = anti-aircraft gun team,
 * lightTank = the enemy-only early-war Panzer III Ausf. E,
 * conscript = the Soviet signature infantry (NATIONS.md): cheap, weak riflemen trained as a squad of several per order.
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
  | 'lightTank'
  | 'conscript';

export type DamageType = 'bullet' | 'explosive' | 'antiTank';

/**
 * Columns of the damage matrix. `hq` is separate from `fortification` so HQ durability can be tuned on its own.
 * `infantryBuilding` = men at the windows of a standing building, `rubbleCover` = men in its rubble or behind a cover
 * prop (FOUNDATIONS.md 4.3).
 */
export type TargetClass = 'infantryOpen' | 'infantryTrench' | 'fortification' | 'vehicle' | 'hq' | 'infantryBuilding' | 'rubbleCover';

export type Order = 'fallBack' | 'hold' | 'advance';
/**
 * bomber = bombing run over a large area, fighter = strafing run, recon = reveals enemy health in a radius,
 * katyusha = the Soviet signature rocket salvo (a wide, inaccurate barrage with a long cooldown).
 */
export type SupportKind = 'artillery' | 'smoke' | 'airStrike' | 'bomber' | 'fighter' | 'recon' | 'katyusha';
export type Difficulty = 'normal' | 'hard' | 'insane';
/**
 * A backdrop set (src/data/theatres.ts, painters in src/art/backdrops/theatres). The Soviet theatres (FOUNDATIONS.md
 * 4.7, STALINGRAD.md): russiaSummer (birch woods, rye, izbas), stalingrad (the ruined city, autumn) and steppe (open
 * land, balkas), each with a winter variant that a winter mission (MissionDef.climate) gets.
 */
export type TheatreId = 'france' | 'desert' | 'sicily' | 'italy' | 'normandy' | 'holland' | 'germany' | 'russiaSummer' | 'stalingrad' | 'steppe';
export type TimeOfDay = 'dawn' | 'day' | 'overcast' | 'dusk' | 'night';
/**
 * Scripted weather (FOUNDATIONS.md 4.7): sim state that caps the visible range of direct fire for both sides (fog,
 * blizzard, dust, smoke), grounds aircraft (fog, blizzard) and slows men on foot (blizzard); the view draws its sky and
 * particles. The numbers are WEATHER_SIM in src/data/weather.ts.
 */
export type WeatherKind = 'clear' | 'overcast' | 'rain' | 'snow' | 'blizzard' | 'fog' | 'dust' | 'smoke';
/**
 * A label for the HUD, the briefing card and medal scoring (FOUNDATIONS.md 3.1, 7.1); behaviour comes from the phases.
 * assault = take the enemy HQ (or make it surrender); survival = timed, no enemy HQ; hold = take something, then hold
 * it; delay = timed, with enemyReached losses and often a kill count; special = anything else (a river crossing).
 */
export type MissionMode = 'assault' | 'survival' | 'hold' | 'delay' | 'special';

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
  projectileLook: 'none' | 'grenade' | 'mortar' | 'rocket' | 'shell' | 'bomb' | 'katyusha';
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
  /**
   * Heavy shells (tank cannon): how far (wu) the blast throws a man in the open at its centre, falling off linearly to
   * nothing at the splash edge; men in a trench or behind sandbags within config.knockDugIn of the radius are blown out
   * of their slots. 0 = no throw (everything but the tank cannon).
   */
  knockback: number;
  /** Multiplier on the blast's damage to fortifications: wire, tank traps and road blocks, pillboxes, building walls. 1 normally. */
  fortMul: number;
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
  /**
   * Squad training (Soviet conscripts): one training order costs cost x squad and pop x squad, takes trainTime, and
   * sends all `squad` men out of the HQ together. cost, pop and hp stay per man. Absent = 1.
   */
  squad?: number;
}

/** Commander speech bubbles (src/data/speech.ts): short text lines per faction and per order. */
export type SpeechTable = Record<FactionId, Record<Order, readonly string[]>>;

export type DamageMatrix =Record<DamageType, Record<TargetClass, number>>;

/** Helmet shapes drawn in src/art/figure/parts.ts. ssh40 = the Soviet SSh-40 (a deep round dome, a short brim all round). */
export type HelmetShape = 'brodie' | 'stahlhelm' | 'ssh40';

export interface FactionLook {
  helmet: HelmetShape;
  /** Uniform / helmet tint and a darker shade, CSS hex colours. */
  tint: string;
  tintDark: string;
  /** sovietRed = the red flag with the gold hammer and sickle and the gold-edged star (NATIONS.md section 1). */
  flag: 'unionJack' | 'balkenkreuz' | 'sovietRed';
  tank: 'churchill' | 'panzer4' | 't34';
  heavyTank: 'churchill' | 'kingTiger' | 'kv1';
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
  /** HUD accent and campaign-card colour (NATIONS.md). */
  uiAccent: string;
  /**
   * The nation's signature kinds (NATIONS.md section 2): only this nation fields them, so a mission may offer them only
   * to a side of this nation (tests/unit/nations.test.ts).
   */
  signature: { units: UnitKind[]; supports: SupportKind[] };
}

/**
 * Campaigns (FOUNDATIONS.md section 6). Mission ids have four digits by campaign: Stalingrad 1001 to 1010, D-Day 2001
 * to 2010, Road to Berlin 3001 to 3010, Africa 4001 to 4010. Stalingrad is the only one built so far; the ten British
 * placeholder missions (ids 1 to 10) were removed with its release (saves archive their progress, src/meta/save.ts).
 * A new campaign adds its id here.
 */
export type CampaignId = 'stalingrad';

export interface CampaignDef {
  id: CampaignId;
  /** The player's nation: the card's flag and colours. */
  nation: NationId;
  title: string;
  /** Dates line for the card, e.g. 'June 1941 to February 1943'. */
  subtitle: string;
  /** Every mission id of the campaign lies in [first, last]. */
  missionRange: { first: number; last: number };
  /** Mission ids in play order. */
  missionIds: number[];
  /** Open from the start, or once a mission (of any campaign) is cleared. */
  unlock: { always: true } | { afterMission: number };
  /** One-line blurb for the campaign select screen. */
  card: string;
  /** False while the campaign is being built: it must not be offered on the live site. */
  released: boolean;
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
  /** Heavy shells (WeaponDef.knockback): speed (wu/s) a thrown man is carried at, and the share of the splash radius inside which men dug in are blown out of their slots. */
  knockSpeed: number;
  /** How far past its splash radius a heavy shell still throws men in the open (x the radius; they are not hurt out there). */
  knockReach: number;
  knockDugIn: number;
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
  /** Supports: value within artilleryRadius worth a Katyusha salvo (the long cooldown makes the AI wait for a big target). */
  katyushaMinValue: number;
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

/**
 * How a building is drawn (src/art/structures/buildings.ts; FOUNDATIONS.md 4.3). The sim treats every look alike.
 * casemate = a brick ring barracks or casemate; church; izba = a log house; house = a brick or plastered town house;
 * apartment = a block of flats (3 to 4 floors); station = a railway station; factoryHall = a brick works hall;
 * waterTank = a concrete water tank; mill; store = a department store; hangar = an airfield hangar; sheds = goods sheds.
 */
export type BuildingLook =
  | 'casemate'
  | 'church'
  | 'izba'
  | 'house'
  | 'apartment'
  | 'station'
  | 'factoryHall'
  | 'waterTank'
  | 'mill'
  | 'store'
  | 'hangar'
  | 'sheds';

/**
 * A building (FOUNDATIONS.md 4.3): infantry take its window slots as they take a trench's (`usesTrench` kinds; never
 * vehicles), floor by floor, and count as `infantryBuilding`; a side captures it by entering it empty. Damage to the
 * walls (explosive and anti-tank splash) brings floors down, top first, and at 0 hp it falls to rubble, which still
 * gives `rubbleCover` to half as many men.
 */
export interface BuildingDef {
  id: number;
  /** Centre x and width of its footprint (wu). */
  x: number;
  width: number;
  /** Floors 1 to 4. Men on floor 2 and up see further (range x BUILDINGS.upperFloorRange). */
  floors: 1 | 2 | 3 | 4;
  /** Window slots on each floor. */
  slotsPerFloor: number;
  /** Multiplier on BUILDINGS.hp (src/data/buildings.ts). */
  hpMul: number;
  /** Starting owner; -1 = empty and unowned. */
  owner: Side | -1;
  look: BuildingLook;
  /** Also a spawn point while owned (FOUNDATIONS.md 4.5; today waves name it with ForceDef.at). */
  spawn?: boolean;
  /** 'none' = the walls take no damage (it never loses a floor or falls). Default 'rubble'. */
  collapse?: 'rubble' | 'none';
}

/** A cover prop's look (src/art/structures/buildings.ts): goods wagons on a siding, the wrecks of transport aircraft. */
export type CoverPropLook = 'wagons' | 'ju52Wreck' | 'he111Wreck';

/**
 * A cover prop (FOUNDATIONS.md 4.3): scenery men shelter behind as in rubble (`rubbleCover`, `slots` men). It takes no
 * damage and is taken by entering it empty, like a building. Its id is in the buildings' id space (`buildingId`,
 * `{ building }` name it too).
 */
export interface CoverPropDef {
  id: number;
  x: number;
  width: number;
  slots: number;
  look: CoverPropLook;
  /** Starting owner; default -1 (nobody). */
  owner?: Side | -1;
}

/**
 * The HQ's building for a mission (SideStart.hqLook): one of the Quartermaster's HQ styles, or a building the mission
 * puts the HQ in (casemate = Brest's ring barracks, mill = the Gerhardt mill, store = the Univermag).
 */
export type HqLook = 'tent' | 'bigTent' | 'dugout' | 'bunkerBritish' | 'bunkerGerman' | 'capeTent' | 'zemlyanka' | 'logDugout' | 'bunkerSoviet' | 'casemate' | 'mill' | 'store';

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

/**
 * A vehicle obstacle (FOUNDATIONS.md 4.8; src/sim/obstacles.ts): the other side's vehicles cannot pass it until it is
 * cleared by sappers, blown apart by explosive splash or worked loose by the vehicles held at it. tankTrap = steel
 * "hedgehogs" (infantry walk through); roadBlock = a barricade of logs and wire that also slows the other side's
 * infantry like wire.
 */
export interface ObstacleDef {
  id: number;
  x: number;
  width: number;
  /** The side that built it; only the other side is stopped. */
  owner: Side;
  kind: ObstacleKind;
}

export type ObstacleKind = 'tankTrap' | 'roadBlock';

/**
 * A minefield (FOUNDATIONS.md 4.6; src/sim/mines.ts). The other side's units moving in it roll, per 10 wu moved,
 * density x MINES.chance[mines][class] on the battle RNG; a blast hurts the one who set it off and lowers the density.
 * Explosive splash and sappers' Clear jobs thin it out. Its owner always sees it; the other side once it is marked, a
 * mine has gone off under one of its men, its own rounds have set mines off there, or its recon plane has passed over.
 */
export interface MinefieldDef {
  id: number;
  x: number;
  width: number;
  owner: Side;
  /** ap = anti-personnel (barely scratch a tank), at = anti-tank (ignore infantry), mixed = both. */
  mines: MineKind;
  /** 0..1. */
  density: number;
  /** Warning signs: the other side sees it from the start. */
  marked: boolean;
}

export type MineKind = 'ap' | 'at' | 'mixed';

/**
 * A bridge over a river (FOUNDATIONS.md 4.4; src/sim/water.ts). While it stands its span [x0, x1] is road for
 * everyone (vehicles cross, nobody wades); a fallen bridge leaves the water below. `point` names the capture point that
 * holds it (its owner follows the point). A wired bridge is blown by the `demolish` event unless the other side holds
 * its point (the wires are cut then). A bridge with `standing: false` is put across later by the `bridge` event (a
 * pontoon).
 */
export interface BridgeDef {
  id: number;
  x0: number;
  x1: number;
  /** Multiplier on WATER.bridgeHp. Default 1. */
  hpMul?: number;
  /** Starting owner; -1 = nobody. A bridge with a `point` takes the point's owner. */
  owner: Side | -1;
  /** The capture point on the bridge (MissionDef.capturePoints). */
  point?: string;
  /** Charges laid by `side`; wired = ready to blow. */
  demolition?: { side: Side; wired: boolean };
  /** Default true. False: not there until a `bridge` event puts it up. */
  standing?: boolean;
  /** How it is drawn: a girder bridge (default) or a pontoon bridge. */
  look?: 'bridge' | 'pontoon';
}

/**
 * A ferry (CapturePointDef.ferry, FOUNDATIONS.md 4.4 and 4.5): units deploying at the point, or at a point beyond it,
 * board at `from` on the home bank and cross together, a boat every `batchEvery` seconds; a round of the other side
 * that lands on the boat while it crosses sinks `hitShare` of its load (the men chosen on the battle RNG).
 */
export interface FerryDef {
  /** Where the boat puts out from (wu, on the side's own bank). */
  from: number;
  /** Seconds the crossing takes. Default WATER.ferryCross. */
  crossSeconds?: number;
  /** Share of the load lost when the boat is hit (0..1). Default WATER.ferryHitShare. */
  hitShare?: number;
}

/** A group of units placed at mission start or spawned by an event. */
export interface ForceDef {
  kind: UnitKind;
  count: number;
  /** World x to place at; omitted = at the side's HQ door, or the map edge for sides with no HQ. */
  x?: number;
  /** Place into this trench's slots instead. */
  trenchId?: number;
  /** Place into this building's window slots instead (like `trenchId`; `garrison` holds the building). */
  buildingId?: number;
  /**
   * guard = stay within config.guardLeash of the spawn point (boss tank); assault = always advance (waves);
   * garrison = with `trenchId`, hold that trench whatever the order until it falls, then join the army.
   */
  behaviour?: 'army' | 'guard' | 'assault' | 'garrison';
  /** Veteran infantry (the King Tiger's escort): health and hit chance scaled by config.veteran. */
  veteran?: boolean;
  /**
   * A look inside the era (FOUNDATIONS.md 5.1, src/data/eras.ts): a vehicle variant (a `kv2` among the KV-1s, a
   * `stug3b` instead of the era's Panzer IV) or an infantry look (`romanian`). Names and art only: the stats stay the
   * kind's. tests/unit/eras.test.ts checks each against the equipment table (src/data/equipment.ts).
   */
  look?: ForceLookId;
  /** The nation these units belong to, if not the side's (FOUNDATIONS.md 5.1, per-kind nation). */
  nation?: NationId;
  /**
   * A wave only: come in at this point (a forward spawn, FOUNDATIONS.md 4.5) while the wave's side owns it, just
   * behind it; otherwise as without it (the HQ door or the map edge). Ignored when `x` or `trenchId` is given.
   */
  at?: PointRef;
  /**
   * How far a guard may move from its post (wu); omitted = config.guardLeash. 0 = frozen where it stands (a tank out
   * of fuel, a dug-in hull): it still turns and shoots. A force with a leash and no behaviour is a guard.
   */
  leash?: number;
  /** Abilities of these units (FOUNDATIONS.md 4.2): `skis` = deep snow does not slow them (1004's ski troopers). */
  tags?: UnitTag[];
}

/** A unit ability a force may carry (ForceDef.tags). */
export type UnitTag = 'skis';

/**
 * The per-force looks a mission may name (ForceDef.look): vehicle looks drawn in src/art/vehicles (VehicleLook in
 * src/data/artLayout.ts) and infantry looks (INFANTRY_LOOKS in src/data/eras.ts).
 */
export type ForceLookId =
  | 't26'
  | 'bt7'
  | 't60'
  | 't34'
  | 'kv1'
  | 'kv2'
  | 'panzer3'
  | 'panzer3h'
  | 'panzer3l'
  | 'panzer4'
  | 'panzer4g'
  | 'stug3b'
  | 'stug3f'
  | 'romanian'
  | 'skiTroops';

/** A mission's climate (FOUNDATIONS.md 5.1): with its date, it picks each nation's era (src/data/eras.ts). */
export type Climate = 'temperate' | 'winter' | 'desert' | 'tropical' | 'city';

export interface SideStart {
  faction: FactionId;
  /** Call-ins the mission offers but that start withdrawn, until a `support` event offers them (FOUNDATIONS.md 3.3). */
  supportsOff?: SupportKind[];
  /** This mission's own full cooldown (seconds, before upgrades) for some call-ins: 1007's 90 s artillery. */
  supportCooldown?: Partial<Record<SupportKind, number>>;
  /**
   * Charges of each call-in this side brings (the player's Shop charges and those lent, src/meta/medals.ts applyRoster):
   * each use spends one and a call-in with none left cannot be called. Absent = no limit (the enemy, the bot, the
   * proving ground and Basic Training).
   */
  supportCharges?: Partial<Record<SupportKind, number>>;
  /** False in survival missions for side 1: no HQ, no economy, units arrive as waves. */
  hasHq: boolean;
  supplies: number;
  /** Multiplier on the base HQ health in config. */
  hqHpMul: number;
  /** The HQ's look in this mission (FOUNDATIONS.md 4.3) instead of the side's upgrade look. Names and art only. */
  hqLook?: HqLook;
  /** Multiplier on passive and sapper income for this side in this mission. */
  incomeMul: number;
  sappers: number;
  forces: ForceDef[];
  /**
   * Kinds this side fields as another nation (FOUNDATIONS.md 5.1): `{ lightTank: 'southAfrican' }`. Their units carry
   * that nation's names and looks; stats stay the kind's. ForceDef.nation overrides it per force.
   */
  rosterNation?: Partial<Record<UnitKind, NationId>>;
}

/**
 * A structure on the field, by its mission id (the HQ by side). The director (src/sim/director.ts) resolves each to
 * "destroyed" and a 0..1 health; later features add their own kinds here ({ building }, { bridge }, { minefield }).
 * A trench counts as destroyed (lost) once the other side holds it.
 */
export type StructureRef =
  | { trench: number }
  | { pillbox: number }
  | { wire: number }
  | { hq: Side }
  | { building: number }
  | { bridge: number }
  | { obstacle: number }
  | { minefield: number };

/**
 * Something a side owns and the director can test: a trench, a building (MissionDef.buildings, by its slot record), or
 * a capture point by its id (MissionDef.capturePoints, FOUNDATIONS.md 4.5). Owned = the side holds it; lost = the
 * other side holds it.
 */
export type PointRef = { trench: number } | { point: string } | { building: number };

/**
 * Battlefield ground (FOUNDATIONS.md 4.2; src/data/ground.ts holds each one's speeds, cover and art). `slopeUp` rises
 * toward the right-hand (+x) end of the field, `slopeDown` falls toward it.
 */
export type GroundId =
  | 'grass'
  | 'field'
  | 'steppe'
  | 'road'
  | 'cobble'
  | 'forest'
  | 'mud'
  | 'sand'
  | 'rock'
  | 'snow'
  | 'deepSnow'
  | 'rubble'
  | 'slopeUp'
  | 'slopeDown'
  | 'water';

/**
 * A stretch of the battlefield with its own ground (FOUNDATIONS.md 4.1). A mission's sectors run left to right without
 * gaps or overlaps from 0 to its length; ground left uncovered is even ground (every multiplier 1).
 */
export interface SectorDef {
  /** wu. */
  from: number;
  to: number;
  ground: GroundId;
  /**
   * Its own backdrop set (at most two per mission: the mission's theatre and one other); absent = the mission's
   * theatre. The view crossfades the backdrop strips over 600 wu where neighbouring sectors differ (FOUNDATIONS.md 4.1).
   */
  backdrop?: TheatreId;
  /** Minimap and briefing name ("Kholm Gate", "Red October"). */
  label?: string;
  /** Range multiplier for every weapon fired from here (a hilltop: 1006's summit 1.1). */
  heightBonus?: number;
}

/**
 * The structure a capture point is (CapturePointDef.structure): a trench, or a building (MissionDef.buildings,
 * FOUNDATIONS.md 4.3), held through the building's slot record.
 */
export type PointStructureRef = { trench: number } | { building: number };

/**
 * A capture point (FOUNDATIONS.md 4.5): a stretch of ground a side takes by holding it alone, a forward spawn point
 * for trained units while owned and uncontested, a rally point for Fall Back, and a candidate for the hold line.
 */
export interface CapturePointDef {
  /** Unique in the mission: 'P1'. Named by PointRef `{ point: 'P1' }`. */
  id: string;
  /** Centre and width of its zone (wu). */
  x: number;
  width: number;
  /** HUD and minimap name, 24 characters at most. */
  label: string;
  /** Starting owner; -1 = nobody. */
  owner: Side | -1;
  /** Seconds a side must hold the zone alone (armed units in it, none of the other side's) to take it; 0 = at once. */
  captureTime: number;
  /** Owned and uncontested: trained units may deploy here, and Fall Back rallies here. */
  spawn: boolean;
  /** Only this side deploys and rallies here (a forward spawn the attacker gains by taking it); absent = its owner. */
  spawnFor?: Side;
  /** An armed enemy within this distance of x contests it: nobody deploys there, and Fall Back picks another. */
  contestRadius: number;
  /** The point is this trench or building: it changes hands with it (the trench way), not by its own timer. */
  structure?: PointStructureRef;
  /** A ferry landing (FOUNDATIONS.md 4.4): deployments arrive together, a boat every this many seconds (with `ferry`). */
  batchEvery?: number;
  /** The ferry that serves the landing (with batchEvery). */
  ferry?: FerryDef;
}

/**
 * When a scripted mission event fires. Times are seconds on the mission clock (missionTime: battle time less every
 * prep phase); phase times are seconds since that phase began (after its own prep, if any).
 * at = once at that time; every = repeatedly from `from` until `until` (or the end);
 * trenchCapturedBy = once, `delay` seconds after that side takes the trench;
 * hqHpBelow = once, when that side's HQ health drops below this fraction (0..1) of its maximum;
 * phase = once, `delay` seconds after that phase starts (only while it is the current phase);
 * phaseEvery = repeatedly while that phase is current, from `from` (default 0) to `until` seconds into it;
 * objective = once, `delay` seconds after that objective (or side objective) is done;
 * pointCapturedBy = once, `delay` seconds after that side takes the point;
 * kills = once, when this many units of `side` (the side that died; of `kinds` if given) have died in the mission;
 * structureDestroyed = once, `delay` seconds after the structure is destroyed (a trench: taken by the other side);
 * enemyNear = once, when a unit of the side other than `side` comes within `dist` of `x` (or past it).
 */
export type MissionTrigger =
  | { at: number }
  | { every: number; from: number; until?: number }
  | { trenchCapturedBy: Side; trenchId: number; delay?: number }
  | { hqHpBelow: number; side: Side }
  | { phase: string; delay?: number }
  | { phaseEvery: number; phase: string; from?: number; until?: number }
  | { objective: string; delay?: number }
  | { pointCapturedBy: Side; point: PointRef; delay?: number }
  | { kills: number; side: Side; kinds?: UnitKind[] }
  | { structureDestroyed: StructureRef; delay?: number }
  | { enemyNear: { x: number; dist: number; side: Side } };

/** Weapons made for scripted barrages (src/data/weapons.ts); any lobbed or dropped weapon id of the list works. */
export type BarrageWeapon = 'artilleryShell' | 'siegeShell' | 'heavyBomb' | 'nebelwerfer' | 'mortar21' | 'katyushaRocket' | 'aerialBomb';

/** A banner's sound (the HUD plays it with the text). */
export type BannerSound = 'horn' | 'alarm' | 'boss';

/**
 * A scripted event (FOUNDATIONS.md 3.3). `id` (unique in the mission) names it for the admin panel and the snapshot.
 * wave, airdrop, hint and announce as before; and:
 * banner = a big notice with a sound; barrage = scripted shells, free (no cost or cooldown) for any side, with or
 *   without an HQ: `rounds` land at random within x +- spread over `duration` seconds, from `delay` seconds after the
 *   event (default 0; 3 with a `warning`, which shows as an alarm banner when the event fires);
 * airRaid = a free call-in of `support` at x (no cost; the side's own cooldown is untouched; skipped while that side's
 *   aircraft of the kind is still in the air); income = the side's income becomes the mission's x `mul`;
 * posture = steer that side's AI commander: hold (no Advance; an Advance in progress stops), counterattack (Advance,
 *   at `point`, for `seconds`, then free), free (its own judgement again);
 * support = offer or withdraw a call-in; disguise = units of `side` inside [x0, x1] are not chosen as targets for
 *   `seconds` unless they fire; reveal = enemy health shown to `side` over the whole field for `seconds`;
 * setOwner = a trench or pillbox changes hands; endMission = the battle ends now with this winner (a surrender), with
 *   `text` as the closing announcement;
 * weather / time = the weather or the time of day changes over `over` seconds (FOUNDATIONS.md 4.7): the sim switches
 *   at the midpoint, the view crossfades over the whole span;
 * flare = a flare over x: visibility 1 within `width` wu of it (default WEATHER_SIM.flare.width 1,500, centred) for
 *   `seconds` (default 20), for both sides; `side` fired it (default 1); `color` is the view's (default white; green
 *   for a signal).
 */
export type MissionEventDef = { id?: string } & (
  | { type: 'wave'; when: MissionTrigger; side: Side; forces: ForceDef[]; announce?: string }
  | { type: 'airdrop'; when: MissionTrigger; side: Side; supplies: number }
  /** `about`: the unit or call-in a "New:" hint introduces; dropped when the player already had it before this mission. */
  | { type: 'hint'; when: MissionTrigger; text: string; about?: UnitKind | SupportKind }
  | { type: 'announce'; when: MissionTrigger; text: string }
  | { type: 'banner'; when: MissionTrigger; text: string; sound?: BannerSound }
  | {
      type: 'barrage';
      when: MissionTrigger;
      side: Side;
      x: number;
      spread: number;
      rounds: number;
      duration: number;
      weapon: BarrageWeapon;
      warning?: string;
      delay?: number;
    }
  | { type: 'airRaid'; when: MissionTrigger; side: Side; support: SupportKind; x: number }
  | { type: 'income'; when: MissionTrigger; side: Side; mul: number }
  | { type: 'posture'; when: MissionTrigger; side: Side; posture: 'hold' | 'counterattack' | 'free'; point?: PointRef; seconds?: number }
  | { type: 'support'; when: MissionTrigger; side: Side; kind: SupportKind; enabled: boolean }
  | { type: 'disguise'; when: MissionTrigger; side: Side; seconds: number; x0: number; x1: number }
  | { type: 'reveal'; when: MissionTrigger; side: Side; seconds: number }
  | {
      type: 'setOwner';
      when: MissionTrigger;
      ref: { trench: number } | { pillbox: number } | { building: number } | { point: string };
      owner: Side | -1;
    }
  | { type: 'endMission'; when: MissionTrigger; winner: Side; text: string }
  | { type: 'weather'; when: MissionTrigger; to: WeatherKind; over: number }
  | { type: 'time'; when: MissionTrigger; to: TimeOfDay; over: number }
  | { type: 'flare'; when: MissionTrigger; x: number; side?: Side; seconds?: number; width?: number; color?: 'white' | 'green' }
  /** Blow a wired bridge (FOUNDATIONS.md 4.4): nothing happens if it is down, not wired, or its wires were cut. */
  | { type: 'demolish'; when: MissionTrigger; bridge: number }
  /** Put a bridge across (a pontoon the engineers have built): its span becomes road again. */
  | { type: 'bridge'; when: MissionTrigger; bridge: number }
);

/**
 * What a phase asks of the player (FOUNDATIONS.md 3.1). `text` is the objective plate's line (a default by type
 * otherwise). Counted from the phase's start unless said otherwise.
 * destroyHq = that side's HQ destroyed; capture = side 0 owns the point (once is enough); hold = side 0 owns it
 * without a break for `seconds` (a loss starts it again); survive = the phase has run `seconds`; kill = `count` units
 * of `side` (of `kinds`) have died, counted over the whole mission; destroy = every listed structure destroyed (a
 * trench: taken); reach = `count` living side 0 units (of `kinds`) at or past x at once; surrender = that side's HQ
 * under `hqBelow` of its health (the battle then ends as a surrender).
 */
export type ObjectiveDef = { id: string; text?: string } & (
  | { type: 'destroyHq'; side: Side }
  | { type: 'capture'; point: PointRef }
  | { type: 'hold'; point: PointRef; seconds: number }
  | { type: 'survive'; seconds: number }
  | { type: 'kill'; side: Side; kinds?: UnitKind[]; count: number }
  | { type: 'destroy'; structures: StructureRef[] }
  | { type: 'reach'; x: number; count: number; kinds?: UnitKind[] }
  | { type: 'surrender'; side: Side; hqBelow: number }
);

/**
 * A way to lose a phase (on top of "your HQ falls"), or what fails a side objective.
 * pointLost = side 1 holds the point; enemyReached = `count` living side 1 units (of `kinds`) at or past x (toward
 * side 0's end) at once; structureLost = any listed structure destroyed or taken by side 1; lost = side 0 has lost
 * `count` units (of `kinds`) since the condition began (its phase's start).
 */
export type LossDef =
  | { type: 'pointLost'; point: PointRef }
  | { type: 'enemyReached'; x: number; count: number; kinds?: UnitKind[] }
  | { type: 'structureLost'; structures: StructureRef[] }
  | { type: 'lost'; count: number; kinds?: UnitKind[] }
  /** Side 1 infantry inside the point's span (a building or trench) while side 0 holds it (1007: no German inside). */
  | { type: 'contested'; point: PointRef }
  /** `count` boat loads of the ferry at this capture point have been hit on the way over (1005). */
  | { type: 'ferryLoads'; point: string; count: number };

/**
 * An optional objective that pays a medal bonus (FOUNDATIONS.md 7.1), watched from its phase's start to the end of
 * the mission (failIf only until phase `until` starts, if given). It is earned at a win when its `objective` (if any)
 * was done, within `within` seconds of the mission clock if given; `failIf` (if any) never happened; and, with no
 * objective, the win itself came within `within` seconds (if given).
 */
export interface SideObjectiveDef {
  id: string;
  /** Pause and end screens, 40 characters at most. */
  text: string;
  objective?: ObjectiveDef;
  failIf?: LossDef;
  within?: number;
  /** The same, counted from the start of the side objective's own phase (1009: the bridge within 180 s of phase 3). */
  withinPhase?: number;
  /** The objective must still hold when the battle ends (1008: the machine shops still ours at dark). */
  atEnd?: boolean;
  until?: string;
  /** Share added to the 0..1 medal score (0.1 = +10%). */
  bonus: number;
}

/** A phase's own clock on the HUD. lose = the mission is lost when it runs out; complete = the phase is done then. */
export interface PhaseTimerDef {
  seconds: number;
  label: string;
  onExpire: 'complete' | 'lose';
}

/**
 * What the admin panel's "jump to phase" (and phase-isolated tests) put in place before entering the phase: who holds
 * which trenches and pillboxes, money, and units placed for each side.
 */
export interface PhaseAssume {
  owners?: { ref: { trench: number } | { pillbox: number } | { building: number } | { point: string }; owner: Side | -1 }[];
  supplies?: [number, number];
  forces?: [ForceDef[], ForceDef[]];
}

/**
 * One phase of a mission (FOUNDATIONS.md 3.1). One is current at a time; when all its objectives are done the
 * director moves to `next` (null: the mission is won). Its events are the mission's events with phase triggers, plus
 * `onEnter` (fired when it starts, after its prep).
 */
export interface PhaseDef {
  id: string;
  /** HUD objective plate and phase banner, 40 characters at most. */
  title: string;
  objectives: ObjectiveDef[];
  sideObjectives?: SideObjectiveDef[];
  lose?: LossDef[];
  timer?: PhaseTimerDef;
  /** A prep phase at its start (FOUNDATIONS.md 7.3). The first phase's is MissionDef.prep. */
  prep?: MissionPrepDef;
  onEnter?: MissionEventDef[];
  next: string | null;
  assume?: PhaseAssume;
}

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
export type BattleTrackName =
  | 'arras'
  | 'dunkirk'
  | 'crusader'
  | 'alamein'
  | 'hill112'
  | 'arnhem'
  | 'reichswald'
  | 'primosole'
  | 'cassino'
  | 'sword'
  // The Soviet campaign (src/data/musicCampaigns.ts says which Stalingrad mission plays which).
  | 'volokolamsk'
  | 'factories'
  | 'brest'
  | 'dubno'
  | 'klin'
  | 'volga'
  | 'kurgan'
  | 'pavlov'
  | 'uranus'
  | 'ring';

/** A briefing's intelligence (MissionDef.intel): short lines that read on a phone, the era's names for every type. */
export interface MissionIntel {
  /** What the enemy fields and roughly how many, and what supports him. */
  enemy: string[];
  /** What the player starts with, and what comes up later. */
  friendly: string[];
}

export interface MissionDef {
  id: number;
  key: string;
  title: string;
  location: string;
  date: string;
  /**
   * The mission's date as 'YYYY-MM-DD' (FOUNDATIONS.md 5.1 and 9.1): with `climate` it picks each nation's era, its
   * unit names and looks (src/data/eras.ts). Absent = every nation's default era (today's names and looks).
   */
  dateIso?: string;
  /** The mission's climate for the era (winter brings the winter looks). Absent = temperate. */
  climate?: Climate;
  /** Position on the campaign map in degrees. */
  mapPos: { lon: number; lat: number };
  briefing: string[];
  objective: string;
  /** The briefing's intelligence: a few short lines on each side (shown under the orders). Absent = none shown. */
  intel?: MissionIntel;
  theatre: TheatreId;
  /** The time of day at the start; `time` events change it during the battle (FOUNDATIONS.md 4.7). */
  timeOfDay: TimeOfDay;
  /**
   * Scripted weather at the start (FOUNDATIONS.md 4.7); `weather` events change it. Set (or any weather event) = the
   * view's random rain is off. Absent = no weather in the sim (as 'clear') and the random rain as before.
   */
  weather?: WeatherKind;
  /** Visibility at night for this mission (default WEATHER_SIM.time.night; a full moon is about 0.8). */
  nightVisibility?: number;
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
  /** Buildings (FOUNDATIONS.md 4.3). Absent = none. */
  buildings?: BuildingDef[];
  /** Cover props: wagons, wrecks (FOUNDATIONS.md 4.3). Absent = none. */
  props?: CoverPropDef[];
  /** Tank traps and road blocks (FOUNDATIONS.md 4.8). Absent = none. */
  obstacles?: ObstacleDef[];
  /** Minefields (FOUNDATIONS.md 4.6). Absent = none. */
  minefields?: MinefieldDef[];
  /** Bridges over the water sectors (FOUNDATIONS.md 4.4). Absent = none. */
  bridges?: BridgeDef[];
  /**
   * The ground in sectors, left to right (FOUNDATIONS.md 4.1 and 4.2): speeds, cover, the crest's range bonus, the
   * ground art and the minimap. Absent = even ground, exactly as before.
   */
  sectors?: SectorDef[];
  /** Capture points, forward spawn and rally points (FOUNDATIONS.md 4.5). Absent = none, exactly as before. */
  capturePoints?: CapturePointDef[];
  /**
   * A prep phase before the enemy attacks (defensive missions; src/data/prep.ts): its countdown (default
   * PREP.defaultSeconds), what may be built (default every buildable), the zone the player builds in (default their
   * half of the field, behind their front), and the test bot's build plan.
   */
  prep?: MissionPrepDef;
  /**
   * A clock over the whole mission (from the end of the first prep phase). Survival: win when it expires. Deadline:
   * lose when it expires. With `phases` it runs beside them (the HUD shows it unless the current phase has its own).
   */
  timer: { seconds: number; onExpire: 'win' | 'lose'; label: string } | null;
  /**
   * The mission director's phases (FOUNDATIONS.md 3.1), in order; the first is where the mission starts. Absent = one
   * phase made from `mode` and `timer` (normalPhases in src/sim/director.ts), which plays exactly as before.
   */
  phases?: PhaseDef[];
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

/** A mission's prep phase (MissionDef.prep). */
export interface MissionPrepDef {
  seconds?: number;
  buildables?: BuildableId[];
  zone?: { from: number; to: number };
  /** What the "reasonable player" test bot builds, in order, as money allows. */
  bot?: { kind: BuildableId; x: number }[];
}

/**
 * What a prep phase can build (src/data/prep.ts): tankTrap and roadBlock stop the enemy's vehicles, sandbags is a
 * sandbag wall on open ground or sandbags in the windows of a building the side holds, minefield an AP field.
 */
export type BuildableId = 'wire' | 'foxhole' | 'trench' | 'pillbox' | 'tankTrap' | 'roadBlock' | 'sandbags' | 'minefield';
