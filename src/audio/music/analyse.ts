/**
 * Measuring rendered audio with plain numbers (no WebAudio), for the music checks and the mix targets: peak, RMS,
 * band-limited signals, the loudest window and the continuity of a loop point. Runs in Node and in the page.
 */

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

/** One RBJ biquad pass (low-pass or high-pass, Butterworth Q), into a new array. */
function biquad(data: Float32Array, rate: number, kind: 'lowpass' | 'highpass', freq: number): Float32Array {
  const w0 = (2 * Math.PI * Math.min(freq, rate * 0.49)) / rate;
  const alpha = Math.sin(w0) / (2 * Math.SQRT1_2);
  const cos = Math.cos(w0);
  const a0 = 1 + alpha;
  const b0 = (kind === 'lowpass' ? (1 - cos) / 2 : (1 + cos) / 2) / a0;
  const b1 = (kind === 'lowpass' ? 1 - cos : -(1 + cos)) / a0;
  const b2 = b0;
  const a1 = (-2 * cos) / a0;
  const a2 = (1 - alpha) / a0;
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

/** The part of a signal between `low` and `high` Hz (two fourth-order Butterworth slopes). */
export function band(data: Float32Array, rate: number, low: number, high: number): Float32Array {
  let out = data;
  if (low > 0) out = biquad(biquad(out, rate, 'highpass', low), rate, 'highpass', low);
  if (high < rate / 2) out = biquad(biquad(out, rate, 'lowpass', high), rate, 'lowpass', high);
  return out;
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
