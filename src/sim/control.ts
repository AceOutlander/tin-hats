/**
 * Direct control: the player takes over one unit of their side. It ignores orders, walks with the
 * stick (the front clamp still applies), keeps its target and aim, fires while the fire button is
 * held and uses its secondary weapon on the ability button, with config.controlDamageMul and
 * config.controlReloadMul. A controlled infantryman standing still inside a trench that is not
 * enemy-held takes a free slot there. Control ends on release (the unit goes back to its orders),
 * on death (controlLost, see killUnit) or when the battle ends.
 */
import { KIND_SAPPER } from './tables';
import { claimSlot, releaseSlot } from './trenches';
import type { UnitState } from './types';
import type { World } from './world';

function clearInput(w: World, si: number): void {
  w.ctrlMove[si] = 0;
  w.ctrlFire[si] = 0;
  w.ctrlAbility[si] = 0;
}

/** Let go of the side's controlled unit, if any. It goes back to its orders on the next tick. */
export function releaseControl(w: World, si: number): void {
  const side = w.state.sides[si];
  const index = side.controlled;
  clearInput(w, si);
  if (index < 0) return;
  side.controlled = -1;
  const u = w.state.units[index];
  u.controlled = false;
  u.engaged = false;
  u.mount.trigger = true;
  u.mount2.trigger = true;
}

/** End control on both sides (the battle is over). */
export function releaseAll(w: World): void {
  releaseControl(w, 0);
  releaseControl(w, 1);
}

/**
 * Take control of the unit with unique id `id` for side `si`. Dropped unless it is a living,
 * controllable unit of that side standing on the field (sappers never are). Releases the side's
 * previous unit: one at a time.
 */
export function takeControl(w: World, si: number, id: number): void {
  const s = w.state;
  const side = s.sides[si];
  let found: UnitState | null = null;
  for (let i = 0; i < s.unitCount; i++) {
    const u = s.units[i];
    if (u.alive && u.id === id) {
      found = u;
      break;
    }
  }
  if (!found || found.side !== si || found.inside || !found.def.controllable || found.kindIndex === KIND_SAPPER) return;
  if (found.controlled) return;
  releaseControl(w, si);
  // A slot it was only walking to is given up: under control it goes nowhere on its own.
  if (found.slot >= 0 && found.trenchId < 0) releaseSlot(w, found);
  side.controlled = found.index;
  found.controlled = true;
  found.engaged = false;
}

/** Store the stick and buttons for the side's controlled unit (they stay in force until changed). */
export function setControlInput(w: World, si: number, moveX: number, fire: boolean, ability: boolean): void {
  let mx = moveX;
  if (!(mx === mx)) mx = 0; // NaN
  w.ctrlMove[si] = mx > 1 ? 1 : mx < -1 ? -1 : mx;
  w.ctrlFire[si] = fire ? 1 : 0;
  if (ability) w.ctrlAbility[si] = 1;
}

/**
 * Sense pass for a controlled unit: where it walks. Moving with the stick leaves any trench slot;
 * standing still inside a trench that is not enemy-held, an infantryman takes the nearest free slot
 * and steps onto it (updateTrenches then drops him in, with cover).
 */
export function senseControlled(w: World, u: UnitState): void {
  const s = w.state;
  const mx = w.ctrlMove[u.side];
  u.engaged = false;
  if (mx !== 0) {
    releaseSlot(w, u);
    u.goalX = mx > 0 ? s.length : 0;
    return;
  }
  if (u.slot < 0 && u.def.usesTrench) {
    const trenches = s.trenches;
    for (let t = 0; t < trenches.length; t++) {
      const trench = trenches[t];
      const d = u.x - trench.x;
      const half = w.trenchHalf[t];
      if (d < -half || d > half) continue;
      const enemyHeld = trench.owner >= 0 && trench.owner !== u.side && trench.occupants > 0;
      if (!enemyHeld && claimSlot(w, u, t)) break;
    }
  }
  u.goalX = u.slot >= 0 ? w.slotX[u.slot] : u.x;
}
