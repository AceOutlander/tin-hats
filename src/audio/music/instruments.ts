/**
 * The music instruments (settings in src/data/music.ts). Each builder schedules one note on any BaseAudioContext, so
 * the same code renders a track offline and could play live. A note is a pitch (MIDI), a start and a length in
 * seconds and a velocity 0..1; `dest` is the instrument's bus.
 */
import type { ChoirSettings, DrumSettings, HornSettings, PadSettings, PianoSettings, ReverbSettings, StringLeadSettings } from '../../data/music';
import type { AnvilSettings, BattleChoirSettings, BellSettings, BrassSettings, HandSettings, SnareSettings, StringSettings, TimpaniSettings, WindSettings } from '../../data/musicBattle';
import { AUDIO } from '../../data/sounds';
import { seededRandom } from '../dsp';
import type { NoiseBank } from '../synth';

/** ln(1000): a decay of `seconds` to -60 dB is an exponential with time constant seconds / LN1000. */
const LN1000 = Math.log(1000);
/** Smallest level an exponential ramp may aim at. */
const FLOOR = 1e-4;

export function midiHz(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

/**
 * Automate these once per render quantum (128 frames, under 6 ms) instead of every sample: for a slow filter sweep or a
 * vibrato the difference cannot be heard, and a swept filter or a modulated detune computed per sample is what makes
 * a long offline render slow. A browser without the setting keeps the default.
 */
function kRate(...params: AudioParam[]): void {
  for (const p of params) p.automationRate = 'k-rate';
}

function stopAt(source: AudioScheduledSourceNode, when: number): void {
  source.stop(when + AUDIO.stopPad);
}

/**
 * Dark string pad: `voices` detuned oscillators through one low-pass that swells open toward the middle of the chord
 * and closes again, with a slow fade in, a swell in level and a long release after `length`.
 */
export function playPad(ctx: BaseAudioContext, dest: AudioNode, at: number, length: number, note: number, level: number, s: PadSettings): void {
  playPadChord(ctx, dest, at, length, [note], level, s);
}

/**
 * A whole pad chord through one filter pair and one envelope: the same sound as `playPad` note by note (the filters and
 * the envelope are the same for every note of a chord, and they are linear), at a fraction of the cost to render, since
 * a swept filter is the dearest node there is. `level` is the level of each note.
 */
export function playPadChord(ctx: BaseAudioContext, dest: AudioNode, at: number, length: number, notes: readonly number[], level: number, s: PadSettings): void {
  const end = at + length;
  const stop = end + s.release;
  const mid = at + length * 0.5;
  // Two low-pass stages (24 dB an octave): the sawtooths keep their body and lose their buzz.
  const filter = ctx.createBiquadFilter();
  const filter2 = ctx.createBiquadFilter();
  for (const f2 of [filter, filter2]) {
    f2.type = 'lowpass';
    if (s.kRate === true) kRate(f2.frequency, f2.Q);
    f2.Q.value = s.q;
    f2.frequency.setValueAtTime(s.cutoff, at);
    f2.frequency.exponentialRampToValueAtTime(s.swellCutoff, mid);
    f2.frequency.exponentialRampToValueAtTime(s.cutoff, end);
  }
  filter.connect(filter2);
  const env = ctx.createGain();
  const g = env.gain;
  // It breathes: up to its rest level, swelling to full in the middle of the chord, sinking back, then gone.
  g.value = 0;
  g.setValueAtTime(0, at);
  g.linearRampToValueAtTime(level * s.rest, at + Math.min(s.attack, length * 0.45));
  g.linearRampToValueAtTime(level, mid);
  g.linearRampToValueAtTime(level * s.rest, end);
  g.linearRampToValueAtTime(0, stop);
  const per = 1 / Math.max(1, s.voices);
  const voice = ctx.createGain();
  voice.gain.value = per;
  for (const note of notes) {
    const f = midiHz(note);
    for (let v = 0; v < s.voices; v++) {
      const osc = ctx.createOscillator();
      osc.type = s.wave;
      osc.frequency.value = f;
      osc.detune.value = s.voices > 1 ? -s.detuneCents + (2 * s.detuneCents * v) / (s.voices - 1) : 0;
      osc.connect(voice);
      osc.start(at);
      stopAt(osc, stop);
    }
  }
  voice.connect(filter);
  filter2.connect(env);
  env.connect(dest);
}

/**
 * A distant muted horn: a sawtooth with a triangle an octave down for body, through a low-pass that opens a little
 * as the note speaks (brighter when played harder), a soft attack, a vibrato that only comes in after a while, and
 * some breath.
 */
export function playHorn(ctx: BaseAudioContext, dest: AudioNode, at: number, length: number, note: number, vel: number, s: HornSettings, bank: NoiseBank, rng: () => number): void {
  const f = midiHz(note);
  const end = at + length;
  const stop = end + s.release;
  const peak = s.level * vel;
  const cutoff = s.cutoff + s.brightness * vel;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = s.q;
  filter.frequency.setValueAtTime(cutoff * 0.55, at);
  filter.frequency.exponentialRampToValueAtTime(cutoff, at + s.attack * 1.5);
  filter.frequency.setValueAtTime(cutoff, end);
  filter.frequency.exponentialRampToValueAtTime(cutoff * 0.5, stop);
  const env = ctx.createGain();
  const g = env.gain;
  g.value = 0;
  g.setValueAtTime(0, at);
  const swell = s.swell ?? 0;
  if (swell > 0 && length > s.attack * 2) {
    swellEnvelope(g, at, end, peak, s.attack, swell);
  } else {
    g.linearRampToValueAtTime(peak, at + s.attack);
    g.setValueAtTime(peak, end);
  }
  g.exponentialRampToValueAtTime(FLOOR, stop);

  // The vibrato: a sine on both oscillators' detune, silent until vibratoDelay, then rising to its depth.
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = s.vibratoRate * (0.92 + 0.16 * rng());
  const depth = ctx.createGain();
  depth.gain.value = 0;
  depth.gain.setValueAtTime(0, at + s.vibratoDelay);
  depth.gain.linearRampToValueAtTime(s.vibratoCents, at + s.vibratoDelay + s.vibratoRise);
  lfo.connect(depth);
  lfo.start(at);
  stopAt(lfo, stop);

  const saw = ctx.createOscillator();
  saw.type = 'sawtooth';
  saw.frequency.value = f;
  depth.connect(saw.detune);
  saw.connect(filter);
  saw.start(at);
  stopAt(saw, stop);
  const body = ctx.createOscillator();
  body.type = 'triangle';
  body.frequency.value = f / 2;
  depth.connect(body.detune);
  const bodyGain = ctx.createGain();
  bodyGain.gain.value = s.bodyMix;
  body.connect(bodyGain);
  bodyGain.connect(filter);
  body.start(at);
  stopAt(body, stop);
  filter.connect(env);
  env.connect(dest);

  // Breath through the mouthpiece, with the same envelope.
  if (s.breath > 0) {
    const noise = ctx.createBufferSource();
    const buffer = bank.get(ctx, 'pink');
    noise.buffer = buffer;
    noise.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = s.breathHz;
    band.Q.value = 1.2;
    const breath = ctx.createGain();
    breath.gain.value = s.breath;
    noise.connect(band);
    band.connect(breath);
    breath.connect(env);
    noise.start(at, rng() * buffer.duration * 0.9);
    stopAt(noise, stop);
  }
}

/** A long note leaning in: it speaks at (1 - swell) of `peak`, grows to `peak` in its middle and eases to (1 - swell / 2). */
function swellEnvelope(g: AudioParam, at: number, end: number, peak: number, attack: number, swell: number): void {
  g.linearRampToValueAtTime(peak * (1 - swell), at + attack);
  g.linearRampToValueAtTime(peak, at + Math.max(attack * 1.5, (end - at) * 0.5));
  g.linearRampToValueAtTime(peak * (1 - swell * 0.5), end);
}

/**
 * A string section on a melody: `voices` detuned sawtooths through two low-pass stages (brighter when played harder),
 * a slow bowed attack, a vibrato that comes in once the note has spoken, a swell over long notes and a long release,
 * so consecutive notes overlap into a legato.
 */
export function playStringLead(ctx: BaseAudioContext, dest: AudioNode, at: number, length: number, note: number, vel: number, s: StringLeadSettings, rng: () => number): void {
  const f = midiHz(note);
  const end = at + Math.max(length, s.attack);
  const stop = end + s.release;
  const peak = s.level * vel;
  const cutoff = s.cutoff + s.brightness * vel;
  const lp1 = ctx.createBiquadFilter();
  const lp2 = ctx.createBiquadFilter();
  for (const lp of [lp1, lp2]) {
    lp.type = 'lowpass';
    kRate(lp.frequency, lp.Q);
    lp.Q.value = s.q;
    lp.frequency.setValueAtTime(cutoff * 0.6, at);
    lp.frequency.exponentialRampToValueAtTime(cutoff, at + s.attack * 1.5);
  }
  lp1.connect(lp2);
  const env = ctx.createGain();
  const g = env.gain;
  g.value = 0;
  g.setValueAtTime(0, at);
  if (end - at > s.attack * 2) {
    swellEnvelope(g, at, end, peak, s.attack, s.swell);
  } else {
    g.linearRampToValueAtTime(peak * (1 - s.swell), at + s.attack);
    g.setValueAtTime(peak * (1 - s.swell), end);
  }
  g.linearRampToValueAtTime(0, stop);

  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = s.vibratoRate * (0.94 + 0.12 * rng());
  const depth = ctx.createGain();
  depth.gain.value = 0;
  depth.gain.setValueAtTime(0, at + s.vibratoDelay);
  depth.gain.linearRampToValueAtTime(s.vibratoCents, at + s.vibratoDelay + 0.8);
  lfo.connect(depth);
  lfo.start(at);
  stopAt(lfo, stop);

  const voice = ctx.createGain();
  voice.gain.value = 1 / Math.max(1, s.voices);
  for (let v = 0; v < s.voices; v++) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = f;
    kRate(osc.frequency, osc.detune);
    osc.detune.value = s.voices > 1 ? -s.detuneCents + (2 * s.detuneCents * v) / (s.voices - 1) : 0;
    depth.connect(osc.detune);
    osc.connect(voice);
    osc.start(at);
    stopAt(osc, stop);
  }
  voice.connect(lp1);
  lp2.connect(env);
  env.connect(dest);
}

