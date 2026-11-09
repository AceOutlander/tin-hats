/**
 * Russia in summer (Brest, Dubno) and, as its winter variant, the snows before Moscow (Volokolamsk, Klin):
 *   far:  low forested ridges, a village of log izbas round an onion-domed church; in winter, snow on the ridges and
 *         chimney smoke standing in the cold air
 *   mid:  a birch wood along the crest, strips of rye in front, a pair of izbas behind a fence (a snowfield in winter)
 *   near: clumps of tall birches and a few pines on a bank, telegraph poles along the road; snow-laden firs in winter
 */
import { SCENES } from '../../../data/theatres';
import {
  bush,
  clumps,
  disc,
  fillBelow,
  fillPoly,
  line,
  noiseProfile,
  oval,
  pathBelow,
  pine,
  sineProfile,
  spread,
  vGrad,
  wrapped,
  wrappedSeeded,
  type Ctx,
  type Profile,
  type TreeLook,
} from '../kit';
import { chance, range, type Rng } from '../rng';
import type { LayerPainter, Scene, TheatreArt } from '../scene';

const S = SCENES.russiaSummer;

/** Snow shelves along the tiers of a conifer drawn by kit.pine with the same size (the winter variant). */
export function pineSnow(ctx: Ctx, rng: Rng, x: number, base: number, h: number, wid: number, stem: number, snow: string): void {
  const tiers = 5;
  const crownBase = base - h * stem;
  const top = base - h;
  const span = crownBase - top;
  ctx.fillStyle = snow;
  for (let t = 1; t <= tiers; t++) {
    const f = t / tiers;
    const y = top + span * f - span * 0.06;
    const half = wid * 0.5 * (0.16 + 0.84 * Math.pow(f, 0.85)) * range(rng, 0.7, 0.9);
    fillPoly(ctx, [x - half, y + span * 0.03, x - half * 0.35, y - span * 0.035, x + half * 0.35, y - span * 0.035, x + half, y + span * 0.03], snow);
  }
  // A cap on the very top.
  fillPoly(ctx, [x - wid * 0.07, top + span * 0.1, x, top - 0.5, x + wid * 0.07, top + span * 0.1], snow);
}

/** A thin column of chimney smoke rising and drifting with the wind (puffs widening and fading as they climb). */
export function smokeColumn(ctx: Ctx, rng: Rng, x: number, base: number, h: number, wid: number, color: (a: number) => string, alpha: number, drift: number): void {
  const puffs = Math.max(4, Math.round(h / (wid * 0.9)));
  for (let i = 0; i < puffs; i++) {
    const f = i / (puffs - 1);
    const px = x + drift * h * f * f + range(rng, -0.25, 0.25) * wid;
    const py = base - h * f;
    const r = wid * (0.45 + f * 1.3) * range(rng, 0.85, 1.15);
    ctx.fillStyle = color(alpha * (1 - f * 0.8));
    oval(ctx, px, py, r, r * 0.8);
  }
}

