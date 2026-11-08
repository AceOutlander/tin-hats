/**
 * Mission 6, Monte Cassino 1944: "The Bells of Cassino". Heavier and slower than the other British tracks: low brass
 * chords held under a half-time snare, the timpani rolling into the downbeats, and bells high on the mountain. Every
 * call of the British motif "The Line" (src/data/musicThemes.ts) comes back off the slopes as a long echo, softer
 * each time, written into the score (a bar or a dotted half later) and carried by a bigger, darker hall. C minor with
 * the flattened second (D flat) for the rubble, 112 BPM, 4/4, seven sections of eight bars (17.1 s per layer, 360 s of
 * distinct music in three layers), plus two stings. Written for Tin Hats; it quotes no existing melody, march, call,
 * hymn, peal or score (the bells only toll the harmony's roots and fifths).
 */
import type { BattleSection, BattleSting, BattleTrackDef, MusicEvent, MusicPart } from '../musicBattle';
import { bass, chordAt, fit, held, hits, line, onRoots, ostinato, part, prog, swell, tile, type ChordSpan } from '../musicKit';
import { BRITISH_ANSWER, BRITISH_MOTIF, motif, type MotifForm } from '../musicThemes';
import { BATTLE_KIT, BATTLE_MIX, BATTLE_REVERB } from './kit';

const BAR = 4;
const TIMP: readonly [number, number] = [36, 50];
const BELL: readonly [number, number] = [55, 72];

// Chords, low to high (MIDI). C minor, the A flat and F minor of the slopes, the D flat of the rubble, G major.
const Cm = [36, 48, 51, 55];
const Cm9 = [36, 50, 51, 55];
const Ab = [44, 48, 51, 56];
const Abmaj7 = [44, 48, 51, 55];
const Fm = [41, 48, 53, 56];
const G = [43, 50, 55, 59];
const Gsus = [43, 50, 55, 60];
const Eb = [39, 51, 55, 58];
const Bb = [46, 50, 53, 58];
const Db = [37, 49, 53, 56];
const FmOnC = [36, 48, 53, 56];
const Bdim = [47, 50, 53, 56];

/** Where the motif comes in, per layer: the instrument, the form, and how the mountain gives it back. */
interface Lead {
  inst: 'horn' | 'strings' | 'brass';
  form: MotifForm;
  answer?: boolean;
  /** Beats until the echo, and how many come back (each softer). */
  echo?: readonly [number, number];
}

interface Plan {
  name: string;
  role: BattleSection['role'];
  chords: ChordSpan[];
  /** String figure: chord tones in eighths (build) and sixteenths (combat). */
  ostBuild: readonly number[];
  ostCombat: readonly number[];
  /** Two bars of sixteenths for the combat snare, played four times; the last bar gets a roll fill. */
  snare: string;
  /** Two bars of eighths: combat timpani and brass stabs on the chord roots. */
  timp: string;
  stabs: string;
  /** Two bars of eighths for the bells (on the root, 5 on the fifth). */
  bells: string;
  build: readonly Lead[];
  combat: readonly Lead[];
  tense: readonly Lead[];
}

const beats = (p: Plan): number => p.chords.reduce((n, c) => n + c.beats, 0);

/** The echo off the mountain: the events again `delay` beats later, `times` times, each at `decay` of the last; nothing past `end`. */
function echo(events: readonly MusicEvent[], delay: number, times: number, decay: number, end: number): MusicEvent[] {
  const out: MusicEvent[] = [];
  for (let k = 1; k <= times; k++) {
    for (const e of events) {
      const at = e.at + k * delay;
      if (at + e.len <= end + 1e-9) out.push({ ...e, at, vel: e.vel * decay ** k });
    }
  }
  return out;
}

function leads(list: readonly Lead[], end: number): MusicPart[] {
  return list.map((l) => {
    const call = motif(l.answer ? BRITISH_ANSWER : BRITISH_MOTIF, { art: l.inst === 'strings' ? 'long' : undefined, ...l.form });
    return part(l.inst, call, l.echo ? echo(call, l.echo[0], l.echo[1], 0.42, end) : []);
  });
}

/** A pattern written for two bars, repeated `reps` times. */
function tilePattern(pattern: string, reps: number): string {
  return Array.from({ length: Math.round(reps) }, () => pattern).join('');
}

