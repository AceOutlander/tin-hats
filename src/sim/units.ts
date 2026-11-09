/**
 * The unit pool: spawning, death, the hold-formation grid and entering the HQ.
 */
import { CONFIG, SPECIALS } from '../data/config';
import { resolveEra, unitVehicleLook, type VehicleKind } from '../data/eras';
import type { Side } from '../data/schema';
import { vehicleGun } from '../data/tankGuns';
import { WEAPONS } from '../data/weapons';
import { CLASS_TRENCH, DAMAGE_TYPES, KIND_BOSS, KIND_COUNT, KIND_DEFS, KIND_LIST, KIND_SAPPER, weaponIndex } from './tables';
import { releaseSlot } from './trenches';
import { TARGET_NONE, type Behaviour, type MountState, type SimEvent, type SimEventType, type UnitState } from './types';
import type { World } from './world';

/** Sapper tasks (UnitState.task). */
export const TASK_TO_DUMP = 0;
export const TASK_LOADING = 1;
export const TASK_TO_HQ = 2;

/** "Never fired": large but finite so it survives being added to every tick. */
const LONG_AGO = 1e6;
/** Fractional part of (a side's spawn count * this) spreads the per-unit jitter evenly over 0..1 (golden ratio sequence). */
const JITTER_STEP = 0.6180339887498949;
/** Index of the explosive damage type (a flamethrower that goes up). */
const EXPLOSIVE = DAMAGE_TYPES.indexOf('explosive');

export function createMount(): MountState {
  return {
    weapon: null,
    weaponIndex: -1,
    targetType: TARGET_NONE,
    targetIndex: -1,
    targetId: -1,
    aimX: 0,
    aim: 0,
    cooldown: 0,
    burstLeft: 0,
    burstTimer: 0,
    sinceShot: LONG_AGO,
    windup: 0,
    x: 0,
    damageMul: 1,
    rateMul: 1,
    trigger: true,
    spread: 0,
    accuracy: 1,
    rangeMul: 1,
    vehicleMul: 1,
  };
}

export function resetMount(m: MountState, weaponId: string | null, x: number): void {
  const index = weaponIndex(weaponId);
  const weapon = index >= 0 && weaponId !== null ? WEAPONS[weaponId] : null;
  m.weapon = weapon;
  m.weaponIndex = weapon ? index : -1;
  m.targetType = TARGET_NONE;
  m.targetIndex = -1;
  m.targetId = -1;
  m.x = x;
  m.aimX = x;
  m.aim = weapon ? weapon.aimTime : 0;
  m.cooldown = 0;
  m.burstLeft = 0;
  m.burstTimer = 0;
  m.sinceShot = LONG_AGO;
  m.windup = 0;
  m.trigger = true;
  m.rangeMul = 1;
  m.vehicleMul = 1;
}

/** A blank pool slot. */
export function createUnit(index: number): UnitState {
  return {
    index,
    id: -1,
    alive: false,
    kind: 'rifle',
    side: 0,
    faction: 'british',
    def: KIND_DEFS[0],
    behaviour: 'army',
    x: 0,
    prevX: 0,
    velX: 0,
    row: 0,
    facing: 1,
    hp: 0,
    maxHp: 0,
    action: 'idle',
    actionTime: 0,
    inside: false,
    carrying: 0,
    trenchId: -1,
    floor: 0,
    coverClass: CLASS_TRENCH,
    controlled: false,
    aimX: 0,
    weaponCharge: 1,
    mount: createMount(),
    mount2: createMount(),
    kindIndex: 0,
    engaged: false,
    goalX: 0,
    moveSpeed: 0,
    task: TASK_TO_DUMP,
    site: -1,
    taskTime: 0,
    cell: -1,
    cellSpan: 0,
    slotDepth: 0,
    jitter: 0,
    leash: 0,
    postX: 0,
    postTrench: -1,
    trench: -1,
    slot: -1,
    setup: 0,
    hitTime: -LONG_AGO,
    knock: 0,
    healIndex: -1,
    healId: -1,
    veteran: false,
    look: '',
    accuracy: 1,
    carrier: -1,
    carrierId: -1,
    passengers: 0,
    flushedUntil: -LONG_AGO,
    aaCooldown: 0,
    invincible: false,
    skis: false,
    rally: -1,
    ferry: -1,
  };
}

/**
 * Give an army unit a cell in its side's hold formation: the first free cell
 * at or behind its kind's formation depth. The cell also fixes its depth row.
 */
