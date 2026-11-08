/**
 * Mission 8, Hill 112 1944: "The Grinding Hill". Heavy and mechanical, like tanks: a low string ostinato that grinds
 * in groups of 3+3+2, anvil clanks like track links, brass hammering the roots, and C minor dragged down to its
 * flattened second (D flat) and across the tritone. The British motif "The Line" (src/data/musicThemes.ts) is
 * turned into machinery: its head (up a fifth, back a step) cut to double speed and hammered as a riff, the whole
 * motif at half speed in the low brass like a tank climbing, backwards on the crest, and sinking in a sequence.
 * 112 BPM, 4/4, seven sections of eight bars (120 s per layer, 360 s of distinct music), plus two stings. Written for
 * Tin Hats; it quotes no existing melody, march, call or score. Built on the recipe of musicTracks/arras.ts.
 */
import type { BattleSection, BattleSting, BattleTrackDef, MusicEvent, MusicPart } from '../musicBattle';
import { bass, held, hits, line, onRoots, ostinato, part, prog, swell, tile, type ChordSpan } from '../musicKit';
import { BRITISH_ANSWER, BRITISH_MOTIF, motif, type MotifForm } from '../musicThemes';
import { BATTLE_KIT, BATTLE_MIX, BATTLE_REVERB } from './kit';

const BAR = 4;
const TIMP: readonly [number, number] = [36, 48];
/** Low brass stabs sit right under the strings. */
const STAB: readonly [number, number] = [28, 43];
/** The anvil's two pitches: the clank of a track link and a duller knock. */
const CLANK = 76;
const KNOCK = 69;

// Chords, low to high (MIDI). C minor, the flattened second (D flat), the F sharp diminished across the tritone.
const Cm = [36, 48, 51, 55];
const Cm5 = [36, 43, 48, 55];
const Cm9 = [36, 50, 51, 55];
const Db = [37, 49, 53, 56];
const Ab = [44, 48, 51, 56];
const Abmaj7 = [44, 48, 51, 55];
const Fm = [41, 48, 53, 56];
const G = [43, 50, 55, 59];
const Gsus = [43, 50, 55, 60];
const Bb = [46, 50, 53, 58];
const Eb = [39, 51, 55, 58];
const FsDim = [42, 48, 51, 57];

/** Where the motif comes in: instrument, form, and an optional repeat (a riff every `every` beats, `times` times). */
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
  /** Build: an idling eighth-note string figure (chord tones). */
  idle: readonly number[];
  /** Combat: the grinding sixteenth ostinato (chord tones, -1 rests) and its accented steps. */
  grind: readonly number[];
  accents: readonly number[];
  /** Two bars of sixteenths each: the combat snare and anvil, and the soft build anvil. */
  snare: string;
  anvil: string;
  anvilBuild: string;
  /** Two bars of eighths: combat timpani and the brass hammering the roots. */
  timp: string;
  stabs: string;
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

/** A pattern written for two bars, repeated `reps` times. */
function tilePattern(pattern: string, reps: number): string {
  return Array.from({ length: Math.round(reps) }, () => pattern).join('');
}

/** Engines idling: a low 3+3+2 pulse, the eighth-note figure, the pad, a soft anvil, the motif far off. */
function buildLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  return [
    part('strings', ostinato(p.chords, p.idle, { step: 0.5, vel: 0.32, shift: 12, accents: [0, 3, 6], accent: 1.3 }), bass(p.chords, 'x..x..x.', { step: 0.5, vel: 0.32 })),
    part('pad', held(p.chords, { vel: 0.6, voices: [0, 1, 2] })),
    part('anvil', tile(hits(p.anvilBuild, { vel: 0.3, note: KNOCK }), 2 * BAR, n / (2 * BAR))),
    part('timpani', onRoots(p.chords, 'o.......|........', { step: 0.5, vel: 0.4, range: TIMP })),
    ...leads(p.build),
  ];
}

