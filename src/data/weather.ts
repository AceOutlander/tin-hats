/**
 * Weather numbers. Two kinds of weather:
 * - the random rain and its thunder (WEATHER) are visual only: they never touch the simulation or its RNG. The logic
 *   that reads them is in src/fx (weather.ts, rain.ts, lightning.ts);
 * - scripted weather and time of day (WEATHER_SIM, FOUNDATIONS.md 4.7) are sim state set by the mission
 *   (MissionDef.weather, timeOfDay and the weather, time and flare events, src/sim/sky.ts); the view draws them with
 *   WEATHER_LOOKS (src/render/weather/sky.ts).
 */
import type { FactionId, SupportKind, TimeOfDay, WeatherKind } from './schema';

export const WEATHER_KINDS: readonly WeatherKind[] = ['clear', 'overcast', 'rain', 'snow', 'blizzard', 'fog', 'dust', 'smoke'];

/** The sim's rules for scripted weather and time of day (src/sim/sky.ts). */
export const WEATHER_SIM = {
  /**
   * Visibility by weather: the share of a weapon's range at which direct-fire and hitscan weapons may pick a target
   * (lobbed weapons are not limited). Both sides alike. With the time of day the lower of the two applies.
   */
  visibility: { clear: 1, overcast: 1, rain: 1, snow: 1, blizzard: 0.7, fog: 0.6, dust: 0.8, smoke: 0.85 } as Record<WeatherKind, number>,
  /** Visibility by time of day (night: MissionDef.nightVisibility overrides it). */
  time: { dawn: 1, day: 1, overcast: 1, dusk: 1, night: 0.65 } as Record<TimeOfDay, number>,
  /** A flare: visibility 1 over `width` wu centred on it, for `seconds`. */
  flare: { seconds: 20, width: 1500 },
  /** Call-ins flown by aircraft: none in these weathers, and none at night (but for nightAir). */
  air: ['airStrike', 'bomber', 'fighter', 'recon'] as readonly SupportKind[],
  groundedBy: ['fog', 'blizzard'] as readonly WeatherKind[],
  /** Aircraft that fly at night, by nation (the Soviet recon plane is the Po-2, the night bomber). */
  nightAir: { soviet: ['recon'] } as Partial<Record<FactionId, readonly SupportKind[]>>,
  /** The blizzard: men on foot (not sappers on the supply road, nor vehicles) move at x0.9; accuracyFar x0.85. */
  blizzard: { infantrySpeed: 0.9, accuracyFar: 0.85 },
};

/** The three numbers that drive the weather controller. */
export interface WeatherConfig {
  /** Chance (0..1) that a map has rain, rolled once when the battle is created. */
  rainChance: number;
  /** Seconds of battle time between thunder checks while it is raining. */
  thunderCheckInterval: number;
  /** Chance (0..1) that one thunder check produces a strike. */
  thunderChance: number;
}

/** One depth of rain streaks. */
export interface RainLayerLook {
  /** Streaks alive at once across one nominal screen (VIEW.screenWu by VIEW.heightWu). */
  streaks: number;
  /** Fall speed along the streak direction, wu/s. */
  speed: number;
  /** Random extra speed as a fraction of speed (0.2 = up to +20%). */
  speedJitter: number;
  /** Drawn length multiplier applied to the streak sprite. */
  scale: number;
  /** Opacity of the layer, 0..1. */
  alpha: number;
}

export interface RainLook {
  /** Lean of the streaks from vertical, radians. Positive leans the bottom of the streak toward +x. */
  angle: number;
  /** Index 0 = far (small, slow, faint), 1 = near (long, fast). */
  layers: [RainLayerLook, RainLayerLook];
  /** Ground splashes per second across one nominal screen width. */
  splashRate: number;
  /** Splashes land on the walkable band: groundY plus or minus this many wu. */
  splashBand: number;
  /** Sky and scene darkening while it rains: a flat overlay of this colour and opacity. */
  skyTint: string;
  skyDarken: number;
  /** Seconds for the darkening and the rain to fade in at the start of a battle. */
  fadeIn: number;
  /** Streaks start and end this far outside the screen (wu) so they never pop in or out. */
  overscan: number;
}

export interface LightningLook {
  /**
   * Flash brightness envelope as [seconds since the strike, brightness 0..1] keys,
   * joined by straight lines: a sharp double flash that decays over about 0.6 s.
   */
  flash: readonly (readonly [number, number])[];
  /** Colour of the full-screen flash and of the bolt core. */
  flashColor: string;
  boltColor: string;
  boltGlow: string;
  /** Peak opacity of the full-screen flash overlay. */
  flashAlpha: number;
  /** Seconds the bolt itself stays visible (it follows the flash envelope, cut off here). */
  boltTime: number;
  /** Seconds between the flash and the thunder sound, [min, max]. */
  thunderDelay: readonly [number, number];
  /** Bolt shape. */
  bolt: LightningBoltShape;
}

