/**
 * The title screen's storm: rain in three depths, a lightning flash every few seconds (now and then with a fork in the
 * distance behind the church spire), the thunder that follows each flash and the rain under it all. Every number the
 * owner may want to tune lives here. It is a separate, always-on thing: the battle weather (src/data/weather.ts, 40%
 * rain per map, a thunder check every 2 s) is not touched by any of it.
 *
 * Read by src/fx/menuStorm.ts (timing, rain and drop motion), src/render/weather/menuStorm.ts (the picture),
 * src/audio/storm.ts (the rain bed and the thunder) and src/app/menuStorm.ts (lifecycle).
 *
 * Units: wu (the battlefield's world units, 410 of them from the top of the screen to the bottom) for the scene, CSS px
 * for the drops on the panel, seconds for times, 0..1 for levels and opacities.
 */
import type { NoiseColor } from './sounds';
import type { TheatreId, TimeOfDay } from './schema';
import type { LightningBoltShape } from './weather';

/** A brightness envelope: [seconds since the flash began, brightness 0..1] keys joined by straight lines. */
export type Envelope = readonly (readonly [number, number])[];

/** One depth of rain streaks. */
export interface MenuRainLayerDef {
  /** Streaks per megapixel of screen (CSS px), so a bigger screen gets more; then held between min and max. */
  perMegapixel: number;
  min: number;
  max: number;
  /** Fall speed along the streak, wu/s, plus up to speedJitter of it at random per streak. */
  speed: number;
  speedJitter: number;
  /** Lean from vertical, radians: positive puts the bottom of a streak toward +x (wind from the left). */
  angle: number;
  /** Streak length and thickness, wu. */
  length: number;
  width: number;
  /** Opacity of a streak, and the random share of it each streak may lose, so the layer is not uniform. */
  alpha: number;
  alphaJitter: number;
}

/** Backdrop tints (multiply, CSS hex) per layer. */
export interface MenuTints {
  sky: string;
  clouds: string;
  farBackdrop: string;
  midBackdrop: string;
  nearBackdrop: string;
  ground: string;
  foreground: string;
}

/** How far each backdrop layer's tint is pulled toward the flash colour at full flash (0..1). */
export type MenuTintShare = { readonly [K in keyof MenuTints]: number };

/** How the sky reacts to one flash. */
export interface MenuFlashLook {
  /** Brightness over time. */
  keys: Envelope;
  /** Opacity of the light overlay on the sky and clouds at brightness 1. */
  skyAlpha: number;
  /** Pull of each layer's tint toward the flash colour at brightness 1. */
  tintShare: MenuTintShare;
}

/** One layer of the rain bed: looping noise through a filter, its level and filter drifting at random. */
export interface RainBedLayerDef {
  color: NoiseColor;
  /** Playback rate of the 2 s noise table; different per layer so the layers never line up. */
  rate: number;
  filter: 'lowpass' | 'highpass' | 'bandpass';
  q: number;
  /** The filter frequency (Hz) and level wander inside these ranges... */
  freq: readonly [number, number];
  gain: readonly [number, number];
  /** ...gliding to a new random target every `segment` seconds (random in the range). */
  segment: readonly [number, number];
}

/** The synthesised thunder (src/audio/storm.ts buildThunder). Levels are at loudness 1 and scale with it. */
export interface ThunderSynthDef {
  /** Peak level of the opening boom on the Ambience bus. */
  level: number;
  /** The crack and tear of a near strike: only above this loudness, scaled by how far above it the loudness is. */
  crackFrom: number;
  crackGain: number;
  /** Low-pass cutoff of the boom and rolls at loudness 1; quieter (further) thunder is darker, down to cutoffFar times it. */
  cutoff: number;
  cutoffFar: number;
  /** Rolls per second of thunder length, and their level (relative to the boom) and length ranges. */
  rollsPerSecond: number;
  rollGain: readonly [number, number];
  rollDecay: readonly [number, number];
  /** Random wobble of each roll's level: this many steps per second, each up to `wobble` of the level. */
  wobbleRate: number;
  wobble: number;
  /** Sub thump under the boom (headphones), as a share of the level. */
  subGain: number;
}

