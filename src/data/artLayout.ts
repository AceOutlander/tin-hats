/**
 * Layout data for structures, vehicles and props: sprite sizes, anchor points,
 * the shared muted palette and animation tunables. Pure data, no drawing.
 *
 * Conventions used by everything here:
 *  - Units are world units (wu). A standing stick figure is VIEW.figureHeight (58) tall.
 *  - Every sprite has an ORIGIN: the point the renderer places at the object's
 *    position (normally on the ground line). `ArtBox` gives the sprite size and
 *    where that origin sits inside it, so ax = ox / w and ay = oy / h.
 *  - Anchor points (`ArtPoint`) are offsets from the origin: +x is toward the
 *    enemy for a left-hand (side 0) object, -y is up. Everything is drawn for
 *    the left side facing right; the renderer mirrors x (and rotation) for side 1.
 */
import type { FactionId, FactionLook } from './schema';
import { VIEW } from './view';

export interface ArtPoint {
  x: number;
  y: number;
}

/** Sprite size in wu and the origin's position inside it, measured from the top-left corner. */
export interface ArtBox {
  w: number;
  h: number;
  ox: number;
  oy: number;
}

export type DamageState = 'intact' | 'damaged' | 'ruin';
export const DAMAGE_STATES: readonly DamageState[] = ['intact', 'damaged', 'ruin'];

/** Muted, period palette shared by structures, vehicles and props. */
export const ART_COLORS = {
  /** Darkest silhouette tone (tank bodies, aircraft). */
  ink: '#171814',
  inkSoft: '#262822',
  /** Doorways, firing slits, wheel wells. */
  void: '#0a0a08',
  /** Soft lighter rim on dark bodies. */
  rim: '#86856f',
  concrete: '#5b5c53',
  concreteDark: '#42433c',
  concreteRim: '#96978a',
  sandbag: '#74694c',
  sandbagDark: '#4a4230',
  sandbagRim: '#a3966f',
  timber: '#51402c',
  timberDark: '#33281b',
  timberRim: '#84694a',
  earth: '#40352a',
  earthDark: '#261f18',
  earthRim: '#665543',
  steel: '#343730',
  steelRim: '#7b8073',
  canvas: '#5a6046',
  canvasDark: '#3c412f',
  canvasRim: '#8a916d',
  crate: '#70583a',
  crateDark: '#463622',
  crateRim: '#a08253',
  drum: '#414d3e',
  drumDark: '#2a3329',
  drumRim: '#77866f',
  rust: '#5d3b27',
  char: '#12100e',
  ember: '#d06a2c',
  silk: '#b9b39b',
  silkDark: '#8f8a76',
  glass: '#5c6c73',
  flagRed: '#a03230',
  flagBlue: '#2a3a6c',
  flagWhite: '#d8d2bd',
  flagBlack: '#141414',
  flagFieldGrey: '#6b7670',
  trackBand: '#1c1d19',
  trackLug: '#5b5c50',
} as const;

// ---------------------------------------------------------------------------
// HQ bunkers
// ---------------------------------------------------------------------------

export interface HqLayout {
  /** One box for all three damage states; origin = bottom centre of the bunker body on the ground line. */
  box: ArtBox;
  bodyW: number;
  bodyH: number;
  /** Centre x of the doorway that units walk in and out of, with its size. */
  doorX: number;
  doorW: number;
  doorH: number;
  /** Muzzle of the HQ machine gun (tracer and flash origin). */
  gunSlit: ArtPoint;
  /** Foot and top of the flagpole. The flag's hoist hangs down from flagTop and the fly extends toward +x. */
  flagBase: ArtPoint;
  flagTop: ArtPoint;
  /** Good places for fire and smoke emitters once the HQ is a burning ruin. */
  fires: ArtPoint[];
}

