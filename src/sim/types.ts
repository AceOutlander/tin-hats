/**
 * Public types of the simulation: configuration, commands, the battle state
 * the view reads, and the events it listens to.
 *
 * Conventions
 * - Distances are world units (wu), times are seconds, x runs 0..state.length.
 * - Side 0 owns the left HQ and faces +x; side 1 owns the right HQ and faces -x.
 * - Everything in BattleState is READ-ONLY for the view. Objects are pooled and
 *   reused: never keep a reference to a unit or an event across ticks without
 *   re-checking `alive` and `id`.
 * - Fields marked "internal" are sim bookkeeping; the view may read but should not need them.
 */
import type {
  BuildableId,
  DamageType,
  Difficulty,
  FactionId,
  MissionDef,
  MissionMode,
  ObjectiveDef,
  Order,
  Side,
  SupportKind,
  TimeOfDay,
  UnitAction,
  UnitDef,
  UnitKind,
  UpgradeDef,
  UpgradeLevels,
  WeaponDef,
  WeatherKind,
} from '../data/schema';

// ---------------------------------------------------------------------------
// Configuration and commands
// ---------------------------------------------------------------------------

/**
 * Who issues commands for a side.
 * human = nobody inside the sim (the app calls battle.command);
 * ai = the AI commander following mission.ai, scaled by the difficulty;
 * bot = the same commander following mission.bot with no difficulty scaling (the "reasonable player" of the tests);
 * idle = never issues a command.
 */
export type CommanderKind = 'human' | 'ai' | 'bot' | 'idle';

export interface BattleConfig {
  mission: MissionDef;
  difficulty: Difficulty;
  /** Any integer. The same config, seed and command stream give the same battle bit for bit. */
  seed: number;
  /** Quartermaster upgrade levels by upgrade id. Applied to side 0 only. */
  upgrades: UpgradeLevels;
  /** Commander of side 0 and of side 1. */
  commanders: [CommanderKind, CommanderKind];
  /**
   * The upgrade definitions `upgrades` refers to. Omitted = UPGRADES from src/data/upgrades.ts;
   * an empty list = upgrades have no effect.
   */
  upgradeDefs?: readonly UpgradeDef[];
}

/**
 * A request from a commander. Queued by battle.command() and applied at the
 * start of the next tick. Invalid commands (cannot afford, population full,
 * queue full, unit not available in this mission, battle over) are dropped silently.
 */
export type Command =
  /** Queue one unit. Cost and population are paid immediately. */
  | { type: 'train'; kind: UnitKind }
  /**
   * Change the army-wide order, or with `kind` give that unit kind its own order (an override that the
   * army-wide order does not clear). Instant and free.
   */
  | { type: 'order'; order: Order; kind?: UnitKind }
  /** Clear one kind's override so it follows the army order again, or every override when `kind` is left out. */
  | { type: 'followArmy'; kind?: UnitKind }
  /**
   * Call a support at world x (clamped to the map). Dropped unless the mission offers it to this
   * side and its cooldown is 0. Starts the cooldown and emits supportCalled.
   */
  | { type: 'support'; kind: SupportKind; x: number }
  /**
   * Take direct control of the unit with this unique `id` (not the pool index), or -1 to release.
   * Dropped unless it is a living, controllable unit of this side on the field (not a sapper, not in
   * the HQ). Taking another unit releases the previous one: one unit per side at a time.
   */
  | { type: 'control'; unit: number }
  /**
   * Stick and buttons for the controlled unit; they stay in force until the next controlInput.
   * moveX -1..1 (clamped); fire = the fire button is held; ability = the ability button was pressed
   * (a one-off press, used on the next tick).
   */
  | { type: 'controlInput'; moveX: number; fire: boolean; ability: boolean }
  /**
   * Prep phase only: place a build site centred on world x. Dropped unless the mission offers this buildable, the spot
   * is in the side's build zone and clear of structures and other sites, and the side can pay (paid now).
   */
  | { type: 'build'; kind: BuildableId; x: number }
  /** Take back an unfinished build site of this side by its id; its money comes back in full. */
  | { type: 'cancelBuild'; site: number }
  /** End the prep phase now (the "Ready" button). */
  | { type: 'ready' }
  /**
   * Where trained units walk out (the "Deploy at" chip, FOUNDATIONS.md 4.5): 'auto' = the forward-most owned,
   * uncontested spawn point (the default), 'hq' = the HQ door, or an index into state.points. Sappers always use the HQ.
   */
  | { type: 'deploy'; at: 'auto' | 'hq' | number };

/**
 * An admin panel action (src/sim/admin.ts). Not a command: battle.admin() applies it at once, between ticks, so it
 * works while the battle is paused or frozen. `side: -1` means both sides; `unit` (a unique id) narrows an action to
 * one unit. Admin spawns ignore the population cap (only the unit pool limits them).
 */
export type AdminAction =
  /** `count` units of `kind` at world x for `side`, one spacing apart going back; veterans with `veteran`. */
  | { type: 'spawn'; side: Side; kind: UnitKind; x: number; count: number; veteran?: boolean }
  /** Kill one unit, every unit of a side, or every unit (invincibility does not stop it). */
  | { type: 'kill'; side: Side | -1; unit?: number }
  /** Back to full health: one unit, a side, or everyone. */
  | { type: 'heal'; side: Side | -1; unit?: number }
  /** One unit's own flag, or a whole side's (which covers its future units too). */
  | { type: 'invincible'; side: Side | -1; unit?: number; on: boolean }
  | { type: 'hqInvincible'; side: Side; on: boolean }
  /** Units of the other side on the field (one by id, or all) change sides and join `side`, keeping their health. */
  | { type: 'takeOver'; side: Side; unit?: number }
  /** End the battle now with this winner (endReason 'admin'). */
  | { type: 'end'; winner: Side }
  | { type: 'setSupplies'; side: Side; amount: number }
  /** Hold the side's supplies at `amount` after every tick (frozen or infinite supplies); null lets them run again. */
  | { type: 'holdSupplies'; side: Side; amount: number | null }
  /** Units in training finish on the next tick. */
  | { type: 'instantTrain'; side: Side; on: boolean }
  /** Units of `kind` walk out until the side's population reaches its cap. */
  | { type: 'fillArmy'; side: Side; kind: UnitKind }
  /** Fire the mission's scripted event with this index now (a one-shot event will not fire again). */
  | { type: 'fireEvent'; index: number }
  /** The mission director moves to the phase with this id now, after putting its PhaseDef.assume in place. */
  | { type: 'jumpPhase'; phase: string }
  /** Scripted weather and time of day change now, over `over` seconds (default 0), as the weather and time events. */
  | { type: 'sky'; weather?: WeatherKind; time?: TimeOfDay; over?: number };

