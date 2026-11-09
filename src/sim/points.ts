/**
 * Capture points, forward spawn points and rally Fall Back (FOUNDATIONS.md 4.5).
 *
 * A point without a structure changes hands when one side's armed units stand in its zone with none of the other
 * side's for its captureTime (progress builds while that lasts, stops while both sides are in it, and drains while
 * nobody, or only the owner, is). A point with a structure (a trench, or a building's stand-in trench) simply follows
 * that structure's owner. While owned and uncontested (no armed enemy within contestRadius), a spawn point is where
 * trained units may deploy (SideState.deploy) and where Fall Back rallies. Both sides are counted before any point
 * changes hands, so the order of the unit pool never favours a side.
 */
import { POINT_RULES } from '../data/ground';
import type { MissionDef } from '../data/schema';
import { KIND_SAPPER } from './tables';
import { DEPLOY_HQ, type CapturePointState, type TrenchState, type UnitState } from './types';
import type { World } from './world';

/** The points of a mission, as battle state. A structure resolves to its trench (a building to its stand-in trench). */
export function createPoints(mission: MissionDef, trenches: readonly TrenchState[]): CapturePointState[] {
  return (mission.capturePoints ?? []).map((p) => {
    const id = p.structure ? ('trench' in p.structure ? p.structure.trench : p.structure.building) : null;
    const trench = id === null ? -1 : trenches.findIndex((t) => t.id === id);
    return {
      id: p.id,
      label: p.label,
      x: p.x,
      width: p.width,
      owner: trench >= 0 ? trenches[trench].owner : p.owner,
      captureTime: p.captureTime,
      spawn: p.spawn,
      contestRadius: p.contestRadius,
      trench,
      capturing: -1,
      progress: 0,
      contested: false,
      capturedAt: -1,
    };
  });
}

function flip(w: World, i: number, side: number): void {
  const p = w.state.points[i];
  const previous = p.owner;
  p.owner = side;
  p.capturing = -1;
  p.progress = 0;
  p.capturedAt = w.state.time;
  const e = w.events.emit('pointCaptured');
  e.side = side;
  e.targetIndex = i;
  e.x = p.x;
  e.value = previous;
  e.text = p.label;
}

/** Scratch per point and side: armed units in the zone, and within the contest radius. */
let inZone = new Int32Array(0);
let near = new Int32Array(0);

/**
 * After movement and the trench captures: count each side in every zone, move the capture timers on, sync the
 * structure points, mark contested points and work out where each side deploys. `dt` 0 only syncs (battle start).
 */
export function updatePoints(w: World, dt: number): void {
  const s = w.state;
  const points = s.points;
  const n = points.length;
  if (n === 0) return;
  if (inZone.length < n * 2) {
    inZone = new Int32Array(n * 2);
    near = new Int32Array(n * 2);
  }
  inZone.fill(0, 0, n * 2);
  near.fill(0, 0, n * 2);
  const units = s.units;
  for (let i = 0; i < s.unitCount; i++) {
    const u = units[i];
    if (!u.alive || u.inside || !u.def.armed || u.kindIndex === KIND_SAPPER) continue;
    for (let k = 0; k < n; k++) {
      const p = points[k];
      const d = u.x > p.x ? u.x - p.x : p.x - u.x;
      if (d <= p.width / 2) inZone[k * 2 + u.side]++;
      if (d <= p.contestRadius) near[k * 2 + u.side]++;
    }
  }
  for (let k = 0; k < n; k++) {
    const p = points[k];
    if (p.trench >= 0) {
      const owner = s.trenches[p.trench].owner;
      if (owner !== p.owner) flip(w, k, owner);
    } else if (dt > 0) {
      const a = inZone[k * 2];
      const b = inZone[k * 2 + 1];
      const taker = a > 0 && b === 0 ? 0 : b > 0 && a === 0 ? 1 : -1;
      const rate = p.captureTime > 0 ? dt / p.captureTime : 1;
      if (taker >= 0 && taker !== p.owner) {
        if (p.capturing !== taker) {
          p.capturing = taker;
          p.progress = 0;
        }
        p.progress += rate;
        if (p.progress >= 1 - 1e-9) flip(w, k, taker);
      } else if (a === 0 || b === 0) {
        // Nobody in it, or only its owner: the half-done capture drains away.
        p.progress -= rate;
        if (p.progress <= 0) {
          p.progress = 0;
          p.capturing = -1;
        }
      }
      // Both sides in it: the capture stands still.
    }
    p.contested = p.owner >= 0 && near[k * 2 + (1 - p.owner)] > 0;
  }
  s.sides[0].deployPoint = resolveDeploy(w, 0);
  s.sides[1].deployPoint = resolveDeploy(w, 1);
}

/** Whether side `si` may deploy at (or rally to) point `k` now: its spawn point, owned and uncontested. */
export function pointAvailable(w: World, si: number, k: number): boolean {
  const p = w.state.points[k];
  return p.spawn && p.owner === si && !p.contested;
}

/** The forward-most available spawn point of a side, or -1. */
function forwardMost(w: World, si: number): number {
  const points = w.state.points;
  const dir = si === 0 ? 1 : -1;
  let best = -1;
  for (let k = 0; k < points.length; k++) {
    if (!pointAvailable(w, si, k)) continue;
    if (best < 0 || (points[k].x - points[best].x) * dir > 0) best = k;
  }
  return best;
}

/** Where side `si` deploys now: an index into state.points, or -1 for the HQ door (SideState.deploy). */
export function resolveDeploy(w: World, si: number): number {
  const side = w.state.sides[si];
  if (side.deploy === DEPLOY_HQ || w.state.points.length === 0) return -1;
  if (side.deploy >= 0 && side.deploy < w.state.points.length && pointAvailable(w, si, side.deploy)) return side.deploy;
  return forwardMost(w, si);
}

/** World x where a unit trained by side `si` deploying at point `k` walks out: just behind the point's zone. */
export function deployX(w: World, si: number, k: number): number {
  const p = w.state.points[k];
  const dir = si === 0 ? 1 : -1;
  return p.x - dir * (p.width / 2 + POINT_RULES.deployBehind);
}

/**
 * Fall Back: the rally point a unit should head for, or -1 for the HQ (FOUNDATIONS.md 4.5). The nearest available
 * spawn point of its side behind it (its whole zone behind the unit), unless the unit is within
 * POINT_RULES.rallyHqReach of its HQ door.
 */
export function rallyFor(w: World, u: UnitState): number {
  const s = w.state;
  const points = s.points;
  if (points.length === 0) return -1;
  const hq = s.sides[u.side].hq;
  if (hq && hq.alive) {
    const d = u.x > hq.doorX ? u.x - hq.doorX : hq.doorX - u.x;
    if (d <= POINT_RULES.rallyHqReach) return -1;
  }
  const dir = u.side === 0 ? 1 : -1;
  let best = -1;
  for (let k = 0; k < points.length; k++) {
    const p = points[k];
    if ((u.x - p.x) * dir <= p.width / 2 || !pointAvailable(w, u.side, k)) continue;
    if (best < 0 || (p.x - points[best].x) * dir > 0) best = k;
  }
  return best;
}
