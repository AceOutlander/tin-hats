/**
 * Mission 1003, the Volokolamsk highway, 16 November 1941: "First Snow on the Highway". The first of the cold Soviet
 * tracks (src/data/musicTracks/sovietKit.ts): E minor at 120 BPM, open fifths and fourths, glassy string harmonics,
 * celesta-like bell figures and a wind bed while the battle is calm; a march snare under low brass in unison, with the
 * Soviet motif "The Long Winter" (src/data/musicThemes.ts) turned upside down in the horns, when the panzers come;
 * a high tremolo, a ticking rim and a heartbeat when the line is about to break. The prep layer is a slow timpani
 * heartbeat under open fifths that climb bar by bar. The quiet section is the wordless choir in the wind. Six sections
 * of eight bars (the quiet one six) in four layers (368 s of distinct music), plus two stings. Written for Tin Hats;
 * it quotes no existing melody, march, call, hymn, folk tune or score.
 */
import type { BattleSection, BattleSting, BattleTrackDef, MusicEvent, MusicPart } from '../musicBattle';
import { bass, chordAt, fit, held, hits, line, onRoots, ostinato, part, prog, swell, tile, type ChordSpan } from '../musicKit';
import { motif, SOVIET_ANSWER, SOVIET_MOTIF, type MotifForm } from '../musicThemes';
import { SOVIET_KIT, SOVIET_MIX, SOVIET_REVERB } from './sovietKit';

const BAR = 4;
const TIMP: readonly [number, number] = [38, 52];

// Chords, low to high (MIDI). E minor kept open: bare fifths, sus chords, the modal B minor and the Phrygian F over E.
const Em5 = [40, 47, 52, 59];
const Em = [40, 47, 55, 59];
const Esus2 = [40, 47, 54, 59];
const C5 = [36, 43, 48, 55];
const Cadd9 = [36, 43, 50, 55];
const Cmaj7 = [36, 43, 52, 59];
const Am = [45, 52, 57, 60];
const Bsus = [47, 52, 54, 59];
const Bm5 = [47, 54, 59, 66];
const D5 = [38, 45, 50, 57];
const G = [43, 50, 55, 59];
const FonE = [40, 48, 53, 57];

type LeadInst = 'horn' | 'strings' | 'brass' | 'bell' | 'choir';

/** Where the motif comes in: instrument, form, and the motif or its answer. */
interface Lead {
  inst: LeadInst;
  form: MotifForm;
  answer?: boolean;
}

interface Plan {
  name: string;
  role: BattleSection['role'];
  chords: ChordSpan[];
  /** The build layer's bell figure: chord tones in eighths two octaves up (-1 rests), repeated over the section. */
  bells: readonly number[];
  /** The combat strings: chord tones in sixteenths an octave up. */
  ostCombat: readonly number[];
  /** Two bars of sixteenths for the march snare (the section's last bar is a roll fill). */
  snare: string;
  /** Two bars of eighths for the combat timpani and for the brass stabs, on the chord roots. */
  timp: string;
  stabs: string;
  /** The wind bed's band (MIDI) and strength while calm. */
  wind: readonly [number, number];
  build: readonly Lead[];
  combat: readonly Lead[];
  tense: readonly Lead[];
  prep: readonly Lead[];
}

function leads(list: readonly Lead[]): MusicPart[] {
  return list.map((l) => part(l.inst, motif(l.answer ? SOVIET_ANSWER : SOVIET_MOTIF, { art: l.inst === 'strings' ? 'long' : undefined, ...l.form })));
}

const beats = (p: Plan): number => p.chords.reduce((n, c) => n + c.beats, 0);

/** A pattern written for two bars, repeated `reps` times. */
function rep(pattern: string, reps: number): string {
  return Array.from({ length: Math.round(reps) }, () => pattern).join('');
}

/** The wind over the whole section, as one long note. */
function windBed(p: Plan, k = 1): MusicEvent[] {
  return line([[0, beats(p), p.wind[0], Math.min(1, p.wind[1] * k)]]);
}

