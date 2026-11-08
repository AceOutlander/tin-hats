/**
 * Barbed wire, drawn END-ON (docs/AGENT_GUIDE.md, art rule): a belt runs across the battlefield, into the screen, so
 * each piece is a short, tall cross-section of concertina coil hung on crossed timber pickets, standing on the ground
 * line. A piece is two sprites sharing one box and origin (WIRE_LAYOUT): the BACK half (the far pickets and far loops)
 * draws behind the unit rows, the FRONT half (the near picket and near loops) over them. Two debris sprites replace a
 * destroyed piece: crushed flat by a tank, or blown apart by a shell.
 *
 * wirePieceLayout places one or a few pieces inside a belt of any data width, centred on it (pure, allocation free).
 */
import { ART_COLORS as C, WIRE_LAYOUT as W } from '../../data/artLayout';
import { type Ctx, TAU, makeSpec, rgba, strokeLine } from '../props/kit';
import type { SpriteSpec } from '../types';

export const WIRE_KEYS = {
  back: 'st/wire/back',
  front: 'st/wire/front',
  crushed: 'st/wire/crushed',
  cut: 'st/wire/cut',
} as const;

// ---------------------------------------------------------------------------
// Piece layout
// ---------------------------------------------------------------------------

/** Where the end-on pieces of one belt stand. */
export interface WirePieces {
  count: number;
  /** x of each piece's centre relative to the belt's centre (first `count` entries). */
  readonly x: Float64Array;
  /** Horizontal scale of every piece: 1, or less for a belt narrower than one piece. */
  scaleX: number;
}

export function createWirePieces(): WirePieces {
  return { count: 0, x: new Float64Array(W.maxPieces), scaleX: 1 };
}

/**
 * One piece per W.pitch of belt beyond the first piece's own width, up to W.maxPieces, spaced W.pitch apart and
 * centred on the belt, so every piece lies wholly inside `width`. Writes into `out` and returns it.
 */
export function wirePieceLayout(width: number, out: WirePieces): WirePieces {
  const w = Number.isFinite(width) ? Math.max(0, width) : 0;
  const n = Math.max(1, Math.min(W.maxPieces, 1 + Math.floor((w - W.pieceW) / W.pitch)));
  out.count = n;
  out.scaleX = w >= W.pieceW ? 1 : w / W.pieceW;
  for (let i = 0; i < out.x.length; i++) out.x[i] = i < n ? (i - (n - 1) / 2) * W.pitch : 0;
  return out;
}

// ---------------------------------------------------------------------------
// Painting
// ---------------------------------------------------------------------------

