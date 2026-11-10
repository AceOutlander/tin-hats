/**
 * Mission 1004, the Moscow counter-offensive at Klin, December 1941: "Forty Below". The coldest and brightest of the
 * cold tracks (src/data/musicTracks/sovietKit.ts): F# minor at 126 BPM, rising to A major in its last section. Its
 * groove is a gallop (an eighth and two sixteenths, over and over) on sleigh-like high bells, short and bright, over a
 * pad of open fifths; in the fight the snare and timpani take the gallop up as a march that swells toward triumph
 * through each section, and the low brass carry the Soviet motif "The Long Winter" (src/data/musicThemes.ts) in its
 * rising answer form, sequenced higher and higher. In the blizzard (tense) the bells freeze into single high strokes
 * over a glassy tremolo; the prep layer is the forming-up in the forest, a pad of fifths, one bell a bar and the
 * timpani breathing. The quiet section is the birches at night: choir, wind and the motif on the bells. "Klin" is the
 * same groove in A major, with the motif in the major colour. Six sections (the quiet one six bars) in four layers,
 * plus two stings. Written for Tin Hats; it quotes no existing melody, march, call, hymn, folk tune or score.
 */
import type { BattleSection, BattleSting, BattleTrackDef, MusicEvent, MusicPart } from '../musicBattle';
import { held, hits, line, onRoots, ostinato, part, prog, swell, tile, type ChordSpan } from '../musicKit';
import { motif, SOVIET_ANSWER, SOVIET_MOTIF } from '../musicThemes';
import { SOVIET_KIT, SOVIET_MIX, SOVIET_REVERB } from './sovietKit';
import { leads, rep, spanBeats, windBand, type Lead } from './sovietParts';

const BAR = 4;
const TIMP: readonly [number, number] = [40, 52];

// Chords, low to high (MIDI). F# minor: open fifths, the major D and A and E of the key, the Phrygian G over F#;
// A major for the last section.
const Fsm5 = [42, 49, 54, 61];
const Fsm = [42, 49, 54, 57];
const D = [38, 45, 50, 54];
const Dmaj7 = [38, 45, 49, 54];
const A = [45, 52, 57, 61];
const A5 = [45, 52, 57, 64];
const E = [40, 47, 52, 56];
const E5 = [40, 47, 52, 59];
const Esus = [40, 45, 47, 52];
const Bm = [47, 54, 59, 62];
const Cs5 = [37, 44, 49, 56];
const Cssus = [37, 42, 44, 49];
const GonFs = [42, 50, 55, 59];

interface Plan {
  name: string;
  role: BattleSection['role'];
  chords: ChordSpan[];
  /** The sleigh bells: chord-tone indices (see ostinato; 2 octaves up) in sixteenths, one bar, -1 rests. */
  sleigh: readonly number[];
  /** The combat bells, denser. */
  jingle: readonly number[];
  /** Two bars of sixteenths: the galloping march snare. Two bars of eighths: the timpani. */
  snare: string;
  timp: string;
  build: readonly Lead[];
  combat: readonly Lead[];
  tense: readonly Lead[];
  prep: readonly Lead[];
}

const beats = (p: Plan): number => spanBeats(p.chords);

function bells(p: Plan, pattern: readonly number[], vel: number): MusicEvent[] {
  return ostinato(p.chords, pattern, { step: 0.25, vel, shift: 24, accents: [0, 8], accent: 1.3, len: 0.5 });
}

/** The pad of open fifths: root and fifth low, the fifth again an octave up. */
function fifthsPad(p: Plan, vel: number): MusicEvent[] {
  return held(p.chords, { vel, voices: [0, 1] });
}

/** Calm: sleigh bells over the pad of fifths and a high harmonic, a timpani on each phrase, the snow wind. */
function buildLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  return [
    part('pad', fifthsPad(p, 0.52)),
    part('strings', held(p.chords, { vel: 0.14, voices: [1, 3], shift: 24, art: 'long' })),
    part('bell', bells(p, p.sleigh, 0.3)),
    part('timpani', onRoots(p.chords, rep('o...............|................', n / (4 * BAR)), { step: 0.5, vel: 0.32, range: TIMP })),
    part('wind', windBand(n, 86, 0.32)),
    ...leads(p.build),
  ];
}

