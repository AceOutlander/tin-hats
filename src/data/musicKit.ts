/**
 * Small pure helpers for writing battle tracks (src/data/musicTracks): chord progressions, step patterns for drums,
 * string ostinatos over the harmony, held chords, bass lines and plain note lists. Every helper returns MusicEvents
 * (times in beats from the start of the section), so a section is a few readable lines per part. See docs/MUSIC.md.
 */
import type { Articulation, BattleInstrument, MusicEvent, MusicPart } from './musicBattle';

/** A chord held from `at` for `beats` (beats from the section start); notes low to high, MIDI. */
export interface ChordSpan {
  at: number;
  beats: number;
  notes: readonly number[];
}

/** A progression from [bars, notes] pairs, back to back from beat 0. */
export function prog(beatsPerBar: number, chords: readonly (readonly [number, readonly number[]])[]): ChordSpan[] {
  const out: ChordSpan[] = [];
  let at = 0;
  for (const [bars, notes] of chords) {
    out.push({ at, beats: bars * beatsPerBar, notes });
    at += bars * beatsPerBar;
  }
  return out;
}

/** The chord sounding at beat `t` (the last one for times past the end). */
export function chordAt(chords: readonly ChordSpan[], t: number): ChordSpan {
  for (const c of chords) if (t >= c.at - 1e-9 && t < c.at + c.beats - 1e-9) return c;
  return chords[chords.length - 1];
}

export function part(inst: BattleInstrument, ...lists: readonly (readonly MusicEvent[])[]): MusicPart {
  const events: MusicEvent[] = [];
  for (const l of lists) events.push(...l);
  return { inst, events };
}

/**
 * Step pattern characters: x hit, X accent, g ghost, f flam, F accented flam, r rim, R roll (lasts through the
 * following '-'), d dum, D accented dum, t tek, T accented tek, o a timpani or bell stroke on `note`, '-' holds the
 * previous stroke, '.' rest. Spaces and '|' are ignored (they only make bars readable).
 */
const STROKES: Record<string, readonly [Articulation, number]> = {
  x: ['hit', 1],
  X: ['hit', 1.3],
  g: ['ghost', 1],
  f: ['flam', 1],
  F: ['flam', 1.3],
  r: ['rim', 1],
  R: ['roll', 1],
  d: ['dum', 1],
  D: ['dum', 1.3],
  t: ['tek', 1],
  T: ['tek', 1.3],
  o: ['hit', 1],
};

export interface HitOptions {
  /** Beats per step (0.25 = sixteenths in 4/4). */
  step?: number;
  vel?: number;
  /** Beat the pattern starts on. */
  at?: number;
  /** Pitch for tuned strokes (timpani, bell, anvil). */
  note?: number;
}

export function hits(pattern: string, opts: HitOptions = {}): MusicEvent[] {
  const step = opts.step ?? 0.25;
  const vel = opts.vel ?? 0.7;
  const out: MusicEvent[] = [];
  let i = 0;
  let last: MusicEvent | null = null;
  for (const ch of pattern) {
    if (ch === ' ' || ch === '|') continue;
    const at = (opts.at ?? 0) + i * step;
    i++;
    if (ch === '-') {
      if (last) last.len += step;
      continue;
    }
    last = null;
    const stroke = STROKES[ch];
    if (!stroke) continue;
    const e: MusicEvent = { at, len: stroke[0] === 'roll' ? step : 0, note: opts.note ?? 0, vel: Math.min(1, vel * stroke[1]), art: stroke[0] };
    out.push(e);
    last = e;
  }
  return out;
}

/** The same events again every `everyBeats`, `times` times in all. */
export function tile(events: readonly MusicEvent[], everyBeats: number, times: number): MusicEvent[] {
  const out: MusicEvent[] = [];
  for (let k = 0; k < times; k++) for (const e of events) out.push({ ...e, at: e.at + k * everyBeats });
  return out;
}

export interface OstinatoOptions {
  /** Beats per step. */
  step: number;
  vel: number;
  /** Steps (indices into the pattern) played harder. */
  accents?: readonly number[];
  accent?: number;
  /** Semitones added to every note. */
  shift?: number;
  art?: Articulation;
  /** Note length as a share of the step. */
  len?: number;
  /** Beats to play from and to (default: the whole progression). */
  from?: number;
  to?: number;
}

/**
 * An ostinato over the harmony: each step plays chord tone pattern[k] of the chord sounding then (0 = lowest; past
 * the top it carries on an octave up; -1 rests).
 */
