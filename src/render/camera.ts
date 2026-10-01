/**
 * Horizontal camera logic in world units: the view centre, a glide toward a
 * requested centre, drag panning with inertia, and clamping to the map.
 * No Phaser here; the view copies centreX onto the Phaser camera each frame.
 */
import { RENDER } from '../data/render';
import { VIEW } from '../data/view';
import type { BattleCamera } from './contracts';

export class CameraRig implements BattleCamera {
  centerX = VIEW.screenWu / 2;
  viewWidthWu: number = VIEW.screenWu;
  /** Map length in wu. */
  length: number = VIEW.screenWu;
  private targetX = VIEW.screenWu / 2;
  private gliding = false;
  private velocity = 0;
  /** True while a finger or the mouse is dragging the view. */
  dragging = false;

  setLength(length: number): void {
    this.length = length;
    this.centerX = this.clamp(this.centerX);
    this.targetX = this.clamp(this.targetX);
  }

  setViewWidth(w: number): void {
    this.viewWidthWu = w;
    this.centerX = this.clamp(this.centerX);
    this.targetX = this.clamp(this.targetX);
  }

  clamp(x: number): number {
    const half = this.viewWidthWu / 2;
    if (this.length <= this.viewWidthWu) return this.length / 2;
    return Math.min(this.length - half, Math.max(half, x));
  }

  setCenter(x: number, immediate = false): void {
    this.velocity = 0;
    this.targetX = this.clamp(x);
    if (immediate) {
      this.centerX = this.targetX;
      this.gliding = false;
    } else {
      this.gliding = true;
    }
  }

  jumpToFrac(f: number): void {
    this.setCenter(Math.max(0, Math.min(1, f)) * this.length, true);
  }

  /** Move the view by dx wu (a drag). Cancels any glide or fling. */
  panBy(dx: number): void {
    this.gliding = false;
    this.velocity = 0;
    this.centerX = this.clamp(this.centerX + dx);
    this.targetX = this.centerX;
  }

  /** Let go with this velocity (wu/s). */
  fling(v: number): void {
    const max = RENDER.camera.maxFling;
    this.velocity = Math.max(-max, Math.min(max, v));
    this.gliding = false;
  }

  /** Stop any inertia (a new touch). */
  stop(): void {
    this.velocity = 0;
    this.gliding = false;
    this.targetX = this.centerX;
  }

  /** Left edge of the view in world x. */
  get left(): number {
    return this.centerX - this.viewWidthWu / 2;
  }

  update(dt: number): void {
    if (dt <= 0) return;
    const C = RENDER.camera;
    if (this.velocity !== 0 && !this.dragging) {
      const before = this.centerX;
      this.centerX = this.clamp(this.centerX + this.velocity * dt);
      this.velocity *= Math.exp(-C.inertiaDecay * dt);
      // Hitting the end of the map kills the fling.
      if (Math.abs(this.velocity) < C.inertiaStop || this.centerX === before) this.velocity = 0;
      this.targetX = this.centerX;
    } else if (this.gliding) {
      const k = 1 - Math.exp(-dt / C.glideTime);
      this.centerX += (this.targetX - this.centerX) * k;
      if (Math.abs(this.targetX - this.centerX) < 0.05) {
        this.centerX = this.targetX;
        this.gliding = false;
      }
    }
  }
}
