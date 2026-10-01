/**
 * Every sound in the game, as data for the WebAudio synthesiser in src/audio.
 *
 * A one-shot sound is a stack of layers. Each layer is an oscillator or a burst
 * of filtered noise with its own start time, pitch sweep, filter sweep and an
 * attack / hold / decay envelope. The engine renders each sound once into a
 * buffer, scales it so its peak equals `volume`, and plays copies of the buffer.
 * Loops (rain, tank engine) are sustained layers with slow modulation.
 *
 * Phone speakers reproduce very little below about 250 Hz, so every sound
 * carries its character in the mid band (filtered noise, harmonics); the
 * sub-bass layers are extra weight for headphones. dev/audio-preview.html
 * measures this for every sound.
 *
 * Pure data and pure helpers only: no DOM, no WebAudio types, no randomness.
 */
import type { Order } from './schema';

export type WaveShape = 'sine' | 'triangle' | 'square' | 'sawtooth';
export type NoiseColor = 'white' | 'pink' | 'brown';
export type FilterKind = 'lowpass' | 'highpass' | 'bandpass';

export interface FilterDef {
  kind: FilterKind;
  /** Cutoff or centre frequency in Hz at the start of the layer. */
  freq: number;
  /** Frequency the filter sweeps to (exponential); omitted = static. Ignored by loops. */
  freqEnd?: number;
  /** Seconds the sweep takes; omitted = the whole layer. */
  sweep?: number;
  /** Bandpass: centre / bandwidth. Lowpass and highpass: resonance at the cutoff in dB (WebAudio convention). */
  q: number;
}

/** A sine modulator. For tremolo, depth is the fraction of the level removed in each dip (0..1); for vibrato it is Hz. */
export interface LfoDef {
  rate: number;
  depth: number;
}

/** Random variation applied each time a sound is built, so no two renders are the same. */
export interface JitterDef {
  /** Start time moves by up to this many seconds either way. */
  at?: number;
  /** Level changes by up to this fraction either way. */
  gain?: number;
  /** Pitch and filter frequencies change by up to this fraction either way. */
  freq?: number;
}

interface LayerBase {
  /** Seconds after the start of the sound. */
  at: number;
  /** Peak level relative to the other layers (the whole sound is normalised afterwards). */
  gain: number;
  /** Envelope in seconds: linear rise, time at full level, then the fall. */
  attack: number;
  hold: number;
  decay: number;
  /** exp (default) falls 60 dB over `decay` like a natural ring-out; lin is a straight fade for sustained notes. */
  decayShape?: 'exp' | 'lin';
  filter?: FilterDef;
  tremolo?: LfoDef;
  jitter?: JitterDef;
}

export interface ToneLayer extends LayerBase {
  src: 'tone';
  wave: WaveShape;
  /** Starting pitch in Hz. */
  freq: number;
  /** Pitch the tone sweeps to (exponential); omitted = steady. */
  freqEnd?: number;
  /** Seconds the pitch stays at `freq` before the sweep begins. */
  sweepDelay?: number;
  /** Seconds the sweep takes; omitted = until the layer ends. */
  sweep?: number;
  /** Detune in cents, for a chorus between layers. */
  detune?: number;
  vibrato?: LfoDef;
}

export interface NoiseLayer extends LayerBase {
  src: 'noise';
  color: NoiseColor;
}

export type SoundLayer = ToneLayer | NoiseLayer;

export interface SoundDef {
  layers: SoundLayer[];
  /** Peak level (0..1) the rendered sound is normalised to: this is the mix. */
  volume: number;
  /** Seconds before the same sound may start again, unless the new one is clearly louder. */
  minInterval: number;
  /** Most copies of this sound that may overlap. */
  maxVoices: number;
  /** 1 = protected from the voice limiter (UI, whistles, stings); 0 = may be dropped when the mix is full. */
  priority: 0 | 1;
  /** Random playback-rate spread per play, as a fraction either way. */
  pitchJitter: number;
  /** How far the sound carries off-screen: multiplies AUDIO.falloffWu. */
  reach: number;
  /** Buffers rendered with different random draws; one is picked per play. */
  variants: number;
  /** Part of the gunfire bed: routed through the bus that blasts duck. Small arms and their impacts. */
  bed?: boolean;
  /**
   * Blasts and other big events dip the bed by `depth` (0..1 of its level) for `seconds`, then it swells back,
   * so a shell is heard over an army firing without being made louder than the compressor would allow.
   */
  duck?: { depth: number; seconds: number };
}

export interface LoopToneLayer {
  src: 'tone';
  wave: WaveShape;
  freq: number;
  gain: number;
  filter?: FilterDef;
  tremolo?: LfoDef;
  vibrato?: LfoDef;
}

export interface LoopNoiseLayer {
  src: 'noise';
  color: NoiseColor;
  gain: number;
  filter?: FilterDef;
  tremolo?: LfoDef;
}

export type LoopLayer = LoopToneLayer | LoopNoiseLayer;

export interface LoopDef {
  layers: LoopLayer[];
  /** Gain applied to the summed layers (loops are not normalised; dev/audio-preview checks their peak). */
  volume: number;
  /** Fade times in seconds. */
  fadeIn: number;
  fadeOut: number;
}

