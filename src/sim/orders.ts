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
import { inPrep } from './prep';
import { crushWire, inEnemyWire } from './projectiles';
import { DT, KIND_HAS_ARMOUR, KIND_SAPPER, WEAPON_LIST, WEAPON_SETUP } from './tables';
import { senseControlled } from './control';
import { applyAura } from './specials';
import { claimSlot, releaseSlot } from './trenches';
import { TARGET_NONE, type SideState, type UnitState } from './types';
import { TASK_LOADING, TASK_TO_DUMP, TASK_TO_HQ, enterHq, joinArmy } from './units';
import { rallyFor } from './points';
import { clearJob } from './clear';
import { clampVehicle, inEnemyRoadBlock } from './obstacles';
import { riverClamp } from './water';
import { GROUND_INV_CELL, GROUND_MODES, orderFor, type World } from './world';

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
 * When the line is a capture point ahead of every trench the side owns, men leave their rear trenches to hold it.
 */
function senseHold(w: World, u: UnitState, side: SideState, dir: number, hasTarget: boolean, patient: boolean): void {
  const ht = w.holdTrench[u.side];
  if (u.def.usesTrench && ht >= 0 && u.trench !== ht && w.trenchTaken[ht] < w.state.trenches[ht].slots) {
    releaseSlot(w, u);
    claimSlot(w, u, ht);
  }
  if (u.slot >= 0 && w.holdPoint[u.side] >= 0) releaseSlot(w, u);
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
  // With no line to follow (nothing but support troops left), they advance like everyone else.
  if (u.def.followsLine && w.leadCount[u.side] > 0) {
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
 * reach, they roll toward the enemy for config.guardAlertTime, never further than their leash (ForceDef.leash, config.guardLeash by default) from the post.
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
  const lo = u.postX - u.leash;
  const hi = u.postX + u.leash;
  u.goalX = goal < lo ? lo : goal > hi ? hi : goal;
}

/**
 * Garrisons hold their trench whatever the order: a trench-capable man keeps (or takes back) a slot
 * in it and fights from there; anyone else, or a man who finds it full, stands at his post behind it.
 * They never chase. Once the trench has fallen the survivors join the army (see senseUnits).
 */
function senseGarrison(w: World, u: UnitState, hasTarget: boolean, patient: boolean): void {
  if (u.slot < 0 && u.postTrench >= 0 && u.def.usesTrench) claimSlot(w, u, u.postTrench);
  if (u.slot >= 0) {
    u.goalX = w.slotX[u.slot];
    u.engaged = u.trenchId >= 0 && hasTarget;
    return;
  }
  u.engaged = hasTarget || patient;
  u.goalX = u.engaged ? u.x : u.postX;
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
    if (u.behaviour === 'garrison' && u.postTrench >= 0 && s.trenches[u.postTrench].owner === 1 - u.side) {
      joinArmy(w, u);
    }
    const order = u.behaviour === 'army' ? orderFor(side, u.kind) : u.behaviour === 'assault' ? 'advance' : 'hold';
    if (order !== 'fallBack') u.rally = -1;
    const retarget = (s.tick + i) % retargetTicks === 0;
    const m = u.mount;

    let hasTarget = false;
    if (m.weaponIndex >= 0) {
      m.x = u.x;
      hasTarget = senseMount(w, m, u.side, retarget);
      // With nothing left in range it decides afresh whether to move on; a unit already standing
      // to fight swings to its next target from where it stands.
      if (!hasTarget) u.engaged = false;
    }
    const m2 = u.mount2;
    if (m2.weaponIndex >= 0) {
      m2.x = u.x;
      senseMount(w, m2, u.side, retarget);
    }
    const patient = u.def.healRate > 0 && findPatient(w, u);

    if (u.controlled) {
      // Direct control: the stick, not the order, says where it goes.
      senseControlled(w, u);
    } else if (order === 'fallBack') {
      releaseSlot(w, u);
      u.engaged = false;
      // The nearest rally point behind him (FOUNDATIONS.md 4.5), kept while his side holds it; else the HQ.
      if (u.rally >= 0 && s.points[u.rally].owner !== u.side) u.rally = -1;
      if (u.rally < 0 && s.points.length > 0) u.rally = rallyFor(w, u);
      if (u.rally >= 0) {
        const p = s.points[u.rally];
        let x = p.x + (dir * p.width) / 2 - dir * u.slotDepth;
        if (side.hq && (x - side.hq.doorX) * dir < 0) x = side.hq.doorX;
        u.goalX = x;
        // Formed up at the rally point, out of the line: he defends himself but does not chase.
        const gap = u.x > x ? u.x - x : x - u.x;
        u.engaged = hasTarget && gap <= CONFIG.moveDeadband;
      } else if (side.hq && side.hq.alive) u.goalX = side.hq.doorX;
      else goToFormation(w, u, side, dir);
    } else if (u.behaviour === 'guard') {
      senseGuard(w, u, hasTarget);
    } else if (u.behaviour === 'garrison') {
      senseGarrison(w, u, hasTarget, patient);
    } else if (order === 'hold') {
      senseHold(w, u, side, dir, hasTarget, patient);
    } else {
      senseAdvance(w, u, dir, hasTarget, patient);
    }
  }
}

