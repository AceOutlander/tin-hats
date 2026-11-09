/**
 * Stalingrad: the city in ruins, autumn 1942 (smoke and brick dust), and as its winter variant the snow on the ruins
 * in January 1943 (also Klin's ruined streets):
 *   far:  the Volga and its low east bank, with smoke columns standing over the city from fires out of sight
 *   mid:  gutted apartment blocks, factory chimneys and the grain elevator, a smoke column or two
 *   near: the broken facades of the nearest blocks, twisted girders, rubble heaps and shell-stripped trees
 */
import { SCENES } from '../../../data/theatres';
import { clamp, fillBelow, fillPoly, line, noiseProfile, rubblePile, shatteredTree, sineProfile, spread, vGrad, wrapped, wrappedSeeded, type Ctx, type Profile } from '../kit';
import { chance, range, type Rng } from '../rng';
import type { LayerPainter, Scene, TheatreArt } from '../scene';
import { smokeColumn } from './russiaSummer';

const S = SCENES.stalingrad;

/** A tall smoke column from a burning city block: dark at the root, spreading and leaning downwind as it climbs. */
function fireSmoke(ctx: Ctx, sc: Scene, rng: Rng, x: number, base: number, h: number, wid: number, haze: number): void {
  const P = sc.pal;
  const dark = (a: number): string => sc.tone(P.metalShade, haze, a);
  const pale = (a: number): string => sc.tone(P.stone, haze + 0.15, a);
  smokeColumn(ctx, rng, x, base, h, wid, dark, 0.5, 0.35);
  smokeColumn(ctx, rng, x + wid * 0.3, base - h * 0.1, h * 0.9, wid * 0.8, pale, 0.28, 0.42);
}

/**
 * A gutted block, x = left edge: its outline broken off at the top, rows of empty windows, holes blown through, a
 * floor line left standing. `snow` lays a white line on every ledge.
 */
function gutted(ctx: Ctx, sc: Scene, rng: Rng, x: number, base: number, w: number, h: number, haze: number, floors: number): void {
  const P = sc.pal;
  const wall = sc.tone(chance(rng, 0.4) ? P.wallAlt : P.wall, haze);
  const shade = sc.tone(P.wallShade, haze);
  const hole = sc.tone(P.opening, haze);
  // The broken top: a jagged line across the roof.
  const steps = Math.max(3, Math.round(w / 6));
  const pts: number[] = [x, base];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const drop = chance(rng, 0.35) ? range(rng, 0.1, 0.45) : range(rng, 0, 0.06);
    pts.push(x + w * f, base - h * (1 - drop));
  }
  pts.push(x + w, base);
  fillPoly(ctx, pts, wall);
  // The side away from the light in shade.
  ctx.fillStyle = shade;
  ctx.fillRect(sc.light < 0 ? x + w * 0.82 : x, base - h * 0.9, w * 0.18, h * 0.9);
  // Empty windows, floor by floor (the sky shows through some).
  const fh = h / floors;
  const cols = Math.max(2, Math.round(w / 7));
  for (let f = 0; f < floors; f++) {
    const y = base - fh * (f + 0.72);
    for (let c = 0; c < cols; c++) {
      if (chance(rng, 0.12)) continue;
      const wx = x + (w * (c + 0.5)) / cols;
      ctx.fillStyle = chance(rng, 0.2) ? sc.hazeCss(0.85) : hole;
      ctx.fillRect(wx - w / cols / 4, y, w / cols / 2, fh * 0.46);
    }
    ctx.fillStyle = shade;
    ctx.fillRect(x, base - fh * f - 0.6, w, Math.max(0.5, fh * 0.06));
  }
  // A shell hole or two.
  for (let i = 0; i < 2; i++) {
    if (!chance(rng, 0.6)) continue;
    const hx = x + range(rng, 0.2, 0.8) * w;
    const hy = base - range(rng, 0.3, 0.75) * h;
    const r = range(rng, 0.08, 0.16) * w;
    ctx.fillStyle = hole;
    ctx.beginPath();
    ctx.ellipse(hx, hy, r, r * range(rng, 0.7, 1.1), range(rng, 0, 3), 0, Math.PI * 2);
    ctx.fill();
  }
  if (sc.winter) {
    ctx.fillStyle = sc.tone(P.pale, haze);
    for (let f = 1; f < floors; f++) ctx.fillRect(x, base - fh * f - 1.2, w, Math.max(0.6, fh * 0.07));
    for (let i = 2; i + 3 < pts.length - 2; i += 2) fillPoly(ctx, [pts[i], pts[i + 1], pts[i + 2], pts[i + 3], pts[i + 2], pts[i + 3] + 1.4, pts[i], pts[i + 1] + 1.4], sc.tone(P.pale, haze));
  }
}