/** One formant band of a vowel between "oo" (0) and "ah" (1): centre (geometric), quality and level (linear). */
function formantAt(s: ChoirSettings, band: number, vowel: number): [number, number, number] {
  const [ooHz, ooQ, ooLevel] = s.oo[band];
  const [ahHz, ahQ, ahLevel] = s.ah[band];
  const v = Math.max(0, Math.min(1, vowel));
  return [ooHz * Math.pow(ahHz / ooHz, v), ooQ + (ahQ - ooQ) * v, ooLevel + (ahLevel - ooLevel) * v];
}

/**
 * A wordless choir singing one chord: each note is `voices` detuned sawtooths sharing one slow vibrato, all summed and
 * softened, then shaped into a vowel by parallel band-passes at its formants, which glide from `vowel[0]` to `vowel[1]`
 * ("oo" 0 to "ah" 1) over the chord's length. One set of formants for the whole chord: a choir's vowel is the same
 * whatever the pitch, and it keeps the node count down.
 */
export function playChoir(ctx: BaseAudioContext, dest: AudioNode, at: number, length: number, notes: readonly number[], vel: number, vowel: readonly [number, number], s: ChoirSettings, rng: () => number): void {
  if (notes.length === 0) return;
  const end = at + length;
  const stop = end + s.release;
  const peak = s.level * vel;
  const buzz = ctx.createGain();
  buzz.gain.value = 1 / (Math.max(1, s.voices) * Math.sqrt(notes.length));
  const soft = ctx.createBiquadFilter();
  soft.type = 'lowpass';
  soft.frequency.value = s.sourceCutoff;
  soft.Q.value = 0.5;
  buzz.connect(soft);
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = s.vibratoRate * (0.9 + 0.2 * rng());
  const depth = ctx.createGain();
  depth.gain.value = s.vibratoCents;
  lfo.connect(depth);
  lfo.start(at);
  stopAt(lfo, stop);
  for (const note of notes) {
    const f = midiHz(note);
    for (let v = 0; v < s.voices; v++) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      const spread = s.voices > 1 ? -s.detuneCents + (2 * s.detuneCents * v) / (s.voices - 1) : 0;
      kRate(osc.frequency, osc.detune);
      osc.detune.value = spread + (rng() * 2 - 1) * 2;
      depth.connect(osc.detune);
      osc.connect(buzz);
      osc.start(at);
      stopAt(osc, stop);
    }
  }
  const env = ctx.createGain();
  const g = env.gain;
  g.value = 0;
  g.setValueAtTime(0, at);
  g.linearRampToValueAtTime(peak, at + Math.min(s.attack, length * 0.5));
  g.setValueAtTime(peak, end);
  g.linearRampToValueAtTime(0, stop);
  for (let band = 0; band < s.oo.length; band++) {
    const [hz0, q0, level0] = formantAt(s, band, vowel[0]);
    const [hz1, q1, level1] = formantAt(s, band, vowel[1]);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    kRate(bp.frequency, bp.Q);
    bp.frequency.setValueAtTime(hz0, at);
    bp.frequency.exponentialRampToValueAtTime(hz1, end);
    bp.Q.setValueAtTime(q0, at);
    bp.Q.linearRampToValueAtTime(q1, end);
    const level = ctx.createGain();
    level.gain.setValueAtTime(level0, at);
    level.gain.linearRampToValueAtTime(level1, end);
    soft.connect(bp);
    bp.connect(level);
    level.connect(env);
  }
  env.connect(dest);
}

