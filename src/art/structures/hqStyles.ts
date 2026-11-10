/**
 * HQ styles shown by the Quartermaster "HQ health" upgrade (HqStyle in src/data/upgradeLooks.ts): a small field tent,
 * a big tent, a timber-and-sandbag dugout and the two nations' concrete bunkers, each in three damage states. Drawn
 * for the left side facing right (door toward +x); the renderer mirrors the right-hand HQ. Anchors are in
 * HQ_STYLE_LAYOUT (src/data/looksHq.ts).
 *
 * The tents and the dugout are shared by every nation and take the nation's canvas colours from FACTIONS[f].look.
 * The HQ machine gun is a separate sprite at the layout's gunNest, so no style draws a gun. To add a style, add it to
 * HqStyle, give it a layout and add a painter to PAINTERS below.
 */
import { ART_COLORS as C, DAMAGE_STATES, type DamageState } from '../../data/artLayout';
import { FACTIONS } from '../../data/factions';
import { HQ_STYLE_LAYOUT, type HqStyleLayout } from '../../data/looksHq';
import type { FactionId } from '../../data/schema';
import type { HqStyle } from '../../data/upgradeLooks';
import {
  type Ctx,
  TAU,
  bagCourse,
  bagWall,
  bite,
  charOver,
  ember,
  fillPoly,
  footing,
  heap,
  inside,
  looseBag,
  makeSpec,
  mix,
  poly,
  rgba,
  rimPoly,
  rimRect,
  rimmed,
  rng,
  sandbag,
  scorch,
  shellHole,
  strokeLine,
} from '../props/kit';
import type { SpriteSpec } from '../types';
import { beam, behind, flagpole, grassTufts, paintBritishBunker, paintGermanBunker, paintSovietBunker } from './hq';

export function hqStyleKey(style: HqStyle, faction: FactionId, state: DamageState): string {
  return `st/hqs/${style}/${faction}/${state}`;
}

const BAG_W = 18;
const BAG_H = 10;
const ROPE = mix(C.sandbagRim, C.inkSoft, 0.35);
const SCRIM = ['#4b5034', '#5a4a30', '#3f4630', '#655d3e'] as const;

/** Canvas tones for one nation, from its uniform tint muted toward the shared canvas colours. */
interface Tones {
  body: string;
  roof: string;
  dark: string;
  rim: string;
}

function tonesFor(faction: FactionId): Tones {
  const look = FACTIONS[faction].look;
  const body = mix(look.tint, C.canvas, 0.4);
  return {
    body,
    roof: mix(body, C.canvasRim, 0.18),
    dark: mix(look.tintDark, C.canvasDark, 0.4),
    rim: mix(body, C.flagWhite, 0.3),
  };
}

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

/** A dark doorway with a warm lamp glow inside. */
function doorway(ctx: Ctx, L: HqStyleLayout): void {
  const dl = L.doorX - L.doorW / 2;
  ctx.fillStyle = C.void;
  ctx.fillRect(dl, -L.doorH, L.doorW, L.doorH + 2);
  const glow = ctx.createRadialGradient(L.doorX + 3, -L.doorH + 18, 1, L.doorX + 3, -L.doorH + 18, 28);
  glow.addColorStop(0, 'rgba(214,160,84,0.3)');
  glow.addColorStop(1, 'rgba(214,160,84,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(dl, -L.doorH, L.doorW, L.doorH);
}

function peg(ctx: Ctx, x: number): void {
  fillPoly(ctx, [x - 1.6, -5, x + 1.6, -5, x + 0.6, 2, x - 0.6, 2], C.timberDark);
  strokeLine(ctx, [x - 1.4, -4.6, x + 1.4, -4.6], rgba(C.timberRim, 0.8), 0.6);
}

/** A guy rope from (x0, y0) to a peg in the ground at x1. */
function guyRope(ctx: Ctx, x0: number, y0: number, x1: number): void {
  ctx.strokeStyle = ROPE;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo((x0 + x1) / 2, y0 * 0.45 + 2, x1, -3);
  ctx.stroke();
  peg(ctx, x1);
}

/** A loose length of rope hanging from (x, y) after its peg was torn out. */
function brokenRope(ctx: Ctx, x: number, y: number, dir: number): void {
  ctx.strokeStyle = ROPE;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + dir * 6, y + 18, x + dir * 2, y + 30);
  ctx.stroke();
}

/** A ground-planted flagpole with two bags around its foot. */
function groundFlagpole(ctx: Ctx, L: HqStyleLayout): void {
  flagpole(ctx, L);
  const x = L.flagBase.x;
  looseBag(ctx, x - 9, -4.5, 0, 0.3, 16, 9);
  looseBag(ctx, x + 8, -4.5, 0, -0.3, 16, 9);
}

/** The flagpole after the HQ fell: snapped and lying across the ground. */
function fallenPole(ctx: Ctx, x: number, y: number, len: number, angle: number): void {
  strokeLine(ctx, [x, y, x + Math.cos(angle) * len, y + Math.sin(angle) * len], C.inkSoft, 2.4);
  strokeLine(ctx, [x, y - 0.8, x + Math.cos(angle) * len, y - 0.8 + Math.sin(angle) * len], rgba(C.rim, 0.45), 0.6);
}

/** A wooden crate with a field telephone on it and its wire trailing along the ground to the rear. */
function telephoneCrate(ctx: Ctx, x: number, wireTo: number, tipped: boolean): void {
  if (tipped) {
    ctx.save();
    ctx.translate(x + 10, -6);
    ctx.rotate(0.35);
    rimRect(ctx, -10, -8, 20, 15, 1, C.crate, C.crateRim);
    ctx.restore();
  } else {
    rimRect(ctx, x, -15, 20, 16, 1, C.crate, C.crateRim);
    fillPoly(ctx, [x, -8, x + 20, -8, x + 20, -6.8, x, -6.8], C.crateDark);
    // Leather-cased telephone with its handset on top.
    rimRect(ctx, x + 3, -24, 13, 9, 1.2, C.drumDark, C.drumRim);
    strokeLine(ctx, [x + 4, -26.5, x + 15, -26.5], C.ink, 2.4);
    strokeLine(ctx, [x + 17, -20, x + 19.5, -17], C.inkSoft, 1);
  }
  ctx.strokeStyle = rgba(C.ink, 0.85);
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(x + 3, tipped ? -4 : -18);
  ctx.quadraticCurveTo(x - 4, 1, x - 14, 0.6);
  ctx.lineTo(wireTo, 1.2);
  ctx.stroke();
}

