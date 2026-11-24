/**
 * Cosmetics: things a player owns and wears that change how their units, the enemy's units or their HQ are drawn, and
 * nothing else. The simulation never reads this file (tests/unit/cosmetics-sim.test.ts holds the source to that), so a
 * battle plays tick for tick the same whatever is worn.
 *
 * Adding one is a data entry in ITEMS below (and, when it brings a picture of its own, a file in src/cosmetics/art):
 * docs/COSMETICS_GUIDE.md says how. The owner designs every item; the ones here are placeholders for testing and are
 * marked so (`placeholder: true`, and "Placeholder" in every name).
 *
 * The whole feature (crates, the Appearance tab, free crates, every word about them) is hidden while `enabled` is
 * false. That is the one switch.
 */
import type { WeaponModel } from './figure';
import type { FigureClothing, FigureHeadgear } from './looksGear';
import type { FactionId, UnitKind } from './schema';

/**
 * Rarity tiers, lowest first. 'secret' is the "???" tier above Mythic; 'special' is outside the crate tiers: an item of
 * it never comes from a crate.
 */
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'secret' | 'special';

export interface RarityDef {
  /** The word the player reads. Always shown with an item: the colour is never the only sign of a rarity. */
  name: string;
  /** '#rrggbb': the flash of an opening crate, the edge of a card. */
  colour: string;
  /** How many marks stand beside the name (a second sign that does not lean on colour). */
  marks: number;
  /** False for the tiers no crate may hold. */
  inCrates: boolean;
}

export const RARITY_ORDER: readonly Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'secret', 'special'];

export const RARITIES: Readonly<Record<Rarity, RarityDef>> = {
  common: { name: 'Common', colour: '#f2f0e6', marks: 1, inCrates: true },
  uncommon: { name: 'Uncommon', colour: '#4fbf5a', marks: 2, inCrates: true },
  rare: { name: 'Rare', colour: '#4a8fe8', marks: 3, inCrates: true },
  epic: { name: 'Epic', colour: '#a45be0', marks: 4, inCrates: true },
  legendary: { name: 'Legendary', colour: '#f2c230', marks: 5, inCrates: true },
  mythic: { name: 'Mythic', colour: '#e2412f', marks: 6, inCrates: true },
  secret: { name: '???', colour: '#bfe9ff', marks: 7, inCrates: true },
  special: { name: 'Special', colour: '#35c2c9', marks: 0, inCrates: false },
};

// --- what an item applies to -------------------------------------------------------------------------------------------

/** A group of unit kinds an item may name instead of listing them. */
export type UnitGroup = 'infantry' | 'tanks' | 'all';

export interface CosmeticTarget {
  /** 'own': the player's side. 'enemy': how the enemy looks to this player. */
  side: 'own' | 'enemy';
  /** The nations it is for, or 'all'. */
  nations: readonly FactionId[] | 'all';
  /** What it dresses: unit kinds (or a group of them), or the HQ. */
  units: readonly UnitKind[] | UnitGroup | 'hq';
}

// --- how an item is drawn ----------------------------------------------------------------------------------------------

/**
 * The pieces of a unit a change may name. A soldier: 'body' (head, torso, arms, legs, boots), 'helmet', 'kit' (pack,
 * pouches, straps) and 'weapon'. A vehicle: 'hull', 'turret', 'gun' and 'tracks'. The HQ: 'hq'.
 */
export type SkinPart = 'body' | 'helmet' | 'kit' | 'weapon' | 'hull' | 'turret' | 'gun' | 'tracks' | 'hq';

/** Where a picture or a glow is pinned. A soldier: 'head', 'body', 'weapon'. A vehicle: 'hull', 'turret'. The HQ: 'hq'. */
export type SkinPin = 'head' | 'body' | 'weapon' | 'hull' | 'turret' | 'hq';

/** A second colour dabbed over a repainted part. `size` in world units, `cover` the share of the part it covers (0..1). */
export interface SkinPattern {
  kind: 'blotches' | 'spots' | 'stripes';
  colour: string;
  size: number;
  cover: number;
}