export interface LightningBoltShape {
  /** Midpoint-displacement passes for the trunk; the trunk has 2^generations segments. */
  generations: number;
  /** Sideways displacement of the first midpoint as a fraction of the bolt length. */
  roughness: number;
  /** How much the displacement shrinks each pass (0.5 = halves). */
  decay: number;
  /** Each midpoint also slides along the line by this fraction of its sideways reach, so the steps are uneven. */
  alongJitter: number;
  /** Branches may sprout only between these fractions of the way along their parent. */
  branchZone: readonly [number, number];
  /** A strike lands between these fractions of the way across the visible strip. */
  strikeZone: readonly [number, number];
  /** Chance that a trunk vertex sprouts a branch, and the same for vertices of a branch. */
  branchChance: number;
  /** Branch nesting limit (1 = branches only off the trunk). */
  maxDepth: number;
  /** Most branches in one bolt. */
  maxBranches: number;
  /** A branch turns away from its parent by an angle in this range, radians. */
  branchAngle: readonly [number, number];
  /** Branch length as a fraction of what is left of its parent, [min, max]. */
  branchLength: readonly [number, number];
  /** Midpoint-displacement passes for a branch. */
  branchGenerations: number;
  /** Stroke width of the trunk in wu, and the factor applied per branch depth. */
  width: number;
  widthFalloff: number;
  /** Brightness factor applied per branch depth. */
  alphaFalloff: number;
  /** The strike starts this far above the top of the screen (wu) so the bolt enters from off-screen. */
  startAbove: number;
  /** Horizontal distance between the top and the bottom of the bolt as a fraction of its height, plus or minus. */
  lean: number;
}

/**
 * Battle lightning with the "Reduce flashing" setting on: the strike, its timing and its thunder are unchanged, but the
 * screen only swells into a slow soft glow (no sharp brightness step) and no bolt is drawn.
 */
export const SOFT_LIGHTNING = {
  /** Glow brightness over time, [seconds since the strike, 0..1]. */
  glow: [
    [0, 0],
    [0.7, 0.5],
    [1.5, 0.32],
    [2.6, 0],
  ] as readonly (readonly [number, number])[],
  /** Opacity of the full-screen glow overlay at brightness 1. */
  alpha: 0.3,
} as const;

export const WEATHER: WeatherConfig & { rain: RainLook; lightning: LightningLook } = {
  rainChance: 0.4,
  thunderCheckInterval: 2,
  thunderChance: 0.005,

  rain: {
    angle: 0.2,
    layers: [
      { streaks: 150, speed: 760, speedJitter: 0.2, scale: 0.7, alpha: 0.4 },
      { streaks: 90, speed: 1250, speedJitter: 0.25, scale: 1.25, alpha: 0.62 },
    ],
    splashRate: 46,
    splashBand: 40,
    skyTint: '#141c27',
    skyDarken: 0.36,
    fadeIn: 2.5,
    overscan: 40,
  },

  lightning: {
    flash: [
      [0, 0],
      [0.02, 1],
      [0.07, 0.3],
      [0.11, 0.16],
      [0.14, 0.86],
      [0.2, 0.5],
      [0.32, 0.22],
      [0.46, 0.08],
      [0.6, 0],
    ],
    flashColor: '#e9efff',
    boltColor: '#ffffff',
    boltGlow: '#a9c2ff',
    flashAlpha: 0.4,
    boltTime: 0.26,
    thunderDelay: [0.35, 2.4],
    bolt: {
      generations: 6,
      roughness: 0.17,
      decay: 0.54,
      alongJitter: 0.3,
      branchZone: [0.08, 0.82],
      strikeZone: [0.15, 0.85],
      branchChance: 0.11,
      maxDepth: 2,
      maxBranches: 9,
      branchAngle: [0.3, 0.75],
      branchLength: [0.25, 0.55],
      branchGenerations: 4,
      width: 3.2,
      widthFalloff: 0.55,
      alphaFalloff: 0.7,
      startAbove: 20,
      lean: 0.22,
    },
  },
};

/**
 * A drifting particle field of the scripted weather (src/fx/sky.ts): screen-space sprites in a band of the view that
 * fall, blow or drift and wrap around. Sizes and the band are view wu; speeds wu/s.
 */
export interface DriftFieldLook {
  sprite: 'flake' | 'dust' | 'smoke' | 'fog';
  /** Particles across one nominal screen width. */
  perScreen: number;
  /** The band (view y) they live in; falling ones re-enter at the top. */
  y0: number;
  y1: number;
  /** Speed ranges, wu/s (vy > 0 falls). */
  vx: readonly [number, number];
  vy: readonly [number, number];
  /** Sideways sway: amplitude (wu) and frequency (Hz). */
  wobble: number;
  wobbleHz: number;
  /** Drawn size (wu) and opacity ranges. */
  size: readonly [number, number];
  alpha: readonly [number, number];
  /** Colour multiplied over the sprite. */
  tint: string;
  /** How far the field slides with the camera pan (0 = fixed to the screen). */
  parallax: number;
}

