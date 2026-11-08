/**
 * Mission 3, Operation Crusader, Libya 1941: "Wind over Sidi Rezegh". Dry and sparse: D minor at 126 BPM in open
 * fifths (no thirds in most chords), a small dry room, hand drums (dum and tek) carrying the rhythm instead of the
 * march snare, plucked string figures with gaps in them, and the British motif "The Line" (src/data/musicThemes.ts)
 * in the Dorian colour on a far horn and in bare parallel fifths on the low brass. Eight sections of eight bars, two
 * of them quiet (366 s of distinct music in three layers), plus two stings. Written for Tin Hats; it quotes no existing
 * melody, march, call or score.
 */
import type { BattleSection, BattleSting, BattleTrackDef, MusicEvent, MusicPart } from '../musicBattle';
import { bass, held, hits, line, onRoots, ostinato, part, prog, swell, tile, transpose, type ChordSpan } from '../musicKit';
import { BRITISH_ANSWER, BRITISH_MOTIF, motif, type MotifForm } from '../musicThemes';
import { BATTLE_KIT, BATTLE_MIX, BATTLE_REVERB } from './kit';

const BAR = 4;
const TIMP: readonly [number, number] = [36, 52];

// Open fifths, low to high (MIDI): root, fifth, octave, fifth. A few colours: a suspended fourth, an added ninth, one minor third.
const D5 = [38, 45, 50, 57];
const C5 = [36, 43, 48, 55];
const Bb5 = [34, 41, 46, 53];
const A5 = [33, 40, 45, 52];
const F5 = [41, 48, 53, 60];
const G5 = [43, 50, 55, 62];
const Eb5 = [39, 46, 51, 58];
const Dsus4 = [38, 45, 50, 55];
const D9 = [38, 45, 52, 57];
const Asus = [33, 40, 45, 50];
const Dm = [38, 45, 50, 53];

interface Lead {
  inst: 'horn' | 'strings' | 'brass';
  form: MotifForm;
  answer?: boolean;
  /** Doubled a bare fifth above (7 semitones), the desert's open sound. */
  fifths?: boolean;
}

interface Plan {
  name: string;
  role: BattleSection['role'];
  chords: ChordSpan[];
  /** Plucked eighths in the build layer (chord-tone indices, -1 a gap) and sixteenths in combat. */
  pluck: readonly number[];
  ostCombat: readonly number[];
  ostTense: readonly number[];
  /** Two bars of sixteenths for the hand drum: build and combat (the combat's last bar is a fill). */
  handBuild: string;
  hand: string;
  /** Two bars of eighths: combat timpani and the brass stabs (played in fifths) on the chord roots. */
  timp: string;
  stabs: string;
  build: readonly Lead[];
  combat: readonly Lead[];
  tense: readonly Lead[];
}

function leads(list: readonly Lead[]): MusicPart[] {
  return list.map((l) => {
    const m = motif(l.answer ? BRITISH_ANSWER : BRITISH_MOTIF, { art: l.inst === 'strings' ? 'long' : undefined, ...l.form });
    return part(l.inst, m, l.fifths ? transpose(m, 7).map((e) => ({ ...e, vel: e.vel * 0.8 })) : []);
  });
}

const beats = (p: Plan): number => p.chords.reduce((n, c) => n + c.beats, 0);

function rep(pattern: string, times: number): string {
  return Array.from({ length: Math.round(times) }, () => pattern).join('');
}

/** The chords with a root below the strings' range lifted an octave (for the cello line). */
function lifted(chords: readonly ChordSpan[]): ChordSpan[] {
  return chords.map((c) => (c.notes[0] < 36 ? { ...c, notes: [c.notes[0] + 12, ...c.notes.slice(1)] } : c));
}

/** Stabs on the roots with the fifth on top. */
function fifthStabs(chords: readonly ChordSpan[], pattern: string, vel: number): MusicEvent[] {
  return onRoots(chords, pattern, { step: 0.5, vel, range: [33, 47] }).flatMap((e) => [
    { ...e, len: 0.4, art: 'stab' as const },
    { ...e, note: e.note + 7, len: 0.4, vel: e.vel * 0.8, art: 'stab' as const },
  ]);
}