/** A factory chimney with its bands, sometimes broken off. */
function chimney(ctx: Ctx, sc: Scene, rng: Rng, x: number, base: number, h: number, haze: number): void {
  const P = sc.pal;
  const top = chance(rng, 0.3) ? h * range(rng, 0.55, 0.8) : h;
  const w0 = h * 0.07;
  const w1 = h * 0.045;
  fillPoly(ctx, [x - w0, base, x - w1, base - top, x + w1, base - top, x + w0, base], sc.tone(P.wallAlt, haze));
  ctx.fillStyle = sc.tone(P.wallShade, haze);
  for (const f of [0.35, 0.65, 0.9]) if (f * h < top) ctx.fillRect(x - w0 * (1 - f * 0.4), base - h * f, w0 * 2 * (1 - f * 0.4), Math.max(0.6, h * 0.012));
  if (sc.winter) {
    ctx.fillStyle = sc.tone(P.pale, haze);
    ctx.fillRect(x - w1, base - top - 0.6, w1 * 2, 1.2);
  }
}

/** The grain elevator: a tall block of silos with the headhouse on top, scarred by shellfire. */
function elevator(ctx: Ctx, sc: Scene, rng: Rng, x: number, base: number, h: number, haze: number): void {
  const P = sc.pal;
  const w = h * 0.62;
  const wall = sc.tone(P.stone, haze);
  const shade = sc.tone(P.stoneShade, haze);
  ctx.fillStyle = wall;
  ctx.fillRect(x - w / 2, base - h * 0.78, w, h * 0.78);
  // The silos read as vertical bands.
  ctx.fillStyle = shade;
  const silos = 6;
  for (let i = 0; i < silos; i++) ctx.fillRect(x - w / 2 + (w * (i + 0.82)) / silos, base - h * 0.78, Math.max(0.6, w * 0.025), h * 0.78);
  // The headhouse.
  ctx.fillStyle = wall;
  ctx.fillRect(x - w * 0.18, base - h, w * 0.36, h * 0.24);
  ctx.fillStyle = sc.tone(P.opening, haze);
  ctx.fillRect(x - w * 0.12, base - h * 0.95, w * 0.24, h * 0.05);
  for (let i = 0; i < 9; i++) {
    const hx = x + range(rng, -0.45, 0.45) * w;
    const hy = base - range(rng, 0.2, 0.75) * h;
    ctx.fillRect(hx, hy, range(rng, 1, 3), range(rng, 1, 3));
  }
  if (sc.winter) {
    ctx.fillStyle = sc.tone(P.pale, haze);
    ctx.fillRect(x - w / 2, base - h * 0.79, w, 1.4);
    ctx.fillRect(x - w * 0.18, base - h - 0.6, w * 0.36, 1.2);
  }
}

const far: LayerPainter = (ctx, sc, rng, box) => {
  const P = sc.pal;
  const { w, bottom, haze } = box;
  // The low east bank across the river: a flat dark line of trees.
  const bankP = noiseProfile(rng, w, 80, 2, 0.5, false);
  const bank: Profile = (x) => S.farBankY - bankP(x) * 4;
  fillBelow(ctx, w, bank, bottom, vGrad(ctx, S.farBankY - 6, bottom, sc.tone(P.far, haze + 0.12), sc.tone(P.farAlt, haze + 0.2)));
  // The Volga, broad and pale, its surface lit in streaks.
  ctx.fillStyle = vGrad(ctx, S.riverY, bottom, sc.tone(P.water, haze + 0.1), sc.tone(P.waterLight, haze + 0.12));
  ctx.fillRect(-4, S.riverY, w + 8, bottom - S.riverY);
  ctx.strokeStyle = sc.tone(P.waterLight, haze, 0.6);
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 40; i++) {
    const x = rng() * w;
    const len = range(rng, 10, 50);
    const y = range(rng, S.riverY + 3, bottom - 4);
    wrapped(w, x, len, (cx) => line(ctx, cx, y, cx + len, y));
  }
  // Smoke columns from fires along the river front, rising high over everything.
  for (const x of spread(rng, w, S.smokeColumns, 0.8)) {
    const h = range(rng, 0.6, 1) * (S.farBankY - 40);
    const wid = range(rng, 12, 22);
    wrappedSeeded(w, x, wid * 4 + h * 0.4, rng, (cx, q) => fireSmoke(ctx, sc, q, cx, S.riverY + 2, h, wid, haze + 0.08));
  }
};

