/** France: rolling fields, hedgerows, poplars, a distant village with a church spire, telegraph poles. */
import { SCENES } from '../../../data/theatres';
import {
  bush,
  clumps,
  disc,
  fillBelow,
  fillPoly,
  house,
  line,
  noiseProfile,
  pathBelow,
  roundTree,
  sineProfile,
  smoothstep,
  spindle,
  spread,
  strokeAlong,
  vGrad,
  wrapped,
  wrappedSeeded,
  type Ctx,
  type HouseLook,
  type Profile,
  type TreeLook,
} from '../kit';
import { chance, range, type Rng } from '../rng';
import type { LayerPainter, Scene, TheatreArt } from '../scene';

const S = SCENES.france;

function houseLook(sc: Scene, haze: number): HouseLook {
  const P = sc.pal;
  return {
    wall: sc.tone(P.wall, haze),
    wallShade: sc.tone(P.wallShade, haze),
    roof: sc.tone(P.roof, haze),
    roofShade: sc.tone(P.roofShade, haze),
    opening: sc.tone(P.opening, haze + 0.12),
  };
}

/** A cluster of small houses around x; with a church and its spire if `church`. */
function village(ctx: Ctx, sc: Scene, rng: Rng, yOf: Profile, x: number, haze: number, houses: number, church: boolean): void {
  const P = sc.pal;
  const look = houseLook(sc, haze);
  ctx.fillStyle = sc.tone(P.foliageShade, haze + 0.04);
  for (let i = 0; i < houses + 3; i++) {
    const tx = x + range(rng, -1, 1) * houses * 9;
    disc(ctx, tx, yOf(tx) - 1, range(rng, 4, 7));
  }
  if (church) {
    const base = yOf(x) + 3;
    // Nave, tower and a slim slate spire.
    house(ctx, x - 4, base, 26, 11, 8, { ...look, roof: sc.tone(P.roofAlt, haze), roofShade: sc.tone(P.roofAlt, haze) }, false, 3);
    ctx.fillStyle = look.wall;
    ctx.fillRect(x - 12, base - 26, 9, 26);
    ctx.fillStyle = look.wallShade;
    ctx.fillRect(x - 12 + (sc.light < 0 ? 6 : 0), base - 26, 3, 26);
    ctx.fillStyle = look.opening;
    ctx.fillRect(x - 9, base - 22, 2.6, 4.5);
    fillPoly(ctx, [x - 13.2, base - 26, x - 7.5, base - 26 - S.spireHeight, x - 1.8, base - 26], sc.tone(P.roofAlt, haze));
  }
  for (let i = 0; i < houses; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const hx = x + side * (14 + (i >> 1) * range(rng, 11, 15)) + range(rng, -3, 3);
    const hw = range(rng, 10, 16);
    const hh = range(rng, 6, 9);
    house(ctx, hx - hw / 2, yOf(hx) + 3, hw, hh, range(rng, 4, 6.5), look, chance(rng, 0.4), chance(rng, 0.7) ? 2 : 1);
  }
  ctx.fillStyle = sc.tone(P.foliage, haze);
  for (let i = 0; i < houses; i++) {
    const tx = x + range(rng, -1, 1) * houses * 10;
    disc(ctx, tx, yOf(tx) + 1.5, range(rng, 2.5, 4.5));
  }
}

