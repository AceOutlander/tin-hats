/** Sky gradient with stars, the sun or moon sprite, and the cloud strip. */
import { VIEW } from '../../data/view';
import { hexToRgb, mixRgb, rgbToCss } from './color';
import { TAU, clamp, lerp, wrappedSeeded, type Ctx } from './kit';
import { range, type Rng } from './rng';
import type { Scene } from './scene';

/** Stars stay out of the bright band above the horizon. */
const STAR_FLOOR = 0.72;

export function paintSky(ctx: Ctx, sc: Scene, rng: Rng, w: number, h: number): void {
  const horizon = VIEW.horizonY;
  const g = ctx.createLinearGradient(0, 0, 0, horizon);
  g.addColorStop(0, rgbToCss(sc.sky.top));
  g.addColorStop(0.58, rgbToCss(sc.sky.mid));
  g.addColorStop(1, rgbToCss(sc.sky.horizon));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const stars = sc.grade.stars;
  for (let i = 0; i < stars; i++) {
    // Keep clear of the tile edges so no star is cut by a seam.
    const x = range(rng, 3, w - 3);
    const f = Math.pow(rng(), 1.5);
    const y = 4 + f * horizon * STAR_FLOOR;
    const big = rng() < 0.12;
    const r = big ? range(rng, 0.9, 1.3) : range(rng, 0.45, 0.8);
    const a = (big ? range(rng, 0.7, 0.95) : range(rng, 0.25, 0.7)) * (1 - f * 0.6);
    const warm = rng() < 0.3;
    ctx.fillStyle = warm ? `rgba(255,236,206,${a.toFixed(3)})` : `rgba(226,234,255,${a.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
}

/** Sun, moon or overcast glow, centred in a square sprite of side `size`. */
export function paintCelestial(ctx: Ctx, sc: Scene, size: number): void {
  const c = sc.grade.celestial;
  const cx = size / 2;
  const cy = size / 2;
  const glow = hexToRgb(c.glow);
  const reach = Math.min(c.glowRadius, size / 2);

  const g = ctx.createRadialGradient(cx, cy, c.radius * 0.6, cx, cy, reach);
  g.addColorStop(0, rgbToCss(glow, c.glowAlpha));
  g.addColorStop(0.35, rgbToCss(glow, c.glowAlpha * 0.38));
  g.addColorStop(1, rgbToCss(glow, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  if (c.kind === 'glow') return;

  const body = hexToRgb(c.color);
  ctx.fillStyle = rgbToCss(body);
  ctx.beginPath();
  ctx.arc(cx, cy, c.radius, 0, TAU);
  ctx.fill();

  if (c.kind === 'moon') {
    // Maria: a few soft grey seas, kept inside the disc.
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, c.radius, 0, TAU);
    ctx.clip();
    ctx.fillStyle = rgbToCss(mixRgb(body, sc.sky.mid, 0.55), 0.38);
    const r = c.radius;
    const seas = [-0.3, -0.25, 0.34, 0.2, 0.3, 0.3, -0.05, 0.42, 0.26, -0.1, -0.42, 0.22];
    for (let i = 0; i < seas.length; i += 3) {
      ctx.beginPath();
      ctx.arc(cx + seas[i] * r, cy + seas[i + 1] * r, seas[i + 2] * r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    // Phase: bite the unlit side out of the disc (and only the disc), leaving a trace of earthshine.
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, c.radius + 0.5, 0, TAU);
    ctx.clip();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(cx - c.radius * 1.72, cy - c.radius * 0.3, c.radius * 1.5, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = rgbToCss(body, 0.1);
    ctx.fill();
    ctx.restore();
  }
}

function paintCloud(ctx: Ctx, rng: Rng, cx: number, baseY: number, cw: number, ch: number, top: string, bottom: string, alpha: number): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  const n = Math.max(4, Math.round(cw / (ch * 0.8)));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const env = Math.sin(Math.PI * t);
    const r = ch * (0.3 + 0.7 * env) * range(rng, 0.72, 1.05);
    const px = cx - cw / 2 + cw * t + range(rng, -0.3, 0.3) * ch;
    const py = baseY - r * 0.7;
    ctx.moveTo(px + r, py);
    ctx.arc(px, py, r, 0, TAU);
  }
  ctx.moveTo(cx + cw * 0.5, baseY - ch * 0.16);
  ctx.ellipse(cx, baseY - ch * 0.16, cw * 0.5, ch * 0.24, 0, 0, TAU);
  ctx.clip();
  const g = ctx.createLinearGradient(0, baseY - ch * 1.5, 0, baseY + ch * 0.1);
  g.addColorStop(0, top);
  g.addColorStop(0.5, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(cx - cw, baseY - ch * 2.2, cw * 2, ch * 2.6);
  ctx.restore();
}

export function paintClouds(ctx: Ctx, sc: Scene, rng: Rng, w: number, h: number): void {
  const cd = sc.grade.cloud;
  const cover = clamp(Math.max(cd.coverMin, sc.def.cloudCover * cd.coverMul), 0, 1);
  const light = hexToRgb(cd.light);
  const shade = hexToRgb(cd.shade);
  const top = rgbToCss(cd.underlit ? shade : light);
  const bottom = rgbToCss(cd.underlit ? light : shade);

  if (cover > 0.8) {
    // Overcast: a grey veil that thins toward the horizon, then heavy slabs on top.
    const veil = ctx.createLinearGradient(0, 0, 0, h);
    veil.addColorStop(0, rgbToCss(shade, 0.6));
    veil.addColorStop(0.6, rgbToCss(mixRgb(shade, light, 0.5), 0.34));
    veil.addColorStop(1, rgbToCss(light, 0));
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, w, h);
  }

  // High, wispy streaks first.
  const streaks = Math.round(lerp(5, 12, cover));
  for (let i = 0; i < streaks; i++) {
    const x = rng() * w;
    const y = range(rng, 20, h * 0.8);
    const len = range(rng, 120, 320);
    wrappedSeeded(w, x, len, rng, (cx, r) => {
      ctx.fillStyle = rgbToCss(mixRgb(light, shade, 0.3), cd.alpha * range(r, 0.12, 0.26));
      ctx.beginPath();
      ctx.ellipse(cx, y, len * 0.5, range(r, 2, 5), range(r, -0.03, 0.03), 0, TAU);
      ctx.fill();
    });
  }

  // Cumulus, far (low, small, flat) to near (high, large).
  const count = Math.round(lerp(2, 20, cover));
  const rows: number[] = [];
  for (let i = 0; i < count; i++) rows.push(rng());
  rows.sort((a, b) => b - a);
  for (let i = 0; i < count; i++) {
    const f = rows[i];
    const baseY = lerp(54, h - 30, f);
    const cw = lerp(300, 96, f) * range(rng, 0.7, 1.35) * lerp(1, 1.4, cover);
    const ch = cw * lerp(0.2, 0.13, f) * range(rng, 0.85, 1.2);
    const a = cd.alpha * lerp(1, 0.55, f);
    const x = rng() * w;
    wrappedSeeded(w, x, cw * 0.5 + ch * 1.5, rng, (cx, r) => {
      paintCloud(ctx, r, cx, baseY, cw, ch, top, bottom, a);
    });
  }
}