/** Scrim tufts: small irregular patches of cloth tied into a net. */
function tuft(ctx: Ctx, x: number, y: number, size: number, rand: () => number, tint: string): void {
  const n = 5;
  const pts: number[] = [];
  const spin = rand() * TAU;
  for (let i = 0; i < n; i++) {
    const a = spin + (i / n) * TAU;
    const r = size * (0.5 + rand() * 0.6);
    pts.push(x + Math.cos(a) * r * 1.3, y + Math.sin(a) * r * 0.75);
  }
  fillPoly(ctx, pts, mix(SCRIM[Math.floor(rand() * SCRIM.length)], tint, 0.25));
}

/**
 * A camouflage net over `outline` (closed polygon): diamond mesh with scrim tufts, plus strands and tufts hanging
 * below its lower edge (`edge`, a polyline from left to right).
 */
function camoNet(ctx: Ctx, outline: readonly number[], edge: readonly number[], rand: () => number, tint: string, density: number): void {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < outline.length; i += 2) {
    x0 = Math.min(x0, outline[i]);
    x1 = Math.max(x1, outline[i]);
    y0 = Math.min(y0, outline[i + 1]);
    y1 = Math.max(y1, outline[i + 1]);
  }
  const h = y1 - y0;
  inside(
    ctx,
    (c) => poly(c, outline),
    () => {
      ctx.fillStyle = rgba(C.inkSoft, 0.16);
      ctx.fillRect(x0, y0, x1 - x0, h);
      ctx.strokeStyle = rgba(C.ink, 0.42);
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      for (let x = x0 - h; x < x1 + h; x += 8) {
        ctx.moveTo(x, y1);
        ctx.lineTo(x + h, y0);
        ctx.moveTo(x, y0);
        ctx.lineTo(x + h, y1);
      }
      ctx.stroke();
      const n = Math.round(((x1 - x0) * h * density) / 180);
      for (let i = 0; i < n; i++) tuft(ctx, x0 + rand() * (x1 - x0), y0 + rand() * h, 3 + rand() * 3.5, rand, tint);
    },
  );
  // Hanging strands and tufts along the lower edge.
  for (let i = 0; i + 3 < edge.length; i += 2) {
    const ex = edge[i];
    const ey = edge[i + 1];
    if (rand() < 0.55) strokeLine(ctx, [ex, ey, ex + (rand() - 0.5) * 3, ey + 4 + rand() * 6], rgba(C.ink, 0.5), 0.6);
    if (rand() < 0.5) tuft(ctx, ex + rand() * 4, ey + 1 + rand() * 3, 2.5 + rand() * 2, rand, tint);
  }
}

// ---------------------------------------------------------------------------
// Tents
// ---------------------------------------------------------------------------

/** A ridge tent seen side-on: side wall from x0 to x1, eaves overhanging by `eave`. */
interface Tent {
  x0: number;
  x1: number;
  wall: number;
  ridge: number;
  eave: number;
}

/** How far the ridge ends sit in from the ends of the wall, so the gable ends slope. */
const RIDGE_INSET = 18;

/** Roof outline (ridge slightly slack between the poles); sag lowers the +x end of the ridge (a pole knocked askew). */
function roofPath(ctx: Ctx, t: Tent, sag: number): void {
  const xa = t.x0 - t.eave;
  const xb = t.x1 + t.eave;
  const ya = -t.wall + 2;
  const yb = ya + sag * 0.35;
  const mid = (t.x0 + t.x1) / 2;
  ctx.beginPath();
  ctx.moveTo(xa, ya);
  ctx.lineTo(t.x0 + RIDGE_INSET, -t.ridge);
  ctx.quadraticCurveTo(mid, -t.ridge + 4 + sag * 0.6, t.x1 - RIDGE_INSET, -t.ridge + sag);
  ctx.lineTo(xb, yb);
  ctx.quadraticCurveTo(mid, (ya + yb) / 2 + 2, xa, ya);
  ctx.closePath();
}

function tentWall(ctx: Ctx, t: Tent, k: Tones, rand: () => number): void {
  const pts = [t.x0 + 2, -t.wall, t.x1 - 2, -t.wall, t.x1 + 3, 2, t.x0 - 3, 2];
  rimPoly(ctx, pts, k.body, k.rim);
  inside(
    ctx,
    (c) => poly(c, pts),
    () => {
      const g = ctx.createLinearGradient(0, -t.wall, 0, 2);
      g.addColorStop(0, rgba(C.void, 0.42));
      g.addColorStop(0.22, rgba(C.void, 0.06));
      g.addColorStop(1, rgba(C.void, 0.22));
      ctx.fillStyle = g;
      ctx.fillRect(t.x0 - 3, -t.wall, t.x1 - t.x0 + 6, t.wall + 2);
      // Panel seams and soft vertical folds.
      for (let x = t.x0 + 24; x < t.x1 - 8; x += 24) {
        strokeLine(ctx, [x, -t.wall, x + (rand() - 0.5) * 2, 2], rgba(k.dark, 0.9), 0.9);
        strokeLine(ctx, [x + 1.3, -t.wall, x + 1.3, 2], rgba(k.rim, 0.22), 0.6);
      }
      // Sod cloth along the ground.
      ctx.fillStyle = rgba(k.dark, 0.75);
      ctx.fillRect(t.x0 - 3, -6, t.x1 - t.x0 + 6, 8);
    },
  );
}

