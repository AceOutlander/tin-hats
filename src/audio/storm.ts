/**
 * The title screen's storm, heard (src/data/menuStorm.ts): a rain bed and a thunder builder, both synthesised.
 *
 * - RainBed: two or three layers of looping noise, each through its own filter, each at its own playback rate (so the
 *   2 s noise tables never line up), and each with its level and filter frequency gliding to new random targets at
 *   random intervals. No sine LFOs and no short buffer on its own: the bed never repeats in a way the ear can catch.
 * - buildThunder: one rumble for a given loudness and length. A near (loud) one opens with a crack and a tearing
 *   sound; every one has a boom, a low body and a run of rolls whose number, timing, level and darkness are drawn at
 *   random, each with a ragged random wobble. No two are the same.
 *
 * Only BaseAudioContext is used, so the same code runs on the live context and in an offline render.
 */
import type { RainBedLayerDef, ThunderSynthDef } from '../data/menuStorm';
import { AUDIO } from '../data/sounds';
import type { NoiseBank } from './synth';

function between(rng: () => number, r: readonly [number, number]): number {
  return r[0] + (r[1] - r[0]) * rng();
}

function clampFreq(f: number): number {
  return Math.min(AUDIO.freqMax, Math.max(AUDIO.freqMin, f));
}

function noiseSource(ctx: BaseAudioContext, bank: NoiseBank, color: RainBedLayerDef['color'], rate: number, at: number, rng: () => number): AudioBufferSourceNode {
  const source = ctx.createBufferSource();
  const buffer = bank.get(ctx, color);
  source.buffer = buffer;
  source.loop = true;
  source.playbackRate.value = rate;
  source.start(at, Math.min(0.999, Math.max(0, rng())) * buffer.duration);
  return source;
}

interface BedLayer {
  def: RainBedLayerDef;
  source: AudioBufferSourceNode;
  filter: BiquadFilterNode;
  gain: GainNode;
  /** Context time the current glide ends: a new target is drawn then. */
  until: number;
}

export class RainBed {
  /** The bed's own level (fades in and out); feeds the Ambience bus. */
  readonly out: GainNode;
  private readonly layers: BedLayer[] = [];

  constructor(
    private readonly ctx: BaseAudioContext,
    dest: AudioNode,
    defs: readonly RainBedLayerDef[],
    private readonly rng: () => number,
    bank: NoiseBank,
  ) {
    const now = ctx.currentTime;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.gain.setValueAtTime(0, now);
    this.out.connect(dest);
    for (const def of defs) {
      const source = noiseSource(ctx, bank, def.color, def.rate, now, rng);
      const filter = ctx.createBiquadFilter();
      filter.type = def.filter;
      filter.Q.value = def.q;
      filter.frequency.value = clampFreq(between(rng, def.freq));
      const gain = ctx.createGain();
      gain.gain.value = between(rng, def.gain);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.out);
      this.layers.push({ def, source, filter, gain, until: now });
    }
  }

  /** Glide the bed's level to `level` over `seconds`, from wherever it is now. */
  fadeTo(level: number, seconds: number): void {
    const now = this.ctx.currentTime;
    const p = this.out.gain;
    if (typeof p.cancelAndHoldAtTime === 'function') {
      p.cancelAndHoldAtTime(now);
    } else {
      const v = p.value;
      p.cancelScheduledValues(now);
      p.setValueAtTime(v, now);
    }
    p.linearRampToValueAtTime(level, now + Math.max(0.01, seconds));
  }

  /**
   * Keep the drift going: every layer whose glide has ended (or ends within `lookahead` seconds) gets a new random
   * level and filter target and a new random glide time. Call every frame while the bed plays; allocates nothing.
   */
  drift(lookahead: number): void {
    const now = this.ctx.currentTime;
    const rng = this.rng;
    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];
      if (layer.until > now + lookahead) continue;
      // Normally the next glide simply carries on from where the last one ends; after a stall it starts from now.
      const behind = layer.until <= now;
      const from = behind ? now : layer.until;
      const to = from + between(rng, layer.def.segment);
      if (behind) {
        layer.gain.gain.setValueAtTime(layer.gain.gain.value, now);
        layer.filter.frequency.setValueAtTime(layer.filter.frequency.value, now);
      }
      layer.gain.gain.linearRampToValueAtTime(between(rng, layer.def.gain), to);
      layer.filter.frequency.exponentialRampToValueAtTime(clampFreq(between(rng, layer.def.freq)), to);
      layer.until = to;
    }
  }

  /** The bed's own level right now (the fade), 0..1. */
  level(): number {
    return this.out.gain.value;
  }

  /** Fade out over `seconds` and stop; `seconds` 0 cuts it at once (a frozen context could not play a fade). */
  stop(seconds: number): void {
    const now = this.ctx.currentTime;
    if (seconds > 0) this.fadeTo(0, seconds);
    else this.out.disconnect();
    for (const layer of this.layers) {
      try {
        layer.source.stop(now + seconds + AUDIO.stopPad);
      } catch {
        // A source refuses a second stop on some old browsers; it ends at the first.
      }
    }
  }
}

