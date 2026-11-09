/**
 * Internal shared context of one battle. Every system is a plain function
 * that takes the World; the Battle class in battle.ts owns it. Nothing in
 * here is part of the public API.
 */
import { GROUND, GROUND_CELL, GROUND_IDS, SKI_GROUND } from '../data/ground';
import type {
  BuildableId,
  FactionId,
  GroundId,
  MissionAiPlan,
  MissionDef,
  MissionEventDef,
  MissionPrepDef,
  PhaseDef,
  Order,
  Side,
  SupportKind,
  UnitKind,
  UpgradeDef,
  UpgradeLevels,
} from '../data/schema';
import { SUPPORT_KINDS } from '../data/supports';
import type { EventQueue } from './events';
import type { Rng } from './rng';
import { KIND_COUNT, KIND_INDEX } from './tables';
import type { BattleConfig, BattleState, Behaviour, SideState } from './types';

/**
 * The battlefield's ground as per-cell tables (FOUNDATIONS.md 4.2), one cell per GROUND_CELL wu, built once when the
 * battle is created (buildGroundField) and rewritten only by setGround (rubble). Null for a mission with no sectors:
 * every reader then skips the lookup, so such a battle plays exactly as before.
 */
export interface GroundField {
  /** Cells: ceil(length / GROUND_CELL). */
  count: number;
  /** Per cell: index into GROUND_IDS. */
  ground: Uint8Array;
  /**
   * Per cell, speed multipliers [cell * GROUND_MODES + mode * 2 + way]: mode 0 infantry, 1 vehicles, 2 ski troops;
   * way 0 moving toward +x, 1 toward -x (a slope climbs one way and descends the other).
   */
  speed: Float32Array;
  /** Per cell: multiplier on bullet damage to infantry in the open (forest and rubble cover). */
  cover: Float32Array;
  /** Per cell: range multiplier for weapons fired from there (SectorDef.heightBonus). */
  height: Float32Array;
}

/** Entries per cell in GroundField.speed. */
export const GROUND_MODES = 6;
export const GROUND_INV_CELL = 1 / GROUND_CELL;

function blankGround(length: number): GroundField {
  const count = Math.max(1, Math.ceil(length / GROUND_CELL));
  return {
    count,
    ground: new Uint8Array(count).fill(GROUND_IDS.indexOf('grass')),
    speed: new Float32Array(count * GROUND_MODES).fill(1),
    cover: new Float32Array(count).fill(1),
    height: new Float32Array(count).fill(1),
  };
}

/** Write one ground over the cells whose centres lie in [from, to). */
function writeGround(f: GroundField, from: number, to: number, id: GroundId): void {
  const def = GROUND[id];
  const gi = GROUND_IDS.indexOf(id);
  const ski = SKI_GROUND[id];
  for (let c = 0; c < f.count; c++) {
    const mid = (c + 0.5) * GROUND_CELL;
    if (mid < from || mid >= to) continue;
    f.ground[c] = gi;
    const o = c * GROUND_MODES;
    f.speed[o] = def.infantry;
    f.speed[o + 1] = def.infantryDown;
    f.speed[o + 2] = def.vehicle;
    f.speed[o + 3] = def.vehicleDown;
    f.speed[o + 4] = ski ?? def.infantry;
    f.speed[o + 5] = ski ?? def.infantryDown;
    f.cover[c] = def.bulletCover;
  }
}

/**
 * The ground tables for a mission's sectors (MissionDef.sectors), or null when it has none. Ground no sector covers is
 * even (every multiplier 1); a sector's heightBonus applies over its cells.
 */
export function buildGroundField(mission: MissionDef): GroundField | null {
  const sectors = mission.sectors;
  if (!sectors || sectors.length === 0) return null;
  const f = blankGround(mission.length);
  for (const sec of sectors) {
    writeGround(f, sec.from, sec.to, sec.ground);
    const bonus = sec.heightBonus ?? 1;
    for (let c = 0; c < f.count; c++) {
      const mid = (c + 0.5) * GROUND_CELL;
      if (mid >= sec.from && mid < sec.to) f.height[c] = bonus;
    }
  }
  return f;
}

/**
 * Change the ground over [from, to) for the rest of the battle (a building falling to rubble, FOUNDATIONS.md 4.3).
 * A battle with no ground tables gets them first (even ground elsewhere).
 */
export function setGround(w: World, from: number, to: number, id: GroundId): void {
  if (w.ground === null) w.ground = blankGround(w.state.length);
  writeGround(w.ground, from, to, id);
}

