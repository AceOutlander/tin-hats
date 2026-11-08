/**
 * Mission 9, Arnhem Bridge 1944 (survival, six minutes): "Six Minutes at the Bridge". Tense like a ticking clock: a
 * rim tick on the beat and a dry tock between, string pulses that repeat one note like a second hand, and B minor
 * held over a bass that creeps down by semitones. The British motif "The Line" (src/data/musicThemes.ts) runs out of
 * step with the clock (displaced half a beat), ticks by at double speed in the strings, stretches out while the
 * minutes crawl and comes up in the relative major when the bridge holds. 120 BPM, 4/4, six sections of eight bars
 * with all four layers (prep is the waiting before the first wave), 384 s of distinct music, plus two stings.
 * Written for Tin Hats; it quotes no existing melody, march, call or score. Built on the recipe of musicTracks/arras.ts.
 */
import type { BattleSection, BattleSting, BattleTrackDef, MusicEvent, MusicPart } from '../musicBattle';
import { bass, held, hits, line, onRoots, ostinato, part, prog, swell, tile, type ChordSpan } from '../musicKit';
import { BRITISH_ANSWER, BRITISH_MOTIF, motif, type MotifForm } from '../musicThemes';
import { BATTLE_KIT, BATTLE_MIX, BATTLE_REVERB } from './kit';

const BAR = 4;
const TIMP: readonly [number, number] = [38, 50];

// Chords, low to high (MIDI). B minor over a bass creeping down (B, A sharp, A, G sharp), the Neapolitan C major.
const Bm = [47, 54, 59, 62];
const BmAs = [46, 54, 59, 62];
const BmA = [45, 54, 59, 62];
const GsHalf = [44, 54, 59, 62];
const G = [43, 55, 59, 62];
const Gmaj7 = [43, 54, 59, 62];
const Em = [40, 55, 59, 64];
const Fs = [42, 54, 58, 61];
const Fssus = [42, 54, 59, 61];
const Fs7 = [42, 52, 58, 61];
const C = [36, 52, 55, 60];
const D = [38, 54, 57, 62];
const A = [45, 52, 57, 61];

interface Lead {
  inst: 'horn' | 'strings' | 'brass';
  form: MotifForm;
  answer?: boolean;
  every?: number;
  times?: number;
}

interface Plan {
  name: string;
  role: BattleSection['role'];
  chords: ChordSpan[];
  /** One bar of sixteenths each: the clock's tick (snare rim) and tock (hand drum). */
  tick: string;
  tock: string;
  /** The second hand: eighth-note string pulses (chord tones), and the combat sixteenths. */
  pulse: readonly number[];
  ostCombat: readonly number[];
  /** Two bars of sixteenths for the combat snare, two bars of eighths for its timpani and brass stabs. */
  snare: string;
  timp: string;
  stabs: string;
  prep: readonly Lead[];
  build: readonly Lead[];
  combat: readonly Lead[];
  tense: readonly Lead[];
}

function leads(list: readonly Lead[]): MusicPart[] {
  return list.map((l) => {
    const events: MusicEvent[] = [];
    const m = l.answer ? BRITISH_ANSWER : BRITISH_MOTIF;
    for (let k = 0; k < (l.times ?? 1); k++) {
      events.push(...motif(m, { art: l.inst === 'strings' ? 'long' : undefined, ...l.form, at: (l.form.at ?? 0) + k * (l.every ?? 0) }));
    }
    return part(l.inst, events);
  });
}

const beats = (p: Plan): number => p.chords.reduce((n, c) => n + c.beats, 0);

function tilePattern(pattern: string, reps: number): string {
  return Array.from({ length: Math.round(reps) }, () => pattern).join('');
}

/** The clock: tick and tock every bar, at a share of their level. */
function clock(p: Plan, vel: number): MusicPart[] {
  const bars = beats(p) / BAR;
  return [part('snare', tile(hits(p.tick, { vel }), BAR, bars)), part('hand', tile(hits(p.tock, { vel: vel * 1.1 }), BAR, bars))];
}

