/**
 * What every unit does each tick, in three passes over the pool:
 *   senseUnits  decide (targets, stand or move, where to) from the positions at the start of the tick;
 *   moveUnits   move (sappers, formation, advance, fall back) under the front clamp;
 *   fireUnits   run the weapons and set the animation fields.
 * Splitting the passes keeps the tick side-symmetric: no unit ever reacts to
 * a move another unit made earlier in the same tick.
 */
import { CONFIG } from '../data/config';
import type { UnitAction } from '../data/schema';
import { senseMount, updateMount } from './combat';
import { KIND_SAPPER, WEAPON_LIST } from './tables';
import { TARGET_NONE, type UnitState } from './types';
import { TASK_LOADING, TASK_TO_DUMP, TASK_TO_HQ, enterHq } from './units';
import type { World } from './world';

/** Where a unit stands in the hold formation: its cell depth behind the line, but never behind the HQ door. */
function slotX(w: World, u: UnitState, lineX: number, dir: number): number {
  let x = lineX - dir * u.slotDepth;
  const hq = w.state.sides[u.side].hq;
  if (hq && (x - hq.doorX) * dir < 0) x = hq.doorX;
  return x;
}

/** Pass 1: targets, and for each army unit whether it stands to fight (`engaged`) and where it is heading (`goalX`). */
export function senseUnits(w: World): void {
  const s = w.state;
  const units = s.units;
  const retargetTicks = w.retargetTicks;
  for (let i = 0; i < s.unitCount; i++) {
    const u = units[i];
    if (!u.alive || u.inside || u.kindIndex === KIND_SAPPER) continue;
    const side = s.sides[u.side];
    const dir = u.side === 0 ? 1 : -1;
    const order = u.behaviour === 'army' ? side.order : u.behaviour === 'assault' ? 'advance' : 'hold';
    const m = u.mount;
    const armed = m.weaponIndex >= 0;

    let hasTarget = false;
    if (armed) {
      const prevType = m.targetType;
      const prevIndex = m.targetIndex;
      const prevId = m.targetId;
      hasTarget = senseMount(w, m, u.side, u.x, (s.tick + i) % retargetTicks === 0);
      // A new target means deciding afresh whether to close in or stand.
      if (!hasTarget || m.targetType !== prevType || m.targetIndex !== prevIndex || m.targetId !== prevId) {
        u.engaged = false;
      }
    }
    // Phase 2: a directly controlled unit takes its movement and fire from controlInput here. NOT YET IMPLEMENTED.

    if (order === 'fallBack') {
      u.engaged = false;
      u.goalX = side.hq && side.hq.alive ? side.hq.doorX : slotX(w, u, side.holdLineX, dir);
      continue;
    }

    if (u.behaviour === 'guard') {
      // Phase 2: guards may roam within config.guardLeash of their post. For now they hold it.
      u.engaged = hasTarget;
      u.goalX = u.postX;
      continue;
    }

    if (order === 'hold') {
      const lineX = side.holdLineX;
      // Phase 2: trench-capable infantry walk to a free trench slot instead. NOT YET IMPLEMENTED.
      if ((u.x - lineX) * dir > CONFIG.holdLineTolerance) {
        // Out in front of the line: walk back without fighting.
        u.engaged = false;
        u.goalX = slotX(w, u, lineX, dir);
      } else if (hasTarget) {
        u.engaged = true;
        u.goalX = u.x;
      } else {
        u.engaged = false;
        const forward = lineX - dir * u.def.formationDepth;
        const weapon = m.weapon;
        if (weapon && u.slotDepth > u.def.formationDepth && (w.front[1 - u.side] - forward) * dir <= weapon.range) {
          // The enemy is within reach of the line: rear ranks close up until they can fire.
          u.goalX = forward;
        } else {
          u.goalX = slotX(w, u, lineX, dir);
        }
      }
      continue;
    }

    // Advance.
    const weapon = m.weapon;
    if (!weapon) {
      // Unarmed troops (medics) follow behind the leading armed unit.
      u.engaged = false;
      u.goalX = w.armedFront[u.side] - dir * (u.def.formationDepth + u.jitter * CONFIG.engageSpread);
    } else if (hasTarget) {
      if (!u.engaged) {
        const d = m.aimX > u.x ? m.aimX - u.x : u.x - m.aimX;
        let engageAt = weapon.range * u.def.engageFrac - u.jitter * CONFIG.engageSpread;
        if (engageAt < weapon.minRange) engageAt = weapon.minRange;
        u.engaged = d <= engageAt;
      }
      u.goalX = dir > 0 ? s.length : 0;
    } else {
      u.engaged = false;
      u.goalX = dir > 0 ? s.length : 0;
    }
  }
}

