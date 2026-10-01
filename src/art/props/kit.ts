/**
 * Shared Canvas 2D drawing helpers for structures, vehicles and props:
 * sprite-spec construction, a seeded RNG (art must be deterministic), colour
 * mixing, rim-lit fills, sandbags, cracks, scorch marks and rubble.
 */
import { ART_COLORS as C, type ArtBox } from '../../data/artLayout';
import type { SpriteSpec } from '../types';

export type Ctx = CanvasRenderingContext2D;

export const TAU = Math.PI * 2;

/**
 * Build a SpriteSpec whose paint function works in origin-relative wu: (0,0)
 * is the sprite's origin, +x right, -y up. The draw is clipped to the sprite
 * box so compositing tricks can never touch a neighbour in an atlas.
 */
export function makeSpec(key: string, box: ArtBox, paint: (ctx: Ctx) => void): SpriteSpec {
  return {
    key,
    w: box.w,
    h: box.h,
    ax: box.ox / box.w,
    ay: box.oy / box.h,
    draw(ctx: Ctx): void {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, box.w, box.h);
      ctx.clip();
      ctx.translate(box.ox, box.oy);
      paint(ctx);
      ctx.restore();
    },
  };
}

/** mulberry32: small deterministic generator for art details. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function channel(hex: string, i: number): number {
  return parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
}

function hex2(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
}

/** Blend two #rrggbb colours; t = 0 gives a, t = 1 gives b. */
export function mix(a: string, b: string, t: number): string {
  return `#${hex2(channel(a, 0) + (channel(b, 0) - channel(a, 0)) * t)}${hex2(
    channel(a, 1) + (channel(b, 1) - channel(a, 1)) * t,
  )}${hex2(channel(a, 2) + (channel(b, 2) - channel(a, 2)) * t)}`;
}

export function rgba(hex: string, alpha: number): string {
  return `rgba(${channel(hex, 0)},${channel(hex, 1)},${channel(hex, 2)},${alpha})`;
}

/** Closed polygon path from a flat [x0, y0, x1, y1, ...] list. */
export function poly(ctx: Ctx, pts: readonly number[]): void {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
}

/** Open polyline path. */
export function line(ctx: Ctx, pts: readonly number[]): void {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
}

/** Rounded rectangle path. */
export function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

export function ellipse(ctx: Ctx, cx: number, cy: number, rx: number, ry: number): void {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU);
}

export function fillPoly(ctx: Ctx, pts: readonly number[], color: string): void {
  poly(ctx, pts);
  ctx.fillStyle = color;
  ctx.fill();
}

export function strokeLine(ctx: Ctx, pts: readonly number[], color: string, width: number): void {
  line(ctx, pts);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/**
 * Fill a shape in `body` with a soft lighter rim along its upper edges: the
 * shape is filled in the rim colour, then refilled in the body colour shifted
 * down a little and clipped to itself.
 */
export function rimmed(ctx: Ctx, path: (ctx: Ctx) => void, body: string, rim: string, dx = 0.3, dy = 1.3): void {
  ctx.save();
  path(ctx);
  ctx.fillStyle = rim;
  ctx.fill();
  ctx.clip();
  ctx.translate(dx, dy);
  path(ctx);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.restore();
}

export function rimPoly(ctx: Ctx, pts: readonly number[], body: string, rim: string, dy = 1.3): void {
  rimmed(ctx, (c) => poly(c, pts), body, rim, 0.3, dy);
}

export function rimRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, body: string, rim: string, dy = 1.2): void {
  rimmed(ctx, (c) => rr(c, x, y, w, h, r), body, rim, 0.2, dy);
}

/** Run `paint` clipped to a shape, for interior detail. */
export function inside(ctx: Ctx, path: (ctx: Ctx) => void, paint: () => void): void {
  ctx.save();
  path(ctx);
  ctx.clip();
  paint();
  ctx.restore();
}

const BAG_TONES = [0, -0.35, 0.3, -0.12];

