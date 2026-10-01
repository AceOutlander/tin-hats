/**
 * Trench slots, dropping in, leaving, and capture.
 *
 * A unit first reserves a slot (u.trench, u.slot) and walks to it; when it stands on the slot it
 * drops in (u.trenchId, trench.occupants) and counts as `infantryTrench`. A trench changes hands
 * when infantry of the side that does not own it stand inside it while none of the owner's
 * infantry do; the old owner's reservations are then cancelled.
 */
import { CONFIG } from '../data/config';
import { KIND_SAPPER } from './tables';
import type { UnitState } from './types';
import type { World } from './world';

/** Slot arrays for the mission's trenches. Called once when the battle is created. */
export function layoutTrenches(w: World): void {
  const trenches = w.state.trenches;
  let total = 0;
  for (let t = 0; t < trenches.length; t++) {
    const trench = trenches[t];
    w.trenchSlot0[t] = total;
    w.trenchHalf[t] = trench.width / 2;
    const spacing = trench.slots > 0 ? Math.min(CONFIG.trenchSlotSpacing, trench.width / trench.slots) : 0;
    for (let k = 0; k < trench.slots; k++) {
      w.slotX[total + k] = trench.x + (k - (trench.slots - 1) / 2) * spacing;
      w.slotUnit[total + k] = -1;
    }
    total += trench.slots;
  }
}

/** Total slots over all trenches (the size of the slot arrays). */
export function slotCount(slots: readonly { slots: number }[]): number {
  let n = 0;
  for (const t of slots) n += t.slots;
  return n;
}

/** Reserve the free slot of trench `t` nearest to the unit. Returns false if the trench is full. */
export function claimSlot(w: World, u: UnitState, t: number): boolean {
  const trench = w.state.trenches[t];
  if (w.trenchTaken[t] >= trench.slots) return false;
  const first = w.trenchSlot0[t];
  let best = -1;
  let bestD = Infinity;
  for (let k = 0; k < trench.slots; k++) {
    const g = first + k;
    if (w.slotUnit[g] >= 0) continue;
    const d = w.slotX[g] > u.x ? w.slotX[g] - u.x : u.x - w.slotX[g];
    if (d < bestD) {
      bestD = d;
      best = g;
    }
  }
  if (best < 0) return false;
  w.slotUnit[best] = u.index;
  w.trenchTaken[t]++;
  u.trench = t;
  u.slot = best;
  return true;
}

/** Give up the unit's slot (reserved or held). Safe to call for a unit without one. */
export function releaseSlot(w: World, u: UnitState): void {
  if (u.slot < 0) return;
  w.slotUnit[u.slot] = -1;
  w.trenchTaken[u.trench]--;
  if (u.trenchId >= 0) {
    w.state.trenches[u.trench].occupants--;
    u.trenchId = -1;
  }
  u.trench = -1;
  u.slot = -1;
}

/** Change a trench's owner, cancel the old owner's reservations and report it. */
function capture(w: World, t: number, side: number): void {
  const s = w.state;
  const trench = s.trenches[t];
  const previous = trench.owner;
  trench.owner = side;
  trench.capturedAt = s.time;
  const first = w.trenchSlot0[t];
  for (let k = 0; k < trench.slots; k++) {
    const holder = w.slotUnit[first + k];
    if (holder >= 0 && s.units[holder].side !== side) releaseSlot(w, s.units[holder]);
  }
  const e = w.events.emit('trenchCaptured');
  e.side = side;
  e.targetIndex = trench.id;
  e.x = trench.x;
  e.value = previous;
}

/** Drop a unit standing on its reserved slot into the trench. The trench becomes its side's if it was not. */
export function enterSlot(w: World, u: UnitState): void {
  if (u.slot < 0 || u.trenchId >= 0) return;
  const trench = w.state.trenches[u.trench];
  if (trench.owner !== u.side) capture(w, u.trench, u.side);
  u.trenchId = trench.id;
  trench.occupants++;
}

/**
 * After movement: units standing on their reserved slot drop in, then trenches change hands where
 * one side's infantry stand inside and the other side's do not. Both sides are counted before any
 * trench changes owner, so the order of the unit pool never favours a side.
 */
export function updateTrenches(w: World): void {
  const s = w.state;
  const trenches = s.trenches;
  if (trenches.length === 0) return;
  const units = s.units;
  const inside = w.trenchInside;
  inside.fill(0);

  for (let i = 0; i < s.unitCount; i++) {
    const u = units[i];
    if (!u.alive || u.inside) continue;
    if (u.slot >= 0 && u.trenchId < 0 && u.x === w.slotX[u.slot]) enterSlot(w, u);
    if (u.def.class !== 'infantry' || u.kindIndex === KIND_SAPPER) continue;
    for (let t = 0; t < trenches.length; t++) {
      const d = u.x - trenches[t].x;
      const half = w.trenchHalf[t];
      if (d >= -half && d <= half) inside[t * 2 + u.side]++;
    }
  }

  for (let t = 0; t < trenches.length; t++) {
    const owner = trenches[t].owner;
    const a = inside[t * 2];
    const b = inside[t * 2 + 1];
    if (a > 0 && b === 0 && owner !== 0) capture(w, t, 0);
    else if (b > 0 && a === 0 && owner !== 1) capture(w, t, 1);
  }
}
