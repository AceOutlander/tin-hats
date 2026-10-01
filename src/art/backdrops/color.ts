/** Colour maths for grading theatre palettes by time of day and distance. */
import type { TimeGradeDef } from '../../data/theatres';

/** Channels 0..255 (not rounded). */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function channel(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

export function rgbToHex(c: Rgb): string {
  const n = (channel(c.r) << 16) | (channel(c.g) << 8) | channel(c.b);
  return `#${n.toString(16).padStart(6, '0')}`;
}

/** 0xRRGGBB, the form Phaser tints take. */
export function rgbToInt(c: Rgb): number {
  return (channel(c.r) << 16) | (channel(c.g) << 8) | channel(c.b);
}

export function rgbToCss(c: Rgb, alpha = 1): string {
  if (alpha >= 1) return `rgb(${channel(c.r)},${channel(c.g)},${channel(c.b)})`;
  return `rgba(${channel(c.r)},${channel(c.g)},${channel(c.b)},${Math.max(0, alpha).toFixed(3)})`;
}

export function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t };
}

/** Rec. 601 luma, 0..255. */
export function luma(c: Rgb): number {
  return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
}

/** Apply a time-of-day light to a day colour: desaturate, then multiply per channel. */
export function gradeRgb(c: Rgb, grade: TimeGradeDef): Rgb {
  const l = luma(c);
  const d = grade.desaturate;
  return {
    r: (c.r + (l - c.r) * d) * grade.mul[0],
    g: (c.g + (l - c.g) * d) * grade.mul[1],
    b: (c.b + (l - c.b) * d) * grade.mul[2],
  };
}
