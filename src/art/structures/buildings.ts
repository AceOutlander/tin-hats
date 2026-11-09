/**
 * Buildings, their rubble and the cover props (FOUNDATIONS.md 4.3), drawn in code like every other structure.
 *
 * A building is a stack of floor pieces (the ground floor with its door and plinth, then the upper floors) with a roof
 * piece on the top standing floor, each in an intact and a damaged state; a broken top replaces the roof once a floor
 * has fallen; rubble (stumps behind the men, a heap in front of them) replaces it all when it falls. The facade pieces
 * have their windows cut out at the building's slot positions, so the men at the windows show through them. Layout and
 * colours are in src/data/looksBuilding.ts. Every piece's origin is the bottom centre of its floor.
 *
 * The pieces depend on the look, the width and the slots per floor, so each battle bakes the ones its buildings need
 * (buildingSpecs, like the trench sprites).
 */
import { BUILDINGS } from '../../data/buildings';
import { ART_COLORS as C, type ArtBox } from '../../data/artLayout';
import { BUILDING_LAYOUT as L, BUILDING_STYLES, PROP_LAYOUT, type BuildingStyle } from '../../data/looksBuilding';
import type { BuildingLook, CoverPropLook } from '../../data/schema';
import type { SpriteSpec } from '../types';
import {
  type Ctx,
  TAU,
  balkenkreuz,
  bite,
  charOver,
  chunk,
  concreteFace,
  crack,
  fillPoly,
  footing,
  heap,
  inside,
  makeSpec,
  mix,
  poly,
  rebar,
  rgba,
  rimPoly,
  rimRect,
  rng,
  scorch,
  shellHole,
  strokeLine,
} from '../props/kit';

/** The pieces of one building type. */
export type BuildingPiece = 'ground' | 'groundDamaged' | 'upper' | 'upperDamaged' | 'roof' | 'roofBroken' | 'rubbleBack' | 'rubbleFront';
export const BUILDING_PIECES: readonly BuildingPiece[] = ['ground', 'groundDamaged', 'upper', 'upperDamaged', 'roof', 'roofBroken', 'rubbleBack', 'rubbleFront'];

/** Sprite key of one piece of a building type (look, width, slots per floor). */
export function buildingKey(look: string, width: number, slots: number, piece: BuildingPiece): string {
  return `st/bld/${look}/${Math.round(width)}/${slots}/${piece}`;
}

/** Sprite key of a cover prop: its body behind the men, and the low cover in front of them. */
export function propKey(look: string, width: number, part: 'back' | 'front'): string {
  return `st/prop/${look}/${Math.round(width)}/${part}`;
}

/** Window centres (x from the building's centre) on every floor: the sim's slot positions. */
export function windowXs(width: number, slots: number): number[] {
  const spacing = slots > 0 ? Math.min(BUILDINGS.slotSpacing, width / slots) : 0;
  const out: number[] = [];
  for (let k = 0; k < slots; k++) out.push((k - (slots - 1) / 2) * spacing);
  return out;
}

/** Whole wu boxes (twice the texture scale stays whole). */
function box(w: number, up: number, down: number): ArtBox {
  const bw = Math.ceil(w);
  return { w: bw, h: Math.ceil(up + down), ox: bw / 2, oy: Math.ceil(up) };
}

function seedOf(look: string, width: number, salt: number): number {
  let h = salt * 7919 + Math.round(width);
  for (let i = 0; i < look.length; i++) h = (h * 31 + look.charCodeAt(i)) >>> 0;
  return h;
}

// ---------------------------------------------------------------------------
// Walls
// ---------------------------------------------------------------------------

