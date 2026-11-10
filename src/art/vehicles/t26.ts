/**
 * The T-26 model 1933 (NATIONS.md section 3, lightTank, 1941; HISTORY.md: in service 1939 to 1942, rare after), the Red
 * Army's most numerous tank in June 1941: a small, flat-sided hull of riveted plates, eight small road wheels a side in
 * four bogies under quarter-elliptic leaf springs, four return rollers, the drive sprocket at the front, the
 * cylindrical turret with its rear bustle and the 45 mm 20-K with a coaxial DT. Tank space as in ./tanks: origin on the
 * ground under the hull centre, facing +x, y up negative. Red star on the turret, like the other Soviet tanks.
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

/** The small rubber-tyred road wheel: a dark tyre, a plain dished disc and a big hub cap. Origin = hub. */
export function t26Wheel(ctx: Ctx, r: number, P: TankPalette): void {
  disc(ctx, 0, 0, r, '#11120e');
  disc(ctx, 0, 0, r * 0.7, P.panel);
  disc(ctx, 0, 0, r * 0.36, mix(P.panel, C.ink, 0.4));
  disc(ctx, 0, 0, r * 0.16, P.bodyDark);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.4;
    disc(ctx, Math.cos(a) * r * 0.52, Math.sin(a) * r * 0.52, 0.5, rgba(P.rim, 0.75));
  }
  ctx.fillStyle = rgba(C.ink, 0.4);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, r * 0.66, 0.4, 1.2);
  ctx.closePath();
  ctx.fill();
}

/** The four bogie centres (between each pair of road wheels; TANK_LAYOUT.t26). */
const BOGIES = [-48.5, -17.5, 13.5, 44.5] as const;

/** Behind the wheels: the lower hull side, and each bogie's bracket and quarter-elliptic leaf spring over its pair. */
export function t26Side(ctx: Ctx, P: TankPalette): void {
  fillPoly(ctx, [-76, -31, 76, -31, 72, -17, -72, -17], P.bodyDark);
  for (const cx of BOGIES) {
    // The bracket down to the bogie's pivot, and the spring leaves arching over both wheels.
    rimPoly(ctx, [cx - 3, -27, cx + 3, -27, cx + 2, -12, cx - 2, -12], P.panel, P.rim, 0.7);
    ctx.strokeStyle = P.panelLit;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 9, -17.5);
    ctx.quadraticCurveTo(cx, -23, cx + 9, -17.5);
    ctx.stroke();
    strokeLine(ctx, [cx - 6, -19.6, cx + 6, -19.6], rgba(C.ink, 0.45), 0.7);
  }
}

/** Fenders, the box hull with the sloped bow and the raised driver's plate, the engine deck and riveting. */
export function t26Hull(ctx: Ctx, P: TankPalette): void {
  // The silencer across the tail.
  rimRect(ctx, -87.5, -43, 6, 9, 3, mix(C.rust, C.ink, 0.35), P.rim, 0.9);
  // Track guards with the turned-down ends.
  rimPoly(ctx, [-82, -31, -80, -34, 76, -34, 82, -31, 80, -29.6, -80, -29.6], P.body, P.rim, 0.9);
  // The hull: near-vertical tail plate, flat engine deck and fighting compartment, the driver's raised plate, the bow.
  rimPoly(ctx, [-82, -33, -81, -45, -76, -47, 40, -47, 44, -51, 58, -51, 70, -42, 80, -35, 80, -33], P.body, P.rim, 1.3);
  fillPoly(ctx, [-78, -35.5, -77, -43.5, -74, -44.6, 40, -44.6, 44.6, -48.6, 56.6, -48.6, 67, -41, 75, -35.5], P.panel);
  fillPoly(ctx, [-78, -35.5, 75, -35.5, 74, -34, -79, -34], rgba(C.ink, 0.35));
  // Rivet rows along the side plates and the deck edge.
  ctx.fillStyle = rgba(P.rim, 0.55);
  for (let x = -74; x <= 62; x += 8) ctx.fillRect(x, -38.4, 0.9, 0.9);
  for (let x = -72; x <= 36; x += 9) ctx.fillRect(x, -45.8, 0.9, 0.9);
  // Engine louvres on the rear deck and the big air intake grille.
  ctx.fillStyle = P.bodyDark;
  for (let i = 0; i < 5; i++) ctx.fillRect(-72 + i * 5, -46.6, 3, 1.4);
  rimRect(ctx, -50, -43.5, 16, 5, 0.8, P.panelLit, P.rim, 0.7);
  ctx.fillStyle = P.bodyDark;
  for (let i = 0; i < 4; i++) ctx.fillRect(-48 + i * 3.6, -42.6, 1.4, 3.2);
  // The driver's visor in the raised plate, a headlamp on the bow and the tow hook.
  rimRect(ctx, 46, -50.4, 9, 3, 0.6, P.bodyDark, P.rim, 0.7);
  ctx.fillStyle = C.void;
  ctx.fillRect(47.5, -49.6, 6, 0.9);
  disc(ctx, 72, -40.5, 1.8, P.rim);
  disc(ctx, 72.3, -40.5, 1.1, P.bodyDark);
  rimRect(ctx, 79, -34.5, 4, 2.2, 0.8, P.bodyDark, P.rim, 0.7);
  // Shovel and a tool box on the track guard.
  strokeLine(ctx, [-30, -36.4, -6, -36.4], P.bodyDark, 1.4);
  rimRect(ctx, 8, -38, 18, 4.4, 1, P.panelLit, P.rim, 0.8);
}

