/**
 * Mission 4, El Alamein 1942: "The Guns of Alamein Ridge". The desert again, heavier and more resolved than Crusader:
 * G minor at 112 BPM, the low brass doubled in octaves, a heavy half-time snare, hand drums doubling the timpani, and
 * phrases that close with the motif's answer coming home. It opens with the massed guns: the first section is a
 * barrage of timpani volleys rippling along the line under a low brass statement of the British motif "The Line"
 * (src/data/musicThemes.ts). The last section turns to B flat major, the tide turned. Seven sections of eight bars
 * (356 s of distinct music in three layers), plus two stings. Written for Tin Hats; it quotes no existing melody,
 * march, call or score.
 */
import type { BattleSection, BattleSting, BattleTrackDef, MusicEvent, MusicPart } from '../musicBattle';
import { bass, held, hits, line, onRoots, ostinato, part, prog, swell, tile, transpose, type ChordSpan } from '../musicKit';
import { BRITISH_ANSWER, BRITISH_MOTIF, motif, type MotifForm } from '../musicThemes';
import { BATTLE_KIT, BATTLE_MIX, BATTLE_REVERB } from './kit';

const BAR = 4;
const TIMP: readonly [number, number] = [36, 52];

// Chords, low to high (MIDI): G minor with its Neapolitan-coloured A flat, the F sharp diminished seventh and D major.
const Gm = [43, 50, 55, 58];
const Eb = [39, 51, 55, 58];
const Ebmaj7 = [39, 50, 55, 58];
const Cm = [36, 48, 51, 55];
const Cm7 = [36, 46, 51, 55];
const D = [38, 50, 54, 57];
const Dsus = [38, 50, 55, 57];
const Bb = [46, 50, 53, 58];
const F = [41, 48, 53, 57];
const Ab = [44, 51, 56, 60];
const Fsdim7 = [42, 48, 51, 57];

interface Lead {
  inst: 'horn' | 'strings' | 'brass';
  form: MotifForm;
  answer?: boolean;
  /** Doubled an octave below (low brass): the weight of the thing. */
  octave?: boolean;
}

interface Plan {
  name: string;
  role: BattleSection['role'];
  chords: ChordSpan[];
  ostBuild: readonly number[];
  ostCombat: readonly number[];
  ostTense: readonly number[];
  /** Two bars of sixteenths, the heavy snare (last bar of the section is a fill). */
  snare: string;
  /** Two bars of eighths: timpani (doubled by the hand drum's dum) and brass stabs in octaves on the roots. */
  timp: string;
  stabs: string;
  /** Beats where a volley of the massed guns goes off, per layer (the opening section). */
  volleys?: { build: readonly number[]; combat: readonly number[]; tense: readonly number[] };
  build: readonly Lead[];
  combat: readonly Lead[];
  tense: readonly Lead[];
}

function leads(list: readonly Lead[]): MusicPart[] {
  return list.map((l) => {
    const m = motif(l.answer ? BRITISH_ANSWER : BRITISH_MOTIF, { art: l.inst === 'strings' ? 'long' : undefined, ...l.form });
    return part(l.inst, m, l.octave ? transpose(m, -12).map((e) => ({ ...e, vel: e.vel * 0.85 })) : []);
  });
}

const beats = (p: Plan): number => p.chords.reduce((n, c) => n + c.beats, 0);

function rep(pattern: string, times: number): string {
  return Array.from({ length: Math.round(times) }, () => pattern).join('');
}

/** One volley: guns along the line going off a fraction apart, at different pitches. [beats after, MIDI, share]. */
const VOLLEY: readonly (readonly [number, number, number])[] = [
  [0, 43, 1],
  [0.17, 38, 0.8],
  [0.42, 46, 0.7],
  [0.58, 36, 0.9],
  [0.92, 41, 0.6],
  [1.25, 38, 0.5],
];

/** A barrage: a volley at each of `times`, each one rotated so no two sound alike, under a rumbling roll. */
function barrage(times: readonly number[], vel: number): MusicEvent[] {
  return times.flatMap((t, k) =>
    VOLLEY.map(([dt, , share], i) => ({ at: t + dt, len: 0, note: VOLLEY[(i + k) % VOLLEY.length][1], vel: Math.min(1, vel * share), art: 'hit' as const })),
  );
}

