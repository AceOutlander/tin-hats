/**
 * Ground types (docs/campaigns/FOUNDATIONS.md 4.2): how fast infantry and vehicles cross each kind of ground, the
 * cover it gives infantry in the open, and how it is drawn. A mission lays its ground out in sectors
 * (MissionDef.sectors); a mission with none plays on even ground exactly as before (every multiplier 1).
 *
 * Speeds multiply a unit's own speed. Slopes have a speed each way: `slopeUp` rises toward the right-hand (+x) end of
 * the field, `slopeDown` falls toward it, so on `slopeUp` a unit moving right climbs (`infantry`, `vehicle`) and one
 * moving left descends (`infantryDown`, `vehicleDown`). All numbers are starting points for the balance tests.
 *
 * The sim reads this through per-cell tables built once per battle (src/sim/world.ts, buildGroundField): one entry
 * per GROUND_CELL wu, so nothing is searched in the hot loop.
 */
import type { GroundId } from './schema';
import type { GroundStyle } from './theatres';

export interface GroundDef {
  id: GroundId;
  /** Minimap and briefing name. */
  label: string;
  /** Speed multipliers on the flat, or climbing for a slope. */
  infantry: number;
  vehicle: number;
  /** Going the other way (downhill on a slope); the same as above for flat ground. */
  infantryDown: number;
  vehicleDown: number;
  /** Multiplier on bullet damage to infantry in the open standing here (trunks, broken walls): 1 = no cover. */
  bulletCover: number;
  /** How it is drawn (src/art/backdrops/ground.ts); 'theatre' = the theatre's own ground. */
  art: GroundStyle | 'theatre';
  /** Drawn instead in a winter mission (MissionDef.climate 'winter'): steppe and fields under snow. */
  winterArt?: GroundStyle;
  /** Vehicles cannot drive onto it (a river): they stop at its edge unless a bridge spans it (FOUNDATIONS.md 4.4). */
  vehicleBarrier?: boolean;
}

/** Width of one cell of the sim's ground tables in wu. */
export const GROUND_CELL = 50;

/** Ski troops (ForceDef.tags 'skis') cross this ground at this multiplier instead (FOUNDATIONS.md 4.2: they ignore it). */
export const SKI_GROUND: Partial<Record<GroundId, number>> = { deepSnow: 1 };

function flat(id: GroundId, label: string, infantry: number, vehicle: number, art: GroundStyle | 'theatre', bulletCover = 1, winterArt?: GroundStyle): GroundDef {
  return { id, label, infantry, vehicle, infantryDown: infantry, vehicleDown: vehicle, bulletCover, art, winterArt };
}

export const GROUND: Record<GroundId, GroundDef> = {
  grass: flat('grass', 'Grass', 1, 1, 'grass', 1, 'snow'),
  field: flat('field', 'Fields', 1, 1, 'theatre', 1, 'snow'),
  steppe: flat('steppe', 'Steppe', 1, 1, 'steppe', 1, 'snow'),
  road: flat('road', 'Road', 1, 1.1, 'dry', 1, 'snow'),
  cobble: flat('cobble', 'Cobbles', 1, 1.1, 'cobble'),
  forest: flat('forest', 'Forest', 0.9, 0.75, 'forest', 0.85),
  mud: flat('mud', 'Mud', 0.8, 0.6, 'mud'),
  sand: flat('sand', 'Sand', 0.9, 0.85, 'sand'),
  rock: flat('rock', 'Rock', 0.9, 0.8, 'dry', 1, 'snow'),
  snow: flat('snow', 'Snow', 0.85, 0.9, 'snow'),
  deepSnow: flat('deepSnow', 'Deep snow', 0.65, 0.75, 'deepSnow'),
  rubble: flat('rubble', 'Rubble', 0.7, 0.55, 'rubble', 0.85),
  slopeUp: { id: 'slopeUp', label: 'Slope', infantry: 0.85, vehicle: 0.8, infantryDown: 1.1, vehicleDown: 1, bulletCover: 1, art: 'theatre', winterArt: 'snow' },
  slopeDown: { id: 'slopeDown', label: 'Slope', infantry: 1.1, vehicle: 1, infantryDown: 0.85, vehicleDown: 0.8, bulletCover: 1, art: 'theatre', winterArt: 'snow' },
  // Wading or paddling (the ford); vehicles stop at the bank, and cross only on a bridge (FOUNDATIONS.md 4.4).
  water: { ...flat('water', 'River', 0.35, 0.35, 'water'), vehicleBarrier: true },
};

