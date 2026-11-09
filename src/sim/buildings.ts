/**
 * Buildings, rubble and cover props (FOUNDATIONS.md 4.3).
 *
 * A building's window slots are a slot record in state.trenches (TrenchState.building >= 0, id BUILDINGS.idBase + the
 * building's id), so taking a slot, dropping in, capture by entering it empty, garrisons, the hold line and the front
 * clamp are the trench code's (src/sim/trenches.ts). This file adds what a building has and a trench does not: slots
 * on floors (ground floor first; anti-tank teams climb to the top), its own target class (enterSlot asks
 * seatInBuilding for it), the range of the upper floors and the top floor's shot down onto a tank, walls that take
 * explosive damage and lose their floors top first, and rubble at 0 hp, which shelters half as many men
 * (`rubbleCover`). A cover prop (wagons, a wreck) is rubble from the start that takes no damage.
 *
 * A mission without buildings or props has no slot records of this kind and none of this code does anything.
 */
import { BUILDINGS } from '../data/buildings';
import { DAMAGE } from '../data/damage';
import type { BuildingDef, CoverPropDef, MissionDef, PointRef } from '../data/schema';
import { CLASS_BUILDING, CLASS_RUBBLE, DAMAGE_TYPES, WEAPON_DTYPE } from './tables';
import { claimSlot, enterSlot, releaseSlot } from './trenches';
import { TARGET_BUILDING, TARGET_UNIT, type BattleState, type BuildingState, type TrenchState, type UnitState } from './types';
import type { World } from './world';

/** slotUnit value of a slot that is gone (on a fallen floor, or beyond the rubble's room). */
export const SLOT_SEALED = -2;

const ANTI_TANK = DAMAGE_TYPES.indexOf('antiTank');
const EXPLOSIVE = DAMAGE_TYPES.indexOf('explosive');
/** Weight of a floor against distance when a man picks a building slot: the floor always wins. */
const FLOOR_WEIGHT = 1e4;

/** Id of building `id`'s slot record in state.trenches. */
export function buildingTrenchId(id: number): number {
  return BUILDINGS.idBase + id;
}


/** The slot record id a point names: a trench's own id, or a building's record. */
export function refTrenchId(ref: PointRef | { building: number } | { trench: number }): number {
  return 'building' in ref ? buildingTrenchId(ref.building) : ref.trench;
}

/** Index in state.buildings of building (or cover prop) `id`, or -1. Buildings and props share one id space. */
export function buildingIndex(buildings: readonly BuildingState[], id: number): number {
  for (let i = 0; i < buildings.length; i++) if (buildings[i].id === id) return i;
  return -1;
}

/** Slots in a building's rubble: BUILDINGS.rubbleSlots of what it had, at least one. */
export function rubbleSlotCount(floors: number, slotsPerFloor: number): number {
  return Math.max(1, Math.floor(floors * slotsPerFloor * BUILDINGS.rubbleSlots));
}

/**
 * The mission's buildings and cover props as state, each with its slot record appended to `trenches` (after the
 * mission's own trenches, so their indices do not change).
 */
export function createBuildings(mission: MissionDef, trenches: TrenchState[]): BuildingState[] {
  const out: BuildingState[] = [];
  const record = (id: number, x: number, width: number, slots: number, owner: number): number => {
    trenches.push({ id, x, width, slots, owner, occupants: 0, capturedAt: -1, building: out.length });
    return trenches.length - 1;
  };
  for (const b of mission.buildings ?? []) out.push(buildingState(b, record(buildingTrenchId(b.id), b.x, b.width, b.floors * b.slotsPerFloor, b.owner)));
  for (const p of mission.props ?? []) out.push(propState(p, record(buildingTrenchId(p.id), p.x, p.width, p.slots, p.owner ?? -1)));
  return out;
}

function buildingState(b: BuildingDef, trench: number): BuildingState {
  const maxHp = BUILDINGS.hp * b.hpMul;
  return {
    id: b.id,
    x: b.x,
    width: b.width,
    floors: b.floors,
    floorsLeft: b.floors,
    slotsPerFloor: b.slotsPerFloor,
    hp: maxHp,
    maxHp,
    look: b.look,
    trench,
    owner: b.owner,
    occupants: 0,
    inside: [0, 0],
    contested: false,
    rubble: false,
    prop: false,
    breakable: b.collapse !== 'none',
    spawn: b.spawn === true,
    hitAt: -1,
  };
}

function propState(p: CoverPropDef, trench: number): BuildingState {
  return {
    id: p.id,
    x: p.x,
    width: p.width,
    floors: 1,
    floorsLeft: 0,
    slotsPerFloor: p.slots,
    hp: 0,
    maxHp: 0,
    look: p.look,
    trench,
    owner: p.owner ?? -1,
    occupants: 0,
    inside: [0, 0],
    contested: false,
    rubble: true,
    prop: true,
    breakable: false,
    spawn: false,
    hitAt: -1,
  };
}