/** Calm: an eighth-note string figure, a slow bass, a dum on the bar, the motif in the distance. */
function buildLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  const out: MusicPart[] = [
    part('strings', ostinato(p.chords, p.ostBuild, { step: 0.5, vel: 0.32, accents: [0], accent: 1.3 }), bass(p.chords, 'x.......', { step: 0.5, vel: 0.32 })),
    part('pad', held(p.chords, { vel: 0.58, voices: [0, 1, 2] })),
    part('hand', tile(hits('D...............|d.......d.......', { vel: 0.42 }), 2 * BAR, n / (2 * BAR))),
    part('timpani', p.volleys ? barrage(p.volleys.build, 0.32) : onRoots(p.chords, 'o.......|........', { step: 0.5, vel: 0.36, range: TIMP })),
    ...leads(p.build),
  ];
  return out;
}

/** Heavy fighting: sixteenths over an octave bass, the half-time snare, timpani with dums, stabs in octaves, low brass. */
function combatLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  const reps = n / (2 * BAR);
  const snare = tile(hits(p.snare, { vel: 0.72 }), 2 * BAR, reps).filter((e) => e.at < n - BAR);
  const fill = swell(hits('X..xX..xX.xxR---', { at: n - BAR, vel: 0.72 }), 0.75, 1.1);
  const timp = p.volleys ? barrage(p.volleys.combat, 0.7) : onRoots(p.chords, rep(p.timp, reps), { step: 0.5, vel: 0.66, range: TIMP });
  const stabs = onRoots(p.chords, rep(p.stabs, reps), { step: 0.5, vel: 0.62, range: [36, 47] }).flatMap((e) => [
    { ...e, len: 0.45, art: 'stab' as const },
    { ...e, note: e.note - 12 >= 28 ? e.note - 12 : e.note + 12, len: 0.45, vel: e.vel * 0.8, art: 'stab' as const },
  ]);
  return [
    part('strings', ostinato(p.chords, p.ostCombat, { step: 0.25, vel: 0.52, shift: 12, accents: [0, 8], accent: 1.35 }), bass(p.chords, 'X.x.8.x.', { step: 0.5, vel: 0.5 })),
    part('pad', held(p.chords, { vel: 0.5, voices: [1, 2, 3] })),
    part('snare', snare, fill),
    part('timpani', timp),
    part('hand', p.volleys ? p.volleys.combat.map((at) => ({ at, len: 0, note: 0, vel: 0.6, art: 'dum' as const })) : hits(rep(p.timp, reps).replace(/o/g, 'D'), { step: 0.5, vel: 0.55 })),
    part('brass', stabs),
    ...leads(p.combat),
  ];
}

/** HQ in danger: high tremolo over a pedal figure, a rim clock, the heartbeat timpani, low brass held, guns far off. */
function tenseLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  return [
    part('strings', held(p.chords, { vel: 0.28, voices: [1, 2, 3], shift: 12, art: 'trem' }), ostinato(p.chords, p.ostTense, { step: 0.25, vel: 0.36, shift: 12 })),
    part('snare', tile(hits('r.g.r.g.r.g.r.g.', { vel: 0.28 }), BAR, n / BAR)),
    part('timpani', p.volleys ? barrage(p.volleys.tense, 0.4) : onRoots(p.chords, rep('o..o............', n / BAR), { step: 0.25, vel: 0.5, range: TIMP })),
    part('hand', tile(hits('..t...t...t...tt', { vel: 0.26 }), BAR, n / BAR)),
    part('brass', held(p.chords.filter((_, i) => i % 2 === 0), { vel: 0.32, voices: [0, 1] })),
    ...leads(p.tense),
  ];
}

