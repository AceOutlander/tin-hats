/**
 * The title screen's storm as pure logic, with its own seeded random numbers. No Phaser, no DOM, no clock: time only
 * moves when update(dt) is called, so the app freezes the storm simply by not advancing it.
 *
 * - MenuStorm: exactly one lightning flash per `thunderInterval` seconds of storm time (the remainder is carried, so
 *   frame times of any size add up exactly), a fork on some of them, and for each flash a thunder cue with a random
 *   delay, loudness and length from src/data/menuStorm.ts.
 * - MenuRain: three depths of rain streaks in screen space, their count scaled to the screen area, and the splashes on
 *   the grass.
 * - PanelDrops: a few drops running down the front of the title panel, stopping and sliding like real drops on glass.
 *
 * Fixed-size typed arrays throughout: nothing allocates after construction (MenuRain.layout() only when the screen
 * changes size).
 */
import { MENU_STORM, type MenuStormDef } from '../data/menuStorm';
import { createRng, mixSeed, type Rng01 } from './rng';
import { lightningFlash, lightningFlashDuration } from './weather';

/** Guards the interval comparison against the rounding error of summing frame times. */
const EPSILON = 1e-9;
/** Thunders that can wait at once (a flash every few seconds and delays under a second need one or two). */
const MAX_WAITING = 8;

function range(rng: Rng01, r: readonly [number, number]): number {
  return r[0] + (r[1] - r[0]) * rng();
}

/** One rumble to play now. */
export interface ThunderCue {
  /** 0..1 */
  loudness: number;
  /** Seconds. */
  length: number;
  /** The delay it was given after its flash (seconds). */
  delay: number;
}

/** What the renderer reads each frame. */
export interface MenuStormState {
  /** Sky brightness now, 0..1: the sharp flash envelope, or the soft glow when flashing is reduced. */
  readonly flash: number;
  /** Fork brightness now, 0..1; 0 when no fork is on show (never one when flashing is reduced). */
  readonly fork: number;
  /** Changes with every flash: the renderer shapes a new fork when it does. */
  readonly flashSeq: number;
  /** Seed for the fork's shape, and where it lands around the spire (-1..1). */
  readonly forkSeed: number;
  readonly forkSide: number;
  readonly reduced: boolean;
}

export class MenuStorm implements MenuStormState {
  /** Storm seconds advanced so far. */
  time = 0;
  flashes = 0;
  forks = 0;
  thundersScheduled = 0;
  thundersPlayed = 0;
  reduced = false;
  flash = 0;
  fork = 0;
  flashSeq = 0;
  forkSeed = 0;
  forkSide = 0;
  /** Seconds since the last flash began (Infinity before the first). */
  sinceFlash = Infinity;
  /** The same for the flash before it: a new flash never cuts the light of one still fading (no sudden darkening). */
  private sincePrev = Infinity;
  /** True when the last flash has a fork. */
  forkOn = false;
  /** The cue made for the most recent flash (for the debug hooks and tests). */
  readonly lastCue: ThunderCue = { loudness: 0, length: 0, delay: 0 };

  /** Thunders that fell due in the last update(); valid until the next one. */
  readonly due: ThunderCue[] = [];
  dueCount = 0;

  /** Storm time since the last scheduled flash: the interval's carried remainder. */
  private elapsed = 0;
  private readonly waitLeft = new Float64Array(MAX_WAITING);
  private readonly waitLoud = new Float32Array(MAX_WAITING);
  private readonly waitLength = new Float32Array(MAX_WAITING);
  private readonly waitDelay = new Float32Array(MAX_WAITING);
  private waiting = 0;
  private readonly rng: Rng01;
  private readonly sharpEnd: number;
  private readonly glowEnd: number;

  constructor(
    seed: number,
    private readonly def: MenuStormDef = MENU_STORM,
  ) {
    this.rng = createRng(mixSeed(seed, 0x570a));
    for (let i = 0; i < MAX_WAITING; i++) this.due.push({ loudness: 0, length: 0, delay: 0 });
    this.sharpEnd = lightningFlashDuration(def.flash.keys);
    this.glowEnd = lightningFlashDuration(def.glow.keys);
  }

  /** Thunders scheduled and not yet due. */
  get pending(): number {
    return this.waiting;
  }

  setReduced(on: boolean): void {
    this.reduced = on;
    this.shade();
  }

