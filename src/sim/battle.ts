/**
 * Battle creation and the fixed-step tick.
 */
import { CONFIG } from '../data/config';
import { DIFFICULTIES } from '../data/difficulty';
import type { MissionDef, Side, SupportKind, UnitKind } from '../data/schema';
import { SUPPORT_KINDS } from '../data/supports';
import { UNITS } from '../data/units';
import { UPGRADES } from '../data/upgrades';
import { applyDamage } from './combat';
import { applyCommands } from './commands';
import { createAi, runCommanders } from './commander';
import { updateEconomy } from './economy';
import { EventQueue } from './events';
import { checkEnd, placeStartingForces, updateMission } from './mission';
import { fireUnits, moveUnits, senseUnits } from './orders';
import { Rng } from './rng';
import { updateProjectiles, updateSmokes } from './projectiles';
import { computeFronts, fireStructures, senseStructures } from './structures';
import { SUPPORT_COUNT, updateSupports } from './supports';
import { KIND_COUNT, KIND_LIST } from './tables';
import { layoutTrenches, slotCount, updateTrenches } from './trenches';
import type {
  Battle,
  BattleConfig,
  BattleState,
  Command,
  CommanderKind,
  HqState,
  PillboxState,
  ProjectileState,
  SideState,
  SmokeState,
  TrenchState,
  WireState,
} from './types';
import { createMount, createUnit, resetMount } from './units';
import {
  CMD_CONTROL,
  CMD_CONTROL_INPUT,
  CMD_ORDER,
  CMD_SUPPORT,
  CMD_TRAIN,
  CommandQueue,
  DamageQueue,
  applyUpgrades,
  createSideMods,
  type AiState,
  type SideMods,
  type World,
} from './world';

/** Starting size of the deferred-damage queue; it grows if a tick ever needs more. */
const DAMAGE_QUEUE_START = 256;

function kindRecord<T>(value: T): Record<UnitKind, T> {
  const out = {} as Record<UnitKind, T>;
  for (const kind of KIND_LIST) out[kind] = value;
  return out;
}

function supportRecord<T>(value: T): Record<SupportKind, T> {
  const out = {} as Record<SupportKind, T>;
  for (const kind of SUPPORT_KINDS) out[kind] = value;
  return out;
}

/*
 * Records whose values are fractional and rewritten every tick (training progress, support
 * cooldowns) are instances of classes of their own, with fields started at a fraction: their hidden
 * class then holds doubles that are updated in place. A plain object with the same keys shares its
 * hidden class with every other literal of those keys (UNITS, SUPPORTS, the faction names), whose
 * values are objects and strings, and then every store of a fraction allocates a heap number.
 */
class ProgressRecord implements Record<UnitKind, number> {
  sapper = 0.5;
  rifle = 0.5;
  lmg = 0.5;
  assault = 0.5;
  mortar = 0.5;
  sniper = 0.5;
  medic = 0.5;
  at = 0.5;
  tank = 0.5;
  heavyTank = 0.5;
}

class CooldownRecord implements Record<SupportKind, number> {
  artillery = 0.5;
  smoke = 0.5;
  airStrike = 0.5;
}

function progressRecord(): Record<UnitKind, number> {
  const out = new ProgressRecord();
  for (const kind of KIND_LIST) out[kind] = 0;
  return out;
}

function cooldownRecord(): Record<SupportKind, number> {
  const out = new CooldownRecord();
  for (const kind of SUPPORT_KINDS) out[kind] = 0;
  return out;
}

function createHq(mission: MissionDef, side: Side, mods: SideMods): HqState {
  const dir = side === 0 ? 1 : -1;
  const x = side === 0 ? CONFIG.hqInset : mission.length - CONFIG.hqInset;
  const maxHp = CONFIG.hqHp * mission.start[side].hqHpMul * mods.hqHealth;
  const gun = createMount();
  resetMount(gun, CONFIG.hqGunWeapon, x + dir * CONFIG.hqGunOffset);
  return {
    side,
    x,
    doorX: x + dir * CONFIG.hqDoorOffset,
    gunX: x + dir * CONFIG.hqGunOffset,
    hp: maxHp,
    maxHp,
    alive: true,
    garrison: 0,
    gun,
  };
}

function createSide(mission: MissionDef, side: Side, commander: CommanderKind, mods: SideMods): SideState {
  const start = mission.start[side];
  const available = kindRecord(false);
  if (start.hasHq) {
    for (const kind of mission.units[side]) {
      if (UNITS[kind].trainable) available[kind] = true;
    }
  }
  const supportAvailable = supportRecord(false);
  for (const kind of mission.supports[side]) supportAvailable[kind] = true;
  return {
    side,
    faction: start.faction,
    commander,
    hasHq: start.hasHq,
    supplies: start.supplies,
    income: 0,
    pop: 0,
    popCap: CONFIG.popCap,
    order: 'hold',
    available,
    queue: kindRecord(0),
    progress: progressRecord(),
    alive: kindRecord(0),
    supportAvailable,
    supportCooldown: cooldownRecord(),
    hq: start.hasHq ? createHq(mission, side, mods) : null,
    holdLineX: 0,
    controlled: -1,
    stats: { trained: 0, lost: 0, kills: 0, suppliesGathered: 0, suppliesSpent: 0, damageDealt: 0 },
  };
}

