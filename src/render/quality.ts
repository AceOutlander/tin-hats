/**
 * Quality governor: watches the real time between frames and lowers the effect
 * level (particle density, caps, tracers, rain) when frames stay slow, then
 * raises it again after a long calm. Pure arithmetic, no Phaser: it runs in
 * unit tests with made-up frame times. Tunables: src/data/renderPerf.ts.
 */
import { type QualityLevel, type QualityTunables, RENDER_PERF } from '../data/renderPerf';

/**
 * The share of a particle burst to spawn when `count` particles are alive: the level's density up to its soft cap,
 * then shrinking toward RENDER_PERF.minDensity of it at the hard cap, and none at or past the hard cap.
 */
export function burstDensity(level: QualityLevel, count: number): number {
  if (count >= level.hardCap) return 0;
  const crowd = count - level.softCap;
  if (crowd <= 0) return level.density;
  return level.density * Math.max(RENDER_PERF.minDensity, 1 - crowd / (level.hardCap - level.softCap));
}

/**
 * Which level to pin at start-up, or null to let the frame times decide. `?quality=auto` lets them decide, `?quality=N`
 * pins level N. Without the parameter the governor is on for people and off (full quality) under browser automation,
 * where software rendering makes frame times meaningless and the tests and screenshots should look the same every run.
 */
export function startQuality(search: string, automated: boolean): number | null {
  const q = new URLSearchParams(search).get('quality');
  if (q === 'auto') return null;
  if (q !== null && /^\d+$/.test(q)) return Number(q);
  return automated ? 0 : null;
}

export class QualityGovernor {
  /** Index into the levels (0 = best). */
  level = 0;
  /** Smoothed real frame time (ms). */
  avgMs: number;
  /** Times the level went down and up since the start (for the debug hooks and tests). */
  drops = 0;
  raises = 0;

  private forced = -1;
  private slow = 0;
  private fast = 0;
  private sinceRaise = Infinity;
  private backoff = 1;

  constructor(private readonly cfg: QualityTunables = RENDER_PERF.quality) {
    this.avgMs = (cfg.dropFrameMs + cfg.raiseFrameMs) / 2;
  }

  get current(): QualityLevel {
    return this.cfg.levels[this.level];
  }

  /** True while a level is pinned (force()): frame times are then not acted on. */
  get pinned(): boolean {
    return this.forced >= 0;
  }

  /** Pin a level (a debug page or a test), or null to let the frame times decide again. */
  force(level: number | null): void {
    if (level === null) {
      this.forced = -1;
      return;
    }
    this.forced = Math.max(0, Math.min(this.cfg.levels.length - 1, Math.round(level)));
    this.level = this.forced;
  }

  /** One frame: `intervalMs` is the real time since the previous frame. */
  update(intervalMs: number): void {
    const cfg = this.cfg;
    if (this.forced >= 0 || !(intervalMs > 0) || intervalMs > cfg.ignoreAboveMs) return;
    const dt = intervalMs / 1000;
    this.avgMs += (intervalMs - this.avgMs) * (1 - Math.exp(-dt / cfg.smoothSeconds));
    this.sinceRaise += dt;
    if (this.avgMs > cfg.dropFrameMs) {
      this.slow += dt;
      this.fast = 0;
    } else if (this.avgMs < cfg.raiseFrameMs) {
      this.fast += dt;
      this.slow = 0;
    } else {
      this.slow = 0;
      this.fast = 0;
    }
    if (this.slow >= cfg.dropAfter && this.level < cfg.levels.length - 1) {
      if (this.sinceRaise < cfg.flapWindow) this.backoff = Math.min(cfg.maxBackoff, this.backoff * 2);
      this.level++;
      this.drops++;
      this.settle();
    } else if (this.fast >= cfg.raiseAfter * this.backoff && this.level > 0) {
      this.level--;
      this.raises++;
      this.sinceRaise = 0;
      this.settle();
    }
  }

  /** After a change, measure the new level from a neutral start. */
  private settle(): void {
    this.slow = 0;
    this.fast = 0;
    this.avgMs = (this.cfg.dropFrameMs + this.cfg.raiseFrameMs) / 2;
  }
}
