/**
 * The German era looks (FOUNDATIONS.md 5.1; HISTORY.md, German equipment by date), drawn on the Panzer III and
 * Panzer IV rigs so they share the running gear:
 *
 * - Panzer III Ausf. H (1940 to 1942): the Ausf. E's turret with the external mantlet and the short 5 cm KwK 38 L/42.
 * - Panzer III Ausf. L (from mid-1942, the "later Panzer III" of the Stalingrad battles): the long 5 cm KwK 39 L/60,
 *   a 20 mm spaced plate standing in front of the mantlet and of the driver's front plate, spare track links on the
 *   bow and a stowage bin on the turret rear. No side skirts (Schürzen came in 1943).
 * - Panzer IV Ausf. G (from mid-1942): the long 7.5 cm KwK 40 L/43 with its double-baffle muzzle brake.
 * - StuG III Ausf. B (1941) and Ausf. F (1942): the low hull and the fixed casemate (drawn as the rig's "turret") with
 *   the short 7.5 cm StuK 37 L/24, or the long StuK 40 L/43 with its muzzle brake and the roof fan.
 *
 * Tank space as in ./tanks (origin on the ground under the hull centre, facing +x, y up negative); turrets in turret
 * space (origin = turret ring); guns from the trunnion along +x. Markings: the plain Balkenkreuz only.
 */
import { ART_COLORS as C } from '../../data/artLayout';
import { type Ctx, TAU, balkenkreuz, fillPoly, mix, rgba, rimPoly, rimRect, strokeLine } from '../props/kit';
import { smallTankHull, smallTankTurretBody } from './lightVehicles';
import type { TankPalette } from './tanks';