/** Birch: a slim white trunk with dark marks and a drooping crown (bare twigs dusted with snow in winter). */
function birch(ctx: Ctx, sc: Scene, rng: Rng, x: number, base: number, h: number, wid: number, haze: number): void {
  const P = sc.pal;
  const tw = Math.max(0.7, wid * 0.07);
  const lean = range(rng, -0.05, 0.05) * h;
  const bark = sc.tone(P.pale, haze + 0.04);
  const mark = sc.tone(P.trunk, haze);
  fillPoly(ctx, [x - tw, base, x + lean - tw * 0.4, base - h * 0.92, x + lean + tw * 0.4, base - h * 0.92, x + tw, base], bark);
  ctx.fillStyle = mark;
  const marks = Math.max(2, Math.round(h / 9));
  for (let i = 0; i < marks; i++) {
    const f = range(rng, 0.05, 0.7);
    ctx.fillRect(x + lean * f - tw * 0.8, base - h * f, tw * range(rng, 0.8, 1.6), Math.max(0.4, h * 0.012));
  }
  const cx = x + lean;
  const cy = base - h * 0.66;
  if (sc.winter) {
    // Bare crown: a fan of fine twigs, a little snow along the upper ones.
    ctx.strokeStyle = sc.tone(P.trunk, haze + 0.12, 0.7);
    ctx.lineWidth = Math.max(0.35, tw * 0.45);
    ctx.lineCap = 'round';
    const twigs = 9;
    for (let i = 0; i < twigs; i++) {
      const a = -Math.PI / 2 + range(rng, -1.1, 1.1);
      const len = h * range(rng, 0.2, 0.36);
      const sy = base - h * range(rng, 0.45, 0.85);
      line(ctx, cx, sy, cx + Math.cos(a) * len, sy + Math.sin(a) * len * 0.9);
    }
    ctx.fillStyle = sc.tone(P.pale, haze, 0.55);
    for (let i = 0; i < 4; i++) oval(ctx, cx + range(rng, -0.25, 0.25) * wid, cy - h * range(rng, 0, 0.2), wid * 0.18, h * 0.025);
    return;
  }
  const rx = wid / 2;
  const ry = h * 0.3;
  ctx.fillStyle = sc.tone(P.foliageShade, haze);
  for (let i = 0; i < 6; i++) oval(ctx, cx + range(rng, -0.55, 0.55) * rx, cy + range(rng, -0.6, 0.7) * ry, rx * range(rng, 0.45, 0.65), ry * range(rng, 0.45, 0.65));
  ctx.fillStyle = sc.tone(P.foliage, haze);
  for (let i = 0; i < 6; i++) {
    oval(ctx, cx + sc.light * rx * 0.15 + range(rng, -0.5, 0.5) * rx, cy - ry * 0.12 + range(rng, -0.6, 0.6) * ry, rx * range(rng, 0.3, 0.5), ry * range(rng, 0.3, 0.5));
  }
}

/** A log izba: x = left edge. Steep gable roof, carved window frames in the trim colour, a chimney (smoking in winter). */
function izba(ctx: Ctx, sc: Scene, rng: Rng, x: number, base: number, w: number, h: number, haze: number): void {
  const P = sc.pal;
  const top = base - h;
  const roofH = h * 0.85;
  ctx.fillStyle = sc.tone(P.wall, haze);
  ctx.fillRect(x, top, w, h);
  // The logs: fine dark lines and the crossed log ends at the corners.
  ctx.fillStyle = sc.tone(P.wallShade, haze);
  const logs = Math.max(3, Math.round(h / 1.6));
  for (let i = 1; i < logs; i++) ctx.fillRect(x, top + (h * i) / logs, w, Math.max(0.3, h * 0.035));
  ctx.fillRect(x - 0.6, top, 1.2, h);
  ctx.fillRect(x + w - 0.6, top, 1.2, h);
  // Roof over the gable end, a long side under it.
  const roof = sc.tone(P.roof, haze);
  fillPoly(ctx, [x - w * 0.1, top + 0.4, x + w / 2, top - roofH, x + w * 1.1, top + 0.4], roof);
  fillPoly(ctx, [x + w / 2, top - roofH, x + w * 1.1, top + 0.4, x + w * 1.1 - w * 0.1, top + 0.4], sc.tone(P.roofShade, haze));
  // A small window in the gable and two framed windows below.
  ctx.fillStyle = sc.tone(P.opening, haze + 0.08);
  ctx.fillRect(x + w / 2 - w * 0.06, top - roofH * 0.45, w * 0.12, roofH * 0.2);
  const trim = sc.tone(P.trim, haze);
  for (const f of [0.3, 0.7]) {
    const wx = x + w * f;
    ctx.fillStyle = trim;
    ctx.fillRect(wx - w * 0.11, top + h * 0.22, w * 0.22, h * 0.5);
    ctx.fillStyle = sc.tone(P.opening, haze + 0.08);
    ctx.fillRect(wx - w * 0.07, top + h * 0.3, w * 0.14, h * 0.34);
  }
  const chimneyX = x + w * range(rng, 0.6, 0.72);
  ctx.fillStyle = sc.tone(P.stoneShade, haze);
  ctx.fillRect(chimneyX, top - roofH * 0.7, Math.max(1, w * 0.07), roofH * 0.5);
  if (sc.winter) smokeColumn(ctx, rng, chimneyX + w * 0.035, top - roofH * 0.72, h * 5, Math.max(1.6, w * 0.09), sc.hazeCss, 0.35, 0.15);
}

