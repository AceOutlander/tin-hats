/**
 * Mission 1, Arras 1940: "Fields at Arras". Urgent and uncertain: a running string ostinato, the snare pressing on,
 * harmony that will not settle (E minor leaning on F major, the flattened second, and on the open B major), and the
 * British motif "The Line" (src/data/musicThemes.ts) in low brass, a far horn and the strings. 138 BPM, 4/4, eight
 * sections of eight bars (111 s per layer, 334 s of distinct music in three layers), plus two stings. Written for
 * Tin Hats; it quotes no existing melody, march, call or score.
 *
 * This file is the template for the other mission tracks: a few recipe functions turn each section's plan (its
 * chords, patterns and where the motif comes in) into the build, combat and tense layers. See docs/MUSIC.md.
 */
import type { BattleSection, BattleSting, BattleTrackDef, MusicPart } from '../musicBattle';
import { bass, held, hits, line, onRoots, ostinato, part, prog, swell, tile, type ChordSpan } from '../musicKit';
import { BRITISH_ANSWER, BRITISH_MOTIF, motif, type MotifForm } from '../musicThemes';
import { BATTLE_KIT, BATTLE_MIX, BATTLE_REVERB } from './kit';

const BAR = 4;
const TIMP: readonly [number, number] = [38, 52];

// Chords, low to high (MIDI). E minor, with the borrowed F major (the flattened second) and the B major dominant.
const Em = [40, 52, 55, 59];
const Em9 = [40, 54, 55, 59];
const C = [36, 48, 52, 55];
const Cmaj7 = [36, 48, 52, 59];
const Am = [45, 52, 57, 60];
const B = [47, 51, 54, 59];
const Bsus = [47, 52, 54, 59];
const D = [38, 50, 54, 57];
const G = [43, 50, 55, 59];
const F = [41, 48, 53, 57];
const FonE = [40, 48, 53, 57];
const DmOnE = [40, 50, 53, 57];
const E = [40, 52, 56, 59];

/** Where the motif comes in, per layer: the instrument and the form. */
interface Lead {
  inst: 'horn' | 'strings' | 'brass';
  form: MotifForm;
  answer?: boolean;
}

interface Plan {
  name: string;
  role: BattleSection['role'];
  chords: ChordSpan[];
  /** String ostinato: chord tones in eighths (build) and sixteenths (combat). */
  ostBuild: readonly number[];
  ostCombat: readonly number[];
  /** Two bars of sixteenths, played four times; the last bar of the section gets a roll fill. */
  snare: string;
  /** Two bars of sixteenths for the build layer's light snare, or none. */
  snareBuild?: string;
  /** Two bars of eighths for the combat timpani, on the chord roots. */
  timp: string;
  /** Two bars of eighths for the combat brass stabs on the chord roots. */
  stabs: string;
  build: readonly Lead[];
  combat: readonly Lead[];
  tense: readonly Lead[];
}

function leads(list: readonly Lead[]): MusicPart[] {
  return list.map((l) => part(l.inst, motif(l.answer ? BRITISH_ANSWER : BRITISH_MOTIF, { art: l.inst === 'strings' ? 'long' : undefined, ...l.form })));
}

const beats = (p: Plan): number => p.chords.reduce((n, c) => n + c.beats, 0);

/** The calm layer: soft eighth-note strings, the pad, a low pulse, the timpani on the phrase starts, the motif far off. */
function buildLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  const out: MusicPart[] = [
    part('strings', ostinato(p.chords, p.ostBuild, { step: 0.5, vel: 0.34, accents: [0], accent: 1.3 }), bass(p.chords, 'x...x...', { step: 0.5, vel: 0.3 })),
    part('pad', held(p.chords, { vel: 0.6, voices: [0, 1, 2] })),
    part('timpani', onRoots(p.chords, 'o.......|........', { step: 0.5, vel: 0.36, range: TIMP })),
    ...leads(p.build),
  ];
  if (p.snareBuild) out.push(part('snare', tile(hits(p.snareBuild, { vel: 0.3 }), 2 * BAR, n / (2 * BAR))));
  return out;
}

