/** Italy: steep mountains with a monastery on a peak, shattered trees, mud and rubble. */
import { SCENES } from '../../../data/theatres';
import {
  fillBelow,
  fillPoly,
  lerp,
  line,
  noiseProfile,
  pathBelow,
  rubblePile,
  shatteredTree,
  sineProfile,
  smoothstep,
  spread,
  vGrad,
  wrappedSeeded,
  type Ctx,
  type Profile,
} from '../kit';
import { range, type Rng } from '../rng';
import type { LayerPainter, Scene, TheatreArt } from '../scene';

const S = SCENES.italy;

/** The abbey: a long, many-windowed block on a battered base, with a domed church rising from the middle. */
function monastery(ctx: Ctx, sc: Scene, x: number, base: number, wid: number, haze: number): void {
  const P = sc.pal;
  const wall = sc.tone(P.wall, haze);
  const shade = sc.tone(P.wallShade, haze);
  const roof = sc.tone(P.roof, haze + 0.04);
  const opening = sc.tone(P.opening, haze + 0.12);
  const h = wid * 0.25;
  const l = x - wid / 2;

  fillPoly(ctx, [l - 5, base + 6, l - 1, base - h * 0.5, l + wid + 1, base - h * 0.5, l + wid + 5, base + 6], shade);
  ctx.fillStyle = wall;
  ctx.fillRect(l, base - h, wid, h);
  ctx.fillStyle = shade;
  ctx.fillRect(sc.light < 0 ? l + wid * 0.84 : l, base - h, wid * 0.16, h);
  ctx.fillStyle = roof;
  ctx.fillRect(l - 1, base - h - 2, wid + 2, 2.4);

  // Church block and dome.
  ctx.fillStyle = wall;
  ctx.fillRect(x - wid * 0.13, base - h * 1.42, wid * 0.28, h * 0.44);
  ctx.fillStyle = roof;
  ctx.fillRect(x - wid * 0.14, base - h * 1.42 - 1.6, wid * 0.3, 2);
  ctx.fillStyle = wall;
  ctx.fillRect(x - wid * 0.045, base - h * 1.62, wid * 0.11, h * 0.2);
  ctx.fillStyle = roof;
  ctx.beginPath();
  ctx.arc(x + wid * 0.01, base - h * 1.62, wid * 0.062, Math.PI, 0);
  ctx.fill();
  // A corner tower.
  ctx.fillStyle = wall;
  ctx.fillRect(l, base - h * 1.28, wid * 0.1, h * 0.3);
  ctx.fillStyle = roof;
  ctx.fillRect(l - 0.6, base - h * 1.28 - 1.4, wid * 0.1 + 1.2, 1.8);

  ctx.fillStyle = opening;
  const n = Math.round(wid / 5.2);
  for (const row of [0.22, 0.56]) {
    for (let i = 0; i < n; i++) ctx.fillRect(l + (wid * (i + 0.5)) / n - 0.6, base - h + h * row, 1.2, 2.1);
  }
}

