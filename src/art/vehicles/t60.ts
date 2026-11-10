/**
 * The T-60 light tank (NATIONS.md section 3, lightTank, from 1941-10): a small, low hull of flat plates, four road
 * wheels and three return rollers a side, the drive sprocket at the front, the driver's armoured cab raised on the bow,
 * a sloped engine deck to the rear, and a small faceted turret carrying the long, slim 20 mm TNSh with a coaxial DT.
 * Tank space as in ./tanks: origin on the ground under the hull centre, facing +x, y up negative. Red star on the
 * turret.
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

/** The small spoked road wheel: rubber tyre, a pressed disc with five holes, the hub. Origin = hub. */
export function t60Wheel(ctx: Ctx, r: number, P: TankPalette): void {
  disc(ctx, 0, 0, r, '#11120e');
  disc(ctx, 0, 0, r * 0.74, P.panel);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + 0.3;
    disc(ctx, Math.cos(a) * r * 0.46, Math.sin(a) * r * 0.46, r * 0.14, mix(C.void, P.bodyDark, 0.3));
  }
  disc(ctx, 0, 0, r * 0.22, P.bodyDark);
  ctx.strokeStyle = rgba(P.rim, 0.5);
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.74, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = rgba(C.ink, 0.38);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, r * 0.7, 0.4, 1.15);
  ctx.closePath();
  ctx.fill();
}

/** Behind the wheels: the lower hull side and the suspension arm brackets. */
export function t60Side(ctx: Ctx, P: TankPalette): void {
  fillPoly(ctx, [-74, -32, 72, -32, 68, -16, -70, -16], P.bodyDark);
  for (const x of [-33, -3, 27]) rimRect(ctx, x - 2.5, -24, 5, 6, 1, P.panel, P.rim, 0.7);
}

/** Track guards, the low hull with the driver's cab on the bow, the sloped engine deck and fittings. */
export function t60Hull(ctx: Ctx, P: TankPalette): void {
  // Silencer across the tail.
  rimRect(ctx, -84, -44, 7, 10, 3, mix(C.rust, C.ink, 0.35), P.rim, 0.9);
  // Narrow track guards.
  rimPoly(ctx, [-80, -32.5, -77, -35.6, 74, -35.6, 79, -32.5, 77, -31.4, -78, -31.4], P.body, P.rim, 0.9);
  // The hull: rear plate, engine deck rising to the roof, the driver's cab, the steep front plate and the nose.
  rimPoly(ctx, [-79, -35, -77, -44, -71, -46.5, -30, -50, 30, -50, 34, -55, 50, -55, 72, -41, 78, -35], P.body, P.rim, 1.3);
  fillPoly(ctx, [-75, -37.5, -73.5, -43.4, -69, -45, -30, -47.6, 30, -47.6, 33.6, -52.4, 48.4, -52.4, 68.6, -40.4, 73, -37.5], P.panel);
  fillPoly(ctx, [-75, -37.5, 73, -37.5, 72, -35.8, -76, -35.8], rgba(C.ink, 0.35));
  // Engine louvres on the sloped deck, a deck hatch, rivets along the side.
  ctx.fillStyle = P.bodyDark;
  for (let i = 0; i < 4; i++) {
    const x = -66 + i * 8;
    ctx.fillRect(x, -46.5 - ((x + 71) * 3.5) / 41 + 0.8, 4.6, 1.4);
  }
  ctx.fillStyle = rgba(P.rim, 0.55);
  for (let x = -66; x <= 62; x += 10) ctx.fillRect(x, -40.5, 1, 1);
  // The driver's visor flap on the cab front, a vision slit on its side, the headlamp and the tow hook.
  ctx.save();
  ctx.translate(58, -49);
  ctx.rotate(Math.atan2(14, 22));
  rimRect(ctx, -5, -2.2, 10, 3.6, 0.8, P.bodyDark, P.rim, 0.8);
  ctx.fillStyle = C.void;
  ctx.fillRect(-3, -1, 6, 1);
  ctx.restore();
  ctx.fillStyle = C.void;
  ctx.fillRect(38, -51.5, 7, 1.2);
  disc(ctx, 70, -43.5, 1.6, P.rim);
  rimRect(ctx, 75, -36.5, 4, 2.2, 0.8, P.bodyDark, P.rim, 0.7);
  // A spare-parts box on the track guard.
  rimRect(ctx, -26, -40.6, 18, 5, 1, P.panelLit, P.rim, 0.8);
}

/** The small faceted turret: sloped faces all round, a round hatch, the flat mantlet with both guns. */
export function t60Turret(ctx: Ctx, P: TankPalette): void {
  rimPoly(ctx, [-24, 0, -28, -6, -24, -18, -18, -20.5, 14, -20.5, 21, -15, 24, -6, 22, 0], P.body, P.rim, 1.2);
  fillPoly(ctx, [-22.4, -3, -25.4, -6.6, -22.2, -16.6, -17.2, -18.4, 13.2, -18.4, 18.8, -14, 21.6, -6.4, 20.4, -3], P.panel);
  // The facet line round the middle.
  strokeLine(ctx, [-25.4, -6.6, 21.6, -6.4], rgba(C.ink, 0.35), 0.7);
  // The round hatch on the roof, a vision slit and lifting hooks.
  rimPoly(ctx, [-14, -20, -12, -23, 0, -23, 2, -20], P.bodyDark, P.rim, 0.9);
  ctx.fillStyle = C.void;
  ctx.fillRect(6, -14.5, 6, 1.2);
  ctx.fillStyle = rgba(P.rim, 0.6);
  for (const x of [-20, 12]) ctx.fillRect(x, -19.8, 1.2, 1.2);
  redStar(ctx, -6, -10, 4.6);
  // The flat mantlet plate, and the coaxial DT's muzzle below the cannon.
  rimRect(ctx, 21, -15, 7, 11, 1.2, P.body, P.rim, 1);
  strokeLine(ctx, [27, -6, 30, -6], C.ink, 1.3);
}

/** The 20 mm TNSh: a thick breech sleeve, a long slim barrel and a small muzzle ring. Origin = trunnion. */
export function t60Barrel(ctx: Ctx, P: TankPalette, len: number): void {
  rimRect(ctx, -6, -1.3, len + 6, 2.6, 0.6, P.bodyDark, P.rim, 1);
  rimRect(ctx, -5, -2.7, 14, 5.4, 1, P.bodyDark, P.rim, 1);
  rimRect(ctx, len - 3.5, -1.8, 3.5, 3.6, 0.6, P.bodyDark, P.rim, 0.9);
}
