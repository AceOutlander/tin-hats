/**
 * The Red Army's call-in aircraft, seen from the side and facing right like ./planes (same boxes and anchors per type,
 * so the upgrade gear and the renderer treat them alike): the Pe-2 dive bomber, the Yak-1 fighter, the Po-2 biplane on
 * recon, and the Il-2 Shturmovik for the air strike (./aircraft registers it). NATIONS.md section 3, supports.
 *
 * Same style as the other nations' planes: a dark body with a light rim, the nation's tint on the upper surfaces over
 * a pale belly, a few darker camouflage patches, glazing, the propeller blur, and the red star on the fuselage and fin.
 */
import { ART_COLORS as C, type PlaneKind } from '../../data/artLayout';
import type { FactionId } from '../../data/schema';
import { type Ctx, TAU, ellipse, fillPoly, inside, redStar, rgba, rimPoly, rimRect, rimmed, strokeLine } from '../props/kit';
import { RIM, marking, propBlur, skin, twoTone } from './planeKit';

const GLASS_RIM = '#b9c5c6';

/** Darker camouflage patches over the upper surfaces: [x, y, rx, ry] ellipses, clipped to the body path. */
function camo(ctx: Ctx, path: (c: Ctx) => void, patches: readonly number[]): void {
  inside(ctx, path, () => {
    ctx.fillStyle = rgba(C.ink, 0.3);
    for (let i = 0; i < patches.length; i += 4) {
      ellipse(ctx, patches[i], patches[i + 1], patches[i + 2], patches[i + 3]);
      ctx.fill();
    }
  });
}

/** Window frames: vertical bars from y0 to y1 at each x. */
function frames(ctx: Ctx, xs: readonly number[], y0: number, y1: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (const x of xs) {
    ctx.moveTo(x, y0);
    ctx.lineTo(x - 0.6, y1);
  }
  ctx.stroke();
}

function wheel(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.fillStyle = '#11120e';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = rgba(RIM, 0.6);
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.arc(x, y, r - 0.6, Math.PI * 1.05, Math.PI * 1.6);
  ctx.stroke();
  ctx.fillStyle = '#4a4d44';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.42, 0, TAU);
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Pe-2: slim fuselage, glazed nose, long greenhouse canopy, long engine nacelles, twin oval fins
// ---------------------------------------------------------------------------

function pe2Fin(c: Ctx, dx: number): void {
  c.beginPath();
  c.moveTo(-112 + dx, -6);
  c.bezierCurveTo(-112 + dx, -24, -122 + dx, -32, -131 + dx, -31);
  c.bezierCurveTo(-140 + dx, -28, -141 + dx, -6, -138 + dx, 8);
  c.bezierCurveTo(-134 + dx, 13, -119 + dx, 11, -114 + dx, 4);
  c.closePath();
}

