/**
 * What the new unit kinds do beyond moving and shooting:
 *   commander  a damage aura for nearby friendly infantry (one per side, never stacking) and a
 *              line of speech whenever its side's army-wide order changes;
 *   APC        friendly infantry near it climb aboard; under Advance it drives them forward and
 *              unloads them near the front.
 * The flamethrower's flush and fuel tank, hit-facing armour and veterans live where damage and
 * spawning happen (combat.ts, trenches.ts, units.ts); aircraft and anti-aircraft fire in supports.ts.
 */
import { SPECIALS } from '../data/config';
import type { Order } from '../data/schema';
import { KIND_AURA_MUL, KIND_AURA_RADIUS, KIND_CARRIES, KIND_RIDES } from './tables';
import type { MountState, UnitState } from './types';
import { board, dropPassengers, emitUnitEvent } from './units';
import { orderFor, type World } from './world';

/**
 * Find each side's commander for this tick (World.auraUnit): the first living one on the field.
 * A second commander (only a mission script can place one) adds nothing: the aura never stacks.
 */
export function updateAuras(w: World): void {
  const s = w.state;
  w.auraUnit[0] = -1;
  w.auraUnit[1] = -1;
  for (let i = 0; i < s.unitCount; i++) {
    const u = s.units[i];
    if (!u.alive || u.inside || KIND_AURA_RADIUS[u.kindIndex] <= 0) continue;
    if (w.auraUnit[u.side] < 0) w.auraUnit[u.side] = i;
  }
}

/**
 * The commander's aura on friendly infantryman u this tick: m.damageMul is multiplied in place (no
 * double is returned, see the allocation note in combat.ts). Not for the commander himself.
 */
export function applyAura(w: World, u: UnitState, m: MountState): void {
  const ci = w.auraUnit[u.side];
  if (ci < 0 || ci === u.index || u.def.class !== 'infantry') return;
  const c = w.state.units[ci];
  const d = c.x > u.x ? c.x - u.x : u.x - c.x;
  if (d <= KIND_AURA_RADIUS[c.kindIndex]) m.damageMul *= KIND_AURA_MUL[c.kindIndex];
}

/**
 * The army-wide order of side si changed: its commander (alive and on the field) says a line.
 * value = a per-side count, so consecutive speeches walk through the lines without a random draw.
 */
export function speak(w: World, si: number, order: Order): void {
  const cached = w.auraUnit[si];
  const ci = cached >= 0 && w.state.units[cached].alive ? cached : findCommander(w, si);
  if (ci < 0) return;
  const e = emitUnitEvent(w, 'speech', w.state.units[ci]);
  e.order = order;
  e.value = w.speechCount[si]++;
}

function findCommander(w: World, si: number): number {
  const s = w.state;
  for (let i = 0; i < s.unitCount; i++) {
    const u = s.units[i];
    if (u.alive && !u.inside && u.side === si && KIND_AURA_RADIUS[u.kindIndex] > 0) return i;
  }
  return -1;
}

/**
 * APCs, after movement. Not under Advance, an APC with room takes on friendly army infantry on Hold
 * standing within SPECIALS.apcBoardRadius that hold no trench slot (men in a trench stay put). Under
 * Advance a loaded APC unloads once it stops to fight, reaches its goal or comes within
 * SPECIALS.apcUnloadDistance of the enemy front: an apcUnload event, then a unitSpawned for each man.
 */
export function updateCarriers(w: World): void {
  const s = w.state;
  const units = s.units;
  for (let i = 0; i < s.unitCount; i++) {
    const apc = units[i];
    const room = KIND_CARRIES[apc.kindIndex];
    if (room <= 0 || !apc.alive || apc.inside || apc.controlled) continue;
    const side = s.sides[apc.side];
    const order = apc.behaviour === 'army' ? orderFor(side, apc.kind) : 'hold';
    if (order === 'advance') {
      if (apc.passengers <= 0) continue;
      const dir = apc.side === 0 ? 1 : -1;
      const gap = (w.front[1 - apc.side] - apc.x) * dir;
      if (apc.engaged || gap <= SPECIALS.apcUnloadDistance || apc.velX === 0) unload(w, apc);
      continue;
    }
    if (order !== 'hold' || apc.passengers >= room) continue;
    for (let j = 0; j < s.unitCount && apc.passengers < room; j++) {
      const p = units[j];
      if (!p.alive || p.inside || p.side !== apc.side || KIND_RIDES[p.kindIndex] !== 1) continue;
      if (p.behaviour !== 'army' || p.controlled || p.slot >= 0) continue;
      if (orderFor(side, p.kind) !== 'hold') continue;
      const d = p.x > apc.x ? p.x - apc.x : apc.x - p.x;
      if (d <= SPECIALS.apcBoardRadius) board(w, p, apc);
    }
  }
}

function unload(w: World, apc: UnitState): void {
  const e = emitUnitEvent(w, 'apcUnload', apc);
  e.value = dropPassengers(w, apc, false);
}