/**
 * A soft piano: a few slightly inharmonic sine partials, each falling away exponentially (the higher, the faster),
 * damped when the written length is over, a felt hammer's thud, everything through a low-pass.
 */
export function playPiano(ctx: BaseAudioContext, dest: AudioNode, at: number, length: number, note: number, vel: number, s: PianoSettings, bank: NoiseBank): void {
  const f0 = midiHz(note);
  const peak = s.level * vel;
  const felt = ctx.createBiquadFilter();
  felt.type = 'lowpass';
  felt.frequency.value = s.cutoff * (0.7 + 0.3 * vel);
  felt.Q.value = 0.5;
  felt.connect(dest);
  const nyquist = ctx.sampleRate / 2;
  const struck = at + s.attack;
  const damped = at + length;
  for (const [n, level] of s.partials) {
    const fn = f0 * n * Math.sqrt(1 + s.inharmonicity * n * n);
    if (fn > nyquist * 0.9) continue;
    const decay = s.decay / Math.pow(n, s.decayPower);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = fn;
    const gain = ctx.createGain();
    const g = gain.gain;
    const p = peak * level;
    g.value = 0;
    g.setValueAtTime(0, at);
    g.linearRampToValueAtTime(p, struck);
    const ring = struck + decay;
    if (damped < ring) {
      // The damper comes down while it still rings: fall naturally until then, then quickly.
      const atDamp = p * Math.exp((-LN1000 * Math.max(0, damped - struck)) / decay);
      g.exponentialRampToValueAtTime(Math.max(FLOOR, atDamp), Math.max(struck + 0.001, damped));
      g.exponentialRampToValueAtTime(FLOOR, damped + s.damp);
    } else {
      g.exponentialRampToValueAtTime(FLOOR, ring);
    }
    osc.connect(gain);
    gain.connect(felt);
    osc.start(at);
    stopAt(osc, Math.min(ring, damped + s.damp));
  }
  if (s.hammer > 0) {
    const noise = ctx.createBufferSource();
    noise.buffer = bank.get(ctx, 'pink');
    const thud = ctx.createGain();
    thud.gain.value = 0;
    thud.gain.setValueAtTime(0, at);
    thud.gain.linearRampToValueAtTime(peak * s.hammer, at + 0.002);
    thud.gain.exponentialRampToValueAtTime(FLOOR, at + 0.06);
    noise.connect(thud);
    thud.connect(felt);
    noise.start(at);
    stopAt(noise, at + 0.07);
  }
}