/** Calm: a bare drone, plucked figures with gaps, a hand drum, now and then a timpani stroke, the horn far away. */
function buildLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  return [
    part('pad', held(p.chords, { vel: 0.5, voices: [0, 1, 2] })),
    part('strings', ostinato(p.chords, p.pluck, { step: 0.5, vel: 0.32, shift: 12, len: 0.5, accents: [0], accent: 1.3 }), held(lifted(p.chords), { vel: 0.17, voices: [0], art: 'long' })),
    part('hand', tile(hits(p.handBuild, { vel: 0.45 }), 2 * BAR, n / (2 * BAR))),
    part('timpani', onRoots(p.chords, 'o.......|........', { step: 0.5, vel: 0.32, range: TIMP })),
    ...leads(p.build),
  ];
}

/** Heavy fighting: sixteenths in fifths, a lopsided 3-3-2 bass, the hand drums at full stretch, rim shots, stabs in fifths. */
function combatLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  const reps = n / (2 * BAR);
  const hand = tile(hits(p.hand, { vel: 0.7 }), 2 * BAR, reps).filter((e) => e.at < n - BAR);
  const fill = swell(hits('D.t.D.t.DtDtDTDT', { at: n - BAR, vel: 0.72 }), 0.75, 1.1);
  return [
    part('strings', ostinato(p.chords, p.ostCombat, { step: 0.25, vel: 0.52, shift: 12, accents: [0, 6, 12], accent: 1.35 }), bass(lifted(p.chords), 'X..x..x.', { step: 0.25, vel: 0.48 })),
    part('pad', held(p.chords, { vel: 0.45, voices: [1, 2, 3] })),
    part('hand', hand, fill),
    part('snare', tile(hits('....r.......r.r.|....r.......r..r', { vel: 0.42 }), 2 * BAR, reps)),
    part('timpani', onRoots(p.chords, rep(p.timp, reps), { step: 0.5, vel: 0.6, range: TIMP })),
    part('brass', fifthStabs(p.chords, rep(p.stabs, reps), 0.58)),
    ...leads(p.combat),
  ];
}

/** HQ in danger: a high tremolo on the bare fifth, a low pedal, a heartbeat dum and a tek ticking like a clock. */
function tenseLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  return [
    part('strings', held(p.chords, { vel: 0.28, voices: [2, 3], shift: 12, art: 'trem' }), ostinato(p.chords, p.ostTense, { step: 0.25, vel: 0.36, shift: 12 })),
    part('hand', tile(hits('D..d............', { vel: 0.6 }), BAR, n / BAR), tile(hits('..t...t...t...t.', { vel: 0.3 }), BAR, n / BAR)),
    part('timpani', onRoots(p.chords, rep('o..o............', n / BAR), { step: 0.25, vel: 0.42, range: TIMP })),
    part('brass', held(p.chords.filter((_, i) => i % 2 === 0), { vel: 0.3, voices: [0, 1] })),
    ...leads(p.tense),
  ];
}

/** Heat and stillness: a drone, single dums, the motif slowed down; the louder layers keep that space. */
function quietSection(p: Plan): BattleSection {
  const n = beats(p);
  return {
    name: p.name,
    bars: n / BAR,
    role: 'quiet',
    layers: {
      build: [
        part('pad', held(p.chords, { vel: 0.52 })),
        part('strings', held(p.chords, { vel: 0.2, voices: [1], art: 'long' })),
        part('hand', tile(hits('d...............|........t.......', { vel: 0.36 }), 2 * BAR, n / (2 * BAR))),
        ...leads(p.build),
      ],
      combat: [
        part('pad', held(p.chords, { vel: 0.5 })),
        part('strings', ostinato(p.chords, p.pluck, { step: 0.5, vel: 0.3, shift: 12, len: 0.5 })),
        part('brass', held(p.chords, { vel: 0.38, voices: [0, 1] })),
        part('hand', swell(hits('d.......d...d...d...d.d.d.d.dddd', { at: n - 2 * BAR, vel: 0.6 }), 0.5, 1.1)),
        part('timpani', swell(onRoots(p.chords, 'R-------', { at: n - 2 * BAR, step: 1, vel: 0.55, range: TIMP }), 0.6, 1)),
        ...leads(p.combat),
      ],
      tense: [
        part('strings', held(p.chords, { vel: 0.24, voices: [2, 3], shift: 12, art: 'trem' })),
        part('hand', tile(hits('D...............', { vel: 0.5 }), BAR, n / BAR), tile(hits('t...', { step: 1, vel: 0.28 }), BAR, n / BAR)),
        part('timpani', tile(onRoots(p.chords, 'o..o', { step: 0.25, vel: 0.38, range: TIMP }), 2 * BAR, n / (2 * BAR))),
        ...leads(p.tense),
      ],
    },
  };
}