/** Spread `count` slots of record `t` along its footprint from slot index `first`, on floor `floor`. */
function spreadSlots(w: World, first: number, count: number, x: number, width: number, floor: number): void {
  const spacing = count > 0 ? Math.min(BUILDINGS.slotSpacing, width / count) : 0;
  for (let k = 0; k < count; k++) {
    w.slotX[first + k] = x + (k - (count - 1) / 2) * spacing;
    w.slotFloor[first + k] = floor;
    w.slotUnit[first + k] = -1;
  }
}

/** Slot positions of the buildings and props, floor by floor (after layoutTrenches, which spread them as a trench). */
export function layoutBuildings(w: World): void {
  const s = w.state;
  for (let i = 0; i < s.buildings.length; i++) {
    const b = s.buildings[i];
    const first = w.trenchSlot0[b.trench];
    if (b.prop) {
      spreadSlots(w, first, b.slotsPerFloor, b.x, b.width, 0);
      continue;
    }
    for (let f = 0; f < b.floors; f++) spreadSlots(w, first + f * b.slotsPerFloor, b.slotsPerFloor, b.x, b.width, f);
  }
}

/**
 * Score added to a building slot's distance when `u` picks one (claimSlot): the ground floor first, the top floor
 * first for anti-tank weapons. 0 for a trench slot, so trenches pick exactly as before.
 */
export function floorPreference(w: World, u: UnitState, slot: number): number {
  const f = w.slotFloor[slot];
  if (f === 0) return 0;
  const wi = u.mount.weaponIndex;
  const high = wi >= 0 && WEAPON_DTYPE[wi] === ANTI_TANK;
  return (high ? -f : f) * FLOOR_WEIGHT;
}

/** The floor bonuses of a man in building `b`: range from floor 2 up, the top floor's shot down onto a tank. */
function floorMods(u: UnitState, b: BuildingState): void {
  const standing = !b.rubble;
  const range = standing && u.floor >= 1 ? BUILDINGS.upperFloorRange : 1;
  const top = standing && b.floorsLeft >= BUILDINGS.topFloorMinFloors && u.floor === b.floorsLeft - 1;
  u.mount.rangeMul = range;
  u.mount2.rangeMul = range;
  const m1 = u.mount.weaponIndex;
  const m2 = u.mount2.weaponIndex;
  u.mount.vehicleMul = top && m1 >= 0 && WEAPON_DTYPE[m1] === ANTI_TANK ? BUILDINGS.topFloorVsVehicles : 1;
  u.mount2.vehicleMul = top && m2 >= 0 && WEAPON_DTYPE[m2] === ANTI_TANK ? BUILDINGS.topFloorVsVehicles : 1;
}

/** A man drops into a building slot (enterSlot): his floor, target class and floor bonuses. */
export function seatInBuilding(w: World, u: UnitState, bi: number): void {
  const b = w.state.buildings[bi];
  u.floor = w.slotFloor[u.slot];
  u.coverClass = b.rubble ? CLASS_RUBBLE : CLASS_BUILDING;
  floorMods(u, b);
}

/**
 * After the trench update: each building's owner and men (copies of its slot record's), who is inside its span, and
 * whether it is contested (the other side's infantry inside while its owner holds it).
 */
export function updateBuildings(w: World): void {
  const s = w.state;
  const buildings = s.buildings;
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    const t = s.trenches[b.trench];
    b.owner = t.owner;
    b.occupants = t.occupants;
    b.inside[0] = w.trenchInside[b.trench * 2];
    b.inside[1] = w.trenchInside[b.trench * 2 + 1];
    b.contested = b.owner >= 0 && b.inside[1 - b.owner] > 0;
  }
}

/**
 * Splash on the walls (projectiles.ts explode): every standing, breakable building within `r` of x that `side` does
 * not own takes `base` x falloff x BUILDINGS.wallDamage of its damage type, through the damage queue.
 */
export function splashWalls(w: World, side: number, x: number, r: number, base: number, dtype: number, dir: number): void {
  const buildings = w.state.buildings;
  const share = BUILDINGS.wallDamage[DAMAGE_TYPES[dtype]];
  if (share <= 0) return;
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    if (!b.breakable || b.rubble || b.owner === side) continue;
    const d = (b.x > x ? b.x - x : x - b.x) - b.width / 2;
    if (d > r) continue;
    const falloff = d <= 0 ? 1 : 1 - d / r;
    w.damage.push(TARGET_BUILDING, i, -1, base * falloff * share, side, dtype, dir, 0);
  }
}

/** Pool indices of the men holding or walking to slots [from, to) of a record. */
function holders(w: World, from: number, to: number, out: number[]): void {
  out.length = 0;
  for (let g = from; g < to; g++) if (w.slotUnit[g] >= 0) out.push(w.slotUnit[g]);
}

const MEN: number[] = [];

