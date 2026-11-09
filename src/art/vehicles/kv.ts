/**
 * The KV heavy tanks (NATIONS.md section 3, heavyTank). The KV-1 model 1941: a tall, slab-sided hull with vertical
 * sides over long track guards, six small road wheels on torsion bars and three return rollers a side, the drive
 * sprocket at the rear, a short upper glacis with the driver's visor and the hull machine gun, and the welded turret with
 * its rear overhang (a ball-mounted DT in the back wall) and the boxy mantlet of the 76.2 mm ZiS-5. The KV-2 is the same
 * hull under a tall box turret with the short, thick 152 mm M-10T howitzer (registered for the 1941 era looks).
 * Tank space as in ./tanks: origin on the ground under the hull centre, facing +x, y up negative. Red star on the turret.
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

/** The small road wheel: a dark tyre, a ribbed steel disc and a domed hub. Origin = hub. */
export function kvWheel(ctx: Ctx, r: number, P: TankPalette): void {
  disc(ctx, 0, 0, r, '#11120e');
  disc(ctx, 0, 0, r * 0.78, P.panel);
  ctx.strokeStyle = rgba(P.rim, 0.5);
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.78, 0, TAU);
  ctx.stroke();
  // Eight pressed ribs from the hub to the rim.
  ctx.strokeStyle = mix(P.panel, C.ink, 0.45);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    ctx.moveTo(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3);
    ctx.lineTo(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72);
  }
  ctx.stroke();
  disc(ctx, 0, 0, r * 0.3, P.bodyDark);
  disc(ctx, 0, 0, r * 0.14, rgba(P.rim, 0.7));
  // A streak of mud so the turning reads.
  ctx.fillStyle = rgba(C.ink, 0.38);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, r * 0.76, 0.4, 1.15);
  ctx.closePath();
  ctx.fill();
}

/** Behind the wheels: the lower hull side and the torsion-arm brackets between the road wheels. */
export function kvSide(ctx: Ctx, P: TankPalette): void {
  fillPoly(ctx, [-98, -41, 96, -41, 92, -18, -94, -18], P.bodyDark);
  for (const x of [-55, -29, -2.5, 24, 50.5]) rimRect(ctx, x - 3, -30, 6, 7, 1.2, P.panel, P.rim, 0.7);
}