/** Heavy fighting: sixteenth-note strings, the march snare with flams and a closing roll, timpani, low brass. */
function combatLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  const reps = n / (2 * BAR);
  const snare = tile(hits(p.snare, { vel: 0.72 }), 2 * BAR, reps).filter((e) => e.at < n - BAR);
  const fill = swell(hits('x.x.x.xxR-------', { at: n - BAR, vel: 0.72 }), 0.7, 1.1);
  return [
    part('strings', ostinato(p.chords, p.ostCombat, { step: 0.25, vel: 0.55, shift: 12, accents: [0, 6, 12], accent: 1.35 }), bass(p.chords, 'X.x.x.x.', { step: 0.5, vel: 0.5 })),
    part('pad', held(p.chords, { vel: 0.5, voices: [1, 2, 3] })),
    part('snare', snare, fill),
    part('timpani', onRoots(p.chords, tilePattern(p.timp, reps), { step: 0.5, vel: 0.62, range: TIMP })),
    part('brass', onRoots(p.chords, tilePattern(p.stabs, reps), { step: 0.5, vel: 0.62, range: [36, 52] }).map((e) => ({ ...e, len: 0.4, art: 'stab' as const }))),
    ...leads(p.combat),
  ];
}

/** HQ in danger or the clock running out: high tremolo, a ticking rim like a clock, a heartbeat on the timpani, the motif turned upside down. */
function tenseLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  return [
    part('strings', held(p.chords, { vel: 0.3, voices: [1, 2, 3], shift: 12, art: 'trem' }), bass(p.chords, 'x.x.x.x.', { step: 0.5, vel: 0.42 })),
    part('snare', tile(hits('r.g.r.g.r.g.r.g.', { vel: 0.3 }), BAR, n / BAR)),
    part('timpani', onRoots(p.chords, tilePattern('o..o............', n / BAR), { step: 0.25, vel: 0.5, range: TIMP })),
    part('brass', held(p.chords.filter((_, i) => i % 2 === 0), { vel: 0.32, voices: [0] })),
    ...leads(p.tense),
  ];
}

/** The quiet stretch: long notes and space; its combat and tense layers stay muffled. */
function quietSection(p: Plan): BattleSection {
  const n = beats(p);
  return {
    name: p.name,
    bars: n / BAR,
    role: 'quiet',
    layers: {
      build: [part('pad', held(p.chords, { vel: 0.55 })), part('strings', held(p.chords, { vel: 0.22, voices: [0], art: 'long' })), part('timpani', onRoots(p.chords, 'o', { step: 1, vel: 0.3, range: TIMP })), ...leads(p.build)],
      combat: [
        part('pad', held(p.chords, { vel: 0.5 })),
        part('strings', ostinato(p.chords, p.ostBuild, { step: 0.5, vel: 0.3 })),
        part('brass', held(p.chords, { vel: 0.4, voices: [0, 1] })),
        part('timpani', swell(onRoots(p.chords, 'R-------', { at: n - 2 * BAR, step: 1, vel: 0.6, range: TIMP }), 0.6, 1)),
        part('snare', swell(hits('R-------', { at: n - 2 * BAR, step: 1, vel: 0.45 }), 0.5, 1)),
        ...leads(p.combat),
      ],
      tense: [
        part('strings', held(p.chords, { vel: 0.24, voices: [1, 2, 3], shift: 12, art: 'trem' })),
        part('snare', tile(hits('r...', { step: 1, vel: 0.26 }), BAR, n / BAR)),
        part('timpani', tile(onRoots(p.chords, 'o..o', { step: 0.25, vel: 0.4, range: TIMP }), 2 * BAR, n / (2 * BAR))),
        ...leads(p.tense),
      ],
    },
  };
}

