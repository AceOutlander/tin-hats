/**
 * What every unit does each tick, in three passes over the pool:
 *   senseUnits  decide (targets, trench slots, stand or move, where to) from the positions at the start of the tick;
 *   moveUnits   move (sappers, formation, advance, fall back) under the front clamp, slowed by wire;
 *   fireUnits   run the weapons, heal, and set the animation fields.
 * Splitting the passes keeps the tick side-symmetric: no unit ever reacts to
 * a move another unit made earlier in the same tick.
 */
import { CONFIG } from '../data/config';
import type { UnitAction } from '../data/schema';
import { senseMount, updateMount } from './combat';
import { crushWire, inEnemyWire } from './projectiles';
import { DT, KIND_SAPPER, WEAPON_LIST, WEAPON_SETUP } from './tables';
import { claimSlot, releaseSlot } from './trenches';
import { TARGET_NONE, type SideState, type UnitState } from './types';
import { TASK_LOADING, TASK_TO_DUMP, TASK_TO_HQ, enterHq } from './units';
import type { World } from './world';

/*
 * Numbers travel between the passes in unit fields (goalX, moveSpeed, mount.x...) and not as
 * arguments or return values, so the tick allocates nothing (see the allocation note in combat.ts).
 */

/** Aim a unit at its place in the hold formation: its cell depth behind the formation base, but never behind the HQ door. */
function goToFormation(w: World, u: UnitState, side: SideState, dir: number): void {
  let x = w.formBase[u.side] - dir * u.slotDepth;
  const hq = side.hq;
  if (hq && (x - hq.doorX) * dir < 0) x = hq.doorX;
  u.goalX = x;
}

/**
 * Medics: pick the most wounded friendly infantryman (lowest health fraction) standing within
 * healRange, leaving it in u.healIndex / u.healId. Returns true if there is one.
 */
function findPatient(w: World, u: UnitState): boolean {
  const s = w.state;
  const units = s.units;
  const range = u.def.healRange;
  let best = -1;
  let worst = 1;
  for (let i = 0; i < s.unitCount; i++) {
    const p = units[i];
    if (!p.alive || p.side !== u.side || p.inside || p === u || p.def.class !== 'infantry') continue;
    // Only a man who has stopped can be treated: chasing one on the move would stutter.
    if (p.hp >= p.maxHp || p.velX !== 0) continue;
    const d = p.x > u.x ? p.x - u.x : u.x - p.x;
    if (d > range) continue;
    const frac = p.hp / p.maxHp;
    if (frac < worst) {
      worst = frac;
      best = i;
    }
  }
  u.healIndex = best;
  u.healId = best >= 0 ? units[best].id : -1;
  return best >= 0;
}

/**
 * Hold. Trench-capable infantry take a slot in the hold-line trench (one already sitting in a
 * rear trench moves up only when a slot is free) and fire from it at anything in range. Everyone
 * else, and the overflow, forms up behind the line: they fire at what is in range but never chase.
 */
function senseHold(w: World, u: UnitState, side: SideState, dir: number, hasTarget: boolean, patient: boolean): void {
  const ht = w.holdTrench[u.side];
  if (u.def.usesTrench && ht >= 0 && u.trench !== ht && w.trenchTaken[ht] < w.state.trenches[ht].slots) {
    releaseSlot(w, u);
    claimSlot(w, u, ht);
  }
  if (u.slot >= 0) {
    u.goalX = w.slotX[u.slot];
    u.engaged = u.trenchId >= 0 && hasTarget;
    return;
  }
  if ((u.x - w.lineFront[u.side]) * dir > CONFIG.holdLineTolerance) {
    // Out in front of the line: walk back without fighting.
    u.engaged = false;
    goToFormation(w, u, side, dir);
  } else if (hasTarget || patient) {
    u.engaged = true;
    u.goalX = u.x;
  } else {
    u.engaged = false;
    const forward = w.formBase[u.side] - dir * u.def.formationDepth;
    const weapon = u.mount.weapon;
    if (weapon && u.slotDepth > u.def.formationDepth && (w.front[1 - u.side] - forward) * dir <= weapon.range) {
      // The enemy is within reach of the line: rear ranks close up until they can fire.
      u.goalX = forward;
    } else {
      goToFormation(w, u, side, dir);
    }
  }
}

/**
 * Advance. Units leave their trenches and push on until something they can engage is within
 * range * engageFrac; with nothing in range they walk on (the front clamp stops them short of the
 * next enemy position). Support troops (followsLine) stay formationDepth behind the leading line
 * unit and fight from wherever that leaves them.
 */
