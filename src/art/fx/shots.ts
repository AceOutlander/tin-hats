/**
 * Things that are fired: tracer streaks for each tracer type and the
 * projectile sprites. All point along +x; the renderer rotates them to the
 * direction of flight.
 */
import { FX_KEYS, type TracerLook } from '../../data/fx';
import type { SpriteSpec } from '../types';
import { dab, rgba, sprite, type Rgb } from './paint';

interface TracerArt {
  /** Sprite length and height in wu. */
  w: number;
  h: number;
  /** Thickness of the bright line. */
  line: number;
  head: Rgb;
  tail: Rgb;
  /** Opacity at the head. */
  alpha: number;
  /** Radius of the glow round the head, as a multiple of the height (at most 0.5, or the sprite edge clips it). */
  glow: number;
}

/** Rifle: thin and pale. MG: a hot orange tracer round. SMG: short and faint. Sniper: long, fine and white. */
const TRACERS: Record<TracerLook, TracerArt> = {
  rifle: { w: 46, h: 3, line: 0.9, head: [255, 240, 190], tail: [240, 200, 130], alpha: 0.9, glow: 0.5 },
  mg: { w: 62, h: 6, line: 1.3, head: [255, 232, 170], tail: [246, 128, 52], alpha: 1, glow: 0.5 },
  smg: { w: 30, h: 3, line: 0.8, head: [250, 236, 196], tail: [226, 196, 140], alpha: 0.75, glow: 0.4 },
  sniper: { w: 110, h: 4, line: 0.8, head: [255, 255, 255], tail: [206, 222, 246], alpha: 0.95, glow: 0.5 },
};

/** A streak with a bright leading end at the right edge and a tail fading to nothing. */
function paintTracer(ctx: CanvasRenderingContext2D, art: TracerArt): void {
  const cy = art.h / 2;
  const headX = art.w - art.h * 0.5;
  // Soft outer streak.
  const outer = ctx.createLinearGradient(0, 0, art.w, 0);
  outer.addColorStop(0, rgba(art.tail, 0));
  outer.addColorStop(0.6, rgba(art.tail, art.alpha * 0.28));
  outer.addColorStop(1, rgba(art.tail, art.alpha * 0.5));
  ctx.strokeStyle = outer;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.min(art.h * 0.9, art.line * 2.2);
  ctx.beginPath();
  ctx.moveTo(art.h, cy);
  ctx.lineTo(headX, cy);
  ctx.stroke();
  // Bright core.
  const core = ctx.createLinearGradient(0, 0, art.w, 0);
  core.addColorStop(0, rgba(art.tail, 0));
  core.addColorStop(0.45, rgba(art.tail, art.alpha * 0.55));
  core.addColorStop(0.85, rgba(art.head, art.alpha));
  core.addColorStop(1, rgba(art.head, art.alpha));
  ctx.strokeStyle = core;
  ctx.lineWidth = art.line;
  ctx.beginPath();
  ctx.moveTo(art.h, cy);
  ctx.lineTo(headX, cy);
  ctx.stroke();
  dab(ctx, headX, cy, art.h * art.glow, art.head, art.alpha, 0.2);
}

const OLIVE: Rgb = [74, 80, 58];
const OLIVE_DARK: Rgb = [44, 48, 36];
const OLIVE_LIGHT: Rgb = [112, 118, 88];
const STEEL: Rgb = [84, 90, 88];
const STEEL_DARK: Rgb = [46, 50, 50];
const STEEL_LIGHT: Rgb = [134, 140, 136];
const HANDLE: Rgb = [146, 114, 74];
const HANDLE_DARK: Rgb = [96, 72, 44];
const COPPER: Rgb = [176, 112, 62];
const OUTLINE: Rgb = [22, 22, 20];

/** Top-lit body fill for a horizontal cylinder or bomb. */
function bodyFill(ctx: CanvasRenderingContext2D, top: number, bottom: number, light: Rgb, mid: Rgb, dark: Rgb): void {
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  g.addColorStop(0, rgba(light, 1));
  g.addColorStop(0.4, rgba(mid, 1));
  g.addColorStop(1, rgba(dark, 1));
  ctx.fillStyle = g;
}