function tentRoof(ctx: Ctx, t: Tent, k: Tones, sag: number): void {
  const path = (c: Ctx): void => roofPath(c, t, sag);
  rimmed(ctx, path, k.roof, k.rim, 0.3, 1.8);
  inside(
    ctx,
    path,
    () => {
      // The roof falls away from the light toward the eave.
      const g = ctx.createLinearGradient(0, -t.ridge, 0, -t.wall + 2);
      g.addColorStop(0, rgba(C.void, 0));
      g.addColorStop(1, rgba(C.void, 0.26));
      ctx.fillStyle = g;
      ctx.fillRect(t.x0 - t.eave, -t.ridge, t.x1 - t.x0 + 2 * t.eave, t.ridge);
      const n = Math.max(2, Math.round((t.x1 - t.x0) / 26));
      for (let i = 1; i < n; i++) {
        const u = i / n;
        const xt = t.x0 + RIDGE_INSET + (t.x1 - t.x0 - 2 * RIDGE_INSET) * u;
        const xb = t.x0 - t.eave + (t.x1 - t.x0 + 2 * t.eave) * u;
        strokeLine(ctx, [xt, -t.ridge + 3 + sag * u, xb, -t.wall + 2 + sag * 0.35 * u], rgba(k.dark, 0.7), 0.8);
      }
      if (sag > 0) {
        // A slack crease where the ridge has dropped.
        strokeLine(ctx, [t.x1 - 60, -t.ridge + 2, t.x1 - 20, -t.wall + 6], rgba(k.dark, 0.8), 1.4);
      }
    },
  );
  // Scalloped valance along the eave.
  const xa = t.x0 - t.eave;
  const xb = t.x1 + t.eave;
  const ya = -t.wall + 2;
  const yb = ya + sag * 0.35;
  const n = Math.max(4, Math.round((xb - xa) / 10));
  ctx.beginPath();
  ctx.moveTo(xa, ya - 0.5);
  ctx.lineTo(xb, yb - 0.5);
  for (let i = n; i >= 0; i--) {
    const u = i / n;
    ctx.lineTo(xa + (xb - xa) * u, ya + (yb - ya) * u + (i % 2 === 0 ? 3 : 6));
  }
  ctx.closePath();
  ctx.fillStyle = k.dark;
  ctx.fill();
  strokeLine(ctx, [xa, ya, xb, yb], rgba(k.rim, 0.55), 0.8);
  // Ridge pole ends with their finials.
  for (const [x, y] of [
    [t.x0 + RIDGE_INSET, -t.ridge],
    [t.x1 - RIDGE_INSET, -t.ridge + sag],
  ]) {
    strokeLine(ctx, [x, y + 1, x, y - 6], C.timberDark, 2.4);
    ctx.fillStyle = C.timberRim;
    ctx.beginPath();
    ctx.arc(x, y - 6.5, 1.5, 0, TAU);
    ctx.fill();
  }
}

/** The tent's door: a dark opening, side flaps tied back, the top flap rolled up. */
function tentDoor(ctx: Ctx, L: HqStyleLayout, k: Tones): void {
  doorway(ctx, L);
  const dl = L.doorX - L.doorW / 2;
  const dr = dl + L.doorW;
  const top = -L.doorH;
  rimPoly(ctx, [dl - 2, top, dl + 6, top, dl + 3, -30, dl - 3, -6, dl - 2, 2, dl - 9, 2, dl - 8, -28], k.body, k.rim);
  rimPoly(ctx, [dr + 2, top, dr - 6, top, dr - 3, -30, dr + 3, -6, dr + 2, 2, dr + 9, 2, dr + 8, -28], mix(k.body, k.dark, 0.35), k.rim);
  strokeLine(ctx, [dl - 9, -29, dl + 4, -31], ROPE, 1);
  strokeLine(ctx, [dr + 9, -29, dr - 4, -31], ROPE, 1);
  rimRect(ctx, dl - 6, top - 7, L.doorW + 12, 7, 3.5, k.body, k.rim);
  strokeLine(ctx, [dl - 4, top - 3.5, dr + 4, top - 3.5], rgba(k.dark, 0.8), 0.8);
}

/** A ragged hole torn in the canvas, with a flap hanging from its lower edge. */
function tear(ctx: Ctx, x: number, y: number, r: number, rand: () => number, k: Tones): void {
  const pts: number[] = [];
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const q = 0.55 + rand() * 0.6;
    pts.push(x + Math.cos(a) * r * q * 1.2, y + Math.sin(a) * r * q);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  fillPoly(ctx, pts, rgba(C.void, 0.92));
  ctx.restore();
  rimPoly(ctx, [x - r * 0.5, y + r * 0.2, x + r * 0.4, y + r * 0.35, x + r * 0.1, y + r * 1.5], k.dark, k.rim, 0.8);
}