/** A timpani or a far-off gun: a sine thump falling in pitch, an inharmonic overtone, a burst of low noise, a long tail. */
export function playDrum(ctx: BaseAudioContext, dest: AudioNode, at: number, vel: number, pitchMul: number, s: DrumSettings, bank: NoiseBank): void {
  const peak = s.level * vel;
  const end = at + s.decay;
  const body = (ratio: number, level: number, decay: number): void => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(s.pitch * pitchMul * ratio, at);
    osc.frequency.exponentialRampToValueAtTime(s.pitchEnd * pitchMul * ratio, at + s.drop);
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(level, at + 0.006);
    gain.gain.exponentialRampToValueAtTime(FLOOR, at + decay);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(at);
    stopAt(osc, at + decay);
  };
  body(1, peak, s.decay);
  body(s.overtone, peak * s.overtoneGain, s.decay * 0.4);
  const noise = ctx.createBufferSource();
  noise.buffer = bank.get(ctx, 'brown');
  const low = ctx.createBiquadFilter();
  low.type = 'lowpass';
  low.frequency.value = s.noiseCutoff;
  const thud = ctx.createGain();
  thud.gain.value = 0;
  thud.gain.setValueAtTime(0, at);
  thud.gain.linearRampToValueAtTime(peak * s.noise, at + 0.004);
  thud.gain.exponentialRampToValueAtTime(FLOOR, at + s.noiseDecay);
  noise.connect(low);
  low.connect(thud);
  thud.connect(dest);
  noise.start(at);
  stopAt(noise, Math.min(end, at + s.noiseDecay));
}

/**
 * The impulse response of the big dark reverb, generated: noise that falls 60 dB over `seconds` after a short
 * pre-delay and grows darker as it falls (a one-pole low-pass sliding from brightHz to darkHz). Each channel gets its
 * own noise, so a stereo render is wide.
 */
