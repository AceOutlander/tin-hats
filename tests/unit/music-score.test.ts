/**
 * The battle scores as music, read from the data: every campaign mission has a track of its own, the British motif
 * ("The Line") and its answer come back in every British track in several transformed forms, and no melodic line in
 * any track runs along a well-known tune (an originality guard: the owner wants nothing recognisable).
 */
import { describe, expect, it } from 'vitest';
import { MISSIONS } from '../../src/data/missions';
import type { MusicEvent } from '../../src/data/musicBattle';
import { MUSIC_LAYERS } from '../../src/data/musicBattle';
import { BRITISH_ANSWER, BRITISH_MOTIF, motif, SCALES, type Colour, type Motif } from '../../src/data/musicThemes';
import { BATTLE_TRACK_NAMES, BATTLE_TRACKS } from '../../src/data/musicTracks';

/** A form the motif can take, as found in a part. */
interface Shape {
  key: string;
  /** Transformations applied: 'colour', 'invert', 'retrograde', 'take', 'step', 'answer' ('augment' is found from the rhythm). */
  kinds: string[];
}

const COLOURS = Object.keys(SCALES) as Colour[];

/** Interval and rhythm fingerprint of consecutive events: semitone steps, and each gap as a share of the first gap. */
function fingerprint(events: readonly MusicEvent[]): string {
  const iv: number[] = [];
  const gaps: number[] = [];
  for (let i = 1; i < events.length; i++) {
    iv.push(events[i].note - events[i - 1].note);
    gaps.push(events[i].at - events[i - 1].at);
  }
  const g0 = gaps[0] || 1;
  return `${iv.join(',')}|${gaps.map((g) => Math.round((g / g0) * 100)).join(',')}`;
}

/** Every form of a motif from three notes up, keyed by fingerprint (key-, register- and tempo-free). */
function shapes(m: Motif, answer: boolean): Map<string, Shape> {
  const out = new Map<string, Shape>();
  for (const colour of COLOURS) {
    for (const invert of [false, true]) {
      for (const retrograde of [false, true]) {
        // The plainest form first: an octave (step 7) is the same shape as no step at all.
        for (const step of [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6]) {
          for (let take = 3; take <= m.notes.length; take++) {
            const ev = motif(m, { tonic: 60, colour, invert, retrograde, step, take });
            const key = `${take}:${fingerprint(ev)}`;
            if (out.has(key)) continue;
            const kinds: string[] = [];
            if (answer) kinds.push('answer');
            if (colour !== 'minor') kinds.push('colour');
            if (invert) kinds.push('invert');
            if (retrograde) kinds.push('retrograde');
            if (step !== 0) kinds.push('step');
            if (take < m.notes.length) kinds.push('take');
            out.set(key, { key, kinds });
          }
        }
      }
    }
  }
  return out;
}

const SHAPES = [shapes(BRITISH_MOTIF, false), shapes(BRITISH_ANSWER, true)];
const MOTIF_GAP = BRITISH_MOTIF.notes[1][0] - BRITISH_MOTIF.notes[0][0];

interface Statement {
  section: string;
  kinds: Set<string>;
}

/** The motif statements in a list of parts: runs of consecutive events (as written) shaped like a form, 4 notes or more. */
function statements(where: string, parts: readonly { events: readonly MusicEvent[] }[]): Statement[] {
  const out: Statement[] = [];
  for (const p of parts) {
    const ev = p.events.filter((e) => e.note > 0);
    for (let i = 0; i < ev.length; i++) {
      // The longest form starting here.
      for (let take = 8; take >= 4; take--) {
        if (i + take > ev.length) continue;
        const run = ev.slice(i, i + take);
        const key = `${take}:${fingerprint(run)}`;
        const shape = SHAPES.map((s) => s.get(key)).find((s) => s !== undefined);
        if (!shape) continue;
        const kinds = new Set(shape.kinds);
        // Augmented or diminished: its first gap differs from the written motif's (the retrograde's differs anyway).
        if (!shape.kinds.includes('retrograde') && !shape.kinds.includes('answer') && Math.abs(run[1].at - run[0].at - MOTIF_GAP) > 1e-6) kinds.add('augment');
        out.push({ section: where, kinds });
        i += take - 1;
        break;
      }
    }
  }
  return out;
}

/**
 * Openings of tunes the scores must not run along (MIDI, any key: compared by interval). National anthems, bugle
 * calls, marches, hymns and film themes a player might know.
 */
