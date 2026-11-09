/**
 * Obstacles and water (FOUNDATIONS.md 4.4, 4.6 and 4.8), drawn like the wire: a belt runs across the battlefield into
 * the screen, so a tank trap or road block is a few END-ON pieces standing in the walked band, each a BACK half (far
 * pieces, behind the unit rows) and a FRONT half (the near piece, over them). Every y is relative to the ground line
 * (VIEW.groundY); the walked band runs from about -40 (far row) to +40 (near row).
 *
 * - Tank traps: steel "hedgehogs" of riveted angle girders, three beams crossed; toppled and broken once gone.
 * - Road block: a barricade of felled logs and posts with a coil of wire on top; scattered logs once gone.
 * - Sandbags: a breastwork of bags (a sandbag wall's front, its scrape behind), and a low course for a building's front.
 * - Minefields: a warning sign on a stake (a plain triangle, no lettering or emblem) and the low humps of buried mines.
 * - Bridges: a tileable deck (planks and the far truss) under the men and its near girder with piers over the water;
 *   a broken end hanging into the river; a pontoon bridge's planks on boats.
 * - The ferry: a wooden river boat, and the helmets of its load.
 */
import { ART_COLORS as C } from '../../data/artLayout';
import { OBSTACLE_ART as A } from '../../data/obstacles';
import { type Ctx, bagCourse, ellipse, fillPoly, makeSpec, mix, rgba, rimPoly, rr, rng, strokeLine } from '../props/kit';
import type { SpriteSpec } from '../types';

export const OBSTACLE_KEYS = {
  hedgehogBack: 'st/obs/hedgehogBack',
  hedgehogFront: 'st/obs/hedgehogFront',
  hedgehogDown: 'st/obs/hedgehogDown',
  roadBlockBack: 'st/obs/roadBlockBack',
  roadBlockFront: 'st/obs/roadBlockFront',
  roadBlockDown: 'st/obs/roadBlockDown',
  sandbagBack: 'st/obs/sandbagBack',
  sandbagFront: 'st/obs/sandbagFront',
  sandbagLow: 'st/obs/sandbagLow',
  mineSign: 'st/obs/mineSign',
  mine: 'st/obs/mine',
  deck: 'st/obs/deck',
  deckNear: 'st/obs/deckNear',
  deckBroken: 'st/obs/deckBroken',
  pontoonDeck: 'st/obs/pontoonDeck',
  pontoonNear: 'st/obs/pontoonNear',
  boat: 'st/obs/boat',
  boatLoad: 'st/obs/boatLoad',
} as const;

// ---------------------------------------------------------------------------
// Tank traps
// ---------------------------------------------------------------------------

/** One riveted steel angle girder from (x0, y0) to (x1, y1): dark web, a lit flange edge, rivets along it. */
function girder(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, s: number): void {
  strokeLine(ctx, [x0, y0, x1, y1], C.steel, 4.2 * s);
  strokeLine(ctx, [x0 - 0.9 * s, y0 - 0.9 * s, x1 - 0.9 * s, y1 - 0.9 * s], rgba(C.steelRim, 0.8), 1.1 * s);
  strokeLine(ctx, [x0 + 1.2 * s, y0 + 0.6 * s, x1 + 1.2 * s, y1 + 0.6 * s], rgba(C.rust, 0.55), 1 * s);
  ctx.fillStyle = rgba(C.steelRim, 0.7);
  for (let i = 1; i < 5; i++) {
    const t = i / 5;
    ellipse(ctx, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 0.6 * s, 0.6 * s);
    ctx.fill();
  }
}

