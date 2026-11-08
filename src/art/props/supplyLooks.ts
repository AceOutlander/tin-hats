/**
 * Quartermaster supply looks: the supply dump at each income stage (a few crates, stacked crates, crates with fuel
 * drums, all that with a parked supply truck), the bigger load a sapper carries, the handcart and the small supply
 * truck (British Bedford-style in khaki, German Opel Blitz-style in field grey). Layouts in src/data/looksSupply.ts.
 * Light comes from the upper left, as on the tanks.
 */
import { ART_COLORS as C } from '../../data/artLayout';
import { FACTIONS } from '../../data/factions';
import { BIG_LOAD_BOX, CART_LAYOUT, DUMP_STYLE_LAYOUT, DUMP_TRUCK_X, SUPPLY_TRUCK_LAYOUT } from '../../data/looksSupply';
import type { FactionId } from '../../data/schema';
import type { DumpStyle } from '../../data/upgradeLooks';
import type { SpriteSpec } from '../types';
import {
  type Ctx,
  TAU,
  charOver,
  ellipse,
  ember,
  fillPoly,
  footing,
  inside,
  makeSpec,
  mix,
  poly,
  rgba,
  rimPoly,
  rimRect,
  rimmed,
  rng,
  rr,
  scorch,
  strokeLine,
} from './kit';

export type TruckState = 'empty' | 'loaded' | 'wreck';
export const DUMP_STYLE_LIST: readonly DumpStyle[] = ['crates', 'stacked', 'drums', 'truck'];
export const TRUCK_STATES: readonly TruckState[] = ['empty', 'loaded', 'wreck'];

export function dumpStyleKey(style: DumpStyle, faction: FactionId): string {
  return `prop/dump/${style}/${faction}`;
}

export function bigLoadKey(faction: FactionId): string {
  return `fig/${faction}/bigLoad`;
}

export function cartKey(faction: FactionId, loaded: boolean): string {
  return `prop/cart/${faction}/${loaded ? 'loaded' : 'empty'}`;
}

export function truckKey(faction: FactionId, state: TruckState): string {
  return `veh/supplyTruck/${faction}/${state}`;
}

// ---------------------------------------------------------------------------
// Faction palette
// ---------------------------------------------------------------------------

interface Pal {
  faction: FactionId;
  wood: string;
  woodDark: string;
  woodRim: string;
  body: string;
  bodyDark: string;
  lit: string;
  rim: string;
  tilt: string;
  tiltDark: string;
  tiltRim: string;
  drum: string;
}

function pal(faction: FactionId): Pal {
  const f = FACTIONS[faction].look;
  const k = faction === 'german' ? 0.3 : 0.2;
  return {
    faction,
    wood: mix(C.crate, f.tint, k),
    woodDark: mix(C.crateDark, f.tintDark, k),
    woodRim: mix(C.crateRim, f.tint, k * 0.6),
    body: mix(f.tintDark, C.ink, 0.38),
    bodyDark: mix(f.tintDark, C.ink, 0.66),
    lit: mix(f.tintDark, f.tint, 0.45),
    rim: mix(f.tint, '#ffffff', 0.22),
    tilt: mix(C.canvas, f.tint, 0.55),
    tiltDark: mix(C.canvasDark, f.tintDark, 0.5),
    tiltRim: mix(C.canvasRim, f.tint, 0.4),
    drum: faction === 'german' ? mix(C.drum, f.tintDark, 0.5) : C.drum,
  };
}

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

/** A wooden crate; (x, y) is its top-left corner. shade < 0 darker (rear rank), > 0 lighter. */
function crate(ctx: Ctx, P: Pal, x: number, y: number, w: number, h: number, shade = 0, mark = true): void {
  const body = shade >= 0 ? mix(P.wood, P.woodRim, shade) : mix(P.wood, P.woodDark, -shade);
  rimRect(ctx, x, y, w, h, 0.8, body, P.woodRim, 1.2);
  ctx.fillStyle = rgba(P.woodDark, 0.75);
  const planks = Math.max(2, Math.round(h / 6.5));
  for (let i = 1; i < planks; i++) ctx.fillRect(x + 0.5, y + (h * i) / planks - 0.4, w - 1, 0.9);
  const batten = Math.max(1.6, w * 0.09);
  ctx.fillStyle = P.woodDark;
  ctx.fillRect(x + 1.4, y + 1.2, batten, h - 1.2);
  ctx.fillRect(x + w - 1.4 - batten, y + 1.2, batten, h - 1.2);
  if (mark && w > 13) stencil(ctx, P, x + w / 2, y + h * 0.45, Math.min(w * 0.42, 10));
}

