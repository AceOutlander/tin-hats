/**
 * Shared drawing kit for the backdrop painters: periodic profiles that tile
 * along x, seam-safe placement, and the stock of trees, rocks and houses the
 * theatres share. Everything draws in wu with plain Canvas 2D.
 */
import { mulberry32, range, type Rng } from './rng';

export type Ctx = CanvasRenderingContext2D;
/** Height (or any value) as a function of x, periodic over the tile width. */
export type Profile = (x: number) => number;

export const TAU = Math.PI * 2;

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(t: number): number {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
}

/**
 * Smooth rolling profile in about -1..1: a sum of sines whose wave counts are
 * whole numbers per tile, so the two ends always meet.
 */
export function sineProfile(rng: Rng, w: number, waves: readonly number[], rough: number): Profile {
  const n = waves.length;
  const k = new Float64Array(n);
  const a = new Float64Array(n);
  const p = new Float64Array(n);
  let norm = 0;
  for (let i = 0; i < n; i++) {
    k[i] = (TAU * waves[i]) / w;
    a[i] = range(rng, 0.6, 1.4) / Math.pow(waves[i], rough);
    p[i] = rng() * TAU;
    norm += a[i];
  }
  return (x) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += a[i] * Math.sin(k[i] * x + p[i]);
    return s / norm;
  };
}

/**
 * Periodic value noise in 0..1. `cells` lattice points per tile in the first
 * octave, doubling each octave. `sharp` joins lattice points with straight
 * lines, which gives crags instead of rolling ground.
 */
export function noiseProfile(rng: Rng, w: number, cells: number, octaves: number, gain: number, sharp: boolean): Profile {
  const tables: Float64Array[] = [];
  let n = cells;
  for (let o = 0; o < octaves; o++) {
    const t = new Float64Array(n);
    for (let i = 0; i < n; i++) t[i] = rng();
    tables.push(t);
    n *= 2;
  }
  return (x) => {
    let u = x / w;
    u -= Math.floor(u);
    let sum = 0;
    let amp = 1;
    let norm = 0;
    for (let o = 0; o < tables.length; o++) {
      const t = tables[o];
      const f = u * t.length;
      const i = Math.floor(f) % t.length;
      const fr = f - Math.floor(f);
      const s = sharp ? fr : fr * fr * (3 - 2 * fr);
      const v0 = t[i];
      const v1 = t[(i + 1) % t.length];
      sum += (v0 + (v1 - v0) * s) * amp;
      norm += amp;
      amp *= gain;
    }
    return sum / norm;
  };
}

/** Outline the area under a profile, running a little past both tile edges. */
export function pathBelow(ctx: Ctx, w: number, yOf: Profile, bottom: number, step = 3): void {
  ctx.beginPath();
  ctx.moveTo(-6, bottom);
  for (let x = -6; x < w + 6; x += step) ctx.lineTo(x, yOf(x));
  ctx.lineTo(w + 6, yOf(w + 6));
  ctx.lineTo(w + 6, bottom);
  ctx.closePath();
}

export function fillBelow(ctx: Ctx, w: number, yOf: Profile, bottom: number, style: string | CanvasGradient, step = 3): void {
  pathBelow(ctx, w, yOf, bottom, step);
  ctx.fillStyle = style;
  ctx.fill();
}

/** Stroke a line that follows a profile shifted down by `dy`. */
export function strokeAlong(ctx: Ctx, w: number, yOf: Profile, dy: number, step = 4): void {
  ctx.beginPath();
  ctx.moveTo(-6, yOf(-6) + dy);
  for (let x = -6 + step; x <= w + 6; x += step) ctx.lineTo(x, yOf(x) + dy);
  ctx.stroke();
}

export function vGrad(ctx: Ctx, y0: number, y1: number, c0: string, c1: string): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, c0);
  g.addColorStop(1, c1);
  return g;
}