export function makeImpulse(ctx: BaseAudioContext, r: ReverbSettings, channels: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.max(1, Math.ceil((r.preDelay + r.seconds) * rate));
  const impulse = ctx.createBuffer(channels, length, rate);
  const pre = Math.round(r.preDelay * rate);
  for (let ch = 0; ch < channels; ch++) {
    const data = impulse.getChannelData(ch);
    const rng = seededRandom(r.seed + ch * 7919);
    let y = 0;
    for (let i = pre; i < length; i++) {
      const t = (i - pre) / rate;
      const k = t / r.seconds;
      const fc = r.brightHz * Math.pow(r.darkHz / r.brightHz, Math.min(1, k));
      const a = Math.exp((-2 * Math.PI * fc) / rate);
      y = (1 - a) * (rng() * 2 - 1) + a * y;
      data[i] = y * Math.exp(-LN1000 * k);
    }
  }
  return impulse;
}

// --- battle instruments (settings in src/data/musicBattle.ts) ----------------------------------------------------

/** A gain node with a fast attack to `peak` at `at` and an exponential fall to silence over `decay` seconds. */
function strike(ctx: BaseAudioContext, at: number, peak: number, decay: number, attack = 0.002): GainNode {
  const g = ctx.createGain();
  g.gain.value = 0;
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(Math.max(FLOOR, peak), at + attack);
  g.gain.exponentialRampToValueAtTime(FLOOR, at + attack + Math.max(0.005, decay));
  return g;
}

/** A looping noise source started at a random place in its table. */
function noiseAt(ctx: BaseAudioContext, bank: NoiseBank, color: 'white' | 'pink' | 'brown', at: number, stop: number, rng: () => number): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  const buffer = bank.get(ctx, color);
  src.buffer = buffer;
  src.loop = true;
  src.start(at, rng() * buffer.duration * 0.9);
  stopAt(src, stop);
  return src;
}

/** Snare: hit, ghost, flam, rim, or a roll lasting `length` seconds (crescendo from rollStart to full). */
export function playSnare(ctx: BaseAudioContext, dest: AudioNode, at: number, length: number, vel: number, art: string, s: SnareSettings, bank: NoiseBank, rng: () => number): void {
  const peak = s.level * vel;
  if (art === 'rim') {
    const end = at + s.rimDecay * 1.2;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = s.rimHz;
    band.Q.value = 4;
    const env = strike(ctx, at, peak * s.rimMix, s.rimDecay, 0.001);
    noiseAt(ctx, bank, 'white', at, end, rng).connect(band);
    band.connect(env);
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = s.rimHz * 0.5;
    osc.connect(env);
    osc.start(at);
    stopAt(osc, end);
    env.connect(dest);
    return;
  }
  if (art === 'roll') {
    // One noise source through the wires' filters; its gain is struck rollRate times a second, rising in level.
    const end = at + length;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = s.highpassHz;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = s.lowpassHz;
    const env = ctx.createGain();
    const g = env.gain;
    g.value = 0;
    g.setValueAtTime(0, at);
    const gap = 1 / s.rollRate;
    const strokes = Math.max(1, Math.round(length / gap));
    for (let k = 0; k < strokes; k++) {
      const t = at + k * gap;
      const share = s.rollStart + ((1 - s.rollStart) * k) / Math.max(1, strokes - 1);
      const p = peak * s.noiseMix * share * (0.85 + 0.3 * rng());
      g.setValueAtTime(FLOOR, t);
      g.linearRampToValueAtTime(p, t + 0.002);
      g.exponentialRampToValueAtTime(Math.max(FLOOR, p * 0.2), t + Math.min(gap * 0.95, s.rollDecay));
    }
    g.exponentialRampToValueAtTime(FLOOR, end + s.decay);
    noiseAt(ctx, bank, 'white', at, end + s.decay, rng).connect(hp);
    hp.connect(lp);
    lp.connect(env);
    env.connect(dest);
    return;
  }
  if (art === 'flam') snareStroke(ctx, dest, at - s.flamGap, peak * s.flamVel, s, bank, rng);
  snareStroke(ctx, dest, at, art === 'ghost' ? peak * s.ghost : peak, s, bank, rng);
}

function snareStroke(ctx: BaseAudioContext, dest: AudioNode, at: number, peak: number, s: SnareSettings, bank: NoiseBank, rng: () => number): void {
  const t = Math.max(0, at);
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(s.toneHz, t);
  osc.frequency.exponentialRampToValueAtTime(s.toneEndHz, t + 0.04);
  const body = strike(ctx, t, peak * s.toneMix, s.toneDecay);
  osc.connect(body);
  body.connect(dest);
  osc.start(t);
  stopAt(osc, t + s.toneDecay + 0.01);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = s.highpassHz;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = s.lowpassHz;
  const wires = strike(ctx, t, peak * s.noiseMix, s.decay, 0.001);
  noiseAt(ctx, bank, 'white', t, t + s.decay + 0.01, rng).connect(hp);
  hp.connect(lp);
  lp.connect(wires);
  wires.connect(dest);
}