const far: LayerPainter = (ctx, sc, rng, box) => {
  const P = sc.pal;
  const { w, bottom, haze } = box;

  // Back range, snow on the high tops.
  const n1 = noiseProfile(rng, w, 6, 4, 0.5, true);
  const yBack: Profile = (x) => S.backRangeY - S.backRangeAmp * Math.pow(n1(x), 1.25);
  fillBelow(ctx, w, yBack, bottom, vGrad(ctx, S.backRangeY - S.backRangeAmp, bottom, sc.tone(P.far, haze + 0.14), sc.tone(P.far, haze + 0.3)), 2);
  const snowline = S.backRangeY - S.backRangeAmp * 0.42;
  ctx.fillStyle = sc.tone(P.pale, haze + 0.1, 0.8);
  ctx.beginPath();
  ctx.moveTo(-6, yBack(-6));
  for (let x = -6; x <= w + 6; x += 2) ctx.lineTo(x, yBack(x));
  for (let x = w + 6; x >= -6; x -= 5) {
    const top = yBack(x);
    const depth = Math.max(0, snowline - top) * 0.6;
    const zig = depth > 0 ? ((Math.round(x / 5) & 1) === 0 ? 2.5 : -1.5) : 0;
    ctx.lineTo(x, top + Math.max(0, depth + zig));
  }
  ctx.closePath();
  ctx.fill();

  // The massif, flat-topped where the abbey stands.
  const px = w * 0.38;
  const dist = (x: number): number => Math.abs(((x - px + w * 1.5) % w) - w / 2);
  const crag = noiseProfile(rng, w, 11, 4, 0.5, true);
  const lift = (d: number): number => Math.pow(Math.max(0, 1 - d / 540), 1.3);
  const shelf = S.monasteryWidth * 0.62;
  const massif: Profile = (x) => {
    const d = dist(x);
    const rough = smoothstep((d - shelf) / 50);
    return S.massifY - S.massifAmp * lift(Math.max(d, shelf)) - crag(x) * 40 * rough;
  };
  const peakY = massif(px);
  fillBelow(ctx, w, massif, bottom, vGrad(ctx, peakY, bottom, sc.tone(P.farAlt, haze - 0.04), sc.tone(P.farAlt, haze + 0.2)), 2);

  ctx.save();
  pathBelow(ctx, w, massif, bottom, 2);
  ctx.clip();
  // Light and shadow either side of the summit.
  const side = ctx.createLinearGradient(px - 420, 0, px + 420, 0);
  const litC = sc.tone(P.pale, haze, 0.12);
  const darkC = sc.tone(P.far, haze - 0.2, 0.3);
  side.addColorStop(0, sc.light < 0 ? litC : darkC);
  side.addColorStop(0.5, sc.tone(P.far, haze, 0));
  side.addColorStop(1, sc.light < 0 ? darkC : litC);
  ctx.fillStyle = side;
  ctx.fillRect(px - 520, peakY - 10, 1040, bottom - peakY + 10);
  // Gullies running down from the ridge.
  ctx.lineCap = 'round';
  for (let i = 0; i < 80; i++) {
    const gx = range(rng, 6, w - 6);
    const top = massif(gx);
    const away = gx < px ? -1 : 1;
    const len = range(rng, 24, 80);
    ctx.strokeStyle = sc.tone(P.far, haze - 0.14, range(rng, 0.14, 0.3));
    ctx.lineWidth = range(rng, 1, 2.6);
    ctx.beginPath();
    ctx.moveTo(gx, top + range(rng, 3, 14));
    ctx.quadraticCurveTo(gx + away * len * 0.2, top + len * 0.6, gx + away * len * range(rng, 0.25, 0.6), top + len);
    ctx.stroke();
  }
  ctx.restore();

  monastery(ctx, sc, px, peakY + 1, S.monasteryWidth, haze - 0.16);
};

/** A wall with a ragged top between two heights; returns the outline (for filling) and takes openings as rect holes. */
function jaggedWall(ctx: Ctx, rng: Rng, x0: number, x1: number, base: number, hLeft: number, hRight: number): void {
  const steps = Math.max(4, Math.round((x1 - x0) / 5));
  ctx.moveTo(x0, base);
  ctx.lineTo(x0, base - hLeft);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = lerp(x0, x1, t);
    const top = base - lerp(hLeft, hRight, t) * range(rng, 0.84, 1.04);
    ctx.lineTo(x - 1, top);
    ctx.lineTo(x + 1, top + range(rng, -2.5, 3));
  }
  ctx.lineTo(x1, base - hRight);
  ctx.lineTo(x1, base);
  ctx.closePath();
}

