/**
 * Trench kit for any width: a pit cut into the ground band, not a box standing on it.
 *
 * Two layers: the BACK piece (the spoil heaped behind the far lip, and the far wall of the pit falling
 * away into shadow) draws behind the units at DEPTH.trenchBack; the FRONT piece (the earth parapet thrown
 * up in front of the pit, with one course of sandbags bedded along its crest, its near face blending back
 * into the ground) draws over the occupants' lower bodies at DEPTH.trenchFront. Occupants stand on the
 * floor at VIEW.trenchFeetY, so only their heads and shoulders show above the cover line (bagTopY).
 *
 * Earth is painted in a TrenchPalette: the battle passes its theatre's ground and soil colours, so the
 * spoil matches the desert sand, the Italian chalk or the Dutch polder it was dug from. The fixed kit
 * pieces (dev pages) use the neutral base palette.
 *
 * Each layer comes as a left cap, a tileable middle and a right cap (see tileSpan in ./span), all with their
 * origin at the piece's left edge on the trench's ground line. trenchSpec() builds a ready-made one-piece
 * sprite for a given width (and palette), with its origin at the centre.
 */
import { ART_COLORS as C, TRENCH_LAYOUT as T } from '../../data/artLayout';
import { type Ctx, TAU, looseBag, makeSpec, mix, rgba, sandbag } from '../props/kit';
import type { SpriteSpec } from '../types';
import { createTileSpan, tileSpan } from './span';

export type TrenchLayer = 'back' | 'front';

/** Earth colours of one battlefield (CSS hex). `id` goes into the sprite keys. */
export interface TrenchPalette {
  id: string;
  /** Ground surface (lit). */
  ground: string;
  groundDark: string;
  /** Dug soil (walls, spoil). */
  soil: string;
  soilDark: string;
}

/** Neutral brown earth, for the fixed kit pieces. */
export const TRENCH_BASE_PALETTE: TrenchPalette = {
  id: 'base',
  ground: mix(C.earth, C.earthRim, 0.45),
  groundDark: C.earth,
  soil: C.earth,
  soilDark: C.earthDark,
};

export const TRENCH_KEYS = {
  backCapL: 'st/trench/back/capL',
  backMid: 'st/trench/back/mid',
  backCapR: 'st/trench/back/capR',
  frontCapL: 'st/trench/front/capL',
  frontMid: 'st/trench/front/mid',
  frontCapR: 'st/trench/front/capR',
} as const;

/** Key of the one-piece sprite built by trenchSpec(). */
export function trenchKey(layer: TrenchLayer, width: number, palette: TrenchPalette = TRENCH_BASE_PALETTE): string {
  return `st/trench/${layer}/${palette.id}/w${Math.round(width)}`;
}

const BACK_TOP = -T.backOy;
const BACK_BOTTOM = T.backH - T.backOy;
const FRONT_TOP = -T.frontOy;
const FRONT_BOTTOM = T.frontH - T.frontOy;
/** Pieces are painted this much wider than their box so neighbours never show a seam. */
const BLEED = 0.75;
/** The pit is painted down to here: the front parapet's near face is solid above it and fades out below. */
const PIT_FLOOR = T.bermBottomY - 18;
/** Periods of the ragged edges; each divides tileW so the middle piece tiles. */
const P1 = 36;
const P2 = 24;

function smooth(t: number): number {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * (3 - 2 * c);
}

/** Crest of the spoil behind the far lip at x (tile phase applied by the caller). */
function paradosCrest(x: number): number {
  return T.paradosY + 1.4 * Math.sin((x / P1) * TAU + 0.6) + 0.8 * Math.sin((x / P2) * TAU + 2.1);
}

/** Crest of the front parapet at x. */
function bermCrest(x: number): number {
  return T.crestY + 1.5 * Math.sin((x / P1) * TAU + 1) + 0.7 * Math.sin((x / P2) * TAU);
}

// --- back piece ------------------------------------------------------------------------------------------

