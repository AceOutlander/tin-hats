/**
 * Theatre palettes, time-of-day grades and backdrop layer tunables.
 *
 * Pure data: the drawing code that turns this into parallax strips lives in
 * src/art/backdrops. Colours are the DAY colours of each surface as seen up
 * close; the art code grades them for the time of day and mixes them toward
 * the haze colour by each layer's `haze` amount (atmospheric perspective).
 *
 * All y values are view-space wu (0 = top of the 540 wu view).
 */
import type { Climate, TheatreId, TimeOfDay } from './schema';

export interface SkyRamp {
  top: string;
  mid: string;
  horizon: string;
}

/** One uniform set of colour slots so every theatre can be graded the same way. */
export interface TheatrePalette {
  sky: SkyRamp;
  /** What distant things fade toward: lighter and bluer than the land. */
  haze: string;
  /** Terrain masses of the far, mid and near strips (main and alternate tone). */
  far: string;
  farAlt: string;
  mid: string;
  midAlt: string;
  near: string;
  nearAlt: string;
  /** Main vegetation (lit, shaded) and a second species (poplar, cypress, pine...). */
  foliage: string;
  foliageShade: string;
  foliageAlt: string;
  foliageAltShade: string;
  trunk: string;
  /** Buildings. */
  wall: string;
  wallShade: string;
  wallAlt: string;
  roof: string;
  roofShade: string;
  roofAlt: string;
  trim: string;
  opening: string;
  /** Rock, concrete and masonry; steel and wrecks; water; a pale accent (snow, foam, frost). */
  stone: string;
  stoneShade: string;
  metal: string;
  metalShade: string;
  water: string;
  waterLight: string;
  pale: string;
  /** Ground plane. `ground` is the colour under the units; `soil`, `soilDark` and `dust` are for trench cut-outs and kicked-up dust. */
  ground: string;
  groundLight: string;
  groundDark: string;
  track: string;
  soil: string;
  soilDark: string;
  dust: string;
  tuft: string;
  pebble: string;
  /** Foreground silhouettes close to the camera: dark, never pure black (the figures own black). */
  fg: string;
  fgAlt: string;
}

/** How a ground is drawn. snow, deepSnow, rubble and steppe bring their own colours (GROUND_PALETTES in src/data/ground.ts). */
export type GroundStyle = 'grass' | 'sand' | 'dry' | 'mud' | 'beach' | 'cobble' | 'forest' | 'snow' | 'deepSnow' | 'rubble' | 'steppe';

export type ForegroundItem =
  | 'tuft'
  | 'stone'
  | 'post'
  | 'scrub'
  | 'reed'
  | 'rubble'
  | 'stump'
  | 'fern'
  | 'bollard'
  | 'flower';

export interface BackdropStripDef {
  /** y of the strip's top edge. Every backdrop strip ends at BACKDROP.stripBottom. */
  top: number;
  /** 0..1 mix toward the haze colour. */
  haze: number;
  /** Ground mist painted over the bottom of the strip: peak alpha and height in wu. */
  mist: number;
  mistHeight: number;
}

export interface RainGrade {
  /** 0..1: multiply the scene toward black by this much while it rains. */
  darken: number;
  /** 0..1: pull colours toward grey by this much while it rains. */
  desaturate: number;
}

export interface TheatreDef {
  id: TheatreId;
  palette: TheatrePalette;
  layers: { far: BackdropStripDef; mid: BackdropStripDef; near: BackdropStripDef };
  /** 0..1 share of the sky holding cloud on a normal day. */
  cloudCover: number;
  groundStyle: GroundStyle;
  /** Items in the foreground strip, per tile. */
  foreground: { item: ForegroundItem; count: number }[];
  rain: RainGrade;
  /** Colour of the renderer's night overlay (DEPTH.nightTint). The alpha per time of day is TIME_GRADES[time].tintAlpha. */
  nightTint: string;
  /**
   * The winter variant (FOUNDATIONS.md 4.7), for a mission whose climate is winter: these palette colours replace the
   * theatre's, and its painters lay snow on roofs, trees and ridges. Absent = the theatre has no winter look.
   */
  winter?: {
    palette: Partial<TheatrePalette>;
    cloudCover?: number;
    groundStyle?: GroundStyle;
    foreground?: { item: ForegroundItem; count: number }[];
  };
}

/** Which look of a theatre a backdrop is painted in: its own (summer, or the city's autumn) or its winter variant. */
export type TheatreVariant = 'base' | 'winter';

/** The variant a mission of this climate sees: winter if it is a winter mission and the theatre has one. */
export function theatreVariant(theatre: TheatreId, climate: Climate | undefined): TheatreVariant {
  return climate === 'winter' && THEATRES[theatre].winter !== undefined ? 'winter' : 'base';
}

export interface CelestialDef {
  /** glow = no disc, only a bright patch behind the overcast. */
  kind: 'sun' | 'moon' | 'glow';
  /** View-space centre at camera x = 0. It then drifts left by camX * PARALLAX.celestial. */
  x: number;
  y: number;
  radius: number;
  color: string;
  glow: string;
  glowRadius: number;
  glowAlpha: number;
}

