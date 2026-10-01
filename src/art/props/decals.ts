/**
 * Ground decals: shell crater, scorch mark and loose rubble chunks. They lie
 * flat on the ground plane (origin = centre) and are meant to fade out.
 * The wrecked tank husks live with the tanks ("veh/<look>/husk").
 */
import { ART_COLORS as C, DECAL_LAYOUT as D } from '../../data/artLayout';
import type { SpriteSpec } from '../types';
import { type Ctx, TAU, chunk, ellipse, makeSpec, mix, rgba, rng } from './kit';

export const DECAL_KEYS = {
  crater: 'prop/decal/crater',
  scorch: 'prop/decal/scorch',
} as const;

/** Keys of the rubble chunk variants: "prop/rubble/0" .. "prop/rubble/3". */
export const RUBBLE_KEYS: readonly string[] = Array.from({ length: D.rubbleVariants }, (_, i) => `prop/rubble/${i}`);

function paintCrater(ctx: Ctx): void {
  const rand = rng(17);
  // Ring of thrown earth, thicker on the far side.
  ctx.fillStyle = rgba(C.earth, 0.9);
  ctx.beginPath();
  for (let i = 0; i <= 28; i++) {
    const a = (i / 28) * TAU;
    const k = 1 + (rand() - 0.5) * 0.16;
    const x = Math.cos(a) * 45 * k;
    const y = Math.sin(a) * 14.5 * k - 1;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = rgba(C.earthRim, 0.85);
  ctx.beginPath();
  ctx.ellipse(0, -2.5, 38, 10.5, 0, Math.PI, TAU);
  ctx.ellipse(0, -1, 36, 8, 0, 0, Math.PI, true);
  ctx.closePath();
  ctx.fill();
  // The pit, darkest toward the near wall.
  const g = ctx.createLinearGradient(0, -9, 0, 11);
  g.addColorStop(0, mix(C.earthDark, C.earth, 0.35));
  g.addColorStop(0.55, C.earthDark);
  g.addColorStop(1, C.void);
  ctx.fillStyle = g;
  ellipse(ctx, 0, 0.5, 35, 9.5);
  ctx.fill();
  // Ejecta: clods and streaks flung outward.
  for (let i = 0; i < 16; i++) {
    const a = rand() * TAU;
    const d = 0.95 + rand() * 0.2;
    ctx.fillStyle = rgba(i % 3 === 0 ? C.earthRim : C.earthDark, 0.8);
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * 44 * d, Math.sin(a) * 14 * d, 1.2 + rand() * 1.8, 0.8 + rand() * 0.9, 0, 0, TAU);
    ctx.fill();
  }
}

function paintScorch(ctx: Ctx): void {
  const rand = rng(23);
  const blot = (x: number, y: number, rx: number, ry: number, strength: number): void => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, `rgba(12,10,9,${strength})`);
    g.addColorStop(0.6, `rgba(12,10,9,${strength * 0.5})`);
    g.addColorStop(1, 'rgba(12,10,9,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, TAU);
    ctx.fill();
    ctx.restore();
  };
  blot(0, 0, 58, 16.5, 0.6);
  blot(-18, 2, 30, 10, 0.45);
  blot(22, -2, 26, 9, 0.45);
  for (let i = 0; i < 9; i++) {
    const a = rand() * TAU;
    blot(Math.cos(a) * 40, Math.sin(a) * 11, 9 + rand() * 8, 3 + rand() * 2.5, 0.35);
  }
  // Flecks of ash.
  for (let i = 0; i < 14; i++) {
    const a = rand() * TAU;
    const d = rand() * 0.8;
    ctx.fillStyle = rgba(i % 2 === 0 ? C.char : C.silkDark, 0.5);
    ctx.fillRect(Math.cos(a) * 46 * d, Math.sin(a) * 13 * d, 1.4, 0.9);
  }
}

function paintRubble(ctx: Ctx, variant: number): void {
  const rand = rng(100 + variant * 7);
  const body = mix(C.concrete, C.concreteDark, 0.15 + variant * 0.22);
  chunk(ctx, 0, 0, 9.5 + variant * 1.6, rand, body, C.concreteRim);
}

export function decalSpecs(): SpriteSpec[] {
  const specs: SpriteSpec[] = [makeSpec(DECAL_KEYS.crater, D.craterBox, paintCrater), makeSpec(DECAL_KEYS.scorch, D.scorchBox, paintScorch)];
  for (let i = 0; i < D.rubbleVariants; i++) {
    specs.push(makeSpec(RUBBLE_KEYS[i], D.rubbleBox, (ctx) => paintRubble(ctx, i)));
  }
  return specs;
}