function allocCell(w: World, u: UnitState): void {
  const rows = CONFIG.rows;
  const cols = CONFIG.formationColumns;
  const cells = w.cells[u.side];
  const span = Math.max(1, Math.round(u.def.width / CONFIG.spacing));
  const firstCol = Math.max(0, Math.floor(u.def.formationDepth / CONFIG.spacing));
  for (let col = firstCol; col + span <= cols; col++) {
    for (let r = 0; r < rows; r++) {
      const row = CONFIG.formationRowOrder[r];
      let free = true;
      for (let k = 0; k < span; k++) {
        if (cells[(col + k) * rows + row] !== 0) {
          free = false;
          break;
        }
      }
      if (!free) continue;
      for (let k = 0; k < span; k++) cells[(col + k) * rows + row] = 1;
      u.cell = col * rows + row;
      u.cellSpan = span;
      u.row = row;
      // Odd rows sit half a column back, so a full formation is a checkerboard.
      u.slotDepth = col * CONFIG.spacing + (row % 2 === 1 ? CONFIG.spacing / 2 : 0);
      return;
    }
  }
  // Formation full (cannot happen under the population cap): share the kind's base depth.
  u.cell = -1;
  u.cellSpan = 0;
  u.slotDepth = u.def.formationDepth;
}

/** A garrison whose trench has fallen joins its side's army and takes a place in the hold formation. */
export function joinArmy(w: World, u: UnitState): void {
  u.behaviour = 'army';
  u.postTrench = -1;
  allocCell(w, u);
}

function freeCell(w: World, u: UnitState): void {
  if (u.cell < 0) return;
  const rows = CONFIG.rows;
  const cells = w.cells[u.side];
  for (let k = 0; k < u.cellSpan; k++) cells[u.cell + k * rows] = 0;
  u.cell = -1;
  u.cellSpan = 0;
}

/**
 * Put a new unit into the lowest free pool slot. Population is counted here
 * for mission-placed units; trained units paid theirs when they were queued.
 * Returns null if the pool is full (the caller must cope; nothing crashes).
 */
export function spawnUnit(
  w: World,
  side: Side,
  kindIndex: number,
  x: number,
  behaviour: Behaviour,
  inside: boolean,
  trained: boolean,
): UnitState | null {
  const s = w.state;
  const units = s.units;
  let index = -1;
  for (let i = 0; i < units.length; i++) {
    if (!units[i].alive) {
      index = i;
      break;
    }
  }
  if (index < 0) return null;
  if (index >= s.unitCount) s.unitCount = index + 1;

  const sideState = s.sides[side];
  const def = KIND_DEFS[kindIndex];
  const u = units[index];
  const margin = CONFIG.mapMargin;
  const px = x < margin ? margin : x > s.length - margin ? s.length - margin : x;

  u.id = w.nextUnitId++;
  u.alive = true;
  u.kind = KIND_LIST[kindIndex];
  u.kindIndex = kindIndex;
  u.side = side;
  // A kind the side fields as another nation (SideStart.rosterNation; FOUNDATIONS.md 5.1): names and looks only.
  const roster = w.mission.start[side].rosterNation;
  u.faction = (roster && roster[u.kind]) ?? sideState.faction;
  u.def = def;
  u.behaviour = behaviour;
  u.x = px;
  u.prevX = px;
  u.velX = 0;
  u.facing = side === 0 ? 1 : -1;
  u.maxHp = def.hp * w.mods[side].unitHealth[kindIndex];
  u.hp = u.maxHp;
  u.action = inside ? 'inside' : 'idle';
  u.actionTime = 0;
  u.inside = inside;
  u.carrying = 0;
  u.trenchId = -1;
  u.floor = 0;
  u.coverClass = CLASS_TRENCH;
  u.controlled = false;
  u.aimX = px;
  u.weaponCharge = 1;
  resetMount(u.mount, def.weapon, px);
  resetMount(u.mount2, def.secondary, px);
  u.engaged = false;
  u.goalX = px;
  u.moveSpeed = 0;
  u.task = TASK_TO_DUMP;
  u.site = -1;
  u.taskTime = 0;
  const serial = ++w.spawnCount[side];
  u.jitter = (serial * JITTER_STEP) % 1;
  u.mount.spread = u.jitter;
  u.mount2.spread = u.jitter;
  u.postX = px;
  u.leash = CONFIG.guardLeash;
  u.postTrench = -1;
  u.trench = -1;
  u.slot = -1;
  u.setup = 0;
  u.hitTime = -LONG_AGO;
  u.knock = 0;
  u.healIndex = -1;
  u.healId = -1;
  u.veteran = false;
  u.look = '';
  u.accuracy = 1;
  u.mount.accuracy = 1;
  u.mount2.accuracy = 1;
  u.carrier = -1;
  u.carrierId = -1;
  u.passengers = 0;
  u.flushedUntil = -LONG_AGO;
  u.aaCooldown = 0;
  u.invincible = false;
  u.skis = false;
  u.rally = -1;
  u.ferry = -1;
  u.cell = -1;
  u.cellSpan = 0;
  u.slotDepth = def.formationDepth;
  u.row = serial % CONFIG.rows;
  if (behaviour === 'army' && kindIndex !== KIND_SAPPER) allocCell(w, u);
  if (def.class === 'vehicle') armVehicle(w, u);

  sideState.alive[u.kind]++;
  if (!trained) sideState.pop += def.pop;
  if (inside && sideState.hq) sideState.hq.garrison++;

  const e = w.events.emit('unitSpawned');
  e.side = side;
  e.unit = index;
  e.unitId = u.id;
  e.kind = u.kind;
  e.x = px;
  e.row = u.row;
  e.value = trained ? 1 : 0;
  e.hit = inside;
  if (KIND_BOSS[kindIndex] === 1 && !inside) emitUnitEvent(w, 'bossArrived', u);
  return u;
}

