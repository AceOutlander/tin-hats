/**
 * Rain streaks, battlefield markers (call-in reticle, selection ring, order
 * marker) and ground decals (craters, scorch).
 */
import { FX_KEYS } from '../../data/fx';
import type { Rng01 } from '../../fx/rng';
import type { SpriteSpec } from '../types';
import { chunkPath, dab, rgba, sprite, TAU, type Rgb } from './paint';

const RAIN: Rgb = [206, 220, 234];

/** A vertical streak, brightest at the bottom (the leading end). The renderer leans it with rotation. */
function paintRainStreak(ctx: CanvasRenderingContext2D, w: number, h: number, line: number, alpha: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, rgba(RAIN, 0));
  g.addColorStop(0.7, rgba(RAIN, alpha * 0.7));
  g.addColorStop(1, rgba(RAIN, alpha));
  ctx.strokeStyle = g;
  ctx.lineCap = 'round';
  ctx.lineWidth = line;
  ctx.beginPath();
  ctx.moveTo(w / 2, line);
  ctx.lineTo(w / 2, h - line);
  ctx.stroke();
}

const MARK_RED: Rgb = [222, 78, 44];
const MARK_RED_LIGHT: Rgb = [255, 170, 120];
const MARK_GOLD: Rgb = [255, 220, 120];
const MARK_GOLD_LIGHT: Rgb = [255, 246, 204];
const MARK_DARK: Rgb = [24, 20, 16];

/** Stroke the current path twice: a dark under-stroke for contrast on any ground, then the colour. */
function inked(ctx: CanvasRenderingContext2D, colour: Rgb, width: number, alpha = 1): void {
  ctx.strokeStyle = rgba(MARK_DARK, 0.55 * alpha);
  ctx.lineWidth = width + 1.4;
  ctx.stroke();
  ctx.strokeStyle = rgba(colour, alpha);
  ctx.lineWidth = width;
  ctx.stroke();
}

const RETICLE_W = 128;
const RETICLE_H = 40;

/**
 * Call-in targeting reticle: a circle lying on the ground, seen from the side,
 * with a dashed outer ring, cross ticks and a centre pip. Scale x to the
 * support's spread.
 */
function paintReticle(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cx = w / 2;
  const cy = h / 2;
  const rx = w / 2 - 3;
  const ry = h / 2 - 3;
  ctx.lineCap = 'round';
  // Faint fill so the target area reads at a glance.
  ctx.fillStyle = rgba(MARK_RED, 0.12);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
  ctx.fill();
  ctx.setLineDash([7, 5]);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
  inked(ctx, MARK_RED, 2);
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.5, ry * 0.5, 0, 0, TAU);
  inked(ctx, MARK_RED_LIGHT, 1.3, 0.9);
  // Cross ticks, pointing in from the rim.
  ctx.beginPath();
  ctx.moveTo(cx - rx, cy);
  ctx.lineTo(cx - rx * 0.68, cy);
  ctx.moveTo(cx + rx, cy);
  ctx.lineTo(cx + rx * 0.68, cy);
  ctx.moveTo(cx, cy - ry);
  ctx.lineTo(cx, cy - ry * 0.62);
  ctx.moveTo(cx, cy + ry);
  ctx.lineTo(cx, cy + ry * 0.62);
  inked(ctx, MARK_RED, 2);
  ctx.beginPath();
  ctx.ellipse(cx, cy, 3.2, 1.6, 0, 0, TAU);
  ctx.fillStyle = rgba(MARK_DARK, 0.6);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, cy, 2.4, 1.1, 0, 0, TAU);
  ctx.fillStyle = rgba(MARK_RED_LIGHT, 1);
  ctx.fill();
}

const RING_W = 60;
const RING_H = 20;

/**
 * Selection ring for the unit under direct control: a glowing gold ellipse on
 * the ground at its feet, heavier at the front, with a notch at each end.
 */
function paintSelectRing(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cx = w / 2;
  const cy = h / 2;
  const rx = w / 2 - 4;
  const ry = h / 2 - 4;
  ctx.lineCap = 'round';
  // Glow.
  ctx.strokeStyle = rgba(MARK_GOLD, 0.22);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
  ctx.stroke();
  // Far half thin, near half thick: reads as a ring lying flat.
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, TAU);
  inked(ctx, MARK_GOLD, 1.2, 0.85);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI);
  inked(ctx, MARK_GOLD_LIGHT, 2.2);
  // End notches.
  ctx.beginPath();
  ctx.moveTo(cx - rx - 3, cy);
  ctx.lineTo(cx - rx + 3, cy);
  ctx.moveTo(cx + rx - 3, cy);
  ctx.lineTo(cx + rx + 3, cy);
  inked(ctx, MARK_GOLD_LIGHT, 1.8);
}

