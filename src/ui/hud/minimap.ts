/**
 * The minimap strip: the whole front on one thin canvas.
 * Drawing reuses the typed arrays in MinimapState and allocates nothing.
 */
import type { MinimapState } from '../contracts';

/** Blank margin at each end of the strip so the HQ blocks are not clipped (CSS px). */
export const MINIMAP_PAD = 4;

const COL_SKY = '#1b1d14';
const COL_GROUND = '#34301f';
const COL_GROUND_EDGE = '#5f5331';
const COL_NEUTRAL = '#7a7460';
const COL_OUTLINE = '#0c0d08';
const COL_CAM_FILL = 'rgba(233, 223, 195, 0.16)';
const COL_CAM_EDGE = '#e9dfc3';
const COL_RUBBLE = '#4a4636';
/** Unit dots are drawn in the side colour mixed this far toward white, so they stand out from structures. */
const DOT_LIGHTEN = 0.5;

/** Mix a "#rrggbb" colour toward white. Anything else is returned unchanged. */
export function lighten(color: string, amount: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  const n = parseInt(color.slice(1), 16);
  const mix = (c: number): number => Math.round(c + (255 - c) * amount);
  return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}

export class MinimapView {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private w = 0;
  private h = 0;
  private scale = 1;
  private src0 = '';
  private src1 = '';
  private dot0 = '';
  private dot1 = '';

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  /** Match the backing store to the CSS size. Returns true if it changed (the strip then needs a redraw). */
  resize(cssW: number, cssH: number, dpr: number): boolean {
    const w = Math.max(1, Math.round(cssW * dpr));
    const h = Math.max(1, Math.round(cssH * dpr));
    if (w === this.w && h === this.h) return false;
    this.w = w;
    this.h = h;
    this.scale = dpr;
    this.canvas.width = w;
    this.canvas.height = h;
    return true;
  }

  draw(m: MinimapState): void {
    const ctx = this.ctx;
    if (!ctx || this.w <= 1 || !(m.length > 0)) return;
    const w = this.w;
    const h = this.h;
    const s = this.scale;
    const pad = MINIMAP_PAD * s;
    const k = (w - pad * 2) / m.length;
    const ground = Math.round(h * 0.66);
    const col0 = m.colors[0];
    const col1 = m.colors[1];
    if (col0 !== this.src0) {
      this.src0 = col0;
      this.dot0 = lighten(col0, DOT_LIGHTEN);
    }
    if (col1 !== this.src1) {
      this.src1 = col1;
      this.dot1 = lighten(col1, DOT_LIGHTEN);
    }

    ctx.fillStyle = COL_SKY;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = COL_GROUND;
    ctx.fillRect(0, ground, w, h - ground);
    // The ground by sector (FOUNDATIONS.md 4.1): each stretch in its own shade.
    const sectorColor = m.sectorColor;
    const from = m.sectorFrom;
    const to = m.sectorTo;
    if (sectorColor && from && to) {
      for (let i = 0; i < sectorColor.length; i++) {
        const x0 = Math.round(pad + from[i] * k);
        const x1 = Math.round(pad + to[i] * k);
        ctx.fillStyle = sectorColor[i];
        ctx.fillRect(x0, ground, Math.max(1, x1 - x0), h - ground);
      }
    }
    ctx.fillStyle = COL_GROUND_EDGE;
    ctx.fillRect(0, ground, w, Math.max(1, Math.round(s * 0.5)));

    // Capture points (FOUNDATIONS.md 4.5): a flag on a pole, in the holder's colour.
    const pointX = m.pointX;
    const pointOwner = m.pointOwner;
    const points = m.pointCount ?? 0;
    if (pointX && pointOwner) {
      const poleH = Math.max(5, Math.round(ground * 0.55));
      const flagW = Math.max(3, Math.round(4 * s));
      const flagH = Math.max(2, Math.round(3 * s));
      const lw = Math.max(1, Math.round(s * 0.6));
      for (let i = 0; i < points; i++) {
        const x = Math.round(pad + pointX[i] * k);
        ctx.fillStyle = COL_CAM_EDGE;
        ctx.fillRect(x, ground - poleH, lw, poleH);
        const owner = pointOwner[i];
        ctx.fillStyle = owner === 0 ? col0 : owner === 1 ? col1 : COL_NEUTRAL;
        ctx.fillRect(x + lw, ground - poleH, flagW, flagH);
      }
    }

    // Trenches: a notch cut into the ground, coloured by whoever holds it.
    const trenchH = Math.max(2, Math.round(3 * s));
    for (let i = 0; i < m.trenchCount; i++) {
      const tw = Math.max(3 * s, m.trenchW[i] * k);
      const owner = m.trenchOwner[i];
      ctx.fillStyle = owner === 0 ? col0 : owner === 1 ? col1 : COL_NEUTRAL;
      ctx.fillRect(Math.round(pad + m.trenchX[i] * k - tw / 2), ground + Math.round(s), Math.round(tw), trenchH);
    }

    // Pillboxes: squat blocks on the ground line.
    const pb = Math.max(3, Math.round(4 * s));
    for (let i = 0; i < m.pillboxCount; i++) {
      const x = Math.round(pad + m.pillboxX[i] * k - pb / 2);
      ctx.fillStyle = COL_OUTLINE;
      ctx.fillRect(x - 1, ground - pb - 1, pb + 2, pb + 1);
      ctx.fillStyle = m.pillboxSide[i] === 0 ? col0 : col1;
      ctx.fillRect(x, ground - pb, pb, pb);
    }

    // HQ bunkers: tall blocks at each end, rubble once destroyed.
    const hqW = Math.max(4, Math.round(6 * s));
    const hqH = Math.round(ground * 0.72);
    for (let side = 0; side < 2; side++) {
      const hq = m.hq[side];
      if (hq === null) continue;
      const x = Math.round(pad + hq.x * k - hqW / 2);
      if (hq.hp > 0) {
        ctx.fillStyle = COL_OUTLINE;
        ctx.fillRect(x - 1, ground - hqH - 1, hqW + 2, hqH + 1);
        ctx.fillStyle = side === 0 ? col0 : col1;
        ctx.fillRect(x, ground - hqH, hqW, hqH);
      } else {
        ctx.fillStyle = COL_RUBBLE;
        ctx.fillRect(x, ground - Math.round(hqH * 0.3), hqW, Math.round(hqH * 0.3));
      }
    }

    // Units: one dot each, vehicles larger.
    const dot = Math.max(2, Math.round(2 * s));
    const bigDot = Math.max(3, Math.round(3.5 * s));
    for (let i = 0; i < m.unitCount; i++) {
      const d = m.unitBig[i] === 1 ? bigDot : dot;
      ctx.fillStyle = m.unitSide[i] === 0 ? this.dot0 : this.dot1;
      ctx.fillRect(Math.round(pad + m.unitX[i] * k - d / 2), ground - d - Math.round(s * 0.5), d, d);
    }

    // Camera window.
    const cx = pad + m.camX * k;
    const cw = Math.max(4 * s, m.camW * k);
    const lw = Math.max(1, Math.round(1.5 * s));
    ctx.fillStyle = COL_CAM_FILL;
    ctx.fillRect(cx, 0, cw, h);
    ctx.fillStyle = COL_CAM_EDGE;
    ctx.fillRect(cx, 0, cw, lw);
    ctx.fillRect(cx, h - lw, cw, lw);
    ctx.fillRect(cx, 0, lw, h);
    ctx.fillRect(cx + cw - lw, 0, lw, h);
  }
}
