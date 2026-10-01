/**
 * Lightning: a pure bolt-shape generator and a small state holder that plays
 * the flash envelope and times the thunder. View only; no Phaser, no DOM.
 */
import { VIEW } from '../data/view';
import { WEATHER, type LightningBoltShape, type LightningLook } from '../data/weather';
import { createRng, type Rng01 } from './rng';
import { lightningFlash, lightningFlashDuration, thunderDelay } from './weather';

/**
 * A bolt as a set of polylines for the renderer to stroke. Polyline 0 is the
 * trunk from the sky to the ground; the rest are branches that end in the air.
 */
export interface LightningBolt {
  /** x, y pairs for every polyline, back to back. */
  readonly points: Float32Array;
  /** Number of polylines in use. */
  count: number;
  /** Index of the first point (not the first float) of each polyline. */
  readonly start: Uint16Array;
  /** Number of points in each polyline. */
  readonly length: Uint16Array;
  /** Stroke width (wu) and brightness (0..1) of each polyline. */
  readonly width: Float32Array;
  readonly alpha: Float32Array;
  /** 0 = trunk, 1 = branch, 2 = branch of a branch. */
  readonly depth: Uint8Array;
}

function pointsPerLine(generations: number): number {
  return (1 << generations) + 1;
}

/** A reusable buffer big enough for any bolt of the given shape. */
export function createBoltBuffer(shape: LightningBoltShape = WEATHER.lightning.bolt): LightningBolt {
  const lines = 1 + shape.maxBranches;
  const points = pointsPerLine(shape.generations) + shape.maxBranches * pointsPerLine(shape.branchGenerations);
  return {
    points: new Float32Array(points * 2),
    count: 0,
    start: new Uint16Array(lines),
    length: new Uint16Array(lines),
    width: new Float32Array(lines),
    alpha: new Float32Array(lines),
    depth: new Uint8Array(lines),
  };
}

/**
 * Fill points [first, first + 2^generations] with a jagged line from A to B by
 * midpoint displacement: each pass halves the gaps and pushes the new midpoint
 * sideways (and a little along the line) by a shrinking random amount.
 */
function jaggedLine(
  pts: Float32Array,
  first: number,
  generations: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  shape: LightningBoltShape,
  rng: Rng01,
): void {
  const segments = 1 << generations;
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  const ux = len > 0 ? dx / len : 0;
  const uy = len > 0 ? dy / len : 1;
  pts[first * 2] = ax;
  pts[first * 2 + 1] = ay;
  pts[(first + segments) * 2] = bx;
  pts[(first + segments) * 2 + 1] = by;
  let reach = len * shape.roughness;
  for (let step = segments; step > 1; step >>= 1) {
    const half = step >> 1;
    for (let i = half; i < segments; i += step) {
      const a = (first + i - half) * 2;
      const b = (first + i + half) * 2;
      const side = (rng() * 2 - 1) * reach;
      const along = (rng() * 2 - 1) * reach * shape.alongJitter;
      const o = (first + i) * 2;
      // The normal of (ux, uy) is (-uy, ux).
      pts[o] = (pts[a] + pts[b]) * 0.5 - uy * side + ux * along;
      pts[o + 1] = (pts[a + 1] + pts[b + 1]) * 0.5 + ux * side + uy * along;
    }
    reach *= shape.decay;
  }
}

/**
 * Build a jagged, branching bolt from (x0, y0) in the sky to (x1, y1) on the
 * horizon. Pure: the same seed and end points always give the same bolt.
 * Pass `out` (from createBoltBuffer with the same shape) to reuse a buffer.
 */
