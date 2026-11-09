/**
 * renderTrack: a whole score built in an OfflineAudioContext and rendered into one buffer that loops seamlessly.
 *
 * The loop is rendered with `tail` extra seconds after it; those tails (the reverb, the last pad release, a piano note
 * still ringing) are then added back onto the start of the loop, exactly where they would sound when the loop comes
 * round again, so the loop point has no click and no gap. The buffer keeps the tail samples (zeroed) after the loop:
 * the player loops [0, loopSeconds) of it, which saves a second copy of a buffer that is megabytes long.
 */
import type { DrumSettings, MusicInstrument, TrackDef } from '../../data/music';
import { seededRandom } from '../dsp';
import { startRendering, type OfflineContextCtor } from '../render';
import { createNoiseBank, type NoiseBank } from '../synth';
import { makeImpulse, playChoir, playDrum, playHorn, playPadChord, playPiano, playStringLead } from './instruments';
import { choirChords, loopSeconds, padChords, scoreNotes } from './score';

export interface RenderedTrack {
  buffer: AudioBuffer;
  /** The loop: frames and seconds (the buffer is longer by the folded, zeroed tail). */
  loopFrames: number;
  loopSeconds: number;
  sampleRate: number;
  channels: number;
  /** Wall-clock milliseconds the render took, from building the graph to the folded, levelled buffer... */
  renderMs: number;
  /** ...and of that, the main-thread time spent building the graph (the rest runs on the audio thread). */
  buildMs: number;
  /** Bytes of sample memory the buffer holds. */
  bytes: number;
  /** Peak of the folded loop before it was levelled to the track's `peak`. */
  rawPeak: number;
}

/** Build the score into `ctx` (any BaseAudioContext): instruments on their buses, the buses into the dry mix and the reverb. */
export function buildTrack(ctx: BaseAudioContext, out: AudioNode, def: TrackDef, bank: NoiseBank): void {
  const rng = seededRandom(def.seed);
  // Everything through one gentle low-pass at the end: heard from far off, across a field.
  const dark = ctx.createBiquadFilter();
  dark.type = 'lowpass';
  dark.frequency.value = def.mix.lowpass;
  dark.Q.value = 0.5;
  dark.connect(out);
  const dest: AudioNode = dark;
  const reverb = ctx.createConvolver();
  reverb.normalize = true;
  reverb.buffer = makeImpulse(ctx, def.reverb, def.channels);
  const wet = ctx.createGain();
  wet.gain.value = def.mix.reverb;
  reverb.connect(wet);
  wet.connect(dest);
  // One bus per instrument the score uses, made when its first note comes.
  const buses = new Map<MusicInstrument, AudioNode>();
  const bus = (name: MusicInstrument): AudioNode => {
    const made = buses.get(name);
    if (made) return made;
    const m = def.mix[name];
    if (!m) throw new Error(`${def.title}: no mix for the ${name}`);
    const input = ctx.createGain();
    const dry = ctx.createGain();
    dry.gain.value = m.dry;
    const send = ctx.createGain();
    send.gain.value = m.send;
    input.connect(dry);
    dry.connect(dest);
    input.connect(send);
    send.connect(reverb);
    buses.set(name, input);
    return input;
  };
  const I = def.instruments;
  const need = <T>(settings: T | undefined, what: string): T => {
    if (settings === undefined) throw new Error(`${def.title}: the score needs the ${what}, which the track does not set`);
    return settings;
  };
  const H = def.humanize;
  const human = (t: number): number => Math.max(0, t + (rng() * 2 - 1) * H.time);
  const velocity = (v: number): number => Math.max(0.05, Math.min(1, v * (1 + (rng() * 2 - 1) * H.velocity)));
  // The pad a chord at a time (one filter pair per chord), not humanised.
  for (const c of padChords(def)) playPadChord(ctx, bus('pad'), c.at, c.length, c.notes, I.pad.level * c.vel, I.pad);
  for (const n of scoreNotes(def)) {
    switch (n.instrument) {
      case 'pad':
        // Played above, chord by chord.
        break;
      case 'horn':
        playHorn(ctx, bus('horn'), human(n.at), n.length, n.note, velocity(n.vel), I.horn, bank, rng);
        break;
      case 'piano':
        playPiano(ctx, bus('piano'), human(n.at), n.length, n.note, velocity(n.vel), need(I.piano, 'piano'), bank);
        break;
      case 'drum':
        if (n.length > 0) playRoll(ctx, bus('drum'), human(n.at), n.length, velocity(n.vel), n.pitch, I.drum, need(I.drum.roll, 'drum roll'), bank, rng);
        else playDrum(ctx, bus('drum'), human(n.at), velocity(n.vel), n.pitch, I.drum, bank);
        break;
      case 'strings':
        playStringLead(ctx, bus('strings'), human(n.at), n.length, n.note, velocity(n.vel), need(I.strings, 'strings'), rng);
        break;
      case 'choir':
        // Sung a chord at a time, below.
        break;
    }
  }
  for (const c of choirChords(def)) playChoir(ctx, bus('choir'), c.at, c.length, c.notes, c.vel, c.vowel, need(I.choir, 'choir'), rng);
}

