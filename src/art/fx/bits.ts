/**
 * Solid bits that fly: dirt clods and plumes, concrete chunks, wood splinters,
 * cloth scraps, wire, spent cases, water droplets and the rain splash ring.
 */
import { FX_SPRITES } from '../../data/fx';
import type { Rng01 } from '../../fx/rng';
import type { SpriteSpec } from '../types';
import { chunkPath, dab, mix, rgba, sprite, TAU, type Rgb } from './paint';

const EARTH: Rgb = [74, 59, 42];
const EARTH_DARK: Rgb = [44, 35, 26];
const EARTH_LIGHT: Rgb = [112, 92, 66];

const CONCRETE: Rgb = [122, 118, 110];
const CONCRETE_DARK: Rgb = [70, 67, 63];
const CONCRETE_LIGHT: Rgb = [156, 152, 142];

const WOOD: Rgb = [140, 108, 68];
const WOOD_DARK: Rgb = [88, 66, 40];
const WOOD_LIGHT: Rgb = [182, 150, 104];

const IRON: Rgb = [52, 48, 46];
const BRASS: Rgb = [200, 162, 76];
const BRASS_DARK: Rgb = [118, 92, 38];
const BRASS_LIGHT: Rgb = [240, 214, 140];

const WATER: Rgb = [208, 222, 232];
const WATER_LIGHT: Rgb = [244, 249, 252];

/** Muted kit colours so a hit reads the same on either side: khaki, field grey, webbing. */
const CLOTH: readonly Rgb[] = [
  [124, 112, 78],
  [96, 104, 98],
  [156, 144, 110],
];

function paintClod(ctx: CanvasRenderingContext2D, w: number, h: number, rng: Rng01): void {
  const cx = w / 2;
  const cy = h / 2;
  chunkPath(ctx, cx, cy, w * 0.46, h * 0.46, 6 + Math.floor(rng() * 2), 0.35, rng);
  ctx.fillStyle = rgba(mix(EARTH, EARTH_DARK, rng() * 0.6), 1);
  ctx.fill();
  // A lit upper face.
  chunkPath(ctx, cx - w * 0.08, cy - h * 0.1, w * 0.24, h * 0.2, 5, 0.3, rng);
  ctx.fillStyle = rgba(EARTH_LIGHT, 0.6);
  ctx.fill();
}

/** A jet of thrown earth, densest at the leading (+x) end. */
function paintPlume(ctx: CanvasRenderingContext2D, w: number, h: number, rng: Rng01): void {
  const cy = h / 2;
  const steps = 9;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const r = h * (0.16 + 0.3 * t);
    const x = r + (w - 2 * r) * t;
    const y = cy + (rng() - 0.5) * h * 0.14;
    dab(ctx, x, y, r, mix(EARTH_DARK, EARTH, rng() * 0.7), 0.25 + 0.5 * t, 0.3);
  }
  // Clods riding in the jet.
  for (let i = 0; i < 7; i++) {
    const t = 0.3 + 0.65 * rng();
    const x = w * t;
    const y = cy + (rng() - 0.5) * h * 0.45 * t;
    chunkPath(ctx, x, y, h * 0.09, h * 0.08, 5, 0.4, rng);
    ctx.fillStyle = rgba(EARTH_DARK, 0.9);
    ctx.fill();
  }
}

function paintDebris(ctx: CanvasRenderingContext2D, w: number, h: number, rng: Rng01): void {
  const cx = w / 2;
  const cy = h / 2;
  chunkPath(ctx, cx, cy, w * 0.47, h * (0.4 + 0.07 * rng()), 5 + Math.floor(rng() * 2), 0.28, rng);
  ctx.fillStyle = rgba(CONCRETE, 1);
  ctx.fill();
  ctx.clip();
  // A shadowed face below a slanting break line, and a lit corner: a solid block, not an outline.
  ctx.fillStyle = rgba(CONCRETE_DARK, 0.9);
  ctx.beginPath();
  ctx.moveTo(0, cy + h * (rng() - 0.5) * 0.3);
  ctx.lineTo(w, cy + h * (rng() - 0.5) * 0.3);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rgba(CONCRETE_LIGHT, 0.75);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(w * (0.5 + 0.3 * rng()), 0);
  ctx.lineTo(0, h * (0.35 + 0.2 * rng()));
  ctx.closePath();
  ctx.fill();
}