/** The march to Klin: the galloping snare swelling through the section, timpani, the bells, the rising brass answer. */
function combatLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  const reps = n / (2 * BAR);
  const snare = swell(tile(hits(p.snare, { vel: 0.66 }), 2 * BAR, reps).filter((e) => e.at < n - BAR), 0.7, 1.05);
  const fill = swell(hits('X.xxX.xxX.xxRRRR', { at: n - BAR, vel: 0.72 }), 0.85, 1.15);
  return [
    part('snare', snare, fill),
    part('timpani', swell(onRoots(p.chords, rep(p.timp, reps), { step: 0.5, vel: 0.62, range: TIMP }), 0.75, 1.1)),
    part('bell', bells(p, p.jingle, 0.34)),
    part('pad', fifthsPad(p, 0.44)),
    part('strings', ostinato(p.chords, [0, -1, 1, 1, 0, -1, 1, 1, 2, -1, 1, 1, 0, -1, 1, 1], { step: 0.25, vel: 0.44, shift: 12, accents: [0, 8], accent: 1.3 })),
    ...leads(p.combat),
  ];
}

/** The blizzard: the bells frozen into single strokes, a glassy high tremolo, a rim, a heartbeat, a low pedal. */
function tenseLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  return [
    part('strings', held(p.chords, { vel: 0.24, voices: [1, 2, 3], shift: 24, art: 'trem' })),
    part('bell', ostinato(p.chords, [6, -1, -1, -1, -1, -1, -1, -1, -1, -1, 5, -1, -1, -1, -1, -1], { step: 0.25, vel: 0.3, shift: 24, len: 0.5 })),
    part('snare', tile(hits('r...r.r.r...r.r.', { vel: 0.28 }), BAR, n / BAR - 1), swell(hits('R---------------', { at: n - BAR, vel: 0.42 }), 0.3, 1)),
    part('timpani', onRoots(p.chords, rep('o..o............', n / BAR), { step: 0.25, vel: 0.48, range: TIMP })),
    part('brass', held(p.chords.filter((_, i) => i % 2 === 0).map((c) => ({ ...c, beats: 2 * BAR })), { vel: 0.3, voices: [0] })),
    part('wind', windBand(n, 88, 0.36)),
    ...leads(p.tense),
  ];
}

/** Forming up in the forest: the pad of fifths, one bell a bar, the timpani breathing in and out, the wind. */
function prepLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  // A two-beat roll every two bars: the timpani breathing.
  const breaths = onRoots(p.chords, rep('R---............', n / (2 * BAR)), { step: 0.5, vel: 0.3, range: TIMP });
  return [
    part('pad', fifthsPad(p, 0.48)),
    part('strings', held(p.chords, { vel: 0.12, voices: [3], shift: 24, art: 'long' })),
    part('bell', ostinato(p.chords, [5, ...Array<number>(15).fill(-1)], { step: 0.25, vel: 0.3, shift: 24, len: 0.5 })),
    part('timpani', breaths),
    part('wind', windBand(n, 84, 0.3)),
    ...leads(p.prep),
  ];
}

/** The birches at night: choir and wind, high harmonics, the motif on the bells; the other layers keep its shape. */
function quietSection(p: Plan): BattleSection {
  const n = beats(p);
  return {
    name: p.name,
    bars: n / BAR,
    role: 'quiet',
    layers: {
      build: [
        part('choir', held(p.chords, { vel: 0.5, voices: [1, 2, 3] })),
        part('strings', held(p.chords, { vel: 0.13, voices: [3], shift: 24, art: 'long' })),
        part('wind', windBand(n, 86, 0.42)),
        part('timpani', onRoots(p.chords, 'o', { step: 1, vel: 0.24, range: TIMP })),
        ...leads(p.build),
      ],
      combat: [
        part('choir', held(p.chords, { vel: 0.48, voices: [1, 2, 3] })),
        part('bell', bells(p, p.sleigh, 0.26)),
        part('brass', held(p.chords, { vel: 0.34, voices: [0] })),
        part('timpani', swell(onRoots(p.chords, 'R-------', { at: n - 2 * BAR, step: 1, vel: 0.56, range: TIMP }), 0.6, 1)),
        part('snare', swell(hits('R-------', { at: n - 2 * BAR, step: 1, vel: 0.42 }), 0.5, 1)),
        ...leads(p.combat),
      ],
      tense: [
        part('strings', held(p.chords, { vel: 0.2, voices: [1, 2, 3], shift: 24, art: 'trem' })),
        part('snare', tile(hits('r...', { step: 1, vel: 0.24 }), BAR, n / BAR)),
        part('timpani', tile(onRoots(p.chords, 'o..o', { step: 0.25, vel: 0.36, range: TIMP }), 2 * BAR, n / (2 * BAR))),
        part('wind', windBand(n, 88, 0.34)),
        ...leads(p.tense),
      ],
      prep: [
        part('choir', held(p.chords, { vel: 0.42, voices: [1, 2] })),
        part('bell', ostinato(p.chords, [5, ...Array<number>(31).fill(-1)], { step: 0.25, vel: 0.26, shift: 24, len: 0.5 })),
        part('wind', windBand(n, 84, 0.36)),
        ...leads(p.prep),
      ],
    },
  };
}

