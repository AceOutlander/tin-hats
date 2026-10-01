/**
 * Front lines, hold lines and structures. Phase 1 simulates the HQ and its
 * machine gun; trenches, pillbox guns and wire are present as state and are
 * filled in by Phase 2 at the marked places.
 */
import { CONFIG } from '../data/config';
import { senseMount, updateMount } from './combat';
import { TARGET_NONE } from './types';
import type { World } from './world';

/**
 * The line a side's army holds under Hold: the forward-most trench it owns,
 * or holdLineOffset in front of its HQ, or its map edge if it has neither.
 */
function holdLineOf(w: World, side: number): number {
  const s = w.state;
  const dir = side === 0 ? 1 : -1;
  let line = 0;
  let found = false;
  for (let i = 0; i < s.trenches.length; i++) {
    const t = s.trenches[i];
    if (t.owner !== side) continue;
    if (!found || (t.x - line) * dir > 0) {
      line = t.x;
      found = true;
    }
  }
  if (found) return line;
  const hq = s.sides[side].hq;
  if (hq) return hq.x + dir * CONFIG.holdLineOffset;
  return side === 0 ? CONFIG.mapMargin : s.length - CONFIG.mapMargin;
}

/**
 * Snapshot, before anyone moves this tick: each side's most forward blocker,
 * its most forward armed army unit, the front clamp for the other side, and
 * the hold lines. Movement and targeting read these snapshots so that the
 * order units are processed in can never favour a side.
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

  const units = s.units;
  for (let i = 0; i < s.unitCount; i++) {
    const u = units[i];
    if (!u.alive || u.inside) continue;
    const lead = u.def.armed && u.behaviour === 'army';
    if (u.side === 0) {
      if (u.x > f0) f0 = u.x;
      if (lead && u.x > a0) a0 = u.x;
    } else {
      if (u.x < f1) f1 = u.x;
      if (lead && u.x < a1) a1 = u.x;
    }
  }

  const line0 = holdLineOf(w, 0);
  const line1 = holdLineOf(w, 1);
  s.sides[0].holdLineX = line0;
  s.sides[1].holdLineX = line1;
  w.front[0] = f0;
  w.front[1] = f1;
  w.armedFront[0] = a0 === -Infinity ? line0 : a0;
  w.armedFront[1] = a1 === Infinity ? line1 : a1;
  w.limit[0] = f1 - CONFIG.contactGap;
  w.limit[1] = f0 + CONFIG.contactGap;
}

/** Target upkeep for structure guns (before movement, like the units). */
export function senseStructures(w: World, retarget: boolean): void {
  const s = w.state;
  for (let side = 0; side < 2; side++) {
    const hq = s.sides[side].hq;
    if (hq && hq.alive) {
      hq.gun.x = hq.gunX;
      senseMount(w, hq.gun, side, retarget);
    }
  }
  // Phase 2: pillbox guns acquire targets here. NOT YET IMPLEMENTED.
}

/** Fire structure guns. The HQ gun fires whenever an enemy is in range, whatever the order. */
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
    updateMount(w, gun, gun.targetType !== TARGET_NONE, side, -1, null, 'hq');
  }
  // Phase 2: pillbox guns fire here (updateMount with source 'pillbox'). NOT YET IMPLEMENTED.
}