/** Draw something at x, and again one tile left or right if it overhangs an edge, so the strip tiles. */
export function wrapped(w: number, x: number, half: number, draw: (x: number) => void): void {
  draw(x);
  if (x - half < 0) draw(x + w);
  if (x + half > w) draw(x - w);
}

/** As `wrapped`, for things with their own randomness: every copy gets an identical stream. */
export function wrappedSeeded(w: number, x: number, half: number, rng: Rng, draw: (x: number, r: Rng) => void): void {
  const s = Math.floor(rng() * 4294967296);
  draw(x, mulberry32(s));
  if (x - half < 0) draw(x + w, mulberry32(s));
  if (x + half > w) draw(x - w, mulberry32(s));
}

/** `count` positions spread evenly over the tile with jitter (0 = regular, 1 = up to half a slot either way). */
export function spread(rng: Rng, w: number, count: number, jitter: number): number[] {
  const out: number[] = [];
  const offset = rng();
  for (let i = 0; i < count; i++) {
    const u = (i + offset + (rng() - 0.5) * jitter) / count;
    out.push((u - Math.floor(u)) * w);
  }
  return out;
}

export function poly(ctx: Ctx, pts: readonly number[]): void {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
}

export function fillPoly(ctx: Ctx, pts: readonly number[], style: string | CanvasGradient): void {
  poly(ctx, pts);
  ctx.fillStyle = style;
  ctx.fill();
}

export function disc(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

export function oval(ctx: Ctx, x: number, y: number, rx: number, ry: number): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fill();
}