/** A coat of paint over the game's own art. */
export interface SkinRecolour {
  /** The parts painted; absent = every part of the unit. */
  parts?: readonly SkinPart[];
  /** '#rrggbb'. */
  colour: string;
  /** 1 = the part becomes this flat colour; less lets its own shading show through. */
  strength: number;
  pattern?: SkinPattern;
}

/** A sway about the pin, in degrees either way, `perSecond` swings a second; it swings wider while the unit moves. */
export interface SkinSwing {
  degrees: number;
  perSecond: number;
}

/** A picture of the owner's, pinned to a part of the unit and moving with it. */
export interface SkinImage {
  /** The file's name in src/cosmetics/art (an .svg or a .png). */
  file: string;
  pin: SkinPin;
  /** Its size in world units (a soldier is 58 tall, his head 10 across). */
  w: number;
  h: number;
  /** The point of the picture that sits on the pin, as fractions of its width and height (0.5, 1 = bottom centre). */
  ax: number;
  ay: number;
  /** A shift from the pin in world units (x toward the way the unit faces, y down). */
  x?: number;
  y?: number;
  /** True: the game's own part at that pin is not drawn (a hat in place of the helmet). False or absent: drawn over it. */
  replaces?: boolean;
  swing?: SkinSwing;
}

/** A soft light at a pin. `pulse` = swells a second (0 = steady). */
export interface SkinGlow {
  pin: SkinPin;
  colour: string;
  /** Across, in world units. */
  size: number;
  /** 0..1 at its brightest. */
  alpha: number;
  pulse: number;
  x?: number;
  y?: number;
}

/** Everything an item changes. Every field is optional; an empty look changes nothing. */
export interface SkinLook {
  recolours?: readonly SkinRecolour[];
  /** Headgear, clothing or a weapon the game already draws, worn in place of the usual (only where the nation has that art). */
  headgear?: FigureHeadgear;
  clothing?: FigureClothing;
  weapon?: WeaponModel;
  /** Parts of the game's own art left undrawn. */
  hide?: readonly SkinPart[];
  images?: readonly SkinImage[];
  glows?: readonly SkinGlow[];
}

export interface CosmeticItem {
  /** Letters, digits and dashes; never changed once players may own it (the save holds it). */
  id: string;
  name: string;
  rarity: Rarity;
  /** One line under the name. */
  blurb: string;
  target: CosmeticTarget;
  look: SkinLook;
  /** A stand-in for testing, not a design of the owner's. */
  placeholder?: boolean;
}

export interface CosmeticsData {
  /**
   * THE switch. False: no crate section, no Appearance tab, no free crates, no word about any of it, and nothing worn
   * is drawn: the game looks and plays as it did before the feature existed. Tests and the admin panel switch it on for
   * their own session.
   */
  enabled: boolean;
  /** Most items a save's lists keep (ids it does not know included: another build may know them). */
  maxOwned: number;
  /** An item id as a save may hold it. */
  idPattern: RegExp;
  /** The most overlay pictures and glows one unit draws (the rest of a look's are ignored). */
  maxOverlays: number;
  /** Words of the Appearance tab and the item cards. */
  text: {
    tab: string;
    shopTab: string;
    heading: string;
    empty: string;
    wear: string;
    takeOff: string;
    worn: string;
    own: string;
    enemy: string;
    hq: string;
    placeholder: string;
    groups: Record<UnitGroup, string>;
    allNations: string;
  };
  items: readonly CosmeticItem[];
}

const PLACEHOLDER_BLURB = 'A placeholder for testing. Not a real design.';

