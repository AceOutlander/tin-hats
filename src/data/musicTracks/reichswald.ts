/**
 * Mission 10, the Siegfried Line, Reichswald 1945: "Through the Reichswald". The big final push and the British
 * motif "The Line" (src/data/musicThemes.ts) at its fullest: the whole phrase and its answer stated together,
 * harmonised in thirds by brass and horn with the strings doubling above, in canon a beat apart, climbing in
 * sequence, and at last in the relative major when the line breaks. A driving march snare, galloping strings and
 * timpani in D minor, with the flattened second (E flat) for the dragon's teeth. 144 BPM, 4/4, nine sections of
 * eight bars (120 s per layer, 360 s of distinct music), plus two stings. Written for Tin Hats; it quotes no existing
 * melody, march, call or score. Built on the recipe of musicTracks/arras.ts.
 */
import type { BattleSection, BattleSting, BattleTrackDef, MusicPart } from '../musicBattle';
import { bass, held, hits, line, onRoots, ostinato, part, prog, swell, tile, type ChordSpan } from '../musicKit';
import { BRITISH_ANSWER, BRITISH_MOTIF, motif, type MotifForm } from '../musicThemes';
import { BATTLE_KIT, BATTLE_MIX, BATTLE_REVERB } from './kit';

const BAR = 4;
const TIMP: readonly [number, number] = [38, 52];

// Chords, low to high (MIDI). D minor, its relative F major, the flattened second (E flat), the A major dominant.
const Dm = [38, 50, 53, 57];
const Bb = [46, 50, 53, 58];
const Bbmaj7 = [46, 50, 53, 57];
const F = [41, 48, 53, 57];
const C = [36, 48, 52, 55];
const Gm = [43, 50, 55, 58];
const Gm7 = [43, 50, 53, 58];
const G = [43, 50, 55, 59];
const A = [45, 49, 52, 57];
const Asus = [45, 50, 52, 57];
const Eb = [39, 51, 55, 58];
const Dm9 = [38, 52, 53, 57];

/** Where the motif comes in: the instrument and the form; `answer` plays the phrase that comes home. */
interface Lead {
  inst: 'horn' | 'strings' | 'brass';
  form: MotifForm;
  answer?: boolean;
}

interface Plan {
  name: string;
  role: BattleSection['role'];
  chords: ChordSpan[];
  ostBuild: readonly number[];
  ostCombat: readonly number[];
  /** Two bars of sixteenths for the march snare; the last bar of the section gets a roll fill. */
  snare: string;
  snareBuild?: string;
  /** Two bars of eighths: combat timpani and brass stabs, on the chord roots. */
  timp: string;
  stabs: string;
  build: readonly Lead[];
  combat: readonly Lead[];
  tense: readonly Lead[];
}

function leads(list: readonly Lead[]): MusicPart[] {
  return list.map((l) => part(l.inst, motif(l.answer ? BRITISH_ANSWER : BRITISH_MOTIF, { art: l.inst === 'strings' ? 'long' : undefined, ...l.form })));
}

/**
 * The theme at full strength from beat `at`: the motif then its answer (16 beats), low brass on the tune, the horn a
 * third above, the strings an octave over the brass.
 */
function full(at: number, o: { brass: number; horn: number; strings: number; colour?: MotifForm['colour']; vel?: number }): Lead[] {
  const v = o.vel ?? 0.82;
  const out: Lead[] = [];
  for (const answer of [false, true]) {
    const t = at + (answer ? 8 : 0);
    out.push({ inst: 'brass', form: { tonic: o.brass, at: t, colour: o.colour, vel: v }, answer });
    out.push({ inst: 'horn', form: { tonic: o.horn, at: t, step: 2, colour: o.colour, vel: v * 0.62 }, answer });
    out.push({ inst: 'strings', form: { tonic: o.strings, at: t, colour: o.colour, vel: v * 0.6 }, answer });
  }
  return out;
}

const beats = (p: Plan): number => p.chords.reduce((n, c) => n + c.beats, 0);

function tilePattern(pattern: string, reps: number): string {
  return Array.from({ length: Math.round(reps) }, () => pattern).join('');
}

