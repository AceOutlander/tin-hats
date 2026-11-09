/**
 * Air strike art: a generic single-engine fighter-bomber seen from the side
 * (facing right; the renderer mirrors it for the other side), its soft ground
 * shadow, and the rockets and bombs it drops. No national markings. The Red Army flies the Il-2 Shturmovik instead
 * (./sovietPlanes); airStrikeKey picks a nation's plane (AIR_STRIKE_PLANE).
 */
import { AIR_LAYOUT as A, AIR_STRIKE_PLANE, ART_COLORS as C } from '../../data/artLayout';
import type { FactionId } from '../../data/schema';
import { type Ctx, TAU, ellipse, fillPoly, inside, makeSpec, mix, rgba, rimPoly, rimRect, rimmed, strokeLine } from '../props/kit';
import type { SpriteSpec } from '../types';
import { paintIl2 } from './sovietPlanes';

export const AIR_KEYS = {
  plane: 'veh/air/plane',
  il2: 'veh/air/plane/il2',
  shadow: 'veh/air/shadow',
  rocket: 'veh/air/rocket',
  bomb: 'veh/air/bomb',
} as const;

/** The aircraft a nation's air strike flies. */
export function airStrikeKey(faction: FactionId): string {
  return AIR_STRIKE_PLANE[faction] === 'il2' ? AIR_KEYS.il2 : AIR_KEYS.plane;
}

const SKIN = mix(C.ink, '#3b4038', 0.55);
const BELLY = '#565b54';
const RIM = '#9a9d8c';

function fuselage(c: Ctx): void {
  c.beginPath();
  c.moveTo(92, -9);
  c.bezierCurveTo(78, -12.5, 58, -13, 40, -13);
  // Windscreen and bubble canopy.
  c.lineTo(31, -22);
  c.bezierCurveTo(22, -25.5, 6, -25, -4, -16);
  // Spine down to the fin.
  c.bezierCurveTo(-30, -13, -62, -9.5, -82, -7.5);
  c.lineTo(-97, -35);
  c.bezierCurveTo(-100, -38.5, -109, -38.5, -111, -35);
  c.lineTo(-113, -5);
  c.lineTo(-114, 1.5);
  // Belly, then the deep chin radiator under the nose.
  c.bezierCurveTo(-90, 6, -40, 12, -6, 13.5);
  c.bezierCurveTo(14, 14, 28, 15, 40, 17);
  c.bezierCurveTo(52, 23.5, 78, 23.5, 88, 17);
  c.lineTo(92, 11);
  c.closePath();
}

function rocketOnRail(ctx: Ctx, x: number, y: number): void {
  strokeLine(ctx, [x - 9, y - 2.4, x + 7, y - 2.4], C.ink, 1);
  rimRect(ctx, x - 12, y - 1.5, 21, 3, 1.4, C.inkSoft, RIM, 0.8);
  fillPoly(ctx, [x + 8, y - 2.2, x + 15, y, x + 8, y + 2.2], mix(C.inkSoft, RIM, 0.3));
  fillPoly(ctx, [x - 12, y - 1.5, x - 16, y - 4, x - 13, y, x - 16, y + 4, x - 12, y + 1.5], C.ink);
}

