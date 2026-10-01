/**
 * Holland: a Dutch town.
 *   far:  a hazy skyline of gabled roofs with a church tower, over flat polder
 *   mid:  a steel arch bridge on embankments over a river, a windmill on the dike
 *   near: gabled brick houses on a canal quay, plane trees, barges
 */
import { SCENES } from '../../../data/theatres';
import {
  clumps,
  disc,
  fillBelow,
  fillPoly,
  house,
  lerp,
  line,
  oval,
  roundTree,
  sineProfile,
  smoothstep,
  spindle,
  strokeAlong,
  vGrad,
  wrapped,
  wrappedSeeded,
  type Ctx,
  type HouseLook,
  type Profile,
  type TreeLook,
} from '../kit';
import { chance, range, rangeInt, type Rng } from '../rng';
import type { LayerPainter, Scene, TheatreArt } from '../scene';

const S = SCENES.holland;

type GableKind = 'step' | 'bell' | 'neck' | 'tri';
const GABLES: readonly GableKind[] = ['step', 'bell', 'neck', 'tri'];

/** Outline of the gable above a facade whose top edge is at `top`, from x to x + w. */
function gablePath(ctx: Ctx, kind: GableKind, x: number, top: number, w: number, gh: number): void {
  const cx = x + w / 2;
  ctx.beginPath();
  ctx.moveTo(x, top + 0.4);
  if (kind === 'tri') {
    ctx.lineTo(cx, top - gh);
  } else if (kind === 'step') {
    const n = 3;
    const dx = (w * 0.5 - w * 0.09) / n;
    const dy = gh / n;
    for (let i = 0; i < n; i++) {
      ctx.lineTo(x + i * dx, top - (i + 1) * dy);
      ctx.lineTo(x + (i + 1) * dx, top - (i + 1) * dy);
    }
    for (let i = n - 1; i >= 0; i--) {
      ctx.lineTo(x + w - (i + 1) * dx, top - (i + 1) * dy);
      ctx.lineTo(x + w - i * dx, top - (i + 1) * dy);
    }
  } else if (kind === 'bell') {
    ctx.bezierCurveTo(x, top - gh * 0.5, x + w * 0.3, top - gh * 0.35, x + w * 0.3, top - gh * 0.7);
    ctx.bezierCurveTo(x + w * 0.3, top - gh * 0.95, cx - w * 0.1, top - gh * 0.8, cx, top - gh);
    ctx.bezierCurveTo(cx + w * 0.1, top - gh * 0.8, x + w * 0.7, top - gh * 0.95, x + w * 0.7, top - gh * 0.7);
    ctx.bezierCurveTo(x + w * 0.7, top - gh * 0.35, x + w, top - gh * 0.5, x + w, top + 0.4);
  } else {
    ctx.lineTo(x, top - gh * 0.2);
    ctx.quadraticCurveTo(x + w * 0.24, top - gh * 0.22, x + w * 0.28, top - gh * 0.46);
    ctx.lineTo(x + w * 0.28, top - gh * 0.8);
    ctx.lineTo(cx, top - gh);
    ctx.lineTo(x + w * 0.72, top - gh * 0.8);
    ctx.lineTo(x + w * 0.72, top - gh * 0.46);
    ctx.quadraticCurveTo(x + w * 0.76, top - gh * 0.22, x + w, top - gh * 0.2);
  }
  ctx.lineTo(x + w, top + 0.4);
  ctx.closePath();
}

// ---------------------------------------------------------------- far

function houseLook(sc: Scene, haze: number): HouseLook {
  const P = sc.pal;
  return {
    wall: sc.tone(P.wall, haze),
    wallShade: sc.tone(P.wallShade, haze),
    roof: sc.tone(P.roof, haze),
    roofShade: sc.tone(P.roofShade, haze),
    opening: sc.tone(P.opening, haze + 0.1),
  };
}