export interface MenuStormDef {
  /** The scene behind the title panel. */
  scene: {
    theatre: TheatreId;
    timeOfDay: TimeOfDay;
    seed: number;
    /** Where the church spire sits across the screen (0 = left edge, 1 = right): beside the panel, not under it. */
    spireScreenFrac: number;
    /** The camera tries this many positions that put the spire in the same place and keeps the one where the nearer trees cover it least. */
    cameraCandidates: number;
    /** Half-width (wu) of the strip around the spire that the nearer layers should leave clear. */
    spireClearHalf: number;
  };
  /** Seconds of storm time between flashes. */
  thunderInterval: number;
  /** Chance (0..1) that a flash also shows a fork behind the spire. */
  forkChance: number;
  /** Seconds the storm fades in when the title appears and out when the player leaves. */
  fadeIn: number;
  fadeOut: number;

  rain: {
    /** Back to front: behind the tree line, in front of the field, nearest (over everything in the scene). */
    layers: readonly [MenuRainLayerDef, MenuRainLayerDef, MenuRainLayerDef];
    colour: string;
    /** Streaks start and end this far outside the screen (wu), so they never pop in or out. */
    overscan: number;
    /** Splashes on the grass per second across 1000 wu of screen width. */
    splashRate: number;
    /** Most splashes alive at once. */
    maxSplashes: number;
    /** Seconds a splash lasts (it plays its three frames in that time). */
    splashLife: number;
    /** Splashes land between these world y (the grass in front of the hedge, down to the bottom of the screen). */
    splashBand: readonly [number, number];
    /** Splash size at the far and near edge of the band (perspective). */
    splashScale: readonly [number, number];
    splashAlpha: number;
  };

  /** Drops running down the front of the title panel. */
  panelDrops: {
    count: number;
    /** Head radius, CSS px. */
    size: readonly [number, number];
    /** Sliding speed, panel heights per second. */
    speed: readonly [number, number];
    /** A drop sticks for this long between slides... */
    hold: readonly [number, number];
    /** ...and slides this far (panel heights) each time. */
    slide: readonly [number, number];
    /** Longest wet trail (panel heights) and how fast it dries when the drop stops (panel heights per second). */
    trailMax: number;
    trailDry: number;
    alpha: number;
    /** Seconds before a drop that ran off the bottom forms again, and how long it takes to appear. */
    respawn: readonly [number, number];
    appear: number;
    /** A new drop forms between these fractions of the panel height. */
    formBand: readonly [number, number];
  };

  /** Normal lightning: a sharp double flash. */
  flash: MenuFlashLook;
  /** "Reduce flashing": a slow soft glow with no sharp brightness step, and no fork. */
  glow: MenuFlashLook;
  colours: {
    /** The storm's grey-blue light on each backdrop layer. */
    storm: MenuTints;
    /** What the light is pulled toward in a flash. */
    flash: string;
    /** The light overlay on the sky. */
    skyFlash: string;
  };

  /** The distant fork. */
  fork: {
    shape: LightningBoltShape;
    /** Seconds the fork stays visible (it follows the flash envelope, cut off here). */
    time: number;
    /** It lands up to this far (wu) to either side of the spire... */
    landJitter: number;
    /** ...and its foot is hidden this far below the spire's tip (and at least footBelowHills below the hills there). */
    footBelowTip: number;
    footBelowHills: number;
    /** Its top starts this far above the top of the screen (wu). */
    startAbove: number;
    /** Soft glow around the strike behind the hills: size (wu), opacity at full brightness, colour. */
    glowW: number;
    glowH: number;
    glowAlpha: number;
    glowColour: string;
    /** Scale of the bolt's brightness (it is distant). */
    alpha: number;
  };

