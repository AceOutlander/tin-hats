/**
 * Battle creation and the fixed-step tick.
 */
import { CONFIG } from '../data/config';
import { DIFFICULTIES } from '../data/difficulty';
import type { MissionDef, MissionEventDef, MissionPrepDef, Order, PhaseDef, Side, SupportKind, UnitKind } from '../data/schema';
import { SUPPORTS, SUPPORT_KINDS } from '../data/supports';
import { UNITS } from '../data/units';
import { UPGRADES } from '../data/upgrades';
import { applyAdmin, cheatSupplies, cheatTraining, inspectAi } from './admin';
import { createBuildings, layoutBuildings, updateBuildings } from './buildings';
import { updateClears } from './clear';
import { createMinefields, updateMines } from './mines';
import { createObstacles, updateObstacles } from './obstacles';
import { createBridges, createFerries, layBridges, updateBridges, updateFerries } from './water';
import { applyDamage } from './combat';
import { applyCommands } from './commands';
import { createAi, runCommanders } from './commander';
import { updateEconomy } from './economy';
import { EventQueue } from './events';
import { createDirector, directorEvents, normalPhases, resetTriggerClocks, startDirector } from './director';
import { checkEnd, placeStartingForces, updateMission } from './mission';
import { fireUnits, moveUnits, senseUnits } from './orders';
import { createPrep, updateBuilds, updatePrep } from './prep';
import { createPoints, updatePoints } from './points';
import { Rng } from './rng';
import { updateProjectiles, updateSmokes } from './projectiles';
import { computeFronts, fireStructures, senseStructures } from './structures';
import { updateAuras, updateCarriers } from './specials';
import { SUPPORT_COUNT, fireAntiAir, updateSupports } from './supports';
import { KIND_COUNT, KIND_LIST } from './tables';
import { layoutTrenches, slotCount, updateTrenches } from './trenches';
import type {
  AdminAction,
  AiReport,
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
import { DEPLOY_AUTO, DEPLOY_HQ } from './types';
import { createMount, createUnit, resetMount } from './units';
import {
  CMD_BUILD,
  CMD_CANCEL_BUILD,
  CMD_CLEAR,
  CMD_READY,
  CMD_CONTROL,
  CMD_CONTROL_INPUT,
  CMD_DEPLOY,
  CMD_FOLLOW,
  CMD_FOLLOW_ALL,
  CMD_KIND_ORDER,
  CMD_ORDER,
  CMD_SUPPORT,
  CMD_TRAIN,
  CommandQueue,
  DamageQueue,
  applyUpgrades,
  buildGroundField,
  createSideMods,
  type GroundField,
  type AiState,
  type ReserveGroup,
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
  conscript = 0.5;
  lmg = 0.5;
  assault = 0.5;
  mortar = 0.5;
  sniper = 0.5;
  medic = 0.5;
  at = 0.5;
  tank = 0.5;
  heavyTank = 0.5;
  apc = 0.5;
  flame = 0.5;
  commander = 0.5;
  aa = 0.5;
  lightTank = 0.5;
}

class CooldownRecord implements Record<SupportKind, number> {
  artillery = 0.5;
  smoke = 0.5;
  airStrike = 0.5;
  bomber = 0.5;
  fighter = 0.5;
  recon = 0.5;
  katyusha = 0.5;
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

/** Each support's full cooldown for a side: the data cooldown (or the mission's own, SideStart.supportCooldown) divided by its upgrade (supportRate). */
function fullCooldownRecord(mods: SideMods, own: Partial<Record<SupportKind, number>> | undefined): Record<SupportKind, number> {
  const out = new CooldownRecord();
  for (let k = 0; k < SUPPORT_KINDS.length; k++) {
    const kind = SUPPORT_KINDS[k];
    out[kind] = (own?.[kind] ?? SUPPORTS[kind].cooldown) / mods.supportRate[k];
  }
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
    look: mission.start[side].hqLook ?? '',
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
  // Offered later by a `support` event (FOUNDATIONS.md 3.3).
  for (const kind of start.supportsOff ?? []) supportAvailable[kind] = false;
  return {
    side,
    faction: start.faction,
    commander,
    hasHq: start.hasHq,
    supplies: start.supplies,
    income: 0,
    pop: 0,
    popCap: Math.round(CONFIG.popCap * mods.popCap),
    reservePop: 0,
    order: 'hold',
    kindOrders: kindRecord<Order | null>(null),
    available,
    queue: kindRecord(0),
    progress: progressRecord(),
    alive: kindRecord(0),
    supportAvailable,
    supportCooldown: cooldownRecord(),
    supportCooldownFull: fullCooldownRecord(mods, start.supportCooldown),
    hq: start.hasHq ? createHq(mission, side, mods) : null,
    holdLineX: 0,
    controlled: -1,
    stats: { trained: 0, lost: 0, kills: 0, killsByKind: kindRecord(0), lostByKind: kindRecord(0), suppliesGathered: 0, suppliesSpent: 0, damageDealt: 0 },
    cheats: { invincible: false, hqInvincible: false, holdSupplies: -1, instantTrain: false },
    deploy: DEPLOY_AUTO,
    deployPoint: -1,
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
      top: false,
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
    building: -1,
  }));
  // Buildings and cover props: their slot records go after the mission's trenches (FOUNDATIONS.md 4.3).
  const buildings = createBuildings(mission, trenches);
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
  // After the buildings: a point that is a building follows the building's slot record.
  const points = createPoints(mission, trenches);
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
    points,
    buildings,
    dumps: [
      hq0 ? { side: 0, x: hq0.doorX + CONFIG.dumpDistance } : null,
      hq1 ? { side: 1, x: hq1.doorX - CONFIG.dumpDistance } : null,
    ],
    prep: createPrep(mission, hq0 ? hq0.x : null),
    sites: [],
    // Obstacles and water (FOUNDATIONS.md 4.4, 4.6 and 4.8): all empty for a mission without them.
    obstacles: createObstacles(mission),
    minefields: createMinefields(mission),
    bridges: createBridges(mission, points),
    ferries: createFerries(mission, points),
    clears: [],
    sandbags: [],
    timer: mission.timer
      ? {
          secondsLeft: mission.timer.seconds,
          total: mission.timer.seconds,
          progress: 0,
          onExpire: mission.timer.onExpire,
          label: mission.timer.label,
        }
      : null,
    director: createDirector(normalPhases(mission).length, [mods[0].income, mods[1].income]),
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
  readonly squadLeft = new Int32Array(2 * KIND_COUNT);
  readonly ai: [AiState | null, AiState | null];
  readonly eventFired: Uint8Array;
  readonly eventNext: Float64Array;
  readonly phases: PhaseDef[];
  readonly missionEvents: MissionEventDef[];
  prepDef: MissionPrepDef | null;
  readonly reserve: ReserveGroup[] = [];
  nextUnitId = 1;
  readonly spawnCount = new Int32Array(2);
  nextProjectileId = 1;
  smokeCount = 0;
  readonly retargetTicks: number;
  readonly holdTrench = new Int32Array(2);
  readonly formBase = new Float64Array(2);
  readonly lineFront = new Float64Array(2);
  readonly holdPoint = new Int32Array(2).fill(-1);
  ground: GroundField | null;
  trenchSlot0: Int32Array;
  trenchTaken: Int32Array;
  trenchHalf: Float64Array;
  slotX: Float64Array;
  slotUnit: Int32Array;
  slotFloor: Int8Array;
  trenchInside: Int32Array;
  readonly cluster = new Uint8Array(CONFIG.maxUnits);
  readonly clusterOrder: [Int32Array, Int32Array] = [new Int32Array(CONFIG.maxUnits), new Int32Array(CONFIG.maxUnits)];
  readonly clusterLen = new Int32Array(2);
  readonly clusterX = new Float64Array(CONFIG.maxUnits);
  readonly clusterMark = new Uint8Array(CONFIG.maxUnits);
  readonly leadCount = new Int32Array(2);
  readonly ctrlMove = new Float64Array(2);
  readonly ctrlFire = new Uint8Array(2);
  readonly ctrlAbility = new Uint8Array(2);
  readonly strikeTime = new Float64Array(2 * SUPPORT_COUNT).fill(-1);
  readonly strikeX = new Float64Array(2 * SUPPORT_COUNT);
  readonly strikeFired = new Int32Array(2 * SUPPORT_COUNT);
  readonly strikeWarned = new Uint8Array(2 * SUPPORT_COUNT);
  readonly planeHp = new Float64Array(2 * SUPPORT_COUNT);
  readonly planeState = new Uint8Array(2 * SUPPORT_COUNT);
  readonly planePassed = new Uint8Array(2 * SUPPORT_COUNT);
  readonly planesUp = new Int32Array(2);
  readonly planesSeen = new Int32Array(2);
  readonly escorts = new Int32Array(2 * KIND_COUNT);
  readonly auraUnit = new Int32Array(2).fill(-1);
  readonly speechCount = new Int32Array(2);
  nextSiteId = 1;
  readonly aaEngaged = new Uint8Array(CONFIG.maxUnits);
  aaAny = 0;

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
      this.mods[si].popCap = isAi ? difficulty.aiPopCapMul : 1;
    }

    const cellCount = CONFIG.formationColumns * CONFIG.rows;
    this.cells = [new Uint8Array(cellCount), new Uint8Array(cellCount)];
    this.state = createState(config, this.mods);
    this.ground = buildGroundField(mission);
    layBridges(this); // standing bridges are road over the river
    // The mission's trenches, then the slot records of its buildings and cover props.
    const trenchCount = this.state.trenches.length;
    const slots = slotCount(this.state.trenches);
    this.trenchSlot0 = new Int32Array(trenchCount);
    this.trenchTaken = new Int32Array(trenchCount);
    this.trenchHalf = new Float64Array(trenchCount);
    this.trenchInside = new Int32Array(trenchCount * 2);
    this.slotX = new Float64Array(slots);
    this.slotUnit = new Int32Array(slots);
    this.slotFloor = new Int8Array(slots);
    layoutTrenches(this);
    layoutBuildings(this);

    this.phases = normalPhases(mission);
    this.missionEvents = directorEvents(mission, this.phases);
    this.prepDef = mission.prep ?? this.phases[0].prep ?? null;
    this.eventFired = new Uint8Array(this.missionEvents.length);
    this.eventNext = new Float64Array(this.missionEvents.length);
    resetTriggerClocks(this);

    this.ai = [createAi(this, config.commanders[0]), createAi(this, config.commanders[1])];

    computeFronts(this); // hold lines, needed to place the starting formation
    placeStartingForces(this);
    updateBuildings(this); // the men placed in buildings
    updatePoints(this, 0); // points that are trenches or buildings take their garrisons' owner; where each side deploys
    computeFronts(this);
    // The first phase begins with the forces in place (garrisons own their trenches).
    startDirector(this);
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
    updatePrep(this); // the countdown; the mission clock and events wait while it runs
    updateMission(this);
    cheatTraining(this); // admin panel: instant training
    updateEconomy(this);
    updateFerries(this); // boats put out and land the men who waited for them
    updateBuilds(this); // sappers on build sites; a finished site becomes its structure
    updateClears(this); // sappers on Clear jobs at enemy minefields and obstacles
    updateSupports(this); // cooldowns; strikes launch their rounds and lay their smoke

    computeFronts(this);
    senseUnits(this);
    senseStructures(this, s.tick % this.retargetTicks === 0);
    moveUnits(this); // wire slows and is crushed here; obstacles and rivers stop vehicles
    updateMines(this); // whoever moved through an enemy minefield rolls for a blast
    updateObstacles(this); // vehicles held at an obstacle work it loose
    updateCarriers(this); // men climb into APCs, loaded APCs unload at the front
    updateTrenches(this); // drop into slots, captures
    updateBuildings(this); // who holds and who is inside each building
    updatePoints(this, this.dt); // capture points change hands; contested points; where each side deploys
    updateBridges(this); // a bridge follows its point; holding it cuts the charges
    updateProjectiles(this); // rounds already in flight land on the new positions
    updateAuras(this); // each side's commander
    fireAntiAir(this); // guns with a plane in reach fire at it (and hold their fire at the ground)
    fireUnits(this);
    fireStructures(this);
    updateSmokes(this);

    applyDamage(this);
    checkEnd(this);
    cheatSupplies(this); // admin panel: frozen or infinite supplies
  }

  admin(action: AdminAction): number {
    this.events.clear();
    return applyAdmin(this, action);
  }

  inspectAi(side: Side): AiReport | null {
    return inspectAi(this, side);
  }

  command(side: Side, cmd: Command): void {
    if (side !== 0 && side !== 1) return;
    const q = this.commands;
    switch (cmd.type) {
      case 'train':
        q.push(side, CMD_TRAIN).kind = cmd.kind;
        break;
      case 'order':
        if (cmd.kind === undefined) {
          q.push(side, CMD_ORDER).order = cmd.order;
        } else {
          const c = q.push(side, CMD_KIND_ORDER);
          c.kind = cmd.kind;
          c.order = cmd.order;
        }
        break;
      case 'followArmy':
        if (cmd.kind === undefined) q.push(side, CMD_FOLLOW_ALL);
        else q.push(side, CMD_FOLLOW).kind = cmd.kind;
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
      case 'build': {
        const c = q.push(side, CMD_BUILD);
        c.build = cmd.kind;
        c.x = cmd.x;
        break;
      }
      case 'cancelBuild':
        q.push(side, CMD_CANCEL_BUILD).unit = cmd.site;
        break;
      case 'ready':
        q.push(side, CMD_READY);
        break;
      case 'deploy':
        q.push(side, CMD_DEPLOY).unit = cmd.at === 'auto' ? DEPLOY_AUTO : cmd.at === 'hq' ? DEPLOY_HQ : cmd.at;
        break;
      case 'clear':
        q.push(side, CMD_CLEAR).x = cmd.x;
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