/** Church tower with a lantern, onion and needle spire. `base` = foot, total height `H`. */
function tower(ctx: Ctx, sc: Scene, x: number, base: number, H: number, haze: number): void {
  const P = sc.pal;
  const wall = sc.tone(P.wallAlt, haze);
  const shade = sc.tone(P.wallShade, haze);
  const dark = sc.tone(P.roofShade, haze);
  const tw = H * 0.15;
  const shaft = H * 0.6;
  ctx.fillStyle = wall;
  ctx.fillRect(x - tw / 2, base - shaft, tw, shaft);
  ctx.fillStyle = shade;
  ctx.fillRect(sc.light < 0 ? x + tw / 2 - tw * 0.3 : x - tw / 2, base - shaft, tw * 0.3, shaft);
  // Louvred belfry opening and a clock face (a plain disc, no marks).
  ctx.fillStyle = sc.tone(P.opening, haze);
  ctx.fillRect(x - tw * 0.2, base - shaft * 0.5, tw * 0.4, shaft * 0.2);
  ctx.fillStyle = sc.tone(P.trim, haze);
  disc(ctx, x, base - shaft * 0.8, tw * 0.22);
  // Cornice, lantern, onion and needle.
  ctx.fillStyle = dark;
  ctx.fillRect(x - tw * 0.62, base - shaft - 1.5, tw * 1.24, 2);
  ctx.fillRect(x - tw * 0.36, base - shaft - H * 0.12, tw * 0.72, H * 0.12);
  ctx.beginPath();
  ctx.moveTo(x - tw * 0.4, base - shaft - H * 0.12);
  ctx.bezierCurveTo(x - tw * 0.8, base - shaft - H * 0.2, x - tw * 0.5, base - shaft - H * 0.25, x, base - shaft - H * 0.27);
  ctx.bezierCurveTo(x + tw * 0.5, base - shaft - H * 0.25, x + tw * 0.8, base - shaft - H * 0.2, x + tw * 0.4, base - shaft - H * 0.12);
  ctx.fill();
  fillPoly(ctx, [x - tw * 0.1, base - shaft - H * 0.25, x, base - H, x + tw * 0.1, base - shaft - H * 0.25], dark);
}

const far: LayerPainter = (ctx, sc, rng, box) => {
  const P = sc.pal;
  const { w, bottom, haze } = box;
  const base = S.skylineY;

  // Roofs in three clusters: pitched gable ends, stepped gables and flat parapets.
  const wallTones = [sc.tone(P.wall, haze), sc.tone(P.wallAlt, haze), sc.tone(P.roofAlt, haze)];
  const roofTones = [sc.tone(P.roof, haze), sc.tone(P.roofAlt, haze)];
  const clusters = [w * 0.22, w * 0.6, w * 0.9];
  const perCluster = Math.round(S.farRoofs / clusters.length);
  for (const c of clusters) {
    let x = c - (perCluster * 18) / 2;
    for (let i = 0; i < perCluster; i++) {
      const bw = range(rng, 12, 24);
      const bh = range(rng, 9, 24) * (1 - Math.abs(i / perCluster - 0.5) * 0.7);
      const wall = wallTones[rangeInt(rng, 0, wallTones.length - 1)];
      const kind = GABLES[rangeInt(rng, 0, GABLES.length - 1)];
      const roofed = chance(rng, 0.45);
      const rt = roofTones[rangeInt(rng, 0, roofTones.length - 1)];
      wrapped(w, x + bw / 2, bw, (cx) => {
        const left = cx - bw / 2;
        ctx.fillStyle = wall;
        ctx.fillRect(left, base - bh, bw, bh + 4);
        if (roofed) {
          fillPoly(ctx, [left - 1.2, base - bh + 0.5, cx, base - bh - bw * 0.42, left + bw + 1.2, base - bh + 0.5], rt);
        } else {
          gablePath(ctx, kind, left, base - bh, bw, bw * 0.55);
          ctx.fillStyle = wall;
          ctx.fill();
        }
        ctx.fillStyle = sc.tone(P.opening, haze + 0.1);
        ctx.fillRect(left + bw * 0.3, base - bh * 0.7, bw * 0.14, bh * 0.2);
        ctx.fillRect(left + bw * 0.56, base - bh * 0.7, bw * 0.14, bh * 0.2);
      });
      x += bw * range(rng, 0.9, 1.08);
    }
  }

  // Church: a long nave and the tower.
  const tx = w * 0.4;
  const nave = houseLook(sc, haze);
  wrapped(w, tx, 60, (cx) => {
    house(ctx, cx + 8, base + 3, 46, 20, 12, { ...nave, wall: sc.tone(P.wallAlt, haze), roof: sc.tone(P.roofShade, haze) }, false, 0);
    tower(ctx, sc, cx, base + 3, S.towerHeight, haze);
  });
  // A second, shorter spire at the far end of town.
  wrapped(w, w * 0.78, 30, (cx) => tower(ctx, sc, cx, base + 3, S.towerHeight * 0.62, haze + 0.04));

  // Polder: flat land with ditches and a tree line.
  const flat = sineProfile(rng, w, [2, 5, 9], 0.8);
  const land: Profile = (x) => base + 4 + flat(x) * 1.3;
  fillBelow(ctx, w, land, bottom, vGrad(ctx, base, bottom, sc.tone(P.far, haze + 0.04), sc.tone(P.farAlt, haze + 0.16)));
  ctx.strokeStyle = sc.tone(P.water, haze + 0.06, 0.5);
  ctx.lineWidth = 1.2;
  strokeAlong(ctx, w, land, 12, 4);
  strokeAlong(ctx, w, land, 26, 4);
  clumps(ctx, rng, w, land, 90, 2, 4.5, sc.tone(P.foliageShade, haze + 0.04), 1.5);

  // A far windmill on the skyline.
  wrapped(w, w * 0.04, 24, (cx) => windmill(ctx, sc, cx, base + 3, 30, haze + 0.02, 0.5));
};

