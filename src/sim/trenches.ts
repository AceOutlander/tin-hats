/**
 * Trench slots, dropping in, leaving, and capture.
 *
 * A unit first reserves a slot (u.trench, u.slot) and walks to it; when it stands on the slot it
 * drops in (u.trenchId, trench.occupants) and counts as `infantryTrench`. A trench changes hands
 * when infantry of the side that does not own it stand inside it while none of the owner's
 * infantry do; the old owner's reservations are then cancelled.
 */
import { CONFIG, SPECIALS } from '../data/config';
import type { TrenchDef } from '../data/schema';
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

/**
 * A trench dug during the battle (the prep phase): appended to state.trenches, with the slot arrays grown to hold its
 * slots after every existing one, so no index already handed out changes. Returns its index in state.trenches.
 */
export function addTrench(w: World, def: TrenchDef): number {
  const trenches = w.state.trenches;
  const t = trenches.length;
  trenches.push({ id: def.id, x: def.x, width: def.width, slots: def.slots, owner: def.owner, occupants: 0, capturedAt: -1 });
  const grow32 = (a: Int32Array, n: number): Int32Array => {
    const b = new Int32Array(n);
    b.set(a.subarray(0, Math.min(a.length, n)));
    return b;
  };
  const grow64 = (a: Float64Array, n: number): Float64Array => {
    const b = new Float64Array(n);
    b.set(a.subarray(0, Math.min(a.length, n)));
    return b;
  };
  const total = slotCount(trenches);
  const first = total - def.slots;
  w.trenchSlot0 = grow32(w.trenchSlot0, t + 1);
  w.trenchTaken = grow32(w.trenchTaken, t + 1);
  w.trenchHalf = grow64(w.trenchHalf, t + 1);
  w.trenchInside = grow32(w.trenchInside, (t + 1) * 2);
  w.slotX = grow64(w.slotX, total);
  w.slotUnit = grow32(w.slotUnit, total);
  w.trenchSlot0[t] = first;
  w.trenchTaken[t] = 0;
  w.trenchHalf[t] = def.width / 2;
  const spacing = def.slots > 0 ? Math.min(CONFIG.trenchSlotSpacing, def.width / def.slots) : 0;
  for (let k = 0; k < def.slots; k++) {
    w.slotX[first + k] = def.x + (k - (def.slots - 1) / 2) * spacing;
    w.slotUnit[first + k] = -1;
  }
  return t;
}

/** Total slots over all trenches (the size of the slot arrays). */
export function slotCount(slots: readonly { slots: number }[]): number {
  let n = 0;
  for (const t of slots) n += t.slots;
  return n;
}

/**
 * Reserve the free slot of trench `t` nearest to the unit; between two equally near slots, the one
 * further back from its side's point of view (slots are scanned rear first), so mirrored sides match.
 * Returns false if the trench is full.
 */
export function claimSlot(w: World, u: UnitState, t: number): boolean {
  const trench = w.state.trenches[t];
  if (w.trenchTaken[t] >= trench.slots) return false;
  // Burned out by a flamethrower: he will not get back into a slot for a while.
  if (u.flushedUntil > w.state.time) return false;
  const first = w.trenchSlot0[t];
  const last = trench.slots - 1;
  let best = -1;
  let bestD = Infinity;
  for (let n = 0; n < trench.slots; n++) {
    const g = first + (u.side === 0 ? n : last - n);
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

/**
 * A flamethrower burned this man out of his trench: he loses the slot (and the cover) and may not
 * take one again for SPECIALS.flushSeconds.
 */
export function flushUnit(w: World, u: UnitState): void {
  releaseSlot(w, u);
  u.flushedUntil = w.state.time + SPECIALS.flushSeconds;
}
