/**
 * Effects data: particle presets, sprite keys, layers and screen shake.
 * View only. The maths that plays these presets is in src/fx/particles.ts and
 * the textures are drawn by src/art/fx.
 *
 * Units: positions and sizes in world units (wu), speeds in wu/s, gravity in
 * wu/s^2 (positive pulls down the screen), angles in radians, times in seconds.
 * A standing figure is 58 wu tall.
 */
import type { FactionId, WeaponDef } from './schema';
import { DEPTH } from './view';

export type Range = readonly [number, number];

/* ------------------------------------------------------------------ */
/* Sprite keys                                                         */
/* ------------------------------------------------------------------ */

function family(prefix: string, count: number): readonly string[] {
  const keys: string[] = [];
  for (let i = 0; i < count; i++) keys.push(`${prefix}/${i}`);
  return keys;
}

/** Particle texture families. Every key has a SpriteSpec in src/art/fx. */
export const FX_SPRITES = {
  /** Soft grey-brown smoke puffs. */
  smoke: family('fx/smoke', 4),
  /** Oily black smoke for burning tanks and exhausts. */
  smokeDark: family('fx/smokeDark', 3),
  /** Pale, very soft puffs for smoke screens. */
  smokeLight: family('fx/smokeLight', 3),
  /** Tan dust. */
  dust: family('fx/dust', 3),
  /** Explosion fireball, played in order: white-hot core to dark smoke. */
  fireball: family('fx/fireball', 6),
  /** Flame tongues. */
  flame: family('fx/flame', 3),
  /** Flash stars for explosions. */
  flash: family('fx/flash', 3),
  /** Directional muzzle flashes pointing along +x, anchored at the muzzle. */
  muzzle: family('fx/muzzle', 3),
  /** Soft warm round glow. */
  glow: family('fx/glow', 1),
  /** Small starburst where a round strikes metal. */
  hitSpark: family('fx/hitSpark', 2),
  /** 0 = streak pointing along +x, 1 = ember dot. */
  spark: family('fx/spark', 2),
  dirt: family('fx/dirt', 4),
  /** Elongated dirt streaks for explosion fountains, pointing along +x. */
  plume: family('fx/plume', 2),
  /** Concrete and metal chunks. */
  debris: family('fx/debris', 4),
  /** Wood splinters. */
  splinter: family('fx/splinter', 3),
  /** Scraps of cloth and webbing. */
  cloth: family('fx/cloth', 3),
  /** Bits of barbed wire. */
  wire: family('fx/wire', 2),
  /** 0 = small brass, 1 = big shell case. */
  casing: family('fx/casing', 2),
  droplet: family('fx/droplet', 2),
  /** White water spray puffs. */
  spray: family('fx/spray', 2),
  /** Ground splash ring, played in order. */
  rainSplash: family('fx/rainSplash', 3),
} as const;

export type FxSpriteFamily = keyof typeof FX_SPRITES;

/**
 * Every particle sprite key in a fixed order. The particle system reports
 * sprites as indices into this list.
 */
export const FX_SPRITE_KEYS: readonly string[] = (Object.keys(FX_SPRITES) as FxSpriteFamily[]).flatMap(
  (name) => FX_SPRITES[name],
);

/** Keys of the effect textures that are not particles. */
export const FX_KEYS = {
  tracer: {
    rifle: 'fx/tracer/rifle',
    mg: 'fx/tracer/mg',
    smg: 'fx/tracer/smg',
    sniper: 'fx/tracer/sniper',
  },
  projectile: {
    stickGrenade: 'fx/proj/stickGrenade',
    millsBomb: 'fx/proj/millsBomb',
    mortar: 'fx/proj/mortar',
    rocket: 'fx/proj/rocket',
    shell: 'fx/proj/shell',
    bomb: 'fx/proj/bomb',
  },
  rain: {
    far: 'fx/rain/far',
    near: 'fx/rain/near',
  },
  ui: {
    reticle: 'fx/ui/reticle',
    selectRing: 'fx/ui/selectRing',
    orderMarker: 'fx/ui/orderMarker',
  },
  decal: {
    crater: ['fx/decal/crater/0', 'fx/decal/crater/1'],
    scorch: 'fx/decal/scorch',
  },
} as const;

export type TracerLook = Exclude<WeaponDef['tracer'], 'none'>;
export type ProjectileLook = Exclude<WeaponDef['projectileLook'], 'none'>;

/** How the renderer should fly each tracer sprite from muzzle to target. */
export const FX_TRACERS: Record<TracerLook, { sprite: string; speed: number; alpha: number }> = {
  rifle: { sprite: FX_KEYS.tracer.rifle, speed: 3200, alpha: 0.8 },
  mg: { sprite: FX_KEYS.tracer.mg, speed: 3000, alpha: 0.95 },
  smg: { sprite: FX_KEYS.tracer.smg, speed: 2600, alpha: 0.7 },
  sniper: { sprite: FX_KEYS.tracer.sniper, speed: 4200, alpha: 0.9 },
};