/** Track guards, the box hull with its glacis, the engine deck, stowage and fittings. */
export function kvHull(ctx: Ctx, P: TankPalette): void {
  // Exhaust pipes out of the rear plate, under the deck edge.
  rimRect(ctx, -106, -61, 9, 4, 1.8, mix(C.rust, C.ink, 0.4), P.rim, 0.9);
  rimRect(ctx, -106, -55, 9, 4, 1.8, mix(C.rust, C.ink, 0.4), P.rim, 0.9);
  // Long track guards, turned down at both ends.
  rimPoly(ctx, [-107, -41, -104, -45.5, 101, -45.5, 107, -41, 105, -39.8, -105, -39.8], P.body, P.rim, 1);
  // The hull: rear plate, a short step down to the engine deck, the flat roof, the upper glacis and the nose.
  const hull = [-102, -45, -100, -58, -96, -62, -86, -62, -84, -64.5, 66, -64.5, 98, -50, 102, -45];
  rimPoly(ctx, hull, P.body, P.rim, 1.4);
  // The vertical side plate, lit, with its lower edge in shadow and a weld line under the roof.
  fillPoly(ctx, [-97, -47.5, -95.5, -57.5, -92, -59.5, -82, -59.5, -80, -61.5, 64, -61.5, 92, -49, 95, -47.5], P.panel);
  fillPoly(ctx, [-97, -47.5, 95, -47.5, 94, -45.6, -98, -45.6], rgba(C.ink, 0.35));
  strokeLine(ctx, [-80, -61, 64, -61], rgba(P.rim, 0.45), 0.8);
  // Bolt heads along the side, where the 1941 hull plates join.
  ctx.fillStyle = rgba(P.rim, 0.55);
  for (let x = -76; x <= 56; x += 11) ctx.fillRect(x, -58.6, 1.1, 1.1);
  // The raised engine-deck grating behind the turret, its slots, and the deck hatch.
  rimRect(ctx, -84, -67, 30, 2.8, 0.8, P.body, P.rim, 0.8);
  ctx.fillStyle = P.bodyDark;
  for (let i = 0; i < 6; i++) ctx.fillRect(-82 + i * 4.6, -66.2, 2.4, 1.6);
  rimRect(ctx, -50, -66.6, 9, 2.4, 0.8, P.bodyDark, P.rim, 0.8);
  // Stowage boxes on the track guard and a tow cable looped along the side.
  rimRect(ctx, -72, -52, 30, 6.6, 1, P.panelLit, P.rim, 0.9);
  strokeLine(ctx, [-57, -52, -57, -45.6], rgba(C.ink, 0.5), 0.8);
  rimRect(ctx, 24, -51.5, 22, 6, 1, P.panelLit, P.rim, 0.9);
  ctx.strokeStyle = P.bodyDark;
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-30, -56.5);
  ctx.quadraticCurveTo(0, -51.5, 30, -56.5);
  ctx.stroke();
  // The driver's visor block on the glacis, the hull machine gun in its ball mount, headlamp and tow hook.
  ctx.save();
  ctx.translate(76, -60.5);
  ctx.rotate(Math.atan2(14.5, 32));
  rimRect(ctx, -6, -2.6, 12, 4.2, 1, P.bodyDark, P.rim, 0.9);
  ctx.fillStyle = C.void;
  ctx.fillRect(-3.5, -1.2, 7, 1.2);
  ctx.restore();
  strokeLine(ctx, [90, -54, 97, -54], C.ink, 1.5);
  disc(ctx, 89.6, -54, 2.7, P.rim);
  disc(ctx, 89.9, -53.7, 2, P.bodyDark);
  disc(ctx, 100, -47.5, 1.7, P.rim);
  rimRect(ctx, 101, -43.5, 4.4, 2.6, 1, P.bodyDark, P.rim, 0.7);
}

/** The welded 1941 turret: flat sides, the rear overhang with its ball-mounted DT, the boxy mantlet. */
export function kvTurret(ctx: Ctx, P: TankPalette): void {
  rimPoly(ctx, [-38, 0, -47, -6, -45, -25, -37, -29, 22, -29, 29, -23, 31, -5, 28, 0], P.body, P.rim, 1.4);
  fillPoly(ctx, [-36, -3.4, -43.6, -7.4, -42, -23.6, -35.6, -26.4, 20.6, -26.4, 26.4, -21.6, 28, -5.4, 26, -3.4], P.panel);
  // The overhang's underside in shadow, and the rear machine gun's ball mount in the back wall.
  fillPoly(ctx, [-47, -6, -38, -6, -36, -0.6, -40, -0.6], rgba(C.ink, 0.5));
  disc(ctx, -45.4, -15, 2.6, P.rim);
  disc(ctx, -45.1, -14.7, 1.9, P.bodyDark);
  // Weld seams of the plates and their bolt heads.
  strokeLine(ctx, [-42, -12.5, 27, -12.5], rgba(C.ink, 0.35), 0.8);
  ctx.fillStyle = rgba(P.rim, 0.6);
  for (let x = -38; x <= 22; x += 10) ctx.fillRect(x, -24, 1.2, 1.2);
  // The roof hatch over the rear, the periscope ahead of it.
  rimPoly(ctx, [-32, -28.6, -30, -32.5, -12, -32.5, -10, -28.6], P.bodyDark, P.rim, 1);
  rimRect(ctx, 6, -32.4, 6, 3.8, 0.8, P.bodyDark, P.rim, 0.8);
  // Vision slit, pistol port, lifting hooks.
  ctx.fillStyle = C.void;
  ctx.fillRect(10, -19.5, 8, 1.4);
  disc(ctx, -24, -8, 1.6, P.bodyDark);
  ctx.fillStyle = rgba(P.rim, 0.6);
  for (const x of [-34, 18]) ctx.fillRect(x, -30.4, 1.4, 1.4);
  redStar(ctx, -7, -16, 6);
  // The cast mantlet, its rounded box round the gun, and the coaxial DT's port.
  rimPoly(ctx, [28, -22.5, 38, -23.5, 44, -19, 44, -8.5, 38, -4, 28, -5], P.body, P.rim, 1.1);
  strokeLine(ctx, [31, -21.5, 31, -6], rgba(C.ink, 0.4), 0.8);
  disc(ctx, 41.5, -7.6, 0.9, C.void);
}

