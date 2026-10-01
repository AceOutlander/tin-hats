/**
 * Bright things, meant for additive blending: explosion flash stars, muzzle
 * flashes, a round glow, hit sparks and flying sparks. Warm whites and oranges.
 */
import { FX_SPRITES } from '../../data/fx';
import type { Rng01 } from '../../fx/rng';
import type { SpriteSpec } from '../types';
import { dab, rgba, sprite, TAU, type Rgb } from './paint';

const HOT: Rgb = [255, 246, 214];
const WARM: Rgb = [255, 206, 112];
const ORANGE: Rgb = [246, 150, 56];
const EMBER: Rgb = [226, 96, 34];

/** A thin spike from (cx, cy) outward. The caller sets the fill. */
function spike(ctx: CanvasRenderingContext2D, cx: number, cy: number, angle: number, length: number, halfWidth: number): void {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  ctx.beginPath();
  ctx.moveTo(cx - sin * halfWidth, cy + cos * halfWidth);
  ctx.lineTo(cx + cos * length, cy + sin * length);
  ctx.lineTo(cx + sin * halfWidth, cy - cos * halfWidth);
  ctx.closePath();
  ctx.fill();
}

/** Explosion flash: a hot centre with uneven spikes. */
function paintFlashStar(ctx: CanvasRenderingContext2D, w: number, _h: number, rng: Rng01): void {
  const c = w / 2;
  const R = w / 2;
  dab(ctx, c, c, R * 0.95, ORANGE, 0.34, 0);
  dab(ctx, c, c, R * 0.62, WARM, 0.6, 0.1);
  const g = ctx.createRadialGradient(c, c, 0, c, c, R);
  g.addColorStop(0, rgba(HOT, 1));
  g.addColorStop(0.35, rgba(WARM, 0.85));
  g.addColorStop(0.8, rgba(ORANGE, 0.3));
  g.addColorStop(1, rgba(ORANGE, 0));
  ctx.fillStyle = g;
  const spikes = 9 + Math.floor(rng() * 4);
  const turn = rng() * TAU;
  for (let i = 0; i < spikes; i++) {
    const a = turn + ((i + (rng() - 0.5) * 0.7) / spikes) * TAU;
    const long = rng() < 0.4;
    spike(ctx, c, c, a, R * (long ? 0.8 + 0.2 * rng() : 0.45 + 0.25 * rng()), R * (0.07 + 0.07 * rng()));
  }
  dab(ctx, c, c, R * 0.36, HOT, 1, 0.45);
}

const MUZZLE_W = 30;
const MUZZLE_H = 16;
/** The muzzle sits here (fraction of the width); the flash points along +x. */
const MUZZLE_AX = 0.14;

function paintMuzzle(ctx: CanvasRenderingContext2D, w: number, h: number, rng: Rng01): void {
  const mx = w * MUZZLE_AX;
  const cy = h / 2;
  const reach = w * (0.78 + 0.07 * rng());
  dab(ctx, mx + w * 0.16, cy, h * 0.5, ORANGE, 0.45, 0);
  const g = ctx.createLinearGradient(mx, 0, mx + reach, 0);
  g.addColorStop(0, rgba(HOT, 1));
  g.addColorStop(0.3, rgba(WARM, 0.95));
  g.addColorStop(0.7, rgba(ORANGE, 0.6));
  g.addColorStop(1, rgba(EMBER, 0));
  ctx.fillStyle = g;
  // Main tongue: fat near the muzzle, pointed at the tip.
  const fat = h * (0.2 + 0.05 * rng());
  ctx.beginPath();
  ctx.moveTo(mx, cy);
  ctx.quadraticCurveTo(mx + reach * 0.22, cy - fat * 1.5, mx + reach * 0.45, cy - fat * 0.6);
  ctx.lineTo(mx + reach, cy + (rng() - 0.5) * h * 0.08);
  ctx.lineTo(mx + reach * 0.45, cy + fat * 0.6);
  ctx.quadraticCurveTo(mx + reach * 0.22, cy + fat * 1.5, mx, cy);
  ctx.closePath();
  ctx.fill();
  // Side jets from the gas escaping round the muzzle.
  const side = 0.55 + 0.25 * rng();
  spike(ctx, mx + w * 0.03, cy, -side, w * (0.3 + 0.1 * rng()), h * 0.07);
  spike(ctx, mx + w * 0.03, cy, side * (0.85 + 0.3 * rng()), w * (0.3 + 0.1 * rng()), h * 0.07);
  if (rng() < 0.6) spike(ctx, mx + w * 0.03, cy, (rng() - 0.5) * 0.5, w * 0.6, h * 0.05);
  dab(ctx, mx + w * 0.08, cy, h * 0.26, HOT, 1, 0.3);
}