/** The cell of the ground tables under world x (clamped to the field). */
export function groundCell(f: GroundField, x: number): number {
  const c = (x * GROUND_INV_CELL) | 0;
  return c < 0 ? 0 : c >= f.count ? f.count - 1 : c;
}

/** The order a unit of this kind obeys: its kind's override if one is set, else the army order. */
export function orderFor(side: SideState, kind: UnitKind): Order {
  const own = side.kindOrders[kind];
  return own === null ? side.order : own;
}

/** Multipliers applied to one side: Quartermaster upgrades, mission income and difficulty. All default to 1. */
export interface SideMods {
  sapperSpeed: number;
  sapperCarry: number;
  /** Upgrade multiplier on the passive HQ income only. */
  hqIncome: number;
  hqHealth: number;
  hqGunDamage: number;
  hqGunRate: number;
  /** Per kind index. */
  unitHealth: Float64Array;
  unitDamage: Float64Array;
  unitHeal: Float64Array;
  /** Per support index (SUPPORT_KINDS): cooldown divisor, area and effect-time multipliers. */
  supportRate: Float64Array;
  supportReach: Float64Array;
  supportTime: Float64Array;
  /** Mission incomeMul x difficulty aiIncomeMul (AI sides only): scales passive income and sapper deliveries. */
  income: number;
  /** Difficulty aiIncomeMul (AI sides only): scales scripted airdrops, which the mission sizes itself. */
  airdrop: number;
  /** Multiplier on scripted wave sizes (difficulty aiWaveMul, AI sides only). */
  wave: number;
  /** Multiplier on the population cap (difficulty aiPopCapMul, AI sides only). */
  popCap: number;
}

export function createSideMods(): SideMods {
  return {
    sapperSpeed: 1,
    sapperCarry: 1,
    hqIncome: 1,
    hqHealth: 1,
    hqGunDamage: 1,
    hqGunRate: 1,
    unitHealth: new Float64Array(KIND_COUNT).fill(1),
    unitDamage: new Float64Array(KIND_COUNT).fill(1),
    unitHeal: new Float64Array(KIND_COUNT).fill(1),
    supportRate: new Float64Array(SUPPORT_KINDS.length).fill(1),
    supportReach: new Float64Array(SUPPORT_KINDS.length).fill(1),
    supportTime: new Float64Array(SUPPORT_KINDS.length).fill(1),
    income: 1,
    airdrop: 1,
    wave: 1,
    popCap: 1,
  };
}

/** Fold the bought upgrade levels into a side's multipliers. Unknown ids and missing definitions are ignored. */
export function applyUpgrades(mods: SideMods, levels: UpgradeLevels, defs: readonly UpgradeDef[] | undefined): void {
  if (!defs) return;
  for (const def of defs) {
    const bought = levels[def.id];
    if (typeof bought !== 'number' || !(bought >= 1)) continue;
    const level = Math.min(Math.floor(bought), def.levels.length);
    if (level < 1) continue;
    // Each level lists its cumulative effects, so only the bought level applies.
    for (const effect of def.levels[level - 1]) {
      switch (effect.stat) {
        case 'sapperSpeed':
          mods.sapperSpeed *= effect.mul;
          break;
        case 'sapperCarry':
          mods.sapperCarry *= effect.mul;
          break;
        case 'hqIncome':
          mods.hqIncome *= effect.mul;
          break;
        case 'hqHealth':
          mods.hqHealth *= effect.mul;
          break;
        case 'hqGunDamage':
          mods.hqGunDamage *= effect.mul;
          break;
        case 'hqGunRate':
          mods.hqGunRate *= effect.mul;
          break;
        case 'unitHealth':
          mods.unitHealth[KIND_INDEX[effect.unit]] *= effect.mul;
          break;
        case 'unitDamage':
          mods.unitDamage[KIND_INDEX[effect.unit]] *= effect.mul;
          break;
        case 'unitHeal':
          mods.unitHeal[KIND_INDEX[effect.unit]] *= effect.mul;
          break;
        case 'supportRate':
          mods.supportRate[SUPPORT_KINDS.indexOf(effect.support)] *= effect.mul;
          break;
        case 'supportReach':
          mods.supportReach[SUPPORT_KINDS.indexOf(effect.support)] *= effect.mul;
          break;
        case 'supportTime':
          mods.supportTime[SUPPORT_KINDS.indexOf(effect.support)] *= effect.mul;
          break;
      }
    }
  }
}

