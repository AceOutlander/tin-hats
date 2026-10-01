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
  DamageType,
  Difficulty,
  FactionId,
  MissionDef,
  MissionMode,
  Order,
  Side,
  SupportKind,
  UnitAction,
  UnitDef,
  UnitKind,
  UpgradeDef,
  UpgradeLevels,
  WeaponDef,
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
   * The upgrade definitions `upgrades` refers to (src/data/upgrades.ts once it exists).
   * Omitted or empty = upgrades have no effect.
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
  /** Change the army-wide order. Instant and free. */
  | { type: 'order'; order: Order }
  /** Call a support at world x. NOT YET IMPLEMENTED (Phase 2): accepted and ignored. */
  | { type: 'support'; kind: SupportKind; x: number }
  /** Take direct control of the unit with this `id`, or -1 to release. NOT YET IMPLEMENTED (Phase 2): ignored. */
  | { type: 'control'; unit: number }
  /** Stick and buttons for the controlled unit. NOT YET IMPLEMENTED (Phase 2): ignored. */
  | { type: 'controlInput'; moveX: number; fire: boolean; ability: boolean };

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

/** How a unit relates to its side's order: army = obeys it; guard = holds its post; assault = always advances. */
export type Behaviour = 'army' | 'guard' | 'assault';

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
  | 'draw';

/** Kinds of thing an event or a weapon mount can point at. */
export type EntityKind = 'none' | 'unit' | 'hq' | 'pillbox' | 'trench' | 'wire' | 'ground';

/** Numeric target codes used by MountState.targetType. */
export const TARGET_NONE = 0;
export const TARGET_UNIT = 1;
export const TARGET_HQ = 2;
export const TARGET_PILLBOX = 3;

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
  /**
   * internal: the owner's world x, damage multiplier and reload-speed multiplier for this tick.
   * The owner writes them before sensing and firing so the hot path passes no doubles around
   * (see the allocation note in combat.ts).
   */
  x: number;
  damageMul: number;
  rateMul: number;
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

  /** What the unit is doing; drives the animation. `inside` = garrisoned in the HQ: do not draw, cannot be hit. */
  action: UnitAction;
  /** Seconds the unit has been in `action` (0 on the tick it changes). */
  actionTime: number;
  /** True while garrisoned in the HQ under Fall Back (always together with action 'inside'). */
  inside: boolean;
  /** Supplies a sapper is carrying (draw the crate when > 0); 0 otherwise. */
  carrying: number;
  /** Id of the trench the unit occupies, or -1. Always -1 until trenches are simulated (Phase 2). */
  trenchId: number;
  /** True while the player directly controls this unit. Always false until Phase 2. */
  controlled: boolean;

  /** World x of what the unit is aiming at; equal to x when it has no target. */
  aimX: number;
  /** Primary weapon readiness 0..1 (1 = ready to fire, rises from 0 during the reload). 1 for unarmed units. */
  weaponCharge: number;
  /** Primary weapon (rifle, tank gun...). `mount.weapon` is null for unarmed units. */
  mount: MountState;
  /** Secondary weapon (grenade, coaxial MG). Present but not fired until Phase 2. */
  mount2: MountState;

  /** internal: index of `kind` in the sim's kind tables. */
  kindIndex: number;
  /** internal: true while standing to fight its target instead of moving. */
  engaged: boolean;
  /** internal: where the unit wants to walk this tick. */
  goalX: number;
  /** internal: speed in wu/s it walks at this tick (set together with goalX). */
  moveSpeed: number;
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
  /** internal: the post a guard unit returns to. */
  postX: number;
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
}

