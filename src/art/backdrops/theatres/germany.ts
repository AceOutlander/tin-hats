/**
 * Germany: dense dark pine forest, misty ridges, and the dragon's teeth of the Westwall drawn end-on
 * (concrete tank traps) in the mid layer.
 *   far:  three misty forested ridges, each paler than the next
 *   mid:  a forest wall in three rows of pines over a floor, with end-on crossings of dragon's teeth in front
 *   near: a few tall pines on a mossy bank, boulders and young firs
 */
import { SCENES } from '../../../data/theatres';
import {
  bush,
  fillBelow,
  fillPoly,
  noiseProfile,
  oval,
  pine,
  rock,
  sineProfile,
  spread,
  vGrad,
  wrapped,
  wrappedSeeded,
  type Ctx,
  type Profile,
  type TreeLook,
} from '../kit';
import { range, type Rng } from '../rng';
import type { LayerPainter, TheatreArt } from '../scene';

const S = SCENES.germany;

/** Small serrated fir silhouette for ridge lines and the forest wall. Apex at (x, base - h). */
function fir(ctx: Ctx, x: number, base: number, h: number, wid: number): void {
  const half = wid / 2;
  ctx.beginPath();
  ctx.moveTo(x, base - h);
  ctx.lineTo(x + half * 0.42, base - h * 0.62);
  ctx.lineTo(x + half * 0.2, base - h * 0.62);
  ctx.lineTo(x + half * 0.72, base - h * 0.3);
  ctx.lineTo(x + half * 0.38, base - h * 0.3);
  ctx.lineTo(x + half, base);
  ctx.lineTo(x - half, base);
  ctx.lineTo(x - half * 0.38, base - h * 0.3);
  ctx.lineTo(x - half * 0.72, base - h * 0.3);
  ctx.lineTo(x - half * 0.2, base - h * 0.62);
  ctx.lineTo(x - half * 0.42, base - h * 0.62);
  ctx.closePath();
  ctx.fill();
}

/** A ragged line of firs standing on a profile. */
function firEdge(ctx: Ctx, rng: Rng, w: number, yOf: Profile, count: number, hMin: number, hMax: number, color: string, sink: number): void {
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const x = rng() * w;
    const h = range(rng, hMin, hMax);
    const wid = h * range(rng, 0.36, 0.5);
    wrapped(w, x, wid, (cx) => fir(ctx, cx, yOf(cx) + sink, h, wid));
  }
}

const RIDGE_WAVES: readonly (readonly number[])[] = [
  [1, 2, 3, 5],
  [1, 3, 4, 7],
  [2, 3, 6, 9],
];

const far: LayerPainter = (ctx, sc, rng, box) => {
  const P = sc.pal;
  const { w, bottom, haze } = box;
  for (let i = 0; i < S.farRidges; i++) {
    const baseY = S.farRidgeY - 36 + i * 20;
    const p = sineProfile(rng, w, RIDGE_WAVES[i % RIDGE_WAVES.length], 0.9);
    const y: Profile = (x) => baseY + p(x) * S.farRidgeAmp * 0.5;
    // The farthest ridge is the palest; each nearer one is a little darker and greener.
    const hz = haze + 0.3 - i * 0.12;
    fillBelow(ctx, w, y, bottom, vGrad(ctx, baseY - 14, baseY + 56, sc.tone(P.far, hz), sc.tone(P.farAlt, hz + 0.16)));
    firEdge(ctx, rng, w, y, 240 + i * 70, 6, 12 + i * 3, sc.tone(P.far, hz - 0.02), 1.5);
    // Mist pooling in the folds below the crest.
    ctx.fillStyle = vGrad(ctx, baseY - 2, baseY + 38, sc.hazeCss(0), sc.hazeCss(0.5));
    ctx.fillRect(-4, baseY - 2, w + 8, 40);
  }
};

/** Dragon's tooth: a squat concrete pyramid, lit on the side toward the light. */
function tooth(ctx: Ctx, x: number, base: number, s: number, light: number, lit: string, shade: string, cap: string): void {
  const bw = s * 1.3;
  const tw = s * 0.34;
  fillPoly(ctx, [x - bw / 2, base, x - tw / 2, base - s, x + tw / 2, base - s, x + bw / 2, base], shade);
  fillPoly(ctx, [x, base, x, base - s, x + light * tw / 2, base - s, x + light * bw / 2, base], lit);
  ctx.fillStyle = cap;
  ctx.fillRect(x - tw / 2, base - s - 0.7, tw, 0.9);
}