// ---------------------------------------------------------------- mid

/** Tower mill: tapered brick tower, gallery, rounded cap and four lattice sails at `angle`. */
function windmill(ctx: Ctx, sc: Scene, x: number, base: number, H: number, haze: number, angle: number): void {
  const P = sc.pal;
  const body = sc.tone(P.wallAlt, haze);
  const shade = sc.tone(P.wallShade, haze);
  const wood = sc.tone(P.trunk, haze);
  const bw0 = H * 0.4;
  const bw1 = H * 0.24;
  const bh = H * 0.78;
  fillPoly(ctx, [x - bw0 / 2, base, x - bw1 / 2, base - bh, x + bw1 / 2, base - bh, x + bw0 / 2, base], body);
  fillPoly(ctx, [x + (sc.light < 0 ? 0 : -bw0 / 2), base, x + (sc.light < 0 ? 0 : -bw1 / 2), base - bh, x + (sc.light < 0 ? bw1 / 2 : 0), base - bh, x + (sc.light < 0 ? bw0 / 2 : 0), base], shade);
  ctx.fillStyle = wood;
  ctx.fillRect(x - bw0 * 0.62, base - bh * 0.34, bw0 * 1.24, 1.4);
  ctx.fillStyle = sc.tone(P.opening, haze);
  ctx.fillRect(x - 1.1, base - bh * 0.22, 2.2, bh * 0.2);
  ctx.fillStyle = sc.tone(P.roofShade, haze);
  ctx.beginPath();
  ctx.ellipse(x, base - bh, bw1 * 0.62, H * 0.1, 0, Math.PI, 0);
  ctx.fill();
  const ax = x;
  const ay = base - bh - H * 0.03;
  const L = H * 0.62;
  ctx.lineCap = 'butt';
  for (let k = 0; k < 4; k++) {
    const a = angle + (k * Math.PI) / 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const px = -sa;
    const py = ca;
    ctx.strokeStyle = wood;
    ctx.lineWidth = Math.max(0.7, H * 0.022);
    line(ctx, ax - ca * L * 0.06, ay - sa * L * 0.06, ax + ca * L, ay + sa * L);
    // Lattice panel on one side of the stock.
    const w0 = L * 0.18;
    const s0 = L * 0.2;
    const s1 = L * 0.96;
    fillPoly(ctx, [ax + ca * s0, ay + sa * s0, ax + ca * s1, ay + sa * s1, ax + ca * s1 + px * w0, ay + sa * s1 + py * w0, ax + ca * s0 + px * w0, ay + sa * s0 + py * w0], sc.tone(P.pale, haze, 0.55));
    ctx.strokeStyle = wood;
    ctx.lineWidth = 0.4;
    for (let r = 0; r < 6; r++) {
      const s = lerp(s0, s1, r / 5);
      line(ctx, ax + ca * s, ay + sa * s, ax + ca * s + px * w0, ay + sa * s + py * w0);
    }
  }
  ctx.fillStyle = wood;
  disc(ctx, ax, ay, Math.max(1, H * 0.035));
}