/** Timpani: a tuned stroke (its modes over a thump), or a roll of soft strokes over `length` seconds. */
export function playTimpani(ctx: BaseAudioContext, dest: AudioNode, at: number, length: number, note: number, vel: number, art: string, s: TimpaniSettings, bank: NoiseBank, rng: () => number): void {
  if (art === 'roll') {
    const gap = 1 / s.rollRate;
    const strokes = Math.max(1, Math.round(length / gap));
    for (let k = 0; k < strokes; k++) {
      const share = 0.45 + (0.55 * k) / Math.max(1, strokes - 1);
      timpaniStroke(ctx, dest, at + k * gap, note, vel * share * (0.85 + 0.3 * rng()), s, bank, rng, k < strokes - 1 ? 0.35 : 1);
    }
    return;
  }
  timpaniStroke(ctx, dest, at, note, vel, s, bank, rng, 1);
}

function timpaniStroke(ctx: BaseAudioContext, dest: AudioNode, at: number, note: number, vel: number, s: TimpaniSettings, bank: NoiseBank, rng: () => number, ring: number): void {
  const f = midiHz(note);
  const peak = s.level * vel;
  const glide = Math.pow(2, s.glideCents / 1200);
  for (const [ratio, level, share] of s.modes) {
    const decay = s.decay * share * ring;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f * ratio * glide, at);
    osc.frequency.exponentialRampToValueAtTime(f * ratio, at + s.glideTime);
    const g = strike(ctx, at, peak * level, decay, 0.004);
    osc.connect(g);
    g.connect(dest);
    osc.start(at);
    stopAt(osc, at + decay + 0.01);
  }
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = s.noiseCutoff;
  const thud = strike(ctx, at, peak * s.noise, s.noiseDecay, 0.002);
  noiseAt(ctx, bank, 'brown', at, at + s.noiseDecay + 0.01, rng).connect(lp);
  lp.connect(thud);
  thud.connect(dest);
}

/** Low brass: detuned sawtooths scooping up into the note, the filter blaring open on the attack; a stab is short. */
export function playBrass(ctx: BaseAudioContext, dest: AudioNode, at: number, length: number, note: number, vel: number, art: string, s: BrassSettings): void {
  const f = midiHz(note);
  const len = art === 'stab' ? Math.min(length, s.stab) : length;
  const end = at + len;
  const stop = end + s.release;
  const peak = s.level * vel;
  const top = s.cutoff + s.envCutoff * vel;
  const settle = Math.max(s.cutoff, top * s.sustainShare);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = s.q;
  filter.frequency.setValueAtTime(s.cutoff, at);
  filter.frequency.exponentialRampToValueAtTime(top, at + s.attack);
  filter.frequency.exponentialRampToValueAtTime(settle, Math.max(at + s.attack + 0.001, Math.min(end, at + s.attack + s.envDecay)));
  filter.frequency.setValueAtTime(settle, Math.max(end, at + s.attack + 0.002));
  filter.frequency.exponentialRampToValueAtTime(s.cutoff, stop + 0.003);
  const env = ctx.createGain();
  env.gain.value = 0;
  env.gain.setValueAtTime(0, at);
  env.gain.linearRampToValueAtTime(peak, at + s.attack);
  env.gain.linearRampToValueAtTime(peak * (art === 'stab' ? 0.6 : 0.82), Math.max(at + s.attack + 0.001, end));
  env.gain.exponentialRampToValueAtTime(FLOOR, stop + 0.002);
  const voice = ctx.createGain();
  voice.gain.value = 1 / Math.max(1, s.voices);
  for (let v = 0; v < s.voices; v++) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = f;
    const spread = s.voices > 1 ? -s.detuneCents + (2 * s.detuneCents * v) / (s.voices - 1) : 0;
    osc.detune.setValueAtTime(spread - s.scoopCents, at);
    osc.detune.linearRampToValueAtTime(spread, at + s.scoopTime);
    osc.connect(voice);
    osc.start(at);
    stopAt(osc, stop);
  }
  voice.connect(filter);
  filter.connect(env);
  env.connect(dest);
}

