/**
 * Small Canvas 2D helpers shared by the effect sprites. Everything is drawn in
 * world units; shapes are seeded so the same sprite is identical on every run.
 */
import { createRng, type Rng01 } from '../../fx/rng';
import type { SpriteSpec } from '../types';

export type Rgb = readonly [number, number, number];

export const TAU = Math.PI * 2;

export function rgba(c: Rgb, alpha: number): string {
  return `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${alpha.toFixed(3)})`;
}

export function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Colour at `t` (0..1) along a list of evenly spaced stops. */
export function ramp(stops: readonly Rgb[], t: number): Rgb {
  const clamped = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(clamped));
  return mix(stops[i], stops[i + 1], clamped - i);
}

function hashKey(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Build a SpriteSpec whose painter gets a random source seeded from the key,
 * and whose context state is restored afterwards.
 */
export function sprite(
  key: string,
  w: number,
  h: number,
  ax: number,
  ay: number,
  paint: (ctx: CanvasRenderingContext2D, w: number, h: number, rng: Rng01) => void,
): SpriteSpec {
  const seed = hashKey(key);
  return {
    key,
    w,
    h,
    ax,
    ay,
    draw(ctx: CanvasRenderingContext2D): void {
      ctx.save();
      paint(ctx, w, h, createRng(seed));
      ctx.restore();
    },
  };
}

/**
 * A soft round dab of colour that fades to nothing at radius r.
 * `core` (0..1) is how far out the dab stays near full strength: 0 is a pure
 * glow, 0.6 is a puff with a readable edge.
 */
export function dab(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  colour: Rgb,
  alpha: number,
  core = 0,
): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(colour, alpha));
  if (core > 0) g.addColorStop(core, rgba(colour, alpha * 0.92));
  g.addColorStop(core + (1 - core) * 0.55, rgba(colour, alpha * 0.34));
  g.addColorStop(1, rgba(colour, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

/** A closed lumpy polygon around (cx, cy): `points` vertices at radius r scaled by a random 1-rough..1. */
export function chunkPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  points: number,
  rough: number,
  rng: Rng01,
): void {
  const turn = rng() * TAU;
  ctx.beginPath();
  for (let i = 0; i < points; i++) {
    const a = turn + ((i + (rng() - 0.5) * 0.5) / points) * TAU;
    const k = 1 - rough * rng();
    const x = cx + Math.cos(a) * rx * k;
    const y = cy + Math.sin(a) * ry * k;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}
