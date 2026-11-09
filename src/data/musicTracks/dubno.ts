/**
 * Mission 1002, Dubno, 27 June 1941: "Iron in the Rye". The tank battle, heavy and mechanical but cold
 * (src/data/musicTracks/sovietKit.ts): A minor at 132 BPM. Its groove is the tracks: a low string ostinato in
 * sixteenths grinding on the root and the semitone above it, accented every third step against the bar, with the anvil
 * clanking on the same three-step cycle like a tread link going round. While calm, the treads idle in eighths under a
 * summer heat shimmer: high strings held on a narrow tremolo, still glassy, not warm. In the fight, low brass in unison
 * carries the Soviet motif "The Long Winter" (src/data/musicThemes.ts) augmented to twice its length over a heavy
 * half-time backbeat and pounding timpani; when the eighty-eight is firing the treads break up under a high shimmer
 * and a ticking anvil. The prep layer is the engines warming: the idling treads, a slow timpani and the horn. The
 * quiet section is dusk over the burnt-out tanks: choir and wind, and the treads far off. Six sections of eight bars
 * in four layers, plus two stings. Written for Tin Hats; it quotes no existing melody, march, call, hymn, folk tune or
 * score.
 */
import type { BattleSection, BattleSting, BattleTrackDef, MusicEvent, MusicPart } from '../musicBattle';
import { chordAt, fit, held, hits, line, onRoots, part, prog, swell, tile, type ChordSpan } from '../musicKit';
import { motif, SOVIET_ANSWER, SOVIET_MOTIF } from '../musicThemes';
import { SOVIET_KIT, SOVIET_MIX, SOVIET_REVERB } from './sovietKit';
import { leads, rep, spanBeats, windBand, type Lead } from './sovietParts';

const BAR = 4;
const TIMP: readonly [number, number] = [40, 52];

// Chords, low to high (MIDI). A minor, hard and plain: open fifths, the Phrygian B flat over A, E sus4 to E5.
const Am5 = [45, 52, 57, 64];
const Am = [45, 52, 57, 60];
const F = [41, 48, 53, 57];
const Fmaj7 = [41, 48, 52, 57];
const Dm = [38, 45, 50, 53];
const Dm5 = [38, 45, 50, 57];
const E5 = [40, 47, 52, 59];
const Esus = [40, 45, 47, 52];
const G5 = [43, 50, 55, 62];
const C5 = [36, 43, 48, 55];
const BbonA = [45, 53, 58, 62];

/**
 * The tracks: one note per step on the chord root (moved into [lo, lo + 11]) by the pattern's cells: 0 root, 1 the
 * semitone above (the grind), 5 the fifth, 8 the octave, '.' rest. Every third step is accented, so the accents walk
 * across the bar like a tread link going round.
 */
function treads(chords: readonly ChordSpan[], cells: string, o: { step: number; vel: number; lo: number; accent?: number; len?: number }): MusicEvent[] {
  const pattern = [...cells].filter((c) => c !== ' ' && c !== '|');
  const end = spanBeats(chords);
  const out: MusicEvent[] = [];
  let k = 0;
  for (let t = 0; t < end - 1e-9; t += o.step, k++) {
    const c = pattern[k % pattern.length];
    if (c === '.') continue;
    const root = fit(chordAt(chords, t).notes[0], o.lo, o.lo + 11);
    const note = root + (c === '1' ? 1 : c === '5' ? 7 : c === '8' ? 12 : 0);
    const vel = Math.min(1, o.vel * (k % 3 === 0 ? (o.accent ?? 1.35) : 1));
    out.push({ at: t, len: o.step * (o.len ?? 0.8), note, vel, art: 'short' });
  }
  return out;
}

/** The tread clank: the anvil every third sixteenth for two bars (32 steps, the cycle starting again on the bar). */
const CLANK = `${'o..'.repeat(10)}o.`;
/**
 * The same clank in the fight, every third stroke harder (a slower wheel turning inside the fast one): an even high
 * strike three times a second would grate over a long fight.
 */
const CLANK_FIGHT = [...CLANK].map((c, i) => (c === 'o' ? (i % 9 === 0 ? 'X' : 'x') : c)).join('');

