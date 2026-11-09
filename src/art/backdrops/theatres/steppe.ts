/**
 * The steppe of the Don bend (Uranus, the Ring), summer grass or, as its winter variant, snow to the horizon:
 *   far:  a horizon flat as a table, a railway embankment with a slow goods train and its telegraph line
 *   mid:  long low swells cut by balkas (gullies) with scrub in their beds, haystacks, a lone post windmill
 *   near: a grassy (or drifted) bank with feather grass, a few stones and a broken fence
 */
import { SCENES } from '../../../data/theatres';
import { bush, fillBelow, fillPoly, line, noiseProfile, oval, rock, sineProfile, spread, vGrad, wrapped, wrappedSeeded, type Ctx, type Profile } from '../kit';
import { chance, range, type Rng } from '../rng';
import type { LayerPainter, Scene, TheatreArt } from '../scene';

const S = SCENES.steppe;

/** A haystack: a rounded stack with a darker skirt (snow on its crown in winter). */
function haystack(ctx: Ctx, sc: Scene, x: number, base: number, r: number, haze: number): void {
  const P = sc.pal;
  ctx.fillStyle = sc.tone(P.roofAlt, haze);
  ctx.beginPath();
  ctx.ellipse(x, base, r, r * 1.25, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = sc.tone(P.roofShade, haze, 0.6);
  ctx.fillRect(x - r, base - r * 0.22, r * 2, r * 0.22);
  if (sc.winter) {
    ctx.fillStyle = sc.tone(P.pale, haze);
    ctx.beginPath();
    ctx.ellipse(x, base - r * 0.7, r * 0.72, r * 0.55, 0, Math.PI, 0);
    ctx.fill();
  }
}

/** A post windmill: the timber body on its trestle, four sails (one pointing up). */
function windmill(ctx: Ctx, sc: Scene, rng: Rng, x: number, base: number, h: number, haze: number): void {
  const P = sc.pal;
  const wood = sc.tone(P.trunk, haze);
  ctx.strokeStyle = wood;
  ctx.lineWidth = 1.2;
  line(ctx, x - h * 0.16, base, x, base - h * 0.34);
  line(ctx, x + h * 0.16, base, x, base - h * 0.34);
  line(ctx, x, base, x, base - h * 0.34);
  ctx.fillStyle = sc.tone(P.wall, haze);
  ctx.fillRect(x - h * 0.12, base - h * 0.62, h * 0.24, h * 0.3);
  fillPoly(ctx, [x - h * 0.14, base - h * 0.62, x, base - h * 0.72, x + h * 0.14, base - h * 0.62], sc.tone(P.roof, haze));
  const hub = { x: x + h * 0.13, y: base - h * 0.58 };
  const turn = range(rng, 0, 0.6);
  ctx.strokeStyle = wood;
  for (let k = 0; k < 4; k++) {
    const a = turn + (k * Math.PI) / 2;
    const ex = hub.x + Math.cos(a) * h * 0.4;
    const ey = hub.y + Math.sin(a) * h * 0.4;
    ctx.lineWidth = 0.9;
    line(ctx, hub.x, hub.y, ex, ey);
    // The lattice of the sail.
    const nx = -Math.sin(a) * h * 0.06;
    const ny = Math.cos(a) * h * 0.06;
    fillPoly(ctx, [hub.x + (ex - hub.x) * 0.3, hub.y + (ey - hub.y) * 0.3, ex, ey, ex + nx, ey + ny, hub.x + (ex - hub.x) * 0.3 + nx, hub.y + (ey - hub.y) * 0.3 + ny], sc.tone(P.wallShade, haze, 0.75));
  }
  if (sc.winter) {
    ctx.fillStyle = sc.tone(P.pale, haze);
    fillPoly(ctx, [x - h * 0.14, base - h * 0.62, x, base - h * 0.72, x + h * 0.14, base - h * 0.62, x, base - h * 0.69], sc.tone(P.pale, haze));
  }
}

const far: LayerPainter = (ctx, sc, rng, box) => {
  const P = sc.pal;
  const { w, bottom, haze } = box;
  // The horizon: barely a swell in it.
  const r = sineProfile(rng, w, [1, 2, 3], 0.6);
  const y: Profile = (x) => S.farLineY + r(x) * 2.5;
  fillBelow(ctx, w, y, bottom, vGrad(ctx, S.farLineY - 4, bottom, sc.tone(P.far, haze + 0.12), sc.tone(P.farAlt, haze + 0.22)));
  // A far line of trees in a shelter belt, here and there.
  for (let i = 0; i < 5; i++) {
    const x = rng() * w;
    const len = range(rng, 60, 180);
    const n = Math.round(len / 4);
    const pts: number[] = [];
    for (let k = 0; k < n; k++) pts.push(range(rng, 1.2, 2.6));
    wrapped(w, x, len, (cx) => {
      ctx.fillStyle = sc.tone(P.foliageShade, haze + 0.16);
      for (let k = 0; k < n; k++) oval(ctx, cx + k * 4, y(cx + k * 4) - pts[k] * 0.4, pts[k] * 1.3, pts[k]);
    });
  }
  // The railway embankment with its telegraph line and a goods train.
  const railY = S.railY;
  ctx.fillStyle = sc.tone(P.farAlt, haze + 0.04);
  ctx.fillRect(-4, railY - 1.5, w + 8, 2.5);
  ctx.strokeStyle = sc.tone(P.metalShade, haze + 0.1, 0.8);
  ctx.lineWidth = 0.5;
  const pitch = w / S.poles;
  for (let i = 0; i < S.poles; i++) {
    const px = (i + 0.5) * pitch;
    line(ctx, px, railY - 1.5, px, railY - 9);
  }
  line(ctx, -4, railY - 8, w + 4, railY - 8);
  const tx = range(rng, 0.1, 0.6) * w;
  const wagon = sc.tone(P.metal, haze + 0.04);
  const wagonAlt = sc.tone(P.roofShade, haze + 0.06);
  for (let k = 0; k < S.wagons; k++) {
    const wx = tx + k * 9;
    ctx.fillStyle = k === 0 ? sc.tone(P.metalShade, haze) : k % 3 === 0 ? wagonAlt : wagon;
    ctx.fillRect(wx, railY - 6.5, 8, 5);
    if (sc.winter) {
      ctx.fillStyle = sc.tone(P.pale, haze);
      ctx.fillRect(wx, railY - 7, 8, 0.8);
    }
  }
  // The engine's smoke trailing back over the wagons.
  ctx.fillStyle = sc.hazeCss(0.5);
  for (let k = 0; k < 6; k++) oval(ctx, tx + 3 + k * 7, railY - 9 - k * 1.2, 3 + k, 2 + k * 0.5);
};

const mid: LayerPainter = (ctx, sc, rng, box) => {
  const P = sc.pal;
  const { w, bottom, haze } = box;
  const r = sineProfile(rng, w, [1, 2, 3, 5], 0.8);
  const y: Profile = (x) => S.midSwellY + r(x) * S.midSwellAmp;
  fillBelow(ctx, w, y, bottom, vGrad(ctx, S.midSwellY - 6, bottom, sc.tone(P.mid, haze), sc.tone(P.midAlt, haze + 0.08)));
  // Balkas: gullies running across, darker in their beds, scrub along them.
  for (const bx of spread(rng, w, S.balkas, 0.7)) {
    const bw = range(rng, 120, 220);
    const depth = range(rng, 6, 10);
    wrappedSeeded(w, bx, bw, rng, (cx, q) => {
      const top = y(cx);
      fillPoly(ctx, [cx - bw / 2, top + 1, cx - bw * 0.2, top + depth, cx + bw * 0.25, top + depth * 0.8, cx + bw / 2, top + 1], sc.tone(P.near, haze + 0.04));
      ctx.fillStyle = sc.tone(P.soilDark, haze + 0.12, 0.6);
      ctx.fillRect(cx - bw * 0.2, top + depth - 1.2, bw * 0.45, 1.2);
      for (let k = 0; k < 6; k++) {
        const sx = cx + range(q, -0.3, 0.3) * bw;
        bush(ctx, q, sx, top + depth * 0.8, range(q, 6, 12), range(q, 2, 4), sc.tone(P.foliage, haze), sc.tone(P.foliageShade, haze), sc.light);
      }
    });
  }
  // Haystacks across the swells.
  for (let i = 0; i < S.haystacks; i++) {
    const x = range(rng, 10, w - 10);
    const hr = range(rng, 3.5, 6);
    haystack(ctx, sc, x, y(x) + range(rng, 4, 14), hr, haze);
  }
  // A lone post windmill on a rise.
  const mx = w * S.windmillAt;
  windmill(ctx, sc, rng, mx, y(mx) + 3, S.windmillHeight, haze - 0.04);
  if (sc.winter) {
    // Wind-scoured streaks on the snow.
    ctx.strokeStyle = sc.tone(P.midAlt, haze, 0.7);
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 18; i++) {
      const x = rng() * w;
      const len = range(rng, 30, 110);
      const dy = range(rng, 4, 20);
      wrapped(w, x, len, (cx) => line(ctx, cx, y(cx) + dy, cx + len, y(cx + len) + dy + 1));
    }
  }
};