function senseAdvance(w: World, u: UnitState, dir: number, hasTarget: boolean, patient: boolean): void {
  releaseSlot(w, u);
  let goal = dir > 0 ? w.state.length : 0;
  if (u.def.followsLine) {
    const back = w.armedFront[u.side] - dir * (u.def.formationDepth + u.jitter * CONFIG.engageSpread);
    if ((goal - back) * dir > 0) goal = back;
  }
  u.goalX = goal;
  const weapon = u.mount.weapon;
  if (!weapon) {
    u.engaged = patient;
  } else if (hasTarget) {
    if (!u.engaged) {
      const m = u.mount;
      const d = m.aimX > u.x ? m.aimX - u.x : u.x - m.aimX;
      let engageAt = weapon.range * u.def.engageFrac - u.jitter * CONFIG.engageSpread;
      if (engageAt < weapon.minRange) engageAt = weapon.minRange;
      u.engaged = d <= engageAt || (goal - u.x) * dir <= 0;
    }
  } else {
    u.engaged = false;
  }
}

/**
 * Guards (the boss tank) ignore orders and fight from their post. Hit by something they cannot
 * reach, they roll toward the enemy for config.guardAlertTime, never further than guardLeash from the post.
 */
function senseGuard(w: World, u: UnitState, hasTarget: boolean): void {
  releaseSlot(w, u);
  u.engaged = hasTarget;
  if (hasTarget) {
    u.goalX = u.x;
    return;
  }
  let goal = u.postX;
  if (w.state.time - u.hitTime < CONFIG.guardAlertTime) goal = w.front[1 - u.side];
  const lo = u.postX - CONFIG.guardLeash;
  const hi = u.postX + CONFIG.guardLeash;
  u.goalX = goal < lo ? lo : goal > hi ? hi : goal;
}

/** Pass 1: targets, and for each unit whether it stands to fight (`engaged`) and where it is heading (`goalX`). */
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
    const retarget = (s.tick + i) % retargetTicks === 0;
    const m = u.mount;

    let hasTarget = false;
    if (m.weaponIndex >= 0) {
      const prevType = m.targetType;
      const prevIndex = m.targetIndex;
      const prevId = m.targetId;
      m.x = u.x;
      hasTarget = senseMount(w, m, u.side, retarget);
      // A new target means deciding afresh whether to close in or stand.
      if (!hasTarget || m.targetType !== prevType || m.targetIndex !== prevIndex || m.targetId !== prevId) {
        u.engaged = false;
      }
    }
    const m2 = u.mount2;
    if (m2.weaponIndex >= 0) {
      m2.x = u.x;
      senseMount(w, m2, u.side, retarget);
    }
    const patient = u.def.healRate > 0 && findPatient(w, u);
    // Phase 2 part 2: a directly controlled unit takes its movement and fire from controlInput here.

    if (order === 'fallBack') {
      releaseSlot(w, u);
      u.engaged = false;
      if (side.hq && side.hq.alive) u.goalX = side.hq.doorX;
      else goToFormation(w, u, side, dir);
    } else if (u.behaviour === 'guard') {
      senseGuard(w, u, hasTarget);
    } else if (order === 'hold') {
      senseHold(w, u, side, dir, hasTarget, patient);
    } else {
      senseAdvance(w, u, dir, hasTarget, patient);
    }
  }
}

/**
 * Walk a unit toward u.goalX at u.moveSpeed. Forward movement stops at the front
 * clamp (never past the nearest enemy blocker minus contactGap); the unit is
 * never pushed back. Returns true when it stands on the goal.
 */