/** Shelled house: a standing gable, a broken front with empty windows, rubble at its foot. */
function ruin(ctx: Ctx, sc: Scene, rng: Rng, x: number, base: number, wid: number, h: number, haze: number): void {
  const P = sc.pal;
  const flip = rng() < 0.5 ? -1 : 1;
  ctx.save();
  ctx.translate(x, 0);
  ctx.scale(flip, 1);
  ctx.fillStyle = sc.tone(P.wallShade, haze + 0.04);
  ctx.beginPath();
  jaggedWall(ctx, rng, -wid * 0.2, wid * 0.5, base, h * 0.75, h * 0.95);
  ctx.fill();
  ctx.fillStyle = sc.tone(P.wall, haze);
  ctx.beginPath();
  jaggedWall(ctx, rng, -wid * 0.5, wid * 0.24, base, h, h * 0.4);
  for (const t of [0.2, 0.55]) {
    const localTop = lerp(h, h * 0.4, t) * 0.8;
    const ww = wid * 0.09;
    const wh = Math.min(h * 0.24, localTop * 0.36);
    ctx.rect(lerp(-wid * 0.5, wid * 0.24, t) - ww / 2, base - localTop * 0.82, ww, wh);
    if (localTop > h * 0.6) ctx.rect(lerp(-wid * 0.5, wid * 0.24, t) - ww / 2, base - localTop * 0.38, ww, wh);
  }
  ctx.fill('evenodd');
  // A charred beam still lodged in the wall.
  ctx.strokeStyle = sc.tone(P.trunk, haze);
  ctx.lineWidth = Math.max(0.8, h * 0.035);
  ctx.lineCap = 'butt';
  line(ctx, -wid * 0.3, base - h * 0.52, wid * 0.32, base - h * 0.2);
  ctx.restore();
  rubblePile(ctx, rng, x, base + 1, wid * 1.15, h * 0.2, sc.tone(P.stone, haze), sc.tone(P.stoneShade, haze), sc.light);
}

const mid: LayerPainter = (ctx, sc, rng, box) => {
  const P = sc.pal;
  const { w, bottom, haze } = box;
  const n = noiseProfile(rng, w, 5, 4, 0.5, true);
  const y: Profile = (x) => S.midSlopeY - S.midSlopeAmp * n(x);
  fillBelow(ctx, w, y, bottom, vGrad(ctx, S.midSlopeY - S.midSlopeAmp, bottom, sc.tone(P.mid, haze), sc.tone(P.midAlt, haze + 0.14)), 2);

  // Rock ribs and scree on the slope.
  ctx.save();
  pathBelow(ctx, w, y, bottom, 2);
  ctx.clip();
  ctx.lineCap = 'round';
  for (let i = 0; i < 110; i++) {
    const gx = range(rng, 4, w - 4);
    const top = y(gx);
    const len = range(rng, 8, 30);
    const lean = range(rng, -0.5, 0.5) * len;
    ctx.strokeStyle = i % 3 === 0 ? sc.tone(P.stone, haze, 0.4) : sc.tone(P.midAlt, haze - 0.1, 0.4);
    ctx.lineWidth = range(rng, 1, 2.4);
    line(ctx, gx, top + range(rng, 2, 26), gx + lean, top + range(rng, 2, 26) + len);
  }
  ctx.restore();

  for (const rx of spread(rng, w, S.ruins, 0.8)) {
    const wid = range(rng, 28, 46);
    const h = range(rng, 18, 30);
    wrappedSeeded(w, rx, wid, rng, (cx, r) => ruin(ctx, sc, r, cx, y(cx) + 5, wid, h, haze - 0.06));
  }
  const tree = sc.tone(P.trunk, haze + 0.04);
  for (let i = 0; i < S.midTrees; i++) {
    const tx = rng() * w;
    const h = range(rng, 14, 27);
    wrappedSeeded(w, tx, h, rng, (cx, r) => shatteredTree(ctx, r, cx, y(cx) + 3, h, tree));
  }
};