/** Bells on the chord roots ('o') and fifths ('5'), in the bell's high register, each answered by its echo. */
function bells(p: Plan, pattern: string, vel: number, echoBeats: number): MusicEvent[] {
  const n = beats(p);
  const cells = [...pattern].filter((c) => c !== ' ' && c !== '|');
  const out: MusicEvent[] = [];
  for (let k = 0; k < (n / BAR) * 8; k++) {
    const ch = cells[k % cells.length];
    if (ch !== 'o' && ch !== '5') continue;
    const at = k * 0.5;
    const root = chordAt(p.chords, at).notes[0];
    out.push({ at, len: 0, note: fit(root + (ch === '5' ? 7 : 0), BELL[0], BELL[1]), vel, art: 'hit' });
  }
  return [...out, ...echo(out, echoBeats, 1, 0.4, n)];
}

/** The calm layer: the pad, slow string swells, a low bell on the phrase starts, the motif on the horn with its echoes. */
function buildLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  return [
    part('strings', ostinato(p.chords, p.ostBuild, { step: 0.5, vel: 0.3, accents: [0], accent: 1.3, art: 'long', len: 1 }), bass(p.chords, 'x-------', { step: 0.5, vel: 0.3, art: 'long' })),
    part('pad', held(p.chords, { vel: 0.6, voices: [0, 1, 2] })),
    part('timpani', onRoots(p.chords, 'o.......|........', { step: 0.5, vel: 0.36, range: TIMP })),
    part('bell', bells(p, 'o...............', 0.42, 3)),
    part('snare', tile(hits('................|............g.g.', { vel: 0.26 }), 2 * BAR, n / (2 * BAR))),
    ...leads(p.build, n),
  ];
}

/** Heavy fighting: low brass chords and stabs, a half-time snare, rolling timpani, strings grinding, bells ringing out. */
function combatLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  const reps = n / (2 * BAR);
  const snare = tile(hits(p.snare, { vel: 0.74 }), 2 * BAR, reps).filter((e) => e.at < n - BAR);
  const fill = swell(hits('X.....x.R-------', { at: n - BAR, vel: 0.72 }), 0.7, 1.1);
  return [
    part('strings', ostinato(p.chords, p.ostCombat, { step: 0.25, vel: 0.5, shift: 12, accents: [0, 8], accent: 1.35 }), bass(p.chords, 'X..xX.x.', { step: 0.5, vel: 0.52 })),
    part('brass', held(p.chords, { vel: 0.42, voices: [0, 1, 2] }), onRoots(p.chords, tilePattern(p.stabs, reps), { step: 0.5, vel: 0.62, range: [36, 48] }).map((e) => ({ ...e, len: 0.4, art: 'stab' as const }))),
    part('pad', held(p.chords, { vel: 0.4, voices: [2, 3] })),
    part('snare', snare, fill),
    part('timpani', onRoots(p.chords, tilePattern(p.timp, reps), { step: 0.5, vel: 0.66, range: TIMP })),
    part('bell', bells(p, p.bells, 0.55, 3)),
    ...leads(p.combat, n),
  ];
}

/** HQ in danger: a quick alarm bell, high tremolo, a heavy heartbeat, the motif turned upside down and echoing. */
function tenseLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  return [
    part('strings', held(p.chords, { vel: 0.3, voices: [1, 2, 3], shift: 12, art: 'trem' }), bass(p.chords, 'x...x...', { step: 0.5, vel: 0.44 })),
    part('bell', bells(p, 'o...o...o...o...', 0.34, 1.5)),
    part('snare', tile(hits('r...g.g.r...g...', { vel: 0.3 }), BAR, n / BAR)),
    part('timpani', onRoots(p.chords, tilePattern('o..o............', n / BAR), { step: 0.25, vel: 0.56, range: TIMP })),
    part('brass', held(p.chords, { vel: 0.34, voices: [0] })),
    ...leads(p.tense, n),
  ];
}

