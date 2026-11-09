/**
 * How unit gear upgrades are drawn (the contract is src/data/upgradeLooks.ts). Pure data: the sprites are painted in
 * src/art/figure/gear.ts and src/art/vehicles/tankGear.ts.
 *
 * Infantry gear is a texture swap of a slot the figure already has (helmet, pack, belt pouches, medic satchel) plus
 * one extra slot for a strap across the chest (bandolier). Tank gear swaps the hull, turret and gun sprites.
 */
import type { GearLook, PlaneKind } from './artLayout';
import { FIGURE_GAIT_CARRY, FIGURE_STANCES, FIGURE_UPPERS, type FigureKind, type GaitProfile, type StanceDef, type UpperDef } from './figure';
import type { FactionId } from './schema';
import { GEAR_STEPS, SAPPER_CART_HANDLE, type GearLevels, type GearPiece, type GearStep, type TankGearPiece } from './upgradeLooks';

/** Gear level 0 on both tracks: the unit's normal look. */
export const GEAR_NONE: GearLevels = Object.freeze({ health: 0, damage: 0 });

/** Every figure gear style: the contract's pieces plus the medic's kit and the haversack. */
export type FigureGearStyle = GearPiece | 'haversack' | 'medicSatchel' | 'aidPouches' | 'aidStrap' | 'flameShield';
export type FigureGearSlot = 'helmet' | 'pack' | 'pouches' | 'bandolier' | 'satchel';

export const FIGURE_GEAR_STYLES: readonly FigureGearStyle[] = [
  'fullPack',
  'haversack',
  'helmetNet',
  'helmetScrim',
  'fullPouches',
  'bandolier',
  'grenades',
  'medicSatchel',
  'aidPouches',
  'aidStrap',
  'flameShield',
];

/** Which figure slot each style is drawn in (a later style of the same slot replaces the earlier one). */
export const FIGURE_GEAR_SLOT: Record<FigureGearStyle, FigureGearSlot> = {
  fullPack: 'pack',
  haversack: 'pack',
  helmetNet: 'helmet',
  helmetScrim: 'helmet',
  fullPouches: 'pouches',
  grenades: 'pouches',
  bandolier: 'bandolier',
  medicSatchel: 'satchel',
  aidPouches: 'pouches',
  aidStrap: 'bandolier',
  flameShield: 'pack',
};

/**
 * The medic's healing upgrade counts as his damage track, but pouches, a bandolier and grenades make no sense on a
 * medic: he gets a fuller medical satchel, then first-aid pouches on the belt, then more on a strap across the chest.
 */
export const MEDIC_DAMAGE_GEAR: readonly GearStep<FigureGearStyle>[] = [
  { piece: 'medicSatchel', source: 'damage', level: 1 },
  { piece: 'aidPouches', source: 'damage', level: 2 },
  { piece: 'aidStrap', source: 'damage', level: 3 },
];

/**
 * The flamethrower always wears his fuel tanks in the pack slot, so his health track's first piece is a pale steel
 * heat shield strapped over the tanks (they ignite when shot from behind) instead of the fuller pack.
 */
export const FLAME_HEALTH_GEAR: readonly GearStep<FigureGearStyle>[] = [
  { piece: 'flameShield', source: 'health', level: 1 },
  ...GEAR_STEPS.filter((s) => s.source === 'health' && s.piece !== 'fullPack'),
];

/** Gear steps per figure kind (kinds not listed use GEAR_STEPS). */
export const FIGURE_GEAR_STEPS: Partial<Record<FigureKind, readonly GearStep<FigureGearStyle>[]>> = {
  medic: [...GEAR_STEPS.filter((s) => s.source === 'health'), ...MEDIC_DAMAGE_GEAR],
  flame: [...FLAME_HEALTH_GEAR, ...GEAR_STEPS.filter((s) => s.source === 'damage')],
};