/**
 * Walk a unit toward goalX at `speed`. Forward movement stops at the front
 * clamp (never past the nearest enemy blocker minus contactGap); the unit is
 * never pushed back. Returns true when it stands on the goal.
 */
function walk(w: World, u: UnitState, goalX: number, speed: number, dir: number): boolean {
  const s = w.state;
  const step = speed * w.dt;
  const dx = goalX - u.x;
  let nx = dx > step ? u.x + step : dx < -step ? u.x - step : goalX;
  if ((nx - u.x) * dir > 0) {
    const limit = w.limit[u.side];
    if ((nx - limit) * dir > 0) nx = (u.x - limit) * dir > 0 ? u.x : limit;
  }
  const margin = CONFIG.mapMargin;
  if (nx < margin) nx = margin;
  else if (nx > s.length - margin) nx = s.length - margin;
  u.velX = (nx - u.x) / w.dt;
  u.x = nx;
  if (u.velX > 0) u.facing = 1;
  else if (u.velX < 0) u.facing = -1;
  return nx === goalX;
}

/** A sapper reaching the HQ door hands over its crate. */
function deliver(w: World, u: UnitState): void {
  if (u.carrying <= 0) return;
  const side = w.state.sides[u.side];
  const amount = u.carrying * w.mods[u.side].income;
  side.supplies += amount;
  side.stats.suppliesGathered += amount;
  u.carrying = 0;
  const e = w.events.emit('supplyDelivered');
  e.side = u.side;
  e.unit = u.index;
  e.unitId = u.id;
  e.kind = u.kind;
  e.x = u.x;
  e.row = u.row;
  e.value = amount;
}

/** Sappers shuttle between the HQ door and the dump whatever the order, except Fall Back. */
function moveSapper(w: World, u: UnitState, dir: number): void {
  const s = w.state;
  const side = s.sides[u.side];
  const hq = side.hq;
  const dump = s.dumps[u.side];
  if (!hq || !dump) {
    u.velX = 0;
    return;
  }
  const speed = u.def.speed * w.mods[u.side].sapperSpeed;
  if (side.order === 'fallBack') {
    if (walk(w, u, hq.doorX, speed * CONFIG.fallBackSpeedMul, dir)) {
      deliver(w, u);
      enterHq(w, u);
    }
    return;
  }
  switch (u.task) {
    case TASK_TO_DUMP:
      if (walk(w, u, dump.x + (u.jitter - 0.5) * CONFIG.dumpSpread, speed, dir)) {
        u.task = TASK_LOADING;
        u.taskTime = CONFIG.sapperLoadTime;
      }
      break;
    case TASK_LOADING:
      u.velX = 0;
      u.facing = dir;
      u.taskTime -= w.dt;
      if (u.taskTime <= 0) {
        u.carrying = CONFIG.sapperCarry * w.mods[u.side].sapperCarry;
        u.task = TASK_TO_HQ;
      }
      break;
    case TASK_TO_HQ:
      if (walk(w, u, hq.doorX, speed, dir)) {
        deliver(w, u);
        u.task = TASK_TO_DUMP;
      }
      break;
    default:
      u.task = TASK_TO_DUMP;
      break;
  }
}