/** The advance forming up: eighth-note strings, the pad, a light snare, timpani on the phrase starts, the motif on the horn. */
function buildLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  const out: MusicPart[] = [
    part('strings', ostinato(p.chords, p.ostBuild, { step: 0.5, vel: 0.34, accents: [0], accent: 1.3 }), bass(p.chords, 'x...x...', { step: 0.5, vel: 0.3 })),
    part('pad', held(p.chords, { vel: 0.6, voices: [0, 1, 2] })),
    part('timpani', onRoots(p.chords, 'o.......|....o...', { step: 0.5, vel: 0.38, range: TIMP })),
    ...leads(p.build),
  ];
  if (p.snareBuild) out.push(part('snare', tile(hits(p.snareBuild, { vel: 0.32 }), 2 * BAR, n / (2 * BAR))));
  return out;
}

/** The push: galloping strings, the march snare with flams and a closing roll, timpani, brass stabs and the full theme. */
function combatLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  const reps = n / (2 * BAR);
  const snare = tile(hits(p.snare, { vel: 0.72 }), 2 * BAR, reps).filter((e) => e.at < n - BAR);
  const fill = swell(hits('x.xxx.xxx.xxR---', { at: n - BAR, vel: 0.72 }), 0.7, 1.1);
  return [
    part('strings', ostinato(p.chords, p.ostCombat, { step: 0.25, vel: 0.52, shift: 12, accents: [0, 3, 6, 8, 11, 14], accent: 1.35 }), bass(p.chords, 'X.x.x.x.', { step: 0.5, vel: 0.5 })),
    part('pad', held(p.chords, { vel: 0.48, voices: [1, 2, 3] })),
    part('snare', snare, fill),
    part('timpani', onRoots(p.chords, tilePattern(p.timp, reps), { step: 0.5, vel: 0.62, range: TIMP })),
    part('brass', onRoots(p.chords, tilePattern(p.stabs, reps), { step: 0.5, vel: 0.58, range: [36, 50] }).map((e) => ({ ...e, len: 0.4, art: 'stab' as const }))),
    ...leads(p.combat),
  ];
}

/** HQ in danger: high tremolo, the rim ticking, a heartbeat on the timpani, the motif upside down. */
function tenseLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  return [
    part('strings', held(p.chords, { vel: 0.3, voices: [1, 2, 3], shift: 12, art: 'trem' }), bass(p.chords, 'x.x.x.x.', { step: 0.5, vel: 0.42 })),
    part('snare', tile(hits('r.g.r.g.r.g.rgrg', { vel: 0.3 }), BAR, n / BAR)),
    part('timpani', onRoots(p.chords, tilePattern('o..o............', n / BAR), { step: 0.25, vel: 0.5, range: TIMP })),
    part('brass', held(p.chords.filter((_, i) => i % 2 === 0), { vel: 0.32, voices: [0] })),
    ...leads(p.tense),
  ];
}

/** The clearing: long notes and space before the last push; its combat and tense layers stay muffled. */
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

function section(p: Plan): BattleSection {
  if (p.role === 'quiet') return quietSection(p);
  return { name: p.name, bars: beats(p) / BAR, role: p.role, layers: { build: buildLayer(p), combat: combatLayer(p), tense: tenseLayer(p) } };
}