/** Fill a wall rectangle in the look's material. */
function wall(ctx: Ctx, st: BuildingStyle, x0: number, y0: number, x1: number, y1: number, rand: () => number): void {
  ctx.fillStyle = st.wall;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  switch (st.material) {
    case 'brick': {
      ctx.strokeStyle = rgba(st.wallDark, 0.55);
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      let row = 0;
      for (let y = y1 - 4; y > y0; y -= 4, row++) {
        ctx.moveTo(x0, y);
        ctx.lineTo(x1, y);
        for (let x = x0 + (row % 2 === 0 ? 0 : 4.5); x < x1; x += 9) {
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + 4);
        }
      }
      ctx.stroke();
      for (let i = 0; i < ((x1 - x0) * (y1 - y0)) / 90; i++) {
        ctx.fillStyle = rgba(rand() < 0.5 ? st.wallDark : st.wallRim, 0.22);
        ctx.fillRect(x0 + rand() * (x1 - x0), y0 + rand() * (y1 - y0), 8, 3.4);
      }
      break;
    }
    case 'plaster': {
      // Weathering streaks, and the brick showing where the plaster has come away.
      for (let i = 0; i < (x1 - x0) / 16; i++) {
        const x = x0 + rand() * (x1 - x0);
        ctx.fillStyle = rgba(st.wallDark, 0.12 + rand() * 0.12);
        ctx.fillRect(x, y0, 2 + rand() * 4, (y1 - y0) * (0.4 + rand() * 0.6));
      }
      for (let i = 0; i < (x1 - x0) / 60; i++) {
        const w = 8 + rand() * 12;
        const h = 5 + rand() * 7;
        const x = x0 + rand() * (x1 - x0 - w);
        const y = y0 + 4 + rand() * (y1 - y0 - h - 8);
        fillPoly(ctx, [x, y + 2, x + w * 0.4, y, x + w, y + 1, x + w - 1, y + h, x + 2, y + h - 1], st.under);
        ctx.strokeStyle = rgba(st.wallDark, 0.6);
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        for (let yy = y + 3; yy < y + h; yy += 3.5) {
          ctx.moveTo(x + 1, yy);
          ctx.lineTo(x + w - 1, yy);
        }
        ctx.stroke();
      }
      break;
    }
    case 'logs': {
      for (let y = y1; y > y0; y -= 7) {
        const top = Math.max(y0, y - 7);
        ctx.fillStyle = mix(st.wall, rand() < 0.5 ? st.wallDark : st.wallRim, rand() * 0.25);
        ctx.fillRect(x0, top, x1 - x0, y - top);
        strokeLine(ctx, [x0, top + 0.8, x1, top + 0.8], rgba(st.wallRim, 0.7), 0.8);
        strokeLine(ctx, [x0, y - 0.4, x1, y - 0.4], rgba(st.wallDark, 0.9), 0.9);
      }
      // The log ends at the corners.
      for (let y = y1 - 3.5; y > y0 + 2; y -= 7) {
        for (const x of [x0 + 2.5, x1 - 2.5]) {
          ctx.beginPath();
          ctx.arc(x, y, 3.2, 0, TAU);
          ctx.fillStyle = st.wallRim;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(x, y, 1.4, 0, TAU);
          ctx.fillStyle = st.wallDark;
          ctx.fill();
        }
      }
      break;
    }
    case 'concrete':
      concreteFace(ctx, x0, x1, y0, y1, rand);
      break;
    case 'planks': {
      ctx.strokeStyle = rgba(st.wallDark, 0.85);
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      for (let x = x0 + 6; x < x1; x += 6) {
        ctx.moveTo(x, y0);
        ctx.lineTo(x, y1);
      }
      ctx.stroke();
      for (let i = 0; i < (x1 - x0) / 8; i++) {
        ctx.fillStyle = rgba(rand() < 0.5 ? st.wallDark : st.wallRim, 0.18);
        ctx.fillRect(x0 + Math.floor(rand() * ((x1 - x0) / 6)) * 6, y0, 6, y1 - y0);
      }
      break;
    }
  }
}

/** One window: cut through the wall, then its frame and sill. */
function windowAt(ctx: Ctx, st: BuildingStyle, x: number, damaged: boolean, rand: () => number): void {
  const w = L.windowW;
  let top = L.lintelY;
  let bottom = L.sillY;
  if (st.window === 'tall') top -= 4;
  if (st.window === 'slit') {
    top = -36;
    bottom = -26;
  }
  const x0 = x - w / 2;
  const x1 = x + w / 2;
  const arch = st.window === 'arch';
  const hole = arch
    ? (c: Ctx): void => {
        c.beginPath();
        c.moveTo(x0, bottom);
        c.lineTo(x0, top + w / 2);
        c.arc(x, top + w / 2, w / 2, Math.PI, 0);
        c.lineTo(x1, bottom);
        c.closePath();
      }
    : (c: Ctx): void => {
        c.beginPath();
        c.rect(x0, top, w, bottom - top);
      };
  // Frame first (it shows round the hole), then the hole.
  ctx.save();
  ctx.lineWidth = st.window === 'carved' ? 2.4 : 1.6;
  ctx.strokeStyle = st.trim;
  hole(ctx);
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  hole(ctx);
  ctx.fillStyle = '#000';
  ctx.fill();
  ctx.restore();
  if (st.window === 'carved') {
    // The izba's carved and painted frame: a pointed hood and a fretted apron.
    fillPoly(ctx, [x0 - 3, top - 1, x, top - 7, x1 + 3, top - 1, x1 + 2, top + 0.5, x0 - 2, top + 0.5], st.trim);
    fillPoly(ctx, [x0 - 2, bottom + 1, x1 + 2, bottom + 1, x1, bottom + 5, x, bottom + 3.5, x0, bottom + 5], st.trim);
    strokeLine(ctx, [x0 - 1, top - 2.2, x, top - 5.4, x1 + 1, top - 2.2], '#4d6a86', 0.7);
  } else if (st.window !== 'slit') {
    // Sill and lintel.
    rimRect(ctx, x0 - 2, bottom, w + 4, 2.6, 0.4, mix(st.trim, st.wallDark, 0.25), st.wallRim, 0.6);
    if (!arch) fillPoly(ctx, [x0 - 1.5, top - 2.4, x1 + 1.5, top - 2.4, x1 + 1.5, top, x0 - 1.5, top], mix(st.trim, st.wallDark, 0.15));
  }
  if (st.window === 'tall') {
    // A works window's glazing bars, half the panes gone.
    strokeLine(ctx, [x, top, x, bottom], rgba(C.steel, damaged ? 0.6 : 0.9), 0.8);
    strokeLine(ctx, [x0, (top + bottom) / 2, x1, (top + bottom) / 2], rgba(C.steel, damaged ? 0.5 : 0.85), 0.8);
  }
  if (damaged && rand() < 0.6) {
    // A broken frame: a shard of shutter or glass hanging in the hole.
    fillPoly(ctx, [x0, top + 2, x0 + 4 + rand() * 3, top + 4, x0 + 1, top + 12 + rand() * 6], rgba(C.glass, 0.55));
  }
}