/** Bowed strings: a short stab, a long note, or a tremolo for the note's length. */
export function playStrings(ctx: BaseAudioContext, dest: AudioNode, at: number, length: number, note: number, vel: number, art: string, s: StringSettings, bank: NoiseBank, rng: () => number): void {
  const f = midiHz(note);
  const len = art === 'short' ? Math.min(length, s.short) : length;
  const end = at + Math.max(len, s.attack + 0.01);
  const stop = end + s.release;
  const peak = s.level * vel;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = s.q;
  filter.frequency.value = s.cutoff + s.brightness * vel;
  const env = ctx.createGain();
  const g = env.gain;
  g.value = 0;
  g.setValueAtTime(0, at);
  if (art === 'trem') {
    const gap = 1 / s.tremRate;
    const strokes = Math.max(1, Math.floor((end - at) / gap));
    for (let k = 0; k < strokes; k++) {
      const t = at + k * gap;
      g.linearRampToValueAtTime(peak, t + gap * 0.25);
      g.linearRampToValueAtTime(peak * (1 - s.tremDepth), t + gap * 0.95);
    }
    g.linearRampToValueAtTime(peak * 0.8, end);
  } else {
    g.linearRampToValueAtTime(peak, at + s.attack);
    g.linearRampToValueAtTime(peak * (art === 'short' ? 0.55 : 0.9), end);
  }
  g.linearRampToValueAtTime(0, stop);
  const voice = ctx.createGain();
  voice.gain.value = 1 / Math.max(1, s.voices);
  for (let v = 0; v < s.voices; v++) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = f;
    osc.detune.value = s.voices > 1 ? -s.detuneCents + (2 * s.detuneCents * v) / (s.voices - 1) : 0;
    osc.connect(voice);
    osc.start(at);
    stopAt(osc, stop);
  }
  voice.connect(filter);
  if (s.bowNoise > 0) {
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = Math.min(ctx.sampleRate * 0.45, f * 4);
    band.Q.value = 1.5;
    const bow = ctx.createGain();
    bow.gain.value = s.bowNoise;
    noiseAt(ctx, bank, 'pink', at, stop, rng).connect(band);
    band.connect(bow);
    bow.connect(filter);
  }
  filter.connect(env);
  env.connect(dest);
}

/** A hand drum: dum (deep, open) or tek (high, dry). */
export function playHand(ctx: BaseAudioContext, dest: AudioNode, at: number, vel: number, art: string, s: HandSettings, bank: NoiseBank, rng: () => number): void {
  const peak = s.level * vel;
  const tek = art === 'tek';
  const decay = tek ? s.tekDecay : s.dumDecay;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(tek ? s.tekHz : s.dumHz, at);
  osc.frequency.exponentialRampToValueAtTime(tek ? s.tekHz * 0.8 : s.dumEndHz, at + decay * 0.6);
  const body = strike(ctx, at, peak, decay);
  osc.connect(body);
  body.connect(dest);
  osc.start(at);
  stopAt(osc, at + decay + 0.01);
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = Math.min(ctx.sampleRate * 0.45, tek ? s.tekHz * 3 : s.dumHz * 6);
  band.Q.value = 1.2;
  const slap = strike(ctx, at, peak * s.slap, tek ? 0.03 : 0.05, 0.001);
  noiseAt(ctx, bank, 'white', at, at + 0.07, rng).connect(band);
  band.connect(slap);
  slap.connect(dest);
}

/** A bell: inharmonic partials ringing for their own times, with a metallic strike. */
export function playBell(ctx: BaseAudioContext, dest: AudioNode, at: number, note: number, vel: number, s: BellSettings, bank: NoiseBank, rng: () => number): void {
  const f = midiHz(note);
  const peak = s.level * vel;
  const nyquist = ctx.sampleRate / 2;
  for (const [ratio, level, decay] of s.partials) {
    if (f * ratio > nyquist * 0.9) continue;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f * ratio;
    const g = strike(ctx, at, peak * level, decay, 0.003);
    osc.connect(g);
    g.connect(dest);
    osc.start(at);
    stopAt(osc, at + decay + 0.01);
  }
  if (s.strike > 0) {
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = Math.min(nyquist * 0.8, f * 4);
    band.Q.value = 3;
    const g = strike(ctx, at, peak * s.strike, 0.05, 0.001);
    noiseAt(ctx, bank, 'white', at, at + 0.07, rng).connect(band);
    band.connect(g);
    g.connect(dest);
  }
}