const PLANS: Plan[] = [
  {
    name: 'The forest edge',
    role: 'intro',
    chords: prog(BAR, [[1, Dm], [1, Dm], [1, Bb], [1, Bb], [1, Gm], [1, Gm], [1, Asus], [1, A]]),
    ostBuild: [0, 2, 1, 2, 3, 2, 1, 2],
    ostCombat: [0, 1, 2, 0, 1, 2, 0, 1, 0, 2, 3, 0, 2, 3, 2, 1],
    snare: 'X..x..x.x.x.x...|X..x..x.F...x.x.',
    snareBuild: '................|........g.g.g.g.',
    timp: 'o.....o.|o...o...',
    stabs: 'x.......|....x...',
    build: [{ inst: 'horn', form: { tonic: 62, at: 16, take: 5, vel: 0.4 } }],
    combat: [...full(0, { brass: 50, horn: 62, strings: 74 }), { inst: 'brass', form: { tonic: 38, at: 16, augment: 2, take: 5, vel: 0.7 } }],
    tense: [{ inst: 'horn', form: { tonic: 62, at: 8, invert: true, colour: 'phrygian', vel: 0.45 } }],
  },
  {
    name: 'Mud and pine',
    role: 'main',
    chords: prog(BAR, [[1, Dm], [1, C], [1, Bb], [1, A], [1, Dm], [1, C], [1, Bb], [1, A]]),
    ostBuild: [0, 1, 2, 3, 2, 1, 2, 1],
    ostCombat: [0, 2, 1, 2, 0, 3, 1, 3, 0, 2, 1, 2, 4, 3, 2, 1],
    snare: 'X.x.x.xxX.x.x.x.|X.x.x.xxX.r.x.r.',
    timp: 'o.o.o...|o.o.o.oo',
    stabs: 'x...x...|x.x.....',
    build: [{ inst: 'strings', form: { tonic: 62, at: 0, vel: 0.3 } }],
    combat: [
      { inst: 'brass', form: { tonic: 50, at: 0, vel: 0.82 } },
      { inst: 'horn', form: { tonic: 62, at: 2, vel: 0.5 } },
      { inst: 'brass', form: { tonic: 50, at: 16, colour: 'harmonic', vel: 0.82 } },
      { inst: 'horn', form: { tonic: 62, at: 18, colour: 'harmonic', take: 7, vel: 0.5 } },
    ],
    tense: [{ inst: 'horn', form: { tonic: 62, at: 0, take: 3, augment: 2, vel: 0.45 } }],
  },
  {
    name: 'The barrage lifts',
    role: 'main',
    chords: prog(BAR, [[1, Gm], [1, Dm], [1, Gm], [1, Dm], [1, Eb], [1, Bb], [1, Gm], [1, A]]),
    ostBuild: [0, 2, 3, 2, 1, 2, 3, 2],
    ostCombat: [0, 1, 0, 2, 0, 3, 0, 2, 0, 1, 0, 2, 3, 2, 1, 0],
    snare: 'F..x..x.X.x.X...|F..x..x.x..xX.xx',
    snareBuild: 'r.......r.......|r.......r...r.r.',
    timp: 'o..o..o.|o..o.o.o',
    stabs: '...x....|...x..x.',
    build: [{ inst: 'horn', form: { tonic: 62, at: 0, take: 5, colour: 'phrygian', vel: 0.4 } }],
    combat: [
      { inst: 'brass', form: { tonic: 50, at: 0, step: 3, vel: 0.82 } },
      { inst: 'horn', form: { tonic: 50, at: 0, step: 5, vel: 0.5 } },
      { inst: 'brass', form: { tonic: 50, at: 16, invert: true, step: 4, vel: 0.82 } },
      { inst: 'strings', form: { tonic: 74, at: 16, invert: true, step: 4, vel: 0.5 } },
    ],
    tense: [{ inst: 'horn', form: { tonic: 62, at: 16, retrograde: true, colour: 'phrygian', vel: 0.45 } }],
  },
  {
    name: 'Through the trees',
    role: 'main',
    chords: prog(BAR, [[1, Dm], [1, F], [1, C], [1, Gm], [1, Dm], [1, F], [1, Eb], [1, A]]),
    ostBuild: [0, 3, 2, 3, 1, 3, 2, 3],
    ostCombat: [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 4, 3, 2, 1],
    snare: 'X..x.xx.X.xx.x..|X..x.xx.X.x.x.xx',
    timp: 'o...o.o.|o...o.oo',
    stabs: 'x.......|x.......',
    build: [
      { inst: 'horn', form: { tonic: 62, at: 0, vel: 0.42 } },
      { inst: 'horn', form: { tonic: 62, at: 16, vel: 0.4, colour: 'harmonic' }, answer: true },
    ],
    combat: full(0, { brass: 50, horn: 62, strings: 74, colour: 'harmonic', vel: 0.84 }).concat(full(16, { brass: 50, horn: 62, strings: 74, vel: 0.86 })),
    tense: [{ inst: 'horn', form: { tonic: 62, at: 0, invert: true, colour: 'harmonic', vel: 0.45 } }],
  },
  {
    name: 'A clearing',
    role: 'quiet',
    chords: prog(BAR, [[2, Dm9], [2, Bbmaj7], [2, Gm7], [1, Asus], [1, A]]),
    ostBuild: [0, 2, 3, 2, 1, 2, 3, 2],
    ostCombat: [0, 2, 1, 2],
    snare: '',
    timp: '',
    stabs: '',
    build: [{ inst: 'horn', form: { tonic: 62, at: 4, augment: 2, take: 5, colour: 'dorian', vel: 0.38 } }],
    combat: [{ inst: 'brass', form: { tonic: 50, at: 8, augment: 2, take: 5, vel: 0.6 } }],
    tense: [{ inst: 'horn', form: { tonic: 62, at: 8, invert: true, augment: 2, take: 4, vel: 0.36 } }],
  },
  {
    name: "Dragon's teeth",
    role: 'main',
    chords: prog(BAR, [[1, Dm], [1, Eb], [1, Dm], [1, Eb], [1, Bb], [1, Gm], [1, A], [1, A]]),
    ostBuild: [0, 0, 2, 0, 0, 0, 3, 0],
    ostCombat: [0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 2, 1, 0],
    snare: 'X...X...X...X.x.|X...X...X..xX.x.',
    timp: 'o.o.o.o.|o.o.o.oo',
    stabs: 'x.x.....|x.x.....',
    build: [
      { inst: 'horn', form: { tonic: 62, at: 4, take: 3, colour: 'phrygian', vel: 0.4 } },
      { inst: 'horn', form: { tonic: 62, at: 20, take: 3, colour: 'phrygian', vel: 0.4 } },
    ],
    combat: [
      { inst: 'brass', form: { tonic: 38, at: 0, augment: 2, colour: 'phrygian', vel: 0.88 } },
      { inst: 'horn', form: { tonic: 62, at: 0, colour: 'phrygian', vel: 0.5 } },
      { inst: 'strings', form: { tonic: 74, at: 16, colour: 'phrygian', vel: 0.52 } },
    ],
    tense: [{ inst: 'horn', form: { tonic: 62, at: 0, invert: true, augment: 2, vel: 0.42 } }],
  },
  {
    name: 'The pillboxes',
    role: 'main',
    chords: prog(BAR, [[1, Bb], [1, C], [1, Dm], [1, Dm], [1, Bb], [1, C], [1, Asus], [1, A]]),
    ostBuild: [0, 2, 1, 3, 0, 2, 1, 3],
    ostCombat: [0, 2, 0, 3, 0, 2, 0, 1, 0, 2, 0, 3, 1, 2, 3, 4],
    snare: 'X.xxX.x.X.xxX.x.|X.xxX.x.X.x.F...',
    snareBuild: '....g.......g...|....g.......g.g.',
    timp: 'o.oo....|o.oo..oo',
    stabs: 'x...x...|x...x.x.',
    build: [{ inst: 'strings', form: { tonic: 62, at: 16, take: 5, vel: 0.32 } }],
    combat: [
      { inst: 'brass', form: { tonic: 50, at: 0, take: 5, vel: 0.84 } },
      { inst: 'horn', form: { tonic: 62, at: 4, take: 5, step: 1, vel: 0.52 } },
      { inst: 'brass', form: { tonic: 50, at: 8, take: 5, step: 2, vel: 0.86 } },
      { inst: 'horn', form: { tonic: 62, at: 12, take: 5, step: 3, vel: 0.54 } },
      { inst: 'brass', form: { tonic: 50, at: 16, colour: 'harmonic', vel: 0.88 } },
      { inst: 'strings', form: { tonic: 74, at: 16, colour: 'harmonic', vel: 0.52 } },
    ],
    tense: [{ inst: 'horn', form: { tonic: 62, at: 8, take: 5, invert: true, step: 3, vel: 0.45 } }],
  },
  {
    name: 'Over the line',
    role: 'main',
    chords: prog(BAR, [[1, F], [1, C], [1, Dm], [1, Bb], [1, F], [1, C], [1, G], [1, A]]),
    ostBuild: [0, 1, 2, 1, 3, 1, 2, 1],
    ostCombat: [0, 2, 1, 3, 0, 2, 1, 3, 0, 2, 1, 3, 2, 3, 4, 5],
    snare: 'X.x.X.x.X.xxX.x.|X.x.X.x.F.F.x.xx',
    timp: 'o...o...|o.o.o.oo',
    stabs: 'x...x...|x...xxx.',
    build: [
      { inst: 'horn', form: { tonic: 62, at: 0, colour: 'dorian', vel: 0.42 } },
      { inst: 'horn', form: { tonic: 62, at: 16, vel: 0.42 } },
    ],
    combat: [...full(0, { brass: 41, horn: 65, strings: 77, colour: 'major', vel: 0.84 }), ...full(16, { brass: 50, horn: 62, strings: 74, colour: 'dorian', vel: 0.86 })],
    tense: [{ inst: 'horn', form: { tonic: 62, at: 16, take: 5, colour: 'dorian', vel: 0.45 } }],
  },
  {
    name: 'The Rhine ahead',
    role: 'main',
    chords: prog(BAR, [[1, Bb], [1, F], [1, C], [1, Dm], [1, Bb], [1, F], [1, G], [1, A]]),
    ostBuild: [0, 3, 1, 3, 2, 3, 1, 3],
    ostCombat: [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 4, 5, 4, 3],
    snare: 'X..xX.x.X..xX.x.|X..xX.x.X.xxF.x.',
    snareBuild: 'g.......g.......|g.......g...g.g.',
    timp: 'o..oo...|o..oo.oo',
    stabs: 'x..x....|x..x..x.',
    build: [
      { inst: 'strings', form: { tonic: 65, at: 0, colour: 'major', vel: 0.32 } },
      { inst: 'horn', form: { tonic: 62, at: 16, colour: 'dorian', vel: 0.42 }, answer: true },
    ],
    combat: [
      { inst: 'brass', form: { tonic: 41, at: 0, colour: 'major', vel: 0.86 } },
      { inst: 'horn', form: { tonic: 65, at: 2, colour: 'major', vel: 0.52 } },
      { inst: 'strings', form: { tonic: 77, at: 4, colour: 'major', vel: 0.48 } },
      { inst: 'brass', form: { tonic: 50, at: 16, colour: 'dorian', vel: 0.88 } },
      { inst: 'horn', form: { tonic: 62, at: 16, step: 2, colour: 'dorian', vel: 0.54 } },
      { inst: 'strings', form: { tonic: 74, at: 16, colour: 'dorian', vel: 0.52 } },
    ],
    tense: [{ inst: 'horn', form: { tonic: 62, at: 0, retrograde: true, augment: 2, vel: 0.42 } }],
  },
];