/** What an AI commander is up to, for the admin panel's debug view. Null from battle.inspectAi for a human side. */
export interface AiReport {
  commander: CommanderKind;
  order: Order;
  /** Difficulty aggression (1 for the bot). */
  aggression: number;
  /** Units its build plan and reactions want right now, per kind (kinds it wants none of are left out). */
  wants: Partial<Record<UnitKind, number>>;
  /** Seconds since its last order change, and since its current Advance first met the enemy (-1 while not in contact). */
  sinceOrder: number;
  sinceContact: number;
  /** Seconds before its first Advance is allowed (the plan's firstAttackAfter). */
  firstAttackAfter: number;
}

/** Which parts of the design the sim currently simulates. The app guards its UI on these. */
export interface SimFeatures {
  trenches: boolean;
  pillboxes: boolean;
  wire: boolean;
  /** Lobbed and direct projectiles with splash. While false, such weapons resolve as an instant hit roll. */
  projectiles: boolean;
  directControl: boolean;
  supports: boolean;
  /** Scripted mission events (hints, announcements, airdrops, waves) and the mission timer. */
  events: boolean;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/**
 * How a unit relates to its side's order: army = obeys it; guard = holds its post; assault = always
 * advances; garrison = holds the trench it was placed in until that trench falls, then joins the army.
 */
export type Behaviour = 'army' | 'guard' | 'assault' | 'garrison';

/** Why the battle ended. `none` while it is still running. */
export type EndReason =
  | 'none'
  /** An HQ was destroyed; `winner` is the other side. */
  | 'hqDestroyed'
  /** A survival timer ran out; side 0 wins. */
  | 'timerSurvived'
  /** A deadline timer ran out; side 1 wins. */
  | 'timerExpired'
  /** Both HQs fell in the same tick; `winner` is -1. */
  | 'draw'
  /** The mission director's last phase was completed; side 0 wins. */
  | 'objectives'
  /** A phase's loss condition happened (a point lost, the enemy through, a structure lost); side 1 wins. */
  | 'objectiveFailed'
  /** The enemy gave up (a surrender objective); side 0 wins. */
  | 'surrender'
  /** A scripted endMission event ended it; `winner` is the side it named. */
  | 'scripted'
  /** The admin panel ended it (AdminAction 'end'); `winner` is the side it chose. */
  | 'admin';

/** Kinds of thing an event or a weapon mount can point at. */
export type EntityKind = 'none' | 'unit' | 'hq' | 'pillbox' | 'trench' | 'wire' | 'ground' | 'building';

/** Numeric target codes used by MountState.targetType. */
export const TARGET_NONE = 0;
export const TARGET_UNIT = 1;
export const TARGET_HQ = 2;
export const TARGET_PILLBOX = 3;
/** Damage queue only (no mount aims at one): the walls of state.buildings[targetIndex]. */
export const TARGET_BUILDING = 4;

/** One weapon on a unit, an HQ or a pillbox, and what it is doing. */
export interface MountState {
  /** The weapon, or null for an empty mount (unarmed unit, no secondary). */
  weapon: WeaponDef | null;
  /** internal: index of the weapon in the sim's weapon tables, -1 if none. */
  weaponIndex: number;
  /** What it is aiming at: TARGET_NONE, TARGET_UNIT, TARGET_HQ or TARGET_PILLBOX. */
  targetType: number;
  /** Unit pool index, HQ side, or index into state.pillboxes, depending on targetType; -1 if none. */
  targetIndex: number;
  /** For unit targets, the target's unique id (guards against a reused pool slot); otherwise -1. */
  targetId: number;
  /** World x of the target while it has one (last known otherwise). */
  aimX: number;
  /** Seconds of settling left before it may fire at the current target. */
  aim: number;
  /** Seconds of reload left; 0 = ready. */
  cooldown: number;
  /** Shots left in the burst in progress; 0 when not mid-burst. */
  burstLeft: number;
  /** internal: seconds until the next shot of the burst. */
  burstTimer: number;
  /** Seconds since this mount last fired (large if it never has). */
  sinceShot: number;
  /** Thrown weapons: seconds until the round leaves the hand (the unit is in 'throw'); 0 otherwise. */
  windup: number;
  /**
   * internal: the owner's world x, damage multiplier and reload-speed multiplier for this tick.
   * The owner writes them before sensing and firing so the hot path passes no doubles around
   * (see the allocation note in combat.ts).
   */
  x: number;
  damageMul: number;
  rateMul: number;
  /**
   * internal: false holds fire: the mount keeps its target and settles its aim but does not shoot
   * (a directly controlled unit whose fire button is up). True for every other mount.
   */
  trigger: boolean;
  /** internal: this shooter's fixed 0..1 offset for fire distribution (config.targetSpread); 0 for structures. */
  spread: number;
  /** internal: multiplier on this mount's hit chance (veteran troops; divides the scatter of shells). 1 normally. */
  accuracy: number;
  /** internal: multiplier on the weapon's range (a man on a building's upper floor). 1 normally. */
  rangeMul: number;
  /** internal: multiplier on its damage to vehicles (an anti-tank weapon on a tall building's top floor). 1 normally. */
  vehicleMul: number;
}

/**
 * One soldier or vehicle. Lives in the fixed pool `state.units`; a slot is
 * reused after its unit dies, so match on `id`, not on the pool index, when
 * tracking a unit across ticks.
 */
export interface UnitState {
  /** Pool slot: `state.units[index] === this`. Stable while the unit is alive. */
  index: number;
  /** Unique within the battle, never reused, increases with spawn order. */
  id: number;
  /** False for free pool slots; every other field of a dead slot is stale. */
  alive: boolean;
  kind: UnitKind;
  side: Side;
  faction: FactionId;
  /** The unit's data definition (UNITS[kind]). */
  def: UnitDef;
  behaviour: Behaviour;