/** A Czech hedgehog standing on the ground at (x, y), `s` its scale: two beams crossed in an X and one across them. */
function hedgehog(ctx: Ctx, x: number, y: number, s: number): void {
  const h = 30 * s;
  const half = 15 * s;
  // Shadow on the ground.
  ctx.fillStyle = rgba(C.void, 0.3);
  ellipse(ctx, x, y + 1, half * 1.25, 2.2 * s);
  ctx.fill();
  girder(ctx, x + half, y - h * 0.35, x - half * 1.1, y - h * 0.2, s);
  girder(ctx, x - half, y + 1, x + half * 0.85, y - h, s);
  girder(ctx, x + half, y + 1, x - half * 0.85, y - h, s);
  // The gusset plate where they cross.
  rimPoly(ctx, [x - 3 * s, y - h * 0.5 - 3 * s, x + 3 * s, y - h * 0.5 - 3 * s, x + 3 * s, y - h * 0.5 + 3 * s, x - 3 * s, y - h * 0.5 + 3 * s], C.steel, C.steelRim, 0.6);
}

function paintHedgehogBack(ctx: Ctx): void {
  hedgehog(ctx, -9, -30, 0.82);
  hedgehog(ctx, 8, -9, 0.92);
}

function paintHedgehogFront(ctx: Ctx): void {
  hedgehog(ctx, -3, 26, 1.04);
}

function paintHedgehogDown(ctx: Ctx): void {
  // Toppled and torn: beams lying askew, one still half upright, scorched ground.
  ctx.fillStyle = rgba(C.char, 0.35);
  ellipse(ctx, 0, 6, 26, 6);
  ctx.fill();
  girder(ctx, -24, 2, 20, -6, 0.95);
  girder(ctx, -14, 12, 22, 4, 0.95);
  girder(ctx, -6, -18, 10, 14, 0.9);
  girder(ctx, 8, 26, 24, 20, 0.9);
}

// ---------------------------------------------------------------------------
// Road block
// ---------------------------------------------------------------------------

/** A felled log lying across the band at top-left (x, y), seen from the side, with its cut end lit. */
function log(ctx: Ctx, x: number, y: number, w: number, h: number, tone: number): void {
  const body = mix(C.timber, tone > 0 ? C.timberRim : C.timberDark, Math.abs(tone) * 0.5);
  rr(ctx, x, y, w, h, h * 0.5);
  ctx.fillStyle = C.timberDark;
  ctx.fill();
  rr(ctx, x + 0.6, y + 0.5, w - 1.2, h - 1.6, h * 0.45);
  ctx.fillStyle = body;
  ctx.fill();
  strokeLine(ctx, [x + w * 0.15, y + 1.4, x + w * 0.8, y + 1.4], rgba(C.timberRim, 0.7), 0.8);
  // The sawn end: rings.
  ctx.fillStyle = mix(C.timberRim, C.sandbagRim, 0.4);
  ellipse(ctx, x + w - h * 0.35, y + h * 0.5, h * 0.32, h * 0.45);
  ctx.fill();
  ctx.strokeStyle = rgba(C.timberDark, 0.7);
  ctx.lineWidth = 0.5;
  ellipse(ctx, x + w - h * 0.35, y + h * 0.5, h * 0.16, h * 0.24);
  ctx.stroke();
}

/** A loose coil of barbed wire along the top of the barricade. */
function coil(ctx: Ctx, x0: number, x1: number, y: number, r: number): void {
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 0.8;
  for (let x = x0; x < x1; x += r * 1.1) {
    ellipse(ctx, x, y, r, r * 0.85);
    ctx.stroke();
  }
}

function barricade(ctx: Ctx, y: number, s: number): void {
  const w = 54 * s;
  const lh = 7 * s;
  // Posts driven in front and behind.
  strokeLine(ctx, [-w * 0.42, y + 2, -w * 0.46, y - lh * 4.2], C.timberDark, 2.4 * s);
  strokeLine(ctx, [w * 0.4, y + 2, w * 0.44, y - lh * 4], C.timberDark, 2.4 * s);
  for (let r = 0; r < 3; r++) log(ctx, -w / 2 + r * 3 * s, y - lh * (r + 1), w - r * 6 * s, lh, ((r % 2) - 0.5) * 0.8);
  coil(ctx, -w * 0.38, w * 0.38, y - lh * 3 - 4 * s, 4.2 * s);
}