const far: LayerPainter = (ctx, sc, rng, box) => {
  const P = sc.pal;
  const { w, bottom, haze } = box;

  const r1 = sineProfile(rng, w, [1, 2, 3, 5], 0.9);
  const y1: Profile = (x) => S.farRidgeY - 16 + r1(x) * S.farRidgeAmp;
  fillBelow(ctx, w, y1, bottom, vGrad(ctx, S.farRidgeY - 40, bottom, sc.tone(P.far, haze + 0.16), sc.tone(P.far, haze + 0.28)));
  clumps(ctx, rng, w, y1, 70, 2, 4.5, sc.tone(P.foliageShade, haze + 0.2), 1.5);

  const r2 = sineProfile(rng, w, [1, 2, 4, 7], 0.8);
  const y2: Profile = (x) => S.farRidgeY + 14 + r2(x) * S.farRidgeAmp * 0.6;
  fillBelow(ctx, w, y2, bottom, vGrad(ctx, S.farRidgeY, bottom, sc.tone(P.farAlt, haze), sc.tone(P.farAlt, haze + 0.14)));

  // A patchwork of small fields on the nearer slope.
  ctx.save();
  pathBelow(ctx, w, y2, bottom);
  ctx.clip();
  const crops = [sc.tone(P.midAlt, haze + 0.04, 0.55), sc.tone(P.mid, haze - 0.04, 0.5), sc.tone(P.soil, haze + 0.1, 0.3)];
  const fields = 26;
  for (let i = 0; i < fields; i++) {
    const cx = ((i + rng()) / fields) * w;
    const fw = (w / fields) * range(rng, 0.8, 1.5);
    const top = y2(cx) + range(rng, 2, 26);
    const fh = range(rng, 8, 18);
    const skew = range(rng, -12, 12);
    const color = crops[i % crops.length];
    const tilt = range(rng, -2, 2);
    wrapped(w, cx, fw, (x) => {
      fillPoly(ctx, [x - fw / 2, top, x + fw / 2, top + tilt, x + fw / 2 + skew, top + fh, x - fw / 2 + skew, top + fh], color);
    });
  }
  ctx.strokeStyle = sc.tone(P.foliageShade, haze + 0.06, 0.6);
  ctx.lineWidth = 1.3;
  strokeAlong(ctx, w, y2, 10);
  strokeAlong(ctx, w, y2, 25);
  ctx.restore();
  clumps(ctx, rng, w, y2, 80, 2.5, 5.5, sc.tone(P.foliageShade, haze + 0.05), 2);

  village(ctx, sc, rng, y2, w * 0.31, haze - 0.08, S.villageHouses, true);
  village(ctx, sc, rng, y2, w * 0.79, haze - 0.04, 4, false);
};

