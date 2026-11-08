/**
 * Mission 5, Primosole Bridge, Sicily 1943: "Dusk at Primosole". A race against nightfall: a clock that never stops
 * ticking (a rim click and a dry hand-drum "tek", thinly at first and twice as fast in each section's second half),
 * harmony that climbs by steps while the light goes, and the British motif "The Line" (src/data/musicThemes.ts) in
 * rising sequences, played higher each time it comes back within a section, darkened to the Phrygian colour as dusk
 * falls. G minor, 132 BPM, 4/4, eight sections of eight bars (14.5 s per layer, 349 s of distinct music in three
 * layers), plus two stings. Written for Tin Hats; it quotes no existing melody, march, call or score.
 */
import type { BattleSection, BattleSting, BattleTrackDef, MusicEvent, MusicPart } from '../musicBattle';
import { bass, chordAt, fit, held, hits, line, onRoots, ostinato, part, prog, shift, swell, tile, type ChordSpan } from '../musicKit';
import { BRITISH_ANSWER, BRITISH_MOTIF, motif, type MotifForm } from '../musicThemes';
import { BATTLE_KIT, BATTLE_MIX, BATTLE_REVERB } from './kit';

const BAR = 4;
const TIMP: readonly [number, number] = [38, 52];

// Chords, low to high (MIDI). G minor, with the flattened second (A flat) for the dusk and the D major dominant.
const Gm = [43, 55, 58, 62];
const Gm9 = [43, 57, 58, 62];
const GmHi = [43, 58, 62, 67];
const Eb = [39, 51, 55, 58];
const Ebmaj7 = [39, 50, 55, 58];
const Cm = [36, 48, 51, 55];
const CmHi = [36, 51, 55, 60];
const D = [38, 50, 54, 57];
const Dsus = [38, 50, 55, 57];
const D7 = [38, 54, 57, 60];
const Bb = [46, 50, 53, 58];
const F = [41, 48, 53, 57];
const Ab = [44, 51, 56, 60];
const Fm = [41, 48, 53, 56];
const Adim = [45, 51, 57, 60];

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
  /** The clock: one bar of sixteenths for the first half of the section, and one (busier) for the second half. */
  tick: readonly [string, string];
  /** Two bars of sixteenths for the combat snare, played four times; the last bar gets a roll fill. */
  snare: string;
  /** Two bars of eighths for the combat timpani on the chord roots, and for the combat brass stabs. */
  timp: string;
  stabs: string;
  build: readonly Lead[];
  combat: readonly Lead[];
  tense: readonly Lead[];
}

function leads(list: readonly Lead[]): MusicPart[] {
  return list.map((l) => part(l.inst, motif(l.answer ? BRITISH_ANSWER : BRITISH_MOTIF, { art: l.inst === 'strings' ? 'long' : undefined, ...l.form })));
}

const beats = (p: Plan): number => p.chords.reduce((n, c) => n + c.beats, 0);

/** A pattern written for two bars, repeated `reps` times. */
function tilePattern(pattern: string, reps: number): string {
  return Array.from({ length: Math.round(reps) }, () => pattern).join('');
}

/** The clock over a section: the first half on tick[0], the second on tick[1], louder by `rise` at the end. */
function clock(p: Plan, vel: number, rise: number): MusicEvent[] {
  const n = beats(p);
  const half = n / (2 * BAR);
  const first = tile(hits(p.tick[0], { vel }), BAR, half);
  const second = shift(tile(hits(p.tick[1], { vel }), BAR, half), n / 2);
  return swell([...first, ...second], 1, rise);
}

/** The calm layer: soft eighth-note strings, the pad, the clock ticking quietly, the motif far off on the horn. */
function buildLayer(p: Plan): MusicPart[] {
  return [
    part('strings', ostinato(p.chords, p.ostBuild, { step: 0.5, vel: 0.32, accents: [0], accent: 1.3 }), bass(p.chords, 'x...x...', { step: 0.5, vel: 0.28 })),
    part('pad', held(p.chords, { vel: 0.55, voices: [0, 1, 2] })),
    part('snare', clock(p, 0.24, 1.25)),
    part('timpani', onRoots(p.chords, 'o.......|........', { step: 0.5, vel: 0.34, range: TIMP })),
    ...leads(p.build),
  ];
}