/** Deterministic 0..1 per (loop, salt), so the coil is irregular but identical every build. */
function h01(i: number, salt: number): number {
  const s = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** An X picket seen end-on: two timber stakes crossed, legs splayed on the ground, tops crossing above the coil. */
function picket(ctx: Ctx, x: number, y: number, s: number, wood: string, rim: string, rimAlpha: number): void {
  const lh = W.legHalf * s;
  const th = W.topHalf * s;
  const top = y - W.postH * s;
  for (const e of [-1, 1]) {
    strokeLine(ctx, [x - e * lh, y + 1, x + e * th, top], wood, W.postW * s);
    // Lit edge on the side toward the light.
    strokeLine(ctx, [x - e * lh - 0.55 * s, y + 0.6, x + e * th - 0.55 * s, top + 0.4], rgba(rim, rimAlpha), 0.75 * s);
  }
  // Binding wire round the crossing.
  const cy = y - W.postH * s * (lh / (lh + th));
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 0.8 * s;
  ctx.beginPath();
  ctx.moveTo(x - 2.2 * s, cy - 1.8 * s);
  ctx.lineTo(x + 2.2 * s, cy + 1.2 * s);
  ctx.moveTo(x - 2.2 * s, cy + 1.2 * s);
  ctx.lineTo(x + 2.2 * s, cy - 1.8 * s);
  ctx.stroke();
}

/** Centre, radii and tilt of coil loop i (0 = nearest). */
function loopGeom(i: number, out: Float64Array): void {
  const a = i * W.helixStep + h01(i, 1) * 0.5;
  out[0] = i * W.loopDx + Math.cos(a) * W.helixR;
  out[1] = W.coilY + i * W.loopDy + Math.sin(a) * W.helixR;
  const r = W.coilR + (h01(i, 3) - 0.5) * 2 * W.coilJitter;
  out[2] = r * (1 + (h01(i, 4) - 0.5) * 0.1);
  out[3] = r * (1 - h01(i, 5) * 0.08);
  out[4] = (h01(i, 6) - 0.5) * 0.6;
}

const G = new Float64Array(5);

/** One loop of concertina seen end-on: a slightly irregular ring with barbs ticked round it. */
function coilLoop(ctx: Ctx, i: number, color: string, width: number, glint: string | null): void {
  loopGeom(i, G);
  const cx = G[0];
  const cy = G[1];
  const rx = G[2];
  const ry = G[3];
  const rot = G[4];
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, rot, 0, TAU);
  ctx.stroke();
  if (glint) {
    // Light catching the upper-left of the ring.
    ctx.strokeStyle = glint;
    ctx.lineWidth = width * 0.4;
    ctx.beginPath();
    ctx.ellipse(cx - 0.35, cy - 0.35, rx, ry, rot, Math.PI * 1.05, Math.PI * 1.65);
    ctx.stroke();
  }
  // Barbs: small crossed ticks on the ring.
  const b = W.barbSize;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(0.6, width * 0.6);
  ctx.beginPath();
  const phase = h01(i, 7) * TAU;
  const cr = Math.cos(rot);
  const sr = Math.sin(rot);
  for (let k = 0; k < W.barbs; k++) {
    const a = phase + (k / W.barbs) * TAU;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const x = cx + rx * c * cr - ry * s * sr;
    const y = cy + rx * c * sr + ry * s * cr;
    ctx.moveTo(x - b, y - b * 0.8);
    ctx.lineTo(x + b, y + b * 0.8);
    ctx.moveTo(x - b, y + b * 0.8);
    ctx.lineTo(x + b, y - b * 0.8);
  }
  ctx.stroke();
}

/** Far half: two pickets receding into the screen and the far loops of the coil, darker with distance. */
function paintBack(ctx: Ctx): void {
  const far2 = W.farScale * W.farScale;
  picket(ctx, 2 * W.farDx, 2 * W.farDy, far2, rgba(C.timberDark, 0.75), C.timberRim, 0.3);
  for (let i = W.loops - 1; i >= W.nearLoops; i--) {
    const fade = (i - W.nearLoops) / Math.max(1, W.loops - 1 - W.nearLoops);
    coilLoop(ctx, i, rgba(C.inkSoft, 0.95 - fade * 0.35), W.farWireW, null);
  }
  picket(ctx, W.farDx, W.farDy, W.farScale, C.timberDark, C.timberRim, 0.5);
}

/** Near half: the near loops round the near picket, nearest loop on top. */
function paintFront(ctx: Ctx): void {
  const glint = rgba(C.rim, 0.6);
  for (let i = W.nearLoops - 1; i >= 1; i--) coilLoop(ctx, i, C.ink, W.wireW, glint);
  picket(ctx, 0, 0, 1, C.timber, C.timberRim, 0.8);
  coilLoop(ctx, 0, C.ink, W.wireW, glint);
}

/** A squashed loop lying on the ground. */
function flatLoop(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, rot: number, color: string, width: number): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, rot, 0, TAU);
  ctx.stroke();
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU + rot;
    const x = cx + rx * Math.cos(a);
    const y = cy + ry * Math.sin(a);
    ctx.moveTo(x - 1.2, y - 0.9);
    ctx.lineTo(x + 1.2, y + 0.9);
    ctx.moveTo(x - 1.2, y + 0.9);
    ctx.lineTo(x + 1.2, y - 0.9);
  }
  ctx.stroke();
}