/** The armour moving: the grinding ostinato, brass hammering, anvil clanks, a heavy snare and timpani, the motif in low brass. */
function combatLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  const reps = n / (2 * BAR);
  const snare = tile(hits(p.snare, { vel: 0.7 }), 2 * BAR, reps).filter((e) => e.at < n - BAR);
  const fill = swell(hits('X..x..x.x.x.R---', { at: n - BAR, vel: 0.72 }), 0.7, 1.1);
  return [
    part('strings', ostinato(p.chords, p.grind, { step: 0.25, vel: 0.56, shift: 12, accents: p.accents, accent: 1.4 }), bass(p.chords, 'X..x..x.', { step: 0.5, vel: 0.52 })),
    part('pad', held(p.chords, { vel: 0.5, voices: [1, 2, 3] })),
    part('snare', snare, fill),
    part('anvil', tile(hits(p.anvil, { vel: 0.62, note: CLANK }), 2 * BAR, reps)),
    part('timpani', onRoots(p.chords, tilePattern(p.timp, reps), { step: 0.5, vel: 0.66, range: TIMP })),
    part('brass', onRoots(p.chords, tilePattern(p.stabs, reps), { step: 0.5, vel: 0.6, range: STAB }).map((e) => ({ ...e, len: 0.4, art: 'stab' as const }))),
    ...leads(p.combat),
  ];
}

/** HQ in danger: tremolo above, metal creaking in the dark, a heartbeat on the timpani, the motif turned over. */
function tenseLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  return [
    part('strings', held(p.chords, { vel: 0.3, voices: [1, 2, 3], shift: 12, art: 'trem' }), bass(p.chords, 'x.x.x.x.', { step: 0.5, vel: 0.44 })),
    part('anvil', tile(hits('x..............x|......x.........', { vel: 0.36, note: KNOCK }), 2 * BAR, n / (2 * BAR))),
    part('snare', tile(hits('g...g...g..gg...', { vel: 0.4 }), BAR, n / BAR)),
    part('timpani', onRoots(p.chords, tilePattern('o..o............', n / BAR), { step: 0.25, vel: 0.52, range: TIMP })),
    part('brass', held(p.chords.filter((_, i) => i % 2 === 0), { vel: 0.34, voices: [0] })),
    ...leads(p.tense),
  ];
}

/** The quiet stretch: burnt-out hulls, long notes and a far-off knock; its combat and tense layers stay muffled. */
function quietSection(p: Plan): BattleSection {
  const n = beats(p);
  return {
    name: p.name,
    bars: n / BAR,
    role: 'quiet',
    layers: {
      build: [
        part('pad', held(p.chords, { vel: 0.55 })),
        part('strings', held(p.chords, { vel: 0.22, voices: [0], art: 'long' })),
        part('anvil', hits('x.......|........|........|........|x.......|........|........|........', { step: 0.5, vel: 0.2, note: KNOCK })),
        part('timpani', onRoots(p.chords, 'o', { step: 1, vel: 0.32, range: TIMP })),
        ...leads(p.build),
      ],
      combat: [
        part('pad', held(p.chords, { vel: 0.5 })),
        part('strings', ostinato(p.chords, p.idle, { step: 0.5, vel: 0.3, shift: 12 })),
        part('brass', held(p.chords, { vel: 0.4, voices: [0, 1] })),
        part('anvil', tile(hits('x...............', { vel: 0.4, note: KNOCK }), BAR, n / BAR)),
        part('timpani', swell(onRoots(p.chords, 'R-------', { at: n - 2 * BAR, step: 1, vel: 0.62, range: TIMP }), 0.6, 1)),
        part('snare', swell(hits('R-------', { at: n - 2 * BAR, step: 1, vel: 0.45 }), 0.5, 1)),
        ...leads(p.combat),
      ],
      tense: [
        part('strings', held(p.chords, { vel: 0.24, voices: [1, 2, 3], shift: 12, art: 'trem' })),
        part('anvil', tile(hits('......x.........', { vel: 0.3, note: KNOCK }), BAR, n / BAR)),
        part('timpani', tile(onRoots(p.chords, 'o..o', { step: 0.25, vel: 0.42, range: TIMP }), 2 * BAR, n / (2 * BAR))),
        ...leads(p.tense),
      ],
    },
  };
}

function section(p: Plan): BattleSection {
  if (p.role === 'quiet') return quietSection(p);
  return { name: p.name, bars: beats(p) / BAR, role: p.role, layers: { build: buildLayer(p), combat: combatLayer(p), tense: tenseLayer(p) } };
}