export const CMD_TRAIN = 0;
export const CMD_ORDER = 1;
export const CMD_SUPPORT = 2;
export const CMD_CONTROL = 3;
export const CMD_CONTROL_INPUT = 4;
/** An order for one unit kind (`kind`, `order`). */
export const CMD_KIND_ORDER = 5;
/** One kind (`kind`) follows the army order again. */
export const CMD_FOLLOW = 6;
/** Every kind follows the army order again. */
export const CMD_FOLLOW_ALL = 7;
/** Prep phase: a build site of `build` at `x`. */
export const CMD_BUILD = 8;
/** Prep phase: cancel the build site with id `unit`. */
export const CMD_CANCEL_BUILD = 9;
/** Prep phase: ready, end it now. */
export const CMD_READY = 10;
/** "Deploy at": `unit` = DEPLOY_AUTO, DEPLOY_HQ or a capture point index. */
export const CMD_DEPLOY = 11;

/** A queued command, flattened so the queue can be pooled. Only the fields of its `type` are meaningful. */
export interface QueuedCommand {
  side: number;
  type: number;
  kind: UnitKind;
  order: Order;
  support: SupportKind;
  x: number;
  unit: number;
  moveX: number;
  fire: boolean;
  ability: boolean;
  build: BuildableId;
}

function blankCommand(): QueuedCommand {
  return {
    side: 0,
    type: CMD_ORDER,
    kind: 'rifle',
    order: 'hold',
    support: 'artillery',
    x: 0,
    unit: -1,
    moveX: 0,
    fire: false,
    ability: false,
    build: 'wire',
  };
}

/** Pooled FIFO of commands waiting for the start of the next tick. */
export class CommandQueue {
  readonly items: QueuedCommand[] = [];
  count = 0;

  constructor(capacity: number) {
    for (let i = 0; i < capacity; i++) this.items.push(blankCommand());
  }

  /** Reserve the next record; the caller fills in `side`, `type` and the fields that type uses. */
  push(side: number, type: number): QueuedCommand {
    if (this.count === this.items.length) this.items.push(blankCommand());
    const c = this.items[this.count++];
    c.side = side;
    c.type = type;
    return c;
  }
}

/**
 * Damage dealt during a tick, applied only after every unit and structure has
 * acted, so neither side benefits from acting first.
 */
/** DamageQueue.flags: hit from above (armour facing does not apply). */
export const DMG_TOP = 1;
/** DamageQueue.flags: a flamethrower: a trench occupant it hurts is burned out of his slot. */
export const DMG_FLUSH = 2;
/** DamageQueue.flags: a shell that struck the hull while flying toward +x, or toward -x (the armour side it hit). */
export const DMG_FLEW_POS = 4;
export const DMG_FLEW_NEG = 8;

export class DamageQueue {
  count = 0;
  /** TARGET_UNIT, TARGET_HQ or TARGET_PILLBOX. */
  targetType: Int8Array;
  targetIndex: Int32Array;
  /** Unique id for unit targets, so damage never lands on a reused pool slot. */
  targetId: Int32Array;
  amount: Float64Array;
  /** Side that dealt it. */
  side: Int8Array;
  /** Index into DAMAGE_TYPES. */
  dtype: Int8Array;
  /** Direction the blow travelled: 1 or -1. */
  dir: Int8Array;
  /** DMG_* bits: top attack, flushes a trench, and the direction a shell flew when it hit the hull. */
  flags: Uint8Array;

  constructor(capacity: number) {
    this.targetType = new Int8Array(capacity);
    this.targetIndex = new Int32Array(capacity);
    this.targetId = new Int32Array(capacity);
    this.amount = new Float64Array(capacity);
    this.side = new Int8Array(capacity);
    this.dtype = new Int8Array(capacity);
    this.dir = new Int8Array(capacity);
    this.flags = new Uint8Array(capacity);
  }

  push(
    targetType: number,
    targetIndex: number,
    targetId: number,
    amount: number,
    side: number,
    dtype: number,
    dir: number,
    flags: number,
  ): void {
    if (this.count === this.amount.length) this.grow();
    const i = this.count++;
    this.targetType[i] = targetType;
    this.targetIndex[i] = targetIndex;
    this.targetId[i] = targetId;
    this.amount[i] = amount;
    this.side[i] = side;
    this.dtype[i] = dtype;
    this.dir[i] = dir;
    this.flags[i] = flags;
  }