/** A kind that wears no pack gets this style instead of the full pack (a haversack on the back). */
export const GEAR_NO_PACK_STYLE: FigureGearStyle = 'haversack';

/**
 * Per nation: the grenades hung on the belt (they follow the nation's hand grenade), and the light colours of the
 * fuller belt kit (pouches, water bottle and its cap) that make it read against the black body at phone size.
 */
export const FIGURE_GEAR_NATION: Record<FactionId, { grenades: 'mills' | 'stick'; pouch: string; bottle: string; cap: string }> = {
  british: { grenades: 'mills', pouch: '#cdbf8e', bottle: '#cdbf8e', cap: '#2e2d24' },
  german: { grenades: 'stick', pouch: '#a9ab8f', bottle: '#8c6a42', cap: '#2b2c28' },
};

/**
 * Sizes and colours of the figure gear sprites, in wu (a standing figure is 58 wu, about 55 CSS px on a phone, so
 * nothing here is thinner than about 0.6 wu or it vanishes). Frames as in src/art/figure/parts.ts: helmets in head
 * space (scaled from a 5.4 head), pack and bandolier upright from the chest joint, pouches upright from the hip.
 */
export const FIGURE_GEAR_ART = {
  colors: {
    /** Cotton bandolier and the blanket roll: lighter than the uniform so they read on the black body. */
    cotton: '#b9ab7c',
    cottonDark: '#7d7250',
    /** The blanket roll on the full pack: paler than the cotton so it reads on a khaki pack. */
    blanket: '#dcd2aa',
    net: '#1f2119',
    /** Scrim and foliage tufts. */
    scrim: ['#5e6b33', '#7a7440', '#46522a'],
    grenade: '#3a4430',
    stickHead: '#4b5246',
    aidWhite: '#e6e1cf',
    /** The flamethrower's heat shield: pale steel with a dark edge, so it stands out on the dark tanks. */
    shield: '#b4b8ad',
    shieldDark: '#4c5048',
  },
  net: {
    /** Mesh spacing and line width (head space, unscaled). */
    spacing: 2.0,
    width: 0.55,
    /** The net hangs a little past the rim: extra outline width. */
    edge: 0.55,
  },
  /** Scrim tufts on top of the net: [x, y, radius] in helmet head space (unscaled), per helmet shape. */
  scrim: {
    brodie: [-6.0, -4.0, 1.3, -2.8, -6.8, 1.6, 1.0, -7.8, 1.6, 4.4, -5.8, 1.4],
    stahlhelm: [-5.0, -5.0, 1.4, -2.0, -8.6, 1.6, 2.0, -8.8, 1.5, -6.4, -1.4, 1.2],
  } as Record<'brodie' | 'stahlhelm', readonly number[]>,
  /** Full pack: body (x, y, w, h) and the blanket roll on top (x, y, length, radius). */
  fullPack: { x: -9.6, y: -7.8, w: 7.0, h: 9.6, rollX: -10.8, rollY: -9.6, rollW: 9.2, rollR: 2.1 },
  /** Haversack worn by kinds without a pack. */
  haversack: { x: -7.9, y: -3.4, w: 4.9, h: 5.4 },
  /** Full pouches: a big light pouch block in front and a water bottle sticking out behind the hip (both outlined). */
  fullPouches: { x: 1.4, y: -8.2, w: 5.4, h: 6.8, bottleX: -10.6, bottleY: -9.2, bottleW: 5.0, bottleH: 9.0, edge: '#25231a', edgeW: 0.7 },
  /** Mills bombs on the belt ([x, y] centres, radius) and the stick grenade (handle from x0,y0 to x1,y1, head size). */
  mills: { at: [6.9, -5.6, -6.4, 0.6, -9.4, -1.0] as readonly number[], rx: 1.7, ry: 1.45 },
  /** Stick grenades pushed behind the belt, heads sticking out behind the back: [x0, y0, x1, y1] per grenade. */
  stick: { at: [1.4, 1.2, -11.6, -6.0, 2.4, 0.2, -9.6, -10.8] as readonly number[], handle: 1.35, headW: 3.4, headH: 2.9 },
  /**
   * Bandolier over the shoulder: from the front of the near shoulder (x0, y0) across the back to behind the hip (x1,
   * y1), so it shows over the pack and past the back where the arms and weapon do not hide it. Width, pockets, edge.
   */
  bandolier: { x0: 2.2, y0: -9.6, x1: -8.2, y1: 7.4, width: 3.4, pockets: 5, edge: '#25231a', edgeW: 0.7 },
  /** Medic: the fuller satchel (box size and offset along the strap), belt aid pouches and the chest strap. */
  medicSatchel: { x: 2.4, y: -5.4, w: 10.4, h: 10.8 },
  // Aid pouches hang behind the hip, where the arms do not hide them.
  aidPouches: { x: -11.0, y: -6.6, w: 3.6, h: 4.2, gap: 0.6 },
  aidStrap: { pouchW: 2.8, pouchH: 2.4 },
  /** Flamethrower heat shield over the back of the fuel tanks (pack space, like the tanks): plate x, y, w, h, corner. */
  flameShield: { x: -12.4, y: -11.2, w: 4.6, h: 16.0, r: 1.4 },
} as const;

