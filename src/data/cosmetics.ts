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
  /** A stand-in for testing, not a design of the owner's. Never finished, so never in a crate. */
  placeholder?: boolean;
  /**
   * True once the item is built, looked at in a battle at phone size and ready to sell. Crates hold only finished
   * items (src/meta/cosmetics.ts crateItems), and a crate none of whose rarities has one is not shown in the Shop.
   */
  finished?: boolean;
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

/**
 * The owner's designs (docs/COSMETICS.md), as built. Each blurb says what the player sees and nothing more; the note
 * under each design in docs/COSMETICS.md says what was built and what of the design was left out.
 */
const ITEMS: readonly CosmeticItem[] = [
  // --- Common ---
  {
    id: 'frostbite-british',
    finished: true,
    name: 'Frostbite (British)',
    rarity: 'common',
    blurb: 'White winter uniforms and helmets with green camouflage blotches.',
    target: { side: 'own', nations: ['british'], units: ['rifle'] },
    look: { recolours: [{ parts: ['body', 'helmet'], colour: '#eef0ea', strength: 0.82, pattern: { kind: 'blotches', colour: '#4d7a3c', size: 4.5, cover: 0.22 } }] },
  },
  {
    id: 'frostbite-soviet',
    finished: true,
    name: 'Frostbite (Soviet)',
    rarity: 'common',
    blurb: 'White winter uniforms and helmets with green camouflage blotches.',
    target: { side: 'own', nations: ['soviet'], units: ['rifle'] },
    look: { recolours: [{ parts: ['body', 'helmet'], colour: '#eef0ea', strength: 0.82, pattern: { kind: 'blotches', colour: '#4d7a3c', size: 4.5, cover: 0.22 } }] },
  },
  // --- Uncommon ---
  {
    id: 'constellation',
    finished: true,
    name: 'Constellation',
    rarity: 'uncommon',
    blurb: 'Night-sky blue paint with yellow stars scattered over it, like a star map. The red star stays on the turret.',
    target: { side: 'own', nations: ['soviet'], units: 'tanks' },
    look: {
      recolours: [{ parts: ['hull', 'turret', 'gun'], colour: '#1d2d5c', strength: 0.78, pattern: { kind: 'spots', colour: '#ffe04a', size: 2.6, cover: 0.035 } }],
      images: [{ file: 'constellation-star.svg', pin: 'turret', w: 9, h: 9, ax: 0.5, ay: 0.5 }],
    },
  },
  {
    id: 'loyalist',
    finished: true,
    name: 'Loyalist',
    rarity: 'uncommon',
    blurb: 'A red peaked cap with a gold star badge in place of the helmet.',
    target: { side: 'own', nations: ['soviet'], units: ['sapper'] },
    look: { images: [{ file: 'loyalist-cap.svg', pin: 'head', w: 17, h: 12, ax: 0.5, ay: 0.8, replaces: true }] },
  },
  // --- Rare ---
  {
    id: 'secret-agent',
    finished: true,
    name: 'Secret Agent',
    rarity: 'rare',
    blurb: 'A charcoal fedora in place of the helmet and a long charcoal coat whose tail sways as he runs.',
    target: { side: 'own', nations: ['british'], units: ['assault'] },
    look: {
      recolours: [{ parts: ['body', 'kit'], colour: '#4a4a54', strength: 0.75 }],
      images: [
        { file: 'secret-agent-fedora.svg', pin: 'head', w: 20, h: 12, ax: 0.5, ay: 0.78, replaces: true },
        { file: 'secret-agent-coat.svg', pin: 'body', w: 10, h: 19, ax: 0.6, ay: 0.03, x: -3, y: 4, swing: { degrees: 5, perSecond: 0.8 } },
      ],
    },
  },
  {
    id: 'hoodlum',
    finished: true,
    name: 'Hoodlum',
    rarity: 'rare',
    blurb: 'Enemy machine-pistol troopers in black ski masks and dark hoodies, with a chunky gold chain that swings as they move.',
    target: { side: 'enemy', nations: ['german'], units: ['assault'] },
    look: {
      recolours: [{ parts: ['body', 'kit'], colour: '#2e2e34', strength: 0.7 }],
      images: [
        { file: 'hoodlum-mask.svg', pin: 'head', w: 12, h: 13, ax: 0.5, ay: 0.6, replaces: true },
        { file: 'hoodlum-chain.svg', pin: 'body', w: 10, h: 8.5, ax: 0.5, ay: 0.05, x: 1, y: -6, swing: { degrees: 12, perSecond: 1 } },
      ],
    },
  },
  // --- Epic ---
  {
    id: 'night-ops',
    finished: true,
    name: 'Night Ops',
    rarity: 'epic',
    blurb: 'A black tactical helmet with quad night-vision goggles flipped up, their green lenses softly glowing.',
    target: { side: 'own', nations: ['british'], units: 'infantry' },
    look: {
      images: [{ file: 'night-ops-helmet.svg', pin: 'head', w: 19, h: 15, ax: 0.47, ay: 0.78, replaces: true }],
      glows: [{ pin: 'head', colour: '#5dff6a', size: 9, alpha: 0.5, pulse: 0.3, x: 7, y: -10 }],
    },
  },
  {
    id: 'frost-ghoul',
    finished: true,
    name: 'Frost Ghoul',
    rarity: 'epic',
    blurb: 'An all-white snow suit and hood, a white face mask and mittens, dark tactical goggles and a white-wrapped rifle.',
    target: { side: 'own', nations: ['soviet'], units: ['sniper'] },
    look: {
      headgear: 'snowHood',
      clothing: 'snowSmock',
      recolours: [
        { parts: ['body'], colour: '#f2f2ec', strength: 0.85 },
        { parts: ['weapon'], colour: '#e8e6dc', strength: 0.7, pattern: { kind: 'stripes', colour: '#b9b6aa', size: 1.2, cover: 0.3 } },
      ],
      images: [{ file: 'frost-ghoul-goggles.svg', pin: 'head', w: 9, h: 4.5, ax: 0.5, ay: 0.5, x: 1.5, y: -0.5 }],
    },
  },
  // --- Legendary ---
  {
    id: 'heavens-gate',
    finished: true,
    name: "Heaven's Gate",
    rarity: 'legendary',
    blurb: 'Your HQ becomes tall golden gates in an arched frame, filled with warm light, on a bank of white clouds.',
    target: { side: 'own', nations: 'all', units: 'hq' },
    look: {
      images: [{ file: 'heavens-gate.svg', pin: 'hq', w: 110, h: 110, ax: 0.5, ay: 0.97, replaces: true }],
      glows: [{ pin: 'hq', colour: '#fff1b0', size: 90, alpha: 0.4, pulse: 0.25, y: -55 }],
    },
  },
  {
    id: 'furnace-walker',
    finished: true,
    name: 'Furnace Walker',
    rarity: 'legendary',
    blurb: 'Enemy flamethrowers as soot-black iron soldiers with bronze rivets and a round furnace-hatch head whose grille glows orange.',
    target: { side: 'enemy', nations: ['german'], units: ['flame'] },
    look: {
      recolours: [{ parts: ['body', 'kit'], colour: '#34343a', strength: 0.8, pattern: { kind: 'spots', colour: '#a7834a', size: 1.1, cover: 0.08 } }],
      images: [{ file: 'furnace-walker-head.svg', pin: 'head', w: 13, h: 12, ax: 0.5, ay: 0.62, replaces: true }],
      glows: [{ pin: 'head', colour: '#ff8a1e', size: 10, alpha: 0.5, pulse: 0.5, x: 2 }],
    },
  },
  // --- Mythic ---
  {
    id: 'zeus',
    finished: true,
    name: 'Zeus',
    rarity: 'mythic',
    blurb: 'The mortar crew in white robes, gold laurel wreaths and long white beards, in a faint golden glow.',
    target: { side: 'own', nations: 'all', units: ['mortar'] },
    look: {
      recolours: [{ parts: ['body'], colour: '#e6dfc8', strength: 0.8 }],
      images: [
        { file: 'zeus-wreath.svg', pin: 'head', w: 15, h: 7.5, ax: 0.5, ay: 0.75, y: -3, replaces: true },
        { file: 'zeus-beard.svg', pin: 'head', w: 10, h: 16, ax: 0.35, ay: 0.02, x: 3, y: 1.5 },
      ],
      glows: [{ pin: 'body', colour: '#ffd86a', size: 34, alpha: 0.3, pulse: 0.35 }],
    },
  },
  {
    id: 'legacy',
    finished: true,
    name: 'Legacy',
    rarity: 'mythic',
    blurb: 'Your HQ becomes a weathered stone statue of a soldier in a tin hat, pointing at the enemy, on a stepped pedestal with a doorway. Its eyes glow gold.',
    target: { side: 'own', nations: 'all', units: 'hq' },
    look: {
      images: [{ file: 'legacy-statue.svg', pin: 'hq', w: 120, h: 180, ax: 0.4, ay: 0.99, replaces: true }],
      glows: [{ pin: 'hq', colour: '#ffd23a', size: 8, alpha: 0.6, pulse: 0.3, x: 18.6, y: -154 }],
    },
  },
  // --- more, in the order they were built ---
  {
    id: 'royal',
    finished: true,
    name: 'Royal',
    rarity: 'common',
    blurb: 'A polished silver dress helmet with gold trim, a gold star plate, a top spike and a cream plume that sways as he moves.',
    target: { side: 'own', nations: ['british'], units: ['commander'] },
    look: {
      images: [
        { file: 'royal-helmet.svg', pin: 'head', w: 18, h: 15, ax: 0.5, ay: 0.8, replaces: true },
        { file: 'royal-plume.svg', pin: 'head', w: 9, h: 14, ax: 0.78, ay: 0.04, x: 0, y: -14, swing: { degrees: 6, perSecond: 0.7 } },
      ],
    },
  },
  {
    id: 'old-times',
    finished: true,
    name: 'Old Times',
    rarity: 'uncommon',
    blurb: 'Enemy German soldiers in plain black spiked helmets with grey-steel fittings and field-grey uniforms.',
    target: { side: 'enemy', nations: ['german'], units: 'infantry' },
    look: {
      recolours: [{ parts: ['body'], colour: '#6f7468', strength: 0.55 }],
      images: [{ file: 'old-times-helmet.svg', pin: 'head', w: 17, h: 15, ax: 0.5, ay: 0.8, replaces: true }],
    },
  },
  {
    id: 'bioblaster',
    finished: true,
    name: 'Bioblaster',
    rarity: 'epic',
    blurb: 'A black canister on his back with a window of glowing green liquid and a green-lit hose. The flame stays the game\'s own.',
    target: { side: 'own', nations: ['soviet'], units: ['flame'] },
    look: {
      images: [{ file: 'bioblaster-tank.svg', pin: 'body', w: 7, h: 11, ax: 0.5, ay: 0.5, x: -4.5, y: 0 }],
      glows: [{ pin: 'body', colour: '#7dff3a', size: 9, alpha: 0.45, pulse: 0.5, x: -4.5, y: 1 }],
    },
  },
  {
    id: 'spetsnaz',
    finished: true,
    name: 'Spetsnaz',
    rarity: 'epic',
    blurb: 'A heavy olive armoured helmet with a flat visor, one narrow eye slit and a white stencilled mark, and olive webbing.',
    target: { side: 'own', nations: ['soviet'], units: ['lmg'] },
    look: {
      recolours: [{ parts: ['kit'], colour: '#55603a', strength: 0.8 }, { parts: ['body'], colour: '#3e4530', strength: 0.5 }],
      images: [{ file: 'spetsnaz-helmet.svg', pin: 'head', w: 19, h: 18, ax: 0.5, ay: 0.7, replaces: true }],
    },
  },
  {
    id: 'evolved',
    finished: true,
    name: 'Evolved',
    rarity: 'epic',
    blurb: 'Red berets and a modern green-and-tan camouflage uniform.',
    target: { side: 'own', nations: ['soviet'], units: ['rifle'] },
    look: {
      recolours: [
        { parts: ['body'], colour: '#8c8a5a', strength: 0.75, pattern: { kind: 'blotches', colour: '#4f6a36', size: 2.2, cover: 0.35 } },
        { parts: ['kit'], colour: '#3a3f2c', strength: 0.7 },
      ],
      images: [{ file: 'evolved-beret.svg', pin: 'head', w: 15, h: 8.5, ax: 0.5, ay: 0.85, y: -1, replaces: true }],
    },
  },
];

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
  items: [...ITEMS, ...PLACEHOLDERS],
};

/** The unit kinds each group stands for (the platform's extra unit is in none: it has art of its own). */
export const UNIT_GROUPS: Readonly<Record<UnitGroup, readonly UnitKind[]>> = {
  infantry: ['sapper', 'rifle', 'lmg', 'assault', 'mortar', 'sniper', 'medic', 'at', 'flame', 'commander', 'aa', 'conscript'],
  tanks: ['tank', 'heavyTank', 'lightTank'],
  all: ['sapper', 'rifle', 'lmg', 'assault', 'mortar', 'sniper', 'medic', 'at', 'flame', 'commander', 'aa', 'conscript', 'tank', 'heavyTank', 'lightTank', 'apc'],
};
