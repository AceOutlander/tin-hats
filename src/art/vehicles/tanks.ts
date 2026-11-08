/**
 * Tank sprites as rig parts: track (one sprite per tread phase), wheels,
 * hull, turret and barrel for the Churchill, Panzer IV and King Tiger, plus a
 * burnt-out husk of each. Drawn facing right. Positions come from TANK_LAYOUT
 * (src/data/artLayout.ts); ./tankLayout turns a state into part transforms.
 *
 * Dark silhouette bodies, faction-tint panels and a lighter rim. German
 * turrets carry a small Balkenkreuz, British ones a plain white-red-white flash.
 */
import { ART_COLORS as C, TANK_LAYOUT, TANK_LOOKS, type ArtBox, type TankLook, type TankWheelKind } from '../../data/artLayout';
import { FACTIONS } from '../../data/factions';
import {
  type Ctx,
  TAU,
  balkenkreuz,
  bite,
  charOver,
  ember,
  fillPoly,
  makeSpec,
  mix,
  poly,
  recognitionFlash,
  rgba,
  rimPoly,
  rimRect,
  rimmed,
  rr,
  scorch,
  strokeLine,
} from '../props/kit';
import type { SpriteSpec } from '../types';
import { type BeltPoint, beltPath, beltPoint, makeBelt } from './belt';
import { TANK_KEYS, TANK_TRACK_PITCH } from './tankLayout';

export interface TankPalette {
  body: string;
  bodyDark: string;
  panel: string;
  panelLit: string;
  rim: string;
}

export function palette(look: TankLook): TankPalette {
  const f = FACTIONS[TANK_LAYOUT[look].faction].look;
  return {
    body: mix(C.ink, f.tintDark, 0.45),
    bodyDark: mix(C.ink, f.tintDark, 0.16),
    panel: mix(f.tintDark, C.ink, 0.1),
    panelLit: mix(f.tintDark, f.tint, 0.4),
    rim: mix(f.tint, '#ffffff', 0.25),
  };
}

function disc(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

function ring(ctx: Ctx, x: number, y: number, r: number, color: string, width: number): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// Wheels (origin = hub; they spin, so no directional lighting is baked in)
// ---------------------------------------------------------------------------

function paintWheel(ctx: Ctx, r: number, kind: TankWheelKind, P: TankPalette): void {
  const tyre = '#11120e';
  if (kind === 'sprocket') {
    const teeth = Math.max(9, Math.round(r * 1.15));
    ctx.fillStyle = P.bodyDark;
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * TAU;
      ctx.save();
      ctx.rotate(a);
      ctx.fillRect(r - 2.6, -1.1, 2.6, 2.2);
      ctx.restore();
    }
    disc(ctx, 0, 0, r - 1.8, P.bodyDark);
    disc(ctx, 0, 0, r - 3.2, P.panel);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + 0.3;
      disc(ctx, Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.15, C.void);
    }
    disc(ctx, 0, 0, r * 0.24, P.bodyDark);
    ring(ctx, 0, 0, r - 3.2, rgba(P.rim, 0.45), 0.6);
    return;
  }
  if (kind === 'idler') {
    disc(ctx, 0, 0, r, P.bodyDark);
    disc(ctx, 0, 0, r - 1.7, P.panel);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.2;
      disc(ctx, Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.17, C.void);
    }
    disc(ctx, 0, 0, r * 0.22, P.bodyDark);
    ring(ctx, 0, 0, r - 1.7, rgba(P.rim, 0.45), 0.6);
    return;
  }
  if (kind === 'return') {
    disc(ctx, 0, 0, r, tyre);
    disc(ctx, 0, 0, r * 0.55, P.panel);
    disc(ctx, r * 0.3, 0, r * 0.14, P.bodyDark);
    return;
  }
  // Road wheel: tyre, steel disc, dished centre, bolt ring, hub.
  const big = r > 10;
  disc(ctx, 0, 0, r, big ? P.bodyDark : tyre);
  disc(ctx, 0, 0, r * (big ? 0.86 : 0.74), P.panel);
  disc(ctx, 0, 0, r * 0.5, mix(P.panel, C.ink, 0.4));
  ring(ctx, 0, 0, r * (big ? 0.86 : 0.74), rgba(P.rim, 0.5), 0.6);
  const bolts = big ? 8 : 6;
  for (let i = 0; i < bolts; i++) {
    const a = (i / bolts) * TAU;
    disc(ctx, Math.cos(a) * r * 0.66, Math.sin(a) * r * 0.66, Math.max(0.45, r * 0.06), rgba(P.rim, 0.75));
  }
  disc(ctx, 0, 0, r * 0.2, P.bodyDark);
  // A streak of mud so the turning reads.
  ctx.fillStyle = rgba(C.ink, 0.38);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, r * 0.72, 0.4, 1.15);
  ctx.closePath();
  ctx.fill();
}