/** The village church: a white body, a drum, an onion dome with its cross; a bell tower with a smaller dome. */
function church(ctx: Ctx, sc: Scene, x: number, base: number, haze: number): void {
  const P = sc.pal;
  const wall = sc.tone(P.pale, haze);
  const shade = sc.tone(P.stone, haze);
  const dome = sc.tone(P.roofAlt, haze - 0.04);
  ctx.fillStyle = wall;
  ctx.fillRect(x - 14, base - 16, 28, 16);
  ctx.fillStyle = shade;
  ctx.fillRect(x + (sc.light < 0 ? 8 : -14), base - 16, 6, 16);
  fillPoly(ctx, [x - 15, base - 16, x, base - 22, x + 15, base - 16], sc.tone(P.roof, haze));
  // Drum and dome.
  ctx.fillStyle = wall;
  ctx.fillRect(x - 4.5, base - 30, 9, 9);
  onion(ctx, x, base - 30, 7, S.domeHeight * 0.45, dome);
  cross(ctx, x, base - 30 - S.domeHeight * 0.45, sc.tone(P.metalShade, haze));
  // Bell tower to one side.
  const tx = x + 22;
  ctx.fillStyle = wall;
  ctx.fillRect(tx - 3.5, base - 34, 7, 34);
  ctx.fillStyle = sc.tone(P.opening, haze + 0.08);
  ctx.fillRect(tx - 1.6, base - 31, 3.2, 4);
  onion(ctx, tx, base - 34, 4.5, S.domeHeight * 0.32, dome);
  cross(ctx, tx, base - 34 - S.domeHeight * 0.32, sc.tone(P.metalShade, haze));
}

/** An onion dome standing on y = base, `r` its widest half-width. */
function onion(ctx: Ctx, x: number, base: number, r: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.7, base);
  ctx.bezierCurveTo(x - r * 1.35, base - h * 0.35, x - r * 0.6, base - h * 0.7, x, base - h);
  ctx.bezierCurveTo(x + r * 0.6, base - h * 0.7, x + r * 1.35, base - h * 0.35, x + r * 0.7, base);
  ctx.closePath();
  ctx.fill();
}

/** A thin cross on a dome. */
function cross(ctx: Ctx, x: number, base: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x - 0.35, base - 6, 0.7, 6);
  ctx.fillRect(x - 1.6, base - 4.6, 3.2, 0.6);
}

const far: LayerPainter = (ctx, sc, rng, box) => {
  const P = sc.pal;
  const { w, bottom, haze } = box;
  const snow = sc.tone(P.pale, haze + 0.12);

  // Two ridges of forest, the farther one paler.
  const r1 = sineProfile(rng, w, [1, 2, 3, 5], 0.9);
  const y1: Profile = (x) => S.farRidgeY - 20 + r1(x) * S.farRidgeAmp;
  fillBelow(ctx, w, y1, bottom, vGrad(ctx, S.farRidgeY - 40, bottom, sc.tone(P.far, haze + 0.2), sc.tone(P.far, haze + 0.3)));
  clumps(ctx, rng, w, y1, 120, 1.6, 3.6, sc.tone(P.foliageAltShade, haze + 0.24), 1.2);
  const r2 = sineProfile(rng, w, [1, 2, 4, 7], 0.8);
  const y2: Profile = (x) => S.farRidgeY + 8 + r2(x) * S.farRidgeAmp * 0.6;
  fillBelow(ctx, w, y2, bottom, vGrad(ctx, S.farRidgeY, bottom, sc.tone(P.farAlt, haze + 0.02), sc.tone(P.farAlt, haze + 0.14)));
  clumps(ctx, rng, w, y2, 130, 2, 4.4, sc.tone(P.foliageAltShade, haze + 0.08), 1.6);
  if (sc.winter) {
    // Snow lying on the open slopes between the woods.
    ctx.save();
    pathBelow(ctx, w, y2, bottom);
    ctx.clip();
    for (let i = 0; i < 24; i++) {
      const cx = rng() * w;
      const fw = range(rng, 40, 120);
      const dy = range(rng, 6, 20);
      const fh = range(rng, 3, 7);
      wrapped(w, cx, fw, (x) => {
        ctx.fillStyle = sc.tone(P.pale, haze + 0.08, 0.7);
        oval(ctx, x, y2(x) + dy, fw / 2, fh);
      });
    }
    ctx.restore();
  }

  // The village round its church; smoke stands over it in winter.
  const vx = w * S.churchAt;
  church(ctx, sc, vx, y2(vx) + 3, haze - 0.1);
  for (let i = 0; i < S.villageHouses; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const hx = vx + side * (34 + (i >> 1) * range(rng, 12, 16));
    const hw = range(rng, 8, 11);
    izba(ctx, sc, rng, hx - hw / 2, y2(hx) + 3, hw, range(rng, 5, 6.5), haze - 0.06);
  }
  if (sc.winter) for (let i = 0; i < 3; i++) clumps(ctx, rng, w, y2, 4, 1, 2, snow, 0);
};

