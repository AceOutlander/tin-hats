/**
 * Small writing helpers shared by the later cold tracks (brest, dubno, klin, volga): the motif statements of a plan
 * ("leads"), a two-bar pattern repeated over a section, a section's length in beats, and a held wind band. The first
 * two cold tracks (volokolamsk, factories) carry their own copies of these and are left as they were.
 */
import type { MusicEvent, MusicPart } from '../musicBattle';
import { line, part, type ChordSpan } from '../musicKit';
import { motif, SOVIET_ANSWER, SOVIET_MOTIF, type MotifForm } from '../musicThemes';

export type LeadInst = 'horn' | 'strings' | 'brass' | 'bell' | 'anvil' | 'choir';

/** Where "The Long Winter" comes in: instrument, form, the motif or its answer, and brass played short. */
export interface Lead {
  inst: LeadInst;
  form: MotifForm;
  answer?: boolean;
  stab?: boolean;
}

/** One part per statement, so each statement reads as one line (the score test finds it there). */
export function leads(list: readonly Lead[]): MusicPart[] {
  return list.map((l) => {
    const art = l.inst === 'strings' ? 'long' : l.stab ? 'stab' : undefined;
    return part(l.inst, motif(l.answer ? SOVIET_ANSWER : SOVIET_MOTIF, { art, ...l.form }));
  });
}

export function spanBeats(chords: readonly ChordSpan[]): number {
  return chords.reduce((n, c) => n + c.beats, 0);
}

/** A pattern written for one unit (two bars, a bar), repeated `reps` times. */
export function rep(pattern: string, reps: number): string {
  return Array.from({ length: Math.round(reps) }, () => pattern).join('');
}

/** A band of wind held over `beats`, as one long note. */
export function windBand(beats: number, note: number, vel: number, at = 0): MusicEvent[] {
  return line([[at, beats - at, note, Math.min(1, vel)]]);
}