/** The far wall of the pit, lit at the lip and falling into shadow; revetment posts and planks fade with it. */
function pitWall(ctx: Ctx, P: TrenchPalette, x0: number, x1: number, phase: number): void {
  const top = T.lipY;
  ctx.fillStyle = mix(P.soil, P.soilDark, 0.55);
  ctx.fillRect(x0, top, x1 - x0, PIT_FLOOR - top);
  // Revetment: a few planks and posts, low contrast; the shadow below swallows them.
  for (let y = top + 7; y < T.shadowY; y += 7) {
    ctx.fillStyle = rgba(C.void, 0.22);
    ctx.fillRect(x0, y, x1 - x0, 0.8);
    ctx.fillStyle = rgba(P.soil, 0.25);
    ctx.fillRect(x0, y + 0.8, x1 - x0, 0.6);
  }
  for (let k = -1; k <= 2; k++) {
    const px = phase + 10 + k * P1;
    if (px + 4 < x0 || px > x1) continue;
    ctx.fillStyle = mix(C.timberDark, P.soilDark, 0.35);
    ctx.fillRect(px, top + 2, 3.4, T.shadowY - top);
    ctx.fillStyle = rgba(C.timberRim, 0.28);
    ctx.fillRect(px, top + 2, 0.8, T.shadowY - top);
  }
  // Depth: darker the deeper it goes, near black where the occupants' feet would be.
  const g = ctx.createLinearGradient(0, top, 0, T.shadowY);
  g.addColorStop(0, rgba(C.void, 0.12));
  g.addColorStop(0.4, rgba(C.void, 0.5));
  g.addColorStop(1, rgba(C.void, 0.86));
  ctx.fillStyle = g;
  ctx.fillRect(x0, top, x1 - x0, T.shadowY - top);
  ctx.fillStyle = rgba(C.void, 0.86);
  ctx.fillRect(x0, T.shadowY, x1 - x0, PIT_FLOOR - T.shadowY);
  // The lip overhangs a little: a dark line right under it.
  ctx.fillStyle = rgba(C.void, 0.45);
  ctx.fillRect(x0, top, x1 - x0, 2);
}

/**
 * Spoil heaped behind the far lip; `rise` (0..1 along x) lets an end piece taper it into the ground. The lip
 * edge is drawn only from `lipFrom` on (an end piece's pit starts a little way in).
 */
function parados(
  ctx: Ctx,
  P: TrenchPalette,
  x0: number,
  x1: number,
  phase: number,
  rise: (x: number) => number,
  lipFrom: number,
): void {
  const base = T.lipY + 1.5;
  ctx.beginPath();
  ctx.moveTo(x0, base);
  for (let x = x0; x <= x1 + 0.01; x += 1.5) ctx.lineTo(x, base + (paradosCrest(x - phase) - base) * rise(x));
  ctx.lineTo(x1, base);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, T.paradosY - 2, 0, base);
  g.addColorStop(0, mix(P.ground, P.soil, 0.3));
  g.addColorStop(1, mix(P.soil, P.soilDark, 0.2));
  ctx.fillStyle = g;
  ctx.fill();
  // The lip itself: a crisp edge between the spoil and the pit.
  if (lipFrom < x1) {
    ctx.fillStyle = rgba(P.soilDark, 0.9);
    ctx.fillRect(lipFrom, T.lipY - 0.4, x1 - lipFrom, 1.1);
  }
}

/** Clods on the spoil (positions repeat every tile). */
function paradosClods(ctx: Ctx, P: TrenchPalette, phase: number, from: number, to: number): void {
  const marks = [6, 2.2, 21, 1.6, 33, 2.6, 50, 1.8, 63, 2.3];
  for (let k = -1; k <= 1; k++) {
    for (let i = 0; i < marks.length; i += 2) {
      const x = marks[i] + phase + k * T.tileW;
      if (x < from || x > to) continue;
      const r = marks[i + 1];
      ctx.fillStyle = i % 4 === 0 ? rgba(P.groundDark, 0.85) : rgba(mix(P.ground, '#ffffff', 0.1), 0.7);
      ctx.beginPath();
      ctx.ellipse(x, paradosCrest(x - phase) + 2.2, r, r * 0.6, 0, 0, TAU);
      ctx.fill();
    }
  }
}