// ---------------------------------------------------------------------------
// Sapper pushing a handcart
// ---------------------------------------------------------------------------

/**
 * A sapper pushing the handcart: both hands on the handle at SAPPER_CART_HANDLE (the grip point is stood on the ground
 * as an absolute figure-space position, like a set-up weapon), body leaning into the push. The legs keep the normal
 * gait with a longer lean; the arms do not swing.
 */
export const SAPPER_PUSH: { stance: StanceDef; upper: UpperDef; gait: GaitProfile } = {
  stance: { ...FIGURE_STANCES.stand, hipX: -1.6, spine: 0.24, chest: 0.06, head: -0.2, nearFootX: 1.2, farFootX: -5.4, twist: 0.25 },
  upper: {
    ...FIGURE_UPPERS.free,
    ground: true,
    ox: SAPPER_CART_HANDLE.x,
    oy: SAPPER_CART_HANDLE.y,
    angle: 0,
    nearPin: 1,
    farPin: 1,
    nearPx: 0.5,
    nearPy: 0,
    farPx: -0.7,
    farPy: 0,
    head: -0.04,
  },
  gait: {
    walkSpeed: FIGURE_GAIT_CARRY.walkSpeed,
    runSpeed: FIGURE_GAIT_CARRY.runSpeed,
    slow: { ...FIGURE_GAIT_CARRY.slow, lean: 0.24, chest: 0.06, headLevel: 0.7, twist: 0.25, armSwing: 0, weaponBob: 0 },
    fast: { ...FIGURE_GAIT_CARRY.fast, lean: 0.3, chest: 0.06, headLevel: 0.75, twist: 0.25, armSwing: 0, weaponBob: 0 },
  },
};

// ---------------------------------------------------------------------------
// Tanks
// ---------------------------------------------------------------------------

/** Where each tank look carries its gear, in tank space (hull) or turret space (turret), facing +x. */
export interface TankGearArt {
  /** Extra room around the hull and turret sprites for the gear: [front, top, back] in wu. */
  hullPad: readonly [number, number, number];
  turretPad: readonly [number, number, number];
  /** Spare track links: first link (x, y), step between links (dx, dy), count, link size. */
  links: { x: number; y: number; dx: number; dy: number; n: number; w: number; h: number };
  /** Bolted armour plates: [x, y, w, h] rectangles. */
  applique: readonly number[];
  /** Sandbags along the hull: first bag centre (x, y), step (dx, dy), count, bag size. Two rows. */
  sandbags: { x: number; y: number; dx: number; dy: number; n: number; w: number; h: number };
  /** Stowage box on the turret: x, y, w, h. */
  stowage: readonly [number, number, number, number];
  /** Machine gun on the cupola: mount (x, y), barrel length, pintle post height and barrel angle (rad, up = negative). */
  cupolaMg: { x: number; y: number; len: number; post: number; angle: number };
  /** Long gun: extra barrel length (wu) and muzzle brake (length, half height; 0 = none). */
  longGun: { extra: number; brakeLen: number; brakeHalf: number };
}