/** Running totals per side, shown on the result screen. */
export interface SideStats {
  /** Units that finished training (sappers included). */
  trained: number;
  /** Own units killed. */
  lost: number;
  /** Enemy units killed by this side. */
  kills: number;
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
  /** The current army-wide order. */
  order: Order;
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
  /** Seconds until each support is ready again; 0 = ready. Always 0 until Phase 2. */
  supportCooldown: Record<SupportKind, number>;
  /** The HQ, or null if the side has none. Stays non-null (with alive false) after it is destroyed. */
  hq: HqState | null;
  /** World x of the line the army holds under Hold. */
  holdLineX: number;
  /** Pool index of the unit under direct control, or -1. Always -1 until Phase 2. */
  controlled: number;
  stats: SideStats;
}

/** A trench line. Listed from the mission; occupation and capture are simulated from Phase 2. */
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
}

/** A pillbox. Listed from the mission; its gun and health are simulated from Phase 2. */
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

/** A belt of barbed wire. Listed from the mission; slowing and destruction are simulated from Phase 2. */
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

/** A shell, rocket, grenade or bomb in flight. Pool slots; none are alive until Phase 2. */
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
}

/** A smoke cloud that blocks direct fire. Pool slots; none are alive until Phase 2. */
export interface SmokeState {
  alive: boolean;
  x: number;
  radius: number;
  /** Seconds left and total lifetime. */
  timeLeft: number;
  duration: number;
}

/** The mission clock, when the mission has one. */
export interface TimerState {
  secondsLeft: number;
  total: number;
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
  /** Projectile pool (check `alive`). Empty until Phase 2. */
  projectiles: ProjectileState[];
  /** Smoke pool (check `alive`). Empty until Phase 2. */
  smokes: SmokeState[];
  trenches: TrenchState[];
  pillboxes: PillboxState[];
  wires: WireState[];
  /** Supply dump of side 0 and side 1; null for a side with no HQ. */
  dumps: [DumpState | null, DumpState | null];
  /** The mission timer, or null. */
  timer: TimerState | null;
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
  | 'battleEnded';

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
 * projectile        (Phase 2) A shell left a barrel. side, weapon, x, row = launch; x2 = landing point;
 *                   value = flight time in seconds; targetIndex = projectile pool index.
 * explosion         (Phase 2) x = centre, value = radius, weapon, cause = damage type.
 * unitSpawned       A unit appeared. side, unit, unitId, kind, x, row;
 *                   value = 1 if it was trained, 0 if a mission event or the mission start placed it;
 *                   hit = true if it appeared inside the HQ (trained under Fall Back) and is not on the field yet.
 * unitDied          side = victim's side, unit, unitId, kind, x, row; cause = damage type that killed it;
 *                   dir = direction the blow travelled (+1 = toward +x, so the body falls that way);
 *                   targetIndex = side that made the kill, -1 if none.
 * unitHit           A unit took damage and survived. side, unit, unitId, kind, x, row, value = damage, cause, dir.
 * structureHit      target = 'hq' | 'pillbox', targetIndex = HQ side or pillbox index, side = owner,
 *                   x = impact point, value = damage, cause, dir.
 * structureDestroyed  target, targetIndex, side = owner, x.
 * trenchCaptured    (Phase 2) side = new owner, targetIndex = trench id, x.
 * wireDestroyed     (Phase 2) targetIndex = wire id, x.
 * supplyDelivered   A sapper reached the HQ door. side, unit, unitId, kind, x, row, value = supplies credited.
 * trainStarted      A unit was queued. side, kind, value = that kind's queue length afterwards.
 * trainDone         A unit finished training. side, kind, unit, unitId (a unitSpawned event follows).
 * orderChanged      side, order.
 * supportCalled     (Phase 2) side, support, x.
 * supportIncoming   (Phase 2) side, support, x, value = seconds until the first round.
 * smokeSpawned      (Phase 2) x, value = radius.
 * wave              A scripted wave arrived. side, value = units spawned, text = announcement or null.
 * airdrop           Scripted supplies. side, value = supplies credited, x = where the crate lands (HQ door).
 * announce          text = banner text.
 * hint              text = tutorial hint.
 * controlLost       (Phase 2) side, unit, unitId, kind: the controlled unit died.
 * battleEnded       side = winner (-1 for a draw), value = battle time in seconds; see state.endReason.
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