/** A shell hole through the wall (the interior shows), with spalled edges. */
function breach(ctx: Ctx, st: BuildingStyle, x: number, y: number, r: number, rand: () => number): void {
  const pts: number[] = [];
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const rr = r * (0.6 + rand() * 0.55);
    pts.push(x + Math.cos(a) * rr * 1.2, y + Math.sin(a) * rr);
  }
  ctx.save();
  poly(ctx, pts);
  ctx.lineWidth = 3;
  ctx.strokeStyle = st.under;
  ctx.stroke();
  ctx.restore();
  bite(ctx, pts);
}

/** Damage on a floor's facade: cracks, scorch, breaches, chunks out of the corners. */
function damage(ctx: Ctx, st: BuildingStyle, half: number, top: number, xs: readonly number[], rand: () => number): void {
  for (let i = 0; i < 3; i++) crack(ctx, -half + rand() * half * 2, top + 6 + rand() * 30, rand() * TAU, 10 + rand() * 14, rand, 0.8, rgba(C.void, 0.8));
  scorch(ctx, -half * 0.4 + rand() * half, top + 20, 22, 18, 0.55);
  scorch(ctx, (rand() - 0.5) * half * 1.4, top + 10, 16, 12, 0.45);
  // A breach between two windows.
  if (xs.length >= 2) {
    const k = Math.floor(rand() * (xs.length - 1));
    breach(ctx, st, (xs[k] + xs[k + 1]) / 2, top + 30 + rand() * 8, 5 + rand() * 2.5, rand);
  }
  bite(ctx, [half - 14 - rand() * 8, top - 1, half + 2, top - 1, half + 2, top + 12 + rand() * 8]);
  shellHole(ctx, -half * 0.6 + rand() * half * 1.2, top + 40, 4.5, rand);
}

/** A floor's facade: wall, string course, windows (cut out), and on the ground floor the plinth and door. */
function paintFloor(ctx: Ctx, look: BuildingLook, width: number, slots: number, ground: boolean, damaged: boolean): void {
  const st = BUILDING_STYLES[look];
  const rand = rng(seedOf(look, width, ground ? 1 : 2));
  const half = width / 2;
  const top = -L.floorH;
  if (look === 'waterTank') {
    // A concrete drum: rounded shoulders, banded.
    inside(
      ctx,
      (c) => {
        c.beginPath();
        c.rect(-half, top, width, -top);
      },
      () => {
        wall(ctx, st, -half, top, half, 0, rand);
        const g = ctx.createLinearGradient(-half, 0, half, 0);
        g.addColorStop(0, rgba(C.void, 0.45));
        g.addColorStop(0.3, rgba(C.void, 0));
        g.addColorStop(0.7, rgba(C.void, 0));
        g.addColorStop(1, rgba(C.void, 0.55));
        ctx.fillStyle = g;
        ctx.fillRect(-half, top, width, -top);
        for (const y of [top + 10, top + 30]) strokeLine(ctx, [-half, y, half, y], rgba(C.concreteDark, 0.8), 1.4);
      },
    );
  } else {
    wall(ctx, st, -half, top, half, 0, rand);
    // String course at the floor's top, shade under it.
    rimRect(ctx, -half - 2, top, width + 4, 3.4, 0.3, mix(st.trim, st.wallDark, 0.3), st.wallRim, 0.8);
    ctx.fillStyle = rgba(C.void, 0.18);
    ctx.fillRect(-half, top + 3.4, width, 4);
    // Corner quoins or posts.
    for (const x of [-half, half - 4]) {
      ctx.fillStyle = rgba(st.material === 'brick' ? st.wallRim : st.wallDark, 0.35);
      ctx.fillRect(x, top, 4, -top);
    }
  }
  const xs = windowXs(width, slots);
  for (const x of xs) windowAt(ctx, st, x, damaged, rand);
  if (ground) {
    if (look !== 'waterTank') {
      ctx.fillStyle = rgba(st.wallDark, 0.75);
      ctx.fillRect(-half, -7, width, 7);
      strokeLine(ctx, [-half, -7, half, -7], rgba(st.wallRim, 0.6), 0.8);
    }
    // The door at the left end, if the windows leave room for it.
    const doorX = -half + L.doorInset;
    const span = xs.length > 0 ? xs[0] - L.windowW / 2 : half;
    if (doorX + L.doorW / 2 + 2 < span) {
      const d0 = doorX - L.doorW / 2;
      rimRect(ctx, d0 - 2, -44, L.doorW + 4, 44, 1, mix(st.trim, st.wallDark, 0.35), st.wallRim, 0.6);
      bite(ctx, [d0, 0, d0, -41, d0 + L.doorW, -41, d0 + L.doorW, 0]);
    }
    footing(ctx, -half - 4, half + 4, 0, 6, rand);
  }
  if (damaged) damage(ctx, st, half, top, xs, rand);
}

