/**
 * Barbed wire: crossed stakes with concertina coils, as a BACK strand and a
 * FRONT strand so units pass between them, plus a flattened destroyed tile.
 * Every piece is WIRE_LAYOUT.tileW wide, tiles seamlessly, and has its origin
 * at its left edge on its own ground line (see WIRE_LAYOUT.backDy / frontDy).
 */
import { ART_COLORS as C, WIRE_LAYOUT as W } from '../../data/artLayout';
import { type Ctx, TAU, makeSpec, rgba, strokeLine } from '../props/kit';
import type { SpriteSpec } from '../types';

export const WIRE_KEYS = {
  back: 'st/wire/back',
  front: 'st/wire/front',
  flat: 'st/wire/flat',
} as const;

const LOOPS_PER_TILE = 4;

/** A concertina coil as a looping curve; `squash` flattens it for the destroyed tile. */
function coil(ctx: Ctx, cy: number, radiusX: number, radiusY: number, phase: number, width: number, color: string): void {
  const pitch = W.tileW / LOOPS_PER_TILE;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  const from = -2 * TAU;
  const to = (LOOPS_PER_TILE + 2) * TAU;
  for (let a = from; a <= to; a += 0.2) {
    const x = phase + (a / TAU) * pitch + radiusX * Math.sin(a);
    const y = cy - radiusY * Math.cos(a);
    if (a === from) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

/** Barbs: tiny crossed ticks at regular steps round the coil. */
function barbs(ctx: Ctx, cy: number, radiusX: number, radiusY: number, phase: number, color: string): void {
  const pitch = W.tileW / LOOPS_PER_TILE;
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let a = -2 * TAU; a <= (LOOPS_PER_TILE + 2) * TAU; a += TAU / 5) {
    const x = phase + (a / TAU) * pitch + radiusX * Math.sin(a);
    const y = cy - radiusY * Math.cos(a);
    ctx.moveTo(x - 1.3, y - 1.1);
    ctx.lineTo(x + 1.3, y + 1.1);
    ctx.moveTo(x - 1.3, y + 1.1);
    ctx.lineTo(x + 1.3, y - 1.1);
  }
  ctx.stroke();
}

/** Two stakes driven in as an X, the classic wire picket. */
function crossedStakes(ctx: Ctx, x: number, height: number, spread: number): void {
  for (const s of [-1, 1]) {
    strokeLine(ctx, [x - s * spread, 2, x + s * spread * 0.75, -height], C.timberDark, 2.6);
    strokeLine(ctx, [x - s * spread - 0.6, 1.5, x + s * spread * 0.75 - 0.6, -height], rgba(C.timberRim, 0.75), 0.7);
  }
}

/** A taut strand sagging between pickets `span` apart. */
function strand(ctx: Ctx, y: number, sag: number, phase: number, span: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  for (let x = phase - span; x < W.tileW + span; x += span) {
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + span / 2, y + sag * 2, x + span, y);
  }
  ctx.stroke();
}

function paintStrand(ctx: Ctx, front: boolean): void {
  const wire = front ? C.ink : C.inkSoft;
  const glint = rgba(C.rim, front ? 0.55 : 0.4);
  const half = W.tileW / 2;
  const postPhase = front ? 7 : 23;
  const height = front ? 27 : 24;
  const cy = front ? -11.5 : -10.5;
  const ry = front ? 9.5 : 8.5;
  const coilPhase = front ? 3 : 11;
  // Rear coil, pickets, then the near coil over them.
  coil(ctx, cy - 2, 6, ry - 1.5, coilPhase + 8, 0.8, rgba(wire, 0.7));
  strand(ctx, -height + 3, 2.2, postPhase, half, rgba(wire, 0.85));
  for (let k = -1; k <= 2; k++) crossedStakes(ctx, postPhase + k * half, height, 6.5);
  coil(ctx, cy, 6.5, ry, coilPhase, front ? 1.15 : 1, wire);
  ctx.save();
  ctx.translate(-0.4, -0.45);
  coil(ctx, cy, 6.5, ry, coilPhase, 0.4, glint);
  ctx.restore();
  barbs(ctx, cy, 6.5, ry, coilPhase, wire);
}

/** Trampled or blown flat: squashed coils and snapped stakes on the ground. */
function paintFlat(ctx: Ctx): void {
  coil(ctx, -2.2, 7, 2.3, 5, 0.9, rgba(C.inkSoft, 0.9));
  coil(ctx, -3.6, 6.5, 2.8, 13, 1, C.ink);
  ctx.save();
  ctx.translate(-0.4, -0.4);
  coil(ctx, -3.6, 6.5, 2.8, 13, 0.4, rgba(C.rim, 0.45));
  ctx.restore();
  barbs(ctx, -3.6, 6.5, 2.8, 13, C.ink);
  const stakes = [6, -1, 21, -4, 37, 0.5, 50, -3.5, 27, 0.5, 29, -7, 58, 0.5, 59.5, -5.5];
  for (let i = 0; i < stakes.length; i += 4) {
    strokeLine(ctx, [stakes[i], stakes[i + 1], stakes[i + 2], stakes[i + 3]], C.timberDark, 2.4);
    strokeLine(ctx, [stakes[i], stakes[i + 1] - 0.7, stakes[i + 2], stakes[i + 3] - 0.7], rgba(C.timberRim, 0.7), 0.6);
  }
}

export function wireSpecs(): SpriteSpec[] {
  return [
    makeSpec(WIRE_KEYS.back, W.backBox, (ctx) => paintStrand(ctx, false)),
    makeSpec(WIRE_KEYS.front, W.frontBox, (ctx) => paintStrand(ctx, true)),
    makeSpec(WIRE_KEYS.flat, W.flatBox, paintFlat),
  ];
}