function wheelBox(r: number): ArtBox {
  const half = Math.ceil(r) + 1;
  return { w: half * 2, h: half * 2, ox: half, oy: half };
}

// ---------------------------------------------------------------------------
// Tracks (tank space; static on the ground)
// ---------------------------------------------------------------------------

const SCRATCH_POINT: BeltPoint = { x: 0, y: 0, nx: 0, ny: 0 };

function churchillSide(ctx: Ctx, P: TankPalette): void {
  // Armoured pannier between the track runs.
  rimPoly(ctx, [-84, -39.4, 82, -42.3, 82, -18.5, -84, -18.5], P.panel, P.rim, 1.1);
  // Mud chutes.
  for (const x of [-66, -2, 22, 66]) {
    fillPoly(ctx, [x, -29.5, x + 13, -29.5, x + 10, -18.5, x - 3, -18.5], C.void);
    strokeLine(ctx, [x, -30, x + 13, -30], rgba(P.rim, 0.5), 0.6);
  }
  // Air intake louvre and the side escape hatch.
  rimRect(ctx, -40, -38.6, 31, 12, 1.5, P.panelLit, P.rim);
  ctx.fillStyle = P.bodyDark;
  for (let i = 0; i < 3; i++) ctx.fillRect(-37, -35 + i * 2.8, 25, 1.1);
  rr(ctx, 43, -39, 15, 14, 3.5);
  ctx.strokeStyle = P.bodyDark;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = rgba(P.rim, 0.55);
  for (let x = -78; x <= 78; x += 12) ctx.fillRect(x, -38.6 - (x + 84) * 0.0175 + 1.6, 1.1, 1.1);
}

function panzer4Side(ctx: Ctx, P: TankPalette): void {
  fillPoly(ctx, [-76, -31, 78, -31, 74, -17, -72, -17], P.bodyDark);
  // Bogie brackets between each pair of road wheels.
  for (const cx of [-51.75, -17.75, 16.25, 50.25]) {
    rimPoly(ctx, [cx - 6, -24, cx + 6, -24, cx + 2.5, -13, cx - 2.5, -13], P.panel, P.rim, 0.9);
  }
}

function kingTigerSide(ctx: Ctx, P: TankPalette): void {
  fillPoly(ctx, [-106, -37, 108, -37, 102, -22, -102, -22], P.bodyDark);
}

const SIDE_DETAIL: Record<TankLook, (ctx: Ctx, P: TankPalette) => void> = {
  churchill: churchillSide,
  panzer4: panzer4Side,
  kingTiger: kingTigerSide,
};