export function line(ctx: Ctx, x0: number, y0: number, x1: number, y1: number): void {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

/** Lighten the bottom of whatever is already drawn (and only that) toward the haze: ground mist. */
export function mistBand(ctx: Ctx, w: number, yTop: number, yBottom: number, color: (alpha: number) => string, alpha: number): void {
  if (alpha <= 0 || yBottom <= yTop) return;
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  const g = ctx.createLinearGradient(0, yTop, 0, yBottom);
  g.addColorStop(0, color(0));
  g.addColorStop(0.65, color(alpha * 0.8));
  g.addColorStop(1, color(alpha));
  ctx.fillStyle = g;
  ctx.fillRect(-8, yTop, w + 16, yBottom - yTop);
  ctx.restore();
}

export interface TreeLook {
  lit: string;
  shade: string;
  trunk: string;
}

/** Tall narrow tree: poplar (fat low down, blunt) or cypress (slim, pointed). `x`, `base` = foot of the trunk. */
export function spindle(ctx: Ctx, x: number, base: number, h: number, wid: number, look: TreeLook, light: number, stem: number): void {
  const tw = Math.max(0.7, wid * 0.14);
  ctx.fillStyle = look.trunk;
  ctx.fillRect(x - tw / 2, base - h * (stem + 0.08), tw, h * (stem + 0.08));
  const y0 = base - h * stem;
  const top = base - h;
  const ch = y0 - top;
  ctx.fillStyle = look.shade;
  ctx.beginPath();
  ctx.moveTo(x, y0);
  ctx.bezierCurveTo(x + wid * 0.8, y0 - ch * 0.1, x + wid * 0.5, top + ch * 0.3, x, top);
  ctx.bezierCurveTo(x - wid * 0.5, top + ch * 0.3, x - wid * 0.8, y0 - ch * 0.1, x, y0);
  ctx.fill();
  // The lit flank is a slimmer spindle hugging the light side.
  const s = light;
  ctx.fillStyle = look.lit;
  ctx.beginPath();
  ctx.moveTo(x + s * wid * 0.06, y0 - ch * 0.04);
  ctx.bezierCurveTo(x + s * wid * 0.74, y0 - ch * 0.12, x + s * wid * 0.46, top + ch * 0.3, x, top + ch * 0.03);
  ctx.bezierCurveTo(x - s * wid * 0.1, top + ch * 0.4, x - s * wid * 0.12, y0 - ch * 0.3, x + s * wid * 0.06, y0 - ch * 0.04);
  ctx.fill();
}

/** Broad-leaved tree (oak, elm, olive): a trunk and a crown of overlapping blobs, lit from one side. */
export function roundTree(ctx: Ctx, rng: Rng, x: number, base: number, h: number, wid: number, look: TreeLook, light: number): void {
  const trunkH = h * 0.5;
  const tw = Math.max(0.9, wid * 0.07);
  const lean = range(rng, -0.08, 0.08) * h;
  ctx.fillStyle = look.trunk;
  ctx.beginPath();
  ctx.moveTo(x - tw * 1.3, base);
  ctx.quadraticCurveTo(x - tw * 0.5, base - trunkH * 0.5, x + lean - tw * 0.6, base - trunkH);
  ctx.lineTo(x + lean + tw * 0.6, base - trunkH);
  ctx.quadraticCurveTo(x + tw * 0.7, base - trunkH * 0.5, x + tw * 1.3, base);
  ctx.fill();
  // Two limbs reaching into the crown.
  ctx.strokeStyle = look.trunk;
  ctx.lineWidth = tw * 0.9;
  ctx.lineCap = 'round';
  line(ctx, x + lean, base - trunkH * 0.9, x + lean - wid * 0.2, base - h * 0.62);
  line(ctx, x + lean, base - trunkH * 0.9, x + lean + wid * 0.22, base - h * 0.6);

  const cx = x + lean;
  const cy = base - h * 0.68;
  const rx = wid / 2;
  const ry = h * 0.32;
  const rBase = Math.min(rx, ry);
  const n = 7;
  const bx: number[] = [cx];
  const by: number[] = [cy];
  const br: number[] = [rBase * 0.78];
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * TAU + range(rng, -0.3, 0.3);
    bx.push(cx + Math.cos(ang) * rx * 0.56);
    by.push(cy + Math.sin(ang) * ry * 0.5);
    br.push(rBase * range(rng, 0.42, 0.64));
  }
  ctx.fillStyle = look.shade;
  for (let i = 0; i < bx.length; i++) disc(ctx, bx[i], by[i], br[i]);
  ctx.fillStyle = look.lit;
  for (let i = 0; i < bx.length; i++) disc(ctx, bx[i] + light * br[i] * 0.2, by[i] - br[i] * 0.24, br[i] * 0.74);
}

/** Conifer: bare lower trunk and drooping tiers, the half toward the light a tone lighter. */
export function pine(ctx: Ctx, rng: Rng, x: number, base: number, h: number, wid: number, look: TreeLook, light: number, stem: number): void {
  const tw = Math.max(0.9, wid * 0.08);
  ctx.fillStyle = look.trunk;
  ctx.beginPath();
  ctx.moveTo(x - tw * 0.7, base);
  ctx.lineTo(x - tw * 0.4, base - h * (stem + 0.1));
  ctx.lineTo(x + tw * 0.4, base - h * (stem + 0.1));
  ctx.lineTo(x + tw * 0.7, base);
  ctx.fill();
  const tiers = 5 + Math.floor(rng() * 3);
  const crownBase = base - h * stem;
  const top = base - h;
  const span = crownBase - top;
  for (let pass = 0; pass < 2; pass++) {
    const side = pass === 0 ? -light : light;
    ctx.fillStyle = side === light ? look.lit : look.shade;
    ctx.beginPath();
    ctx.moveTo(x, top);
    for (let t = 1; t <= tiers; t++) {
      const f = t / tiers;
      const y = top + span * f;
      const half = wid * 0.5 * (0.16 + 0.84 * Math.pow(f, 0.85)) * range(rng, 0.84, 1.08);
      ctx.lineTo(x + side * half, y + span * 0.025);
      if (t < tiers) ctx.lineTo(x + side * half * 0.5, y - span * 0.045);
    }
    ctx.lineTo(x, crownBase - span * 0.04);
    ctx.closePath();
    ctx.fill();
  }
}