/** The motif's head (up a fifth, back a step) at double speed: two beats of riff. */
const HEAD = { take: 3, augment: 0.5 } as const;

const PLANS: Plan[] = [
  {
    name: 'Engines at first light',
    role: 'intro',
    chords: prog(BAR, [[2, Cm5], [2, Ab], [2, Fm], [1, Gsus], [1, G]]),
    idle: [0, 0, 1, 0, 0, 2, 0, 1],
    grind: [0, 0, 1, 0, 0, 1, 0, 0, 2, 0, 0, 1, 0, 0, 3, 2],
    accents: [0, 3, 6, 8, 11, 14],
    snare: 'X.......x.......|X.......x...x.x.',
    anvil: '....X.......X...|....X.......X..x',
    anvilBuild: '................|....x.......x...',
    timp: 'o.....o.|o.....oo',
    stabs: 'x..x..x.|x..x..x.',
    build: [{ inst: 'horn', form: { tonic: 60, at: 16, take: 3, vel: 0.4 } }],
    combat: [
      { inst: 'brass', form: { tonic: 36, at: 0, augment: 2, vel: 0.85 } },
      { inst: 'brass', form: { tonic: 48, at: 16, ...HEAD, vel: 0.7 }, every: 2, times: 8 },
    ],
    tense: [{ inst: 'horn', form: { tonic: 60, at: 8, invert: true, colour: 'phrygian', vel: 0.45 } }],
  },
  {
    name: 'Tracks through the corn',
    role: 'main',
    chords: prog(BAR, [[1, Cm], [1, Db], [1, Cm], [1, Db], [1, Ab], [1, Bb], [1, Gsus], [1, G]]),
    idle: [0, 0, 2, 0, 0, 1, 0, 3],
    grind: [0, 1, 0, 0, 1, 0, 0, 2, 0, 1, 0, 0, 2, 1, 0, 3],
    accents: [0, 3, 6, 8, 11, 14],
    snare: 'X...x..x..x.X...|X...x..x..x.X.xx',
    anvil: 'x..x..x.....x...|x..x..x.....x.x.',
    anvilBuild: 'x...............|x.......x.......',
    timp: 'o..o..o.|o..o..oo',
    stabs: 'x..x..x.|x..x..xx',
    build: [{ inst: 'horn', form: { tonic: 60, at: 0, ...HEAD, vel: 0.36 }, every: 4, times: 4 }],
    combat: [
      { inst: 'brass', form: { tonic: 48, at: 0, ...HEAD, vel: 0.72 }, every: 2, times: 8 },
      { inst: 'brass', form: { tonic: 36, at: 16, colour: 'phrygian', vel: 0.85 } },
    ],
    tense: [{ inst: 'horn', form: { tonic: 60, at: 16, take: 5, colour: 'phrygian', vel: 0.45 } }],
  },
  {
    name: 'The orchard on the slope',
    role: 'main',
    chords: prog(BAR, [[1, Fm], [1, Cm], [1, Fm], [1, Cm], [1, Eb], [1, Bb], [1, Ab], [1, G]]),
    idle: [0, 2, 1, 0, 2, 1, 0, 3],
    grind: [0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 2, 3],
    accents: [0, 4, 8, 12],
    snare: 'x..X..x...x.X...|x..X..x.x..xX...',
    anvil: '........X.......|........X.....x.',
    anvilBuild: '................|........x.......',
    timp: 'o..o..o.|o..o.o.o',
    stabs: '...x....|...x..x.',
    build: [{ inst: 'strings', form: { tonic: 60, at: 0, take: 5, colour: 'phrygian', vel: 0.3 } }],
    combat: [
      { inst: 'strings', form: { tonic: 72, at: 0, colour: 'phrygian', vel: 0.62 } },
      { inst: 'brass', form: { tonic: 36, at: 16, step: 3, vel: 0.8 } },
    ],
    tense: [{ inst: 'horn', form: { tonic: 60, at: 0, retrograde: true, vel: 0.45 } }],
  },
  {
    name: 'Tigers on the crest',
    role: 'main',
    chords: prog(BAR, [[1, Cm5], [1, FsDim], [1, Cm5], [1, FsDim], [1, Ab], [1, Db], [1, G], [1, G]]),
    idle: [0, 0, 0, 2, 0, 0, 1, 0],
    grind: [0, -1, 0, 0, -1, 0, 0, 1, 0, -1, 0, 0, -1, 0, 2, 1],
    accents: [0, 3, 6, 8, 11, 14],
    snare: 'X...X...X...X.x.|X...X...X..xX.x.',
    anvil: 'X..x..X.X..x..X.|X..x..X.X..x.xxx',
    anvilBuild: 'x.......x.......|x.......x.......',
    timp: 'o.o.o.o.|o.o.o.oo',
    stabs: 'x.x.....|x.x.....',
    build: [
      { inst: 'horn', form: { tonic: 60, at: 4, take: 3, colour: 'phrygian', vel: 0.4 } },
      { inst: 'horn', form: { tonic: 60, at: 20, take: 3, retrograde: true, colour: 'phrygian', vel: 0.4 } },
    ],
    combat: [
      { inst: 'brass', form: { tonic: 36, at: 0, retrograde: true, vel: 0.88 } },
      { inst: 'brass', form: { tonic: 36, at: 16, retrograde: true, colour: 'harmonic', vel: 0.88 } },
    ],
    tense: [{ inst: 'horn', form: { tonic: 60, at: 0, invert: true, augment: 2, vel: 0.42 } }],
  },
  {
    name: 'Burnt-out hulls',
    role: 'quiet',
    chords: prog(BAR, [[2, Cm9], [2, Abmaj7], [2, Fm], [1, Gsus], [1, G]]),
    idle: [0, 2, 3, 2, 1, 2, 3, 2],
    grind: [0],
    accents: [],
    snare: '',
    anvil: '',
    anvilBuild: '',
    timp: '',
    stabs: '',
    build: [{ inst: 'horn', form: { tonic: 60, at: 4, augment: 2, take: 5, vel: 0.38 } }],
    combat: [{ inst: 'brass', form: { tonic: 36, at: 8, augment: 2, take: 5, vel: 0.62 } }],
    tense: [{ inst: 'horn', form: { tonic: 60, at: 8, invert: true, augment: 2, take: 4, vel: 0.36 } }],
  },
  {
    name: 'Gears and tracks',
    role: 'main',
    chords: prog(BAR, [[1, Cm], [1, Bb], [1, Ab], [1, G], [1, Cm], [1, Bb], [1, Db], [1, G]]),
    idle: [0, 1, 0, 2, 0, 1, 0, 3],
    grind: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 2, 3],
    accents: [0, 3, 6, 9, 12, 14],
    snare: 'X..x..x..x..X.x.|X..x..x..x..F.x.',
    anvil: 'x..x..x..x..x...|x..x..x..x..x.x.',
    anvilBuild: 'x.....x.........|x.....x.........',
    timp: 'o..o..o.|o..o..o.',
    stabs: 'x..x..x.|x..x..x.',
    build: [{ inst: 'strings', form: { tonic: 60, at: 16, take: 5, vel: 0.3 } }],
    combat: [
      { inst: 'brass', form: { tonic: 48, at: 0, take: 5, vel: 0.82 } },
      { inst: 'brass', form: { tonic: 48, at: 8, take: 5, step: -1, vel: 0.82 } },
      { inst: 'brass', form: { tonic: 48, at: 16, take: 5, step: -2, vel: 0.84 } },
      { inst: 'brass', form: { tonic: 48, at: 24, take: 5, step: -3, colour: 'harmonic', vel: 0.86 } },
    ],
    tense: [{ inst: 'horn', form: { tonic: 60, at: 8, take: 5, invert: true, step: 2, vel: 0.45 } }],
  },
  {
    name: 'The last hundred yards',
    role: 'main',
    chords: prog(BAR, [[1, Ab], [1, Bb], [1, Cm], [1, Cm], [1, Ab], [1, Bb], [1, Gsus], [1, G]]),
    idle: [0, 2, 1, 3, 0, 2, 1, 3],
    grind: [0, 0, 1, 0, 0, 2, 0, 0, 1, 0, 0, 2, 0, 0, 3, 4],
    accents: [0, 3, 6, 8, 11, 14],
    snare: 'X.x.X..xX.x.X..x|X.x.X..xF.F.x.xx',
    anvil: 'X.......X..x....|X.......X..x..x.',
    anvilBuild: '....x...........|....x.......x...',
    timp: 'o...o.o.|o.o.o.oo',
    stabs: 'x...x.x.|x...xxx.',
    build: [
      { inst: 'horn', form: { tonic: 60, at: 0, vel: 0.42 } },
      { inst: 'horn', form: { tonic: 60, at: 16, vel: 0.42, colour: 'harmonic' } },
    ],
    combat: [
      { inst: 'brass', form: { tonic: 36, at: 0, colour: 'harmonic', vel: 0.85 } },
      { inst: 'horn', form: { tonic: 60, at: 0, colour: 'harmonic', vel: 0.5 } },
      { inst: 'brass', form: { tonic: 36, at: 16, vel: 0.88 }, answer: true },
    ],
    tense: [{ inst: 'horn', form: { tonic: 60, at: 16, take: 5, colour: 'harmonic', vel: 0.45 } }],
  },
];