  /**
   * Advance by dt seconds of storm time. Flashes fall exactly every interval (several in one call if dt is long),
   * and every thunder whose delay has run out is put in `due`. Returns how many are due. dt <= 0 (paused) changes
   * nothing at all. Allocates nothing.
   */
  update(dt: number): number {
    this.dueCount = 0;
    if (!(dt > 0) || dt === Infinity) return 0;
    const interval = this.def.thunderInterval;
    this.time += dt;
    this.sinceFlash += dt;
    this.sincePrev += dt;
    // Thunders already on their way.
    for (let i = 0; i < this.waiting; ) {
      this.waitLeft[i] -= dt;
      if (this.waitLeft[i] <= 0) {
        this.emit(this.waitLoud[i], this.waitLength[i], this.waitDelay[i]);
        this.removeWaiting(i);
      } else {
        i++;
      }
    }
    if (interval > 0) {
      this.elapsed += dt;
      while (this.elapsed + EPSILON >= interval) {
        this.elapsed -= interval;
        // The flash happened `elapsed` seconds ago (the carried remainder): its envelope and thunder start from there.
        this.flashNow(Math.max(0, this.elapsed), null);
      }
    }
    this.shade();
    return this.dueCount;
  }

  /** A flash right now, outside the interval (debug and screenshots). `fork` forces the fork on or off; omitted, it is rolled. */
  forceFlash(fork?: boolean): void {
    this.flashNow(0, fork === undefined ? null : fork);
    this.shade();
  }

  private flashNow(age: number, fork: boolean | null): void {
    const rng = this.rng;
    this.flashes++;
    this.flashSeq++;
    this.sincePrev = this.sinceFlash;
    this.sinceFlash = age;
    // Every flash draws the same random numbers whatever the setting, so turning reduced flashing on or off never
    // shifts the sequence.
    const roll = rng();
    this.forkSeed = Math.floor(rng() * 4294967296);
    this.forkSide = rng() * 2 - 1;
    const wantFork = fork === null ? roll < this.def.forkChance : fork;
    this.forkOn = wantFork && !this.reduced;
    if (this.forkOn) this.forks++;

    // The thunder: a nearer strike (low distance) comes sooner and louder; its length is drawn on its own.
    const T = this.def.thunder;
    const distance = rng();
    const delay = T.delay[0] + (T.delay[1] - T.delay[0]) * distance;
    const loudJitter = rng();
    const loud = Math.min(T.loudness[1], Math.max(T.loudness[0], T.loudness[1] - (T.loudness[1] - T.loudness[0]) * (0.7 * distance + 0.3 * loudJitter)));
    const length = range(rng, T.length);
    this.lastCue.delay = delay;
    this.lastCue.loudness = loud;
    this.lastCue.length = length;
    this.thundersScheduled++;
    const left = delay - age;
    if (left <= 0) {
      this.emit(loud, length, delay);
    } else if (this.waiting < MAX_WAITING) {
      const i = this.waiting++;
      this.waitLeft[i] = left;
      this.waitLoud[i] = loud;
      this.waitLength[i] = length;
      this.waitDelay[i] = delay;
    } else {
      // Only a huge time step can queue this many: let the oldest go now rather than lose one.
      this.emit(this.waitLoud[0], this.waitLength[0], this.waitDelay[0]);
      this.removeWaiting(0);
      const i = this.waiting++;
      this.waitLeft[i] = left;
      this.waitLoud[i] = loud;
      this.waitLength[i] = length;
      this.waitDelay[i] = delay;
    }
  }

  private removeWaiting(i: number): void {
    const last = --this.waiting;
    this.waitLeft[i] = this.waitLeft[last];
    this.waitLoud[i] = this.waitLoud[last];
    this.waitLength[i] = this.waitLength[last];
    this.waitDelay[i] = this.waitDelay[last];
  }

  private emit(loudness: number, length: number, delay: number): void {
    this.thundersPlayed++;
    if (this.dueCount >= this.due.length) return;
    const cue = this.due[this.dueCount++];
    cue.loudness = loudness;
    cue.length = length;
    cue.delay = delay;
  }

