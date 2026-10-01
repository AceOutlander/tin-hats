/**
 * Shells, rockets, grenades and bombs in flight; explosions with linear splash falloff; barbed
 * wire damage and crushing; smoke clouds.
 *
 * Splash hits enemy units (not those inside an HQ), enemy pillboxes and the enemy HQ through the
 * damage matrix, and wire of either side when the damage type is explosive. Distance is measured
 * from the edge of each target's footprint, so a round that lands on a tank's hull does full damage.
 * Damage goes through the deferred damage queue like every other hit.
 */
import { CONFIG } from '../data/config';
import type { Side } from '../data/schema';
import {
  CLASS_FORT,
  CLASS_HQ,
  DAMAGE_TYPES,
  WEAPON_DTYPE,
  WEAPON_LIST,
  damageFactor,
  unitClass,
} from './tables';
import { TARGET_HQ, TARGET_PILLBOX, TARGET_UNIT, type EntityKind, type UnitState, type WireState } from './types';
import type { World } from './world';

/** Index of 'explosive' in DAMAGE_TYPES: only explosive splash hurts wire. */
const EXPLOSIVE = DAMAGE_TYPES.indexOf('explosive');

/**
 * Inputs of launch() that are doubles (passed in a typed array so nothing is boxed, see the
 * allocation note in combat.ts): [0] launch x, [1] landing x, [2] damage multiplier,
 * [3] flight time in seconds, or 0 to derive it from the distance and weapon.projectileSpeed.
 * Set all four before every call.
 */
export const LAUNCH = new Float64Array(4);

/**
 * Put a projectile of weapon `wi` in flight from LAUNCH[0] to LAUNCH[1] and emit its `projectile`
 * event. `row` is the launch depth row, `targetRow` the row it lands on (-1 = ground); `shooter`
 * and `source` say who fired it ('none' for a call-in). Returns its pool index, or -1 when the pool
 * is full and the round is lost.
 */
export function launch(
  w: World,
  side: number,
  wi: number,
  row: number,
  targetRow: number,
  shooter: UnitState | null,
  source: EntityKind,
): number {
  const pool = w.state.projectiles;
  let index = -1;
  for (let i = 0; i < pool.length; i++) {
    if (!pool[i].alive) {
      index = i;
      break;
    }
  }
  if (index < 0) return -1;
  const weapon = WEAPON_LIST[wi];
  const fromX = LAUNCH[0];
  const toX = LAUNCH[1];
  const dist = toX > fromX ? toX - fromX : fromX - toX;
  let flight = LAUNCH[3];
  if (!(flight > 0)) flight = weapon.projectileSpeed > 0 ? dist / weapon.projectileSpeed : 0;
  if (flight < w.dt) flight = w.dt;

  const p = pool[index];
  p.alive = true;
  p.id = w.nextProjectileId++;
  p.side = side as Side;
  p.weapon = weapon;
  p.weaponIndex = wi;
  p.damageMul = LAUNCH[2];
  p.fromX = fromX;
  p.toX = toX;
  p.x = fromX;
  p.prevX = fromX;
  p.age = 0;
  p.flightTime = flight;
  p.row = row;
  p.targetRow = targetRow;

  const e = w.events.emit('projectile');
  e.side = side;
  e.source = source;
  if (shooter) {
    e.unit = shooter.index;
    e.unitId = shooter.id;
    e.kind = shooter.kind;
  }
  e.weapon = weapon.id;
  e.x = fromX;
  e.row = row;
  e.x2 = toX;
  e.row2 = targetRow;
  e.value = flight;
  e.targetIndex = index;
  e.dir = toX >= fromX ? 1 : -1;
  return index;
}

/** Remove a belt of wire. `explosive` = blown apart by splash rather than crushed. */
function destroyWire(w: World, wire: WireState, explosive: boolean): void {
  wire.hp = 0;
  wire.alive = false;
  const e = w.events.emit('wireDestroyed');
  e.targetIndex = wire.id;
  e.side = wire.owner;
  e.x = wire.x;
  e.cause = explosive ? 'explosive' : null;
}

