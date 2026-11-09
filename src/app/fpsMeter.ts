/**
 * The "Show FPS" readout's numbers: frames per second and the average and worst frame time of the last second
 * (APP.fps.windowMs), worked out a few times a second (APP.fps.updateMs) from a ring of frame times. Allocation free.
 */
import { APP } from '../data/app';
import type { FpsState } from '../ui/contracts';

export class FpsMeter {
  readonly state: FpsState = { seq: 0, fps: 0, avgMs: 0, worstMs: 0 };
  private readonly ring = new Float64Array(APP.fps.ring);
  /** Frames recorded since the reset. */
  private count = 0;
  private sinceUpdate = 0;

  /** Start over (a new battle: the gap since the last one is not a frame). */
  reset(): void {
    this.count = 0;
    this.sinceUpdate = 0;
    const s = this.state;
    s.fps = 0;
    s.avgMs = 0;
    s.worstMs = 0;
    s.seq++;
  }

  /** One frame: `dtMs` is the real time since the previous one. */
  frame(dtMs: number): void {
    if (!(dtMs > 0) || !Number.isFinite(dtMs)) return;
    const ring = this.ring;
    ring[this.count % ring.length] = dtMs;
    this.count++;
    this.sinceUpdate += dtMs;
    if (this.sinceUpdate < APP.fps.updateMs) return;
    this.sinceUpdate = 0;
    this.publish();
  }

  /** Sum the newest frames back to a window's worth. */
  private publish(): void {
    const ring = this.ring;
    const len = ring.length;
    const avail = this.count < len ? this.count : len;
    let sum = 0;
    let n = 0;
    let worst = 0;
    for (let k = 0; k < avail && sum < APP.fps.windowMs; k++) {
      const dt = ring[(this.count - 1 - k) % len];
      sum += dt;
      n++;
      if (dt > worst) worst = dt;
    }
    if (n === 0) return;
    const s = this.state;
    s.fps = (n * 1000) / sum;
    s.avgMs = sum / n;
    s.worstMs = worst;
    s.seq++;
  }
}