/** Through-arch steel bridge. Deck at `deckY` from x0 to x1, arch rising `rise` above it. */
function archBridge(ctx: Ctx, sc: Scene, x0: number, x1: number, deckY: number, rise: number, waterY: number, haze: number): void {
  const P = sc.pal;
  const span = x1 - x0;
  const steel = sc.tone(P.metal, haze);
  const steelShade = sc.tone(P.metalShade, haze);
  const stone = sc.tone(P.stone, haze);
  const stoneShade = sc.tone(P.stoneShade, haze);
  const arch = (x: number): number => {
    const u = (x - x0) / span;
    return deckY - rise * 4 * u * (1 - u);
  };

  // Piers in the water: the two abutments and two intermediate piers.
  for (const u of [0, 0.34, 0.66, 1]) {
    const px = x0 + span * u;
    const pw = u === 0 || u === 1 ? 7 : 9;
    ctx.fillStyle = stone;
    ctx.fillRect(px - pw / 2, deckY + 6, pw, waterY - deckY - 2);
    ctx.fillStyle = stoneShade;
    ctx.fillRect(sc.light < 0 ? px + pw / 2 - 2.6 : px - pw / 2, deckY + 6, 2.6, waterY - deckY - 2);
    ctx.fillStyle = steelShade;
    ctx.fillRect(px - pw / 2 - 1, deckY + 5, pw + 2, 1.6);
  }
  // Deck girder with a lattice web.
  ctx.fillStyle = steel;
  ctx.fillRect(x0 - 3, deckY - 1, span + 6, 3.2);
  ctx.fillRect(x0 - 3, deckY + 4, span + 6, 1.6);
  ctx.strokeStyle = steelShade;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  for (let x = x0; x < x1; x += 9) {
    ctx.moveTo(x, deckY + 2);
    ctx.lineTo(x + 4.5, deckY + 5);
    ctx.lineTo(x + 9, deckY + 2);
  }
  ctx.stroke();
  // Hangers and the zigzag between the two arch chords.
  ctx.strokeStyle = steel;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  for (let x = x0 + 14; x < x1 - 8; x += 22) {
    ctx.moveTo(x, arch(x) + 3);
    ctx.lineTo(x, deckY - 1);
  }
  ctx.stroke();
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  for (let x = x0 + 4; x < x1 - 8; x += 11) {
    ctx.moveTo(x, arch(x) + 4.5);
    ctx.lineTo(x + 5.5, arch(x + 5.5));
    ctx.lineTo(x + 11, arch(x + 11) + 4.5);
  }
  ctx.stroke();
  // The arch itself: a heavy top chord and a lighter inner chord.
  for (const [dy, lw, color] of [
    [0, 3.2, steelShade],
    [4.6, 1.6, steel],
  ] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, deckY);
    for (let x = x0 + 4; x < x1; x += 4) {
      const u = (x - x0) / span;
      // The inner chord closes onto the outer one at both ends.
      ctx.lineTo(x, arch(x) + dy * Math.min(1, u * (1 - u) * 10));
    }
    ctx.lineTo(x1, deckY);
    ctx.stroke();
  }
}