/** Heavy fighting: sixteenth-note strings, the snare driving on, the clock on the hand drum above it, timpani and brass. */
function combatLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  const reps = n / (2 * BAR);
  const snare = tile(hits(p.snare, { vel: 0.7 }), 2 * BAR, reps).filter((e) => e.at < n - BAR);
  const fill = swell(hits('x.xxx.xxR-------', { at: n - BAR, vel: 0.7 }), 0.7, 1.1);
  const tek = tile(hits('T.t.t.t.T.t.t.t.', { vel: 0.5 }), BAR, n / BAR);
  return [
    part('strings', ostinato(p.chords, p.ostCombat, { step: 0.25, vel: 0.52, shift: 12, accents: [0, 3, 6, 10], accent: 1.35 }), bass(p.chords, 'X.xxX.x.', { step: 0.5, vel: 0.5 })),
    part('pad', held(p.chords, { vel: 0.45, voices: [1, 2, 3] })),
    part('snare', snare, fill),
    part('hand', swell(tek, 0.8, 1.15)),
    part('timpani', onRoots(p.chords, tilePattern(p.timp, reps), { step: 0.5, vel: 0.6, range: TIMP })),
    part('brass', onRoots(p.chords, tilePattern(p.stabs, reps), { step: 0.5, vel: 0.6, range: [36, 52] }).map((e) => ({ ...e, len: 0.4, art: 'stab' as const }))),
    ...leads(p.combat),
  ];
}

/** The clock under a minute: sixteenth rims, a quickening heartbeat on the timpani, high tremolo, the motif climbing. */
function tenseLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  const heart = [...tile(hits('o..o............', { vel: 0.48 }), BAR, n / (2 * BAR)), ...shift(tile(hits('o..o....o..o....', { vel: 0.5 }), BAR, n / (2 * BAR)), n / 2)];
  return [
    part('strings', held(p.chords, { vel: 0.28, voices: [1, 2, 3], shift: 12, art: 'trem' }), bass(p.chords, 'x.x.x.x.', { step: 0.5, vel: 0.4 })),
    part('snare', swell(tile(hits('rgrgrgrgrgrgrgrg', { vel: 0.26 }), BAR, n / BAR), 0.8, 1.2)),
    part('hand', tile(hits('T...t...T...t...', { vel: 0.36 }), BAR, n / BAR)),
    part('timpani', heart.map((e) => ({ ...e, note: fit(chordAt(p.chords, e.at).notes[0], TIMP[0], TIMP[1]) }))),
    part('brass', held(p.chords.filter((_, i) => i % 2 === 0), { vel: 0.3, voices: [0] })),
    ...leads(p.tense),
  ];
}