const mid: LayerPainter = (ctx, sc, rng, box) => {
  const P = sc.pal;
  const { w, bottom, haze } = box;
  const base = S.midBaseY;
  // A low haze of brick dust over the whole district behind the blocks.
  const roll = sineProfile(rng, w, [2, 3, 5, 8], 0.9);
  const back: Profile = (x) => S.skylineY + roll(x) * 6;
  fillBelow(ctx, w, back, bottom, vGrad(ctx, S.skylineY - 10, bottom, sc.tone(P.midAlt, haze + 0.12), sc.tone(P.mid, haze + 0.06)));
  for (let i = 0; i < S.farBlocks; i++) {
    const x = ((i + rng()) / S.farBlocks) * w;
    const bw = range(rng, 18, 34);
    const bh = range(rng, 18, 36);
    wrappedSeeded(w, x, bw, rng, (cx, q) => gutted(ctx, sc, q, cx - bw / 2, back(cx) + 6, bw, bh, haze + 0.12, 3));
  }
  // Chimneys of the factory district and the grain elevator.
  for (let i = 0; i < S.chimneys; i++) {
    const x = ((i + rng()) / S.chimneys) * w;
    const h = S.chimneyHeight * range(rng, 0.7, 1.05);
    wrappedSeeded(w, x, h * 0.1, rng, (cx, q) => chimney(ctx, sc, q, cx, base - 10, h, haze + 0.06));
  }
  const ex = w * S.elevatorAt;
  elevator(ctx, sc, rng, ex, base - 8, S.elevatorHeight, haze + 0.02);
  // The nearer blocks: tall, burnt out.
  for (let i = 0; i < S.midBlocks; i++) {
    const x = ((i + rng()) / S.midBlocks) * w;
    const bw = range(rng, 46, 84);
    const bh = S.midBlockHeight * range(rng, 0.55, 1);
    wrappedSeeded(w, x, bw, rng, (cx, q) => gutted(ctx, sc, q, cx - bw / 2, base + range(q, 0, 4), bw, bh, haze, 5));
  }
  // Smoke rising from one or two of them.
  for (let i = 0; i < 2; i++) {
    const x = rng() * w;
    const h = range(rng, 90, 150);
    wrappedSeeded(w, x, h * 0.5, rng, (cx, q) => fireSmoke(ctx, sc, q, cx, base - 20, h, range(q, 9, 14), haze));
  }
  // Heaps of brick along the street front.
  const lump = noiseProfile(rng, w, 60, 2, 0.5, false);
  const street: Profile = (x) => base + 2 - lump(x) * 6;
  fillBelow(ctx, w, street, bottom, vGrad(ctx, base - 4, bottom, sc.tone(P.mid, haze), sc.tone(P.near, haze + 0.04)), 2);
  if (sc.winter) {
    ctx.fillStyle = sc.tone(P.pale, haze, 0.8);
    for (let i = 0; i < 30; i++) {
      const x = rng() * w;
      const sw = range(rng, 20, 60);
      wrapped(w, x, sw, (cx) => ctx.fillRect(cx - sw / 2, street(cx) - 0.4, sw, 2));
    }
  }
};

const near: LayerPainter = (ctx, sc, rng, box) => {
  const P = sc.pal;
  const { w, bottom, haze } = box;
  const base = S.nearBaseY;
  // The nearest facades: a few tall broken walls standing alone, open to the sky.
  for (const x of spread(rng, w, S.nearRuins, 0.8)) {
    const bw = range(rng, 70, 130);
    const bh = S.nearRuinHeight * range(rng, 0.6, 1);
    wrappedSeeded(w, x, bw, rng, (cx, q) => {
      gutted(ctx, sc, q, cx - bw / 2, base + 4, bw, bh, haze, 4);
      // A girder or two hanging out of a floor.
      ctx.strokeStyle = sc.tone(P.metalShade, haze);
      ctx.lineWidth = 1.6;
      for (let k = 0; k < 2; k++) {
        const gx = cx + range(q, -0.4, 0.4) * bw;
        const gy = base - bh * range(q, 0.3, 0.7);
        line(ctx, gx, gy, gx + range(q, -24, 24), gy + range(q, 6, 20));
      }
    });
  }
  // Shell-stripped trees of a boulevard.
  for (let i = 0; i < S.deadTrees; i++) {
    const x = rng() * w;
    const h = range(rng, 50, 90);
    wrappedSeeded(w, x, h * 0.3, rng, (cx, q) => shatteredTree(ctx, q, cx, base + 2, h, sc.tone(P.trunk, haze)));
  }
  // Rubble heaps and the broken ground in front.
  const lump = noiseProfile(rng, w, 70, 2, 0.5, false);
  const front: Profile = (x) => base - lump(x) * 6;
  fillBelow(ctx, w, front, bottom, vGrad(ctx, base - 6, bottom, sc.tone(P.nearAlt, haze), sc.tone(P.ground, 0.22)), 2);
  for (let i = 0; i < S.rubbleHeaps; i++) {
    const x = rng() * w;
    const hw = range(rng, 30, 70);
    const hh = range(rng, 8, 18);
    wrappedSeeded(w, x, hw, rng, (cx, q) => {
      rubblePile(ctx, q, cx, front(cx) + 3, hw, hh, sc.tone(P.wallAlt, haze), sc.tone(P.stoneShade, haze), sc.light);
      if (sc.winter) {
        ctx.fillStyle = sc.tone(P.pale, haze);
        ctx.beginPath();
        ctx.ellipse(cx, front(cx) + 3 - hh * 0.55, hw * 0.36, clamp(hh * 0.22, 1.5, 4), 0, Math.PI, 0);
        ctx.fill();
      }
    });
  }
};

export const stalingrad: TheatreArt = { far, mid, near };