/**
 * Stencilled marking: British crates carry a plain bar with a broad arrow-like notch, German crates a bar with three
 * small figures (no lettering either way).
 */
function stencil(ctx: Ctx, P: Pal, cx: number, cy: number, w: number): void {
  const h = Math.max(1.4, w * 0.26);
  ctx.fillStyle = rgba(C.flagWhite, 0.5);
  if (P.faction === 'british') {
    ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
    fillPoly(ctx, [cx - h * 0.7, cy + h * 0.6, cx, cy + h * 1.6, cx + h * 0.7, cy + h * 0.6], rgba(C.flagWhite, 0.45));
  } else {
    const d = w / 4;
    for (let i = 0; i < 3; i++) ctx.fillRect(cx - w / 2 + i * (d + d / 2) + 0.2, cy - h / 2, d, h * 1.3);
  }
}

/** An upright fuel drum standing on yBase. */
function drum(ctx: Ctx, P: Pal, x: number, yBase: number, w: number, h: number, dark = 0): void {
  const body = mix(P.drum, C.drumDark, dark);
  rimRect(ctx, x, yBase - h, w, h, 2, body, C.drumRim, 1.3);
  ctx.fillStyle = rgba(C.drumDark, 0.9);
  ctx.fillRect(x, yBase - h * 0.68, w, 1.3);
  ctx.fillRect(x, yBase - h * 0.34, w, 1.3);
  ctx.fillStyle = rgba(C.drumRim, 0.45);
  ctx.fillRect(x + w * 0.16, yBase - h + 2.4, 1.6, h - 4.8);
  ctx.fillStyle = rgba(C.void, 0.28);
  ctx.fillRect(x + w * 0.68, yBase - h + 1.6, w * 0.32 - 0.6, h - 2.4);
  // Bung on the lid.
  ctx.fillStyle = C.drumDark;
  ctx.fillRect(x + w * 0.62, yBase - h - 1, 2.2, 1.4);
}

/** A drum lying on its side, (cx, cy) its centre. */
function lyingDrum(ctx: Ctx, P: Pal, cx: number, cy: number, len: number, r: number): void {
  rimRect(ctx, cx - len / 2, cy - r, len, r * 2, r * 0.4, mix(P.drum, C.drumDark, 0.2), C.drumRim, 1.2);
  ctx.fillStyle = rgba(C.drumDark, 0.9);
  ctx.fillRect(cx - len * 0.18, cy - r, 1.2, r * 2);
  ctx.fillRect(cx + len * 0.18, cy - r, 1.2, r * 2);
  ellipse(ctx, cx + len / 2 - 0.6, cy, 1.6, r * 0.92);
  ctx.fillStyle = mix(P.drum, C.drumRim, 0.25);
  ctx.fill();
}

function jerrycan(ctx: Ctx, P: Pal, x: number, yBase: number, s = 1): void {
  const w = 8.5 * s;
  const h = 13 * s;
  rimRect(ctx, x, yBase - h, w, h, 1.6 * s, P.drum, C.drumRim, 1.1);
  fillPoly(ctx, [x + 1.6 * s, yBase - h - 2.6 * s, x + 6 * s, yBase - h - 2.6 * s, x + 6 * s, yBase - h, x + 1.6 * s, yBase - h], C.drumDark);
  ctx.strokeStyle = rgba(C.drumDark, 0.9);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(x + 1.8 * s, yBase - h * 0.82);
  ctx.lineTo(x + w - 1.8 * s, yBase - h * 0.2);
  ctx.moveTo(x + w - 1.8 * s, yBase - h * 0.82);
  ctx.lineTo(x + 1.8 * s, yBase - h * 0.2);
  ctx.stroke();
}

function sack(ctx: Ctx, x: number, yBase: number, w: number, h: number, tone: number): void {
  rimmed(
    ctx,
    (c) => {
      c.beginPath();
      c.moveTo(x, yBase);
      c.bezierCurveTo(x - 1.6, yBase - h * 0.8, x + w * 0.2, yBase - h, x + w * 0.5, yBase - h);
      c.bezierCurveTo(x + w * 0.82, yBase - h, x + w + 1.6, yBase - h * 0.8, x + w, yBase);
      c.closePath();
    },
    mix(C.sandbag, C.silk, 0.25 + tone),
    mix(C.sandbagRim, C.silk, 0.5),
    0.2,
    1.2,
  );
}

/** A rope lashing along a polyline. */
function rope(ctx: Ctx, pts: readonly number[]): void {
  strokeLine(ctx, pts, rgba(C.silk, 0.7), 0.8);
}