  private grow(): void {
    const n = this.amount.length * 2;
    const targetType = new Int8Array(n);
    targetType.set(this.targetType);
    this.targetType = targetType;
    const targetIndex = new Int32Array(n);
    targetIndex.set(this.targetIndex);
    this.targetIndex = targetIndex;
    const targetId = new Int32Array(n);
    targetId.set(this.targetId);
    this.targetId = targetId;
    const amount = new Float64Array(n);
    amount.set(this.amount);
    this.amount = amount;
    const side = new Int8Array(n);
    side.set(this.side);
    this.side = side;
    const dtype = new Int8Array(n);
    dtype.set(this.dtype);
    this.dtype = dtype;
    const dir = new Int8Array(n);
    dir.set(this.dir);
    this.dir = dir;
    const flags = new Uint8Array(n);
    flags.set(this.flags);
    this.flags = flags;
  }
}

/**
 * Units of a scripted wave that did not fit under their side's population cap. They wait at the
 * HQ and walk out of its door, in the order they were scripted, as room frees up.
 */
export interface ReserveGroup {
  side: Side;
  kindIndex: number;
  behaviour: Behaviour;
  /** Where a guard posts itself or a garrison stands; NaN = no post. */
  postX: number;
  /** Index into state.trenches of a garrison's trench, -1 for none. */
  postTrench: number;
  /** Units still waiting. */
  left: number;
  /** Veterans (ForceDef.veteran). */
  veteran: boolean;
  /** ForceDef.look ('' = the era's) and ForceDef.nation ('' = the side's own, or its roster nation for the kind). */
  look: string;
  faction: FactionId | '';
  /** ForceDef.leash, or -1 for the default. */
  leash: number;
  /** ForceDef.tags has skis. */
  skis: boolean;
}

/** Per-side memory of the AI commander (also used by the test bot). */
export interface AiState {
  plan: MissionAiPlan;
  /** Ticks between decisions. */
  thinkTicks: number;
  /** Difficulty aggression (1 for the bot). */
  aggression: number;
  /** Battle time of its last order change. */
  lastOrderTime: number;
  /** Battle time since which it has been holding. */
  holdSince: number;
  /** Battle time its current (or last) Advance began. */
  advanceSince: number;
  /** Battle time the current Advance came within AI.threatDistance of the enemy, or -1 while still closing. */
  contactSince: number;
  /** Battle time of its last support call-in. */
  lastSupportTime: number;
  /** True for the test bot (side 0's "reasonable player"), false for the AI. */
  bot: boolean;
  /** Prep phase: index of the next build of MissionDef.prep.bot to place. */
  prepNext: number;
  /** Scratch: wanted number of units per kind index. */
  desired: Int16Array;
}

export interface World {
  config: BattleConfig;
  mission: MissionDef;
  /** Seconds per tick. */
  dt: number;
  state: BattleState;
  events: EventQueue;
  rng: Rng;
  mods: [SideMods, SideMods];
  commands: CommandQueue;
  damage: DamageQueue;
  /** Per side: x of its most forward blocker (unit on the field, live pillbox, HQ door), or its own map edge. */
  front: Float64Array;
  /** Per side: x of its most forward armed army unit on the field, or its hold line if it has none. */
  armedFront: Float64Array;
  /** Per side: the furthest x its ground units may move forward to (the front clamp). */
  limit: Float64Array;
  /** Per side: occupancy of the hold formation grid, [column * rows + row]. */
  cells: [Uint8Array, Uint8Array];
  /** Per side: seconds until the next garrisoned unit may leave the HQ. */
  doorTimer: Float64Array;
  /** Seconds left on the unit in training, indexed [side * KIND_COUNT + kindIndex]. */
  trainLeft: Float64Array;
  /**
   * Men of a finished squad order (UnitDef.squad) still to leave the HQ, indexed like trainLeft: 0 while the order
   * trains. The order leaves the queue once its last man is out.
   */
  squadLeft: Int32Array;
  ai: [AiState | null, AiState | null];
  /** Per mission event: 1 once a one-shot event has fired. */
  eventFired: Uint8Array;
  /** Per mission event: battle time of its next firing (repeating events and delayed triggers). */
  eventNext: Float64Array;
  /** The mission's phases (MissionDef.phases, or the one made from its mode and timer: normalPhases). */
  phases: PhaseDef[];
  /**
   * Every scripted event the director watches: MissionDef.events (same indices: the admin panel fires them by index),
   * then each phase's onEnter events with a phase trigger. eventFired and eventNext are indexed like this list.
   */
  missionEvents: MissionEventDef[];
  /** The prep phase being run (the mission's, or the current phase's), for the test bot's build plan; null for none. */
  prepDef: MissionPrepDef | null;
  /** Scripted reinforcements waiting for room under the population cap (only sides with an HQ). */
  reserve: ReserveGroup[];
  nextUnitId: number;
  /** Per side: units spawned so far. Per-unit variation derives from this, not the id, so mirrored sides match. */
  spawnCount: Int32Array;
  nextProjectileId: number;
  /** Ticks between preferred-target checks. */
  retargetTicks: number;
  /**
   * Living smoke clouds. spawnSmoke and updateSmokes (effects.ts) keep this in step; targeting
   * skips the smoke test entirely while it is 0.
   */
  smokeCount: number;