function paintGlow(ctx: CanvasRenderingContext2D, w: number): void {
  const c = w / 2;
  dab(ctx, c, c, w / 2, ORANGE, 0.5, 0);
  dab(ctx, c, c, w * 0.34, WARM, 0.6, 0);
  dab(ctx, c, c, w * 0.16, HOT, 0.7, 0);
}

/** A small crisp star where a round hits metal. */
function paintHitSpark(ctx: CanvasRenderingContext2D, w: number, _h: number, rng: Rng01): void {
  const c = w / 2;
  const R = w / 2;
  dab(ctx, c, c, R * 0.8, WARM, 0.5, 0);
  const g = ctx.createRadialGradient(c, c, 0, c, c, R);
  g.addColorStop(0, rgba([255, 255, 244], 1));
  g.addColorStop(0.5, rgba(WARM, 0.8));
  g.addColorStop(1, rgba(ORANGE, 0));
  ctx.fillStyle = g;
  const spikes = 5 + Math.floor(rng() * 3);
  const turn = rng() * TAU;
  for (let i = 0; i < spikes; i++) {
    const a = turn + ((i + (rng() - 0.5) * 0.6) / spikes) * TAU;
    spike(ctx, c, c, a, R * (0.6 + 0.4 * rng()), R * 0.09);
  }
  dab(ctx, c, c, R * 0.3, [255, 255, 244], 1, 0.4);
}

/** A spark in flight: a short hot streak with the bright end leading (+x). */
function paintSparkStreak(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cy = h / 2;
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, rgba(EMBER, 0));
  g.addColorStop(0.55, rgba(ORANGE, 0.8));
  g.addColorStop(0.9, rgba(HOT, 1));
  g.addColorStop(1, rgba(HOT, 0.9));
  ctx.strokeStyle = g;
  ctx.lineCap = 'round';
  ctx.lineWidth = h * 0.42;
  ctx.beginPath();
  ctx.moveTo(h * 0.3, cy);
  ctx.lineTo(w - h * 0.35, cy);
  ctx.stroke();
  dab(ctx, w - h * 0.5, cy, h * 0.5, HOT, 0.9, 0.2);
}

function paintEmber(ctx: CanvasRenderingContext2D, w: number): void {
  const c = w / 2;
  dab(ctx, c, c, w / 2, ORANGE, 0.7, 0);
  dab(ctx, c, c, w * 0.26, HOT, 1, 0.3);
}

export function flashSprites(): SpriteSpec[] {
  return [
    ...FX_SPRITES.flash.map((key) => sprite(key, 96, 96, 0.5, 0.5, paintFlashStar)),
    ...FX_SPRITES.muzzle.map((key) => sprite(key, MUZZLE_W, MUZZLE_H, MUZZLE_AX, 0.5, paintMuzzle)),
    ...FX_SPRITES.glow.map((key) => sprite(key, 64, 64, 0.5, 0.5, paintGlow)),
    ...FX_SPRITES.hitSpark.map((key) => sprite(key, 22, 22, 0.5, 0.5, paintHitSpark)),
    sprite(FX_SPRITES.spark[0], 14, 3, 0.5, 0.5, paintSparkStreak),
    sprite(FX_SPRITES.spark[1], 6, 6, 0.5, 0.5, paintEmber),
  ];
}