/** Victory: the answer on the low brass over the grinding head, landing on C major with one last clank. */
const VICTORY: BattleSting = {
  beats: 12,
  parts: [
    part('brass', motif(BRITISH_ANSWER, { tonic: 48, colour: 'harmonic', vel: 0.85 }), line([[8, 4, 36, 0.85], [8, 4, 43, 0.7]])),
    part('pad', line([[0, 12, 36, 0.6], [0, 12, 48, 0.5], [8, 4, 52, 0.55], [8, 4, 55, 0.5]])),
    part('strings', line([[8, 4, 60, 0.5], [8, 4, 64, 0.45], [8, 4, 67, 0.45]], 'trem')),
    part('anvil', hits('x..x..x.x..x..x.|x..x..x.x..x..x.', { vel: 0.4, note: KNOCK }), hits('X', { at: 8, vel: 0.85, note: CLANK })),
    part('timpani', swell(hits('R-------', { step: 1, vel: 0.6, note: 36 }), 0.5, 1), hits('o', { at: 8, vel: 0.95, note: 36 })),
  ],
};

/** Defeat: the engine dying, knocks slowing to nothing, under the motif's head sinking in the Phrygian colour. */
const DEFEAT: BattleSting = {
  beats: 12,
  parts: [
    part('brass', motif(BRITISH_MOTIF, { tonic: 36, take: 3, augment: 2, colour: 'phrygian', vel: 0.72 }), line([[8, 4, 37, 0.55], [8, 4, 36, 0.5]])),
    part('strings', line([[0, 12, 60, 0.3], [0, 12, 61, 0.26], [0, 12, 67, 0.24]], 'trem')),
    part('pad', line([[0, 12, 36, 0.55], [0, 12, 43, 0.45]])),
    part('anvil', line([[0, 0, KNOCK, 0.6], [1, 0, KNOCK, 0.5], [2.5, 0, KNOCK, 0.4], [4.5, 0, KNOCK, 0.3], [7.5, 0, KNOCK, 0.22]], 'hit')),
    part('timpani', hits('o...o...o', { step: 1, vel: 0.72, note: 36 })),
  ],
};

export const HILL112: BattleTrackDef = {
  title: 'The Grinding Hill',
  theme: 'british',
  bpm: 112,
  beatsPerBar: BAR,
  tonic: 0,
  layerLevel: { build: 1.5, combat: 1, tense: 1.27, prep: 1.5 },
  gain: 0.8,
  humanize: { time: 0.004, velocity: 0.06 },
  seed: 1944,
  instruments: { ...BATTLE_KIT, anvil: { ...BATTLE_KIT.anvil, decay: 0.42 } },
  mix: { ...BATTLE_MIX, anvil: { dry: 0.8, send: 0.4 }, reverb: 0.4 },
  reverb: { ...BATTLE_REVERB, seconds: 1.5, seed: 112 },
  sections: PLANS.map(section),
  stings: { victory: VICTORY, defeat: DEFEAT },
};