function paintTrack(ctx: Ctx, look: TankLook, frame: number): void {
  const L = TANK_LAYOUT[look];
  const P = palette(look);
  const T = L.trackThickness;
  const centre = makeBelt(L.belt, T / 2);
  beltPath(ctx, centre);
  ctx.fillStyle = C.void;
  ctx.fill();
  SIDE_DETAIL[look](ctx, P);
  beltPath(ctx, centre);
  ctx.strokeStyle = C.trackBand;
  ctx.lineWidth = T;
  ctx.lineJoin = 'round';
  ctx.stroke();
  // Tread lugs, shifted a fraction of the pitch per frame so the tread scrolls.
  const pitch = TANK_TRACK_PITCH[look];
  const count = Math.round(centre.length / pitch);
  const offset = (frame / L.trackFrames) * pitch;
  const lugW = pitch * 0.42;
  for (let i = 0; i < count; i++) {
    const p = beltPoint(centre, i * pitch + offset, SCRATCH_POINT);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.atan2(p.ny, p.nx));
    ctx.fillStyle = C.trackLug;
    ctx.fillRect(-T / 2, -lugW / 2, T, lugW);
    ctx.fillStyle = C.trackBand;
    ctx.fillRect(T / 2 - 0.2, -lugW * 0.4, 1.1, lugW * 0.8);
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Hulls (tank space; the sprite origin is the rock pivot)
// ---------------------------------------------------------------------------

function churchillHull(ctx: Ctx, P: TankPalette): void {
  // Track guards: a long plate over the top run curling round both ends.
  const guard = (c: Ctx): void => {
    c.beginPath();
    c.arc(-94, -28, 18.2, (200 / 360) * TAU, (269 / 360) * TAU);
    c.arc(91, -31, 18.2, (-91 / 360) * TAU, (-20 / 360) * TAU);
  };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  guard(ctx);
  ctx.strokeStyle = P.rim;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.save();
  ctx.translate(0, 1.1);
  guard(ctx);
  ctx.strokeStyle = P.body;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
  // Low superstructure between the tracks, engine deck to the rear.
  rimPoly(ctx, [-91, -47, -89, -53.5, -70, -56, 58, -56, 69, -50, 69, -47.5], P.body, P.rim);
  fillPoly(ctx, [-66, -49, -64, -54, 52, -54, 60, -49.5], P.panel);
  ctx.fillStyle = P.bodyDark;
  for (let i = 0; i < 5; i++) ctx.fillRect(-62 + i * 5, -53, 2.6, 3.2);
  rimRect(ctx, -24, -58.5, 56, 3.5, 1, P.bodyDark, P.rim, 0.9);
  // Exhaust pipe along the rear deck, a stowage bin and a headlamp.
  rimRect(ctx, -92, -58.6, 24, 4.4, 2.2, mix(C.rust, C.ink, 0.35), P.rim, 1);
  rimRect(ctx, 40, -59.5, 16, 4.5, 1, P.panel, P.rim, 0.9);
  disc(ctx, 74, -53.5, 2.2, P.rim);
  disc(ctx, 74.4, -53.5, 1.3, P.bodyDark);
}

function panzer4Hull(ctx: Ctx, P: TankPalette): void {
  // Fenders with a turned-up front and a rear mudflap.
  rimPoly(ctx, [-96, -33, -94, -36.6, 90, -36.6, 97, -40.5, 98.5, -38.5, 92, -33.2], P.body, P.rim, 1);
  fillPoly(ctx, [-96, -34, -93, -34, -95, -25, -98, -26], P.body);
  // Engine deck, superstructure, bow.
  rimPoly(ctx, [-90, -36, -88, -46.5, -64, -50, -62, -36], P.body, P.rim);
  rimPoly(ctx, [58, -45.5, 84, -42, 93, -36.5, 58, -36], P.body, P.rim);
  rimPoly(ctx, [-64, -36, -62, -56, 54, -56, 58, -45.5, 60, -36], P.body, P.rim);
  fillPoly(ctx, [-58, -39, -57.2, -53, 50, -53, 53.5, -39], P.panel);
  // Vision port, engine louvres, tools.
  rimRect(ctx, 34, -51, 9, 4.6, 1, P.bodyDark, P.rim, 0.8);
  ctx.fillStyle = P.bodyDark;
  for (let i = 0; i < 3; i++) ctx.fillRect(-85, -45.5 + i * 2.7, 17, 1.2);
  strokeLine(ctx, [-42, -42.5, -16, -42.5], P.bodyDark, 1.7);
  ctx.fillStyle = P.bodyDark;
  ctx.fillRect(-13, -45, 5.5, 4.6);
  // Spare track links on the bow.
  ctx.fillStyle = C.trackBand;
  for (let i = 0; i < 4; i++) ctx.fillRect(63 + i * 5.4, -43.6 + i * 0.72, 4, 2.7);
  // Muffler across the tail and the hull machine-gun ball mount.
  rimRect(ctx, -104, -33.5, 8.5, 13.5, 3.8, mix(C.rust, C.ink, 0.35), P.rim, 1);
  strokeLine(ctx, [58, -48.5, 63.5, -48.5], C.ink, 1.4);
  disc(ctx, 57.6, -48.5, 2.5, P.rim);
  disc(ctx, 57.9, -48.2, 1.9, P.bodyDark);
}

function kingTigerHull(ctx: Ctx, P: TankPalette): void {
  // Exhaust stacks behind the tail plate.
  rimRect(ctx, -135, -73, 5.2, 31, 2.2, mix(C.rust, C.ink, 0.4), P.rim, 1);
  ctx.fillStyle = mix(C.rust, C.ink, 0.4);
  ctx.fillRect(-132, -45, 8, 3.6);
  // One big slab-sided hull with a long sloped glacis.
  rimPoly(ctx, [-126, -31.5, -129, -36, -124, -59.5, -117, -64, 80, -64, 125, -39.5, 129, -34.5, 125, -31], P.body, P.rim, 1.4);
  fillPoly(ctx, [-129, -36, -126, -36, -129.5, -29, -132.5, -30], P.body);
  fillPoly(ctx, [-118, -47.5, -115.5, -61, 77, -61, 101.5, -47.5], P.panel);
  // Side skirts, one plate missing.
  for (let i = 0; i < 9; i++) {
    if (i === 6) continue;
    rimRect(ctx, -116 + i * 24.4, -45.5, 23.4, 14, 0.8, mix(P.panel, P.body, 0.45), P.rim, 0.9);
  }
  // Tow cable slung along the side.
  ctx.strokeStyle = P.bodyDark;
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-98, -57.5);
  ctx.quadraticCurveTo(-30, -50.5, 40, -57.5);
  ctx.stroke();
  // Roof fittings.
  rimRect(ctx, 62, -67, 9, 3.6, 1, P.bodyDark, P.rim, 0.9);
  rimRect(ctx, -110, -66.6, 20, 3.2, 1, P.bodyDark, P.rim, 0.9);
  rimRect(ctx, -82, -66.6, 14, 3.2, 1, P.bodyDark, P.rim, 0.9);
  // Hull machine gun in its ball mount on the glacis.
  strokeLine(ctx, [106, -50, 112.5, -50], C.ink, 1.5);
  disc(ctx, 105, -50, 3.3, P.rim);
  disc(ctx, 105.3, -49.6, 2.6, P.bodyDark);
}

