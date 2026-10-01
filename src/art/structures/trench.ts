/**
 * Trench kit for any width.
 *
 * Two layers: the BACK piece (far lip with a low sandbag parados, timber-
 * revetted back wall, floor and duckboards) draws behind the units at
 * DEPTH.trenchBack; the FRONT piece (sandbag parapet on an earth berm) draws
 * over the occupants' legs at DEPTH.trenchFront. Occupants sink
 * TRENCH_LAYOUT.sink (= VIEW.trenchDepth).
 *
 * Each layer comes as a left cap, a tileable middle and a right cap (see
 * tileSpan in ./span), all with their origin at the piece's left edge on the
 * trench's ground line. trenchSpec() also builds a ready-made one-piece
 * sprite for a given width, with its origin at the centre.
 */
import { ART_COLORS as C, TRENCH_LAYOUT as T } from '../../data/artLayout';
import { type Ctx, TAU, bagCourse, looseBag, makeSpec, mix, rgba, rimRect, rimmed, sandbag } from '../props/kit';
import type { SpriteSpec } from '../types';
import { createTileSpan, tileSpan } from './span';

export type TrenchLayer = 'back' | 'front';

export const TRENCH_KEYS = {
  backCapL: 'st/trench/back/capL',
  backMid: 'st/trench/back/mid',
  backCapR: 'st/trench/back/capR',
  frontCapL: 'st/trench/front/capL',
  frontMid: 'st/trench/front/mid',
  frontCapR: 'st/trench/front/capR',
} as const;

/** Key of the one-piece sprite built by trenchSpec(). */
export function trenchKey(layer: TrenchLayer, width: number): string {
  return `st/trench/${layer}/w${Math.round(width)}`;
}

const BACK_TOP = -T.backOy;
const BACK_BOTTOM = T.backH - T.backOy;
const FRONT_TOP = -T.frontOy;
const FRONT_BOTTOM = T.frontH - T.frontOy;
/** Pieces are painted this much wider than their box so neighbours never show a seam. */
const BLEED = 0.75;

const WALL = mix(C.timberDark, C.earthDark, 0.35);
const FLOOR = C.earthDark;

function wallPlanks(ctx: Ctx, x0: number, x1: number): void {
  ctx.fillStyle = WALL;
  ctx.fillRect(x0, T.lipY, x1 - x0, T.floorY - T.lipY);
  ctx.lineCap = 'butt';
  for (let y = T.lipY + 6; y < T.floorY - 1; y += 6) {
    ctx.fillStyle = rgba(C.void, 0.55);
    ctx.fillRect(x0, y, x1 - x0, 0.9);
    ctx.fillStyle = rgba(C.timberRim, 0.22);
    ctx.fillRect(x0, y + 0.9, x1 - x0, 0.7);
  }
}