function createState(config: BattleConfig, mods: [SideMods, SideMods]): BattleState {
  const mission = config.mission;
  const sides: [SideState, SideState] = [
    createSide(mission, 0, config.commanders[0], mods[0]),
    createSide(mission, 1, config.commanders[1], mods[1]),
  ];

  const units = [];
  for (let i = 0; i < CONFIG.maxUnits; i++) units.push(createUnit(i));

  const projectiles: ProjectileState[] = [];
  for (let i = 0; i < CONFIG.maxProjectiles; i++) {
    projectiles.push({
      alive: false,
      id: -1,
      side: 0,
      weapon: null,
      fromX: 0,
      toX: 0,
      x: 0,
      prevX: 0,
      age: 0,
      flightTime: 0,
      row: 0,
      weaponIndex: -1,
      damageMul: 1,
      targetRow: -1,
      hqMul: 1,
      vehicleMul: 1,
    });
  }
  const smokes: SmokeState[] = [];
  for (let i = 0; i < CONFIG.maxSmokes; i++) smokes.push({ alive: false, x: 0, radius: 0, timeLeft: 0, duration: 0 });

  const trenches: TrenchState[] = mission.trenches.map((t) => ({
    id: t.id,
    x: t.x,
    width: t.width,
    slots: t.slots,
    owner: t.owner,
    occupants: 0,
    capturedAt: -1,
  }));
  const pillboxes: PillboxState[] = mission.pillboxes.map((p) => {
    const gun = createMount();
    resetMount(gun, CONFIG.pillboxGunWeapon, p.x);
    const maxHp = CONFIG.pillboxHp * p.hpMul;
    return { id: p.id, x: p.x, side: p.side, hp: maxHp, maxHp, alive: true, gun };
  });
  const wires: WireState[] = mission.wire.map((wire) => ({
    id: wire.id,
    x: wire.x,
    width: wire.width,
    owner: wire.owner,
    hp: CONFIG.wireHp,
    alive: true,
  }));

  const hq0 = sides[0].hq;
  const hq1 = sides[1].hq;
  return {
    tick: 0,
    time: 0,
    length: mission.length,
    mode: mission.mode,
    over: false,
    winner: -1,
    endReason: 'none',
    sides,
    units,
    unitCount: 0,
    projectiles,
    smokes,
    trenches,
    pillboxes,
    wires,
    dumps: [
      hq0 ? { side: 0, x: hq0.doorX + CONFIG.dumpDistance } : null,
      hq1 ? { side: 1, x: hq1.doorX - CONFIG.dumpDistance } : null,
    ],
    timer: mission.timer
      ? {
          secondsLeft: mission.timer.seconds,
          total: mission.timer.seconds,
          progress: 0,
          onExpire: mission.timer.onExpire,
          label: mission.timer.label,
        }
      : null,
  };
}

class BattleImpl implements Battle, World {
  readonly config: BattleConfig;
  readonly mission: MissionDef;
  readonly dt: number;
  readonly state: BattleState;
  readonly events: EventQueue;
  readonly rng: Rng;
  readonly mods: [SideMods, SideMods];
  readonly commands: CommandQueue;
  readonly damage: DamageQueue;
  readonly front = new Float64Array(2);
  readonly armedFront = new Float64Array(2);
  readonly limit = new Float64Array(2);
  readonly cells: [Uint8Array, Uint8Array];
  readonly doorTimer = new Float64Array(2);
  readonly trainLeft = new Float64Array(2 * KIND_COUNT);
  readonly ai: [AiState | null, AiState | null];
  readonly eventFired: Uint8Array;
  readonly eventNext: Float64Array;
  nextUnitId = 1;
  readonly spawnCount = new Int32Array(2);
  nextProjectileId = 1;
  smokeCount = 0;
  readonly retargetTicks: number;
  readonly holdTrench = new Int32Array(2);
  readonly formBase = new Float64Array(2);
  readonly lineFront = new Float64Array(2);
  readonly trenchSlot0: Int32Array;
  readonly trenchTaken: Int32Array;
  readonly trenchHalf: Float64Array;
  readonly slotX: Float64Array;
  readonly slotUnit: Int32Array;
  readonly trenchInside: Int32Array;
  readonly cluster = new Uint8Array(CONFIG.maxUnits);
  readonly leadCount = new Int32Array(2);
  readonly ctrlMove = new Float64Array(2);
  readonly ctrlFire = new Uint8Array(2);
  readonly ctrlAbility = new Uint8Array(2);
  readonly strikeTime = new Float64Array(2 * SUPPORT_COUNT).fill(-1);
  readonly strikeX = new Float64Array(2 * SUPPORT_COUNT);
  readonly strikeFired = new Int32Array(2 * SUPPORT_COUNT);
  readonly strikeWarned = new Uint8Array(2 * SUPPORT_COUNT);

