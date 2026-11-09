/**
 * Call-in aircraft seen from the side, facing right (the renderer mirrors them): a twin-engine bomber, a
 * single-engine fighter and a high-wing recon plane for each nation, and a ground shadow per type. The British
 * planes carry a roundel and fin flash, the German ones the plain Balkenkreuz; the Red Army flies its own types
 * (./sovietPlanes: Pe-2, Yak-1, Po-2) with a red star. Nothing else.
 *
 * The shapes are readable at phone size: a dark body with a light rim like every unit, the nation's tint on the
 * upper surfaces, a pale belly, glazing and a propeller blur.
 */
import { ART_COLORS as C, PLANE_LAYOUT, type PlaneKind } from '../../data/artLayout';
import { PLANE_GEAR_ART, PLANE_GEAR_NATION } from '../../data/looksGear';
import { PLANE_GEAR_STEPS, type PlaneGearPiece } from '../../data/upgradeLooks';
import { FACTIONS } from '../../data/factions';
import type { FactionId } from '../../data/schema';
import { type Ctx, TAU, balkenkreuz, ellipse, fillPoly, makeSpec, rgba, rimmed } from '../props/kit';
import type { SpriteSpec } from '../types';
import { RIM, finFlash, marking, propBlur, skin, twoTone } from './planeKit';
import { SOVIET_PLANES } from './sovietPlanes';

export const PLANE_KINDS: readonly PlaneKind[] = ['bomber', 'fighter', 'recon'];

export function planeKey(kind: PlaneKind, faction: FactionId): string {
  return `veh/air/${kind}/${faction}`;
}

export function planeShadowKey(kind: PlaneKind): string {
  return `veh/air/shadow/${kind}`;
}

// ---------------------------------------------------------------------------
// Bomber: twin engines, glazed nose, twin or single fin
// ---------------------------------------------------------------------------

function paintBomber(ctx: Ctx, f: FactionId): void {
  const S = skin(f);
  const german = FACTIONS[f].look.flag === 'balkenkreuz';
  // Tailplane behind.
  rimmed(ctx, (c) => ellipse(c, -118, -6, 20, 3), C.ink, RIM, 0, 1);
  const body = (c: Ctx): void => {
    c.beginPath();
    c.moveTo(german ? 128 : 120, -2);
    c.bezierCurveTo(german ? 126 : 112, -16, 96, -17, 70, -16);
    c.bezierCurveTo(30, -15, -40, -13, -100, -8);
    c.lineTo(-118, -42);
    c.bezierCurveTo(-122, -47, -132, -47, -134, -42);
    c.lineTo(-136, -4);
    c.lineTo(-138, 3);
    c.bezierCurveTo(-100, 8, -20, 13, 60, 13);
    c.bezierCurveTo(96, 13, 118, 10, german ? 128 : 120, -2);
    c.closePath();
  };
  twoTone(ctx, body, S, -2, 150);
  // Nose glazing (German: the fully glazed nose; British: a cockpit canopy and a nose turret).
  if (german) {
    rimmed(ctx, (c) => {
      c.beginPath();
      c.moveTo(126, -2);
      c.bezierCurveTo(124, -14, 108, -16, 96, -15);
      c.lineTo(98, 6);
      c.bezierCurveTo(112, 8, 124, 6, 126, -2);
      c.closePath();
    }, C.glass, '#b9c5c6', 0.2, 1);
    ctx.strokeStyle = rgba(C.void, 0.5);
    ctx.lineWidth = 0.7;
    for (const x of [104, 112, 119]) {
      ctx.beginPath();
      ctx.moveTo(x, -15);
      ctx.lineTo(x, 7);
      ctx.stroke();
    }
  } else {
    rimmed(ctx, (c) => {
      c.beginPath();
      c.moveTo(88, -16);
      c.bezierCurveTo(84, -27, 62, -27, 56, -16);
      c.closePath();
    }, C.glass, '#b9c5c6', 0.2, 1);
    rimmed(ctx, (c) => ellipse(c, 114, -4, 9, 8), C.glass, '#b9c5c6', 0.2, 1);
  }
  // Wing root (edge-on), the near engine nacelle and its propeller.
  rimmed(ctx, (c) => ellipse(c, 20, 4, 54, 4), C.ink, RIM, 0.2, 1.2);
  rimmed(ctx, (c) => {
    c.beginPath();
    c.moveTo(76, -6);
    c.bezierCurveTo(70, -12, 40, -12, 22, -6);
    c.lineTo(22, 12);
    c.bezierCurveTo(40, 16, 70, 14, 76, 8);
    c.closePath();
  }, S.body, RIM, 0.2, 1.2);
  ctx.fillStyle = rgba(C.void, 0.8);
  for (let i = 0; i < 4; i++) ctx.fillRect(30 + i * 8, -4, 4, 1.8);
  propBlur(ctx, 80, 1, 24);
  // Bomb-bay doors line, markings.
  ctx.strokeStyle = rgba(C.void, 0.55);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-36, 11);
  ctx.lineTo(16, 12.5);
  ctx.stroke();
  marking(ctx, f, -62, -3, 7);
  finFlash(ctx, f, -132, -38, 10, 14);
  if (german) balkenkreuz(ctx, -124, -28, 8);
}