export interface TimeGradeDef {
  /** Sky ramp shared by all theatres at this time; null = the theatre's own day sky. */
  sky: SkyRamp | null;
  /** How much of the theatre's own (graded) sky survives under the shared ramp, 0..1. */
  skyKeep: number;
  /** Light colour: per-channel multipliers on every land colour. */
  mul: readonly [number, number, number];
  /** 0..1 pull toward grey before the multiply. */
  desaturate: number;
  /** Relative extra haze on every strip (0.2 = 20% more). */
  hazeBoost: number;
  /** How far the haze colour follows the sky near the horizon, 0..1. */
  hazeSky: number;
  /** Which side the light comes from: -1 = left, 1 = right. */
  light: -1 | 1;
  celestial: CelestialDef;
  /** Stars per sky tile. */
  stars: number;
  cloud: {
    light: string;
    shade: string;
    alpha: number;
    /** Cover = max(coverMin, theatre cover * coverMul). */
    coverMul: number;
    coverMin: number;
    /** Low sun: the bellies of the clouds catch the light instead of the tops. */
    underlit: boolean;
  };
  /** Suggested alpha for the renderer's night-tint overlay at this time of day. */
  tintAlpha: number;
}

/** Sizes, raster scales and shared tunables of the backdrop layers. */
export const BACKDROP = {
  /** Tile width per strip in wu. */
  tileW: {
    sky: 1024,
    clouds: 2048,
    farBackdrop: 2048,
    midBackdrop: 2048,
    nearBackdrop: 2048,
    ground: 2048,
    foreground: 2048,
  },
  /** Texture pixels per wu each layer should be rasterised at. Phones show about 1.5 px per wu. */
  rasterScale: {
    sky: 1,
    celestial: 1,
    clouds: 1,
    farBackdrop: 1,
    midBackdrop: 1.5,
    nearBackdrop: 1.5,
    ground: 2,
    foreground: 2,
  },
  /** Sky and backdrop strips run this far below the horizon so no gap can open above the ground strip. */
  stripBottom: 358,
  cloudsHeight: 270,
  /** Side of the square sun or moon sprite. */
  celestialSize: 320,
  /** Top of the ground strip; its uneven far edge sits between here and the horizon. */
  groundTop: 344,
  /** Height of the uneven far edge of the ground (wu either side of its mean). */
  groundEdgeAmp: 1.8,
  /** How far the worn band under the units is lightened toward `track`, 0..1. */
  trackAlpha: 0.3,
  /** Half-height of that band around VIEW.groundY. */
  trackHalfHeight: 34,
  /** Darkening of the ground at the very bottom of the view (it sits under the HUD). */
  groundFootShade: 0.22,
  foregroundTop: 428,
  /** No foreground item may rise above this y: the nearest row of feet is at about 425. */
  foregroundLimit: 436,
  /** Nearest and farthest base line of foreground items. */
  foregroundBaseMin: 458,
  foregroundBaseMax: 536,
} as const;

export const TIMES_OF_DAY: readonly TimeOfDay[] = ['dawn', 'day', 'overcast', 'dusk', 'night'];
export const THEATRE_IDS: readonly TheatreId[] = ['france', 'desert', 'sicily', 'italy', 'normandy', 'holland', 'germany', 'russiaSummer', 'stalingrad', 'steppe'];

export const TIME_GRADES: Record<TimeOfDay, TimeGradeDef> = {
  dawn: {
    sky: { top: '#7183a4', mid: '#c9b3b4', horizon: '#f3d4ab' },
    skyKeep: 0.22,
    mul: [0.96, 0.87, 0.86],
    desaturate: 0.2,
    hazeBoost: 0.18,
    hazeSky: 0.7,
    light: -1,
    celestial: {
      kind: 'sun',
      x: 250,
      y: 236,
      radius: 22,
      color: '#fff0cf',
      glow: '#ffd9a0',
      glowRadius: 160,
      glowAlpha: 0.55,
    },
    stars: 10,
    cloud: { light: '#f7dcc6', shade: '#a898aa', alpha: 0.85, coverMul: 0.9, coverMin: 0.15, underlit: true },
    tintAlpha: 0.04,
  },
  day: {
    sky: null,
    skyKeep: 1,
    mul: [1, 1, 1],
    desaturate: 0,
    hazeBoost: 0,
    hazeSky: 0.5,
    light: -1,
    celestial: {
      kind: 'sun',
      x: 330,
      y: 92,
      radius: 17,
      color: '#fffbe8',
      glow: '#fff3cc',
      glowRadius: 130,
      glowAlpha: 0.5,
    },
    stars: 0,
    cloud: { light: '#f6f3ea', shade: '#b6bfc8', alpha: 0.9, coverMul: 1, coverMin: 0, underlit: false },
    tintAlpha: 0,
  },
  overcast: {
    sky: { top: '#838a91', mid: '#a2a7aa', horizon: '#c6c8c3' },
    skyKeep: 0.15,
    mul: [0.83, 0.85, 0.88],
    desaturate: 0.4,
    hazeBoost: 0.25,
    hazeSky: 0.75,
    light: -1,
    celestial: {
      kind: 'glow',
      x: 420,
      y: 110,
      radius: 0,
      color: '#e4e4dc',
      glow: '#dcdcd4',
      glowRadius: 150,
      glowAlpha: 0.28,
    },
    stars: 0,
    cloud: { light: '#b7babb', shade: '#7f858b', alpha: 0.92, coverMul: 1.6, coverMin: 0.85, underlit: false },
    tintAlpha: 0,
  },
  dusk: {
    sky: { top: '#474c72', mid: '#b3737a', horizon: '#f3b26c' },
    skyKeep: 0.15,
    mul: [0.93, 0.74, 0.64],
    desaturate: 0.12,
    hazeBoost: 0.15,
    hazeSky: 0.7,
    light: 1,
    celestial: {
      kind: 'sun',
      x: 800,
      y: 246,
      radius: 25,
      color: '#ffd9a0',
      glow: '#ff9d5c',
      glowRadius: 160,
      glowAlpha: 0.6,
    },
    stars: 16,
    cloud: { light: '#f4aa78', shade: '#6d5a7a', alpha: 0.85, coverMul: 0.9, coverMin: 0.15, underlit: true },
    tintAlpha: 0.08,
  },
  night: {
    sky: { top: '#0d1428', mid: '#1a2644', horizon: '#35455f' },
    skyKeep: 0.08,
    mul: [0.5, 0.6, 0.82],
    desaturate: 0.45,
    hazeBoost: 0.2,
    hazeSky: 0.85,
    light: 1,
    celestial: {
      kind: 'moon',
      x: 760,
      y: 96,
      radius: 19,
      color: '#eceadb',
      glow: '#a9bbdc',
      glowRadius: 120,
      glowAlpha: 0.35,
    },
    stars: 150,
    cloud: { light: '#42506c', shade: '#1b2338', alpha: 0.75, coverMul: 0.8, coverMin: 0.1, underlit: false },
    tintAlpha: 0.12,
  },
};