const mid: LayerPainter = (ctx, sc, rng, box) => {
  const P = sc.pal;
  const { w, bottom, haze } = box;
  const r = sineProfile(rng, w, [1, 2, 3, 5, 8], 0.9);
  const crest: Profile = (x) => S.midWoodY + r(x) * S.midWoodAmp;

  // The wood's dark interior behind the birch stems.
  const roll = noiseProfile(rng, w, 50, 2, 0.5, false);
  const canopy: Profile = (x) => crest(x) - 26 - roll(x) * 12;
  fillBelow(ctx, w, canopy, bottom, vGrad(ctx, S.midWoodY - 40, S.midWoodY, sc.tone(P.foliageAltShade, haze + 0.04), sc.tone(P.foliageShade, haze)));
  clumps(ctx, rng, w, canopy, 140, 3, 6, sc.tone(sc.winter ? P.foliageAlt : P.foliage, haze + 0.02), 2);

  // Birches in front of it.
  for (let i = 0; i < S.birches; i++) {
    const x = ((i + rng()) / S.birches) * w;
    const h = S.birchHeight * range(rng, 0.75, 1.15);
    wrappedSeeded(w, x, h * 0.3, rng, (cx, q) => birch(ctx, sc, q, cx, crest(cx) + 4, h, h * range(q, 0.4, 0.55), haze));
  }

  // The field in front: strips of rye, or an even snowfield.
  fillBelow(ctx, w, crest, bottom, vGrad(ctx, S.midWoodY, bottom, sc.tone(P.mid, haze), sc.tone(P.mid, haze + 0.08)), 2);
  if (!sc.winter) {
    ctx.save();
    pathBelow(ctx, w, crest, bottom);
    ctx.clip();
    const bounds = spread(rng, w, 11, 0.5).sort((a, b) => a - b);
    for (let i = 0; i < bounds.length; i += 2) {
      const xa = bounds[i];
      const xb = i + 1 < bounds.length ? bounds[i + 1] : bounds[0] + w;
      const sa = range(rng, -18, 18);
      for (const o of [-w, 0, w]) fillPoly(ctx, [xa + o, S.midWoodY - 20, xb + o, S.midWoodY - 20, xb + sa + o, bottom, xa + sa + o, bottom], sc.tone(P.midAlt, haze, 0.75));
    }
    ctx.restore();
  } else {
    ctx.strokeStyle = sc.tone(P.midAlt, haze, 0.8);
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const x0 = rng() * w;
      const len = range(rng, 60, 160);
      const d0 = range(rng, 4, 14);
      const d1 = range(rng, 4, 14);
      wrapped(w, x0, len, (cx) => line(ctx, cx, crest(cx) + d0, cx + len, crest(cx + len) + d1));
    }
  }

  // Two izbas behind a fence.
  const ix = w * S.izbaAt;
  izba(ctx, sc, rng, ix, crest(ix) + 6, 30, 15, haze - 0.06);
  izba(ctx, sc, rng, ix + 44, crest(ix + 44) + 7, 26, 13, haze - 0.04);
  ctx.strokeStyle = sc.tone(P.trunk, haze);
  ctx.lineWidth = 0.8;
  const fy = crest(ix) + 9;
  for (let k = 0; k < 18; k++) line(ctx, ix - 12 + k * 5, fy, ix - 12 + k * 5, fy - 4.5);
  line(ctx, ix - 12, fy - 3.2, ix + 74, fy - 3.2);
};