function section(p: Plan): BattleSection {
  if (p.role === 'quiet') return quietSection(p);
  return { name: p.name, bars: beats(p) / BAR, role: p.role, layers: { build: buildLayer(p), combat: combatLayer(p), tense: tenseLayer(p) } };
}

const DOR = 'dorian' as const;
const P = 'phrygian' as const;

const PLANS: Plan[] = [
  {
    name: 'Before the wire',
    role: 'intro',
    chords: prog(BAR, [[1, D5], [1, D5], [1, D5], [1, C5], [1, D5], [1, D5], [1, Bb5], [1, A5]]),
    pluck: [0, -1, 1, -1, 2, -1, 1, 3],
    ostCombat: [0, 1, 2, 1, 3, 1, 2, 1, 0, 2, 3, 2, 1, 2, 3, 2],
    ostTense: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 2, 1, 0],
    handBuild: 'd.....t.d.......|d.....t.d.t.....',
    hand: 'D.ttd.t.D.t.d.tt|D.ttd.t.D.ttT.t.',
    timp: 'o.....o.|o...o...',
    stabs: 'x.......|....x...',
    build: [{ inst: 'horn', form: { tonic: 62, at: 16, take: 5, colour: DOR, vel: 0.4 } }],
    combat: [
      { inst: 'brass', form: { tonic: 50, at: 0, colour: DOR, vel: 0.75 }, fifths: true },
      { inst: 'brass', form: { tonic: 50, at: 16, colour: DOR, vel: 0.75 } },
    ],
    tense: [{ inst: 'horn', form: { tonic: 62, at: 8, invert: true, colour: P, vel: 0.45 } }],
  },
  {
    name: 'Columns in the dust',
    role: 'main',
    chords: prog(BAR, [[1, D5], [1, C5], [1, Bb5], [1, C5], [1, D5], [1, C5], [1, Bb5], [1, A5]]),
    pluck: [0, 2, -1, 1, -1, 2, 3, -1],
    ostCombat: [0, 2, 1, 2, 0, 3, 1, 3, 0, 2, 1, 2, 4, 3, 2, 1],
    ostTense: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 2, 0, 1, 0, 2],
    handBuild: 'd.......t...t...|d.......t.t.t...',
    hand: 'D..tD..tD.t.d.t.|D..tD..tD.ttd.tt',
    timp: 'o.o.o...|o.o.o.oo',
    stabs: 'x...x...|x.x.....',
    build: [{ inst: 'strings', form: { tonic: 62, at: 0, colour: DOR, vel: 0.28 } }],
    combat: [
      { inst: 'brass', form: { tonic: 50, at: 16, displace: 0.5, colour: DOR, vel: 0.75 }, fifths: true },
      { inst: 'horn', form: { tonic: 62, at: 0, take: 5, vel: 0.5 } },
    ],
    tense: [{ inst: 'horn', form: { tonic: 62, at: 0, take: 3, augment: 2, vel: 0.45 } }],
  },
  {
    name: 'The flanking march',
    role: 'main',
    chords: prog(BAR, [[1, G5], [1, F5], [1, G5], [1, D5], [1, G5], [1, F5], [1, Eb5], [1, A5]]),
    pluck: [0, -1, 2, 1, -1, 3, 2, -1],
    ostCombat: [0, 1, 0, 2, 0, 3, 0, 2, 0, 1, 0, 2, 3, 2, 1, 0],
    ostTense: [0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 2, 1, 0, 0],
    handBuild: 'd...t...d...t...|d...t...d.t.t...',
    hand: 'D.t.D.ttD.t.DttT|D.t.D.ttD.t.D.T.',
    timp: 'o..o..o.|o..o.o.o',
    stabs: '...x....|...x..x.',
    build: [{ inst: 'horn', form: { tonic: 55, at: 0, take: 5, colour: DOR, vel: 0.42 } }],
    combat: [
      { inst: 'brass', form: { tonic: 43, at: 0, colour: DOR, vel: 0.8 }, fifths: true },
      { inst: 'brass', form: { tonic: 43, at: 16, retrograde: true, vel: 0.8 }, fifths: true },
    ],
    tense: [{ inst: 'horn', form: { tonic: 67, at: 16, retrograde: true, colour: DOR, vel: 0.45 } }],
  },
  {
    name: 'Heat haze',
    role: 'quiet',
    chords: prog(BAR, [[1, D9], [1, D9], [1, Dsus4], [1, Dsus4], [1, Bb5], [1, Bb5], [1, Asus], [1, A5]]),
    pluck: [1, -1, -1, 2, -1, -1, 3, -1],
    ostCombat: [0, 2, 1, 2],
    ostTense: [0, -1, 1, -1],
    handBuild: '',
    hand: '',
    timp: '',
    stabs: '',
    build: [{ inst: 'horn', form: { tonic: 62, at: 4, augment: 2, take: 5, colour: DOR, vel: 0.36 } }],
    combat: [{ inst: 'brass', form: { tonic: 50, at: 8, augment: 2, take: 5, vel: 0.55 }, fifths: true }],
    tense: [{ inst: 'horn', form: { tonic: 62, at: 8, invert: true, augment: 2, take: 4, colour: P, vel: 0.36 } }],
  },
  {
    name: 'Tanks in the open',
    role: 'main',
    chords: prog(BAR, [[1, D5], [1, Eb5], [1, D5], [1, Eb5], [1, C5], [1, Bb5], [1, Eb5], [1, A5]]),
    pluck: [0, 1, -1, 1, 0, 1, -1, 3],
    ostCombat: [0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 2, 1, 0],
    ostTense: [0, 0, 1, 1, 0, 0, 2, 2, 0, 0, 1, 1, 0, 2, 1, 0],
    handBuild: 'd..d....t.......|d..d....t...t.t.',
    hand: 'D..D..t.D..D..tt|D..D..t.D.tDT.T.',
    timp: 'o..o..o.|o..o..oo',
    stabs: 'x..x....|x..x..x.',
    build: [
      { inst: 'horn', form: { tonic: 62, at: 4, take: 3, colour: P, vel: 0.4 } },
      { inst: 'horn', form: { tonic: 62, at: 20, take: 3, colour: P, vel: 0.4 } },
    ],
    combat: [{ inst: 'brass', form: { tonic: 38, at: 0, augment: 2, colour: P, vel: 0.85 }, fifths: true }],
    tense: [{ inst: 'horn', form: { tonic: 62, at: 0, invert: true, augment: 2, colour: P, vel: 0.42 } }],
  },
  {
    name: 'The escarpment',
    role: 'main',
    chords: prog(BAR, [[1, F5], [1, C5], [1, D5], [1, A5], [1, F5], [1, C5], [1, G5], [1, A5]]),
    pluck: [0, 2, 1, 3, -1, 2, 1, -1],
    ostCombat: [0, 2, 0, 3, 0, 2, 0, 1, 0, 2, 0, 3, 1, 2, 3, 4],
    ostTense: [0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 1, 2, 3, 2],
    handBuild: 'd.....t.....t...|d.....t...t.t...',
    hand: 'D.tDt.tDt.D.t.tt|D.tDt.tDt.D.T.T.',
    timp: 'o.oo....|o.oo..oo',
    stabs: 'x...x...|x...x.x.',
    build: [{ inst: 'strings', form: { tonic: 62, at: 16, take: 5, colour: DOR, vel: 0.3 } }],
    combat: [
      { inst: 'brass', form: { tonic: 41, at: 0, colour: 'major', vel: 0.78 }, fifths: true },
      { inst: 'brass', form: { tonic: 50, at: 16, step: 1, colour: DOR, vel: 0.78 } },
    ],
    tense: [{ inst: 'horn', form: { tonic: 62, at: 8, take: 5, invert: true, step: 3, vel: 0.45 } }],
  },
  {
    name: 'Night leaguer',
    role: 'quiet',
    chords: prog(BAR, [[1, Dm], [1, Dm], [1, Bb5], [1, Bb5], [1, G5], [1, G5], [1, Asus], [1, A5]]),
    pluck: [0, -1, 2, -1, -1, -1, 1, -1],
    ostCombat: [0, 1, 2, 1],
    ostTense: [0, -1, -1, 1],
    handBuild: '',
    hand: '',
    timp: '',
    stabs: '',
    build: [{ inst: 'horn', form: { tonic: 62, at: 0, augment: 2, colour: DOR, vel: 0.34 }, answer: true }],
    combat: [{ inst: 'brass', form: { tonic: 50, at: 0, augment: 2, take: 5, vel: 0.55 } }],
    tense: [{ inst: 'strings', form: { tonic: 74, at: 8, retrograde: true, augment: 2, take: 4, vel: 0.26 } }],
  },
  {
    name: 'The relief column',
    role: 'main',
    chords: prog(BAR, [[1, D5], [1, F5], [1, G5], [1, D5], [1, Bb5], [1, C5], [1, Dsus4], [1, A5]]),
    pluck: [0, 1, 2, -1, 3, 2, 1, -1],
    ostCombat: [0, 2, 1, 3, 0, 2, 1, 3, 0, 2, 1, 3, 2, 3, 4, 5],
    ostTense: [0, 0, 1, 0, 2, 0, 1, 0, 0, 0, 1, 0, 2, 0, 3, 0],
    handBuild: 'd.t.....d.t.....|d.t.....d.t.t.t.',
    hand: 'D.ttD.ttD.t.DtDt|D.ttD.ttDtDtD.T.',
    timp: 'o...o...|o.o.o.oo',
    stabs: 'x...x...|x...xxx.',
    build: [
      { inst: 'horn', form: { tonic: 62, at: 0, colour: DOR, vel: 0.42 } },
      { inst: 'horn', form: { tonic: 62, at: 16, colour: DOR, vel: 0.4 }, answer: true },
    ],
    combat: [
      { inst: 'brass', form: { tonic: 50, at: 0, colour: DOR, vel: 0.8 }, fifths: true },
      { inst: 'brass', form: { tonic: 50, at: 16, colour: DOR, vel: 0.8 }, answer: true, fifths: true },
    ],
    tense: [{ inst: 'horn', form: { tonic: 62, at: 16, take: 5, colour: DOR, vel: 0.45 } }],
  },
];