export const THEATRES: Record<TheatreId, TheatreDef> = {
  france: {
    id: 'france',
    palette: {
      sky: { top: '#7da2c0', mid: '#a9c4d3', horizon: '#dfe7dc' },
      haze: '#c6d5dd',
      far: '#6e8a70',
      farAlt: '#7f9668',
      mid: '#7f9660',
      midAlt: '#b8ac72',
      near: '#748c52',
      nearAlt: '#93a468',
      foliage: '#587645',
      foliageShade: '#455f3a',
      foliageAlt: '#5f7c4c',
      foliageAltShade: '#4a6440',
      trunk: '#54483a',
      wall: '#d0c3a4',
      wallShade: '#a99c7f',
      wallAlt: '#bfae8c',
      roof: '#96705a',
      roofShade: '#75594a',
      roofAlt: '#6c727a',
      trim: '#e4dcc6',
      opening: '#5a544a',
      stone: '#a59e8c',
      stoneShade: '#817b6d',
      metal: '#5e5c56',
      metalShade: '#47453f',
      water: '#8fa9b3',
      waterLight: '#b8cbcf',
      pale: '#e9e6d8',
      ground: '#8f9f62',
      groundLight: '#a6b276',
      groundDark: '#778a54',
      track: '#b9ab82',
      soil: '#7c644a',
      soilDark: '#4f3e2e',
      dust: '#bcac8a',
      tuft: '#66803f',
      pebble: '#9e9989',
      fg: '#35432a',
      fgAlt: '#465632',
    },
    layers: {
      far: { top: 196, haze: 0.62, mist: 0.3, mistHeight: 60 },
      mid: { top: 222, haze: 0.36, mist: 0.28, mistHeight: 46 },
      near: { top: 196, haze: 0.14, mist: 0.3, mistHeight: 42 },
    },
    cloudCover: 0.42,
    groundStyle: 'grass',
    foreground: [
      { item: 'tuft', count: 11 },
      { item: 'flower', count: 3 },
      { item: 'stone', count: 2 },
      { item: 'post', count: 2 },
    ],
    rain: { darken: 0.2, desaturate: 0.3 },
    nightTint: '#0b1430',
  },

  desert: {
    id: 'desert',
    palette: {
      sky: { top: '#a3bfd0', mid: '#cddad8', horizon: '#f0e7d0' },
      haze: '#ddd8d2',
      far: '#b59c92',
      farAlt: '#c3a98c',
      mid: '#dec391',
      midAlt: '#c0a076',
      near: '#dbbf88',
      nearAlt: '#bd9f6c',
      foliage: '#8f8e5e',
      foliageShade: '#73724b',
      foliageAlt: '#9a9468',
      foliageAltShade: '#7b7652',
      trunk: '#6c5c46',
      wall: '#dccbaa',
      wallShade: '#b5a386',
      wallAlt: '#cdb992',
      roof: '#aa8e6e',
      roofShade: '#8a7258',
      roofAlt: '#9a8468',
      trim: '#eadfc6',
      opening: '#6a5a48',
      stone: '#a89279',
      stoneShade: '#836f5b',
      metal: '#6a5a4e',
      metalShade: '#51443b',
      water: '#9db4ba',
      waterLight: '#c3d2d2',
      pale: '#f1e9d6',
      ground: '#d7bf8c',
      groundLight: '#e5d1a2',
      groundDark: '#c3a878',
      track: '#e3cf9f',
      soil: '#aa8858',
      soilDark: '#7b603d',
      dust: '#dfcba1',
      tuft: '#93895a',
      pebble: '#a99880',
      fg: '#5e4b34',
      fgAlt: '#735f42',
    },
    layers: {
      far: { top: 206, haze: 0.6, mist: 0.35, mistHeight: 50 },
      mid: { top: 232, haze: 0.34, mist: 0.25, mistHeight: 40 },
      near: { top: 262, haze: 0.12, mist: 0.2, mistHeight: 30 },
    },
    cloudCover: 0.1,
    groundStyle: 'sand',
    foreground: [
      { item: 'stone', count: 7 },
      { item: 'scrub', count: 5 },
      { item: 'post', count: 1 },
    ],
    rain: { darken: 0.14, desaturate: 0.22 },
    nightTint: '#11183a',
  },

  sicily: {
    id: 'sicily',
    palette: {
      sky: { top: '#6f9cc5', mid: '#a5c3d7', horizon: '#e7e0c8' },
      haze: '#cdd3d6',
      far: '#a59b80',
      farAlt: '#b2a57f',
      mid: '#b9a56e',
      midAlt: '#a6925e',
      near: '#b09c60',
      nearAlt: '#c7b274',
      foliage: '#77845e',
      foliageShade: '#5c684e',
      foliageAlt: '#465a46',
      foliageAltShade: '#36473a',
      trunk: '#5c4e3c',
      wall: '#dbcba8',
      wallShade: '#b5a380',
      wallAlt: '#cbb690',
      roof: '#b47e5a',
      roofShade: '#8f6347',
      roofAlt: '#a08068',
      trim: '#ebe2ca',
      opening: '#6b5a48',
      stone: '#b8ab8f',
      stoneShade: '#92866c',
      metal: '#62594e',
      metalShade: '#4a433b',
      water: '#86a5b8',
      waterLight: '#b4c9d0',
      pale: '#eee9da',
      ground: '#c5af78',
      groundLight: '#d6c38c',
      groundDark: '#ab9563',
      track: '#d6c69a',
      soil: '#91714a',
      soilDark: '#614a31',
      dust: '#d0bc8f',
      tuft: '#a99750',
      pebble: '#a79c86',
      fg: '#4e422b',
      fgAlt: '#625433',
    },
    layers: {
      far: { top: 150, haze: 0.6, mist: 0.3, mistHeight: 60 },
      mid: { top: 226, haze: 0.36, mist: 0.25, mistHeight: 44 },
      near: { top: 204, haze: 0.14, mist: 0.28, mistHeight: 40 },
    },
    cloudCover: 0.2,
    groundStyle: 'dry',
    foreground: [
      { item: 'tuft', count: 7 },
      { item: 'stone', count: 6 },
      { item: 'scrub', count: 2 },
    ],
    rain: { darken: 0.16, desaturate: 0.25 },
    nightTint: '#0e1636',
  },

  italy: {
    id: 'italy',
    palette: {
      sky: { top: '#7b8ea0', mid: '#a6b3bb', horizon: '#d4d6cf' },
      haze: '#c2cad1',
      far: '#7a8794',
      farAlt: '#878e8c',
      mid: '#86826e',
      midAlt: '#716d5c',
      near: '#7e7560',
      nearAlt: '#958c76',
      foliage: '#646b54',
      foliageShade: '#4e5444',
      foliageAlt: '#56604e',
      foliageAltShade: '#434b3e',
      trunk: '#4c443a',
      wall: '#bcb19b',
      wallShade: '#948a72',
      wallAlt: '#a89c84',
      roof: '#8c6c5a',
      roofShade: '#6e5648',
      roofAlt: '#7c7468',
      trim: '#d8d2c2',
      opening: '#57504a',
      stone: '#a29c8e',
      stoneShade: '#7e796d',
      metal: '#5a5650',
      metalShade: '#44413c',
      water: '#a9b5ba',
      waterLight: '#c4cdd0',
      pale: '#e5e9eb',
      ground: '#9d9278',
      groundLight: '#b2a88d',
      groundDark: '#82775f',
      track: '#aca085',
      soil: '#6c5c46',
      soilDark: '#42382b',
      dust: '#aba18b',
      tuft: '#727555',
      pebble: '#9f998c',
      fg: '#38322a',
      fgAlt: '#4b4336',
    },
    layers: {
      far: { top: 74, haze: 0.58, mist: 0.36, mistHeight: 80 },
      mid: { top: 214, haze: 0.36, mist: 0.3, mistHeight: 50 },
      near: { top: 214, haze: 0.15, mist: 0.34, mistHeight: 44 },
    },
    cloudCover: 0.55,
    groundStyle: 'mud',
    foreground: [
      { item: 'rubble', count: 6 },
      { item: 'stump', count: 3 },
      { item: 'stone', count: 4 },
      { item: 'tuft', count: 3 },
    ],
    rain: { darken: 0.22, desaturate: 0.3 },
    nightTint: '#0c1330',
  },

  normandy: {
    id: 'normandy',
    palette: {
      sky: { top: '#7f97a9', mid: '#a9bac2', horizon: '#d9ddd7' },
      haze: '#c7d1d6',
      far: '#7d959f',
      farAlt: '#94a8ad',
      mid: '#b9ae93',
      midAlt: '#a09d8c',
      near: '#cfc098',
      nearAlt: '#b5a780',
      foliage: '#8d9962',
      foliageShade: '#6f7b4d',
      foliageAlt: '#7f8c5a',
      foliageAltShade: '#647048',
      trunk: '#6c5c48',
      wall: '#b9b3a4',
      wallShade: '#948f82',
      wallAlt: '#a8a294',
      roof: '#7c7468',
      roofShade: '#625c52',
      roofAlt: '#8c8274',
      trim: '#dedbd0',
      opening: '#55524c',
      stone: '#aaa69a',
      stoneShade: '#878478',
      metal: '#5c6266',
      metalShade: '#464b4f',
      water: '#7f98a2',
      waterLight: '#b3c5c9',
      pale: '#eef0ea',
      ground: '#cbbb92',
      groundLight: '#dacca5',
      groundDark: '#b5a680',
      track: '#d5c8a2',
      soil: '#9c8860',
      soilDark: '#6e5e42',
      dust: '#d1c4a3',
      tuft: '#89935c',
      pebble: '#9e9a8e',
      fg: '#4d4937',
      fgAlt: '#5f5d42',
    },
    layers: {
      far: { top: 120, haze: 0.5, mist: 0.2, mistHeight: 30 },
      mid: { top: 286, haze: 0.28, mist: 0.2, mistHeight: 30 },
      near: { top: 286, haze: 0.1, mist: 0.2, mistHeight: 26 },
    },
    cloudCover: 0.6,
    groundStyle: 'beach',
    foreground: [
      { item: 'reed', count: 7 },
      { item: 'stone', count: 6 },
      { item: 'post', count: 2 },
    ],
    rain: { darken: 0.2, desaturate: 0.28 },
    nightTint: '#0c1532',
  },

  holland: {
    id: 'holland',
    palette: {
      sky: { top: '#7e9cb8', mid: '#abc0cd', horizon: '#dee3db' },
      haze: '#c5d0d7',
      far: '#7e8b90',
      farAlt: '#8a9588',
      mid: '#829070',
      midAlt: '#8d8a7c',
      near: '#a7a092',
      nearAlt: '#8b9a68',
      foliage: '#627c4c',
      foliageShade: '#4c643f',
      foliageAlt: '#6c8452',
      foliageAltShade: '#546a44',
      trunk: '#4e4438',
      wall: '#9a6652',
      wallShade: '#7c5244',
      wallAlt: '#c1ac86',
      roof: '#5e524e',
      roofShade: '#4a403e',
      roofAlt: '#a4674e',
      trim: '#e2dac6',
      opening: '#4f4a48',
      stone: '#a59f92',
      stoneShade: '#817c72',
      metal: '#5f6c6e',
      metalShade: '#4a5557',
      water: '#8fa6ae',
      waterLight: '#bccaca',
      pale: '#e8e6da',
      ground: '#a19a8e',
      groundLight: '#b5ae9f',
      groundDark: '#888277',
      track: '#aea799',
      soil: '#705e4a',
      soilDark: '#473b2f',
      dust: '#b2aa9a',
      tuft: '#728353',
      pebble: '#96705c',
      fg: '#343230',
      fgAlt: '#54423a',
    },
    layers: {
      far: { top: 190, haze: 0.56, mist: 0.3, mistHeight: 40 },
      mid: { top: 208, haze: 0.34, mist: 0.25, mistHeight: 36 },
      near: { top: 176, haze: 0.12, mist: 0.26, mistHeight: 30 },
    },
    cloudCover: 0.5,
    groundStyle: 'cobble',
    foreground: [
      { item: 'rubble', count: 6 },
      { item: 'bollard', count: 3 },
      { item: 'tuft', count: 3 },
      { item: 'stone', count: 2 },
    ],
    rain: { darken: 0.2, desaturate: 0.26 },
    nightTint: '#0b1330',
  },

  germany: {
    id: 'germany',
    palette: {
      sky: { top: '#8592a0', mid: '#acb5bb', horizon: '#dad9d0' },
      haze: '#c6ced3',
      far: '#5e7475',
      farAlt: '#6a7d77',
      mid: '#4f665b',
      midAlt: '#5c7162',
      near: '#8c8a72',
      nearAlt: '#a5a48e',
      foliage: '#7c7252',
      foliageShade: '#615a42',
      foliageAlt: '#3d5847',
      foliageAltShade: '#2f463a',
      trunk: '#4e4338',
      wall: '#b5ae9f',
      wallShade: '#8e887b',
      wallAlt: '#a39c8c',
      roof: '#6a5c52',
      roofShade: '#544a42',
      roofAlt: '#70685e',
      trim: '#dcd8cc',
      opening: '#4c4a46',
      stone: '#b6b3a7',
      stoneShade: '#8e8b80',
      metal: '#585c5c',
      metalShade: '#434747',
      water: '#9aa9ae',
      waterLight: '#bdc8ca',
      pale: '#e1e5e2',
      ground: '#98957d',
      groundLight: '#b3b19c',
      groundDark: '#7d7b64',
      track: '#a7a38c',
      soil: '#5e4e3c',
      soilDark: '#3a3026',
      dust: '#aaa694',
      tuft: '#6e7452',
      pebble: '#918e82',
      fg: '#2b352e',
      fgAlt: '#3c4432',
    },
    layers: {
      far: { top: 180, haze: 0.62, mist: 0.4, mistHeight: 70 },
      mid: { top: 236, haze: 0.38, mist: 0.36, mistHeight: 50 },
      near: { top: 150, haze: 0.16, mist: 0.5, mistHeight: 70 },
    },
    cloudCover: 0.65,
    groundStyle: 'forest',
    foreground: [
      { item: 'fern', count: 7 },
      { item: 'stump', count: 3 },
      { item: 'stone', count: 3 },
      { item: 'tuft', count: 3 },
    ],
    rain: { darken: 0.22, desaturate: 0.3 },
    nightTint: '#0a122c',
  },

  russiaSummer: {
    id: 'russiaSummer',
    palette: {
      sky: { top: '#6f98c4', mid: '#a6c3dc', horizon: '#e2e8dc' },
      haze: '#c9d6df',
      far: '#61806e',
      farAlt: '#728c6a',
      mid: '#9aa35f',
      midAlt: '#c3b16a',
      near: '#6f8a4c',
      nearAlt: '#8ea05e',
      foliage: '#7b9a52',
      foliageShade: '#5a7a42',
      foliageAlt: '#3f5c45',
      foliageAltShade: '#2f4838',
      trunk: '#5a4a3a',
      wall: '#8c7458',
      wallShade: '#6a5642',
      wallAlt: '#a08766',
      roof: '#78705f',
      roofShade: '#5c5649',
      roofAlt: '#4f7d68',
      trim: '#86a3c4',
      opening: '#3f3a34',
      stone: '#a19c8e',
      stoneShade: '#7d796d',
      metal: '#5c5a54',
      metalShade: '#45433e',
      water: '#8ba7b3',
      waterLight: '#b9ccd2',
      pale: '#ece9dc',
      ground: '#8d9c5c',
      groundLight: '#a4b073',
      groundDark: '#768650',
      track: '#b4a67e',
      soil: '#76604a',
      soilDark: '#4c3d2e',
      dust: '#b9aa86',
      tuft: '#64803d',
      pebble: '#9b968a',
      fg: '#33422a',
      fgAlt: '#465531',
    },
    layers: {
      far: { top: 196, haze: 0.6, mist: 0.32, mistHeight: 56 },
      mid: { top: 214, haze: 0.34, mist: 0.26, mistHeight: 44 },
      near: { top: 170, haze: 0.13, mist: 0.28, mistHeight: 40 },
    },
    cloudCover: 0.36,
    groundStyle: 'grass',
    foreground: [
      { item: 'tuft', count: 12 },
      { item: 'flower', count: 2 },
      { item: 'stump', count: 2 },
      { item: 'stone', count: 2 },
    ],
    rain: { darken: 0.2, desaturate: 0.3 },
    nightTint: '#0b1430',
    winter: {
      palette: {
        sky: { top: '#8d9fb4', mid: '#b6c2ce', horizon: '#dfe3e6' },
        haze: '#d4dbe1',
        far: '#8e9ca6',
        farAlt: '#a9b4bc',
        mid: '#d6dce1',
        midAlt: '#c7ced4',
        near: '#dfe4e8',
        nearAlt: '#ccd3d9',
        foliage: '#4f625a',
        foliageShade: '#3c4d47',
        foliageAlt: '#3f5249',
        foliageAltShade: '#2e3e38',
        trunk: '#55493e',
        roof: '#e6eaee',
        roofShade: '#b9c2ca',
        pale: '#f3f5f7',
        ground: '#d9dee0',
        groundLight: '#eef1f2',
        groundDark: '#a9b3b9',
        track: '#c4c9c9',
        dust: '#e2e6e8',
        tuft: '#8c8a6c',
        fg: '#3b4544',
        fgAlt: '#55615f',
      },
      cloudCover: 0.62,
      groundStyle: 'snow',
      foreground: [
        { item: 'stump', count: 3 },
        { item: 'stone', count: 3 },
        { item: 'tuft', count: 5 },
        { item: 'post', count: 2 },
      ],
    },
  },

  stalingrad: {
    id: 'stalingrad',
    palette: {
      sky: { top: '#7f8890', mid: '#a9aaa4', horizon: '#d8c9ac' },
      haze: '#c4bfb2',
      far: '#8a8d8c',
      farAlt: '#9b9a92',
      mid: '#8d8476',
      midAlt: '#a39a88',
      near: '#8a7f6e',
      nearAlt: '#a19683',
      foliage: '#7f7a4e',
      foliageShade: '#625e3f',
      foliageAlt: '#6b6a49',
      foliageAltShade: '#504f38',
      trunk: '#4a3f35',
      wall: '#b3a995',
      wallShade: '#8c836f',
      wallAlt: '#a2876a',
      roof: '#6e655b',
      roofShade: '#574f47',
      roofAlt: '#7c6a58',
      trim: '#d1c8b5',
      opening: '#2f2b28',
      stone: '#a69e8f',
      stoneShade: '#7f786b',
      metal: '#55524d',
      metalShade: '#3f3d3a',
      water: '#7f8f96',
      waterLight: '#a8b5b8',
      pale: '#e3ddcf',
      ground: '#9d907a',
      groundLight: '#b0a48e',
      groundDark: '#837763',
      track: '#aa9e86',
      soil: '#6a5a47',
      soilDark: '#43382c',
      dust: '#b2a58c',
      tuft: '#7c7651',
      pebble: '#968e80',
      fg: '#3a332c',
      fgAlt: '#4d443a',
    },
    layers: {
      far: { top: 150, haze: 0.58, mist: 0.36, mistHeight: 64 },
      mid: { top: 176, haze: 0.34, mist: 0.32, mistHeight: 50 },
      near: { top: 150, haze: 0.14, mist: 0.34, mistHeight: 46 },
    },
    cloudCover: 0.6,
    groundStyle: 'rubble',
    foreground: [
      { item: 'rubble', count: 8 },
      { item: 'stone', count: 4 },
      { item: 'post', count: 1 },
      { item: 'tuft', count: 2 },
    ],
    rain: { darken: 0.22, desaturate: 0.3 },
    nightTint: '#0d1228',
    winter: {
      palette: {
        sky: { top: '#8a95a1', mid: '#b2b9bf', horizon: '#dcdcd6' },
        haze: '#cfd3d6',
        far: '#9aa1a6',
        farAlt: '#b3b8bb',
        mid: '#958e84',
        midAlt: '#aaa498',
        near: '#8f877c',
        nearAlt: '#a69f93',
        roof: '#e3e7ea',
        roofShade: '#b8bfc5',
        pale: '#f1f3f4',
        water: '#c9d3d8',
        waterLight: '#e2e8eb',
        ground: '#d2d6d6',
        groundLight: '#e6e9ea',
        groundDark: '#a7aeb1',
        track: '#bfc2c0',
        dust: '#dadddd',
        fg: '#3c3a37',
        fgAlt: '#55524d',
      },
      cloudCover: 0.7,
      groundStyle: 'snow',
    },
  },

  steppe: {
    id: 'steppe',
    palette: {
      sky: { top: '#759cc2', mid: '#abc5d9', horizon: '#e6e6d6' },
      haze: '#cfd7da',
      far: '#8c9a8a',
      farAlt: '#9fa587',
      mid: '#b1aa76',
      midAlt: '#c2b47e',
      near: '#a59d68',
      nearAlt: '#b9ad74',
      foliage: '#8a8c58',
      foliageShade: '#6c6e45',
      foliageAlt: '#6f7a4f',
      foliageAltShade: '#56603e',
      trunk: '#5b4c3c',
      wall: '#a58f70',
      wallShade: '#806e56',
      wallAlt: '#c2ae8a',
      roof: '#8a7d66',
      roofShade: '#6b604f',
      roofAlt: '#b39a62',
      trim: '#ddd4bf',
      opening: '#433b33',
      stone: '#a39b89',
      stoneShade: '#7e786a',
      metal: '#5a5852',
      metalShade: '#44423e',
      water: '#93a9b1',
      waterLight: '#bfcfd1',
      pale: '#eeeadb',
      ground: '#aba26c',
      groundLight: '#bdb47f',
      groundDark: '#918a5b',
      track: '#c0b48c',
      soil: '#7b6548',
      soilDark: '#4f402e',
      dust: '#c4b791',
      tuft: '#8e8c50',
      pebble: '#a19a8a',
      fg: '#4a4430',
      fgAlt: '#5d563b',
    },
    layers: {
      far: { top: 232, haze: 0.62, mist: 0.34, mistHeight: 46 },
      mid: { top: 250, haze: 0.36, mist: 0.26, mistHeight: 36 },
      near: { top: 222, haze: 0.14, mist: 0.24, mistHeight: 32 },
    },
    cloudCover: 0.32,
    groundStyle: 'steppe',
    foreground: [
      { item: 'tuft', count: 13 },
      { item: 'scrub', count: 3 },
      { item: 'stone', count: 2 },
    ],
    rain: { darken: 0.18, desaturate: 0.26 },
    nightTint: '#0c1532',
    winter: {
      palette: {
        sky: { top: '#8798ad', mid: '#b4c0cb', horizon: '#e0e3e4' },
        haze: '#d6dce0',
        far: '#a4afb7',
        farAlt: '#b8c0c5',
        mid: '#d9dee2',
        midAlt: '#c9d0d5',
        near: '#e0e5e8',
        nearAlt: '#cdd4d9',
        foliage: '#7c7a62',
        foliageShade: '#5f5e4c',
        roof: '#e5e9ec',
        roofShade: '#b8c1c8',
        pale: '#f4f6f7',
        ground: '#dadfe1',
        groundLight: '#eef1f2',
        groundDark: '#aab4b9',
        track: '#c6cbca',
        dust: '#e2e6e8',
        tuft: '#94906c',
        fg: '#45494a',
        fgAlt: '#5c6162',
      },
      cloudCover: 0.66,
      groundStyle: 'snow',
      foreground: [
        { item: 'tuft', count: 8 },
        { item: 'stone', count: 3 },
        { item: 'post', count: 1 },
      ],
    },
  },
};