/** Victory: the whole answer in D major, brass, horn and strings together over a timpani roll, home on D major. */
const VICTORY: BattleSting = {
  beats: 16,
  parts: [
    part('brass', motif(BRITISH_ANSWER, { tonic: 50, colour: 'major', vel: 0.88 }), line([[8, 8, 38, 0.82], [8, 8, 45, 0.72]])),
    part('horn', motif(BRITISH_ANSWER, { tonic: 62, step: 2, colour: 'major', vel: 0.55 }), line([[8, 8, 66, 0.5]])),
    part('pad', line([[0, 16, 38, 0.6], [0, 16, 50, 0.5], [4, 12, 54, 0.5], [4, 12, 57, 0.5]])),
    part('strings', motif(BRITISH_ANSWER, { tonic: 74, colour: 'major', vel: 0.5, art: 'long' }), line([[8, 8, 78, 0.45], [8, 8, 81, 0.45]], 'trem')),
    part('timpani', swell(hits('R-------', { step: 1, vel: 0.6, note: 38 }), 0.5, 1), hits('o...o.o.o', { at: 8, step: 0.5, vel: 0.9, note: 38 })),
    part('snare', swell(hits('R-------', { step: 1, vel: 0.5 }), 0.4, 1), hits('F', { at: 8, vel: 0.85 })),
  ],
};

