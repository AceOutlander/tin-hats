/**
 * Sappers' Clear jobs (FOUNDATIONS.md 4.6 and 4.8: the prep phase's build jobs run in reverse). A side orders one on an
 * enemy minefield it can see or an enemy tank trap or road block (Command `clear`); the nearest free sapper of the side
 * leaves the supply road, walks to the near edge and works there: a field shrinks from that edge at MINES.clearRate wu
 * a second, an obstacle loses OBSTACLES.clearRate health a second. The job ends when its target is gone (cleared,
 * blown or thinned to nothing), and the sapper goes back to hauling. One sapper per job, one job per target and side.
 */
import { MINES, OBSTACLES } from '../data/obstacles';
import { clearField, nearEdge } from './mines';
import { damageObstacle } from './obstacles';
import { KIND_SAPPER } from './tables';
import type { ClearJobState } from './types';
import type { World } from './world';

/** How far from the x a clear order names its target may lie (wu). */
export const CLEAR_PICK = 400;

/** Where a sapper of side si stands to work on the job's target, or NaN once the target is gone. */
function workX(w: World, job: ClearJobState): number {
  const s = w.state;
  const dir = job.side === 0 ? 1 : -1;
  if (job.target === 'minefield') {
    const f = s.minefields[job.index];
    return f.alive ? nearEdge(f, job.side) : NaN;
  }
  const o = s.obstacles[job.index];
  return o.alive ? o.x - dir * (o.width / 2 + 6) : NaN;
}

/**
 * The target a clear order of side si at x names: the nearest enemy minefield the side can see, or enemy obstacle,
 * within CLEAR_PICK of x. Writes [kind, index] (kind 0 = minefield, 1 = obstacle) and returns false when there is none.
 */
export function clearTarget(w: World, si: number, x: number, out: Int32Array): boolean {
  const s = w.state;
  let best = CLEAR_PICK;
  let found = false;
  for (let k = 0; k < s.minefields.length; k++) {
    const f = s.minefields[k];
    if (!f.alive || f.owner === si || !f.known[si]) continue;
    const d = Math.max(0, Math.abs(f.x - x) - f.width / 2);
    if (d <= best) {
      best = d;
      out[0] = 0;
      out[1] = k;
      found = true;
    }
  }
  for (let k = 0; k < s.obstacles.length; k++) {
    const o = s.obstacles[k];
    if (!o.alive || o.owner === si) continue;
    const d = Math.max(0, Math.abs(o.x - x) - o.width / 2);
    if (d < best || (!found && d <= best)) {
      best = d;
      out[0] = 1;
      out[1] = k;
      found = true;
    }
  }
  return found;
}

const PICK = new Int32Array(2);

/** True if side si already has a Clear job on that target. */
function jobOn(w: World, si: number, target: 'minefield' | 'obstacle', index: number): boolean {
  for (const job of w.state.clears) if (job.side === si && job.target === target && job.index === index) return true;
  return false;
}

/** Command `clear`: a Clear job for side si on the target nearest x (dropped if there is none, or one is on it). */
export function applyClear(w: World, si: number, x: number): void {
  if (!Number.isFinite(x) || !clearTarget(w, si, x, PICK)) return;
  const target = PICK[0] === 0 ? 'minefield' : 'obstacle';
  const index = PICK[1];
  if (jobOn(w, si, target, index)) return;
  const job: ClearJobState = { id: w.nextSiteId++, side: si === 1 ? 1 : 0, target, index, x: 0, worker: -1, workerId: -1 };
  job.x = workX(w, job);
  w.state.clears.push(job);
}

/** The Clear job with this id (UnitState.site), or null. */
export function clearJob(w: World, id: number): ClearJobState | null {
  const jobs = w.state.clears;
  for (let i = 0; i < jobs.length; i++) if (jobs[i].id === id) return jobs[i];
  return null;
}

function freeWorker(w: World, job: ClearJobState): void {
  if (job.worker < 0) return;
  const u = w.state.units[job.worker];
  if (u.alive && u.id === job.workerId && u.site === job.id) u.site = -1;
  job.worker = -1;
  job.workerId = -1;
}

/** Each tick: give every job a sapper, let the sappers at their spot work, and close jobs whose target is gone. */
export function updateClears(w: World): void {
  const s = w.state;
  const jobs = s.clears;
  if (jobs.length === 0) return;
  const units = s.units;
  for (let i = jobs.length - 1; i >= 0; i--) {
    const job = jobs[i];
    job.x = workX(w, job);
    if (!Number.isFinite(job.x)) {
      freeWorker(w, job);
      jobs.splice(i, 1);
      continue;
    }
    if (job.worker >= 0) {
      const u = units[job.worker];
      if (!u.alive || u.id !== job.workerId || u.site !== job.id || u.inside) {
        if (u.alive && u.id === job.workerId && u.site === job.id) u.site = -1;
        job.worker = -1;
        job.workerId = -1;
      }
    }
    if (job.worker < 0) {
      let best = -1;
      let bestD = Infinity;
      for (let j = 0; j < s.unitCount; j++) {
        const u = units[j];
        if (!u.alive || u.side !== job.side || u.kindIndex !== KIND_SAPPER || u.inside || u.site >= 0) continue;
        const d = Math.abs(u.x - job.x);
        if (d < bestD) {
          bestD = d;
          best = j;
        }
      }
      if (best < 0) continue;
      const u = units[best];
      u.site = job.id;
      job.worker = best;
      job.workerId = u.id;
    }
    const u = units[job.worker];
    if (Math.abs(u.x - job.x) > OBSTACLES.clearReach) continue;
    let done: boolean;
    if (job.target === 'minefield') {
      clearField(w, job.index, job.side, MINES.clearRate * w.dt);
      done = !s.minefields[job.index].alive;
    } else {
      damageObstacle(w, job.index, OBSTACLES.clearRate * w.dt, 'cleared');
      done = !s.obstacles[job.index].alive;
    }
    if (done) {
      const e = w.events.emit('clearDone');
      e.side = job.side;
      e.x = job.x;
      e.text = job.target;
      freeWorker(w, job);
      jobs.splice(i, 1);
    }
  }
}