function paintSplinter(ctx: CanvasRenderingContext2D, w: number, h: number, rng: Rng01): void {
  const cy = h / 2;
  const top = cy - h * (0.28 + 0.12 * rng());
  const bottom = cy + h * (0.28 + 0.12 * rng());
  ctx.beginPath();
  ctx.moveTo(w * 0.02, cy + (rng() - 0.5) * h * 0.3);
  ctx.lineTo(w * (0.2 + 0.1 * rng()), top);
  ctx.lineTo(w * (0.72 + 0.1 * rng()), top + h * 0.1 * rng());
  ctx.lineTo(w * 0.98, cy + (rng() - 0.5) * h * 0.4);
  ctx.lineTo(w * (0.7 + 0.1 * rng()), bottom);
  ctx.lineTo(w * (0.22 + 0.1 * rng()), bottom - h * 0.1 * rng());
  ctx.closePath();
  ctx.fillStyle = rgba(WOOD, 1);
  ctx.fill();
  ctx.lineCap = 'round';
  ctx.lineWidth = h * 0.16;
  ctx.strokeStyle = rgba(WOOD_DARK, 0.9);
  ctx.beginPath();
  ctx.moveTo(w * 0.18, cy + h * 0.14);
  ctx.lineTo(w * 0.82, cy + h * 0.1);
  ctx.stroke();
  ctx.strokeStyle = rgba(WOOD_LIGHT, 0.9);
  ctx.beginPath();
  ctx.moveTo(w * 0.24, cy - h * 0.16);
  ctx.lineTo(w * 0.7, cy - h * 0.14);
  ctx.stroke();
}

function paintCloth(ctx: CanvasRenderingContext2D, w: number, h: number, rng: Rng01, colour: Rgb): void {
  const cx = w / 2;
  const cy = h / 2;
  chunkPath(ctx, cx, cy, w * 0.47, h * 0.45, 7, 0.45, rng);
  ctx.fillStyle = rgba(colour, 1);
  ctx.fill();
  // A fold.
  ctx.strokeStyle = rgba(mix(colour, [0, 0, 0], 0.45), 0.8);
  ctx.lineWidth = 0.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.2, cy + h * 0.05);
  ctx.quadraticCurveTo(cx, cy - h * 0.15, cx + w * 0.2, cy + h * 0.1);
  ctx.stroke();
}

/** A snapped length of barbed wire: a springy curl with barbs. */
function paintWire(ctx: CanvasRenderingContext2D, w: number, h: number, rng: Rng01): void {
  const cy = h / 2;
  ctx.strokeStyle = rgba(IRON, 1);
  ctx.lineCap = 'round';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(w * 0.04, cy + (rng() - 0.5) * h * 0.4);
  ctx.bezierCurveTo(w * 0.3, cy - h * 0.6, w * 0.55, cy + h * 0.6, w * 0.96, cy + (rng() - 0.5) * h * 0.5);
  ctx.stroke();
  ctx.lineWidth = 0.6;
  for (let i = 0; i < 3; i++) {
    const x = w * (0.2 + 0.3 * i + 0.06 * rng());
    const y = cy + (i === 1 ? h * 0.02 : i === 0 ? -h * 0.14 : h * 0.12);
    ctx.beginPath();
    ctx.moveTo(x - 1, y - 1.1);
    ctx.lineTo(x + 1, y + 1.1);
    ctx.moveTo(x + 1, y - 1.1);
    ctx.lineTo(x - 1, y + 1.1);
    ctx.stroke();
  }
}

function paintCasing(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const top = h * 0.14;
  const bodyH = h * 0.72;
  const g = ctx.createLinearGradient(0, top, 0, top + bodyH);
  g.addColorStop(0, rgba(BRASS_LIGHT, 1));
  g.addColorStop(0.45, rgba(BRASS, 1));
  g.addColorStop(1, rgba(BRASS_DARK, 1));
  ctx.fillStyle = g;
  ctx.fillRect(w * 0.06, top, w * 0.88, bodyH);
  // Rim at the base, open mouth at the other end.
  ctx.fillStyle = rgba(BRASS_DARK, 1);
  ctx.fillRect(w * 0.02, h * 0.04, w * 0.12, h * 0.92);
  ctx.fillStyle = rgba([40, 32, 20], 0.85);
  ctx.fillRect(w * 0.9, top + bodyH * 0.15, w * 0.06, bodyH * 0.7);
}