export const HQ_LAYOUT: Record<FactionId, HqLayout> = {
  british: {
    box: { w: 356, h: 240, ox: 176, oy: 226 },
    bodyW: 300,
    bodyH: 112,
    doorX: 42,
    doorW: 34,
    doorH: 64,
    gunSlit: { x: 160, y: -47 },
    flagBase: { x: -26, y: -108 },
    flagTop: { x: -26, y: -214 },
    fires: [
      { x: -78, y: -46 },
      { x: 8, y: -34 },
      { x: 104, y: -40 },
    ],
  },
  german: {
    box: { w: 356, h: 240, ox: 176, oy: 226 },
    bodyW: 300,
    bodyH: 110,
    doorX: 30,
    doorW: 34,
    doorH: 64,
    gunSlit: { x: 162, y: -53 },
    flagBase: { x: -16, y: -108 },
    flagTop: { x: -16, y: -212 },
    fires: [
      { x: -84, y: -50 },
      { x: -6, y: -36 },
      { x: 96, y: -38 },
    ],
  },
};

// ---------------------------------------------------------------------------
// Flags
// ---------------------------------------------------------------------------

export const FLAG_LAYOUT = {
  /** Flat flag size in wu (5:3). Origin = top of the hoist (top-left corner). */
  w: 60,
  h: 36,
  /** Vertical strips the renderer cuts the flag into. */
  strips: 12,
  wave: {
    /** Seconds for the whole motion to repeat exactly. */
    period: 4,
    /** Main ripple: amplitude (wu), wavelengths along the flag, whole cycles per period. */
    amp1: 3.4,
    waves1: 1.15,
    harmonic1: 3,
    /** Secondary ripple. */
    amp2: 1.3,
    waves2: 2.3,
    harmonic2: 5,
    phase2: 1.3,
    /** Sag of the fly end (wu) and how much it breathes over one period. */
    droop: 4,
    droopSway: 0.3,
    /** Shading weights of the two ripples (sum <= 1) and the share present even at the hoist. */
    shade1: 0.7,
    shade2: 0.3,
    shadeBase: 0.35,
    /** Brightness multiplier range for a strip: mid +- swing. */
    tintMid: 0.84,
    tintSwing: 0.16,
  },
} as const;

// ---------------------------------------------------------------------------
// Trench kit
// ---------------------------------------------------------------------------

export const TRENCH_LAYOUT = {
  /** Width of the tileable middle piece and of each end cap. */
  tileW: 72,
  capW: 34,
  /** How far occupants sink. */
  sink: VIEW.trenchDepth,
  /** All y values are relative to the trench's ground line (VIEW.groundY). */
  /** Far lip of the pit. */
  lipY: -30,
  /** Where the back wall meets the floor (lipY + sink). */
  floorY: -6,
  /** Top of the front sandbag parapet. */
  parapetTopY: 6,
  /** Bottom of the earth berm under the front sandbags; covers sunk feet in the nearest row. */
  parapetBottomY: 52,
  /** Back piece (wall, floor, duckboards): origin = left edge on the ground line. */
  backH: 90,
  backOy: 44,
  /** Front piece (parapet): origin = left edge on the ground line. */
  frontH: 64,
  frontOy: 8,
  bagW: 18,
  bagH: 10,
} as const;

// ---------------------------------------------------------------------------
// Pillbox
// ---------------------------------------------------------------------------

export const PILLBOX_LAYOUT = {
  /** Same box for intact, damaged and rubble. Origin = bottom centre on the ground line. */
  box: { w: 132, h: 84, ox: 60, oy: 74 } as ArtBox,
  bodyW: 92,
  bodyH: 58,
  /** Muzzle of the pillbox machine gun. */
  slit: { x: 57, y: -34 } as ArtPoint,
  /** Dust and debris burst from here when it collapses. */
  centre: { x: 0, y: -28 } as ArtPoint,
} as const;

// ---------------------------------------------------------------------------
// Barbed wire
// ---------------------------------------------------------------------------