/** Waiting for the first wave: the clock alone over a low pedal, a slow swell to the end, the motif's first step far off. */
function prepLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  return [
    ...clock(p, 0.26),
    part('pad', held(p.chords, { vel: 0.5, voices: [0, 1] })),
    part('strings', held(p.chords, { vel: 0.2, voices: [0], art: 'long' }), swell(held(p.chords.filter((c) => c.at >= n - 2 * BAR), { vel: 0.26, voices: [2, 3], art: 'trem' }), 0.4, 1)),
    part('timpani', onRoots(p.chords, 'o...............|o...............', { step: 0.5, vel: 0.34, range: TIMP })),
    ...leads(p.prep),
  ];
}

/** Calm: the clock, the second hand in the strings, the pad, the motif out of step. */
function buildLayer(p: Plan): MusicPart[] {
  return [
    ...clock(p, 0.3),
    part('strings', ostinato(p.chords, p.pulse, { step: 0.5, vel: 0.3, shift: 12, len: 0.5, accents: [0, 4], accent: 1.25 }), bass(p.chords, 'x.......', { step: 0.5, vel: 0.3 })),
    part('pad', held(p.chords, { vel: 0.58, voices: [0, 1, 2] })),
    part('timpani', onRoots(p.chords, 'o.......|........', { step: 0.5, vel: 0.36, range: TIMP })),
    ...leads(p.build),
  ];
}

/** Heavy fighting: the clock keeps going under sixteenth strings, the snare, timpani and low brass. */
function combatLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  const reps = n / (2 * BAR);
  const snare = tile(hits(p.snare, { vel: 0.7 }), 2 * BAR, reps).filter((e) => e.at < n - BAR);
  const fill = swell(hits('x.x.x.x.x.x.R---', { at: n - BAR, vel: 0.72 }), 0.7, 1.1);
  return [
    part('hand', tile(hits(p.tock, { vel: 0.4 }), BAR, n / BAR)),
    part('strings', ostinato(p.chords, p.ostCombat, { step: 0.25, vel: 0.55, shift: 12, accents: [0, 4, 8, 12], accent: 1.3 }), bass(p.chords, 'X.x.x.x.', { step: 0.5, vel: 0.5 })),
    part('pad', held(p.chords, { vel: 0.5, voices: [1, 2, 3] })),
    part('snare', snare, fill),
    part('timpani', onRoots(p.chords, tilePattern(p.timp, reps), { step: 0.5, vel: 0.62, range: TIMP })),
    part('brass', onRoots(p.chords, tilePattern(p.stabs, reps), { step: 0.5, vel: 0.6, range: [36, 50] }).map((e) => ({ ...e, len: 0.4, art: 'stab' as const }))),
    ...leads(p.combat),
  ];
}

/** The clock running out: ticks on every eighth, high tremolo, a heartbeat on the timpani, the motif turned over. */
function tenseLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  return [
    part('snare', tile(hits('r.r.r.r.r.r.r.r.', { vel: 0.32 }), BAR, n / BAR)),
    part('hand', tile(hits('.t.t.t.t.t.t.t.t', { vel: 0.26 }), BAR, n / BAR)),
    part('strings', held(p.chords, { vel: 0.3, voices: [1, 2, 3], shift: 12, art: 'trem' }), bass(p.chords, 'x.x.x.x.', { step: 0.5, vel: 0.42 })),
    part('timpani', onRoots(p.chords, tilePattern('o..o............', n / BAR), { step: 0.25, vel: 0.5, range: TIMP })),
    part('brass', held(p.chords.filter((_, i) => i % 2 === 0), { vel: 0.32, voices: [0] })),
    ...leads(p.tense),
  ];
}