function paintPe2(ctx: Ctx, f: FactionId): void {
  const S = skin(f);
  // The far fin and the tailplane, behind the fuselage.
  rimmed(ctx, (c) => pe2Fin(c, 3), C.ink, RIM, 0.2, 1);
  rimmed(ctx, (c) => ellipse(c, -122, -5, 22, 2.6), C.ink, RIM, 0, 1);
  const body = (c: Ctx): void => {
    c.beginPath();
    c.moveTo(124, 0);
    c.bezierCurveTo(124, -8, 116, -13, 104, -14);
    c.lineTo(96, -15);
    c.bezierCurveTo(70, -16, 30, -15, -20, -12);
    c.bezierCurveTo(-60, -9, -96, -7, -112, -6);
    c.lineTo(-134, -4);
    c.lineTo(-136, 2);
    c.bezierCurveTo(-100, 6, -40, 11, 20, 12);
    c.bezierCurveTo(60, 13, 96, 12, 112, 8);
    c.bezierCurveTo(120, 6, 124, 4, 124, 0);
    c.closePath();
  };
  twoTone(ctx, body, S, -1, 150);
  camo(ctx, body, [-80, -9, 18, 4, -20, -12, 14, 4, 40, -14, 16, 3]);
  // The near fin, over the tail.
  twoTone(ctx, (c) => pe2Fin(c, 0), S, -1, 150);
  // The glazed nose, and the long canopy over pilot and navigator, the rear gunner's glazing behind it.
  const nose = (c: Ctx): void => {
    c.beginPath();
    c.moveTo(123, -2);
    c.bezierCurveTo(122, -9, 114, -13, 104, -13.5);
    c.lineTo(103, 4);
    c.bezierCurveTo(112, 6, 120, 4, 123, -2);
    c.closePath();
  };
  rimmed(ctx, nose, C.glass, GLASS_RIM, 0.2, 1);
  frames(ctx, [109, 116], -13, 5, rgba(C.void, 0.5));
  const canopy = (c: Ctx): void => {
    c.beginPath();
    c.moveTo(98, -15);
    c.lineTo(88, -24);
    c.lineTo(54, -25);
    c.lineTo(44, -16);
    c.closePath();
  };
  rimmed(ctx, canopy, C.glass, GLASS_RIM, 0.2, 1);
  frames(ctx, [86, 76, 66, 56], -24.5, -15.5, S.body);
  rimmed(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(36, -15.5);
      c.lineTo(30, -21);
      c.lineTo(18, -21);
      c.lineTo(13, -14);
      c.closePath();
    },
    C.glass,
    GLASS_RIM,
    0.2,
    1,
  );
  // The near wing root edge-on, the long engine nacelle reaching back past the wing, its exhausts and propeller.
  rimmed(ctx, (c) => ellipse(c, 16, 4, 56, 3.6), C.ink, RIM, 0.2, 1.2);
  const nacelle = (c: Ctx): void => {
    c.beginPath();
    c.moveTo(92, -4);
    c.bezierCurveTo(88, -11, 60, -12, 40, -9);
    c.bezierCurveTo(10, -6, -10, 0, -18, 4);
    c.bezierCurveTo(-10, 10, 20, 16, 50, 15);
    c.bezierCurveTo(74, 14, 90, 12, 92, 6);
    c.closePath();
  };
  twoTone(ctx, nacelle, S, 2, 150);
  ctx.fillStyle = rgba(C.void, 0.8);
  for (let i = 0; i < 5; i++) ctx.fillRect(48 + i * 7, -6, 4, 1.8);
  fillPoly(ctx, [92, -5, 99, -1, 99.6, 1, 99, 3, 92, 7], C.ink);
  propBlur(ctx, 96, 1, 24);
  // Bomb-bay doors line, red stars on the fuselage and the near fin.
  strokeLine(ctx, [-40, 10.6, 8, 11.8], rgba(C.void, 0.55), 0.8);
  marking(ctx, f, -56, -2.4, 7);
  redStar(ctx, -127, -14, 5.2);
}

// ---------------------------------------------------------------------------
// Yak-1: long slim nose with a pointed spinner, razorback canopy, belly radiator, rounded fin
// ---------------------------------------------------------------------------