/** A timpani roll: strokes at the drum's roll rate over `length` seconds, growing to `vel`, the last left to ring. */
function playRoll(ctx: BaseAudioContext, dest: AudioNode, at: number, length: number, vel: number, pitch: number, s: DrumSettings, r: NonNullable<DrumSettings['roll']>, bank: NoiseBank, rng: () => number): void {
  const strokes = Math.max(1, Math.round(length * r.rate));
  const short: DrumSettings = { ...s, decay: s.decay * r.ring };
  for (let k = 0; k < strokes; k++) {
    const share = r.start + ((1 - r.start) * k) / Math.max(1, strokes - 1);
    playDrum(ctx, dest, at + k / r.rate, vel * share * (0.9 + 0.2 * rng()), pitch, k < strokes - 1 ? short : s, bank);
  }
}

/** Add the tail after the loop back onto its start and zero it; then level the loop to `peak`. Returns the peak before. */
export function foldAndLevel(buffer: AudioBuffer, loopFrames: number, peak: number): number {
  let raw = 0;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    const tail = data.length - loopFrames;
    for (let i = 0; i < tail; i++) {
      // A tail longer than the loop would wrap more than once.
      data[i % loopFrames] += data[loopFrames + i];
      data[loopFrames + i] = 0;
    }
    for (let i = 0; i < loopFrames; i++) raw = Math.max(raw, Math.abs(data[i]));
  }
  if (raw > 1e-9) {
    const scale = peak / raw;
    for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < loopFrames; i++) data[i] *= scale;
    }
  }
  return raw;
}

/** Render a track once into a looping buffer. Rejects when the browser cannot render it; the caller carries on silently. */
export async function renderTrack(def: TrackDef, Offline: OfflineContextCtor, now: () => number = () => performance.now(), bank: NoiseBank = createNoiseBank()): Promise<RenderedTrack> {
  const started = now();
  const rate = def.sampleRate;
  const seconds = loopSeconds(def);
  const loopFrames = Math.round(seconds * rate);
  const frames = loopFrames + Math.ceil(def.tail * rate);
  const ctx = new Offline(def.channels, frames, rate);
  const master = ctx.createGain();
  master.connect(ctx.destination);
  buildTrack(ctx, master, def, bank);
  const buildMs = now() - started;
  const buffer = await startRendering(ctx);
  const rawPeak = foldAndLevel(buffer, loopFrames, def.peak);
  return {
    buffer,
    loopFrames,
    loopSeconds: loopFrames / rate,
    sampleRate: rate,
    channels: def.channels,
    renderMs: now() - started,
    buildMs,
    bytes: buffer.length * buffer.numberOfChannels * 4,
    rawPeak,
  };
}