interface Plan {
  name: string;
  role: BattleSection['role'];
  chords: ChordSpan[];
  /** The tread cells (see treads), in sixteenths for the fight and eighths while idling. */
  tracks: string;
  idle: string;
  anvilNote: number;
  /** Two bars of sixteenths: the half-time backbeat snare. Two bars of eighths: the pounding timpani. */
  snare: string;
  timp: string;
  build: readonly Lead[];
  combat: readonly Lead[];
  tense: readonly Lead[];
  prep: readonly Lead[];
}

const beats = (p: Plan): number => spanBeats(p.chords);

/** The heat shimmer: the chord's upper two notes two octaves up, held on the narrow tremolo. */
function shimmer(p: Plan, vel: number): MusicEvent[] {
  return held(p.chords, { vel, voices: [2, 3], shift: 24, art: 'trem' });
}

/** Calm: the treads idling in eighths, the shimmer, the low pad, an anvil every bar far back; the motif far off. */
function buildLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  return [
    part('strings', treads(p.chords, p.idle, { step: 0.5, vel: 0.28, lo: 40 }), shimmer(p, 0.15)),
    part('pad', held(p.chords, { vel: 0.5, voices: [0, 1, 2] })),
    part('anvil', tile(hits('o.......', { step: 0.5, vel: 0.2, note: p.anvilNote }), BAR, n / BAR)),
    part('timpani', onRoots(p.chords, rep('o.......|........', n / (2 * BAR)), { step: 0.5, vel: 0.32, range: TIMP })),
    ...leads(p.build),
  ];
}

/** The panzers: the treads grinding in sixteenths, the clank, a half-time backbeat, pounding timpani, the brass theme. */
function combatLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  const reps = n / (2 * BAR);
  const snare = tile(hits(p.snare, { vel: 0.72 }), 2 * BAR, reps).filter((e) => e.at < n - BAR);
  const fill = swell(hits('X...X...X.X.RRRR', { at: n - BAR, vel: 0.72 }), 0.8, 1.1);
  return [
    part('strings', treads(p.chords, p.tracks, { step: 0.25, vel: 0.46, lo: 40 }), shimmer(p, 0.12)),
    part('anvil', tile(hits(CLANK_FIGHT, { vel: 0.36, note: p.anvilNote }), 2 * BAR, reps)),
    part('snare', snare, fill),
    part('timpani', onRoots(p.chords, rep(p.timp, reps), { step: 0.5, vel: 0.64, range: TIMP })),
    // The engines: a low brass drone on the roots under the theme.
    part('brass', held(p.chords.filter((_, i) => i % 2 === 0).map((c) => ({ ...c, beats: 2 * BAR })), { vel: 0.32, voices: [0] })),
    ...leads(p.combat),
  ];
}

/** The eighty-eight: the treads breaking up, the shimmer high and close, a ticking anvil, a heartbeat, a ghost snare. */
function tenseLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  return [
    part('strings', treads(p.chords, '0.0.1...0.0.....', { step: 0.25, vel: 0.36, lo: 40 }), held(p.chords, { vel: 0.22, voices: [3], shift: 24, art: 'trem' }), held(p.chords, { vel: 0.18, voices: [3], shift: 25, art: 'trem' })),
    part('anvil', tile(hits('o...', { step: 0.5, vel: 0.24, note: p.anvilNote + 7 }), 2, n / 2)),
    part('snare', tile(hits('g.g.g.g.g.g.g.g.', { vel: 0.28 }), BAR, n / BAR - 1), swell(hits('R---------------', { at: n - BAR, vel: 0.42 }), 0.3, 1)),
    part('timpani', onRoots(p.chords, rep('o..o............', n / BAR), { step: 0.25, vel: 0.5, range: TIMP })),
    part('brass', held(p.chords.filter((_, i) => i % 2 === 0).map((c) => ({ ...c, beats: 2 * BAR })), { vel: 0.3, voices: [0] })),
    ...leads(p.tense),
  ];
}

/** Engines warming: the idling treads soft, the pad, a slow timpani, the anvil every two bars, a dust wind. */
function prepLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  return [
    part('strings', swell(treads(p.chords, p.idle, { step: 0.5, vel: 0.24, lo: 40, accent: 1.2 }), 0.7, 1.15)),
    part('pad', held(p.chords, { vel: 0.46, voices: [0, 1] })),
    part('timpani', onRoots(p.chords, rep('o.......|....o...', n / (2 * BAR)), { step: 0.5, vel: 0.34, range: TIMP })),
    part('anvil', tile(hits('o.......|........', { step: 0.5, vel: 0.24, note: p.anvilNote - 12 }), 2 * BAR, n / (2 * BAR))),
    part('snare', swell(hits('R---------------', { at: n - BAR, vel: 0.32 }), 0.3, 1)),
    part('wind', windBand(n, 74, 0.2)),
    ...leads(p.prep),
  ];
}