function walk(w: World, u: UnitState, dir: number): boolean {
  const s = w.state;
  const goalX = u.goalX;
  const step = u.moveSpeed * w.dt;
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
  u.moveSpeed = u.def.speed * w.mods[u.side].sapperSpeed;
  if (side.order === 'fallBack') {
    u.goalX = hq.doorX;
    u.moveSpeed *= CONFIG.fallBackSpeedMul;
    if (walk(w, u, dir)) {
      deliver(w, u);
      enterHq(w, u);
    }
    return;
  }
  switch (u.task) {
    case TASK_TO_DUMP:
      // Sappers spread over the width of the dump, mirrored for side 1 so both sides walk the same distances.
      u.goalX = dump.x + dir * (u.jitter - 0.5) * CONFIG.dumpSpread;
      if (walk(w, u, dir)) {
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
      u.goalX = hq.doorX;
      if (walk(w, u, dir)) {
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
  const anyWire = s.wires.length > 0;
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
    if (u.velX === 0 && u.goalX !== u.x) {
      const gap = u.goalX > u.x ? u.goalX - u.x : u.x - u.goalX;
      if (gap <= CONFIG.moveDeadband && u.slot < 0 && (side.order !== 'fallBack' || u.behaviour !== 'army')) continue;
    }

    const retreating = u.behaviour === 'army' && side.order === 'fallBack';
    u.moveSpeed = retreating ? u.def.speed * CONFIG.fallBackSpeedMul : u.def.speed;
    if (anyWire && u.def.class === 'infantry' && inEnemyWire(w, u)) u.moveSpeed *= CONFIG.wireSlow;
    const arrived = walk(w, u, dir);
    if (anyWire && u.def.crushesWire && u.velX !== 0) crushWire(w, u);
    if (arrived && retreating && side.hq && side.hq.alive) enterHq(w, u);
  }
}

function setAction(u: UnitState, action: UnitAction): void {
  if (u.action === action) {
    u.actionTime += DT;
  } else {
    u.action = action;
    u.actionTime = 0;
  }
}

/** A medic standing next to its patient heals it. Returns true if it did. */
function heal(w: World, u: UnitState): boolean {
  if (u.healIndex < 0) return false;
  const p = w.state.units[u.healIndex];
  if (!p.alive || p.id !== u.healId || p.inside || p.hp >= p.maxHp) return false;
  const d = p.x > u.x ? p.x - u.x : u.x - p.x;
  if (d > u.def.healRange) return false;
  p.hp += u.def.healRate * w.mods[u.side].unitHeal[u.kindIndex] * DT;
  if (p.hp > p.maxHp) p.hp = p.maxHp;
  u.aimX = p.x;
  if (p.x !== u.x) u.facing = p.x > u.x ? 1 : -1;
  return true;
}

/** Pass 3: weapons and healing, then the fields the view animates from (action, facing, aimX, weaponCharge). */
export function fireUnits(w: World): void {
  const s = w.state;
  const units = s.units;
  for (let i = 0; i < s.unitCount; i++) {
    const u = units[i];
    if (!u.alive) continue;
    if (u.inside) {
      setAction(u, 'inside');
      u.aimX = u.x;
      continue;
    }
    const dir = u.side === 0 ? 1 : -1;
    const moving = u.velX !== 0;

    if (u.kindIndex === KIND_SAPPER) {
      setAction(u, moving ? 'move' : u.task === TASK_LOADING ? 'load' : 'idle');
      u.aimX = u.x;
      continue;
    }

    const m = u.mount;
    if (m.weaponIndex < 0) {
      // Unarmed: medics heal the most wounded man within reach while standing.
      if (!moving && heal(w, u)) {
        setAction(u, 'heal');
        continue;
      }
      setAction(u, moving ? 'move' : 'idle');
      if (!moving) u.facing = dir;
      u.aimX = u.x;
      continue;
    }

    const wi = m.weaponIndex;
    const weapon = WEAPON_LIST[wi];
    // Crew weapons set up again after every move ('deploy') before they can aim.
    if (moving) u.setup = WEAPON_SETUP[wi];
    else if (u.setup > 0) {
      u.setup -= DT;
      if (u.setup < 0) u.setup = 0;
    }
    const ready = u.setup <= 0;
    const hasTarget = m.targetType !== TARGET_NONE;
    const fleeing = u.behaviour === 'army' && s.sides[u.side].order === 'fallBack';
    const m2 = u.mount2;
    const active = ready && m2.windup <= 0 && hasTarget && (u.engaged || (weapon.moveAndFire && !fleeing));
    m.x = u.x;
    m.damageMul = w.mods[u.side].unitDamage[u.kindIndex];
    m.rateMul = 1;
    if (u.controlled) {
      m.damageMul *= CONFIG.controlDamageMul;
      m.rateMul = CONFIG.controlReloadMul;
    }
    updateMount(w, m, active, u.side, u.row, u, 'unit');

    // The secondary fires on its own: a coaxial MG whenever it has a target (even on the move),
    // a grenade only while the unit stands to fight between bursts of its primary.
    let thrower = false;
    if (m2.weaponIndex >= 0) {
      const weapon2 = WEAPON_LIST[m2.weaponIndex];
      thrower = weapon2.thrown;
      const has2 = m2.targetType !== TARGET_NONE;
      const active2 = has2 && (weapon2.moveAndFire ? !fleeing : u.engaged && ready && m.burstLeft === 0);
      m2.x = u.x;
      m2.damageMul = m.damageMul;
      m2.rateMul = m.rateMul;
      updateMount(w, m2, active2, u.side, u.row, u, 'unit');
    }
    const throwing =
      thrower && (m2.windup > 0 || m2.sinceShot < CONFIG.throwPoseTime - CONFIG.throwReleaseTime);

    u.aimX = throwing ? m2.aimX : hasTarget ? m.aimX : u.x;
    u.weaponCharge = weapon.cooldown > 0 ? 1 - m.cooldown / weapon.cooldown : 1;
    if (!moving) {
      if (throwing && u.aimX !== u.x) u.facing = u.aimX > u.x ? 1 : -1;
      else u.facing = active && m.aimX !== u.x ? (m.aimX > u.x ? 1 : -1) : dir;
    }

    if (throwing) setAction(u, 'throw');
    else if (m.burstLeft > 0 || m.sinceShot < CONFIG.firePoseTime) setAction(u, 'fire');
    else if (moving) setAction(u, 'move');
    else if (!ready) setAction(u, 'deploy');
    else if (active && m.cooldown > 0) setAction(u, 'reload');
    else if (active) setAction(u, 'aim');
    else setAction(u, 'idle');
  }
}