const mid: LayerPainter = (ctx, sc, rng, box) => {
  const P = sc.pal;
  const { w, bottom, haze } = box;
  const forestY = S.midForestY;

  // The forest's interior: a dark mass following the crest.
  const roll = sineProfile(rng, w, [2, 3, 5, 8, 13], 0.8);
  const crest: Profile = (x) => forestY - 20 + roll(x) * 14;
  fillBelow(ctx, w, crest, bottom, vGrad(ctx, forestY - 40, forestY + 4, sc.tone(P.foliageAltShade, haze - 0.06), sc.tone(P.foliageAltShade, haze - 0.14)));
  firEdge(ctx, rng, w, crest, 150, 12, 24, sc.tone(P.foliageAlt, haze - 0.04), 2);

  // Forest floor, mid-toned so concrete and figures stand out against it.
  const lump = noiseProfile(rng, w, 60, 2, 0.5, false);
  const floorTop: Profile = (x) => forestY + 5 + lump(x) * 5;
  fillBelow(ctx, w, floorTop, bottom, vGrad(ctx, forestY + 5, bottom, sc.tone(P.soil, haze + 0.04), sc.tone(P.groundDark, haze + 0.02)), 2);
  // Shade under the canopy where the floor meets the trunks.
  ctx.fillStyle = vGrad(ctx, forestY + 5, forestY + 17, sc.tone(P.foliageAltShade, haze, 0.5), sc.tone(P.foliageAltShade, haze, 0));
  ctx.fillRect(-4, forestY + 5, w + 8, 12);

  // Three rows of pines, the front rows lower down the slope and a touch lighter.
  const rows = 3;
  for (let r = 0; r < rows; r++) {
    const look: TreeLook = {
      lit: sc.tone(P.foliageAlt, haze - 0.02 - r * 0.05),
      shade: sc.tone(P.foliageAltShade, haze - 0.02 - r * 0.05),
      trunk: sc.tone(P.trunk, haze - r * 0.05),
    };
    for (let i = 0; i < S.midPines; i++) {
      const x = ((i + rng()) / S.midPines) * w;
      const h = S.midPineHeight * range(rng, 0.66, 0.92) * (0.9 + r * 0.1);
      const base = crest(x) + 8 + r * 7 + range(rng, -2, 2);
      wrappedSeeded(w, x, h * 0.3, rng, (cx, q) => pine(ctx, q, cx, base, h, h * range(q, 0.44, 0.58), look, sc.light, 0.16));
    }
  }

  // Dragon's teeth, end-on: where the Westwall crosses the field, its cross-section (a few teeth side by side, taller
  // toward the German side) with each row receding into the screen, farthest first so the near teeth overlap them.
  const shadow = sc.tone(P.soilDark, haze, 0.32);
  for (const at of S.teethAt) {
    const x0 = (at + range(rng, -0.02, 0.02)) * w;
    for (let d = S.teethDeep - 1; d >= 0; d--) {
      const k = Math.pow(S.teethRecedeScale, d);
      const base = S.teethY - d * S.teethRecedeY;
      const fade = haze + d * 0.05;
      const lit = sc.tone(P.stoneShade, fade - 0.25);
      const shade = sc.tone(P.metal, fade - 0.25);
      const cap = sc.tone(P.stone, fade - 0.2);
      for (let c = 0; c < S.teethAcross; c++) {
        const s = S.toothSize * (1 + c * S.toothGrow) * k;
        const x = x0 + (c - (S.teethAcross - 1) / 2) * S.toothSize * 1.25 * k + d * 1.5;
        wrapped(w, x, s, (cx) => {
          ctx.fillStyle = shadow;
          oval(ctx, cx - sc.light * s * 0.55, base + 0.5, s * 0.8, s * 0.12);
          tooth(ctx, cx, base, s * range(rng, 0.96, 1.04), sc.light, lit, shade, cap);
        });
      }
    }
  }
};

const near: LayerPainter = (ctx, sc, rng, box) => {
  const P = sc.pal;
  const { w, bottom, haze } = box;
  const tall: TreeLook = { lit: sc.tone(P.foliageAlt, haze), shade: sc.tone(P.foliageAltShade, haze), trunk: sc.tone(P.trunk, haze) };

  // Tall pines in loose clumps, their feet planted in the bank.
  const clumpXs = spread(rng, w, S.pineClumps, 0.7);
  for (const cx of clumpXs) {
    for (let k = 0; k < S.pinesPerClump; k++) {
      const x = cx + (k - (S.pinesPerClump - 1) / 2) * range(rng, 22, 34) + range(rng, -6, 6);
      const h = S.pineHeight * range(rng, 0.72, 1.12);
      const base = S.bankY + range(rng, 1, 7);
      wrappedSeeded(w, x, h * 0.22, rng, (px, q) => pine(ctx, q, px, base, h, h * range(q, 0.34, 0.42), tall, sc.light, 0.3));
    }
  }

  // Mossy bank with young firs and bracken along it.
  const lump = noiseProfile(rng, w, 90, 2, 0.5, false);
  const bank: Profile = (x) => S.bankY + 3 - lump(x) * 5;
  firEdge(ctx, rng, w, bank, 70, 9, 20, sc.tone(P.foliageAltShade, haze), 3);
  fillBelow(ctx, w, bank, bottom, vGrad(ctx, S.bankY - 4, bottom, sc.tone(P.nearAlt, haze), sc.tone(P.ground, 0.22)), 2);
  for (let i = 0; i < 46; i++) {
    const x = rng() * w;
    const bw = range(rng, 10, 22);
    wrappedSeeded(w, x, bw, rng, (cx, q) => {
      bush(ctx, q, cx, bank(cx) + 3, bw, range(q, 3.5, 6), sc.tone(P.foliage, haze), sc.tone(P.foliageShade, haze), sc.light);
    });
  }
  for (let i = 0; i < 7; i++) {
    const x = rng() * w;
    const rw = range(rng, 14, 28);
    wrappedSeeded(w, x, rw, rng, (cx, q) => {
      rock(ctx, q, cx, bank(cx) + 4, rw, rw * range(q, 0.32, 0.5), sc.tone(P.stone, haze), sc.tone(P.stoneShade, haze), sc.light);
    });
  }
};

export const germany: TheatreArt = { far, mid, near };