function paintYak1(ctx: Ctx, f: FactionId): void {
  const S = skin(f);
  rimmed(ctx, (c) => ellipse(c, -74, -5, 13, 2.2), C.ink, RIM, 0, 1);
  const body = (c: Ctx): void => {
    c.beginPath();
    c.moveTo(72, -1);
    c.bezierCurveTo(70, -7, 60, -9, 40, -10);
    c.lineTo(32, -11);
    c.lineTo(26, -18);
    c.bezierCurveTo(20, -20.5, 6, -20.5, 0, -18);
    c.bezierCurveTo(-8, -16, -24, -12, -40, -9);
    c.bezierCurveTo(-56, -7, -66, -6, -70, -6);
    c.lineTo(-74, -25);
    c.bezierCurveTo(-76, -30, -84, -30, -86, -25);
    c.lineTo(-88, -4);
    c.lineTo(-88, 1);
    c.bezierCurveTo(-60, 5, -40, 8, -26, 9);
    // The radiator bath under the fuselage, behind the wing's leading edge.
    c.lineTo(-24, 13);
    c.bezierCurveTo(-16, 15.5, -6, 15.5, 0, 12.5);
    c.lineTo(4, 9);
    c.bezierCurveTo(40, 9, 60, 7, 72, 3);
    c.closePath();
  };
  twoTone(ctx, body, S, -1, 100);
  camo(ctx, body, [-50, -8, 12, 3, 10, -12, 10, 3, 50, -10, 12, 3]);
  // Canopy: the framed hood over the cockpit and the glazed panel let into the razorback behind it.
  rimmed(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(30, -11.5);
      c.lineTo(25, -18);
      c.bezierCurveTo(18, -20, 6, -20, -2, -17.6);
      c.lineTo(-14, -13);
      c.lineTo(-14, -11.5);
      c.closePath();
    },
    C.glass,
    GLASS_RIM,
    0.2,
    1,
  );
  frames(ctx, [22, 10, -2], -19.5, -11.5, S.body);
  // The radiator's dark mouth and outlet flap.
  fillPoly(ctx, [-23, 12.6, -20, 14.4, -20, 11, -23, 10.4], C.void);
  strokeLine(ctx, [-1, 12.4, 3, 14], C.ink, 1.2);
  // Near wing edge-on.
  rimmed(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(36, 6);
      c.bezierCurveTo(32, 2, 0, 2, -22, 6);
      c.bezierCurveTo(-4, 10, 26, 10.5, 36, 6);
      c.closePath();
    },
    C.ink,
    RIM,
    0.2,
    1.2,
  );
  // Pointed spinner (the cannon fires through it), propeller, exhaust stubs.
  fillPoly(ctx, [72, -5.5, 84, -0.6, 85.5, 0, 84, 0.6, 72, 5.5], C.ink);
  propBlur(ctx, 77, 0, 26);
  ctx.fillStyle = rgba(C.void, 0.85);
  for (let i = 0; i < 6; i++) ctx.fillRect(42 + i * 4, -7.4, 2.6, 1.8);
  marking(ctx, f, -35, -1.8, 5);
  redStar(ctx, -80, -16, 4.2);
}

// ---------------------------------------------------------------------------
// Po-2: a fabric biplane on fixed legs, two open cockpits, the bare five-cylinder radial
// ---------------------------------------------------------------------------