/** Victory: the answer in D major on the brass in bare fifths, the horn above, home on an open D with a last dum. */
const VICTORY: BattleSting = {
  beats: 12,
  parts: [
    part('brass', motif(BRITISH_ANSWER, { tonic: 50, colour: 'major', vel: 0.8 }), transpose(motif(BRITISH_ANSWER, { tonic: 50, colour: 'major', vel: 0.6 }), 7), line([[8, 4, 38, 0.8], [8, 4, 45, 0.7]])),
    part('horn', line([[8, 4, 66, 0.5]])),
    part('pad', line([[0, 12, 38, 0.6], [0, 12, 45, 0.5], [4, 8, 50, 0.5], [4, 8, 57, 0.5]])),
    part('strings', line([[8, 4, 62, 0.45], [8, 4, 69, 0.45], [8, 4, 74, 0.4]], 'trem')),
    part('timpani', swell(hits('R-------', { step: 1, vel: 0.55, note: 38 }), 0.5, 1), hits('o', { at: 8, vel: 0.9, note: 38 })),
    part('hand', swell(hits('d.d.d.d.ddddDDDD', { step: 0.5, vel: 0.6 }), 0.5, 1), hits('D', { at: 8, vel: 0.9 })),
  ],
};

/** Defeat: the head of the motif sinking in the Phrygian colour over a bare low fifth, three dums and the wind. */
const DEFEAT: BattleSting = {
  beats: 12,
  parts: [
    part('brass', motif(BRITISH_MOTIF, { tonic: 38, take: 3, augment: 2, colour: P, vel: 0.7 }), line([[8, 4, 39, 0.5], [8, 4, 38, 0.5]])),
    part('strings', line([[0, 12, 62, 0.3], [0, 12, 69, 0.26]], 'trem')),
    part('pad', line([[0, 12, 38, 0.55], [0, 12, 45, 0.45]])),
    part('hand', hits('D...d...d', { step: 1, vel: 0.7 })),
    part('timpani', hits('o.......o', { step: 1, vel: 0.6, note: 38 })),
  ],
};

export const CRUSADER: BattleTrackDef = {
  title: 'Wind over Sidi Rezegh',
  theme: 'british',
  bpm: 126,
  beatsPerBar: BAR,
  tonic: 2,
  layerLevel: { build: 1.5, combat: 1, tense: 1.27, prep: 1.5 },
  gain: 0.8,
  humanize: { time: 0.007, velocity: 0.1 },
  seed: 411118,
  instruments: { ...BATTLE_KIT, hand: { ...BATTLE_KIT.hand, dumDecay: 0.28, tekDecay: 0.06, level: 0.4 } },
  mix: { ...BATTLE_MIX, reverb: 0.3, hand: { dry: 0.9, send: 0.15 }, horn: { dry: 0.6, send: 0.5 } },
  reverb: { ...BATTLE_REVERB, seconds: 0.9, preDelay: 0.012, brightHz: 4200, darkHz: 700, seed: 411118 },
  sections: PLANS.map(section),
  stings: { victory: VICTORY, defeat: DEFEAT },
};