/** Engine and mix constants. */
export const AUDIO = {
  /** Most one-shot voices that may sound at once. When full, the quietest is dropped. */
  maxVoices: 24,
  /** Extra channels so a stolen voice can fade out while its replacement starts. */
  spareVoices: 8,
  /** Seconds a stolen voice takes to fade out. */
  stealFade: 0.015,
  /** A sound quieter than this peak level (after distance attenuation) is not played at all. */
  minAudible: 0.02,
  /** Inside its rate-limit window a sound still plays if it is this many times louder than the last one. */
  overrideRatio: 1.6,
  /** Score added to protected sounds so normal ones can never displace them. */
  priorityScore: 100,
  /** Stereo pan reached at the edge of the screen (0..1). */
  panWidth: 0.8,
  /** Distance past the screen edge (wu) at which a sound of reach 1 has fallen to half volume. */
  falloffWu: 700,
  /** Master compressor: only dense mixes should reach the threshold. */
  compressor: { threshold: -6, knee: 6, ratio: 3, attack: 0.003, release: 0.15 },
  /** Gain after the compressor (which adds its own make-up gain of about 1.7 at these settings). */
  masterGain: 1.1,
  /** Ducking of the gunfire bed: time constant of the dip and of the swell back (seconds). */
  duckAttack: 0.012,
  duckRelease: 0.18,
  /**
   * Seconds after the context starts before the first sound may begin. Browsers' compressors start fully
   * closed and open over about 0.15 s (measured: 74% at 0.06 s, 90% at 0.1 s), which would swallow the
   * attack of a sound played in the same instant the context is created.
   */
  warmup: 0.1,
  /** Final soft clipper: linear up to the knee, then bends so the output can never pass the ceiling. */
  clipKnee: 0.7,
  clipCeiling: 0.97,
  /** Largest input magnitude the clip curve covers, and its resolution. */
  clipRange: 4,
  clipCurveSize: 2049,
  /** Time constant of the mute fade in seconds. */
  muteFade: 0.02,
  /** Noise tables: length, loop crossfade (seconds) and RMS level. */
  noiseSeconds: 2,
  noiseCrossfade: 0.05,
  noiseRms: 0.3,
  /** An exponential decay ends at this fraction of the layer's peak (-60 dB). */
  decayFloor: 0.001,
  /** Shortest attack the engine schedules, to avoid clicks. */
  minAttack: 0.0005,
  /** Silence added after the last layer when rendering, and the fade applied to the last samples. */
  renderTail: 0.03,
  renderFadeOut: 0.004,
  /** Sources are stopped this long after their envelope ends. */
  stopPad: 0.01,
  /** Limits on the final playback rate. */
  pitchMin: 0.5,
  pitchMax: 2,
  /** Oscillator and filter frequencies are clamped to this range in Hz. */
  freqMin: 20,
  freqMax: 16000,
} as const;

type ToneExtra = Partial<Omit<ToneLayer, 'src' | 'wave' | 'freq' | 'gain' | 'attack' | 'hold' | 'decay'>>;
type NoiseExtra = Partial<Omit<NoiseLayer, 'src' | 'color' | 'gain' | 'attack' | 'hold' | 'decay'>>;

function tone(
  wave: WaveShape,
  freq: number,
  gain: number,
  attack: number,
  hold: number,
  decay: number,
  extra: ToneExtra = {},
): ToneLayer {
  return { src: 'tone', wave, freq, gain, at: 0, attack, hold, decay, ...extra };
}

function noise(
  color: NoiseColor,
  gain: number,
  attack: number,
  hold: number,
  decay: number,
  extra: NoiseExtra = {},
): NoiseLayer {
  return { src: 'noise', color, gain, at: 0, attack, hold, decay, ...extra };
}

function lp(freq: number, freqEnd?: number, q = 0, sweep?: number): FilterDef {
  return { kind: 'lowpass', freq, freqEnd, sweep, q };
}

function hp(freq: number, q = 0): FilterDef {
  return { kind: 'highpass', freq, q };
}

function bp(freq: number, q: number, freqEnd?: number, sweep?: number): FilterDef {
  return { kind: 'bandpass', freq, freqEnd, sweep, q };
}

function sound(layers: SoundLayer[], volume: number, extra: Partial<Omit<SoundDef, 'layers' | 'volume'>> = {}): SoundDef {
  return { layers, volume, minInterval: 0.05, maxVoices: 3, priority: 0, pitchJitter: 0.05, reach: 1, variants: 1, ...extra };
}

/** Equal-tempered pitches used by the brass phrases, in Hz. */
const NOTE = {
  D2: 73.42,
  Bb2: 116.54,
  D3: 146.83,
  F3: 174.61,
  A3: 220.0,
  Bb3: 233.08,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392.0,
  A4: 440.0,
  Bb4: 466.16,
  C5: 523.25,
  D5: 587.33,
  Eb5: 622.25,
  F5: 698.46,
  G5: 783.99,
  Bb5: 932.33,
} as const;

/**
 * One brass-like note: two detuned sawtooths through a lowpass that opens as
 * the note speaks, with a little vibrato. `bright` scales how far the filter opens.
 */
function brass(at: number, freq: number, length: number, gain: number, bright = 1, attack = 0.03): ToneLayer[] {
  const filter = lp(freq * 1.5, freq * 4 * bright, 2, 0.07);
  const vibrato: LfoDef = { rate: 5.5, depth: freq * 0.004 };
  return [
    tone('sawtooth', freq, gain, attack, length, 0.12, { at, detune: -5, decayShape: 'lin', filter, vibrato }),
    tone('sawtooth', freq, gain * 0.8, attack, length, 0.12, { at, detune: 6, decayShape: 'lin', filter, vibrato }),
  ];
}

/** A soft kettle-drum hit under the brass. */
function drum(at: number, freq: number, gain: number): SoundLayer[] {
  return [
    tone('sine', freq * 1.5, gain, 0.003, 0.02, 0.5, { at, freqEnd: freq, sweep: 0.05 }),
    noise('brown', gain * 0.5, 0.003, 0.01, 0.2, { at, filter: lp(300) }),
  ];
}

