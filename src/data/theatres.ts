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
import type { TheatreId, TimeOfDay } from './schema';

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

export type GroundStyle = 'grass' | 'sand' | 'dry' | 'mud' | 'beach' | 'cobble' | 'forest';

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
export const THEATRE_IDS: readonly TheatreId[] = ['france', 'desert', 'sicily', 'italy', 'normandy', 'holland', 'germany'];

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
    teethY: 326,
    teethRows: 4,
    teethPerRow: 58,
    toothSize: 13,
    bankY: 344,
    pineClumps: 5,
    pinesPerClump: 4,
    pineHeight: 150,
  },
} as const;