/** The cylindrical turret of 1933 with its rear bustle, the roof hatch, the flat mantlet with the 45 mm and the DT. */
export function t26Turret(ctx: Ctx, P: TankPalette): void {
  // The rear bustle (the radio set lived here) under the line of the roof.
  rimPoly(ctx, [-24, -5, -33, -6, -34, -16, -24, -18], P.body, P.rim, 1);
  // The drum seen from the side: straight sides, a flat roof, and its curve shaded at front and back.
  rimPoly(ctx, [-25, 0, -25, -19, -21, -21, 18, -21, 22, -19, 22, 0], P.body, P.rim, 1.3);
  fillPoly(ctx, [-22.4, -2.6, -22.4, -17.6, -19.6, -18.8, 16.6, -18.8, 19.4, -17.6, 19.4, -2.6], P.panel);
  fillPoly(ctx, [-22.4, -2.6, -22.4, -17.6, -16, -18.8, -16, -2.6], rgba(C.ink, 0.28));
  fillPoly(ctx, [13, -2.6, 13, -18.8, 16.6, -18.8, 19.4, -17.6, 19.4, -2.6], rgba(C.ink, 0.22));
  strokeLine(ctx, [-22.4, -10.5, 19.4, -10.5], rgba(C.ink, 0.25), 0.6);
  // The hatch on the roof, a periscope, a vision slit and a pistol port.
  rimPoly(ctx, [-14, -20.6, -12, -24, 0, -24, 2, -20.6], P.bodyDark, P.rim, 0.9);
  rimRect(ctx, 6, -23.6, 4, 2.8, 0.6, P.bodyDark, P.rim, 0.7);
  ctx.fillStyle = C.void;
  ctx.fillRect(5, -14.6, 7, 1.1);
  disc(ctx, -10, -6, 1.3, P.bodyDark);
  redStar(ctx, -6, -11.5, 4.2);
  // The flat mantlet, and the coaxial DT's muzzle beside the gun.
  rimRect(ctx, 21, -16, 8, 11, 1.4, P.body, P.rim, 1);
  strokeLine(ctx, [28, -7, 31, -7], C.ink, 1.3);
}

/** The 45 mm 20-K: a recoil sleeve at the breech, a long slim tube and a plain muzzle. Origin = trunnion. */
export function t26Barrel(ctx: Ctx, P: TankPalette, len: number): void {
  rimRect(ctx, -6, -1.6, len + 6, 3.2, 0.7, P.bodyDark, P.rim, 1);
  rimRect(ctx, -5, -2.9, 15, 5.8, 1, P.bodyDark, P.rim, 1);
  rimRect(ctx, len - 3, -2, 3, 4, 0.6, P.bodyDark, P.rim, 0.9);
}