function paintRoadBlockBack(ctx: Ctx): void {
  barricade(ctx, -18, 0.95);
}

function paintRoadBlockFront(ctx: Ctx): void {
  log(ctx, -26, 22, 46, 7, 0.3);
  strokeLine(ctx, [-18, 30, -20, 12], C.timberDark, 2.2);
  strokeLine(ctx, [16, 30, 18, 14], C.timberDark, 2.2);
}

function paintRoadBlockDown(ctx: Ctx): void {
  ctx.fillStyle = rgba(C.char, 0.3);
  ellipse(ctx, 0, 4, 30, 7);
  ctx.fill();
  log(ctx, -30, -12, 34, 6, -0.4);
  log(ctx, -4, -2, 36, 6, 0.2);
  log(ctx, -20, 14, 30, 6, 0.4);
  coil(ctx, -10, 14, -16, 3.5);
}

// ---------------------------------------------------------------------------
// Sandbags
// ---------------------------------------------------------------------------

function paintSandbagBack(ctx: Ctx): void {
  // The scrape behind the wall: trodden earth with a low lip of spoil.
  const w = A.wallTileW;
  fillPoly(ctx, [0, -26, w, -26, w, 40, 0, 40], rgba(C.earthDark, 0.55));
  fillPoly(ctx, [0, -30, w, -31, w, -26, 0, -26], C.earth);
}

function paintSandbagFront(ctx: Ctx): void {
  // A breastwork of six courses, alternate ones offset by half a bag, its top near the trench parapet's cover line.
  // Four bags to the tile and tones that repeat every four bags, so tiles join without a seam.
  for (let r = 0; r < 6; r++) bagCourse(ctx, 0, A.wallTileW, 54 - 11 - r * 9.2, 16, 11, r % 2 === 1 ? -8 : 0, r);
}

function paintSandbagLow(ctx: Ctx): void {
  bagCourse(ctx, 0, A.lowTileW, -10, 15, 9, 0, 2);
  bagCourse(ctx, 0, A.lowTileW, -18, 15, 9, 7.5, 1);
}

// ---------------------------------------------------------------------------
// Minefields
// ---------------------------------------------------------------------------

function paintMineSign(ctx: Ctx): void {
  // A stake, and a plain triangular warning plate: white field, red border, a dark bar across it.
  strokeLine(ctx, [0, 0, 0.6, -26], C.timberDark, 1.8);
  strokeLine(ctx, [-0.5, 0, 0.1, -26], rgba(C.timberRim, 0.6), 0.6);
  fillPoly(ctx, [0, -36, 7.5, -23, -7.5, -23], C.flagRed);
  fillPoly(ctx, [0, -33, 5.2, -24.6, -5.2, -24.6], C.flagWhite);
  fillPoly(ctx, [-2.8, -27.6, 2.8, -27.6, 2.8, -26.2, -2.8, -26.2], C.ink);
}