/** The damage a man takes when the floor he stands on comes down (the building column of the matrix applies). */
function crush(w: World, u: UnitState, by: number, dir: number): void {
  const amount = BUILDINGS.collapseDamage * DAMAGE.explosive.infantryBuilding;
  w.damage.push(TARGET_UNIT, u.index, u.id, amount, by, EXPLOSIVE, dir, 0);
}

/** The top standing floor of building `bi` falls in: its men are hurt and drop to a floor below if there is room. */
function loseFloor(w: World, bi: number, by: number, dir: number): void {
  const s = w.state;
  const b = s.buildings[bi];
  const t = b.trench;
  const f = b.floorsLeft - 1;
  b.floorsLeft = f;
  const from = w.trenchSlot0[t] + f * b.slotsPerFloor;
  const to = from + b.slotsPerFloor;
  holders(w, from, to, MEN);
  for (const i of MEN) releaseSlot(w, s.units[i]);
  for (let g = from; g < to; g++) {
    w.slotUnit[g] = SLOT_SEALED;
    w.trenchTaken[t]++;
  }
  for (const i of MEN) {
    const u = s.units[i];
    crush(w, u, by, dir);
    if (claimSlot(w, u, t) && u.x === w.slotX[u.slot]) enterSlot(w, u);
  }
  // The top floor is another one now.
  const first = w.trenchSlot0[t];
  for (let g = first; g < first + f * b.slotsPerFloor; g++) {
    const k = w.slotUnit[g];
    if (k >= 0 && s.units[k].trenchId >= 0) floorMods(s.units[k], b);
  }
  const e = w.events.emit('floorCollapsed');
  e.side = b.owner;
  e.targetIndex = bi;
  e.value = f;
  e.x = b.x;
}

/**
 * Hook for the ground (FOUNDATIONS.md 4.2): a fallen building's footprint becomes `rubble` ground for the rest of the
 * battle. The ground speed table is another job's (it is wired in here when it lands); until then rubble changes only
 * the cover. Called once per building, as it falls.
 */
export function onCollapse(w: World, b: BuildingState): void {
  void w;
  void b;
}

/** Building `bi` falls: everyone in it is hurt and thrown out, and its rubble shelters half as many men. */
function fall(w: World, bi: number, by: number, dir: number): void {
  const s = w.state;
  const b = s.buildings[bi];
  const t = b.trench;
  const first = w.trenchSlot0[t];
  const total = s.trenches[t].slots;
  b.hp = 0;
  b.floorsLeft = 0;
  b.rubble = true;
  holders(w, first, first + total, MEN);
  for (const i of MEN) {
    const u = s.units[i];
    const seated = u.trenchId >= 0;
    releaseSlot(w, u);
    if (seated) crush(w, u, by, dir);
  }
  const room = rubbleSlotCount(b.floors, b.slotsPerFloor);
  spreadSlots(w, first, room, b.x, b.width, 0);
  for (let g = first + room; g < first + total; g++) w.slotUnit[g] = SLOT_SEALED;
  w.trenchTaken[t] = total - room;
  const e = w.events.emit('structureDestroyed');
  e.side = b.owner;
  e.target = 'building';
  e.targetIndex = bi;
  e.x = b.x;
  onCollapse(w, b);
}

/** Damage on building `bi`'s walls (applyDamage): floors fall below their share of its health, rubble at 0. */
export function damageBuilding(w: World, bi: number, amount: number, by: number, dtype: number, dir: number): void {
  const s = w.state;
  const b = s.buildings[bi];
  if (!b.breakable || b.rubble) return;
  b.hp -= amount;
  b.hitAt = s.time;
  const e = w.events.emit('structureHit');
  e.side = b.owner;
  e.target = 'building';
  e.targetIndex = bi;
  e.x = b.x;
  e.value = amount;
  e.cause = DAMAGE_TYPES[dtype];
  e.dir = dir;
  while (b.floorsLeft > 1 && b.hp < (b.maxHp * (b.floorsLeft - 1)) / b.floors) loseFloor(w, bi, by, dir);
  if (b.hp <= 0) fall(w, bi, by, dir);
}

/**
 * Living infantry of `side` (sappers too: a man inside is a man inside) within the span of the trench or building a
 * point names (the director's `contested` loss). 0 for a point that does not exist.
 */
export function infantryInside(s: BattleState, ref: PointRef, side: number): number {
  const id = refTrenchId(ref);
  let t = -1;
  for (let i = 0; i < s.trenches.length; i++) {
    if (s.trenches[i].id === id) {
      t = i;
      break;
    }
  }
  if (t < 0) return 0;
  const tr = s.trenches[t];
  const half = tr.width / 2;
  let n = 0;
  for (let i = 0; i < s.unitCount; i++) {
    const u = s.units[i];
    if (!u.alive || u.inside || u.side !== side || u.def.class !== 'infantry') continue;
    const d = u.x - tr.x;
    if (d >= -half && d <= half) n++;
  }
  return n;
}
