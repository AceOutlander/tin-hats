/**
 * The campaign map track, "Roll of Honour": slow, noble and hymn-like, remembering the men who served; warm and
 * bittersweet rather than grim. E flat major at 62 BPM in 4/4, 42 bars, 162.6 s before it repeats.
 *
 * Soft strings open alone; a solo horn sings a long melody (A) and a second, higher strain that turns to the borrowed
 * minor iv (A flat minor, its C flat the bittersweet note) while a wordless choir comes in underneath on "oo"; the full
 * strings take the melody up in octaves with the horn below them and the choir under both; a four-bar climb on a rising
 * line, the choir opening from "oo" to "ah" over a soft timpani roll, reaches the one climax, the melody an octave higher
 * on strings, horn and choir together; then a quiet coda, the horn far off with the opening phrase, settles on the
 * tonic and leads straight back into the opening.
 *
 * Instruments: the string pad (warm sawtooths, swelling with each chord), a solo horn with a swell on its long notes, a
 * string section on the melody (`strings`), a choir of vowel-shaped voices (`choir`) and a tuned timpani. Written for
 * Tin Hats: an original melody, harmony and rhythm that quote no existing melody, hymn or score.
 */
import type { ChoirChord, Chord, MelodyNote, TrackDef } from './music';
import { SCALES } from './musicThemes';

const Eb = 3;
const inKey = (note: number): boolean => (SCALES.major as readonly number[]).includes((((note - Eb) % 12) + 12) % 12);

// Pitches (MIDI). C flat is the borrowed note of A flat minor.
const C4 = 60;
const D4 = 62;
const Eb4 = 63;
const F4 = 65;
const G4 = 67;
const Ab4 = 68;
const Bb4 = 70;
const Cb5 = 71;
const C5 = 72;
const D5 = 74;
const Eb5 = 75;
const F5 = 77;
const G5 = 79;
const Ab5 = 80;
const Bb5 = 82;

/** The chords: the pad's voicing (with its bass) and the choir's. */
const CHORDS = {
  Eb: { pad: [39, 51, 55, 58, 63], choir: [51, 55, 58, 63] },
  EbBb: { pad: [34, 51, 55, 58, 63], choir: [51, 55, 58, 63] },
  AbEb: { pad: [39, 51, 56, 60, 63], choir: [51, 56, 60, 63] },
  Ab: { pad: [32, 48, 51, 56, 60], choir: [51, 56, 60, 63] },
  Abmaj7: { pad: [32, 44, 51, 55, 60], choir: [56, 60, 63, 67] },
  Abm: { pad: [32, 44, 51, 59], choir: [51, 56, 59, 63] },
  Cm: { pad: [36, 48, 51, 55, 60], choir: [51, 55, 60, 63] },
  Cm7: { pad: [36, 48, 55, 58, 63], choir: [55, 58, 60, 63] },
  CmBb: { pad: [34, 48, 51, 55, 60], choir: [51, 55, 60, 63] },
  Fm7: { pad: [41, 53, 56, 60, 63], choir: [53, 56, 60, 63] },
  Gm: { pad: [43, 50, 55, 58, 62], choir: [55, 58, 62, 67] },
  Gm7: { pad: [43, 50, 53, 58, 62], choir: [53, 58, 62, 65] },
  Bbsus4: { pad: [34, 46, 53, 58, 63], choir: [53, 58, 63, 65] },
  Bb: { pad: [34, 46, 53, 58, 62], choir: [53, 58, 62, 65] },
  Bb7: { pad: [34, 46, 53, 56, 62], choir: [53, 56, 62, 65] },
} as const;
type ChordName = keyof typeof CHORDS;
type Progression = readonly (readonly [ChordName, number])[];

function outside(notes: readonly number[]): readonly number[] | undefined {
  const acc = notes.filter((n) => !inKey(n));
  return acc.length > 0 ? acc : undefined;
}

/** The pad's chords, back to back from the section's start. */
function prog(list: Progression): Chord[] {
  let at = 0;
  return list.map(([name, beats]) => {
    const notes = CHORDS[name].pad;
    const c: Chord = { at, beats, notes, accidentals: outside(notes) };
    at += beats;
    return c;
  });
}

/**
 * The choir on a progression from beat `from`: its velocity and its vowel move evenly from the first value to the last
 * across the chords (each chord glides on to where the next begins). `lift` puts the top two voices up an octave.
 */