/** A tent that has burnt and fallen in: a low heap of charred canvas propped up where a pole still stands. */
function collapsedTent(ctx: Ctx, x0: number, x1: number, peakX: number, peakH: number, k: Tones, rand: () => number): void {
  // Broken poles: one still standing at a lean, one lying on the heap.
  strokeLine(ctx, [peakX - 6, 2, peakX + 6, -peakH - 20], C.timberDark, 3.4);
  strokeLine(ctx, [peakX + 6, -peakH - 20, peakX + 10, -peakH - 26], C.timberDark, 1.8);
  strokeLine(ctx, [x1 - 34, 2, x1 - 18, -peakH * 0.9], C.timberDark, 3);
  const n = Math.max(6, Math.round((x1 - x0) / 7));
  const pts: number[] = [x0, 2];
  for (let i = 1; i < n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    const d = (x - peakX) / 34;
    const lump = 7 + rand() * 9 + Math.sin((i / n) * Math.PI) * 6;
    pts.push(x, -(lump + peakH * Math.exp(-d * d)));
  }
  pts.push(x1, 2);
  rimPoly(ctx, pts, mix(k.body, C.char, 0.3), mix(k.rim, C.char, 0.3), 1.4);
  inside(
    ctx,
    (c) => poly(c, pts),
    () => {
      // Folds running down from the pole, burnt patches and holes.
      for (let i = 0; i < 7; i++) {
        const ex = x0 + 10 + rand() * (x1 - x0 - 20);
        strokeLine(ctx, [peakX + 4, -peakH, ex, 2], rgba(k.dark, 0.8), 1.1);
      }
      for (let i = 0; i < 6; i++) scorch(ctx, x0 + rand() * (x1 - x0), -rand() * 20, 16 + rand() * 14, 10, 0.7);
      for (let i = 0; i < 5; i++) {
        const hx = x0 + 14 + rand() * (x1 - x0 - 28);
        const hy = -4 - rand() * 10;
        ctx.fillStyle = rgba(C.void, 0.9);
        ctx.beginPath();
        ctx.ellipse(hx, hy, 4 + rand() * 5, 2 + rand() * 2, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = rgba(C.ember, 0.55);
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }
    },
  );
  // The ridge pole fallen across the heap.
  beam(ctx, x0 + 16, -8, peakX - 8, -peakH + 4, 3.2);
}

interface TentPlan {
  main: Tent;
  annex?: Tent;
  /** Courses of bags along the wall left of the door, for the main tent and the annex. */
  bagRows: number;
  annexBagRows: number;
  net: boolean;
  aerialX?: number;
  /** The field telephone crate's x, and whether a second crate stands on it. */
  crateX: number;
  crates: number;
  seed: number;
}

const SMALL_TENT: TentPlan = {
  main: { x0: -88, x1: 88, wall: 64, ridge: 112, eave: 9 },
  bagRows: 2,
  annexBagRows: 0,
  net: false,
  crateX: 62,
  crates: 1,
  seed: 410,
};

const BIG_TENT: TentPlan = {
  main: { x0: -60, x1: 126, wall: 70, ridge: 126, eave: 9 },
  annex: { x0: -128, x1: -44, wall: 50, ridge: 88, eave: 7 },
  bagRows: 3,
  annexBagRows: 2,
  net: true,
  aerialX: 108,
  crateX: 94,
  crates: 2,
  seed: 1939,
};

function radioAerial(ctx: Ctx, x: number, top: number, bent: boolean): void {
  ctx.strokeStyle = rgba(C.ink, 0.5);
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(x, top + 40);
  ctx.lineTo(x - 44, -40);
  ctx.moveTo(x, top + 40);
  ctx.lineTo(x + 40, -30);
  ctx.stroke();
  if (bent) {
    strokeLine(ctx, [x, -40, x, top + 44], C.inkSoft, 1.8);
    strokeLine(ctx, [x, top + 44, x + 22, top + 60, x + 34, top + 84], C.inkSoft, 1);
  } else {
    strokeLine(ctx, [x, -40, x, top + 30], C.inkSoft, 1.8);
    strokeLine(ctx, [x, top + 30, x, top], C.inkSoft, 1);
    strokeLine(ctx, [x - 0.6, -40, x - 0.6, top + 30], rgba(C.rim, 0.5), 0.5);
    for (const y of [top + 14, top + 28]) strokeLine(ctx, [x - 6, y, x + 6, y], C.inkSoft, 0.9);
  }
}

function tentNetPts(t: Tent, rand: () => number): { outline: number[]; edge: number[] } {
  const edge: number[] = [];
  const xa = t.x0 - t.eave - 4;
  const xb = t.x1 + t.eave + 4;
  for (let x = xa; x <= xb + 0.1; x += 9) edge.push(x, -t.wall + 4 + rand() * 6);
  const outline = [t.x0 + RIDGE_INSET - 4, -t.ridge - 4, (t.x0 + t.x1) / 2, -t.ridge, t.x1 - RIDGE_INSET + 4, -t.ridge - 4];
  for (let i = edge.length - 2; i >= 0; i -= 2) outline.push(edge[i], edge[i + 1]);
  return { outline, edge };
}

function paintTent(ctx: Ctx, state: DamageState, faction: FactionId, L: HqStyleLayout, plan: TentPlan): void {
  const k = tonesFor(faction);
  const tint = FACTIONS[faction].look.tint;
  const rand = rng(plan.seed);
  const t = plan.main;
  const dl = L.doorX - L.doorW / 2;
  const left = plan.annex ? plan.annex : t;
  const ropeL = left.x0 - left.eave;
  const ropeR = t.x1 + t.eave;

  if (state === 'ruin') {
    const rrand = rng(plan.seed + 7);
    if (plan.aerialX !== undefined) fallenPole(ctx, plan.aerialX - 20, -3, 70, -0.18);
    collapsedTent(ctx, left.x0 - 6, t.x1 + 8, plan.annex ? -10 : -22, plan.annex ? 34 : 26, k, rrand);
    // What is left of the bag wall, and bags blown loose.
    bagWall(ctx, left.x0 + 4, 2, 3, 1, BAG_W, BAG_H, 1);
    bagWall(ctx, t.x0 + 50, 2, 2, 1, BAG_W, BAG_H, 2);
    looseBag(ctx, left.x0 - 12, -4, 0.4, -0.2);
    looseBag(ctx, dl - 6, -4, -0.3, 0.3);
    looseBag(ctx, L.doorX + 26, -3, 0.15, -0.3);
    telephoneCrate(ctx, plan.crateX, ropeL - 16, true);
    fallenPole(ctx, L.flagBase.x - 4, -2, 92, -0.12);
    peg(ctx, ropeL - 22);
    peg(ctx, ropeR + 26);
    charOver(ctx, -L.box.ox, -L.box.oy, L.box.w, L.box.h, 0.3);
    for (const f of L.fires) {
      ember(ctx, f.x, f.y + 22, 14, 0.55);
      ember(ctx, f.x + 8 - rrand() * 16, f.y + 26, 5, 0.8);
    }
    for (let i = 0; i < 8; i++) ember(ctx, left.x0 + rrand() * (t.x1 - left.x0), -4 - rrand() * 18, 2 + rrand() * 2.5, 0.75);
    footing(ctx, ropeL - 10, ropeR + 10, 2, 7, rand);
    return;
  }

  const damaged = state === 'damaged';
  const sag = damaged ? 11 : 0;
  if (plan.aerialX !== undefined) radioAerial(ctx, plan.aerialX, -L.flagTop.y > 180 ? -196 : -170, damaged);

  // Guy ropes at both ends (behind the bags, in front of the canvas).
  const drawRopes = (): void => {
    guyRope(ctx, left.x0 - left.eave, -left.wall + 2, ropeL - 22);
    guyRope(ctx, left.x0 + RIDGE_INSET, -left.ridge, ropeL - 40);
    if (damaged) brokenRope(ctx, t.x1 + t.eave, -t.wall + 2 + sag * 0.35, 1);
    else guyRope(ctx, t.x1 + t.eave, -t.wall + 2, ropeR + 22);
    guyRope(ctx, t.x1 - RIDGE_INSET, -t.ridge + sag, ropeR + 40);
  };

  if (plan.annex) {
    const a = plan.annex;
    tentWall(ctx, a, k, rand);
    tentRoof(ctx, a, k, 0);
    // Stovepipe through the annex roof.
    rimRect(ctx, a.x0 + 30, -a.ridge - 14, 4.5, 26, 1, C.steel, C.steelRim);
    rimPoly(ctx, [a.x0 + 27, -a.ridge - 14, a.x0 + 32.2, -a.ridge - 19, a.x0 + 37.5, -a.ridge - 14], C.steel, C.steelRim, 1);
  }
  tentWall(ctx, t, k, rand);
  tentRoof(ctx, t, k, sag);
  if (plan.net) {
    const nrand = rng(plan.seed + 3);
    const { outline, edge } = tentNetPts(t, nrand);
    camoNet(ctx, outline, edge, nrand, tint, 1);
  }
  tentDoor(ctx, L, k);
  drawRopes();

  if (damaged) {
    const drand = rng(plan.seed + 5);
    tear(ctx, t.x0 + 30, -t.wall + 20, 7, drand, k);
    tear(ctx, (t.x0 + t.x1) / 2 - 10, -t.ridge + 16, 8, drand, k);
    tear(ctx, t.x1 - 22, -t.wall - 10, 6, drand, k);
    if (plan.annex) tear(ctx, plan.annex.x0 + 50, -plan.annex.wall + 14, 6, drand, k);
    scorch(ctx, t.x0 + 30, -t.wall + 20, 26, 22, 0.55);
    scorch(ctx, t.x1 - 26, -t.wall - 6, 30, 22, 0.6);
    scorch(ctx, (t.x0 + t.x1) / 2, -t.ridge + 20, 22, 14, 0.4);
  }

  // Sandbag walls along the front, left of the door.
  const mainCols = Math.max(1, Math.floor((dl - 6 - t.x0) / BAG_W));
  bagWall(ctx, dl - 6 - mainCols * BAG_W, 2, mainCols, plan.bagRows, BAG_W, BAG_H);
  if (plan.annex) {
    const a = plan.annex;
    const cols = Math.floor((t.x0 - 6 - dl + mainCols * BAG_W - a.x0) / BAG_W);
    bagWall(ctx, a.x0 + 2, 2, Math.max(1, Math.min(cols, 3)), plan.annexBagRows, BAG_W, BAG_H, 2);
  }

  telephoneCrate(ctx, plan.crateX, ropeL - 16, false);
  if (plan.crates > 1) {
    rimRect(ctx, plan.crateX + 22, -20, 22, 21, 1, C.crate, C.crateRim);
    fillPoly(ctx, [plan.crateX + 22, -11, plan.crateX + 44, -11, plan.crateX + 44, -9.8, plan.crateX + 22, -9.8], C.crateDark);
  }
  groundFlagpole(ctx, L);

  if (damaged) {
    const drand = rng(plan.seed + 6);
    looseBag(ctx, dl - 14, -4, 0.3, 0.2);
    looseBag(ctx, t.x0 - 4, -4, -0.5, -0.3);
    scorch(ctx, dl - 40, -12, 22, 12, 0.45);
    for (let i = 0; i < 4; i++) ember(ctx, t.x0 + drand() * (t.x1 - t.x0), -t.wall + 8 + drand() * 20, 1.5 + drand(), 0.5);
  }
  footing(ctx, ropeL - 10, ropeR + 10, 2, 7, rand);
}

// ---------------------------------------------------------------------------
// Dugout
// ---------------------------------------------------------------------------

const DUG = { x0: -104, x1: 112, face: 62, beamTop: -72 };

function logWall(ctx: Ctx, rand: () => number): void {
  const { x0, x1, face } = DUG;
  const pts = [x0, -face, x1, -face, x1, 2, x0, 2];
  fillPoly(ctx, pts, C.timberDark);
  inside(
    ctx,
    (c) => poly(c, pts),
    () => {
      const h = 9.4;
      for (let y = 2; y > -face - h; y -= h) {
        const tone = mix(C.timber, C.timberDark, rand() * 0.45);
        rimRect(ctx, x0 - 4, y - h + 0.6, x1 - x0 + 8, h - 0.6, h / 2, tone, C.timberRim, 1);
        // Bark streaks.
        for (let i = 0; i < 6; i++) {
          const bx = x0 + rand() * (x1 - x0);
          strokeLine(ctx, [bx, y - h * 0.45, bx + 8 + rand() * 10, y - h * 0.5], rgba(C.timberDark, 0.6), 0.6);
        }
      }
      // Upright posts holding the logs.
      for (let px = x0 + 26; px < x1 - 4; px += 54) rimRect(ctx, px, -face, 7, face + 2, 1.5, mix(C.timber, C.timberDark, 0.5), C.timberRim);
      // Shadow under the roof beam.
      ctx.fillStyle = rgba(C.void, 0.4);
      ctx.fillRect(x0, -face, x1 - x0, 5);
    },
  );
}

function firingSlit(ctx: Ctx, x: number, y: number): void {
  fillPoly(ctx, [x - 15, y - 6, x + 15, y - 6, x + 15, y + 5, x - 15, y + 5], C.timberDark);
  fillPoly(ctx, [x - 13, y - 3.5, x + 13, y - 3.5, x + 13, y + 3, x - 13, y + 3], C.void);
  strokeLine(ctx, [x - 15, y - 6.4, x + 15, y - 6.4], rgba(C.timberRim, 0.8), 0.9);
}

/** Height of each extra course of logs on the Soviet log dugout's roof. */
const LOG_COURSE = 10;

/**
 * The timber dugout; with logs = 3 it is the Red Army's log dugout: three courses of logs on the roof under earth and
 * sod, and log cheeks at the door instead of bags.
 */
function paintDugout(ctx: Ctx, state: DamageState, faction: FactionId, logs = 1, L: HqStyleLayout = HQ_STYLE_LAYOUT.dugout): void {
  const tint = FACTIONS[faction].look.tint;
  const rand = rng(1917);
  const ruin = state === 'ruin';
  const { x0, x1, face } = DUG;
  const soviet = logs > 1;
  // Everything above the first course of logs rises with the extra courses.
  const lift = (logs - 1) * LOG_COURSE;
  const beamTop = DUG.beamTop - lift;
  const dl = L.doorX - L.doorW / 2;
  const dr = dl + L.doorW;

  if (!ruin) flagpole(ctx, L);

  // Earth heaped over the back and the roof.
  rimmed(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(-158, 2);
      c.quadraticCurveTo(-130, -60 - lift, -96, -78 - lift);
      c.quadraticCurveTo(0, -94 - lift, 104, -78 - lift);
      c.quadraticCurveTo(136, -60 - lift, 160, 2);
      c.closePath();
    },
    C.earth,
    C.earthRim,
  );

  logWall(ctx, rand);
  firingSlit(ctx, -72, -38);
  firingSlit(ctx, -22, -38);
  firingSlit(ctx, 94, -38);

  // Revetted entrance: timber frame and sandbag cheeks.
  doorway(ctx, L);
  for (let i = 1; i < 4; i++) strokeLine(ctx, [dl + 2, -i * 4, dr - 2, -i * 4], rgba(C.timberRim, 0.18), 1.2);
  rimRect(ctx, dl - 5, -L.doorH - 2, 5, L.doorH + 4, 1, C.timber, C.timberRim);
  rimRect(ctx, dr, -L.doorH - 2, 5, L.doorH + 4, 1, C.timber, C.timberRim);
  if (soviet) {
    // Cheeks of short logs stacked either side of the door.
    for (let r = 0; r < 5; r++) {
      beam(ctx, dl - 26, -4 - r * 7.4, dl - 6, -4 - r * 7.4, 6.4);
      beam(ctx, dr + 6, -4 - r * 7.4, dr + 26, -4 - r * 7.4, 6.4);
    }
  } else {
    for (let r = 0; r < 4; r++) {
      sandbag(ctx, dl - 5 - BAG_W + (r % 2) * 1.5, -BAG_H - r * 8.2, BAG_W, BAG_H, ((r + 1) % 3) * 0.3 - 0.3);
      sandbag(ctx, dr + 5 - (r % 2) * 1.5, -BAG_H - r * 8.2, BAG_W, BAG_H, (r % 3) * 0.3 - 0.3);
    }
  }

  // Roof: heavy logs with their ends showing (one course, or the Soviet three), earth and a course of bags or sod on top.
  for (let course = 0; course < logs; course++) {
    const top = DUG.beamTop - course * LOG_COURSE;
    const inset = course * 5;
    const h = course === 0 ? -DUG.beamTop - face : LOG_COURSE;
    rimRect(ctx, x0 - 6 + inset, top, x1 - x0 + 12 - inset * 2, h, 2, C.timber, C.timberRim);
    for (let x = x0 + 2 + inset + (course % 2) * 5.8; x <= x1 - 2 - inset; x += 11.6) {
      ctx.fillStyle = C.timberDark;
      ctx.beginPath();
      ctx.arc(x, top + 5, 4.8, 0, TAU);
      ctx.fill();
      ctx.fillStyle = mix(C.timber, C.timberRim, 0.35);
      ctx.beginPath();
      ctx.arc(x, top + 4.7, 3.7, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = rgba(C.timberDark, 0.8);
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.arc(x, top + 4.7, 1.7, 0, TAU);
      ctx.stroke();
    }
  }
  rimmed(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(x0 - 8, beamTop + 1);
      c.quadraticCurveTo(-30, beamTop - 16, 40, beamTop - 13);
      c.quadraticCurveTo(96, beamTop - 10, x1 + 10, beamTop + 1);
      c.closePath();
    },
    mix(C.earth, C.earthRim, 0.12),
    C.earthRim,
  );
  if (soviet) grassTufts(ctx, [-90, beamTop - 2, -50, beamTop - 10, -10, beamTop - 13, 30, beamTop - 13, 70, beamTop - 9, 100, beamTop - 3], rand);
  else bagCourse(ctx, -84, 70, beamTop - 18, BAG_W, BAG_H, -84);

  // Camouflage net over the roof, hanging to just above the door.
  const nrand = rng(1918);
  const edge: number[] = [];
  for (let x = -134; x <= 138; x += 9) {
    const u = (x + 134) / 272;
    const drop = Math.sin(u * Math.PI);
    edge.push(x, -26 - drop * 36 + nrand() * 5);
  }
  const outline = [-104, -86 - lift, -40, -96 - lift, 40, -96 - lift, 104, -86 - lift];
  for (let i = edge.length - 2; i >= 0; i -= 2) outline.push(edge[i], edge[i + 1]);
  camoNet(ctx, outline, edge, nrand, tint, 0.8);

  // Heavy corner posts at both ends of the log wall.
  rimRect(ctx, x0 - 4, -face - 2, 8, face + 4, 1.5, C.timber, C.timberRim);
  rimRect(ctx, x1 - 4, -face - 2, 8, face + 4, 1.5, C.timber, C.timberRim);

  // Stovepipe.
  rimRect(ctx, 66, beamTop - 40, 5, 26, 1, C.steel, C.steelRim);
  rimPoly(ctx, [62, beamTop - 40, 68.5, beamTop - 46, 75, beamTop - 40], C.steel, C.steelRim, 1);

  if (state === 'damaged') {
    const drand = rng(1919);
    bite(ctx, [-36, beamTop - 40, -30, beamTop - 18, -18, beamTop - 8, -4, beamTop - 12, 6, beamTop - 6, 18, beamTop - 20, 24, beamTop - 40]);
    beam(ctx, -30, beamTop - 6, -40, beamTop - 22, 3.2);
    beam(ctx, 10, beamTop - 4, 20, beamTop - 18, 3.2);
    shellHole(ctx, -50, -24, 7, drand);
    shellHole(ctx, 76, -14, 5, drand);
    scorch(ctx, -10, beamTop - 6, 34, 18, 0.65);
    scorch(ctx, -50, -24, 28, 22, 0.55);
    scorch(ctx, 120, -30, 24, 18, 0.45);
    looseBag(ctx, -40, -4, 0.4, 0.2);
    looseBag(ctx, 128, -4, -0.3, -0.2);
    looseBag(ctx, 30, beamTop - 2, 0.9, 0);
    for (let i = 0; i < 3; i++) ember(ctx, -24 + drand() * 40, beamTop - 2 - drand() * 6, 2 + drand() * 2, 0.6);
  }

  if (ruin) {
    const rrand = rng(1920);
    // The roof has caved in: what stands is a low, lumpy bank of earth with the pit behind it.
    const profile: number[] = [];
    const prand = rng(1922);
    for (let x = -172; x <= 172; x += 8) {
      const u = (x + 172) / 344;
      const bank = Math.sin(u * Math.PI) ** 0.6;
      profile.push(x, -(4 + bank * (22 + prand() * 16) + (Math.abs(x - 20) < 30 ? -8 : 0)));
    }
    const n = profile.length;
    bite(ctx, [profile[0], -L.box.oy, ...profile, profile[n - 2], -L.box.oy]);
    behind(
      ctx,
      [-140, 2, -126, -36, -100, -48, -60, -44, -20, -52, 20, -46, 60, -54, 100, -44, 126, -34, 144, 2],
      mix(C.earth, C.earthDark, 0.55),
    );
    // The roof caved in: beams snapped and tipped into the pit, posts leaning.
    beam(ctx, -100, -40, -36, -6, 5);
    beam(ctx, -26, -8, 40, -42, 5);
    beam(ctx, 52, -6, 110, -36, 4.5);
    beam(ctx, -60, -46, -48, -14, 4);
    strokeLine(ctx, [26, 2, 34, -50], C.timberDark, 5);
    strokeLine(ctx, [80, 2, 70, -40], C.timberDark, 5);
    heap(ctx, -150, -40, 4, 22, rrand, C.earth, C.earthRim);
    heap(ctx, -30, 70, 4, 18, rrand, mix(C.earth, C.timberDark, 0.3), C.earthRim);
    heap(ctx, 96, 156, 4, 20, rrand, C.earth, C.earthRim);
    for (let i = 0; i < 6; i++) {
      const lx = -120 + rrand() * 240;
      beam(ctx, lx, -2 - rrand() * 4, lx + 14 + rrand() * 12, -6 - rrand() * 10, 3.6);
    }
    looseBag(ctx, -120, -6, 0.5, 0);
    looseBag(ctx, -54, -4, -0.3, -0.3);
    looseBag(ctx, 40, -5, 0.2, 0.3);
    looseBag(ctx, 132, -4, -0.6, -0.2);
    const tr = rng(1921);
    for (let i = 0; i < 9; i++) tuft(ctx, -110 + tr() * 220, -6 - tr() * 26, 3 + tr() * 2, tr, tint);
    fallenPole(ctx, -70, -10, 96, 0.1);
    charOver(ctx, -L.box.ox, -L.box.oy, L.box.w, L.box.h, 0.4);
    for (const f of L.fires) {
      ember(ctx, f.x, f.y + 18, 16, 0.55);
      ember(ctx, f.x + 9 - rrand() * 18, f.y + 22, 5, 0.8);
    }
    for (let i = 0; i < 9; i++) ember(ctx, -120 + rrand() * 240, -6 - rrand() * 26, 2 + rrand() * 2.5, 0.75);
  }
  footing(ctx, -170, 170, 2, 9, rand);
}