  constructor(config: BattleConfig) {
    const mission = config.mission;
    const difficulty = DIFFICULTIES[config.difficulty];
    this.config = config;
    this.mission = mission;
    this.dt = 1 / CONFIG.tickRate;
    this.rng = new Rng(config.seed);
    this.events = new EventQueue(CONFIG.maxEvents);
    this.commands = new CommandQueue(CONFIG.maxCommands);
    this.damage = new DamageQueue(DAMAGE_QUEUE_START);
    this.retargetTicks = Math.max(1, Math.round(CONFIG.retargetInterval * CONFIG.tickRate));

    // Upgrades belong to side 0 only; difficulty scales AI-commanded sides only.
    this.mods = [createSideMods(), createSideMods()];
    applyUpgrades(this.mods[0], config.upgrades, config.upgradeDefs ?? UPGRADES);
    for (let si = 0; si < 2; si++) {
      const isAi = config.commanders[si] === 'ai';
      this.mods[si].income = mission.start[si].incomeMul * (isAi ? difficulty.aiIncomeMul : 1);
      this.mods[si].airdrop = isAi ? difficulty.aiIncomeMul : 1;
      this.mods[si].wave = isAi ? difficulty.aiWaveMul : 1;
    }

    const cellCount = CONFIG.formationColumns * CONFIG.rows;
    this.cells = [new Uint8Array(cellCount), new Uint8Array(cellCount)];
    this.state = createState(config, this.mods);
    const trenchCount = mission.trenches.length;
    const slots = slotCount(mission.trenches);
    this.trenchSlot0 = new Int32Array(trenchCount);
    this.trenchTaken = new Int32Array(trenchCount);
    this.trenchHalf = new Float64Array(trenchCount);
    this.trenchInside = new Int32Array(trenchCount * 2);
    this.slotX = new Float64Array(slots);
    this.slotUnit = new Int32Array(slots);
    layoutTrenches(this);

    this.eventFired = new Uint8Array(mission.events.length);
    this.eventNext = new Float64Array(mission.events.length);
    for (let i = 0; i < mission.events.length; i++) {
      const when = mission.events[i].when;
      if ('every' in when) this.eventNext[i] = when.from;
    }

    this.ai = [createAi(this, config.commanders[0]), createAi(this, config.commanders[1])];

    computeFronts(this); // hold lines, needed to place the starting formation
    placeStartingForces(this);
    computeFronts(this);
    // The spawn events of the starting forces stay readable until the first step.
  }

  step(): void {
    this.events.clear();
    const s = this.state;
    if (s.over) return;
    s.tick++;
    s.time = s.tick * this.dt;

    applyCommands(this);
    runCommanders(this); // their commands apply at the start of the next tick, like the player's
    updateMission(this);
    updateEconomy(this);
    updateSupports(this); // cooldowns; strikes launch their rounds and lay their smoke

    computeFronts(this);
    senseUnits(this);
    senseStructures(this, s.tick % this.retargetTicks === 0);
    moveUnits(this); // wire slows and is crushed here
    updateTrenches(this); // drop into slots, captures
    updateProjectiles(this); // rounds already in flight land on the new positions
    fireUnits(this);
    fireStructures(this);
    updateSmokes(this);

    applyDamage(this);
    checkEnd(this);
  }

  command(side: Side, cmd: Command): void {
    if (side !== 0 && side !== 1) return;
    const q = this.commands;
    switch (cmd.type) {
      case 'train':
        q.push(side, CMD_TRAIN).kind = cmd.kind;
        break;
      case 'order':
        q.push(side, CMD_ORDER).order = cmd.order;
        break;
      case 'support': {
        const c = q.push(side, CMD_SUPPORT);
        c.support = cmd.kind;
        c.x = cmd.x;
        break;
      }
      case 'control':
        q.push(side, CMD_CONTROL).unit = cmd.unit;
        break;
      case 'controlInput': {
        const c = q.push(side, CMD_CONTROL_INPUT);
        c.moveX = cmd.moveX;
        c.fire = cmd.fire;
        c.ability = cmd.ability;
        break;
      }
    }
  }
}

/** Create a battle. See BattleConfig. The starting forces are placed and their unitSpawned events are waiting in `events`. */
export function createBattle(config: BattleConfig): Battle {
  return new BattleImpl(config);
}