/** The long minute: almost nothing but the clock; the combat and tense layers stay muffled. */
function quietSection(p: Plan): BattleSection {
  const n = beats(p);
  return {
    name: p.name,
    bars: n / BAR,
    role: 'quiet',
    layers: {
      build: [...clock(p, 0.24), part('pad', held(p.chords, { vel: 0.55 })), part('strings', held(p.chords, { vel: 0.22, voices: [0], art: 'long' })), ...leads(p.build)],
      combat: [
        ...clock(p, 0.3),
        part('pad', held(p.chords, { vel: 0.5 })),
        part('strings', ostinato(p.chords, p.pulse, { step: 0.5, vel: 0.3, shift: 12, len: 0.5 })),
        part('brass', held(p.chords, { vel: 0.4, voices: [0, 1] })),
        part('timpani', swell(onRoots(p.chords, 'R-------', { at: n - 2 * BAR, step: 1, vel: 0.6, range: TIMP }), 0.6, 1)),
        ...leads(p.combat),
      ],
      tense: [
        part('snare', tile(hits('r.r.r.r.r.r.r.r.', { vel: 0.26 }), BAR, n / BAR)),
        part('strings', held(p.chords, { vel: 0.24, voices: [1, 2, 3], shift: 12, art: 'trem' })),
        part('timpani', tile(onRoots(p.chords, 'o..o', { step: 0.25, vel: 0.4, range: TIMP }), 2 * BAR, n / (2 * BAR))),
        ...leads(p.tense),
      ],
      prep: [
        ...clock(p, 0.22),
        part('pad', held(p.chords, { vel: 0.48, voices: [0, 2] })),
        part('timpani', onRoots(p.chords, 'o', { step: 1, vel: 0.28, range: TIMP })),
        ...leads(p.prep),
      ],
    },
  };
}

function section(p: Plan): BattleSection {
  if (p.role === 'quiet') return quietSection(p);
  return { name: p.name, bars: beats(p) / BAR, role: p.role, layers: { build: buildLayer(p), combat: combatLayer(p), tense: tenseLayer(p), prep: prepLayer(p) } };
}

