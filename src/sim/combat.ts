/**
 * Generic, data-driven weapon handling shared by units, the HQ gun and
 * pillbox guns: target search and validation, the aim / fire / reload cycle,
 * hit rolls, and the deferred damage queue.
 */
import { CONFIG } from '../data/config';
import { killUnit } from './units';
import {
  CLASS_FORT,
  CLASS_HQ,
  CLASS_OPEN,
  CLASS_TRENCH,
  CLASS_VEHICLE,
  DAMAGE_TYPES,
  NO_PREFERENCE,
  WEAPON_DTYPE,
  WEAPON_HAS_PREFER,
  WEAPON_LIST,
  WEAPON_MASK,
  WEAPON_PREFER,
  damageFactor,
} from './tables';
import {
  TARGET_HQ,
  TARGET_NONE,
  TARGET_PILLBOX,
  TARGET_UNIT,
  type EntityKind,
  type MountState,
  type UnitState,
} from './types';
import type { World } from './world';

/** Weight of the preference rank against distance when scoring targets: rank always wins. */
const RANK_WEIGHT = 1e7;
/** Structures are engaged only when no unit is in range. */
const STRUCTURE_RANK = NO_PREFERENCE + 1;

/*
 * Allocation note. V8 boxes a floating-point value into a heap object whenever it is passed to a
 * function that is not inlined, returned from one, or kept in a module-level variable. Hot paths
 * here therefore hand numbers over in object fields (m.x, m.damageMul, m.rateMul, u.goalX,
 * u.moveSpeed) or in typed arrays, never as double arguments or return values.
 */

/** Result of the last search(): written here instead of returned so the tick never allocates. */
let foundType = TARGET_NONE;
let foundIndex = -1;
let foundId = -1;
let foundRank = 0;
/** World x of the last search() result (a typed array, so the double is not boxed). */
const FOUND_X = new Float64Array(1);

/** Damage-matrix column of a unit right now. */
export function unitClass(u: UnitState): number {
  if (u.def.class === 'vehicle') return CLASS_VEHICLE;
  return u.trenchId >= 0 ? CLASS_TRENCH : CLASS_OPEN;
}

/**
 * True if a smoke cloud blocks direct fire between two points. Lobbed weapons
 * never call this. No smoke exists until supports are simulated (Phase 2), but
 * the rule itself is complete.
 */
export function smokeBlocks(w: World, fromX: number, toX: number): boolean {
  const smokes = w.state.smokes;
  const dist = fromX < toX ? toX - fromX : fromX - toX;
  if (dist <= CONFIG.smokePointBlank) return false;
  const lo = fromX < toX ? fromX : toX;
  const hi = fromX < toX ? toX : fromX;
  for (let i = 0; i < smokes.length; i++) {
    const smoke = smokes[i];
    if (!smoke.alive) continue;
    if (smoke.x + smoke.radius >= lo && smoke.x - smoke.radius <= hi) return true;
  }
  return false;
}

/**
 * Find the best target for a mount (at m.x): the most preferred kind, then the
 * nearest. Units come before structures. The result is left in the found*
 * variables; returns false if nothing is in range.
 */