export const HULL: Record<TankLook, (ctx: Ctx, P: TankPalette) => void> = {
  churchill: churchillHull,
  panzer4: panzer4Hull,
  kingTiger: kingTigerHull,
};

// ---------------------------------------------------------------------------
// Turrets (origin = turret ring centre; the turret sits on y = 0)
// ---------------------------------------------------------------------------

function churchillTurret(ctx: Ctx, P: TankPalette): void {
  rimRect(ctx, -47, -21, 13, 16, 1.5, P.panel, P.rim, 1);
  rimPoly(ctx, [-32, 0, -35, -8, -33, -24, -28, -27.5, 24, -27.5, 33, -22, 35, -6, 33, 0], P.body, P.rim, 1.4);
  fillPoly(ctx, [-29, -3.5, -30, -22, -26, -24.5, 22, -24.5, 29.5, -20, 31, -5, 30, -3.5], P.panel);
  // Commander's cupola, periscope, lifting eyes.
  rimRect(ctx, -17, -32, 15, 5.5, 1.6, P.bodyDark, P.rim, 1);
  rimRect(ctx, 8, -29.6, 6, 2.8, 0.8, P.bodyDark, P.rim, 0.8);
  // Gun slot and collar.
  ctx.fillStyle = C.void;
  ctx.fillRect(26.5, -17.5, 8.5, 11);
  rimRect(ctx, 30, -16.5, 10, 9, 2.5, P.body, P.rim, 1);
  recognitionFlash(ctx, -14, -18, 16, 8);
  ctx.fillStyle = rgba(P.rim, 0.6);
  for (const x of [-26, 18]) ctx.fillRect(x, -7, 1.3, 1.3);
}