const PLANS: Plan[] = [
  {
    name: 'The northern ramp',
    role: 'intro',
    chords: prog(BAR, [[1, Bm], [1, BmAs], [1, BmA], [1, GsHalf], [1, G], [1, Em], [1, Fssus], [1, Fs]]),
    tick: 'r...r...r...r...',
    tock: '..t...t...t...t.',
    pulse: [3, 3, 3, 3, 3, 3, 2, 3],
    ostCombat: [3, 1, 3, 2, 3, 1, 3, 2, 3, 1, 3, 2, 4, 3, 2, 1],
    snare: 'X..x..x.x.r.x...|X..x..x.f...x.x.',
    timp: 'o.....o.|o...o...',
    stabs: 'x.......|....x...',
    prep: [{ inst: 'horn', form: { tonic: 59, at: 16, take: 2, augment: 2, vel: 0.3 } }],
    build: [{ inst: 'strings', form: { tonic: 71, at: 16, take: 5, displace: 0.5, vel: 0.3 } }],
    combat: [
      { inst: 'brass', form: { tonic: 47, at: 0, vel: 0.8 } },
      { inst: 'brass', form: { tonic: 47, at: 16, displace: 0.5, colour: 'harmonic', vel: 0.8 } },
    ],
    tense: [{ inst: 'horn', form: { tonic: 59, at: 8, invert: true, colour: 'phrygian', vel: 0.45 } }],
  },
  {
    name: 'Waiting for the relief',
    role: 'main',
    chords: prog(BAR, [[1, Bm], [1, G], [1, Bm], [1, G], [1, Em], [1, C], [1, Fssus], [1, Fs]]),
    tick: 'r.......r.......',
    tock: '....t.......t...',
    pulse: [2, 3, 2, 3, 2, 3, 2, 3],
    ostCombat: [3, 2, 3, 1, 3, 2, 3, 1, 3, 2, 3, 1, 3, 2, 1, 0],
    snare: 'X.x.x.xxX.x.x.x.|X.x.x.xxX.r.x.r.',
    timp: 'o.o.o...|o.o.o.oo',
    stabs: 'x...x...|x.x.....',
    prep: [{ inst: 'strings', form: { tonic: 59, at: 8, take: 3, augment: 2, vel: 0.24 } }],
    build: [{ inst: 'horn', form: { tonic: 59, at: 0, take: 5, augment: 2, vel: 0.38 } }],
    combat: [
      { inst: 'strings', form: { tonic: 71, at: 0, augment: 0.5, vel: 0.55 }, every: 4, times: 2 },
      { inst: 'strings', form: { tonic: 71, at: 16, augment: 0.5, step: -1, vel: 0.55 }, every: 4, times: 2 },
      { inst: 'brass', form: { tonic: 47, at: 24, take: 5, vel: 0.8 } },
    ],
    tense: [{ inst: 'horn', form: { tonic: 59, at: 16, retrograde: true, vel: 0.45 } }],
  },
  {
    name: 'House by house',
    role: 'main',
    chords: prog(BAR, [[1, Em], [1, Bm], [1, Em], [1, Bm], [1, C], [1, G], [1, Fs7], [1, Fs]]),
    tick: 'r...r...r...r.r.',
    tock: '..t...t...t.....',
    pulse: [0, 3, 1, 3, 2, 3, 1, 3],
    ostCombat: [0, 3, 1, 3, 0, 3, 2, 3, 0, 3, 1, 3, 2, 3, 4, 3],
    snare: 'x..X..x...x.X...|x..X..x.x..xX...',
    timp: 'o..o..o.|o..o.o.o',
    stabs: '...x....|...x..x.',
    prep: [{ inst: 'horn', form: { tonic: 59, at: 0, take: 2, displace: 0.5, vel: 0.28 }, every: 8, times: 3 }],
    build: [{ inst: 'strings', form: { tonic: 71, at: 0, take: 5, colour: 'phrygian', displace: 0.5, vel: 0.3 } }],
    combat: [
      { inst: 'brass', form: { tonic: 47, at: 0, invert: true, vel: 0.8 } },
      { inst: 'brass', form: { tonic: 47, at: 16, step: 3, vel: 0.8 } },
    ],
    tense: [{ inst: 'horn', form: { tonic: 59, at: 0, take: 3, augment: 2, colour: 'phrygian', vel: 0.45 } }],
  },
  {
    name: 'Panzers on the embankment',
    role: 'main',
    chords: prog(BAR, [[1, Bm], [1, C], [1, Bm], [1, C], [1, A], [1, G], [1, Fssus], [1, Fs]]),
    tick: 'r.r.r.r.r.r.r.r.',
    tock: '................',
    pulse: [3, 0, 3, 0, 3, 1, 3, 2],
    ostCombat: [0, 0, 3, 0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 2, 1, 0],
    snare: 'X...X...X...X.x.|X...X...X..xX.x.',
    timp: 'o.o.o.o.|o.o.o.oo',
    stabs: 'x.x.....|x.x.....',
    prep: [{ inst: 'strings', form: { tonic: 59, at: 16, take: 3, invert: true, augment: 2, vel: 0.24 } }],
    build: [{ inst: 'horn', form: { tonic: 59, at: 8, colour: 'phrygian', vel: 0.4 } }],
    combat: [
      { inst: 'brass', form: { tonic: 47, at: 0, colour: 'phrygian', vel: 0.85 } },
      { inst: 'brass', form: { tonic: 47, at: 16, colour: 'harmonic', displace: 0.5, vel: 0.85 } },
    ],
    tense: [{ inst: 'horn', form: { tonic: 59, at: 0, invert: true, augment: 2, vel: 0.42 } }],
  },
  {
    name: 'The long minute',
    role: 'quiet',
    chords: prog(BAR, [[2, Bm], [2, Gmaj7], [2, Em], [2, Fs]]),
    tick: 'r...r...r...r...',
    tock: '..t...t...t...t.',
    pulse: [3, 3, 2, 3, 3, 3, 1, 3],
    ostCombat: [3],
    snare: '',
    timp: '',
    stabs: '',
    prep: [{ inst: 'strings', form: { tonic: 71, at: 16, take: 3, augment: 2, vel: 0.22 } }],
    build: [{ inst: 'horn', form: { tonic: 59, at: 4, augment: 2, take: 5, vel: 0.36 } }],
    combat: [{ inst: 'brass', form: { tonic: 47, at: 8, augment: 2, take: 5, vel: 0.6 } }],
    tense: [{ inst: 'horn', form: { tonic: 59, at: 8, invert: true, augment: 2, take: 4, vel: 0.36 } }],
  },
  {
    name: 'Hold the bridge',
    role: 'main',
    chords: prog(BAR, [[1, G], [1, D], [1, A], [1, Bm], [1, G], [1, D], [1, Em], [1, Fs]]),
    tick: 'r...r...r...r...',
    tock: '.t...t...t...t..',
    pulse: [0, 2, 3, 2, 0, 2, 3, 2],
    ostCombat: [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 4, 3, 2, 1],
    snare: 'X.x.X.x.X.xxX.x.|X.x.X.x.F.F.x.xx',
    timp: 'o...o...|o.o.o.oo',
    stabs: 'x...x...|x...xxx.',
    prep: [{ inst: 'horn', form: { tonic: 62, at: 8, take: 3, colour: 'major', augment: 2, vel: 0.28 } }],
    build: [
      { inst: 'horn', form: { tonic: 62, at: 0, colour: 'major', vel: 0.42 } },
      { inst: 'horn', form: { tonic: 59, at: 16, vel: 0.42 } },
    ],
    combat: [
      { inst: 'brass', form: { tonic: 50, at: 0, colour: 'major', vel: 0.82 } },
      { inst: 'horn', form: { tonic: 62, at: 0, colour: 'major', vel: 0.5 } },
      { inst: 'brass', form: { tonic: 47, at: 16, colour: 'harmonic', vel: 0.85 } },
    ],
    tense: [{ inst: 'horn', form: { tonic: 59, at: 16, take: 5, vel: 0.45 } }],
  },
];