/** How one kind of scripted weather looks (src/render/weather/sky.ts). Alphas are at full strength. */
export interface WeatherLook {
  /** A flat veil over the sky and the backdrop strips (behind the ground and the units). */
  skyTint: string;
  skyAlpha: number;
  /** A lighter veil over the whole scene, units included. */
  sceneTint: string;
  sceneAlpha: number;
  fields: readonly DriftFieldLook[];
  /** Scripted rain turns on the rain streaks of src/fx/rain.ts. */
  rain?: boolean;
}

const FLAKES = (perScreen: number, vx: readonly [number, number], vy: readonly [number, number], size: readonly [number, number], alpha: readonly [number, number], parallax: number, wobble: number): DriftFieldLook => ({
  sprite: 'flake',
  perScreen,
  y0: -20,
  y1: 560,
  vx,
  vy,
  wobble,
  wobbleHz: 0.35,
  size,
  alpha,
  tint: '#f4f7fa',
  parallax,
});

export const WEATHER_LOOKS: Record<WeatherKind, WeatherLook> = {
  clear: { skyTint: '#ffffff', skyAlpha: 0, sceneTint: '#ffffff', sceneAlpha: 0, fields: [] },
  overcast: { skyTint: '#9ba1a7', skyAlpha: 0.42, sceneTint: '#8c9298', sceneAlpha: 0.06, fields: [] },
  rain: { skyTint: '#5d6670', skyAlpha: 0.2, sceneTint: '#6c737b', sceneAlpha: 0.04, fields: [], rain: true },
  snow: {
    skyTint: '#c7ced6',
    skyAlpha: 0.4,
    sceneTint: '#dfe5ea',
    sceneAlpha: 0.06,
    fields: [FLAKES(110, [-14, 6], [26, 46], [1.6, 2.6], [0.35, 0.6], 0.15, 9), FLAKES(55, [-20, 10], [55, 85], [3, 4.6], [0.55, 0.85], 0.4, 14)],
  },
  blizzard: {
    skyTint: '#d4dade',
    skyAlpha: 0.66,
    sceneTint: '#e3e8ec',
    sceneAlpha: 0.26,
    fields: [FLAKES(260, [-320, -200], [80, 140], [1.4, 2.4], [0.4, 0.7], 0.2, 5), FLAKES(140, [-460, -300], [120, 200], [2.8, 4.4], [0.6, 0.9], 0.5, 8)],
  },
  fog: {
    skyTint: '#c9ced1',
    skyAlpha: 0.72,
    sceneTint: '#cbd0d3',
    sceneAlpha: 0.3,
    fields: [
      { sprite: 'fog', perScreen: 9, y0: 300, y1: 470, vx: [6, 16], vy: [0, 0], wobble: 4, wobbleHz: 0.05, size: [320, 520], alpha: [0.22, 0.38], tint: '#dde1e3', parallax: 0.6 },
    ],
  },
  dust: {
    skyTint: '#c3a87d',
    skyAlpha: 0.42,
    sceneTint: '#b99f73',
    sceneAlpha: 0.16,
    fields: [
      { sprite: 'dust', perScreen: 7, y0: 330, y1: 460, vx: [20, 45], vy: [0, 0], wobble: 6, wobbleHz: 0.08, size: [220, 380], alpha: [0.16, 0.28], tint: '#cdb58c', parallax: 0.7 },
      { sprite: 'flake', perScreen: 60, y0: 300, y1: 520, vx: [30, 70], vy: [-4, 6], wobble: 10, wobbleHz: 0.25, size: [1, 1.8], alpha: [0.2, 0.4], tint: '#d8c49d', parallax: 0.5 },
    ],
  },
  smoke: {
    skyTint: '#7f766b',
    skyAlpha: 0.44,
    sceneTint: '#6e665d',
    sceneAlpha: 0.12,
    fields: [
      { sprite: 'smoke', perScreen: 6, y0: 120, y1: 300, vx: [8, 20], vy: [-3, 0], wobble: 6, wobbleHz: 0.04, size: [260, 460], alpha: [0.18, 0.32], tint: '#6f675f', parallax: 0.25 },
      { sprite: 'flake', perScreen: 30, y0: 80, y1: 520, vx: [6, 20], vy: [8, 18], wobble: 12, wobbleHz: 0.3, size: [0.9, 1.6], alpha: [0.25, 0.45], tint: '#3f3a36', parallax: 0.4 },
    ],
  },
};

/** How a flare looks: a bright star drifting down under its parachute, and the pool of light it throws. */
export const FLARE_LOOK = {
  /** View y it bursts at and the y it has sunk to when it burns out. */
  burstY: 70,
  endY: 230,
  /** Sideways drift over its life (wu). */
  drift: 60,
  /** The star (wu) and its halo; the light pool on the ground is `pool` wu wide. */
  star: 9,
  halo: 120,
  pool: 1500,
  /** Pool opacity in daylight and at full night (the night tint's level picks between them). */
  poolDay: 0.04,
  poolNight: 0.3,
  /** Seconds to flare up and to die away. */
  rise: 0.6,
  fade: 2.5,
  colors: { white: '#fff3d6', green: '#8dff9a' } as Record<'white' | 'green', string>,
};
