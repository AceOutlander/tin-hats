/**
 * Maps battlefield events to the audio engine, with rate limiting. The view
 * works with no audio set: every call is then a no-op.
 *
 * Limits (real time, so a fast-forward cannot flood the mixer): a minimum gap
 * per sound name, a ceiling on plays per second, and no sound for things more
 * than RENDER.audio.reachViews screens away.
 */
import { RENDER } from '../../data/render';
import type { AudioSink } from '../contracts';

const A = RENDER.audio;

export class SoundDirector {
  private sink: AudioSink | null = null;
  private readonly last = new Map<string, number>();
  private windowStart = 0;
  private windowCount = 0;
  private center = 0;
  private width = 1000;
  private lastCenter = NaN;
  private lastWidth = NaN;
  private rainOn = false;
  private tankVolume = 0;
  private tankIdle = 0;

  /** Swap the sink; loops that were running on the old one are stopped and restarted on the new one. */
  setSink(sink: AudioSink | null): void {
    if (sink === this.sink) return;
    this.stopLoops();
    this.sink = sink;
    this.lastCenter = NaN;
    if (sink && this.rainOn) sink.startLoop('rain', A.rainVolume);
  }

  hasSink(): boolean {
    return this.sink !== null;
  }

  /** Tell the engine (and the reach test) what the camera sees. */
  setView(centerX: number, viewWidth: number): void {
    this.center = centerX;
    this.width = viewWidth;
    if (this.sink && (centerX !== this.lastCenter || viewWidth !== this.lastWidth)) {
      this.lastCenter = centerX;
      this.lastWidth = viewWidth;
      this.sink.setListener(centerX, viewWidth);
    }
  }

  private allowed(name: string): boolean {
    if (!this.sink || name === 'none' || name === '') return false;
    const now = performance.now();
    const gap = (A.minGap[name] ?? A.defaultGap) * 1000;
    const last = this.last.get(name);
    if (last !== undefined && now - last < gap) return false;
    if (now - this.windowStart >= 1000) {
      this.windowStart = now;
      this.windowCount = 0;
    }
    if (this.windowCount >= A.maxPerSecond) return false;
    this.windowCount++;
    this.last.set(name, now);
    return true;
  }

  /** A sound at world x (panned and softened by distance by the engine). */
  at(name: string, x: number, volume = 1): void {
    if (!this.sink) return;
    if (Math.abs(x - this.center) > this.width * (0.5 + A.reachViews)) return;
    if (!this.allowed(name)) return;
    this.sink.playAt(name, x, volume === 1 ? undefined : { volume });
  }

  /** A sound in the middle of the mix. */
  global(name: string, volume = 1): void {
    if (!this.allowed(name)) return;
    this.sink?.play(name, volume === 1 ? undefined : { volume });
  }

  /** Rain loop on or off. */
  rain(on: boolean): void {
    if (on === this.rainOn) return;
    this.rainOn = on;
    if (!this.sink) return;
    if (on) this.sink.startLoop('rain', A.rainVolume);
    else this.sink.stopLoop('rain');
  }

  /**
   * The tank engine loop: on while tanks are near the view, louder with more of them (up to tankLoopMax),
   * and off after tankLoopHold seconds without any.
   */
  tanks(count: number, dt: number): void {
    const sink = this.sink;
    if (!sink) return;
    if (count > 0) {
      this.tankIdle = 0;
      const volume = (A.tankLoopVolume * Math.min(count, A.tankLoopMax)) / A.tankLoopMax;
      if (Math.abs(volume - this.tankVolume) > 0.01) {
        this.tankVolume = volume;
        sink.startLoop('tankEngine', volume);
      }
    } else if (this.tankVolume > 0) {
      this.tankIdle += dt;
      if (this.tankIdle >= A.tankLoopHold) {
        this.tankVolume = 0;
        sink.stopLoop('tankEngine');
      }
    }
  }

  /** Stop the loops this director started (battle detached, sink swapped or view destroyed). */
  stopLoops(): void {
    const sink = this.sink;
    if (sink) {
      if (this.rainOn) sink.stopLoop('rain');
      if (this.tankVolume > 0) sink.stopLoop('tankEngine');
    }
    this.tankVolume = 0;
    this.tankIdle = 0;
  }

  /** Forget the rain state (a new battle starts). Does not touch the sink. */
  reset(): void {
    this.rainOn = false;
    this.tankVolume = 0;
    this.tankIdle = 0;
    this.last.clear();
  }
}