/** Projectile sprite for each WeaponDef.projectileLook; grenades differ per faction. */
export const FX_PROJECTILE_SPRITE: Record<ProjectileLook, Record<FactionId, string>> = {
  grenade: { british: FX_KEYS.projectile.millsBomb, german: FX_KEYS.projectile.stickGrenade },
  mortar: { british: FX_KEYS.projectile.mortar, german: FX_KEYS.projectile.mortar },
  rocket: { british: FX_KEYS.projectile.rocket, german: FX_KEYS.projectile.rocket },
  shell: { british: FX_KEYS.projectile.shell, german: FX_KEYS.projectile.shell },
  bomb: { british: FX_KEYS.projectile.bomb, german: FX_KEYS.projectile.bomb },
};

/* ------------------------------------------------------------------ */
/* Layers                                                              */
/* ------------------------------------------------------------------ */

/**
 * Where a particle is drawn. The particle system reports the index into this
 * list. `additive` asks for an additive (lighten) blend.
 */
export const FX_LAYERS = [
  { name: 'ground', depth: DEPTH.shadows, additive: false },
  { name: 'effects', depth: DEPTH.effects, additive: false },
  { name: 'glow', depth: DEPTH.effects, additive: true },
  { name: 'smokeScreen', depth: DEPTH.smokeScreen, additive: false },
] as const;

export type FxLayerName = (typeof FX_LAYERS)[number]['name'];

/* ------------------------------------------------------------------ */
/* Screen shake                                                        */
/* ------------------------------------------------------------------ */

export type FxShakeSize = 'small' | 'medium' | 'large';

/** Peak camera offset (wu) and how long it takes to die away (s), per explosion size. */
export const FX_SHAKE: Record<FxShakeSize, { amplitude: number; duration: number }> = {
  small: { amplitude: 2.2, duration: 0.22 },
  medium: { amplitude: 5, duration: 0.38 },
  large: { amplitude: 10, duration: 0.6 },
};

/* ------------------------------------------------------------------ */
/* General tunables                                                    */
/* ------------------------------------------------------------------ */

export const FX = {
  /** Most particles alive at once; extra spawns are dropped. */
  capacity: 1536,
  /** A bouncing particle comes to rest when it lands slower than this (wu/s). */
  restSpeed: 55,
  /** Default sideways drift picked up by smoke (wu/s). */
  wind: 14,
  /** Shake wobble rates on x and y (rad/s) and the most the camera may be displaced (wu). */
  shakeRateX: 71,
  shakeRateY: 93,
  /** Vertical shake as a fraction of the horizontal. */
  shakeYRatio: 0.7,
  shakeMax: 14,
  /** Shake falls to nothing when the blast is this far outside the screen edge (wu). */
  shakeFalloff: 900,
} as const;

/* ------------------------------------------------------------------ */
/* Particle presets                                                    */
/* ------------------------------------------------------------------ */

export interface FxEmitterDef {
  /** Textures to use (keys from FX_SPRITES). */
  sprites: readonly string[];
  /** pick = each particle keeps one random sprite; animate = plays the list once over its life. Default pick. */
  spriteMode?: 'pick' | 'animate';
  layer: FxLayerName;
  /** Particles per spawn, inclusive. */
  count: Range;
  /** Seconds before a particle appears: staggers smoke columns and secondary bursts. Default none. */
  delay?: Range;
  life: Range;

  /**
   * Launch direction. dir = the direction given to spawn(); up = straight up;
   * any = all round; sides = flat along the ground to the left or right, with
   * `spread` lifting it upward only.
   */
  aim: 'dir' | 'up' | 'any' | 'sides';
  /** With aim 'dir': turn the direction toward screen-up by this angle, mirrored for left-facing spawns. */
  turnUp?: number;
  /** Full width of the launch cone. */
  spread: number;
  speed: Range;
  /** Start this far along the launch direction (wu). */
  forward?: Range;
  /** Random start offset, plus or minus (wu). */
  jitterX?: number;
  jitterY?: number;

  /** Positive falls, negative rises. Default 0. */
  gravity?: number;
  /** Velocity lost per second (exponential). Default 0. */
  drag?: number;
  /** Share of the system wind this particle drifts with. Default 0. */
  wind?: number;
  /** What happens at the ground line. Default none (passes through). */
  ground?: 'none' | 'bounce' | 'stick' | 'die';
  /** With ground 'bounce': vertical speed kept per bounce, and sideways speed and spin kept. */
  bounce?: number;
  friction?: number;

  /** Starting scale (1 = the sprite's own size in wu). */
  scale: Range;
  /** End scale as a multiple of the starting scale. Default 1. */
  grow?: number;
  /** 1 = steady growth; larger = most of the growth happens early (billowing). Default 1. */
  growEase?: number;
  /** Peak opacity. Default 1. */
  alpha?: number;
  /** Fraction of life spent fading in. Default 0. */
  fadeIn?: number;
  /** Fraction of life after which it fades out. Default 0.6. */
  fadeOut?: number;
  /** none = upright; random = any angle; aim = fixed along the launch direction; velocity = follows its motion. Default none. */
  rotation?: 'none' | 'random' | 'aim' | 'velocity';
  /** Spin speed, rad/s, random sign. Default none. */
  spin?: Range;
}

