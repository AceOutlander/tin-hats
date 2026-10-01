/**
 * Normandy: a beach. Sea horizon with ships, landing craft and barrage
 * balloons; surf, wet sand and beach obstacles in the mid strip; low dunes
 * nearest the battlefield. Obstacles appear in the far and mid strips only.
 */
import { SCENES } from '../../../data/theatres';
import {
  TAU,
  disc,
  fillBelow,
  fillPoly,
  lerp,
  line,
  noiseProfile,
  oval,
  sineProfile,
  spread,
  strokeAlong,
  vGrad,
  wrapped,
  wrappedSeeded,
  type Ctx,
  type Profile,
} from '../kit';
import { chance, range, type Rng } from '../rng';
import type { LayerPainter, TheatreArt } from '../scene';

const S = SCENES.normandy;

/** Warship on the horizon. (x, y) = waterline amidships, L = length. */
function destroyer(ctx: Ctx, x: number, y: number, L: number, facing: number, color: string): void {
  const u = L / 100;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing * u, u);
  ctx.fillStyle = color;
  fillPoly(ctx, [-50, 0, -50, -5, -46, -6, 38, -6.5, 50, -9.5, 45, 0], color);
  ctx.fillRect(7, -14, 13, 8);
  ctx.fillRect(10, -17.5, 7, 4);
  fillPoly(ctx, [-5, -6, -4, -15.5, 1.5, -15.5, 2.5, -6], color);
  fillPoly(ctx, [-15, -6, -14, -13.5, -9.5, -13.5, -8.5, -6], color);
  ctx.fillRect(27, -9.5, 7, 3.5);
  ctx.fillRect(34, -8.6, 8, 1);
  ctx.fillRect(-37, -9.5, 7, 3.5);
  ctx.fillRect(-45, -8.6, 8, 1);
  ctx.fillRect(13, -28, 1, 11);
  ctx.fillRect(10.5, -24, 6, 0.8);
  ctx.fillRect(-22, -17, 0.9, 11);
  ctx.restore();
}

/** Transport standing off the beach. */
function transport(ctx: Ctx, x: number, y: number, L: number, facing: number, color: string): void {
  const u = L / 100;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing * u, u);
  fillPoly(ctx, [-50, 0, -50, -9, 45, -9, 50, -11.5, 46, 0], color);
  ctx.fillRect(-13, -18, 27, 9);
  ctx.fillRect(-8, -21.5, 16, 4);
  fillPoly(ctx, [-3, -21, -2.4, -30, 4, -30, 4.6, -21], color);
  ctx.fillRect(-34.5, -31, 1.1, 22);
  ctx.fillRect(29.5, -31, 1.1, 22);
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.9;
  line(ctx, -34, -10, -22, -24);
  line(ctx, 30, -10, 19, -24);
  ctx.restore();
}

/**
 * Assault landing craft, side on. (x, y) = waterline amidships. Under way it
 * carries a row of helmets and pushes a bow wave; beached, the ramp is down.
 */
function landingCraft(ctx: Ctx, x: number, y: number, L: number, facing: number, hull: string, shade: string, foam: string, beached: boolean): void {
  const u = L / 100;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing * u, u);
  if (!beached) {
    ctx.fillStyle = foam;
    oval(ctx, 44, 1.5, 12, 2.2);
    oval(ctx, -66, 1.5, 22, 1.6);
    ctx.fillStyle = shade;
    for (let hx = -26; hx <= 26; hx += 7.5) disc(ctx, hx, -13.2, 2.3);
  }
  fillPoly(ctx, [-50, 2, -50, -12, 34, -12, beached ? 38 : 48, beached ? -12 : -18, 40, 2], hull);
  ctx.fillStyle = hull;
  ctx.fillRect(-45, -20, 11, 8);
  ctx.fillStyle = shade;
  ctx.fillRect(-50, -4, 90, 1.4);
  ctx.fillRect(-42.5, -18, 6, 2.6);
  if (beached) fillPoly(ctx, [38, -12, 40, -12, 61, 2.5, 58, 3.4], shade);
  ctx.restore();
}