/** Low shrub or hedge lump with a flat base. */
export function bush(ctx: Ctx, rng: Rng, x: number, base: number, wid: number, h: number, lit: string, shade: string, light: number): void {
  const n = Math.max(3, Math.round(wid / (h * 0.7)));
  const bx: number[] = [];
  const by: number[] = [];
  const br: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const env = 0.55 + 0.45 * Math.sin(Math.PI * t);
    const r = h * 0.62 * env * range(rng, 0.8, 1.1);
    bx.push(x - wid / 2 + wid * t);
    by.push(base - r * 0.55);
    br.push(r);
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - wid, base - h * 2, wid * 2, h * 2);
  ctx.clip();
  ctx.fillStyle = shade;
  for (let i = 0; i < n; i++) disc(ctx, bx[i], by[i], br[i]);
  ctx.fillStyle = lit;
  for (let i = 0; i < n; i++) disc(ctx, bx[i] + light * br[i] * 0.2, by[i] - br[i] * 0.22, br[i] * 0.72);
  ctx.restore();
}

/** Shell-stripped tree: a leaning trunk with a splintered top and a few broken limbs. */
export function shatteredTree(ctx: Ctx, rng: Rng, x: number, base: number, h: number, color: string): void {
  const lean = range(rng, -0.14, 0.14) * h;
  const w0 = Math.max(1.1, h * 0.06);
  const tx = x + lean;
  const ty = base - h;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - w0, base);
  ctx.lineTo(tx - w0 * 0.55, ty + h * 0.1);
  ctx.lineTo(tx - w0 * 0.3, ty);
  ctx.lineTo(tx, ty + h * 0.09);
  ctx.lineTo(tx + w0 * 0.3, ty + h * 0.03);
  ctx.lineTo(tx + w0 * 0.55, ty + h * 0.14);
  ctx.lineTo(x + w0, base);
  ctx.fill();
  const limbs = 1 + Math.floor(rng() * 3);
  ctx.strokeStyle = color;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  for (let i = 0; i < limbs; i++) {
    const f = range(rng, 0.4, 0.85);
    const side = rng() < 0.5 ? -1 : 1;
    const len = h * range(rng, 0.12, 0.28);
    const lx = x + lean * f;
    const ly = base - h * f;
    ctx.lineWidth = w0 * range(rng, 0.5, 0.85);
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx + side * len * 0.75, ly - len * 0.6);
    // Some limbs hang snapped.
    if (rng() < 0.5) ctx.lineTo(lx + side * len * 1.05, ly - len * 0.2);
    ctx.stroke();
  }
}

/** Angular boulder with a shaded facet on the side away from the light. */
export function rock(ctx: Ctx, rng: Rng, x: number, base: number, wid: number, h: number, lit: string, shade: string, light: number): void {
  const n = 6;
  const pts: number[] = [];
  for (let i = 0; i <= n; i++) {
    const a = Math.PI * (i / n);
    const px = x - Math.cos(a) * wid * 0.5 * range(rng, 0.86, 1.08);
    const py = i === 0 || i === n ? base : base - Math.sin(a) * h * range(rng, 0.75, 1.08);
    pts.push(px, py);
  }
  fillPoly(ctx, pts, lit);
  // Shade facet: the half of the outline away from the light, closed through a point low in the middle.
  const facet: number[] = [];
  const from = light < 0 ? n / 2 : 0;
  for (let i = from; i <= from + n / 2; i++) facet.push(pts[i * 2], pts[i * 2 + 1]);
  facet.push(x - light * wid * 0.04, base);
  fillPoly(ctx, facet, shade);
}

export interface HouseLook {
  wall: string;
  wallShade: string;
  roof: string;
  roofShade: string;
  opening: string;
}