// ---------------------------------------------------------------------------
// Fighter: slim nose, bubble or framed canopy, wing guns
// ---------------------------------------------------------------------------

function paintFighter(ctx: Ctx, f: FactionId): void {
  const S = skin(f);
  const german = FACTIONS[f].look.flag === 'balkenkreuz';
  rimmed(ctx, (c) => ellipse(c, -70, -5, 13, 2.4), C.ink, RIM, 0, 1);
  const body = (c: Ctx): void => {
    c.beginPath();
    c.moveTo(70, -4);
    c.bezierCurveTo(66, -10, 50, -11, 30, -11);
    c.lineTo(22, -19);
    c.bezierCurveTo(14, -22, 0, -22, -6, -12);
    c.bezierCurveTo(-26, -10, -50, -7, -62, -6);
    c.lineTo(german ? -72 : -70, -28);
    c.bezierCurveTo(german ? -75 : -74, -31, -82, -31, -84, -27);
    c.lineTo(-86, -3);
    c.lineTo(-86, 2);
    c.bezierCurveTo(-60, 6, -20, 9, 20, 10);
    c.bezierCurveTo(46, 11, 62, 8, 70, 4);
    c.closePath();
  };
  twoTone(ctx, body, S, -1, 100);
  // Canopy.
  rimmed(ctx, (c) => {
    c.beginPath();
    c.moveTo(28, -11.5);
    c.lineTo(21, -18);
    c.bezierCurveTo(13, -20.6, 2, -20, -4, -12);
    c.closePath();
  }, C.glass, '#b9c5c6', 0.2, 1);
  if (german) {
    ctx.strokeStyle = S.body;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(14, -20);
    ctx.lineTo(13, -12);
    ctx.moveTo(4, -19);
    ctx.lineTo(4, -12);
    ctx.stroke();
  }
  // Near wing edge-on and its gun barrels.
  rimmed(ctx, (c) => {
    c.beginPath();
    c.moveTo(40, 6);
    c.bezierCurveTo(36, 2, 0, 2, -24, 6);
    c.bezierCurveTo(-6, 10, 30, 11, 40, 6);
    c.closePath();
  }, C.ink, RIM, 0.2, 1.2);
  fillPoly(ctx, [40, 4.6, 50, 4.6, 50, 5.8, 40, 5.8], C.ink);
  // Spinner, propeller, exhausts, markings.
  fillPoly(ctx, [70, -5, 80, -1, 81, 0, 80, 1, 70, 5], C.ink);
  propBlur(ctx, 76, 0, 26);
  ctx.fillStyle = rgba(C.void, 0.85);
  for (let i = 0; i < 4; i++) ctx.fillRect(40 + i * 5, -7, 3, 1.8);
  marking(ctx, f, -36, -2, 5.2);
  finFlash(ctx, f, -84, -26, 8, 10);
  if (german) {
    // A yellow theatre band on the nose of the Messerschmitt.
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = rgba('#b89a3a', 0.8);
    ctx.fillRect(56, -14, 6, 30);
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Recon: a high-wing spotter on long legs, the wing above the cabin
// ---------------------------------------------------------------------------

function paintRecon(ctx: Ctx, f: FactionId): void {
  const S = skin(f);
  rimmed(ctx, (c) => ellipse(c, -54, -6, 11, 2), C.ink, RIM, 0, 1);
  const body = (c: Ctx): void => {
    c.beginPath();
    c.moveTo(46, -4);
    c.bezierCurveTo(44, -10, 34, -12, 22, -13);
    c.lineTo(-4, -14);
    c.bezierCurveTo(-24, -10, -44, -7, -50, -6);
    c.lineTo(-56, -24);
    c.bezierCurveTo(-58, -27, -64, -27, -66, -24);
    c.lineTo(-66, 0);
    c.bezierCurveTo(-40, 3, -10, 8, 18, 8);
    c.bezierCurveTo(34, 8, 42, 5, 46, -4);
    c.closePath();
  };
  twoTone(ctx, body, S, -2, 80);
  // Big glazed cabin under the wing.
  rimmed(ctx, (c) => {
    c.beginPath();
    c.moveTo(22, -13);
    c.lineTo(28, -2);
    c.lineTo(-2, -1);
    c.lineTo(-4, -14);
    c.closePath();
  }, C.glass, '#b9c5c6', 0.2, 1);
  ctx.strokeStyle = rgba(C.void, 0.5);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(10, -14);
  ctx.lineTo(12, -1);
  ctx.stroke();
  // The high wing seen edge-on above the cabin, its strut, and the long undercarriage legs.
  rimmed(ctx, (c) => ellipse(c, 8, -16, 40, 2.6), C.ink, RIM, 0.2, 1.2);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-10, -14);
  ctx.lineTo(-2, 4);
  ctx.moveTo(12, 8);
  ctx.lineTo(18, 20);
  ctx.moveTo(4, 8);
  ctx.lineTo(10, 20);
  ctx.stroke();
  ctx.fillStyle = '#11120e';
  ctx.beginPath();
  ctx.arc(16, 21, 3, 0, TAU);
  ctx.fill();
  // Camera port and markings.
  ctx.fillStyle = C.void;
  ctx.fillRect(-20, 4, 4, 3);
  fillPoly(ctx, [46, -4, 53, -1, 53, 1, 46, 3], C.ink);
  propBlur(ctx, 50, 0, 18);
  marking(ctx, f, -30, -3, 4.4);
  finFlash(ctx, f, -65, -22, 7, 8);
}

const WESTERN_PLANES: Record<PlaneKind, (ctx: Ctx, f: FactionId) => void> = {
  bomber: paintBomber,
  fighter: paintFighter,
  recon: paintRecon,
};

/** The painters each nation flies: the British and German types share the western shapes, the Red Army has its own. */
const PLANES_BY_NATION: Record<FactionId, Record<PlaneKind, (ctx: Ctx, f: FactionId) => void>> = {
  british: WESTERN_PLANES,
  german: WESTERN_PLANES,
  soviet: SOVIET_PLANES,
};

function paintPlane(ctx: Ctx, kind: PlaneKind, f: FactionId): void {
  PLANES_BY_NATION[f][kind](ctx, f);
}

// ---------------------------------------------------------------------------
// Upgrade gear (PLANE_GEAR_STEPS): stripes, a drop tank, a painted nose with mission tallies
// ---------------------------------------------------------------------------

/** The sprite of a plane at a gear level (1 to 3); level 0 is planeKey. */
export function planeGearKey(kind: PlaneKind, faction: FactionId, level: number): string {
  return level <= 0 ? planeKey(kind, faction) : `veh/air/${kind}/${faction}/gear${Math.min(3, Math.floor(level))}`;
}

function has(piece: PlaneGearPiece, level: number): boolean {
  return PLANE_GEAR_STEPS.some((s) => s.piece === piece && s.level <= level);
}

function paintPlaneGear(ctx: Ctx, kind: PlaneKind, f: FactionId, level: number): void {
  const G = PLANE_GEAR_ART[kind];
  const N = PLANE_GEAR_NATION[f];
  if (has('stripes', level)) {
    // Painted on the fuselage only (source-atop keeps the paint inside what is drawn).
    const S = G.stripes;
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    for (let i = 0; i < S.n; i++) {
      ctx.fillStyle = N.stripes[i % N.stripes.length];
      ctx.fillRect(S.x + i * S.w, S.y0, S.w + 0.2, S.y1 - S.y0);
    }
    ctx.restore();
  }
  if (has('nose', level)) {
    const S = G.nose;
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = rgba(N.nose, 0.9);
    ctx.fillRect(S.x0, S.y0, S.x1 - S.x0, S.y1 - S.y0);
    ctx.restore();
    // Mission tallies: small pale bars under the cockpit.
    ctx.fillStyle = N.tally;
    for (let i = 0; i < S.n; i++) ctx.fillRect(S.tallyX + i * S.dx, S.tallyY, 1.6, 4.2);
  }
  if (has('dropTank', level)) {
    const T = G.dropTank;
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(T.x - T.rx * 0.3, T.y - T.ry);
    ctx.lineTo(T.x - T.rx * 0.3, T.y - T.ry - 3);
    ctx.moveTo(T.x + T.rx * 0.3, T.y - T.ry);
    ctx.lineTo(T.x + T.rx * 0.3, T.y - T.ry - 3);
    ctx.stroke();
    rimmed(ctx, (c) => ellipse(c, T.x, T.y, T.rx, T.ry), N.tank, RIM, 0.2, 1.2);
  }
}

/** The plane sprites of one type and nation at a gear level (empty at level 0, which is the plain plane). */
export function planeGearSpecs(kind: PlaneKind, faction: FactionId, level: number): SpriteSpec[] {
  if (level <= 0) return [];
  const L = PLANE_LAYOUT[kind];
  const T = PLANE_GEAR_ART[kind].dropTank;
  // Room under the belly for the drop tank.
  const below = Math.max(L.box.h - L.box.oy, Math.ceil(T.y + T.ry + 2));
  const box = { w: L.box.w, h: L.box.oy + below, ox: L.box.ox, oy: L.box.oy };
  return [
    makeSpec(planeGearKey(kind, faction, level), box, (ctx) => {
      paintPlane(ctx, kind, faction);
      paintPlaneGear(ctx, kind, faction, level);
    }),
  ];
}

/** Soft shadow on the ground, stretched to the type's span. */
function paintPlaneShadow(ctx: Ctx, kind: PlaneKind): void {
  const B = PLANE_LAYOUT[kind].shadowBox;
  const hw = B.w * 0.42;
  for (let i = 0; i < 4; i++) {
    const grow = 1 + i * 0.12;
    ctx.fillStyle = 'rgba(0,0,0,0.085)';
    ellipse(ctx, 0, 0, hw * grow, B.h * 0.14 * grow);
    ctx.fill();
    ellipse(ctx, hw * 0.12, 0, hw * 0.3 * grow, B.h * 0.36 * grow);
    ctx.fill();
  }
}

export function planeSpecs(): SpriteSpec[] {
  const out: SpriteSpec[] = [];
  for (const kind of PLANE_KINDS) {
    const L = PLANE_LAYOUT[kind];
    for (const f of Object.keys(FACTIONS) as FactionId[]) out.push(makeSpec(planeKey(kind, f), L.box, (ctx) => paintPlane(ctx, kind, f)));
    out.push(makeSpec(planeShadowKey(kind), L.shadowBox, (ctx) => paintPlaneShadow(ctx, kind)));
  }
  return out;
}