/** One blast on an officer's pea whistle: a warbling sine, its octave and breath noise. */
function blast(at: number, length: number, freq: number, freqEnd?: number): SoundLayer[] {
  const env = { at, decayShape: 'lin' as const };
  return [
    tone('sine', freq, 1, 0.012, length, 0.045, { ...env, freqEnd, vibrato: { rate: 36, depth: freq * 0.035 } }),
    tone('sine', freq * 2, 0.12, 0.012, length, 0.045, {
      ...env,
      freqEnd: freqEnd === undefined ? undefined : freqEnd * 2,
      vibrato: { rate: 36, depth: freq * 0.07 },
    }),
    noise('white', 0.35, 0.012, length, 0.045, { ...env, filter: bp(freq, 7, freqEnd) }),
  ];
}

/**
 * One blast of an air-raid style klaxon: two detuned sawtooths climbing a fourth with their octave above, so the
 * note carries on a phone speaker.
 */
function klaxon(at: number): SoundLayer[] {
  const filter = lp(1900, 2600, 1, 0.2);
  const env = { at, freqEnd: 247, sweep: 0.22, decayShape: 'lin' as const, filter };
  return [
    tone('sawtooth', 185, 0.9, 0.04, 0.34, 0.12, { ...env, detune: -7 }),
    tone('sawtooth', 185, 0.7, 0.04, 0.34, 0.12, { ...env, detune: 8 }),
    tone('square', 370, 0.25, 0.04, 0.34, 0.12, { ...env, freqEnd: 494, filter: lp(2200) }),
  ];
}

/** One rolling swell of distant thunder. Start, level and colour are randomised per render. */
function thunderRoll(at: number, gain: number): NoiseLayer {
  return noise('pink', gain, 0.3, 0.3, 1.5, {
    at,
    filter: lp(520),
    tremolo: { rate: 5, depth: 0.45 },
    jitter: { at: 0.3, gain: 0.4, freq: 0.3 },
  });
}