export function generateBolt(
  seed: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  shape: LightningBoltShape = WEATHER.lightning.bolt,
  out: LightningBolt = createBoltBuffer(shape),
): LightningBolt {
  const rng = createRng(seed);
  const pts = out.points;
  const trunkPoints = pointsPerLine(shape.generations);
  const branchPoints = pointsPerLine(shape.branchGenerations);
  const maxLines = Math.min(out.start.length, 1 + shape.maxBranches);

  jaggedLine(pts, 0, shape.generations, x0, y0, x1, y1, shape, rng);
  out.start[0] = 0;
  out.length[0] = trunkPoints;
  out.width[0] = shape.width;
  out.alpha[0] = 1;
  out.depth[0] = 0;
  let lines = 1;
  let nextPoint = trunkPoints;

  // Walk the polylines made so far (the list grows as branches are added) and let their vertices sprout.
  for (let p = 0; p < lines && lines < maxLines; p++) {
    const depth = out.depth[p];
    if (depth >= shape.maxDepth) continue;
    const first = out.start[p];
    const n = out.length[p];
    const endX = pts[(first + n - 1) * 2];
    const endY = pts[(first + n - 1) * 2 + 1];
    // No branches right at the cloud or at the tip.
    const from = Math.max(1, Math.floor(n * shape.branchZone[0]));
    const to = Math.floor(n * shape.branchZone[1]);
    for (let i = from; i < to && lines < maxLines; i++) {
      if (rng() >= shape.branchChance) continue;
      const vx = pts[(first + i) * 2];
      const vy = pts[(first + i) * 2 + 1];
      const restX = endX - vx;
      const restY = endY - vy;
      const rest = Math.hypot(restX, restY);
      if (!(rest > 0)) continue;
      const turn =
        (shape.branchAngle[0] + (shape.branchAngle[1] - shape.branchAngle[0]) * rng()) * (rng() < 0.5 ? -1 : 1);
      const reach = rest * (shape.branchLength[0] + (shape.branchLength[1] - shape.branchLength[0]) * rng());
      const cos = Math.cos(turn);
      const sin = Math.sin(turn);
      const dirX = (restX * cos - restY * sin) / rest;
      const dirY = (restX * sin + restY * cos) / rest;
      jaggedLine(pts, nextPoint, shape.branchGenerations, vx, vy, vx + dirX * reach, vy + dirY * reach, shape, rng);
      out.start[lines] = nextPoint;
      out.length[lines] = branchPoints;
      out.width[lines] = out.width[p] * shape.widthFalloff;
      out.alpha[lines] = out.alpha[p] * shape.alphaFalloff;
      out.depth[lines] = depth + 1;
      lines++;
      nextPoint += branchPoints;
    }
  }
  out.count = lines;
  return out;
}

/** Plays one strike: bolt shape, flash brightness over time and the delayed thunder. */
export interface LightningFx {
  /** The current (or last) bolt, in view space. Valid while boltAlpha > 0. */
  readonly bolt: LightningBolt;
  /** Full-screen flash brightness 0..1 right now. Multiply by look.flashAlpha for the overlay opacity. */
  readonly flash: number;
  /** Bolt brightness 0..1 right now. */
  readonly boltAlpha: number;
  /** True while a flash is playing. */
  readonly active: boolean;
  /**
   * Start a strike somewhere across the visible strip [viewLeft, viewLeft + viewWidth]
   * (any consistent x units; the bolt comes back in the same space, y in view wu).
   */
  strike(viewLeft: number, viewWidth: number): void;
  /** Advance. Returns true on the one frame when the thunder sound is due. Allocates nothing. */
  update(dtSeconds: number): boolean;
}

class LightningPlayer implements LightningFx {
  readonly bolt: LightningBolt;
  flash = 0;
  boltAlpha = 0;
  active = false;

  private time = 0;
  private thunderIn = -1;
  private readonly duration: number;
  private readonly rng01: Rng01;
  private readonly look: LightningLook;

  constructor(rng01: Rng01, look: LightningLook) {
    this.rng01 = rng01;
    this.look = look;
    this.bolt = createBoltBuffer(look.bolt);
    this.duration = lightningFlashDuration(look.flash);
  }

  strike(viewLeft: number, viewWidth: number): void {
    const shape = this.look.bolt;
    const rng = this.rng01;
    const top = -shape.startAbove;
    const bottom = VIEW.horizonY;
    const x1 = viewLeft + viewWidth * (shape.strikeZone[0] + (shape.strikeZone[1] - shape.strikeZone[0]) * rng());
    const x0 = x1 + (bottom - top) * shape.lean * (rng() * 2 - 1);
    generateBolt(Math.floor(rng() * 4294967296), x0, top, x1, bottom, shape, this.bolt);
    this.time = 0;
    this.active = true;
    this.flash = lightningFlash(0, this.look.flash);
    this.boltAlpha = this.flash;
    const delay = thunderDelay(rng, this.look.thunderDelay);
    // If a rumble is already on its way, keep the earlier one.
    this.thunderIn = this.thunderIn >= 0 ? Math.min(this.thunderIn, delay) : delay;
  }

  update(dtSeconds: number): boolean {
    if (!(dtSeconds > 0)) return false;
    if (this.active) {
      this.time += dtSeconds;
      if (this.time >= this.duration) {
        this.active = false;
        this.flash = 0;
        this.boltAlpha = 0;
      } else {
        this.flash = lightningFlash(this.time, this.look.flash);
        this.boltAlpha = this.time < this.look.boltTime ? this.flash : 0;
      }
    }
    if (this.thunderIn >= 0) {
      this.thunderIn -= dtSeconds;
      if (this.thunderIn <= 0) {
        this.thunderIn = -1;
        return true;
      }
    }
    return false;
  }
}

export function createLightning(rng01: Rng01, look: LightningLook = WEATHER.lightning): LightningFx {
  return new LightningPlayer(rng01, look);
}