const mid: LayerPainter = (ctx, sc, rng, box) => {
  const P = sc.pal;
  const { w, bottom, haze } = box;
  const gx0 = Math.round(w * 0.42);
  const gx1 = gx0 + S.bridgeSpan;
  const deckY = S.bridgeDeckY;
  const waterY = S.riverY;
  const rampLen = 120;
  const dikeY = S.skylineY + 8;
  const undulate = sineProfile(rng, w, [3, 7, 12], 0.8);
  // Dike land that rises on embankments to the bridge deck.
  const ground: Profile = (x) => {
    const d = x < gx0 ? gx0 - x : x > gx1 ? x - gx1 : 0;
    const t = x >= gx0 && x <= gx1 ? 1 : 1 - smoothstep(d / rampLen);
    return lerp(dikeY + undulate(x) * 2, deckY + 3, t);
  };

  // River water under the span; the earth is clipped away from it.
  ctx.fillStyle = vGrad(ctx, waterY, bottom, sc.tone(P.waterLight, haze), sc.tone(P.water, haze));
  ctx.fillRect(gx0, waterY, S.bridgeSpan, bottom - waterY);
  for (let i = 0; i < 70; i++) {
    const x = range(rng, gx0 + 4, gx1 - 30);
    const y = waterY + 2 + rng() * (bottom - waterY - 4);
    const len = range(rng, 8, 30);
    ctx.fillStyle = chance(rng, 0.5) ? sc.tone(P.pale, haze, 0.4) : sc.tone(P.water, haze - 0.1, 0.35);
    oval(ctx, x, y, len / 2, 0.8);
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(-8, 0, gx0 + 8, bottom);
  ctx.rect(gx1, 0, w + 8 - gx1, bottom);
  ctx.clip();
  fillBelow(ctx, w, ground, bottom, vGrad(ctx, dikeY - 8, bottom, sc.tone(P.mid, haze), sc.tone(P.midAlt, haze + 0.06)), 2);
  ctx.strokeStyle = sc.tone(P.foliage, haze, 0.9);
  ctx.lineWidth = 2.4;
  strokeAlong(ctx, w, ground, 1.4, 3);
  // Polder strips and ditches on the flat land.
  ctx.strokeStyle = sc.tone(P.water, haze, 0.55);
  ctx.lineWidth = 1.1;
  strokeAlong(ctx, w, (x) => dikeY + undulate(x) * 2, 14, 4);
  strokeAlong(ctx, w, (x) => dikeY + undulate(x) * 2, 25, 4);
  ctx.restore();
  // Quay walls where the embankments meet the water.
  ctx.fillStyle = sc.tone(P.stone, haze);
  ctx.fillRect(gx0 - 6, deckY + 3, 6, waterY - deckY);
  ctx.fillRect(gx1, deckY + 3, 6, waterY - deckY);

  archBridge(ctx, sc, gx0, gx1, deckY, S.bridgeRise, waterY, haze);

  // Pier reflections.
  ctx.fillStyle = sc.tone(P.metalShade, haze, 0.28);
  for (const u of [0.34, 0.66]) ctx.fillRect(gx0 + S.bridgeSpan * u - 4, waterY + 3, 8, 12);

  // Windmill on the dike beside the bridge, and a few trees.
  const wx = gx1 + 200;
  windmill(ctx, sc, wx, ground(wx) + 3, S.windmillHeight, haze, 0.35);
  const poplars: TreeLook = { lit: sc.tone(P.foliageAlt, haze), shade: sc.tone(P.foliageAltShade, haze), trunk: sc.tone(P.trunk, haze) };
  const keepOut = (x: number): boolean => x > gx0 - rampLen - 20 && x < gx1 + rampLen + 20;
  for (let i = 0; i < S.trees * 2; i++) {
    const tx = range(rng, 60, w - 60);
    if (keepOut(tx) || Math.abs(tx - wx) < 70) continue;
    spindle(ctx, tx, ground(tx) + 2, range(rng, 30, 42), 8, poplars, sc.light, 0.16);
  }

  // Two small clusters of houses on the dike.
  const look = houseLook(sc, haze - 0.04);
  for (const cx of [gx0 - 360, gx1 + 380]) {
    let x = cx - 40;
    for (let i = 0; i < 5; i++) {
      const hw = range(rng, 12, 19);
      const hh = range(rng, 9, 15);
      house(ctx, x, ground(x) + 3, hw, hh, range(rng, 5, 8), look, chance(rng, 0.6), 2);
      x += hw + range(rng, 1, 5);
    }
  }
};

// ---------------------------------------------------------------- near

/** One narrow brick canal house seen gable-on. `x` = left edge, `base` = quay level. */
function facade(ctx: Ctx, sc: Scene, rng: Rng, x: number, base: number, w: number, h: number, kind: GableKind, wall: string, wallShade: string, haze: number): void {
  const P = sc.pal;
  const top = base - h;
  const gh = w * range(rng, 0.55, 0.85);
  const trim = sc.tone(P.trim, haze);
  const opening = sc.tone(P.opening, haze);
  ctx.fillStyle = wall;
  ctx.fillRect(x, top, w, h);
  gablePath(ctx, kind, x, top, w, gh);
  ctx.fillStyle = wall;
  ctx.fill();
  // The side away from the light is in shade.
  ctx.fillStyle = wallShade;
  ctx.fillRect(sc.light < 0 ? x + w - 2.2 : x, top, 2.2, h);
  // Pale coping along the gable and a cornice line.
  gablePath(ctx, kind, x, top, w, gh);
  ctx.strokeStyle = trim;
  ctx.lineWidth = 0.9;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.fillStyle = trim;
  ctx.fillRect(x, top - 0.4, w, 1);
  // Windows on three floors, framed in white, and a door.
  const cols = Math.max(2, Math.round(w / 7.5));
  const ww = w / (cols * 2.3);
  const wh = h * 0.15;
  for (let f = 0; f < 3; f++) {
    const wy = top + h * (0.1 + f * 0.26);
    for (let c = 0; c < cols; c++) {
      const wx = x + (w * (c + 0.5)) / cols - ww / 2;
      ctx.fillStyle = trim;
      ctx.fillRect(wx - 0.8, wy - 0.8, ww + 1.6, wh + 1.6);
      ctx.fillStyle = opening;
      ctx.fillRect(wx, wy, ww, wh);
    }
  }
  ctx.fillStyle = trim;
  ctx.fillRect(x + w * 0.5 - ww * 0.7 - 0.7, base - h * 0.2 - 0.7, ww * 1.4 + 1.4, h * 0.2 + 0.7);
  ctx.fillStyle = sc.tone(P.roofShade, haze);
  ctx.fillRect(x + w * 0.5 - ww * 0.7, base - h * 0.2, ww * 1.4, h * 0.2);
  // Attic hoist door in the gable.
  ctx.fillStyle = opening;
  ctx.fillRect(x + w / 2 - ww * 0.4, top - gh * 0.42, ww * 0.8, gh * 0.22);
}

/** Moored barge, side on. `y` = waterline. */
function barge(ctx: Ctx, sc: Scene, x: number, y: number, L: number, haze: number): void {
  const P = sc.pal;
  const hull = sc.tone(P.metalShade, haze);
  fillPoly(ctx, [x, y - 6, x + L, y - 6, x + L - 4, y + 1, x + 3, y + 1], hull);
  ctx.fillStyle = sc.tone(P.roofAlt, haze);
  ctx.fillRect(x, y - 6.8, L, 1.1);
  ctx.fillStyle = sc.tone(P.wallAlt, haze);
  ctx.fillRect(x + L * 0.62, y - 14, L * 0.26, 8);
  ctx.fillStyle = sc.tone(P.roofShade, haze);
  ctx.fillRect(x + L * 0.6, y - 15, L * 0.3, 1.4);
  ctx.fillStyle = sc.tone(P.opening, haze);
  ctx.fillRect(x + L * 0.66, y - 12.2, 2.2, 2.4);
  ctx.fillRect(x + L * 0.76, y - 12.2, 2.2, 2.4);
  ctx.fillStyle = sc.tone(P.water, haze, 0.35);
  oval(ctx, x + L / 2, y + 1.4, L * 0.55, 1.2);
}

const near: LayerPainter = (ctx, sc, rng, box) => {
  const P = sc.pal;
  const { w, bottom, haze } = box;
  const quay = S.quayY;

  // Canal along the whole strip; the ground strip crops its lower part.
  ctx.fillStyle = vGrad(ctx, quay, bottom, sc.tone(P.waterLight, haze), sc.tone(P.water, haze));
  ctx.fillRect(-4, quay, w + 8, bottom - quay);

  // House blocks.
  const wallSets = [
    [sc.tone(P.wall, haze), sc.tone(P.wallShade, haze)],
    [sc.tone(P.wallAlt, haze), sc.tone(P.wallShade, haze, 0.3)],
    [sc.tone(P.roofAlt, haze), sc.tone(P.roofShade, haze)],
  ];
  const blockXs = [w * 0.13, w * 0.48, w * 0.83];
  for (let b = 0; b < S.houseBlocks; b++) {
    const widths: number[] = [];
    let total = 0;
    for (let i = 0; i < S.housesPerBlock; i++) {
      const hw = range(rng, 15, 21);
      widths.push(hw);
      total += hw + 0.6;
    }
    const heights: number[] = [];
    for (let i = 0; i < S.housesPerBlock; i++) heights.push(S.houseHeight * range(rng, 0.8, 1.12));
    wrappedSeeded(w, blockXs[b], total / 2 + 4, rng, (cx, r) => {
      let hx = cx - total / 2;
      let ci = rangeInt(r, 0, wallSets.length - 1);
      for (let i = 0; i < S.housesPerBlock; i++) {
        ci = (ci + 1 + (r() < 0.4 ? 1 : 0)) % wallSets.length;
        const [wall, shade] = wallSets[ci];
        facade(ctx, sc, r, hx, quay, widths[i], heights[i], GABLES[rangeInt(r, 0, GABLES.length - 1)], wall, shade, haze);
        hx += widths[i] + 0.6;
      }
    });
    // Water reflections of the block.
    ctx.fillStyle = sc.tone(P.wall, haze, 0.18);
    ctx.fillRect(blockXs[b] - total / 2, quay + 2, total, 12);
  }

  // Plane trees along the quay between the blocks.
  const treeLook: TreeLook = { lit: sc.tone(P.foliage, haze), shade: sc.tone(P.foliageShade, haze), trunk: sc.tone(P.trunk, haze) };
  for (let i = 0; i < S.trees; i++) {
    const tx = ((i + 0.5 + range(rng, -0.2, 0.2)) / S.trees) * w;
    if (blockXs.some((bx) => Math.abs(tx - bx) < 80)) continue;
    const h = range(rng, 58, 72);
    wrappedSeeded(w, tx, h * 0.5, rng, (cx, r) => roundTree(ctx, r, cx, quay - 1, h, h * range(r, 0.6, 0.78), treeLook, sc.light));
  }

  // Quay edge: a stone lip, its shadow on the water, and bollards.
  ctx.fillStyle = sc.tone(P.stone, haze);
  ctx.fillRect(-4, quay - 1, w + 8, 3);
  ctx.fillStyle = sc.tone(P.stoneShade, haze);
  ctx.fillRect(-4, quay + 2, w + 8, 1.6);
  ctx.fillStyle = sc.tone(P.metalShade, haze);
  for (let i = 0; i < 36; i++) {
    const bx = rng() * w;
    wrapped(w, bx, 3, (cx) => {
      ctx.fillRect(cx - 1.1, quay - 4.6, 2.2, 4);
      ctx.fillRect(cx - 1.6, quay - 5.2, 3.2, 1);
    });
  }

  // Ripples and glints.
  for (let i = 0; i < 160; i++) {
    const x = rng() * w;
    const y = quay + 4 + rng() * (bottom - quay - 6);
    const len = range(rng, 8, 34);
    ctx.fillStyle = chance(rng, 0.55) ? sc.tone(P.pale, haze, 0.4) : sc.tone(P.water, haze - 0.12, 0.35);
    wrapped(w, x, len, (cx) => oval(ctx, cx, y, len / 2, 0.8));
  }

  // Barges moored along the quay.
  for (const bx of [w * 0.3, w * 0.66, w * 0.95]) {
    const L = range(rng, 52, 80);
    wrapped(w, bx, L, (cx) => barge(ctx, sc, cx - L / 2, quay + 8, L, haze));
  }
};

export const holland: TheatreArt = { far, mid, near };