/** After the dust: long chords, the motif slowed down, the guns silent; the louder layers keep the space. */
function quietSection(p: Plan): BattleSection {
  const n = beats(p);
  return {
    name: p.name,
    bars: n / BAR,
    role: 'quiet',
    layers: {
      build: [part('pad', held(p.chords, { vel: 0.55 })), part('strings', held(p.chords, { vel: 0.22, voices: [0, 2], art: 'long' })), part('timpani', onRoots(p.chords, 'o', { step: 1, vel: 0.3, range: TIMP })), ...leads(p.build)],
      combat: [
        part('pad', held(p.chords, { vel: 0.5 })),
        part('strings', ostinato(p.chords, p.ostBuild, { step: 0.5, vel: 0.3 })),
        part('brass', held(p.chords, { vel: 0.42, voices: [0, 1] })),
        part('timpani', swell(onRoots(p.chords, 'R-------', { at: n - 2 * BAR, step: 1, vel: 0.62, range: TIMP }), 0.6, 1)),
        part('hand', swell(hits('D.......D...D...D.D.D.D.DDDDDDDD', { at: n - 2 * BAR, vel: 0.55 }), 0.5, 1.1)),
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

const H = 'harmonic' as const;
const P = 'phrygian' as const;

const PLANS: Plan[] = [
  {
    name: 'The barrage',
    role: 'intro',
    chords: prog(BAR, [[1, Gm], [1, Gm], [1, Ab], [1, Gm], [1, Eb], [1, Cm], [1, Dsus], [1, D]]),
    ostBuild: [0, 1, 2, 1, 0, 1, 2, 3],
    ostCombat: [0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 1, 0, 3, 2, 1, 0],
    ostTense: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 2, 1, 0],
    snare: 'R-------X.......|R-------X...x.x.',
    timp: '',
    stabs: 'x.......|x.......',
    volleys: {
      build: [0, 3, 6.5, 9, 12, 14.5, 17, 20, 22.5, 25, 27.5],
      combat: [0, 1.5, 3, 4, 6, 7.5, 8, 9.5, 11, 12, 14, 15.5, 16, 17.5, 19, 20, 22, 23.5, 24, 26, 27.5],
      tense: [0, 5, 10, 14, 18, 23, 27],
    },
    build: [{ inst: 'horn', form: { tonic: 55, at: 16, take: 5, vel: 0.38 } }],
    combat: [
      { inst: 'brass', form: { tonic: 43, at: 0, vel: 0.85 }, octave: true },
      { inst: 'brass', form: { tonic: 43, at: 16, colour: H, vel: 0.85 }, octave: true },
    ],
    tense: [{ inst: 'horn', form: { tonic: 67, at: 8, invert: true, colour: P, vel: 0.45 } }],
  },
  {
    name: 'Through the minefields',
    role: 'main',
    chords: prog(BAR, [[1, Gm], [1, F], [1, Eb], [1, D], [1, Gm], [1, F], [1, Eb], [1, D]]),
    ostBuild: [0, 2, 1, 2, 3, 2, 1, 2],
    ostCombat: [0, 1, 2, 1, 3, 1, 2, 1, 0, 2, 3, 2, 1, 2, 3, 2],
    ostTense: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 2, 0, 1, 0, 2],
    snare: 'X.......x..xX...|X.......x.x.X.x.',
    timp: 'o...o...|o...o.o.',
    stabs: 'x...x...|x.x.....',
    build: [{ inst: 'strings', form: { tonic: 55, at: 0, vel: 0.3 } }],
    combat: [
      { inst: 'brass', form: { tonic: 43, at: 0, vel: 0.85 }, octave: true },
      { inst: 'brass', form: { tonic: 43, at: 16, colour: H, vel: 0.85 }, answer: true },
    ],
    tense: [{ inst: 'horn', form: { tonic: 67, at: 0, take: 3, augment: 2, vel: 0.45 } }],
  },
  {
    name: 'Clearing the lanes',
    role: 'main',
    chords: prog(BAR, [[1, Cm], [1, Gm], [1, Cm], [1, Gm], [1, Eb], [1, Bb], [1, Fsdim7], [1, D]]),
    ostBuild: [0, 2, 3, 2, 1, 2, 3, 2],
    ostCombat: [0, 1, 0, 2, 0, 3, 0, 2, 0, 1, 0, 2, 3, 2, 1, 0],
    ostTense: [0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 2, 1, 0, 0],
    snare: 'X..x....X..x..x.|X..x....X..xX.x.',
    timp: 'o..o....|o..o..o.',
    stabs: '...x....|...x..x.',
    build: [{ inst: 'horn', form: { tonic: 60, at: 0, take: 5, vel: 0.4 } }],
    combat: [
      { inst: 'brass', form: { tonic: 48, at: 0, retrograde: true, vel: 0.8 }, octave: true },
      { inst: 'brass', form: { tonic: 43, at: 16, step: 2, colour: H, vel: 0.8 } },
    ],
    tense: [{ inst: 'horn', form: { tonic: 67, at: 16, retrograde: true, colour: H, vel: 0.45 } }],
  },
  {
    name: 'Armour on the ridge',
    role: 'main',
    chords: prog(BAR, [[1, Gm], [1, Ab], [1, Gm], [1, Ab], [1, Eb], [1, F], [1, Dsus], [1, D]]),
    ostBuild: [0, 0, 2, 0, 0, 0, 3, 0],
    ostCombat: [0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 2, 1, 0],
    ostTense: [0, 0, 1, 1, 0, 0, 2, 2, 0, 0, 1, 1, 0, 2, 1, 0],
    snare: 'X.......X.x.....|X.......X.x.x.xx',
    timp: 'o.o.o.o.|o.o.o.oo',
    stabs: 'x.x.....|x.x.....',
    build: [
      { inst: 'horn', form: { tonic: 55, at: 4, take: 3, colour: P, vel: 0.4 } },
      { inst: 'horn', form: { tonic: 55, at: 20, take: 3, colour: P, vel: 0.4 } },
    ],
    combat: [{ inst: 'brass', form: { tonic: 43, at: 0, augment: 2, colour: P, vel: 0.85 }, octave: true }],
    tense: [{ inst: 'horn', form: { tonic: 67, at: 0, invert: true, augment: 2, vel: 0.42 } }],
  },
  {
    name: 'Dust settling',
    role: 'quiet',
    chords: prog(BAR, [[1, Ebmaj7], [1, Ebmaj7], [1, Cm7], [1, Cm7], [1, Gm], [1, Gm], [1, Dsus], [1, D]]),
    ostBuild: [0, 2, 3, 2, 1, 2, 3, 2],
    ostCombat: [0, 2, 1, 2],
    ostTense: [0, -1, 1, -1],
    snare: '',
    timp: '',
    stabs: '',
    build: [{ inst: 'horn', form: { tonic: 55, at: 4, augment: 2, take: 5, vel: 0.36 } }],
    combat: [{ inst: 'brass', form: { tonic: 43, at: 8, augment: 2, take: 5, vel: 0.6 } }],
    tense: [{ inst: 'horn', form: { tonic: 67, at: 8, invert: true, augment: 2, take: 4, vel: 0.36 } }],
  },
  {
    name: 'The breakout',
    role: 'main',
    chords: prog(BAR, [[1, Gm], [1, Eb], [1, Bb], [1, F], [1, Gm], [1, Eb], [1, Cm], [1, D]]),
    ostBuild: [0, 1, 2, 3, 2, 1, 2, 3],
    ostCombat: [0, 2, 1, 3, 0, 2, 1, 3, 0, 2, 1, 3, 2, 3, 4, 5],
    ostTense: [0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 1, 2, 3, 2],
    snare: 'X..x..x.X.......|X..x..x.X...x.xx',
    timp: 'o..o..o.|o...o.oo',
    stabs: 'x..x..x.|x.......',
    build: [{ inst: 'horn', form: { tonic: 55, at: 0, vel: 0.42 } }],
    combat: [
      { inst: 'brass', form: { tonic: 43, at: 0, vel: 0.85 }, octave: true },
      { inst: 'brass', form: { tonic: 43, at: 16, displace: 0.5, colour: H, vel: 0.8 } },
      { inst: 'strings', form: { tonic: 67, at: 16, colour: H, vel: 0.4 } },
    ],
    tense: [{ inst: 'horn', form: { tonic: 67, at: 16, take: 5, step: 1, vel: 0.45 } }],
  },
  {
    name: 'The tide turns',
    role: 'main',
    chords: prog(BAR, [[1, Bb], [1, F], [1, Gm], [1, Eb], [1, Bb], [1, F], [1, Dsus], [1, D]]),
    ostBuild: [0, 1, 2, 1, 3, 1, 2, 1],
    ostCombat: [0, 2, 1, 2, 0, 3, 1, 3, 0, 2, 1, 2, 4, 3, 2, 1],
    ostTense: [0, 0, 1, 0, 2, 0, 1, 0, 0, 0, 1, 0, 2, 0, 3, 0],
    snare: 'X.x.X...X.x.X...|X.x.X...X.xxX.x.',
    timp: 'o...o...|o.o.o.oo',
    stabs: 'x...x...|x...xxx.',
    build: [
      { inst: 'horn', form: { tonic: 58, at: 0, colour: 'major', vel: 0.42 } },
      { inst: 'horn', form: { tonic: 55, at: 16, vel: 0.42 }, answer: true },
    ],
    combat: [
      { inst: 'brass', form: { tonic: 46, at: 0, colour: 'major', vel: 0.85 }, octave: true },
      { inst: 'brass', form: { tonic: 43, at: 16, vel: 0.85 }, answer: true, octave: true },
      { inst: 'strings', form: { tonic: 70, at: 0, colour: 'major', vel: 0.36 } },
    ],
    tense: [
      { inst: 'horn', form: { tonic: 58, at: 0, colour: 'major', vel: 0.45 } },
      { inst: 'horn', form: { tonic: 55, at: 16, colour: H, vel: 0.45 }, answer: true },
    ],
  },
];

/** Victory: the answer in G major in octave brass over alternating timpani, home on G major with a last dum. */
const VICTORY: BattleSting = {
  beats: 12,
  parts: [
    part('brass', motif(BRITISH_ANSWER, { tonic: 55, colour: 'major', vel: 0.8 }), motif(BRITISH_ANSWER, { tonic: 43, colour: 'major', vel: 0.7 }), line([[8, 4, 31, 0.8], [8, 4, 38, 0.7]])),
    part('pad', line([[0, 12, 43, 0.6], [0, 12, 50, 0.5], [4, 8, 59, 0.5], [4, 8, 62, 0.5]])),
    part('strings', line([[8, 4, 67, 0.5], [8, 4, 71, 0.45], [8, 4, 74, 0.45]], 'trem')),
    part('timpani', swell(hits('o.o.o.o.o.o.o.o.', { step: 0.5, vel: 0.55 }).map((e, i) => ({ ...e, note: i % 2 === 0 ? 43 : 38 })), 0.5, 1), hits('o', { at: 8, vel: 0.9, note: 43 })),
    part('hand', hits('D', { at: 8, vel: 0.9 })),
    part('snare', swell(hits('R-------', { step: 1, vel: 0.5 }), 0.4, 1), hits('F', { at: 8, vel: 0.8 })),
  ],
};

/** Defeat: the head of the motif sinking low in the Phrygian colour while the guns fall silent one by one. */
const DEFEAT: BattleSting = {
  beats: 12,
  parts: [
    part('brass', motif(BRITISH_MOTIF, { tonic: 43, take: 3, augment: 2, colour: P, vel: 0.7 }), motif(BRITISH_MOTIF, { tonic: 31, take: 3, augment: 2, colour: P, vel: 0.55 }), line([[8, 4, 44, 0.5], [8, 4, 43, 0.5]])),
    part('strings', line([[0, 12, 67, 0.3], [0, 12, 70, 0.26], [0, 12, 74, 0.24]], 'trem')),
    part('pad', line([[0, 12, 43, 0.55], [0, 12, 50, 0.45]])),
    part('timpani', barrage([0, 3.5], 0.5), hits('o', { at: 8, vel: 0.6, note: 43 })),
  ],
};

export const ALAMEIN: BattleTrackDef = {
  title: 'The Guns of Alamein Ridge',
  theme: 'british',
  bpm: 112,
  beatsPerBar: BAR,
  tonic: 7,
  layerLevel: { build: 1.5, combat: 1, tense: 1.27, prep: 1.5 },
  gain: 0.8,
  humanize: { time: 0.006, velocity: 0.08 },
  seed: 421023,
  instruments: { ...BATTLE_KIT, snare: { ...BATTLE_KIT.snare, toneHz: 190, toneEndHz: 150, decay: 0.21 }, hand: { ...BATTLE_KIT.hand, dumHz: 88, dumEndHz: 64, dumDecay: 0.38 } },
  mix: { ...BATTLE_MIX, reverb: 0.38, hand: { dry: 0.85, send: 0.2 } },
  reverb: { ...BATTLE_REVERB, seconds: 1.3, brightHz: 3800, darkHz: 600, seed: 421023 },
  sections: PLANS.map(section),
  stings: { victory: VICTORY, defeat: DEFEAT },
};