export const WIRE_LAYOUT = {
  tileW: 64,
  /** Origin of every wire tile = left edge on that strand's ground line. */
  backBox: { w: 64, h: 34, ox: 0, oy: 30 } as ArtBox,
  frontBox: { w: 64, h: 38, ox: 0, oy: 34 } as ArtBox,
  flatBox: { w: 64, h: 16, ox: 0, oy: 11 } as ArtBox,
  /** y of each strand's ground line relative to VIEW.groundY: behind row 0 and in front of row 3. */
  backDy: -27,
  frontDy: 28,
} as const;

// ---------------------------------------------------------------------------
// Supplies and airdrops
// ---------------------------------------------------------------------------

export const SUPPLY_LAYOUT = {
  /** Supply dump. Origin = bottom centre on the ground line. */
  dumpBox: { w: 176, h: 84, ox: 88, oy: 74 } as ArtBox,
  /** Where a sapper stands to load, relative to the dump origin. */
  dumpLoadX: 0,
  /** The crate a sapper carries. Origin = centre. */
  crateBox: { w: 22, h: 16, ox: 11, oy: 8 } as ArtBox,
  /** Airdrop crate. Origin = bottom centre (where it lands). */
  dropCrateBox: { w: 36, h: 30, ox: 18, oy: 27 } as ArtBox,
  /** Height of the drop crate's harness ring above its origin: the parachute's origin goes here. */
  dropCrateHarnessY: -25,
  /** Parachute canopy and shroud lines. Origin = the point where the lines meet. */
  parachuteBox: { w: 92, h: 104, ox: 46, oy: 100 } as ArtBox,
} as const;

// ---------------------------------------------------------------------------
// Aircraft, rockets, bombs
// ---------------------------------------------------------------------------

export const AIR_LAYOUT = {
  /** Fighter-bomber side silhouette facing +x. Origin = centre of the fuselage. */
  planeBox: { w: 240, h: 88, ox: 122, oy: 48 } as ArtBox,
  /** Where rockets leave the wing rails and bombs drop from. */
  rocketRail: { x: 30, y: 19 } as ArtPoint,
  bombBay: { x: 4, y: 20 } as ArtPoint,
  /** Ground shadow. Origin = centre. */
  shadowBox: { w: 236, h: 36, ox: 118, oy: 18 } as ArtBox,
  /** Rocket and bomb point along +x. Origin = centre. */
  rocketBox: { w: 32, h: 10, ox: 16, oy: 5 } as ArtBox,
  bombBox: { w: 28, h: 12, ox: 14, oy: 6 } as ArtBox,
} as const;

// ---------------------------------------------------------------------------
// Ground decals
// ---------------------------------------------------------------------------

export const DECAL_LAYOUT = {
  /** Origin = centre for all of these; they lie flat on the ground plane. */
  craterBox: { w: 100, h: 36, ox: 50, oy: 18 } as ArtBox,
  scorchBox: { w: 124, h: 38, ox: 62, oy: 19 } as ArtBox,
  /** Loose rubble chunks (also usable as flying debris). */
  rubbleBox: { w: 20, h: 16, ox: 10, oy: 8 } as ArtBox,
  rubbleVariants: 4,
} as const;

// ---------------------------------------------------------------------------
// Tanks
// ---------------------------------------------------------------------------

export type TankLook = FactionLook['tank'] | FactionLook['heavyTank'];
export const TANK_LOOKS: readonly TankLook[] = ['churchill', 'panzer4', 'kingTiger'];

export type TankWheelKind = 'road' | 'sprocket' | 'idler' | 'return';

export interface TankWheelDef {
  kind: TankWheelKind;
  /** Hub position in tank space (origin = ground under the hull centre, facing +x). */
  x: number;
  y: number;
  /** Rolling radius: the wheel turns distance / r radians. */
  r: number;
}