/**
 * Give a vehicle the main gun of the look it is drawn with (its force's look, else its era's for its nation; TANK_GUNS
 * in src/data/tankGuns.ts): the cannon scale by calibre. Call again whenever u.look or u.faction changes. Only the
 * weapon changes; the mount's aim, accuracy and spread stay as they are.
 */
export function armVehicle(w: World, u: UnitState): void {
  if (u.def.class !== 'vehicle' || u.def.weapon === null) return;
  const m = w.mission;
  const era = resolveEra(u.faction, m.dateIso ?? null, m.climate ?? 'temperate');
  const gun = vehicleGun(u.kind, unitVehicleLook(era, u.kind as VehicleKind, u.look));
  const mount = u.mount;
  if (gun === null || (mount.weapon !== null && mount.weapon.id === gun)) return;
  const index = weaponIndex(gun);
  if (index < 0) return;
  mount.weapon = WEAPONS[gun];
  mount.weaponIndex = index;
  mount.aim = mount.weapon.aimTime;
  mount.cooldown = 0;
}

/** Remove a unit from play. `dtype` indexes DAMAGE_TYPES; `killerSide` is -1 if nobody gets the credit. */
export function killUnit(w: World, u: UnitState, dtype: number, dir: number, killerSide: number): void {
  const s = w.state;
  const side = s.sides[u.side];
  u.alive = false;
  u.hp = 0;
  side.pop -= u.def.pop;
  side.alive[u.kind]--;
  if (u.veteran) w.escorts[u.side * KIND_COUNT + u.kindIndex]--;
  side.stats.lost++;
  side.stats.lostByKind[u.kind]++;
  if (killerSide >= 0) {
    const killer = s.sides[killerSide].stats;
    killer.kills++;
    killer.killsByKind[u.kind]++;
  }
  // Men waiting for (or on) a ferry are off the field but not in the HQ.
  if (u.inside && u.carrier < 0 && u.ferry < 0 && side.hq) side.hq.garrison--;
  u.ferry = -1;
  if (u.passengers > 0) dropPassengers(w, u, false);
  freeCell(w, u);
  releaseSlot(w, u);

  if (u.controlled) {
    u.controlled = false;
    side.controlled = -1;
    const lost = w.events.emit('controlLost');
    lost.side = u.side;
    lost.unit = u.index;
    lost.unitId = u.id;
    lost.kind = u.kind;
  }

  const e = w.events.emit('unitDied');
  e.side = u.side;
  e.unit = u.index;
  e.unitId = u.id;
  e.kind = u.kind;
  e.x = u.x;
  e.row = u.row;
  e.cause = DAMAGE_TYPES[dtype];
  e.dir = dir;
  e.targetIndex = killerSide;

  while (s.unitCount > 0 && !s.units[s.unitCount - 1].alive) s.unitCount--;
}

/**
 * Take a unit off the field without a death: no unitDied event, no loss or kill counted (the view lets go of a unit
 * whose slot is no longer alive). The admin panel's take-over uses it before the unit reappears on the other side.
 */
export function removeUnit(w: World, u: UnitState): void {
  const s = w.state;
  const side = s.sides[u.side];
  u.alive = false;
  side.pop -= u.def.pop;
  side.alive[u.kind]--;
  if (u.veteran) w.escorts[u.side * KIND_COUNT + u.kindIndex]--;
  if (u.inside && u.carrier < 0 && u.ferry < 0 && side.hq) side.hq.garrison--;
  u.ferry = -1;
  if (u.passengers > 0) dropPassengers(w, u, false);
  freeCell(w, u);
  releaseSlot(w, u);
  if (u.controlled) {
    u.controlled = false;
    side.controlled = -1;
  }
  while (s.unitCount > 0 && !s.units[s.unitCount - 1].alive) s.unitCount--;
}

