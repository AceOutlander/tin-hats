/**
 * The BT-7 model 1937 (NATIONS.md section 3, lightTank, 1941; HISTORY.md: in service 1939 to 1942): the fast tank on
 * Christie suspension, four big road wheels a side with no return rollers (the top run lies on the wheels), the drive
 * sprocket at the rear, the long flat hull with its pointed nose, the twin exhausts on the tail, and the conical turret
 * with its bustle and the 45 mm 20-K. Tank space as in ./tanks: origin on the ground under the hull centre, facing +x,
 * y up negative. Red star on the turret, like the other Soviet tanks.
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

/** The big Christie road wheel: a thick rubber tyre on a disc with eight spokes and a domed hub. Origin = hub. */
export function bt7Wheel(ctx: Ctx, r: number, P: TankPalette): void {
  disc(ctx, 0, 0, r, '#11120e');
  disc(ctx, 0, 0, r * 0.78, P.panel);
  ctx.strokeStyle = mix(C.void, P.bodyDark, 0.3);
  ctx.lineWidth = r * 0.12;
  ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3);
    ctx.lineTo(Math.cos(a) * r * 0.66, Math.sin(a) * r * 0.66);
    ctx.stroke();
  }
  ctx.strokeStyle = rgba(P.rim, 0.5);
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.78, 0, TAU);
  ctx.stroke();
  disc(ctx, 0, 0, r * 0.28, mix(P.panel, C.ink, 0.35));
  disc(ctx, 0, 0, r * 0.12, P.bodyDark);
  ctx.fillStyle = rgba(C.ink, 0.38);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, r * 0.76, 0.4, 1.1);
  ctx.closePath();
  ctx.fill();
}

/** Behind the wheels: the lower hull side and the swing-arm housings of the Christie springs. */
export function bt7Side(ctx: Ctx, P: TankPalette): void {
  fillPoly(ctx, [-90, -32, 90, -32, 86, -18, -86, -18], P.bodyDark);
  for (const x of [-60, -20, 20, 60]) rimRect(ctx, x - 3, -31, 6, 7, 1, P.panel, P.rim, 0.7);
}

/** Track guards, the long flat hull with its pointed nose, the twin exhausts and the fittings. */
export function bt7Hull(ctx: Ctx, P: TankPalette): void {
  // The twin exhaust pipes curling over the tail plate.
  for (const y of [-50.5, -46]) rimRect(ctx, -98, y, 9, 3.6, 1.6, mix(C.rust, C.ink, 0.4), P.rim, 0.8);
  // Wide track guards over the wheels.
  rimPoly(ctx, [-96, -33, -93, -36, 88, -36, 93, -33, 91, -31.5, -94, -31.5], P.body, P.rim, 0.9);
  // The hull: sloped tail, the flat deck, then the upper glacis down to the pointed nose and the lower glacis back.
  rimPoly(ctx, [-94, -35, -96, -46, -88, -52, 52, -52, 92, -40, 96, -37, 88, -33], P.body, P.rim, 1.3);
  fillPoly(ctx, [-90, -37.5, -91.6, -45, -86, -49.4, 51, -49.4, 87, -38.6, 85, -37.5], P.panel);
  fillPoly(ctx, [-90, -37.5, 85, -37.5, 84, -36, -91, -36], rgba(C.ink, 0.35));
  strokeLine(ctx, [52, -51.6, 92, -40.2], rgba(P.rim, 0.45), 0.7);
  // The engine deck's long louvred grilles behind the turret and the rivet line along the side.
  ctx.fillStyle = P.bodyDark;
  for (let i = 0; i < 6; i++) ctx.fillRect(-82 + i * 7, -51.6, 4.4, 1.6);
  ctx.fillStyle = rgba(P.rim, 0.55);
  for (let x = -86; x <= 76; x += 9) ctx.fillRect(x, -41, 0.9, 0.9);
  // The driver's hatch on the glacis, the two headlamps on the nose and a tool box on the guard.
  ctx.save();
  ctx.translate(66, -46.5);
  ctx.rotate(Math.atan2(12, 40));
  rimRect(ctx, -6, -2, 12, 3.2, 0.8, P.bodyDark, P.rim, 0.8);
  ctx.fillStyle = C.void;
  ctx.fillRect(-3.5, -1, 7, 1);
  ctx.restore();
  disc(ctx, 88, -42, 1.8, P.rim);
  disc(ctx, 88.3, -42, 1.1, P.bodyDark);
  rimRect(ctx, -40, -40, 22, 4.6, 1, P.panelLit, P.rim, 0.8);
  rimRect(ctx, 94, -36, 4, 2.4, 0.8, P.bodyDark, P.rim, 0.7);
}

/** The conical turret of 1937: sides sloping in to a smaller roof, the bustle, two hatches and the 45 mm's mantlet. */
export function bt7Turret(ctx: Ctx, P: TankPalette): void {
  // The bustle at the rear.
  rimPoly(ctx, [-24, -4, -35, -6, -34, -18, -22, -19], P.body, P.rim, 1);
  // The cone: the base wider than the roof.
  rimPoly(ctx, [-27, 0, -21, -22, 16, -22, 25, 0], P.body, P.rim, 1.3);
  fillPoly(ctx, [-23.6, -2.6, -18.8, -19.6, 14.2, -19.6, 21.6, -2.6], P.panel);
  fillPoly(ctx, [-23.6, -2.6, -18.8, -19.6, -12, -19.6, -15.6, -2.6], rgba(C.ink, 0.25));
  strokeLine(ctx, [-22, -9, 19, -9], rgba(C.ink, 0.25), 0.6);
  // Two roof hatches and a periscope; a vision slit and a pistol port on the side.
  rimPoly(ctx, [-16, -21.6, -14, -24.6, -4, -24.6, -2, -21.6], P.bodyDark, P.rim, 0.9);
  rimPoly(ctx, [0, -21.6, 1.5, -24, 8, -24, 9.5, -21.6], P.bodyDark, P.rim, 0.8);
  ctx.fillStyle = C.void;
  ctx.fillRect(6, -14.6, 7, 1.1);
  disc(ctx, -12, -6, 1.3, P.bodyDark);
  redStar(ctx, -4, -11.5, 4.4);
  // The mantlet of the 45 mm and the coaxial DT.
  rimRect(ctx, 22, -17, 8, 11, 1.6, P.body, P.rim, 1);
  strokeLine(ctx, [29, -8, 32, -8], C.ink, 1.3);
}

/** The 45 mm 20-K: as on the T-26 (the same gun), a recoil sleeve, a long slim tube and a plain muzzle. */
export function bt7Barrel(ctx: Ctx, P: TankPalette, len: number): void {
  rimRect(ctx, -6, -1.6, len + 6, 3.2, 0.7, P.bodyDark, P.rim, 1);
  rimRect(ctx, -5, -3, 16, 6, 1, P.bodyDark, P.rim, 1);
  rimRect(ctx, len - 3, -2, 3, 4, 0.6, P.bodyDark, P.rim, 0.9);
}