function search(w: World, m: MountState, side: number): boolean {
  const s = w.state;
  const x = m.x;
  const wi = m.weaponIndex;
  const weapon = WEAPON_LIST[wi];
  const mask = WEAPON_MASK[wi];
  const prefer = WEAPON_PREFER[wi];
  const range = weapon.range;
  const minRange = weapon.minRange;
  const direct = weapon.delivery !== 'lob';
  const enemy = 1 - side;
  const dir = side === 0 ? 1 : -1;
  foundType = TARGET_NONE;

  // Every enemy is at or beyond its side's front, so if the front is out of range everything is.
  if ((w.front[enemy] - x) * dir > range) return false;

  let best = Infinity;
  const units = s.units;
  for (let i = 0; i < s.unitCount; i++) {
    const t = units[i];
    if (!t.alive || t.side !== enemy || t.inside) continue;
    const d = t.x > x ? t.x - x : x - t.x;
    if (d > range || d < minRange) continue;
    if ((mask & (1 << unitClass(t))) === 0) continue;
    const rank = prefer[t.kindIndex];
    const score = rank * RANK_WEIGHT + d;
    if (score >= best) continue;
    if (direct && w.smokeCount > 0 && smokeBlocks(w, x, t.x)) continue;
    best = score;
    foundType = TARGET_UNIT;
    foundIndex = i;
    foundId = t.id;
    FOUND_X[0] = t.x;
    foundRank = rank;
  }

  if ((mask & (1 << CLASS_FORT)) !== 0) {
    const pillboxes = s.pillboxes;
    for (let i = 0; i < pillboxes.length; i++) {
      const p = pillboxes[i];
      if (!p.alive || p.side !== enemy) continue;
      const d = p.x > x ? p.x - x : x - p.x;
      if (d > range || d < minRange) continue;
      const score = STRUCTURE_RANK * RANK_WEIGHT + d;
      if (score >= best) continue;
      if (direct && w.smokeCount > 0 && smokeBlocks(w, x, p.x)) continue;
      best = score;
      foundType = TARGET_PILLBOX;
      foundIndex = i;
      foundId = -1;
      FOUND_X[0] = p.x;
      foundRank = STRUCTURE_RANK;
    }
  }

  if ((mask & (1 << CLASS_HQ)) !== 0) {
    const hq = s.sides[enemy].hq;
    if (hq && hq.alive) {
      const d = hq.doorX > x ? hq.doorX - x : x - hq.doorX;
      if (d <= range && d >= minRange) {
        const score = STRUCTURE_RANK * RANK_WEIGHT + d;
        if (score < best && !(direct && w.smokeCount > 0 && smokeBlocks(w, x, hq.doorX))) {
          foundType = TARGET_HQ;
          foundIndex = enemy;
          foundId = -1;
          FOUND_X[0] = hq.doorX;
          foundRank = STRUCTURE_RANK;
        }
      }
    }
  }
  return foundType !== TARGET_NONE;
}

/** Point the mount at the last search() result and start settling on it. */
function takeFound(m: MountState): void {
  const weapon = WEAPON_LIST[m.weaponIndex];
  m.targetType = foundType;
  m.targetIndex = foundIndex;
  m.targetId = foundId;
  m.aimX = FOUND_X[0];
  m.aim = weapon.aimTime;
  if (m.burstLeft > 0) {
    m.burstLeft = 0;
    m.cooldown = weapon.cooldown;
  }
}

function dropTarget(m: MountState): void {
  m.targetType = TARGET_NONE;
  m.targetIndex = -1;
  m.targetId = -1;
}

/**
 * Check that the mount's target is still alive, targetable and in range.
 * Refreshes aimX. Returns false (and the caller drops the target) otherwise.
 */
function targetValid(w: World, m: MountState): boolean {
  const s = w.state;
  const x = m.x;
  const wi = m.weaponIndex;
  const weapon = WEAPON_LIST[wi];
  let tx: number;
  switch (m.targetType) {
    case TARGET_UNIT: {
      const t = s.units[m.targetIndex];
      if (!t.alive || t.id !== m.targetId || t.inside) return false;
      if ((WEAPON_MASK[wi] & (1 << unitClass(t))) === 0) return false;
      tx = t.x;
      break;
    }
    case TARGET_HQ: {
      const hq = s.sides[m.targetIndex].hq;
      if (!hq || !hq.alive) return false;
      tx = hq.doorX;
      break;
    }
    case TARGET_PILLBOX: {
      const p = s.pillboxes[m.targetIndex];
      if (!p.alive) return false;
      tx = p.x;
      break;
    }
    default:
      return false;
  }
  const d = tx > x ? tx - x : x - tx;
  if (d > weapon.range || d < weapon.minRange) return false;
  if (weapon.delivery !== 'lob' && w.smokeCount > 0 && smokeBlocks(w, x, tx)) return false;
  m.aimX = tx;
  return true;
}