/** Run over by a tank: the coil pressed into a flat tangle, the pickets snapped and lying in it. */
function paintCrushed(ctx: Ctx): void {
  const stakes = [-27, -1.2, 4, -4.4, -6, 0.2, 25, -2.6, 9, -0.6, 28, -3.8, -22, -4.8, -10, -1.4];
  for (let i = 0; i < stakes.length; i += 4) {
    strokeLine(ctx, [stakes[i], stakes[i + 1], stakes[i + 2], stakes[i + 3]], C.timberDark, 2.5);
    strokeLine(ctx, [stakes[i], stakes[i + 1] - 0.8, stakes[i + 2], stakes[i + 3] - 0.8], rgba(C.timberRim, 0.65), 0.6);
  }
  flatLoop(ctx, -12, -2.6, 15, 2.6, 0.04, rgba(C.inkSoft, 0.9), 0.9);
  flatLoop(ctx, 10, -3.0, 16, 3.0, -0.05, rgba(C.inkSoft, 0.9), 0.9);
  flatLoop(ctx, -2, -3.6, 18, 3.4, 0.02, C.ink, 1.1);
  flatLoop(ctx, 4, -2.4, 13, 2.2, -0.08, C.ink, 1.0);
  ctx.strokeStyle = rgba(C.rim, 0.45);
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.ellipse(-2.4, -4, 18, 3.4, 0.02, Math.PI * 1.1, Math.PI * 1.7);
  ctx.stroke();
}

/** Blown apart by a shell: two snapped stumps, broken tops lying on the ground, torn loops sagging off them. */
function paintCut(ctx: Ctx): void {
  strokeLine(ctx, [-13, 1, -7, -15], C.timberDark, 2.6);
  strokeLine(ctx, [12, 1, 8.5, -11], C.timberDark, 2.6);
  strokeLine(ctx, [-13.6, 0.6, -7.6, -15], rgba(C.timberRim, 0.6), 0.7);
  strokeLine(ctx, [11.4, 0.6, 7.9, -11], rgba(C.timberRim, 0.6), 0.7);
  // Splintered ends.
  strokeLine(ctx, [-7, -15, -5.8, -17.2], C.timber, 1.2);
  strokeLine(ctx, [8.5, -11, 10, -13], C.timber, 1.2);
  // The broken-off tops on the ground.
  strokeLine(ctx, [14, -1, 25, -3.5], C.timberDark, 2.3);
  strokeLine(ctx, [-24, -0.8, -15, -2.6], C.timberDark, 2.3);
  // Torn loops: arcs hanging from the stumps down to the ground, and loops lying slack.
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.05;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-7.5, -13);
  ctx.bezierCurveTo(-1, -16, 6, -12, 8.5, -9);
  ctx.moveTo(-7.5, -11);
  ctx.bezierCurveTo(-14, -9, -20, -6, -21, -0.5);
  ctx.moveTo(8.5, -9.5);
  ctx.bezierCurveTo(15, -8, 19, -4, 20, -0.4);
  ctx.stroke();
  flatLoop(ctx, -1, -3.2, 13, 3.2, 0.05, C.ink, 1.0);
  flatLoop(ctx, 3, -5.6, 9, 4.2, -0.2, rgba(C.inkSoft, 0.9), 0.85);
}

export function wireSpecs(): SpriteSpec[] {
  return [
    makeSpec(WIRE_KEYS.back, W.backBox, paintBack),
    makeSpec(WIRE_KEYS.front, W.frontBox, paintFront),
    makeSpec(WIRE_KEYS.crushed, W.crushedBox, paintCrushed),
    makeSpec(WIRE_KEYS.cut, W.cutBox, paintCut),
  ];
}
