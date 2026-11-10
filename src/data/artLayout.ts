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
  // Dry grass on the sod banks over Soviet dugouts and the DOT.
  grass: '#5f6338',
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
  // The Soviet flag: its red field and the gold of the hammer, sickle and star edge.
  flagSovietRed: '#b3241c',
  flagGold: '#e2b53a',
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
  // The Soviet DOT: a concrete pillbox earthed over, its embrasure facing the enemy, the entrance cut into the bank.
  soviet: {
    box: { w: 356, h: 240, ox: 176, oy: 226 },
    bodyW: 300,
    bodyH: 100,
    doorX: -30,
    doorW: 32,
    doorH: 62,
    gunSlit: { x: 166, y: -46 },
    flagBase: { x: -96, y: -112 },
    flagTop: { x: -96, y: -214 },
    fires: [
      { x: -80, y: -44 },
      { x: 10, y: -66 },
      { x: 106, y: -44 },
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
  /**
   * All y values are relative to the trench's ground line (VIEW.groundY). The pit is cut into the ground band
   * between the far row (lipY) and the near rows; occupants stand on its floor at VIEW.trenchFeetY.
   */
  /** Far lip of the pit, on the far row's ground. */
  lipY: -30,
  /** Crest of the spoil (parados) heaped behind the far lip. */
  paradosY: -35,
  /** The far wall is in full shadow from here down (the floor itself is never seen). */
  shadowY: 4,
  /** Crest of the earth parapet thrown up in front of the pit. */
  crestY: 2,
  /** Top of the single course of sandbags bedded along that crest: the cover line occupants show above. */
  bagTopY: -6,
  /** Where the parapet's near face has blended back into the ground; covers sunk feet in the nearest row. */
  bermBottomY: 54,
  /** Back piece (spoil, far wall, pit): origin = left edge on the ground line. */
  backH: 90,
  backOy: 44,
  /** Front piece (parapet): origin = left edge on the ground line. */
  frontH: 70,
  frontOy: 14,
  bagW: 18,
  bagH: 10,
  /**
   * End-on pit (the battle look): the trench line runs into the screen, so each trench is drawn as one narrow pit
   * this wide centred on the trench, whatever its sim width. Occupants are packed into it (view only).
   */
  pitW: 96,
  /** Near lip (cover line, top of the near face) and far rim of the pit; the far corners are pitFar x the near width. */
  pitNearY: 6,
  /** The near wall is solid down to here (below the occupants' feet), then fades into the ground band. */
  pitNearFade: 50,
  /** Width (wu) over which the near wall feathers into the ground beyond the pit walls. */
  pitNearFeather: 16,
  pitFarY: -26,
  pitFar: 0.62,
  /** Firing step along the enemy-facing wall: its width at the near end and its top. */
  stepW: 12,
  stepY: 14,
  /** Sandbags piled end-on on the enemy-facing lip: bag size and bags per course, bottom up. */
  pileBagW: 12,
  pileBagH: 7,
  pileCourses: [4, 3, 2] as readonly number[],
  /** How far the heap reaches in over the enemy-facing wall (wu). */
  pileInset: 8,
  /** Soft strata bands in the near wall (wu below the lip) and stones on it (x as a fraction of the half-width, y, radius). */
  strata: [9, 17, 27] as readonly number[],
  stones: [-0.7, 6, 1.6, -0.2, 13, 1.2, 0.35, 8, 1.4, 0.8, 21, 1.8, -0.5, 24, 1.3] as readonly number[],
  /** Occupants keep this margin from the pit walls when packed in (wu). */
  packMargin: 5,
  /** Seconds over which an occupant shuffles into or out of his packed place. */
  packTime: 0.3,
  /** Owner's pennant on a stake at the friendly lip: stake height and width, cloth size, colours per faction. */
  stakeH: 30,
  stakeW: 1.6,
  pennantW: 12,
  pennantH: 7,
  stakeColor: 0x4a3a28,
  pennant: { british: 0xb5a46e, german: 0x7c8475, soviet: 0xb3261e } as Readonly<Record<FactionId, number>>,
  /** Seconds the pennant takes to fade in after a capture. */
  pennantFade: 0.6,
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

/**
 * A wire belt runs across the battlefield, into the screen, so it is drawn END-ON (docs/AGENT_GUIDE.md, art rule):
 * one or a few short, tall cross-sections of concertina coil hung on crossed timber pickets, standing on one ground
 * line inside the belt's data width. Each piece is split in two sprites that share one box and origin: the BACK half
 * (far picket, far loops of the coil) draws behind every unit row, the FRONT half (near picket, near loops) over them,
 * so a man passing through has the coil over his legs. Once destroyed a piece leaves debris on the ground.
 */
export const WIRE_LAYOUT = {
  /** Both halves of a standing piece. Origin = centre of the piece on its ground line. */
  backBox: { w: 48, h: 56, ox: 24, oy: 50 } as ArtBox,
  frontBox: { w: 48, h: 56, ox: 24, oy: 50 } as ArtBox,
  /** Crushed flat by a tank: a squashed tangle with the pickets lying in it. Origin = centre on the ground line. */
  crushedBox: { w: 66, h: 16, ox: 33, oy: 11 } as ArtBox,
  /** Blown apart by a shell: snapped stumps and torn loops sagging to the ground. Origin = centre on the ground line. */
  cutBox: { w: 52, h: 26, ox: 26, oy: 20 } as ArtBox,
  /** Footprint of one piece left to right (picket legs and the coil seen down its axis, wu): narrow, less than postH. */
  pieceW: 38,
  /** Height of the picket tops above the ground line: waist to chest on a 58 wu soldier. */
  postH: 44,
  /** Splay of the picket legs at the ground and of the crossed tops (half widths, wu). */
  legHalf: 13,
  topHalf: 10,
  /** Picket thickness (wu). */
  postW: 2.6,
  /** The far picket of a piece sits this far back (up and right, wu) and this much smaller. */
  farDx: 2,
  farDy: -6,
  farScale: 0.9,
  /** Coil: centre height above the ground line, loop radius, and how much each loop's radius varies. */
  coilY: -19,
  coilR: 15,
  coilJitter: 1.5,
  /** Loops of the coil seen end-on; the nearest `nearLoops` belong to the front half. */
  loops: 7,
  nearLoops: 3,
  /** Each farther loop drifts this far (wu) as the coil recedes into the screen, and its centre wanders round a
   * circle of helixR (wu) by helixStep rad per loop, so the loops overlap like a coil seen down its axis. */
  helixR: 2.2,
  helixStep: 2.4,
  loopDx: 0.35,
  loopDy: -0.85,
  /** Wire stroke widths (wu) and barbs per loop. */
  wireW: 1.4,
  farWireW: 1.1,
  barbs: 7,
  barbSize: 1.5,
  /** Centre-to-centre spacing of the pieces in a wide belt, and the most pieces one belt shows. */
  pitch: 80,
  maxPieces: 3,
  /** Ground line of the pieces relative to VIEW.groundY (a little in front of the feet line of the men inside). */
  dy: 10,
  /**
   * Infantry inside a standing belt walk on the feet line VIEW.groundY + feetDy, keeping rowSpread of their depth
   * offset, eased over squeezeTime seconds (view only), so every row passes through the coil, not above or below it.
   */
  feetDy: -1,
  rowSpread: 0.35,
  squeezeTime: 0.22,
  /** A tank crushing the wire: seconds the coil takes to fold down, how far it leans the way the tank drives (rad), and
   * the height it folds to (share) before only the flattened tangle is left. */
  collapseTime: 0.4,
  collapseLean: 0.55,
  collapseFlat: 0.12,
  /** Delay (s) between neighbouring pieces of one belt folding, as the tank reaches each in turn. */
  collapseStagger: 0.8,
  /** Share of the collapse after which the tangle starts to show. */
  debrisFrom: 0.35,
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

/** The aircraft each nation's air strike flies: the generic fighter-bomber, or the Red Army's Il-2 (same box and anchors). */
export const AIR_STRIKE_PLANE: Record<FactionId, 'generic' | 'il2'> = {
  british: 'generic',
  german: 'generic',
  soviet: 'il2',
};

/**
 * The BM-13 Katyusha launcher on its three-axle ZiS-6 truck (src/art/props/supplyLooks.ts), facing +x, origin on the
 * ground under the middle of the truck: eight launch rails over the bed, raised to fire over the cab, with a rocket on
 * and under each. Registered (KATYUSHA_LAUNCHER_KEY) for a salvo that shows its trucks; the salvo does not draw it yet.
 */
export const BM13_LAYOUT = {
  box: { w: 126, h: 80, ox: 64, oy: 76 } as ArtBox,
  /** The rails' rear pivot over the bed, their elevation (rad, up) and length. */
  railPivot: { x: -52, y: -30 } as ArtPoint,
  railAngle: 0.42,
  railLength: 88,
  /** Shift of the cab and front axle ahead of the supply truck's (the ZiS-6 chassis is longer). */
  cabShift: 6,
  /** The rear tandem axles. */
  rearAxles: [-24, -44] as readonly number[],
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

/** Call-in aircraft drawn by src/art/vehicles/planes.ts. */
export type PlaneKind = 'bomber' | 'fighter' | 'recon';

/** Plane sprites facing +x, origin = centre of the fuselage; shadows centred. */
export const PLANE_LAYOUT: Record<PlaneKind, { box: ArtBox; shadowBox: ArtBox; bombBay: ArtPoint; guns: ArtPoint; camera: ArtPoint; tail: ArtPoint }> = {
  bomber: { box: { w: 284, h: 80, ox: 142, oy: 50 }, shadowBox: { w: 280, h: 40, ox: 140, oy: 20 }, bombBay: { x: -10, y: 12 }, guns: { x: 114, y: -2 }, camera: { x: 0, y: 12 }, tail: { x: -130, y: -10 } },
  fighter: { box: { w: 180, h: 62, ox: 90, oy: 32 }, shadowBox: { w: 176, h: 30, ox: 88, oy: 15 }, bombBay: { x: 0, y: 8 }, guns: { x: 50, y: 5 }, camera: { x: 0, y: 8 }, tail: { x: -80, y: -6 } },
  recon: { box: { w: 132, h: 54, ox: 70, oy: 30 }, shadowBox: { w: 120, h: 24, ox: 60, oy: 12 }, bombBay: { x: 0, y: 6 }, guns: { x: 40, y: 0 }, camera: { x: -18, y: 6 }, tail: { x: -58, y: -6 } },
};

/**
 * Era aircraft looks (FOUNDATIONS.md 5.1, src/data/eras.ts): a call-in type flown in place of the nation's usual plane
 * on the mission's date, drawn in that type's box with its anchors. The I-16 is the Red Army's fighter of 1941.
 */
export type AircraftLook = 'i16';
export const AIRCRAFT_LOOKS: Record<AircraftLook, { kind: PlaneKind; faction: FactionId }> = {
  i16: { kind: 'fighter', faction: 'soviet' },
};

/** The tank looks that carry Quartermaster upgrade gear (src/data/looksGear.ts). */
export type TankLook = FactionLook['tank'] | FactionLook['heavyTank'];
export const TANK_LOOKS: readonly TankLook[] = ['churchill', 'panzer4', 'kingTiger', 't34', 'kv1'];

/**
 * Every vehicle rig: the gear-carrying tanks plus the light tanks (Panzer III Ausf. E, and a British cruiser on the
 * same small hull, and the Soviet T-60) and the APCs (Universal Carrier, SdKfz 251 half-track, and the Red Army's
 * Lend-Lease carrier with a Soviet crew and a DP gun). An APC's "turret" is its gunner behind the machine gun and its
 * "barrel" is that gun, so every vehicle draws with the same rig.
 */
export type VehicleLook = TankLook | 'panzer3' | 'cruiser' | 'carrier' | 'halftrack' | 't60' | 'carrierSoviet' | EraVehicleLook;

/**
 * The era looks (FOUNDATIONS.md 5.1; src/data/eras.ts picks them by the mission's date, ForceDef.look per force): the
 * Red Army's 1941 T-26 and BT-7 light tanks and the KV-2 (the KV-1 rig under the MT-1 turret), the Panzer III with the
 * short 5 cm (Ausf. H) and the long 5 cm with spaced armour (Ausf. L), the Panzer IV with the long 7.5 cm (Ausf. G),
 * and the StuG III with the short (Ausf. B) and the long (Ausf. F) 7.5 cm. No upgrade gear: a player's Quartermaster
 * gear shows on the nations' default looks only.
 */
export type EraVehicleLook = 't26' | 'bt7' | 'kv2' | 'panzer3h' | 'panzer3l' | 'panzer4g' | 'stug3b' | 'stug3f';
export const ERA_VEHICLE_LOOKS: readonly EraVehicleLook[] = ['t26', 'bt7', 'kv2', 'panzer3h', 'panzer3l', 'panzer4g', 'stug3b', 'stug3f'];

/** Every vehicle look, default and era, for iterating (the sprites, the keys, the layout tests). */
export const VEHICLE_LOOKS: readonly VehicleLook[] = [...TANK_LOOKS, 'panzer3', 'cruiser', 'carrier', 'halftrack', 't60', 'carrierSoviet', ...ERA_VEHICLE_LOOKS];

/**
 * Era looks drawn on another look's rig: the track and wheels come from `rig` (one set of sprites, shared), the hull
 * sprite from `hull` (the rig's own, or a look with a hull of its own); the turret, gun and husk are the look's own.
 */
export const VEHICLE_LOOK_RIG: Partial<Record<VehicleLook, { rig: VehicleLook; hull: VehicleLook }>> = {
  kv2: { rig: 'kv1', hull: 'kv1' },
  panzer3h: { rig: 'panzer3', hull: 'panzer3' },
  panzer3l: { rig: 'panzer3', hull: 'panzer3l' },
  panzer4g: { rig: 'panzer4', hull: 'panzer4' },
  stug3b: { rig: 'panzer3', hull: 'stug3b' },
  stug3f: { rig: 'panzer3', hull: 'stug3b' },
};

/** The looks that carry Quartermaster upgrade gear: the tanks and the player's APCs (src/data/looksGear.ts). */
export type GearLook = TankLook | 'carrier' | 'halftrack' | 'carrierSoviet';
export const GEAR_LOOKS: readonly GearLook[] = [...TANK_LOOKS, 'carrier', 'halftrack', 'carrierSoviet'];

/** Looks of the vehicle kinds a FactionLook does not name (tank and heavyTank come from FACTIONS[f].look). */
export const VEHICLE_LOOK_EXTRA: Record<FactionId, Record<'apc' | 'lightTank', VehicleLook>> = {
  british: { apc: 'carrier', lightTank: 'cruiser' },
  german: { apc: 'halftrack', lightTank: 'panzer3' },
  // The Red Army drove Lend-Lease Universal Carriers from 1942 (NATIONS.md, apc), and the T-60 light tank from 1941-10.
  soviet: { apc: 'carrierSoviet', lightTank: 't60' },
};

/**
 * The King Tiger's elite look: a three-tone ambush camouflage over the hull and turret, and a tactical number on the
 * turret side (no unit or party symbols). Blotches are [x, y, rx, ry, colour index] in hull or turret space.
 */
export const ELITE_TANK_LOOK = {
  camo: ['#9a8744', '#6a4026', '#46552f'] as readonly string[],
  camoAlpha: 0.7,
  hullBlotches: [
    [-100, -54, 16, 7, 1], [-70, -48, 14, 6, 2], [-40, -57, 18, 6, 1], [-10, -47, 12, 6, 2], [18, -55, 16, 6, 1],
    [46, -49, 14, 5, 2], [76, -56, 12, 5, 1], [-112, -40, 12, 5, 2], [-56, -38, 16, 5, 1], [8, -38, 14, 5, 2], [64, -40, 14, 5, 1],
  ] as readonly (readonly number[])[],
  turretBlotches: [
    [-42, -20, 9, 6, 1], [-24, -8, 10, 5, 2], [-2, -26, 9, 5, 1], [24, -14, 10, 6, 2], [38, -26, 7, 4, 1], [30, -5, 8, 4, 1],
  ] as readonly (readonly number[])[],
  /** Tactical number painted on the turret side: text, centre and height (wu). */
  number: { text: '312', x: -25, y: -9.5, h: 10 },
  /** Elite marker: a white band painted round the gun barrel, [x0, x1] along the barrel. */
  barrelBand: [62, 70] as readonly number[],
} as const;

/** APC passengers: the helmets of the carried squad over the side while it rides (hidden once it unloads). */
export interface PassengerDef {
  /** Sprite box; its origin sits at `at` (tank space, hull level) and rides the hull. */
  box: ArtBox;
  at: ArtPoint;
  /** Helmet x positions in sprite space; helmets sit on y = headY. */
  heads: readonly number[];
  headY: number;
}

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
  /** APCs: the carried squad's helmets showing over the side. */
  passengers?: PassengerDef;
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

/** The era looks on another look's rig (VEHICLE_LOOK_RIG); their layouts are the rig's with a few fields changed. */
type RiggedLook = 'kv2' | 'panzer3h' | 'panzer3l' | 'panzer4g' | 'stug3b' | 'stug3f';

/** Every vehicle with a rig of its own; the Soviet carrier shares the British one below. */
const DRAWN_TANK_LAYOUT: Record<Exclude<VehicleLook, 'carrierSoviet' | RiggedLook>, TankLayoutDef> = {
  /**
   * T-26 model 1933 (src/art/vehicles/t26.ts), the Red Army's most numerous tank in June 1941: a small, flat hull, eight
   * small road wheels a side in four leaf-sprung bogies, four return rollers, the drive sprocket at the front, the
   * cylindrical turret with its rear bustle and the 45 mm 20-K. Drawn a little over life size, like the other light tanks.
   */
  t26: {
    faction: 'soviet',
    length: 166,
    height: 70,
    trackBox: { w: 172, h: 40, ox: 86, oy: 37 },
    hullBox: { w: 176, h: 32, ox: 88, oy: 26 },
    turretBox: { w: 70, h: 28, ox: 34, oy: 25 },
    barrelBox: { w: 66, h: 8, ox: 7, oy: 4 },
    huskBox: { w: 200, h: 92, ox: 100, oy: 86 },
    rockPivot: { x: 0, y: -30 },
    turretRing: { x: -4, y: -47 },
    trunnion: { x: 18, y: -58 },
    exhaust: { x: -82, y: -38 },
    hullMg: { x: 32, y: -50 },
    barrelLength: 56,
    recoilDist: 3,
    elevMin: -6 * DEG,
    elevMax: 22 * DEG,
    rockMax: 2.2 * DEG,
    wheels: [
      { kind: 'return', x: -46, y: -27, r: 3 },
      { kind: 'return', x: -16, y: -27, r: 3 },
      { kind: 'return', x: 14, y: -27, r: 3 },
      { kind: 'return', x: 44, y: -27, r: 3 },
      ...[-56, -41, -25, -10, 6, 21, 37, 52].map((x) => ({ kind: 'road' as const, x, y: -10.1, r: 6.5 })),
      { kind: 'idler', x: -72, y: -16, r: 8 },
      { kind: 'sprocket', x: 70, y: -18, r: 9 },
    ],
    belt: [
      { x: -72, y: -16, r: 8 },
      { x: -46, y: -27, r: 3 },
      { x: 44, y: -27, r: 3 },
      { x: 70, y: -18, r: 9 },
      { x: 52, y: -10.1, r: 6.5 },
      { x: -56, y: -10.1, r: 6.5 },
    ],
    trackThickness: 3.6,
    trackPitch: 5.4,
    trackFrames: 4,
  },
  /**
   * BT-7 model 1937 (src/art/vehicles/bt7.ts): the fast tank on Christie suspension, four big road wheels a side and no
   * return rollers (the top run lies on the wheels), the drive sprocket at the rear, the long hull with its pointed
   * nose, the conical turret and the 45 mm 20-K.
   */
  bt7: {
    faction: 'soviet',
    length: 180,
    height: 74,
    trackBox: { w: 200, h: 44, ox: 100, oy: 40 },
    hullBox: { w: 200, h: 36, ox: 100, oy: 28 },
    turretBox: { w: 74, h: 30, ox: 36, oy: 27 },
    barrelBox: { w: 68, h: 8, ox: 7, oy: 4 },
    huskBox: { w: 222, h: 96, ox: 110, oy: 90 },
    rockPivot: { x: 0, y: -32 },
    turretRing: { x: 8, y: -50 },
    trunnion: { x: 32, y: -62 },
    exhaust: { x: -94, y: -42 },
    hullMg: { x: 62, y: -48 },
    barrelLength: 58,
    recoilDist: 3,
    elevMin: -6 * DEG,
    elevMax: 22 * DEG,
    rockMax: 2 * DEG,
    wheels: [...roadWheels(4, -60, 60, -18, 14), { kind: 'idler', x: 87, y: -21.5, r: 10.5 }, { kind: 'sprocket', x: -88, y: -21, r: 11 }],
    belt: [
      { x: -88, y: -21, r: 11 },
      { x: 87, y: -21.5, r: 10.5 },
      { x: 60, y: -18, r: 14 },
      { x: -60, y: -18, r: 14 },
    ],
    trackThickness: 4,
    trackPitch: 6.4,
    trackFrames: 4,
  },
  /**
   * T-34/76, 1942 (src/art/vehicles/t34.ts): about the Panzer IV's size, five big Christie road wheels a side and no
   * return rollers (the top run lies on the wheels), the drive sprocket at the rear, the turret well forward, and the
   * 76.2 mm F-34 overhanging the nose.
   */
  t34: {
    faction: 'soviet',
    length: 196,
    height: 82,
    trackBox: { w: 210, h: 40, ox: 105, oy: 36 },
    hullBox: { w: 216, h: 40, ox: 108, oy: 26 },
    turretBox: { w: 86, h: 36, ox: 45, oy: 33 },
    barrelBox: { w: 86, h: 10, ox: 10, oy: 5 },
    huskBox: { w: 250, h: 110, ox: 122, oy: 100 },
    rockPivot: { x: 0, y: -34 },
    turretRing: { x: 12, y: -54.5 },
    trunnion: { x: 44, y: -67 },
    exhaust: { x: -102, y: -40 },
    hullMg: { x: 90, y: -42 },
    barrelLength: 74,
    recoilDist: 6,
    elevMin: -5 * DEG,
    elevMax: 25 * DEG,
    rockMax: 1.9 * DEG,
    wheels: [
      ...roadWheels(5, -66, 66, -13.5, 13.5),
      { kind: 'idler', x: 88, y: -17, r: 10.5 },
      { kind: 'sprocket', x: -88, y: -17, r: 11 },
    ],
    belt: [
      { x: -88, y: -17, r: 11 },
      { x: 88, y: -17, r: 10.5 },
      { x: 66, y: -13.5, r: 13.5 },
      { x: -66, y: -13.5, r: 13.5 },
    ],
    trackThickness: 4.5,
    trackPitch: 6.4,
    trackFrames: 4,
  },
  /**
   * KV-1 model 1941 (src/art/vehicles/kv.ts): a tall, slab-sided heavy tank a little longer than the T-34, six small
   * steel road wheels on torsion bars and three return rollers a side, the drive sprocket at the rear, the welded turret
   * with its rear overhang, and the 76.2 mm ZiS-5.
   */
  kv1: {
    faction: 'soviet',
    length: 204,
    height: 94,
    trackBox: { w: 218, h: 50, ox: 109, oy: 47 },
    hullBox: { w: 216, h: 42, ox: 108, oy: 37 },
    turretBox: { w: 100, h: 40, ox: 52, oy: 37 },
    barrelBox: { w: 92, h: 10, ox: 10, oy: 5 },
    huskBox: { w: 262, h: 124, ox: 128, oy: 116 },
    rockPivot: { x: 0, y: -40 },
    turretRing: { x: 4, y: -70 },
    trunnion: { x: 40, y: -82 },
    exhaust: { x: -100, y: -66 },
    hullMg: { x: 90, y: -58.5 },
    barrelLength: 76,
    recoilDist: 7,
    elevMin: -5 * DEG,
    elevMax: 25 * DEG,
    rockMax: 1.5 * DEG,
    wheels: [
      { kind: 'return', x: -42, y: -33, r: 3.6 },
      { kind: 'return', x: 2, y: -33, r: 3.6 },
      { kind: 'return', x: 46, y: -33, r: 3.6 },
      ...roadWheels(6, -68, 64, -13.5, 9),
      { kind: 'idler', x: 90, y: -22, r: 10.5 },
      { kind: 'sprocket', x: -92, y: -22, r: 11 },
    ],
    belt: [
      { x: -92, y: -22, r: 11 },
      { x: -42, y: -33, r: 3.6 },
      { x: 46, y: -33, r: 3.6 },
      { x: 90, y: -22, r: 10.5 },
      { x: 64, y: -13.5, r: 9 },
      { x: -68, y: -13.5, r: 9 },
    ],
    trackThickness: 4.5,
    trackPitch: 7,
    trackFrames: 4,
  },
  /**
   * T-60 (src/art/vehicles/t60.ts): a small, low light tank with four road wheels and three return rollers a side, the
   * drive sprocket at the front, the driver's armoured cab on the bow and a small faceted turret carrying the long 20 mm
   * TNSh. Drawn a little over life size, like the other light tanks, so it reads next to the figures.
   */
  t60: {
    faction: 'soviet',
    length: 152,
    height: 62,
    trackBox: { w: 164, h: 40, ox: 82, oy: 38 },
    hullBox: { w: 168, h: 30, ox: 84, oy: 26 },
    turretBox: { w: 58, h: 26, ox: 28, oy: 24 },
    barrelBox: { w: 50, h: 8, ox: 6, oy: 4 },
    huskBox: { w: 190, h: 92, ox: 95, oy: 86 },
    rockPivot: { x: 0, y: -32 },
    turretRing: { x: -6, y: -50 },
    trunnion: { x: 15, y: -60 },
    exhaust: { x: -76, y: -40 },
    hullMg: { x: 24, y: -55 },
    barrelLength: 40,
    recoilDist: 2.5,
    elevMin: -7 * DEG,
    elevMax: 25 * DEG,
    rockMax: 2.2 * DEG,
    wheels: [
      { kind: 'return', x: -32, y: -26, r: 3 },
      { kind: 'return', x: 0, y: -26, r: 3 },
      { kind: 'return', x: 32, y: -26, r: 3 },
      ...roadWheels(4, -48, 42, -12.3, 8.5),
      { kind: 'idler', x: -68, y: -17, r: 8.5 },
      // The sprocket's top sits a little under the return rollers' tops, so the top run bends down over the front
      // roller (a sprocket standing higher makes the belt wrap that roller inside out, a fan of links).
      { kind: 'sprocket', x: 66, y: -18.5, r: 9.5 },
    ],
    belt: [
      { x: -68, y: -17, r: 8.5 },
      { x: -32, y: -26, r: 3 },
      { x: 32, y: -26, r: 3 },
      { x: 66, y: -18.5, r: 9.5 },
      { x: 42, y: -12.3, r: 8.5 },
      { x: -48, y: -12.3, r: 8.5 },
    ],
    trackThickness: 3.8,
    trackPitch: 5.6,
    trackFrames: 4,
  },
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
  panzer3: {
    faction: 'german',
    length: 160,
    height: 72,
    trackBox: { w: 170, h: 42, ox: 85, oy: 38 },
    hullBox: { w: 180, h: 40, ox: 90, oy: 24 },
    turretBox: { w: 72, h: 32, ox: 38, oy: 29 },
    barrelBox: { w: 40, h: 8, ox: 6, oy: 4 },
    huskBox: { w: 200, h: 92, ox: 100, oy: 86 },
    rockPivot: { x: 0, y: -30 },
    turretRing: { x: 0, y: -48 },
    trunnion: { x: 25, y: -57 },
    exhaust: { x: -86, y: -30 },
    hullMg: { x: 52, y: -42 },
    barrelLength: 30,
    recoilDist: 4,
    elevMin: -8 * DEG,
    elevMax: 18 * DEG,
    rockMax: 2.1 * DEG,
    wheels: [
      { kind: 'return', x: -36, y: -25, r: 3 },
      { kind: 'return', x: 0, y: -25, r: 3 },
      { kind: 'return', x: 36, y: -25, r: 3 },
      ...roadWheels(6, -50, 50, -10, 8.5),
      { kind: 'idler', x: -68, y: -16, r: 8 },
      { kind: 'sprocket', x: 70, y: -18, r: 9.5 },
    ],
    belt: [
      { x: -68, y: -16, r: 8 },
      { x: -36, y: -25, r: 3 },
      { x: 36, y: -25, r: 3 },
      { x: 70, y: -18, r: 9.5 },
      { x: 50, y: -10, r: 8.5 },
      { x: -50, y: -10, r: 8.5 },
    ],
    trackThickness: 3.6,
    trackPitch: 6,
    trackFrames: 4,
  },
  cruiser: {
    faction: 'british',
    length: 160,
    height: 72,
    trackBox: { w: 170, h: 42, ox: 85, oy: 38 },
    hullBox: { w: 180, h: 40, ox: 90, oy: 24 },
    turretBox: { w: 72, h: 32, ox: 38, oy: 29 },
    barrelBox: { w: 40, h: 8, ox: 6, oy: 4 },
    huskBox: { w: 200, h: 92, ox: 100, oy: 86 },
    rockPivot: { x: 0, y: -30 },
    turretRing: { x: 0, y: -48 },
    trunnion: { x: 25, y: -57 },
    exhaust: { x: -86, y: -30 },
    hullMg: { x: 52, y: -42 },
    barrelLength: 30,
    recoilDist: 4,
    elevMin: -8 * DEG,
    elevMax: 18 * DEG,
    rockMax: 2.1 * DEG,
    wheels: [...roadWheels(5, -52, 52, -12, 11), { kind: 'idler', x: -70, y: -17, r: 8 }, { kind: 'sprocket', x: 71, y: -19, r: 9.5 }],
    belt: [
      { x: -70, y: -17, r: 8 },
      { x: 71, y: -19, r: 9.5 },
      { x: 52, y: -12, r: 11 },
      { x: -52, y: -12, r: 11 },
    ],
    trackThickness: 3.6,
    trackPitch: 6,
    trackFrames: 4,
  },
  carrier: {
    faction: 'british',
    length: 124,
    height: 44,
    trackBox: { w: 128, h: 34, ox: 64, oy: 30 },
    hullBox: { w: 136, h: 30, ox: 68, oy: 16 },
    turretBox: { w: 24, h: 28, ox: 12, oy: 24 },
    barrelBox: { w: 30, h: 8, ox: 8, oy: 4 },
    huskBox: { w: 150, h: 64, ox: 75, oy: 58 },
    rockPivot: { x: 0, y: -22 },
    turretRing: { x: 32, y: -34 },
    trunnion: { x: 44, y: -38 },
    exhaust: { x: -62, y: -24 },
    hullMg: { x: 64, y: -38 },
    barrelLength: 20,
    recoilDist: 1.5,
    elevMin: -6 * DEG,
    elevMax: 14 * DEG,
    rockMax: 2.6 * DEG,
    wheels: [...roadWheels(3, -26, 26, -8, 7.5), { kind: 'idler', x: -48, y: -12, r: 7.5 }, { kind: 'sprocket', x: 50, y: -13, r: 8.5 }],
    belt: [
      { x: -48, y: -12, r: 7.5 },
      { x: 50, y: -13, r: 8.5 },
      { x: 26, y: -8, r: 7.5 },
      { x: -26, y: -8, r: 7.5 },
    ],
    trackThickness: 3,
    trackPitch: 5,
    trackFrames: 4,
    passengers: { box: { w: 60, h: 14, ox: 30, oy: 10 }, at: { x: -18, y: -34 }, heads: [-20, -6, 8, 22], headY: 0 },
  },
  halftrack: {
    faction: 'german',
    length: 196,
    height: 62,
    trackBox: { w: 136, h: 38, ox: 104, oy: 34 },
    hullBox: { w: 204, h: 42, ox: 102, oy: 32 },
    turretBox: { w: 26, h: 28, ox: 12, oy: 24 },
    barrelBox: { w: 34, h: 8, ox: 8, oy: 4 },
    huskBox: { w: 220, h: 80, ox: 110, oy: 74 },
    rockPivot: { x: 0, y: -24 },
    turretRing: { x: 26, y: -52 },
    trunnion: { x: 36, y: -58 },
    exhaust: { x: -96, y: -24 },
    hullMg: { x: 56, y: -56 },
    barrelLength: 22,
    recoilDist: 1.5,
    elevMin: -6 * DEG,
    elevMax: 14 * DEG,
    rockMax: 2 * DEG,
    wheels: [
      ...interleaved(roadWheels(4, -66, 6, -10, 9)),
      { kind: 'idler', x: -86, y: -15, r: 8 },
      { kind: 'sprocket', x: 24, y: -17, r: 9 },
      { kind: 'road', x: 74, y: -11, r: 11 },
    ],
    belt: [
      { x: -86, y: -15, r: 8 },
      { x: 24, y: -17, r: 9 },
      { x: 6, y: -10, r: 9 },
      { x: -66, y: -10, r: 9 },
    ],
    trackThickness: 3.4,
    trackPitch: 5.5,
    trackFrames: 4,
    passengers: { box: { w: 76, h: 14, ox: 38, oy: 10 }, at: { x: -34, y: -52 }, heads: [-27, -10, 7, 24], headY: 0 },
  },
};

/**
 * The KV-2 of 1941 (NATIONS.md section 3, heavyTank): the KV-1 hull under a tall box turret with the short 152 mm M-10T
 * howitzer (KV2_KEYS in src/art/vehicles; the `kv2` look below). The turret sits on the KV-1's turret ring; the
 * trunnion here is in turret space.
 */
export const KV2_TURRET: { turretBox: ArtBox; trunnion: ArtPoint; barrelLength: number; barrelBox: ArtBox } = {
  turretBox: { w: 96, h: 56, ox: 46, oy: 52 },
  trunnion: { x: 32, y: -22 },
  barrelLength: 44,
  barrelBox: { w: 60, h: 18, ox: 10, oy: 9 },
};

const KV1 = DRAWN_TANK_LAYOUT.kv1;
const PZ3 = DRAWN_TANK_LAYOUT.panzer3;
const PZ4 = DRAWN_TANK_LAYOUT.panzer4;

/**
 * The StuG III on the Panzer III running gear: the low hull and the fixed casemate (drawn as its "turret", so it rides
 * the hull like one) with the gun low in the front plate, off the hull's centre line. About as tall as a man.
 */
const STUG: TankLayoutDef = {
  ...PZ3,
  height: 60,
  turretBox: { w: 92, h: 24, ox: 46, oy: 16 },
  turretRing: { x: 8, y: -47 },
  trunnion: { x: 46, y: -53 },
  hullMg: { x: 40, y: -42 },
  elevMin: -6 * DEG,
  elevMax: 20 * DEG,
};

/** The era looks on another look's rig (VEHICLE_LOOK_RIG): the rig's layout with the turret, gun and husk changed. */
const RIGGED_TANK_LAYOUT: Record<RiggedLook, TankLayoutDef> = {
  /** KV-2: the MT-1 turret on the KV-1's ring; much taller, so a taller husk box for the toppled turret. */
  kv2: {
    ...KV1,
    height: 112,
    turretBox: KV2_TURRET.turretBox,
    trunnion: { x: KV1.turretRing.x + KV2_TURRET.trunnion.x, y: KV1.turretRing.y + KV2_TURRET.trunnion.y },
    barrelLength: KV2_TURRET.barrelLength,
    barrelBox: KV2_TURRET.barrelBox,
    huskBox: { w: 262, h: 140, ox: 128, oy: 132 },
    recoilDist: 5,
    elevMax: 18 * DEG,
  },
  /** Panzer III Ausf. H: the external mantlet and the short 5 cm KwK 38 L/42. */
  panzer3h: { ...PZ3, barrelLength: 36, barrelBox: { w: 46, h: 9, ox: 6, oy: 4.5 } },
  /** Panzer III Ausf. L: spaced plates on the mantlet and the bow, and the long 5 cm KwK 39 L/60 (no skirts before 1943). */
  panzer3l: { ...PZ3, turretBox: { w: 78, h: 32, ox: 40, oy: 29 }, barrelLength: 52, barrelBox: { w: 62, h: 9, ox: 6, oy: 4.5 }, recoilDist: 5 },
  /** Panzer IV Ausf. G: the long 7.5 cm KwK 40 L/43 with its double-baffle muzzle brake. */
  panzer4g: { ...PZ4, barrelLength: 70, barrelBox: { w: 84, h: 12, ox: 10, oy: 6 }, recoilDist: 7 },
  /** StuG III Ausf. B: the short 7.5 cm StuK 37 L/24. */
  stug3b: { ...STUG, barrelLength: 32, barrelBox: { w: 42, h: 10, ox: 6, oy: 5 } },
  /** StuG III Ausf. F: the long 7.5 cm StuK 40 L/43 with its muzzle brake. */
  stug3f: { ...STUG, barrelLength: 62, barrelBox: { w: 74, h: 12, ox: 8, oy: 6 }, recoilDist: 6 },
};

export const TANK_LAYOUT: Record<VehicleLook, TankLayoutDef> = {
  ...DRAWN_TANK_LAYOUT,
  ...RIGGED_TANK_LAYOUT,
  // The Lend-Lease carrier is the British vehicle: same rig, Soviet paint, crew and DP gun (src/art/vehicles/lightVehicles.ts).
  carrierSoviet: { ...DRAWN_TANK_LAYOUT.carrier, faction: 'soviet' },
};

/** Most wheels on any tank: size of the preallocated wheel array in a TankPose. */
export const TANK_MAX_WHEELS = Math.max(...VEHICLE_LOOKS.map((look) => TANK_LAYOUT[look].wheels.length));
