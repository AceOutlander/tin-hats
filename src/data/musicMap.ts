/**
 * The campaign map track, "Between the Lines": calmer and reflective, grim but hopeful, somewhere between the menu's
 * lament and the battle music. G minor at 66 BPM over the menu theme's instruments (string pad, distant horn, soft
 * piano, far-off drums), built on the British motif "The Line" (src/data/musicThemes.ts): heard on the piano, sung by
 * the horn with its answer, turned to B flat major for the hopeful third section, and inverted at the end. 32 bars,
 * 116 s before it repeats. Written for Tin Hats; it quotes no existing melody, call, hymn or score.
 */
import type { Chord, MelodyNote, TrackDef } from './music';
import type { MusicEvent } from './musicBattle';
import { BRITISH_ANSWER, BRITISH_MOTIF, motif, SCALES } from './musicThemes';

const G = 7;
const G3 = 55;

const inKey = (note: number): boolean => (SCALES.minor as readonly number[]).includes((((note - G) % 12) + 12) % 12);

/** Motif events as horn or piano notes, with the notes outside G minor marked as the deliberate accidentals they are. */
function mel(events: readonly MusicEvent[]): MelodyNote[] {
  return events.map((e) => ({ at: e.at, beats: e.len, note: e.note, vel: e.vel, accidental: inKey(e.note) ? undefined : true }));
}

function chords(list: readonly (readonly number[])[]): Chord[] {
  return list.map((notes, i) => {
    const accidentals = notes.filter((n) => !inKey(n));
    return { at: i * 4, beats: 4, notes, accidentals: accidentals.length > 0 ? accidentals : undefined };
  });
}

const Gm = [43, 50, 55, 58];
const Eb = [39, 46, 51, 55];
const Bb = [46, 53, 58, 62];
const F = [41, 48, 53, 57];
const Cm = [36, 48, 51, 55];
const D = [38, 50, 54, 57];
const Gm2 = [31, 43, 50, 55, 58];

export const CAMPAIGN_MAP: TrackDef = {
  title: 'Between the Lines',
  bpm: 66,
  beatsPerBar: 4,
  key: { tonic: G, mode: 'minor' },
  sampleRate: 22050,
  channels: 1,
  tail: 7,
  peak: 0.95,
  humanize: { time: 0.016, velocity: 0.06 },
  seed: 1941,
  instruments: {
    pad: { wave: 'sawtooth', voices: 3, detuneCents: 9, cutoff: 820, swellCutoff: 2200, q: 0.6, rest: 0.6, attack: 2.2, release: 3, level: 0.2, range: [24, 64] },
    horn: {
      cutoff: 760,
      brightness: 950,
      q: 0.9,
      bodyMix: 0.35,
      attack: 0.38,
      release: 1.2,
      vibratoRate: 4.8,
      vibratoCents: 10,
      vibratoDelay: 0.6,
      vibratoRise: 1,
      breath: 0.05,
      breathHz: 850,
      level: 0.34,
      range: [45, 70],
    },
    piano: {
      partials: [
        [1, 1],
        [2, 0.42],
        [3, 0.2],
        [4, 0.09],
        [5, 0.05],
        [7, 0.02],
      ],
      inharmonicity: 0.00035,
      decay: 5.5,
      decayPower: 0.75,
      attack: 0.005,
      damp: 1.3,
      cutoff: 2400,
      hammer: 0.05,
      level: 0.32,
      range: [57, 88],
    },
    drum: { pitch: 66, pitchEnd: 39, drop: 0.38, overtone: 1.58, overtoneGain: 0.3, decay: 3, noise: 0.35, noiseCutoff: 320, noiseDecay: 0.45, level: 0.2 },
  },
  mix: {
    pad: { dry: 0.8, send: 0.45 },
    horn: { dry: 0.52, send: 0.72 },
    piano: { dry: 0.62, send: 0.6 },
    drum: { dry: 0.2, send: 0.95 },
    reverb: 0.55,
    lowpass: 3600,
  },
  reverb: { seconds: 5, preDelay: 0.04, brightHz: 2600, darkHz: 340, seed: 1942 },
  sections: [
    {
      // The motif alone on the piano over a low pad, lamplight on the map table.
      name: 'Maps by lamplight',
      bars: 8,
      padLevel: 0.8,
      chords: chords([Gm, Gm, Eb, Eb, Bb, F, Cm, D]),
      horn: [],
      piano: mel([...motif(BRITISH_MOTIF, { tonic: 67, at: 0, vel: 0.42, first: 1 }), ...motif(BRITISH_MOTIF, { tonic: 67, at: 16, take: 5, vel: 0.36, first: 1 })]),
      drums: [
        { at: 11.5, vel: 0.45, pitch: 1 },
        { at: 27.25, vel: 0.6, pitch: 0.95 },
      ],
    },
    {
      // The horn takes it up, with its answer coming home: the road goes on.
      name: 'The road north',
      bars: 8,
      padLevel: 1,
      chords: chords([Gm, Cm, Bb, F, Eb, Bb, Cm, D]),
      horn: mel([...motif(BRITISH_MOTIF, { tonic: G3, at: 1, vel: 0.55, first: 1 }), ...motif(BRITISH_ANSWER, { tonic: G3, at: 17, vel: 0.52, first: 1, colour: 'harmonic' })]),
      piano: [],
      drums: [
        { at: 6.75, vel: 0.5, pitch: 1.03 },
        { at: 21.5, vel: 0.7, pitch: 0.92 },
      ],
    },
    {
      // Hope: the motif in B flat major, high on the piano, the horn answering below; the pad opens up.
      name: 'Letters home',
      bars: 8,
      padLevel: 0.7,
      chords: chords([Bb, F, Gm, Eb, Bb, F, Eb, F]),
      horn: mel(motif(BRITISH_ANSWER, { tonic: 58, at: 17, colour: 'major', vel: 0.48, first: 1 })),
      piano: mel([...motif(BRITISH_MOTIF, { tonic: 70, at: 0, colour: 'major', vel: 0.45, first: 1 }), ...motif(BRITISH_MOTIF, { tonic: 70, at: 8, take: 3, colour: 'major', vel: 0.38, first: 1 })]),
      drums: [{ at: 14.5, vel: 0.4, pitch: 1.05 }],
    },
    {
      // Back to the war: the motif turned upside down on the horn over the lowest pad, one piano note left hanging.
      name: 'The next objective',
      bars: 8,
      padLevel: 1,
      chords: chords([Gm2, Eb, Cm, D, Gm, Eb, Cm, D]),
      horn: mel([...motif(BRITISH_MOTIF, { tonic: G3, step: 4, invert: true, at: 2, vel: 0.5, first: 1 }), ...motif(BRITISH_MOTIF, { tonic: G3, take: 4, at: 18, augment: 1.5, vel: 0.48, first: 1 })]),
      piano: [
        { at: 28, beats: 4, note: 74, vel: 0.3 },
        { at: 30, beats: 2, note: 70, vel: 0.26 },
      ],
      drums: [
        { at: 3.5, vel: 0.55, pitch: 1 },
        { at: 17.75, vel: 0.45, pitch: 1.04 },
        { at: 25, vel: 0.72, pitch: 0.9 },
      ],
    },
  ],
};