const ORDER_W = 26;
const ORDER_H = 34;

/**
 * Order marker: a bold double chevron pointing down at a spot on the ground
 * (the hold line, a rally point, a target). Anchored at its tip.
 */
function paintOrderMarker(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cx = w / 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const chevron = (top: number, half: number, drop: number): void => {
    ctx.beginPath();
    ctx.moveTo(cx - half, top);
    ctx.lineTo(cx, top + drop);
    ctx.lineTo(cx + half, top);
  };
  chevron(h * 0.1, w * 0.36, h * 0.34);
  inked(ctx, MARK_GOLD, 3.2, 0.8);
  chevron(h * 0.46, w * 0.36, h * 0.38);
  inked(ctx, MARK_GOLD_LIGHT, 3.6);
  // Ground pip under the tip.
  ctx.beginPath();
  ctx.ellipse(cx, h - 2.2, 4.4, 1.5, 0, 0, TAU);
  ctx.fillStyle = rgba(MARK_DARK, 0.45);
  ctx.fill();
}

const CRATER_DARK: Rgb = [30, 24, 18];
const CRATER_RIM: Rgb = [118, 98, 70];
const SCORCH: Rgb = [20, 17, 14];

/** A shell hole seen from the side: dark bowl, a pale rim of thrown earth on the far edge, clods around. */
function paintCrater(ctx: CanvasRenderingContext2D, w: number, h: number, rng: Rng01): void {
  const cx = w / 2;
  const cy = h * 0.52;
  // Scorched surround, flattened onto the ground.
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, h / w);
  dab(ctx, 0, 0, w * 0.5, SCORCH, 0.55, 0.3);
  ctx.restore();
  // Far rim.
  ctx.strokeStyle = rgba(CRATER_RIM, 0.75);
  ctx.lineWidth = h * 0.09;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.ellipse(cx, cy, w * 0.3, h * 0.26, 0, Math.PI * 1.06, Math.PI * 1.94);
  ctx.stroke();
  // Bowl.
  ctx.fillStyle = rgba(CRATER_DARK, 0.9);
  ctx.beginPath();
  ctx.ellipse(cx, cy + h * 0.03, w * 0.28, h * 0.22, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = rgba([0, 0, 0], 0.35);
  ctx.beginPath();
  ctx.ellipse(cx + w * 0.02, cy - h * 0.02, w * 0.2, h * 0.12, 0, 0, TAU);
  ctx.fill();
  // Thrown clods.
  for (let i = 0; i < 14; i++) {
    const a = rng() * TAU;
    const d = 0.32 + 0.16 * rng();
    const size = h * (0.04 + 0.05 * rng());
    chunkPath(ctx, cx + Math.cos(a) * w * d, cy + Math.sin(a) * h * d * 0.9, size * 1.3, size, 5, 0.4, rng);
    ctx.fillStyle = rgba(rng() < 0.5 ? CRATER_DARK : CRATER_RIM, 0.8);
    ctx.fill();
  }
}

function paintScorch(ctx: CanvasRenderingContext2D, w: number, h: number, rng: Rng01): void {
  ctx.translate(w / 2, h / 2);
  ctx.scale(1, h / w);
  dab(ctx, 0, 0, w * 0.5, SCORCH, 0.5, 0.2);
  for (let i = 0; i < 6; i++) {
    const a = rng() * TAU;
    const d = w * 0.22 * rng();
    dab(ctx, Math.cos(a) * d, Math.sin(a) * d, w * (0.12 + 0.1 * rng()), SCORCH, 0.35, 0.2);
  }
}

export function markSprites(): SpriteSpec[] {
  return [
    sprite(FX_KEYS.rain.far, 2, 18, 0.5, 0.5, (ctx, w, h) => paintRainStreak(ctx, w, h, 0.7, 0.7)),
    sprite(FX_KEYS.rain.near, 3, 30, 0.5, 0.5, (ctx, w, h) => paintRainStreak(ctx, w, h, 1.1, 0.85)),
    sprite(FX_KEYS.ui.reticle, RETICLE_W, RETICLE_H, 0.5, 0.5, paintReticle),
    sprite(FX_KEYS.ui.selectRing, RING_W, RING_H, 0.5, 0.5, paintSelectRing),
    sprite(FX_KEYS.ui.orderMarker, ORDER_W, ORDER_H, 0.5, 1 - 2.2 / ORDER_H, paintOrderMarker),
    sprite(FX_KEYS.decal.crater[0], 72, 20, 0.5, 0.5, paintCrater),
    sprite(FX_KEYS.decal.crater[1], 104, 28, 0.5, 0.5, paintCrater),
    sprite(FX_KEYS.decal.scorch, 80, 22, 0.5, 0.5, paintScorch),
  ];
}