/** One sandbag; (x, y) is its top-left corner. tone: -1 darker .. +1 lighter. */
export function sandbag(ctx: Ctx, x: number, y: number, w: number, h: number, tone = 0): void {
  const body = tone >= 0 ? mix(C.sandbag, C.sandbagRim, tone * 0.4) : mix(C.sandbag, C.sandbagDark, -tone * 0.7);
  rr(ctx, x, y, w, h, h * 0.45);
  ctx.fillStyle = C.sandbagDark;
  ctx.fill();
  rr(ctx, x + 0.7, y + 0.5, w - 1.4, h - 1.8, h * 0.4);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.lineCap = 'round';
  ctx.strokeStyle = rgba(C.sandbagRim, 0.9);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.2, y + 1.6);
  ctx.lineTo(x + w * 0.7, y + 1.6);
  ctx.stroke();
  ctx.strokeStyle = rgba(C.sandbagDark, 0.75);
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.84, y + h * 0.28);
  ctx.lineTo(x + w * 0.87, y + h * 0.66);
  ctx.stroke();
}

/**
 * A course of sandbags laid end to end at top edge y. Bags sit at
 * phase + k * bagW; every bag overlapping [x0, x1] is drawn in full, so clip
 * if a hard edge is needed. Tones repeat every four bags, which keeps tiles seamless.
 */
export function bagCourse(ctx: Ctx, x0: number, x1: number, y: number, bagW: number, bagH: number, phase: number, toneShift = 0): void {
  let k = Math.floor((x0 - phase) / bagW);
  for (let x = phase + k * bagW; x < x1 - 0.01; x += bagW, k++) {
    sandbag(ctx, x, y, bagW, bagH, BAG_TONES[(((k + toneShift) % 4) + 4) % 4]);
  }
}

/** A stepped pile: `cols` bags on the bottom course, one fewer on each course above. */
export function bagPile(ctx: Ctx, x: number, yBase: number, cols: number, rows: number, bagW: number, bagH: number, toneShift = 0): void {
  const rise = bagH - 1.8;
  for (let r = 0; r < rows; r++) {
    const n = cols - r;
    if (n <= 0) break;
    const y = yBase - bagH - r * rise;
    for (let i = 0; i < n; i++) {
      sandbag(ctx, x + r * bagW * 0.5 + i * bagW, y, bagW, bagH, BAG_TONES[(i + r * 3 + toneShift) % 4]);
    }
  }
}

/** A straight-sided wall of bags, alternate courses offset by half a bag. */
export function bagWall(ctx: Ctx, x: number, yBase: number, cols: number, rows: number, bagW: number, bagH: number, toneShift = 0): void {
  const rise = bagH - 1.8;
  for (let r = 0; r < rows; r++) {
    const y = yBase - bagH - r * rise;
    const off = r % 2 === 1 ? bagW * 0.5 : 0;
    const n = r % 2 === 1 ? cols - 1 : cols;
    for (let i = 0; i < n; i++) {
      sandbag(ctx, x + off + i * bagW, y, bagW, bagH, BAG_TONES[(i + r + toneShift) % 4]);
    }
  }
}

/** A jagged crack starting at (x, y), with one or two side branches. */
export function crack(ctx: Ctx, x: number, y: number, angle: number, len: number, rand: () => number, width = 0.9, color: string = C.void): void {
  const n = Math.max(3, Math.round(len / 5));
  const step = len / n;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  let px = x;
  let py = y;
  let bx = x;
  let by = y;
  let ba = angle;
  for (let i = 0; i < n; i++) {
    const a = angle + (rand() - 0.5) * 1.5;
    px += Math.cos(a) * step;
    py += Math.sin(a) * step;
    ctx.lineTo(px, py);
    if (i === Math.floor(n / 2)) {
      bx = px;
      by = py;
      ba = angle + (rand() < 0.5 ? -0.9 : 0.9);
    }
  }
  ctx.stroke();
  if (len > 14) crack(ctx, bx, by, ba, len * 0.45, rand, width * 0.75, color);
}