// ---------------------------------------------------------------------------
// Roofs
// ---------------------------------------------------------------------------

function sheetSeams(ctx: Ctx, pts: readonly number[], x0: number, x1: number, y0: number, step: number, colour: string): void {
  inside(
    ctx,
    (c) => poly(c, pts),
    () => {
      ctx.strokeStyle = colour;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      for (let x = x0; x < x1; x += step) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, y0);
      }
      ctx.stroke();
    },
  );
}

/** The roof on top of the top standing floor (origin = that floor's top line). */
function paintRoof(ctx: Ctx, look: BuildingLook, width: number): void {
  const st = BUILDING_STYLES[look];
  const rand = rng(seedOf(look, width, 3));
  const half = width / 2;
  const rise = Math.min(40, width * 0.26);
  switch (st.roof) {
    case 'gable': {
      const pts = [-half - 7, 1, 0, -rise, half + 7, 1];
      rimPoly(ctx, pts, st.roofColour, st.roofRim, 1.4);
      sheetSeams(ctx, pts, -half - 7, half + 7, -rise, look === 'izba' ? 4 : 7, rgba(C.void, 0.3));
      if (look === 'izba') {
        // The carved gable board and the brick stove chimney.
        strokeLine(ctx, [-half - 6, 0, 0, -rise + 1, half + 6, 0], st.trim ?? C.silk, 1.6);
        rimRect(ctx, half * 0.35, -rise * 0.8, 8, rise * 0.55, 0.5, '#7a4630', '#a8705a', 0.8);
      } else {
        rimRect(ctx, -half * 0.45, -rise * 0.75, 7, rise * 0.5, 0.4, mix(st.wall, st.wallDark, 0.3), st.wallRim, 0.8);
      }
      break;
    }
    case 'flat': {
      // A cornice and a low parapet; on the casemate, a bank of earth and grass.
      if (look === 'casemate') {
        heap(ctx, -half - 4, half + 4, 1, 16, rand, C.earth, C.earthRim);
        for (let i = 0; i < width / 10; i++) strokeLine(ctx, [-half + rand() * width, -6 - rand() * 8, -half + rand() * width, -9 - rand() * 8], C.grass, 1);
      } else {
        rimRect(ctx, -half - 4, -5, width + 8, 5, 0.4, mix(st.trim, st.wallDark, 0.2), st.wallRim, 0.8);
        rimRect(ctx, -half - 1, -11, width + 2, 6, 0.3, st.roofColour, st.roofRim, 0.8);
        // A chimney stack and an aerial.
        rimRect(ctx, half * 0.4, -24, 10, 13, 0.4, mix(st.wall, st.wallDark, 0.25), st.wallRim, 0.8);
        strokeLine(ctx, [-half * 0.5, -11, -half * 0.5, -32], rgba(C.ink, 0.8), 0.7);
      }
      break;
    }
    case 'dome': {
      // A low roof over the nave, a drum, and the onion dome over it.
      const pts = [-half - 5, 1, -half + 8, -14, half - 8, -14, half + 5, 1];
      rimPoly(ctx, pts, '#4f5c55', '#7d9086', 1.2);
      rimRect(ctx, -12, -30, 24, 17, 0.4, st.wall, st.wallRim, 0.8);
      for (const x of [-6, 0, 6]) fillPoly(ctx, [x - 1.4, -27, x + 1.4, -27, x + 1.4, -18, x - 1.4, -18], C.void);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-15, -30);
      ctx.bezierCurveTo(-19, -40, -10, -48, 0, -60);
      ctx.bezierCurveTo(10, -48, 19, -40, 15, -30);
      ctx.closePath();
      ctx.fillStyle = st.roofRim;
      ctx.fill();
      ctx.clip();
      ctx.translate(1, 1.4);
      ctx.beginPath();
      ctx.moveTo(-15, -30);
      ctx.bezierCurveTo(-19, -40, -10, -48, 0, -60);
      ctx.bezierCurveTo(10, -48, 19, -40, 15, -30);
      ctx.closePath();
      ctx.fillStyle = st.roofColour;
      ctx.fill();
      ctx.restore();
      strokeLine(ctx, [0, -60, 0, -63], C.ink, 1);
      break;
    }
    case 'sawtooth': {
      const teeth = Math.max(2, Math.round(width / 50));
      const tw = (width + 8) / teeth;
      for (let i = 0; i < teeth; i++) {
        const x0 = -half - 4 + i * tw;
        rimPoly(ctx, [x0, 1, x0 + tw * 0.78, -24, x0 + tw, -24, x0 + tw, 1], st.roofColour, st.roofRim, 1.2);
        // The glazed north light on the steep side.
        fillPoly(ctx, [x0 + tw * 0.82, -21, x0 + tw - 1, -21, x0 + tw - 1, -2, x0 + tw * 0.96, -2], rgba(C.glass, 0.8));
      }
      // The works chimney.
      rimRect(ctx, half * 0.55, -60, 11, 40, 0.5, mix(st.wall, st.wallDark, 0.2), st.wallRim, 0.8);
      break;
    }
    case 'vault': {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-half - 4, 1);
      ctx.quadraticCurveTo(0, -rise * 1.5, half + 4, 1);
      ctx.closePath();
      ctx.fillStyle = st.roofRim;
      ctx.fill();
      ctx.clip();
      ctx.translate(0.3, 1.4);
      ctx.beginPath();
      ctx.moveTo(-half - 4, 1);
      ctx.quadraticCurveTo(0, -rise * 1.5, half + 4, 1);
      ctx.closePath();
      ctx.fillStyle = st.roofColour;
      ctx.fill();
      ctx.strokeStyle = rgba(C.void, 0.35);
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      for (let x = -half; x < half; x += 12) {
        ctx.moveTo(x, 2);
        ctx.lineTo(x * 0.92, -rise * 1.2);
      }
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'cone': {
      rimPoly(ctx, [-half - 3, 1, -half * 0.25, -16, half * 0.25, -16, half + 3, 1], st.roofColour, st.roofRim, 1.2);
      rimRect(ctx, -5, -22, 10, 7, 0.5, st.wall, st.wallRim, 0.6);
      break;
    }
    case 'hip': {
      const pts = [-half - 6, 1, -half + rise * 0.8, -rise * 0.7, half - rise * 0.8, -rise * 0.7, half + 6, 1];
      rimPoly(ctx, pts, st.roofColour, st.roofRim, 1.3);
      sheetSeams(ctx, pts, -half - 6, half + 6, -rise, 7, rgba(C.void, 0.3));
      // The clock gable over the middle.
      rimPoly(ctx, [-16, 1, -16, -rise * 0.9, 0, -rise * 1.25, 16, -rise * 0.9, 16, 1], st.wall, st.wallRim, 1);
      ctx.beginPath();
      ctx.arc(0, -rise * 0.62, 6, 0, TAU);
      ctx.fillStyle = C.flagWhite;
      ctx.fill();
      strokeLine(ctx, [0, -rise * 0.62, 0, -rise * 0.62 - 4, 0, -rise * 0.62, 3, -rise * 0.62], C.ink, 0.8);
      break;
    }
  }
}

