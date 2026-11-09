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
  /** ...and of that, the longest main-thread task building the graph (all of it, or its first chunk; the rest runs on\n   * the audio thread). */
  buildMs: number;
  /** Bytes of sample memory the buffer holds. */
  bytes: number;
  /** Peak of the folded loop before it was levelled to the track's `peak`. */
  rawPeak: number;
}

/** One note (or chord, or roll) of the score, ready to be added to the graph: when it starts, and what adds it. */
interface NoteJob {
  at: number;
  play: (rng: () => number) => void;
}

/**
 * The score's graph without its notes (the buses, the dry mix and the reverb into `out`) and every note as a job, in
 * the order they are to be added. A track built all at once adds them in score order, humanised from one random
 * stream (as every looping track always was). A track rendered in chunks (`TrackDef.chunk`) adds them in time order,
 * each humanised from its own stream (seeded from the track's seed and its place in the score), so the music does not
 * depend on where the chunks fall.
 */
function trackJobs(ctx: BaseAudioContext, out: AudioNode, def: TrackDef, bank: NoiseBank): { at: number; play: () => void }[] {
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
  const human = (rng: () => number, t: number): number => Math.max(0, t + (rng() * 2 - 1) * H.time);
  const velocity = (rng: () => number, v: number): number => Math.max(0.05, Math.min(1, v * (1 + (rng() * 2 - 1) * H.velocity)));
  const jobs: NoteJob[] = [];
  // The pad a chord at a time (one filter pair per chord), not humanised.
  for (const c of padChords(def)) jobs.push({ at: c.at, play: () => playPadChord(ctx, bus('pad'), c.at, c.length, c.notes, I.pad.level * c.vel, I.pad) });
  for (const n of scoreNotes(def)) {
    switch (n.instrument) {
      case 'pad':
        // Played chord by chord, above.
        break;
      case 'horn':
        jobs.push({ at: n.at, play: (rng) => playHorn(ctx, bus('horn'), human(rng, n.at), n.length, n.note, velocity(rng, n.vel), I.horn, bank, rng) });
        break;
      case 'piano': {
        const s = need(I.piano, 'piano');
        jobs.push({ at: n.at, play: (rng) => playPiano(ctx, bus('piano'), human(rng, n.at), n.length, n.note, velocity(rng, n.vel), s, bank) });
        break;
      }
      case 'drum':
        if (n.length > 0) {
          const roll = need(I.drum.roll, 'drum roll');
          jobs.push({ at: n.at, play: (rng) => playRoll(ctx, bus('drum'), human(rng, n.at), n.length, velocity(rng, n.vel), n.pitch, I.drum, roll, bank, rng) });
        } else {
          jobs.push({ at: n.at, play: (rng) => playDrum(ctx, bus('drum'), human(rng, n.at), velocity(rng, n.vel), n.pitch, I.drum, bank) });
        }
        break;
      case 'strings': {
        const s = need(I.strings, 'strings');
        jobs.push({ at: n.at, play: (rng) => playStringLead(ctx, bus('strings'), human(rng, n.at), n.length, n.note, velocity(rng, n.vel), s, rng) });
        break;
      }
      case 'choir':
        // Sung a chord at a time, below.
        break;
    }
  }
  const chords = choirChords(def);
  if (chords.length > 0) {
    const s = need(I.choir, 'choir');
    for (const c of chords) jobs.push({ at: c.at, play: (rng) => playChoir(ctx, bus('choir'), c.at, c.length, c.notes, c.vel, c.vowel, s, rng) });
  }
  if (!def.chunk) {
    const rng = seededRandom(def.seed);
    return jobs.map((j) => ({ at: j.at, play: () => j.play(rng) }));
  }
  const own = jobs.map((j, i) => {
    const rng = seededRandom(def.seed + 7919 * (i + 1));
    return { at: j.at, play: () => j.play(rng) };
  });
  // A stable sort: notes that start together keep their score order.
  return own.sort((a, b) => a.at - b.at);
}

/** Build the whole score into `ctx` (any BaseAudioContext) at once: instruments on their buses, the buses into the dry mix and the reverb. */
export function buildTrack(ctx: BaseAudioContext, out: AudioNode, def: TrackDef, bank: NoiseBank): void {
  for (const j of trackJobs(ctx, out, def, bank)) j.play();
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
  const jobs = trackJobs(ctx, master, def, bank);
  // A browser without OfflineAudioContext.suspend gets the whole graph at once.
  const C = typeof ctx.suspend === 'function' ? def.chunk : undefined;
  let next = 0;
  /** Add the notes that start before `until` seconds; returns the main-thread milliseconds it took. */
  const add = (until: number): number => {
    const t0 = now();
    while (next < jobs.length && jobs[next].at < until) jobs[next++].play();
    return now() - t0;
  };
  add(C ? C.seconds : Infinity);
  // Everything up to here (the context, the buses, the reverb's room and the first notes) is one task.
  let buildMs = now() - started;
  if (C) {
    // A graph holding every note of a long track is slow to render: the audio thread walks every node, even those of
    // notes minutes away. So the notes go in a few seconds of music at a time, each chunk while the render is
    // suspended a little before it.
    for (let t = C.seconds; t < seconds; t += C.seconds) {
      const until = t + C.seconds;
      ctx.suspend(Math.max(0, t - C.lead)).then(
        () => {
          buildMs = Math.max(buildMs, add(until));
          void ctx.resume();
        },
        () => {
          // A refused suspend: its notes are left out rather than stalling the render.
        },
      );
    }
  }
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
