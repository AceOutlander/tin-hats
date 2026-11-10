/**
 * The campaign themes: a short motif per campaign that comes back, transformed, in every mission track of that
 * campaign and in the campaign map track, so the missions sound related (docs/MUSIC.md).
 *
 * A motif is written in scale degrees (0 = the tonic, 4 = the fifth, -1 = the step below the tonic) with its rhythm in
 * beats, so one motif can be played in any key, in a darker or brighter colour and in any of these forms:
 *
 * - colour: the scale the degrees are read in: minor (the home colour), harmonic (raised 7th, harder), phrygian
 *   (flattened 2nd, uneasy), dorian (raised 6th, a little lighter) or major (hope, used sparingly).
 * - invert: every interval upside down around the first note.
 * - retrograde: the notes backwards, same rhythm backwards.
 * - augment: every time and length multiplied (2 = twice as slow, 0.5 = twice as fast: diminution).
 * - displace: the whole motif moved by a few beats (0.5 puts its long notes off the beat: rhythmic displacement).
 * - take: only the first n notes (the head motif, for fragments and ostinatos).
 * - step: moved up or down by scale steps (a sequence), keeping its colour.
 * - orchestration is the composer's choice of instrument and register (the part it goes into, and `tonic`).
 *
 * The British motif ("The Line") was written for Tin Hats. It quotes and paraphrases no existing melody, march, call,
 * hymn, folk tune or score: a dotted rise of a fifth, a turn back down, a sigh, and an open ending on the fifth.
 */
import type { Articulation, MusicEvent } from './musicBattle';

/** [at (beats), length (beats), scale degree]. */
export type MotifNote = readonly [number, number, number];

export interface Motif {
  name: string;
  /** Length in beats (the bar grid it fits). */
  beats: number;
  notes: readonly MotifNote[];
}

export const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
} as const;

export type Colour = keyof typeof SCALES;

/** MIDI note of a scale degree above (or below) `tonic` in a colour. */
export function degreeNote(tonic: number, colour: Colour, degree: number): number {
  const scale = SCALES[colour];
  const octave = Math.floor(degree / 7);
  const idx = degree - octave * 7;
  return tonic + 12 * octave + scale[idx];
}

export interface MotifForm {
  /** MIDI note of degree 0: picks key and register. */
  tonic: number;
  colour?: Colour;
  invert?: boolean;
  retrograde?: boolean;
  augment?: number;
  displace?: number;
  take?: number;
  step?: number;
  /** Beat (from the section start) the motif begins on. */
  at?: number;
  vel?: number;
  /** Velocity share of the first note (an accent) and of the long notes (>= 1 beat). */
  first?: number;
  art?: Articulation;
}

/** One statement of a motif in a form, as MusicEvents ready for a part. */
export function motif(m: Motif, f: MotifForm): MusicEvent[] {
  let notes = m.notes.slice(0, f.take ?? m.notes.length);
  const span = notes.length > 0 ? Math.max(...notes.map(([at, len]) => at + len)) : 0;
  if (f.retrograde) {
    notes = notes.map(([at, len, d]) => [span - at - len, len, d] as const).sort((a, b) => a[0] - b[0]);
  }
  const base = notes.length > 0 ? notes[0][2] : 0;
  const k = f.augment ?? 1;
  const vel = f.vel ?? 0.7;
  return notes.map(([at, len, d], i) => {
    const degree = (f.invert ? base - (d - base) : d) + (f.step ?? 0);
    return {
      at: (f.at ?? 0) + (f.displace ?? 0) + at * k,
      len: len * k,
      note: degreeNote(f.tonic, f.colour ?? 'minor', degree),
      vel: Math.min(1, vel * (i === 0 ? (f.first ?? 1.1) : 1)),
      art: f.art,
    };
  });
}

/**
 * The British campaign motif, "The Line": two bars of 4/4.
 *   1 . . 5 | 4 . 5 3 . | 2 . . 3 | 5 - - -     (degrees counted from 1 here; 0-based in the data)
 * Dotted rhythms (a dotted quarter and an eighth, a dotted eighth and a sixteenth), the rise of a fifth, the fall
 * through the fourth to the third, the second leaning back up and the long open fifth at the end: a question.
 */
export const BRITISH_MOTIF: Motif = {
  name: 'The Line',
  beats: 8,
  notes: [
    [0, 1.5, 0],
    [1.5, 0.5, 4],
    [2, 0.75, 3],
    [2.75, 0.25, 4],
    [3, 1, 2],
    [4, 1.5, 1],
    [5.5, 0.5, 2],
    [6, 2, 4],
  ],
};

/**
 * The answer that closes "The Line" when a phrase must come home: down from the fifth by step to the tonic. Used for
 * endings and the victory sting.
 */
export const BRITISH_ANSWER: Motif = {
  name: 'The Line, answered',
  beats: 8,
  notes: [
    [0, 1.5, 4],
    [1.5, 0.5, 3],
    [2, 1, 2],
    [3, 1, 3],
    [4, 1.5, 1],
    [5.5, 0.5, -1],
    [6, 2, 0],
  ],
};

/**
 * The Soviet campaign motif, "The Long Winter" (Stalingrad, docs/campaigns/STALINGRAD.md), in natural minor:
 *   1 1 7 1 - | 4 . 3 5 2 3 | 5(low) - -     (degrees counted from 1 here; 0-based in the data, -3 is the low fifth)
 * Level and hushed: the tonic twice, the step below and back, held; then up to the fourth, the minor third, the fifth,
 * a fall of a fourth to the second, the third, and a drop of a fourth below the tonic to end open on the low dominant,
 * held for a whole bar. Three bars of 4/4 (the brief's rhythm adds up to twelve beats), so with its one-bar answer a
 * phrase is four bars. After the fifth the brief had the fourth and the third; they became the second and the third,
 * because the brief's "3 5 4 3" (from 1; F A G F in D minor) is a phrase of
 * Korobeiniki. Compared (from their well-known melodies, not from scores) with Polyushko-pole, Svyashchennaya voyna,
 * Katyusha, Korobeiniki and Kalinka: no run of four notes matches one of theirs. Written for Tin Hats.
 */
export const SOVIET_MOTIF: Motif = {
  name: 'The Long Winter',
  beats: 12,
  notes: [
    [0, 1, 0],
    [1, 0.5, 0],
    [1.5, 0.5, -1],
    [2, 2, 0],
    [4, 1.5, 3],
    [5.5, 0.5, 2],
    [6, 1, 4],
    [7, 1, 1],
    [8, 1, 2],
    [9, 3, -3],
  ],
};

/** Its answer, one bar: from the low dominant back up through the tonic, the third and the fourth, and home. */
export const SOVIET_ANSWER: Motif = {
  name: 'The Long Winter, answered',
  beats: 4,
  notes: [
    [0, 0.5, -3],
    [0.5, 0.5, 0],
    [1, 1, 2],
    [2, 0.5, 3],
    [2.5, 1.5, 0],
  ],
};

export const THEMES = {
  british: { motif: BRITISH_MOTIF, answer: BRITISH_ANSWER },
  sovietWinter: { motif: SOVIET_MOTIF, answer: SOVIET_ANSWER },
} as const;

export type ThemeName = keyof typeof THEMES;