function section(p: Plan): BattleSection {
  if (p.role === 'quiet') return quietSection(p);
  return { name: p.name, bars: beats(p) / BAR, role: p.role, layers: { build: buildLayer(p), combat: combatLayer(p), tense: tenseLayer(p), prep: prepLayer(p) } };
}

const PH = 'phrygian' as const;
const MAJ = 'major' as const;

/** The rising answer in the low brass, four times a section, each a step higher: 0, 2, 4, then home. */
function risingAnswer(tonic: number, vel: number, colour?: typeof MAJ): Lead[] {
  return [0, 2, 4].map((step, i) => ({ inst: 'brass' as const, form: { tonic, at: 16 + 4 * i, step, colour, vel: vel + 0.03 * i }, answer: true }));
}

const PLANS: Plan[] = [
  {
    name: 'Forty below',
    role: 'intro',
    chords: prog(BAR, [[1, Fsm5], [1, Fsm5], [1, D], [1, D], [1, Bm], [1, Bm], [1, Cssus], [1, Cs5]]),
    sleigh: [6, -1, 6, 5, -1, -1, -1, -1, 6, -1, 6, 5, -1, -1, -1, -1],
    jingle: [6, -1, 6, 5, 6, -1, 6, 5, 3, -1, 3, 5, 6, -1, 6, 5],
    snare: 'X.xxX.xxX.xxX...|X.xxX.xxX.xxX.x.',
    timp: 'o...o...|o...o.o.',
    build: [{ inst: 'bell', form: { tonic: 78, at: 16, take: 6, vel: 0.36 } }],
    combat: [
      { inst: 'brass', form: { tonic: 42, at: 0, vel: 0.8 } },
      { inst: 'brass', form: { tonic: 42, at: 12, vel: 0.76 }, answer: true },
      ...risingAnswer(54, 0.6).slice(1),
    ],
    tense: [{ inst: 'strings', form: { tonic: 78, at: 8, take: 4, vel: 0.28 } }],
    prep: [{ inst: 'brass', form: { tonic: 42, at: 16, vel: 0.42 }, answer: true }],
  },
  {
    name: 'Ski troops in the birches',
    role: 'main',
    chords: prog(BAR, [[1, Fsm], [1, D], [1, A], [1, E], [1, Fsm], [1, D], [1, Bm], [1, Cssus]]),
    sleigh: [5, -1, 5, 6, -1, -1, 3, -1, 5, -1, 5, 6, -1, -1, -1, -1],
    jingle: [5, -1, 5, 6, 5, -1, 5, 6, 5, -1, 5, 6, 3, -1, 3, 2],
    snare: 'X.xxX.xxX.xxX.xx|X.xxX.xxX.x.X.x.',
    timp: 'o.o.o.o.|o.o.o.oo',
    build: [
      { inst: 'horn', form: { tonic: 66, at: 0, vel: 0.38 } },
      { inst: 'horn', form: { tonic: 66, at: 12, vel: 0.36 }, answer: true },
    ],
    combat: [{ inst: 'horn', form: { tonic: 66, at: 0, invert: true, vel: 0.52 } }, { inst: 'brass', form: { tonic: 42, at: 12, vel: 0.76 }, answer: true }, ...risingAnswer(42, 0.8)],
    tense: [{ inst: 'horn', form: { tonic: 66, at: 16, take: 4, colour: PH, vel: 0.42 } }],
    prep: [{ inst: 'brass', form: { tonic: 42, at: 4, vel: 0.4, step: 2 }, answer: true }],
  },
  {
    name: 'The flare',
    role: 'main',
    chords: prog(BAR, [[1, Fsm5], [1, GonFs], [1, Fsm5], [1, GonFs], [1, Bm], [1, A], [1, GonFs], [1, Cs5]]),
    sleigh: [6, -1, -1, -1, 5, -1, -1, -1, 6, -1, 5, -1, -1, -1, -1, -1],
    jingle: [6, -1, 6, 6, 5, -1, 5, 5, 6, -1, 6, 6, 3, -1, 3, 3],
    snare: 'X...X.xxX...X.xx|X...X.xxX.xxX.xx',
    timp: 'o.o.o.o.|o.o.oooo',
    build: [
      { inst: 'horn', form: { tonic: 66, at: 4, take: 4, colour: PH, vel: 0.36 } },
      { inst: 'horn', form: { tonic: 66, at: 20, take: 4, colour: PH, step: -1, vel: 0.34 } },
    ],
    combat: [
      { inst: 'brass', form: { tonic: 42, at: 0, augment: 2, take: 6, colour: PH, vel: 0.82 } },
      { inst: 'horn', form: { tonic: 66, at: 16, invert: true, colour: PH, vel: 0.52 } },
    ],
    tense: [{ inst: 'strings', form: { tonic: 78, at: 0, invert: true, augment: 2, take: 5, vel: 0.26 } }],
    prep: [{ inst: 'bell', form: { tonic: 78, at: 8, take: 4, augment: 2, colour: PH, vel: 0.3 } }],
  },
  {
    name: 'Cut the highway',
    role: 'main',
    chords: prog(BAR, [[1, D], [1, E], [1, Fsm], [1, Fsm], [1, D], [1, E5], [1, Cssus], [1, Cs5]]),
    sleigh: [3, -1, 3, 5, -1, -1, 5, -1, 6, -1, 6, 5, -1, -1, 3, -1],
    jingle: [3, -1, 3, 5, 6, -1, 6, 5, 3, -1, 3, 5, 6, -1, 5, 6],
    snare: 'X.xxX.xxX.xxX.xx|X.xxX.xxXxxxX.xx',
    timp: 'o...o.o.|o...o.oo',
    build: [{ inst: 'strings', form: { tonic: 78, at: 0, vel: 0.22 } }, { inst: 'bell', form: { tonic: 78, at: 16, take: 6, step: 2, vel: 0.32 } }],
    combat: [
      { inst: 'brass', form: { tonic: 42, at: 0, vel: 0.84 } },
      { inst: 'brass', form: { tonic: 42, at: 12, vel: 0.8 }, answer: true },
      ...risingAnswer(42, 0.82),
      { inst: 'horn', form: { tonic: 66, at: 16, take: 6, step: 2, vel: 0.56 } },
    ],
    tense: [{ inst: 'horn', form: { tonic: 66, at: 16, invert: true, take: 5, vel: 0.42 } }],
    prep: [{ inst: 'brass', form: { tonic: 42, at: 0, take: 4, augment: 2, vel: 0.4 } }],
  },
  {
    name: 'Birches at night',
    role: 'quiet',
    chords: prog(BAR, [[1, Fsm5], [1, Fsm5], [1, Dmaj7], [1, Dmaj7], [1, Cssus], [1, Cssus]]),
    sleigh: [6, -1, -1, -1, -1, -1, -1, -1, 5, -1, -1, -1, -1, -1, -1, -1],
    jingle: [],
    snare: '',
    timp: '',
    build: [{ inst: 'bell', form: { tonic: 78, at: 0, augment: 2, take: 6, vel: 0.32 } }],
    combat: [{ inst: 'brass', form: { tonic: 42, at: 8, augment: 2, take: 5, vel: 0.56 } }],
    tense: [{ inst: 'horn', form: { tonic: 66, at: 8, invert: true, augment: 2, take: 4, vel: 0.32 } }],
    prep: [{ inst: 'choir', form: { tonic: 54, at: 4, augment: 2, take: 5, vel: 0.4 } }],
  },
  {
    name: 'Klin',
    role: 'main',
    // A major: the last section of the brief, the triumph. It ends on E sus, which leads home to A or back to F# minor.
    chords: prog(BAR, [[1, A5], [1, E], [1, Fsm], [1, D], [1, A], [1, E], [1, D], [1, Esus]]),
    sleigh: [5, -1, 5, 6, -1, -1, 5, -1, 6, -1, 6, 5, -1, -1, 6, -1],
    jingle: [5, -1, 5, 6, 5, -1, 5, 6, 6, -1, 6, 5, 6, -1, 6, 5],
    snare: 'X.xxX.xxX.xxX.xx|X.xxX.xxX.xxXxxx',
    timp: 'o.o.o.o.|o.o.o.oo',
    build: [
      { inst: 'choir', form: { tonic: 57, at: 0, colour: MAJ, vel: 0.5 } },
      { inst: 'bell', form: { tonic: 81, at: 16, colour: MAJ, take: 6, vel: 0.34 } },
    ],
    combat: [
      { inst: 'brass', form: { tonic: 45, at: 0, colour: MAJ, vel: 0.86 } },
      { inst: 'horn', form: { tonic: 57, at: 0, colour: MAJ, vel: 0.56 } },
      { inst: 'brass', form: { tonic: 45, at: 12, colour: MAJ, vel: 0.82 }, answer: true },
      ...risingAnswer(45, 0.84, MAJ),
    ],
    tense: [{ inst: 'horn', form: { tonic: 57, at: 16, take: 6, colour: MAJ, vel: 0.44 } }],
    prep: [{ inst: 'choir', form: { tonic: 57, at: 16, take: 4, colour: MAJ, vel: 0.4 } }],
  },
];