function disc(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Panzer III Ausf. H and Ausf. L
// ---------------------------------------------------------------------------

/** The external mantlet of the 5 cm guns: a wide curved plate over the inner one, with the coaxial MG34's port. */
function externalMantlet(ctx: Ctx, P: TankPalette): void {
  rimPoly(ctx, [22, -16.5, 28, -17, 31, -14, 31, -4.5, 28, -2, 22, -2.5], P.body, P.rim, 1.1);
  strokeLine(ctx, [25, -15.5, 25, -3.5], rgba(C.ink, 0.4), 0.7);
  disc(ctx, 29.4, -5, 0.9, C.void);
}

/** Panzer III Ausf. H: the turret with the external mantlet. */
export function panzer3hTurret(ctx: Ctx, P: TankPalette): void {
  smallTankTurretBody(ctx, P);
  externalMantlet(ctx, P);
  balkenkreuz(ctx, 7, -9.5, 6.4);
}

/** Panzer III Ausf. L: the stowage bin on the turret rear, the external mantlet and the spaced plate in front of it. */
export function panzer3lTurret(ctx: Ctx, P: TankPalette): void {
  // The big stowage bin ("Rommelkiste") hung on the turret rear, its lid and hasp.
  rimRect(ctx, -39.5, -19, 13, 16, 1.6, P.panelLit, P.rim, 1);
  strokeLine(ctx, [-38.6, -14.5, -27.4, -14.5], rgba(C.ink, 0.45), 0.8);
  ctx.fillStyle = rgba(C.ink, 0.5);
  ctx.fillRect(-34, -13.6, 2, 2.4);
  smallTankTurretBody(ctx, P);
  externalMantlet(ctx, P);
  // The roof ventilator of the J and L.
  rimRect(ctx, 2, -23, 7, 3.2, 1.2, P.bodyDark, P.rim, 0.7);
  // The 20 mm spaced plate standing well proud of the mantlet on two brackets, the gap dark behind it.
  ctx.fillStyle = C.void;
  ctx.fillRect(31, -15, 2.4, 2.4);
  ctx.fillRect(31, -6, 2.4, 2.4);
  rimPoly(ctx, [33.4, -19.5, 37, -19, 37, -0.8, 33.4, 0], P.panelLit, P.rim, 1);
  strokeLine(ctx, [35.2, -18.4, 35.2, -1.4], rgba(C.ink, 0.35), 0.6);
  balkenkreuz(ctx, 5, -9.5, 6.4);
}

/** Panzer III Ausf. L hull: the Ausf. E hull with the spaced plate before the driver and spare track links on the bow. */
export function panzer3lHull(ctx: Ctx, P: TankPalette): void {
  smallTankHull(ctx, P);
  // Two spare road wheels hung on the rear of the hull side, a jerrycan rack on the engine deck.
  for (const x of [-66, -55]) {
    disc(ctx, x, -36, 4.6, '#11120e');
    disc(ctx, x, -36, 2.8, P.panel);
    disc(ctx, x, -36, 0.9, P.bodyDark);
  }
  for (let i = 0; i < 3; i++) rimRect(ctx, -72 + i * 5.2, -47.6, 4.4, 5, 0.8, P.panelLit, P.rim, 0.7);
  // The 20 mm spaced plate in front of the superstructure's front plate (the driver's visor looks through a slot in it).
  ctx.fillStyle = C.void;
  ctx.fillRect(48.5, -49, 3, 9);
  rimPoly(ctx, [51.5, -51.5, 55.5, -51, 55.5, -39.6, 51.5, -39], P.panelLit, P.rim, 1);
  ctx.fillStyle = C.void;
  ctx.fillRect(52.4, -47.4, 2.2, 3.2);
  // Spare track links hung across the sloped bow plate.
  ctx.fillStyle = C.trackBand;
  for (let i = 0; i < 4; i++) ctx.fillRect(57 + i * 4.6, -38.4 + i * 1.1, 3.6, 2.4);
  ctx.fillStyle = rgba(P.rim, 0.35);
  for (let i = 0; i < 4; i++) ctx.fillRect(57 + i * 4.6, -38.4 + i * 1.1, 3.6, 0.6);
}

/** The short 5 cm KwK 38 L/42: thicker than the 3.7 cm, a long recoil sleeve and a plain muzzle. Origin = trunnion. */
export function panzer3hBarrel(ctx: Ctx, P: TankPalette, len: number): void {
  rimRect(ctx, -6, -2.1, len + 6, 4.2, 0.9, P.bodyDark, P.rim, 1);
  rimRect(ctx, -4, -3.2, 14, 6.4, 1.2, P.bodyDark, P.rim, 1);
  rimRect(ctx, len - 3, -2.6, 3, 5.2, 0.6, P.bodyDark, P.rim, 0.9);
}

/** The long 5 cm KwK 39 L/60: the same sleeve, a long tube tapering to the muzzle, no brake. Origin = trunnion. */
export function panzer3lBarrel(ctx: Ctx, P: TankPalette, len: number): void {
  rimPoly(ctx, [-6, -2.2, 12, -2.2, 14, -1.8, len - 3, -1.5, len - 3, -2, len, -2, len, 2, len - 3, 2, len - 3, 1.5, 14, 1.8, 12, 2.2, -6, 2.2], P.bodyDark, P.rim, 1);
  rimRect(ctx, -4, -3.2, 14, 6.4, 1.2, P.bodyDark, P.rim, 1);
  strokeLine(ctx, [14, -0.7, len - 4, -0.5], rgba(P.rim, 0.35), 0.6);
}

// ---------------------------------------------------------------------------
// Panzer IV Ausf. G
// ---------------------------------------------------------------------------

/** The double-baffle muzzle brake of the long 7.5 cm guns, ending at `len`. */
function muzzleBrake(ctx: Ctx, P: TankPalette, len: number, half: number): void {
  rimRect(ctx, len - 9, -half, 4, half * 2, 0.8, P.bodyDark, P.rim, 0.9);
  rimRect(ctx, len - 4, -half, 4, half * 2, 0.8, P.bodyDark, P.rim, 0.9);
  ctx.fillStyle = C.void;
  ctx.fillRect(len - 5, -half + 1, 1, half * 2 - 2);
}

/** The long 7.5 cm KwK 40 L/43: a recoil sleeve at the mantlet, a long tube and the double-baffle brake. */
export function panzer4gBarrel(ctx: Ctx, P: TankPalette, len: number): void {
  rimRect(ctx, -9, -3.2, 22, 6.4, 1.2, P.bodyDark, P.rim, 1);
  rimPoly(ctx, [13, -2.8, len - 9, -2.3, len - 9, 2.3, 13, 2.8], P.bodyDark, P.rim, 1);
  strokeLine(ctx, [14, -1, len - 10, -0.8], rgba(P.rim, 0.35), 0.7);
  muzzleBrake(ctx, P, len, 3.8);
}

// ---------------------------------------------------------------------------
// StuG III Ausf. B and Ausf. F
// ---------------------------------------------------------------------------

/** The StuG's hull: the Panzer III's fenders and running gear covers, the engine deck and the low bow; no turret. */
export function stugHull(ctx: Ctx, P: TankPalette): void {
  // Fenders and the rear mudflap, as on the Panzer III.
  rimPoly(ctx, [-82, -29, -80, -32, 74, -32, 80, -35, 81.5, -33.5, 76, -29.2], P.body, P.rim, 1);
  fillPoly(ctx, [-82, -30, -79.5, -30, -81, -23, -83.5, -24], P.body);
  // The tail, the raised engine deck, the low hull under the casemate and the sloped bow plate.
  rimPoly(ctx, [-78, -31, -76, -43, -36, -44, -32, -41, 50, -41, 76, -32, 74, -31], P.body, P.rim, 1.2);
  fillPoly(ctx, [-74, -34, -73, -41, -37, -41.8, -34, -39, 48, -39, 69, -33.5, 69, -34], P.panel);
  // Engine deck louvres and the hatch, the tow cable along the side, the muffler.
  ctx.fillStyle = P.bodyDark;
  for (let i = 0; i < 3; i++) ctx.fillRect(-72, -41.5 + i * 2.4, 14, 1.1);
  rimRect(ctx, -54, -45.6, 14, 2.6, 0.8, P.bodyDark, P.rim, 0.8);
  strokeLine(ctx, [-30, -35.5, 40, -35.5], P.bodyDark, 1.2);
  rimRect(ctx, -88, -30, 7, 11, 3, mix(C.rust, C.ink, 0.35), P.rim, 1);
  // Spare road wheel on the engine deck side and the bow's tow hook.
  disc(ctx, -46, -37, 4.4, '#11120e');
  disc(ctx, -46, -37, 2.6, P.panel);
  rimRect(ctx, 74, -33, 4, 2.2, 0.8, P.bodyDark, P.rim, 0.7);
}

/**
 * The casemate (turret space, on the hull at y = +6 down to its roof): sloped side plates, the rear wall, the roof
 * with the hatches, the front plate with the gun low in it. `late` = Ausf. F: the roof fan and the taller front.
 */
function stugCasemate(ctx: Ctx, P: TankPalette, late: boolean): void {
  rimPoly(ctx, [-44, 6, -42, -9, -37, -12, 22, -12, 40, -3, 46, 6], P.body, P.rim, 1.3);
  fillPoly(ctx, [-40.4, 3.4, -38.8, -7.6, -35.4, -9.6, 21, -9.6, 37.6, -2, 41.6, 3.4], P.panel);
  // The sloped side plates' lower edge in shadow, the vision slit and the side panniers' joint.
  fillPoly(ctx, [-40.4, 3.4, 41.6, 3.4, 42.4, 5, -41, 5], rgba(C.ink, 0.35));
  strokeLine(ctx, [-38, -3, 34, -3], rgba(C.ink, 0.3), 0.7);
  ctx.fillStyle = C.void;
  ctx.fillRect(18, -7, 7, 1.1);
  // Roof: the commander's hatch and his scissors periscope, the loader's hatch; on the F, the ventilator dome.
  rimPoly(ctx, [-30, -11.6, -28, -14.5, -16, -14.5, -14, -11.6], P.bodyDark, P.rim, 0.9);
  rimRect(ctx, -6, -15.6, 3, 3.8, 0.6, P.bodyDark, P.rim, 0.7);
  rimPoly(ctx, [2, -11.6, 3.5, -13.8, 12, -13.8, 13.5, -11.6], P.bodyDark, P.rim, 0.8);
  if (late) rimRect(ctx, 16, -14, 6, 2.6, 1.2, P.bodyDark, P.rim, 0.7);
  balkenkreuz(ctx, -8, -2.5, 7);
  // The gun's mantlet low in the front plate (trunnion at (38, -6)).
  if (late) rimPoly(ctx, [33, -11, 41, -10.5, 44, -6, 41, -1.5, 33, -1], P.body, P.rim, 1);
  else rimRect(ctx, 34, -10.5, 9, 9, 1.4, P.body, P.rim, 1);
}

export function stug3bCasemate(ctx: Ctx, P: TankPalette): void {
  stugCasemate(ctx, P, false);
}

export function stug3fCasemate(ctx: Ctx, P: TankPalette): void {
  stugCasemate(ctx, P, true);
}

/** The short 7.5 cm StuK 37 L/24: a stubby, thick tube with a slight muzzle lip. Origin = trunnion. */
export function stug3bBarrel(ctx: Ctx, P: TankPalette, len: number): void {
  rimRect(ctx, -6, -3.6, len + 6, 7.2, 1.2, P.bodyDark, P.rim, 1);
  rimRect(ctx, len - 3.5, -4.1, 3.5, 8.2, 0.8, P.bodyDark, P.rim, 0.9);
  strokeLine(ctx, [2, -1.4, len - 5, -1.4], rgba(P.rim, 0.35), 0.7);
}

/** The long 7.5 cm StuK 40 L/43: the recoil sleeve, the long tube and the double-baffle brake. Origin = trunnion. */
export function stug3fBarrel(ctx: Ctx, P: TankPalette, len: number): void {
  rimRect(ctx, -6, -3.2, 18, 6.4, 1.2, P.bodyDark, P.rim, 1);
  rimPoly(ctx, [12, -2.8, len - 9, -2.3, len - 9, 2.3, 12, 2.8], P.bodyDark, P.rim, 1);
  strokeLine(ctx, [13, -1, len - 10, -0.8], rgba(P.rim, 0.35), 0.7);
  muzzleBrake(ctx, P, len, 3.8);
}
