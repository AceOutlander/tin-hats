/**
 * Soft things: smoke and dust puffs, water spray, the explosion fireball and
 * flame tongues. Painterly and muted: grey-brown smoke, warm fire.
 */
import { FX_SPRITES } from '../../data/fx';
import { createRng, type Rng01 } from '../../fx/rng';
import type { SpriteSpec } from '../types';
import { dab, mix, ramp, rgba, sprite, TAU, type Rgb } from './paint';

interface PuffLook {
  /** Sprite size in wu (square). */
  size: number;
  body: Rgb;
  light: Rgb;
  shade: Rgb;
  /** Lobes in the cluster and how strongly each is painted. */
  lobes: number;
  alpha: number;
  /** 0 = pure haze, higher = lobes with a readable edge. */
  core: number;
  /** Strength of the lit top-left and the shaded underside. */
  lightAlpha: number;
  shadeAlpha: number;
}

const SMOKE: PuffLook = {
  size: 64,
  body: [124, 116, 104],
  light: [190, 181, 164],
  shade: [62, 57, 52],
  lobes: 10,
  alpha: 0.82,
  core: 0.55,
  lightAlpha: 0.5,
  shadeAlpha: 0.5,
};

const SMOKE_DARK: PuffLook = {
  size: 64,
  body: [46, 42, 40],
  light: [98, 90, 82],
  shade: [16, 14, 14],
  lobes: 10,
  alpha: 0.86,
  core: 0.55,
  lightAlpha: 0.42,
  shadeAlpha: 0.5,
};

const SMOKE_LIGHT: PuffLook = {
  size: 96,
  body: [198, 194, 183],
  light: [236, 233, 224],
  shade: [144, 140, 132],
  lobes: 13,
  alpha: 0.56,
  core: 0.3,
  lightAlpha: 0.4,
  shadeAlpha: 0.32,
};

const DUST: PuffLook = {
  size: 48,
  body: [168, 148, 110],
  light: [212, 194, 152],
  shade: [112, 94, 64],
  lobes: 9,
  alpha: 0.66,
  core: 0.38,
  lightAlpha: 0.42,
  shadeAlpha: 0.36,
};

const SPRAY: PuffLook = {
  size: 40,
  body: [214, 224, 230],
  light: [248, 251, 253],
  shade: [146, 168, 184],
  lobes: 8,
  alpha: 0.6,
  core: 0.3,
  lightAlpha: 0.45,
  shadeAlpha: 0.3,
};

/**
 * A cauliflower cluster of lobes. The whole puff is lit from the top-left and
 * shaded underneath, and each lobe gets its own small highlight and shadow so
 * the billows read as volume rather than as a flat blur.
 */
function paintPuff(ctx: CanvasRenderingContext2D, size: number, rng: Rng01, look: PuffLook): void {
  const c = size / 2;
  const R = size / 2;
  const lobeX: number[] = [];
  const lobeY: number[] = [];
  const lobeR: number[] = [];
  // A central mass so the puff never has a hole in it.
  dab(ctx, c, c, R * 0.6, look.body, look.alpha, look.core);
  const turn = rng() * TAU;
  for (let i = 0; i < look.lobes; i++) {
    const a = turn + ((i + rng() * 0.7) / look.lobes) * TAU;
    const r = R * (0.26 + 0.2 * rng());
    const d = Math.min(R * 0.98 - r, R * (0.3 + 0.32 * rng()));
    lobeX.push(c + Math.cos(a) * d);
    lobeY.push(c + Math.sin(a) * d * 0.94);
    lobeR.push(r);
    dab(ctx, lobeX[i], lobeY[i], r, look.body, look.alpha, look.core);
  }
  // Light and shade only tint what is already painted, so the silhouette keeps its soft edge.
  ctx.globalCompositeOperation = 'source-atop';
  dab(ctx, c - R * 0.36, c - R * 0.42, R * 1.05, look.light, look.lightAlpha, 0.25);
  dab(ctx, c + R * 0.3, c + R * 0.5, R * 0.95, look.shade, look.shadeAlpha, 0.25);
  for (let i = 0; i < look.lobes; i++) {
    const r = lobeR[i];
    dab(ctx, lobeX[i] + r * 0.3, lobeY[i] + r * 0.38, r * 0.8, look.shade, look.shadeAlpha * 0.5, 0.2);
    dab(ctx, lobeX[i] - r * 0.26, lobeY[i] - r * 0.3, r * 0.62, look.light, look.lightAlpha * 0.6, 0.3);
  }
}

