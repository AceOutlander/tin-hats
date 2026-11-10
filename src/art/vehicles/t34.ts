/**
 * The T-34/76 as fielded in 1942 (NATIONS.md section 3, tank): five big Christie road wheels a side with no return
 * rollers (the track's top run rests on the wheels), the drive sprocket at the rear, the long sloped glacis and
 * sloped upper hull sides, the external fuel drums at the rear, and the wide welded turret with its rear overhang,
 * the big one-piece hatch and the cast mantlet of the 76.2 mm F-34 gun. Tank space as in ./tanks: origin on the
 * ground under the hull centre, facing +x, y up negative. Marked with a red star on the turret.
 */
import { ART_COLORS as C } from '../../data/artLayout';
import { type Ctx, TAU, fillPoly, mix, redStar, rgba, rimPoly, rimRect, strokeLine } from '../props/kit';
import type { TankPalette } from './tanks';

function disc(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

/** The big rubber-tyred road wheel: dark tyre, dished disc with lightening holes, hub with bolts. Origin = hub. */
export function t34Wheel(ctx: Ctx, r: number, P: TankPalette): void {
  disc(ctx, 0, 0, r, '#11120e');
  disc(ctx, 0, 0, r * 0.8, P.panel);
  ctx.strokeStyle = rgba(P.rim, 0.5);
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.8, 0, TAU);
  ctx.stroke();
  // Lightening holes round the disc and the spokes between them.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    disc(ctx, Math.cos(a) * r * 0.52, Math.sin(a) * r * 0.52, r * 0.15, mix(C.void, P.bodyDark, 0.3));
  }
  disc(ctx, 0, 0, r * 0.3, mix(P.panel, C.ink, 0.35));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + TAU / 12;
    disc(ctx, Math.cos(a) * r * 0.22, Math.sin(a) * r * 0.22, 0.5, rgba(P.rim, 0.8));
  }
  disc(ctx, 0, 0, r * 0.1, P.bodyDark);
  // A streak of mud so the turning reads.
  ctx.fillStyle = rgba(C.ink, 0.38);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, r * 0.78, 0.4, 1.1);
  ctx.closePath();
  ctx.fill();
}

/** Behind the wheels: the dark lower hull side and the suspension spring housings between the wheels. */
export function t34Side(ctx: Ctx, P: TankPalette): void {
  fillPoly(ctx, [-88, -30, 90, -30, 86, -16, -84, -16], P.bodyDark);
  ctx.fillStyle = rgba(P.rim, 0.25);
  for (const x of [-49.5, -16.5, 16.5, 49.5]) ctx.fillRect(x - 1, -29, 2, 8);
}