function choir(list: Progression, from: number, vel: readonly [number, number], vowel: readonly [number, number], lift = false): ChoirChord[] {
  const total = list.reduce((n, [, beats]) => n + beats, 0);
  let at = 0;
  return list.map(([name, beats]) => {
    const p0 = at / total;
    const p1 = (at + beats) / total;
    const notes = CHORDS[name].choir.map((n, i) => (lift && i >= 2 ? n + 12 : n));
    const c: ChoirChord = {
      at: from + at,
      beats,
      notes,
      vel: vel[0] + (vel[1] - vel[0]) * p0,
      vowel: [vowel[0] + (vowel[1] - vowel[0]) * p0, vowel[0] + (vowel[1] - vowel[0]) * p1],
      accidentals: outside(notes),
    };
    at += beats;
    return c;
  });
}

/** A melody as [note (0 = rest), beats] pairs. */
type Line = readonly (readonly [number, number])[];

/**
 * A line of notes from beat `from`, `shift` semitones up, phrased with its velocity: an arch from `lo` up to `hi` in its
 * middle and back (`shape` 'arch'), or moving evenly from `lo` to `hi` ('ramp').
 */
function line(notes: Line, lo: number, hi: number, shape: 'arch' | 'ramp', from = 0, shift = 0): MelodyNote[] {
  const total = notes.reduce((n, [, beats]) => n + beats, 0);
  const out: MelodyNote[] = [];
  let at = 0;
  for (const [pitch, beats] of notes) {
    if (pitch > 0) {
      const p = at / total;
      const vel = shape === 'arch' ? lo + (hi - lo) * Math.sin(Math.PI * p) : lo + (hi - lo) * p;
      const note = pitch + shift;
      out.push({ at: from + at, beats, note, vel, accidental: inKey(note) ? undefined : true });
    }
    at += beats;
  }
  return out;
}

/** Strings in octaves: the line and the line an octave below, a little softer. */
function octaves(notes: Line, lo: number, hi: number, shape: 'arch' | 'ramp', from = 0): MelodyNote[] {
  return [...line(notes, lo, hi, shape, from), ...line(notes, lo * 0.85, hi * 0.85, shape, from, -12)];
}

// The harmony of the main melody (A), and of the second strain (B).
const A_CHORDS: Progression = [
  ['Eb', 4],
  ['Cm', 4],
  ['Abmaj7', 4],
  ['Bbsus4', 2],
  ['Bb7', 2],
  ['Gm7', 4],
  ['Cm', 2],
  ['Ab', 2],
  ['Fm7', 2],
  ['Bb7', 2],
  ['Eb', 4],
];
const B_CHORDS: Progression = [
  ['Cm', 2],
  ['CmBb', 2],
  ['Ab', 4],
  ['Fm7', 2],
  ['Bb', 2],
  ['Gm', 2],
  ['Cm', 2],
  ['Ab', 4],
  ['Abm', 4],
  ['EbBb', 4],
  ['Bbsus4', 2],
  ['Bb', 2],
];

/** The melody: two four-bar phrases, the second reaching up to its high E flat, ending open on the third. */
const MELODY_A: Line = [
  [G4, 2.5], [F4, 0.5], [Eb4, 1],
  [C5, 3], [Bb4, 1],
  [Ab4, 1.5], [G4, 0.5], [Ab4, 1], [C5, 1],
  [Bb4, 2], [Ab4, 1], [F4, 1],
  [G4, 1.5], [Bb4, 0.5], [D5, 2],
  [Eb5, 2.5], [D5, 0.5], [C5, 1],
  [Bb4, 1.5], [Ab4, 0.5], [G4, 1], [Ab4, 1],
  [G4, 4],
];
/** The same melody coming home to the tonic, for the strings. */
const MELODY_A_HOME: Line = [...MELODY_A.slice(0, -5), [Bb4, 1.5], [Ab4, 0.5], [G4, 1], [F4, 1], [Eb4, 4]];
/** The second strain: higher, through A flat minor's C flat, down to the dominant. */
const MELODY_B: Line = [
  [0, 1], [G4, 1], [C5, 1], [D5, 1],
  [Eb5, 3], [C5, 1],
  [C5, 1.5], [Ab4, 0.5], [Bb4, 2],
  [Bb4, 1], [D5, 1], [Eb5, 2],
  [F5, 1.5], [Eb5, 0.5], [C5, 2],
  [Cb5, 3], [Bb4, 1],
  [G4, 3], [F4, 1],
  [Eb4, 2], [D4, 2],
];
/** The climb to the climax, rising through the A flat chord. */
const CLIMB: Line = [
  [C5, 1.5], [D5, 0.5], [Eb5, 2],
  [C5, 1], [Eb5, 1], [Ab5, 2],
  [G5, 1.5], [F5, 0.5], [Ab5, 2],
  [F5, 2], [D5, 1], [F5, 1],
];
/** The climax: the high B flat, falling by steps through A flat minor and home. */
const SUMMIT: Line = [
  [Bb5, 2.5], [Ab5, 0.5], [G5, 1],
  [G5, 1.5], [F5, 0.5], [Eb5, 2],
  [Ab5, 2], [G5, 1], [F5, 1],
  [Eb5, 2], [Cb5, 2],
  [G5, 1.5], [F5, 1.5], [Ab5, 1],
  [G5, 4],
];