export const SOUNDS = {
  /** Bolt-action rifle: a crack, a muzzle thump and a short report. */
  rifleShot: sound(
    [
      noise('white', 2, 0.0008, 0.008, 0.09, { filter: bp(1800, 0.5, 900) }),
      noise('pink', 1.2, 0.001, 0.01, 0.2, { filter: lp(2400, 500) }),
      tone('triangle', 180, 0.25, 0.001, 0.008, 0.1, { freqEnd: 60, sweep: 0.07 }),
      noise('pink', 0.9, 0.01, 0.03, 0.42, { filter: bp(700, 0.6, 300) }),
    ],
    0.26,
    { minInterval: 0.05, maxVoices: 5, pitchJitter: 0.07, bed: true },
  ),

  /** One round from a light machine gun. Retriggered per shot, so a burst is a string of these. */
  mgShot: sound(
    [
      noise('white', 2, 0.0008, 0.005, 0.05, { filter: bp(1500, 0.6, 800) }),
      noise('pink', 1, 0.001, 0.006, 0.09, { filter: lp(1800, 500) }),
      tone('square', 150, 0.2, 0.001, 0.004, 0.05, { freqEnd: 65, sweep: 0.04, filter: lp(700) }),
      noise('pink', 0.35, 0.003, 0.01, 0.16, { filter: lp(900, 400) }),
    ],
    0.22,
    { minInterval: 0.045, maxVoices: 5, pitchJitter: 0.05, bed: true },
  ),

  /** Submachine gun: higher, drier and shorter. */
  smgShot: sound(
    [
      noise('white', 2, 0.0006, 0.004, 0.05, { filter: bp(2600, 0.7, 1600) }),
      noise('pink', 0.8, 0.001, 0.004, 0.07, { filter: lp(2600, 900) }),
      tone('triangle', 260, 0.15, 0.0008, 0.003, 0.03, { freqEnd: 120, sweep: 0.025 }),
      noise('pink', 0.5, 0.002, 0.006, 0.11, { filter: lp(1500, 600) }),
    ],
    0.17,
    { minInterval: 0.04, maxVoices: 4, pitchJitter: 0.06, bed: true },
  ),

  /** Sniper rifle: a hard crack, then a long tail with two echoes. */
  sniperShot: sound(
    [
      noise('white', 1.2, 0.0005, 0.005, 0.06, { filter: hp(1500) }),
      noise('pink', 1.2, 0.001, 0.012, 0.25, { filter: lp(2200, 400) }),
      tone('triangle', 150, 0.3, 0.001, 0.01, 0.2, { freqEnd: 44, sweep: 0.12 }),
      noise('pink', 0.7, 0.01, 0.06, 1, { filter: bp(750, 0.6, 240) }),
      noise('white', 0.5, 0.004, 0.02, 0.25, { at: 0.17, filter: bp(1300, 0.9, 700) }),
      noise('white', 0.3, 0.006, 0.03, 0.3, { at: 0.36, filter: bp(1000, 0.9, 500) }),
    ],
    0.33,
    { minInterval: 0.12, pitchJitter: 0.04, reach: 1.6 },
  ),

  /** Bunker and HQ machine gun: deeper and boxier than the field gun. */
  bunkerMg: sound(
    [
      noise('white', 1.6, 0.0008, 0.006, 0.06, { filter: bp(1000, 0.7, 550) }),
      noise('brown', 1.2, 0.001, 0.008, 0.1, { filter: lp(900, 300) }),
      tone('square', 110, 0.25, 0.001, 0.005, 0.07, { freqEnd: 52, sweep: 0.05, filter: lp(600) }),
      tone('sine', 330, 0.08, 0.001, 0.004, 0.05),
      noise('brown', 0.4, 0.003, 0.01, 0.18, { filter: lp(450) }),
    ],
    0.24,
    { minInterval: 0.05, maxVoices: 4, pitchJitter: 0.04, reach: 1.2, bed: true },
  ),

  /** A grenade leaves a hand: the spoon pings off, then a short whoosh rises and falls away. */
  grenadeThrow: sound(
    [
      tone('triangle', 3300, 0.35, 0.0005, 0.003, 0.05, { freqEnd: 2500, sweep: 0.04 }),
      noise('white', 0.25, 0.0005, 0.002, 0.012, { filter: hp(4000) }),
      noise('pink', 1, 0.06, 0.04, 0.16, { at: 0.04, filter: bp(500, 1.2, 2400, 0.2) }),
    ],
    0.09,
    { minInterval: 0.12, maxVoices: 2, pitchJitter: 0.1, reach: 0.9 },
  ),

  /** Hand grenade: a small sharp explosion with a patter of debris. */
  grenadeExplosion: sound(
    [
      noise('white', 1.5, 0.0008, 0.006, 0.09, { filter: bp(2200, 0.6, 900) }),
      noise('pink', 1.4, 0.002, 0.02, 0.32, { filter: lp(3000, 300) }),
      noise('brown', 1.2, 0.002, 0.03, 0.5, { filter: lp(1900, 180, 1) }),
      tone('sine', 115, 0.5, 0.002, 0.02, 0.32, { freqEnd: 36, sweep: 0.18 }),
      noise('white', 0.08, 0.03, 0.05, 0.35, { at: 0.09, filter: bp(2600, 0.8) }),
    ],
    0.55,
    { minInterval: 0.08, pitchJitter: 0.08, reach: 1.8, duck: { depth: 0.3, seconds: 0.2 } },
  ),

  /** Mortar launch: a hollow thump from the tube. */
  mortarLaunch: sound(
    [
      tone('sine', 170, 0.4, 0.002, 0.015, 0.22, { freqEnd: 46, sweep: 0.11 }),
      noise('pink', 2, 0.002, 0.01, 0.14, { filter: lp(1200, 300) }),
      tone('triangle', 430, 0.5, 0.001, 0.005, 0.08, { freqEnd: 300, sweep: 0.06, filter: bp(400, 3) }),
    ],
    0.4,
    { minInterval: 0.1, reach: 1.4 },
  ),

  /** Incoming shell: a falling whistle that swells until it lands. */
  shellWhistle: sound(
    [
      tone('sine', 2100, 0.5, 0.55, 0.25, 0.2, { freqEnd: 700, decayShape: 'lin', vibrato: { rate: 7, depth: 12 } }),
      tone('triangle', 2140, 0.2, 0.55, 0.25, 0.2, { freqEnd: 715, decayShape: 'lin' }),
      noise('white', 0.25, 0.55, 0.25, 0.2, { decayShape: 'lin', filter: bp(2300, 5, 800) }),
    ],
    0.1,
    { minInterval: 0.25, pitchJitter: 0.1, reach: 1.5 },
  ),

  /** Mortar bomb or tank shell landing: blast, thump and a low rumble. */
  explosionMedium: sound(
    [
      noise('white', 1.5, 0.0008, 0.008, 0.1, { filter: bp(2000, 0.6, 800) }),
      noise('pink', 2, 0.003, 0.04, 0.6, { filter: lp(3200, 250) }),
      noise('brown', 0.8, 0.003, 0.05, 0.9, { filter: lp(1500, 130, 1) }),
      tone('sine', 95, 0.4, 0.002, 0.03, 0.55, { freqEnd: 31, sweep: 0.25 }),
      noise('pink', 0.6, 0.18, 0.2, 1, { at: 0.12, filter: lp(500), tremolo: { rate: 6, depth: 0.35 } }),
      noise('brown', 0.35, 0.18, 0.2, 1, { at: 0.12, filter: lp(220), tremolo: { rate: 4.1, depth: 0.35 } }),
      noise('white', 0.06, 0.05, 0.1, 0.5, { at: 0.12, filter: bp(2800, 0.8) }),
    ],
    0.8,
    { minInterval: 0.1, pitchJitter: 0.08, reach: 2.5, duck: { depth: 0.45, seconds: 0.3 } },
  ),

  /** Artillery shell or aircraft bomb: a bigger blast with a long low rumble and falling debris. */
  explosionLarge: sound(
    [
      noise('white', 1.4, 0.001, 0.012, 0.14, { filter: bp(1700, 0.6, 600) }),
      noise('pink', 2, 0.004, 0.07, 1, { filter: lp(2800, 200) }),
      noise('brown', 0.9, 0.004, 0.09, 1.5, { filter: lp(1200, 90, 1) }),
      tone('sine', 72, 0.4, 0.003, 0.05, 0.9, { freqEnd: 25, sweep: 0.4 }),
      tone('sine', 48, 0.25, 0.01, 0.1, 1.2, { at: 0.03, freqEnd: 22, sweep: 0.6 }),
      noise('pink', 0.7, 0.3, 0.5, 1.8, { at: 0.18, filter: lp(420), tremolo: { rate: 4.5, depth: 0.4 } }),
      noise('brown', 0.4, 0.3, 0.5, 1.8, { at: 0.18, filter: lp(200), tremolo: { rate: 3.1, depth: 0.4 } }),
      noise('white', 0.06, 0.08, 0.2, 0.9, { at: 0.2, filter: bp(2600, 0.8) }),
    ],
    0.9,
    { minInterval: 0.15, pitchJitter: 0.08, reach: 4, duck: { depth: 0.6, seconds: 0.55 } },
  ),

  /** Tank main gun: a violent crack, a deep thump, a ring from the breech and an echo. */
  tankGun: sound(
    [
      noise('white', 1.2, 0.0005, 0.006, 0.07, { filter: hp(900) }),
      noise('pink', 1.5, 0.001, 0.02, 0.35, { filter: lp(2600, 300) }),
      noise('brown', 1.2, 0.002, 0.03, 0.6, { filter: lp(1000, 140, 1) }),
      tone('sine', 125, 0.6, 0.001, 0.02, 0.45, { freqEnd: 33, sweep: 0.14 }),
      tone('triangle', 615, 0.08, 0.002, 0.01, 0.3),
      tone('triangle', 921, 0.05, 0.002, 0.01, 0.22),
      noise('pink', 0.5, 0.03, 0.1, 0.7, { at: 0.05, filter: bp(500, 0.6, 200) }),
    ],
    0.85,
    { minInterval: 0.12, reach: 2.5, duck: { depth: 0.4, seconds: 0.3 } },
  ),

  /** Anti-tank rocket leaving the tube: ignition hiss, then a rising whoosh. */
  rocketLaunch: sound(
    [
      noise('white', 0.4, 0.008, 0.03, 0.14, { filter: hp(2200) }),
      noise('pink', 1, 0.04, 0.16, 0.6, { filter: bp(450, 1.3, 2600, 0.4) }),
      tone('sawtooth', 95, 0.3, 0.02, 0.1, 0.3, { freqEnd: 60, filter: lp(320) }),
    ],
    0.3,
    { minInterval: 0.1, pitchJitter: 0.08, reach: 1.4, duck: { depth: 0.25, seconds: 0.2 } },
  ),

  /** A round glancing off armour: a clang and a falling whine. */
  ricochet: sound(
    [
      noise('white', 0.8, 0.0005, 0.003, 0.03, { filter: bp(3600, 3) }),
      tone('sine', 3300, 0.5, 0.001, 0.02, 0.3, { freqEnd: 1150, sweep: 0.24 }),
      tone('triangle', 4350, 0.18, 0.001, 0.01, 0.2, { freqEnd: 1900, sweep: 0.2 }),
    ],
    0.15,
    { minInterval: 0.06, pitchJitter: 0.15, bed: true },
  ),

  /** A smoke canister: a pop, then a long hiss as the cloud pours out. */
  smokePop: sound(
    [
      noise('pink', 1.3, 0.001, 0.01, 0.12, { filter: lp(1800, 300) }),
      tone('sine', 240, 0.5, 0.001, 0.01, 0.1, { freqEnd: 90, sweep: 0.07 }),
      tone('triangle', 620, 0.25, 0.001, 0.005, 0.06, { freqEnd: 360, sweep: 0.05 }),
      noise('white', 0.9, 0.02, 0.25, 0.6, { at: 0.04, decayShape: 'lin', filter: bp(3000, 0.45) }),
      noise('pink', 0.5, 0.03, 0.2, 0.5, { at: 0.04, decayShape: 'lin', filter: bp(1100, 0.8) }),
    ],
    0.26,
    { minInterval: 0.3, maxVoices: 2, pitchJitter: 0.05, reach: 1.3 },
  ),

  /** Barbed wire parting under a tank or a blast: a snap and a short metallic twang. */
  wireSnap: sound(
    [
      noise('white', 0.9, 0.0005, 0.002, 0.02, { filter: hp(3000) }),
      tone('triangle', 560, 0.7, 0.001, 0.01, 0.5, { freqEnd: 470, sweep: 0.45, vibrato: { rate: 14, depth: 14 } }),
      tone('sine', 1120, 0.35, 0.001, 0.01, 0.4, { freqEnd: 940, sweep: 0.35 }),
      tone('sine', 1840, 0.18, 0.001, 0.005, 0.25),
    ],
    0.15,
    { minInterval: 0.1, maxVoices: 3, pitchJitter: 0.12, reach: 0.9 },
  ),

  /** A bullet hitting dirt: a soft puff. */
  dirtHit: sound(
    [
      noise('pink', 1, 0.0015, 0.004, 0.07, { filter: lp(1400, 350) }),
      tone('sine', 150, 0.25, 0.001, 0.003, 0.05, { freqEnd: 65, sweep: 0.04 }),
    ],
    0.12,
    { minInterval: 0.05, pitchJitter: 0.15, reach: 0.7, bed: true },
  ),

  uiClick: sound(
    [
      tone('triangle', 1250, 1, 0.001, 0.004, 0.035, { freqEnd: 880, sweep: 0.03 }),
      noise('white', 0.3, 0.0005, 0.002, 0.012, { filter: hp(3000) }),
    ],
    0.22,
    { minInterval: 0.03, maxVoices: 2, priority: 1, pitchJitter: 0 },
  ),

  /** Two low buzzes, the second lower: "no". */
  uiDeny: sound(
    [
      tone('square', 277.18, 1, 0.004, 0.07, 0.04, { decayShape: 'lin', filter: lp(1500) }),
      tone('square', 207.65, 1.4, 0.004, 0.12, 0.06, { at: 0.12, decayShape: 'lin', filter: lp(1000) }),
      // The octave above each buzz, so a phone speaker that drops the low notes still says no.
      tone('triangle', 554.37, 0.7, 0.004, 0.07, 0.04, { decayShape: 'lin' }),
      tone('triangle', 415.3, 0.9, 0.004, 0.12, 0.06, { at: 0.12, decayShape: 'lin' }),
    ],
    0.1,
    { minInterval: 0.15, maxVoices: 1, priority: 1, pitchJitter: 0 },
  ),

  /** Two bright rising notes: "yes". */
  uiConfirm: sound(
    [
      tone('triangle', 659.26, 1, 0.003, 0.05, 0.1),
      tone('triangle', 987.77, 1, 0.003, 0.06, 0.2, { at: 0.085 }),
      tone('sine', 1975.53, 0.2, 0.003, 0.03, 0.15, { at: 0.085 }),
    ],
    0.12,
    { minInterval: 0.1, maxVoices: 1, priority: 1, pitchJitter: 0 },
  ),

  /** Order whistle, Fall Back: three short blasts stepping down. */
  whistleFallBack: sound(
    [...blast(0, 0.13, 2950), ...blast(0.2, 0.13, 2650), ...blast(0.4, 0.22, 2350, 2150)],
    0.12,
    { minInterval: 0.3, maxVoices: 1, priority: 1, pitchJitter: 0 },
  ),

  /** Order whistle, Hold: two even blasts. */
  whistleHold: sound([...blast(0, 0.16, 2750), ...blast(0.27, 0.16, 2750)], 0.12, {
    minInterval: 0.3,
    maxVoices: 1,
    priority: 1,
    pitchJitter: 0,
  }),

  /** Order whistle, Advance: one long rising blast. */
  whistleAdvance: sound(blast(0, 0.5, 2400, 3100), 0.12, {
    minInterval: 0.3,
    maxVoices: 1,
    priority: 1,
    pitchJitter: 0,
  }),

  /** A unit finished training: a two-note bugle call over two taps on a snare. */
  unitTrained: sound(
    [
      ...brass(0, NOTE.G4, 0.07, 0.8),
      ...brass(0.12, NOTE.C5, 0.2, 1),
      noise('white', 0.25, 0.001, 0.005, 0.08, { filter: hp(1800) }),
      noise('white', 0.25, 0.001, 0.005, 0.08, { at: 0.12, filter: hp(1800) }),
    ],
    0.14,
    { minInterval: 0.2, maxVoices: 2, priority: 1, pitchJitter: 0 },
  ),

  /** Supplies delivered: a crate thunk and a small two-note chime. */
  suppliesDelivered: sound(
    [
      tone('sine', 135, 1, 0.002, 0.01, 0.1, { freqEnd: 68, sweep: 0.07 }),
      noise('pink', 0.6, 0.002, 0.008, 0.07, { filter: lp(700, 300) }),
      tone('triangle', 345, 0.25, 0.001, 0.005, 0.045),
      tone('sine', 1568, 0.35, 0.003, 0.02, 0.4, { at: 0.1 }),
      tone('sine', 2093, 0.3, 0.003, 0.02, 0.5, { at: 0.19 }),
      tone('sine', 4327, 0.06, 0.002, 0.005, 0.12, { at: 0.1 }),
    ],
    0.2,
    { minInterval: 0.15, maxVoices: 2, pitchJitter: 0.02 },
  ),

  /** A pillbox giving way: a crack and a boom, then lumps of concrete rattling down and dust settling. */
  pillboxCollapse: sound(
    [
      noise('white', 1.2, 0.001, 0.01, 0.1, { filter: bp(1600, 0.6, 700) }),
      noise('pink', 1.6, 0.003, 0.05, 0.5, { filter: lp(2600, 300) }),
      tone('sine', 85, 0.35, 0.002, 0.03, 0.6, { freqEnd: 34, sweep: 0.3 }),
      noise('white', 0.5, 0.004, 0.01, 0.12, { at: 0.18, filter: bp(1900, 1.4), jitter: { at: 0.02, gain: 0.3 } }),
      noise('white', 0.4, 0.004, 0.01, 0.1, { at: 0.34, filter: bp(1500, 1.4), jitter: { at: 0.03, gain: 0.3 } }),
      noise('white', 0.32, 0.004, 0.01, 0.1, { at: 0.52, filter: bp(2300, 1.4), jitter: { at: 0.03, gain: 0.3 } }),
      noise('white', 0.25, 0.004, 0.01, 0.12, { at: 0.75, filter: bp(1700, 1.4), jitter: { at: 0.04, gain: 0.3 } }),
      noise('pink', 0.5, 0.05, 0.25, 1.2, { at: 0.15, filter: lp(900), tremolo: { rate: 9, depth: 0.5 } }),
    ],
    0.5,
    { minInterval: 0.3, maxVoices: 2, pitchJitter: 0.06, reach: 2.2, duck: { depth: 0.5, seconds: 0.4 } },
  ),

  /** A support call-in acknowledged over the radio: squelch, two beeps, a breath of static. */
  supportCall: sound(
    [
      noise('white', 0.7, 0.001, 0.01, 0.05, { filter: bp(2400, 1.2) }),
      tone('square', 1040, 0.5, 0.002, 0.07, 0.01, { at: 0.06, decayShape: 'lin', filter: bp(1400, 2) }),
      tone('square', 1400, 0.5, 0.002, 0.07, 0.01, { at: 0.17, decayShape: 'lin', filter: bp(1700, 2) }),
      noise('white', 0.3, 0.003, 0.08, 0.1, { at: 0.26, decayShape: 'lin', filter: bp(1800, 0.8) }),
      noise('white', 0.6, 0.001, 0.01, 0.04, { at: 0.38, filter: bp(2400, 1.2) }),
    ],
    0.08,
    { minInterval: 0.2, maxVoices: 1, priority: 1, pitchJitter: 0.02 },
  ),

  /** A trench taken: cloth snaps in the wind, then a short rising bugle call. */
  trenchCaptured: sound(
    [
      noise('pink', 0.5, 0.01, 0.05, 0.14, { filter: bp(1400, 0.8, 3200, 0.1) }),
      ...brass(0.08, NOTE.G4, 0.07, 0.8),
      ...brass(0.2, NOTE.C5, 0.07, 0.9),
      ...brass(0.32, NOTE.G5, 0.3, 1),
      noise('white', 0.25, 0.001, 0.005, 0.08, { at: 0.08, filter: hp(1800) }),
      noise('white', 0.25, 0.001, 0.005, 0.08, { at: 0.2, filter: hp(1800) }),
    ],
    0.125,
    { minInterval: 0.5, maxVoices: 1, priority: 1, pitchJitter: 0, reach: 2 },
  ),

  /** The enemy is coming: two blasts of a klaxon. */
  waveHorn: sound(
    [
      ...klaxon(0),
      ...klaxon(0.55),
    ],
    0.23,
    { minInterval: 2, maxVoices: 1, priority: 1, pitchJitter: 0 },
  ),

  /** One tick of the clock in the last seconds of a timed mission. */
  timerTick: sound(
    [
      tone('triangle', 2400, 0.8, 0.0005, 0.004, 0.03, { freqEnd: 1700, sweep: 0.02 }),
      noise('white', 0.3, 0.0005, 0.002, 0.012, { filter: bp(3500, 2) }),
      tone('sine', 700, 0.3, 0.0005, 0.006, 0.05, { freqEnd: 400, sweep: 0.03 }),
    ],
    0.18,
    { minInterval: 0.3, maxVoices: 1, priority: 1, pitchJitter: 0 },
  ),

  /** Airdrop: the canopy snaps open, flutters down, and the crate lands. */
  airdrop: sound(
    [
      noise('pink', 1.4, 0.03, 0.05, 0.35, { filter: lp(1400, 300) }),
      tone('sine', 88, 0.3, 0.02, 0.04, 0.3, { freqEnd: 48, sweep: 0.25 }),
      noise('pink', 0.6, 0.12, 0.45, 0.4, { at: 0.2, filter: bp(1100, 0.8), tremolo: { rate: 9, depth: 0.6 } }),
      tone('sine', 900, 0.1, 0.2, 0.3, 0.4, { at: 0.2, freqEnd: 540, decayShape: 'lin' }),
      tone('sine', 125, 0.4, 0.002, 0.01, 0.12, { at: 1.2, freqEnd: 62, sweep: 0.06 }),
      noise('pink', 1, 0.002, 0.01, 0.09, { at: 1.2, filter: lp(1200, 350) }),
    ],
    0.4,
    { minInterval: 0.5, maxVoices: 2, pitchJitter: 0.03, reach: 2 },
  ),

  /** Strike aircraft passing overhead: an engine drone that swells and drops in pitch as it goes by. */
  planeFlyby: sound(
    [
      tone('sawtooth', 148, 0.8, 1, 0.3, 1.3, {
        freqEnd: 96,
        sweepDelay: 0.9,
        sweep: 0.6,
        detune: -8,
        decayShape: 'lin',
        filter: lp(1800, 700),
        tremolo: { rate: 27, depth: 0.35 },
      }),
      tone('sawtooth', 148, 0.6, 1, 0.3, 1.3, {
        freqEnd: 96,
        sweepDelay: 0.9,
        sweep: 0.6,
        detune: 9,
        decayShape: 'lin',
        filter: lp(1800, 700),
        tremolo: { rate: 27, depth: 0.35 },
      }),
      tone('square', 74, 0.12, 1, 0.3, 1.3, {
        freqEnd: 48,
        sweepDelay: 0.9,
        sweep: 0.6,
        decayShape: 'lin',
        filter: lp(400),
      }),
      noise('pink', 0.9, 1, 0.3, 1.3, { decayShape: 'lin', filter: bp(900, 0.7, 350) }),
      // The engine's second harmonic, which a phone speaker can actually play.
      tone('sawtooth', 296, 0.4, 1, 0.3, 1.3, {
        freqEnd: 192,
        sweepDelay: 0.9,
        sweep: 0.6,
        decayShape: 'lin',
        filter: lp(2200, 900),
        tremolo: { rate: 27, depth: 0.35 },
      }),
    ],
    0.36,
    { minInterval: 1, maxVoices: 1, priority: 1, pitchJitter: 0.03, reach: 5 },
  ),

  /** Victory: an original rising brass phrase in B flat major ending on a held chord. */
  victorySting: sound(
    [
      ...drum(0, NOTE.Bb2, 0.6),
      ...brass(0, NOTE.Bb4, 0.11, 0.8),
      ...brass(0.16, NOTE.D5, 0.11, 0.8),
      ...brass(0.32, NOTE.F5, 0.24, 0.9),
      ...brass(0.64, NOTE.Eb5, 0.09, 0.8),
      ...brass(0.78, NOTE.F5, 0.09, 0.8),
      ...brass(0.92, NOTE.G5, 0.11, 0.85),
      ...drum(1.08, NOTE.Bb2, 0.8),
      ...brass(1.08, NOTE.Bb5, 0.85, 1),
      ...brass(1.08, NOTE.F5, 0.85, 0.5),
      ...brass(1.08, NOTE.D5, 0.85, 0.5),
      ...brass(1.08, NOTE.Bb3, 0.85, 0.5),
    ],
    0.5,
    { minInterval: 2, maxVoices: 1, priority: 1, pitchJitter: 0 },
  ),

  /** Defeat: an original slow falling phrase in D minor on darker, muted brass. */
  defeatSting: sound(
    [
      ...drum(0, NOTE.D2, 0.5),
      ...brass(0, NOTE.A4, 0.34, 0.8, 0.6, 0.06),
      ...brass(0.45, NOTE.F4, 0.34, 0.8, 0.6, 0.06),
      ...brass(0.9, NOTE.E4, 0.3, 0.75, 0.6, 0.06),
      ...drum(1.3, NOTE.D2, 0.7),
      ...brass(1.3, NOTE.D4, 1.1, 0.9, 0.55, 0.06),
      ...brass(1.3, NOTE.A3, 1.1, 0.45, 0.5, 0.06),
      ...brass(1.3, NOTE.F3, 1.1, 0.35, 0.5, 0.06),
      ...brass(1.3, NOTE.D3, 1.1, 0.5, 0.5, 0.06),
    ],
    0.5,
    { minInterval: 2, maxVoices: 1, priority: 1, pitchJitter: 0 },
  ),

  /** Thunder: a sharp crack and a tearing sound, then a boom and a long low roll. Randomised per render and per play. */
  thunder: sound(
    [
      noise('white', 1.2, 0.001, 0.02, 0.22, { filter: hp(1500), jitter: { gain: 0.3 } }),
      noise('white', 1, 0.005, 0.06, 0.4, { at: 0.03, filter: bp(2200, 0.8, 600), jitter: { at: 0.03, gain: 0.3 } }),
      noise('pink', 1.5, 0.01, 0.1, 1.2, { at: 0.05, filter: lp(1800, 250), jitter: { gain: 0.2, freq: 0.2 } }),
      noise('brown', 0.8, 0.01, 0.1, 1.4, { at: 0.05, filter: lp(500, 90), jitter: { gain: 0.2, freq: 0.2 } }),
      tone('sine', 55, 0.3, 0.01, 0.05, 1, { at: 0.05, freqEnd: 30, jitter: { freq: 0.15 } }),
      thunderRoll(0.6, 1),
      thunderRoll(1.3, 0.85),
      thunderRoll(2.1, 0.7),
      thunderRoll(3, 0.45),
    ],
    0.75,
    { minInterval: 1.5, maxVoices: 2, priority: 1, pitchJitter: 0.12, variants: 3 },
  ),
} satisfies Record<string, SoundDef>;