function panzer4Turret(ctx: Ctx, P: TankPalette): void {
  // Stowage bin on the turret rear.
  rimRect(ctx, -48, -20, 16.5, 16, 2, P.panel, P.rim, 1);
  rimPoly(ctx, [-29, 0, -33, -5, -30, -21, -26, -23, 16, -23, 28, -14.5, 30, -3, 27, 0], P.body, P.rim, 1.4);
  fillPoly(ctx, [-26.5, -3, -27.5, -18.5, -24, -20.2, 14.5, -20.2, 24.5, -13, 26, -3], P.panel);
  // Side door.
  rr(ctx, -15, -17.5, 15, 12.5, 1.5);
  ctx.strokeStyle = P.bodyDark;
  ctx.lineWidth = 1.1;
  ctx.stroke();
  ctx.fillStyle = P.bodyDark;
  ctx.fillRect(-10, -14, 5, 1.4);
  balkenkreuz(ctx, 9.5, -11.2, 7.4);
  // Commander's cupola: a drum with vision slits and a hatch lid.
  rimRect(ctx, -25, -31, 17, 9, 2, P.bodyDark, P.rim, 1.1);
  ctx.fillStyle = C.void;
  for (const x of [-22.5, -17.5, -12.5]) ctx.fillRect(x, -27.6, 2.6, 1.5);
  strokeLine(ctx, [-24, -31.6, -11, -32.6], P.body, 1.5);
  // Box mantlet.
  rimRect(ctx, 24.5, -18.5, 10, 14, 2, P.body, P.rim, 1);
  disc(ctx, 31.5, -15.4, 0.9, C.void);
}

function kingTigerTurret(ctx: Ctx, P: TankPalette): void {
  rimPoly(ctx, [-50, 0, -56, -7, -52, -28, -46, -32, 30, -32, 46, -25, 50, -6, 46, 0], P.body, P.rim, 1.5);
  fillPoly(ctx, [-47, -4, -50, -8, -47, -26, -43.5, -28.6, 28, -28.6, 41.5, -22.5, 45, -6, 43, -4], P.panel);
  // Rear escape hatch, spare track links, vent.
  rr(ctx, -49, -23, 8.5, 15, 1.2);
  ctx.strokeStyle = P.bodyDark;
  ctx.lineWidth = 1.1;
  ctx.stroke();
  ctx.fillStyle = C.trackBand;
  for (let i = 0; i < 4; i++) ctx.fillRect(-36 + i * 5.6, -24, 4.6, 7);
  ctx.fillStyle = rgba(P.rim, 0.4);
  for (let i = 0; i < 4; i++) ctx.fillRect(-36 + i * 5.6, -24, 4.6, 0.9);
  balkenkreuz(ctx, 6, -15.5, 10.5);
  // Cupola, ventilator dome.
  rimRect(ctx, -31, -40.5, 20, 9.5, 2.2, P.bodyDark, P.rim, 1.1);
  ctx.fillStyle = C.void;
  for (const x of [-28.5, -22.5, -16.5]) ctx.fillRect(x, -37, 3, 1.6);
  rimRect(ctx, 10, -34.6, 9, 3, 1.4, P.bodyDark, P.rim, 0.8);
  // Bell-shaped mantlet.
  rimmed(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(43, -25.5);
      c.bezierCurveTo(54, -25, 62, -21, 63, -17);
      c.lineTo(63, -11);
      c.bezierCurveTo(62, -7, 54, -3.5, 43, -3);
      c.closePath();
    },
    P.body,
    P.rim,
    0.2,
    1.3,
  );
}