/** The quiet stretch: snow and stone, long notes and a far bell; combat and tense stay muffled. */
function quietSection(p: Plan): BattleSection {
  const n = beats(p);
  return {
    name: p.name,
    bars: n / BAR,
    role: 'quiet',
    layers: {
      build: [part('pad', held(p.chords, { vel: 0.55 })), part('strings', held(p.chords, { vel: 0.2, voices: [0], art: 'long' })), part('bell', bells(p, 'o...............|................', 0.32, 4)), ...leads(p.build, n)],
      combat: [
        part('pad', held(p.chords, { vel: 0.5 })),
        part('strings', ostinato(p.chords, p.ostBuild, { step: 0.5, vel: 0.28 })),
        part('brass', held(p.chords, { vel: 0.42, voices: [0, 1] })),
        part('bell', bells(p, 'o.......5.......', 0.36, 3)),
        part('timpani', swell(onRoots(p.chords, 'R-------', { at: n - 2 * BAR, step: 1, vel: 0.6, range: TIMP }), 0.6, 1)),
        part('snare', swell(hits('R-------', { at: n - 2 * BAR, step: 1, vel: 0.45 }), 0.5, 1)),
        ...leads(p.combat, n),
      ],
      tense: [
        part('strings', held(p.chords, { vel: 0.24, voices: [1, 2, 3], shift: 12, art: 'trem' })),
        part('bell', bells(p, 'o.......o.......', 0.28, 1.5)),
        part('timpani', tile(onRoots(p.chords, 'o..o', { step: 0.25, vel: 0.42, range: TIMP }), 2 * BAR, n / (2 * BAR))),
        ...leads(p.tense, n),
      ],
    },
  };
}

function section(p: Plan): BattleSection {
  if (p.role === 'quiet') return quietSection(p);
  return { name: p.name, bars: beats(p) / BAR, role: p.role, layers: { build: buildLayer(p), combat: combatLayer(p), tense: tenseLayer(p) } };
}