function disc(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Supply truck (facing +x, origin = ground centre)
// ---------------------------------------------------------------------------

type Tilt = 'closed' | 'rolled' | 'none';

interface TruckOpts {
  tilt: Tilt;
  cargo: boolean;
  driver: boolean;
  wreck: boolean;
}

interface TruckShape {
  /** Cab outline (closed polygon), bonnet included. */
  cab: number[];
  /** Window in the cab door. */
  window: number[];
  /** Front mudguard over the front wheel. */
  guard: number[];
  /** Radiator grille strip. */
  grille: number[];
  lamp: [number, number];
}

const WHEEL_R = 9;
const WHEEL_Y = -9;
const REAR_X = -27;
const FRONT_X = 31;
const BED_X0 = -50;
const BED_X1 = 5;
const BED_TOP = -31;
const BED_FLOOR = -20;
const TILT_TOP = -50;

/** British: square Bedford cab with an upright screen and a flat-fronted bonnet; German: rounded Blitz cab, sloping nose. */
const TRUCK_SHAPES: Record<FactionId, TruckShape> = {
  british: {
    cab: [6, -17, 6, -46, 8, -48, 27, -48, 28.5, -46, 30, -33, 47, -32, 49.5, -30, 49.5, -16, 6, -16],
    window: [12.5, -45, 26.5, -45, 27.5, -36, 12.5, -36],
    guard: [20, -16, 21, -21, 26, -24, 37, -24, 42, -21, 49, -19, 49, -16],
    grille: [46.5, -31, 49.5, -30, 49.5, -19, 46.5, -19],
    lamp: [44, -27],
  },
  german: {
    cab: [6, -17, 6, -44, 9, -48, 24, -48.5, 27.5, -46, 30.5, -33.5, 43, -32.5, 47.5, -29.5, 50, -23, 50, -16, 6, -16],
    window: [12, -44.5, 24.5, -45, 27.5, -36, 12, -36],
    guard: [19, -16, 21, -20, 27, -24.5, 36, -25, 43, -22, 48.5, -17.5, 48.5, -16],
    grille: [44.5, -32, 47.5, -29.5, 50, -23, 50, -19, 47, -19],
    lamp: [41, -28],
  },
};

function truckWheel(ctx: Ctx, P: Pal, x: number, wreck: boolean): void {
  const y = WHEEL_Y;
  if (wreck) {
    // Tyres burnt off: the bare steel rim sits on the ground.
    disc(ctx, x, -6.4, 6.4, C.char);
    ctx.strokeStyle = mix(C.rust, C.char, 0.3);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(x, -6.4, 5.4, 0, TAU);
    ctx.stroke();
    disc(ctx, x, -6.4, 2, mix(C.rust, C.char, 0.5));
    return;
  }
  disc(ctx, x, y, WHEEL_R, '#121310');
  // Tread blocks along the bottom and a lit rim on the upper left.
  ctx.strokeStyle = rgba(C.rim, 0.45);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, WHEEL_R - 0.7, Math.PI * 1.05, Math.PI * 1.55);
  ctx.stroke();
  disc(ctx, x, y, WHEEL_R * 0.56, P.bodyDark);
  ctx.strokeStyle = rgba(P.rim, 0.55);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(x, y, WHEEL_R * 0.56 - 0.5, Math.PI * 1.0, Math.PI * 1.6);
  ctx.stroke();
  disc(ctx, x, y, 1.9, P.lit);
  ctx.fillStyle = rgba(C.void, 0.8);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    ctx.fillRect(x + Math.cos(a) * 3.3 - 0.4, y + Math.sin(a) * 3.3 - 0.4, 0.8, 0.8);
  }
}

/** Black driver silhouette (head, shoulders, faction helmet) seen through the cab window, facing +x. */
function driver(ctx: Ctx, faction: FactionId, x: number, y: number): void {
  const ink = '#0c0c0c';
  ctx.fillStyle = ink;
  // Shoulders and arm reaching to the wheel.
  rr(ctx, x - 5, y + 3, 9, 8, 2.5);
  ctx.fill();
  strokeLine(ctx, [x + 2, y + 6, x + 6.5, y + 6.5], ink, 2.2);
  disc(ctx, x, y, 2.9, ink);
  if (faction === 'british') {
    // Brodie: shallow dome with a wide flat brim.
    ellipse(ctx, x, y - 2.2, 6, 1.1);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x, y - 2.4, 3.6, 2.6, 0, Math.PI, 0);
    ctx.fill();
  } else {
    // Stahlhelm: tall dome, short visor and a flared skirt over the neck.
    ctx.beginPath();
    ctx.moveTo(x + 4.2, y - 1.6);
    ctx.bezierCurveTo(x + 4, y - 6.2, x - 3.8, y - 6.6, x - 3.6, y - 1.8);
    ctx.lineTo(x - 5, y + 0.4);
    ctx.lineTo(x - 2.6, y + 0.2);
    ctx.lineTo(x - 2.2, y - 1);
    ctx.closePath();
    ctx.fill();
  }
  // Steering wheel rim.
  strokeLine(ctx, [x + 6.4, y + 2.5, x + 7.6, y + 8.5], ink, 1.3);
}

