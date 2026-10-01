/**
 * "Crate stencil": an original chamfered block alphabet with stencil bridges,
 * defined as polygons so headings need no font file. Pure data and string
 * building (no DOM), so it can be unit-tested in Node. Caps, digits and a
 * little punctuation; anything else renders as a space.
 *
 * Glyph space: y runs 0 (cap line) to 100 (baseline), strokes are 20 thick and
 * bridges 6 wide. Each glyph is a list of polygons as flat x,y arrays.
 */

interface Glyph {
  /** Advance width before letter spacing. */
  w: number;
  polys: readonly (readonly number[])[];
}

const GLYPH_HEIGHT = 100;
const LETTER_GAP = 11;
const SPACE_WIDTH = 30;

function mirror(pts: readonly number[], w: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < pts.length; i += 2) out.push(w - pts[i], pts[i + 1]);
  return out;
}

/** Rotate a polygon half a turn inside a w by 100 box (6 becomes 9). */
function turn(pts: readonly number[], w: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < pts.length; i += 2) out.push(w - pts[i], GLYPH_HEIGHT - pts[i + 1]);
  return out;
}

const STEM = [0, 0, 20, 0, 20, 100, 0, 100];
const STEM_R = [40, 0, 60, 0, 60, 100, 40, 100];
/** Left half of a round letter: O, Q, 0. */
const BOWL_L = [27, 0, 8, 0, 0, 8, 0, 92, 8, 100, 27, 100, 27, 80, 20, 80, 20, 20, 27, 20];
/** Curled terminals shared by C, G, S and the digits. */
const TERM_TR = [33, 0, 52, 0, 60, 8, 60, 30, 40, 30, 40, 20, 33, 20];
const TERM_BL = [27, 100, 8, 100, 0, 92, 0, 70, 20, 70, 20, 80, 27, 80];
const TERM_TL = mirror(TERM_TR, 60);
/** Lower right bowl shared by S, 5 and 6. */
const BOWL_BR = [33, 40, 52, 40, 60, 48, 60, 92, 52, 100, 33, 100, 33, 80, 40, 80, 40, 60, 33, 60];
const C_BODY = [8, 0, 27, 0, 27, 20, 20, 20, 20, 80, 27, 80, 27, 100, 8, 100, 0, 92, 0, 8];
const A_HALF = [0, 100, 0, 8, 8, 0, 27, 0, 27, 20, 20, 20, 20, 40, 27, 40, 27, 60, 20, 60, 20, 100];
const U_HALF = [0, 0, 20, 0, 20, 80, 27, 80, 27, 100, 8, 100, 0, 92];
const EIGHT_HALF = [
  27, 0, 8, 0, 0, 8, 0, 42, 8, 50, 0, 58, 0, 92, 8, 100, 27, 100, 27, 80, 20, 80, 20, 60, 27, 60, 27, 40, 20, 40, 20, 20,
  27, 20,
];
const SIX_BODY = [27, 0, 8, 0, 0, 8, 0, 92, 8, 100, 27, 100, 27, 80, 20, 80, 20, 60, 27, 60, 27, 40, 20, 40, 20, 20, 27, 20];
const M_MIDDLE = [26, 0, 34, 0, 40, 30, 46, 0, 54, 0, 54, 22, 44, 62, 36, 62, 26, 22];
const DOT = [0, 80, 20, 80, 20, 100, 0, 100];

