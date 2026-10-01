/**
 * Extra particle presets used by the battlefield renderer (src/render/effects).
 * They extend FX_PRESETS from ./fx and use the same emitter format and units
 * (wu, wu/s, seconds, radians). View only.
 */
import { FX_SPRITES, type FxPresetDef } from './fx';

const S = FX_SPRITES;

export const RENDER_FX_PRESETS = {
  /** A soldier falls: a low skirt of dust around his feet and a puff above it. */
  deathDust: {
    emitters: [
      { sprites: S.dust, layer: 'ground', count: [3, 4], life: [0.5, 0.9], aim: 'sides', spread: 0.35, speed: [25, 75], jitterX: 7, gravity: -8, drag: 3, wind: 0.5, scale: [0.2, 0.32], grow: 2.4, growEase: 2, alpha: 0.5, fadeOut: 0.3, rotation: 'random', spin: [0.3, 1] },
      { sprites: S.dust, layer: 'effects', count: [2, 3], life: [0.6, 1], aim: 'up', spread: 1, speed: [20, 55], jitterX: 5, gravity: -10, drag: 2.5, wind: 0.6, scale: [0.16, 0.26], grow: 2.4, growEase: 2, alpha: 0.38, fadeOut: 0.3, rotation: 'random', spin: [0.3, 1] },
    ],
  },

  /** Supplies delivered: a quick pop of gold sparks and light dust at the door. */
  supplyPop: {
    emitters: [
      { sprites: S.glow, layer: 'glow', count: [1, 1], life: [0.22, 0.3], aim: 'up', spread: 0, speed: [0, 0], scale: [0.75, 0.9], alpha: 0.5, fadeOut: 0.1 },
      { sprites: [S.spark[1]], layer: 'glow', count: [9, 12], life: [0.45, 0.8], aim: 'up', spread: 2.6, speed: [70, 170], gravity: 320, drag: 1.4, scale: [0.7, 1.4], grow: 0.4, fadeOut: 0.4 },
      { sprites: S.dust, layer: 'effects', count: [3, 4], life: [0.4, 0.7], aim: 'sides', spread: 0.5, speed: [30, 80], gravity: -8, drag: 3, wind: 0.5, scale: [0.18, 0.28], grow: 2.2, growEase: 2, alpha: 0.4, fadeOut: 0.3, rotation: 'random', spin: [0.3, 1] },
    ],
  },

  /** A trained unit steps out: a soft puff of dust and a short warm glow at the doorway. */
  trainPuff: {
    emitters: [
      { sprites: S.glow, layer: 'glow', count: [1, 1], life: [0.25, 0.32], aim: 'up', spread: 0, speed: [0, 0], scale: [0.9, 1.1], alpha: 0.3, fadeOut: 0.1 },
      { sprites: S.dust, layer: 'effects', count: [5, 7], life: [0.55, 0.95], aim: 'up', spread: 2.4, speed: [25, 80], jitterX: 8, gravity: -10, drag: 2.5, wind: 0.6, scale: [0.2, 0.34], grow: 2.4, growEase: 2, alpha: 0.5, fadeIn: 0.05, fadeOut: 0.35, rotation: 'random', spin: [0.3, 1] },
    ],
  },

  /** Dark smoke leaking from a damaged bunker. Spawn every `interval`. */
  hqSmoke: {
    interval: 0.3,
    emitters: [
      { sprites: S.smokeDark, layer: 'effects', count: [1, 1], life: [2.2, 3.4], aim: 'up', spread: 0.5, speed: [30, 60], jitterX: 6, gravity: -22, drag: 0.8, wind: 1, scale: [0.28, 0.42], grow: 3, growEase: 1.6, alpha: 0.5, fadeIn: 0.12, fadeOut: 0.45, rotation: 'random', spin: [0.1, 0.4] },
    ],
  },

  /** A ruined bunker's pall: thicker, taller smoke. Spawn every `interval`. */
  hqRuinSmoke: {
    interval: 0.16,
    emitters: [
      { sprites: S.smokeDark, layer: 'effects', count: [1, 2], life: [3, 4.6], aim: 'up', spread: 0.6, speed: [40, 85], jitterX: 22, gravity: -26, drag: 0.7, wind: 1, scale: [0.42, 0.62], grow: 3.2, growEase: 1.6, alpha: 0.55, fadeIn: 0.1, fadeOut: 0.5, rotation: 'random', spin: [0.08, 0.3] },
    ],
  },

  /** A thin trail behind a shell, bomb or mortar round. dir = opposite to its flight. */
  projTrailThin: {
    interval: 0.022,
    emitters: [
      { sprites: S.smoke, layer: 'effects', count: [1, 1], life: [0.35, 0.65], aim: 'dir', spread: 0.4, speed: [4, 18], gravity: -8, drag: 2, wind: 0.5, scale: [0.09, 0.13], grow: 2.2, growEase: 2, alpha: 0.34, fadeOut: 0.3, rotation: 'random' },
    ],
  },

  /** A faint pool of light around a muzzle flash or blast: strong only at night (the renderer scales the count). */
  flashGlow: {
    emitters: [
      { sprites: S.glow, layer: 'glow', count: [1, 1], life: [0.07, 0.11], aim: 'up', spread: 0, speed: [0, 0], scale: [1.7, 2.2], alpha: 0.34, fadeOut: 0.2 },
    ],
  },

  /** A round hitting concrete or steel: grit and a few sparks. dir = back toward the shooter. */
  concreteHit: {
    emitters: [
      { sprites: S.hitSpark, layer: 'glow', count: [1, 1], life: [0.05, 0.08], aim: 'dir', spread: 0, speed: [0, 0], scale: [0.5, 0.8], fadeOut: 0.3, rotation: 'random' },
      { sprites: S.debris, layer: 'effects', count: [1, 2], life: [0.4, 0.7], aim: 'dir', spread: 1.5, speed: [40, 110], gravity: 560, ground: 'die', scale: [0.2, 0.4], fadeOut: 0.8, rotation: 'random', spin: [4, 12] },
      { sprites: S.dust, layer: 'effects', count: [1, 2], life: [0.3, 0.55], aim: 'dir', spread: 1.4, speed: [15, 50], gravity: -8, drag: 4, wind: 0.5, scale: [0.1, 0.17], grow: 2.2, growEase: 2, alpha: 0.4, fadeOut: 0.3, rotation: 'random' },
    ],
  },

  /** A crate or canopy settling on the ground. */
  landingDust: {
    emitters: [
      { sprites: S.dust, layer: 'ground', count: [5, 7], life: [0.6, 1.1], aim: 'sides', spread: 0.3, speed: [50, 130], jitterX: 10, gravity: -6, drag: 3.4, wind: 0.5, scale: [0.28, 0.42], grow: 2.4, growEase: 2, alpha: 0.5, fadeOut: 0.3, rotation: 'random', spin: [0.2, 0.8] },
      { sprites: S.dust, layer: 'effects', count: [3, 4], life: [0.6, 1], aim: 'up', spread: 1.5, speed: [30, 80], jitterX: 8, gravity: -10, drag: 2.5, wind: 0.6, scale: [0.2, 0.3], grow: 2.3, growEase: 2, alpha: 0.4, fadeOut: 0.3, rotation: 'random', spin: [0.3, 1] },
    ],
  },

  /** A headquarters collapsing: a wall of dust, chunks of concrete and long-lived smoke. */
  hqCollapse: {
    shake: 'large',
    emitters: [
      { sprites: S.debris, layer: 'effects', count: [16, 22], life: [1.8, 3], aim: 'up', spread: 2.4, speed: [160, 520], jitterX: 90, jitterY: 20, gravity: 640, ground: 'bounce', bounce: 0.3, friction: 0.55, scale: [0.8, 1.9], fadeOut: 0.85, rotation: 'random', spin: [3, 12] },
      { sprites: S.dirt, layer: 'effects', count: [14, 18], life: [0.9, 1.6], aim: 'up', spread: 2.4, speed: [160, 440], jitterX: 90, gravity: 640, ground: 'die', scale: [0.6, 1.2], fadeOut: 0.85, rotation: 'random', spin: [4, 12] },
      { sprites: S.dust, layer: 'effects', count: [9, 12], life: [1.2, 2.2], aim: 'sides', spread: 0.35, speed: [90, 260], jitterX: 60, gravity: -6, drag: 2.6, wind: 0.5, scale: [0.7, 1.1], grow: 2.4, growEase: 2, alpha: 0.5, fadeOut: 0.35, rotation: 'random', spin: [0.15, 0.6] },
      { sprites: S.smokeDark, layer: 'effects', count: [6, 8], delay: [0.05, 0.7], life: [3, 4.6], aim: 'up', spread: 1.1, speed: [40, 120], jitterX: 80, jitterY: 20, gravity: -30, drag: 1, wind: 1, scale: [0.7, 1.1], grow: 2.4, growEase: 2, alpha: 0.6, fadeIn: 0.08, fadeOut: 0.4, rotation: 'random', spin: [0.1, 0.4] },
      { sprites: S.smoke, layer: 'effects', count: [8, 10], delay: [0.1, 1], life: [2.6, 4], aim: 'up', spread: 1, speed: [40, 130], jitterX: 90, gravity: -30, drag: 1, wind: 1, scale: [0.8, 1.3], grow: 2.2, growEase: 2, alpha: 0.6, fadeIn: 0.08, fadeOut: 0.4, rotation: 'random', spin: [0.1, 0.5] },
    ],
  },
} as const satisfies Record<string, FxPresetDef>;

export type RenderFxPresetId = keyof typeof RENDER_FX_PRESETS;