const WELL_KNOWN: Record<string, readonly number[]> = {
  'God Save the King': [67, 67, 69, 66, 67, 69, 71, 71, 72, 71, 69, 67, 69, 67, 66, 67],
  'Ode to Joy': [64, 64, 65, 67, 67, 65, 64, 62, 60, 60, 62, 64, 64, 62, 62],
  Taps: [55, 55, 60, 55, 60, 64, 55, 60, 64, 55, 60, 64, 60, 64, 67, 64, 60, 55],
  'Imperial March': [67, 67, 67, 63, 70, 67, 63, 70, 67, 74, 74, 74, 75, 70, 66, 63, 70, 67],
  'Star Wars main title': [62, 62, 62, 67, 74, 72, 71, 69, 79, 74, 72, 71, 69, 79, 74, 72, 71, 72, 69],
  'Dies irae': [65, 64, 65, 62, 64, 60, 62, 62],
  'Westminster Quarters': [64, 60, 62, 55, 55, 62, 64, 60, 64, 62, 60, 55, 55, 62, 64, 60],
  'Chopin funeral march': [58, 58, 58, 58, 61, 60, 60, 58, 58, 57, 58],
  "He's a Pirate": [57, 60, 62, 62, 62, 64, 65, 65, 65, 67, 64, 64, 62, 60, 60, 62],
  'Game of Thrones': [67, 60, 63, 65, 67, 60, 63, 65],
  'Colonel Bogey': [64, 60, 60, 62, 64, 60, 60],
  Katyusha: [57, 59, 60, 57, 60, 60, 59, 57, 59, 52],
  'Beethoven Fifth': [67, 67, 67, 63, 65, 65, 65, 62],
  Kaiserhymne: [60, 62, 64, 62, 65, 64, 62, 59, 60, 69, 67, 65, 64, 62, 64, 60],
  'La Marseillaise': [62, 62, 62, 67, 67, 69, 69, 74, 71, 67],
  'Mission Impossible': [67, 67, 70, 72, 67, 67, 65, 66],
};
/** Consecutive intervals that would make a line recognisable (7 intervals: 8 notes in a row). */
const RECOGNISABLE = 7;

function intervals(notes: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < notes.length; i++) out.push(notes[i] - notes[i - 1]);
  return out;
}

/** A part's lines: as written, its top voice and its bottom voice (notes struck together collapsed). */
function lines(events: readonly MusicEvent[]): number[][] {
  const pitched = events.filter((e) => e.note > 0);
  const byAt = new Map<number, number[]>();
  for (const e of pitched) {
    const k = Math.round(e.at * 48);
    const list = byAt.get(k) ?? [];
    list.push(e.note);
    byAt.set(k, list);
  }
  const at = [...byAt.keys()].sort((a, b) => a - b);
  return [pitched.map((e) => e.note), at.map((k) => Math.max(...(byAt.get(k) ?? []))), at.map((k) => Math.min(...(byAt.get(k) ?? [])))];
}

/** Every part of a track with where it is. */
function everyPart(name: (typeof BATTLE_TRACK_NAMES)[number]): { where: string; events: readonly MusicEvent[] }[] {
  const def = BATTLE_TRACKS[name];
  const out: { where: string; events: readonly MusicEvent[] }[] = [];
  for (const s of def.sections) {
    for (const layer of MUSIC_LAYERS) for (const p of s.layers[layer] ?? []) out.push({ where: `${s.name} ${layer} ${p.inst}`, events: p.events });
  }
  for (const sting of ['victory', 'defeat'] as const) for (const p of def.stings[sting].parts) out.push({ where: `${sting} sting ${p.inst}`, events: p.events });
  return out;
}

describe('the battle scores', () => {
  it('give every campaign mission a track of its own', () => {
    const names = MISSIONS.map((m) => m.music);
    expect(names.length).toBe(10);
    expect(new Set(names).size).toBe(names.length);
    for (const n of names) expect(BATTLE_TRACK_NAMES).toContain(n);
  });

  for (const name of BATTLE_TRACK_NAMES) {
    it(`${name}: states the British motif in several sections and several transformed forms`, () => {
      const def = BATTLE_TRACKS[name];
      const found: Statement[] = [];
      for (const s of def.sections) {
        for (const layer of MUSIC_LAYERS) found.push(...statements(s.name, s.layers[layer] ?? []));
      }
      const sections = new Set(found.map((f) => f.section));
      const kinds = new Set(found.flatMap((f) => [...f.kinds]));
      expect(found.length, 'statements of the motif or its answer').toBeGreaterThanOrEqual(8);
      expect(sections.size, 'sections it comes back in').toBeGreaterThanOrEqual(Math.min(5, def.sections.length));
      expect(kinds.size, `forms: ${[...kinds].join(', ')}`).toBeGreaterThanOrEqual(4);
      // Plain statements too, so the tune is known before it is varied.
      expect(found.some((f) => f.kinds.size === 0 || (f.kinds.size === 1 && f.kinds.has('take')))).toBe(true);
    });

    it(`${name}: runs along no well-known tune`, () => {
      const refs = Object.entries(WELL_KNOWN).map(([tune, notes]) => [tune, `,${intervals(notes).join(',')},`] as const);
      const runs: string[] = [];
      for (const p of everyPart(name)) {
        for (const line of lines(p.events)) {
          const iv = intervals(line);
          for (let i = 0; i + RECOGNISABLE <= iv.length; i++) {
            const w = iv.slice(i, i + RECOGNISABLE).join(',');
            for (const [tune, ref] of refs) {
              // A window of the line found anywhere in the tune's opening, on interval boundaries.
              if (ref.includes(`,${w},`)) runs.push(`${p.where} runs along ${tune}`);
            }
          }
        }
      }
      expect(runs).toEqual([]);
    });
  }
});