  /** The thunder after each flash. */
  thunder: {
    /** Seconds from the flash to the rumble: a random fraction of a second, as if the storm were a little way off. */
    delay: readonly [number, number];
    /** Loudness 0..1 (a nearer strike is louder and comes sooner) and length in seconds. */
    loudness: readonly [number, number];
    length: readonly [number, number];
    synth: ThunderSynthDef;
  };

  /** Keeping the title cheap on any screen. */
  perf: {
    /**
     * Most canvas pixels the title scene is drawn with: a big or very dense desktop window renders the backdrop and the
     * rain at this many pixels and the browser scales the picture up, so it costs no more than a phone (844x390 at 2x
     * is 1.32 million). Battles are not affected.
     */
    maxCanvasPixels: number;
    /** The lowest canvas resolution that cap may give, in device pixels per CSS pixel. */
    minPixelRatio: number;
    /** Budget for the storm's JavaScript per frame (ms), enforced by the browser test on the production build. */
    jsBudgetMs: number;
  };

  /**
   * When frames on the title stay slow, the storm sheds rain streaks and splashes step by step down to a floor, and
   * takes them back after a calm. The renderer's quality governor still applies on top (its rain share).
   */
  guard: {
    /** Smoothed real frame time (ms) above which frames count as slow, and below which they count as fast. */
    slowFrameMs: number;
    fastFrameMs: number;
    /** Time constant of that smoothing (s); frames longer than ignoreAboveMs (a stall, a hidden tab) are not counted. */
    smoothSeconds: number;
    ignoreAboveMs: number;
    /** Seconds of slow frames before a step down, and of fast frames before a step back up. */
    shedAfter: number;
    restoreAfter: number;
    /** Each step multiplies the share of rain by this; it never goes below floor. */
    step: number;
    floor: number;
  };

  /** The rain you hear, on the Ambience bus. */
  rainAudio: {
    /** Level of the bed at full Ambience volume. */
    volume: number;
    /** Seconds the bed fades in once the sound starts (the first touch), and out when the title is left. */
    fadeIn: number;
    fadeOut: number;
    /** The drift is scheduled this far ahead of the audio clock (s). */
    lookahead: number;
    layers: readonly RainBedLayerDef[];
  };
}