function tiltHoops(ctx: Ctx, P: Pal, wreck: boolean): void {
  const color = wreck ? mix(C.rust, C.char, 0.35) : P.bodyDark;
  const hoops = wreck ? [-46, -20, 1] : [-46, -21, 1];
  hoops.forEach((x, i) => {
    if (wreck && i === 1) {
      // Bent by the heat.
      strokeLine(ctx, [x, BED_TOP, x - 1, -40, x + 4, -45, x + 9, -43], color, 1.2);
      return;
    }
    strokeLine(ctx, [x, BED_TOP, x, TILT_TOP + 3, x + 1.5, TILT_TOP + 0.6], color, 1.2);
  });
  if (!wreck) strokeLine(ctx, [-45, TILT_TOP + 0.6, 2.5, TILT_TOP + 0.6], color, 1);
}

function closedTilt(ctx: Ctx, P: Pal): void {
  const path = (c: Ctx): void => {
    c.beginPath();
    c.moveTo(BED_X0 - 0.5, BED_TOP + 1);
    c.lineTo(BED_X0 - 0.5, TILT_TOP + 4);
    c.quadraticCurveTo(BED_X0, TILT_TOP, BED_X0 + 4, TILT_TOP);
    c.lineTo(BED_X1 - 3, TILT_TOP);
    c.quadraticCurveTo(BED_X1 + 1, TILT_TOP, BED_X1 + 1, TILT_TOP + 4);
    c.lineTo(BED_X1 + 1, BED_TOP + 1);
    c.closePath();
  };
  rimmed(ctx, path, P.tilt, P.tiltRim, 0.4, 1.4);
  inside(ctx, path, () => {
    // Sag between the hoops, tie-down straps, and the shaded lower edge.
    ctx.strokeStyle = rgba(P.tiltDark, 0.8);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const x of [-37, -21, -6]) {
      ctx.moveTo(x, TILT_TOP + 1);
      ctx.quadraticCurveTo(x - 1.5, (TILT_TOP + BED_TOP) / 2, x, BED_TOP);
    }
    ctx.stroke();
    ctx.fillStyle = rgba(P.tiltDark, 0.55);
    ctx.fillRect(BED_X0, BED_TOP - 4, BED_X1 - BED_X0 + 2, 4);
    ctx.fillStyle = rgba(P.tiltDark, 0.45);
    ctx.beginPath();
    ctx.moveTo(-28, TILT_TOP);
    ctx.quadraticCurveTo(-26, -40, -29, BED_TOP);
    ctx.lineTo(-24, BED_TOP);
    ctx.quadraticCurveTo(-22, -40, -24, TILT_TOP);
    ctx.fill();
  });
  // Rope ties along the bottom edge.
  for (let x = -46; x < 4; x += 8) strokeLine(ctx, [x, BED_TOP - 2, x + 1, BED_TOP + 1], rgba(C.silk, 0.6), 0.7);
}

/** The tilt's side sheet rolled up along the roof rail and tied to the hoops. */
function rolledTilt(ctx: Ctx, P: Pal): void {
  const y = TILT_TOP - 1.5;
  rimRect(ctx, -48, y, 52, 6, 3, P.tilt, P.tiltRim, 1.2);
  ctx.strokeStyle = rgba(P.tiltDark, 0.8);
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  for (let x = -44; x < 2; x += 5.5) {
    ctx.moveTo(x, y + 5.6);
    ctx.quadraticCurveTo(x + 2.4, y + 3, x + 2, y + 0.4);
  }
  ctx.stroke();
  ctx.fillStyle = rgba(P.tiltDark, 0.5);
  ctx.fillRect(-48, y + 4.2, 52, 1.8);
  for (const x of [-37, -14, 0]) strokeLine(ctx, [x, y - 0.3, x + 0.6, y + 7.5], rgba(C.silk, 0.75), 0.9);
}