function paintBackMid(ctx: Ctx, P: TrenchPalette): void {
  const x0 = -BLEED;
  const x1 = T.tileW + BLEED;
  pitWall(ctx, P, x0, x1, 0);
  parados(ctx, P, x0, x1, 0, () => 1, x0);
  paradosClods(ctx, P, 0, x0, x1);
  // A sandbag thrown up on the spoil now and then.
  looseBag(ctx, 46, T.lipY - 5.5, 0.12, -0.3, 15, 8);
}

/** Where the dark slot of the pit ends in an end piece, and the radius of its rounded far corner. */
const SLOT_END = 9;
const SLOT_R = 13;

/** Left end of the pit: the slot ends in a rounded, sloped earth end; the spoil tapers into the ground. */
function paintBackCapL(ctx: Ctx, P: TrenchPalette): void {
  const x1 = T.capW + BLEED;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x1, T.lipY);
  ctx.lineTo(SLOT_END + SLOT_R, T.lipY);
  ctx.quadraticCurveTo(SLOT_END, T.lipY, SLOT_END, T.lipY + SLOT_R);
  ctx.lineTo(SLOT_END, PIT_FLOOR);
  ctx.lineTo(x1, PIT_FLOOR);
  ctx.closePath();
  ctx.clip();
  pitWall(ctx, P, 0, x1, T.capW);
  // The end wall slopes toward us: lit earth at the top of the corner, falling into the same shadow.
  const g = ctx.createLinearGradient(SLOT_END, 0, SLOT_END + 9, 0);
  g.addColorStop(0, rgba(mix(P.soil, P.ground, 0.35), 0.9));
  g.addColorStop(1, rgba(P.soil, 0));
  ctx.fillStyle = g;
  ctx.fillRect(SLOT_END, T.lipY, 9, T.shadowY - T.lipY);
  const s = ctx.createLinearGradient(0, T.lipY + 6, 0, T.shadowY);
  s.addColorStop(0, rgba(C.void, 0));
  s.addColorStop(1, rgba(C.void, 0.8));
  ctx.fillStyle = s;
  ctx.fillRect(SLOT_END, T.lipY + 6, 9, T.shadowY - T.lipY - 6);
  ctx.restore();
  // Spoil rising from the ground at the end.
  parados(ctx, P, 0, x1, T.capW, (x) => smooth((x - 1) / 22), SLOT_END + SLOT_R);
  paradosClods(ctx, P, T.capW - T.tileW, 8, x1);
}

// --- front piece -----------------------------------------------------------------------------------------

/** The parapet: earth thrown up in front of the pit, lit along its crest, blending into the ground below. */
/**
 * `rise` (0..1 along x) lowers the crest toward an end; `foot` (0..1) pulls the bottom of the near face up to
 * the crest, so an end piece finishes as a rounded mound instead of a cut-off slab.
 */
function berm(
  ctx: Ctx,
  P: TrenchPalette,
  x0: number,
  x1: number,
  phase: number,
  rise: (x: number) => number,
  foot: (x: number) => number,
): void {
  const low = T.crestY + 14;
  const crestAt = (x: number): number => low + (bermCrest(x - phase) - low) * rise(x);
  ctx.beginPath();
  ctx.moveTo(x0, crestAt(x0));
  for (let x = x0; x <= x1 + 0.01; x += 1.5) ctx.lineTo(x, crestAt(x));
  for (let x = x1; x >= x0 - 0.01; x -= 1.5) {
    const c = crestAt(x);
    ctx.lineTo(x, c + (FRONT_BOTTOM - c) * foot(x));
  }
  ctx.closePath();
  // A band of fresh spoil along the crest; below it the near face is the ground the units walk on (the
  // theatre's own ground colour, a little shaded where it slopes), fading out at the bottom.
  const y0 = T.crestY - 2;
  const at = (y: number): number => (y - y0) / (FRONT_BOTTOM - y0);
  const g = ctx.createLinearGradient(0, y0, 0, FRONT_BOTTOM);
  g.addColorStop(0, mix(P.ground, P.soil, 0.45));
  g.addColorStop(at(T.crestY + 7), mix(P.ground, P.soil, 0.2));
  g.addColorStop(at(T.crestY + 14), mix(P.ground, P.groundDark, 0.22));
  g.addColorStop(at(T.bermBottomY - 18), rgba(P.ground, 1));
  g.addColorStop(at(T.bermBottomY - 6), rgba(P.ground, 0));
  g.addColorStop(1, rgba(P.ground, 0));
  ctx.fillStyle = g;
  ctx.fill();
  // Lit crest line.
  ctx.strokeStyle = rgba(mix(P.ground, '#ffffff', 0.15), 0.6);
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  for (let x = x0; x <= x1 + 0.01; x += 1.5) {
    if (x === x0) ctx.moveTo(x, crestAt(x) + 0.5);
    else ctx.lineTo(x, crestAt(x) + 0.5);
  }
  ctx.stroke();
}