function puffs(keys: readonly string[], look: PuffLook): SpriteSpec[] {
  return keys.map((key) => sprite(key, look.size, look.size, 0.5, 0.5, (ctx, w, _h, rng) => paintPuff(ctx, w, rng, look)));
}

/** Fireball colour by heat: 0 = cooled grey-brown smoke, 1 = white-hot. */
const HEAT: readonly Rgb[] = [
  [112, 103, 93],
  [62, 52, 46],
  [150, 62, 30],
  [232, 122, 40],
  [255, 196, 84],
  [255, 242, 204],
];

const FIREBALL_SIZE = 80;
const FIREBALL_LOBES = 12;
/** Every frame is laid out from this one seed. */
const FIREBALL_SEED = 0x51f15e;

/**
 * One frame of the explosion fireball. Every frame uses the same lobe layout
 * (the seed is shared), so the ball swells and cools in place instead of
 * jumping: white-hot core, orange lobes, red glow inside dark smoke, then smoke.
 */
function paintFireball(ctx: CanvasRenderingContext2D, size: number, frame: number, frames: number): void {
  const rng = createRng(FIREBALL_SEED);
  const t = frame / (frames - 1);
  const c = size / 2;
  const R = (size / 2) * (0.5 + 0.5 * (1 - (1 - t) * (1 - t)));
  const fade = t > 0.75 ? 1 - (t - 0.75) * 1.6 : 1;

  const layout: { a: number; d: number; r: number; jitter: number }[] = [];
  const turn = rng() * TAU;
  for (let i = 0; i < FIREBALL_LOBES; i++) {
    layout.push({
      a: turn + ((i + rng() * 0.6) / FIREBALL_LOBES) * TAU,
      d: 0.3 + 0.3 * rng(),
      r: 0.3 + 0.18 * rng(),
      jitter: rng(),
    });
  }

  // Outer lobes cool first.
  const outerHeat = 1 - t * 1.5;
  const innerHeat = 1.1 - t * 1.05;
  dab(ctx, c, c, R * 0.66, ramp(HEAT, innerHeat), 0.85 * fade, 0.45);
  for (const lobe of layout) {
    const r = R * lobe.r;
    const d = Math.min(R * 0.97 - r, R * lobe.d);
    const heat = outerHeat + (lobe.jitter - 0.5) * 0.3;
    dab(ctx, c + Math.cos(lobe.a) * d, c + Math.sin(lobe.a) * d, r, ramp(HEAT, heat), 0.72 * fade, 0.4);
  }
  // Inner glow showing through the cooling shell.
  ctx.globalCompositeOperation = 'source-atop';
  if (innerHeat > 0.25) {
    for (const lobe of layout) {
      if (lobe.jitter < 0.35) continue;
      const d = R * lobe.d * 0.45;
      dab(
        ctx,
        c + Math.cos(lobe.a + 0.6) * d,
        c + Math.sin(lobe.a + 0.6) * d,
        R * (0.2 + 0.16 * lobe.jitter),
        ramp(HEAT, innerHeat + 0.1),
        0.6 * Math.min(1, innerHeat),
        0.2,
      );
    }
  }
  if (t < 0.55) {
    dab(ctx, c, c, R * (0.55 - t * 0.5), HEAT[5], 0.95 * (1 - t / 0.55), 0.35);
  }
  // Smoke frames get the same top-left light as the smoke puffs.
  if (t > 0.5) {
    dab(ctx, c - R * 0.25, c - R * 0.3, R * 0.5, [170, 160, 146], 0.3 * (t - 0.5) * 2, 0.1);
    dab(ctx, c + R * 0.15, c + R * 0.35, R * 0.5, [40, 34, 30], 0.3 * (t - 0.5) * 2, 0.1);
  }
}