export function ostinato(chords: readonly ChordSpan[], pattern: readonly number[], o: OstinatoOptions): MusicEvent[] {
  const end = o.to ?? chords[chords.length - 1].at + chords[chords.length - 1].beats;
  const out: MusicEvent[] = [];
  let k = 0;
  for (let t = o.from ?? 0; t < end - 1e-9; t += o.step, k++) {
    const idx = pattern[k % pattern.length];
    if (idx < 0) continue;
    const c = chordAt(chords, t);
    const n = c.notes.length;
    const note = c.notes[idx % n] + 12 * Math.floor(idx / n) + (o.shift ?? 0);
    const accented = o.accents?.includes(k % pattern.length) === true;
    out.push({ at: t, len: o.step * (o.len ?? 0.9), note, vel: Math.min(1, o.vel * (accented ? (o.accent ?? 1.25) : 1)), art: o.art ?? 'short' });
  }
  return out;
}

export interface HeldOptions {
  vel: number;
  /** Which chord tones (indices, low to high); default all. */
  voices?: readonly number[];
  shift?: number;
  art?: Articulation;
}

/** Every chord held for its whole length. */
export function held(chords: readonly ChordSpan[], o: HeldOptions): MusicEvent[] {
  const out: MusicEvent[] = [];
  for (const c of chords) {
    const voices = o.voices ?? c.notes.map((_, i) => i);
    for (const v of voices) {
      if (v >= c.notes.length) continue;
      out.push({ at: c.at, len: c.beats, note: c.notes[v] + (o.shift ?? 0), vel: o.vel, art: o.art ?? 'long' });
    }
  }
  return out;
}

/**
 * A bass line on the chords' lowest notes: x root, X accented root, 5 the fifth above, 8 the octave, '-' holds,
 * '.' rests. The pattern repeats over the whole progression.
 */
export function bass(chords: readonly ChordSpan[], pattern: string, o: { step: number; vel: number; shift?: number; art?: Articulation }): MusicEvent[] {
  const cells = [...pattern].filter((c) => c !== ' ' && c !== '|');
  const c0 = chords[chords.length - 1];
  const end = c0.at + c0.beats;
  const out: MusicEvent[] = [];
  let last: MusicEvent | null = null;
  let k = 0;
  for (let t = 0; t < end - 1e-9; t += o.step, k++) {
    const ch = cells[k % cells.length];
    if (ch === '-') {
      if (last) last.len += o.step;
      continue;
    }
    last = null;
    if (ch === '.') continue;
    const root = chordAt(chords, t).notes[0] + (o.shift ?? 0);
    const note = ch === '5' ? root + 7 : ch === '8' ? root + 12 : root;
    const e: MusicEvent = { at: t, len: o.step * 0.9, note, vel: Math.min(1, o.vel * (ch === 'X' ? 1.25 : 1)), art: o.art ?? 'short' };
    out.push(e);
    last = e;
  }
  return out;
}

/** A plain list of [at, beats, note, vel] notes. */
export function line(notes: readonly (readonly [number, number, number, number])[], art?: Articulation): MusicEvent[] {
  return notes.map(([at, len, note, vel]) => ({ at, len, note, vel, art }));
}

export function shift(events: readonly MusicEvent[], beats: number): MusicEvent[] {
  return events.map((e) => ({ ...e, at: e.at + beats }));
}

export function transpose(events: readonly MusicEvent[], semitones: number): MusicEvent[] {
  return events.map((e) => (e.note > 0 ? { ...e, note: e.note + semitones } : e));
}

export function louder(events: readonly MusicEvent[], k: number): MusicEvent[] {
  return events.map((e) => ({ ...e, vel: Math.min(1, e.vel * k) }));
}

/** Velocities ramped from `from` to `to` (shares) across the events in time order: a crescendo or a diminuendo. */
export function swell(events: readonly MusicEvent[], from: number, to: number): MusicEvent[] {
  if (events.length === 0) return [];
  const t0 = Math.min(...events.map((e) => e.at));
  const t1 = Math.max(...events.map((e) => e.at));
  const span = Math.max(1e-9, t1 - t0);
  return events.map((e) => ({ ...e, vel: Math.min(1, e.vel * (from + ((to - from) * (e.at - t0)) / span)) }));
}

/** Keep only the events in [from, to) beats. */
export function between(events: readonly MusicEvent[], from: number, to: number): MusicEvent[] {
  return events.filter((e) => e.at >= from - 1e-9 && e.at < to - 1e-9);
}

/** A note moved by octaves into [lo, hi] (as close to the bottom as it fits). */
export function fit(note: number, lo: number, hi: number): number {
  let n = note;
  while (n < lo) n += 12;
  while (n - 12 >= lo && n > hi) n -= 12;
  return n;
}

/**
 * A step pattern (see hits) whose strokes are tuned to the root of the chord sounding at each stroke, moved into
 * [lo, hi]: timpani that follow the harmony.
 */
export function onRoots(chords: readonly ChordSpan[], pattern: string, o: HitOptions & { range: readonly [number, number] }): MusicEvent[] {
  return hits(pattern, o).map((e) => ({ ...e, note: fit(chordAt(chords, e.at).notes[0], o.range[0], o.range[1]) }));
}