/**
 * Scene tunables per theatre: how many of each thing and where the main lines
 * of the composition sit. Pure shape geometry (how a poplar is drawn) stays in
 * the art code.
 */
export const SCENES = {
  france: {
    farRidgeY: 268,
    farRidgeAmp: 20,
    villageHouses: 9,
    /** The village with the church sits this far across the far strip's tile (0..1). */
    churchAt: 0.31,
    spireHeight: 36,
    midRidgeY: 304,
    midRidgeAmp: 11,
    fields: 13,
    poplars: 11,
    poplarHeight: 42,
    hedgeY: 325,
    vergeY: 341,
    hedgeTrees: 9,
    treeHeight: 86,
    telegraphPoles: 8,
    poleHeight: 88,
  },
  desert: {
    farMesaY: 290,
    farMesaHeight: 44,
    dunes: 9,
    duneHeight: 44,
    duneBaseY: 326,
    nearSwellY: 334,
    nearSwellAmp: 7,
    scrub: 16,
    rocks: 9,
    wrecks: 1,
  },
  sicily: {
    volcanoTopY: 176,
    farRidgeY: 270,
    farRidgeAmp: 26,
    townHouses: 26,
    midRidgeY: 300,
    midRidgeAmp: 20,
    terraces: 5,
    midOlives: 46,
    wallY: 330,
    olives: 7,
    oliveHeight: 58,
    cypresses: 5,
    cypressHeight: 104,
    pricklyPears: 3,
  },
  italy: {
    backRangeY: 236,
    backRangeAmp: 96,
    massifY: 286,
    massifAmp: 165,
    massifHalf: 300,
    monasteryWidth: 92,
    midSlopeY: 306,
    midSlopeAmp: 44,
    ruins: 5,
    midTrees: 20,
    bankY: 332,
    shatteredTrees: 10,
    treeHeight: 84,
    wallRuins: 2,
    rubblePiles: 9,
  },
  normandy: {
    seaY: 272,
    ships: 7,
    landingCraft: 8,
    balloons: 7,
    balloonMinY: 150,
    balloonMaxY: 252,
    surfY: 318,
    sandY: 324,
    obstacles: 30,
    duneY: 340,
    duneAmp: 11,
    marram: 46,
  },
  holland: {
    skylineY: 306,
    towerHeight: 96,
    farRoofs: 60,
    riverY: 320,
    bridgeSpan: 520,
    bridgeDeckY: 300,
    bridgeRise: 64,
    windmillHeight: 62,
    quayY: 332,
    houseBlocks: 3,
    housesPerBlock: 6,
    houseHeight: 86,
    trees: 7,
  },
  germany: {
    farRidges: 3,
    farRidgeY: 240,
    farRidgeAmp: 24,
    midForestY: 316,
    midPines: 70,
    midPineHeight: 52,
    /**
     * Dragon's teeth: the Westwall crosses the battlefield, so it is drawn end-on (docs/AGENT_GUIDE.md, art rule) as a
     * few narrow clusters, never a band along the ground. Each crossing (at these shares of the layer width) shows the
     * line's cross-section, teethAcross teeth side by side growing taller toward the German side, each row receding
     * into the screen as teethDeep teeth that step up by teethRecedeY and shrink by teethRecedeScale.
     */
    teethY: 340,
    teethAt: [0.16, 0.6] as readonly number[],
    teethAcross: 4,
    teethDeep: 4,
    teethRecedeY: 4,
    teethRecedeScale: 0.86,
    /** Height of the smallest tooth of a cross-section, and the growth per tooth toward the German side. */
    toothSize: 11,
    toothGrow: 0.14,
    bankY: 344,
    pineClumps: 5,
    pinesPerClump: 4,
    pineHeight: 150,
  },
  russiaSummer: {
    farRidgeY: 262,
    farRidgeAmp: 14,
    villageHouses: 8,
    /** The onion-dome church stands this far across the far strip's tile (0..1). */
    churchAt: 0.42,
    domeHeight: 30,
    midWoodY: 300,
    midWoodAmp: 10,
    birches: 70,
    birchHeight: 40,
    izbaAt: 0.64,
    nearBankY: 334,
    birchClumps: 6,
    nearBirchHeight: 120,
    pines: 4,
    pineHeight: 150,
    telegraphPoles: 6,
    poleHeight: 84,
  },
  stalingrad: {
    /** The Volga and its low east bank, far off on the far strip. */
    riverY: 296,
    farBankY: 288,
    /** The skyline of gutted blocks and factory chimneys. */
    skylineY: 300,
    farBlocks: 30,
    chimneys: 7,
    chimneyHeight: 104,
    /** The grain elevator stands this far across the far strip's tile (0..1). */
    elevatorAt: 0.68,
    elevatorHeight: 92,
    smokeColumns: 4,
    midBlocks: 8,
    midBlockHeight: 96,
    midBaseY: 330,
    nearBaseY: 344,
    nearRuins: 4,
    nearRuinHeight: 150,
    rubbleHeaps: 10,
    deadTrees: 5,
  },
  steppe: {
    farLineY: 300,
    /** A distant railway embankment with a slow train of wagons and telegraph poles beside it. */
    railY: 304,
    wagons: 9,
    poles: 26,
    midSwellY: 322,
    midSwellAmp: 5,
    balkas: 3,
    haystacks: 12,
    nearSwellY: 338,
    nearSwellAmp: 4,
    windmillAt: 0.33,
    windmillHeight: 70,
    grassClumps: 70,
  },
} as const;