/** Stand-ins, two per crate tier and one Special: enough to try sets, duplicates and the Appearance tab. */
const PLACEHOLDERS: readonly CosmeticItem[] = [
  {
    id: 'placeholder-common-1',
    name: 'Placeholder C1: khaki rifles',
    rarity: 'common',
    blurb: PLACEHOLDER_BLURB,
    placeholder: true,
    target: { side: 'own', nations: 'all', units: ['rifle', 'conscript'] },
    look: { recolours: [{ parts: ['body', 'helmet'], colour: '#b9ad7c', strength: 0.85 }] },
  },
  {
    id: 'placeholder-common-2',
    name: 'Placeholder C2: orange kit',
    rarity: 'common',
    blurb: PLACEHOLDER_BLURB,
    placeholder: true,
    target: { side: 'own', nations: 'all', units: 'infantry' },
    look: { recolours: [{ parts: ['kit', 'helmet'], colour: '#e07a1f', strength: 0.9 }] },
  },
  {
    id: 'placeholder-uncommon-1',
    name: 'Placeholder U1: spotted tanks',
    rarity: 'uncommon',
    blurb: PLACEHOLDER_BLURB,
    placeholder: true,
    target: { side: 'own', nations: 'all', units: 'tanks' },
    look: { recolours: [{ parts: ['hull', 'turret', 'gun'], colour: '#39506e', strength: 0.8, pattern: { kind: 'spots', colour: '#f1d24a', size: 2.2, cover: 0.12 } }] },
  },
  {
    id: 'placeholder-uncommon-2',
    name: 'Placeholder U2: striped enemy',
    rarity: 'uncommon',
    blurb: PLACEHOLDER_BLURB,
    placeholder: true,
    target: { side: 'enemy', nations: ['german'], units: 'infantry' },
    look: { recolours: [{ parts: ['body'], colour: '#6d5a7a', strength: 0.8, pattern: { kind: 'stripes', colour: '#d8cfe6', size: 2.4, cover: 0.3 } }] },
  },
  {
    id: 'placeholder-rare-1',
    name: 'Placeholder R1: test cap',
    rarity: 'rare',
    blurb: PLACEHOLDER_BLURB,
    placeholder: true,
    target: { side: 'own', nations: 'all', units: ['rifle', 'assault', 'lmg'] },
    look: { images: [{ file: 'placeholder-cap.svg', pin: 'head', w: 16, h: 11, ax: 0.5, ay: 0.82, replaces: true }] },
  },
  {
    id: 'placeholder-rare-2',
    name: 'Placeholder R2: blotched enemy tanks',
    rarity: 'rare',
    blurb: PLACEHOLDER_BLURB,
    placeholder: true,
    target: { side: 'enemy', nations: ['german'], units: 'tanks' },
    look: { recolours: [{ parts: ['hull', 'turret'], colour: '#7b6a4a', strength: 0.75, pattern: { kind: 'blotches', colour: '#3e5a35', size: 7, cover: 0.4 } }] },
  },
  {
    id: 'placeholder-epic-1',
    name: 'Placeholder E1: striped HQ',
    rarity: 'epic',
    blurb: PLACEHOLDER_BLURB,
    placeholder: true,
    target: { side: 'own', nations: 'all', units: 'hq' },
    look: { recolours: [{ parts: ['hq'], colour: '#8a7f6a', strength: 0.5, pattern: { kind: 'stripes', colour: '#c9b98a', size: 6, cover: 0.25 } }] },
  },
  {
    id: 'placeholder-epic-2',
    name: 'Placeholder E2: tagged machine gun',
    rarity: 'epic',
    blurb: PLACEHOLDER_BLURB,
    placeholder: true,
    target: { side: 'own', nations: 'all', units: ['lmg'] },
    look: {
      recolours: [{ parts: ['weapon'], colour: '#7a8894', strength: 0.7 }],
      images: [{ file: 'placeholder-tag.svg', pin: 'weapon', w: 7, h: 9, ax: 0.5, ay: 0.08, x: 6, y: 1, swing: { degrees: 22, perSecond: 0.9 } }],
    },
  },
  {
    id: 'placeholder-legendary-1',
    name: 'Placeholder L1: glowing army',
    rarity: 'legendary',
    blurb: PLACEHOLDER_BLURB,
    placeholder: true,
    target: { side: 'own', nations: 'all', units: 'all' },
    look: {
      recolours: [{ colour: '#2b3a4a', strength: 0.6 }],
      glows: [
        { pin: 'head', colour: '#7fd8ff', size: 16, alpha: 0.5, pulse: 0.6 },
        { pin: 'turret', colour: '#7fd8ff', size: 26, alpha: 0.45, pulse: 0.6 },
      ],
    },
  },
  {
    id: 'placeholder-legendary-2',
    name: 'Placeholder L2: flagged enemy heavy tank',
    rarity: 'legendary',
    blurb: PLACEHOLDER_BLURB,
    placeholder: true,
    target: { side: 'enemy', nations: ['german'], units: ['heavyTank'] },
    look: {
      recolours: [{ parts: ['hull', 'turret', 'gun'], colour: '#5b5f66', strength: 0.7 }],
      images: [{ file: 'placeholder-tag.svg', pin: 'turret', w: 10, h: 13, ax: 0.5, ay: 1, y: -8, swing: { degrees: 8, perSecond: 0.7 } }],
    },
  },
  {
    id: 'placeholder-mythic-1',
    name: 'Placeholder M1: signed HQ',
    rarity: 'mythic',
    blurb: PLACEHOLDER_BLURB,
    placeholder: true,
    target: { side: 'own', nations: 'all', units: 'hq' },
    look: {
      images: [{ file: 'placeholder-sign.svg', pin: 'hq', w: 44, h: 26, ax: 0.5, ay: 1, y: -70 }],
      glows: [{ pin: 'hq', colour: '#ff6a4a', size: 70, alpha: 0.35, pulse: 0.4, y: -84 }],
    },
  },
  {
    id: 'placeholder-mythic-2',
    name: 'Placeholder M2: snow sniper',
    rarity: 'mythic',
    blurb: PLACEHOLDER_BLURB,
    placeholder: true,
    target: { side: 'own', nations: ['soviet'], units: ['sniper'] },
    look: { headgear: 'snowHood', clothing: 'snowSmock', recolours: [{ parts: ['weapon'], colour: '#e8e8e0', strength: 0.8 }] },
  },
  {
    id: 'placeholder-special-1',
    name: 'Placeholder S1: marked commander',
    rarity: 'special',
    blurb: 'A placeholder for testing. Never in a crate.',
    placeholder: true,
    target: { side: 'own', nations: 'all', units: ['commander'] },
    look: { recolours: [{ parts: ['helmet', 'kit'], colour: '#d6a531', strength: 0.9 }] },
  },
];

