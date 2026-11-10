/**
 * Pure maths of the new units' and call-ins' effects (no Phaser, so it can be unit tested): speech line choice,
 * show/fade timing, and where a call-in plane is on its pass.
 */
import type { PlaneKind } from '../../data/artLayout';
import { RENDER } from '../../data/render';
import type { FactionId, Order } from '../../data/schema';
import { SPEECH } from '../../data/speech';

const P = RENDER.planes;

export function isPlaneKind(kind: string | null | undefined): kind is PlaneKind {
  return kind === 'bomber' || kind === 'fighter' || kind === 'recon';
}

/** Where a pass is after `age` s: straight and level from x0 to x1 over `dur` s (and on past x1 beyond it). */
export function planePassX(x0: number, x1: number, dur: number, age: number): number {
  const d = dur > 0 ? dur : 1;
  return x0 + ((x1 - x0) * age) / d;
}

/** Height (wu above the ground) of a plane of this kind on an altitude row. */
export function planeAltitude(kind: PlaneKind, row: number): number {
  return (P.altitude[kind] ?? 200) + Math.max(0, row) * P.rowStep;
}

/** Seconds a pass takes: the event's own time, else its distance at the type's speed. */
export function planePassTime(kind: PlaneKind, x0: number, x1: number, value: number): number {
  if (value > 0) return value;
  return Math.abs(x1 - x0) / Math.max(1, P.speed[kind] ?? 400);
}

/** The order a speech event names, from the contract's number (0 fallBack, 1 hold, 2 advance) or the order itself. */
export function speechOrder(order: Order | number | null | undefined): Order {
  if (order === 'fallBack' || order === 0) return 'fallBack';
  if (order === 'hold' || order === 1) return 'hold';
  return 'advance';
}

/** The line a commander of `faction` shouts for `order` with line seed `seed` (SPEECH[faction][order][seed % n]). */
export function speechLine(faction: FactionId, order: Order, seed: number): { index: number; text: string } {
  const lines = SPEECH[faction][order];
  const n = lines.length;
  const s = Number.isFinite(seed) ? Math.abs(Math.floor(seed)) : 0;
  const index = n > 0 ? s % n : 0;
  return { index, text: n > 0 ? lines[index] : '' };
}

/** Opacity of a bubble or banner `age` s into a show of `time` s with fade-in and fade-out times. */
export function showAlpha(age: number, time: number, fadeIn: number, fadeOut: number): number {
  if (age < 0 || age >= time) return 0;
  if (fadeIn > 0 && age < fadeIn) return age / fadeIn;
  const left = time - age;
  if (fadeOut > 0 && left < fadeOut) return left / fadeOut;
  return 1;
}

/**
 * Peak opacity of the target marker over a call-in or barrage fired by `side` when the player commands `playerSide`:
 * a faint one for the player's own, none (0) for the enemy's, whose whistles are the only warning (owner, 2026-11-09).
 */
export function targetMarkerPeak(side: number, playerSide: number): number {
  return side === playerSide ? RENDER.fx.flight.ownMarkerPeak : 0;
}