/** Victory: the clock stops; the answer in B major on the brass over a timpani roll, home on a held chord. */
const VICTORY: BattleSting = {
  beats: 12,
  parts: [
    part('snare', hits('r...r...r...r...|r...r...........', { vel: 0.3 }), swell(hits('R---', { at: 4, step: 1, vel: 0.5 }), 0.4, 1), hits('F', { at: 8, vel: 0.8 })),
    part('brass', motif(BRITISH_ANSWER, { tonic: 47, colour: 'major', vel: 0.85 }), line([[8, 4, 35, 0.8], [8, 4, 42, 0.7]])),
    part('pad', line([[0, 12, 47, 0.6], [0, 12, 54, 0.5], [4, 8, 59, 0.5], [4, 8, 63, 0.5]])),
    part('strings', line([[8, 4, 66, 0.5], [8, 4, 71, 0.45], [8, 4, 75, 0.45]], 'trem')),
    part('timpani', swell(hits('R-------', { step: 1, vel: 0.6, note: 47 }), 0.5, 1), hits('o', { at: 8, vel: 0.9, note: 47 })),
  ],
};

/** Defeat: the clock slows and stops under the motif's head sinking in the Phrygian colour. */
const DEFEAT: BattleSting = {
  beats: 12,
  parts: [
    part('snare', line([[0, 0, 0, 0.32], [1, 0, 0, 0.3], [2.25, 0, 0, 0.27], [3.75, 0, 0, 0.24], [5.75, 0, 0, 0.2]], 'rim')),
    part('brass', motif(BRITISH_MOTIF, { tonic: 47, take: 3, augment: 2, colour: 'phrygian', vel: 0.7 }), line([[8, 4, 48, 0.55], [8, 4, 47, 0.5]])),
    part('strings', line([[0, 12, 71, 0.3], [0, 12, 72, 0.26], [0, 12, 78, 0.24]], 'trem')),
    part('pad', line([[0, 12, 47, 0.55], [0, 12, 54, 0.45]])),
    part('timpani', hits('o...o...o', { step: 1, vel: 0.7, note: 47 })),
  ],
};

export const ARNHEM: BattleTrackDef = {
  title: 'Six Minutes at the Bridge',
  theme: 'british',
  bpm: 120,
  beatsPerBar: BAR,
  tonic: 11,
  layerLevel: { build: 1.5, combat: 1, tense: 1.27, prep: 1.5 },
  gain: 0.8,
  humanize: { time: 0.003, velocity: 0.06 },
  seed: 1709,
  instruments: { ...BATTLE_KIT, hand: { ...BATTLE_KIT.hand, tekHz: 640, tekDecay: 0.06 } },
  mix: { ...BATTLE_MIX, hand: { dry: 0.8, send: 0.3 } },
  reverb: { ...BATTLE_REVERB, seconds: 1.9, seed: 917 },
  sections: PLANS.map(section),
  stings: { victory: VICTORY, defeat: DEFEAT },
};