function paintPo2(ctx: Ctx, f: FactionId): void {
  const S = skin(f);
  // Tailplane and the lower wing, behind the fuselage.
  rimmed(ctx, (c) => ellipse(c, -56, -3, 10, 1.8), C.ink, RIM, 0, 1);
  rimmed(ctx, (c) => ellipse(c, 12, 6.5, 14, 1.9), C.ink, RIM, 0.2, 1);
  // Undercarriage legs to the axle, and the wheel.
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(8, 5);
  ctx.lineTo(16, 18);
  ctx.moveTo(22, 5);
  ctx.lineTo(16, 18);
  ctx.stroke();
  wheel(ctx, 16, 19, 4.6);
  const body = (c: Ctx): void => {
    c.beginPath();
    c.moveTo(40, -6);
    c.lineTo(14, -8.5);
    c.lineTo(-30, -8);
    c.lineTo(-56, -4.5);
    c.lineTo(-58, -1);
    c.lineTo(-54, 2);
    c.lineTo(-20, 5);
    c.lineTo(20, 6);
    c.lineTo(40, 5);
    c.closePath();
  };
  twoTone(ctx, body, S, -1, 80);
  // Fin and rudder.
  twoTone(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(-50, -5);
      c.lineTo(-55, -18);
      c.bezierCurveTo(-57, -22, -64, -23, -66, -19);
      c.lineTo(-66, -2);
      c.lineTo(-57, -1.5);
      c.closePath();
    },
    S,
    -1,
    80,
  );
  strokeLine(ctx, [-60, -21, -60, -2], rgba(C.void, 0.45), 0.7);
  // Two open cockpits with their small windscreens and the crew's heads in leather helmets.
  for (const x of [16, -2]) {
    ctx.fillStyle = C.void;
    ctx.fillRect(x - 6, -9, 9, 2);
    ctx.fillStyle = '#1b1c18';
    ctx.beginPath();
    ctx.arc(x - 2, -11.2, 2.6, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = rgba(RIM, 0.7);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.arc(x - 2, -11.2, 2.6, Math.PI, Math.PI * 1.9);
    ctx.stroke();
    fillPoly(ctx, [x + 3, -8.8, x + 5.5, -12, x + 6.5, -12, x + 5, -8.8], rgba(C.glass, 0.9));
  }
  // The upper wing on its cabane struts, the interplane struts down to the lower wing.
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(10, -8);
  ctx.lineTo(12, -20);
  ctx.moveTo(24, -7.5);
  ctx.lineTo(24, -20);
  ctx.moveTo(6, -21);
  ctx.lineTo(4, 6);
  ctx.moveTo(26, -21);
  ctx.lineTo(22, 6);
  ctx.stroke();
  ctx.strokeStyle = rgba(C.ink, 0.6);
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(6, -20);
  ctx.lineTo(22, 5);
  ctx.moveTo(26, -20);
  ctx.lineTo(4, 5);
  ctx.stroke();
  rimmed(ctx, (c) => ellipse(c, 16, -22, 15, 2.1), S.top, RIM, 0.2, 1.2);
  // The bare radial: crankcase, three cylinders showing, the exhaust ring; spinner and propeller.
  rimRect(ctx, 38, -5, 6, 10, 1.5, C.ink, RIM, 0.8);
  for (const [x, y, w, h] of [
    [40, -11, 5, 6],
    [40, 5, 5, 6],
    [44, -3, 5, 6],
  ] as const) {
    rimRect(ctx, x, y, w, h, 1, '#2a2b26', RIM, 0.8);
    ctx.fillStyle = rgba(RIM, 0.5);
    for (let k = 1; k < 4; k++) ctx.fillRect(x + 0.6, y + (h * k) / 4, w - 1.2, 0.5);
  }
  fillPoly(ctx, [49, -2.6, 53, -0.6, 53.6, 0, 53, 0.6, 49, 2.6], C.ink);
  propBlur(ctx, 51, 0, 20);
  // Tail skid, stars on the fuselage and rudder.
  strokeLine(ctx, [-50, 1.6, -54, 6], C.ink, 1.1);
  marking(ctx, f, -26, -1.4, 4);
  redStar(ctx, -61, -11, 3.6);
}

// ---------------------------------------------------------------------------
// I-16 (the fighter of 1941, NATIONS.md section 3): a short barrel of a fuselage behind the big blunt radial cowling,
// the open cockpit with its windscreen and headrest fairing, the small rounded fin. An era look (FOUNDATIONS 5.1).
// ---------------------------------------------------------------------------