/** Soft soot blot that only darkens what is already painted. */
export function scorch(ctx: Ctx, x: number, y: number, rx: number, ry: number, strength: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(10,9,8,${strength})`);
  g.addColorStop(0.55, `rgba(10,9,8,${strength * 0.6})`);
  g.addColorStop(1, 'rgba(10,9,8,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Cut a polygon out of what is already painted. */
export function bite(ctx: Ctx, pts: readonly number[]): void {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  poly(ctx, pts);
  ctx.fillStyle = '#000';
  ctx.fill();
  ctx.restore();
}

/** Darken everything already painted (charring). */
export function charOver(ctx: Ctx, x: number, y: number, w: number, h: number, alpha: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = rgba(C.char, alpha);
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

/** A small glow of embers. */
export function ember(ctx: Ctx, x: number, y: number, r: number, alpha: number): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba('#f2b25a', alpha));
  g.addColorStop(0.4, rgba(C.ember, alpha * 0.7));
  g.addColorStop(1, rgba(C.ember, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

/** An angular broken lump (concrete, masonry), roughly `size` across, centred on (x, y). */
export function chunk(ctx: Ctx, x: number, y: number, size: number, rand: () => number, body: string, rim: string): void {
  const n = 5 + Math.floor(rand() * 2);
  const pts: number[] = [];
  const spin = rand() * TAU;
  for (let i = 0; i < n; i++) {
    const a = spin + (i / n) * TAU;
    const r = size * (0.32 + rand() * 0.22);
    pts.push(x + Math.cos(a) * r * 1.25, y + Math.sin(a) * r * 0.85);
  }
  rimPoly(ctx, pts, body, rim, 1);
}

/** A lumpy heap with a jagged top between x0 and x1, peaking about `height` above yBase. */
export function heap(ctx: Ctx, x0: number, x1: number, yBase: number, height: number, rand: () => number, body: string, rim: string): void {
  const n = Math.max(4, Math.round((x1 - x0) / 9));
  const pts: number[] = [x0, yBase];
  for (let i = 1; i < n; i++) {
    const u = i / n;
    const arch = Math.sin(u * Math.PI) ** 0.7;
    pts.push(x0 + (x1 - x0) * u + (rand() - 0.5) * 3, yBase - height * arch * (0.72 + rand() * 0.28));
  }
  pts.push(x1, yBase);
  rimPoly(ctx, pts, body, rim, 1.1);
}

/** A dark strip of trodden earth along the foot of a structure, hiding the join with the ground. */
export function footing(ctx: Ctx, x0: number, x1: number, y: number, depth: number, rand: () => number): void {
  const n = Math.max(4, Math.round((x1 - x0) / 14));
  ctx.beginPath();
  ctx.moveTo(x0, y);
  for (let i = 0; i <= n; i++) {
    ctx.lineTo(x0 + ((x1 - x0) * i) / n, y - 1.5 - rand() * 1.5);
  }
  ctx.lineTo(x1, y);
  for (let i = n; i >= 0; i--) {
    const u = i / n;
    const taper = Math.sin(u * Math.PI) ** 0.35;
    ctx.lineTo(x0 + (x1 - x0) * u, y + depth * taper * (0.65 + rand() * 0.35));
  }
  ctx.closePath();
  ctx.fillStyle = rgba(C.earthDark, 0.85);
  ctx.fill();
}

/** A gaping shell hole with a pale spalled ring; only marks what is already painted. */
export function shellHole(ctx: Ctx, x: number, y: number, r: number, rand: () => number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  const ring: number[] = [];
  const core: number[] = [];
  const n = 9;
  const spin = rand() * TAU;
  for (let i = 0; i < n; i++) {
    const a = spin + (i / n) * TAU;
    const k = 0.75 + rand() * 0.45;
    ring.push(x + Math.cos(a) * r * 1.45 * k, y + Math.sin(a) * r * 1.2 * k);
    core.push(x + Math.cos(a) * r * k, y + Math.sin(a) * r * 0.82 * k);
  }
  fillPoly(ctx, ring, rgba(C.concreteRim, 0.5));
  fillPoly(ctx, core, C.void);
  for (let i = 0; i < 4; i++) {
    const a = spin + i * 1.6 + rand() * 0.6;
    crack(ctx, x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.6, a, r * (1.4 + rand() * 1.6), rand, 0.9, rgba(C.void, 0.9));
  }
  ctx.restore();
}

/** A sandbag that has fallen off its pile, centred on (x, y). */
export function looseBag(ctx: Ctx, x: number, y: number, angle: number, tone: number, w = 18, h = 10): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  sandbag(ctx, -w / 2, -h / 2, w, h, tone);
  ctx.restore();
}

/** Bent reinforcing bars sticking out of broken concrete. */
export function rebar(ctx: Ctx, x: number, y: number, rand: () => number): void {
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + (rand() - 0.5) * 1.4;
    const len = 8 + rand() * 10;
    const mx = x + i * 3 + Math.cos(a) * len * 0.6;
    const my = y + Math.sin(a) * len * 0.6;
    ctx.strokeStyle = C.rust;
    ctx.lineWidth = 0.9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + i * 3, y);
    ctx.quadraticCurveTo(mx, my, mx + (rand() - 0.3) * 8, my - 2 + rand() * 6);
    ctx.stroke();
  }
}

/** A machine-gun barrel poking out of a firing slit; `tip` is the muzzle. */
export function machineGun(ctx: Ctx, tip: { x: number; y: number }, len: number): void {
  strokeLine(ctx, [tip.x - len, tip.y, tip.x - 1, tip.y], C.ink, 1.8);
  strokeLine(ctx, [tip.x - len, tip.y, tip.x - 8, tip.y], C.ink, 3.2);
  strokeLine(ctx, [tip.x - len + 1, tip.y - 1, tip.x - 9, tip.y - 1], rgba(C.rim, 0.6), 0.7);
  strokeLine(ctx, [tip.x - 2, tip.y, tip.x, tip.y], C.ink, 2.6);
}

/** Subtle horizontal shuttering marks, rain streaks and pitting on a concrete face. Clip first. */
export function concreteFace(ctx: Ctx, x0: number, x1: number, y0: number, y1: number, rand: () => number): void {
  ctx.lineCap = 'butt';
  for (let y = y1 - 17; y > y0 + 4; y -= 17) {
    ctx.strokeStyle = rgba(C.concreteDark, 0.55);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
  }
  const streaks = Math.round((x1 - x0) / 22);
  for (let i = 0; i < streaks; i++) {
    const x = x0 + rand() * (x1 - x0);
    const top = y0 + rand() * (y1 - y0) * 0.3;
    ctx.fillStyle = rgba(C.concreteDark, 0.22 + rand() * 0.18);
    ctx.fillRect(x, top, 1.5 + rand() * 2.5, 10 + rand() * 26);
  }
  for (let i = 0; i < streaks * 3; i++) {
    ctx.fillStyle = rgba(rand() < 0.5 ? C.concreteDark : C.concreteRim, 0.25);
    ctx.fillRect(x0 + rand() * (x1 - x0), y0 + rand() * (y1 - y0), 1.2, 1.2);
  }
}

/** A straight-armed black cross with a white outline (Balkenkreuz), centred on (x, y). */
export function balkenkreuz(ctx: Ctx, x: number, y: number, size: number): void {
  const arm = size / 2;
  const bar = size * 0.3;
  const edge = size * 0.11;
  ctx.fillStyle = C.flagWhite;
  ctx.fillRect(x - arm - edge, y - bar / 2 - edge, size + edge * 2, bar + edge * 2);
  ctx.fillRect(x - bar / 2 - edge, y - arm - edge, bar + edge * 2, size + edge * 2);
  ctx.fillStyle = C.flagBlack;
  ctx.fillRect(x - arm, y - bar / 2, size, bar);
  ctx.fillRect(x - bar / 2, y - arm, bar, size);
}

/** British armour recognition flash: three plain vertical bands, white, red, white. */
export function recognitionFlash(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  const band = w / 3;
  ctx.fillStyle = C.flagWhite;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = C.flagRed;
  ctx.fillRect(x + band, y, band, h);
}