function paintPlane(ctx: Ctx): void {
  // Tailplane, behind the fuselage.
  rimmed(ctx, (c) => ellipse(c, -99, -6.5, 15, 2.6), C.ink, RIM, 0, 1);

  rimmed(ctx, fuselage, SKIN, RIM, 0.2, 1.5);
  inside(ctx, fuselage, () => {
    // Paler underside.
    ctx.fillStyle = BELLY;
    ctx.beginPath();
    ctx.moveTo(-116, 0);
    ctx.bezierCurveTo(-60, 3, 20, 6, 96, 6);
    ctx.lineTo(96, 30);
    ctx.lineTo(-116, 30);
    ctx.closePath();
    ctx.fill();
    // Radiator intake, exhaust stubs, panel lines, rudder hinge.
    ctx.fillStyle = C.void;
    ctx.fillRect(82, 12.5, 8, 7);
    ctx.fillStyle = rgba(C.void, 0.85);
    for (let i = 0; i < 5; i++) ctx.fillRect(56 + i * 5.5, -6.5, 3.6, 2.2);
    ctx.strokeStyle = rgba(C.void, 0.45);
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(48, -14);
    ctx.lineTo(50, 18);
    ctx.moveTo(-50, -12);
    ctx.lineTo(-48, 10);
    ctx.moveTo(-103, -37);
    ctx.lineTo(-104, 1);
    ctx.stroke();
  });

  // Canopy glazing with frames.
  const canopy = (c: Ctx): void => {
    c.beginPath();
    c.moveTo(38.5, -13.5);
    c.lineTo(31, -20.5);
    c.bezierCurveTo(22, -23.6, 8, -23, -1, -15);
    c.closePath();
  };
  rimmed(ctx, canopy, C.glass, '#b9c5c6', 0.2, 1.1);
  ctx.strokeStyle = SKIN;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(30.5, -21);
  ctx.lineTo(27, -13.5);
  ctx.moveTo(13, -23);
  ctx.lineTo(12, -14);
  ctx.stroke();

  // Near wing seen almost edge-on, with cannon and rocket rails.
  strokeLine(ctx, [52, 8.4, 66, 8.4], C.ink, 1.5);
  strokeLine(ctx, [52, 10.6, 62, 10.6], C.ink, 1.3);
  rimmed(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(56, 9);
      c.bezierCurveTo(50, 3.5, 10, 3, -30, 8.5);
      c.bezierCurveTo(-10, 13, 40, 14.5, 56, 9);
      c.closePath();
    },
    C.ink,
    RIM,
    0.2,
    1.3,
  );
  rocketOnRail(ctx, 28, 18.5);
  rocketOnRail(ctx, 6, 19.5);

  // Spinner and the blur of the propeller.
  rimPoly(ctx, [92, -9.5, 108, -1.5, 110, 1, 108, 3.5, 92, 11.5], C.ink, RIM, 1.2);
  ctx.fillStyle = 'rgba(20,20,18,0.16)';
  ellipse(ctx, 101, 1, 3.6, 38);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,20,18,0.2)';
  ellipse(ctx, 101, 1, 1.6, 37);
  ctx.fill();
}

/** Soft shadow on the ground: fuselage, wings and tail as layered translucent ellipses. */
function paintShadow(ctx: Ctx): void {
  for (let i = 0; i < 4; i++) {
    const grow = 1 + i * 0.12;
    ctx.fillStyle = 'rgba(0,0,0,0.085)';
    ellipse(ctx, 0, 0, 96 * grow, 4.6 * grow);
    ctx.fill();
    ellipse(ctx, 14, 0, 24 * grow, 13.5 * grow);
    ctx.fill();
    ellipse(ctx, -88, 0, 9 * grow, 6.5 * grow);
    ctx.fill();
  }
}

function paintRocket(ctx: Ctx): void {
  rimRect(ctx, -13, -1.6, 21, 3.2, 1.4, C.inkSoft, RIM, 0.9);
  rimPoly(ctx, [6, -2.6, 9, -2.6, 15, 0, 9, 2.6, 6, 2.6], mix(C.inkSoft, C.steel, 0.5), RIM, 0.9);
  fillPoly(ctx, [-13, -1.6, -15.5, -4.6, -11, -4.6, -8, -1.6], C.ink);
  fillPoly(ctx, [-13, 1.6, -15.5, 4.6, -11, 4.6, -8, 1.6], C.ink);
}

function paintBomb(ctx: Ctx): void {
  // Tail fins and ring first, then the teardrop body.
  fillPoly(ctx, [-13, -4.6, -7, -4.6, -3, -1.5, -3, 1.5, -7, 4.6, -13, 4.6, -11, 0], C.ink);
  rimmed(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(-8, 0);
      c.bezierCurveTo(-6, -5.4, 8, -5.4, 13, 0);
      c.bezierCurveTo(8, 5.4, -6, 5.4, -8, 0);
      c.closePath();
    },
    mix(C.inkSoft, C.drum, 0.45),
    RIM,
    0.2,
    1.2,
  );
  ctx.fillStyle = rgba(C.flagWhite, 0.5);
  ctx.fillRect(5, -3.4, 1.4, 6.8);
  ctx.fillStyle = C.void;
  ctx.beginPath();
  ctx.arc(12.6, 0, 0.9, 0, TAU);
  ctx.fill();
}

export function aircraftSpecs(): SpriteSpec[] {
  return [
    makeSpec(AIR_KEYS.plane, A.planeBox, paintPlane),
    makeSpec(AIR_KEYS.il2, A.planeBox, paintIl2),
    makeSpec(AIR_KEYS.shadow, A.shadowBox, paintShadow),
    makeSpec(AIR_KEYS.rocket, A.rocketBox, paintRocket),
    makeSpec(AIR_KEYS.bomb, A.bombBox, paintBomb),
  ];
}