export const TURRET: Record<TankLook, (ctx: Ctx, P: TankPalette) => void> = {
  churchill: churchillTurret,
  panzer4: panzer4Turret,
  kingTiger: kingTigerTurret,
};

// ---------------------------------------------------------------------------
// Barrels (origin = trunnion, pointing along +x)
// ---------------------------------------------------------------------------

/** A gun tube built from [x0, x1, halfThickness] sections. */
export function tube(ctx: Ctx, sections: readonly number[], P: TankPalette): void {
  for (let i = 0; i < sections.length; i += 3) {
    const x0 = sections[i];
    const x1 = sections[i + 1];
    const half = sections[i + 2];
    rimRect(ctx, x0, -half, x1 - x0, half * 2, Math.min(1, half * 0.4), P.bodyDark, P.rim, 1);
  }
}

/** The gun tube; `len` defaults to the look's barrel (the long-gun upgrade passes a longer one). */
export function paintBarrel(ctx: Ctx, look: TankLook, P: TankPalette, len = TANK_LAYOUT[look].barrelLength): void {
  if (look === 'churchill') {
    tube(ctx, [-7, len, 2.4, -2, 12, 3.3, len - 8, len, 3.3], P);
  } else if (look === 'panzer4') {
    tube(ctx, [-9, len, 3.2, -3, 13, 4.3, len - 3.5, len, 3.9], P);
  } else {
    tube(ctx, [-9, len - 2, 2.8, -3, 46, 3.9, len - 15, len - 9.5, 5, len - 6.5, len - 0.5, 4.6], P);
    ctx.fillStyle = C.void;
    ctx.fillRect(len - 9.5, -2, 3, 4);
  }
  ctx.fillStyle = C.void;
  ctx.fillRect(len - 1, -1.2, 1, 2.4);
}

// ---------------------------------------------------------------------------
// Husk: the whole tank, burnt out, in one sprite (origin = tank origin)
// ---------------------------------------------------------------------------

