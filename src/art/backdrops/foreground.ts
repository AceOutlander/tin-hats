/**
 * The foreground strip: a sparse scatter of things close to the camera that
 * slide past faster than the ground. Everything stays below
 * BACKDROP.foregroundLimit so it can never cover a unit, and is dark but not
 * black so it cannot be mistaken for one.
 */
import { BACKDROP, type ForegroundItem } from '../../data/theatres';
import { disc, lerp, line, rock, rubblePile, wrappedSeeded, type Ctx } from './kit';
import { range, type Rng } from './rng';
import type { Scene } from './scene';

interface Placed {
  item: ForegroundItem;
  x: number;
  base: number;
}

interface Inks {
  dark: string;
  mid: string;
  accent: string;
  pale: string;
}

/** Tapered blade from a root point to a tip, bending through a control point. */
function blade(ctx: Ctx, x: number, base: number, tipX: number, tipY: number, halfWidth: number): void {
  const cxm = x + (tipX - x) * 0.25;
  const cym = base + (tipY - base) * 0.65;
  ctx.beginPath();
  ctx.moveTo(x - halfWidth, base);
  ctx.quadraticCurveTo(cxm - halfWidth * 0.6, cym, tipX, tipY);
  ctx.quadraticCurveTo(cxm + halfWidth * 0.6, cym, x + halfWidth, base);
  ctx.closePath();
  ctx.fill();
}

function grassClump(ctx: Ctx, rng: Rng, x: number, base: number, h: number, spreadW: number, lean: number, inks: Inks): void {
  const blades = 9 + Math.floor(rng() * 6);
  for (let i = 0; i < blades; i++) {
    const ox = range(rng, -0.5, 0.5) * spreadW;
    const len = h * range(rng, 0.45, 1);
    const tipX = x + ox + (ox / spreadW) * len * 0.9 + lean * len;
    ctx.fillStyle = i % 3 === 0 ? inks.mid : inks.dark;
    blade(ctx, x + ox * 0.5, base, tipX, base - len, Math.max(0.7, h * 0.045));
  }
}