/** Calm: the pad low, glassy harmonics high, the bell figure, a timpani stroke on each phrase, the wind; the motif far off. */
function buildLayer(p: Plan): MusicPart[] {
  return [
    part('pad', held(p.chords, { vel: 0.55, voices: [0, 1, 2] })),
    part('strings', held(p.chords, { vel: 0.17, voices: [2, 3], shift: 24, art: 'long' }), bass(p.chords, 'x.......', { step: 0.5, vel: 0.26 })),
    part('bell', ostinato(p.chords, p.bells, { step: 0.5, vel: 0.4, shift: 24, accents: [0], accent: 1.3 })),
    part('timpani', onRoots(p.chords, rep('o...............|................', beats(p) / (4 * BAR)), { step: 0.5, vel: 0.34, range: TIMP })),
    part('wind', windBed(p)),
    ...leads(p.build),
  ];
}

/** The panzers: a march snare and its closing roll, sixteenth strings in open fifths, low brass in unison, timpani. */
function combatLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  const reps = n / (2 * BAR);
  const snare = tile(hits(p.snare, { vel: 0.7 }), 2 * BAR, reps).filter((e) => e.at < n - BAR);
  const fill = swell(hits('x.x.x.x.xxxxR---', { at: n - BAR, vel: 0.7 }), 0.7, 1.1);
  // Unison brass: the root and its octave, two bars at a time.
  const roots = p.chords.filter((_, i) => i % 2 === 0);
  return [
    part('strings', ostinato(p.chords, p.ostCombat, { step: 0.25, vel: 0.5, shift: 12, accents: [0, 8], accent: 1.35 }), bass(p.chords, 'X.x.X.x.', { step: 0.5, vel: 0.48 })),
    part('snare', snare, fill),
    part('timpani', onRoots(p.chords, rep(p.timp, reps), { step: 0.5, vel: 0.6, range: TIMP })),
    part(
      'brass',
      onRoots(p.chords, rep(p.stabs, reps), { step: 0.5, vel: 0.6, range: [36, 50] }).map((e) => ({ ...e, len: 0.4, art: 'stab' as const })),
      held(roots.map((c) => ({ ...c, beats: 2 * BAR })), { vel: 0.34, voices: [0] }),
    ),
    part('bell', hits(rep('o.......|........', reps), { step: 0.5, vel: 0.3, note: fit(p.chords[0].notes[1], 72, 84) })),
    ...leads(p.combat),
  ];
}

/** The line about to break: a glassy high tremolo, a ticking rim, a heartbeat, a low unison pedal, the motif in pieces. */
function tenseLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  return [
    part('strings', held(p.chords, { vel: 0.26, voices: [1, 2, 3], shift: 24, art: 'trem' }), bass(p.chords, 'x.x.x.x.', { step: 0.5, vel: 0.4 })),
    part('snare', tile(hits('r.g.r.g.r.g.r.g.', { vel: 0.3 }), BAR, n / BAR - 1), swell(hits('R---------------', { at: n - BAR, vel: 0.42 }), 0.3, 1)),
    part('timpani', onRoots(p.chords, rep('o..o............', n / BAR), { step: 0.25, vel: 0.48, range: TIMP })),
    part('brass', held(p.chords.filter((_, i) => i % 2 === 0).map((c) => ({ ...c, beats: 2 * BAR })), { vel: 0.3, voices: [0] })),
    part('wind', windBed(p, 0.7)),
    ...leads(p.tense),
  ];
}

/** Waiting for them: a slow heartbeat on the timpani and open fifths climbing bar by bar over the low pad. */
function prepLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  const fifths: MusicEvent[] = [];
  for (let b = 0; b < n / BAR; b++) {
    const root = fit(chordAt(p.chords, b * BAR).notes[0], 52 + b, 64 + b);
    fifths.push({ at: b * BAR, len: BAR, note: root, vel: 0.2 + 0.02 * b, art: 'trem' }, { at: b * BAR, len: BAR, note: root + 7, vel: 0.18 + 0.02 * b, art: 'trem' });
  }
  const lub = onRoots(p.chords, rep('o...............', n / BAR), { step: 0.25, vel: 0.46, range: TIMP });
  const dub = onRoots(p.chords, rep('...o............', n / BAR), { step: 0.25, vel: 0.3, range: TIMP });
  return [
    part('pad', held(p.chords, { vel: 0.48, voices: [0, 1] })),
    part('strings', fifths),
    part('timpani', lub, dub),
    part('snare', swell(hits('R---------------', { at: n - BAR, vel: 0.36 }), 0.3, 1)),
    part('wind', windBed(p, 0.8)),
    ...leads(p.prep),
  ];
}

