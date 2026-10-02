/**
 * Measuring rendered audio with plain numbers (no WebAudio), for the music checks and the mix targets: peak, RMS,
 * band-limited signals, perceived loudness (K-weighted, as in ITU-R BS.1770), a model of a phone's small speaker, the
 * loudest window and the continuity of a loop point. Runs in Node and in the page.
 */
import type { PhoneSpeaker } from '../../data/music';

export function db(level: number): number {
  return 20 * Math.log10(Math.max(level, 1e-9));
}

export function peakOf(data: Float32Array, from = 0, to = data.length): number {
  let peak = 0;
  for (let i = Math.max(0, from); i < Math.min(to, data.length); i++) {
    const a = Math.abs(data[i]);
    if (a > peak) peak = a;
  }
  return peak;
}

export function rmsOf(data: Float32Array, from = 0, to = data.length): number {
  const a = Math.max(0, from);
  const b = Math.min(to, data.length);
  if (b <= a) return 0;
  let sum = 0;
  for (let i = a; i < b; i++) sum += data[i] * data[i];
  return Math.sqrt(sum / (b - a));
}

/** Run one biquad (normalised coefficients) over a signal, into a new array. */
function run(data: Float32Array, b0: number, b1: number, b2: number, a1: number, a2: number): Float32Array {
  const out = new Float32Array(data.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < data.length; i++) {
    const x = data[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    out[i] = y;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
  }
  return out;
}

/** One RBJ biquad pass (low-pass or high-pass at quality q, Butterworth by default), into a new array. */
function biquad(data: Float32Array, rate: number, kind: 'lowpass' | 'highpass', freq: number, q = Math.SQRT1_2): Float32Array {
  const w0 = (2 * Math.PI * Math.min(freq, rate * 0.49)) / rate;
  const alpha = Math.sin(w0) / (2 * q);
  const cos = Math.cos(w0);
  const a0 = 1 + alpha;
  const b0 = (kind === 'lowpass' ? (1 - cos) / 2 : (1 + cos) / 2) / a0;
  const b1 = (kind === 'lowpass' ? 1 - cos : -(1 + cos)) / a0;
  const a1 = (-2 * cos) / a0;
  const a2 = (1 - alpha) / a0;
  return run(data, b0, b1, b0, a1, a2);
}

/** A high shelf (RBJ cookbook) lifting everything above `freq` by `gainDb`. */
function highShelf(data: Float32Array, rate: number, freq: number, gainDb: number, q: number): Float32Array {
  const A = Math.pow(10, gainDb / 40);
  const w0 = (2 * Math.PI * freq) / rate;
  const cos = Math.cos(w0);
  const s = 2 * Math.sqrt(A) * (Math.sin(w0) / (2 * q));
  const a0 = A + 1 - (A - 1) * cos + s;
  return run(
    data,
    (A * (A + 1 + (A - 1) * cos + s)) / a0,
    (-2 * A * (A - 1 + (A + 1) * cos)) / a0,
    (A * (A + 1 + (A - 1) * cos - s)) / a0,
    (2 * (A - 1 - (A + 1) * cos)) / a0,
    (A + 1 - (A - 1) * cos - s) / a0,
  );
}

/** The part of a signal between `low` and `high` Hz (two fourth-order Butterworth slopes). */
export function band(data: Float32Array, rate: number, low: number, high: number): Float32Array {
  let out = data;
  if (low > 0) out = biquad(biquad(out, rate, 'highpass', low), rate, 'highpass', low);
  if (high < rate / 2) out = biquad(biquad(out, rate, 'lowpass', high), rate, 'lowpass', high);
  return out;
}

/** What a phone's small speaker leaves of a (mono) signal: a steep high-pass and a gentle top roll-off. */
export function phoneSpeaker(data: Float32Array, rate: number, phone: PhoneSpeaker): Float32Array {
  let out = data;
  for (let i = 0; i < phone.highpassOrder / 2; i++) out = biquad(out, rate, 'highpass', phone.highpassHz);
  for (let i = 0; i < phone.lowpassOrder / 2; i++) out = biquad(out, rate, 'lowpass', phone.lowpassHz);
  return out;
}

/**
 * K-weighting (BS.1770): a +4 dB shelf above about 1.5 kHz (the head) and a high-pass at 38 Hz, here designed for any
 * sample rate from the standard's analogue prototype parameters.
 */
export function kWeight(data: Float32Array, rate: number): Float32Array {
  return biquad(highShelf(data, rate, 1500, 4, Math.SQRT1_2), rate, 'highpass', 38, 0.5);
}

/** Loudness (LUFS, mono) of a mean square of a K-weighted signal. */
function lufsOf(meanSquare: number): number {
  return -0.691 + 10 * Math.log10(Math.max(meanSquare, 1e-12));
}

export interface Loudness {
  /** Gated integrated loudness over the whole signal (BS.1770: 400 ms blocks, -70 LUFS and -10 LU gates). */
  integrated: number;
  /** Loudest momentary (400 ms) and short-term (3 s) loudness. */
  momentaryMax: number;
  shortTermMax: number;
}

/** Perceived loudness of a mono signal (in LUFS relative to the signal's own full scale). */
export function loudnessOf(data: Float32Array, rate: number): Loudness {
  const k = kWeight(data, rate);
  const prefix = new Float64Array(k.length + 1);
  for (let i = 0; i < k.length; i++) prefix[i + 1] = prefix[i] + k[i] * k[i];
  const window = (seconds: number, hopShare: number): number[] => {
    const w = Math.max(1, Math.round(seconds * rate));
    if (k.length <= w) return [prefix[k.length] / Math.max(1, k.length)];
    const hop = Math.max(1, Math.round(w * hopShare));
    const out: number[] = [];
    for (let s = 0; s + w <= k.length; s += hop) out.push((prefix[s + w] - prefix[s]) / w);
    return out;
  };
  const blocks = window(0.4, 0.25);
  const absolute = blocks.filter((ms) => lufsOf(ms) > -70);
  const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  const relativeGate = lufsOf(mean(absolute)) - 10;
  const gated = absolute.filter((ms) => lufsOf(ms) > relativeGate);
  return {
    integrated: lufsOf(mean(gated)),
    momentaryMax: lufsOf(Math.max(...blocks)),
    shortTermMax: lufsOf(Math.max(...window(3, 0.1))),
  };
}

/** Loudness of two uncorrelated sounds played together. */
export function sumLoudness(a: number, b: number): number {
  return 10 * Math.log10(Math.pow(10, a / 10) + Math.pow(10, b / 10));
}

/** RMS of the loudest `seconds`-long window (stepped by a quarter window). */
export function loudestWindow(data: Float32Array, rate: number, seconds: number, from = 0, to = data.length): number {
  const w = Math.max(1, Math.round(seconds * rate));
  const a = Math.max(0, from);
  const b = Math.min(to, data.length);
  const prefix = new Float64Array(b - a + 1);
  for (let i = a; i < b; i++) prefix[i - a + 1] = prefix[i - a] + data[i] * data[i];
  if (b - a <= w) return Math.sqrt(prefix[b - a] / Math.max(1, b - a));
  let best = 0;
  const hop = Math.max(1, w >> 2);
  for (let s = 0; s + w <= b - a; s += hop) best = Math.max(best, (prefix[s + w] - prefix[s]) / w);
  return Math.sqrt(best);
}

/** Where (sample index) the loudest `seconds`-long window starts. */
export function loudestStart(data: Float32Array, rate: number, seconds: number): number {
  const w = Math.max(1, Math.round(seconds * rate));
  const prefix = new Float64Array(data.length + 1);
  for (let i = 0; i < data.length; i++) prefix[i + 1] = prefix[i] + data[i] * data[i];
  let best = 0;
  let at = 0;
  const hop = Math.max(1, w >> 3);
  for (let s = 0; s + w <= data.length; s += hop) {
    const e = prefix[s + w] - prefix[s];
    if (e > best) {
      best = e;
      at = s;
    }
  }
  return at;
}

export interface SeamReport {
  /** |last sample - first sample| across the loop point. */
  step: number;
  /** The largest sample-to-sample step within `window` seconds either side of the loop point. */
  localStep: number;
  /** RMS of the last and first `window` seconds. */
  rmsBefore: number;
  rmsAfter: number;
}

/** How continuous a loop of `frames` samples is where it wraps round. */
export function seamOf(data: Float32Array, frames: number, rate: number, window = 0.05): SeamReport {
  const w = Math.max(2, Math.round(window * rate));
  let local = 0;
  for (let i = frames - w + 1; i < frames; i++) local = Math.max(local, Math.abs(data[i] - data[i - 1]));
  for (let i = 1; i < w; i++) local = Math.max(local, Math.abs(data[i] - data[i - 1]));
  return {
    step: Math.abs(data[0] - data[frames - 1]),
    localStep: local,
    rmsBefore: rmsOf(data, frames - w, frames),
    rmsAfter: rmsOf(data, 0, w),
  };
}