/** A stretch of thick wall with an arched doorway, left standing. */
function wallRuin(ctx: Ctx, sc: Scene, rng: Rng, x: number, base: number, wid: number, h: number, haze: number): void {
  const P = sc.pal;
  const l = x - wid / 2;
  ctx.fillStyle = sc.tone(P.wall, haze);
  ctx.beginPath();
  jaggedWall(ctx, rng, l, l + wid, base, h * range(rng, 0.5, 0.75), h);
  const ax = x + wid * 0.12;
  const aw = wid * 0.26;
  const ah = h * 0.34;
  ctx.moveTo(ax - aw / 2, base);
  ctx.lineTo(ax - aw / 2, base - ah);
  ctx.arc(ax, base - ah, aw / 2, Math.PI, 0);
  ctx.lineTo(ax + aw / 2, base);
  ctx.closePath();
  ctx.rect(l + wid * 0.14, base - h * 0.44, wid * 0.11, h * 0.16);
  ctx.fill('evenodd');
  // The shaded return of the wall, and a few courses of stone.
  ctx.fillStyle = sc.tone(P.wallShade, haze);
  ctx.fillRect(sc.light < 0 ? l + wid - 5 : l, base - h * 0.5, 5, h * 0.5);
  ctx.strokeStyle = sc.tone(P.wallShade, haze, 0.5);
  ctx.lineWidth = 0.8;
  for (let k = 1; k < 4; k++) line(ctx, l + 2, base - h * 0.12 * k, l + wid * 0.3, base - h * 0.12 * k);
}

const near: LayerPainter = (ctx, sc, rng, box) => {
  const P = sc.pal;
  const { w, bottom, haze } = box;
  const lumps = noiseProfile(rng, w, 26, 3, 0.5, false);
  const roll = sineProfile(rng, w, [2, 3, 5], 0.8);
  const y: Profile = (x) => S.bankY + roll(x) * 3 - lumps(x) * 7;

  for (const rx of spread(rng, w, S.wallRuins, 0.5)) {
    const wid = range(rng, 60, 80);
    const h = range(rng, 52, 68);
    wrappedSeeded(w, rx, wid, rng, (cx, r) => wallRuin(ctx, sc, r, cx, y(cx) + 6, wid, h, haze + 0.06));
  }

  // Trees stripped by shellfire, the farther ones a tone lighter.
  const xs = spread(rng, w, S.shatteredTrees, 0.9);
  for (let i = 0; i < xs.length; i++) {
    const h = S.treeHeight * range(rng, 0.55, 1.2);
    const back = i % 3 === 0;
    const color = sc.tone(P.trunk, haze + (back ? 0.14 : 0.02));
    wrappedSeeded(w, xs[i], h * 0.5, rng, (cx, r) => shatteredTree(ctx, r, cx, y(cx) + 4, back ? h * 0.8 : h, color));
  }

  // The churned bank.
  fillBelow(ctx, w, y, bottom, vGrad(ctx, S.bankY - 8, bottom, sc.tone(P.near, haze), sc.tone(P.ground, 0.22)), 2);
  ctx.save();
  pathBelow(ctx, w, y, bottom, 2);
  ctx.clip();
  for (let i = 0; i < 60; i++) {
    const mx = range(rng, 10, w - 10);
    ctx.fillStyle = i % 2 === 0 ? sc.tone(P.nearAlt, haze, 0.35) : sc.tone(P.groundDark, haze, 0.3);
    ctx.beginPath();
    ctx.ellipse(mx, y(mx) + range(rng, 3, 20), range(rng, 8, 26), range(rng, 1.2, 3), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  for (const rx of spread(rng, w, S.rubblePiles, 0.9)) {
    const wid = range(rng, 28, 58);
    wrappedSeeded(w, rx, wid, rng, (cx, r) => {
      rubblePile(ctx, r, cx, y(cx) + 5, wid, range(r, 6, 12), sc.tone(P.stone, haze), sc.tone(P.stoneShade, haze), sc.light);
    });
  }
  // Stumps.
  const stump = sc.tone(P.trunk, haze);
  for (let i = 0; i < 8; i++) {
    const sx = rng() * w;
    wrappedSeeded(w, sx, 8, rng, (cx, r) => shatteredTree(ctx, r, cx, y(cx) + 4, range(r, 8, 14), stump));
  }
};

export const italy: TheatreArt = { far, mid, near };
