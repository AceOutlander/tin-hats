/**
 * Tank traps and road blocks (FOUNDATIONS.md 4.8; tunables OBSTACLES in src/data/obstacles.ts).
 *
 * An obstacle stops the other side's vehicles: walk() clamps a vehicle so its hull never enters one (clampVehicle), a
 * front clamp for the vehicle class that holds whatever the vehicle's order, and only from outside, so a vehicle that
 * is somehow already in one drives out. A road block also slows the other side's infantry like wire. An obstacle goes
 * when explosive splash (either side's; steel hedgehogs take only a share), a sapper's Clear job (src/sim/clear.ts) or
 * the vehicles held at it with nothing to shoot at (tow cables, the gun, the hull) wear its health down. Nothing here
 * runs for a battle with no obstacles.
 */
import { OBSTACLES } from '../data/obstacles';
import type { MissionDef, ObstacleDef } from '../data/schema';
import type { ObstacleState, UnitState } from './types';
import type { World } from './world';

export function obstacleState(def: ObstacleDef): ObstacleState {
  const maxHp = OBSTACLES.kinds[def.kind].hp;
  return { id: def.id, x: def.x, width: def.width, owner: def.owner, kind: def.kind, hp: maxHp, maxHp, alive: true, held: 0 };
}

/** The mission's obstacles as battle state. */
export function createObstacles(mission: MissionDef): ObstacleState[] {
  return (mission.obstacles ?? []).map(obstacleState);
}

/** A new obstacle (a finished prep build); returns its index in state.obstacles. */
export function addObstacle(w: World, def: ObstacleDef): number {
  w.state.obstacles.push(obstacleState(def));
  return w.state.obstacles.length - 1;
}

/**
 * The furthest a vehicle moving from u.x toward nx may go without its hull entering an obstacle of the other side.
 * A vehicle held this way counts toward the obstacle's `held` (it works the obstacle loose).
 */
export function clampVehicle(w: World, u: UnitState, nx: number): number {
  const obs = w.state.obstacles;
  const x = u.x;
  const hull = u.def.width / 2;
  for (let i = 0; i < obs.length; i++) {
    const o = obs[i];
    if (!o.alive || o.owner === u.side) continue;
    const lo = o.x - o.width / 2 - hull;
    const hi = o.x + o.width / 2 + hull;
    if (nx > x && x <= lo && nx > lo) {
      nx = lo;
      o.held++;
    } else if (nx < x && x >= hi && nx < hi) {
      nx = hi;
      o.held++;
    }
  }
  return nx;
}

/** True if the unit stands in a road block of the other side (its infantry are slowed as by wire). */
export function inEnemyRoadBlock(w: World, u: UnitState): boolean {
  const obs = w.state.obstacles;
  for (let i = 0; i < obs.length; i++) {
    const o = obs[i];
    if (!o.alive || o.owner === u.side || !OBSTACLES.kinds[o.kind].slowsInfantry) continue;
    const d = u.x > o.x ? u.x - o.x : o.x - u.x;
    if (d <= o.width / 2) return true;
  }
  return false;
}

/** Remove an obstacle. `cause` is how it went: 'explosive' (blown), 'cleared' (sappers) or 'breached' (vehicles). */
export function destroyObstacle(w: World, i: number, cause: string): void {
  const o = w.state.obstacles[i];
  if (!o.alive) return;
  o.alive = false;
  o.hp = 0;
  const e = w.events.emit('obstacleDestroyed');
  e.targetIndex = i;
  e.side = o.owner;
  e.x = o.x;
  e.cause = cause === 'explosive' ? 'explosive' : null;
  e.text = cause;
}

/** Wear an obstacle down by `amount`; it goes at 0. */
export function damageObstacle(w: World, i: number, amount: number, cause: string): void {
  const o = w.state.obstacles[i];
  if (!o.alive || amount <= 0) return;
  o.hp -= amount;
  if (o.hp <= 0) destroyObstacle(w, i, cause);
}

/** Explosive splash of `damage` (weapon damage x the firer's multiplier) landing at x with radius r. */
export function splashObstacles(w: World, x: number, r: number, damage: number): void {
  const obs = w.state.obstacles;
  for (let i = 0; i < obs.length; i++) {
    const o = obs[i];
    if (!o.alive) continue;
    const d = (o.x > x ? o.x - x : x - o.x) - o.width / 2;
    if (d > r) continue;
    const falloff = d <= 0 ? 1 : 1 - d / r;
    damageObstacle(w, i, damage * falloff * OBSTACLES.kinds[o.kind].blastMul, 'explosive');
  }
}

/** After movement: the vehicles held at each obstacle this tick work it loose. */
export function updateObstacles(w: World): void {
  const obs = w.state.obstacles;
  for (let i = 0; i < obs.length; i++) {
    const o = obs[i];
    if (o.held > 0 && o.alive) damageObstacle(w, i, o.held * OBSTACLES.breachDps * w.dt, 'breached');
    o.held = 0;
  }
}