const mid: LayerPainter = (ctx, sc, rng, box) => {
  const P = sc.pal;
  const { w, bottom, haze } = box;
  const r = sineProfile(rng, w, [1, 2, 3, 5, 8], 0.9);
  const y: Profile = (x) => S.midRidgeY + r(x) * S.midRidgeAmp;
  fillBelow(ctx, w, y, bottom, vGrad(ctx, S.midRidgeY - 14, bottom, sc.tone(P.mid, haze), sc.tone(P.mid, haze + 0.1)));

  // Strip fields divided by hedges that run away from the camera.
  const bounds = spread(rng, w, S.fields, 0.5).sort((a, b) => a - b);
  const slant = bounds.map(() => range(rng, -22, 22));
  ctx.save();
  pathBelow(ctx, w, y, bottom);
  ctx.clip();
  for (let i = 0; i < bounds.length; i++) {
    const xa = bounds[i];
    const last = i + 1 === bounds.length;
    const xb = last ? bounds[0] + w : bounds[i + 1];
    const sa = slant[i];
    const sb = last ? slant[0] : slant[i + 1];
    const kind = i % 3;
    if (kind === 0) continue;
    const color = kind === 1 ? sc.tone(P.midAlt, haze, 0.8) : sc.tone(P.soil, haze + 0.1, 0.4);
    for (const o of [-w, 0, w]) {
      fillPoly(ctx, [xa + o, S.midRidgeY - 30, xb + o, S.midRidgeY - 30, xb + sb + o, bottom, xa + sa + o, bottom], color);
    }
  }
  ctx.strokeStyle = sc.tone(P.foliageShade, haze, 0.9);
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  for (let i = 0; i < bounds.length; i++) {
    for (const o of [-w, 0, w]) {
      const x0 = bounds[i] + o;
      line(ctx, x0, y(bounds[i]) + 1, x0 + slant[i] * 0.8, bottom);
    }
  }
  ctx.restore();

  // Hedge lumps and field trees along the crest.
  clumps(ctx, rng, w, y, 90, 3, 6, sc.tone(P.foliageShade, haze), 2);
  clumps(ctx, rng, w, y, 50, 2.5, 5, sc.tone(P.foliage, haze), 0.5);

  // Haystacks in the wheat.
  for (let i = 0; i < 9; i++) {
    const hx = range(rng, 20, w - 20);
    const hy = y(hx) + range(rng, 12, 26);
    ctx.fillStyle = sc.tone(P.midAlt, haze - 0.08);
    ctx.beginPath();
    ctx.ellipse(hx, hy, 4.2, 5.4, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = sc.tone(P.roofShade, haze + 0.1, 0.5);
    ctx.fillRect(hx - 4.2, hy - 0.4, 8.4, 1);
  }

  // A farm.
  const fx = w * 0.62;
  const look = houseLook(sc, haze - 0.06);
  const trees: TreeLook = { lit: sc.tone(P.foliage, haze), shade: sc.tone(P.foliageShade, haze), trunk: sc.tone(P.trunk, haze) };
  roundTree(ctx, rng, fx - 14, y(fx - 14) + 3, 30, 26, trees, sc.light);
  house(ctx, fx, y(fx) + 4, 44, 14, 11, look, false, 0);
  ctx.fillStyle = look.opening;
  ctx.fillRect(fx + 16, y(fx) + 4 - 9, 9, 9);
  house(ctx, fx + 50, y(fx + 60) + 4, 22, 16, 9, look, true, 2);
  roundTree(ctx, rng, fx + 86, y(fx + 86) + 3, 26, 24, trees, sc.light);

  // Poplars lining a road over the hill.
  const poplars: TreeLook = { lit: sc.tone(P.foliageAlt, haze), shade: sc.tone(P.foliageAltShade, haze), trunk: sc.tone(P.trunk, haze) };
  const rows = [
    { x0: w * 0.1, n: S.poplars, gap: 25 },
    { x0: w * 0.84, n: 5, gap: 28 },
  ];
  for (const row of rows) {
    for (let i = 0; i < row.n; i++) {
      const px = row.x0 + i * row.gap + range(rng, -2, 2);
      spindle(ctx, px, y(px) + 2, S.poplarHeight * range(rng, 0.85, 1.1), 9, poplars, sc.light, 0.14);
    }
  }
};

const near: LayerPainter = (ctx, sc, rng, box) => {
  const P = sc.pal;
  const { w, bottom, haze } = box;
  const broad: TreeLook = { lit: sc.tone(P.foliage, haze), shade: sc.tone(P.foliageShade, haze), trunk: sc.tone(P.trunk, haze) };
  const tall: TreeLook = { lit: sc.tone(P.foliageAlt, haze), shade: sc.tone(P.foliageAltShade, haze), trunk: sc.tone(P.trunk, haze) };

  // Two field gates break the hedge.
  const gates = [w * 0.27, w * 0.71];
  const gap = (x: number): number => {
    let m = 1;
    for (const gx of gates) {
      const dx = Math.abs(((x - gx + w * 1.5) % w) - w / 2);
      m = Math.min(m, smoothstep((dx - 16) / 9));
    }
    return m;
  };
  const lumps = noiseProfile(rng, w, 70, 2, 0.5, false);
  const hedgeTop: Profile = (x) => S.vergeY + 2 - (S.vergeY - S.hedgeY + lumps(x) * 7) * gap(x);

  // Hedgerow trees stand behind the hedge.
  const xs = spread(rng, w, S.hedgeTrees, 0.9);
  for (const tx of xs) {
    if (gap(tx) < 1) continue;
    if (chance(rng, 0.28)) {
      const n = 2 + Math.floor(rng() * 2);
      for (let k = 0; k < n; k++) {
        const px = tx + (k - (n - 1) / 2) * 24;
        const h = S.treeHeight * range(rng, 1.25, 1.5);
        wrapped(w, px, 16, (cx) => spindle(ctx, cx, S.vergeY, h, 21, tall, sc.light, 0.12));
      }
    } else {
      const h = S.treeHeight * range(rng, 0.75, 1.15);
      wrappedSeeded(w, tx, h * 0.6, rng, (cx, r) => roundTree(ctx, r, cx, S.vergeY, h, h * range(r, 0.78, 0.95), broad, sc.light));
    }
  }

  // The hedge itself: a shaded mass with a lumpy, sunlit top.
  fillBelow(ctx, w, hedgeTop, bottom, vGrad(ctx, S.hedgeY - 6, S.vergeY + 4, sc.tone(P.near, haze), sc.tone(P.foliageShade, haze)), 2);
  const bumps = Math.round(w / 8);
  for (let i = 0; i < bumps; i++) {
    const bx = ((i + rng()) / bumps) * w;
    if (gap(bx) < 0.9) continue;
    const br = range(rng, 3.2, 6);
    const lit = chance(rng, 0.6);
    wrapped(w, bx, br, (cx) => {
      ctx.fillStyle = lit ? sc.tone(P.nearAlt, haze, 0.75) : sc.tone(P.foliageShade, haze, 0.5);
      disc(ctx, cx, hedgeTop(cx) + (lit ? 2.5 : 8), br);
    });
  }

  // Gates: posts, bars and a brace.
  ctx.strokeStyle = sc.tone(P.trunk, haze + 0.08);
  ctx.lineCap = 'butt';
  for (const gx of gates) {
    ctx.lineWidth = 2;
    line(ctx, gx - 15, S.vergeY + 3, gx - 15, S.vergeY - 12);
    line(ctx, gx + 15, S.vergeY + 3, gx + 15, S.vergeY - 12);
    ctx.lineWidth = 1.1;
    for (let k = 0; k < 4; k++) line(ctx, gx - 15, S.vergeY - 10 + k * 3.2, gx + 15, S.vergeY - 10 + k * 3.2);
    line(ctx, gx - 15, S.vergeY - 0.4, gx + 15, S.vergeY - 10);
  }

  // Grass verge at the foot of the hedge, fading into the field.
  const sway = sineProfile(rng, w, [2, 5, 9], 0.7);
  const verge: Profile = (x) => S.vergeY + sway(x) * 1.6;
  fillBelow(ctx, w, verge, bottom, vGrad(ctx, S.vergeY - 2, bottom, sc.tone(P.nearAlt, haze), sc.tone(P.ground, 0.22)));
  for (let i = 0; i < 40; i++) {
    const bx = rng() * w;
    const bw = range(rng, 8, 18);
    wrappedSeeded(w, bx, bw, rng, (cx, r) => {
      bush(ctx, r, cx, verge(cx) + 2.5, bw, range(r, 3, 5), sc.tone(P.nearAlt, haze), sc.tone(P.near, haze), sc.light);
    });
  }

  // Telegraph poles march along the lane, wires sagging between them.
  const n = S.telegraphPoles;
  const pitch = w / n;
  const poleColor = sc.tone(P.trunk, haze + 0.04);
  const footY = S.vergeY + 4;
  const topY = footY - S.poleHeight;
  ctx.strokeStyle = sc.tone(P.metal, haze + 0.12, 0.8);
  ctx.lineWidth = 0.6;
  for (let i = -1; i < n; i++) {
    const xa = pitch * (i + 0.5);
    const xb = xa + pitch;
    for (const [dx, dy] of [
      [-7, 5],
      [7, 5],
      [-5, 12],
      [5, 12],
    ]) {
      ctx.beginPath();
      ctx.moveTo(xa + dx, topY + dy);
      ctx.quadraticCurveTo((xa + xb) / 2 + dx, topY + dy + 15, xb + dx, topY + dy);
      ctx.stroke();
    }
  }
  for (let i = 0; i < n; i++) {
    const px = pitch * (i + 0.5);
    fillPoly(ctx, [px - 1.5, footY, px - 1, topY, px + 1, topY, px + 1.5, footY], poleColor);
    ctx.fillStyle = poleColor;
    ctx.fillRect(px - 8.5, topY + 5, 17, 1.7);
    ctx.fillRect(px - 6.5, topY + 12, 13, 1.6);
    ctx.fillStyle = sc.tone(P.pale, haze + 0.1);
    for (const dx of [-7, 7]) ctx.fillRect(px + dx - 0.8, topY + 3, 1.6, 2);
    for (const dx of [-5, 5]) ctx.fillRect(px + dx - 0.8, topY + 10, 1.6, 2);
  }
};

export const france: TheatreArt = { far, mid, near };