/** The broken top of the highest standing floor once the floors above it have fallen. */
function paintBrokenTop(ctx: Ctx, look: BuildingLook, width: number): void {
  const st = BUILDING_STYLES[look];
  const rand = rng(seedOf(look, width, 4));
  const half = width / 2;
  // Jagged teeth of wall standing above the floor line.
  const pts: number[] = [-half, 1];
  const n = Math.max(5, Math.round(width / 14));
  for (let i = 0; i <= n; i++) {
    const x = -half + (width * i) / n;
    const tall = rand() < 0.35 ? 10 + rand() * 18 : rand() * 5;
    pts.push(x, -tall);
  }
  pts.push(half, 1);
  rimPoly(ctx, pts, mix(st.wall, st.wallDark, 0.25), st.wallRim, 1);
  charOver(ctx, -half, -30, width, 32, 0.25);
  // Floor joists sticking out of the broken wall.
  for (let i = 0; i < 3; i++) {
    const x = -half + 10 + rand() * (width - 20);
    const a = -0.4 + rand() * 0.8;
    strokeLine(ctx, [x, -1, x + Math.cos(a - Math.PI / 2) * 4 + 8 * Math.sin(a), -1 - 12 * Math.cos(a)], C.timberDark, 2.2);
  }
  rebar(ctx, -half * 0.3, -6, rand);
  for (let i = 0; i < 5; i++) chunk(ctx, -half + rand() * width, -1 - rand() * 3, 4 + rand() * 4, rand, mix(st.wall, st.wallDark, rand() * 0.5), st.wallRim);
}