/** Preference rank of the mount's current (valid) target. */
function currentRank(w: World, m: MountState): number {
  if (m.targetType !== TARGET_UNIT) return STRUCTURE_RANK;
  return WEAPON_PREFER[m.weaponIndex][w.state.units[m.targetIndex].kindIndex];
}

/**
 * Keep a mount's target up to date. Retargets only when the target died or
 * left range, when a unit comes into range while it is shooting at a
 * structure, or (checked every `retarget` call) when a more preferred kind appears.
 * The caller sets `m.x` (the muzzle position) first. Returns true if the mount has a target afterwards.
 */
export function senseMount(w: World, m: MountState, side: number, retarget: boolean): boolean {
  if (m.weaponIndex < 0) return false;
  if (m.targetType !== TARGET_NONE) {
    if (targetValid(w, m)) {
      if (retarget) {
        const rank = currentRank(w, m);
        const couldImprove = rank === STRUCTURE_RANK || (rank > 0 && WEAPON_HAS_PREFER[m.weaponIndex]);
        if (couldImprove && search(w, m, side) && foundRank < rank) takeFound(m);
      }
      return true;
    }
    dropTarget(m);
  }
  if (search(w, m, side)) {
    takeFound(m);
    return true;
  }
  return false;
}

/** Fire one round from a mount at its current target. */
function fireShot(
  w: World,
  m: MountState,
  side: number,
  row: number,
  shooter: UnitState | null,
  source: EntityKind,
): void {
  const s = w.state;
  const x = m.x;
  const wi = m.weaponIndex;
  const weapon = WEAPON_LIST[wi];
  const dtype = WEAPON_DTYPE[wi];

  let tx = m.aimX;
  let trow = -1;
  let cls = CLASS_HQ;
  let targetId = -1;
  let target: EntityKind = 'hq';
  if (m.targetType === TARGET_UNIT) {
    const t = s.units[m.targetIndex];
    tx = t.x;
    trow = t.row;
    cls = unitClass(t);
    targetId = t.id;
    target = 'unit';
  } else if (m.targetType === TARGET_PILLBOX) {
    cls = CLASS_FORT;
    target = 'pillbox';
  }
  const dir = tx >= x ? 1 : -1;
  const dist = (tx - x) * dir;

  // Phase 2: 'direct' and 'lob' weapons will spawn a projectile here (flight time, scatter, splash).
  // NOT YET IMPLEMENTED: until then every delivery resolves as an instant single-target hit roll.
  let t = weapon.range > 0 ? dist / weapon.range : 0;
  if (t > 1) t = 1;
  const chance = weapon.accuracyNear + (weapon.accuracyFar - weapon.accuracyNear) * t;
  const hit = w.rng.next() < chance;
  if (hit) {
    const amount = weapon.damage * damageFactor(dtype, cls) * m.damageMul;
    w.damage.push(m.targetType, m.targetIndex, targetId, amount, side, dtype, dir);
  }

  m.sinceShot = 0;
  const e = w.events.emit('shot');
  e.side = side;
  e.source = source;
  if (shooter) {
    e.unit = shooter.index;
    e.unitId = shooter.id;
    e.kind = shooter.kind;
  }
  e.weapon = weapon.id;
  e.x = x;
  e.row = row;
  e.x2 = tx;
  e.row2 = trow;
  e.target = target;
  e.targetIndex = m.targetIndex;
  e.hit = hit;
  e.dir = dir;
}

/**
 * Advance a mount by one tick. The reload always runs; the aim only settles
 * while `active` (the shooter is standing on a target) and resets otherwise.
 * It fires when both are done, then plays out its burst.
 * The caller sets `m.x` (muzzle position), `m.damageMul` and `m.rateMul` first.
 */