/** The I-16 Type 24 in the fighter's box and anchors (PLANE_LAYOUT.fighter), drawn a little over life size. */
export function paintI16(ctx: Ctx, f: FactionId): void {
  const S = skin(f);
  // Tailplane behind the fuselage.
  rimmed(ctx, (c) => ellipse(c, -64, -3, 12, 2.2), C.ink, RIM, 0, 1);
  const body = (c: Ctx): void => {
    c.beginPath();
    // The cowling's front ring, the belly, the taper to the rudder, the fin, then the back, the cockpit and the hump.
    c.moveTo(60, -12);
    c.lineTo(60, 10);
    c.bezierCurveTo(48, 13, 30, 12, 10, 10);
    c.bezierCurveTo(-20, 7, -50, 4, -70, 2);
    c.lineTo(-74, 1);
    c.lineTo(-76, -8);
    c.bezierCurveTo(-78, -20, -70, -24, -64, -20);
    c.lineTo(-60, -8);
    c.bezierCurveTo(-40, -9, -20, -11, -2, -13);
    c.lineTo(4, -17);
    c.lineTo(10, -17);
    c.lineTo(14, -14);
    c.bezierCurveTo(28, -15, 40, -15, 46, -14);
    c.closePath();
  };
  twoTone(ctx, body, S, 0, 100);
  camo(ctx, body, [-40, -6, 12, 3, 20, -10, 10, 3]);
  // The cowling: its front ring, the shutter, and the exhaust stubs round its back edge.
  rimRect(ctx, 54, -12.5, 7, 23, 3, C.ink, RIM, 0.8);
  strokeLine(ctx, [57.5, -10, 57.5, 8], rgba(RIM, 0.5), 0.7);
  ctx.fillStyle = rgba(C.void, 0.85);
  for (let i = 0; i < 4; i++) ctx.fillRect(44, -9 + i * 5, 2.4, 2);
  // The open cockpit: the windscreen ahead of the pilot's head, the headrest fairing behind it.
  rimPoly(ctx, [14, -14, 11, -19, 8, -19, 8, -15], C.glass, GLASS_RIM, 0.8);
  fillPoly(ctx, [4, -17, 6.5, -18.6, 8, -17], C.ink);
  ctx.fillStyle = '#2a2a24';
  ctx.beginPath();
  ctx.arc(5.4, -18.6, 2.4, 0, TAU);
  ctx.fill();
  // Near wing edge-on, low on the fuselage, with the wing gun's muzzle.
  rimmed(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(42, 6);
      c.bezierCurveTo(36, 2, 6, 2, -16, 6);
      c.bezierCurveTo(4, 10, 32, 10.5, 42, 6);
      c.closePath();
    },
    C.ink,
    RIM,
    0.2,
    1.2,
  );
  strokeLine(ctx, [42, 5, 50, 5], C.ink, 1.1);
  // The propeller hub and blur.
  fillPoly(ctx, [60, -4, 66, -1, 66, 1, 60, 4], C.ink);
  propBlur(ctx, 64, 0, 26);
  marking(ctx, f, -30, -1.2, 4.6);
  redStar(ctx, -70, -12, 3.8);
}

export const SOVIET_PLANES: Record<PlaneKind, (ctx: Ctx, f: FactionId) => void> = {
  bomber: paintPe2,
  fighter: paintYak1,
  recon: paintPo2,
};

// ---------------------------------------------------------------------------
// Il-2 Shturmovik: the long armoured nose, the humped two-seat canopy, the wheel pods under the wing (AIR_LAYOUT)
// ---------------------------------------------------------------------------

function il2Rocket(ctx: Ctx, x: number, y: number): void {
  // An RS-82 under its launch rail: a slim motor, the pointed head and the cross of fins.
  strokeLine(ctx, [x - 9, y - 2.4, x + 7, y - 2.4], C.ink, 1);
  rimRect(ctx, x - 11, y - 1.4, 18, 2.8, 1.3, C.inkSoft, RIM, 0.8);
  fillPoly(ctx, [x + 7, y - 1.9, x + 12, y, x + 7, y + 1.9], C.inkSoft);
  fillPoly(ctx, [x - 11, y - 1.4, x - 14, y - 4, x - 12, y, x - 14, y + 4, x - 11, y + 1.4], C.ink);
}

