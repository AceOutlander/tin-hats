/**
 * Canvas 2D reference renderer: draws the same parts with the same layout the
 * Phaser renderer uses (for the dev page, HUD icons and portraits).
 */
import { FIGURE } from '../../data/figure';
import type { FactionId, UnitAction, UnitKind } from '../../data/schema';
import { updateFigure } from './animate';
import { createFigureLayout, layoutFigure, type FigurePart } from './layout';
import { figureSpriteMap } from './parts';
import { createFigureAnim, createFigureInput, isFigureKind, type FigureAnim } from './pose';

const LAYOUT: FigurePart[] = createFigureLayout();

/** Draw laid-out parts into ctx (figure space; set up the transform first). */
export function drawFigureParts(ctx: CanvasRenderingContext2D, parts: readonly FigurePart[]): void {
  const map = figureSpriteMap();
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (!p.visible) continue;
    const s = map.get(p.key);
    if (!s) continue;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.scale(p.scaleX, p.scaleY);
    ctx.translate(-s.ax * s.w, -s.ay * s.h);
    s.draw(ctx);
    ctx.restore();
  }
}

/**
 * Draw one figure at the context's current origin (figure space: y up is
 * negative, +x the facing). Mirror with ctx.scale(-1, 1) to face left.
 */
export function drawFigure2d(ctx: CanvasRenderingContext2D, anim: FigureAnim): void {
  layoutFigure(anim, LAYOUT);
  drawFigureParts(ctx, LAYOUT);
}

/** Bounding box of the visible parts, written to out as [x0, y0, x1, y1]. */
export function figureBounds(parts: readonly FigurePart[], out: Float64Array): void {
  const map = figureSpriteMap();
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of parts) {
    if (!p.visible) continue;
    const s = map.get(p.key);
    if (!s) continue;
    const c = Math.cos(p.rotation);
    const sn = Math.sin(p.rotation);
    for (let k = 0; k < 4; k++) {
      const lx = ((k & 1 ? s.w : 0) - s.ax * s.w) * p.scaleX;
      const ly = ((k & 2 ? s.h : 0) - s.ay * s.h) * p.scaleY;
      const x = p.x + lx * c - ly * sn;
      const y = p.y + lx * sn + ly * c;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  out[0] = x0;
  out[1] = y0;
  out[2] = x1;
  out[3] = y1;
}

/** Portrait pose per kind: the action that shows off the unit best. */
const ICON_POSE: Record<string, { action: UnitAction; carrying: boolean; time: number }> = {
  sapper: { action: 'idle', carrying: true, time: 1.6 },
  rifle: { action: 'aim', carrying: false, time: 1.4 },
  lmg: { action: 'idle', carrying: false, time: 1.4 },
  assault: { action: 'aim', carrying: false, time: 1.4 },
  mortar: { action: 'aim', carrying: false, time: 2.0 },
  sniper: { action: 'aim', carrying: false, time: 1.6 },
  medic: { action: 'idle', carrying: false, time: 1.4 },
  at: { action: 'aim', carrying: false, time: 1.6 },
};

const BOUNDS = new Float64Array(4);

/**
 * Paint a portrait of one unit kind into a canvas of any size (uses the
 * canvas's pixel size). Returns false for kinds that are not stick figures.
 */
export function paintUnitIcon(canvas: HTMLCanvasElement, kind: UnitKind, faction: FactionId): boolean {
  const ctx = canvas.getContext('2d');
  if (!ctx || !isFigureKind(kind)) return false;
  const pose = ICON_POSE[kind];
  const anim = createFigureAnim(kind, faction, 3);
  anim.altAim = false;
  const input = createFigureInput(kind);
  input.action = pose.action;
  input.carrying = pose.carrying;
  const steps = Math.round(pose.time * 60);
  for (let i = 0; i < steps; i++) updateFigure(anim, input, 1 / 60);
  const parts = createFigureLayout();
  layoutFigure(anim, parts);
  figureBounds(parts, BOUNDS);
  const bw = BOUNDS[2] - BOUNDS[0];
  const bh = BOUNDS[3] - BOUNDS[1];
  const W = canvas.width;
  const H = canvas.height;
  const m = FIGURE.icon.margin;
  const scale = Math.min((W * (1 - 2 * m)) / bw, (H * (1 - 2 * m)) / bh);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.translate(W / 2, H / 2);
  ctx.scale(scale, scale);
  ctx.translate(-(BOUNDS[0] + BOUNDS[2]) / 2, -(BOUNDS[1] + BOUNDS[3]) / 2);
  drawFigureParts(ctx, parts);
  ctx.restore();
  return true;
}
