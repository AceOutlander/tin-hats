/**
 * Battlefield pointer input on the canvas element (DOM pointer events, so the
 * HUD above the canvas never sees them and they never see the HUD):
 * one-finger or mouse drag pans with inertia, a short small press is a tap,
 * the mouse wheel pans. Positions are CSS px relative to the canvas.
 */
import { RENDER } from '../data/render';
import type { CameraRig } from './camera';

const SAMPLES = 8;

export class PanInput {
  private pointerId = -1;
  private startX = 0;
  private startY = 0;
  private startT = 0;
  private lastX = 0;
  private moved = false;
  /** Ring of recent (time, x) samples for the fling speed. */
  private readonly sampleT = new Float64Array(SAMPLES);
  private readonly sampleX = new Float64Array(SAMPLES);
  private sampleN = 0;

  constructor(
    private readonly el: HTMLElement,
    private readonly rig: CameraRig,
    /** CSS px per wu right now. */
    private readonly cssPerWu: () => number,
    private readonly onTap: (cssX: number, cssY: number) => void,
    /** Where the pointer is (CSS px), for the targeting reticle; null when it leaves. */
    private readonly onHover: (cssX: number, cssY: number) => void,
  ) {
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', this.down);
    el.addEventListener('pointermove', this.move);
    el.addEventListener('pointerup', this.up);
    el.addEventListener('pointercancel', this.cancel);
    el.addEventListener('wheel', this.wheel, { passive: false });
    el.addEventListener('contextmenu', this.noMenu);
  }

  destroy(): void {
    const el = this.el;
    el.removeEventListener('pointerdown', this.down);
    el.removeEventListener('pointermove', this.move);
    el.removeEventListener('pointerup', this.up);
    el.removeEventListener('pointercancel', this.cancel);
    el.removeEventListener('wheel', this.wheel);
    el.removeEventListener('contextmenu', this.noMenu);
  }

  private local(e: PointerEvent | WheelEvent): { x: number; y: number } {
    const r = this.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private readonly noMenu = (e: Event): void => {
    e.preventDefault();
  };

  private readonly down = (e: PointerEvent): void => {
    if (this.pointerId !== -1) return; // one finger pans; extra fingers are ignored
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.pointerId = e.pointerId;
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch (_err) {
      // Synthetic events cannot be captured; panning still works without it.
    }
    const p = this.local(e);
    this.startX = p.x;
    this.startY = p.y;
    this.lastX = p.x;
    this.startT = e.timeStamp / 1000;
    this.moved = false;
    this.sampleN = 0;
    this.addSample(this.startT, p.x);
    this.rig.stop();
    this.rig.dragging = true;
    this.onHover(p.x, p.y);
  };

  private readonly move = (e: PointerEvent): void => {
    const p = this.local(e);
    if (e.pointerId !== this.pointerId) {
      if (this.pointerId === -1) this.onHover(p.x, p.y);
      return;
    }
    if (!this.moved && Math.hypot(p.x - this.startX, p.y - this.startY) > RENDER.input.tapSlop) this.moved = true;
    if (this.moved) {
      this.rig.panBy(-(p.x - this.lastX) / this.cssPerWu());
      this.lastX = p.x;
    }
    this.addSample(e.timeStamp / 1000, p.x);
    this.onHover(p.x, p.y);
  };

  private readonly up = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    const p = this.local(e);
    const t = e.timeStamp / 1000;
    this.end();
    if (!this.moved && t - this.startT <= RENDER.input.tapTime) {
      this.onTap(p.x, p.y);
      return;
    }
    if (this.moved) {
      this.addSample(t, p.x);
      this.rig.fling(-this.flingSpeed(t) / this.cssPerWu());
    }
  };

  private readonly cancel = (e: PointerEvent): void => {
    if (e.pointerId === this.pointerId) this.end();
  };

  private readonly wheel = (e: WheelEvent): void => {
    e.preventDefault();
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    const px = e.deltaMode === 1 ? d * 16 : e.deltaMode === 2 ? d * 400 : d;
    const target = this.rig.centerX + px * RENDER.camera.wheelWuPerPx;
    this.rig.setCenter(target);
  };

  private end(): void {
    if (this.pointerId !== -1) {
      try {
        this.el.releasePointerCapture(this.pointerId);
      } catch (_err) {
        // Already released.
      }
    }
    this.pointerId = -1;
    this.rig.dragging = false;
  }

  private addSample(t: number, x: number): void {
    const i = this.sampleN % SAMPLES;
    this.sampleT[i] = t;
    this.sampleX[i] = x;
    this.sampleN++;
  }

  /** CSS px per second over the last RENDER.input.flingWindow seconds. */
  private flingSpeed(now: number): number {
    const n = Math.min(this.sampleN, SAMPLES);
    if (n < 2) return 0;
    const newest = (this.sampleN - 1) % SAMPLES;
    let oldest = newest;
    for (let k = 1; k < n; k++) {
      const i = (this.sampleN - 1 - k) % SAMPLES;
      if (now - this.sampleT[i] > RENDER.input.flingWindow) break;
      oldest = i;
    }
    const dt = this.sampleT[newest] - this.sampleT[oldest];
    if (dt <= 0.004) return 0;
    return (this.sampleX[newest] - this.sampleX[oldest]) / dt;
  }
}