// ---------------------------------------------------------------------------
// Rubble
// ---------------------------------------------------------------------------

/** What is left standing behind the men: stumps of wall, one with half a window. */
function paintRubbleBack(ctx: Ctx, look: BuildingLook, width: number): void {
  const st = BUILDING_STYLES[look];
  const rand = rng(seedOf(look, width, 5));
  const half = width / 2;
  const stump = (x0: number, x1: number, h: number): void => {
    const pts = [x0, 1, x0, -h * (0.7 + rand() * 0.3), (x0 + x1) / 2, -h, x1, -h * (0.4 + rand() * 0.4), x1, 1];
    inside(
      ctx,
      (c) => poly(c, pts),
      () => {
        wall(ctx, st, x0, -h - 2, x1, 1, rand);
        charOver(ctx, x0, -h - 2, x1 - x0, h + 3, 0.3);
      },
    );
    strokeLine(ctx, pts.slice(2, 8), rgba(st.wallRim, 0.6), 0.8);
  };
  stump(-half, -half + width * 0.28, L.rubbleBackH - 6);
  stump(half - width * 0.22, half, L.rubbleBackH * 0.6);
  if (width > 140) stump(-width * 0.06, width * 0.08, L.rubbleBackH * 0.45);
  rebar(ctx, -half + width * 0.2, -L.rubbleBackH * 0.5, rand);
}

/** The heap in front of the men in the rubble: they crouch behind it as behind a parapet. */
function paintRubbleFront(ctx: Ctx, look: BuildingLook, width: number): void {
  const st = BUILDING_STYLES[look];
  const rand = rng(seedOf(look, width, 6));
  const half = width / 2;
  const body = mix(st.wallDark, C.earth, 0.35);
  // Solid down below the crouching men's feet (as a trench's near wall), fading into the ground at the ends.
  const pts: number[] = [-half - 8, L.rubbleFrontDown - 4];
  const n = Math.max(6, Math.round(width / 10));
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const arch = Math.sin(u * Math.PI) ** 0.4;
    pts.push(-half - 8 + (width + 16) * u, -6 - arch * (6 + rand() * 9) + 6 * (1 - arch));
  }
  pts.push(half + 8, L.rubbleFrontDown - 4);
  rimPoly(ctx, pts, body, mix(st.wallRim, C.earthRim, 0.4), 1.2);
  const g = ctx.createLinearGradient(0, 4, 0, L.rubbleFrontDown);
  g.addColorStop(0, rgba(C.earthDark, 0));
  g.addColorStop(1, rgba(C.earthDark, 0.5));
  inside(
    ctx,
    (c) => poly(c, pts),
    () => {
      ctx.fillStyle = g;
      ctx.fillRect(-half - 8, 0, width + 16, L.rubbleFrontDown);
    },
  );
  for (let i = 0; i < width / 6; i++) {
    const x = -half + rand() * width;
    chunk(ctx, x, -6 - rand() * 8 + rand() * 30, 4 + rand() * 6, rand, mix(st.wall, st.wallDark, rand() * 0.6), st.wallRim);
  }
  for (let i = 0; i < 3; i++) {
    const x = -half + rand() * width;
    strokeLine(ctx, [x, -8 - rand() * 4, x + 14 + rand() * 10, -2 + rand() * 6], C.timberDark, 2);
  }
}