  /** Brightness of the sky and the fork for the time since the last flash (and the one before, still fading). */
  private shade(): void {
    const t = this.sinceFlash;
    const keys = this.reduced ? this.def.glow.keys : this.def.flash.keys;
    const end = this.reduced ? this.glowEnd : this.sharpEnd;
    const now = t < end ? lightningFlash(t, keys) : 0;
    const before = this.sincePrev < end ? lightningFlash(this.sincePrev, keys) : 0;
    this.flash = Math.max(now, before);
    this.fork = !this.reduced && this.forkOn && t < this.def.fork.time ? now : 0;
  }
}

/**
 * The rain streaks. Positions are in screen space across the width (x in [0, width) wu from the left edge of the view)
 * and in world y, from above the top of the view to below its bottom. Layer l owns indices [start[l], start[l] + cap[l]);
 * the first count[l] of them are falling.
 */
export class MenuRain {
  readonly layers: number;
  readonly start: Int32Array;
  readonly cap: Int32Array;
  readonly count: Int32Array;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly alpha: Float32Array;
  /** Rotation of every streak of a layer (the sprite is drawn vertical): -angle. */
  readonly rotation: Float32Array;
  width = 0;
  /** Share (0..1) of the rain drawn: the effect quality and the load guard thin streaks and splashes alike. */
  share = 1;
  /** Splashes: a fixed ring. A splash with age >= life is over. */
  readonly splashX: Float32Array;
  readonly splashY: Float32Array;
  readonly splashAge: Float32Array;
  readonly splashScale: Float32Array;
  private readonly speed: Float32Array;
  private readonly dirX: Float32Array;
  private readonly dirY: Float32Array;
  private splashNext = 0;
  private splashDebt = 0;
  private readonly rng: Rng01;

  constructor(
    seed: number,
    private readonly top: number,
    private readonly bottom: number,
    private readonly def: MenuStormDef = MENU_STORM,
  ) {
    const L = def.rain.layers;
    this.layers = L.length;
    this.rng = createRng(mixSeed(seed, 0x4a17));
    this.start = new Int32Array(L.length);
    this.cap = new Int32Array(L.length);
    this.count = new Int32Array(L.length);
    this.rotation = new Float32Array(L.length);
    this.dirX = new Float32Array(L.length);
    this.dirY = new Float32Array(L.length);
    let total = 0;
    for (let l = 0; l < L.length; l++) {
      this.start[l] = total;
      this.cap[l] = L[l].max;
      total += L[l].max;
      this.rotation[l] = -L[l].angle;
      this.dirX[l] = Math.sin(L[l].angle);
      this.dirY[l] = Math.cos(L[l].angle);
    }
    this.x = new Float32Array(total);
    this.y = new Float32Array(total);
    this.alpha = new Float32Array(total);
    this.speed = new Float32Array(total);
    for (let l = 0; l < L.length; l++) {
      for (let k = 0; k < this.cap[l]; k++) {
        const i = this.start[l] + k;
        this.speed[i] = L[l].speed * (1 + L[l].speedJitter * this.rng());
        this.alpha[i] = L[l].alpha * (1 - L[l].alphaJitter * this.rng());
      }
    }
    const n = def.rain.maxSplashes;
    this.splashX = new Float32Array(n);
    this.splashY = new Float32Array(n);
    this.splashAge = new Float32Array(n).fill(Infinity);
    this.splashScale = new Float32Array(n);
  }

  /** Streaks a layer gets on a screen of cssW x cssH CSS px: per megapixel, held between the layer's min and max. */
  static countFor(layer: { perMegapixel: number; min: number; max: number }, cssW: number, cssH: number): number {
    const n = Math.round((layer.perMegapixel * Math.max(0, cssW) * Math.max(0, cssH)) / 1e6);
    return Math.min(layer.max, Math.max(layer.min, n));
  }

  /**
   * Fit the rain to a screen of cssW x cssH CSS px that is widthWu wide. `share` (0..1, the effect quality) thins every
   * layer. Streaks are re-scattered only when the width changes.
   */
  layout(cssW: number, cssH: number, widthWu: number, share = 1): void {
    const L = this.def.rain.layers;
    const widthChanged = Math.abs(widthWu - this.width) > 0.5;
    if (widthChanged) this.width = widthWu;
    this.share = Math.max(0, Math.min(1, share));
    const span = this.bottom - this.top;
    for (let l = 0; l < this.layers; l++) {
      const want = Math.max(1, Math.round(MenuRain.countFor(L[l], cssW, cssH) * this.share));
      const from = widthChanged ? 0 : this.count[l];
      for (let k = from; k < want; k++) {
        const i = this.start[l] + k;
        this.x[i] = this.rng() * this.width;
        this.y[i] = this.top + this.rng() * span;
      }
      this.count[l] = Math.min(this.cap[l], want);
    }
  }