/** Pass 2: movement. */
export function moveUnits(w: World): void {
  const s = w.state;
  const units = s.units;
  if (w.doorTimer[0] > 0) w.doorTimer[0] -= w.dt;
  if (w.doorTimer[1] > 0) w.doorTimer[1] -= w.dt;

  for (let i = 0; i < s.unitCount; i++) {
    const u = units[i];
    if (!u.alive) continue;
    u.prevX = u.x;
    const side = s.sides[u.side];
    const dir = u.side === 0 ? 1 : -1;

    if (u.inside) {
      u.velX = 0;
      // Garrisoned units walk out one at a time once the order is no longer Fall Back.
      const hq = side.hq;
      if (hq && side.order !== 'fallBack' && w.doorTimer[u.side] <= 0) {
        w.doorTimer[u.side] = CONFIG.doorInterval;
        u.inside = false;
        hq.garrison--;
        u.x = hq.doorX;
        u.prevX = hq.doorX;
        u.task = TASK_TO_DUMP;
        u.facing = dir;
      }
      continue;
    }

    if (u.kindIndex === KIND_SAPPER) {
      moveSapper(w, u, dir);
      continue;
    }

    if (u.engaged) {
      u.velX = 0;
      continue;
    }

    // Phase 2: wire slows enemy infantry inside it (config.wireSlow) and tanks crush it. NOT YET IMPLEMENTED.
    const retreating = u.behaviour === 'army' && side.order === 'fallBack';
    const speed = retreating ? u.def.speed * CONFIG.fallBackSpeedMul : u.def.speed;
    const arrived = walk(w, u, u.goalX, speed, dir);
    if (arrived && retreating && side.hq && side.hq.alive) enterHq(w, u);
  }
}

function setAction(u: UnitState, action: UnitAction, dt: number): void {
  if (u.action === action) {
    u.actionTime += dt;
  } else {
    u.action = action;
    u.actionTime = 0;
  }
}

/** Pass 3: weapons, then the fields the view animates from (action, facing, aimX, weaponCharge). */
export function fireUnits(w: World): void {
  const s = w.state;
  const units = s.units;
  const dt = w.dt;
  for (let i = 0; i < s.unitCount; i++) {
    const u = units[i];
    if (!u.alive) continue;
    if (u.inside) {
      setAction(u, 'inside', dt);
      u.aimX = u.x;
      continue;
    }
    const dir = u.side === 0 ? 1 : -1;
    const moving = u.velX !== 0;

    if (u.kindIndex === KIND_SAPPER) {
      setAction(u, moving ? 'move' : u.task === TASK_LOADING ? 'load' : 'idle', dt);
      u.aimX = u.x;
      continue;
    }

    const m = u.mount;
    if (m.weaponIndex < 0) {
      // Phase 2: medics heal the most wounded friendly infantry in range here ('heal'). NOT YET IMPLEMENTED.
      setAction(u, moving ? 'move' : 'idle', dt);
      if (!moving) u.facing = dir;
      u.aimX = u.x;
      continue;
    }

    const weapon = WEAPON_LIST[m.weaponIndex];
    const hasTarget = m.targetType !== TARGET_NONE;
    const fleeing = u.behaviour === 'army' && s.sides[u.side].order === 'fallBack';
    const active = hasTarget && (u.engaged || (weapon.moveAndFire && !fleeing));
    const mods = w.mods[u.side];
    updateMount(
      w,
      m,
      active,
      u.side,
      u.x,
      u.row,
      u,
      'unit',
      u.controlled ? mods.unitDamage[u.kindIndex] * CONFIG.controlDamageMul : mods.unitDamage[u.kindIndex],
      u.controlled ? CONFIG.controlReloadMul : 1,
    );
    // Phase 2: the secondary weapon (u.mount2: grenades, coaxial MG) is sensed and fired here. NOT YET IMPLEMENTED.

    u.aimX = hasTarget ? m.aimX : u.x;
    u.weaponCharge = weapon.cooldown > 0 ? 1 - m.cooldown / weapon.cooldown : 1;
    if (!moving) u.facing = active && m.aimX !== u.x ? (m.aimX > u.x ? 1 : -1) : dir;

    if (m.burstLeft > 0 || m.sinceShot < CONFIG.firePoseTime) setAction(u, 'fire', dt);
    else if (moving) setAction(u, 'move', dt);
    else if (active && m.cooldown > 0) setAction(u, 'reload', dt);
    else if (active) setAction(u, 'aim', dt);
    else setAction(u, 'idle', dt);
  }
}
