/**
 * Plain-number signal helpers for the audio engine: noise tables, the soft-clip
 * curve and buffer levelling. No WebAudio objects, so all of it runs in Node tests.
 */
import { AUDIO, type NoiseColor } from '../data/sounds';

/** Small seeded generator (mulberry32) so noise tables and test renders are repeatable. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NOISE_SEED: Record<NoiseColor, number> = { white: 0x51a7e, pink: 0x9e3779, brown: 0xb5297a };
/** Samples run through the colouring filters before recording starts, so they have settled. */
const NOISE_WARMUP = 4096;

/**
 * One table of looping noise: white (flat), pink (-3 dB per octave) or brown
 * (-6 dB per octave). The end is crossfaded into the start so the loop has no
 * click, the mean is removed, and the level is set to AUDIO.noiseRms.
 */
export function makeNoise(color: NoiseColor, length: number, crossfade: number): Float32Array {
  const random = seededRandom(NOISE_SEED[color]);
  const fade = Math.max(0, Math.min(crossfade, length >> 1));
  const total = length + fade;
  const raw = new Float32Array(total);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;
  let brown = 0;
  for (let i = -NOISE_WARMUP; i < total; i++) {
    const white = random() * 2 - 1;
    let sample = white;
    if (color === 'pink') {
      // Paul Kellet's pink filter: a sum of first-order lowpasses.
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      sample = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
    } else if (color === 'brown') {
      // Leaky integrator.
      brown = (brown + 0.02 * white) / 1.02;
      sample = brown;
    }
    if (i >= 0) raw[i] = sample;
  }

  const out = new Float32Array(length);
  let mean = 0;
  for (let i = 0; i < length; i++) {
    let sample = raw[i];
    if (i < fade) {
      // Equal-power blend: the table starts as the continuation of its own end.
      const phase = ((i + 0.5) / fade) * (Math.PI / 2);
      sample = sample * Math.sin(phase) + raw[length + i] * Math.cos(phase);
    }
    out[i] = sample;
    mean += sample;
  }
  mean /= Math.max(1, length);
  let power = 0;
  for (let i = 0; i < length; i++) {
    out[i] -= mean;
    power += out[i] * out[i];
  }
  const rms = Math.sqrt(power / Math.max(1, length));
  const scale = rms > 0 ? AUDIO.noiseRms / rms : 0;
  for (let i = 0; i < length; i++) out[i] *= scale;
  return out;
}

/**
 * The final limiter's transfer function: the identity up to the knee, then a
 * smooth bend that approaches but never reaches the ceiling.
 */
export function softClip(x: number, knee: number = AUDIO.clipKnee, ceiling: number = AUDIO.clipCeiling): number {
  const magnitude = Math.abs(x);
  if (magnitude <= knee) return x;
  const room = ceiling - knee;
  const shaped = knee + room * Math.tanh((magnitude - knee) / room);
  return x < 0 ? -shaped : shaped;
}

/** WaveShaper curve for softClip over inputs from -range to +range. */
export function makeClipCurve(
  size: number = AUDIO.clipCurveSize,
  range: number = AUDIO.clipRange,
): Float32Array<ArrayBuffer> {
  const curve = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    curve[i] = softClip(((i / (size - 1)) * 2 - 1) * range);
  }
  return curve;
}

/** Largest absolute sample. */
export function peakOf(data: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < data.length; i++) {
    const magnitude = Math.abs(data[i]);
    if (magnitude > peak) peak = magnitude;
  }
  return peak;
}

/**
 * Scales a rendered sound so its peak equals `target` and fades its last
 * `fadeSamples` to zero so it cannot end on a click. Returns the peak before scaling.
 */
export function normalise(data: Float32Array, target: number, fadeSamples: number): number {
  const peak = peakOf(data);
  if (!(peak > 1e-6)) return 0;
  const scale = target / peak;
  const length = data.length;
  const fadeStart = Math.max(0, length - fadeSamples);
  for (let i = 0; i < fadeStart; i++) data[i] *= scale;
  for (let i = fadeStart; i < length; i++) data[i] *= (scale * (length - 1 - i)) / Math.max(1, fadeSamples);
  return peak;
}