export const LOOPS = {
  /** Steady rain: hiss, a brighter patter and a low wash, each drifting slowly. */
  rain: {
    layers: [
      { src: 'noise', color: 'pink', gain: 1, filter: bp(2600, 0.45), tremolo: { rate: 0.13, depth: 0.2 } },
      { src: 'noise', color: 'white', gain: 0.25, filter: hp(5000), tremolo: { rate: 0.37, depth: 0.3 } },
      { src: 'noise', color: 'brown', gain: 0.6, filter: lp(420), tremolo: { rate: 0.21, depth: 0.25 } },
    ],
    volume: 0.1,
    fadeIn: 1.5,
    fadeOut: 1.5,
  },

  /**
   * Tank engine: a growl in the mid band (the harmonics of a low sawtooth, pulsing at the firing rate),
   * a little weight underneath, exhaust chug and a faint clatter of tracks.
   */
  tankEngine: {
    layers: [
      {
        src: 'tone',
        wave: 'sawtooth',
        freq: 46,
        gain: 1,
        filter: bp(420, 1.1),
        tremolo: { rate: 23, depth: 0.5 },
        vibrato: { rate: 6.3, depth: 1.5 },
      },
      { src: 'tone', wave: 'sawtooth', freq: 46.4, gain: 0.15, filter: lp(160) },
      { src: 'noise', color: 'pink', gain: 1, filter: bp(500, 0.9), tremolo: { rate: 11.5, depth: 0.7 } },
      { src: 'noise', color: 'white', gain: 0.15, filter: bp(2100, 2.5), tremolo: { rate: 17, depth: 0.9 } },
    ],
    volume: 0.15,
    fadeIn: 0.4,
    fadeOut: 0.6,
  },
} satisfies Record<string, LoopDef>;