/** Defeat: the motif's head stalls in the Phrygian colour on low brass, a last timpani stroke under a fading tremolo. */
const DEFEAT: BattleSting = {
  beats: 12,
  parts: [
    part('brass', motif(BRITISH_MOTIF, { tonic: 38, take: 3, augment: 2, colour: 'phrygian', vel: 0.72 }), line([[8, 4, 39, 0.55], [8, 4, 38, 0.5]])),
    part('strings', line([[0, 12, 62, 0.32], [0, 12, 63, 0.28], [0, 12, 69, 0.26]], 'trem')),
    part('pad', line([[0, 12, 38, 0.55], [0, 12, 45, 0.45]])),
    part('timpani', hits('o...o...o', { step: 1, vel: 0.7, note: 38 })),
  ],
};

export const REICHSWALD: BattleTrackDef = {
  title: 'Through the Reichswald',
  theme: 'british',
  bpm: 144,
  beatsPerBar: BAR,
  tonic: 2,
  layerLevel: { build: 1.5, combat: 1, tense: 1.27, prep: 1.5 },
  gain: 0.76,
  humanize: { time: 0.006, velocity: 0.08 },
  seed: 1945,
  instruments: BATTLE_KIT,
  mix: { ...BATTLE_MIX, reverb: 0.5 },
  reverb: { ...BATTLE_REVERB, seconds: 2.1, seed: 245 },
  sections: PLANS.map(section),
  stings: { victory: VICTORY, defeat: DEFEAT },
};