export interface TankLayoutDef {
  faction: FactionId;
  /** Footprint and overall height of the hull and turret, without the gun overhang (wu). */
  length: number;
  height: number;
  /** Track sprite (static, on the ground). Origin = tank origin. */
  trackBox: ArtBox;
  /** Hull sprite. Origin = rockPivot. */
  hullBox: ArtBox;
  /** Turret sprite. Origin = turretRing. */
  turretBox: ArtBox;
  /** Barrel sprite, pointing along +x. Origin = trunnion. */
  barrelBox: ArtBox;
  /** Wrecked husk sprite. Origin = tank origin. */
  huskBox: ArtBox;
  /** All of these are in tank space with the hull level and the gun horizontal. */
  rockPivot: ArtPoint;
  turretRing: ArtPoint;
  trunnion: ArtPoint;
  exhaust: ArtPoint;
  hullMg: ArtPoint;
  /** Trunnion to muzzle. */
  barrelLength: number;
  /** How far the barrel slides back at recoil = 1. */
  recoilDist: number;
  /** Gun elevation limits in radians (positive = up). */
  elevMin: number;
  elevMax: number;
  /** Hull pitch in radians at hullRock = 1 (nose up). */
  rockMax: number;
  /** Wheels in draw order. */
  wheels: TankWheelDef[];
  /** Pulleys the track wraps, clockwise on screen (top run first, rear to front). */
  belt: { x: number; y: number; r: number }[];
  trackThickness: number;
  /** Nominal distance between tread lugs; the real pitch is rounded so a whole number fits the loop. */
  trackPitch: number;
  /** Pre-rendered tread phases per pitch. */
  trackFrames: number;
}

/** Evenly spaced road wheels. */
function roadWheels(count: number, x0: number, x1: number, y: number, r: number): TankWheelDef[] {
  const out: TankWheelDef[] = [];
  for (let i = 0; i < count; i++) {
    out.push({ kind: 'road', x: x0 + ((x1 - x0) * i) / (count - 1), y, r });
  }
  return out;
}

/** King Tiger wheels overlap: the inner (odd) ones draw first so the outer ones sit on top. */
function interleaved(wheels: TankWheelDef[]): TankWheelDef[] {
  const inner = wheels.filter((_, i) => i % 2 === 1);
  const outer = wheels.filter((_, i) => i % 2 === 0);
  return inner.concat(outer);
}

const DEG = Math.PI / 180;