// Timpani tuning: pitch multipliers of the drum (1 = E flat).
const TIMP_EB = 1;
const TIMP_AB = 0.6674;
const TIMP_BB = 0.7492;

export const CAMPAIGN_MAP: TrackDef = {
  title: 'Roll of Honour',
  bpm: 62,
  beatsPerBar: 4,
  key: { tonic: Eb, mode: 'major' },
  sampleRate: 22050,
  channels: 1,
  tail: 7,
  peak: 0.95,
  humanize: { time: 0.014, velocity: 0.05 },
  seed: 1945,
  instruments: {
    pad: { wave: 'sawtooth', voices: 3, detuneCents: 8, cutoff: 900, swellCutoff: 2000, q: 0.5, rest: 0.7, attack: 2, release: 3, level: 0.17, range: [24, 64], kRate: true },
    horn: {
      cutoff: 850,
      brightness: 1300,
      q: 0.8,
      bodyMix: 0.4,
      attack: 0.35,
      release: 1.1,
      vibratoRate: 4.9,
      vibratoCents: 9,
      vibratoDelay: 0.55,
      vibratoRise: 0.9,
      breath: 0.06,
      breathHz: 900,
      swell: 0.3,
      level: 0.36,
      range: [50, 77],
    },
    strings: { voices: 3, detuneCents: 11, cutoff: 1100, brightness: 1700, q: 0.5, attack: 0.45, release: 1.4, vibratoRate: 5.2, vibratoCents: 12, vibratoDelay: 0.35, swell: 0.3, level: 0.5, range: [48, 84] },
    choir: {
      voices: 2,
      detuneCents: 10,
      oo: [
        [320, 5, 1],
        [800, 7, 0.28],
        [2350, 10, 0.07],
      ],
      ah: [
        [740, 5, 1],
        [1180, 7, 0.55],
        [2550, 10, 0.2],
      ],
      sourceCutoff: 3200,
      vibratoRate: 4.6,
      vibratoCents: 7,
      attack: 2.4,
      release: 3.2,
      level: 0.9,
      range: [48, 80],
    },
    drum: { pitch: 84, pitchEnd: 77.8, drop: 0.12, overtone: 1.5, overtoneGain: 0.35, decay: 2.6, noise: 0.25, noiseCutoff: 400, noiseDecay: 0.3, level: 0.3, roll: { rate: 11, start: 0.25, ring: 0.3 } },
  },
  mix: {
    pad: { dry: 0.78, send: 0.45 },
    horn: { dry: 0.55, send: 0.7 },
    strings: { dry: 0.62, send: 0.6 },
    choir: { dry: 0.5, send: 0.85 },
    drum: { dry: 0.3, send: 0.8 },
    reverb: 0.55,
    lowpass: 4400,
  },
  reverb: { seconds: 4.6, preDelay: 0.035, brightHz: 3000, darkHz: 420, seed: 1944 },
  sections: [
    {
      // Warm, soft strings alone: the pad and one quiet line.
      name: 'First light',
      bars: 4,
      padLevel: 0.75,
      chords: prog([
        ['Eb', 4],
        ['AbEb', 4],
        ['Cm7', 4],
        ['Bbsus4', 2],
        ['Bb', 2],
      ]),
      horn: [],
      piano: [],
      drums: [],
      strings: line(
        [
          [0, 2],
          [Bb4, 2],
          [C5, 3],
          [Bb4, 1],
          [G4, 4],
          [Ab4, 2],
          [F4, 2],
        ],
        0.26,
        0.36,
        'arch',
      ),
    },
    {
      // The horn sings the melody over the strings.
      name: 'The horn',
      bars: 8,
      padLevel: 0.8,
      chords: prog(A_CHORDS),
      horn: line(MELODY_A, 0.5, 0.72, 'arch'),
      piano: [],
      drums: [{ at: 0.5, vel: 0.25, pitch: TIMP_EB }],
    },
    {
      // Higher and more searching, through A flat minor; the choir comes in softly underneath.
      name: 'Remembrance',
      bars: 8,
      padLevel: 0.85,
      chords: prog(B_CHORDS),
      horn: line(MELODY_B, 0.55, 0.75, 'arch'),
      piano: [],
      drums: [{ at: 20, vel: 0.3, pitch: TIMP_AB }],
      choir: choir(B_CHORDS.slice(-5), 16, [0.22, 0.35], [0, 0.1]),
    },
    {
      // The full strings take the melody up in octaves and bring it home; the horn below, the choir under both.
      name: 'The strings take it up',
      bars: 8,
      padLevel: 0.95,
      chords: prog(A_CHORDS),
      horn: line(
        [
          [0, 16],
          [D4, 4],
          [Eb4, 2],
          [C4, 2],
          [C4, 2],
          [D4, 2],
          [Eb4, 4],
        ],
        0.4,
        0.5,
        'ramp',
      ),
      piano: [],
      drums: [{ at: 0, vel: 0.35, pitch: TIMP_EB }],
      strings: octaves(MELODY_A_HOME, 0.5, 0.7, 'arch'),
      choir: choir(A_CHORDS, 0, [0.35, 0.5], [0.05, 0.3]),
    },
    {
      // The climb: a rising line, the choir opening to "ah", a soft timpani roll into the climax.
      name: 'The long climb',
      bars: 4,
      padLevel: 1,
      chords: prog([
        ['Cm', 4],
        ['Ab', 4],
        ['Fm7', 4],
        ['Bbsus4', 2],
        ['Bb', 2],
      ]),
      horn: line(
        [
          [G4, 4],
          [Ab4, 4],
          [Ab4, 2],
          [C5, 2],
          [Bb4, 4],
        ],
        0.55,
        0.75,
        'ramp',
      ),
      piano: [],
      drums: [{ at: 10, vel: 0.55, pitch: TIMP_BB, roll: 6 }],
      strings: octaves(CLIMB, 0.62, 0.8, 'ramp'),
      choir: choir(
        [
          ['Cm', 4],
          ['Ab', 4],
          ['Fm7', 4],
          ['Bbsus4', 2],
          ['Bb', 2],
        ],
        0,
        [0.5, 0.75],
        [0.3, 0.85],
      ),
    },
    {
      // The one climax: the melody an octave up on the strings, the horn with them, the full choir on "ah".
      name: 'Roll of honour',
      bars: 6,
      padLevel: 1.15,
      chords: prog([
        ['Eb', 4],
        ['Cm', 4],
        ['Ab', 4],
        ['Abm', 4],
        ['EbBb', 2],
        ['Bb7', 2],
        ['Eb', 4],
      ]),
      horn: line(SUMMIT, 0.7, 0.5, 'ramp', 0, -12),
      piano: [],
      drums: [
        { at: 0, vel: 0.8, pitch: TIMP_EB },
        { at: 12, vel: 0.45, pitch: TIMP_AB },
        { at: 18, vel: 0.4, pitch: TIMP_BB, roll: 2 },
        { at: 20, vel: 0.45, pitch: TIMP_EB },
      ],
      strings: octaves(SUMMIT, 0.92, 0.62, 'ramp'),
      choir: choir(
        [
          ['Eb', 4],
          ['Cm', 4],
          ['Ab', 4],
          ['Abm', 4],
          ['EbBb', 2],
          ['Bb7', 2],
          ['Eb', 4],
        ],
        0,
        [0.85, 0.55],
        [1, 0.7],
        true,
      ),
    },
    {
      // Settling: the horn far off with the opening phrase, the choir fading, home to E flat and on into the opening.
      name: 'Quiet fields',
      bars: 4,
      padLevel: 0.7,
      chords: prog([
        ['Cm7', 4],
        ['Abmaj7', 4],
        ['Abm', 4],
        ['Eb', 4],
      ]),
      horn: line(
        [
          [G4, 2.5],
          [F4, 0.5],
          [Eb4, 1],
          [C5, 3],
          [Bb4, 1],
          [Cb5, 2],
          [Bb4, 2],
          [G4, 4],
        ],
        0.42,
        0.3,
        'ramp',
      ),
      piano: [],
      drums: [],
      choir: choir(
        [
          ['Cm7', 4],
          ['Abmaj7', 4],
        ],
        0,
        [0.3, 0.18],
        [0.4, 0],
      ),
    },
  ],
};