/** A mechanical anvil hit: hard inharmonic metal over a clank of noise; `note` sets its pitch. */
export function playAnvil(ctx: BaseAudioContext, dest: AudioNode, at: number, note: number, vel: number, s: AnvilSettings, bank: NoiseBank, rng: () => number): void {
  const f = midiHz(note);
  const peak = s.level * vel;
  const nyquist = ctx.sampleRate / 2;
  for (const [ratio, level] of s.partials) {
    if (f * ratio > nyquist * 0.9) continue;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = f * ratio;
    const g = strike(ctx, at, (peak * level) / 3, s.decay / Math.sqrt(ratio), 0.001);
    osc.connect(g);
    g.connect(dest);
    osc.start(at);
    stopAt(osc, at + s.decay + 0.01);
  }
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = Math.min(nyquist * 0.8, s.noiseHz);
  band.Q.value = 2;
  const g = strike(ctx, at, peak * s.noise, 0.06, 0.001);
  noiseAt(ctx, bank, 'white', at, at + 0.08, rng).connect(band);
  band.connect(g);
  g.connect(dest);
}

/**
 * A wordless choir: detuned sawtooths sharing one slow vibrato, through formant band-passes (the vowel) and a little
 * breath, swelling in slowly to full in the note's middle and dying away over the release.
 */
export function playBattleChoir(ctx: BaseAudioContext, dest: AudioNode, at: number, length: number, note: number, vel: number, s: BattleChoirSettings, bank: NoiseBank, rng: () => number): void {
  const f = midiHz(note);
  const end = at + Math.max(length, 0.05);
  const stop = end + s.release;
  const peak = s.level * vel;
  const nyquist = ctx.sampleRate / 2;
  const env = ctx.createGain();
  const g = env.gain;
  g.value = 0;
  g.setValueAtTime(0, at);
  g.linearRampToValueAtTime(peak * s.rest, at + Math.min(s.attack, (end - at) * 0.45));
  g.linearRampToValueAtTime(peak, at + (end - at) * 0.5);
  g.linearRampToValueAtTime(peak * s.rest, end);
  g.linearRampToValueAtTime(0, stop);
  // The vowel: parallel band-passes summed into the envelope.
  const vowel = ctx.createGain();
  vowel.gain.value = 1;
  for (const [hz, level, q] of s.formants) {
    if (hz > nyquist * 0.9) continue;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = hz;
    band.Q.value = q;
    const lv = ctx.createGain();
    lv.gain.value = level;
    vowel.connect(band);
    band.connect(lv);
    lv.connect(env);
  }
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = s.vibratoRate * (0.9 + 0.2 * rng());
  const depth = ctx.createGain();
  depth.gain.value = s.vibratoCents;
  lfo.connect(depth);
  lfo.start(at);
  stopAt(lfo, stop);
  const voice = ctx.createGain();
  voice.gain.value = 1 / Math.max(1, s.voices);
  for (let v = 0; v < s.voices; v++) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = f;
    osc.detune.value = s.voices > 1 ? -s.detuneCents + (2 * s.detuneCents * v) / (s.voices - 1) : 0;
    depth.connect(osc.detune);
    osc.connect(voice);
    osc.start(at);
    stopAt(osc, stop);
  }
  voice.connect(vowel);
  if (s.breath > 0) {
    const breath = ctx.createGain();
    breath.gain.value = s.breath;
    noiseAt(ctx, bank, 'pink', at, stop, rng).connect(breath);
    breath.connect(vowel);
  }
  env.connect(dest);
}

/**
 * Wind: looping noise through a resonant band-pass on the note. The band wanders up and down by up to driftCents and
 * the level gusts, each reaching a new target every 0.6 to 1.4 `gust` seconds, after a slow fade in.
 */
export function playWind(ctx: BaseAudioContext, dest: AudioNode, at: number, length: number, note: number, vel: number, s: WindSettings, bank: NoiseBank, rng: () => number): void {
  const top = ctx.sampleRate * 0.45;
  const f = Math.min(top, midiHz(note));
  const end = at + Math.max(length, s.attack);
  const stop = end + s.release;
  const peak = s.level * vel;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = s.q;
  const fq = band.frequency;
  fq.value = f;
  fq.setValueAtTime(f, at);
  const env = ctx.createGain();
  const g = env.gain;
  g.value = 0;
  g.setValueAtTime(0, at);
  g.linearRampToValueAtTime(peak * (1 - s.gustDepth * 0.5), at + s.attack);
  for (let t = at + s.attack + s.gust * (0.6 + 0.8 * rng()); t < end; t += s.gust * (0.6 + 0.8 * rng())) {
    fq.linearRampToValueAtTime(Math.min(top, f * Math.pow(2, ((rng() * 2 - 1) * s.driftCents) / 1200)), t);
    g.linearRampToValueAtTime(peak * (1 - s.gustDepth * rng()), t);
  }
  g.linearRampToValueAtTime(peak * (1 - s.gustDepth * 0.5), end);
  g.linearRampToValueAtTime(0, stop);
  noiseAt(ctx, bank, s.color, at, stop, rng).connect(band);
  band.connect(env);
  env.connect(dest);
}