const near: LayerPainter = (ctx, sc, rng, box) => {
  const P = sc.pal;
  const { w, bottom, haze } = box;
  const firs: TreeLook = { lit: sc.tone(P.foliageAlt, haze), shade: sc.tone(P.foliageAltShade, haze), trunk: sc.tone(P.trunk, haze) };
  const snow = sc.tone(P.pale, haze);
  const lump = noiseProfile(rng, w, 90, 2, 0.5, false);
  const bank: Profile = (x) => S.nearBankY + 2 - lump(x) * 5;

  // Tall pines (or firs heavy with snow), then the birch clumps.
  for (const px of spread(rng, w, S.pines, 0.8)) {
    const h = S.pineHeight * range(rng, 0.8, 1.1);
    const wid = h * (sc.winter ? 0.42 : 0.32);
    wrappedSeeded(w, px, wid, rng, (cx, q) => {
      pine(ctx, q, cx, S.nearBankY + 4, h, wid, firs, sc.light, sc.winter ? 0.12 : 0.34);
      if (sc.winter) pineSnow(ctx, q, cx, S.nearBankY + 4, h, wid, 0.12, snow);
    });
  }
  for (const cx of spread(rng, w, S.birchClumps, 0.8)) {
    const n = 3 + Math.floor(rng() * 3);
    for (let k = 0; k < n; k++) {
      const x = cx + (k - (n - 1) / 2) * range(rng, 14, 22);
      const h = S.nearBirchHeight * range(rng, 0.7, 1.1);
      wrappedSeeded(w, x, h * 0.3, rng, (bx, q) => birch(ctx, sc, q, bx, S.nearBankY + range(q, 2, 6), h, h * range(q, 0.36, 0.5), haze));
    }
  }

  // The bank with its undergrowth (or drifts).
  fillBelow(ctx, w, bank, bottom, vGrad(ctx, S.nearBankY - 4, bottom, sc.tone(P.nearAlt, haze), sc.tone(P.ground, 0.22)), 2);
  for (let i = 0; i < 44; i++) {
    const x = rng() * w;
    const bw = range(rng, 9, 20);
    wrappedSeeded(w, x, bw, rng, (cx, q) => {
      if (sc.winter) {
        ctx.fillStyle = chance(q, 0.5) ? snow : sc.tone(P.nearAlt, haze);
        oval(ctx, cx, bank(cx) + 2, bw * 0.6, range(q, 2, 3.5));
      } else {
        bush(ctx, q, cx, bank(cx) + 3, bw, range(q, 3.5, 6), sc.tone(P.foliage, haze), sc.tone(P.foliageShade, haze), sc.light);
      }
    });
  }

  // Telegraph poles along the road, the wires sagging between them.
  const n = S.telegraphPoles;
  const pitch = w / n;
  const footY = S.nearBankY + 5;
  const topY = footY - S.poleHeight;
  ctx.strokeStyle = sc.tone(P.metal, haze + 0.12, 0.8);
  ctx.lineWidth = 0.6;
  for (let i = -1; i < n; i++) {
    const xa = pitch * (i + 0.5);
    const xb = xa + pitch;
    for (const dy of [4, 9]) {
      ctx.beginPath();
      ctx.moveTo(xa, topY + dy);
      ctx.quadraticCurveTo((xa + xb) / 2, topY + dy + 14, xb, topY + dy);
      ctx.stroke();
    }
  }
  const poleColor = sc.tone(P.trunk, haze + 0.04);
  for (let i = 0; i < n; i++) {
    const px = pitch * (i + 0.5);
    fillPoly(ctx, [px - 1.4, footY, px - 0.9, topY, px + 0.9, topY, px + 1.4, footY], poleColor);
    ctx.fillStyle = poleColor;
    ctx.fillRect(px - 6, topY + 3, 12, 1.5);
    // A slanting stay, as on the Russian lines.
    ctx.strokeStyle = poleColor;
    ctx.lineWidth = 1;
    line(ctx, px, topY + 26, px + 9, footY);
    if (sc.winter) {
      ctx.fillStyle = snow;
      ctx.fillRect(px - 6, topY + 2.3, 12, 0.8);
      disc(ctx, px, topY - 0.3, 1.1);
    }
  }
};

export const russiaSummer: TheatreArt = { far, mid, near };
