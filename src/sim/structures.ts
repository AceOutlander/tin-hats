/**
 * Front lines, hold lines and structure guns. The HQ machine gun and the
 * pillbox machine guns run through the same structure-weapon code.
 */
import { CONFIG } from '../data/config';
import { senseMount, updateMount } from './combat';
import { TARGET_NONE, type EntityKind, type MountState } from './types';
import type { World } from './world';

/**
 * The line a side's army holds under Hold: the forward-most trench (or building) or capture point it owns
 * (FOUNDATIONS.md 4.5), or holdLineOffset in front of its HQ, or its map edge if it has none.
 * Also sets the side's hold trench or hold point, the base its formation forms up behind
 * (behind the trench's rear edge when the line is a trench, from the zone's forward edge back when it is a point)
 * and the line's forward edge. A trench inside or ahead of a point's zone is the stronger line and wins.
 */
function holdLineOf(w: World, side: number): void {
  const s = w.state;
  const dir = side === 0 ? 1 : -1;
  let best = -1;
  for (let i = 0; i < s.trenches.length; i++) {
    const t = s.trenches[i];
    if (t.owner !== side) continue;
    if (best < 0 || (t.x - s.trenches[best].x) * dir > 0) best = i;
  }
  let point = -1;
  const points = s.points;
  for (let k = 0; k < points.length; k++) {
    const p = points[k];
    // A point that is a structure is held through it (its trench above).
    if (p.owner !== side || p.trench >= 0) continue;
    const rear = p.x - (dir * p.width) / 2;
    if (best >= 0 && (s.trenches[best].x - rear) * dir >= 0) continue;
    if (point < 0 || (p.x - points[point].x) * dir > 0) point = k;
  }
  if (point >= 0) best = -1;
  w.holdTrench[side] = best;
  w.holdPoint[side] = point;
  let line: number;
  if (point >= 0) {
    const p = points[point];
    line = p.x;
    w.formBase[side] = p.x + (dir * p.width) / 2;
    w.lineFront[side] = w.formBase[side];
  } else if (best >= 0) {
    line = s.trenches[best].x;
    const half = w.trenchHalf[best];
    w.formBase[side] = line - dir * (half + CONFIG.trenchFormGap);
    w.lineFront[side] = line + dir * half;
  } else {
    const hq = s.sides[side].hq;
    if (hq) line = hq.x + dir * CONFIG.holdLineOffset;
    else line = side === 0 ? CONFIG.mapMargin : s.length - CONFIG.mapMargin;
    w.formBase[side] = line;
    w.lineFront[side] = line;
  }
  s.sides[side].holdLineX = line;
}

/**
 * For every unit on the field, how many of its side (itself included) stand within clusterRadius
 * (|dx| <= radius; 0 for units not on the field). A sorted sweep: each side's units on the field
 * stay in w.clusterOrder in last tick's x order, so the insertion sort is close to O(n), and two
 * pointers bound each unit's window. The distance test is the same subtraction an all-pairs count
 * uses, so the result is identical to one.
 */
export function countClusters(w: World): void {
  const s = w.state;
  const units = s.units;
  const n = s.unitCount;
  const radius = CONFIG.clusterRadius;
  const cluster = w.cluster;
  const xs = w.clusterX;
  const mark = w.clusterMark;
  for (let i = 0; i < n; i++) {
    cluster[i] = 0;
    mark[i] = 0;
    xs[i] = units[i].x;
  }
  for (let side = 0; side < 2; side++) {
    const order = w.clusterOrder[side];
    // Last tick's members still on the field keep their order; newcomers go on the end.
    let len = 0;
    const prev = w.clusterLen[side];
    for (let k = 0; k < prev; k++) {
      const i = order[k];
      if (i >= n || mark[i] !== 0) continue;
      const u = units[i];
      if (!u.alive || u.inside || u.side !== side) continue;
      mark[i] = 1;
      order[len++] = i;
    }
    for (let i = 0; i < n; i++) {
      if (mark[i] !== 0) continue;
      const u = units[i];
      if (!u.alive || u.inside || u.side !== side) continue;
      mark[i] = 1;
      order[len++] = i;
    }
    w.clusterLen[side] = len;
    for (let k = 1; k < len; k++) {
      const v = order[k];
      const x = xs[v];
      let j = k - 1;
      while (j >= 0 && xs[order[j]] > x) {
        order[j + 1] = order[j];
        j--;
      }
      order[j + 1] = v;
    }
    let lo = 0;
    let hi = 0;
    for (let k = 0; k < len; k++) {
      const x = xs[order[k]];
      while (x - xs[order[lo]] > radius) lo++;
      if (hi < k) hi = k;
      while (hi + 1 < len && xs[order[hi + 1]] - x <= radius) hi++;
      const c = hi - lo + 1;
      cluster[order[k]] = c > 255 ? 255 : c;
    }
  }
}