export type OneShotName = keyof typeof SOUNDS;
export type LoopName = keyof typeof LOOPS;
export type SoundName = OneShotName | LoopName;

export const ONE_SHOT_NAMES = Object.keys(SOUNDS) as OneShotName[];
export const LOOP_NAMES = Object.keys(LOOPS) as LoopName[];
/** Every sound the engine knows: one-shots (play, playAt) followed by loops (startLoop, stopLoop). */
export const SOUND_NAMES: readonly SoundName[] = [...ONE_SHOT_NAMES, ...LOOP_NAMES];

export function isSoundName(name: string): name is SoundName {
  return (SOUND_NAMES as readonly string[]).includes(name);
}

/** The whistle that announces each army order. */
export const ORDER_WHISTLE: Record<Order, OneShotName> = {
  fallBack: 'whistleFallBack',
  hold: 'whistleHold',
  advance: 'whistleAdvance',
};

/** The sound behind each UI feedback name in src/ui/contracts.ts. */
export const UI_SOUND: Record<'click' | 'deny' | 'confirm', OneShotName> = {
  click: 'uiClick',
  deny: 'uiDeny',
  confirm: 'uiConfirm',
};

/**
 * The sounds the app plays for sim events the battlefield view is silent on (src/app/sfx.ts). Everything else
 * on the field (shots, blasts, deliveries, whistles, engines, weather) is played by the view itself.
 */