/** Dusk over the burnt-out tanks: choir and wind, the treads far off; the other layers keep its shape, quietly. */
function quietSection(p: Plan): BattleSection {
  const n = beats(p);
  return {
    name: p.name,
    bars: n / BAR,
    role: 'quiet',
    layers: {
      build: [
        part('choir', held(p.chords, { vel: 0.48, voices: [1, 2, 3] })),
        part('wind', windBand(n, 78, 0.4)),
        part('strings', treads(p.chords, '0.......', { step: 0.5, vel: 0.16, lo: 40, accent: 1 }), shimmer(p, 0.1)),
        part('timpani', onRoots(p.chords, 'o', { step: 1, vel: 0.24, range: TIMP })),
        ...leads(p.build),
      ],
      combat: [
        part('choir', held(p.chords, { vel: 0.46, voices: [1, 2, 3] })),
        part('strings', treads(p.chords, p.idle, { step: 0.5, vel: 0.3, lo: 40 })),
        part('brass', held(p.chords, { vel: 0.34, voices: [0] })),
        part('timpani', swell(onRoots(p.chords, 'R-------', { at: n - 2 * BAR, step: 1, vel: 0.56, range: TIMP }), 0.6, 1)),
        part('snare', swell(hits('R-------', { at: n - 2 * BAR, step: 1, vel: 0.4 }), 0.5, 1)),
        ...leads(p.combat),
      ],
      tense: [
        part('strings', held(p.chords, { vel: 0.2, voices: [3], shift: 24, art: 'trem' }), held(p.chords, { vel: 0.16, voices: [3], shift: 25, art: 'trem' })),
        part('anvil', tile(hits('o...', { step: 0.5, vel: 0.2, note: p.anvilNote + 7 }), 2, n / 2)),
        part('timpani', tile(onRoots(p.chords, 'o..o', { step: 0.25, vel: 0.36, range: TIMP }), 2 * BAR, n / (2 * BAR))),
        part('wind', windBand(n, 78, 0.3)),
        ...leads(p.tense),
      ],
      prep: [
        part('choir', held(p.chords, { vel: 0.4, voices: [1, 2] })),
        part('anvil', tile(hits('o.......|........', { step: 0.5, vel: 0.22, note: p.anvilNote - 12 }), 2 * BAR, n / (2 * BAR))),
        part('wind', windBand(n, 74, 0.36)),
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
const H = 'harmonic' as const;

// The combat theme is the motif augmented: 24 beats, six of the eight bars, so it rises to its fifth in bars 3 to 5
// and falls to the low dominant at bar 6, with the last two bars left to the treads and the fill.
const PLANS: Plan[] = [
  {
    name: 'Engines in the rye',
    role: 'intro',
    chords: prog(BAR, [[1, Am5], [1, Am5], [1, F], [1, F], [1, Dm5], [1, Dm5], [1, Esus], [1, E5]]),
    tracks: '0001|0008|0001|0050',
    idle: '0.0.1.0.',
    anvilNote: 81,
    snare: '....X.......X...|....X.......X.x.',
    timp: 'o.o.....|o.o...o.',
    build: [{ inst: 'horn', form: { tonic: 69, at: 16, take: 6, vel: 0.36 } }],
    combat: [{ inst: 'brass', form: { tonic: 45, at: 0, augment: 2, vel: 0.84 } }],
    tense: [{ inst: 'horn', form: { tonic: 69, at: 8, invert: true, take: 5, colour: PH, vel: 0.42 } }],
    prep: [{ inst: 'horn', form: { tonic: 69, at: 16, take: 4, augment: 2, vel: 0.3 } }],
  },
  {
    name: 'The road through Verba',
    role: 'main',
    chords: prog(BAR, [[1, Am], [1, G5], [1, F], [1, E5], [1, Am], [1, G5], [1, Dm], [1, Esus]]),
    tracks: '0010|0080|0010|0858',
    idle: '0.0.0.1.',
    anvilNote: 79,
    snare: '....X.......X...|....X.......X..x',
    timp: 'o.oo....|o.oo..o.',
    build: [{ inst: 'strings', form: { tonic: 81, at: 0, augment: 2, take: 6, vel: 0.2 } }],
    combat: [
      { inst: 'brass', form: { tonic: 45, at: 0, augment: 2, vel: 0.84 } },
      { inst: 'brass', form: { tonic: 57, at: 0, augment: 2, vel: 0.64 } },
      { inst: 'horn', form: { tonic: 69, at: 24, vel: 0.5 }, answer: true },
    ],
    tense: [{ inst: 'horn', form: { tonic: 69, at: 0, take: 4, augment: 2, vel: 0.42 } }],
    prep: [{ inst: 'bell', form: { tonic: 81, at: 0, take: 4, vel: 0.3 } }],
  },
  {
    name: 'Behind the panzers',
    role: 'main',
    chords: prog(BAR, [[1, Am5], [1, BbonA], [1, Am5], [1, BbonA], [1, Dm5], [1, C5], [1, BbonA], [1, E5]]),
    tracks: '0101|0001|0101|0805',
    idle: '0.1.0...',
    anvilNote: 84,
    snare: '....X.......X...|....X...X...X.x.',
    timp: 'o.o.o.o.|o.o.o.oo',
    build: [
      { inst: 'horn', form: { tonic: 69, at: 4, take: 4, colour: PH, vel: 0.38 } },
      { inst: 'horn', form: { tonic: 69, at: 20, take: 4, colour: PH, step: -1, vel: 0.36 } },
    ],
    combat: [
      { inst: 'brass', form: { tonic: 45, at: 0, augment: 2, colour: PH, vel: 0.86 } },
      { inst: 'anvil', form: { tonic: 88, at: 24, augment: 0.5, colour: PH, vel: 0.46 } },
    ],
    tense: [{ inst: 'strings', form: { tonic: 81, at: 0, invert: true, augment: 2, take: 5, colour: PH, vel: 0.26 } }],
    prep: [{ inst: 'horn', form: { tonic: 69, at: 8, take: 4, colour: PH, augment: 2, vel: 0.3 } }],
  },
  {
    name: 'Supply columns burning',
    role: 'main',
    chords: prog(BAR, [[1, F], [1, Fmaj7], [1, Dm], [1, Am], [1, F], [1, G5], [1, Dm5], [1, E5]]),
    tracks: '0008|0001|0008|5810',
    idle: '0.8.0.1.',
    anvilNote: 80,
    snare: '....X.......X...|....X.....x.X.X.',
    timp: 'o...o.o.|o...o.oo',
    build: [
      { inst: 'strings', form: { tonic: 81, at: 0, vel: 0.2 } },
      { inst: 'strings', form: { tonic: 81, at: 12, vel: 0.18 }, answer: true },
    ],
    combat: [
      { inst: 'brass', form: { tonic: 45, at: 0, augment: 2, colour: H, vel: 0.86 } },
      { inst: 'brass', form: { tonic: 57, at: 0, augment: 2, colour: H, vel: 0.64 } },
      { inst: 'horn', form: { tonic: 69, at: 24, invert: true, vel: 0.5 }, answer: true },
    ],
    tense: [{ inst: 'horn', form: { tonic: 69, at: 16, take: 6, colour: H, vel: 0.44 } }],
    prep: [{ inst: 'strings', form: { tonic: 81, at: 16, take: 4, vel: 0.2 } }],
  },
  {
    name: 'Dusk over the tanks',
    role: 'quiet',
    chords: prog(BAR, [[1, Am5], [1, Am5], [1, Fmaj7], [1, Fmaj7], [1, Dm5], [1, Dm5], [1, Esus], [1, Esus]]),
    tracks: '',
    idle: '0...0...',
    anvilNote: 79,
    snare: '',
    timp: '',
    build: [{ inst: 'brass', form: { tonic: 45, at: 4, augment: 2, take: 6, vel: 0.5 } }],
    combat: [{ inst: 'brass', form: { tonic: 45, at: 0, augment: 2, take: 7, vel: 0.6 } }],
    tense: [{ inst: 'horn', form: { tonic: 69, at: 8, invert: true, augment: 2, take: 4, vel: 0.32 } }],
    prep: [{ inst: 'choir', form: { tonic: 57, at: 4, augment: 2, take: 5, vel: 0.4 } }],
  },
  {
    name: 'Into Dubno',
    role: 'main',
    chords: prog(BAR, [[1, Dm], [1, F], [1, C5], [1, G5], [1, Dm], [1, F], [1, Esus], [1, E5]]),
    tracks: '0008|0058|0001|0805',
    idle: '0.5.8.5.',
    anvilNote: 82,
    snare: '....X.......X...|....X..x....X.xx',
    timp: 'o.oo..o.|o.oo..oo',
    build: [
      { inst: 'choir', form: { tonic: 57, at: 0, vel: 0.48 } },
      { inst: 'horn', form: { tonic: 57, at: 16, take: 6, step: 2, vel: 0.36 } },
    ],
    combat: [
      { inst: 'brass', form: { tonic: 45, at: 0, augment: 2, step: 2, vel: 0.88 } },
      { inst: 'brass', form: { tonic: 57, at: 0, augment: 2, step: 2, vel: 0.66 } },
      { inst: 'horn', form: { tonic: 69, at: 24, vel: 0.54 }, answer: true },
    ],
    tense: [{ inst: 'horn', form: { tonic: 69, at: 16, retrograde: true, take: 5, vel: 0.42 } }],
    prep: [{ inst: 'choir', form: { tonic: 57, at: 16, take: 4, vel: 0.38 } }],
  },
];

/** Victory: the answer in A major on unison brass and the anvil, over the treads stopping, then an open fifth held. */
const VICTORY: BattleSting = {
  beats: 14,
  parts: [
    part('brass', motif(SOVIET_ANSWER, { tonic: 45, colour: 'major', vel: 0.84 }), motif(SOVIET_ANSWER, { tonic: 57, colour: 'major', vel: 0.68 }), line([[4, 10, 45, 0.72], [4, 10, 52, 0.62]])),
    part('anvil', motif(SOVIET_ANSWER, { tonic: 88, colour: 'major', vel: 0.44 })),
    part('strings', treads(prog(BAR, [[1, Am5]]), '0001|0008|0001|0000', { step: 0.25, vel: 0.44, lo: 40 }), line([[4, 10, 76, 0.26], [4, 10, 81, 0.24]], 'trem')),
    part('choir', line([[4, 10, 57, 0.48], [4, 10, 61, 0.42], [4, 10, 64, 0.42]])),
    part('timpani', swell(hits('R---', { step: 1, vel: 0.56, note: 45 }), 0.5, 1), hits('o', { at: 4, vel: 0.85, note: 45 })),
    part('snare', hits('....X...X.X.RRRR', { vel: 0.66 }), hits('F', { at: 4, vel: 0.75 })),
  ],
};

/** Defeat: the motif's head on low brass in the Phrygian colour, the treads slowing to a stop, a bare fifth left. */
const DEFEAT: BattleSting = {
  beats: 14,
  parts: [
    part('brass', motif(SOVIET_MOTIF, { tonic: 45, take: 4, augment: 1.5, colour: PH, vel: 0.66 }), line([[6, 8, 45, 0.5], [6, 8, 52, 0.42]])),
    part('strings', line([[0, 1, 45, 0.4], [1, 1, 46, 0.36], [2.5, 1.5, 45, 0.3], [4.5, 1.5, 45, 0.22]], 'short'), line([[0, 14, 76, 0.18], [0, 14, 81, 0.16]], 'trem')),
    part('anvil', hits('o...o.....o', { step: 1, vel: 0.34, note: 72 })),
    part('timpani', hits('o.....o', { step: 1, vel: 0.6, note: 45 })),
    part('wind', line([[0, 14, 74, 0.5]])),
  ],
};

export const DUBNO: BattleTrackDef = {
  title: 'Iron in the Rye',
  theme: 'sovietWinter',
  bpm: 132,
  beatsPerBar: BAR,
  tonic: 9,
  layerLevel: { build: 1.5, combat: 1, tense: 1.27, prep: 1.45 },
  gain: 0.8,
  humanize: { time: 0.004, velocity: 0.07 },
  seed: 410627,
  instruments: {
    ...SOVIET_KIT,
    // The heat shimmer: a narrower, quicker tremolo, still glassy.
    strings: { ...SOVIET_KIT.strings, tremRate: 19, tremDepth: 0.22 },
    // A heavier tread clank.
    anvil: { ...SOVIET_KIT.anvil, decay: 0.24, noiseHz: 4200, level: 0.22 },
  },
  mix: SOVIET_MIX,
  // Open fields in summer: a shorter room than the city's.
  reverb: { ...SOVIET_REVERB, seconds: 1.9, seed: 410627 },
  sections: PLANS.map(section),
  stings: { victory: VICTORY, defeat: DEFEAT },
};