  /** Per side: index into state.trenches of its hold-line trench, -1 if it owns none. */
  holdTrench: Int32Array;
  /** Per side: x the hold formation forms up behind (the hold line, or the rear edge of the hold trench less a gap). */
  formBase: Float64Array;
  /** Per side: forward edge of the hold line (the hold trench's front edge, or the hold line itself). */
  lineFront: Float64Array;
  /** Per trench: index of its first slot in the slot arrays. */
  trenchSlot0: Int32Array;
  /** Per trench: slots held or reserved. */
  trenchTaken: Int32Array;
  /** Per trench: half its width. */
  trenchHalf: Float64Array;
  /** Per slot: world x. */
  slotX: Float64Array;
  /** Per slot: pool index of the unit holding or walking to it, -1 if free, SLOT_SEALED if it is gone (a fallen floor). */
  slotUnit: Int32Array;
  /** Per slot: its floor (0 = ground; always 0 in a trench). */
  slotFloor: Int8Array;
  /** Scratch, per trench and side: infantry standing inside it this tick ([trench * 2 + side]). */
  trenchInside: Int32Array;
  /** Per unit pool index: units of its side (itself included) within config.clusterRadius, 0 if not on the field. */
  cluster: Uint8Array;
  /** Per side: pool indices of its units on the field, sorted by x (countClusters keeps it between ticks). */
  clusterOrder: [Int32Array, Int32Array];
  /** Per side: entries in use in clusterOrder. */
  clusterLen: Int32Array;
  /** Scratch for countClusters, per unit pool index: its x this tick, and 1 once listed. */
  clusterX: Float64Array;
  clusterMark: Uint8Array;
  /** Per side: armed army units on the field that lead the line (not followsLine). */
  leadCount: Int32Array;

  /** Per side: the stick (-1..1), fire button (1 held) and pending ability press of its controlled unit. */
  ctrlMove: Float64Array;
  ctrlFire: Uint8Array;
  ctrlAbility: Uint8Array;

  /** Per side and support kind ([side * SUPPORT_COUNT + k]): seconds since the call of the strike in progress, -1 if none. */
  strikeTime: Float64Array;
  /** Target x of that strike. */
  strikeX: Float64Array;
  /** Rounds of it launched so far. */
  strikeFired: Int32Array;
  /** 1 once its supportIncoming has been emitted. */
  strikeWarned: Uint8Array;

  /** Aircraft, per strike slot: health, PLANE_* state, and whether its planePass was emitted. */
  planeHp: Float64Array;
  planeState: Uint8Array;
  planePassed: Uint8Array;
  /** Per side: aircraft of that side in the air right now (flying or breaking off). */
  planesUp: Int32Array;
  /** Per side: enemy aircraft call-ins it has seen (the AI answers with anti-aircraft guns). */
  planesSeen: Int32Array;
  /**
   * Per side and kind (side * KIND_COUNT + kind index): veterans alive, the King Tiger's escort. They stay with their
   * tank, so the AI does not count them as part of the army its build plan asks for.
   */
  escorts: Int32Array;
  /** Per side: pool index of the commander whose aura applies this tick, -1 for none. */
  auraUnit: Int32Array;
  /** Per unit pool index: 1 while an anti-aircraft gun has a plane in reach (it holds its fire at the ground). */
  aaEngaged: Uint8Array;
  /** 1 if any entry of aaEngaged is set. */
  aaAny: number;
  /** Per side: commander speeches so far (picks the line, so no random number is drawn). */
  speechCount: Int32Array;
  /** Id the next build site gets. */
  nextSiteId: number;
  /** The ground tables (MissionDef.sectors), or null for even ground everywhere. */
  ground: GroundField | null;
  /**
   * Per side: index into state.points of its hold-line capture point, -1 when the hold line is a trench, the HQ's
   * line or the map edge (structures.ts).
   */
  holdPoint: Int32Array;
}
