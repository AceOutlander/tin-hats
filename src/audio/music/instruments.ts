/**
 * The music instruments (settings in src/data/music.ts). Each builder schedules one note on any BaseAudioContext, so
 * the same code renders a track offline and could play live. A note is a pitch (MIDI), a start and a length in
 * seconds and a velocity 0..1; `dest` is the instrument's bus.
 */
import type { DrumSettings, HornSettings, PadSettings, PianoSettings, ReverbSettings } from '../../data/music';
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

function stopAt(source: AudioScheduledSourceNode, when: number): void {
  source.stop(when + AUDIO.stopPad);
}

/**
 * Dark string pad: `voices` detuned oscillators through one low-pass that swells open toward the middle of the chord
 * and closes again, with a slow fade in, a swell in level and a long release after `length`.
 */
export function playPad(ctx: BaseAudioContext, dest: AudioNode, at: number, length: number, note: number, level: number, s: PadSettings): void {
  const f = midiHz(note);
  const end = at + length;
  const stop = end + s.release;
  const mid = at + length * 0.5;
  // Two low-pass stages (24 dB an octave): the sawtooths keep their body and lose their buzz.
  const filter = ctx.createBiquadFilter();
  const filter2 = ctx.createBiquadFilter();
  for (const f2 of [filter, filter2]) {
    f2.type = 'lowpass';
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
  for (let v = 0; v < s.voices; v++) {
    const osc = ctx.createOscillator();
    osc.type = s.wave;
    osc.frequency.value = f;
    osc.detune.value = s.voices > 1 ? -s.detuneCents + (2 * s.detuneCents * v) / (s.voices - 1) : 0;
    osc.connect(voice);
    osc.start(at);
    stopAt(osc, stop);
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
  g.linearRampToValueAtTime(peak, at + s.attack);
  g.setValueAtTime(peak, end);
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