// ---------------------------------------------------------------------------
// Specs
// ---------------------------------------------------------------------------

type Painter = (ctx: Ctx, state: DamageState, faction: FactionId) => void;

// ---------------------------------------------------------------------------
// Soviet: the rain-cape tent and the zemlyanka (the log dugout and the DOT are above and in ./hq)
// ---------------------------------------------------------------------------

/** A ridge tent of rain capes: the shared small tent, lower bags, with the capes' seams and buttons over the canvas. */
const CAPE_TENT: TentPlan = {
  main: { x0: -86, x1: 86, wall: 62, ridge: 104, eave: 6 },
  bagRows: 1,
  annexBagRows: 0,
  net: false,
  crateX: 60,
  crates: 1,
  seed: 1941,
};

function paintCapeTent(ctx: Ctx, state: DamageState, faction: FactionId): void {
  const L = HQ_STYLE_LAYOUT.capeTent;
  paintTent(ctx, state, faction, L, CAPE_TENT);
  if (state === 'ruin') return;
  const t = CAPE_TENT.main;
  const k = tonesFor(faction);
  const sag = state === 'damaged' ? 11 : 0;
  // Each cape is a square buttoned to its neighbours: seams run down the roof from the ridge and along the wall.
  inside(
    ctx,
    (c) => roofPath(c, t, sag),
    () => {
      const xa = t.x0 - t.eave;
      const span = t.x1 - t.x0 + 2 * t.eave;
      for (let i = 0; i <= 6; i++) {
        const xb = xa + (span * i) / 6;
        strokeLine(ctx, [xb - 16, -t.ridge, xb + 16, -t.wall + 2], rgba(k.dark, 0.85), 0.9);
        for (let j = 1; j < 4; j++) {
          const u = j / 4;
          ctx.fillStyle = rgba(k.rim, 0.7);
          ctx.fillRect(xb - 16 + 32 * u - 0.6, -t.ridge + (t.ridge - t.wall + 2) * u - 0.6, 1.2, 1.2);
        }
      }
      strokeLine(ctx, [xa, -t.wall - (t.ridge - t.wall) * 0.5, xa + span, -t.wall - (t.ridge - t.wall) * 0.5 + sag * 0.5], rgba(k.dark, 0.6), 0.8);
    },
  );
  // A low bank of spoil thrown up along the foot of the wall.
  const rand = rng(1942);
  rimmed(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(t.x0 - 18, 2);
      c.quadraticCurveTo(t.x0 - 6, -12, t.x0 + 30, -10);
      c.lineTo(L.doorX - L.doorW / 2 - 18, -9);
      c.quadraticCurveTo(L.doorX - L.doorW / 2 - 6, -6, L.doorX - L.doorW / 2 - 2, 2);
      c.closePath();
    },
    C.earth,
    C.earthRim,
  );
  grassTufts(ctx, [t.x0 - 4, -10, t.x0 + 30, -11, -8, -10], rand);
}

