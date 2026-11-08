/**
 * Generic, data-driven weapon handling shared by units, the HQ gun and
 * pillbox guns: target search and validation, the aim / fire / reload cycle,
 * hit rolls, projectile launches, and the deferred damage queue.
 */
import { CONFIG, SPECIALS } from '../data/config';
import { LAUNCH, launch } from './projectiles';
import {
  CLASS_FORT,
  CLASS_HQ,
  DAMAGE_TYPES,
  DUG_IN_NONE,
  DUG_IN_ONLY,
  DUG_IN_RANK,
  NO_PREFERENCE,
  WEAPON_DTYPE,
  KIND_ARMOUR_FRONT,
  KIND_ARMOUR_REAR,
  KIND_HAS_ARMOUR,
  KIND_REAR_IGNITE,
  WEAPON_DUG_IN,
  WEAPON_FLUSH,
  WEAPON_LIST,
  WEAPON_MASK,
  WEAPON_MIN_RANK,
  WEAPON_PREFER,
  WEAPON_PROJECTILE,
  WEAPON_STRUCT_RANK,
  damageFactor,
  unitClass,
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
import { flushUnit } from './trenches';
import { igniteUnit, killUnit } from './units';
import { DMG_FLEW_NEG, DMG_FLEW_POS, DMG_FLUSH, DMG_TOP, type World } from './world';

/** Index of the bullet damage type (a bullet in the back ignites a flamethrower). */
const BULLET = DAMAGE_TYPES.indexOf('bullet');

/** Weight of the preference rank against distance when scoring targets: rank always wins. */
const RANK_WEIGHT = 1e7;

/*
 * Allocation note. V8 boxes a floating-point value into a heap object whenever it is passed to a
 * function that is not inlined, returned from one, or kept in a module-level variable. Hot paths
 * here therefore hand numbers over in object fields (m.x, m.damageMul, m.rateMul, u.goalX,
 * u.moveSpeed) or in typed arrays (FOUND_X, LAUNCH), never as double arguments or return values.
 */

/** Result of the last search(): written here instead of returned so the tick never allocates. */
let foundType = TARGET_NONE;
let foundIndex = -1;
let foundId = -1;
let foundRank = 0;
/** World x of the last search() result (a typed array, so the double is not boxed). */
const FOUND_X = new Float64Array(1);

/**
 * True if a smoke cloud blocks direct fire between two points: the line crosses a cloud or ends
 * in one, and the shooter is not within config.smokePointBlank. Lobbed weapons never call this.
 */
export function smokeBlocks(w: World, fromX: number, toX: number): boolean {
  SMOKE_LINE[0] = fromX;
  SMOKE_LINE[1] = toX;
  return lineSmoked(w);
}

/** The two ends of the line lineSmoked() tests (a typed array, so hot callers pass no boxed doubles). */
const SMOKE_LINE = new Float64Array(2);

/** smokeBlocks() for the line SMOKE_LINE[0] to SMOKE_LINE[1]. */
function lineSmoked(w: World): boolean {
  const fromX = SMOKE_LINE[0];
  const toX = SMOKE_LINE[1];
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
 * Preference rank of an enemy unit for weapon `wi` (lower is chosen first), or -1 if the weapon
 * may not engage it at all (area weapons with dugIn 'only' and a lone man in the open).
 */
function unitRank(w: World, wi: number, t: UnitState): number {
  const rank = WEAPON_PREFER[wi][t.kindIndex];
  if (rank !== NO_PREFERENCE) return rank;
  const dugIn = WEAPON_DUG_IN[wi];
  if (dugIn === DUG_IN_NONE) return rank;
  if (t.trenchId >= 0 || w.cluster[t.index] >= CONFIG.clusterMin) return DUG_IN_RANK;
  return dugIn === DUG_IN_ONLY ? -1 : rank;
}

/**
 * Find the best target for a mount (at m.x): the lowest rank, then the nearest. The result is
 * left in the found* variables; returns false if nothing is in range.
 */
function search(w: World, m: MountState, side: number): boolean {
  const s = w.state;
  const x = m.x;
  const wi = m.weaponIndex;
  const weapon = WEAPON_LIST[wi];
  const mask = WEAPON_MASK[wi];
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
  const spreadWu = CONFIG.targetSpread;
  const offset = m.spread;
  for (let i = 0; i < s.unitCount; i++) {
    const t = units[i];
    if (!t.alive || t.side !== enemy || t.inside) continue;
    const d = t.x > x ? t.x - x : x - t.x;
    if (d > range || d < minRange) continue;
    if ((mask & (1 << unitClass(t))) === 0) continue;
    const rank = unitRank(w, wi, t);
    if (rank < 0) continue;
    // Fire distribution: this shooter's own fixed bias for each target (see config.targetSpread).
    let bias = t.jitter + offset;
    if (bias >= 1) bias -= 1;
    const score = rank * RANK_WEIGHT + d + bias * spreadWu;
    if (score >= best) continue;
    if (direct && w.smokeCount > 0) {
      SMOKE_LINE[0] = x;
      SMOKE_LINE[1] = t.x;
      if (lineSmoked(w)) continue;
    }
    best = score;
    foundType = TARGET_UNIT;
    foundIndex = i;
    foundId = t.id;
    FOUND_X[0] = t.x;
    foundRank = rank;
  }

  const structRank = WEAPON_STRUCT_RANK[wi];
  if ((mask & (1 << CLASS_FORT)) !== 0) {
    const pillboxes = s.pillboxes;
    for (let i = 0; i < pillboxes.length; i++) {
      const p = pillboxes[i];
      if (!p.alive || p.side !== enemy) continue;
      const d = p.x > x ? p.x - x : x - p.x;
      if (d > range || d < minRange) continue;
      const score = structRank * RANK_WEIGHT + d;
      if (score >= best) continue;
      if (direct && w.smokeCount > 0) {
        SMOKE_LINE[0] = x;
        SMOKE_LINE[1] = p.x;
        if (lineSmoked(w)) continue;
      }
      best = score;
      foundType = TARGET_PILLBOX;
      foundIndex = i;
      foundId = -1;
      FOUND_X[0] = p.x;
      foundRank = structRank;
    }
  }

  if ((mask & (1 << CLASS_HQ)) !== 0) {
    const hq = s.sides[enemy].hq;
    if (hq && hq.alive) {
      const d = hq.doorX > x ? hq.doorX - x : x - hq.doorX;
      if (d <= range && d >= minRange) {
        const score = structRank * RANK_WEIGHT + d;
        let blocked = false;
        if (direct && w.smokeCount > 0) {
          SMOKE_LINE[0] = x;
          SMOKE_LINE[1] = hq.doorX;
          blocked = lineSmoked(w);
        }
        if (score < best && !blocked) {
          foundType = TARGET_HQ;
          foundIndex = enemy;
          foundId = -1;
          FOUND_X[0] = hq.doorX;
          foundRank = structRank;
        }
      }
    }
  }
  return foundType !== TARGET_NONE;
}

/**
 * Point the mount at the last search() result and start settling on it: the full aim time from
 * nothing, config.switchAimFrac of it when swinging over from another target (`switching`). A burst
 * in progress carries on at the new target (a gunner swings to the next man).
 */
function takeFound(m: MountState, switching: boolean): void {
  const weapon = WEAPON_LIST[m.weaponIndex];
  m.targetType = foundType;
  m.targetIndex = foundIndex;
  m.targetId = foundId;
  m.aimX = FOUND_X[0];
  m.aim = switching ? weapon.aimTime * CONFIG.switchAimFrac : weapon.aimTime;
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
      if (unitRank(w, wi, t) < 0) return false;
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
  if (weapon.delivery !== 'lob' && w.smokeCount > 0) {
    SMOKE_LINE[0] = x;
    SMOKE_LINE[1] = tx;
    if (lineSmoked(w)) return false;
  }
  m.aimX = tx;
  return true;
}

/** Preference rank of the mount's current (valid) target. */
function currentRank(w: World, m: MountState): number {
  if (m.targetType !== TARGET_UNIT) return WEAPON_STRUCT_RANK[m.weaponIndex];
  return unitRank(w, m.weaponIndex, w.state.units[m.targetIndex]);
}

/**
 * Keep a mount's target up to date. Retargets only when the target died or
 * left range, or (checked every `retarget` call) when a target of a better
 * rank appears: a preferred kind, a dug-in or clustered enemy for area weapons,
 * or any unit while it is shooting at a structure it does not prefer.
 * The caller sets `m.x` (the muzzle position) first. Returns true if the mount has a target afterwards.
 */
export function senseMount(w: World, m: MountState, side: number, retarget: boolean): boolean {
  if (m.weaponIndex < 0) return false;
  const had = m.targetType !== TARGET_NONE;
  if (had) {
    if (targetValid(w, m)) {
      if (retarget) {
        const rank = currentRank(w, m);
        if (rank > WEAPON_MIN_RANK[m.weaponIndex] && search(w, m, side) && foundRank < rank) takeFound(m, true);
      }
      return true;
    }
    dropTarget(m);
  }
  if (search(w, m, side)) {
    takeFound(m, had);
    return true;
  }
  return false;
}

/**
 * Fire one round from a mount at its current target: a hit roll for hitscan weapons, a projectile
 * for direct and lobbed ones. A thrown round leaves after its windup, by which time the target may
 * be gone: it then lands where the target was last seen (m.aimX).
 */
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
    if (t.alive && t.id === m.targetId) {
      tx = t.x;
      trow = t.row;
      cls = unitClass(t);
      targetId = t.id;
      target = 'unit';
    } else {
      target = 'ground';
    }
  } else if (m.targetType === TARGET_PILLBOX) {
    cls = CLASS_FORT;
    target = 'pillbox';
  } else if (m.targetType === TARGET_NONE) {
    target = 'ground';
  }
  const dir = tx >= x ? 1 : -1;
  const dist = (tx - x) * dir;

  let hit = false;
  if (WEAPON_PROJECTILE[wi] === 1) {
    // Scatter grows with distance, from scatterMinFrac of the weapon's scatter up to all of it at full range.
    let land = tx;
    if (weapon.scatter > 0) {
      let frac = weapon.range > 0 ? dist / weapon.range : 1;
      if (frac > 1) frac = 1;
      if (frac < CONFIG.scatterMinFrac) frac = CONFIG.scatterMinFrac;
      land += (w.rng.gauss() * weapon.scatter * frac) / m.accuracy;
      if (land < 0) land = 0;
      else if (land > s.length) land = s.length;
    }
    LAUNCH[0] = x;
    LAUNCH[1] = land;
    LAUNCH[2] = m.damageMul;
    LAUNCH[3] = 0;
    LAUNCH[4] = 1;
    LAUNCH[5] = 1;
    LAUNCH[6] = 0;
    launch(w, side, wi, row, trow, shooter, source);
  } else if (target !== 'ground') {
    let t = weapon.range > 0 ? dist / weapon.range : 0;
    if (t > 1) t = 1;
    const chance = (weapon.accuracyNear + (weapon.accuracyFar - weapon.accuracyNear) * t) * m.accuracy;
    hit = w.rng.next() < chance;
    if (hit) {
      const flush = WEAPON_FLUSH[wi] === 1;
      let amount = weapon.damage * damageFactor(dtype, cls) * m.damageMul;
      if (flush && cls === CLASS_FORT) amount *= SPECIALS.flamePillboxMul;
      w.damage.push(m.targetType, m.targetIndex, targetId, amount, side, dtype, dir, flush ? DMG_FLUSH : 0);
    }
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
  e.targetIndex = target === 'ground' ? -1 : m.targetIndex;
  e.hit = hit;
  e.dir = dir;
}

/**
 * Advance a mount by one tick. The reload always runs; the aim only settles
 * while `active` (the shooter is standing on a target) and resets otherwise.
 * It fires when both are done and `m.trigger` is set, then plays out its burst. A thrown weapon first
 * winds up for config.throwReleaseTime and lets go even if the thrower is interrupted.
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
  if (m.windup > 0) {
    m.windup -= dt;
    if (m.windup <= 1e-9) {
      m.windup = 0;
      fireShot(w, m, side, row, shooter, source);
      m.cooldown = weapon.cooldown;
    }
    return;
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
  if (m.cooldown > 0 || !m.trigger) return;
  if (weapon.thrown && CONFIG.throwReleaseTime > 0) {
    m.windup = CONFIG.throwReleaseTime;
    return;
  }
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
    let amount = q.amount[i];
    const by = q.side[i];
    const dtype = q.dtype[i];
    const dir = q.dir[i];
    switch (q.targetType[i]) {
      case TARGET_UNIT: {
        const u = s.units[q.targetIndex[i]];
        if (!u.alive || u.id !== q.targetId[i] || u.inside) break;
        const flags = q.flags[i];
        const k = u.kindIndex;
        if (KIND_HAS_ARMOUR[k] === 1 && (flags & DMG_TOP) === 0) {
          // Hit-facing armour: a blow travelling the way the vehicle faces came from behind.
          const from = (flags & DMG_FLEW_POS) !== 0 ? 1 : (flags & DMG_FLEW_NEG) !== 0 ? -1 : dir;
          amount *= from === u.facing ? KIND_ARMOUR_REAR[k] : KIND_ARMOUR_FRONT[k];
        }
        if (KIND_REAR_IGNITE[k] === 1 && dtype === BULLET && dir === u.facing) {
          // A bullet in the fuel tank on his back: he goes up at once.
          s.sides[by].stats.damageDealt += u.hp;
          igniteUnit(w, u, dir, by);
          break;
        }
        u.hp -= amount;
        u.hitTime = s.time;
        s.sides[by].stats.damageDealt += amount;
        if (u.hp <= 0) {
          killUnit(w, u, dtype, dir, by);
        } else {
          if ((flags & DMG_FLUSH) !== 0 && u.slot >= 0) flushUnit(w, u);
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
          // Rubble: it stops firing and blocking, and stays in the list for the view.
          p.hp = 0;
          p.alive = false;
          p.gun.targetType = TARGET_NONE;
          p.gun.burstLeft = 0;
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