export function updateMount(
  w: World,
  m: MountState,
  active: boolean,
  side: number,
  row: number,
  shooter: UnitState | null,
  source: EntityKind,
): void {
  if (m.weaponIndex < 0) return;
  const weapon = WEAPON_LIST[m.weaponIndex];
  const dt = w.dt;
  m.sinceShot += dt;
  if (m.cooldown > 0) {
    m.cooldown -= dt * m.rateMul;
    if (m.cooldown < 0) m.cooldown = 0;
  }
  if (!active || m.targetType === TARGET_NONE) {
    m.aim = weapon.aimTime;
    if (m.burstLeft > 0) {
      m.burstLeft = 0;
      m.cooldown = weapon.cooldown;
    }
    return;
  }
  if (m.burstLeft > 0) {
    m.burstTimer -= dt;
    if (m.burstTimer <= 0) {
      fireShot(w, m, side, row, shooter, source);
      m.burstLeft--;
      if (m.burstLeft > 0) m.burstTimer += weapon.burstInterval;
      else m.cooldown = weapon.cooldown;
    }
    return;
  }
  if (m.aim > 0) {
    m.aim -= dt;
    if (m.aim > 0) return;
    m.aim = 0;
  }
  if (m.cooldown > 0) return;
  fireShot(w, m, side, row, shooter, source);
  m.burstLeft = weapon.burst - 1;
  if (m.burstLeft > 0) m.burstTimer = weapon.burstInterval;
  else m.cooldown = weapon.cooldown;
}

/**
 * Apply all damage queued this tick. Runs after every unit and structure has
 * acted, so two units can kill each other in the same tick.
 */
export function applyDamage(w: World): void {
  const s = w.state;
  const q = w.damage;
  for (let i = 0; i < q.count; i++) {
    const amount = q.amount[i];
    const by = q.side[i];
    const dtype = q.dtype[i];
    const dir = q.dir[i];
    switch (q.targetType[i]) {
      case TARGET_UNIT: {
        const u = s.units[q.targetIndex[i]];
        if (!u.alive || u.id !== q.targetId[i] || u.inside) break;
        u.hp -= amount;
        s.sides[by].stats.damageDealt += amount;
        if (u.hp <= 0) {
          killUnit(w, u, dtype, dir, by);
        } else {
          const e = w.events.emit('unitHit');
          e.side = u.side;
          e.unit = u.index;
          e.unitId = u.id;
          e.kind = u.kind;
          e.x = u.x;
          e.row = u.row;
          e.value = amount;
          e.cause = DAMAGE_TYPES[dtype];
          e.dir = dir;
        }
        break;
      }
      case TARGET_HQ: {
        const hq = s.sides[q.targetIndex[i]].hq;
        if (!hq || !hq.alive) break;
        hq.hp -= amount;
        s.sides[by].stats.damageDealt += amount;
        const e = w.events.emit('structureHit');
        e.side = hq.side;
        e.target = 'hq';
        e.targetIndex = hq.side;
        e.x = hq.doorX;
        e.value = amount;
        e.cause = DAMAGE_TYPES[dtype];
        e.dir = dir;
        if (hq.hp <= 0) {
          hq.hp = 0;
          hq.alive = false;
          const d = w.events.emit('structureDestroyed');
          d.side = hq.side;
          d.target = 'hq';
          d.targetIndex = hq.side;
          d.x = hq.x;
        }
        break;
      }
      case TARGET_PILLBOX: {
        // Pillboxes take damage already; their own gun is NOT YET IMPLEMENTED (Phase 2).
        const p = s.pillboxes[q.targetIndex[i]];
        if (!p.alive) break;
        p.hp -= amount;
        s.sides[by].stats.damageDealt += amount;
        const e = w.events.emit('structureHit');
        e.side = p.side;
        e.target = 'pillbox';
        e.targetIndex = q.targetIndex[i];
        e.x = p.x;
        e.value = amount;
        e.cause = DAMAGE_TYPES[dtype];
        e.dir = dir;
        if (p.hp <= 0) {
          p.hp = 0;
          p.alive = false;
          const d = w.events.emit('structureDestroyed');
          d.side = p.side;
          d.target = 'pillbox';
          d.targetIndex = q.targetIndex[i];
          d.x = p.x;
        }
        break;
      }
      default:
        break;
    }
  }
  q.count = 0;
}