const GLYPHS: Record<string, Glyph> = {
  A: { w: 60, polys: [A_HALF, mirror(A_HALF, 60)] },
  B: {
    w: 60,
    polys: [
      STEM,
      [26, 0, 52, 0, 60, 8, 60, 42, 52, 50, 60, 58, 60, 92, 52, 100, 26, 100, 26, 80, 40, 80, 40, 60, 26, 60, 26, 40, 40, 40, 40, 20, 26, 20],
    ],
  },
  C: { w: 60, polys: [C_BODY, TERM_TR, mirror(TERM_BL, 60)] },
  D: { w: 60, polys: [STEM, [26, 0, 50, 0, 60, 10, 60, 90, 50, 100, 26, 100, 26, 80, 40, 80, 40, 20, 26, 20]] },
  E: { w: 58, polys: [STEM, [26, 0, 58, 0, 58, 20, 26, 20], [26, 40, 50, 40, 50, 60, 26, 60], [26, 80, 58, 80, 58, 100, 26, 100]] },
  F: { w: 58, polys: [STEM, [26, 0, 58, 0, 58, 20, 26, 20], [26, 40, 50, 40, 50, 60, 26, 60]] },
  G: { w: 60, polys: [C_BODY, TERM_TR, [33, 100, 52, 100, 60, 92, 60, 44, 34, 44, 34, 62, 40, 62, 40, 80, 33, 80]] },
  H: { w: 60, polys: [[0, 0, 20, 0, 20, 40, 34, 40, 34, 60, 20, 60, 20, 100, 0, 100], STEM_R] },
  I: { w: 20, polys: [STEM] },
  J: { w: 60, polys: [[40, 0, 60, 0, 60, 92, 52, 100, 33, 100, 33, 80, 40, 80], [27, 100, 8, 100, 0, 92, 0, 62, 20, 62, 20, 80, 27, 80]] },
  K: {
    w: 60,
    polys: [STEM, [40, 0, 60, 0, 60, 32, 48, 50, 60, 68, 60, 100, 40, 100, 40, 72, 30, 60, 26, 60, 26, 40, 30, 40, 40, 28]],
  },
  L: { w: 56, polys: [STEM, [26, 80, 56, 80, 56, 100, 26, 100]] },
  M: { w: 80, polys: [STEM, M_MIDDLE, [60, 0, 80, 0, 80, 100, 60, 100]] },
  N: { w: 66, polys: [STEM, [26, 0, 40, 58, 40, 100, 26, 42], [46, 0, 66, 0, 66, 100, 46, 100]] },
  O: { w: 60, polys: [BOWL_L, mirror(BOWL_L, 60)] },
  P: { w: 60, polys: [STEM, [26, 0, 52, 0, 60, 8, 60, 52, 52, 60, 26, 60, 26, 40, 40, 40, 40, 20, 26, 20]] },
  Q: { w: 66, polys: [BOWL_L, mirror(BOWL_L, 60), [36, 64, 46, 64, 66, 100, 54, 100]] },
  R: {
    w: 60,
    polys: [
      STEM,
      [26, 0, 52, 0, 60, 8, 60, 46, 52, 56, 60, 66, 60, 100, 40, 100, 40, 70, 34, 60, 26, 60, 26, 40, 40, 40, 40, 20, 26, 20],
    ],
  },
  S: {
    w: 60,
    polys: [[8, 0, 27, 0, 27, 20, 20, 20, 20, 40, 27, 40, 27, 60, 8, 60, 0, 52, 0, 8], TERM_TR, BOWL_BR, TERM_BL],
  },
  T: { w: 60, polys: [[0, 0, 60, 0, 60, 20, 0, 20], [20, 26, 40, 26, 40, 100, 20, 100]] },
  U: { w: 60, polys: [U_HALF, mirror(U_HALF, 60)] },
  V: { w: 64, polys: [[0, 0, 20, 0, 29, 41, 29, 100, 22, 100], [64, 0, 44, 0, 35, 41, 35, 100, 42, 100]] },
  W: { w: 80, polys: [STEM, turn(M_MIDDLE, 80), [60, 0, 80, 0, 80, 100, 60, 100]] },
  X: { w: 62, polys: [[0, 0, 22, 0, 62, 100, 40, 100], [40, 0, 62, 0, 45, 42.5, 34, 15], [22, 100, 0, 100, 17, 57.5, 28, 85]] },
  Y: {
    w: 60,
    polys: [[0, 0, 20, 0, 20, 28, 30, 42, 40, 28, 40, 0, 60, 0, 60, 36, 40, 60, 20, 60, 0, 36], [20, 66, 40, 66, 40, 100, 20, 100]],
  },
  Z: { w: 60, polys: [[0, 0, 60, 0, 60, 20, 0, 20], [38, 26, 60, 26, 22, 74, 0, 74], [0, 80, 60, 80, 60, 100, 0, 100]] },
  '0': { w: 60, polys: [BOWL_L, mirror(BOWL_L, 60)] },
  '1': { w: 36, polys: [[0, 20, 16, 0, 36, 0, 36, 100, 16, 100, 16, 28, 0, 28]] },
  '2': {
    w: 60,
    polys: [
      TERM_TL,
      [33, 0, 52, 0, 60, 8, 60, 52, 52, 60, 33, 60, 33, 40, 40, 40, 40, 20, 33, 20],
      [27, 40, 8, 40, 0, 48, 0, 100, 60, 100, 60, 80, 20, 80, 20, 60, 27, 60],
    ],
  },
  '3': {
    w: 60,
    polys: [
      TERM_TL,
      [33, 0, 52, 0, 60, 8, 60, 42, 52, 50, 60, 58, 60, 92, 52, 100, 33, 100, 33, 80, 40, 80, 40, 60, 24, 60, 24, 40, 40, 40, 40, 20, 33, 20],
      TERM_BL,
    ],
  },
  '4': { w: 60, polys: [[0, 0, 20, 0, 20, 44, 34, 44, 34, 64, 0, 64], STEM_R] },
  '5': { w: 60, polys: [[0, 0, 60, 0, 60, 20, 20, 20, 20, 40, 27, 40, 27, 60, 0, 60], BOWL_BR, TERM_BL] },
  '6': { w: 60, polys: [SIX_BODY, TERM_TR, BOWL_BR] },
  '7': { w: 60, polys: [[0, 0, 60, 0, 60, 20, 0, 20], [38, 26, 60, 26, 34, 100, 12, 100]] },
  '8': { w: 60, polys: [EIGHT_HALF, mirror(EIGHT_HALF, 60)] },
  '9': { w: 60, polys: [turn(SIX_BODY, 60), turn(TERM_TR, 60), turn(BOWL_BR, 60)] },
  '.': { w: 20, polys: [DOT] },
  ',': { w: 20, polys: [[0, 80, 20, 80, 20, 102, 10, 116, 2, 116, 8, 100, 0, 100]] },
  ':': { w: 20, polys: [[0, 26, 20, 26, 20, 46, 0, 46], DOT] },
  '!': { w: 20, polys: [[0, 0, 20, 0, 20, 66, 0, 66], DOT] },
  '-': { w: 38, polys: [[0, 40, 38, 40, 38, 60, 0, 60]] },
  "'": { w: 16, polys: [[0, 0, 16, 0, 16, 14, 6, 32, 0, 32]] },
  '/': { w: 44, polys: [[28, 0, 44, 0, 16, 100, 0, 100]] },
  '+': { w: 56, polys: [[0, 40, 56, 40, 56, 60, 0, 60], [18, 22, 38, 22, 38, 34, 18, 34], [18, 66, 38, 66, 38, 78, 18, 78]] },
  '?': {
    w: 60,
    polys: [TERM_TL, [33, 0, 52, 0, 60, 8, 60, 46, 52, 54, 40, 54, 40, 68, 20, 68, 20, 36, 40, 36, 40, 20, 33, 20], [20, 80, 40, 80, 40, 100, 20, 100]],
  },
};

