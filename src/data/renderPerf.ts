/**
 * Tunables of the renderer's performance guards (src/render/quality.ts and the caps in src/render/effects):
 * the quality levels the frame-time governor moves between, and the particle caps each level carries.
 */

export interface QualityLevel {
  name: string;
  /**
   * Share of every particle burst that is spawned (1 = all). A burst always keeps at least one particle while the
   * density is above zero.
   */
  density: number;
  /** Chance that a low-priority effect (dust, casings, exhaust, rain splashes) is allowed at all. */
  lowShare: number;
  /**
   * Live particles: low-priority effects stop at softCap, bursts thin out between softCap and hardCap (down to
   * RENDER_PERF.minDensity of their size) and nothing spawns at hardCap. The particle pool is never larger than the
   * top level's hardCap.
   */
  softCap: number;
  hardCap: number;
  /** Only every Nth tracer is drawn (1 = all). Shots, hits and sounds are unaffected. */
  tracerEvery: number;
  /** Share of the rain streaks and splashes drawn (1 = all). */
  weatherShare: number;
}

export interface QualityTunables {
  /** The governor looks at this smoothed real frame time (ms); above dropFrameMs for dropAfter seconds it lowers the level one step. */
  dropFrameMs: number;
  dropAfter: number;
  /** Below raiseFrameMs for raiseAfter seconds it raises the level one step again. */
  raiseFrameMs: number;
  raiseAfter: number;
  /** Time constant (s) of the frame-time average. */
  smoothSeconds: number;
  /** A frame longer than this (a hidden tab, a battle being built) is not counted. */
  ignoreAboveMs: number;
  /** When a level drops again within flapWindow seconds of a raise, the next raise waits this many times longer (up to maxBackoff). */
  flapWindow: number;
  maxBackoff: number;
  /** Best first. */
  levels: readonly QualityLevel[];
}

export const RENDER_PERF = {
  quality: {
    dropFrameMs: 24,
    dropAfter: 2.5,
    raiseFrameMs: 19,
    raiseAfter: 20,
    smoothSeconds: 1,
    ignoreAboveMs: 200,
    flapWindow: 60,
    maxBackoff: 8,
    levels: [
      { name: 'high', density: 1, lowShare: 1, softCap: 650, hardCap: 1000, tracerEvery: 1, weatherShare: 1 },
      { name: 'medium', density: 0.6, lowShare: 0.5, softCap: 420, hardCap: 700, tracerEvery: 2, weatherShare: 0.6 },
      { name: 'low', density: 0.35, lowShare: 0.15, softCap: 260, hardCap: 440, tracerEvery: 3, weatherShare: 0.3 },
    ],
  } as QualityTunables,
  /** Between softCap and hardCap a burst shrinks to this share of its size at the hard cap. */
  minDensity: 0.25,
} as const;