/** Clods and stones on the parapet's face (positions repeat every tile). */
function bermClods(ctx: Ctx, P: TrenchPalette, phase: number, from: number, to: number): void {
  const marks = [5, 13, 1.8, 30, 10, 2.2, 44, 19, 1.6, 61, 12, 2];
  for (let k = -1; k <= 1; k++) {
    for (let i = 0; i < marks.length; i += 3) {
      const x = marks[i] + phase + k * T.tileW;
      if (x < from || x > to) continue;
      const r = marks[i + 2];
      ctx.fillStyle = i % 2 === 0 ? rgba(P.groundDark, 0.4) : rgba(P.soilDark, 0.25);
      ctx.beginPath();
      ctx.ellipse(x, marks[i + 1], r, r * 0.55, 0, 0, TAU);
      ctx.fill();
    }
  }
}

/** Sandbags bedded along the crest: one course, a gap now and then where the earth shows. */
function crestBags(ctx: Ctx, P: TrenchPalette, phase: number, from: number, to: number): void {
  const w = T.bagW;
  const h = T.bagH;
  // Per tile: bags at 0, 18 and 36 (the 54 slot is left as bare earth).
  const slots = [0, 0.15, 18, -0.25, 36, 0.3];
  for (let k = -1; k <= 1; k++) {
    for (let i = 0; i < slots.length; i += 2) {
      const x = slots[i] + phase + k * T.tileW;
      if (x + w < from || x > to) continue;
      const dy = 0.8 * Math.sin(((x - phase) / P2) * TAU);
      sandbag(ctx, x, T.bagTopY + dy, w + 0.5, h, slots[i + 1]);
    }
  }
  // Earth spilt over the bags' feet beds them in.
  ctx.fillStyle = rgba(mix(P.ground, P.soil, 0.3), 0.9);
  for (let k = -1; k <= 1; k++) {
    for (let x = phase + k * T.tileW + 4; x < phase + (k + 1) * T.tileW; x += 9) {
      if (x < from - 4 || x > to + 4) continue;
      ctx.beginPath();
      ctx.ellipse(x, T.bagTopY + h - 0.6, 4.2, 1.6, 0, 0, TAU);
      ctx.fill();
    }
  }
  // The bare-earth gap rises to the bags' height as a hump of spoil.
  for (let k = -1; k <= 1; k++) {
    const x = phase + 54 + k * T.tileW;
    if (x + w < from || x > to) continue;
    ctx.fillStyle = mix(P.ground, P.soil, 0.3);
    ctx.beginPath();
    ctx.moveTo(x - 1, T.bagTopY + h);
    ctx.quadraticCurveTo(x + w / 2, T.bagTopY - 3, x + w + 1, T.bagTopY + h);
    ctx.closePath();
    ctx.fill();
  }
}

function paintFrontMid(ctx: Ctx, P: TrenchPalette): void {
  const x0 = -BLEED;
  const x1 = T.tileW + BLEED;
  berm(ctx, P, x0, x1, 0, () => 1, () => 1);
  bermClods(ctx, P, 0, x0, x1);
  crestBags(ctx, P, 0, x0, x1);
}