/** The 76.2 mm ZiS-5: a recoil sleeve at the breech, then a plain tube with a slight lip at the muzzle. Origin = trunnion. */
export function kvBarrel(ctx: Ctx, P: TankPalette, len: number): void {
  rimPoly(
    ctx,
    [-8, -3.8, 12, -3.8, 14, -2.5, len - 4, -2.1, len - 4, -2.6, len, -2.6, len, 2.6, len - 4, 2.6, len - 4, 2.1, 14, 2.5, 12, 3.8, -8, 3.8],
    P.bodyDark,
    P.rim,
    1,
  );
  strokeLine(ctx, [14, -1.1, len - 5, -0.9], rgba(P.rim, 0.35), 0.7);
}

/** The KV-2's MT-1 turret: a tall box with a sloped front, a rear door, bolted plates and the big round mantlet. */
export function kv2Turret(ctx: Ctx, P: TankPalette): void {
  rimPoly(ctx, [-40, 0, -43, -5, -43, -44, -38, -49, 22, -49, 28, -45, 32, -5, 29, 0], P.body, P.rim, 1.5);
  fillPoly(ctx, [-38, -3.5, -40.4, -6, -40.4, -42.6, -36.6, -46.4, 20.6, -46.4, 25.4, -43, 29, -5.6, 27, -3.5], P.panel);
  // The rear door with its hinges, and the rear DT ball mount in it.
  rimRect(ctx, -40, -34, 8, 24, 1, mix(P.panel, P.body, 0.4), P.rim, 0.8);
  ctx.fillStyle = P.bodyDark;
  ctx.fillRect(-41, -30, 2.4, 2);
  ctx.fillRect(-41, -16, 2.4, 2);
  disc(ctx, -36, -22, 1.9, P.bodyDark);
  // A grid of bolt heads over the side plates.
  ctx.fillStyle = rgba(P.rim, 0.55);
  for (let y = -42; y <= -8; y += 11) for (let x = -28; x <= 20; x += 12) ctx.fillRect(x, y, 1.2, 1.2);
  // Roof: hatch and periscope; side: vision slit and pistol port.
  rimPoly(ctx, [-30, -48.6, -28, -52.5, -10, -52.5, -8, -48.6], P.bodyDark, P.rim, 1);
  rimRect(ctx, 8, -52, 6, 3.6, 0.8, P.bodyDark, P.rim, 0.8);
  ctx.fillStyle = C.void;
  ctx.fillRect(10, -36, 8, 1.4);
  disc(ctx, -20, -12, 1.6, P.bodyDark);
  redStar(ctx, -6, -27, 7);
  // The deep round mantlet of the howitzer.
  rimPoly(ctx, [28, -35, 36, -36, 42, -31, 44, -22, 42, -13, 36, -8.5, 28, -9.5], P.body, P.rim, 1.2);
  strokeLine(ctx, [32, -33, 32, -11], rgba(C.ink, 0.4), 0.8);
}

/** The 152 mm M-10T: a short, thick tube over its recoil cylinders. Origin = trunnion. */
export function kv2Barrel(ctx: Ctx, P: TankPalette, len: number): void {
  rimRect(ctx, -6, -7.4, 24, 3.4, 1.2, P.bodyDark, P.rim, 1);
  rimRect(ctx, -6, 4, 24, 3.4, 1.2, P.bodyDark, P.rim, 1);
  rimPoly(ctx, [-8, -5, len - 5, -4.6, len - 5, -5.4, len, -5.4, len, 5.4, len - 5, 5.4, len - 5, 4.6, -8, 5], P.bodyDark, P.rim, 1);
  strokeLine(ctx, [2, -2.4, len - 6, -2.2], rgba(P.rim, 0.35), 0.8);
  ctx.fillStyle = C.void;
  ctx.fillRect(len - 1.2, -3.2, 1.2, 6.4);
}
