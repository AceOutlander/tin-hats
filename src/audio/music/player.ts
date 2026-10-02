/**
 * Plays one rendered track at a time on the Music bus: the buffer loops over [0, loopSeconds) (the folded loop),
 * fades in when it starts and out when it stops. A track asked for again while it plays carries on.
 */
import { AUDIO } from '../../data/sounds';

export interface LoopedTrack {
  buffer: AudioBuffer;
  loopSeconds: number;
}

export class MusicPlayer {
  private source: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  /** The track on now, or null. */
  current: string | null = null;

  constructor(
    private readonly level: number,
    private readonly fadeIn: number,
    private readonly fadeOut: number,
  ) {}

  get playing(): boolean {
    return this.source !== null;
  }

  /** Start `name` (fading in from silence), unless it is already the one playing. Another track playing is faded out first. */
  start(ctx: BaseAudioContext, dest: AudioNode, name: string, track: LoopedTrack, frozen: boolean): void {
    if (this.source && this.current === name) return;
    if (this.source) this.stop(ctx, frozen);
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(this.level, now + this.fadeIn);
    gain.connect(dest);
    const source = ctx.createBufferSource();
    source.buffer = track.buffer;
    source.loop = true;
    source.loopStart = 0;
    source.loopEnd = track.loopSeconds;
    source.connect(gain);
    source.start(now);
    this.source = source;
    this.gain = gain;
    this.current = name;
  }

  /** Fade out and stop. `frozen` (the context is suspended, so a fade would only play after resume) cuts at once. */
  stop(ctx: BaseAudioContext, frozen: boolean): void {
    const source = this.source;
    const gain = this.gain;
    this.source = null;
    this.gain = null;
    this.current = null;
    if (!source || !gain) return;
    const now = ctx.currentTime;
    let end = now;
    if (frozen) {
      gain.disconnect();
    } else {
      const p = gain.gain;
      if (typeof p.cancelAndHoldAtTime === 'function') {
        p.cancelAndHoldAtTime(now);
      } else {
        const v = p.value;
        p.cancelScheduledValues(now);
        p.setValueAtTime(v, now);
      }
      p.linearRampToValueAtTime(0, now + this.fadeOut);
      end = now + this.fadeOut;
    }
    try {
      source.stop(end + AUDIO.stopPad);
    } catch {
      // Some old browsers refuse a second stop(); the source ends at its first.
    }
  }

  /** The fade now, 0..1 (1 = at the player's level). */
  fade(): number {
    return this.gain ? this.gain.gain.value / this.level : 0;
  }
}