/** The zemlyanka: a dugout under a mound of earth and sod, its entrance cut down into the front with log revetments. */
function paintZemlyanka(ctx: Ctx, state: DamageState, faction: FactionId): void {
  const L = HQ_STYLE_LAYOUT.zemlyanka;
  const tint = FACTIONS[faction].look.tint;
  const rand = rng(1943);
  const ruin = state === 'ruin';
  const dl = L.doorX - L.doorW / 2;
  const dr = dl + L.doorW;
  const top = -L.bodyH;

  if (ruin) {
    const rrand = rng(1944);
    // The roof logs have given way: a slumped heap of earth, the pit open in the middle, logs jutting out.
    behind(ctx, [-150, 2, -126, -30, -90, -40, -40, -34, 0, -44, 40, -36, 90, -42, 130, -28, 152, 2], mix(C.earth, C.earthDark, 0.55));
    heap(ctx, -160, -30, 4, 30, rrand, C.earth, C.earthRim);
    heap(ctx, -40, 70, 4, 16, rrand, mix(C.earth, C.timberDark, 0.3), C.earthRim);
    heap(ctx, 80, 160, 4, 26, rrand, C.earth, C.earthRim);
    beam(ctx, -90, -30, -30, -4, 5);
    beam(ctx, -20, -6, 40, -36, 5);
    beam(ctx, 56, -4, 104, -32, 4.5);
    strokeLine(ctx, [dl - 2, 2, dl + 6, -40], C.timberDark, 5);
    strokeLine(ctx, [-30, -60, -12, -24], C.steel, 3.4);
    for (let i = 0; i < 7; i++) tuft(ctx, -120 + rrand() * 240, -6 - rrand() * 22, 3 + rrand() * 2, rrand, tint);
    fallenPole(ctx, -110, -8, 90, 0.08);
    charOver(ctx, -L.box.ox, -L.box.oy, L.box.w, L.box.h, 0.38);
    for (const f of L.fires) {
      ember(ctx, f.x, f.y + 20, 14, 0.55);
      ember(ctx, f.x + 9 - rrand() * 18, f.y + 24, 5, 0.8);
    }
    for (let i = 0; i < 8; i++) ember(ctx, -110 + rrand() * 220, -6 - rrand() * 22, 2 + rrand() * 2.5, 0.75);
    footing(ctx, -164, 164, 2, 8, rand);
    return;
  }

  flagpole(ctx, L);
  // Firewood stacked at the back.
  for (let r = 0; r < 3; r++) for (let i = 0; i < 4 - r; i++) {
    const x = -150 + i * 9 + r * 4.5;
    const y = -4 - r * 8;
    ctx.fillStyle = C.timberDark;
    ctx.beginPath();
    ctx.arc(x, y, 4.4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = mix(C.timber, C.timberRim, 0.3);
    ctx.beginPath();
    ctx.arc(x, y - 0.3, 3.3, 0, TAU);
    ctx.fill();
  }
  // The mound: low and long, the sod on top.
  const mound = (c: Ctx): void => {
    c.beginPath();
    c.moveTo(-136, 2);
    c.quadraticCurveTo(-120, top + 8, -60, top);
    c.quadraticCurveTo(10, top - 6, 80, top + 4);
    c.quadraticCurveTo(140, top + 20, 156, 2);
    c.closePath();
  };
  rimmed(ctx, mound, C.earth, C.earthRim);
  inside(ctx, mound, () => {
    // Sod: a darker grassy skin over the top, and lumps of turf.
    ctx.fillStyle = rgba(C.grass, 0.35);
    ctx.fillRect(-140, top - 10, 300, 22);
    for (let i = 0; i < 9; i++) {
      const x = -110 + rand() * 230;
      fillPoly(ctx, [x - 8, top + 10 + rand() * 6, x + 8, top + 8 + rand() * 6, x + 6, top + 16 + rand() * 6, x - 6, top + 17 + rand() * 6], rgba(C.earthDark, 0.35));
    }
  });
  grassTufts(ctx, [-110, top + 12, -80, top + 3, -40, top - 1, 0, top - 2, 40, top - 1, 80, top + 4, 120, top + 14], rand);
  // Branches laid over the sod for camouflage.
  for (const [x, y, a] of [
    [-70, top + 2, -0.2],
    [12, top - 2, 0.15],
    [92, top + 8, 0.35],
  ] as const) {
    strokeLine(ctx, [x - 18, y + Math.sin(a) * -18, x + 18, y + Math.sin(a) * 18], C.timberDark, 1.4);
    for (let i = 0; i < 4; i++) tuft(ctx, x - 14 + i * 9, y - 2 + (i % 2) * 3, 3.4, rand, tint);
  }
  // The entrance cut into the front: the dark doorway, log walls stepping down beside it and the lintel log.
  fillPoly(ctx, [dl - 22, 2, dl - 14, -L.doorH - 6, dr + 14, -L.doorH - 6, dr + 22, 2], mix(C.earth, C.earthDark, 0.6));
  doorway(ctx, L);
  for (let i = 1; i < 4; i++) strokeLine(ctx, [dl + 2, -i * 4, dr - 2, -i * 4], rgba(C.timberRim, 0.18), 1.2);
  for (let r = 0; r < 6; r++) {
    const y = -4 - r * 9.4;
    beam(ctx, dl - 20 + r * 1.2, y, dl - 3, y, 7);
    beam(ctx, dr + 3, y, dr + 20 - r * 1.2, y, 7);
  }
  rimRect(ctx, dl - 6, -L.doorH - 2, 5, L.doorH + 4, 1, C.timber, C.timberRim);
  rimRect(ctx, dr + 1, -L.doorH - 2, 5, L.doorH + 4, 1, C.timber, C.timberRim);
  beam(ctx, dl - 18, -L.doorH - 5, dr + 18, -L.doorH - 5, 8);
  // A small window of a single pane low in the mound's flank, and the stovepipe through the roof.
  fillPoly(ctx, [-96, -30, -76, -30, -76, -18, -96, -18], C.timberDark);
  fillPoly(ctx, [-94, -28, -78, -28, -78, -20, -94, -20], mix(C.void, '#d6a054', 0.25));
  const pipeTilt = state === 'damaged' ? 0.5 : 0;
  ctx.save();
  ctx.translate(-14, top + 2);
  ctx.rotate(pipeTilt);
  rimRect(ctx, -2.5, -30, 5, 30, 1, C.steel, C.steelRim);
  rimPoly(ctx, [-6, -30, 0, -36, 6, -30], C.steel, C.steelRim, 1);
  ctx.restore();

  if (state === 'damaged') {
    const drand = rng(1945);
    bite(ctx, [-50, top - 20, -44, top + 4, -30, top + 12, -12, top + 8, 4, top + 14, 16, top + 2, 22, top - 20]);
    beam(ctx, -40, top + 10, -50, top - 4, 3.6);
    beam(ctx, 4, top + 12, 14, top - 2, 3.6);
    shellHole(ctx, 100, -22, 6, drand);
    scorch(ctx, -14, top + 10, 36, 18, 0.6);
    scorch(ctx, 100, -22, 26, 20, 0.5);
    scorch(ctx, dl - 30, -18, 22, 16, 0.4);
    for (let i = 0; i < 3; i++) ember(ctx, -30 + drand() * 40, top + 8 - drand() * 6, 2 + drand() * 2, 0.6);
  }
  footing(ctx, -164, 164, 2, 8, rand);
}

const PAINTERS: Record<HqStyle, Painter> = {
  tent: (ctx, state, faction) => paintTent(ctx, state, faction, HQ_STYLE_LAYOUT.tent, SMALL_TENT),
  bigTent: (ctx, state, faction) => paintTent(ctx, state, faction, HQ_STYLE_LAYOUT.bigTent, BIG_TENT),
  dugout: (ctx, state, faction) => paintDugout(ctx, state, faction),
  bunkerBritish: (ctx, state) => paintBritishBunker(ctx, state, HQ_STYLE_LAYOUT.bunkerBritish, null),
  bunkerGerman: (ctx, state) => paintGermanBunker(ctx, state, HQ_STYLE_LAYOUT.bunkerGerman, null),
  capeTent: paintCapeTent,
  zemlyanka: paintZemlyanka,
  logDugout: (ctx, state, faction) => paintDugout(ctx, state, faction, 3, HQ_STYLE_LAYOUT.logDugout),
  bunkerSoviet: (ctx, state) => paintSovietBunker(ctx, state, HQ_STYLE_LAYOUT.bunkerSoviet, null),
};

/** The three damage states of one HQ style in one nation's colours. */
export function hqStyleSpecs(style: HqStyle, faction: FactionId): SpriteSpec[] {
  const box = HQ_STYLE_LAYOUT[style].box;
  const paint = PAINTERS[style];
  return DAMAGE_STATES.map((state) => makeSpec(hqStyleKey(style, faction, state), box, (ctx) => paint(ctx, state, faction)));
}