  /** Total streaks falling. */
  total(): number {
    let n = 0;
    for (let l = 0; l < this.layers; l++) n += this.count[l];
    return n;
  }

  /** Splashes on show. */
  splashesLive(): number {
    const life = this.def.rain.splashLife;
    let n = 0;
    for (let i = 0; i < this.splashAge.length; i++) if (this.splashAge[i] < life) n++;
    return n;
  }

  update(dt: number): void {
    if (!(dt > 0) || dt === Infinity || this.width <= 0) return;
    const span = this.bottom - this.top;
    const w = this.width;
    for (let l = 0; l < this.layers; l++) {
      const dx = this.dirX[l];
      const dy = this.dirY[l];
      const first = this.start[l];
      const end = first + this.count[l];
      for (let i = first; i < end; i++) {
        const d = this.speed[i] * dt;
        let nx = this.x[i] + dx * d;
        let ny = this.y[i] + dy * d;
        if (ny > this.bottom) {
          ny -= span * Math.ceil((ny - this.bottom) / span);
          nx = this.rng() * w;
        }
        nx %= w;
        if (nx < 0) nx += w;
        this.x[i] = nx;
        this.y[i] = ny;
      }
    }
    // Splashes age, and new ones land at the rate for this width.
    const R = this.def.rain;
    for (let i = 0; i < this.splashAge.length; i++) this.splashAge[i] += dt;
    this.splashDebt += (R.splashRate * this.share * w * Math.min(dt, 0.25)) / 1000;
    let due = Math.floor(this.splashDebt);
    this.splashDebt -= due;
    const n = this.splashAge.length;
    while (due-- > 0) {
      const i = this.splashNext;
      this.splashNext = (i + 1) % n;
      const depth = this.rng();
      this.splashX[i] = this.rng() * w;
      this.splashY[i] = R.splashBand[0] + (R.splashBand[1] - R.splashBand[0]) * depth;
      this.splashScale[i] = R.splashScale[0] + (R.splashScale[1] - R.splashScale[0]) * depth;
      this.splashAge[i] = 0;
    }
  }
}

/**
 * The title's load guard: watches the real time between frames and, when frames stay slow, sheds rain step by step
 * down to a floor; after a long calm it takes it back. Pure arithmetic, so it runs in unit tests with made-up frames.
 */
export class StormGuard {
  /** Share of the rain to draw, floor..1. */
  share = 1;
  /** Smoothed real frame time (ms). */
  avgMs: number;
  sheds = 0;
  restores = 0;
  private slow = 0;
  private fast = 0;

  constructor(private readonly cfg: MenuStormDef['guard'] = MENU_STORM.guard) {
    this.avgMs = (cfg.slowFrameMs + cfg.fastFrameMs) / 2;
  }

  /** One frame: `intervalMs` is the real time since the previous one. */
  update(intervalMs: number): void {
    const c = this.cfg;
    if (!(intervalMs > 0) || intervalMs > c.ignoreAboveMs) return;
    const dt = intervalMs / 1000;
    this.avgMs += (intervalMs - this.avgMs) * (1 - Math.exp(-dt / c.smoothSeconds));
    if (this.avgMs > c.slowFrameMs) {
      this.slow += dt;
      this.fast = 0;
    } else if (this.avgMs < c.fastFrameMs) {
      this.fast += dt;
      this.slow = 0;
    } else {
      this.slow = 0;
      this.fast = 0;
    }
    if (this.slow >= c.shedAfter && this.share > c.floor) {
      this.share = Math.max(c.floor, this.share * c.step);
      this.sheds++;
      this.settle();
    } else if (this.fast >= c.restoreAfter && this.share < 1) {
      this.share = Math.min(1, this.share / c.step);
      this.restores++;
      this.settle();
    }
  }

  /** After a step, judge the new load from a neutral start. */
  private settle(): void {
    this.slow = 0;
    this.fast = 0;
    this.avgMs = (this.cfg.slowFrameMs + this.cfg.fastFrameMs) / 2;
  }
}