const near: LayerPainter = (ctx, sc, rng, box) => {
  const P = sc.pal;
  const { w, bottom, haze } = box;
  const lump = noiseProfile(rng, w, 120, 2, 0.5, false);
  const bank: Profile = (x) => S.nearSwellY - lump(x) * S.nearSwellAmp;
  fillBelow(ctx, w, bank, bottom, vGrad(ctx, S.nearSwellY - 6, bottom, sc.tone(P.nearAlt, haze), sc.tone(P.ground, 0.22)), 2);
  // Feather grass (dry stalks poking through the drifts in winter).
  ctx.lineCap = 'round';
  for (let i = 0; i < S.grassClumps; i++) {
    const x = rng() * w;
    const h = range(rng, 6, 16);
    const blades = 5 + Math.floor(rng() * 5);
    const lean: number[] = [];
    for (let k = 0; k < blades; k++) lean.push(range(rng, -0.5, 0.7));
    const color = sc.tone(chance(rng, 0.5) ? P.tuft : P.foliage, haze);
    wrapped(w, x, h, (cx) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.8;
      const by = bank(cx) + 3;
      for (let k = 0; k < blades; k++) line(ctx, cx + k * 0.6, by, cx + k * 0.6 + lean[k] * h, by - h * (1 - Math.abs(lean[k]) * 0.4));
    });
  }
  // A few stones, and a broken fence of a collective farm's paddock.
  for (let i = 0; i < 6; i++) {
    const x = rng() * w;
    const rw = range(rng, 10, 22);
    wrappedSeeded(w, x, rw, rng, (cx, q) => rock(ctx, q, cx, bank(cx) + 4, rw, rw * range(q, 0.3, 0.5), sc.tone(P.stone, haze), sc.tone(P.stoneShade, haze), sc.light));
  }
  const fx = range(rng, 0.2, 0.8) * w;
  ctx.strokeStyle = sc.tone(P.trunk, haze);
  ctx.lineWidth = 1.4;
  for (let k = 0; k < 7; k++) {
    if (k === 3) continue;
    const px = fx + k * 26;
    line(ctx, px, bank(px) + 4, px + range(rng, -2, 2), bank(px) - 16);
  }
  ctx.lineWidth = 0.9;
  line(ctx, fx, bank(fx) - 11, fx + 70, bank(fx + 70) - 12);
  line(ctx, fx + 104, bank(fx + 104) - 10, fx + 156, bank(fx + 156) - 9);
  if (sc.winter) {
    // Drifts banked against the fence and the stones.
    ctx.fillStyle = sc.tone(P.pale, haze);
    for (let i = 0; i < 26; i++) {
      const x = rng() * w;
      const dw = range(rng, 14, 40);
      const dh = range(rng, 2, 4);
      wrapped(w, x, dw, (cx) => oval(ctx, cx, bank(cx) + 2, dw / 2, dh));
    }
  }
};

export const steppe: TheatreArt = { far, mid, near };