const FLAME_OUTER: Rgb = [226, 96, 30];
const FLAME_MID: Rgb = [250, 160, 50];
const FLAME_CORE: Rgb = [255, 232, 160];

/** A flame tongue: wide at the base, licking up to a bent tip. */
function tongue(
  ctx: CanvasRenderingContext2D,
  cx: number,
  base: number,
  halfWidth: number,
  height: number,
  bend: number,
  colour: Rgb,
  alpha: number,
): void {
  const tipX = cx + bend;
  const tipY = base - height;
  const g = ctx.createLinearGradient(0, base, 0, tipY);
  g.addColorStop(0, rgba(colour, alpha * 0.55));
  g.addColorStop(0.25, rgba(colour, alpha));
  g.addColorStop(0.75, rgba(colour, alpha * 0.6));
  g.addColorStop(1, rgba(colour, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(cx, base);
  ctx.bezierCurveTo(cx - halfWidth * 1.5, base - height * 0.1, cx - halfWidth * 1.1, base - height * 0.55, tipX, tipY);
  ctx.bezierCurveTo(cx + halfWidth * 0.7, base - height * 0.5, cx + halfWidth * 1.5, base - height * 0.12, cx, base);
  ctx.closePath();
  ctx.fill();
}

function paintFlame(ctx: CanvasRenderingContext2D, w: number, h: number, rng: Rng01): void {
  const cx = w / 2;
  const base = h * 0.86;
  const bend = (rng() - 0.5) * w * 0.5;
  dab(ctx, cx, base - h * 0.2, w * 0.48, FLAME_OUTER, 0.5, 0);
  tongue(ctx, cx, base, w * 0.3, h * 0.8, bend, FLAME_OUTER, 0.85);
  tongue(ctx, cx - w * 0.14, base, w * 0.16, h * (0.45 + 0.15 * rng()), -w * 0.12, FLAME_OUTER, 0.7);
  tongue(ctx, cx + w * 0.15, base, w * 0.15, h * (0.4 + 0.2 * rng()), w * 0.1, FLAME_OUTER, 0.7);
  tongue(ctx, cx, base - h * 0.02, w * 0.21, h * 0.58, bend * 0.6, FLAME_MID, 0.9);
  tongue(ctx, cx, base - h * 0.04, w * 0.12, h * 0.36, bend * 0.3, FLAME_CORE, 0.95);
  dab(ctx, cx, base - h * 0.12, w * 0.2, mix(FLAME_CORE, [255, 255, 255], 0.4), 0.7, 0.2);
}

export function smokeSprites(): SpriteSpec[] {
  const fireballFrames = FX_SPRITES.fireball.length;
  return [
    ...puffs(FX_SPRITES.smoke, SMOKE),
    ...puffs(FX_SPRITES.smokeDark, SMOKE_DARK),
    ...puffs(FX_SPRITES.smokeLight, SMOKE_LIGHT),
    ...puffs(FX_SPRITES.dust, DUST),
    ...puffs(FX_SPRITES.spray, SPRAY),
    ...FX_SPRITES.fireball.map((key, frame) =>
      sprite(key, FIREBALL_SIZE, FIREBALL_SIZE, 0.5, 0.5, (ctx, w) => paintFireball(ctx, w, frame, fireballFrames)),
    ),
    ...FX_SPRITES.flame.map((key) => sprite(key, 28, 40, 0.5, 0.7, paintFlame)),
  ];
}