export const GROUND_IDS = Object.keys(GROUND) as GroundId[];

/** The art style a ground is drawn in for a theatre's own style and the mission's climate. */
export function groundArt(id: GroundId, theatreStyle: GroundStyle, winter: boolean): GroundStyle {
  const def = GROUND[id];
  if (winter && def.winterArt) return def.winterArt;
  return def.art === 'theatre' ? theatreStyle : def.art;
}

/**
 * Ground colours of the styles that bring their own (snow is white whatever the theatre): they replace the theatre
 * palette's ground slots when that style is painted. Day colours; the art grades them for the time of day.
 */
export interface GroundPalette {
  ground: string;
  groundLight: string;
  groundDark: string;
  track: string;
  tuft: string;
  pebble: string;
  soil: string;
  soilDark: string;
}

export const GROUND_PALETTES: Partial<Record<GroundStyle, GroundPalette>> = {
  snow: {
    ground: '#d9dee0',
    groundLight: '#eef1f2',
    groundDark: '#a9b3b9',
    track: '#c4c6c0',
    tuft: '#8a8a6e',
    pebble: '#8f9294',
    soil: '#6d6559',
    soilDark: '#4d473f',
  },
  deepSnow: {
    ground: '#e3e8ea',
    groundLight: '#f6f8f9',
    groundDark: '#b2bec6',
    track: '#cfd4d4',
    tuft: '#9a9a80',
    pebble: '#9ca0a3',
    soil: '#6d6559',
    soilDark: '#4d473f',
  },
  rubble: {
    ground: '#8d8478',
    groundLight: '#a9a093',
    groundDark: '#5f574e',
    track: '#9a9184',
    tuft: '#6f6f50',
    pebble: '#a4846c',
    soil: '#5c5146',
    soilDark: '#3e362f',
  },
  // A river (FOUNDATIONS.md 4.4): grey-green water under a dull sky, mid-toned so the waders still read black on it.
  water: {
    ground: '#7d8c8a',
    groundLight: '#9fadaa',
    groundDark: '#55625f',
    track: '#8e9c99',
    tuft: '#5d6a52',
    pebble: '#b8c4c1',
    soil: '#4a5552',
    soilDark: '#333c3a',
  },
  steppe: {
    ground: '#a99c6c',
    groundLight: '#c2b583',
    groundDark: '#7e744f',
    track: '#b9ab7e',
    tuft: '#8c8450',
    pebble: '#958a73',
    soil: '#6e5e43',
    soilDark: '#4c4130',
  },
};

/** Minimap shading of each style (src/ui/hud/minimap.ts): dark, low-contrast tones that keep the unit dots readable. */
export const GROUND_MINIMAP: Record<GroundStyle, string> = {
  grass: '#33402a',
  sand: '#5a4f33',
  dry: '#4c4430',
  mud: '#3d3324',
  beach: '#5c533a',
  cobble: '#3f3c36',
  forest: '#28331f',
  snow: '#6f767a',
  deepSnow: '#7d8589',
  rubble: '#4a4439',
  steppe: '#57502f',
  water: '#2f4248',
};

/** Capture points, forward spawns and rally Fall Back (FOUNDATIONS.md 4.5). */
export const POINT_RULES = {
  /** Under Fall Back, units this close to their HQ door (wu) go into the HQ rather than to a rally point. */
  rallyHqReach: 2500,
  /** Trained units deploying at a point walk out this far behind its zone's rear edge (wu). */
  deployBehind: 0,
};

/**
 * How a capture point is drawn (src/render/points.ts), in wu from the ground line: a tall flagpole at its centre with
 * the holder's colours, two short marker posts at the zone's edges, and a thin bar over the pole while a side takes it.
 */
export const POINT_ART = {
  poleH: 64,
  poleW: 2.2,
  poleColor: 0x3d3326,
  flagW: 20,
  flagH: 12,
  /** The cloth of a point nobody holds. */
  neutralFlag: 0x8a8576,
  /** Edge posts: height, width, colour. */
  postH: 12,
  postW: 2,
  postColor: 0x54483a,
  /** Behind the near rows: the pole stands this far back of the ground line. */
  backY: -6,
  barW: 34,
  barH: 3,
  barGap: 6,
  barBack: 0x1d1c16,
  /** Seconds the new holder's flag takes to run up the pole. */
  hoist: 0.8,
} as const;