/** A flying drop, stretched along its motion (+x). */
function paintDroplet(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cy = h / 2;
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, rgba(WATER, 0));
  g.addColorStop(0.6, rgba(WATER, 0.75));
  g.addColorStop(1, rgba(WATER_LIGHT, 0.95));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(w * 0.02, cy);
  ctx.quadraticCurveTo(w * 0.6, cy - h * 0.55, w * 0.98, cy);
  ctx.quadraticCurveTo(w * 0.6, cy + h * 0.55, w * 0.02, cy);
  ctx.closePath();
  ctx.fill();
}

const SPLASH_W = 16;
const SPLASH_H = 9;
/** The ring sits on the ground this far down the sprite. */
const SPLASH_AY = 0.78;

/** One frame of a raindrop's splash: a little crown that opens into a flat ring. */
function paintRainSplash(ctx: CanvasRenderingContext2D, w: number, h: number, frame: number, frames: number): void {
  const t = frame / (frames - 1);
  const cx = w / 2;
  const gy = h * SPLASH_AY;
  const rx = w * (0.14 + 0.32 * t);
  const ry = rx * 0.28;
  ctx.lineCap = 'round';
  ctx.strokeStyle = rgba(WATER, 0.9 - 0.4 * t);
  ctx.lineWidth = 1.2 - 0.4 * t;
  ctx.beginPath();
  ctx.ellipse(cx, gy, rx, ry, 0, 0, TAU);
  ctx.stroke();
  // The crown: short strokes leaping up and out, flattening as the ring opens.
  const leap = h * 0.6 * (1 - t * 0.85);
  if (leap > 0.6) {
    ctx.strokeStyle = rgba(WATER_LIGHT, 0.95 - 0.4 * t);
    ctx.lineWidth = 1.1;
    for (let i = -1; i <= 1; i++) {
      const lean = i * (0.45 + 0.5 * t);
      ctx.beginPath();
      ctx.moveTo(cx + i * rx * 0.55, gy - ry * 0.4);
      ctx.lineTo(cx + i * rx * 0.55 + lean * leap, gy - leap * (i === 0 ? 1 : 0.7));
      ctx.stroke();
    }
  }
}

export function bitSprites(): SpriteSpec[] {
  const splashFrames = FX_SPRITES.rainSplash.length;
  return [
    ...FX_SPRITES.dirt.map((key, i) => sprite(key, 7 + i, 6 + (i % 2) * 2, 0.5, 0.5, paintClod)),
    ...FX_SPRITES.plume.map((key) => sprite(key, 56, 20, 0.5, 0.5, paintPlume)),
    ...FX_SPRITES.debris.map((key, i) => sprite(key, 10 + i * 2, 9 + (i % 2) * 3, 0.5, 0.5, paintDebris)),
    ...FX_SPRITES.splinter.map((key, i) => sprite(key, 12 + i * 3, 4 + (i % 2), 0.5, 0.5, paintSplinter)),
    ...FX_SPRITES.cloth.map((key, i) =>
      sprite(key, 9, 7, 0.5, 0.5, (ctx, w, h, rng) => paintCloth(ctx, w, h, rng, CLOTH[i % CLOTH.length])),
    ),
    ...FX_SPRITES.wire.map((key, i) => sprite(key, 14 + i * 5, 6, 0.5, 0.5, paintWire)),
    // Sizes are kept to half-wu steps so they land on whole pixels at the 2x texture scale.
    sprite(FX_SPRITES.casing[0], 5, 2.5, 0.5, 0.5, paintCasing),
    sprite(FX_SPRITES.casing[1], 13, 4.5, 0.5, 0.5, paintCasing),
    sprite(FX_SPRITES.droplet[0], 6, 2.5, 0.5, 0.5, paintDroplet),
    sprite(FX_SPRITES.droplet[1], 9, 3.5, 0.5, 0.5, paintDroplet),
    ...FX_SPRITES.rainSplash.map((key, frame) =>
      sprite(key, SPLASH_W, SPLASH_H, 0.5, SPLASH_AY, (ctx, w, h) => paintRainSplash(ctx, w, h, frame, splashFrames)),
    ),
  ];
}