/** Fenders, the sloped hull, glacis and rear plate, fuel drums, hatches and fittings. */
export function t34Hull(ctx: Ctx, P: TankPalette): void {
  // Track guards along the top of the track, turned down at both ends.
  rimPoly(ctx, [-100, -29, -97, -32, 98, -32, 103, -29, 101, -27.5, -98, -27.5], P.body, P.rim, 1);
  // Exhaust pipes poking out of the lower rear plate.
  rimRect(ctx, -104, -42, 8, 4.2, 1.8, mix(C.rust, C.ink, 0.4), P.rim, 0.9);
  rimRect(ctx, -104, -36, 8, 4.2, 1.8, mix(C.rust, C.ink, 0.4), P.rim, 0.9);
  // The hull: rear plates in a shallow V, flat engine deck, the long glacis down to the nose.
  const hull = [-97, -31, -99, -40, -93, -52, -86, -54.5, 58, -54.5, 101, -34, 101, -31];
  rimPoly(ctx, hull, P.body, P.rim, 1.4);
  // The sloped upper side plate, lit from above, with its lower edge in shadow.
  fillPoly(ctx, [-92, -34.5, -89, -50.5, -84, -52, 57, -52, 94, -34.5], P.panel);
  fillPoly(ctx, [-92, -34.5, 94, -34.5, 92, -32.2, -93, -32.2], rgba(C.ink, 0.35));
  strokeLine(ctx, [-84, -51.6, 57, -51.6], rgba(P.rim, 0.45), 0.8);
  // Grab rails along the side.
  ctx.fillStyle = P.bodyDark;
  for (const x of [-44, -8, 28]) ctx.fillRect(x, -48.5, 14, 1.3);
  // External fuel drums on the rear of the side.
  for (const x of [-82, -66]) {
    rimRect(ctx, x, -48, 13, 9, 3.5, mix(P.panelLit, P.body, 0.3), P.rim, 1);
    strokeLine(ctx, [x + 4, -48, x + 4, -39], rgba(C.ink, 0.5), 0.8);
    strokeLine(ctx, [x + 9, -48, x + 9, -39], rgba(C.ink, 0.5), 0.8);
  }
  // Engine deck louvres behind the turret.
  ctx.fillStyle = P.bodyDark;
  for (let i = 0; i < 4; i++) ctx.fillRect(-58 + i * 6, -56.2, 3.6, 1.8);
  // Tool box on the fender.
  rimRect(ctx, 34, -37.5, 20, 5.6, 1, P.panel, P.rim, 0.9);
  // Driver's hatch on the glacis and the hull machine gun in its ball mount.
  ctx.save();
  ctx.translate(72, -48);
  ctx.rotate(Math.atan2(20.5, 43));
  rimRect(ctx, -6, -2.4, 15, 3.6, 1, P.bodyDark, P.rim, 0.9);
  ctx.fillStyle = C.void;
  ctx.fillRect(-3, -1.2, 3, 1.2);
  ctx.fillRect(3, -1.2, 3, 1.2);
  ctx.restore();
  strokeLine(ctx, [90, -42, 96, -42], C.ink, 1.4);
  disc(ctx, 89.6, -42, 2.6, P.rim);
  disc(ctx, 89.9, -41.7, 1.9, P.bodyDark);
  // Headlamp on the glacis corner and the tow hook on the nose.
  disc(ctx, 98, -37.5, 1.6, P.rim);
  rimRect(ctx, 99.5, -32.5, 4, 2.4, 1, P.bodyDark, P.rim, 0.7);
}

/** The welded 1942 turret: low, wide, sloped all round, with its rear overhang and the big hatch. */
export function t34Turret(ctx: Ctx, P: TankPalette): void {
  rimPoly(ctx, [-36, -5, -41, -9, -37, -21, -24, -25, 16, -25, 28, -16, 32, -5, 27, 0, -24, 0, -29, -5], P.body, P.rim, 1.4);
  fillPoly(ctx, [-34, -6.6, -37.6, -9.4, -34.6, -19.6, -23, -22.6, 15, -22.6, 25.6, -15.4, 29, -6.6], P.panel);
  // The overhang's underside in shadow.
  fillPoly(ctx, [-36, -5, -29, -5, -24, -0.6, -27, -0.6], rgba(C.ink, 0.5));
  // The big one-piece hatch over the rear of the roof, standing proud, and the periscope ahead of it.
  rimPoly(ctx, [-30, -24.6, -28, -29.5, -2, -29.5, 1, -24.6], P.bodyDark, P.rim, 1);
  rimRect(ctx, 8, -28.4, 6, 3.8, 0.8, P.bodyDark, P.rim, 0.8);
  // Pistol port and vision slit on the side, lifting hooks.
  disc(ctx, -20, -10, 1.6, P.bodyDark);
  ctx.fillStyle = C.void;
  ctx.fillRect(4, -18, 7, 1.3);
  ctx.fillStyle = rgba(P.rim, 0.6);
  for (const x of [-28, 14]) ctx.fillRect(x, -23.4, 1.3, 1.3);
  redStar(ctx, -8, -12.5, 5.2);
  // The cast mantlet round the gun, and the coaxial machine gun beside it.
  rimPoly(ctx, [26, -20, 33, -21, 38, -16.5, 38, -8.5, 33, -4, 26, -5], P.body, P.rim, 1.1);
  disc(ctx, 35.5, -9.2, 0.9, C.void);
}

/** The 76.2 mm F-34: a plain tapered tube with a slightly thicker muzzle, no brake. Origin = trunnion. */
export function t34Barrel(ctx: Ctx, P: TankPalette, len: number): void {
  rimPoly(ctx, [-8, -3.4, 10, -3.4, 12, -2.6, len - 4, -2.0, len - 4, -2.4, len, -2.4, len, 2.4, len - 4, 2.4, len - 4, 2.0, 12, 2.6, 10, 3.4, -8, 3.4], P.bodyDark, P.rim, 1);
  strokeLine(ctx, [12, -1.2, len - 5, -0.9], rgba(P.rim, 0.35), 0.7);
}