/**
 * One thunder rumble into `dest` starting at t0: `loudness` 0..1 scales the level, the crack and the brightness,
 * `length` (seconds) sets how long it rolls. Returns the time the last layer ends.
 */
export function buildThunder(
  ctx: BaseAudioContext,
  dest: AudioNode,
  t0: number,
  loudness: number,
  length: number,
  def: ThunderSynthDef,
  rng: () => number,
  bank: NoiseBank,
): number {
  const loud = Math.max(0, Math.min(1, loudness));
  const len = Math.max(0.5, length);
  const level = def.level * loud;
  const cutoff = def.cutoff * (def.cutoffFar + (1 - def.cutoffFar) * loud);
  let end = t0;

  /** A burst of filtered noise with an attack, a hold and a decay, all from t. */
  const burst = (
    color: RainBedLayerDef['color'],
    type: BiquadFilterType,
    freq: number,
    freqEnd: number,
    gain: number,
    at: number,
    attack: number,
    hold: number,
    decay: number,
    wobble: boolean,
  ): void => {
    const start = t0 + at;
    const peak = start + Math.max(AUDIO.minAttack, attack);
    const stop = peak + hold + decay;
    const source = noiseSource(ctx, bank, color, 0.9 + 0.2 * rng(), start, rng);
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(clampFreq(freq), start);
    if (freqEnd !== freq) filter.frequency.exponentialRampToValueAtTime(clampFreq(freqEnd), stop);
    const env = ctx.createGain();
    const g = env.gain;
    g.value = 0;
    g.setValueAtTime(0, start);
    g.linearRampToValueAtTime(gain, peak);
    if (wobble) {
      // A ragged roll: the level stumbles up and down at random on the way out, never in a regular beat.
      const steps = Math.max(2, Math.round((hold + decay) * def.wobbleRate));
      for (let k = 1; k <= steps; k++) {
        const t = peak + ((hold + decay) * k) / (steps + 1);
        const fall = 1 - k / (steps + 1);
        g.linearRampToValueAtTime(Math.max(AUDIO.decayFloor, gain * fall * (1 - def.wobble * rng())), t);
      }
      g.linearRampToValueAtTime(0, stop);
    } else {
      if (hold > 0) g.setValueAtTime(gain, peak + hold);
      g.exponentialRampToValueAtTime(Math.max(1e-4, gain * AUDIO.decayFloor), stop);
    }
    source.connect(filter);
    filter.connect(env);
    env.connect(dest);
    source.stop(stop + AUDIO.stopPad);
    if (stop > end) end = stop;
  };

  // A near strike: the crack and the tearing sound.
  if (loud > def.crackFrom) {
    const k = ((loud - def.crackFrom) / (1 - def.crackFrom)) * def.crackGain * level;
    burst('white', 'highpass', 1500, 1500, k, 0, 0.002, 0.02, 0.2, false);
    burst('white', 'bandpass', 2400, 650, k * 0.7, 0.03 + 0.03 * rng(), 0.005, 0.05, 0.38, false);
  }
  // The boom and the low body under it.
  burst('pink', 'lowpass', cutoff * 1.2, cutoff * 0.18, level, 0.04, 0.02 + 0.03 * rng(), def.boomHold, Math.min(1.6, 0.35 * len), false);
  burst('brown', 'lowpass', 520, 90, level * def.bodyGain, 0.05, 0.03, 0.1, Math.min(2.2, 0.5 * len), false);
  // A thump for headphones.
  const thump = ctx.createOscillator();
  thump.type = 'sine';
  thump.frequency.setValueAtTime(52 + 10 * rng(), t0 + 0.05);
  thump.frequency.exponentialRampToValueAtTime(30, t0 + 1.1);
  const thumpGain = ctx.createGain();
  thumpGain.gain.value = 0;
  thumpGain.gain.setValueAtTime(0, t0 + 0.05);
  thumpGain.gain.linearRampToValueAtTime(level * def.subGain, t0 + 0.07);
  thumpGain.gain.exponentialRampToValueAtTime(Math.max(1e-4, level * def.subGain * AUDIO.decayFloor), t0 + 1.1);
  thump.connect(thumpGain);
  thumpGain.connect(dest);
  thump.start(t0 + 0.05);
  thump.stop(t0 + 1.1 + AUDIO.stopPad);
  // The rolls: spread over the length, at random times, levels and colours, quieter toward the end.
  const rolls = Math.max(2, Math.round(len * def.rollsPerSecond));
  for (let i = 0; i < rolls; i++) {
    const at = 0.35 + (len - 1.1) * ((i + rng()) / rolls);
    const fall = 1 - (0.65 * at) / len;
    const gain = level * between(rng, def.rollGain) * fall;
    const decay = between(rng, def.rollDecay);
    burst('pink', 'lowpass', cutoff * between(rng, def.rollCutoff), cutoff * 0.15, gain, at, 0.18 + 0.3 * rng(), 0.1 + 0.25 * rng(), decay, true);
  }
  return end;
}
