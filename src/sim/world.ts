/**
 * Internal shared context of one battle. Every system is a plain function
 * that takes the World; the Battle class in battle.ts owns it. Nothing in
 * here is part of the public API.
 */
import type { MissionAiPlan, MissionDef, Order, SupportKind, UnitKind, UpgradeDef, UpgradeLevels } from '../data/schema';
import type { EventQueue } from './events';
import type { Rng } from './rng';
import { KIND_COUNT, KIND_INDEX } from './tables';
import type { BattleConfig, BattleState } from './types';

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
  /** Mission incomeMul x difficulty aiIncomeMul (AI sides only): scales passive income and sapper deliveries. */
  income: number;
  /** Difficulty aiIncomeMul (AI sides only): scales scripted airdrops, which the mission sizes itself. */
  airdrop: number;
  /** Multiplier on scripted wave sizes (difficulty aiWaveMul, AI sides only). */
  wave: number;
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
    income: 1,
    airdrop: 1,
    wave: 1,
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
      }
    }
  }
}

export const CMD_TRAIN = 0;
export const CMD_ORDER = 1;
export const CMD_SUPPORT = 2;
export const CMD_CONTROL = 3;
export const CMD_CONTROL_INPUT = 4;

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

  constructor(capacity: number) {
    this.targetType = new Int8Array(capacity);
    this.targetIndex = new Int32Array(capacity);
    this.targetId = new Int32Array(capacity);
    this.amount = new Float64Array(capacity);
    this.side = new Int8Array(capacity);
    this.dtype = new Int8Array(capacity);
    this.dir = new Int8Array(capacity);
  }

  push(
    targetType: number,
    targetIndex: number,
    targetId: number,
    amount: number,
    side: number,
    dtype: number,
    dir: number,
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
  }
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
  ai: [AiState | null, AiState | null];
  /** Per mission event: 1 once a one-shot event has fired. */
  eventFired: Uint8Array;
  /** Per mission event: battle time of its next firing (repeating events and delayed triggers). */
  eventNext: Float64Array;
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
  /** Per slot: pool index of the unit holding or walking to it, -1 if free. */
  slotUnit: Int32Array;
  /** Scratch, per trench and side: infantry standing inside it this tick ([trench * 2 + side]). */
  trenchInside: Int32Array;
  /** Per unit pool index: units of its side (itself included) within config.clusterRadius, 0 if not on the field. */
  cluster: Uint8Array;
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
}