  /** Position after this tick. */
  x: number;
  /** Position before this tick: interpolate prevX to x when drawing. Equal to x on the spawn tick. */
  prevX: number;
  /** Signed speed this tick in wu/s ((x - prevX) * tickRate); 0 when standing. */
  velX: number;
  /** Depth row 0..config.rows-1 (0 = farthest from the camera). Visual only; fixed for the unit's life. */
  row: number;
  /** 1 = facing +x, -1 = facing -x. Follows movement, else the target, else the enemy. */
  facing: number;

  hp: number;
  maxHp: number;

  /**
   * What the unit is doing; drives the animation. `inside` = garrisoned in the HQ: do not draw, cannot be hit.
   * `deploy` = a crew weapon (lmg, mortar) setting up after the unit stopped; `throw` = a grenade throw
   * (it leaves the hand config.throwReleaseTime into the action, which lasts config.throwPoseTime);
   * `heal` = a medic treating the unit at `aimX`.
   */
  action: UnitAction;
  /** Seconds the unit has been in `action` (0 on the tick it changes). */
  actionTime: number;
  /** True while garrisoned in the HQ under Fall Back (always together with action 'inside'). */
  inside: boolean;
  /** Supplies a sapper is carrying (draw the crate when > 0); 0 otherwise. */
  carrying: number;
  /** Id of the trench the unit occupies (it has dropped into a slot and has cover), or -1. A building's slots are a trench record (TrenchState.building). */
  trenchId: number;
  /** Floor of the building slot it holds or is walking to (0 = ground floor; 0 for a trench slot or none). */
  floor: number;
  /** internal: damage-matrix column while it holds a slot (trench, building or rubble; see unitClass in tables.ts). */
  coverClass: number;
  /**
   * True while the player directly controls this unit: it ignores orders, walks with the stick
   * (front-clamped), fires while the fire button is held (crew weapons still set up first) and gets
   * config.controlDamageMul / controlReloadMul.
   */
  controlled: boolean;

  /** World x of what the unit is aiming at (or, for a medic, the man it is healing); equal to x when it has neither. */
  aimX: number;
  /** Primary weapon readiness 0..1 (1 = ready to fire, rises from 0 during the reload). 1 for unarmed units. */
  weaponCharge: number;
  /** Primary weapon (rifle, tank gun...). `mount.weapon` is null for unarmed units. */
  mount: MountState;
  /** Secondary weapon (grenade, coaxial MG), sensed and fired independently of the primary. */
  mount2: MountState;

  /** internal: index of `kind` in the sim's kind tables. */
  kindIndex: number;
  /** internal: true while standing to fight its target instead of moving. */
  engaged: boolean;
  /** internal: where the unit wants to walk this tick. */
  goalX: number;
  /** internal: speed in wu/s it walks at this tick (set together with goalX). */
  moveSpeed: number;
  /** Id of the build site this sapper works on (prep phase), -1 for none: he walks there instead of hauling. */
  site: number;
  /** internal: sapper task (0 walking to the dump, 1 loading, 2 carrying back). */
  task: number;
  /** internal: seconds left in the current task (sapper loading). */
  taskTime: number;
  /** internal: formation cell held in the side's hold formation, -1 for none. */
  cell: number;
  /** internal: columns the unit occupies in the formation grid. */
  cellSpan: number;
  /** internal: distance of the formation cell behind the hold line. */
  slotDepth: number;
  /** internal: fixed 0..1 value per unit, used to stagger stopping distances so units do not stack. */
  jitter: number;
  /** internal: how far a guard may move from its post (ForceDef.leash; config.guardLeash by default, 0 = frozen). */
  leash: number;
  /** internal: the post a guard or garrison unit returns to. */
  postX: number;
  /** internal: index into state.trenches of the trench a garrison unit holds, -1 for none. */
  postTrench: number;
  /** internal: index into state.trenches of the trench slot it holds or is walking to, -1 for none. */
  trench: number;
  /** internal: global trench slot index it holds or is walking to, -1 for none. */
  slot: number;
  /** internal: seconds of crew-weapon set-up left (weapon.setupTime after it last moved). */
  setup: number;
  /** internal: battle time it last took damage. */
  hitTime: number;
  /** internal: medics: pool index and id of the unit being healed, -1 for none. */
  healIndex: number;
  healId: number;