/** Garrison a unit that has reached its HQ door under Fall Back. */
export function enterHq(w: World, u: UnitState): void {
  const hq = w.state.sides[u.side].hq;
  if (!hq || u.inside) return;
  u.inside = true;
  u.velX = 0;
  u.engaged = false;
  u.mount.targetType = TARGET_NONE;
  u.mount.burstLeft = 0;
  u.mount2.targetType = TARGET_NONE;
  u.mount2.burstLeft = 0;
  u.mount2.windup = 0;
  releaseSlot(w, u);
  hq.garrison++;
  if (u.passengers > 0) dropPassengers(w, u, true);
}

/** Emit an event of `type` about unit u: side, unit, unitId, kind, x, row. */
export function emitUnitEvent(w: World, type: SimEventType, u: UnitState): SimEvent {
  const e = w.events.emit(type);
  e.side = u.side;
  e.unit = u.index;
  e.unitId = u.id;
  e.kind = u.kind;
  e.x = u.x;
  e.row = u.row;
  return e;
}

/** Make a freshly spawned unit a veteran (config.veteran): more health, a steadier aim. Counted in w.escorts. */
export function makeVeteran(w: World, u: UnitState): void {
  u.veteran = true;
  w.escorts[u.side * KIND_COUNT + u.kindIndex]++;
  u.maxHp *= CONFIG.veteran.hpMul;
  u.hp = u.maxHp;
  u.accuracy = CONFIG.veteran.accuracyMul;
}

/**
 * A flamethrower's fuel tank is hit from behind: ignite, then he dies (explosive) and the tank
 * bursts (an explosion event of radius SPECIALS.igniteRadius; it deals no damage).
 */
export function igniteUnit(w: World, u: UnitState, dir: number, killerSide: number): void {
  emitUnitEvent(w, 'ignite', u);
  const x = u.x;
  const row = u.row;
  const weapon = u.def.weapon;
  killUnit(w, u, EXPLOSIVE, dir, killerSide);
  const e = w.events.emit('explosion');
  e.side = killerSide;
  e.x = x;
  e.row = row;
  e.value = SPECIALS.igniteRadius;
  e.weapon = weapon;
  e.cause = 'explosive';
}

/** Put a man aboard an APC (the caller checked there is room). */
export function board(w: World, u: UnitState, apc: UnitState): void {
  releaseSlot(w, u);
  u.inside = true;
  u.carrier = apc.index;
  u.carrierId = apc.id;
  u.velX = 0;
  u.engaged = false;
  u.x = apc.x;
  u.mount.targetType = TARGET_NONE;
  u.mount.burstLeft = 0;
  u.mount2.targetType = TARGET_NONE;
  u.mount2.burstLeft = 0;
  u.mount2.windup = 0;
  u.action = 'inside';
  u.actionTime = 0;
  apc.passengers++;
}

/**
 * Everyone aboard an APC gets off: into the HQ garrison when the carrier itself went inside
 * (`intoHq`), otherwise onto the ground just behind it, SPECIALS.apcUnloadSpacing apart, each with a
 * unitSpawned event (value 0). Returns the number of men who got off.
 */
export function dropPassengers(w: World, apc: UnitState, intoHq: boolean): number {
  const s = w.state;
  const hq = s.sides[apc.side].hq;
  const dir = apc.side === 0 ? 1 : -1;
  const margin = CONFIG.mapMargin;
  let n = 0;
  for (let i = 0; i < s.unitCount; i++) {
    const p = s.units[i];
    if (!p.alive || p.carrier !== apc.index || p.carrierId !== apc.id) continue;
    p.carrier = -1;
    p.carrierId = -1;
    if (intoHq && hq) {
      hq.garrison++;
      p.x = hq.doorX;
      p.prevX = p.x;
      n++;
      continue;
    }
    let x = apc.x - dir * (apc.def.width / 2 + SPECIALS.apcUnloadSpacing * (n + 1));
    if (x < margin) x = margin;
    else if (x > s.length - margin) x = s.length - margin;
    p.inside = false;
    p.action = 'idle';
    p.actionTime = 0;
    p.x = x;
    p.prevX = x;
    p.goalX = x;
    p.aimX = x;
    p.facing = dir;
    n++;
    // Back on the field: the view shows him again.
    emitUnitEvent(w, 'unitSpawned', p).value = 0;
  }
  apc.passengers = 0;
  return n;
}
