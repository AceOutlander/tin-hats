/**
 * Shells, rockets, grenades and bombs in flight; explosions with linear splash falloff; barbed
 * wire damage and crushing; smoke clouds.
 *
 * Splash hits enemy units (not those inside an HQ), enemy pillboxes and the enemy HQ through the
 * damage matrix, and wire of either side when the damage type is explosive. Distance is measured
 * from the edge of each target's footprint, so a round that lands on a tank's hull does full damage.
 * Damage goes through the deferred damage queue like every other hit.
 */
import { CONFIG, SPECIALS } from '../data/config';
import { FIRE_DAMAGE } from '../data/damage';
import type { Side } from '../data/schema';
import { splashWalls } from './buildings';
import { splashMines } from './mines';
import { splashObstacles } from './obstacles';
import { hitFerries, splashBridges } from './water';
import {
  CLASS_BUILDING,
  CLASS_FORT,
  CLASS_HQ,
  CLASS_VEHICLE,
  DAMAGE_TYPES,
  WEAPON_DTYPE,
  WEAPON_FLUSH,
  WEAPON_LIST,
  damageFactor,
  unitClass,
} from './tables';
import { TARGET_HQ, TARGET_PILLBOX, TARGET_UNIT, type EntityKind, type UnitState, type WireState } from './types';
import { DMG_FLEW_NEG, DMG_FLEW_POS, DMG_FLUSH, DMG_TOP, type World } from './world';

/** Index of 'explosive' in DAMAGE_TYPES: only explosive splash hurts wire. */
const EXPLOSIVE = DAMAGE_TYPES.indexOf('explosive');
/** Fire on men at a building's windows, in place of the matrix value (FIRE_DAMAGE in src/data/damage.ts). */
const FIRE_BUILDING = FIRE_DAMAGE.infantryBuilding ?? 1;

/**
 * Inputs of launch() that are doubles (passed in a typed array so nothing is boxed, see the
 * allocation note in combat.ts): [0] launch x, [1] landing x, [2] damage multiplier,
 * [3] flight time in seconds, or 0 to derive it from the distance and weapon.projectileSpeed,
 * [4] extra multiplier on damage to an HQ and [5] to vehicles (1 for weapons; support call-ins use
 * their hqDamageMul and vehicleDamageMul), [6] 1 for a round dropped from an aircraft (hits from above,
 * so hit-facing armour does not apply), else 0. Set all seven before every call. [7] 1 for a round fired from off the
 * map (artillery, Katyusha, scripted barrages: the projectile event has hit = true, the view draws it falling from
 * above the screen top with its incoming whistle); launch() sets it back to 0, so only off-map callers set it.
 */
export const LAUNCH = new Float64Array(8);

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
  if (index < 0) {
    LAUNCH[7] = 0;
    return -1;
  }
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
  p.hqMul = LAUNCH[4];
  p.vehicleMul = LAUNCH[5];
  p.top = LAUNCH[6] !== 0;
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
  e.hit = LAUNCH[7] !== 0;
  LAUNCH[7] = 0;
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
  const flush = WEAPON_FLUSH[wi] === 1;
  // A direct-fire round that lands on a hull struck the face it was flying at; anything else splashes outward.
  const direct = weapon.delivery === 'direct';
  const flew = p.toX >= p.fromX ? DMG_FLEW_POS : DMG_FLEW_NEG;
  const base = (p.top ? DMG_TOP : 0) | (flush ? DMG_FLUSH : 0);

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
    const cls = unitClass(t);
    const mul = cls === CLASS_VEHICLE ? p.damageMul * p.vehicleMul : p.damageMul;
    let amount = weapon.damage * mul * falloff * damageFactor(dtype, cls);
    if (flush && cls === CLASS_BUILDING) amount = weapon.damage * mul * falloff * FIRE_BUILDING;
    else if (flush && t.trenchId >= 0) amount *= SPECIALS.flameTrenchMul;
    const flags = direct && d <= 0 ? base | flew : base;
    w.damage.push(TARGET_UNIT, i, t.id, amount, side, dtype, t.x >= x ? 1 : -1, flags);
  }

  const pillboxes = s.pillboxes;
  for (let i = 0; i < pillboxes.length; i++) {
    const b = pillboxes[i];
    if (!b.alive || b.side !== enemy) continue;
    const d = (b.x > x ? b.x - x : x - b.x) - CONFIG.pillboxWidth / 2;
    if (d > r) continue;
    const falloff = d <= 0 ? 1 : 1 - d / r;
    let amount = weapon.damage * p.damageMul * falloff * damageFactor(dtype, CLASS_FORT);
    if (flush) amount *= SPECIALS.flamePillboxMul;
    w.damage.push(TARGET_PILLBOX, i, -1, amount, side, dtype, b.x >= x ? 1 : -1, base);
  }

  const hq = s.sides[enemy].hq;
  if (hq && hq.alive) {
    const d = (hq.x > x ? hq.x - x : x - hq.x) - CONFIG.hqWidth / 2;
    if (d <= r) {
      const falloff = d <= 0 ? 1 : 1 - d / r;
      const amount = weapon.damage * p.damageMul * p.hqMul * falloff * damageFactor(dtype, CLASS_HQ);
      w.damage.push(TARGET_HQ, enemy, -1, amount, side, dtype, hq.x >= x ? 1 : -1, base);
    }
  }

  // The walls of the buildings it lands among (not the flamethrower's: fire burns the men, not the brick).
  if (!flush && s.buildings.length > 0) splashWalls(w, side, wi, x, r, weapon.damage * p.damageMul, x >= p.fromX ? 1 : -1);

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
    // Obstacles and water (FOUNDATIONS.md 4.4, 4.6, 4.8): blasts wear down obstacles and bridges and set mines off.
    const dmg = weapon.damage * p.damageMul;
    if (s.obstacles.length > 0) splashObstacles(w, x, r, dmg);
    if (s.minefields.length > 0) splashMines(w, side, x, r, dmg);
    if (s.bridges.length > 0) splashBridges(w, side, x, r, dmg);
  }
  // A boat crossing under the barrage (FOUNDATIONS.md 4.4).
  if (s.ferries.length > 0) hitFerries(w, side, x);
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