/** Every piece of one building type (look, width, slots per floor), for the battle's atlas. */
export function buildingSpecs(look: BuildingLook, width: number, slots: number): SpriteSpec[] {
  const w = width + L.pad * 2;
  const floorBox = box(w, L.floorH + 4, 8);
  const roofBox = box(w, L.roofH, 4);
  return [
    makeSpec(buildingKey(look, width, slots, 'ground'), floorBox, (c) => paintFloor(c, look, width, slots, true, false)),
    makeSpec(buildingKey(look, width, slots, 'groundDamaged'), floorBox, (c) => paintFloor(c, look, width, slots, true, true)),
    makeSpec(buildingKey(look, width, slots, 'upper'), floorBox, (c) => paintFloor(c, look, width, slots, false, false)),
    makeSpec(buildingKey(look, width, slots, 'upperDamaged'), floorBox, (c) => paintFloor(c, look, width, slots, false, true)),
    makeSpec(buildingKey(look, width, slots, 'roof'), roofBox, (c) => paintRoof(c, look, width)),
    makeSpec(buildingKey(look, width, slots, 'roofBroken'), box(w, 34, 4), (c) => paintBrokenTop(c, look, width)),
    makeSpec(buildingKey(look, width, slots, 'rubbleBack'), box(w, L.rubbleBackH + 4, 4), (c) => paintRubbleBack(c, look, width)),
    makeSpec(buildingKey(look, width, slots, 'rubbleFront'), box(w + 16, L.rubbleFrontUp, L.rubbleFrontDown), (c) => paintRubbleFront(c, look, width)),
  ];
}

// ---------------------------------------------------------------------------
// Cover props
// ---------------------------------------------------------------------------

const LUFT = '#5b6253';
const LUFT_DARK = '#3b4136';
const LUFT_RIM = '#8a917e';

function wheel(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = C.ink;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.45, 0, TAU);
  ctx.fillStyle = C.steelRim;
  ctx.fill();
}

/** Goods vans on the sidings, one of them off its bogies. */
function paintWagons(ctx: Ctx, width: number): void {
  const rand = rng(seedOf('wagons', width, 7));
  const half = width / 2;
  const van = (x0: number, x1: number, lift: number, tilt: number): void => {
    ctx.save();
    ctx.translate((x0 + x1) / 2, -lift);
    ctx.rotate(tilt);
    const w = x1 - x0;
    const body = [-w / 2, -8, -w / 2, -52, -w / 2 + 3, -56, w / 2 - 3, -56, w / 2, -52, w / 2, -8];
    rimPoly(ctx, body, '#6b4a33', '#946a4c', 1.2);
    inside(
      ctx,
      (c) => poly(c, body),
      () => {
        ctx.strokeStyle = rgba('#3a281b', 0.8);
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        for (let x = -w / 2 + 6; x < w / 2; x += 6) {
          ctx.moveTo(x, -56);
          ctx.lineTo(x, -8);
        }
        ctx.stroke();
        // The sliding door and its rail, the X bracing of the ends.
        fillPoly(ctx, [-9, -50, 9, -50, 9, -10, -9, -10], rgba('#3a281b', 0.55));
        strokeLine(ctx, [-w / 2 + 3, -50, -w / 2 + 16, -12], rgba(C.steel, 0.9), 1.2);
        strokeLine(ctx, [w / 2 - 3, -50, w / 2 - 16, -12], rgba(C.steel, 0.9), 1.2);
      },
    );
    rimRect(ctx, -w / 2 - 2, -60, w + 4, 5, 2, C.steel, C.steelRim, 0.8);
    fillPoly(ctx, [-w / 2, -10, w / 2, -10, w / 2, -6, -w / 2, -6], C.ink);
    wheel(ctx, -w / 2 + 12, -5, 6);
    wheel(ctx, w / 2 - 12, -5, 6);
    ctx.restore();
  };
  van(-half, -half + width * 0.48, 0, 0);
  van(half - width * 0.48, half, 2, -0.06);
  scorch(ctx, half - width * 0.25, -30, 20, 18, 0.5);
  for (let i = 0; i < 4; i++) chunk(ctx, -half + rand() * width, -2, 4 + rand() * 4, rand, C.concreteDark, C.concreteRim);
}

/** A Ju 52 trimotor broken-backed on the snow: corrugated skin, the nose engine, the tail up (the plain cross only). */
function paintJu52(ctx: Ctx, width: number): void {
  const rand = rng(seedOf('ju52', width, 8));
  const half = width / 2;
  const body = [-half, -10, -half + 8, -34, half * 0.55, -38, half * 0.85, -30, half, -18, half * 0.9, -6, -half * 0.2, -4];
  rimPoly(ctx, body, LUFT, LUFT_RIM, 1.2);
  inside(
    ctx,
    (c) => poly(c, body),
    () => {
      ctx.strokeStyle = rgba(LUFT_DARK, 0.7);
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      for (let y = -36; y < -4; y += 2.6) {
        ctx.moveTo(-half, y);
        ctx.lineTo(half, y);
      }
      ctx.stroke();
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = C.void;
        ctx.fillRect(-half * 0.3 + i * 13, -30, 6, 5);
      }
    },
  );
  // The tail rearing up where the fuselage broke.
  rimPoly(ctx, [-half - 2, -12, -half + 2, -40, -half + 10, -70, -half + 22, -66, -half + 20, -36, -half + 12, -16], LUFT, LUFT_RIM, 1);
  balkenkreuz(ctx, half * 0.1, -22, 9);
  // The nose engine and a bent propeller; the broken wing on the snow.
  rimRect(ctx, half - 6, -30, 12, 18, 3, C.steel, C.steelRim, 0.8);
  strokeLine(ctx, [half + 6, -38, half + 4, -21, half + 10, -6], C.ink, 1.6);
  rimPoly(ctx, [-half * 0.4, -6, half * 0.5, -10, half * 0.75, -3, -half * 0.3, 1], LUFT_DARK, LUFT_RIM, 0.8);
  scorch(ctx, 0, -20, 30, 16, 0.6);
  charOver(ctx, -half, -40, width * 0.4, 40, 0.2);
  for (let i = 0; i < 4; i++) chunk(ctx, -half + rand() * width, -2, 4 + rand() * 4, rand, LUFT_DARK, LUFT_RIM);
}