/** Victory: the answer in A major on brass and bells, rising twice, over a galloping snare onto a held A chord. */
const VICTORY: BattleSting = {
  beats: 14,
  parts: [
    part('brass', motif(SOVIET_ANSWER, { tonic: 45, colour: MAJ, vel: 0.8 }), motif(SOVIET_ANSWER, { tonic: 45, colour: MAJ, step: 2, at: 4, vel: 0.84 }), line([[8, 6, 45, 0.74], [8, 6, 52, 0.64]])),
    part('bell', motif(SOVIET_ANSWER, { tonic: 81, colour: MAJ, vel: 0.44 }), ostinato(prog(BAR, [[2, A5]]), [5, -1, 5, 6, 5, -1, 5, 6], { from: 4, to: 8, step: 0.25, vel: 0.34, shift: 24, len: 0.5 })),
    part('choir', line([[8, 6, 57, 0.5], [8, 6, 61, 0.44], [8, 6, 64, 0.44]])),
    part('strings', line([[8, 6, 81, 0.28], [8, 6, 88, 0.26]], 'trem')),
    part('snare', hits('X.xxX.xxX.xxX.xxX.xxX.xxX.xxRRRR', { vel: 0.62 }), hits('F', { at: 8, vel: 0.78 })),
    part('timpani', hits('o...o...o...o...o...o...R-------', { vel: 0.6, note: 45 }), hits('o', { at: 8, vel: 0.85, note: 45 })),
  ],
};