function truckCargo(ctx: Ctx, P: Pal): void {
  // Crates and a drum heaped above the sides, lashed down.
  crate(ctx, P, -48, -42, 15, 12, -0.15);
  drum(ctx, P, -32.5, BED_TOP + 1, 10, 13, 0.2);
  crate(ctx, P, -21.5, -41, 14, 11, 0.05, false);
  crate(ctx, P, -12.5, -39, 13, 9, -0.05);
  sack(ctx, -34, -41.5, 13, 6, 0.08);
  rope(ctx, [-48, -41, -35, -44, -22, -41, -9, -38]);
}

function paintTruck(ctx: Ctx, P: Pal, o: TruckOpts): void {
  const S = TRUCK_SHAPES[P.faction];
  const rand = rng(P.faction === 'british' ? 31 : 47);
  if (o.wreck) ctx.translate(0, 2.4);

  // Wheel wells and the chassis.
  ctx.fillStyle = C.void;
  for (const x of [REAR_X, FRONT_X]) {
    ctx.beginPath();
    ctx.arc(x, WHEEL_Y, WHEEL_R + 1.6, Math.PI, 0);
    ctx.fill();
  }
  ctx.fillStyle = P.bodyDark;
  ctx.fillRect(BED_X0 + 2, -19, 52, 4.4);
  ctx.fillRect(40, -18, 10, 3.6);

  // Tilt (behind the body sides), cargo, hoops.
  if (o.tilt === 'closed') closedTilt(ctx, P);
  if (o.tilt === 'rolled') {
    tiltHoops(ctx, P, false);
    rolledTilt(ctx, P);
  }
  if (o.tilt === 'none') tiltHoops(ctx, P, o.wreck);
  if (o.cargo) truckCargo(ctx, P);

  // Cargo body: plank sides and the tailboard.
  rimRect(ctx, BED_X0, BED_TOP, BED_X1 - BED_X0, BED_FLOOR - BED_TOP + 2, 0.6, P.body, P.rim, 1.2);
  ctx.fillStyle = rgba(P.bodyDark, 0.9);
  ctx.fillRect(BED_X0 + 0.6, BED_TOP + 5.5, BED_X1 - BED_X0 - 1.2, 0.8);
  for (let x = BED_X0 + 9; x < BED_X1 - 2; x += 11) ctx.fillRect(x, BED_TOP + 1.2, 1.4, BED_FLOOR - BED_TOP);
  ctx.fillStyle = P.bodyDark;
  ctx.fillRect(BED_X0, BED_TOP + 1, 2.2, BED_FLOOR - BED_TOP + 1);
  // Unit marking on the tailboard corner: a plain square (British) or small white bar (German).
  if (!o.wreck) {
    if (P.faction === 'british') {
      ctx.fillStyle = C.flagRed;
      ctx.fillRect(BED_X0 + 4, BED_TOP + 6.8, 4, 4);
      ctx.fillStyle = C.flagBlue;
      ctx.fillRect(BED_X0 + 4, BED_TOP + 8.8, 4, 2);
    } else {
      ctx.fillStyle = rgba(C.flagWhite, 0.75);
      ctx.fillRect(BED_X0 + 4, BED_TOP + 7.5, 6, 2.4);
    }
  }

  // Cab and bonnet.
  rimPoly(ctx, S.cab, P.body, P.rim, 1.3);
  inside(
    ctx,
    (c) => poly(c, S.cab),
    () => {
      // Panel lit from the upper left, shaded nose.
      ctx.fillStyle = rgba(P.lit, 0.35);
      ctx.fillRect(6, -49, 6, 33);
      ctx.fillStyle = rgba(C.void, 0.25);
      ctx.fillRect(38, -34, 14, 18);
      // Door seam, handle and bonnet louvres.
      ctx.fillStyle = rgba(P.bodyDark, 0.95);
      ctx.fillRect(10.5, -45, 0.9, 28);
      ctx.fillRect(27.5, -33, 0.9, 16);
      ctx.fillRect(13, -31, 3, 0.9);
      for (let x = 32; x < 42; x += 2.4) ctx.fillRect(x, -29.5, 0.9, 6);
    },
  );
  // Window and driver.
  fillPoly(ctx, S.window, o.wreck ? C.void : mix(C.glass, C.ink, 0.35));
  if (!o.wreck) {
    inside(
      ctx,
      (c) => poly(c, S.window),
      () => {
        ctx.fillStyle = 'rgba(220,226,214,0.18)';
        ctx.beginPath();
        ctx.moveTo(S.window[2] - 5, S.window[3]);
        ctx.lineTo(S.window[2] - 2, S.window[3]);
        ctx.lineTo(S.window[2] - 8, S.window[5]);
        ctx.lineTo(S.window[2] - 11, S.window[5]);
        ctx.fill();
      },
    );
  }
  if (o.driver) inside(ctx, (c) => poly(c, S.window), () => driver(ctx, P.faction, 18.5, -40));
  fillPoly(ctx, S.grille, P.bodyDark);
  // Running board, mudguards, bumper, headlamp.
  rimRect(ctx, 6, -18, 16, 2.2, 0.6, P.bodyDark, P.lit, 0.8);
  rimPoly(ctx, S.guard, P.body, P.rim, 1);
  ctx.fillStyle = P.bodyDark;
  ctx.fillRect(47, -15.5, 5, 3);
  rimPoly(ctx, [BED_X0 + 1.5, -19, -38, -19, -36, -21.6, -30, -23.6, -24, -23.6, -18, -21.6, -16, -19, -16, -16.4, BED_X0 + 1.5, -16.4], P.body, P.rim, 0.9);
  disc(ctx, S.lamp[0], S.lamp[1], 2.4, P.bodyDark);
  if (!o.wreck) disc(ctx, S.lamp[0] + 0.8, S.lamp[1] - 0.4, 1.3, rgba(C.silk, 0.75));

  truckWheel(ctx, P, REAR_X, o.wreck);
  truckWheel(ctx, P, FRONT_X, o.wreck);

  if (o.wreck) {
    // Burnt out: soot over everything, scorched blooms, a few embers in the cab and bed.
    charOver(ctx, -60, -60, 120, 66, 0.5);
    scorch(ctx, 20, -36, 22, 16, 0.75);
    scorch(ctx, -22, -24, 28, 12, 0.6);
    scorch(ctx, 42, -24, 12, 10, 0.5);
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = rgba(C.rust, 0.35 + rand() * 0.25);
      ctx.fillRect(BED_X0 + rand() * 96, -46 + rand() * 30, 2 + rand() * 4, 1 + rand() * 2.4);
    }
    ctx.restore();
    ember(ctx, 17, -34, 4, 0.5);
    ember(ctx, -30, -23, 3.5, 0.4);
    footing(ctx, -54, 54, -2.4, 4, rand);
  }
}

