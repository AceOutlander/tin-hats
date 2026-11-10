/**
 * The Stalingrad campaign map track, "Versts of Snow": the Soviet counterpart of "Between the Lines" (musicMap.ts),
 * slow and reflective, and cold. A minor at 60 BPM over the menu theme's instruments, set glassy: a dark low pad in open
 * fifths, a high, bell-like piano (few partials, short rings) for the frost, a straight muted horn, far-off drums like
 * guns beyond the horizon. Built on the Soviet motif "The Long Winter" (src/data/musicThemes.ts): on the high piano,
 * then the horn with its answer, then in C major for the one warm moment, and inverted at the end over the lowest pad.
 * 32 bars, 128 s before it repeats. Written for Tin Hats; it quotes no existing melody, call, hymn or score.
 */
import type { Chord, MelodyNote, TrackDef } from './music';
import type { MusicEvent } from './musicBattle';
import { motif, SCALES, SOVIET_ANSWER, SOVIET_MOTIF } from './musicThemes';

const A = 9;
const A3 = 57;

const inKey = (note: number): boolean => (SCALES.minor as readonly number[]).includes((((note - A) % 12) + 12) % 12);

/** Motif events as horn or piano notes, with the notes outside A minor marked as the deliberate accidentals they are. */
function mel(events: readonly MusicEvent[]): MelodyNote[] {
  return events.map((e) => ({ at: e.at, beats: e.len, note: e.note, vel: e.vel, accidental: inKey(e.note) ? undefined : true }));
}

function chords(list: readonly (readonly number[])[]): Chord[] {
  return list.map((notes, i) => {
    const accidentals = notes.filter((n) => !inKey(n));
    return { at: i * 4, beats: 4, notes, accidentals: accidentals.length > 0 ? accidentals : undefined };
  });
}

// Open, sparse voicings: fifths and octaves low, one colour note on top.
const Am5 = [33, 45, 52, 57];
const Am = [45, 52, 57, 60];
const F = [41, 48, 53, 57];
const Fmaj7 = [41, 48, 52, 57];
const C = [36, 48, 55, 60];
const G = [43, 50, 55, 59];
const Dm = [38, 50, 53, 57];
const Em = [40, 52, 55, 59];
const Esus = [40, 52, 57, 59];
const E = [40, 52, 56, 59];
const Am2 = [33, 45, 52, 59];