function paintHusk(ctx: Ctx, look: TankLook): void {
  const L = TANK_LAYOUT[look];
  const P = palette(look);
  paintTrack(ctx, look, 0);
  // The track has parted at the front and a length of it lies on the ground.
  let front = L.belt[0];
  for (const pulley of L.belt) if (pulley.x + pulley.r > front.x + front.r) front = pulley;
  bite(ctx, [front.x - 22, front.y - front.r - 12, front.x + front.r + 12, front.y - front.r - 12, front.x + front.r + 12, front.y - 2, front.x - 6, front.y - 2]);
  const lie = front.x + front.r - 6;
  ctx.fillStyle = C.trackBand;
  ctx.fillRect(lie, -L.trackThickness * 0.8, 44, L.trackThickness * 0.8);
  ctx.fillStyle = C.trackLug;
  for (let x = lie + 2; x < lie + 42; x += L.trackPitch) ctx.fillRect(x, -L.trackThickness * 0.8, L.trackPitch * 0.42, L.trackThickness * 0.8);
  // Wheels, a few of them gone.
  for (let i = 0; i < L.wheels.length; i++) {
    const w = L.wheels[i];
    if (w.kind === 'road' && i % 4 === 2) continue;
    ctx.save();
    ctx.translate(w.x, w.y);
    ctx.rotate(i * 0.9);
    paintWheel(ctx, w.r, w.kind, P);
    ctx.restore();
  }
  HULL[look](ctx, P);
  // The turret has been blown off its ring: a ragged black hole in the deck, the turret
  // slid back and cocked over the rear edge of it, the gun sagging.
  const hx = L.turretRing.x;
  const hy = L.turretRing.y;
  const hw = L.turretBox.w * 0.34;
  ctx.fillStyle = C.void;
  poly(ctx, [
    hx - hw, hy + 4, hx - hw * 0.72, hy - 4, hx - hw * 0.4, hy, hx - hw * 0.1, hy - 6, hx + hw * 0.3, hy - 1,
    hx + hw * 0.62, hy - 5.5, hx + hw, hy + 4, hx + hw * 0.7, hy + 11, hx - hw * 0.7, hy + 11,
  ]);
  ctx.fill();
  ctx.save();
  ctx.translate(hx - L.turretBox.w * 0.2, hy - 5);
  ctx.rotate(-0.26);
  ctx.save();
  ctx.translate(L.trunnion.x - hx, L.trunnion.y - hy);
  ctx.rotate(0.16);
  paintBarrel(ctx, look, P);
  ctx.restore();
  TURRET[look](ctx, P);
  // A hatch left open.
  strokeLine(ctx, [-12, -L.turretBox.oy + 9, -19, -L.turretBox.oy + 1], P.bodyDark, 2);
  ctx.restore();
  // Burnt: darkened, sooted and rusting.
  const B = L.huskBox;
  charOver(ctx, -B.ox, -B.oy, B.w, B.h, 0.62);
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = rgba(C.rust, 0.2);
  ctx.fillRect(-B.ox, -B.oy, B.w, B.h);
  ctx.restore();
  scorch(ctx, hx + hw * 0.3, hy - 4, L.length * 0.3, 34, 0.6);
  scorch(ctx, -L.length * 0.3, -34, L.length * 0.22, 28, 0.5);
  // Embers still glowing inside the hull.
  ember(ctx, hx + hw * 0.25, hy + 4, hw * 0.55, 0.6);
}

// ---------------------------------------------------------------------------

function tankPartSpecs(look: TankLook): SpriteSpec[] {
  const L = TANK_LAYOUT[look];
  const K = TANK_KEYS[look];
  const P = palette(look);
  const specs: SpriteSpec[] = [];
  for (let frame = 0; frame < L.trackFrames; frame++) {
    specs.push(makeSpec(K.track[frame], L.trackBox, (ctx) => paintTrack(ctx, look, frame)));
  }
  const seen = new Set<string>();
  for (let i = 0; i < L.wheels.length; i++) {
    const key = K.wheels[i];
    if (seen.has(key)) continue;
    seen.add(key);
    const wheel = L.wheels[i];
    specs.push(makeSpec(key, wheelBox(wheel.r), (ctx) => paintWheel(ctx, wheel.r, wheel.kind, P)));
  }
  specs.push(
    makeSpec(K.hull, L.hullBox, (ctx) => {
      ctx.translate(-L.rockPivot.x, -L.rockPivot.y);
      HULL[look](ctx, P);
    }),
  );
  specs.push(makeSpec(K.barrel, L.barrelBox, (ctx) => paintBarrel(ctx, look, P)));
  specs.push(makeSpec(K.turret, L.turretBox, (ctx) => TURRET[look](ctx, P)));
  specs.push(makeSpec(K.husk, L.huskBox, (ctx) => paintHusk(ctx, look)));
  return specs;
}

/** Every tank sprite for every look: track frames, wheels, hull, barrel, turret, husk. */
export function tankSpecs(): SpriteSpec[] {
  const specs: SpriteSpec[] = [];
  for (const look of TANK_LOOKS) specs.push(...tankPartSpecs(look));
  return specs;
}