/**
 * Walk a unit toward u.goalX at u.moveSpeed, times the ground's speed where it stands (MissionDef.sectors; none =
 * even ground; never for sappers). Forward movement stops at the front clamp (never past the nearest enemy blocker minus contactGap);
 * the unit is never pushed back. Returns true when it stands on the goal.
 */
function walk(w: World, u: UnitState, dir: number): boolean {
  const s = w.state;
  const goalX = u.goalX;
  const dx = goalX - u.x;
  let step = u.moveSpeed * w.dt;
  const g = w.ground;
  // Sappers walk their supply road between the HQ and the dump: the ground does not slow them (DECISIONS 360).
  if (g !== null && u.kindIndex !== KIND_SAPPER) {
    let c = (u.x * GROUND_INV_CELL) | 0;
    if (c < 0) c = 0;
    else if (c >= g.count) c = g.count - 1;
    const mode = u.def.class === 'vehicle' ? 2 : u.skis ? 4 : 0;
    step *= g.speed[c * GROUND_MODES + mode + (dx < 0 ? 1 : 0)];
  }
  // The blizzard slows men on foot (src/sim/sky.ts; 1 in any other weather). Sappers on the supply road are spared.
  const wading = s.sky.infantrySpeed;
  if (wading !== 1 && u.def.class !== 'vehicle' && u.kindIndex !== KIND_SAPPER) step *= wading;
  let nx = dx > step ? u.x + step : dx < -step ? u.x - step : goalX;
  if ((nx - u.x) * dir > 0) {
    const limit = w.limit[u.side];
    if ((nx - limit) * dir > 0) nx = (u.x - limit) * dir > 0 ? u.x : limit;
  }
  // Vehicles stop at the other side's tank traps and road blocks and at the river bank (FOUNDATIONS.md 4.4 and 4.8).
  if (u.def.class === 'vehicle' && nx !== u.x) {
    if (s.obstacles.length > 0) nx = clampVehicle(w, u, nx);
    if (g !== null && g.blocked > 0) nx = riverClamp(g, u.x, nx);
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

/** Sappers shuttle between the HQ door and the dump whatever the order, except Fall Back (army-wide or their own). */
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
  if (orderFor(side, u.kind) === 'fallBack') {
    u.goalX = hq.doorX;
    u.moveSpeed *= CONFIG.fallBackSpeedMul;
    if (walk(w, u, dir)) {
      deliver(w, u);
      enterHq(w, u);
    }
    return;
  }
  // Prep phase: a sapper given a build site walks there and works (updateBuilds counts his work).
  if (u.site >= 0) {
    const sites = s.sites;
    for (let i = 0; i < sites.length; i++) {
      const site = sites[i];
      if (site.id !== u.site) continue;
      u.goalX = site.x;
      if (walk(w, u, dir)) {
        u.velX = 0;
        u.facing = dir;
      }
      return;
    }
    // A Clear job (src/sim/clear.ts): walk to its spot and work there.
    const job = clearJob(w, u.site);
    if (job !== null) {
      u.goalX = job.x;
      if (walk(w, u, dir)) {
        u.velX = 0;
        u.facing = dir;
      }
      return;
    }
    u.site = -1;
    u.task = TASK_TO_DUMP;
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
  const anyBlock = s.obstacles.length > 0;
  const prep = inPrep(s);
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
      // Waiting for a ferry, or on it (src/sim/water.ts moves them).
      if (u.ferry >= 0) continue;
      if (u.carrier >= 0) {
        // Riding in an APC: wherever it goes.
        const c = units[u.carrier];
        if (c.alive && c.id === u.carrierId) u.x = c.x;
        continue;
      }
      // Garrisoned units walk out one at a time once their order is no longer Fall Back.
      const hq = side.hq;
      if (hq && orderFor(side, u.kind) !== 'fallBack' && w.doorTimer[u.side] <= 0) {
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

    // Prep phase: the enemy stands where it is until the attack starts.
    if (prep && u.side === 1) {
      u.velX = 0;
      continue;
    }

    // Thrown by a heavy shell's blast (src/sim/projectiles.ts knockBack): carried along, doing nothing else.
    if (u.knock !== 0) {
      carryKnock(w, u);
      continue;
    }

    if (u.kindIndex === KIND_SAPPER) {
      moveSapper(w, u, dir);
      continue;
    }

    if (u.controlled) {
      // At the stick's speed (full speed when stepping onto a trench slot by itself), still front-clamped.
      const mx = w.ctrlMove[u.side];
      u.moveSpeed = u.def.speed * (mx > 0 ? mx : mx < 0 ? -mx : 1);
      if (anyWire && u.def.class === 'infantry' && inEnemyWire(w, u)) u.moveSpeed *= CONFIG.wireSlow;
      else if (anyBlock && u.def.class === 'infantry' && inEnemyRoadBlock(w, u)) u.moveSpeed *= CONFIG.wireSlow;
      walk(w, u, dir);
      if (anyWire && u.def.crushesWire && u.velX !== 0) crushWire(w, u);
      continue;
    }

    if (u.engaged) {
      u.velX = 0;
      continue;
    }
    if (u.velX === 0 && u.goalX !== u.x) {
      const gap = u.goalX > u.x ? u.goalX - u.x : u.x - u.goalX;
      if (gap <= CONFIG.moveDeadband && u.slot < 0 && (u.behaviour !== 'army' || orderFor(side, u.kind) !== 'fallBack')) continue;
    }

    const retreating = u.behaviour === 'army' && orderFor(side, u.kind) === 'fallBack';
    u.moveSpeed = retreating ? u.def.speed * CONFIG.fallBackSpeedMul : u.def.speed;
    if (anyWire && u.def.class === 'infantry' && inEnemyWire(w, u)) u.moveSpeed *= CONFIG.wireSlow;
    else if (anyBlock && u.def.class === 'infantry' && inEnemyRoadBlock(w, u)) u.moveSpeed *= CONFIG.wireSlow;
    const arrived = walk(w, u, dir);
    if (anyWire && u.def.crushesWire && u.velX !== 0) crushWire(w, u);
    if (arrived && retreating && u.rally < 0 && side.hq && side.hq.alive) enterHq(w, u);
  }
}

/** One tick of a blast's throw: up to config.knockSpeed x dt of what is left, kept on the map. */
function carryKnock(w: World, u: UnitState): void {
  const max = CONFIG.knockSpeed * w.dt;
  const k = u.knock;
  const step = k > max ? max : k < -max ? -max : k;
  let nx = u.x + step;
  const lo = CONFIG.mapMargin;
  const hi = w.state.length - CONFIG.mapMargin;
  if (nx < lo) nx = lo;
  else if (nx > hi) nx = hi;
  // Never thrown through the other side's line (the two lines never pass through each other): a man blown toward the
  // enemy stops at the front clamp, as a walking man does (or where he is, if already nearer).
  let stopped = false;
  if (u.side === 0) {
    const cap = Math.max(u.x, w.limit[0]);
    if (nx > cap) {
      nx = cap;
      stopped = true;
    }
  } else {
    const cap = Math.min(u.x, w.limit[1]);
    if (nx < cap) {
      nx = cap;
      stopped = true;
    }
  }
  u.x = nx;
  u.velX = 0;
  u.knock = k === step || stopped || nx === lo || nx === hi ? 0 : k - step;
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
    const ctrl = u.controlled;
    const fleeing = !ctrl && u.behaviour === 'army' && orderFor(s.sides[u.side], u.kind) === 'fallBack';
    const m2 = u.mount2;
    // A controlled unit keeps its aim on the target even on the move (crew weapons still set up)
    // and shoots only while the fire button is held.
    const active = ready && m2.windup <= 0 && u.knock === 0 && hasTarget && (ctrl || u.engaged || (weapon.moveAndFire && !fleeing));
    m.x = u.x;
    m.damageMul = w.mods[u.side].unitDamage[u.kindIndex];
    if (w.auraUnit[u.side] >= 0) applyAura(w, u, m);
    m.rateMul = 1;
    m.accuracy = u.accuracy;
    // An anti-aircraft gun with a plane in reach holds its fire at the ground.
    m.trigger = w.aaEngaged[i] === 0;
    if (ctrl) {
      m.damageMul *= CONFIG.controlDamageMul;
      m.rateMul = CONFIG.controlReloadMul;
      m.trigger = w.ctrlFire[u.side] === 1;
    }
    updateMount(w, m, active, u.side, u.row, u, 'unit');

    // The secondary fires on its own: a coaxial MG whenever it has a target (even on the move),
    // a grenade only while the unit stands to fight between bursts of its primary. Under direct
    // control a grenade waits for the ability button and then goes at once.
    let thrower = false;
    if (m2.weaponIndex >= 0) {
      const weapon2 = WEAPON_LIST[m2.weaponIndex];
      thrower = weapon2.thrown;
      const has2 = m2.targetType !== TARGET_NONE;
      let active2 = has2 && (weapon2.moveAndFire ? !fleeing : u.engaged && ready && m.burstLeft === 0);
      m2.trigger = true;
      if (ctrl) {
        const press = w.ctrlAbility[u.side] === 1;
        if (press && has2 && ready && m2.cooldown <= 0 && m2.windup <= 0 && m2.burstLeft === 0) {
          m2.aim = 0;
          active2 = true;
        } else {
          active2 = has2 && weapon2.moveAndFire;
          m2.trigger = weapon2.moveAndFire;
        }
      }
      m2.x = u.x;
      m2.damageMul = m.damageMul;
      m2.rateMul = m.rateMul;
      m2.accuracy = u.accuracy;
      updateMount(w, m2, active2, u.side, u.row, u, 'unit');
    }
    const throwing2 = thrower && (m2.windup > 0 || m2.sinceShot < CONFIG.throwPoseTime - CONFIG.throwReleaseTime);
    // A thrown primary (the Tank Hunters' bundles): the throw pose while it winds up and lets go.
    const throwing1 = weapon.thrown && (m.windup > 0 || m.sinceShot < CONFIG.throwPoseTime - CONFIG.throwReleaseTime);
    const throwing = throwing2 || throwing1;

    u.aimX = throwing2 ? m2.aimX : hasTarget || throwing1 ? m.aimX : u.x;
    u.weaponCharge = weapon.cooldown > 0 ? 1 - m.cooldown / weapon.cooldown : 1;
    if (!moving) {
      if (throwing && u.aimX !== u.x) u.facing = u.aimX > u.x ? 1 : -1;
      // An armoured hull (UnitDef.armour) keeps its front to the enemy while its turret turns.
      else if (active && m.aimX !== u.x && KIND_HAS_ARMOUR[u.kindIndex] === 0) u.facing = m.aimX > u.x ? 1 : -1;
      else if (!ctrl) u.facing = dir; // a controlled unit keeps facing the way it last walked
    }

    if (throwing) setAction(u, 'throw');
    else if (m.burstLeft > 0 || m.sinceShot < CONFIG.firePoseTime) setAction(u, 'fire');
    else if (moving) setAction(u, 'move');
    else if (!ready) setAction(u, 'deploy');
    else if (active && m.cooldown > 0) setAction(u, 'reload');
    else if (active) setAction(u, 'aim');
    else setAction(u, 'idle');
  }
  // An ability press lasts one tick, used or not.
  w.ctrlAbility[0] = 0;
  w.ctrlAbility[1] = 0;
}