export const COSMETICS: CosmeticsData = {
  enabled: false,
  maxOwned: 2000,
  idPattern: /^[a-z0-9][a-z0-9-]{0,47}$/,
  maxOverlays: 3,
  text: {
    tab: 'Appearance',
    shopTab: 'Shop',
    heading: 'APPEARANCE',
    empty: 'Nothing to wear yet. Supply crates hold things to wear.',
    wear: 'Wear',
    takeOff: 'Take off',
    worn: 'Worn',
    own: 'Your forces',
    enemy: 'How the enemy looks to you',
    hq: 'Your headquarters',
    placeholder: 'Placeholder',
    groups: { infantry: 'all infantry', tanks: 'all tanks', all: 'every unit' },
    allNations: 'every nation',
  },
  items: PLACEHOLDERS,
};

/** The unit kinds each group stands for (the platform's extra unit is in none: it has art of its own). */
export const UNIT_GROUPS: Readonly<Record<UnitGroup, readonly UnitKind[]>> = {
  infantry: ['sapper', 'rifle', 'lmg', 'assault', 'mortar', 'sniper', 'medic', 'at', 'flame', 'commander', 'aa', 'conscript'],
  tanks: ['tank', 'heavyTank', 'lightTank'],
  all: ['sapper', 'rifle', 'lmg', 'assault', 'mortar', 'sniper', 'medic', 'at', 'flame', 'commander', 'aa', 'conscript', 'tank', 'heavyTank', 'lightTank', 'apc'],
};