function drawItem(ctx: Ctx, rng: Rng, item: ForegroundItem, x: number, base: number, s: number, room: number, inks: Inks, light: number): void {
  switch (item) {
    case 'tuft': {
      grassClump(ctx, rng, x, base, Math.min(room, s * range(rng, 16, 30)), s * 18, range(rng, -0.15, 0.15), inks);
      break;
    }
    case 'flower': {
      const h = Math.min(room, s * range(rng, 16, 26));
      grassClump(ctx, rng, x, base, h * 0.8, s * 16, 0, inks);
      const stems = 2 + Math.floor(rng() * 3);
      for (let i = 0; i < stems; i++) {
        const ox = range(rng, -0.5, 0.5) * s * 16;
        const top = base - h * range(rng, 0.75, 1);
        ctx.strokeStyle = inks.mid;
        ctx.lineWidth = Math.max(0.6, s * 0.7);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x + ox * 0.6, base);
        ctx.quadraticCurveTo(x + ox * 0.7, (base + top) / 2, x + ox, top);
        ctx.stroke();
        ctx.fillStyle = i % 2 === 0 ? inks.accent : inks.pale;
        disc(ctx, x + ox, top, s * 1.9);
      }
      break;
    }
    case 'stone': {
      const wid = s * range(rng, 14, 30);
      rock(ctx, rng, x, base, wid, Math.min(room, wid * range(rng, 0.4, 0.6)), inks.mid, inks.dark, light);
      break;
    }
    case 'post': {
      const h = Math.min(room, s * range(rng, 40, 56));
      const pw = s * 4.6;
      const lean = range(rng, -0.12, 0.12) * h;
      ctx.fillStyle = inks.dark;
      ctx.beginPath();
      ctx.moveTo(x - pw / 2, base);
      ctx.lineTo(x + lean - pw / 2, base - h);
      ctx.lineTo(x + lean + pw / 2, base - h + pw * 0.5);
      ctx.lineTo(x + pw / 2, base);
      ctx.fill();
      ctx.fillStyle = inks.mid;
      const e = light < 0 ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(x + (e * pw) / 2, base);
      ctx.lineTo(x + lean + (e * pw) / 2, base - h + (e > 0 ? pw * 0.5 : 0));
      ctx.lineTo(x + lean + e * pw * 0.12, base - h + pw * 0.3);
      ctx.lineTo(x + e * pw * 0.12, base);
      ctx.fill();
      // A slack strand of old wire.
      ctx.strokeStyle = inks.dark;
      ctx.lineWidth = Math.max(0.5, s * 0.5);
      ctx.lineCap = 'round';
      const wy = base - h * 0.72;
      const dir = rng() < 0.5 ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(x + lean * 0.72, wy);
      ctx.quadraticCurveTo(x + dir * s * 12, wy + s * 10, x + dir * s * 22, base - s * 2);
      ctx.stroke();
      grassClump(ctx, rng, x, base, Math.min(room, s * 12), s * 12, 0, inks);
      break;
    }
    case 'scrub': {
      const h = Math.min(room, s * range(rng, 14, 24));
      const twigs = 10 + Math.floor(rng() * 6);
      ctx.lineCap = 'round';
      for (let i = 0; i < twigs; i++) {
        const a = -Math.PI / 2 + range(rng, -1.15, 1.15);
        const len = h * range(rng, 0.55, 1);
        const ex = x + Math.cos(a) * len * 1.1;
        const ey = base + Math.sin(a) * len;
        ctx.strokeStyle = i % 3 === 0 ? inks.mid : inks.dark;
        ctx.lineWidth = Math.max(0.6, s * 0.8);
        ctx.beginPath();
        ctx.moveTo(x, base);
        ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.4, base - len * 0.55, ex, ey);
        ctx.stroke();
        if (rng() < 0.6) {
          ctx.fillStyle = inks.mid;
          disc(ctx, ex, ey, s * range(rng, 0.9, 1.6));
        }
      }
      break;
    }
    case 'reed': {
      const lean = (rng() < 0.8 ? 1 : -1) * range(rng, 0.25, 0.5);
      grassClump(ctx, rng, x, base, Math.min(room, s * range(rng, 24, 38)), s * 12, lean, inks);
      break;
    }
    case 'rubble': {
      const wid = s * range(rng, 26, 48);
      rubblePile(ctx, rng, x, base, wid, Math.min(room, s * range(rng, 7, 13)), inks.mid, inks.dark, light);
      ctx.fillStyle = inks.accent;
      const bw = s * 6;
      ctx.fillRect(x + wid * range(rng, -0.3, 0.3), base - bw * 0.5, bw, bw * 0.45);
      break;
    }
    case 'stump': {
      const h = Math.min(room, s * range(rng, 12, 20));
      const sw = s * range(rng, 11, 15);
      ctx.fillStyle = inks.dark;
      ctx.beginPath();
      ctx.moveTo(x - sw * 0.85, base);
      ctx.quadraticCurveTo(x - sw * 0.5, base - h * 0.3, x - sw * 0.5, base - h * 0.8);
      ctx.lineTo(x - sw * 0.3, base - h * 1.25);
      ctx.lineTo(x - sw * 0.1, base - h * 0.9);
      ctx.lineTo(x + sw * 0.15, base - h * 1.45);
      ctx.lineTo(x + sw * 0.3, base - h * 0.85);
      ctx.lineTo(x + sw * 0.5, base - h);
      ctx.quadraticCurveTo(x + sw * 0.5, base - h * 0.3, x + sw * 0.85, base);
      ctx.fill();
      ctx.fillStyle = inks.mid;
      const e = light < 0 ? -1 : 1;
      ctx.fillRect(x + (e < 0 ? -sw * 0.5 : sw * 0.26), base - h * 0.78, sw * 0.24, h * 0.7);
      break;
    }
    case 'fern': {
      const fronds = 4 + Math.floor(rng() * 3);
      const h = Math.min(room, s * range(rng, 18, 30));
      ctx.lineCap = 'round';
      for (let i = 0; i < fronds; i++) {
        const dir = (i / (fronds - 1)) * 2 - 1 + range(rng, -0.15, 0.15);
        const len = h * range(rng, 0.7, 1) * (1 - Math.abs(dir) * 0.25);
        const tipX = x + dir * len * 0.95;
        const tipY = base - len * (1 - Math.abs(dir) * 0.55);
        const cx1 = x + dir * len * 0.25;
        const cy1 = base - len * 0.95;
        ctx.strokeStyle = i % 2 === 0 ? inks.dark : inks.mid;
        ctx.lineWidth = Math.max(0.6, s * 0.8);
        ctx.beginPath();
        ctx.moveTo(x, base);
        ctx.quadraticCurveTo(cx1, cy1, tipX, tipY);
        ctx.stroke();
        // Leaflets, shrinking toward the tip.
        const steps = 8;
        ctx.lineWidth = Math.max(0.5, s * 0.7);
        ctx.beginPath();
        for (let k = 2; k < steps; k++) {
          const t = k / steps;
          const u = 1 - t;
          const px = u * u * x + 2 * u * t * cx1 + t * t * tipX;
          const py = u * u * base + 2 * u * t * cy1 + t * t * tipY;
          const ll = s * 4.2 * u + s * 0.6;
          ctx.moveTo(px - ll * 0.5, py - ll * 0.6);
          ctx.lineTo(px, py);
          ctx.lineTo(px + ll * 0.5, py + ll * 0.75);
        }
        ctx.stroke();
      }
      break;
    }
    case 'bollard': {
      const h = Math.min(room, s * range(rng, 20, 26));
      const bw = s * 9;
      ctx.fillStyle = inks.dark;
      ctx.fillRect(x - bw / 2, base - h * 0.8, bw, h * 0.8);
      ctx.beginPath();
      ctx.ellipse(x, base - h * 0.82, bw * 0.72, h * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x - bw * 0.62, base - h * 0.12, bw * 1.24, h * 0.12);
      ctx.fillStyle = inks.mid;
      const e = light < 0 ? -1 : 1;
      ctx.fillRect(x + (e < 0 ? -bw / 2 : bw * 0.22), base - h * 0.68, bw * 0.28, h * 0.56);
      ctx.strokeStyle = inks.mid;
      ctx.lineWidth = Math.max(0.6, s * 0.9);
      line(ctx, x - bw / 2, base - h * 0.5, x + bw / 2, base - h * 0.5);
      break;
    }
  }
}

