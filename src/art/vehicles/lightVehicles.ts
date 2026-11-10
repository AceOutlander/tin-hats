/**
 * The small vehicles on the shared tank rig: the Panzer III Ausf. E (and a British cruiser on the same hull, so a
 * German-commanded battle still has a light enemy tank), the Universal Carrier and the SdKfz 251 half-track.
 * Same conventions as ./tanks: tank space, facing right, dark bodies with faction-tint panels and a light rim.
 *
 * The APCs have no turret: their "turret" sprite is the gunner behind the machine gun, the "barrel" is the gun,
 * and a separate passengers sprite shows the carried squad's helmets over the side until it unloads.
 */
import { ART_COLORS as C, ELITE_TANK_LOOK as E, TANK_LAYOUT, type VehicleLook } from '../../data/artLayout';
import { FACTIONS } from '../../data/factions';
import { FIGURE } from '../../data/figure';
import type { FactionId, HelmetShape } from '../../data/schema';
import { helmetShapePath } from '../figure/parts';
import { type Ctx, TAU, balkenkreuz, ellipse, fillPoly, mix, recognitionFlash, redStar, rgba, rimPoly, rimRect, strokeLine } from '../props/kit';
import type { TankPalette } from './tanks';

function disc(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

/** A soldier's head and helmet, origin at the head centre, scaled to `k` of a figure head. */
export function crewHead(ctx: Ctx, x: number, y: number, k: number, shape: HelmetShape, tint: string): void {
  const hr = FIGURE.headRadius * k;
  disc(ctx, x, y, hr + 0.7, FIGURE.colors.rim);
  disc(ctx, x, y, hr, FIGURE.colors.body);
  ctx.save();
  ctx.translate(x, y);
  const s = (FIGURE.headRadius / 5.4) * k;
  ctx.scale(s, s);
  ctx.beginPath();
  helmetShapePath(ctx, shape);
  ctx.lineWidth = 1.4 / s;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = FIGURE.colors.rim;
  ctx.stroke();
  ctx.fillStyle = tint;
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Panzer III Ausf. E and the British cruiser (same small hull and turret)
// ---------------------------------------------------------------------------

export function smallTankSide(ctx: Ctx, P: TankPalette): void {
  fillPoly(ctx, [-62, -27, 64, -27, 60, -16, -60, -16], P.bodyDark);
}

export function smallTankHull(ctx: Ctx, P: TankPalette): void {
  // Fenders, rear mudflap.
  rimPoly(ctx, [-82, -29, -80, -32, 74, -32, 80, -35, 81.5, -33.5, 76, -29.2], P.body, P.rim, 1);
  fillPoly(ctx, [-82, -30, -79.5, -30, -81, -23, -83.5, -24], P.body);
  // Engine deck, superstructure, sloped bow.
  rimPoly(ctx, [-78, -31, -76, -40, -54, -43, -52, -31], P.body, P.rim);
  rimPoly(ctx, [48, -40, 70, -37, 77, -32, 48, -31.5], P.body, P.rim);
  rimPoly(ctx, [-54, -31, -52, -49, 44, -49, 48, -40, 50, -31], P.body, P.rim);
  fillPoly(ctx, [-49, -34, -48.4, -46.4, 41, -46.4, 44, -34], P.panel);
  // Vision port, louvres, an escape hatch between the wheels' fender and the deck.
  rimRect(ctx, 28, -45, 8, 4, 1, P.bodyDark, P.rim, 0.8);
  ctx.fillStyle = P.bodyDark;
  for (let i = 0; i < 3; i++) ctx.fillRect(-74, -39.5 + i * 2.4, 15, 1.1);
  ctx.strokeStyle = P.bodyDark;
  ctx.lineWidth = 1;
  ctx.strokeRect(-20, -45, 16, 9);
  // Muffler and the hull machine gun.
  rimRect(ctx, -88, -30, 7, 11, 3, mix(C.rust, C.ink, 0.35), P.rim, 1);
  strokeLine(ctx, [48, -42, 53.5, -42], C.ink, 1.3);
  disc(ctx, 48, -42, 2.1, P.rim);
  disc(ctx, 48.2, -41.8, 1.5, P.bodyDark);
}

/** The Panzer III turret without its marking (the cruiser and the later Panzer IIIs build on it). */
export function smallTankTurretBody(ctx: Ctx, P: TankPalette): void {
  // A short box turret with a squared rear bin and the drum cupola set at the back.
  rimPoly(ctx, [-26, 0, -30, -4, -27, -18, -23, -20, 12, -20, 24, -12, 26, -3, 23, 0], P.body, P.rim, 1.3);
  fillPoly(ctx, [-24, -3, -25, -16, -21.5, -17.6, 11, -17.6, 21, -11, 22.5, -3], P.panel);
  rr(ctx, -12, -15, 12, 10);
  rimRect(ctx, -22, -26.5, 14, 7, 2, P.bodyDark, P.rim, 1);
  ctx.fillStyle = C.void;
  for (const x of [-20, -16, -12]) ctx.fillRect(x, -24, 2.2, 1.3);
  // Inner mantlet.
  rimRect(ctx, 21, -15, 8, 11, 2, P.body, P.rim, 1);
  disc(ctx, 27, -12.5, 0.8, C.void);
}

function rr(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
}

export function panzer3Turret(ctx: Ctx, P: TankPalette): void {
  smallTankTurretBody(ctx, P);
  balkenkreuz(ctx, 7, -9.5, 6.4);
}

export function cruiserTurret(ctx: Ctx, P: TankPalette): void {
  smallTankTurretBody(ctx, P);
  recognitionFlash(ctx, 0, -14, 12, 6);
}

/** The short 3.7 cm gun: thin, with no muzzle brake. */
export function smallTankBarrel(ctx: Ctx, P: TankPalette, len: number): void {
  rimRect(ctx, -6, -1.7, len + 6, 3.4, 0.8, P.bodyDark, P.rim, 1);
  rimRect(ctx, -3, -2.6, 9, 5.2, 1, P.bodyDark, P.rim, 1);
}

// ---------------------------------------------------------------------------
// Universal Carrier: low, open-topped, a Bren in the front plate
// ---------------------------------------------------------------------------

export function carrierSide(ctx: Ctx, P: TankPalette): void {
  fillPoly(ctx, [-44, -20, 46, -20, 42, -12, -40, -12], P.bodyDark);
  // Suspension springs of the two bogies.
  for (const cx of [-13, 13]) rimPoly(ctx, [cx - 4, -19, cx + 4, -19, cx + 2, -11, cx - 2, -11], P.panel, P.rim, 0.8);
}

export function carrierHull(ctx: Ctx, P: TankPalette, faction: FactionId = 'british'): void {
  // Track guards.
  rimPoly(ctx, [-60, -21, -58, -24, 58, -24, 62, -21], P.body, P.rim, 0.9);
  // The open steel tub: low sides, the raised front plate with the driver's hood and the gunner's Bren slot.
  rimPoly(ctx, [-60, -22, -59, -33, 18, -33, 24, -38, 50, -38, 58, -30, 60, -22], P.body, P.rim, 1.1);
  fillPoly(ctx, [-56, -25, -55.5, -30.5, 17, -30.5, 23, -35.4, 48, -35.4, 54.5, -29, 56, -25], P.panel);
  // Rivet line, stowage and a spare wheel at the back.
  ctx.fillStyle = rgba(P.rim, 0.55);
  for (let x = -54; x <= 52; x += 9) ctx.fillRect(x, -27.5, 1, 1);
  rimRect(ctx, -46, -36.5, 16, 4, 1, P.panelLit, P.rim, 0.8);
  disc(ctx, -62, -28, 5.4, '#11120e');
  disc(ctx, -62, -28, 3, P.panel);
  // The Red Army's carriers wore a red star on the hull side (and the British paint was soon painted over).
  if (FACTIONS[faction].look.flag === 'sovietRed') redStar(ctx, -12, -28.4, 3.6);
  // The driver's head beside the gunner, low behind the front plate.
  const look = FACTIONS[faction].look;
  crewHead(ctx, 16, -36, 0.8, look.helmet, look.tint);
}

/** The Bren gunner in the front compartment (origin = his seat on the hull rim). */
export function carrierGunner(ctx: Ctx, faction: FactionId = 'british'): void {
  const look = FACTIONS[faction].look;
  // Shoulders just over the plate, head and helmet.
  ctx.fillStyle = FIGURE.colors.rim;
  ellipse(ctx, 0, -4, 6.6, 5.4);
  ctx.fill();
  ctx.fillStyle = FIGURE.colors.body;
  ellipse(ctx, 0, -4, 5.8, 4.6);
  ctx.fill();
  crewHead(ctx, 1, -12, 0.85, look.helmet, look.tint);
}

/** A Bren on its mount: magazine on top, barrel along +x. */
export function brenOnMount(ctx: Ctx, P: TankPalette, len: number): void {
  rimRect(ctx, -6, -1.4, len + 6, 2.8, 0.6, C.ink, P.rim, 0.8);
  rimRect(ctx, -4, -2.6, 10, 4.6, 0.8, C.ink, P.rim, 0.8);
  fillPoly(ctx, [0, -2.4, 2, -7.6, 4.6, -7.4, 3.4, -2.4], C.ink);
  rimRect(ctx, len - 3, -1.9, 3, 3.8, 0.6, C.ink, P.rim, 0.8);
}

/** The Soviet carrier's DP on its mount: the perforated barrel jacket, and the flat pan magazine lying on top. */
export function dpOnMount(ctx: Ctx, P: TankPalette, len: number): void {
  rimRect(ctx, -6, -1.3, len + 6, 2.6, 0.6, C.ink, P.rim, 0.8);
  rimRect(ctx, 6, -1.9, len - 9, 3.8, 0.8, C.ink, P.rim, 0.8);
  ctx.fillStyle = rgba(P.rim, 0.5);
  for (let x = 8; x < len - 4; x += 2.8) ctx.fillRect(x, -0.5, 1.1, 1);
  rimRect(ctx, -4, -2.4, 10, 4.4, 0.8, C.ink, P.rim, 0.8);
  ellipse(ctx, 1, -3.4, 6.4, 1.6);
  ctx.fillStyle = C.ink;
  ctx.fill();
  ctx.strokeStyle = rgba(P.rim, 0.75);
  ctx.lineWidth = 0.6;
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// SdKfz 251 half-track: angular armoured body, front wheels, rear tracks, an MG34 behind a shield
// ---------------------------------------------------------------------------

export function halftrackSide(ctx: Ctx, P: TankPalette): void {
  fillPoly(ctx, [-84, -22, 22, -22, 18, -12, -80, -12], P.bodyDark);
}

export function halftrackHull(ctx: Ctx, P: TankPalette): void {
  // Front mudguard over the steered wheel.
  ctx.strokeStyle = P.rim;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.arc(74, -11, 16, Math.PI * 1.08, Math.PI * 1.92);
  ctx.stroke();
  ctx.strokeStyle = P.body;
  ctx.lineWidth = 2.4;
  ctx.stroke();
  // Track guard over the rear running gear.
  rimPoly(ctx, [-96, -26, -94, -30, 30, -30, 34, -26], P.body, P.rim, 0.9);
  // The armoured body: rear doors, sloped sides with the open top, then the long sloped engine hood.
  rimPoly(ctx, [-98, -27, -98, -50, -92, -54, 34, -54, 44, -50, 98, -38, 102, -30, 96, -27], P.body, P.rim, 1.2);
  fillPoly(ctx, [-94, -31, -94, -48, -89, -51, 32, -51, 42, -47.5, 92, -36.5, 94, -31], P.panel);
  // Fold lines of the faceted plates, vision slits, rear door handle, side stowage box.
  strokeLine(ctx, [-94, -42, 40, -42, 92, -33], rgba(C.void, 0.45), 0.8);
  ctx.fillStyle = C.void;
  ctx.fillRect(36, -48, 6, 1.4);
  ctx.fillRect(-60, -48, 7, 1.3);
  rimRect(ctx, -38, -40, 26, 8, 1, P.panelLit, P.rim, 0.8);
  strokeLine(ctx, [-92, -40, -88, -40], P.bodyDark, 1.2);
  // Engine louvres on the hood and a headlamp.
  ctx.fillStyle = P.bodyDark;
  for (let i = 0; i < 3; i++) ctx.fillRect(56 + i * 7, -44 + i * 1.6, 4.6, 1.2);
  disc(ctx, 92, -40, 1.8, P.rim);
  // The driver's head behind the front visor.
  const look = FACTIONS.german.look;
  crewHead(ctx, 40, -56, 0.8, look.helmet, look.tint);
  balkenkreuz(ctx, -66, -38, 6);
}

/** The gunner behind the MG shield (origin = the shield's foot on the hull rim). */
export function halftrackGunner(ctx: Ctx, P: TankPalette): void {
  const look = FACTIONS.german.look;
  ctx.fillStyle = FIGURE.colors.rim;
  ellipse(ctx, -2, -5, 6.4, 5.6);
  ctx.fill();
  ctx.fillStyle = FIGURE.colors.body;
  ellipse(ctx, -2, -5, 5.6, 4.8);
  ctx.fill();
  crewHead(ctx, -1, -13, 0.85, look.helmet, look.tint);
  // The gun shield, end-on-ish: a tall plate in front of him.
  rimPoly(ctx, [5, 0, 5, -16, 9, -17, 9, 0], P.body, P.rim, 0.9);
}

/** An MG34 on its pintle: perforated jacket, barrel along +x. */
export function mg34OnMount(ctx: Ctx, P: TankPalette, len: number): void {
  rimRect(ctx, -7, -1.5, len + 7, 3, 0.6, C.ink, P.rim, 0.8);
  ctx.fillStyle = rgba(P.rim, 0.5);
  for (let x = 4; x < len - 3; x += 2.6) ctx.fillRect(x, -0.5, 1, 1);
  fillPoly(ctx, [-2, 1.4, 1.6, 1.4, 1, 6, -1.4, 6], C.ink);
}

// ---------------------------------------------------------------------------
// Passengers and the King Tiger's elite paint
// ---------------------------------------------------------------------------

/** The carried squad's helmets showing over the side of an APC (sprite origin = the hull rim at `at`). */
export function paintPassengers(ctx: Ctx, look: VehicleLook): void {
  const L = TANK_LAYOUT[look];
  const pass = L.passengers;
  if (!pass) return;
  const f = FACTIONS[L.faction].look;
  for (let i = 0; i < pass.heads.length; i++) {
    const x = pass.heads[i];
    const bob = i % 2 === 0 ? 0 : -1.2;
    crewHead(ctx, x, pass.headY - 2.6 + bob, 0.82, f.helmet, f.tint);
  }
}

/** Three-tone ambush camouflage over what is already painted (source-atop: only on the vehicle itself). */
export function eliteCamo(ctx: Ctx, blotches: readonly (readonly number[])[]): void {
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = E.camoAlpha;
  for (const b of blotches) {
    ctx.fillStyle = E.camo[b[4]] ?? E.camo[0];
    ellipse(ctx, b[0], b[1], b[2], b[3]);
    ctx.fill();
    // Small "ambush" dots of the base colour in the dark patches.
    ctx.fillStyle = E.camo[0];
    ctx.beginPath();
    ctx.arc(b[0] + b[2] * 0.3, b[1] - b[3] * 0.2, Math.max(1, b[3] * 0.22), 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * The King Tiger's tactical number on the turret side: black digits with a white outline. Painted mirrored, because
 * the enemy-only King Tiger is always drawn facing left (its sprite flipped), so the digits read the right way round.
 */
export function tacticalNumber(ctx: Ctx): void {
  const N = E.number;
  ctx.save();
  ctx.translate(N.x, 0);
  ctx.scale(-1, 1);
  ctx.translate(-N.x, 0);
  ctx.font = `bold ${N.h}px "Trebuchet MS", "Segoe UI", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = C.flagWhite;
  ctx.strokeText(N.text, N.x, N.y);
  ctx.fillStyle = C.void;
  ctx.fillText(N.text, N.x, N.y);
  ctx.restore();
}

/** The elite band painted round the King Tiger's gun. */
export function eliteBarrelBand(ctx: Ctx): void {
  const [x0, x1] = E.barrelBand;
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = rgba(C.flagWhite, 0.85);
  ctx.fillRect(x0, -8, x1 - x0, 16);
  ctx.restore();
}
