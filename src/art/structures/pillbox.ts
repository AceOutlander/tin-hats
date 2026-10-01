/**
 * Pillbox: a squat concrete machine-gun post, drawn facing right. Intact,
 * damaged and rubble share one box and origin (bottom centre on the ground
 * line); the gun muzzle is PILLBOX_LAYOUT.slit.
 */
import { ART_COLORS as C, DAMAGE_STATES, PILLBOX_LAYOUT as P, type DamageState } from '../../data/artLayout';
import {
  type Ctx,
  bagPile,
  bite,
  charOver,
  chunk,
  concreteFace,
  fillPoly,
  footing,
  heap,
  inside,
  machineGun,
  makeSpec,
  mix,
  poly,
  rebar,
  rgba,
  rimPoly,
  rng,
  sandbag,
  scorch,
  shellHole,
  strokeLine,
} from '../props/kit';
import type { SpriteSpec } from '../types';

/** The destroyed state is named 'rubble' in keys: "st/pillbox/intact", "/damaged", "/rubble". */
export function pillboxKey(state: DamageState): string {
  return `st/pillbox/${state === 'ruin' ? 'rubble' : state}`;
}

function paintBody(ctx: Ctx, rand: () => number): void {
  // Earth banked against the rear.
  rimPoly(ctx, [-58, 2, -52, -14, -44, -28, -40, -30, -40, 2], C.earth, C.earthRim);

  const body = [-44, 2, -46, -34, -41, -47, 39, -47, 44, -39, 46, 2];
  rimPoly(ctx, body, C.concrete, C.concreteRim);
  inside(
    ctx,
    (c) => poly(c, body),
    () => {
      concreteFace(ctx, -46, 46, -47, 2, rand);
      ctx.fillStyle = rgba(C.void, 0.38);
      ctx.fillRect(-46, -47, 92, 5);
      ctx.fillStyle = rgba(C.concreteDark, 0.45);
      ctx.fillRect(-46, -8, 92, 11);
      // The face toward the enemy is in shade.
      fillPoly(ctx, [30, -47, 46, -47, 46, 2, 36, 2], rgba(C.concreteDark, 0.4));
    },
  );

  // Stepped embrasure running round to the front face.
  fillPoly(ctx, [2, -42, 46, -42, 46, -25.5, 2, -25.5], C.concreteDark);
  strokeLine(ctx, [2, -42.4, 45.5, -42.4], rgba(C.concreteRim, 0.8), 0.9);
  fillPoly(ctx, [7, -39, 46, -39, 46, -28.5, 7, -28.5], mix(C.concreteDark, C.void, 0.55));
  fillPoly(ctx, [12, -37, 46, -37, 46, -31, 12, -31], C.void);
  machineGun(ctx, P.slit, 22);

  // Thick roof slab with rounded shoulders.
  rimPoly(ctx, [-49, -46, -46, -54, -36, -58.5, 34, -58.5, 44, -54.5, 49, -46], mix(C.concrete, C.concreteRim, 0.16), C.concreteRim, 1.5);
  strokeLine(ctx, [-48, -45.6, 48, -45.6], rgba(C.void, 0.5), 1.3);

  // Sandbags banked under the slit and one at the back.
  bagPile(ctx, 32, 2, 2, 2, 18, 10, 1);
  sandbag(ctx, -60, -8, 18, 10, -0.2);
}

function paintIntact(ctx: Ctx): void {
  const rand = rng(88);
  paintBody(ctx, rand);
  footing(ctx, -60, 70, 2, 7, rand);
}

function paintDamaged(ctx: Ctx): void {
  const rand = rng(88);
  paintBody(ctx, rand);
  const drand = rng(5);
  bite(ctx, [22, -62, 26, -52, 33, -49, 38, -43, 46, -41, 54, -44, 54, -62]);
  bite(ctx, [-52, -40, -44, -42, -40, -50, -34, -62, -52, -62]);
  shellHole(ctx, -18, -20, 7.5, drand);
  shellHole(ctx, 22, -12, 4, drand);
  scorch(ctx, -18, -20, 30, 24, 0.6);
  scorch(ctx, 36, -46, 24, 20, 0.7);
  rebar(ctx, 30, -50, drand);
  for (let i = 0; i < 5; i++) {
    chunk(ctx, -40 + drand() * 96, -1 - drand() * 3, 4.5 + drand() * 5, drand, mix(C.concrete, C.concreteDark, drand()), C.concreteRim);
  }
  footing(ctx, -60, 70, 2, 7, rand);
}

function paintRubble(ctx: Ctx): void {
  const rand = rng(303);
  // Stumps of the walls still stand at the corners.
  rimPoly(ctx, [-46, 2, -47, -22, -40, -30, -34, -20, -28, -24, -22, 2], mix(C.concrete, C.concreteDark, 0.3), C.concreteRim);
  rimPoly(ctx, [24, 2, 27, -16, 33, -12, 38, -24, 45, -18, 46, 2], mix(C.concrete, C.concreteDark, 0.45), C.concreteRim);
  heap(ctx, -56, 60, 3, 24, rand, mix(C.concreteDark, C.earth, 0.35), C.concreteRim);
  // The roof slab, broken in two, lies on the heap.
  rimPoly(ctx, [-36, -18, 2, -31, 7, -23, -30, -9], mix(C.concrete, C.concreteRim, 0.12), C.concreteRim, 1.4);
  rimPoly(ctx, [8, -22, 40, -12, 37, -4, 6, -13], mix(C.concrete, C.concreteDark, 0.2), C.concreteRim, 1.4);
  rebar(ctx, 3, -26, rand);
  rebar(ctx, -40, -24, rand);
  rebar(ctx, 38, -14, rand);
  for (let i = 0; i < 12; i++) {
    chunk(ctx, -52 + rand() * 108, -1 - rand() * 12, 5 + rand() * 7, rand, mix(C.concrete, C.concreteDark, rand()), C.concreteRim);
  }
  sandbag(ctx, 46, -7, 18, 10, -0.3);
  charOver(ctx, -60, -74, 132, 84, 0.3);
  footing(ctx, -60, 70, 2, 7, rand);
}

export function pillboxSpecs(): SpriteSpec[] {
  const paint: Record<DamageState, (ctx: Ctx) => void> = { intact: paintIntact, damaged: paintDamaged, ruin: paintRubble };
  return DAMAGE_STATES.map((state) => makeSpec(pillboxKey(state), P.box, paint[state]));
}
