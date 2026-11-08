/**
 * Reading a score (src/data/music.ts): section lengths, the loop length and every note at its absolute time. Plain
 * numbers only, so the score checks run in Node.
 */
import { MAJOR_SCALE, MINOR_SCALE, type MusicInstrument, type TrackDef } from '../../data/music';

export interface ScoreNote {
  instrument: MusicInstrument;
  /** Seconds from the start of the loop, and length in seconds (0 for a drum hit, the roll's length for a roll). */
  at: number;
  length: number;
  /** MIDI note (a drum hit has none: NaN). */
  note: number;
  /** Velocity 0..1 (a chord note: the section's pad level). */
  vel: number;
  /** Drum pitch multiplier (1 for everything else). */
  pitch: number;
  /** Marked as a deliberate accidental in the score. */
  accidental: boolean;
  /** Index of the section it belongs to. */
  section: number;
}

/** A choir chord at its absolute time: the choir sings a chord through one set of formants, so it is built whole. */
export interface ScoreChoirChord {
  at: number;
  length: number;
  notes: readonly number[];
  vel: number;
  vowel: readonly [number, number];
  section: number;
}

export function secondsPerBeat(def: TrackDef): number {
  return 60 / def.bpm;
}

/** Beats before the loop repeats. */
export function loopBeats(def: TrackDef): number {
  let beats = 0;
  for (const s of def.sections) beats += s.bars * def.beatsPerBar;
  return beats;
}

/** Seconds before the loop repeats. */
export function loopSeconds(def: TrackDef): number {
  return loopBeats(def) * secondsPerBeat(def);
}

/** Where each section starts and ends, in seconds. */
export function sectionTimes(def: TrackDef): { name: string; start: number; end: number }[] {
  const spb = secondsPerBeat(def);
  const out: { name: string; start: number; end: number }[] = [];
  let beat = 0;
  for (const s of def.sections) {
    const beats = s.bars * def.beatsPerBar;
    out.push({ name: s.name, start: beat * spb, end: (beat + beats) * spb });
    beat += beats;
  }
  return out;
}

/** Every note of the score at its absolute time, in score order (no humanising). A choir chord gives one per note. */
export function scoreNotes(def: TrackDef): ScoreNote[] {
  const spb = secondsPerBeat(def);
  const out: ScoreNote[] = [];
  let beat = 0;
  def.sections.forEach((s, section) => {
    const t = (b: number): number => (beat + b) * spb;
    for (const c of s.chords) {
      for (const note of c.notes) {
        out.push({ instrument: 'pad', at: t(c.at), length: c.beats * spb, note, vel: s.padLevel, pitch: 1, accidental: c.accidentals?.includes(note) === true, section });
      }
    }
    for (const n of s.horn) out.push({ instrument: 'horn', at: t(n.at), length: n.beats * spb, note: n.note, vel: n.vel, pitch: 1, accidental: n.accidental === true, section });
    for (const n of s.piano) out.push({ instrument: 'piano', at: t(n.at), length: n.beats * spb, note: n.note, vel: n.vel, pitch: 1, accidental: n.accidental === true, section });
    for (const d of s.drums) out.push({ instrument: 'drum', at: t(d.at), length: (d.roll ?? 0) * spb, note: Number.NaN, vel: d.vel, pitch: d.pitch, accidental: false, section });
    for (const n of s.strings ?? []) out.push({ instrument: 'strings', at: t(n.at), length: n.beats * spb, note: n.note, vel: n.vel, pitch: 1, accidental: n.accidental === true, section });
    for (const c of s.choir ?? []) {
      for (const note of c.notes) {
        out.push({ instrument: 'choir', at: t(c.at), length: c.beats * spb, note, vel: c.vel, pitch: 1, accidental: c.accidentals?.includes(note) === true, section });
      }
    }
    beat += s.bars * def.beatsPerBar;
  });
  return out;
}

/** The choir's chords at their absolute times, in score order. */
export function choirChords(def: TrackDef): ScoreChoirChord[] {
  const spb = secondsPerBeat(def);
  const out: ScoreChoirChord[] = [];
  let beat = 0;
  def.sections.forEach((s, section) => {
    for (const c of s.choir ?? []) out.push({ at: (beat + c.at) * spb, length: c.beats * spb, notes: c.notes, vel: c.vel, vowel: c.vowel, section });
    beat += s.bars * def.beatsPerBar;
  });
  return out;
}

/** True when a MIDI note belongs to the track's key. */
export function inKey(def: TrackDef, note: number): boolean {
  const degree = (((note - def.key.tonic) % 12) + 12) % 12;
  return (def.key.mode === 'major' ? MAJOR_SCALE : MINOR_SCALE).includes(degree);
}

/** The lowest and highest note an instrument of the track may play (null for the drum, or one the track lacks). */
export function instrumentRange(def: TrackDef, instrument: MusicInstrument): readonly [number, number] | null {
  if (instrument === 'drum') return null;
  return def.instruments[instrument]?.range ?? null;
}

/** The drum hits' times in beats from the start of the loop, sorted. */
export function drumBeats(def: TrackDef): number[] {
  const out: number[] = [];
  let beat = 0;
  for (const s of def.sections) {
    for (const d of s.drums) out.push(beat + d.at);
    beat += s.bars * def.beatsPerBar;
  }
  return out.sort((a, b) => a - b);
}