function outline(ctx: CanvasRenderingContext2D, width: number): void {
  ctx.strokeStyle = rgba(OUTLINE, 0.85);
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/** German stick grenade: wooden handle, steel can at the +x end. */
function paintStickGrenade(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cy = h / 2;
  bodyFill(ctx, cy - 0.9, cy + 0.9, [186, 152, 104], HANDLE, HANDLE_DARK);
  ctx.beginPath();
  ctx.rect(0.6, cy - 0.9, w * 0.62, 1.8);
  ctx.fill();
  outline(ctx, 0.4);
  // Cap on the end of the handle.
  ctx.fillStyle = rgba(STEEL_DARK, 1);
  ctx.fillRect(0.4, cy - 1.1, 1.2, 2.2);
  bodyFill(ctx, cy - h * 0.42, cy + h * 0.42, STEEL_LIGHT, STEEL, STEEL_DARK);
  ctx.beginPath();
  ctx.rect(w * 0.6, cy - h * 0.42, w * 0.36, h * 0.84);
  ctx.fill();
  outline(ctx, 0.45);
}

/** British Mills bomb: a grooved cast-iron egg with a lever and filler plug. */
function paintMillsBomb(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cx = w * 0.52;
  const cy = h * 0.54;
  const rx = w * 0.38;
  const ry = h * 0.34;
  // Lever and striker housing on top.
  ctx.fillStyle = rgba(STEEL, 1);
  ctx.fillRect(cx - 1.1, cy - ry - 1.3, 2.2, 1.6);
  ctx.strokeStyle = rgba(STEEL_LIGHT, 1);
  ctx.lineWidth = 0.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx + 0.9, cy - ry - 0.9);
  ctx.quadraticCurveTo(cx + rx * 1.05, cy - ry * 0.9, cx + rx * 0.95, cy + ry * 0.3);
  ctx.stroke();
  bodyFill(ctx, cy - ry, cy + ry, OLIVE_LIGHT, OLIVE, OLIVE_DARK);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  outline(ctx, 0.45);
  // The fragmentation grooves.
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = rgba(OLIVE_DARK, 0.9);
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  for (let i = -1; i <= 1; i++) {
    ctx.moveTo(cx + i * rx * 0.48, cy - ry);
    ctx.lineTo(cx + i * rx * 0.48, cy + ry);
  }
  ctx.moveTo(cx - rx, cy - ry * 0.3);
  ctx.lineTo(cx + rx, cy - ry * 0.3);
  ctx.moveTo(cx - rx, cy + ry * 0.35);
  ctx.lineTo(cx + rx, cy + ry * 0.35);
  ctx.stroke();
  ctx.restore();
}

/** Mortar bomb: teardrop body, nose fuse at +x, tail fins behind. */
function paintMortarBomb(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cy = h / 2;
  // Tail boom and fins.
  ctx.fillStyle = rgba(OLIVE_DARK, 1);
  ctx.fillRect(w * 0.08, cy - 0.5, w * 0.34, 1);
  ctx.beginPath();
  ctx.moveTo(w * 0.04, cy - h * 0.42);
  ctx.lineTo(w * 0.26, cy - 0.4);
  ctx.lineTo(w * 0.26, cy + 0.4);
  ctx.lineTo(w * 0.04, cy + h * 0.42);
  ctx.closePath();
  ctx.fill();
  outline(ctx, 0.35);
  bodyFill(ctx, cy - h * 0.44, cy + h * 0.44, OLIVE_LIGHT, OLIVE, OLIVE_DARK);
  ctx.beginPath();
  ctx.moveTo(w * 0.34, cy);
  ctx.bezierCurveTo(w * 0.42, cy - h * 0.62, w * 0.78, cy - h * 0.52, w * 0.94, cy);
  ctx.bezierCurveTo(w * 0.78, cy + h * 0.52, w * 0.42, cy + h * 0.62, w * 0.34, cy);
  ctx.closePath();
  ctx.fill();
  outline(ctx, 0.45);
  // Fuse.
  ctx.fillStyle = rgba(STEEL_LIGHT, 1);
  ctx.beginPath();
  ctx.arc(w * 0.92, cy, 0.9, 0, Math.PI * 2);
  ctx.fill();
}

const ROCKET_W = 34;
const ROCKET_H = 9;
/** The rocket body's centre, as a fraction of the sprite width; the flame trails behind it. */
const ROCKET_AX = 0.7;

