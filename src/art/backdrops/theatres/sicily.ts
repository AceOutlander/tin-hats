/** Sicily: dry terraced hills, olive trees, stone walls, a hill town, cypress. */
import { SCENES } from '../../../data/theatres';
import {
  clumps,
  disc,
  fillBelow,
  fillPoly,
  house,
  noiseProfile,
  oval,
  pathBelow,
  roundTree,
  sineProfile,
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

const S = SCENES.sicily;

/** Blocky houses piled up a hilltop, crowned by a dome and a bell tower. */
function hillTown(ctx: Ctx, sc: Scene, rng: Rng, yOf: Profile, x: number, haze: number): void {
  const P = sc.pal;
  const walls = [sc.tone(P.wall, haze), sc.tone(P.wallAlt, haze), sc.tone(P.trim, haze + 0.04)];
  const shade = sc.tone(P.wallShade, haze);
  const roof = sc.tone(P.roof, haze);
  const opening = sc.tone(P.opening, haze + 0.14);
  const reach = 78;

  const houses: { x: number; w: number; h: number; base: number; wall: string }[] = [];
  for (let i = 0; i < S.townHouses; i++) {
    const u = range(rng, -1, 1);
    const dx = u * Math.abs(u) * reach;
    const near = 1 - Math.abs(dx) / reach;
    const hw = range(rng, 8, 14);
    houses.push({
      x: x + dx,
      w: hw,
      h: range(rng, 6, 10) + near * range(rng, 2, 9),
      base: yOf(x + dx) + 4,
      wall: walls[i % walls.length],
    });
  }
  // Tallest first, so the lower houses stand in front.
  houses.sort((a, b) => b.h - a.h);

  // Mother church on the crest: nave, dome on a drum, and a campanile.
  const top = yOf(x) + 2;
  ctx.fillStyle = walls[0];
  ctx.fillRect(x - 14, top - 17, 26, 17);
  ctx.fillStyle = roof;
  ctx.fillRect(x - 15, top - 18.5, 28, 2);
  ctx.fillStyle = walls[2];
  ctx.fillRect(x - 6, top - 23, 11, 5);
  ctx.fillStyle = roof;
  ctx.beginPath();
  ctx.arc(x - 0.5, top - 23, 6, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(x - 1.1, top - 31.5, 1.2, 3);
  ctx.fillStyle = walls[1];
  ctx.fillRect(x + 14, top - 30, 6, 30);
  ctx.fillStyle = shade;
  ctx.fillRect(x + (sc.light < 0 ? 18 : 14), top - 30, 2, 30);
  ctx.fillStyle = opening;
  ctx.fillRect(x + 15.8, top - 27, 2.2, 3.6);
  fillPoly(ctx, [x + 13.4, top - 30, x + 17, top - 37, x + 20.6, top - 30], roof);

  for (const h of houses) {
    ctx.fillStyle = h.wall;
    ctx.fillRect(h.x - h.w / 2, h.base - h.h, h.w, h.h);
    ctx.fillStyle = shade;
    ctx.fillRect(sc.light < 0 ? h.x + h.w * 0.22 : h.x - h.w / 2, h.base - h.h, h.w * 0.28, h.h);
    ctx.fillStyle = roof;
    ctx.fillRect(h.x - h.w / 2 - 0.6, h.base - h.h - 1.2, h.w + 1.2, 1.6);
    ctx.fillStyle = opening;
    const wy = h.base - h.h + 2.4;
    ctx.fillRect(h.x - h.w * 0.26, wy, 1.3, 1.9);
    if (h.w > 10) ctx.fillRect(h.x + h.w * 0.02, wy, 1.3, 1.9);
  }
}

const far: LayerPainter = (ctx, sc, rng, box) => {
  const P = sc.pal;
  const { w, bottom, haze } = box;

  // A volcano on the horizon, mostly haze, trailing a thread of smoke.
  const vx = w * 0.24;
  const rise = S.farRidgeY + 30 - S.volcanoTopY;
  const cone: Profile = (x) => {
    const dx = Math.abs(((x - vx + w * 1.5) % w) - w / 2);
    const lift = 1 / Math.pow(1 + (dx / 150) * (dx / 150), 0.8);
    // A blunt, notched summit.
    return S.farRidgeY + 30 - rise * Math.min(lift, 0.965 - Math.max(0, 9 - dx) * 0.004);
  };
  fillBelow(ctx, w, cone, bottom, vGrad(ctx, S.volcanoTopY, S.farRidgeY + 30, sc.tone(P.far, haze + 0.22), sc.tone(P.far, haze + 0.32)), 2);
  const plume = sc.tone(P.pale, haze + 0.2, 0.2);
  ctx.fillStyle = plume;
  for (let i = 0; i < 7; i++) {
    oval(ctx, vx - sc.light * (6 + i * 15), S.volcanoTopY + 4 - i * 2.2, 10 + i * 5, 3.5 + i * 1.3);
  }

  // Bare, sun-dried hills.
  const r1 = sineProfile(rng, w, [1, 2, 3, 5, 7], 0.75);
  const y1: Profile = (x) => S.farRidgeY + r1(x) * S.farRidgeAmp;
  fillBelow(ctx, w, y1, bottom, vGrad(ctx, S.farRidgeY - S.farRidgeAmp, bottom, sc.tone(P.far, haze), sc.tone(P.farAlt, haze + 0.14)));
  ctx.save();
  pathBelow(ctx, w, y1, bottom);
  ctx.clip();
  ctx.strokeStyle = sc.tone(P.stoneShade, haze + 0.04, 0.35);
  ctx.lineWidth = 1;
  for (const dy of [9, 17, 26, 36]) strokeAlong(ctx, w, y1, dy);
  ctx.restore();
  clumps(ctx, rng, w, y1, 90, 1.8, 4, sc.tone(P.foliageShade, haze + 0.06), 6);

  // The town sits on the highest crest in the right half of the tile.
  let tx = w * 0.6;
  for (let x = w * 0.5; x < w * 0.9; x += 8) if (y1(x) < y1(tx)) tx = x;
  hillTown(ctx, sc, rng, y1, tx, haze - 0.14);
};

const mid: LayerPainter = (ctx, sc, rng, box) => {
  const P = sc.pal;
  const { w, bottom, haze } = box;
  const r = sineProfile(rng, w, [1, 2, 3, 4, 7], 0.8);
  const y: Profile = (x) => S.midRidgeY + r(x) * S.midRidgeAmp;
  fillBelow(ctx, w, y, bottom, vGrad(ctx, S.midRidgeY - S.midRidgeAmp, bottom, sc.tone(P.mid, haze), sc.tone(P.midAlt, haze + 0.08)));

  // Terraces: a stone wall, its shadow, and the pale strip of tilled earth above it.
  const pitch = 9.5;
  ctx.save();
  pathBelow(ctx, w, y, bottom);
  ctx.clip();
  for (let k = 1; k <= S.terraces; k++) {
    ctx.strokeStyle = sc.tone(P.nearAlt, haze, 0.5);
    ctx.lineWidth = 3;
    strokeAlong(ctx, w, y, k * pitch - 2.6);
    ctx.strokeStyle = sc.tone(P.stone, haze - 0.04);
    ctx.lineWidth = 1.8;
    strokeAlong(ctx, w, y, k * pitch);
    ctx.strokeStyle = sc.tone(P.stoneShade, haze, 0.5);
    ctx.lineWidth = 1;
    strokeAlong(ctx, w, y, k * pitch + 1.5);
  }
  ctx.restore();

  // Olive groves on the terraces.
  const lit = sc.tone(P.foliage, haze);
  const shade = sc.tone(P.foliageShade, haze);
  const trunk = sc.tone(P.trunk, haze + 0.06);
  for (let i = 0; i < S.midOlives; i++) {
    const ox = rng() * w;
    const k = Math.floor(rng() * S.terraces);
    const rr = range(rng, 4, 6.2);
    wrapped(w, ox, rr * 2, (cx) => {
      const oy = y(cx) + k * pitch - 1;
      ctx.fillStyle = trunk;
      ctx.fillRect(cx - 0.7, oy - rr * 0.9, 1.4, rr * 0.9);
      ctx.fillStyle = shade;
      oval(ctx, cx, oy - rr * 1.3, rr * 1.15, rr * 0.85);
      ctx.fillStyle = lit;
      oval(ctx, cx + sc.light * rr * 0.25, oy - rr * 1.5, rr * 0.8, rr * 0.55);
    });
  }

  // A farmstead flanked by cypress.
  const fx = w * 0.36;
  const base = y(fx) + 4;
  const look: HouseLook = {
    wall: sc.tone(P.wall, haze - 0.08),
    wallShade: sc.tone(P.wallShade, haze - 0.08),
    roof: sc.tone(P.roof, haze - 0.06),
    roofShade: sc.tone(P.roofShade, haze - 0.06),
    opening: sc.tone(P.opening, haze + 0.1),
  };
  const cyp: TreeLook = { lit: sc.tone(P.foliageAlt, haze), shade: sc.tone(P.foliageAltShade, haze), trunk };
  spindle(ctx, fx - 12, base, 34, 7, cyp, sc.light, 0.04);
  spindle(ctx, fx - 4, base, 28, 6, cyp, sc.light, 0.04);
  house(ctx, fx, base, 36, 15, 6, look, false, 3);
  house(ctx, fx + 36, base, 18, 10, 5, look, false, 1);
  spindle(ctx, fx + 62, base + 1, 31, 7, cyp, sc.light, 0.04);
  for (const gx of spread(rng, w, 4, 0.9)) {
    if (Math.abs(gx - fx) < 120) continue;
    wrapped(w, gx, 20, (cx) => {
      spindle(ctx, cx, y(cx) + 3, 26, 6, cyp, sc.light, 0.04);
      spindle(ctx, cx + 8, y(cx + 8) + 3, 31, 6.5, cyp, sc.light, 0.04);
    });
  }
};

/** Prickly pear: a pile of paddle-shaped pads. */
function pricklyPear(ctx: Ctx, rng: Rng, x: number, base: number, s: number, lit: string, shade: string, light: number): void {
  const pads = 8 + Math.floor(rng() * 5);
  for (let i = 0; i < pads; i++) {
    const level = i / pads;
    const px = x + range(rng, -1, 1) * s * (1.1 - level * 0.5);
    const py = base - s * 0.3 - level * s * 1.5;
    const rx = s * range(rng, 0.22, 0.32);
    const ry = s * range(rng, 0.36, 0.5);
    const rot = range(rng, -0.6, 0.6);
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.ellipse(px, py, rx, ry, rot, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = lit;
    ctx.beginPath();
    ctx.ellipse(px + light * rx * 0.25, py - ry * 0.1, rx * 0.72, ry * 0.8, rot, 0, Math.PI * 2);
    ctx.fill();
  }
}

const near: LayerPainter = (ctx, sc, rng, box) => {
  const P = sc.pal;
  const { w, bottom, haze } = box;
  const olive: TreeLook = { lit: sc.tone(P.foliage, haze), shade: sc.tone(P.foliageShade, haze), trunk: sc.tone(P.trunk, haze) };
  const cyp: TreeLook = { lit: sc.tone(P.foliageAlt, haze), shade: sc.tone(P.foliageAltShade, haze), trunk: sc.tone(P.trunk, haze) };

  // Trees stand behind the wall.
  for (const cx0 of spread(rng, w, S.cypresses, 0.8)) {
    const pair = chance(rng, 0.6);
    const h = S.cypressHeight * range(rng, 0.8, 1.1);
    wrapped(w, cx0, 30, (cx) => {
      spindle(ctx, cx, S.wallY + 8, h, 15, cyp, sc.light, 0.03);
      if (pair) spindle(ctx, cx + 17, S.wallY + 8, h * 0.8, 13, cyp, sc.light, 0.03);
    });
  }
  for (const ox of spread(rng, w, S.olives, 0.7)) {
    const h = S.oliveHeight * range(rng, 0.8, 1.15);
    wrappedSeeded(w, ox, h, rng, (cx, r) => roundTree(ctx, r, cx, S.wallY + 8, h, h * range(r, 1.15, 1.4), olive, sc.light));
  }

  // Dry-stone wall with a ragged top and two tumbled gaps.
  const jag = noiseProfile(rng, w, 220, 2, 0.5, true);
  const gaps = [w * 0.18, w * 0.67];
  const wallTop: Profile = (x) => {
    let drop = 0;
    for (const gx of gaps) {
      const dx = Math.abs(((x - gx + w * 1.5) % w) - w / 2);
      drop = Math.max(drop, 1 - Math.min(1, dx / 26));
    }
    return S.wallY - jag(x) * 2.6 + drop * 8;
  };
  fillBelow(ctx, w, wallTop, bottom, vGrad(ctx, S.wallY - 2, S.wallY + 14, sc.tone(P.stone, haze), sc.tone(P.stoneShade, haze)), 1.5);
  ctx.save();
  pathBelow(ctx, w, wallTop, bottom, 1.5);
  ctx.clip();
  const stones = Math.round(w / 2.4);
  for (let i = 0; i < stones; i++) {
    const sx = ((i + rng()) / stones) * w;
    const sy = S.wallY - 2 + rng() * 14;
    const sw = range(rng, 2.5, 6);
    const pick = rng();
    ctx.fillStyle = pick < 0.45 ? sc.tone(P.stoneShade, haze, 0.55) : sc.tone(P.pale, haze + 0.1, 0.35);
    wrapped(w, sx, sw, (cx) => oval(ctx, cx, sy, sw * 0.5, sw * 0.28));
  }
  ctx.restore();

  // Golden grass at the foot of the wall.
  const sway = sineProfile(rng, w, [2, 5, 9], 0.7);
  const verge: Profile = (x) => S.wallY + 12 + sway(x) * 1.5;
  fillBelow(ctx, w, verge, bottom, vGrad(ctx, S.wallY + 10, bottom, sc.tone(P.nearAlt, haze), sc.tone(P.ground, 0.22)));
  ctx.strokeStyle = sc.tone(P.nearAlt, haze - 0.05);
  ctx.lineWidth = 1;
  ctx.lineCap = 'round';
  const blades = Math.round(w / 3);
  ctx.beginPath();
  for (let i = 0; i < blades; i++) {
    const bx = range(rng, 3, w - 3);
    const by = verge(bx) + 1.5;
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + range(rng, -2, 2), by - range(rng, 2.5, 6));
  }
  ctx.stroke();
  // Tumbled stones in the gaps.
  for (const gx of gaps) {
    for (let k = 0; k < 9; k++) {
      ctx.fillStyle = k % 2 === 0 ? sc.tone(P.stone, haze) : sc.tone(P.stoneShade, haze);
      oval(ctx, gx + range(rng, -26, 26), S.wallY + range(rng, 9, 15), range(rng, 2, 4), range(rng, 1.2, 2.2));
    }
  }

  for (const px of spread(rng, w, S.pricklyPears, 0.9)) {
    const s = range(rng, 9, 13);
    wrappedSeeded(w, px, s * 2, rng, (cx, r) => {
      pricklyPear(ctx, r, cx, verge(cx) + 3, s, sc.tone(P.foliage, haze - 0.04), sc.tone(P.foliageAltShade, haze), sc.light);
    });
  }
  // Dots of scrub along the verge.
  ctx.fillStyle = sc.tone(P.foliageShade, haze + 0.05, 0.6);
  for (let i = 0; i < 26; i++) {
    const bx = range(rng, 6, w - 6);
    disc(ctx, bx, verge(bx) + 3, range(rng, 1.5, 3));
  }
};

export const sicily: TheatreArt = { far, mid, near };