/** Paint the foreground strip. The context is in view-space y. */
export function paintForeground(ctx: Ctx, sc: Scene, rng: Rng, w: number): void {
  const P = sc.pal;
  const inks: Inks = {
    dark: sc.tone(P.fg),
    mid: sc.tone(P.fgAlt),
    accent: sc.tone(P.roof, 0, 0.9),
    pale: sc.tone(P.pale, 0, 0.8),
  };

  const placed: Placed[] = [];
  for (const entry of sc.def.foreground) {
    for (let i = 0; i < entry.count; i++) {
      placed.push({
        item: entry.item,
        x: rng() * w,
        base: lerp(BACKDROP.foregroundBaseMin, BACKDROP.foregroundBaseMax, Math.pow(rng(), 0.8)),
      });
    }
  }
  // Space the items out: nudge any that land on top of a neighbour.
  placed.sort((a, b) => a.x - b.x);
  const minGap = w / (placed.length * 2.2);
  for (let i = 1; i < placed.length; i++) {
    if (placed[i].x - placed[i - 1].x < minGap) placed[i].x = placed[i - 1].x + minGap;
  }
  placed.sort((a, b) => a.base - b.base);

  const span = BACKDROP.foregroundBaseMax - BACKDROP.foregroundBaseMin;
  for (const p of placed) {
    const s = lerp(0.85, 1.5, (p.base - BACKDROP.foregroundBaseMin) / span);
    const room = p.base - BACKDROP.foregroundLimit;
    const x = p.x % w;
    wrappedSeeded(w, x, 70, rng, (cx, r) => drawItem(ctx, r, p.item, cx, p.base, s, room, inks, sc.light));
  }
}