/**
 * Snapshot, before anyone moves this tick: each side's most forward blocker
 * (units on the field, the far edge of a trench its troops occupy, live
 * pillboxes, the HQ door), its most forward armed line unit, the front clamp
 * for the other side, the hold lines and the cluster counts. Movement and
 * targeting read these snapshots so that the order units are processed in can
 * never favour a side.
 */
export function computeFronts(w: World): void {
  const s = w.state;
  let f0 = 0;
  let f1 = s.length;
  let a0 = -Infinity;
  let a1 = Infinity;

  const hq0 = s.sides[0].hq;
  if (hq0 && hq0.alive && hq0.doorX > f0) f0 = hq0.doorX;
  const hq1 = s.sides[1].hq;
  if (hq1 && hq1.alive && hq1.doorX < f1) f1 = hq1.doorX;

  for (let i = 0; i < s.pillboxes.length; i++) {
    const p = s.pillboxes[i];
    if (!p.alive) continue;
    if (p.side === 0) {
      if (p.x > f0) f0 = p.x;
    } else if (p.x < f1) f1 = p.x;
  }

  // An occupied trench is held to its far edge: the other side cannot enter it.
  for (let i = 0; i < s.trenches.length; i++) {
    const t = s.trenches[i];
    if (t.occupants <= 0) continue;
    const half = w.trenchHalf[i];
    if (t.owner === 0) {
      if (t.x + half > f0) f0 = t.x + half;
    } else if (t.owner === 1 && t.x - half < f1) f1 = t.x - half;
  }

  const units = s.units;
  w.leadCount[0] = 0;
  w.leadCount[1] = 0;
  for (let i = 0; i < s.unitCount; i++) {
    const u = units[i];
    if (!u.alive || u.inside) continue;
    const lead = u.def.armed && u.behaviour === 'army' && !u.def.followsLine;
    if (lead) w.leadCount[u.side]++;
    if (u.side === 0) {
      if (u.x > f0) f0 = u.x;
      if (lead && u.x > a0) a0 = u.x;
    } else {
      if (u.x < f1) f1 = u.x;
      if (lead && u.x < a1) a1 = u.x;
    }
  }

  holdLineOf(w, 0);
  holdLineOf(w, 1);
  const line0 = s.sides[0].holdLineX;
  const line1 = s.sides[1].holdLineX;
  w.front[0] = f0;
  w.front[1] = f1;
  w.armedFront[0] = a0 === -Infinity ? line0 : a0;
  w.armedFront[1] = a1 === Infinity ? line1 : a1;
  w.limit[0] = f1 - CONFIG.contactGap;
  w.limit[1] = f0 + CONFIG.contactGap;
  countClusters(w);
}

/**
 * The structure-weapon cycle shared by HQ and pillbox guns: fire whenever an enemy is in range,
 * whatever the order. The caller sets gun.x (and for firing gun.damageMul and gun.rateMul) first.
 */
function fireGun(w: World, gun: MountState, side: number, source: EntityKind): void {
  updateMount(w, gun, gun.targetType !== TARGET_NONE, side, -1, null, source);
}

/** Target upkeep for structure guns (before movement, like the units). */
export function senseStructures(w: World, retarget: boolean): void {
  const s = w.state;
  for (let side = 0; side < 2; side++) {
    const hq = s.sides[side].hq;
    if (!hq || !hq.alive) continue;
    hq.gun.x = hq.gunX;
    senseMount(w, hq.gun, side, retarget);
  }
  for (let i = 0; i < s.pillboxes.length; i++) {
    const p = s.pillboxes[i];
    if (!p.alive) continue;
    p.gun.x = p.x;
    senseMount(w, p.gun, p.side, retarget);
  }
}

/** Fire structure guns. HQ guns carry the side's HQ-gun upgrades; pillbox guns fire at base strength. */
export function fireStructures(w: World): void {
  const s = w.state;
  for (let side = 0; side < 2; side++) {
    const hq = s.sides[side].hq;
    if (!hq || !hq.alive) continue;
    const mods = w.mods[side];
    const gun = hq.gun;
    gun.x = hq.gunX;
    gun.damageMul = mods.hqGunDamage;
    gun.rateMul = mods.hqGunRate;
    fireGun(w, gun, side, 'hq');
  }
  for (let i = 0; i < s.pillboxes.length; i++) {
    const p = s.pillboxes[i];
    if (!p.alive) continue;
    const gun = p.gun;
    gun.x = p.x;
    gun.damageMul = 1;
    gun.rateMul = 1;
    fireGun(w, gun, p.side, 'pillbox');
  }
}