/** A pattern written for two bars, repeated `reps` times. */
function tilePattern(pattern: string, reps: number): string {
  return Array.from({ length: Math.round(reps) }, () => pattern).join('');
}

function section(p: Plan): BattleSection {
  if (p.role === 'quiet') return quietSection(p);
  return { name: p.name, bars: beats(p) / BAR, role: p.role, layers: { build: buildLayer(p), combat: combatLayer(p), tense: tenseLayer(p) } };
}

const PLANS: Plan[] = [
  {
    name: 'First light on the Scarpe',
    role: 'intro',
    chords: prog(BAR, [[1, Em], [1, Em], [1, C], [1, C], [1, Am], [1, Am], [1, Bsus], [1, B]]),
    ostBuild: [0, 2, 1, 2, 3, 2, 1, 2],
    ostCombat: [0, 1, 2, 1, 3, 1, 2, 1, 0, 2, 3, 2, 1, 2, 3, 2],
    snare: 'X..x..x.x.r.x...|X..x..x.f...x.x.',
    snareBuild: '................|........g.g.g.g.',
    timp: 'o.....o.|o...o...',
    stabs: 'x.......|....x...',
    build: [{ inst: 'horn', form: { tonic: 64, at: 16, take: 5, vel: 0.4 } }],
    combat: [
      { inst: 'brass', form: { tonic: 40, at: 0, vel: 0.8 } },
      { inst: 'brass', form: { tonic: 40, at: 16, vel: 0.8, colour: 'harmonic' } },
    ],
    tense: [{ inst: 'horn', form: { tonic: 64, at: 8, invert: true, colour: 'phrygian', vel: 0.45 } }],
  },
  {
    name: 'The column on the road',
    role: 'main',
    chords: prog(BAR, [[1, Em], [1, D], [1, C], [1, B], [1, Em], [1, D], [1, C], [1, D]]),
    ostBuild: [0, 1, 2, 3, 2, 1, 2, 1],
    ostCombat: [0, 2, 1, 2, 0, 3, 1, 3, 0, 2, 1, 2, 4, 3, 2, 1],
    snare: 'X.x.x.xxX.x.x.x.|X.x.x.xxX.r.x.r.',
    timp: 'o.o.o...|o.o.o.oo',
    stabs: 'x...x...|x.x.....',
    build: [{ inst: 'strings', form: { tonic: 52, at: 0, vel: 0.3 } }],
    combat: [{ inst: 'brass', form: { tonic: 52, at: 16, displace: 0.5, vel: 0.75 } }],
    tense: [{ inst: 'horn', form: { tonic: 64, at: 0, take: 3, augment: 2, vel: 0.45 } }],
  },
  {
    name: 'Shadows in the orchards',
    role: 'main',
    chords: prog(BAR, [[1, Em], [1, F], [1, Em], [1, F], [1, Am], [1, G], [1, F], [1, B]]),
    ostBuild: [0, 2, 3, 2, 1, 2, 3, 2],
    ostCombat: [0, 1, 0, 2, 0, 3, 0, 2, 0, 1, 0, 2, 3, 2, 1, 0],
    snare: 'x..X..x...x.X...|x..X..x.x..xX...',
    snareBuild: 'r.......r.......|r.......r...r.r.',
    timp: 'o..o..o.|o..o.o.o',
    stabs: '...x....|...x..x.',
    build: [{ inst: 'horn', form: { tonic: 64, at: 0, take: 5, colour: 'phrygian', vel: 0.4 } }],
    combat: [{ inst: 'brass', form: { tonic: 52, at: 8, invert: true, vel: 0.75 } }],
    tense: [{ inst: 'horn', form: { tonic: 64, at: 16, retrograde: true, colour: 'phrygian', vel: 0.45 } }],
  },
  {
    name: 'Counter-attack',
    role: 'main',
    chords: prog(BAR, [[1, Em], [1, C], [1, G], [1, D], [1, Em], [1, C], [1, Am], [1, B]]),
    ostBuild: [0, 3, 2, 3, 1, 3, 2, 3],
    ostCombat: [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 4, 3, 2, 1],
    snare: 'F..x.xx.X.xx.x..|F..x.xx.X.x.x.xx',
    timp: 'o...o.o.|o...o.oo',
    stabs: 'x.......|x.......',
    build: [
      { inst: 'horn', form: { tonic: 52, at: 0, vel: 0.45 } },
      { inst: 'horn', form: { tonic: 52, at: 16, vel: 0.42, colour: 'harmonic' }, answer: true },
    ],
    combat: [
      { inst: 'brass', form: { tonic: 40, at: 0, vel: 0.85 } },
      { inst: 'brass', form: { tonic: 40, at: 16, vel: 0.85, colour: 'harmonic' }, answer: true },
    ],
    tense: [{ inst: 'horn', form: { tonic: 64, at: 0, invert: true, colour: 'harmonic', vel: 0.45 } }],
  },
  {
    name: 'Smoke over the wheat',
    role: 'quiet',
    chords: prog(BAR, [[1, Em9], [1, Cmaj7], [1, Em9], [1, Cmaj7], [1, Am], [1, Am], [1, Bsus], [1, B]]),
    ostBuild: [0, 2, 3, 2, 1, 2, 3, 2],
    ostCombat: [0, 2, 1, 2],
    snare: '',
    timp: '',
    stabs: '',
    build: [{ inst: 'horn', form: { tonic: 64, at: 4, augment: 2, take: 5, vel: 0.38 } }],
    combat: [{ inst: 'brass', form: { tonic: 52, at: 8, augment: 2, take: 5, vel: 0.6 } }],
    tense: [{ inst: 'horn', form: { tonic: 64, at: 8, invert: true, augment: 2, take: 4, vel: 0.36 } }],
  },
  {
    name: 'Open ground',
    role: 'main',
    chords: prog(BAR, [[1, Am], [1, Em], [1, Am], [1, Em], [1, C], [1, D], [1, Bsus], [1, B]]),
    ostBuild: [0, 2, 1, 3, 0, 2, 1, 3],
    ostCombat: [0, 2, 0, 3, 0, 2, 0, 1, 0, 2, 0, 3, 1, 2, 3, 4],
    snare: 'X.xxX.x.X.xxX.x.|X.xxX.x.X.x.F...',
    snareBuild: '....g.......g...|....g.......g.g.',
    timp: 'o.oo....|o.oo..oo',
    stabs: 'x...x...|x...x.x.',
    build: [{ inst: 'strings', form: { tonic: 52, at: 16, take: 5, vel: 0.32 } }],
    combat: [
      { inst: 'brass', form: { tonic: 40, at: 0, step: 3, vel: 0.8 } },
      { inst: 'brass', form: { tonic: 40, at: 16, vel: 0.8 } },
    ],
    tense: [{ inst: 'horn', form: { tonic: 64, at: 8, take: 5, invert: true, step: 3, vel: 0.45 } }],
  },
  {
    name: 'Tanks in the wood',
    role: 'main',
    chords: prog(BAR, [[1, FonE], [1, Em], [1, DmOnE], [1, Em], [1, C], [1, F], [1, B], [1, B]]),
    ostBuild: [0, 0, 2, 0, 0, 0, 3, 0],
    ostCombat: [0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 2, 1, 0],
    snare: 'X...X...X...X.x.|X...X...X..xX.x.',
    timp: 'o.o.o.o.|o.o.o.oo',
    stabs: 'x.x.....|x.x.....',
    build: [
      { inst: 'horn', form: { tonic: 52, at: 4, take: 3, colour: 'phrygian', vel: 0.4 } },
      { inst: 'horn', form: { tonic: 52, at: 20, take: 3, colour: 'phrygian', vel: 0.4 } },
    ],
    combat: [{ inst: 'brass', form: { tonic: 40, at: 0, augment: 2, colour: 'phrygian', vel: 0.85 } }],
    tense: [{ inst: 'horn', form: { tonic: 64, at: 0, invert: true, augment: 2, vel: 0.42 } }],
  },
  {
    name: 'Holding the crossroads',
    role: 'main',
    chords: prog(BAR, [[1, C], [1, G], [1, D], [1, Em], [1, C], [1, G], [1, D], [1, E]]),
    ostBuild: [0, 1, 2, 1, 3, 1, 2, 1],
    ostCombat: [0, 2, 1, 3, 0, 2, 1, 3, 0, 2, 1, 3, 2, 3, 4, 5],
    snare: 'X.x.X.x.X.xxX.x.|X.x.X.x.F.F.x.xx',
    timp: 'o...o...|o.o.o.oo',
    stabs: 'x...x...|x...xxx.',
    build: [
      { inst: 'horn', form: { tonic: 52, at: 0, vel: 0.42 } },
      { inst: 'horn', form: { tonic: 64, at: 24, vel: 0.42, colour: 'major' }, answer: true },
    ],
    combat: [
      { inst: 'brass', form: { tonic: 52, at: 0, vel: 0.78 } },
      { inst: 'brass', form: { tonic: 40, at: 24, vel: 0.85, colour: 'major' }, answer: true },
    ],
    tense: [{ inst: 'horn', form: { tonic: 64, at: 16, take: 5, vel: 0.45 } }],
  },
];