export const MENU_STORM: MenuStormDef = {
  scene: {
    theatre: 'france',
    timeOfDay: 'overcast',
    seed: 1944,
    spireScreenFrac: 0.105,
    cameraCandidates: 12,
    spireClearHalf: 26,
  },
  thunderInterval: 5,
  forkChance: 0.4,
  fadeIn: 0.5,
  fadeOut: 0.6,

  rain: {
    layers: [
      { perMegapixel: 700, min: 70, max: 300, speed: 430, speedJitter: 0.25, angle: 0.15, length: 15, width: 0.9, alpha: 0.32, alphaJitter: 0.45 },
      { perMegapixel: 380, min: 40, max: 160, speed: 820, speedJitter: 0.25, angle: 0.18, length: 28, width: 1.2, alpha: 0.38, alphaJitter: 0.4 },
      { perMegapixel: 140, min: 14, max: 60, speed: 1350, speedJitter: 0.3, angle: 0.2, length: 48, width: 1.7, alpha: 0.42, alphaJitter: 0.35 },
    ],
    colour: '#c9d6e4',
    overscan: 50,
    splashRate: 34,
    maxSplashes: 48,
    splashLife: 0.26,
    splashBand: [362, 520],
    splashScale: [0.35, 0.8],
    splashAlpha: 0.6,
  },

  panelDrops: {
    count: 5,
    size: [2.6, 4],
    speed: [0.22, 0.6],
    hold: [0.5, 2.8],
    slide: [0.06, 0.3],
    trailMax: 0.2,
    trailDry: 0.12,
    alpha: 0.6,
    respawn: [0.6, 3.5],
    appear: 0.7,
    formBand: [0.02, 0.4],
  },

  flash: {
    keys: [
      [0, 0],
      [0.03, 1],
      [0.09, 0.28],
      [0.13, 0.16],
      [0.17, 0.82],
      [0.26, 0.42],
      [0.4, 0.18],
      [0.6, 0.06],
      [0.8, 0],
    ],
    skyAlpha: 0.45,
    // The sky lights up; the land stays dark, so the hills, the spire and the trees stand out against it.
    tintShare: { sky: 0.85, clouds: 0.85, farBackdrop: 0.22, midBackdrop: 0.18, nearBackdrop: 0.14, ground: 0.1, foreground: 0.05 },
  },
  glow: {
    keys: [
      [0, 0],
      [0.7, 0.5],
      [1.5, 0.32],
      [2.6, 0],
    ],
    skyAlpha: 0.26,
    tintShare: { sky: 0.5, clouds: 0.5, farBackdrop: 0.15, midBackdrop: 0.12, nearBackdrop: 0.09, ground: 0.06, foreground: 0.03 },
  },
  colours: {
    storm: {
      sky: '#7d8796',
      clouds: '#727c8b',
      farBackdrop: '#7c8592',
      midBackdrop: '#76808b',
      nearBackdrop: '#6f7983',
      ground: '#7b838b',
      foreground: '#6c747c',
    },
    flash: '#ffffff',
    skyFlash: '#e6edff',
  },

  fork: {
    shape: {
      generations: 6,
      roughness: 0.16,
      decay: 0.55,
      alongJitter: 0.3,
      branchZone: [0.1, 0.8],
      strikeZone: [0.5, 0.5],
      branchChance: 0.13,
      maxDepth: 2,
      maxBranches: 7,
      branchAngle: [0.3, 0.8],
      branchLength: [0.2, 0.5],
      branchGenerations: 4,
      width: 2.8,
      widthFalloff: 0.55,
      alphaFalloff: 0.7,
      startAbove: 30,
      lean: 0.18,
    },
    time: 0.3,
    landJitter: 5,
    footBelowTip: 46,
    footBelowHills: 14,
    startAbove: 30,
    glowW: 150,
    glowH: 210,
    glowAlpha: 0.85,
    glowColour: '#c6d6ff',
    alpha: 1,
  },

  thunder: {
    delay: [0.2, 0.9],
    loudness: [0.45, 1],
    length: [2.4, 5.6],
    synth: {
      level: 0.7,
      crackFrom: 0.72,
      crackGain: 1.4,
      cutoff: 1500,
      cutoffFar: 0.45,
      rollsPerSecond: 1.1,
      rollGain: [0.35, 0.8],
      rollDecay: [0.8, 1.7],
      wobbleRate: 6,
      wobble: 0.45,
      subGain: 0.35,
    },
  },

  perf: {
    maxCanvasPixels: 1_400_000,
    minPixelRatio: 0.5,
    jsBudgetMs: 1.5,
  },

  guard: {
    slowFrameMs: 22,
    fastFrameMs: 18,
    smoothSeconds: 0.5,
    ignoreAboveMs: 250,
    shedAfter: 1.5,
    restoreAfter: 8,
    step: 0.7,
    floor: 0.3,
  },

  rainAudio: {
    volume: 0.26,
    fadeIn: 2.5,
    fadeOut: 0.6,
    lookahead: 0.3,
    layers: [
      // The hiss of rain on fields and leaves.
      { color: 'pink', rate: 0.97, filter: 'bandpass', q: 0.5, freq: [1900, 3300], gain: [0.6, 1], segment: [1.6, 4.4] },
      // Bright patter close by.
      { color: 'white', rate: 1.13, filter: 'highpass', q: 0.3, freq: [4300, 6800], gain: [0.1, 0.3], segment: [0.5, 1.9] },
      // The low wash of heavy rain further off.
      { color: 'brown', rate: 0.89, filter: 'lowpass', q: 0, freq: [260, 560], gain: [0.35, 0.75], segment: [2.6, 7] },
    ],
  },
};