/** Accented capitals that may turn up in place names fall back to their base letter. */
const FOLD: Record<string, string> = { À: 'A', Á: 'A', Â: 'A', Ä: 'A', Ç: 'C', È: 'E', É: 'E', Ê: 'E', Ë: 'E', Î: 'I', Ï: 'I', Ô: 'O', Ö: 'O', Ü: 'U', Û: 'U', '’': "'", '–': '-', '—': '-' };

function signedArea(pts: readonly number[]): number {
  let sum = 0;
  for (let i = 0; i < pts.length; i += 2) {
    const j = (i + 2) % pts.length;
    sum += pts[i] * pts[j + 1] - pts[j] * pts[i + 1];
  }
  return sum / 2;
}

function fmt(v: number): string {
  return String(Math.round(v * 10) / 10);
}

export interface StencilRun {
  /** SVG path data for the whole string. */
  d: string;
  /** Width of the run in glyph units; the height is always STENCIL_HEIGHT. */
  width: number;
}

export const STENCIL_HEIGHT = GLYPH_HEIGHT;

/** True if the character has its own glyph (after upper-casing and accent folding). */
export function hasStencilGlyph(ch: string): boolean {
  const up = ch.toUpperCase();
  return (FOLD[up] ?? up) in GLYPHS;
}

/**
 * Build one SVG path for `text` in the stencil alphabet. Every polygon is wound
 * the same way so overlapping pieces never cancel under the non-zero fill rule.
 */
export function stencilPath(text: string): StencilRun {
  let d = '';
  let x = 0;
  let first = true;
  for (const raw of text.toUpperCase()) {
    const ch = FOLD[raw] ?? raw;
    const glyph = GLYPHS[ch];
    if (!first) x += LETTER_GAP;
    first = false;
    if (!glyph) {
      x += SPACE_WIDTH;
      continue;
    }
    for (const poly of glyph.polys) {
      const flip = signedArea(poly) < 0;
      const n = poly.length / 2;
      for (let k = 0; k < n; k++) {
        const i = (flip ? n - 1 - k : k) * 2;
        d += `${k === 0 ? 'M' : 'L'}${fmt(x + poly[i])} ${fmt(poly[i + 1])}`;
      }
      d += 'Z';
    }
    x += glyph.w;
  }
  return { d, width: x };
}