function truckOpts(state: TruckState): TruckOpts {
  if (state === 'wreck') return { tilt: 'none', cargo: false, driver: false, wreck: true };
  return { tilt: 'rolled', cargo: state === 'loaded', driver: true, wreck: false };
}

// ---------------------------------------------------------------------------
// Supply dumps (origin = ground centre)
// ---------------------------------------------------------------------------

function dumpCrates(ctx: Ctx, P: Pal): void {
  crate(ctx, P, -34, -18, 22, 17, -0.1);
  crate(ctx, P, -10, -15, 19, 14, 0.05, false);
  crate(ctx, P, -28, -31, 18, 13, 0.18);
  sack(ctx, 10, 1, 15, 8.5, 0.05);
  jerrycan(ctx, P, 25, 1);
}

/** The stacked crate pile, its footprint centred on dx. */
function dumpStacked(ctx: Ctx, P: Pal, dx: number): void {
  // Rear rank, darker.
  crate(ctx, P, dx - 62, -36, 24, 18, -0.45, false);
  crate(ctx, P, dx + 22, -33, 26, 19, -0.45, false);
  crate(ctx, P, dx - 20, -50, 24, 17, -0.3);
  // Front: two stacks three high on the left, a lower one on the right, sacks between.
  crate(ctx, P, dx - 68, -19, 27, 19, 0);
  crate(ctx, P, dx - 40, -19, 25, 19, -0.12);
  crate(ctx, P, dx - 64, -35, 25, 16, 0.18, false);
  crate(ctx, P, dx - 38, -34, 22, 15, 0.08);
  crate(ctx, P, dx - 56, -48, 22, 13, 0.24, false);
  crate(ctx, P, dx - 26, -33, 26, 18, -0.2, false);
  crate(ctx, P, dx + 20, -18, 26, 18, 0.02);
  crate(ctx, P, dx + 44, -15, 22, 15, -0.12, false);
  crate(ctx, P, dx + 24, -31, 22, 13, 0.16);
  sack(ctx, dx - 14, 1, 17, 9.5, 0);
  sack(ctx, dx + 2, 1, 17, 9.5, 0.12);
  sack(ctx, dx - 6, -7.5, 17, 9, 0.06);
  rope(ctx, [dx - 66, -34, dx - 52, -47, dx - 38, -33]);
}