/** Victory: the answer in E major on the brass over a timpani roll, home on a held E major chord. */
const VICTORY: BattleSting = {
  beats: 12,
  parts: [
    part('brass', motif(BRITISH_ANSWER, { tonic: 52, colour: 'major', vel: 0.85 }), line([[8, 4, 40, 0.8], [8, 4, 47, 0.7]])),
    part('pad', line([[0, 12, 40, 0.6], [0, 12, 52, 0.5], [4, 8, 56, 0.5], [4, 8, 59, 0.5]])),
    part('strings', line([[8, 4, 64, 0.5], [8, 4, 68, 0.45], [8, 4, 71, 0.45]], 'trem')),
    part('timpani', swell(hits('R-------', { step: 1, vel: 0.6, note: 40 }), 0.5, 1), hits('o', { at: 8, vel: 0.9, note: 40 })),
    part('snare', swell(hits('R-------', { step: 1, vel: 0.5 }), 0.4, 1), hits('F', { at: 8, vel: 0.8 })),
  ],
};

/** Defeat: the head of the motif sinking in the Phrygian colour, low brass and a last timpani stroke under a fading tremolo. */
const DEFEAT: BattleSting = {
  beats: 12,
  parts: [
    part('brass', motif(BRITISH_MOTIF, { tonic: 40, take: 3, augment: 2, colour: 'phrygian', vel: 0.7 }), line([[8, 4, 41, 0.55], [8, 4, 40, 0.5]])),
    part('strings', line([[0, 12, 64, 0.32], [0, 12, 65, 0.28], [0, 12, 71, 0.26]], 'trem')),
    part('pad', line([[0, 12, 40, 0.55], [0, 12, 47, 0.45]])),
    part('timpani', hits('o...o...o', { step: 1, vel: 0.7, note: 40 })),
  ],
};

export const ARRAS: BattleTrackDef = {
  title: 'Fields at Arras',
  theme: 'british',
  bpm: 138,
  beatsPerBar: BAR,
  tonic: 4,
  layerLevel: { build: 1.5, combat: 1, tense: 1.27, prep: 1.5 },
  gain: 0.8,
  humanize: { time: 0.006, velocity: 0.08 },
  seed: 1940,
  instruments: BATTLE_KIT,
  mix: BATTLE_MIX,
  reverb: BATTLE_REVERB,
  sections: PLANS.map(section),
  stings: { victory: VICTORY, defeat: DEFEAT },
};