/** Barrage balloon: a fat hull with tail lobes, tethered by a cable to `anchorY`. */
function balloon(ctx: Ctx, x: number, y: number, L: number, facing: number, lit: string, shade: string, cable: string, anchorX: number, anchorY: number): void {
  ctx.strokeStyle = cable;
  ctx.lineWidth = 0.5;
  line(ctx, x + facing * L * 0.08, y + L * 0.18, anchorX, anchorY);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  ctx.rotate(-0.1);
  const rx = L / 2;
  const ry = L * 0.2;
  // Tail lobes.
  ctx.fillStyle = shade;
  for (const dir of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(-rx * 0.55, dir * ry * 0.3);
    ctx.quadraticCurveTo(-rx * 1.0, dir * ry * 1.9, -rx * 1.22, dir * ry * 1.25);
    ctx.quadraticCurveTo(-rx * 1.12, dir * ry * 0.4, -rx * 0.85, 0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = lit;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
  ctx.fill();
  // Shaded belly.
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
  ctx.clip();
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.ellipse(-rx * 0.05, ry * 0.75, rx * 1.1, ry * 0.8, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

const far: LayerPainter = (ctx, sc, rng, box) => {
  const P = sc.pal;
  const { w, bottom, haze } = box;
  const seaY = S.seaY;

  ctx.fillStyle = vGrad(ctx, seaY, bottom, sc.tone(P.farAlt, haze + 0.16), sc.tone(P.far, haze - 0.16));
  ctx.fillRect(-4, seaY, w + 8, bottom - seaY);
  ctx.fillStyle = sc.tone(P.waterLight, haze + 0.1, 0.7);
  ctx.fillRect(-4, seaY, w + 8, 1.2);

  // Ships on the horizon, each flying a balloon.
  const shipColor = sc.tone(P.metal, haze + 0.2);
  const shipXs = spread(rng, w, S.ships, 0.7);
  const anchors: number[] = [];
  for (let i = 0; i < shipXs.length; i++) {
    const L = range(rng, 44, 70);
    const sy = seaY + range(rng, 1, 5);
    const facing = chance(rng, 0.7) ? 1 : -1;
    const kind = i % 3;
    anchors.push(shipXs[i]);
    wrapped(w, shipXs[i], L, (cx) => {
      if (kind === 0) transport(ctx, cx, sy, L, facing, shipColor);
      else destroyer(ctx, cx, sy, L, facing, shipColor);
    });
  }

  const litB = sc.tone(P.pale, haze + 0.12);
  const shadeB = sc.tone(P.metal, haze + 0.34);
  const cable = sc.tone(P.metal, haze + 0.3, 0.6);
  for (let i = 0; i < S.balloons; i++) {
    const ax = anchors[i % anchors.length];
    const bx = ax + range(rng, -30, 30);
    const f = rng();
    const by = lerp(S.balloonMinY, S.balloonMaxY, f);
    const L = lerp(30, 17, f) * range(rng, 0.9, 1.1);
    const facing = rng() < 0.75 ? 1 : -1;
    wrapped(w, bx, 60, (cx) => balloon(ctx, cx, by, L, facing, litB, shadeB, cable, cx + (ax - bx), seaY + 1));
  }

  // Swell: short light and dark streaks, longer toward the shore.
  for (let i = 0; i < 420; i++) {
    const x = rng() * w;
    const f = Math.pow(rng(), 1.6);
    const y = seaY + 3 + f * (bottom - seaY - 6);
    const len = lerp(5, 34, f) * range(rng, 0.6, 1.4);
    const lightStreak = rng() < 0.5;
    wrapped(w, x, len, (cx) => {
      ctx.fillStyle = lightStreak ? sc.tone(P.waterLight, haze, 0.32) : sc.tone(P.far, haze - 0.2, 0.26);
      oval(ctx, cx, y, len / 2, lerp(0.35, 0.9, f));
    });
  }

  // Landing craft running in.
  const hull = sc.tone(P.metal, haze + 0.02);
  const hullShade = sc.tone(P.metalShade, haze);
  const foam = sc.tone(P.pale, haze, 0.75);
  const craft: { x: number; f: number }[] = [];
  for (const cx of spread(rng, w, S.landingCraft, 0.8)) craft.push({ x: cx, f: rng() });
  craft.sort((a, b) => a.f - b.f);
  for (const c of craft) {
    const y = seaY + 12 + c.f * 32;
    const L = lerp(22, 44, c.f);
    wrapped(w, c.x, L * 1.6, (cx) => landingCraft(ctx, cx, y, L, 1, hull, hullShade, foam, false));
  }
};

function hedgehog(ctx: Ctx, x: number, base: number, s: number): void {
  ctx.lineWidth = Math.max(0.9, s * 0.16);
  ctx.lineCap = 'butt';
  line(ctx, x - s * 0.5, base, x + s * 0.45, base - s);
  line(ctx, x + s * 0.5, base, x - s * 0.45, base - s);
  line(ctx, x - s * 0.62, base - s * 0.42, x + s * 0.62, base - s * 0.56);
}

function logRamp(ctx: Ctx, x: number, base: number, s: number, dir: number): void {
  ctx.lineWidth = Math.max(0.9, s * 0.14);
  ctx.lineCap = 'round';
  line(ctx, x - dir * s * 0.9, base, x + dir * s * 0.7, base - s * 0.72);
  ctx.lineWidth = Math.max(0.8, s * 0.11);
  line(ctx, x + dir * s * 0.62, base - s * 0.68, x + dir * s * 0.4, base);
  line(ctx, x + dir * s * 0.62, base - s * 0.68, x + dir * s * 0.92, base);
}

function stake(ctx: Ctx, x: number, base: number, s: number, dir: number): void {
  ctx.lineWidth = Math.max(0.9, s * 0.13);
  ctx.lineCap = 'round';
  line(ctx, x, base, x + dir * s * 0.34, base - s);
  ctx.beginPath();
  ctx.arc(x + dir * s * 0.36, base - s * 1.04, s * 0.13, 0, TAU);
  ctx.fill();
}

const mid: LayerPainter = (ctx, sc, rng, box) => {
  const P = sc.pal;
  const { w, bottom, haze } = box;

  // Shallows and three lines of surf.
  const roll = sineProfile(rng, w, [3, 5, 8, 13], 0.6);
  const break1: Profile = (x) => S.surfY - 8 + roll(x) * 2.2;
  const break2: Profile = (x) => S.surfY - 1 + roll(x + 140) * 2;
  const sand: Profile = (x) => S.sandY + roll(x + 420) * 1.8;
  fillBelow(ctx, w, break1, bottom, sc.tone(P.waterLight, haze, 0.5), 2);
  fillBelow(ctx, w, break2, bottom, sc.tone(P.waterLight, haze - 0.1, 0.45), 2);
  const foam = sc.tone(P.pale, haze - 0.1, 0.85);
  ctx.strokeStyle = foam;
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.5;
  strokeAlong(ctx, w, break1, 0, 2);
  ctx.lineWidth = 1.8;
  strokeAlong(ctx, w, break2, 0, 2);

  // Wet sand, drying toward the dunes.
  fillBelow(ctx, w, sand, bottom, vGrad(ctx, S.sandY, S.sandY + 24, sc.tone(P.midAlt, haze), sc.tone(P.mid, haze)), 2);
  ctx.lineWidth = 1.3;
  strokeAlong(ctx, w, sand, 0, 2);
  // Tidal pools holding the sky.
  for (let i = 0; i < 46; i++) {
    const x = rng() * w;
    const y = S.sandY + 4 + Math.pow(rng(), 1.4) * (bottom - S.sandY - 8);
    const rx = range(rng, 10, 46);
    const ry = range(rng, 0.7, 1.6);
    wrapped(w, x, rx, (cx) => {
      ctx.fillStyle = sc.tone(P.waterLight, haze - 0.04, 0.42);
      oval(ctx, cx, y, rx, ry);
    });
  }

  // Beached craft, ramps down.
  const hull = sc.tone(P.metal, haze);
  const hullShade = sc.tone(P.metalShade, haze);
  for (const bx of spread(rng, w, 3, 0.6)) {
    const L = range(rng, 62, 92);
    wrapped(w, bx, L, (cx) => landingCraft(ctx, cx, S.surfY + 3, L, 1, hull, hullShade, foam, true));
  }

  // Obstacles from the surf up the beach, farther ones smaller.
  const items: { x: number; f: number; kind: number; dir: number }[] = [];
  for (let i = 0; i < S.obstacles; i++) {
    items.push({ x: rng() * w, f: rng(), kind: rng(), dir: rng() < 0.7 ? -1 : 1 });
  }
  items.sort((a, b) => a.f - b.f);
  const steel = sc.tone(P.metal, haze - 0.04);
  const wood = sc.tone(P.trunk, haze);
  for (const it of items) {
    const base = lerp(S.surfY - 2, bottom - 12, it.f);
    const s = lerp(8.5, 17, it.f);
    wrapped(w, it.x, s * 1.2, (cx) => {
      ctx.fillStyle = sc.tone(P.metalShade, haze, 0.22);
      oval(ctx, cx - sc.light * s * 0.4, base + 0.6, s * 0.9, s * 0.1);
      if (it.kind < 0.5) {
        ctx.strokeStyle = steel;
        hedgehog(ctx, cx, base, s);
      } else if (it.kind < 0.72) {
        ctx.strokeStyle = wood;
        logRamp(ctx, cx, base, s * 1.15, it.dir);
      } else {
        ctx.strokeStyle = wood;
        ctx.fillStyle = steel;
        stake(ctx, cx, base, s * 1.05, it.dir);
      }
    });
  }
};

const near: LayerPainter = (ctx, sc, rng, box) => {
  const P = sc.pal;
  const { w, bottom, haze } = box;
  const hump = noiseProfile(rng, w, 9, 3, 0.5, false);
  const y: Profile = (x) => S.duneY - S.duneAmp * 2.4 * Math.max(0, hump(x) - 0.42) + hump(x * 3) * 1.5;
  fillBelow(ctx, w, y, bottom, vGrad(ctx, S.duneY - S.duneAmp, bottom, sc.tone(P.near, haze), sc.tone(P.ground, 0.22)), 2);

  // Wind-combed lines on the dune faces.
  ctx.strokeStyle = sc.tone(P.nearAlt, haze, 0.35);
  ctx.lineWidth = 0.9;
  strokeAlong(ctx, w, (x) => y(x) + (S.duneY - y(x)) * 0.45, 4, 3);
  strokeAlong(ctx, w, (x) => y(x) + (S.duneY - y(x)) * 0.8, 7, 3);

  // Marram grass on the crests, bent by the sea wind.
  const lit = sc.tone(P.foliage, haze);
  const shade = sc.tone(P.foliageShade, haze);
  ctx.lineCap = 'round';
  for (let i = 0; i < S.marram; i++) {
    const mx = rng() * w;
    const tall = range(rng, 7, 13);
    wrappedSeeded(w, mx, tall * 1.5, rng, (cx, r) => {
      const top = y(cx);
      // Mostly on the dunes, thinly on the flats between.
      if (top > S.duneY - 2 && r() < 0.7) return;
      const blades = 6 + Math.floor(r() * 5);
      for (let k = 0; k < blades; k++) {
        const ox = range(r, -0.5, 0.5) * tall;
        const len = tall * range(r, 0.6, 1);
        ctx.strokeStyle = k % 2 === 0 ? shade : lit;
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(cx + ox * 0.5, top + 2);
        ctx.quadraticCurveTo(cx + ox, top + 2 - len * 0.7, cx + ox + len * 0.5, top + 2 - len);
        ctx.stroke();
      }
    });
  }
};

export const normandy: TheatreArt = { far, mid, near };