function paintMine(ctx: Ctx): void {
  // A low hump of disturbed earth with the mine's lid and fuse just showing.
  ctx.fillStyle = mix(C.earth, C.earthRim, 0.3);
  ellipse(ctx, 0, 0, 5, 1.8);
  ctx.fill();
  ctx.fillStyle = C.steel;
  ellipse(ctx, 0, -0.6, 2.6, 1);
  ctx.fill();
  ctx.fillStyle = C.steelRim;
  ellipse(ctx, 0, -1.4, 0.7, 0.5);
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Bridges
// ---------------------------------------------------------------------------

/** The deck tile: planks across the walked band and the far truss rising behind it. Origin: left edge, ground line. */
function paintDeck(ctx: Ctx, pontoon: boolean): void {
  const w = A.deckTileW;
  const rand = rng(pontoon ? 77 : 41);
  // The deck surface: planks laid across the band.
  fillPoly(ctx, [0, -44, w, -44, w, 46, 0, 46], pontoon ? mix(C.timber, C.earth, 0.3) : C.timber);
  for (let x = 0; x < w; x += 6) {
    const tone = rand();
    fillPoly(ctx, [x, -44, x + 5.2, -44, x + 5.2, 46, x, 46], rgba(tone < 0.5 ? C.timberDark : C.timberRim, 0.18 + tone * 0.12));
  }
  // Wheel ruts along the road.
  fillPoly(ctx, [0, -6, w, -6, w, -2, 0, -2], rgba(C.timberDark, 0.35));
  fillPoly(ctx, [0, 14, w, 14, w, 18, 0, 18], rgba(C.timberDark, 0.35));
  if (pontoon) {
    // A rope rail on posts along the far edge.
    for (let x = 4; x < w; x += 24) strokeLine(ctx, [x, -44, x, -60], C.timberDark, 1.8);
    strokeLine(ctx, [0, -58, w, -58], C.timberRim, 0.9);
    return;
  }
  // The far truss: top chord, bottom chord on the deck edge, and diagonals.
  strokeLine(ctx, [0, -44, w, -44], C.steel, 3.2);
  strokeLine(ctx, [0, -86, w, -86], C.steel, 3);
  strokeLine(ctx, [0, -87, w, -87], rgba(C.steelRim, 0.7), 0.9);
  for (let x = 0; x <= w; x += w / 4) strokeLine(ctx, [x, -44, x, -86], C.steel, 2.2);
  for (let x = 0; x < w; x += w / 4) {
    strokeLine(ctx, [x, -44, x + w / 4, -86], C.steel, 1.8);
    strokeLine(ctx, [x + 0.8, -44.5, x + w / 4 + 0.8, -86.5], rgba(C.steelRim, 0.5), 0.6);
  }
}

/** The near girder along the deck's near edge, and a pier going down into the water. Origin: left edge, ground line. */
function paintDeckNear(ctx: Ctx, pontoon: boolean): void {
  const w = A.deckTileW;
  if (pontoon) {
    // The pontoons: boats moored side by side under the planks.
    for (let x = 2; x < w; x += w / 2) {
      rimPoly(ctx, [x, 46, x + w / 2 - 4, 46, x + w / 2 - 10, 62, x + 6, 62], mix(C.drum, C.steel, 0.4), C.drumRim);
      fillPoly(ctx, [x + 6, 62, x + w / 2 - 10, 62, x + w / 2 - 12, 64, x + 8, 64], rgba(C.void, 0.4));
    }
    rimPoly(ctx, [0, 42, w, 42, w, 48, 0, 48], C.timber, C.timberRim);
    return;
  }
  // The girder face with its stiffeners and the handrail above it.
  rimPoly(ctx, [0, 44, w, 44, w, 58, 0, 58], C.steel, C.steelRim);
  for (let x = 4; x < w; x += 12) strokeLine(ctx, [x, 45, x, 57], rgba(C.steelRim, 0.45), 1);
  strokeLine(ctx, [0, 30, w, 30], C.steel, 1.6);
  for (let x = 6; x < w; x += 20) strokeLine(ctx, [x, 30, x, 44], C.steel, 1.4);
  // A stone pier under the middle of the tile, into the river.
  rimPoly(ctx, [w * 0.5 - 9, 58, w * 0.5 + 9, 58, w * 0.5 + 12, 120, w * 0.5 - 12, 120], C.concrete, C.concreteRim);
  fillPoly(ctx, [w * 0.5 - 12, 108, w * 0.5 + 12, 108, w * 0.5 + 12, 120, w * 0.5 - 12, 120], rgba(C.earthDark, 0.5));
}

/** A blown span's end at a bank: the deck torn off and hanging into the river. Origin: the bank end, ground line. */
function paintDeckBroken(ctx: Ctx): void {
  fillPoly(ctx, [0, -44, 26, -44, 34, -30, 40, 10, 30, 60, 0, 46], C.timber);
  strokeLine(ctx, [0, -86, 18, -86, 30, -64, 42, -30], C.steel, 3);
  strokeLine(ctx, [0, -44, 24, -44, 38, -10, 44, 40], C.steel, 3.2);
  strokeLine(ctx, [10, -86, 22, -44], C.steel, 2);
  rimPoly(ctx, [0, 44, 22, 46, 36, 70, 30, 76, 0, 58], C.steel, C.steelRim);
  ctx.fillStyle = rgba(C.char, 0.45);
  ellipse(ctx, 24, 0, 18, 40);
  ctx.fill();
}

// ---------------------------------------------------------------------------
// The ferry
// ---------------------------------------------------------------------------

function paintBoat(ctx: Ctx): void {
  // A Volga Flotilla boat seen from the side, bow to the right: low wooden hull, a small wheelhouse aft, the bow wave.
  const L = A.boatW / 2;
  fillPoly(ctx, [-L - 6, 2, L + 10, 2, L + 4, 6, -L, 6], rgba(C.flagWhite, 0.35));
  rimPoly(ctx, [-L, -14, L - 8, -14, L + 6, -20, L + 2, -4, L - 12, 4, -L + 6, 4], mix(C.timber, C.drum, 0.35), C.timberRim);
  strokeLine(ctx, [-L, -10, L + 2, -12], rgba(C.timberDark, 0.8), 1.2);
  rimRectPlain(ctx, -L + 6, -30, 22, 16, mix(C.drum, C.steel, 0.3));
  fillPoly(ctx, [-L + 10, -26, -L + 16, -26, -L + 16, -21, -L + 10, -21], C.glass);
  strokeLine(ctx, [-L + 4, -30, L - 30, -30], C.ink, 0.8);
}

function rimRectPlain(ctx: Ctx, x: number, y: number, w: number, h: number, body: string): void {
  rimPoly(ctx, [x, y, x + w, y, x + w, y + h, x, y + h], body, C.drumRim);
}

function paintBoatLoad(ctx: Ctx): void {
  // Helmets and shoulders of the men crowded in the hull.
  const L = A.boatW / 2;
  for (let x = -L + 34; x < L - 6; x += 9) {
    fillPoly(ctx, [x - 3.5, -14, x + 3.5, -14, x + 3, -20, x - 3, -20], C.ink);
    ctx.fillStyle = C.inkSoft;
    ellipse(ctx, x, -22, 3.4, 2.6);
    ctx.fill();
  }
}

export function obstacleSpecs(): SpriteSpec[] {
  const K = OBSTACLE_KEYS;
  return [
    makeSpec(K.hedgehogBack, A.pieceBox, paintHedgehogBack),
    makeSpec(K.hedgehogFront, A.pieceBox, paintHedgehogFront),
    makeSpec(K.hedgehogDown, A.pieceBox, paintHedgehogDown),
    makeSpec(K.roadBlockBack, A.pieceBox, paintRoadBlockBack),
    makeSpec(K.roadBlockFront, A.pieceBox, paintRoadBlockFront),
    makeSpec(K.roadBlockDown, A.pieceBox, paintRoadBlockDown),
    makeSpec(K.sandbagBack, A.wallBox, paintSandbagBack),
    makeSpec(K.sandbagFront, A.wallBox, paintSandbagFront),
    makeSpec(K.sandbagLow, A.lowBox, paintSandbagLow),
    makeSpec(K.mineSign, A.signBox, paintMineSign),
    makeSpec(K.mine, A.mineBox, paintMine),
    makeSpec(K.deck, A.deckBox, (ctx) => paintDeck(ctx, false)),
    makeSpec(K.deckNear, A.deckBox, (ctx) => paintDeckNear(ctx, false)),
    makeSpec(K.deckBroken, A.brokenBox, paintDeckBroken),
    makeSpec(K.pontoonDeck, A.deckBox, (ctx) => paintDeck(ctx, true)),
    makeSpec(K.pontoonNear, A.deckBox, (ctx) => paintDeckNear(ctx, true)),
    makeSpec(K.boat, A.boatBox, paintBoat),
    makeSpec(K.boatLoad, A.boatBox, paintBoatLoad),
  ];
}