/** Left end: the parapet rounds off just past the end of the pit; the last bags step down with it. */
function paintFrontCapL(ctx: Ctx, P: TrenchPalette): void {
  const x1 = T.capW + BLEED;
  const rise = (x: number): number => smooth((x + 2) / (SLOT_END + 2));
  berm(ctx, P, 0, x1, T.capW, rise, (x) => smooth((x + 4) / (SLOT_END + 4)));
  bermClods(ctx, P, T.capW - T.tileW, 12, x1);
  sandbag(ctx, T.capW - T.bagW, T.bagTopY + 0.6, T.bagW + 0.5, T.bagH, -0.1);
  looseBag(ctx, SLOT_END + 4, T.bagTopY + 5, -0.3, 0.1, 14, 9);
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

/** The six kit pieces (neutral palette). */
export function trenchKitSpecs(): SpriteSpec[] {
  const P = TRENCH_BASE_PALETTE;
  const backCap = { w: T.capW, h: T.backH, ox: 0, oy: T.backOy };
  const backMid = { w: T.tileW, h: T.backH, ox: 0, oy: T.backOy };
  const frontCap = { w: T.capW, h: T.frontH, ox: 0, oy: T.frontOy };
  const frontMid = { w: T.tileW, h: T.frontH, ox: 0, oy: T.frontOy };
  const backCapL = (ctx: Ctx): void => paintBackCapL(ctx, P);
  const frontCapL = (ctx: Ctx): void => paintFrontCapL(ctx, P);
  return [
    makeSpec(TRENCH_KEYS.backCapL, backCap, backCapL),
    makeSpec(TRENCH_KEYS.backMid, backMid, (ctx) => paintBackMid(ctx, P)),
    makeSpec(TRENCH_KEYS.backCapR, backCap, mirrored(T.capW, backCapL)),
    makeSpec(TRENCH_KEYS.frontCapL, frontCap, frontCapL),
    makeSpec(TRENCH_KEYS.frontMid, frontMid, (ctx) => paintFrontMid(ctx, P)),
    makeSpec(TRENCH_KEYS.frontCapR, frontCap, mirrored(T.capW, frontCapL)),
  ];
}

/**
 * One-piece sprite of a whole trench layer `width` wu wide in `palette`, assembled from the kit exactly as
 * tileSpan() lays it out. Origin = centre, on the ground line. Key: trenchKey(layer, width, palette).
 */
export function trenchSpec(layer: TrenchLayer, width: number, palette: TrenchPalette = TRENCH_BASE_PALETTE): SpriteSpec {
  const back = layer === 'back';
  const h = back ? T.backH : T.frontH;
  const oy = back ? T.backOy : T.frontOy;
  const top = back ? BACK_TOP : FRONT_TOP;
  const bottom = back ? BACK_BOTTOM : FRONT_BOTTOM;
  const cap = back ? paintBackCapL : paintFrontCapL;
  const mid = back ? paintBackMid : paintFrontMid;
  const span = tileSpan(width, T.capW, T.tileW, createTileSpan());
  const total = span.capRightX + T.capW - span.capLeftX;
  return makeSpec(trenchKey(layer, width, palette), { w: total, h, ox: total / 2, oy }, (ctx) => {
    for (let i = 0; i < span.count; i++) {
      ctx.save();
      ctx.translate(span.firstX + i * span.step, 0);
      ctx.scale(span.scaleX, 1);
      clipBox(ctx, T.tileW + (i < span.count - 1 ? BLEED : 0), top, bottom);
      mid(ctx, palette);
      ctx.restore();
    }
    ctx.save();
    ctx.translate(span.capLeftX, 0);
    clipBox(ctx, T.capW + BLEED * 0.5, top, bottom);
    cap(ctx, palette);
    ctx.restore();
    ctx.save();
    ctx.translate(span.capRightX + T.capW, 0);
    ctx.scale(-1, 1);
    clipBox(ctx, T.capW + BLEED * 0.5, top, bottom);
    cap(ctx, palette);
    ctx.restore();
  });
}