/** A projectile lands: the explosion event and splash damage around its landing point. */
function explode(w: World, pi: number): void {
  const s = w.state;
  const p = s.projectiles[pi];
  const wi = p.weaponIndex;
  const weapon = WEAPON_LIST[wi];
  const dtype = WEAPON_DTYPE[wi];
  const x = p.toX;
  const r = weapon.splashRadius;
  const side = p.side;
  const enemy = 1 - side;

  const e = w.events.emit('explosion');
  e.side = side;
  e.x = x;
  e.row = p.targetRow;
  e.value = r;
  e.weapon = weapon.id;
  e.cause = weapon.damageType;

  const units = s.units;
  for (let i = 0; i < s.unitCount; i++) {
    const t = units[i];
    if (!t.alive || t.side !== enemy || t.inside) continue;
    const d = (t.x > x ? t.x - x : x - t.x) - t.def.width / 2;
    if (d > r) continue;
    const falloff = d <= 0 ? 1 : 1 - d / r;
    const amount = weapon.damage * p.damageMul * falloff * damageFactor(dtype, unitClass(t));
    w.damage.push(TARGET_UNIT, i, t.id, amount, side, dtype, t.x >= x ? 1 : -1);
  }

  const pillboxes = s.pillboxes;
  for (let i = 0; i < pillboxes.length; i++) {
    const b = pillboxes[i];
    if (!b.alive || b.side !== enemy) continue;
    const d = (b.x > x ? b.x - x : x - b.x) - CONFIG.pillboxWidth / 2;
    if (d > r) continue;
    const falloff = d <= 0 ? 1 : 1 - d / r;
    const amount = weapon.damage * p.damageMul * falloff * damageFactor(dtype, CLASS_FORT);
    w.damage.push(TARGET_PILLBOX, i, -1, amount, side, dtype, b.x >= x ? 1 : -1);
  }

  const hq = s.sides[enemy].hq;
  if (hq && hq.alive) {
    const d = (hq.x > x ? hq.x - x : x - hq.x) - CONFIG.hqWidth / 2;
    if (d <= r) {
      const falloff = d <= 0 ? 1 : 1 - d / r;
      const amount = weapon.damage * p.damageMul * falloff * damageFactor(dtype, CLASS_HQ);
      w.damage.push(TARGET_HQ, enemy, -1, amount, side, dtype, hq.x >= x ? 1 : -1);
    }
  }

  if (dtype === EXPLOSIVE) {
    const wires = s.wires;
    for (let i = 0; i < wires.length; i++) {
      const wire = wires[i];
      if (!wire.alive) continue;
      const d = (wire.x > x ? wire.x - x : x - wire.x) - wire.width / 2;
      if (d > r) continue;
      const falloff = d <= 0 ? 1 : 1 - d / r;
      wire.hp -= weapon.damage * p.damageMul * falloff;
      if (wire.hp <= 0) destroyWire(w, wire, true);
    }
  }
}

/** Move every projectile in flight; those that arrive explode. Runs before anyone fires this tick. */
export function updateProjectiles(w: World): void {
  const pool = w.state.projectiles;
  const dt = w.dt;
  for (let i = 0; i < pool.length; i++) {
    const p = pool[i];
    if (!p.alive) continue;
    p.prevX = p.x;
    p.age += dt;
    if (p.age >= p.flightTime - 1e-9) {
      p.x = p.toX;
      p.alive = false;
      explode(w, i);
    } else {
      p.x = p.fromX + (p.toX - p.fromX) * (p.age / p.flightTime);
    }
  }
}

/** True if the unit stands inside a living belt of the other side's wire. */
export function inEnemyWire(w: World, u: UnitState): boolean {
  const wires = w.state.wires;
  for (let i = 0; i < wires.length; i++) {
    const wire = wires[i];
    if (!wire.alive || wire.owner === u.side) continue;
    const d = u.x > wire.x ? u.x - wire.x : wire.x - u.x;
    if (d <= wire.width / 2) return true;
  }
  return false;
}

/** A tank that has just moved flattens any enemy wire under its hull. */
export function crushWire(w: World, u: UnitState): void {
  const wires = w.state.wires;
  for (let i = 0; i < wires.length; i++) {
    const wire = wires[i];
    if (!wire.alive || wire.owner === u.side) continue;
    const d = u.x > wire.x ? u.x - wire.x : wire.x - u.x;
    if (d <= (wire.width + u.def.width) / 2) destroyWire(w, wire, false);
  }
}

/**
 * Put a smoke cloud at x that blocks direct fire for `duration` seconds and emit smokeSpawned.
 * `side` is who made it (-1 for nobody). When the pool is full the cloud with the least time
 * left is replaced. Keeps World.smokeCount in step.
 */
export function spawnSmoke(w: World, x: number, radius: number, duration: number, side: number): void {
  const smokes = w.state.smokes;
  if (smokes.length === 0) return;
  let index = -1;
  let shortest = Infinity;
  for (let i = 0; i < smokes.length; i++) {
    const smoke = smokes[i];
    if (!smoke.alive) {
      index = i;
      break;
    }
    if (smoke.timeLeft < shortest) {
      shortest = smoke.timeLeft;
      index = i;
    }
  }
  const smoke = smokes[index];
  if (!smoke.alive) w.smokeCount++;
  smoke.alive = true;
  smoke.x = x;
  smoke.radius = radius;
  smoke.timeLeft = duration;
  smoke.duration = duration;
  const e = w.events.emit('smokeSpawned');
  e.side = side;
  e.x = x;
  e.value = radius;
  e.x2 = duration;
}

/** Age the smoke clouds and clear those that have blown away. */
export function updateSmokes(w: World): void {
  if (w.smokeCount === 0) return;
  const smokes = w.state.smokes;
  for (let i = 0; i < smokes.length; i++) {
    const smoke = smokes[i];
    if (!smoke.alive) continue;
    smoke.timeLeft -= w.dt;
    if (smoke.timeLeft <= 0) {
      smoke.timeLeft = 0;
      smoke.alive = false;
      w.smokeCount--;
    }
  }
}