const PLANS: Plan[] = [
  {
    name: 'The abbey above the mist',
    role: 'intro',
    chords: prog(BAR, [[1, Cm], [1, Cm], [1, Ab], [1, Ab], [1, Fm], [1, Fm], [1, Gsus], [1, G]]),
    ostBuild: [0, 2, 3, 2],
    ostCombat: [0, 1, 2, 1, 0, 1, 2, 1, 0, 2, 3, 2, 1, 2, 3, 2],
    snare: 'X.......F...x...|X.......F..xx.x.',
    timp: 'o.......|o.....o.',
    stabs: 'x.......|......x.',
    bells: 'o.......|o...5...',
    build: [{ inst: 'horn', form: { tonic: 60, at: 0, augment: 2, take: 5, vel: 0.42 }, echo: [4, 2] }],
    combat: [
      { inst: 'brass', form: { tonic: 36, at: 0, vel: 0.85 }, echo: [4, 1] },
      { inst: 'horn', form: { tonic: 60, at: 16, vel: 0.5 }, echo: [3, 2] },
    ],
    tense: [{ inst: 'horn', form: { tonic: 67, at: 8, invert: true, colour: 'phrygian', vel: 0.45 }, echo: [3, 2] }],
  },
  {
    name: 'Across the Rapido',
    role: 'main',
    chords: prog(BAR, [[1, Cm], [1, Bb], [1, Ab], [1, G], [1, Cm], [1, Bb], [1, Ab], [1, G]]),
    ostBuild: [0, 1, 2, 3, 2, 1, 2, 1],
    ostCombat: [0, 2, 1, 2, 0, 3, 1, 3, 0, 2, 1, 2, 3, 2, 1, 0],
    snare: 'X...x...F...x.x.|X...x...F...xxx.',
    timp: 'o.o.....|o.o...oo',
    stabs: 'x...x...|x.x.....',
    bells: 'o.......|5.......',
    build: [{ inst: 'strings', form: { tonic: 48, at: 0, vel: 0.3 }, echo: [4, 1] }],
    combat: [
      { inst: 'brass', form: { tonic: 36, at: 0, vel: 0.82 } },
      { inst: 'brass', form: { tonic: 36, at: 16, displace: 0.5, vel: 0.82 }, echo: [3, 1] },
    ],
    tense: [{ inst: 'horn', form: { tonic: 60, at: 0, take: 3, augment: 2, vel: 0.45 }, echo: [4, 2] }],
  },
  {
    name: 'Stone and rubble',
    role: 'main',
    chords: prog(BAR, [[1, Cm], [1, Db], [1, Cm], [1, Db], [1, Fm], [1, Eb], [1, Db], [1, G]]),
    ostBuild: [0, 0, 2, 0, 3, 0, 2, 0],
    ostCombat: [0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 2, 1, 0],
    snare: 'X.......X...F...|X.......X..xF.x.',
    timp: 'o.o.o.o.|o.o.o.oo',
    stabs: 'x.x.....|x.x.....',
    bells: 'o...o...|o...o...',
    build: [{ inst: 'horn', form: { tonic: 60, at: 4, take: 5, colour: 'phrygian', vel: 0.4 }, echo: [3, 2] }],
    combat: [{ inst: 'brass', form: { tonic: 36, at: 0, augment: 2, colour: 'phrygian', vel: 0.88 }, echo: [6, 1] }],
    tense: [{ inst: 'horn', form: { tonic: 67, at: 16, retrograde: true, colour: 'phrygian', vel: 0.45 }, echo: [3, 1] }],
  },
  {
    name: 'Snakeshead Ridge',
    role: 'main',
    chords: prog(BAR, [[1, Fm], [1, Cm], [1, Fm], [1, Cm], [1, Ab], [1, Eb], [1, FmOnC], [1, G]]),
    ostBuild: [0, 3, 2, 3, 1, 3, 2, 3],
    ostCombat: [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 4, 3, 2, 1],
    snare: 'F...x.x.X...x...|F...x.x.X..xx.xx',
    timp: 'o...o.o.|o...o.oo',
    stabs: 'x.......|x...x...',
    bells: 'o.......|o.......',
    build: [
      { inst: 'horn', form: { tonic: 60, at: 0, vel: 0.44 }, echo: [4, 1] },
      { inst: 'horn', form: { tonic: 60, at: 16, vel: 0.42, colour: 'harmonic' }, answer: true },
    ],
    combat: [
      { inst: 'brass', form: { tonic: 36, at: 0, vel: 0.86 } },
      { inst: 'brass', form: { tonic: 36, at: 16, vel: 0.86, colour: 'harmonic' }, answer: true },
      { inst: 'horn', form: { tonic: 60, at: 4, take: 5, vel: 0.42 }, echo: [3, 2] },
    ],
    tense: [{ inst: 'horn', form: { tonic: 67, at: 0, invert: true, colour: 'harmonic', vel: 0.45 }, echo: [4, 2] }],
  },
  {
    name: 'Snow on the high ground',
    role: 'quiet',
    chords: prog(BAR, [[1, Cm9], [1, Abmaj7], [1, Cm9], [1, Abmaj7], [1, Fm], [1, Fm], [1, Gsus], [1, G]]),
    ostBuild: [0, 2, 3, 2, 1, 2, 3, 2],
    ostCombat: [0, 2, 1, 2],
    snare: '',
    timp: '',
    stabs: '',
    bells: '',
    build: [{ inst: 'horn', form: { tonic: 60, at: 4, augment: 2, take: 5, vel: 0.38 }, echo: [4, 2] }],
    combat: [{ inst: 'brass', form: { tonic: 48, at: 8, augment: 2, take: 5, vel: 0.6 }, echo: [4, 1] }],
    tense: [{ inst: 'horn', form: { tonic: 67, at: 8, invert: true, augment: 2, take: 4, vel: 0.36 }, echo: [3, 2] }],
  },
  {
    name: "Hangman's Hill",
    role: 'main',
    chords: prog(BAR, [[1, Ab], [1, Bb], [1, Cm], [1, Cm], [1, Ab], [1, Bb], [1, Bdim], [1, G]]),
    ostBuild: [0, 2, 1, 3, 0, 2, 1, 3],
    ostCombat: [0, 2, 0, 3, 0, 2, 0, 1, 0, 2, 0, 3, 1, 2, 3, 4],
    snare: 'X..x..x.F.......|X..x..x.F...x.xx',
    timp: 'o..o..o.|o..o.ooo',
    stabs: 'x..x..x.|x.......',
    bells: 'o...5...|o...5...',
    build: [{ inst: 'strings', form: { tonic: 48, at: 16, take: 5, step: 2, vel: 0.32 }, echo: [3, 2] }],
    combat: [
      { inst: 'brass', form: { tonic: 36, at: 0, step: 2, vel: 0.84 } },
      { inst: 'brass', form: { tonic: 36, at: 16, vel: 0.86 }, echo: [4, 1] },
    ],
    tense: [{ inst: 'horn', form: { tonic: 67, at: 8, take: 5, invert: true, step: 2, vel: 0.45 }, echo: [3, 2] }],
  },
  {
    name: 'Through the town',
    role: 'main',
    chords: prog(BAR, [[1, Cm], [1, Eb], [1, Fm], [1, G], [1, Cm], [1, Eb], [1, Db], [1, G]]),
    ostBuild: [0, 1, 2, 1, 3, 1, 2, 1],
    ostCombat: [0, 2, 1, 3, 0, 2, 1, 3, 0, 2, 1, 3, 2, 3, 4, 5],
    snare: 'X...X...F.x.X...|X...X...F.F.x.xx',
    timp: 'o...o...|o.o.o.oo',
    stabs: 'x...x...|x...x.x.',
    bells: 'o.......|o...o...',
    build: [
      { inst: 'horn', form: { tonic: 60, at: 0, vel: 0.42 }, echo: [4, 1] },
      { inst: 'horn', form: { tonic: 60, at: 24, vel: 0.4, colour: 'dorian' }, answer: true },
    ],
    combat: [
      { inst: 'brass', form: { tonic: 48, at: 0, vel: 0.78 }, echo: [4, 1] },
      { inst: 'brass', form: { tonic: 36, at: 24, vel: 0.86 }, answer: true },
    ],
    tense: [{ inst: 'horn', form: { tonic: 60, at: 16, take: 5, vel: 0.45 }, echo: [3, 2] }],
  },
];