export interface FxPresetDef {
  emitters: readonly FxEmitterDef[];
  /** Screen shake to add when this plays. */
  shake?: FxShakeSize;
  /** For continuous effects: spawn again this often (s) while the source lasts. */
  interval?: number;
  /** Ground decal to leave behind (a key from FX_KEYS.decal) and its size multiplier. */
  decal?: string;
  decalScale?: number;
}

const S = FX_SPRITES;

export const FX_PRESETS = {
  /** Small-arms muzzle flash. dir = the barrel direction. */
  muzzleFlash: {
    emitters: [
      { sprites: S.muzzle, layer: 'glow', count: [1, 1], life: [0.05, 0.08], aim: 'dir', spread: 0.12, speed: [0, 0], scale: [0.62, 0.9], grow: 1.25, fadeOut: 0.3, rotation: 'aim' },
      { sprites: S.glow, layer: 'glow', count: [1, 1], life: [0.06, 0.09], aim: 'dir', spread: 0, speed: [0, 0], forward: [6, 6], scale: [0.4, 0.5], alpha: 0.55, fadeOut: 0.2 },
      { sprites: S.smoke, layer: 'effects', count: [1, 2], life: [0.35, 0.65], aim: 'dir', spread: 0.6, speed: [30, 90], forward: [4, 10], gravity: -22, drag: 4.5, wind: 0.6, scale: [0.12, 0.18], grow: 2.4, growEase: 2, alpha: 0.32, fadeOut: 0.25, rotation: 'random', spin: [0.3, 1.5] },
    ],
  },

  /** Tank or anti-tank gun firing: long flash, blast smoke and dust kicked off the ground. */
  tankMuzzle: {
    shake: 'small',
    emitters: [
      { sprites: S.muzzle, layer: 'glow', count: [1, 1], life: [0.09, 0.12], aim: 'dir', spread: 0.06, speed: [0, 0], scale: [2.4, 2.9], grow: 1.3, fadeOut: 0.35, rotation: 'aim' },
      { sprites: S.flash, layer: 'glow', count: [1, 1], life: [0.07, 0.1], aim: 'dir', spread: 0, speed: [0, 0], forward: [10, 10], scale: [0.55, 0.7], fadeOut: 0.3, rotation: 'random' },
      { sprites: S.smoke, layer: 'effects', count: [4, 6], life: [0.7, 1.3], aim: 'dir', spread: 0.5, speed: [90, 300], forward: [6, 26], gravity: -18, drag: 4, wind: 0.8, scale: [0.28, 0.45], grow: 2.2, growEase: 2, alpha: 0.5, fadeOut: 0.3, rotation: 'random', spin: [0.2, 1] },
      { sprites: S.dust, layer: 'effects', count: [3, 5], delay: [0.02, 0.08], life: [0.6, 1], aim: 'sides', spread: 0.3, speed: [40, 130], jitterX: 20, gravity: -8, drag: 3.5, wind: 0.6, scale: [0.35, 0.5], grow: 2.2, growEase: 2, alpha: 0.34, fadeOut: 0.3, rotation: 'random', spin: [0.2, 0.8] },
    ],
  },

  /** Ejected cartridge. dir = the way the shooter faces; the case flips up and back and bounces. */
  casing: {
    emitters: [
      { sprites: [S.casing[0]], layer: 'effects', count: [1, 1], life: [0.9, 1.3], aim: 'dir', turnUp: 2.05, spread: 0.5, speed: [95, 165], gravity: 760, ground: 'bounce', bounce: 0.4, friction: 0.55, scale: [1, 1], fadeOut: 0.8, rotation: 'random', spin: [12, 26] },
    ],
  },

  /** Big brass from a tank or anti-tank gun. */
  shellCasing: {
    emitters: [
      { sprites: [S.casing[1]], layer: 'effects', count: [1, 1], life: [1.4, 1.9], aim: 'dir', turnUp: 2.3, spread: 0.4, speed: [70, 120], gravity: 760, ground: 'bounce', bounce: 0.32, friction: 0.5, scale: [1, 1], fadeOut: 0.8, rotation: 'random', spin: [6, 12] },
    ],
  },

  /** A bullet striking the ground. */
  bulletDirt: {
    emitters: [
      { sprites: S.dust, layer: 'effects', count: [2, 3], life: [0.3, 0.55], aim: 'up', spread: 1, speed: [30, 95], gravity: -10, drag: 5, wind: 0.5, scale: [0.14, 0.22], grow: 2.3, growEase: 2, alpha: 0.5, fadeOut: 0.3, rotation: 'random', spin: [0.4, 1.6] },
      { sprites: S.dirt, layer: 'effects', count: [2, 4], life: [0.4, 0.6], aim: 'up', spread: 1.3, speed: [90, 200], gravity: 640, ground: 'die', scale: [0.4, 0.75], fadeOut: 0.8, rotation: 'random', spin: [4, 12] },
    ],
  },

  /** Dust from a running boot. dir = the way the unit is moving. */
  footDust: {
    emitters: [
      { sprites: S.dust, layer: 'ground', count: [1, 2], life: [0.35, 0.6], aim: 'dir', turnUp: 2.75, spread: 0.5, speed: [10, 34], jitterX: 2, gravity: -12, drag: 3, wind: 0.5, scale: [0.13, 0.2], grow: 2.6, growEase: 2, alpha: 0.44, fadeIn: 0.1, fadeOut: 0.3, rotation: 'random', spin: [0.3, 1.2] },
    ],
  },

  /** Dust thrown up behind tank tracks. dir = the way the tank is moving. */
  trackDust: {
    interval: 0.09,
    emitters: [
      { sprites: S.dust, layer: 'effects', count: [2, 3], life: [0.7, 1.2], aim: 'dir', turnUp: 2.7, spread: 0.6, speed: [25, 80], jitterX: 8, gravity: -14, drag: 2.4, wind: 0.8, scale: [0.26, 0.42], grow: 2.6, growEase: 2, alpha: 0.32, fadeIn: 0.08, fadeOut: 0.3, rotation: 'random', spin: [0.2, 0.9] },
      { sprites: S.dirt, layer: 'effects', count: [0, 2], life: [0.35, 0.55], aim: 'dir', turnUp: 2.4, spread: 0.6, speed: [70, 150], gravity: 620, ground: 'die', scale: [0.35, 0.6], fadeOut: 0.8, rotation: 'random', spin: [4, 10] },
    ],
  },

  /** Engine exhaust. dir = the way the pipe points. */
  exhaust: {
    interval: 0.16,
    emitters: [
      { sprites: S.smokeDark, layer: 'effects', count: [1, 1], life: [0.7, 1.15], aim: 'dir', spread: 0.4, speed: [30, 60], gravity: -50, drag: 1.6, wind: 1, scale: [0.11, 0.17], grow: 3.2, growEase: 1.6, alpha: 0.4, fadeIn: 0.1, fadeOut: 0.3, rotation: 'random', spin: [0.3, 1.2] },
    ],
  },

  /** Smoke trail behind a rocket. dir = opposite to its flight. */
  rocketTrail: {
    interval: 0.03,
    emitters: [
      { sprites: S.smoke, layer: 'effects', count: [1, 1], life: [0.45, 0.8], aim: 'dir', spread: 0.5, speed: [10, 40], gravity: -10, drag: 2, wind: 0.6, scale: [0.13, 0.2], grow: 2.6, growEase: 2, alpha: 0.55, fadeOut: 0.25, rotation: 'random', spin: [0.3, 1.2] },
    ],
  },

  /** Hand grenade. */
  grenadeBurst: {
    shake: 'small',
    decal: FX_KEYS.decal.scorch,
    decalScale: 0.6,
    emitters: [
      { sprites: S.flash, layer: 'glow', count: [1, 1], life: [0.08, 0.1], aim: 'up', spread: 0, speed: [0, 0], forward: [8, 8], scale: [0.8, 1], grow: 1.25, fadeOut: 0.3, rotation: 'random' },
      { sprites: S.fireball, spriteMode: 'animate', layer: 'effects', count: [1, 1], life: [0.32, 0.4], aim: 'up', spread: 0, speed: [12, 20], forward: [12, 12], scale: [0.52, 0.62], grow: 1.5, growEase: 2.5, fadeOut: 0.7, rotation: 'random' },
      { sprites: S.plume, layer: 'effects', count: [4, 6], life: [0.3, 0.46], aim: 'up', spread: 2, speed: [140, 280], gravity: 560, drag: 1.2, scale: [0.32, 0.5], grow: 1.3, alpha: 0.62, fadeOut: 0.3, rotation: 'velocity' },
      { sprites: S.dirt, layer: 'effects', count: [8, 12], life: [0.6, 1], aim: 'up', spread: 2, speed: [150, 320], gravity: 640, ground: 'die', scale: [0.35, 0.7], fadeOut: 0.85, rotation: 'random', spin: [4, 14] },
      { sprites: S.smoke, layer: 'effects', count: [4, 6], delay: [0.03, 0.16], life: [0.9, 1.5], aim: 'up', spread: 1.5, speed: [30, 95], jitterX: 8, gravity: -26, drag: 2.4, wind: 0.8, scale: [0.34, 0.52], grow: 2, growEase: 2, alpha: 0.6, fadeIn: 0.08, fadeOut: 0.35, rotation: 'random', spin: [0.2, 0.9] },
      { sprites: S.dust, layer: 'effects', count: [3, 4], life: [0.5, 0.8], aim: 'sides', spread: 0.35, speed: [70, 150], gravity: -6, drag: 4, wind: 0.5, scale: [0.3, 0.42], grow: 2.2, growEase: 2, alpha: 0.38, fadeOut: 0.3, rotation: 'random', spin: [0.2, 0.9] },
    ],
  },

  /** Mortar bomb or tank shell. */
  shellExplosion: {
    shake: 'medium',
    decal: FX_KEYS.decal.crater[0],
    decalScale: 1,
    emitters: [
      { sprites: S.flash, layer: 'glow', count: [1, 1], life: [0.09, 0.12], aim: 'up', spread: 0, speed: [0, 0], forward: [14, 14], scale: [1.4, 1.7], grow: 1.3, fadeOut: 0.3, rotation: 'random' },
      { sprites: S.glow, layer: 'glow', count: [1, 1], life: [0.2, 0.26], aim: 'up', spread: 0, speed: [0, 0], forward: [18, 18], scale: [2, 2.4], alpha: 0.5, fadeOut: 0.1 },
      { sprites: S.fireball, spriteMode: 'animate', layer: 'effects', count: [1, 1], life: [0.5, 0.6], aim: 'up', spread: 0, speed: [22, 34], forward: [22, 22], scale: [0.95, 1.1], grow: 1.55, growEase: 2.5, fadeOut: 0.72, rotation: 'random' },
      { sprites: S.fireball, spriteMode: 'animate', layer: 'effects', count: [2, 3], delay: [0.02, 0.08], life: [0.36, 0.5], aim: 'up', spread: 1.8, speed: [40, 110], forward: [10, 22], drag: 3, scale: [0.45, 0.6], grow: 1.5, growEase: 2.5, fadeOut: 0.7, rotation: 'random' },
      { sprites: S.plume, layer: 'effects', count: [7, 10], life: [0.4, 0.65], aim: 'up', spread: 1.5, speed: [200, 420], gravity: 620, drag: 1.4, scale: [0.48, 0.82], grow: 1.35, alpha: 0.65, fadeOut: 0.35, rotation: 'velocity' },
      { sprites: S.dirt, layer: 'effects', count: [14, 20], life: [0.8, 1.4], aim: 'up', spread: 1.7, speed: [200, 440], gravity: 640, ground: 'die', scale: [0.45, 1], fadeOut: 0.85, rotation: 'random', spin: [4, 14] },
      { sprites: S.debris, layer: 'effects', count: [3, 5], life: [1.3, 1.9], aim: 'up', spread: 1.5, speed: [200, 400], gravity: 640, ground: 'bounce', bounce: 0.3, friction: 0.5, scale: [0.5, 0.9], fadeOut: 0.8, rotation: 'random', spin: [5, 14] },
      { sprites: S.smokeDark, layer: 'effects', count: [2, 3], delay: [0.04, 0.2], life: [1.2, 1.9], aim: 'up', spread: 0.8, speed: [30, 90], jitterX: 8, gravity: -24, drag: 1.5, wind: 1, scale: [0.5, 0.7], grow: 1.9, growEase: 2, alpha: 0.5, fadeIn: 0.1, fadeOut: 0.35, rotation: 'random', spin: [0.15, 0.5] },
      { sprites: S.smoke, layer: 'effects', count: [7, 10], delay: [0.05, 0.5], life: [1.6, 2.7], aim: 'up', spread: 0.7, speed: [40, 125], jitterX: 14, gravity: -30, drag: 1.3, wind: 1, scale: [0.5, 0.8], grow: 2.1, growEase: 2, alpha: 0.62, fadeIn: 0.08, fadeOut: 0.35, rotation: 'random', spin: [0.15, 0.6] },
      { sprites: S.dust, layer: 'effects', count: [5, 7], life: [0.6, 1], aim: 'sides', spread: 0.3, speed: [120, 240], gravity: -6, drag: 4, wind: 0.5, scale: [0.4, 0.6], grow: 2.3, growEase: 2, alpha: 0.4, fadeOut: 0.3, rotation: 'random', spin: [0.2, 0.8] },
    ],
  },

  /** Artillery shell or aircraft bomb. */
  bigExplosion: {
    shake: 'large',
    decal: FX_KEYS.decal.crater[1],
    decalScale: 1.5,
    emitters: [
      { sprites: S.flash, layer: 'glow', count: [1, 1], life: [0.11, 0.14], aim: 'up', spread: 0, speed: [0, 0], forward: [24, 24], scale: [2.4, 2.8], grow: 1.3, fadeOut: 0.3, rotation: 'random' },
      { sprites: S.glow, layer: 'glow', count: [1, 1], life: [0.28, 0.34], aim: 'up', spread: 0, speed: [0, 0], forward: [30, 30], scale: [3.6, 4.2], alpha: 0.55, fadeOut: 0.1 },
      { sprites: S.fireball, spriteMode: 'animate', layer: 'effects', count: [1, 1], life: [0.62, 0.75], aim: 'up', spread: 0, speed: [30, 46], forward: [40, 40], scale: [1.7, 2], grow: 1.6, growEase: 2.5, fadeOut: 0.72, rotation: 'random' },
      { sprites: S.fireball, spriteMode: 'animate', layer: 'effects', count: [4, 6], delay: [0.02, 0.14], life: [0.45, 0.62], aim: 'up', spread: 2.2, speed: [70, 190], forward: [14, 36], drag: 3, scale: [0.7, 1], grow: 1.5, growEase: 2.5, fadeOut: 0.7, rotation: 'random' },
      { sprites: S.plume, layer: 'effects', count: [11, 15], life: [0.55, 0.9], aim: 'up', spread: 1.5, speed: [280, 580], gravity: 640, drag: 1.3, scale: [0.72, 1.25], grow: 1.45, alpha: 0.7, fadeOut: 0.35, rotation: 'velocity' },
      { sprites: S.dirt, layer: 'effects', count: [24, 32], life: [1, 1.8], aim: 'up', spread: 1.8, speed: [260, 600], gravity: 640, ground: 'die', scale: [0.6, 1.3], fadeOut: 0.85, rotation: 'random', spin: [4, 14] },
      { sprites: S.debris, layer: 'effects', count: [6, 9], life: [1.6, 2.4], aim: 'up', spread: 1.6, speed: [240, 540], gravity: 640, ground: 'bounce', bounce: 0.3, friction: 0.5, scale: [0.7, 1.2], fadeOut: 0.8, rotation: 'random', spin: [5, 14] },
      { sprites: [S.spark[1]], layer: 'glow', count: [8, 12], life: [0.5, 1], aim: 'up', spread: 2, speed: [220, 520], gravity: 420, drag: 1.2, scale: [0.7, 1.3], grow: 0.4, fadeOut: 0.4 },
      { sprites: S.smokeDark, layer: 'effects', count: [4, 5], delay: [0.04, 0.3], life: [2, 3], aim: 'up', spread: 0.6, speed: [60, 150], jitterX: 16, gravity: -34, drag: 1.2, wind: 1, scale: [0.7, 1], grow: 2.2, growEase: 2, alpha: 0.5, fadeIn: 0.08, fadeOut: 0.35, rotation: 'random', spin: [0.15, 0.5] },
      { sprites: S.smoke, layer: 'effects', count: [10, 14], delay: [0.06, 0.8], life: [2.2, 3.6], aim: 'up', spread: 0.8, speed: [50, 170], jitterX: 26, gravity: -32, drag: 1.2, wind: 1, scale: [0.75, 1.2], grow: 2.2, growEase: 2, alpha: 0.58, fadeIn: 0.08, fadeOut: 0.35, rotation: 'random', spin: [0.1, 0.5] },
      { sprites: S.dust, layer: 'effects', count: [8, 10], life: [0.8, 1.3], aim: 'sides', spread: 0.3, speed: [180, 360], gravity: -6, drag: 3.6, wind: 0.5, scale: [0.6, 0.9], grow: 2.4, growEase: 2, alpha: 0.42, fadeOut: 0.3, rotation: 'random', spin: [0.2, 0.7] },
    ],
  },

  /** A pillbox breaking up: concrete chunks and a grey dust cloud. */
  pillboxDebris: {
    shake: 'medium',
    emitters: [
      { sprites: S.debris, layer: 'effects', count: [11, 15], life: [1.6, 2.6], aim: 'up', spread: 2.2, speed: [140, 400], jitterX: 22, jitterY: 12, gravity: 640, ground: 'bounce', bounce: 0.32, friction: 0.55, scale: [0.6, 1.5], fadeOut: 0.82, rotation: 'random', spin: [3, 12] },
      { sprites: S.dirt, layer: 'effects', count: [8, 12], life: [0.7, 1.2], aim: 'up', spread: 2.2, speed: [140, 360], jitterX: 20, gravity: 640, ground: 'die', scale: [0.5, 1], fadeOut: 0.85, rotation: 'random', spin: [4, 12] },
      { sprites: S.smoke, layer: 'effects', count: [7, 9], delay: [0, 0.25], life: [1.4, 2.4], aim: 'up', spread: 2.6, speed: [30, 120], jitterX: 30, jitterY: 14, gravity: -16, drag: 2, wind: 0.8, scale: [0.6, 0.95], grow: 2, growEase: 2, alpha: 0.5, fadeIn: 0.1, fadeOut: 0.3, rotation: 'random', spin: [0.1, 0.6] },
      { sprites: S.dust, layer: 'effects', count: [5, 6], life: [0.8, 1.2], aim: 'sides', spread: 0.3, speed: [90, 200], jitterX: 20, gravity: -6, drag: 3.6, wind: 0.5, scale: [0.5, 0.75], grow: 2.2, growEase: 2, alpha: 0.4, fadeOut: 0.3, rotation: 'random', spin: [0.2, 0.7] },
    ],
  },

  /** Barbed wire cut or crushed. */
  wireSnap: {
    emitters: [
      { sprites: S.wire, layer: 'effects', count: [5, 7], life: [0.8, 1.3], aim: 'up', spread: 2.4, speed: [110, 270], jitterX: 16, jitterY: 8, gravity: 640, ground: 'bounce', bounce: 0.25, friction: 0.5, scale: [0.7, 1.1], fadeOut: 0.8, rotation: 'random', spin: [8, 20] },
      { sprites: S.splinter, layer: 'effects', count: [2, 3], life: [0.8, 1.2], aim: 'up', spread: 1.8, speed: [110, 220], jitterX: 12, gravity: 640, ground: 'bounce', bounce: 0.25, friction: 0.5, scale: [0.7, 1], fadeOut: 0.8, rotation: 'random', spin: [6, 14] },
      { sprites: [S.spark[0]], layer: 'glow', count: [2, 4], life: [0.12, 0.25], aim: 'up', spread: 2.6, speed: [160, 320], gravity: 420, drag: 2, scale: [0.5, 0.9], grow: 0.4, fadeOut: 0.4, rotation: 'velocity' },
      { sprites: S.dust, layer: 'effects', count: [2, 3], life: [0.4, 0.7], aim: 'up', spread: 2, speed: [20, 60], jitterX: 14, gravity: -8, drag: 3, wind: 0.5, scale: [0.2, 0.3], grow: 2.2, growEase: 2, alpha: 0.36, fadeOut: 0.3, rotation: 'random', spin: [0.3, 1] },
    ],
  },

  /**
   * One breath of a smoke screen: large, soft, long-lived and drifting. Spawn
   * it every `interval` at random points across the cloud while the screen lasts.
   */
  smokeScreen: {
    interval: 0.3,
    emitters: [
      { sprites: S.smokeLight, layer: 'smokeScreen', count: [2, 3], life: [3.6, 5.6], aim: 'any', spread: 0, speed: [6, 26], jitterX: 46, jitterY: 20, gravity: -5, drag: 0.8, wind: 1, scale: [1.2, 1.9], grow: 1.55, growEase: 1.6, alpha: 0.46, fadeIn: 0.16, fadeOut: 0.55, rotation: 'random', spin: [0.03, 0.18] },
    ],
  },

  /** The pop of a smoke shell as the screen starts. */
  smokeBurst: {
    emitters: [
      { sprites: S.smokeLight, layer: 'smokeScreen', count: [6, 8], life: [2.4, 3.6], aim: 'up', spread: 2.8, speed: [60, 190], gravity: -4, drag: 2.2, wind: 1, scale: [0.6, 1], grow: 2.4, growEase: 2, alpha: 0.5, fadeIn: 0.06, fadeOut: 0.45, rotation: 'random', spin: [0.05, 0.3] },
      { sprites: S.dirt, layer: 'effects', count: [4, 6], life: [0.5, 0.8], aim: 'up', spread: 1.8, speed: [120, 240], gravity: 640, ground: 'die', scale: [0.4, 0.8], fadeOut: 0.85, rotation: 'random', spin: [4, 12] },
    ],
  },

  /** A soldier is hit. No blood: a puff of dust and scraps of cloth. dir = the direction of the blow. */
  hitPuff: {
    emitters: [
      { sprites: S.dust, layer: 'effects', count: [2, 3], life: [0.28, 0.5], aim: 'dir', spread: 1.3, speed: [30, 100], gravity: -8, drag: 5, wind: 0.5, scale: [0.14, 0.22], grow: 2.2, growEase: 2, alpha: 0.5, fadeOut: 0.3, rotation: 'random', spin: [0.4, 1.6] },
      { sprites: S.cloth, layer: 'effects', count: [2, 3], life: [0.55, 0.95], aim: 'dir', turnUp: 0.5, spread: 1.3, speed: [70, 190], gravity: 300, drag: 2.6, wind: 0.5, ground: 'stick', scale: [0.6, 1], fadeOut: 0.7, rotation: 'random', spin: [5, 14] },
    ],
  },

  /** A supply crate smashed. */
  crateSplinters: {
    emitters: [
      { sprites: S.splinter, layer: 'effects', count: [7, 10], life: [0.9, 1.5], aim: 'up', spread: 2.3, speed: [120, 310], jitterX: 8, jitterY: 6, gravity: 640, ground: 'bounce', bounce: 0.28, friction: 0.5, scale: [0.5, 0.9], fadeOut: 0.8, rotation: 'random', spin: [6, 18] },
      { sprites: S.dust, layer: 'effects', count: [3, 4], life: [0.5, 0.9], aim: 'up', spread: 2.4, speed: [25, 80], jitterX: 10, gravity: -8, drag: 3, wind: 0.5, scale: [0.26, 0.4], grow: 2.2, growEase: 2, alpha: 0.4, fadeOut: 0.3, rotation: 'random', spin: [0.3, 1] },
    ],
  },

  /** One raindrop landing. */
  rainSplash: {
    emitters: [
      { sprites: S.rainSplash, spriteMode: 'animate', layer: 'ground', count: [1, 1], life: [0.2, 0.3], aim: 'up', spread: 0, speed: [0, 0], scale: [0.4, 0.65], alpha: 0.75, fadeOut: 0.5 },
      { sprites: S.droplet, layer: 'ground', count: [1, 2], life: [0.16, 0.26], aim: 'up', spread: 1.5, speed: [35, 70], gravity: 520, scale: [0.35, 0.5], alpha: 0.7, fadeOut: 0.5, rotation: 'velocity' },
    ],
  },

  /** A shell or body landing in water. */
  waterSplash: {
    emitters: [
      { sprites: S.spray, layer: 'effects', count: [6, 8], life: [0.5, 0.8], aim: 'up', spread: 0.45, speed: [170, 380], jitterX: 6, gravity: 620, drag: 1.4, scale: [0.4, 0.7], grow: 1.9, growEase: 2, alpha: 0.75, fadeOut: 0.4, rotation: 'random', spin: [0.3, 1.2] },
      { sprites: S.droplet, layer: 'effects', count: [12, 16], life: [0.6, 1], aim: 'up', spread: 1.3, speed: [170, 400], gravity: 640, ground: 'die', scale: [0.7, 1.3], alpha: 0.85, fadeOut: 0.7, rotation: 'velocity' },
      { sprites: S.rainSplash, spriteMode: 'animate', layer: 'ground', count: [1, 1], life: [0.45, 0.55], aim: 'up', spread: 0, speed: [0, 0], scale: [2.6, 3], grow: 1.6, alpha: 0.7, fadeOut: 0.5 },
      { sprites: S.spray, layer: 'effects', count: [3, 4], life: [0.3, 0.45], aim: 'sides', spread: 0.5, speed: [60, 130], gravity: 80, drag: 3, scale: [0.3, 0.45], grow: 2, growEase: 2, alpha: 0.55, fadeOut: 0.3, rotation: 'random' },
    ],
  },

  /** A round glancing off armour. dir = the way the sparks fly (back toward the shooter). */
  armourSparks: {
    emitters: [
      { sprites: S.hitSpark, layer: 'glow', count: [1, 1], life: [0.06, 0.09], aim: 'dir', spread: 0, speed: [0, 0], scale: [0.8, 1.2], fadeOut: 0.3, rotation: 'random' },
      { sprites: [S.spark[0]], layer: 'glow', count: [9, 13], life: [0.2, 0.45], aim: 'dir', spread: 1.7, speed: [200, 500], gravity: 520, drag: 1.6, scale: [0.9, 1.5], grow: 0.35, fadeOut: 0.45, rotation: 'velocity' },
      { sprites: [S.spark[1]], layer: 'glow', count: [2, 4], life: [0.3, 0.55], aim: 'dir', spread: 2, speed: [120, 300], gravity: 520, drag: 1, ground: 'bounce', bounce: 0.4, friction: 0.6, scale: [0.7, 1.1], grow: 0.4, fadeOut: 0.4 },
      { sprites: S.smoke, layer: 'effects', count: [1, 1], life: [0.3, 0.5], aim: 'dir', spread: 0.8, speed: [20, 50], gravity: -20, drag: 3, wind: 0.5, scale: [0.12, 0.18], grow: 2.2, growEase: 2, alpha: 0.3, fadeOut: 0.3, rotation: 'random' },
    ],
  },

  /** A knocked-out tank burning. Spawn every `interval` at the engine deck. */
  tankFire: {
    interval: 0.1,
    emitters: [
      { sprites: S.glow, layer: 'glow', count: [1, 1], life: [0.14, 0.2], aim: 'up', spread: 0, speed: [0, 0], forward: [8, 8], scale: [0.9, 1.2], alpha: 0.3, fadeIn: 0.3, fadeOut: 0.4 },
      { sprites: S.flame, layer: 'glow', count: [2, 3], life: [0.3, 0.55], aim: 'up', spread: 0.5, speed: [35, 95], jitterX: 13, jitterY: 3, gravity: -90, drag: 1, scale: [0.5, 0.85], grow: 0.45, alpha: 0.9, fadeIn: 0.12, fadeOut: 0.5 },
      { sprites: S.smokeDark, layer: 'effects', count: [1, 2], delay: [0, 0.08], life: [1.8, 2.9], aim: 'up', spread: 0.45, speed: [50, 90], forward: [18, 30], jitterX: 8, gravity: -26, drag: 0.6, wind: 1, scale: [0.3, 0.46], grow: 3.2, growEase: 1.6, alpha: 0.6, fadeIn: 0.12, fadeOut: 0.4, rotation: 'random', spin: [0.1, 0.5] },
      { sprites: [S.spark[1]], layer: 'glow', count: [0, 1], life: [0.6, 1.1], aim: 'up', spread: 0.9, speed: [80, 170], jitterX: 10, gravity: -20, drag: 1, wind: 1, scale: [0.4, 0.7], grow: 0.4, fadeOut: 0.4 },
    ],
  },
} as const satisfies Record<string, FxPresetDef>;

export type FxPresetId = keyof typeof FX_PRESETS;

export const FX_PRESET_IDS = Object.keys(FX_PRESETS) as FxPresetId[];