/**
 * Per gear look. The APCs carry the same pieces as the tanks: spare track on the front plate, bolted plates on the
 * sides, sandbags on the deck; their "turret" is the gunner, so the stowage is ammunition boxes behind him, the cupola
 * MG a second gun on a post behind him, and the long gun a heavier barrel with a flash hider.
 */
export const TANK_GEAR_ART: Record<GearLook, TankGearArt> = {
  churchill: {
    hullPad: [6, 12, 0],
    turretPad: [0, 9, 12],
    links: { x: 54, y: -64, dx: 5.2, dy: 1.0, n: 3, w: 4.2, h: 7.5 },
    applique: [-20, -55.5, 22, 7, 8, -55.5, 22, 7, 36, -55.5, 20, 7],
    sandbags: { x: -84, y: -61, dx: 10.5, dy: 0, n: 5, w: 10.5, h: 5.6 },
    stowage: [-58, -24, 12, 15],
    cupolaMg: { x: -10, y: -32, len: 15, post: 4, angle: 0 },
    longGun: { extra: 16, brakeLen: 6, brakeHalf: 3.8 },
  },
  panzer4: {
    hullPad: [6, 12, 0],
    turretPad: [0, 9, 10],
    links: { x: 62, y: -50, dx: 5.4, dy: 0.72, n: 4, w: 4.2, h: 6.4 },
    applique: [-58, -55, 40, 15, -14, -55, 40, 15, 30, -55, 22, 15],
    sandbags: { x: 64, y: -46, dx: 9, dy: 3.4, n: 3, w: 9.5, h: 5.2 },
    stowage: [-58, -21, 12, 13],
    cupolaMg: { x: -16, y: -32, len: 15, post: 4, angle: 0 },
    longGun: { extra: 30, brakeLen: 6, brakeHalf: 4.4 },
  },
  kingTiger: {
    hullPad: [6, 12, 0],
    turretPad: [0, 9, 10],
    links: { x: 84, y: -60, dx: 6.2, dy: 3.4, n: 5, w: 5.2, h: 7.5 },
    applique: [-112, -60, 44, 12, -62, -60, 44, 12, -12, -60, 44, 12],
    sandbags: { x: -100, y: -68, dx: 12, dy: 0, n: 6, w: 11.5, h: 6 },
    stowage: [-64, -26, 12, 18],
    cupolaMg: { x: -21, y: -41, len: 17, post: 4, angle: 0 },
    longGun: { extra: 12, brakeLen: 7, brakeHalf: 5.6 },
  },
  carrier: {
    hullPad: [8, 16, 4],
    turretPad: [14, 16, 18],
    links: { x: 45, y: -41, dx: 3.6, dy: 2.0, n: 4, w: 4.0, h: 7.4 },
    applique: [-54, -32, 24, 8.5, -26, -32, 24, 8.5, 2, -32, 15, 8.5],
    // Behind the carried squad, on the rear deck.
    sandbags: { x: -54, y: -37, dx: 10.5, dy: 0, n: 2, w: 10.5, h: 6 },
    // Ammunition boxes on the front plate below the gun, in front of the gunner.
    stowage: [6, -1, 13, 9],
    // A second Bren on an anti-aircraft post behind the gunner, cocked up.
    cupolaMg: { x: -11, y: 2, len: 14, post: 9, angle: -0.45 },
    longGun: { extra: 12, brakeLen: 5, brakeHalf: 3.0 },
  },
  halftrack: {
    hullPad: [8, 16, 4],
    turretPad: [16, 16, 18],
    links: { x: 56, y: -49, dx: 5.4, dy: 1.3, n: 4, w: 4.4, h: 7.6 },
    applique: [-92, -51, 30, 9.5, -58, -51, 30, 9.5, -24, -51, 30, 9.5],
    // Along the sloped engine hood, in front of the driver.
    sandbags: { x: 54, y: -52, dx: 10.5, dy: 2.4, n: 4, w: 10.5, h: 6 },
    stowage: [10, 0, 12, 8],
    cupolaMg: { x: -11, y: 2, len: 15, post: 9, angle: -0.45 },
    longGun: { extra: 12, brakeLen: 5, brakeHalf: 3.2 },
  },
};