function dumpDrums(ctx: Ctx, P: Pal): void {
  // Drums behind and to the right, the crate pile on the left.
  drum(ctx, P, 44, -4, 16, 30, 0.45);
  drum(ctx, P, 61, -4, 16, 30, 0.5);
  dumpStacked(ctx, P, -18);
  drum(ctx, P, 47, 1, 17, 31, 0);
  drum(ctx, P, 65, 1, 17, 31, 0.15);
  lyingDrum(ctx, P, 56, -38, 26, 7);
  jerrycan(ctx, P, 28, 1);
  jerrycan(ctx, P, 37, 1, 0.9);
  jerrycan(ctx, P, 80, 1, 0.9);
}

function paintDump(ctx: Ctx, P: Pal, style: DumpStyle): void {
  const rand = rng(style.length * 13 + (P.faction === 'british' ? 1 : 2));
  const half = DUMP_STYLE_LAYOUT[style].box.w / 2;
  if (style === 'crates') {
    dumpCrates(ctx, P);
    footing(ctx, -38, 38, 1, 5, rand);
    return;
  }
  if (style === 'stacked') {
    dumpStacked(ctx, P, 0);
    footing(ctx, -half + 3, half - 3, 1, 6, rand);
    return;
  }
  if (style === 'truck') {
    // Parked, backed up to the pile: tilt closed, nobody in the cab.
    ctx.save();
    ctx.translate(DUMP_TRUCK_X, 0);
    ctx.scale(-1, 1);
    paintTruck(ctx, P, { tilt: 'closed', cargo: false, driver: false, wreck: false });
    ctx.restore();
  }
  dumpDrums(ctx, P);
  footing(ctx, -88, 88, 1, 6, rand);
}

// ---------------------------------------------------------------------------
// Sapper's bigger load (origin = centre, like the figure's crate part)
// ---------------------------------------------------------------------------

function paintBigLoad(ctx: Ctx, P: Pal): void {
  const hw = 9.4;
  const hh = 6.4;
  const cy = 3.1;
  crate(ctx, P, -hw, cy - hh, hw * 2, hh * 2, 0.1);
  // A jerrycan lying flat and a small sack lashed on top.
  rimRect(ctx, -8.6, cy - hh - 6.2, 12.5, 6.2, 1.3, P.drum, C.drumRim, 1);
  ctx.fillStyle = C.drumDark;
  ctx.fillRect(3.9, cy - hh - 5.2, 1.8, 2.4);
  strokeLine(ctx, [-7, cy - hh - 4.8, 2.3, cy - hh - 1.2], rgba(C.drumDark, 0.9), 0.7);
  strokeLine(ctx, [-7, cy - hh - 1.2, 2.3, cy - hh - 4.8], rgba(C.drumDark, 0.9), 0.7);
  sack(ctx, 3.2, cy - hh + 0.2, 9.6, 6.2, 0.1);
  // Rope lashing over the lot.
  rope(ctx, [-5, cy + hh - 0.4, -5.6, cy - hh - 5.6]);
  rope(ctx, [7, cy + hh - 0.4, 8, cy - hh - 5.6]);
}

// ---------------------------------------------------------------------------
// Handcart (origin = ground below the handle grip, body forward)
// ---------------------------------------------------------------------------

const CART_TOP = -31;
const CART_BOTTOM = -18;
const CART_X0 = 10;
const CART_X1 = 48;