function paintRocket(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cy = h / 2;
  const tail = w * 0.46;
  // Flame and glow behind the motor.
  dab(ctx, tail - 2, cy, h * 0.5, [246, 150, 56], 0.6, 0);
  const flame = ctx.createLinearGradient(0, 0, tail, 0);
  flame.addColorStop(0, rgba([226, 96, 34], 0));
  flame.addColorStop(0.55, rgba([246, 150, 56], 0.75));
  flame.addColorStop(0.9, rgba([255, 226, 150], 1));
  flame.addColorStop(1, rgba([255, 250, 230], 1));
  ctx.fillStyle = flame;
  ctx.beginPath();
  ctx.moveTo(tail, cy - h * 0.2);
  ctx.quadraticCurveTo(tail * 0.5, cy - h * 0.3, 0.5, cy);
  ctx.quadraticCurveTo(tail * 0.5, cy + h * 0.3, tail, cy + h * 0.2);
  ctx.closePath();
  ctx.fill();
  // Fins.
  ctx.fillStyle = rgba(STEEL_DARK, 1);
  ctx.beginPath();
  ctx.moveTo(tail - 0.5, cy - h * 0.44);
  ctx.lineTo(tail + w * 0.1, cy - h * 0.14);
  ctx.lineTo(tail + w * 0.1, cy + h * 0.14);
  ctx.lineTo(tail - 0.5, cy + h * 0.44);
  ctx.closePath();
  ctx.fill();
  outline(ctx, 0.35);
  // Motor tube and warhead.
  bodyFill(ctx, cy - h * 0.16, cy + h * 0.16, STEEL_LIGHT, STEEL, STEEL_DARK);
  ctx.beginPath();
  ctx.rect(tail, cy - h * 0.16, w * 0.3, h * 0.32);
  ctx.fill();
  outline(ctx, 0.35);
  bodyFill(ctx, cy - h * 0.3, cy + h * 0.3, OLIVE_LIGHT, OLIVE, OLIVE_DARK);
  ctx.beginPath();
  ctx.moveTo(w * 0.72, cy - h * 0.3);
  ctx.quadraticCurveTo(w * 0.92, cy - h * 0.28, w * 0.985, cy);
  ctx.quadraticCurveTo(w * 0.92, cy + h * 0.28, w * 0.72, cy + h * 0.3);
  ctx.closePath();
  ctx.fill();
  outline(ctx, 0.45);
}

/** Tank shell in flight: steel body, copper driving band, pointed nose, and a faint heat streak behind. */
function paintShell(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cy = h / 2;
  const base = w * 0.5;
  const streak = ctx.createLinearGradient(0, 0, base, 0);
  streak.addColorStop(0, rgba([255, 220, 160], 0));
  streak.addColorStop(1, rgba([255, 226, 170], 0.55));
  ctx.fillStyle = streak;
  ctx.fillRect(0, cy - h * 0.14, base, h * 0.28);
  bodyFill(ctx, cy - h * 0.34, cy + h * 0.34, STEEL_LIGHT, STEEL, STEEL_DARK);
  ctx.beginPath();
  ctx.moveTo(base, cy - h * 0.34);
  ctx.lineTo(w * 0.76, cy - h * 0.34);
  ctx.quadraticCurveTo(w * 0.92, cy - h * 0.3, w * 0.985, cy);
  ctx.quadraticCurveTo(w * 0.92, cy + h * 0.3, w * 0.76, cy + h * 0.34);
  ctx.lineTo(base, cy + h * 0.34);
  ctx.closePath();
  ctx.fill();
  outline(ctx, 0.4);
  ctx.fillStyle = rgba(COPPER, 1);
  ctx.fillRect(base + w * 0.04, cy - h * 0.34, w * 0.045, h * 0.68);
}

/** Aircraft bomb: fat body, box tail at -x, a yellow nose ring. */
function paintBomb(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cy = h / 2;
  // Tail fins and ring.
  ctx.fillStyle = rgba(STEEL_DARK, 1);
  ctx.beginPath();
  ctx.moveTo(w * 0.03, cy - h * 0.46);
  ctx.lineTo(w * 0.2, cy - h * 0.46);
  ctx.lineTo(w * 0.38, cy - h * 0.1);
  ctx.lineTo(w * 0.38, cy + h * 0.1);
  ctx.lineTo(w * 0.2, cy + h * 0.46);
  ctx.lineTo(w * 0.03, cy + h * 0.46);
  ctx.closePath();
  ctx.fill();
  outline(ctx, 0.4);
  bodyFill(ctx, cy - h * 0.4, cy + h * 0.4, [128, 134, 116], [82, 88, 74], [44, 48, 40]);
  ctx.beginPath();
  ctx.moveTo(w * 0.24, cy);
  ctx.bezierCurveTo(w * 0.34, cy - h * 0.56, w * 0.8, cy - h * 0.5, w * 0.975, cy);
  ctx.bezierCurveTo(w * 0.8, cy + h * 0.5, w * 0.34, cy + h * 0.56, w * 0.24, cy);
  ctx.closePath();
  ctx.fill();
  outline(ctx, 0.5);
  // Nose ring.
  ctx.save();
  ctx.clip();
  ctx.fillStyle = rgba([206, 176, 78], 1);
  ctx.fillRect(w * 0.8, 0, w * 0.045, h);
  ctx.restore();
}