/** Which tank piece each step adds, as a sprite: health pieces build up on the hull, stowage and the MG on the turret, the long gun is a new barrel. */
export const TANK_GEAR_PART: Record<TankGearPiece, 'hull' | 'turret' | 'barrel'> = {
  trackLinks: 'hull',
  applique: 'hull',
  sandbags: 'hull',
  stowage: 'turret',
  cupolaMg: 'turret',
  longGun: 'barrel',
};

/** Quartermaster previews of the HQ, gun, dump and haul: ground line as a share of the picture's height, and margin. */
export const UPGRADE_PREVIEW = {
  ground: 0.8,
  margin: 0.06,
} as const;

// ---------------------------------------------------------------------------
// Planes
// ---------------------------------------------------------------------------

/** Where a plane type carries its gear (PLANE_GEAR_STEPS), in plane space (facing +x, as src/art/vehicles/planes.ts). */
export interface PlaneGearArt {
  /** Stripes round the rear fuselage: first band x, band width, count, and the fuselage's top and bottom there. */
  stripes: { x: number; w: number; n: number; y0: number; y1: number };
  /** Drop tank under the belly: centre, half length, half height. */
  dropTank: { x: number; y: number; rx: number; ry: number };
  /** Painted nose: the rect x0..x1, y0..y1 (on the plane only); mission tallies from (x, y), `n` of them, `dx` apart. */
  nose: { x0: number; x1: number; y0: number; y1: number; tallyX: number; tallyY: number; n: number; dx: number };
}

export const PLANE_GEAR_ART: Record<PlaneKind, PlaneGearArt> = {
  bomber: {
    stripes: { x: -99, w: 5.8, n: 5, y0: -12, y1: 14 },
    dropTank: { x: -8, y: 17, rx: 22, ry: 4.6 },
    // The glazed nose stays clear: a coloured band round the nose section ahead of the engine.
    nose: { x0: 76, x1: 92, y0: -18, y1: 14, tallyX: -30, tallyY: -11, n: 6, dx: 5 },
  },
  fighter: {
    stripes: { x: -67, w: 4.4, n: 5, y0: -14, y1: 10 },
    dropTank: { x: 6, y: 14, rx: 15, ry: 3.8 },
    nose: { x0: 58, x1: 90, y0: -14, y1: 14, tallyX: -2, tallyY: -8, n: 4, dx: 4.4 },
  },
  recon: {
    stripes: { x: -52, w: 3.4, n: 5, y0: -7, y1: 6 },
    dropTank: { x: -6, y: 12, rx: 11, ry: 3.2 },
    // Below the high wing.
    nose: { x0: 34, x1: 62, y0: -13, y1: 10, tallyX: -16, tallyY: -8, n: 3, dx: 4 },
  },
};

/** Plane gear colours per nation: invasion stripes (British) or a yellow band (German), and the painted nose. */
export const PLANE_GEAR_NATION: Record<FactionId, { stripes: readonly string[]; nose: string; tally: string; tank: string }> = {
  british: { stripes: ['#ece6d2', '#141410'], nose: '#b8352a', tally: '#ece6d2', tank: '#5d6150' },
  german: { stripes: ['#d8b33a', '#d8b33a'], nose: '#e6e0c8', tally: '#ece6d2', tank: '#4f5552' },
};