/** The quiet stretch: heat and long notes, but the clock still ticks (softly) in every layer. */
function quietSection(p: Plan): BattleSection {
  const n = beats(p);
  return {
    name: p.name,
    bars: n / BAR,
    role: 'quiet',
    layers: {
      build: [part('pad', held(p.chords, { vel: 0.5 })), part('strings', held(p.chords, { vel: 0.2, voices: [3], shift: 12, art: 'long' })), part('snare', clock(p, 0.18, 1.1)), ...leads(p.build)],
      combat: [
        part('pad', held(p.chords, { vel: 0.48 })),
        part('strings', ostinato(p.chords, p.ostBuild, { step: 0.5, vel: 0.3 })),
        part('brass', held(p.chords, { vel: 0.38, voices: [0, 1] })),
        part('hand', clock(p, 0.3, 1.3)),
        part('timpani', swell(onRoots(p.chords, 'R-------', { at: n - 2 * BAR, step: 1, vel: 0.6, range: TIMP }), 0.6, 1)),
        part('snare', swell(hits('R-------', { at: n - 2 * BAR, step: 1, vel: 0.45 }), 0.5, 1)),
        ...leads(p.combat),
      ],
      tense: [
        part('strings', held(p.chords, { vel: 0.22, voices: [1, 2, 3], shift: 12, art: 'trem' })),
        part('snare', clock(p, 0.26, 1.3)),
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

// The clocks: quarters, then eighths; eighths, then sixteenths with the off-beats softer.
const QUARTERS = 'r...r...r...r...';
const EIGHTHS = 'r.r.r.r.r.r.r.r.';
const OFFBEAT = '..r...r...r...r.';
const SIXTEENS = 'r.grr.grr.grr.gr';

const PLANS: Plan[] = [
  {
    name: 'Gliders over the Simeto',
    role: 'intro',
    chords: prog(BAR, [[1, Gm], [1, Gm], [1, Eb], [1, Eb], [1, Cm], [1, Cm], [1, Dsus], [1, D]]),
    ostBuild: [0, 2, 3, 2, 1, 2, 3, 2],
    ostCombat: [0, 2, 1, 2, 3, 2, 1, 2, 0, 2, 3, 2, 1, 2, 3, 2],
    tick: [QUARTERS, EIGHTHS],
    snare: 'X...x.x.X...x.x.|X...x.x.X.x.x.xx',
    timp: 'o.....o.|o.....oo',
    stabs: 'x.......|......x.',
    build: [{ inst: 'horn', form: { tonic: 67, at: 16, take: 5, vel: 0.4 } }],
    combat: [
      { inst: 'brass', form: { tonic: 43, at: 0, vel: 0.8 } },
      { inst: 'brass', form: { tonic: 43, at: 16, step: 2, vel: 0.82 } },
    ],
    tense: [{ inst: 'horn', form: { tonic: 67, at: 8, invert: true, colour: 'phrygian', vel: 0.45 } }],
  },
  {
    name: 'The bridge at noon',
    role: 'main',
    chords: prog(BAR, [[1, Gm], [1, F], [1, Eb], [1, D], [1, Gm], [1, F], [1, Eb], [1, D7]]),
    ostBuild: [0, 1, 2, 3, 2, 1, 2, 1],
    ostCombat: [0, 2, 1, 3, 0, 2, 1, 3, 0, 2, 1, 3, 2, 1, 0, 1],
    tick: [EIGHTHS, SIXTEENS],
    snare: 'X.x.x.xxX.x.x.x.|X.x.x.xxX.r.x.xx',
    timp: 'o.o.o...|o.o.o.oo',
    stabs: 'x...x...|x.x.....',
    build: [{ inst: 'strings', form: { tonic: 55, at: 0, vel: 0.3 } }],
    combat: [
      { inst: 'brass', form: { tonic: 43, at: 0, vel: 0.78 } },
      { inst: 'horn', form: { tonic: 55, at: 16, step: 1, vel: 0.5 } },
    ],
    tense: [{ inst: 'horn', form: { tonic: 67, at: 0, take: 3, augment: 2, vel: 0.45 } }],
  },
  {
    name: 'Climbing light',
    role: 'main',
    // The roots climb G, A flat, B flat, C, D, E flat: the sky turns while the sequence rises.
    chords: prog(BAR, [[1, Gm], [1, Ab], [1, Bb], [1, CmHi], [1, Cm], [1, D], [1, Eb], [1, D]]),
    ostBuild: [0, 2, 3, 2, 0, 2, 3, 2],
    ostCombat: [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 4, 3, 2, 1],
    tick: [OFFBEAT, EIGHTHS],
    snare: 'x..X..x.x..X..x.|x..X..x.x..XX.x.',
    timp: 'o..o..o.|o..o.o.o',
    stabs: '...x....|...x..x.',
    build: [
      { inst: 'horn', form: { tonic: 55, at: 0, take: 5, vel: 0.38 } },
      { inst: 'horn', form: { tonic: 55, at: 16, take: 5, step: 2, vel: 0.42 } },
    ],
    combat: [
      { inst: 'brass', form: { tonic: 43, at: 0, take: 5, vel: 0.78 } },
      { inst: 'brass', form: { tonic: 43, at: 8, take: 5, step: 1, vel: 0.8 } },
      { inst: 'brass', form: { tonic: 43, at: 16, take: 5, step: 3, vel: 0.84 } },
      { inst: 'horn', form: { tonic: 55, at: 24, take: 5, step: 4, vel: 0.5 } },
    ],
    tense: [{ inst: 'horn', form: { tonic: 55, at: 8, step: 2, colour: 'harmonic', vel: 0.45 } }],
  },
  {
    name: 'Long shadows',
    role: 'main',
    chords: prog(BAR, [[1, Gm], [1, Ab], [1, Gm], [1, Ab], [1, Fm], [1, Eb], [1, Ab], [1, D]]),
    ostBuild: [0, 0, 2, 0, 3, 0, 2, 0],
    ostCombat: [0, 0, 2, 0, 0, 0, 3, 0, 0, 0, 2, 0, 3, 2, 1, 0],
    tick: [QUARTERS, OFFBEAT],
    snare: 'X...X...X..xX...|X...X...X..xX.x.',
    timp: 'o.o.o...|o.o.o.o.',
    stabs: 'x.x.....|x.x.....',
    build: [{ inst: 'horn', form: { tonic: 67, at: 4, take: 5, colour: 'phrygian', vel: 0.38 } }],
    combat: [{ inst: 'brass', form: { tonic: 43, at: 0, augment: 2, colour: 'phrygian', vel: 0.85 } }],
    tense: [{ inst: 'horn', form: { tonic: 67, at: 16, retrograde: true, colour: 'phrygian', vel: 0.45 } }],
  },
  {
    name: 'Heat haze',
    role: 'quiet',
    chords: prog(BAR, [[1, Gm9], [1, Ebmaj7], [1, Gm9], [1, Ebmaj7], [1, Cm], [1, Cm], [1, Dsus], [1, D]]),
    ostBuild: [0, 2, 3, 2, 1, 2, 3, 2],
    ostCombat: [0, 2, 1, 2],
    tick: [QUARTERS, EIGHTHS],
    snare: '',
    timp: '',
    stabs: '',
    build: [{ inst: 'horn', form: { tonic: 67, at: 4, augment: 2, take: 5, vel: 0.36 } }],
    combat: [{ inst: 'brass', form: { tonic: 55, at: 8, augment: 2, take: 5, vel: 0.6 } }],
    tense: [{ inst: 'horn', form: { tonic: 67, at: 8, invert: true, augment: 2, take: 4, vel: 0.36 } }],
  },
  {
    name: 'Every minute counts',
    role: 'main',
    chords: prog(BAR, [[1, Cm], [1, Gm], [1, Cm], [1, Gm], [1, Eb], [1, Bb], [1, Cm], [1, D]]),
    ostBuild: [0, 3, 2, 3, 1, 3, 2, 3],
    ostCombat: [0, 3, 2, 3, 1, 3, 2, 3, 0, 3, 2, 3, 4, 3, 2, 3],
    tick: [EIGHTHS, SIXTEENS],
    snare: 'F..x.xx.X.xx.x..|F..x.xx.X.x.x.xx',
    timp: 'o...o.o.|o...o.oo',
    stabs: 'x.......|x...x...',
    build: [
      { inst: 'horn', form: { tonic: 55, at: 0, vel: 0.42 } },
      { inst: 'horn', form: { tonic: 55, at: 16, step: 1, vel: 0.42 } },
    ],
    combat: [
      { inst: 'brass', form: { tonic: 43, at: 0, displace: 0.5, vel: 0.82 } },
      { inst: 'brass', form: { tonic: 43, at: 16, step: 1, displace: 0.5, vel: 0.85 } },
    ],
    tense: [{ inst: 'horn', form: { tonic: 67, at: 0, invert: true, colour: 'harmonic', vel: 0.45 } }],
  },
  {
    name: 'Sun on the girders',
    role: 'main',
    chords: prog(BAR, [[1, Eb], [1, F], [1, GmHi], [1, Gm], [1, Eb], [1, F], [1, Adim], [1, D]]),
    ostBuild: [0, 2, 1, 3, 0, 2, 1, 3],
    ostCombat: [0, 2, 0, 3, 0, 2, 0, 1, 0, 2, 0, 3, 1, 2, 3, 4],
    tick: [OFFBEAT, SIXTEENS],
    snare: 'X.xxX.x.X.xxX.x.|X.xxX.x.X.x.F...',
    timp: 'o.oo....|o.oo..oo',
    stabs: 'x...x...|x...x.x.',
    build: [{ inst: 'strings', form: { tonic: 55, at: 16, take: 5, step: 2, vel: 0.32 } }],
    combat: [
      { inst: 'brass', form: { tonic: 43, at: 0, step: 2, vel: 0.8 } },
      { inst: 'brass', form: { tonic: 43, at: 16, vel: 0.8, colour: 'harmonic' }, answer: true },
    ],
    tense: [{ inst: 'horn', form: { tonic: 67, at: 8, take: 5, invert: true, step: 2, vel: 0.45 } }],
  },
  {
    name: 'Dusk on the river',
    role: 'main',
    chords: prog(BAR, [[1, Gm], [1, Eb], [1, Cm], [1, D], [1, Gm], [1, Eb], [1, Ab], [1, D]]),
    ostBuild: [0, 1, 2, 1, 3, 1, 2, 1],
    ostCombat: [0, 2, 1, 3, 0, 2, 1, 3, 0, 2, 1, 3, 2, 3, 4, 5],
    tick: [EIGHTHS, SIXTEENS],
    snare: 'X.x.X.x.X.xxX.x.|X.x.X.x.F.F.x.xx',
    timp: 'o...o...|o.o.o.oo',
    stabs: 'x...x...|x...xxx.',
    build: [
      { inst: 'horn', form: { tonic: 55, at: 0, augment: 2, colour: 'phrygian', vel: 0.4 } },
      { inst: 'strings', form: { tonic: 67, at: 16, take: 5, vel: 0.26 } },
    ],
    combat: [
      { inst: 'brass', form: { tonic: 43, at: 0, vel: 0.8 } },
      { inst: 'brass', form: { tonic: 43, at: 16, vel: 0.85, colour: 'phrygian' }, answer: true },
      { inst: 'horn', form: { tonic: 67, at: 8, take: 5, vel: 0.45 } },
    ],
    tense: [{ inst: 'horn', form: { tonic: 55, at: 16, take: 5, step: 3, vel: 0.45 } }],
  },
];

/** Victory: the bridge held before dark. The answer in G major on the brass, the clock stopping on the last chord. */
const VICTORY: BattleSting = {
  beats: 12,
  parts: [
    part('brass', motif(BRITISH_ANSWER, { tonic: 55, colour: 'major', vel: 0.85 }), line([[8, 4, 43, 0.8], [8, 4, 50, 0.7]])),
    part('pad', line([[0, 12, 43, 0.6], [0, 12, 55, 0.5], [4, 8, 59, 0.5], [4, 8, 62, 0.5]])),
    part('strings', line([[8, 4, 67, 0.5], [8, 4, 71, 0.45], [8, 4, 74, 0.45]], 'trem')),
    part('snare', hits('r.r.r.r.r.r.r.r.r.r.r.r.r.r.r.r.', { vel: 0.3 }), hits('F', { at: 8, vel: 0.8 })),
    part('timpani', swell(hits('R-------', { step: 1, vel: 0.6, note: 43 }), 0.5, 1), hits('o', { at: 8, vel: 0.9, note: 43 })),
  ],
};

/** Defeat: night has fallen. The motif's head sinking in the Phrygian colour while the clock slows and stops. */
const DEFEAT: BattleSting = {
  beats: 12,
  parts: [
    part('brass', motif(BRITISH_MOTIF, { tonic: 43, take: 3, augment: 2, colour: 'phrygian', vel: 0.7 }), line([[8, 4, 44, 0.55], [8, 4, 43, 0.5]])),
    part('strings', line([[0, 12, 67, 0.3], [0, 12, 68, 0.26], [0, 12, 74, 0.24]], 'trem')),
    part('pad', line([[0, 12, 43, 0.55], [0, 12, 50, 0.45]])),
    part('snare', [0, 0.5, 1.1, 1.8, 2.7, 3.8, 5.2, 7].map((at, i) => ({ at, len: 0, note: 0, vel: 0.32 - i * 0.025, art: 'rim' as const }))),
    part('timpani', hits('o...o...o', { step: 1, vel: 0.7, note: 43 })),
  ],
};

export const PRIMOSOLE: BattleTrackDef = {
  title: 'Dusk at Primosole',
  theme: 'british',
  bpm: 132,
  beatsPerBar: BAR,
  tonic: 7,
  layerLevel: { build: 1.5, combat: 1, tense: 1.27, prep: 1.5 },
  gain: 0.8,
  humanize: { time: 0.005, velocity: 0.08 },
  seed: 1943,
  instruments: { ...BATTLE_KIT, snare: { ...BATTLE_KIT.snare, rimHz: 2100, rimDecay: 0.04 }, hand: { ...BATTLE_KIT.hand, tekHz: 610, tekDecay: 0.06 } },
  mix: { ...BATTLE_MIX, hand: { dry: 0.8, send: 0.2 } },
  reverb: { ...BATTLE_REVERB, seconds: 1.5, brightHz: 3800, seed: 1943 },
  sections: PLANS.map(section),
  stings: { victory: VICTORY, defeat: DEFEAT },
};