/** Snow on the greatcoats: the choir and the wind, harmonics and one bell; the other layers keep its shape, quietly. */
function quietSection(p: Plan): BattleSection {
  const n = beats(p);
  return {
    name: p.name,
    bars: n / BAR,
    role: 'quiet',
    layers: {
      build: [
        part('choir', held(p.chords, { vel: 0.5, voices: [1, 2, 3] })),
        part('strings', held(p.chords, { vel: 0.14, voices: [3], shift: 24, art: 'long' })),
        part('wind', windBed(p, 1.2)),
        part('timpani', onRoots(p.chords, 'o', { step: 1, vel: 0.26, range: TIMP })),
        ...leads(p.build),
      ],
      combat: [
        part('choir', held(p.chords, { vel: 0.5, voices: [1, 2, 3] })),
        part('strings', ostinato(p.chords, p.bells.map((k) => (k < 0 ? -1 : k)), { step: 0.5, vel: 0.3, shift: 12 })),
        part('brass', held(p.chords, { vel: 0.36, voices: [0] })),
        part('timpani', swell(onRoots(p.chords, 'R-------', { at: n - 2 * BAR, step: 1, vel: 0.56, range: TIMP }), 0.6, 1)),
        part('snare', swell(hits('R-------', { at: n - 2 * BAR, step: 1, vel: 0.42 }), 0.5, 1)),
        ...leads(p.combat),
      ],
      tense: [
        part('strings', held(p.chords, { vel: 0.22, voices: [1, 2, 3], shift: 24, art: 'trem' })),
        part('snare', tile(hits('r...', { step: 1, vel: 0.26 }), BAR, n / BAR)),
        part('timpani', tile(onRoots(p.chords, 'o..o', { step: 0.25, vel: 0.38, range: TIMP }), 2 * BAR, n / (2 * BAR))),
        part('wind', windBed(p, 0.8)),
        ...leads(p.tense),
      ],
      prep: [
        part('choir', held(p.chords, { vel: 0.42, voices: [1, 2] })),
        part('timpani', onRoots(p.chords, rep('o.......|........', n / (2 * BAR)), { step: 0.5, vel: 0.36, range: TIMP })),
        part('wind', windBed(p)),
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

const PLANS: Plan[] = [
  {
    name: 'Hedgehogs on the highway',
    role: 'intro',
    chords: prog(BAR, [[1, Em5], [1, Em5], [1, C5], [1, C5], [1, Am], [1, Am], [1, Bsus], [1, Bm5]]),
    bells: [3, -1, 2, -1, -1, 3, -1, -1],
    ostCombat: [0, 1, 2, 1, 0, 1, 2, 3, 0, 1, 2, 1, 0, 2, 1, 2],
    snare: 'X..x.x..X.x.x...|X..x.x..X.x.f.x.',
    timp: 'o.....o.|o...o...',
    stabs: 'x.......|....x...',
    wind: [81, 0.45],
    build: [{ inst: 'horn', form: { tonic: 64, at: 16, vel: 0.38 } }],
    combat: [
      { inst: 'horn', form: { tonic: 64, at: 0, invert: true, vel: 0.55 } },
      { inst: 'brass', form: { tonic: 40, at: 16, vel: 0.78 } },
      { inst: 'brass', form: { tonic: 40, at: 28, vel: 0.75 }, answer: true },
    ],
    tense: [{ inst: 'strings', form: { tonic: 76, at: 8, take: 4, vel: 0.3 } }],
    prep: [{ inst: 'horn', form: { tonic: 64, at: 16, take: 4, augment: 2, vel: 0.32 } }],
  },
  {
    name: 'The first snow',
    role: 'main',
    chords: prog(BAR, [[1, Em], [1, Cmaj7], [1, Am], [1, Em], [1, Em], [1, Cmaj7], [1, D5], [1, Bsus]]),
    bells: [3, 2, -1, 3, -1, -1, 1, -1],
    ostCombat: [0, 2, 1, 2, 0, 3, 1, 3, 0, 2, 1, 2, 3, 2, 1, 0],
    snare: 'X.x.x.xxX.x.x.x.|X.x.x.xxF...x.x.',
    timp: 'o.o.o...|o.o.o.oo',
    stabs: 'x...x...|x.x.....',
    wind: [84, 0.38],
    build: [
      { inst: 'bell', form: { tonic: 76, at: 0, vel: 0.42 } },
      { inst: 'bell', form: { tonic: 76, at: 12, vel: 0.36 }, answer: true },
    ],
    combat: [
      { inst: 'horn', form: { tonic: 64, at: 16, invert: true, vel: 0.55 } },
      { inst: 'horn', form: { tonic: 64, at: 28, invert: true, vel: 0.52 }, answer: true },
    ],
    tense: [{ inst: 'horn', form: { tonic: 64, at: 0, take: 4, colour: PH, vel: 0.42 } }],
    prep: [{ inst: 'bell', form: { tonic: 76, at: 16, take: 4, vel: 0.34 } }],
  },
  {
    name: 'Twenty-eight in the trench',
    role: 'main',
    chords: prog(BAR, [[1, Em5], [1, D5], [1, C5], [1, Bm5], [1, Em5], [1, D5], [1, Cadd9], [1, Bsus]]),
    bells: [-1, 3, -1, 2, -1, 3, -1, 1],
    ostCombat: [0, 1, 0, 2, 0, 1, 0, 3, 0, 1, 0, 2, 3, 2, 1, 2],
    snare: 'F..x..x.X..x..x.|F..x..x.X.x.x.xx',
    timp: 'o..o..o.|o..o.o.o',
    stabs: 'x..x....|x..x..x.',
    wind: [79, 0.4],
    build: [{ inst: 'strings', form: { tonic: 76, at: 16, vel: 0.24 } }],
    combat: [
      { inst: 'brass', form: { tonic: 40, at: 0, vel: 0.8 } },
      { inst: 'horn', form: { tonic: 64, at: 16, invert: true, colour: 'harmonic', vel: 0.55 } },
    ],
    tense: [{ inst: 'horn', form: { tonic: 64, at: 16, invert: true, take: 5, vel: 0.42 } }],
    prep: [{ inst: 'horn', form: { tonic: 64, at: 0, take: 4, vel: 0.3 } }],
  },
  {
    name: 'Panzers in the white',
    role: 'main',
    chords: prog(BAR, [[1, FonE], [1, Em5], [1, FonE], [1, Em5], [1, Am], [1, G], [1, FonE], [1, Bm5]]),
    bells: [0, -1, -1, 3, -1, -1, 2, -1],
    ostCombat: [0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 2, 1, 0],
    snare: 'X...X...X...X.x.|X...X...X..xX.x.',
    timp: 'o.o.o.o.|o.o.o.oo',
    stabs: 'x.x.....|x.x.....',
    wind: [76, 0.42],
    build: [
      { inst: 'horn', form: { tonic: 64, at: 4, take: 4, colour: PH, vel: 0.38 } },
      { inst: 'horn', form: { tonic: 64, at: 20, take: 4, colour: PH, step: -1, vel: 0.36 } },
    ],
    combat: [
      { inst: 'brass', form: { tonic: 40, at: 0, augment: 2, take: 6, colour: PH, vel: 0.82 } },
      { inst: 'horn', form: { tonic: 64, at: 16, invert: true, colour: PH, vel: 0.55 } },
    ],
    tense: [{ inst: 'strings', form: { tonic: 76, at: 0, invert: true, augment: 2, take: 5, vel: 0.28 } }],
    prep: [{ inst: 'horn', form: { tonic: 64, at: 8, take: 4, colour: PH, augment: 2, vel: 0.3 } }],
  },
  {
    name: 'Snow on the greatcoats',
    role: 'quiet',
    // Six bars, not eight: a shorter breath (and a megabyte less to hold).
    chords: prog(BAR, [[1, Esus2], [1, Esus2], [1, Cmaj7], [1, Am], [1, Bsus], [1, Bsus]]),
    bells: [3, -1, -1, -1, 2, -1, -1, -1],
    ostCombat: [],
    snare: '',
    timp: '',
    stabs: '',
    wind: [86, 0.42],
    build: [{ inst: 'horn', form: { tonic: 64, at: 4, augment: 2, take: 6, vel: 0.36 } }],
    combat: [{ inst: 'brass', form: { tonic: 40, at: 8, augment: 2, take: 5, vel: 0.6 } }],
    tense: [{ inst: 'horn', form: { tonic: 64, at: 8, invert: true, augment: 2, take: 4, vel: 0.34 } }],
    prep: [{ inst: 'bell', form: { tonic: 88, at: 0, augment: 2, take: 6, vel: 0.3 } }],
  },
  {
    name: 'The road to Moscow',
    role: 'main',
    chords: prog(BAR, [[1, C5], [1, G], [1, D5], [1, Em], [1, C5], [1, G], [1, Bsus], [1, Bm5]]),
    bells: [1, 3, -1, 2, 3, -1, 1, -1],
    ostCombat: [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 4, 3, 2, 1],
    snare: 'X.xxX.x.X.xxX.x.|X.xxX.x.X.x.F...',
    timp: 'o...o.o.|o...o.oo',
    stabs: 'x...x...|x...xxx.',
    wind: [83, 0.34],
    build: [
      { inst: 'choir', form: { tonic: 52, at: 0, vel: 0.5 } },
      { inst: 'bell', form: { tonic: 88, at: 16, take: 6, vel: 0.32 } },
    ],
    combat: [
      { inst: 'brass', form: { tonic: 40, at: 0, vel: 0.85 } },
      { inst: 'brass', form: { tonic: 40, at: 12, vel: 0.8 }, answer: true },
      { inst: 'horn', form: { tonic: 64, at: 16, invert: true, vel: 0.58 } },
    ],
    tense: [{ inst: 'horn', form: { tonic: 64, at: 16, take: 6, colour: 'harmonic', vel: 0.44 } }],
    prep: [{ inst: 'choir', form: { tonic: 52, at: 16, take: 4, vel: 0.4 } }],
  },
];

/** Victory: the answer in E major on unison brass and bells over a timpani roll, then a held open fifth in the wind. */
const VICTORY: BattleSting = {
  beats: 12,
  parts: [
    part('brass', motif(SOVIET_ANSWER, { tonic: 40, colour: 'major', vel: 0.82 }), motif(SOVIET_ANSWER, { tonic: 52, colour: 'major', vel: 0.7 }), line([[4, 8, 40, 0.75], [4, 8, 47, 0.65]])),
    part('bell', motif(SOVIET_ANSWER, { tonic: 76, colour: 'major', vel: 0.5 }), hits('o...o...', { at: 4, step: 1, vel: 0.4, note: 83 })),
    part('choir', line([[4, 8, 52, 0.5], [4, 8, 56, 0.45], [4, 8, 59, 0.45]])),
    part('strings', line([[4, 8, 76, 0.3], [4, 8, 83, 0.28]], 'trem')),
    part('timpani', swell(hits('R---', { step: 1, vel: 0.56, note: 40 }), 0.5, 1), hits('o', { at: 4, vel: 0.85, note: 40 })),
    part('snare', swell(hits('R---', { step: 1, vel: 0.46 }), 0.4, 1), hits('F', { at: 4, vel: 0.75 })),
    part('wind', line([[2, 10, 84, 0.45]])),
  ],
};

/** Defeat: the motif's opening sinking in the Phrygian colour on low brass, onto a bare fifth that fades into the wind. */
const DEFEAT: BattleSting = {
  beats: 12,
  parts: [
    part('brass', motif(SOVIET_MOTIF, { tonic: 40, take: 4, augment: 1.5, colour: PH, vel: 0.68 }), line([[6, 6, 40, 0.5], [6, 6, 47, 0.42]])),
    part('strings', line([[0, 12, 71, 0.22], [0, 12, 76, 0.2]], 'trem')),
    part('pad', line([[0, 12, 40, 0.5], [0, 12, 47, 0.42]])),
    part('timpani', hits('o.....o', { step: 1, vel: 0.62, note: 40 })),
    part('wind', line([[0, 12, 79, 0.55]])),
  ],
};

export const VOLOKOLAMSK: BattleTrackDef = {
  title: 'First Snow on the Highway',
  theme: 'sovietWinter',
  bpm: 120,
  beatsPerBar: BAR,
  tonic: 4,
  layerLevel: { build: 1.5, combat: 1, tense: 1.27, prep: 1.45 },
  gain: 0.8,
  humanize: { time: 0.006, velocity: 0.08 },
  seed: 411116,
  instruments: SOVIET_KIT,
  mix: SOVIET_MIX,
  reverb: { ...SOVIET_REVERB, seed: 411116 },
  sections: PLANS.map(section),
  stings: { victory: VICTORY, defeat: DEFEAT },
};
