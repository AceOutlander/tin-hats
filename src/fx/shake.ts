/**
 * Screen shake: a decaying wobble the renderer adds to the camera position.
 * View only; no Phaser, no DOM, no allocation per frame.
 */
import { FX, FX_SHAKE, type FxShakeSize } from '../data/fx';

export interface ScreenShake {
  /** Camera offset in wu right now. */
  readonly x: number;
  readonly y: number;
  /**
   * Add a jolt. `strength` scales it (1 = on screen): pass shakeStrength() for
   * blasts that may be off screen.
   */
  add(size: FxShakeSize, strength?: number): void;
  update(dtSeconds: number): void;
}

class Shake implements ScreenShake {
  x = 0;
  y = 0;
  private amplitude = 0;
  private decay = 0;
  private time = 0;

  add(size: FxShakeSize, strength = 1): void {
    const def = FX_SHAKE[size];
    const amplitude = Math.min(FX.shakeMax, def.amplitude * strength);
    if (amplitude <= this.amplitude) return;
    this.amplitude = amplitude;
    this.decay = amplitude / def.duration;
  }

  update(dtSeconds: number): void {
    if (!(dtSeconds > 0)) return;
    if (this.amplitude <= 0) {
      this.x = 0;
      this.y = 0;
      return;
    }
    this.time += dtSeconds;
    this.amplitude = Math.max(0, this.amplitude - this.decay * dtSeconds);
    this.x = Math.sin(this.time * FX.shakeRateX) * this.amplitude;
    // The phase offset keeps x and y from crossing zero together.
    this.y = Math.sin(this.time * FX.shakeRateY + 1.3) * this.amplitude * FX.shakeYRatio;
  }
}

export function createShake(): ScreenShake {
  return new Shake();
}

/**
 * How strongly a blast at world x shakes a camera showing [viewLeft, viewLeft + viewWidth]:
 * 1 on screen, falling to 0 at FX.shakeFalloff wu beyond the nearer edge.
 */
export function shakeStrength(blastX: number, viewLeft: number, viewWidth: number): number {
  const outside = blastX < viewLeft ? viewLeft - blastX : blastX > viewLeft + viewWidth ? blastX - (viewLeft + viewWidth) : 0;
  return Math.max(0, 1 - outside / FX.shakeFalloff);
}