function cartWheel(ctx: Ctx, P: Pal): void {
  const { x, y } = CART_LAYOUT.wheel;
  const r = CART_LAYOUT.wheelRadius;
  // Iron tyre, wooden felloe, eight spokes and a hub.
  ctx.strokeStyle = '#151612';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(x, y, r - 0.8, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = P.woodDark;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(x, y, r - 2.2, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = rgba(P.woodRim, 0.6);
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.arc(x, y, r - 2.4, Math.PI * 1.05, Math.PI * 1.55);
  ctx.stroke();
  ctx.strokeStyle = P.woodDark;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2;
    ctx.moveTo(x + Math.cos(a) * 1.6, y + Math.sin(a) * 1.6);
    ctx.lineTo(x + Math.cos(a) * (r - 2.4), y + Math.sin(a) * (r - 2.4));
  }
  ctx.stroke();
  disc(ctx, x, y, 2.3, P.bodyDark);
  disc(ctx, x - 0.5, y - 0.5, 0.9, rgba(P.rim, 0.6));
}

function paintCart(ctx: Ctx, P: Pal, loaded: boolean): void {
  const gy = -30;
  const plank = mix(C.timber, P.lit, 0.35);
  const plankDark = mix(C.timberDark, P.bodyDark, 0.3);
  const plankRim = mix(C.timberRim, P.rim, 0.3);
  // Far handle (darker, a touch higher) and the rest leg.
  strokeLine(ctx, [-0.6, gy - 1.2, CART_X0 + 2, CART_BOTTOM - 2.4, CART_X1 - 2, CART_BOTTOM - 2.4], plankDark, 1.8);
  strokeLine(ctx, [CART_X0 + 3, CART_BOTTOM, CART_X0 + 4.5, -1.2], plankDark, 1.8);
  if (loaded) {
    crate(ctx, P, CART_X0 + 1.5, CART_TOP - 12, 17, 12, 0.05);
    crate(ctx, P, CART_X0 + 19.5, CART_TOP - 10, 15, 10, -0.12, false);
    sack(ctx, CART_X0 + 5, CART_TOP - 11.6, 14, 7, 0.1);
    jerrycan(ctx, P, CART_X0 + 22, CART_TOP - 9.6, 0.65);
    rope(ctx, [CART_X0 + 2, CART_TOP, CART_X0 + 12, CART_TOP - 18, CART_X0 + 30, CART_TOP - 11, CART_X1 - 2, CART_TOP]);
  }
  // Box body: planks with corner posts and an end board standing proud at the front.
  rimRect(ctx, CART_X0, CART_TOP, CART_X1 - CART_X0, CART_BOTTOM - CART_TOP, 0.6, plank, plankRim, 1.1);
  ctx.fillStyle = rgba(plankDark, 0.9);
  ctx.fillRect(CART_X0 + 0.5, CART_TOP + 4.5, CART_X1 - CART_X0 - 1, 0.8);
  ctx.fillRect(CART_X0 + 0.5, CART_TOP + 9, CART_X1 - CART_X0 - 1, 0.8);
  ctx.fillStyle = plankDark;
  ctx.fillRect(CART_X0 + 0.8, CART_TOP + 0.6, 2, CART_BOTTOM - CART_TOP - 0.6);
  ctx.fillRect(CART_X1 - 2.8, CART_TOP - 2, 2.2, CART_BOTTOM - CART_TOP + 2);
  ctx.fillRect(CART_X0 + 17.5, CART_TOP + 0.6, 1.6, CART_BOTTOM - CART_TOP - 0.6);
  // Faction stencil on the side board.
  ctx.fillStyle = rgba(C.flagWhite, 0.45);
  if (P.faction === 'british') ctx.fillRect(CART_X0 + 24, CART_TOP + 5.6, 8, 2.6);
  else for (let i = 0; i < 3; i++) ctx.fillRect(CART_X0 + 23 + i * 3.4, CART_TOP + 5, 2.2, 3.6);
  // Near handle: from the grip under the body to the front.
  strokeLine(ctx, [0, gy, CART_X0 + 2, CART_BOTTOM - 0.6, CART_X1, CART_BOTTOM - 0.6], plank, 2);
  strokeLine(ctx, [0.2, gy - 0.8, CART_X0 + 2, CART_BOTTOM - 1.5], rgba(plankRim, 0.7), 0.6);
  // Grip.
  strokeLine(ctx, [-1.6, gy - 1.2, 1.4, gy + 0.9], '#151612', 2.4);
  cartWheel(ctx, P);
}

// ---------------------------------------------------------------------------
// Specs
// ---------------------------------------------------------------------------

export function dumpStyleSpecs(style: DumpStyle, faction: FactionId): SpriteSpec[] {
  const P = pal(faction);
  return [makeSpec(dumpStyleKey(style, faction), DUMP_STYLE_LAYOUT[style].box, (ctx) => paintDump(ctx, P, style))];
}

export function bigLoadSpec(faction: FactionId): SpriteSpec {
  const P = pal(faction);
  return makeSpec(bigLoadKey(faction), BIG_LOAD_BOX, (ctx) => paintBigLoad(ctx, P));
}

export function cartSpecs(faction: FactionId): SpriteSpec[] {
  const P = pal(faction);
  return [false, true].map((loaded) => makeSpec(cartKey(faction, loaded), CART_LAYOUT.box, (ctx) => paintCart(ctx, P, loaded)));
}

export function truckSpecs(faction: FactionId): SpriteSpec[] {
  const P = pal(faction);
  return TRUCK_STATES.map((state) =>
    makeSpec(truckKey(faction, state), SUPPLY_TRUCK_LAYOUT.box, (ctx) => paintTruck(ctx, P, truckOpts(state))),
  );
}

/** Every supply-look sprite for one nation. */
export function supplyLookSpecs(faction: FactionId): SpriteSpec[] {
  return [
    ...DUMP_STYLE_LIST.flatMap((s) => dumpStyleSpecs(s, faction)),
    bigLoadSpec(faction),
    ...cartSpecs(faction),
    ...truckSpecs(faction),
  ];
}
