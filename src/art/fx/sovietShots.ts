/**
 * Soviet projectile sprites, pointing along +x like ./shots: the F-1 grenade tumbling through the air and the
 * Katyusha's M-13 rocket (a long slender motor with four fins and a blunt warhead, a long flame behind it; the
 * salvo's smoke streaks are the katyushaTrail preset).
 */
import { FX_KEYS } from '../../data/fx';
import type { SpriteSpec } from '../types';
import { dab, rgba, sprite, type Rgb } from './paint';

const GREEN: Rgb = [62, 72, 50];
const GREEN_DARK: Rgb = [36, 42, 30];
const GREEN_LIGHT: Rgb = [100, 112, 80];
const STEEL: Rgb = [84, 90, 88];
const STEEL_DARK: Rgb = [46, 50, 50];
const STEEL_LIGHT: Rgb = [134, 140, 136];
const OUTLINE: Rgb = [22, 22, 20];

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

/** F-1: a ribbed egg, the fuse at its +x end with the lever along the top. */
function paintF1Grenade(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cx = w * 0.44;
  const cy = h * 0.52;
  const rx = w * 0.34;
  const ry = h * 0.36;
  ctx.fillStyle = rgba(STEEL, 1);
  ctx.fillRect(cx + rx - 0.6, cy - 1.1, 2.4, 2.2);
  ctx.strokeStyle = rgba(STEEL_LIGHT, 1);
  ctx.lineWidth = 0.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx + rx + 1.6, cy - 1.0);
  ctx.quadraticCurveTo(cx + rx * 0.4, cy - ry * 1.15, cx - rx * 0.3, cy - ry * 0.9);
  ctx.stroke();
  bodyFill(ctx, cy - ry, cy + ry, GREEN_LIGHT, GREEN, GREEN_DARK);
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  outline(ctx, 0.45);
  // The deep fragmentation grid.
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = rgba(GREEN_DARK, 0.95);
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  for (let i = -1; i <= 1; i++) {
    ctx.moveTo(cx + i * rx * 0.5, cy - ry);
    ctx.lineTo(cx + i * rx * 0.5, cy + ry);
  }
  for (const k of [-0.45, 0.45]) {
    ctx.moveTo(cx - rx, cy + k * ry);
    ctx.lineTo(cx + rx, cy + k * ry);
  }
  ctx.stroke();
  ctx.restore();
}

const M13_W = 50;
const M13_H = 9;
/** The rocket body's centre, as a fraction of the sprite width; the flame trails behind it. */
const M13_AX = 0.68;

/** M-13: the long flame and glow behind the motor, four fins, the slender motor tube and the fat, blunt warhead. */
function paintM13(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cy = h / 2;
  const tail = w * 0.4;
  dab(ctx, tail - 2, cy, h * 0.55, [250, 170, 70], 0.7, 0);
  const flame = ctx.createLinearGradient(0, 0, tail, 0);
  flame.addColorStop(0, rgba([226, 96, 34], 0));
  flame.addColorStop(0.45, rgba([246, 140, 50], 0.7));
  flame.addColorStop(0.85, rgba([255, 226, 150], 1));
  flame.addColorStop(1, rgba([255, 252, 236], 1));
  ctx.fillStyle = flame;
  ctx.beginPath();
  ctx.moveTo(tail, cy - h * 0.22);
  ctx.quadraticCurveTo(tail * 0.45, cy - h * 0.32, 0.5, cy);
  ctx.quadraticCurveTo(tail * 0.45, cy + h * 0.32, tail, cy + h * 0.22);
  ctx.closePath();
  ctx.fill();
  // Fins: two seen edge-on above and below the tail.
  ctx.fillStyle = rgba(STEEL_DARK, 1);
  ctx.beginPath();
  ctx.moveTo(tail, cy - h * 0.46);
  ctx.lineTo(tail + w * 0.12, cy - h * 0.46);
  ctx.lineTo(tail + w * 0.14, cy - h * 0.14);
  ctx.lineTo(tail + w * 0.14, cy + h * 0.14);
  ctx.lineTo(tail + w * 0.12, cy + h * 0.46);
  ctx.lineTo(tail, cy + h * 0.46);
  ctx.closePath();
  ctx.fill();
  outline(ctx, 0.35);
  // Motor tube.
  bodyFill(ctx, cy - h * 0.2, cy + h * 0.2, STEEL_LIGHT, STEEL, STEEL_DARK);
  ctx.beginPath();
  ctx.rect(tail, cy - h * 0.2, w * 0.4, h * 0.4);
  ctx.fill();
  outline(ctx, 0.35);
  // Warhead, a little fatter than the motor, with a blunt nose and its fuse.
  bodyFill(ctx, cy - h * 0.27, cy + h * 0.27, GREEN_LIGHT, GREEN, GREEN_DARK);
  ctx.beginPath();
  ctx.moveTo(w * 0.78, cy - h * 0.27);
  ctx.lineTo(w * 0.9, cy - h * 0.27);
  ctx.quadraticCurveTo(w * 0.97, cy - h * 0.22, w * 0.975, cy);
  ctx.quadraticCurveTo(w * 0.97, cy + h * 0.22, w * 0.9, cy + h * 0.27);
  ctx.lineTo(w * 0.78, cy + h * 0.27);
  ctx.closePath();
  ctx.fill();
  outline(ctx, 0.4);
  ctx.fillStyle = rgba(STEEL_LIGHT, 1);
  ctx.fillRect(w * 0.975, cy - 0.6, w * 0.02, 1.2);
}

export function sovietShotSprites(): SpriteSpec[] {
  return [
    sprite(FX_KEYS.projectile.f1Grenade, 9, 8, 0.48, 0.52, paintF1Grenade),
    sprite(FX_KEYS.projectile.katyusha, M13_W, M13_H, M13_AX, 0.5, paintM13),
  ];
}