export const STALINGRAD_MAP: TrackDef = {
  title: 'Versts of Snow',
  bpm: 60,
  beatsPerBar: 4,
  key: { tonic: A, mode: 'minor' },
  sampleRate: 22050,
  channels: 1,
  tail: 7,
  peak: 0.95,
  humanize: { time: 0.016, velocity: 0.06 },
  seed: 1942,
  instruments: {
    pad: { wave: 'sawtooth', voices: 3, detuneCents: 7, cutoff: 700, swellCutoff: 1900, q: 0.6, rest: 0.6, attack: 2.4, release: 3.2, level: 0.19, range: [24, 64] },
    horn: {
      cutoff: 720,
      brightness: 900,
      q: 0.9,
      bodyMix: 0.3,
      attack: 0.4,
      release: 1.2,
      vibratoRate: 4.6,
      vibratoCents: 5,
      vibratoDelay: 0.8,
      vibratoRise: 1.2,
      breath: 0.06,
      breathHz: 1100,
      level: 0.34,
      range: [45, 70],
    },
    // Glassy: few partials, a little stretched, short rings.
    piano: {
      partials: [
        [1, 1],
        [2, 0.24],
        [3, 0.07],
        [4, 0.03],
      ],
      inharmonicity: 0.0008,
      decay: 3.4,
      decayPower: 0.9,
      attack: 0.004,
      damp: 1,
      cutoff: 3600,
      hammer: 0.03,
      level: 0.3,
      range: [64, 93],
    },
    drum: { pitch: 62, pitchEnd: 37, drop: 0.4, overtone: 1.58, overtoneGain: 0.25, decay: 2.6, noise: 0.3, noiseCutoff: 300, noiseDecay: 0.4, level: 0.18 },
  },
  mix: {
    pad: { dry: 0.75, send: 0.45 },
    horn: { dry: 0.5, send: 0.72 },
    piano: { dry: 0.55, send: 0.68 },
    drum: { dry: 0.2, send: 0.95 },
    reverb: 0.58,
    lowpass: 4800,
  },
  reverb: { seconds: 5.5, preDelay: 0.04, brightHz: 4200, darkHz: 900, seed: 1943 },
  sections: [
    {
      // Frost on the map glass: the motif alone on the high piano over open fifths. It comes in half a beat late, so the
      // loop's seam is not a piano strike (the seam's level stayed within 0.1 dB, was 3.2 dB).
      name: 'Frost on the map glass',
      bars: 8,
      padLevel: 0.8,
      chords: chords([Am5, Am5, F, F, Dm, Dm, Esus, Em]),
      horn: [],
      piano: mel([...motif(SOVIET_MOTIF, { tonic: 81, at: 0.5, vel: 0.4, first: 1 }), ...motif(SOVIET_ANSWER, { tonic: 81, at: 12, vel: 0.34, first: 1 }), ...motif(SOVIET_MOTIF, { tonic: 81, at: 16, take: 4, vel: 0.34, first: 1 })]),
      drums: [
        { at: 9.5, vel: 0.42, pitch: 1 },
        { at: 26.75, vel: 0.58, pitch: 0.94 },
      ],
    },
    {
      // The horn takes it up, low and straight, and its answer climbs home; one piano note glints above.
      name: 'The road to the Volga',
      bars: 8,
      padLevel: 1,
      chords: chords([Am, Dm, F, Em, Am, Dm, G, E]),
      horn: mel([...motif(SOVIET_MOTIF, { tonic: A3, at: 0, vel: 0.55, first: 1 }), ...motif(SOVIET_ANSWER, { tonic: A3, at: 12, vel: 0.5, first: 1 }), ...motif(SOVIET_MOTIF, { tonic: A3, at: 16, take: 6, colour: 'harmonic', vel: 0.5, first: 1 })]),
      piano: [
        { at: 7, beats: 2, note: 88, vel: 0.26 },
        { at: 27, beats: 3, note: 83, vel: 0.24 },
      ],
      drums: [
        { at: 5.25, vel: 0.5, pitch: 1.03 },
        { at: 22.5, vel: 0.66, pitch: 0.92 },
      ],
    },
    {
      // A warm moment: the motif in C major high on the piano, the horn answering below; the pad opens.
      name: 'Lamps in the dugout',
      bars: 8,
      padLevel: 0.7,
      chords: chords([C, G, Am, Fmaj7, C, G, F, Esus]),
      horn: mel(motif(SOVIET_ANSWER, { tonic: 60, at: 28, colour: 'major', vel: 0.46, first: 1 })),
      piano: mel([...motif(SOVIET_MOTIF, { tonic: 72, at: 0, colour: 'major', vel: 0.42, first: 1 }), ...motif(SOVIET_MOTIF, { tonic: 72, at: 16, take: 6, colour: 'major', vel: 0.36, first: 1 })]),
      drums: [{ at: 13.5, vel: 0.38, pitch: 1.05 }],
    },
    {
      // Back to the winter: the motif upside down on the horn over the lowest pad, one high note left hanging.
      name: 'Snow over the river',
      bars: 8,
      padLevel: 1,
      chords: chords([Am2, F, Dm, Esus, Am5, F, Dm, E]),
      horn: mel([...motif(SOVIET_MOTIF, { tonic: A3, invert: true, at: 2, vel: 0.5, first: 1 }), ...motif(SOVIET_MOTIF, { tonic: A3, take: 4, at: 18, augment: 1.5, vel: 0.46, first: 1 })]),
      piano: [
        { at: 28, beats: 4, note: 88, vel: 0.28 },
        { at: 30, beats: 2, note: 81, vel: 0.24 },
      ],
      drums: [
        { at: 3.75, vel: 0.52, pitch: 1 },
        { at: 17.25, vel: 0.44, pitch: 1.04 },
        { at: 25.5, vel: 0.7, pitch: 0.9 },
      ],
    },
  ],
};
