/**
 * Rain streak field: where every streak is on the screen, at two depths, and
 * how many ground splashes are due. View only; no Phaser, no DOM. Fixed size,
 * no allocation after creation.
 *
 * The field lives in screen space (wu): x in [0, width), y from above the top
 * edge to the bottom. The renderer draws streak sprite FX_KEYS.rain.far or
 * .near at (x[i], y[i]) with `rotation`, scaled by the layer's `scale`.
 */
import { VIEW } from '../data/view';
import { WEATHER, type RainLook } from '../data/weather';
import type { Rng01 } from './rng';

export interface RainField {
  /** Total streaks. Far-layer streaks come first, then near. */
  readonly count: number;
  /** Number of far-layer streaks (indices 0..farCount-1). */
  readonly farCount: number;
  readonly x: Float32Array;
  readonly y: Float32Array;
  /** 0 = far, 1 = near. */
  readonly layer: Uint8Array;
  /** Rotation (radians, clockwise on screen) for every streak sprite; the sprite is drawn vertical. */
  readonly rotation: number;
  /** 0..1: fades the rain and the sky darkening in at the start of a battle. */
  readonly intensity: number;
  /** Advance. Returns how many ground splashes to spawn this frame. */
  update(dtSeconds: number): number;
  /** Random position for one splash: x across the field's width, y on the walkable band (view wu). */
  splashX(): number;
  splashY(): number;
}

class RainStreaks implements RainField {
  readonly count: number;
  readonly farCount: number;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly layer: Uint8Array;
  readonly rotation: number;
  intensity = 0;

  private readonly speed: Float32Array;
  private readonly width: number;
  private readonly height: number;
  private readonly margin: number;
  private readonly dirX: number;
  private readonly dirY: number;
  private readonly splashesPerSecond: number;
  private splashDebt = 0;
  private readonly rng01: Rng01;
  private readonly look: RainLook;

  constructor(rng01: Rng01, width: number, height: number, look: RainLook) {
    this.rng01 = rng01;
    this.look = look;
    this.width = width;
    this.height = height;
    this.margin = look.overscan;
    this.dirX = Math.sin(look.angle);
    this.dirY = Math.cos(look.angle);
    this.rotation = -look.angle;
    const screens = width / VIEW.screenWu;
    this.farCount = Math.max(1, Math.round(look.layers[0].streaks * screens));
    const near = Math.max(1, Math.round(look.layers[1].streaks * screens));
    this.count = this.farCount + near;
    this.splashesPerSecond = look.splashRate * screens;
    this.x = new Float32Array(this.count);
    this.y = new Float32Array(this.count);
    this.speed = new Float32Array(this.count);
    this.layer = new Uint8Array(this.count);
    const span = height + this.margin * 2;
    for (let i = 0; i < this.count; i++) {
      const layer = i < this.farCount ? 0 : 1;
      const def = look.layers[layer];
      this.layer[i] = layer;
      this.x[i] = rng01() * width;
      this.y[i] = -this.margin + rng01() * span;
      this.speed[i] = def.speed * (1 + def.speedJitter * rng01());
    }
  }

  update(dtSeconds: number): number {
    if (!(dtSeconds > 0)) return 0;
    const fade = this.look.fadeIn;
    this.intensity = fade > 0 ? Math.min(1, this.intensity + dtSeconds / fade) : 1;
    const { x, y, speed, width, dirX, dirY } = this;
    const bottom = this.height + this.margin;
    const span = this.height + this.margin * 2;
    for (let i = 0; i < this.count; i++) {
      const d = speed[i] * dtSeconds;
      let nx = x[i] + dirX * d;
      let ny = y[i] + dirY * d;
      if (ny > bottom) {
        ny -= span;
        nx = this.rng01() * width;
      }
      if (nx >= width) nx -= width;
      else if (nx < 0) nx += width;
      x[i] = nx;
      y[i] = ny;
    }
    this.splashDebt += this.splashesPerSecond * this.intensity * dtSeconds;
    const due = Math.floor(this.splashDebt);
    this.splashDebt -= due;
    return due;
  }

  splashX(): number {
    return this.rng01() * this.width;
  }

  splashY(): number {
    return VIEW.groundY + (this.rng01() * 2 - 1) * this.look.splashBand;
  }
}

/**
 * @param width visible width in wu (the field wraps across it)
 * @param height visible height in wu (normally VIEW.heightWu)
 */
export function createRainField(
  rng01: Rng01,
  width: number,
  height: number = VIEW.heightWu,
  look: RainLook = WEATHER.rain,
): RainField {
  return new RainStreaks(rng01, width, height, look);
}