/** Defeat: the motif's head in the Phrygian colour on low brass, the bells frozen, a bare fifth in the blizzard. */
const DEFEAT: BattleSting = {
  beats: 12,
  parts: [
    part('brass', motif(SOVIET_MOTIF, { tonic: 42, take: 4, augment: 1.5, colour: PH, vel: 0.66 }), line([[6, 6, 42, 0.5], [6, 6, 49, 0.42]])),
    part('bell', hits('o.....o.....', { step: 0.5, vel: 0.28, note: 90 }), hits('o', { at: 6, vel: 0.24, note: 85 })),
    part('pad', line([[0, 12, 42, 0.48], [0, 12, 49, 0.4]])),
    part('strings', line([[0, 12, 78, 0.2], [0, 12, 85, 0.18]], 'trem')),
    part('timpani', hits('o.....o', { step: 1, vel: 0.58, note: 42 })),
    part('wind', line([[0, 12, 88, 0.55]])),
  ],
};

export const KLIN: BattleTrackDef = {
  title: 'Forty Below',
  theme: 'sovietWinter',
  bpm: 126,
  beatsPerBar: BAR,
  tonic: 6,
  layerLevel: { build: 1.5, combat: 1, tense: 1.27, prep: 1.45 },
  gain: 0.8,
  humanize: { time: 0.005, velocity: 0.08 },
  seed: 411215,
  instruments: {
    ...SOVIET_KIT,
    // Sleigh-like: the same celesta partials with short rings and a harder strike.
    bell: {
      partials: [
        [1, 1, 0.55],
        [2, 0.32, 0.32],
        [3, 0.14, 0.2],
        [4.1, 0.08, 0.12],
      ],
      strike: 0.2,
      level: 0.19,
      range: [60, 96],
    },
  },
  mix: { ...SOVIET_MIX, bell: { dry: 0.65, send: 0.3 } },
  // The brightest room of the cold tracks.
  reverb: { ...SOVIET_REVERB, seconds: 2.6, brightHz: 6000, seed: 411215 },
  sections: PLANS.map(section),
  stings: { victory: VICTORY, defeat: DEFEAT },
};