/** Victory: the answer in C major on the brass, the bells ringing out over a held chord and echoing away. */
const VICTORY: BattleSting = {
  beats: 12,
  parts: [
    part('brass', motif(BRITISH_ANSWER, { tonic: 48, colour: 'major', vel: 0.85 }), line([[8, 4, 36, 0.8], [8, 4, 43, 0.7]])),
    part('pad', line([[0, 12, 36, 0.6], [0, 12, 48, 0.5], [4, 8, 52, 0.5], [4, 8, 55, 0.5]])),
    part('strings', line([[8, 4, 60, 0.5], [8, 4, 64, 0.45], [8, 4, 67, 0.45]], 'trem')),
    part('bell', line([[8, 0, 72, 0.6], [8.75, 0, 67, 0.5], [9.5, 0, 64, 0.45], [10.25, 0, 60, 0.5], [11, 0, 67, 0.25]], 'hit')),
    part('timpani', swell(hits('R-------', { step: 1, vel: 0.6, note: 36 }), 0.5, 1), hits('o', { at: 8, vel: 0.9, note: 36 })),
  ],
};

/** Defeat: the motif's head sinking in the Phrygian colour, one low bell tolling and its echo fading. */
const DEFEAT: BattleSting = {
  beats: 12,
  parts: [
    part('brass', motif(BRITISH_MOTIF, { tonic: 36, take: 3, augment: 2, colour: 'phrygian', vel: 0.72 }), line([[8, 4, 37, 0.55], [8, 4, 36, 0.5]])),
    part('strings', line([[0, 12, 60, 0.3], [0, 12, 61, 0.26], [0, 12, 67, 0.24]], 'trem')),
    part('pad', line([[0, 12, 36, 0.55], [0, 12, 43, 0.45]])),
    part('bell', line([[0, 0, 60, 0.5], [3, 0, 60, 0.22], [6, 0, 60, 0.45], [9, 0, 60, 0.18]], 'hit')),
    part('timpani', hits('o...o...o', { step: 1, vel: 0.72, note: 36 })),
  ],
};

export const CASSINO: BattleTrackDef = {
  title: 'The Bells of Cassino',
  theme: 'british',
  bpm: 112,
  beatsPerBar: BAR,
  tonic: 0,
  layerLevel: { build: 1.5, combat: 1, tense: 1.27, prep: 1.5 },
  gain: 0.8,
  humanize: { time: 0.007, velocity: 0.08 },
  seed: 1944,
  instruments: {
    ...BATTLE_KIT,
    brass: { ...BATTLE_KIT.brass, cutoff: 230, envCutoff: 1600, level: 0.32 },
    snare: { ...BATTLE_KIT.snare, toneHz: 180, toneEndHz: 140, decay: 0.24, highpassHz: 1000 },
    bell: { ...BATTLE_KIT.bell, level: 0.2 },
  },
  mix: { ...BATTLE_MIX, horn: { dry: 0.5, send: 0.75 }, bell: { dry: 0.45, send: 0.8 }, reverb: 0.55 },
  reverb: { ...BATTLE_REVERB, seconds: 2.6, preDelay: 0.05, brightHz: 3000, darkHz: 420, seed: 1944 },
  sections: PLANS.map(section),
  stings: { victory: VICTORY, defeat: DEFEAT },
};