function wallFoot(ctx: Ctx, x0: number, x1: number): void {
  const g = ctx.createLinearGradient(0, T.floorY - 2, 0, T.floorY + 7);
  g.addColorStop(0, rgba(C.void, 0.65));
  g.addColorStop(1, rgba(C.void, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x0, T.floorY - 2, x1 - x0, 9);
}

function lipEdge(ctx: Ctx, x0: number, x1: number): void {
  ctx.fillStyle = C.earth;
  ctx.fillRect(x0, T.lipY - 2.5, x1 - x0, 3.5);
  ctx.fillStyle = rgba(C.earthRim, 0.9);
  ctx.fillRect(x0, T.lipY - 2.5, x1 - x0, 1);
}

function post(ctx: Ctx, x: number): void {
  rimRect(ctx, x, T.lipY - 3, 4.6, T.floorY - T.lipY + 4, 1, C.timber, C.timberRim, 1);
  ctx.fillStyle = rgba(C.timberRim, 0.5);
  ctx.fillRect(x, T.lipY - 2, 0.9, T.floorY - T.lipY + 2);
}

/** Duckboards: two rails with slats across them. Slats sit at slatPhase + 6k. */
function duckboards(ctx: Ctx, x0: number, x1: number, slatPhase: number): void {
  ctx.fillStyle = C.timberDark;
  ctx.fillRect(x0, 0.5, x1 - x0, 1.8);
  ctx.fillRect(x0, 11.5, x1 - x0, 1.8);
  for (let x = slatPhase + Math.ceil((x0 - slatPhase) / 6) * 6; x < x1; x += 6) {
    rimRect(ctx, x, -2.5, 3.6, 18.5, 0.7, C.timber, C.timberRim, 0.9);
  }
}

function paintBackMid(ctx: Ctx): void {
  const x0 = -BLEED;
  const x1 = T.tileW + BLEED;
  ctx.fillStyle = FLOOR;
  ctx.fillRect(x0, T.floorY, x1 - x0, BACK_BOTTOM - T.floorY);
  duckboards(ctx, x0, x1, 1.5);
  wallPlanks(ctx, x0, x1);
  post(ctx, 9);
  post(ctx, 45);
  wallFoot(ctx, x0, x1);
  lipEdge(ctx, x0, x1);
  bagCourse(ctx, x0, x1, T.lipY - T.bagH + 0.5, T.bagW, T.bagH, 0);
}

/** Left end of the pit: the back wall turns the corner into a sloped earth end wall. */
function paintBackCapL(ctx: Ctx): void {
  const x1 = T.capW + BLEED;
  // Floor with a rounded far corner.
  ctx.fillStyle = FLOOR;
  ctx.beginPath();
  ctx.moveTo(x1, T.floorY);
  ctx.lineTo(24, T.floorY);
  ctx.quadraticCurveTo(13, T.floorY, 12, T.floorY + 13);
  ctx.lineTo(12, BACK_BOTTOM);
  ctx.lineTo(x1, BACK_BOTTOM);
  ctx.closePath();
  ctx.fill();
  // The duckboards stop short of the end.
  ctx.save();
  ctx.beginPath();
  ctx.rect(18, -4, x1 - 18, 20);
  ctx.clip();
  duckboards(ctx, 18, x1, T.capW + 1.5 - 18);
  ctx.restore();
  wallPlanks(ctx, 22, x1);
  wallFoot(ctx, 22, x1);
  // Earth end wall.
  rimmed(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(24, T.lipY);
      c.quadraticCurveTo(5, T.lipY, 4, T.lipY + 19);
      c.lineTo(4, BACK_BOTTOM);
      c.lineTo(12, BACK_BOTTOM);
      c.lineTo(12, T.floorY + 13);
      c.quadraticCurveTo(13, T.floorY, 24, T.floorY);
      c.closePath();
    },
    mix(C.earth, C.earthDark, 0.45),
    C.earthRim,
    0.2,
    1,
  );
  ctx.strokeStyle = rgba(C.void, 0.4);
  ctx.lineWidth = 0.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(9, T.lipY + 12);
  ctx.lineTo(8, T.lipY + 30);
  ctx.moveTo(16, T.lipY + 6);
  ctx.lineTo(14.5, T.lipY + 19);
  ctx.stroke();
  lipEdge(ctx, 21, x1);
  // Sandbags follow the lip round the corner and down the end of the pit.
  sandbag(ctx, -1, 6, 12, 9, -0.2);
  sandbag(ctx, -1, -3, 12, 9, 0.2);
  sandbag(ctx, -1, -12, 12, 9, -0.1);
  sandbag(ctx, 0, -21, 12, 9, 0.1);
  looseBag(ctx, 9.5, T.lipY - 2.5, -0.62, -0.2, 15, 9);
  bagCourse(ctx, T.capW - T.bagW, x1, T.lipY - T.bagH + 0.5, T.bagW, T.bagH, T.capW);
}

/** Ragged lower edge of the berm; periods divide the tile width so it tiles. */
function bermBottom(x: number): number {
  return T.parapetBottomY - 3.2 + 2 * Math.sin((x / 36) * TAU) + 1.2 * Math.sin((x / 24) * TAU + 1);
}

function berm(ctx: Ctx, x0: number, x1: number, phase: number, taperLeft: boolean): void {
  ctx.beginPath();
  if (taperLeft) {
    ctx.moveTo(x1, T.parapetTopY + 16);
    ctx.lineTo(10, T.parapetTopY + 16);
    ctx.quadraticCurveTo(2, T.parapetTopY + 20, 1.5, T.parapetTopY + 32);
    ctx.quadraticCurveTo(2, bermBottom(8 - phase) - 2, 9, bermBottom(9 - phase));
    for (let x = 10; x <= x1; x += 1.5) ctx.lineTo(x, bermBottom(x - phase));
  } else {
    ctx.moveTo(x1, T.parapetTopY + 16);
    ctx.lineTo(x0, T.parapetTopY + 16);
    for (let x = x0; x <= x1; x += 1.5) ctx.lineTo(x, bermBottom(x - phase));
  }
  ctx.lineTo(x1, bermBottom(x1 - phase));
  ctx.closePath();
  ctx.fillStyle = C.earth;
  ctx.fill();
}

/** Clods and stones on the berm; positions repeat every tile. */
function bermDetail(ctx: Ctx, phase: number, from: number, to: number): void {
  const marks = [5, 41.5, 3, 17, 44, 2, 30, 40.5, 3.5, 44, 43.5, 2.4, 57, 41, 3, 66, 44.5, 2];
  for (let k = -1; k <= 1; k++) {
    for (let i = 0; i < marks.length; i += 3) {
      const x = marks[i] + phase + k * T.tileW;
      if (x < from || x > to) continue;
      ctx.fillStyle = i % 2 === 0 ? rgba(C.earthRim, 0.75) : rgba(C.earthDark, 0.8);
      ctx.beginPath();
      ctx.ellipse(x, marks[i + 1] - 4, marks[i + 2], marks[i + 2] * 0.55, 0, 0, TAU);
      ctx.fill();
    }
  }
  const g = ctx.createLinearGradient(0, T.parapetBottomY - 12, 0, T.parapetBottomY);
  g.addColorStop(0, rgba(C.earthDark, 0));
  g.addColorStop(1, rgba(C.earthDark, 0.55));
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = g;
  ctx.fillRect(from, T.parapetBottomY - 12, to - from, 13);
  ctx.restore();
}