/** Drops on the front of the title panel. Implements PanelDropsState (src/ui/contracts.ts) structurally. */
export class PanelDrops {
  count: number;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly trail: Float32Array;
  readonly size: Float32Array;
  readonly alpha: Float32Array;
  version = 0;
  /** Per drop: seconds left of the current hold (> 0), or of the wait before it forms again (while hidden). */
  private readonly timer: Float32Array;
  /** Per drop: sliding speed (panel heights/s) while sliding, 0 while holding. */
  private readonly speed: Float32Array;
  /** Per drop: distance left in the current slide. */
  private readonly left: Float32Array;
  /** Per drop: 0 forming, 1 on the panel, 2 waiting to form. */
  private readonly phase: Uint8Array;
  private readonly rng: Rng01;

  constructor(
    seed: number,
    private readonly def: MenuStormDef = MENU_STORM,
  ) {
    const n = def.panelDrops.count;
    this.count = n;
    this.rng = createRng(mixSeed(seed, 0xd209));
    this.x = new Float32Array(n);
    this.y = new Float32Array(n);
    this.trail = new Float32Array(n);
    this.size = new Float32Array(n);
    this.alpha = new Float32Array(n);
    this.timer = new Float32Array(n);
    this.speed = new Float32Array(n);
    this.left = new Float32Array(n);
    this.phase = new Uint8Array(n);
    // Start staggered: some already on the panel, some still to form.
    for (let i = 0; i < n; i++) {
      this.form(i);
      if (i % 2 === 1) {
        this.phase[i] = 2;
        this.alpha[i] = 0;
        this.timer[i] = range(this.rng, def.panelDrops.respawn);
      } else {
        this.alpha[i] = def.panelDrops.alpha;
        this.phase[i] = 1;
      }
    }
  }

  private form(i: number): void {
    const D = this.def.panelDrops;
    this.x[i] = 0.04 + 0.92 * this.rng();
    this.y[i] = range(this.rng, D.formBand);
    this.size[i] = range(this.rng, D.size);
    this.trail[i] = 0;
    this.speed[i] = 0;
    this.left[i] = 0;
    this.timer[i] = range(this.rng, D.hold);
    this.phase[i] = 0;
    this.alpha[i] = 0;
  }

  update(dt: number): void {
    if (!(dt > 0) || dt === Infinity) return;
    const D = this.def.panelDrops;
    const step = Math.min(dt, 0.25);
    // The version only moves when something on the panel changed, so a still frame costs the UI no redraw.
    let changed = false;
    for (let i = 0; i < this.count; i++) {
      const phase = this.phase[i];
      if (phase === 2) {
        this.timer[i] -= step;
        if (this.timer[i] <= 0) this.form(i);
        continue;
      }
      if (phase === 0) {
        this.alpha[i] = Math.min(D.alpha, this.alpha[i] + (D.alpha * step) / Math.max(0.01, D.appear));
        if (this.alpha[i] >= D.alpha) this.phase[i] = 1;
        changed = true;
      }
      if (this.speed[i] > 0) {
        // Sliding: the head runs down and leaves a wet trail behind it.
        const d = Math.min(this.left[i], this.speed[i] * step);
        this.y[i] += d;
        this.trail[i] = Math.min(D.trailMax, this.trail[i] + d);
        this.left[i] -= d;
        changed = true;
        if (this.left[i] <= 0) {
          this.speed[i] = 0;
          this.timer[i] = range(this.rng, D.hold);
        }
      } else {
        // Holding: the trail dries; then the drop lets go again.
        if (this.trail[i] > 0) {
          this.trail[i] = Math.max(0, this.trail[i] - D.trailDry * step);
          changed = true;
        }
        this.timer[i] -= step;
        if (this.timer[i] <= 0) {
          this.speed[i] = range(this.rng, D.speed);
          this.left[i] = range(this.rng, D.slide);
        }
      }
      if (this.y[i] - this.trail[i] > 1.02) {
        // Off the bottom: gone until it forms again near the top.
        this.phase[i] = 2;
        this.alpha[i] = 0;
        this.trail[i] = 0;
        this.timer[i] = range(this.rng, D.respawn);
        changed = true;
      }
    }
    if (changed) this.version++;
  }
}