export const EVENT_SOUND = {
  trenchCaptured: 'trenchCaptured',
  wireDestroyed: 'wireSnap',
  smokeSpawned: 'smokePop',
  supportCalled: 'supportCall',
  grenadeThrown: 'grenadeThrow',
  pillboxDestroyed: 'pillboxCollapse',
  waveWarning: 'waveHorn',
  timerTick: 'timerTick',
} as const satisfies Record<string, OneShotName>;

/** How the app's own event sounds are played. */
export const SFX = {
  /** A trench the enemy takes sounds like ours, but lower and quieter. */
  enemyCapture: { volume: 0.7, pitch: 0.8 },
  /** The clock ticks once a second in the last `tickSeconds` of a timed mission, louder in the last `loudSeconds`. */
  tickSeconds: 10,
  loudSeconds: 3,
  loudTickVolume: 1.6,
} as const;

/** Seconds from the start of a sound to the end of its last layer, allowing for the latest random start. */
export function soundDuration(def: SoundDef): number {
  let end = 0;
  for (const layer of def.layers) {
    const stop = layer.at + (layer.jitter?.at ?? 0) + layer.attack + layer.hold + layer.decay;
    if (stop > end) end = stop;
  }
  return end;
}

/** Sum of the layer levels: an upper bound on the peak of a sound before it is normalised. */
export function layerGainSum(def: SoundDef): number {
  let sum = 0;
  for (const layer of def.layers) sum += layer.gain * (1 + (layer.jitter?.gain ?? 0));
  return sum;
}