export function paintIl2(ctx: Ctx): void {
  const S = skin('soviet');
  rimmed(ctx, (c) => ellipse(c, -100, -6.5, 15, 2.6), C.ink, RIM, 0, 1);
  const body = (c: Ctx): void => {
    c.beginPath();
    c.moveTo(92, -8);
    c.bezierCurveTo(80, -12, 60, -13.5, 42, -13.5);
    c.lineTo(36, -14);
    c.lineTo(30, -22);
    c.bezierCurveTo(24, -25, 10, -25, 4, -21);
    c.lineTo(2, -19.5);
    c.bezierCurveTo(-6, -20.5, -14, -19, -18, -15);
    c.bezierCurveTo(-40, -11, -70, -8.5, -90, -7);
    c.lineTo(-98, -33);
    c.bezierCurveTo(-100, -38, -110, -38, -112, -33);
    c.lineTo(-114, -4);
    c.lineTo(-115, 2);
    c.bezierCurveTo(-90, 6, -40, 11, -6, 13);
    c.bezierCurveTo(14, 14, 30, 16, 44, 16);
    c.bezierCurveTo(64, 16, 80, 15, 88, 12);
    c.lineTo(92, 8);
    c.closePath();
  };
  twoTone(ctx, body, S, 0, 130);
  camo(ctx, body, [-70, -9, 16, 4, -30, -14, 12, 4, 20, -14, 10, 3, 66, -12, 14, 3]);
  // The armour's panel lines over the nose and cockpit tub, the intake on top of the cowling, the oil cooler under it.
  ctx.strokeStyle = rgba(C.void, 0.45);
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(52, -13);
  ctx.lineTo(54, 15.5);
  ctx.moveTo(36, -14);
  ctx.lineTo(38, 16);
  ctx.moveTo(-18, -14.5);
  ctx.lineTo(-16, 12.5);
  ctx.moveTo(-104, -32);
  ctx.lineTo(-105, 2);
  ctx.stroke();
  rimRect(ctx, 40, -16.4, 10, 3, 1, C.ink, RIM, 0.8);
  fillPoly(ctx, [78, 12.6, 87, 11.6, 87, 15, 79, 16], C.void);
  ctx.fillStyle = rgba(C.void, 0.85);
  for (let i = 0; i < 6; i++) ctx.fillRect(58 + i * 4.6, -9.4, 3, 2);
  // The pilot's armoured canopy and the rear gunner's glazing with his machine gun pointing aft.
  rimmed(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(35, -14);
      c.lineTo(29.5, -21.5);
      c.bezierCurveTo(23, -24, 11, -24, 5, -20.5);
      c.lineTo(4, -14.5);
      c.closePath();
    },
    C.glass,
    GLASS_RIM,
    0.2,
    1.1,
  );
  frames(ctx, [27, 15], -23, -14.5, S.body);
  rimmed(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(2, -19);
      c.bezierCurveTo(-4, -21, -12, -20, -16, -15.5);
      c.lineTo(2, -15);
      c.closePath();
    },
    C.glass,
    GLASS_RIM,
    0.2,
    1,
  );
  strokeLine(ctx, [-6, -19, -22, -24.5], C.ink, 1.5);
  // Near wing edge-on, the wheel pod hanging under it with the tyre showing below, the wing cannon.
  strokeLine(ctx, [50, 8.4, 64, 8.4], C.ink, 1.5);
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
  wheel(ctx, 56, 20.5, 5);
  rimmed(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(70, 12);
      c.bezierCurveTo(68, 9, 60, 9, 40, 10);
      c.lineTo(38, 15);
      c.bezierCurveTo(46, 20, 62, 20, 70, 16);
      c.closePath();
    },
    S.body,
    RIM,
    0.2,
    1.1,
  );
  il2Rocket(ctx, 28, 18.5);
  il2Rocket(ctx, 6, 19.5);
  // Spinner and the blur of the big three-bladed propeller.
  rimPoly(ctx, [92, -9, 106, -2, 108, 0.5, 106, 3, 92, 10], C.ink, RIM, 1.2);
  ctx.fillStyle = 'rgba(20,20,18,0.16)';
  ellipse(ctx, 100, 0.5, 3.6, 37);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,20,18,0.2)';
  ellipse(ctx, 100, 0.5, 1.6, 36);
  ctx.fill();
  marking(ctx, 'soviet', -52, -1, 6);
  redStar(ctx, -105, -20, 5);
}