/** An He 111 on its belly: the glazed nose smashed, one wing stub and engine, the fuselage cross. */
function paintHe111(ctx: Ctx, width: number): void {
  const rand = rng(seedOf('he111', width, 9));
  const half = width / 2;
  const body = [-half, -14, -half + 10, -30, half * 0.6, -32, half * 0.92, -26, half, -14, half * 0.9, -4, -half + 6, -4];
  rimPoly(ctx, body, LUFT, LUFT_RIM, 1.2);
  // The glazed nose, panes broken.
  fillPoly(ctx, [half * 0.62, -31, half * 0.95, -25, half, -14, half * 0.7, -16], rgba(C.glass, 0.75));
  strokeLine(ctx, [half * 0.7, -30, half * 0.78, -15, half * 0.86, -29, half * 0.9, -15], rgba(C.ink, 0.8), 0.6);
  bite(ctx, [half * 0.8, -28, half * 0.9, -24, half * 0.84, -20]);
  // The wing stub with its engine nacelle.
  rimPoly(ctx, [-half * 0.25, -14, half * 0.35, -16, half * 0.4, -9, -half * 0.3, -6], LUFT_DARK, LUFT_RIM, 0.8);
  rimRect(ctx, half * 0.05, -24, 22, 12, 4, C.steel, C.steelRim, 0.8);
  balkenkreuz(ctx, -half * 0.35, -20, 9);
  // The tail torn off: a jagged end.
  bite(ctx, [-half - 2, -32, -half + 6, -26, -half + 2, -20, -half + 8, -12, -half - 2, -6]);
  scorch(ctx, half * 0.2, -18, 22, 12, 0.6);
  for (let i = 0; i < 4; i++) chunk(ctx, -half + rand() * width, -2, 4 + rand() * 4, rand, LUFT_DARK, LUFT_RIM);
}

/** The low cover in front of the men behind a prop: snow-dusted debris and sleepers. */
function paintPropFront(ctx: Ctx, look: CoverPropLook, width: number): void {
  const rand = rng(seedOf(look, width, 10));
  const half = width / 2;
  const tone = look === 'wagons' ? C.earth : mix(C.earth, '#d8d6cf', 0.35);
  const pts: number[] = [-half - 8, L.rubbleFrontDown - 4];
  const n = Math.max(6, Math.round(width / 10));
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const arch = Math.sin(u * Math.PI) ** 0.4;
    pts.push(-half - 8 + (width + 16) * u, -4 - arch * (4 + rand() * 6) + 6 * (1 - arch));
  }
  pts.push(half + 8, L.rubbleFrontDown - 4);
  rimPoly(ctx, pts, tone, mix(tone, C.flagWhite, 0.35), 1.2);
  if (look === 'wagons') {
    for (let x = -half; x < half; x += 16) rimRect(ctx, x, -6, 12, 4, 0.5, C.timberDark, C.timberRim, 0.6);
    strokeLine(ctx, [-half - 6, -8, half + 6, -8], C.steelRim, 1.2);
  } else {
    for (let i = 0; i < width / 12; i++) chunk(ctx, -half + rand() * width, -4 - rand() * 6, 4 + rand() * 4, rand, LUFT_DARK, LUFT_RIM);
  }
}

/** A cover prop's two pieces: its body behind the men and the low cover in front of them. */
export function coverPropSpecs(look: CoverPropLook, width: number): SpriteSpec[] {
  const w = width + L.pad * 2;
  const back = look === 'wagons' ? paintWagons : look === 'ju52Wreck' ? paintJu52 : paintHe111;
  return [
    makeSpec(propKey(look, width, 'back'), box(w, PROP_LAYOUT[look].h, 4), (c) => back(c, width)),
    makeSpec(propKey(look, width, 'front'), box(w + 16, L.rubbleFrontUp, L.rubbleFrontDown), (c) => paintPropFront(c, look, width)),
  ];
}