/**
 * The anti-tank rifle's round in flight (PTRD-41, PzB 39): a hot armour-piercing tracer, a white-orange head and a long
 * fading red streak behind it. No motor, no flame, no fins (it is a bullet, not a rocket).
 */
function paintApRound(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cy = h / 2;
  const streak = ctx.createLinearGradient(0, 0, w, 0);
  streak.addColorStop(0, rgba([210, 60, 30], 0));
  streak.addColorStop(0.6, rgba([240, 110, 50], 0.7));
  streak.addColorStop(0.92, rgba([255, 214, 150], 1));
  streak.addColorStop(1, rgba([255, 248, 230], 1));
  ctx.fillStyle = streak;
  ctx.beginPath();
  ctx.moveTo(0, cy);
  ctx.lineTo(w - h * 0.5, cy - h * 0.38);
  ctx.quadraticCurveTo(w, cy - h * 0.3, w, cy);
  ctx.quadraticCurveTo(w, cy + h * 0.3, w - h * 0.5, cy + h * 0.38);
  ctx.closePath();
  ctx.fill();
  dab(ctx, w - h * 0.6, cy, h * 0.5, [255, 236, 190], 0.8, 0);
}

/** The Tank Hunters' petrol bottle in flight: a dark green bottle, the rag at its neck alight. */
function paintMolotovFlight(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cy = h / 2;
  // Flame from the rag (at +x, the neck).
  dab(ctx, w * 0.82, cy, h * 0.55, [246, 150, 56], 0.75, 0);
  dab(ctx, w * 0.86, cy, h * 0.3, [255, 226, 150], 0.9, 0);
  bodyFill(ctx, cy - h * 0.3, cy + h * 0.3, [104, 120, 82], [74, 88, 58], [44, 52, 34]);
  ctx.beginPath();
  ctx.rect(w * 0.1, cy - h * 0.3, w * 0.46, h * 0.6);
  ctx.moveTo(w * 0.56, cy - h * 0.16);
  ctx.lineTo(w * 0.7, cy - h * 0.12);
  ctx.lineTo(w * 0.7, cy + h * 0.12);
  ctx.lineTo(w * 0.56, cy + h * 0.16);
  ctx.closePath();
  ctx.fill();
  outline(ctx, 0.35);
}

export function shotSprites(): SpriteSpec[] {
  const tracerSpecs = (Object.keys(TRACERS) as TracerLook[]).map((look) => {
    const art = TRACERS[look];
    // Anchored at the head, so the sprite's position is the bullet and the streak trails behind it.
    return sprite(FX_KEYS.tracer[look], art.w, art.h, 1 - (art.h * 0.5) / art.w, 0.5, (ctx) => paintTracer(ctx, art));
  });
  return [
    ...tracerSpecs,
    sprite(FX_KEYS.projectile.stickGrenade, 17, 6, 0.5, 0.5, paintStickGrenade),
    sprite(FX_KEYS.projectile.millsBomb, 9, 9, 0.5, 0.55, paintMillsBomb),
    sprite(FX_KEYS.projectile.mortar, 17, 7, 0.6, 0.5, paintMortarBomb),
    sprite(FX_KEYS.projectile.rocket, ROCKET_W, ROCKET_H, ROCKET_AX, 0.5, paintRocket),
    sprite(FX_KEYS.projectile.shell, 22, 5, 0.75, 0.5, paintShell),
    sprite(FX_KEYS.projectile.bomb, 28, 11, 0.55, 0.5, paintBomb),
    // Anchored at the head (the round is where the sprite is; the streak trails behind).
    sprite(FX_KEYS.projectile.apRound, 26, 4, 0.92, 0.5, paintApRound),
    sprite(FX_KEYS.projectile.molotov, 13, 7, 0.4, 0.5, paintMolotovFlight),
  ];
}
