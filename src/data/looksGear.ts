/**
 * How unit gear upgrades are drawn (the contract is src/data/upgradeLooks.ts). Pure data: the sprites are painted in
 * src/art/figure/gear.ts and src/art/vehicles/tankGear.ts.
 *
 * Infantry gear is a texture swap of a slot the figure already has (helmet, pack, belt pouches, medic satchel) plus
 * one extra slot for a strap across the chest (bandolier). Tank gear swaps the hull, turret and gun sprites.
 */
import type { TankLook } from './artLayout';
import { FIGURE_GAIT_CARRY, FIGURE_STANCES, FIGURE_UPPERS, type FigureKind, type GaitProfile, type StanceDef, type UpperDef } from './figure';
import type { FactionId } from './schema';
import { GEAR_STEPS, SAPPER_CART_HANDLE, type GearLevels, type GearPiece, type GearStep, type TankGearPiece } from './upgradeLooks';

/** Gear level 0 on both tracks: the unit's normal look. */
export const GEAR_NONE: GearLevels = Object.freeze({ health: 0, damage: 0 });

/** Every figure gear style: the contract's pieces plus the medic's kit and the haversack. */
export type FigureGearStyle = GearPiece | 'haversack' | 'medicSatchel' | 'aidPouches' | 'aidStrap';
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

/** Gear steps per figure kind (kinds not listed use GEAR_STEPS). */
export const FIGURE_GEAR_STEPS: Partial<Record<FigureKind, readonly GearStep<FigureGearStyle>[]>> = {
  medic: [...GEAR_STEPS.filter((s) => s.source === 'health'), ...MEDIC_DAMAGE_GEAR],
};

/** A kind that wears no pack gets this style instead of the full pack (a haversack on the back). */
export const GEAR_NO_PACK_STYLE: FigureGearStyle = 'haversack';

/** Per nation: the grenades hung on the belt (they follow the nation's hand grenade). */
export const FIGURE_GEAR_NATION: Record<FactionId, { grenades: 'mills' | 'stick' }> = {
  british: { grenades: 'mills' },
  german: { grenades: 'stick' },
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
    net: '#1f2119',
    /** Scrim and foliage tufts. */
    scrim: ['#5e6b33', '#7a7440', '#46522a'],
    grenade: '#3a4430',
    stickHead: '#4b5246',
    aidWhite: '#e6e1cf',
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
  fullPack: { x: -9.6, y: -7.8, w: 7.0, h: 9.6, rollX: -10.4, rollY: -9.4, rollW: 8.6, rollR: 1.7 },
  /** Haversack worn by kinds without a pack. */
  haversack: { x: -7.9, y: -3.4, w: 4.9, h: 5.4 },
  /** Full pouches: front pouch block and a water bottle behind. */
  fullPouches: { x: 1.6, y: -11.0, w: 4.8, h: 8.6, bottleX: -8.6, bottleY: -7.6, bottleW: 4.0, bottleH: 7.6 },
  /** Mills bombs on the belt ([x, y] centres, radius) and the stick grenade (handle from x0,y0 to x1,y1, head size). */
  mills: { at: [6.9, -5.6, -6.4, 0.6, -9.4, -1.0] as readonly number[], rx: 1.7, ry: 1.45 },
  stick: { x0: 1.0, y0: 1.0, x1: -8.2, y1: -6.8, handle: 1.25, headW: 3.0, headH: 2.6 },
  /** Bandolier across the chest: from the near shoulder (x0, y0) down to the far hip (x1, y1), its width and pockets. */
  bandolier: { x0: -3.0, y0: -8.4, x1: 4.0, y1: 4.6, width: 2.6, pockets: 4 },
  /** Medic: the fuller satchel (box size and offset along the strap), belt aid pouches and the chest strap. */
  medicSatchel: { x: 2.6, y: -4.5, w: 8.6, h: 9.0 },
  aidPouches: { x: 0.6, y: -6.2, w: 3.4, h: 3.8, gap: 0.6 },
  aidStrap: { pouchW: 2.8, pouchH: 2.4 },
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
  /** Machine gun on the cupola: mount (x, y), barrel length. */
  cupolaMg: { x: number; y: number; len: number };
  /** Long gun: extra barrel length (wu) and muzzle brake (length, half height; 0 = none). */
  longGun: { extra: number; brakeLen: number; brakeHalf: number };
}

export const TANK_GEAR_ART: Record<TankLook, TankGearArt> = {
  churchill: {
    hullPad: [6, 12, 0],
    turretPad: [0, 9, 12],
    links: { x: 54, y: -64, dx: 5.2, dy: 1.0, n: 3, w: 4.2, h: 7.5 },
    applique: [-20, -55.5, 22, 7, 8, -55.5, 22, 7, 36, -55.5, 20, 7],
    sandbags: { x: -84, y: -61, dx: 10.5, dy: 0, n: 5, w: 10.5, h: 5.6 },
    stowage: [-58, -24, 12, 15],
    cupolaMg: { x: -10, y: -32, len: 15 },
    longGun: { extra: 16, brakeLen: 6, brakeHalf: 3.8 },
  },
  panzer4: {
    hullPad: [6, 12, 0],
    turretPad: [0, 9, 10],
    links: { x: 62, y: -50, dx: 5.4, dy: 0.72, n: 4, w: 4.2, h: 6.4 },
    applique: [-58, -55, 40, 15, -14, -55, 40, 15, 30, -55, 22, 15],
    sandbags: { x: 64, y: -46, dx: 9, dy: 3.4, n: 3, w: 9.5, h: 5.2 },
    stowage: [-58, -21, 12, 13],
    cupolaMg: { x: -16, y: -32, len: 15 },
    longGun: { extra: 30, brakeLen: 6, brakeHalf: 4.4 },
  },
  kingTiger: {
    hullPad: [6, 12, 0],
    turretPad: [0, 9, 10],
    links: { x: 84, y: -60, dx: 6.2, dy: 3.4, n: 5, w: 5.2, h: 7.5 },
    applique: [-112, -60, 44, 12, -62, -60, 44, 12, -12, -60, 44, 12],
    sandbags: { x: -100, y: -68, dx: 12, dy: 0, n: 6, w: 11.5, h: 6 },
    stowage: [-64, -26, 12, 18],
    cupolaMg: { x: -21, y: -41, len: 17 },
    longGun: { extra: 12, brakeLen: 7, brakeHalf: 5.6 },
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