  /** Veteran (the King Tiger's escort): more health and a better hit chance (config.veteran). Draw the elite marker. */
  veteran: boolean;
  /**
   * The look its force named (ForceDef.look: a `kv2`, a `stug3f`, the `romanian` look), '' = its era's look for the
   * kind (src/data/eras.ts). Names and art only; the sim never reads it.
   */
  look: string;
  /** internal: multiplier on hit chance (config.veteran.accuracyMul for veterans, else 1). */
  accuracy: number;
  /**
   * Riding in an APC: pool index and id of the carrier, -1 otherwise. A passenger is `inside` (action
   * 'inside': not drawn, cannot be hit) but does not count in the HQ garrison; it moves with the carrier.
   */
  carrier: number;
  carrierId: number;
  /** APC: men aboard (draw them riding, or a loaded hull); 0 for everyone else. */
  passengers: number;
  /** internal: battle time until which a man burned out of a trench may not take a slot again. */
  flushedUntil: number;
  /** internal: anti-aircraft gun: seconds until it may fire at a plane again. */
  aaCooldown: number;
  /** Admin panel: this unit takes no damage (its side's cheats.invincible covers every unit of the side). */
  invincible: boolean;
  /** Ski troops (ForceDef.tags `skis`): deep snow does not slow them. */
  skis: boolean;
  /** internal: Fall Back: index into state.points of the rally point it is heading for or holds, -1 for none (the HQ). */
  rally: number;
}

/** Admin panel cheats in force on one side (AdminAction). All off in a normal battle. */
export interface SideCheats {
  /** No unit of the side takes damage. */
  invincible: boolean;
  /** The side's HQ takes no damage. */
  hqInvincible: boolean;
  /** Supplies are put back to this after every tick; -1 = not held. */
  holdSupplies: number;
  /** Units in training finish on the next tick. */
  instantTrain: boolean;
}

/** A side's headquarters bunker. */
export interface HqState {
  side: Side;
  /** Centre of the bunker. */
  x: number;
  /** The door, on the side facing the enemy: units spawn and retreat here, enemy fire lands here. */
  doorX: number;
  /** Muzzle of the HQ machine gun. */
  gunX: number;
  hp: number;
  maxHp: number;
  /** False once destroyed (the battle ends on the same tick). */
  alive: boolean;
  /** Units currently inside under Fall Back. */
  garrison: number;
  /** The HQ machine gun. `gun.aimX` is where it points; `gun.burstLeft > 0` or a small `gun.sinceShot` means it is firing. */
  gun: MountState;
  /** The mission's HQ look (SideStart.hqLook), '' for the side's upgrade look. Names and art only. */
  look: string;
}

/** Running totals per side, shown on the result screen. */
export interface SideStats {
  /** Units that finished training (sappers included). */
  trained: number;
  /** Own units killed. */
  lost: number;
  /** Enemy units killed by this side. */
  kills: number;
  /** Enemy units killed by this side, per kind of the unit killed. */
  killsByKind: Record<UnitKind, number>;
  /** Own units lost, per kind (whoever killed them): the director's kill objectives count these. */
  lostByKind: Record<UnitKind, number>;
  /** All supplies earned: passive income, sapper deliveries and airdrops (starting supplies excluded). */
  suppliesGathered: number;
  /** Supplies spent on training. */
  suppliesSpent: number;
  /** Total damage dealt to enemy units and structures. */
  damageDealt: number;
}

/** Everything about one side. The Record fields have one fixed key per unit or support kind. */
export interface SideState {
  side: Side;
  faction: FactionId;
  commander: CommanderKind;
  /** False for survival attackers: no HQ, no economy, no training. */
  hasHq: boolean;
  /** Current supplies. Fractional: floor it for display. */
  supplies: number;
  /** Estimated income in supplies per second (passive plus working sappers). */
  income: number;
  /** Population in use: living units plus queued units. Never above popCap. */
  pop: number;
  popCap: number;
  /**
   * Population kept free for scripted reinforcements that arrived while the side was at its cap; they
   * wait at the HQ and walk out as room frees up. Training needs pop + reservePop + its own pop <= popCap.
   */
  reservePop: number;
  /** The current army-wide order. */
  order: Order;
  /** Per-kind override of the army order, or null where that kind follows the army. See orderFor(). */
  kindOrders: Record<UnitKind, Order | null>;
  /** Unit kinds this side may train in this mission. */
  available: Record<UnitKind, boolean>;
  /** Units waiting or in training, per kind. */
  queue: Record<UnitKind, number>;
  /** 0..1 progress of the unit in training, per kind; 0 when that queue is empty. */
  progress: Record<UnitKind, number>;
  /** Living units per kind (on the field or inside the HQ). */
  alive: Record<UnitKind, number>;
  /** Supports this side may call in this mission. */
  supportAvailable: Record<SupportKind, boolean>;
  /** Seconds until each support is ready again; 0 = ready. */
  supportCooldown: Record<SupportKind, number>;
  /** The full cooldown each support starts when called: its data cooldown over the side's upgrade (fixed per battle). */
  supportCooldownFull: Record<SupportKind, number>;
  /** The HQ, or null if the side has none. Stays non-null (with alive false) after it is destroyed. */
  hq: HqState | null;
  /** World x of the line the army holds under Hold. */
  holdLineX: number;
  /** Pool index of the unit under direct control, or -1. */
  controlled: number;
  stats: SideStats;
  /** Admin panel cheats (all off unless the panel turned them on). */
  cheats: SideCheats;
  /**
   * Where trained units walk out (the training bar's "Deploy at" chip, FOUNDATIONS.md 4.5): DEPLOY_AUTO (the
   * forward-most owned, uncontested spawn point, else the HQ; the default, and what the AI and the test bot use),
   * DEPLOY_HQ, or an index into state.points (while that point is available; otherwise as DEPLOY_AUTO).
   */
  deploy: number;
  /** Where the next trained unit will walk out this tick: an index into state.points, or -1 for the HQ door. */
  deployPoint: number;
}

/** SideState.deploy: the forward-most available spawn point (the default). */
export const DEPLOY_AUTO = -1;
/** SideState.deploy: always the HQ door. */
export const DEPLOY_HQ = -2;

/**
 * A capture point (MissionDef.capturePoints, FOUNDATIONS.md 4.5). A side takes it by holding its zone alone for
 * captureTime (or with its structure, the trench way); while owned and uncontested it is a spawn and rally point.
 */
export interface CapturePointState {
  id: string;
  label: string;
  /** Centre and width of the zone. */
  x: number;
  width: number;
  /** -1 nobody, else the owning side. */
  owner: number;
  captureTime: number;
  spawn: boolean;
  /** CapturePointDef.spawnFor, or -1 for whichever side owns it. */
  spawnFor: number;
  contestRadius: number;
  /** Index into state.trenches of its structure's trench (a building's stand-in until buildings exist), -1 for none. */
  trench: number;
  /** The side taking it now (alone in the zone), -1 for none. */
  capturing: number;
  /** 0..1 of captureTime done by `capturing`. */
  progress: number;
  /** An armed unit of the side that does not own it stands within contestRadius. */
  contested: boolean;
  /** Battle time of the last change of owner, -1 if it never changed. */
  capturedAt: number;
}

/**
 * A trench line. Its slots sit config.trenchSlotSpacing apart (narrower if the trench is) around x.
 * Infantry that drop into a slot count as `infantryTrench`. Infantry of the side that does not own it
 * capture it by walking in while no living enemy occupies it (trenchCaptured); ownership persists when empty.
 */
export interface TrenchState {
  id: number;
  /** Centre and width. */
  x: number;
  width: number;
  slots: number;
  /** -1 unowned, else the owning side. */
  owner: number;
  /** Units currently in it. */
  occupants: number;
  /** Battle time of the last change of owner, -1 if it never changed. */
  capturedAt: number;
  /** Index into state.buildings when these are a building's (or cover prop's) slots, -1 for a trench. */
  building: number;
}

/**
 * A building or cover prop (FOUNDATIONS.md 4.3; src/sim/buildings.ts). Its window slots are the slot record
 * state.trenches[trench] (id BUILDINGS.idBase + id), so occupancy, capture, garrisons and the hold line work as a
 * trench's; owner and occupants are that record's. Slots run floor by floor, ground floor first.
 */
export interface BuildingState {
  id: number;
  x: number;
  width: number;
  /** Floors it was built with, and floors still standing (0 once rubble). */
  floors: number;
  floorsLeft: number;
  slotsPerFloor: number;
  hp: number;
  maxHp: number;
  look: string;
  /** Index of its slot record in state.trenches. */
  trench: number;
  /** -1 unowned, else the owning side (a copy of the slot record's, kept each tick). */
  owner: number;
  /** Men in its slots (a copy of the slot record's). */
  occupants: number;
  /** Infantry of each side inside its span this tick. */
  inside: [number, number];
  /** True when infantry of a side that does not own it are inside its span while its owner holds it. */
  contested: boolean;
  /** Fallen: its men are in rubble (rubbleCover), half as many slots, no floors. */
  rubble: boolean;
  /** A cover prop (wagons, a wreck): rubble cover from the start that takes no damage. */
  prop: boolean;
  /** The walls take damage (BuildingDef.collapse is not 'none'). */
  breakable: boolean;
  /** Also a spawn point while owned. */
  spawn: boolean;
  /** Battle time of the last hit on its walls, -1 if never. */
  hitAt: number;
}

/** A pillbox: target class `fortification`, a machine gun, and a blocker while alive. Destroyed = rubble with no effect. */
export interface PillboxState {
  id: number;
  x: number;
  side: Side;
  hp: number;
  maxHp: number;
  /** False once destroyed (stays in the list as rubble). */
  alive: boolean;
  gun: MountState;
}

/**
 * A belt of barbed wire: slows the other side's infantry inside it to config.wireSlow of their speed,
 * loses health only to explosive splash (from either side), and is crushed by enemy tanks driving over it.
 */
export interface WireState {
  id: number;
  x: number;
  width: number;
  owner: Side;
  hp: number;
  alive: boolean;
}

/** A supply dump: indestructible scenery where a side's sappers load. */
export interface DumpState {
  side: Side;
  x: number;
}

/**
 * A shell, rocket, grenade or bomb in flight (pool slots). It flies from fromX to toX in
 * flightTime and explodes there: an `explosion` event and splash damage that falls off linearly
 * to weapon.splashRadius from the edge of each target's footprint.
 */
export interface ProjectileState {
  alive: boolean;
  /** Unique id, increases with spawn order. */
  id: number;
  side: Side;
  weapon: WeaponDef | null;
  /** Launch point, landing point and current position. */
  fromX: number;
  toX: number;
  x: number;
  prevX: number;
  /** Seconds flown and total flight time: lobbed shells draw an arc from age / flightTime. */
  age: number;
  flightTime: number;
  /** Depth row it was fired from. */
  row: number;
  /** internal: weapon table index, damage multiplier of the firer, and the depth row it lands on (-1 = ground). */
  weaponIndex: number;
  damageMul: number;
  targetRow: number;
  /** internal: extra multipliers on its damage to an HQ and to vehicles (support call-ins; 1 otherwise). */
  hqMul: number;
  vehicleMul: number;
  /** internal: a call-in from an aircraft: its hits come from above (the armour facing rule does not apply). */
  top: boolean;
}

/** A smoke cloud (pool slots): blocks direct fire along any line that crosses it, see smokeBlocks. */
export interface SmokeState {
  alive: boolean;
  x: number;
  radius: number;
  /** Seconds left and total lifetime. */
  timeLeft: number;
  duration: number;
}

/** The mission clock, when the mission has one. */
/** A defensive mission's prep phase (src/sim/prep.ts). */
export interface PrepState {
  /** True until the countdown runs out or the player is ready. */
  active: boolean;
  secondsLeft: number;
  total: number;
  /** Battle time it ended, or -1 while it runs. The mission clock and events count from here. */
  endedAt: number;
  /** Battle time it began: 0 for a prep phase at the mission start, later for one at a phase's start. */
  startedAt: number;
  /** Seconds of the earlier prep phases of this battle (the mission clock leaves them out too). */
  before: number;
  /** What may be built. */
  buildables: BuildableId[];
  /** Side 0's build zone (side 1 never builds). */
  zoneFrom: number;
  zoneTo: number;
}

/**
 * A fortification being built: no protection until done. One sapper works on it at a time; when its progress reaches
 * 1 it becomes the structure (a trench, a pillbox or a wire belt) and leaves this list.
 */
export interface BuildSiteState {
  id: number;
  kind: BuildableId;
  side: Side;
  x: number;
  width: number;
  /** 0..1. */
  progress: number;
  /** Pool index of the sapper working on it, -1 for none yet. */
  worker: number;
  workerId: number;
  /** Money paid for it (given back on a cancel). */
  cost: number;
}

/** A flare in the sky (MissionEventDef 'flare'): visibility 1 over [x0, x1] from `from` until `until` (battle times). */
export interface FlareState {
  x: number;
  x0: number;
  x1: number;
  /** Who fired it, and its colour (the view's). */
  side: Side;
  color: 'white' | 'green';
  from: number;
  until: number;
}

/** Scripted weather and time of day (FOUNDATIONS.md 4.7; src/sim/sky.ts). Plain data. */
export interface SkyState {
  /** The mission scripts its weather (MissionDef.weather or a weather event): the view's random rain stays off. */
  scripted: boolean;
  /** The weather and time of day the sim uses now (a change takes effect at the midpoint of its transition). */
  weather: WeatherKind;
  time: TimeOfDay;
  /** The latest weather change: from, to, its start (battle time) and length in seconds (0 = at once). The view crossfades by these. */
  weatherFrom: WeatherKind;
  weatherTo: WeatherKind;
  weatherStart: number;
  weatherOver: number;
  /** The latest change of the time of day, the same way. */
  timeFrom: TimeOfDay;
  timeTo: TimeOfDay;
  timeStart: number;
  timeOver: number;
  /** The mission's visibility at night (MissionDef.nightVisibility or the default). */
  nightVisibility: number;
  /** Derived from weather and time: the share of a direct weapon's range it may pick targets at (away from flares). */
  visibility: number;
  /** Derived: speed multiplier for men on foot, and the multiplier on every weapon's accuracyFar (the blizzard). */
  infantrySpeed: number;
  accuracyFar: number;
  /** Flares burning now. */
  flares: FlareState[];
}

export interface TimerState {
  secondsLeft: number;
  total: number;
  /** Fraction of the clock used up, 0 at the start to 1 when it runs out (the view darkens a deadline sky by it). */
  progress: number;
  /** win = side 0 wins when it runs out (survival); lose = side 0 loses (deadline). */
  onExpire: 'win' | 'lose';
  label: string;
}

export interface BattleState {
  /** Ticks simulated so far. */
  tick: number;
  /** tick / tickRate, in seconds. */
  time: number;
  /** Battlefield length in wu. */
  length: number;
  mode: MissionMode;
  /** True once the battle has ended; step() does nothing afterwards. */
  over: boolean;
  /** The winning side, or -1 while running and for a draw. */
  winner: number;
  endReason: EndReason;
  sides: [SideState, SideState];
  /**
   * The unit pool. Fixed length; check `alive`. Only indices below `unitCount`
   * can be alive, so loop `for (i = 0; i < state.unitCount; i++)`.
   */
  units: UnitState[];
  /** One past the highest pool index in use. */
  unitCount: number;
  /** Projectile pool (check `alive`). */
  projectiles: ProjectileState[];
  /** Smoke pool (check `alive`). */
  smokes: SmokeState[];
  trenches: TrenchState[];
  pillboxes: PillboxState[];
  wires: WireState[];
  /** Capture points (MissionDef.capturePoints), in the mission's order; empty for a mission with none. */
  points: CapturePointState[];
  /** Buildings and cover props, in mission order (buildings first). */
  buildings: BuildingState[];
  /** Supply dump of side 0 and side 1; null for a side with no HQ. */
  dumps: [DumpState | null, DumpState | null];
  /** The mission timer, or null. */
  timer: TimerState | null;
  /** The prep phase of a defensive mission, or null for a mission without one. */
  prep: PrepState | null;
  /** Build sites not yet finished (placed in the prep phase), in the order placed. */
  sites: BuildSiteState[];
  /** The mission director: the current phase, its objectives, the side objectives (src/sim/director.ts). */
  director: DirectorState;
  /** Scripted weather and time of day (src/sim/sky.ts). */
  sky: SkyState;
}

/** One objective of the current phase, as the objective plate shows it. */
export interface ObjectiveState {
  id: string;
  type: ObjectiveDef['type'];
  /** The plate's line ("Tanks destroyed", "Hold the summit"). */
  text: string;
  /** Progress toward `target`: a count, or seconds for hold and survive. */
  value: number;
  target: number;
  /** count = "7 / 12"; seconds = a countdown of target - value; flag = done or not. */
  unit: 'count' | 'seconds' | 'flag';
  done: boolean;
  /** internal (hold): phase time since the point has been held without a break, -1 while not held. */
  since: number;
}

/** A side objective (pause and end screens). */
export interface SideObjectiveState {
  id: string;
  text: string;
  bonus: number;
  /** open while it can still be earned; done once earned for good (or at a win); failed for good. */
  status: 'open' | 'done' | 'failed';
  /** internal: index into the mission's phases where its failIf stops being watched (`until`), or -1. */
  untilPhase: number;
  /** internal: what its failIf keeps from its start (side 0's losses for `lost`; 1 once side 0 held a point). */
  base: number;
  /** Progress of its objective, or null when it has none. */
  progress: ObjectiveState | null;
  /** True once its objective was done (in time). */
  met: boolean;
}

/** A scripted barrage in progress (MissionEventDef 'barrage'). */
export interface BarrageState {
  side: Side;
  x: number;
  spread: number;
  rounds: number;
  fired: number;
  /** Battle time of the first round and seconds between rounds. */
  start: number;
  interval: number;
  /** Index into the sim's weapon tables. */
  weapon: number;
  /** 1 when the rounds come down from above (bombs). */
  top: number;
}

/** The mission director's state (FOUNDATIONS.md 3; src/sim/director.ts). Plain data. */
export interface DirectorState {
  /** Index of the current phase in the mission's phases, its id and title, and how many phases there are. */
  phase: number;
  phaseId: string;
  title: string;
  count: number;
  /** Mission time the current phase began (its own prep, which stops the mission clock, does not count). */
  startedAt: number;
  /** Mission time each phase began, by phase id (scoring times a mission from one of them). */
  phaseStarts: Record<string, number>;
  objectives: ObjectiveState[];
  /** Every side objective begun so far, in order. */
  side: SideObjectiveState[];
  /** Mission time each objective and side objective was done, by id. */
  doneAt: Record<string, number>;
  /** internal: side 0's losses (of the condition's kinds) when each loss condition of the phase began. */
  lossBase: number[];
  /** The phase's own clock, or null. */
  timer: TimerState | null;
  /** Per side: the AI posture (posture events) and the mission time a counter-attack ends (-1 = no end). */
  posture: ['free' | 'hold' | 'counterattack', 'free' | 'hold' | 'counterattack'];
  postureUntil: [number, number];
  /** Per side: the mission's own income multiplier and difficulty, before income events. */
  incomeBase: [number, number];
  barrages: BarrageState[];
  /** The disguise in force (MissionEventDef 'disguise'): side -1 = none; battle times. */
  disguiseSide: number;
  disguiseX0: number;
  disguiseX1: number;
  disguiseFrom: number;
  disguiseUntil: number;
  /** Why the director ended the battle (the closing announcement of a surrender, or the loss), or null. */
  endText: string | null;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type SimEventType =
  | 'shot'
  | 'projectile'
  | 'explosion'
  | 'unitSpawned'
  | 'unitDied'
  | 'unitHit'
  | 'structureHit'
  | 'structureDestroyed'
  | 'trenchCaptured'
  | 'wireDestroyed'
  | 'supplyDelivered'
  | 'trainStarted'
  | 'trainDone'
  | 'orderChanged'
  | 'supportCalled'
  | 'supportIncoming'
  | 'smokeSpawned'
  | 'wave'
  | 'airdrop'
  | 'announce'
  | 'hint'
  | 'controlLost'
  | 'battleEnded'
  | 'speech'
  | 'bossArrived'
  | 'planePass'
  | 'planeDown'
  | 'reconReveal'
  | 'apcUnload'
  | 'ignite'
  | 'buildStarted'
  | 'buildDone'
  | 'prepEnded'
  | 'phaseStarted'
  | 'banner'
  | 'objectiveDone'
  | 'pointCaptured'
  /** A building lost its top floor (targetIndex = index in state.buildings, value = floors left, x = its centre). */
  | 'floorCollapsed';

/**
 * One event. A flat pooled record: every event has every field, and a field an
 * event type does not list below holds its default (-1 for side, unit, unitId,
 * targetIndex and the rows; 0 for numbers; false; null; 'none').
 *
 * Fields per type ("unit, unitId, kind" = pool index, unique id and kind of the unit concerned):
 *
 * shot              One bullet or shell fired; draw a tracer and a muzzle flash whether it hit or not.
 *                   side = shooter's side; source = 'unit' | 'hq' | 'pillbox';
 *                   unit, unitId, kind = the shooter when source is 'unit';
 *                   weapon = weapon id (WEAPONS[weapon] has tracer and sound);
 *                   x, row = muzzle position (row -1 when a structure fires);
 *                   x2, row2 = target position (row2 -1 for a structure target);
 *                   target = 'unit' | 'hq' | 'pillbox', targetIndex = unit pool index, HQ side, or pillbox index;
 *                   hit = whether it hit; dir = sign of x2 - x.
 *                   Direct and lobbed weapons also emit `shot` (hit false; x2 = the aim point) and, in the
 *                   same step, a `projectile` event with the real landing point.
 * projectile        A shell, rocket, grenade or bomb left the launcher. side, weapon, x, row = launch;
 *                   x2 = landing point, row2 = depth row it lands on (-1 = ground); value = flight time in seconds;
 *                   targetIndex = projectile pool index; source = 'unit' | 'hq' | 'pillbox' | 'none' (a call-in),
 *                   with unit, unitId, kind = the firer when source is 'unit'; dir = sign of x2 - x.
 * explosion         A projectile landed. side = firer's side, x = centre, row = depth row (-1 = ground),
 *                   value = splash radius, weapon, cause = damage type.
 * unitSpawned       A unit appeared. side, unit, unitId, kind, x, row;
 *                   value = 1 if it was trained, 0 if a mission event or the mission start placed it;
 *                   hit = true if it appeared inside the HQ (trained under Fall Back) and is not on the field yet.
 * unitDied          side = victim's side, unit, unitId, kind, x, row; cause = damage type that killed it;
 *                   dir = direction the blow travelled (+1 = toward +x, so the body falls that way);
 *                   targetIndex = side that made the kill, -1 if none.
 * unitHit           A unit took damage and survived. side, unit, unitId, kind, x, row, value = damage, cause, dir.
 * structureHit      target = 'hq' | 'pillbox' | 'building', targetIndex = HQ side, pillbox or building index,
 *                   side = owner (-1 for an unowned building), x = impact point, value = damage, cause, dir.
 * structureDestroyed  target, targetIndex, side = owner, x. A building's ('building', its index) falls to rubble.
 * floorCollapsed    A building lost its top floor. targetIndex = its index in state.buildings, value = floors still
 *                   standing, side = owner, x = its centre.
 * trenchCaptured    side = new owner, targetIndex = trench id, x = trench centre, value = previous owner (-1 none).
 * pointCaptured     A capture point changed hands. side = new owner, targetIndex = index into state.points, x = its
 *                   centre, value = previous owner (-1 none), text = its label, hit = it is a structure (its
 *                   trenchCaptured came with it).
 * wireDestroyed     targetIndex = wire id, side = its owner, x = its centre, cause = 'explosive' (splash) or null (crushed).
 * supplyDelivered   A sapper reached the HQ door. side, unit, unitId, kind, x, row, value = supplies credited.
 * trainStarted      A unit was queued. side, kind, value = that kind's queue length afterwards.
 * trainDone         A unit finished training. side, kind, unit, unitId (a unitSpawned event follows).
 * orderChanged      side, order, kind = the unit kind given its own order (null = the army-wide order). When a
 *                   kind goes back to following the army (followArmy), order is the army order it now obeys.
 * supportCalled     A call-in was accepted (its cooldown starts). side, support, x = target centre,
 *                   value = seconds until the first round (SUPPORTS[support].delay), dir = the caller's
 *                   facing (+1 for side 0): shells come from and the aircraft flies that way.
 * supportIncoming   The rounds are about to arrive: emitted SUPPORTS[support].warning seconds before the
 *                   first round (on the call itself when warning >= delay). side, support, x, dir as above,
 *                   value = seconds until the first round. Artillery shells land at random within
 *                   x +- spread; air-strike rockets leave the aircraft in order along the strip from
 *                   x - dir * spread to x + dir * spread over `duration`; smoke appears at x (smokeSpawned).
 * smokeSpawned      side = who made it (-1 none), x, value = radius, x2 = lifetime in seconds.
 * wave              A scripted wave arrived. side, value = units spawned, text = announcement or null.
 * airdrop           Scripted supplies. side, value = supplies credited, x = where the crate lands (HQ door).
 * announce          text = banner text.
 * hint              text = tutorial hint.
 * controlLost       The controlled unit died (control simply ends, with no event, on a release or when
 *                   the battle ends). side, unit, unitId, kind, x, row.
 * battleEnded       side = winner (-1 for a draw), value = battle time in seconds; see state.endReason.
 *
 * New units and planes (contract, 2026-11-08). The contract's shorthand a/b/c/d maps onto the
 * existing named fields as listed here; consumers read these names.
 * speech            The commander speaks after an order. side, unit, unitId, kind ('commander'), x, row;
 *                   order = the order given (contract c: 0 fallBack, 1 hold, 2 advance);
 *                   value = line seed, a non-negative integer (contract d): show
 *                   SPEECH[faction][order][value % lines.length] (src/data/speech.ts).
 * bossArrived       The King Tiger squad entered the field: show the warning banner and sound.
 *                   side, unit, unitId, kind ('heavyTank'), x, row.
 * planePass         A call-in plane flies across. side, support = its kind (contract b, the kind
 *                   itself rather than an index), x = start, x2 = end, row = altitude row (contract c),
 *                   value = seconds the pass takes (contract d), dir = sign of x2 - x.
 * planeDown         Anti-aircraft fire shot a plane down. side = the plane's side, support = its kind, x.
 * reconReveal       Enemy health is shown around x. side = the side that sees it, x = centre,
 *                   value = radius in wu (contract c), x2 = duration in seconds (contract d; as smokeSpawned).
 * apcUnload         An APC dropped its squad. side, unit, unitId, kind ('apc') = the carrier, x, row;
 *                   value = soldiers unloaded (unitSpawned events follow for each).
 * ignite            A flamethrower's fuel tank was hit from behind and went up (a unitDied and an
 *                   explosion follow in the same step). side, unit, unitId, kind ('flame'), x, row.
 *
 * The mission director (src/sim/director.ts):
 * phaseStarted      A new phase began (after its prep, if any). value = phase index, text = "Phase 2: The water tanks".
 * banner            A scripted banner (or a barrage's warning). text; value = sound: 0 horn, 1 alarm, 2 boss.
 * objectiveDone     An objective of the phase, or a side objective, was done. text = its line; value = 1 for a side
 *                   objective, 0 for one of the phase.
 */
export interface SimEvent {
  type: SimEventType;
  side: number;
  source: EntityKind;
  unit: number;
  unitId: number;
  kind: UnitKind | null;
  weapon: string | null;
  x: number;
  row: number;
  x2: number;
  row2: number;
  target: EntityKind;
  targetIndex: number;
  value: number;
  hit: boolean;
  dir: number;
  cause: DamageType | null;
  order: Order | null;
  support: SupportKind | null;
  text: string | null;
}

/**
 * Events emitted by the last step(). Only `items[0 .. count-1]` are valid.
 * The buffer is cleared at the start of every step, so read it after EACH step
 * (a frame that runs two steps must drain it twice).
 */
export interface EventBuffer {
  readonly items: SimEvent[];
  readonly count: number;
}

// ---------------------------------------------------------------------------
// Battle
// ---------------------------------------------------------------------------

export interface Battle {
  readonly config: BattleConfig;
  /** Read-only for the view. */
  readonly state: BattleState;
  /** Events of the last step. */
  readonly events: EventBuffer;
  /** Advance exactly one tick (1 / tickRate seconds). Does nothing once state.over is true. */
  step(): void;
  /** Queue a command for a side; it is validated and applied at the start of the next tick. The object is copied. */
  command(side: Side, cmd: Command): void;
  /**
   * Apply an admin panel action now, between ticks. The event buffer is cleared first and then holds the action's
   * events (spawns, deaths, battleEnded), so the caller reads them as after a step (view.afterStep()). Returns the
   * number of units (or things) it touched; 0 when it did nothing (battle over, unknown unit, pool full).
   */
  admin(action: AdminAction): number;
  /** What the AI commander of a side is doing (the admin panel's debug view); null for a human or idle side. */
  inspectAi(side: Side): AiReport | null;
}

/** Summary returned by runBattle(). */
export interface BattleResult {
  /** Winning side, or -1 for a draw or a timeout. */
  winner: number;
  endReason: EndReason;
  /** True if maxSeconds passed before the battle ended. */
  timedOut: boolean;
  ticks: number;
  /** Battle time in seconds. */
  seconds: number;
  /** Final stats of side 0 and side 1 (copies). */
  stats: [SideStats, SideStats];
  /** Final HQ health as a 0..1 fraction; 0 for a destroyed or missing HQ. */
  hqHp: [number, number];
  /** Living units per side at the end. */
  unitsAlive: [number, number];
}