export const TANK_LAYOUT: Record<TankLook, TankLayoutDef> = {
  churchill: {
    faction: 'british',
    length: 216,
    height: 86,
    trackBox: { w: 228, h: 58, ox: 114, oy: 54 },
    hullBox: { w: 228, h: 36, ox: 113, oy: 28 },
    turretBox: { w: 96, h: 40, ox: 51, oy: 37 },
    barrelBox: { w: 78, h: 10, ox: 8, oy: 5 },
    huskBox: { w: 250, h: 104, ox: 122, oy: 96 },
    rockPivot: { x: 0, y: -40 },
    turretRing: { x: 4, y: -55 },
    trunnion: { x: 38, y: -67 },
    exhaust: { x: -92, y: -57 },
    hullMg: { x: 106, y: -40 },
    barrelLength: 66,
    recoilDist: 7,
    elevMin: -8 * DEG,
    elevMax: 18 * DEG,
    rockMax: 1.6 * DEG,
    wheels: [
      ...roadWheels(11, -76, 72, -10.5, 6),
      { kind: 'sprocket', x: -94, y: -28, r: 12 },
      { kind: 'idler', x: 91, y: -31, r: 12 },
    ],
    belt: [
      { x: -94, y: -28, r: 12 },
      { x: 91, y: -31, r: 12 },
      { x: 72, y: -10.5, r: 6 },
      { x: -76, y: -10.5, r: 6 },
    ],
    trackThickness: 4.5,
    trackPitch: 7,
    trackFrames: 4,
  },
  panzer4: {
    faction: 'german',
    length: 190,
    height: 84,
    trackBox: { w: 198, h: 46, ox: 98, oy: 42 },
    hullBox: { w: 204, h: 42, ox: 104, oy: 25 },
    turretBox: { w: 90, h: 36, ox: 50, oy: 33 },
    barrelBox: { w: 50, h: 12, ox: 10, oy: 6 },
    huskBox: { w: 226, h: 102, ox: 112, oy: 94 },
    rockPivot: { x: 0, y: -33 },
    turretRing: { x: 2, y: -55 },
    trunnion: { x: 32, y: -66.5 },
    exhaust: { x: -99, y: -34 },
    hullMg: { x: 64, y: -48.5 },
    barrelLength: 36,
    recoilDist: 6,
    elevMin: -8 * DEG,
    elevMax: 18 * DEG,
    rockMax: 1.9 * DEG,
    wheels: [
      { kind: 'return', x: -52, y: -27, r: 3.5 },
      { kind: 'return', x: -19, y: -27, r: 3.5 },
      { kind: 'return', x: 14, y: -27, r: 3.5 },
      { kind: 'return', x: 48, y: -27, r: 3.5 },
      { kind: 'road', x: -59.5, y: -11.5, r: 7.5 },
      { kind: 'road', x: -44, y: -11.5, r: 7.5 },
      { kind: 'road', x: -25.5, y: -11.5, r: 7.5 },
      { kind: 'road', x: -10, y: -11.5, r: 7.5 },
      { kind: 'road', x: 8.5, y: -11.5, r: 7.5 },
      { kind: 'road', x: 24, y: -11.5, r: 7.5 },
      { kind: 'road', x: 42.5, y: -11.5, r: 7.5 },
      { kind: 'road', x: 58, y: -11.5, r: 7.5 },
      { kind: 'idler', x: -80, y: -17, r: 9.5 },
      { kind: 'sprocket', x: 82, y: -19, r: 10.5 },
    ],
    belt: [
      { x: -80, y: -17, r: 9.5 },
      { x: -52, y: -27, r: 3.5 },
      { x: 48, y: -27, r: 3.5 },
      { x: 82, y: -19, r: 10.5 },
      { x: 58, y: -11.5, r: 7.5 },
      { x: -59.5, y: -11.5, r: 7.5 },
    ],
    trackThickness: 4,
    trackPitch: 6.5,
    trackFrames: 4,
  },
  kingTiger: {
    faction: 'german',
    length: 262,
    height: 102,
    trackBox: { w: 264, h: 50, ox: 130, oy: 46 },
    hullBox: { w: 272, h: 48, ox: 138, oy: 43 },
    turretBox: { w: 126, h: 44, ox: 61, oy: 41 },
    barrelBox: { w: 166, h: 12, ox: 10, oy: 6 },
    huskBox: { w: 352, h: 124, ox: 150, oy: 116 },
    rockPivot: { x: 0, y: -33 },
    turretRing: { x: -6, y: -63 },
    trunnion: { x: 44, y: -77 },
    exhaust: { x: -131, y: -73 },
    hullMg: { x: 113, y: -50 },
    barrelLength: 150,
    recoilDist: 10,
    elevMin: -7 * DEG,
    elevMax: 15 * DEG,
    rockMax: 1.3 * DEG,
    wheels: [
      ...interleaved(roadWheels(9, -84, 84, -18.5, 13)),
      { kind: 'idler', x: -108, y: -20, r: 11.5 },
      { kind: 'sprocket', x: 110, y: -23, r: 12.5 },
    ],
    belt: [
      { x: -108, y: -20, r: 11.5 },
      { x: 110, y: -23, r: 12.5 },
      { x: 84, y: -18.5, r: 13 },
      { x: -84, y: -18.5, r: 13 },
    ],
    trackThickness: 5.5,
    trackPitch: 9,
    trackFrames: 4,
  },
};

/** Most wheels on any tank: size of the preallocated wheel array in a TankPose. */
export const TANK_MAX_WHEELS = Math.max(...TANK_LOOKS.map((look) => TANK_LAYOUT[look].wheels.length));