/**
 * Plain house. `x` = left edge, `base` = ground line. `gable` shows the gable
 * end (triangular wall); otherwise the long side with a hipped roof.
 */
export function house(ctx: Ctx, x: number, base: number, w: number, h: number, roofH: number, look: HouseLook, gable: boolean, windows: number): void {
  const top = base - h;
  ctx.fillStyle = look.wall;
  ctx.fillRect(x, top, w, h);
  if (gable) {
    fillPoly(ctx, [x, top + 0.3, x + w / 2, top - roofH, x + w, top + 0.3], look.wall);
    ctx.strokeStyle = look.roof;
    ctx.lineWidth = Math.max(0.8, roofH * 0.18);
    ctx.lineJoin = 'miter';
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(x - w * 0.07, top + roofH * 0.12);
    ctx.lineTo(x + w / 2, top - roofH);
    ctx.lineTo(x + w * 1.07, top + roofH * 0.12);
    ctx.stroke();
  } else {
    const inset = Math.min(w * 0.2, roofH * 0.55);
    fillPoly(ctx, [x - w * 0.04, top, x + inset, top - roofH, x + w - inset, top - roofH, x + w * 1.04, top], look.roof);
    ctx.fillStyle = look.roofShade;
    ctx.fillRect(x - w * 0.04, top - roofH * 0.16, w * 1.08, roofH * 0.16 + 0.3);
    ctx.fillStyle = look.wallShade;
    ctx.fillRect(x, top, w, Math.max(0.5, h * 0.1));
  }
  if (windows > 0) {
    ctx.fillStyle = look.opening;
    const ww = Math.min(w / (windows * 2.6), h * 0.3);
    const wh = Math.min(h * 0.36, ww * 1.5);
    for (let i = 0; i < windows; i++) {
      const cx = x + (w * (i + 0.5)) / windows;
      ctx.fillRect(cx - ww / 2, top + h * 0.3, ww, wh);
    }
  }
}

/** Loose heap of broken masonry: a low mound with a scatter of angular blocks. */
export function rubblePile(ctx: Ctx, rng: Rng, x: number, base: number, wid: number, h: number, lit: string, shade: string, light: number): void {
  const n = 7;
  const pts: number[] = [x - wid / 2, base];
  for (let i = 1; i < n; i++) {
    const t = i / n;
    pts.push(x - wid / 2 + wid * t, base - h * Math.sin(Math.PI * t) * range(rng, 0.6, 1.05));
  }
  pts.push(x + wid / 2, base);
  fillPoly(ctx, pts, shade);
  const blocks = Math.max(3, Math.round(wid / 5));
  for (let i = 0; i < blocks; i++) {
    const t = range(rng, 0.08, 0.92);
    const bw = range(rng, 0.08, 0.2) * wid;
    const bh = bw * range(rng, 0.4, 0.8);
    const bxx = x - wid / 2 + wid * t;
    const byy = base - h * Math.sin(Math.PI * t) * range(rng, 0.2, 0.95);
    const tilt = range(rng, -0.5, 0.5);
    ctx.save();
    ctx.translate(bxx, byy);
    ctx.rotate(tilt);
    ctx.fillStyle = lit;
    ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
    ctx.fillStyle = shade;
    if (light < 0) ctx.fillRect(bw * 0.2, -bh / 2, bw * 0.3, bh);
    else ctx.fillRect(-bw / 2, -bh / 2, bw * 0.3, bh);
    ctx.restore();
  }
}

/** Small round clumps (distant trees) sitting along a profile. */
export function clumps(ctx: Ctx, rng: Rng, w: number, yOf: Profile, count: number, rMin: number, rMax: number, color: string, sink: number): void {
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const x = rng() * w;
    const r = range(rng, rMin, rMax);
    wrapped(w, x, r * 2, (cx) => {
      oval(ctx, cx, yOf(cx) + sink - r * 0.6, r * 1.2, r);
    });
  }
}