function paintFrontMid(ctx: Ctx): void {
  const x0 = -BLEED;
  const x1 = T.tileW + BLEED;
  const top = T.parapetTopY;
  berm(ctx, x0, x1, 0, false);
  bermDetail(ctx, 0, x0, x1);
  bagCourse(ctx, x0, x1, top + 16, T.bagW, T.bagH, 0, 2);
  bagCourse(ctx, x0, x1, top + 8, T.bagW, T.bagH, T.bagW / 2, 1);
  bagCourse(ctx, x0, x1, top, T.bagW, T.bagH, 0, 0);
  // One odd bag on top breaks the ruled line.
  sandbag(ctx, 29, top - 7.6, T.bagW - 1, T.bagH - 0.6, 0.25);
}

function paintFrontCapL(ctx: Ctx): void {
  const x1 = T.capW + BLEED;
  const top = T.parapetTopY;
  berm(ctx, 0, x1, T.capW, true);
  bermDetail(ctx, T.capW - T.tileW, 6, x1);
  // Courses step down toward the end; phases line up with the middle tile.
  sandbag(ctx, 1, top + 16, T.capW - T.bagW - 1, T.bagH, -0.2);
  sandbag(ctx, T.capW - T.bagW, top + 16, T.bagW, T.bagH, 0.1);
  sandbag(ctx, T.capW - T.bagW * 1.5, top + 8, T.bagW, T.bagH, 0.2);
  sandbag(ctx, T.capW - T.bagW * 0.5, top + 8, T.bagW, T.bagH, -0.3);
  sandbag(ctx, T.capW - T.bagW, top, T.bagW, T.bagH, 0);
}

function clipBox(ctx: Ctx, w: number, top: number, bottom: number): void {
  ctx.beginPath();
  ctx.rect(0, top, w, bottom - top);
  ctx.clip();
}

function mirrored(w: number, paint: (ctx: Ctx) => void): (ctx: Ctx) => void {
  return (ctx) => {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    paint(ctx);
  };
}

/** The six kit pieces. */
export function trenchKitSpecs(): SpriteSpec[] {
  const backCap = { w: T.capW, h: T.backH, ox: 0, oy: T.backOy };
  const backMid = { w: T.tileW, h: T.backH, ox: 0, oy: T.backOy };
  const frontCap = { w: T.capW, h: T.frontH, ox: 0, oy: T.frontOy };
  const frontMid = { w: T.tileW, h: T.frontH, ox: 0, oy: T.frontOy };
  return [
    makeSpec(TRENCH_KEYS.backCapL, backCap, paintBackCapL),
    makeSpec(TRENCH_KEYS.backMid, backMid, paintBackMid),
    makeSpec(TRENCH_KEYS.backCapR, backCap, mirrored(T.capW, paintBackCapL)),
    makeSpec(TRENCH_KEYS.frontCapL, frontCap, paintFrontCapL),
    makeSpec(TRENCH_KEYS.frontMid, frontMid, paintFrontMid),
    makeSpec(TRENCH_KEYS.frontCapR, frontCap, mirrored(T.capW, paintFrontCapL)),
  ];
}

/**
 * One-piece sprite of a whole trench layer `width` wu wide, assembled from
 * the kit exactly as tileSpan() lays it out. Origin = centre, on the ground line.
 */
export function trenchSpec(layer: TrenchLayer, width: number): SpriteSpec {
  const back = layer === 'back';
  const h = back ? T.backH : T.frontH;
  const oy = back ? T.backOy : T.frontOy;
  const top = back ? BACK_TOP : FRONT_TOP;
  const bottom = back ? BACK_BOTTOM : FRONT_BOTTOM;
  const cap = back ? paintBackCapL : paintFrontCapL;
  const mid = back ? paintBackMid : paintFrontMid;
  const span = tileSpan(width, T.capW, T.tileW, createTileSpan());
  const total = span.capRightX + T.capW - span.capLeftX;
  return makeSpec(trenchKey(layer, width), { w: total, h, ox: total / 2, oy }, (ctx) => {
    for (let i = 0; i < span.count; i++) {
      ctx.save();
      ctx.translate(span.firstX + i * span.step, 0);
      ctx.scale(span.scaleX, 1);
      clipBox(ctx, T.tileW + (i < span.count - 1 ? BLEED : 0), top, bottom);
      mid(ctx);
      ctx.restore();
    }
    ctx.save();
    ctx.translate(span.capLeftX, 0);
    clipBox(ctx, T.capW + BLEED * 0.5, top, bottom);
    cap(ctx);
    ctx.restore();
    ctx.save();
    ctx.translate(span.capRightX + T.capW, 0);
    ctx.scale(-1, 1);
    clipBox(ctx, T.capW + BLEED * 0.5, top, bottom);
    cap(ctx);
    ctx.restore();
  });
}
