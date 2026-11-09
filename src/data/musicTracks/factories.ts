/**
 * Mission 1008, the Tractor Factory, October 1942: "The Cold Furnaces". The Stalingrad ruins track, industrial and
 * cold (src/data/musicTracks/sovietKit.ts): D minor at 136 BPM over a low string ostinato in stacked diatonic fourths,
 * the anvil on the off-beats, brass stabs, and the Soviet motif "The Long Winter" (src/data/musicThemes.ts) in
 * diminution as a hammering figure on anvil and brass. While calm, the ostinato ticks softly under a far horn and the
 * draught through the broken halls; the tense layer is a high cluster tremolo over a heartbeat; the prep layer a slow
 * metallic clank. The quiet section is the shop floor at night: the choir, the wind and one anvil far off. Six
 * sections of eight bars in four layers (339 s of distinct music), plus two stings. Written for Tin Hats; it quotes
 * no existing melody, march, call, hymn, folk tune or score.
 */
import type { BattleSection, BattleSting, BattleTrackDef, MusicEvent, MusicPart } from '../musicBattle';
import { bass, chordAt, fit, held, hits, line, onRoots, part, prog, swell, tile, type ChordSpan } from '../musicKit';
import { degreeNote, motif, SCALES, SOVIET_ANSWER, SOVIET_MOTIF, type MotifForm } from '../musicThemes';
import { SOVIET_KIT, SOVIET_MIX, SOVIET_REVERB } from './sovietKit';

const BAR = 4;
const TIMP: readonly [number, number] = [38, 50];
/** D2, the key's tonic in the ostinato's register. */
const D2 = 38;

// Chords, low to high (MIDI). D minor, bare and hard: open fifths, sus fourths, the Phrygian E flat over D.
const Dm5 = [38, 45, 50, 57];
const Dm = [38, 45, 50, 53];
const Dsus4 = [38, 45, 50, 55];
const Bb = [46, 53, 58, 62];
const Gm = [43, 50, 55, 58];
const Gm4 = [43, 48, 50, 55];
const A5 = [45, 52, 57, 64];
const Asus = [45, 50, 52, 57];
const C5 = [36, 43, 48, 55];
const F = [41, 48, 53, 57];
const EbonD = [38, 46, 51, 55];

/** The diatonic step number of a note of D natural minor, counted from D2 (a chromatic note counts as the step below). */
function stepOf(note: number): number {
  const rel = note - D2;
  const oct = Math.floor(rel / 12);
  const pc = rel - 12 * oct;
  let i = SCALES.minor.length - 1;
  while (i > 0 && SCALES.minor[i] > pc) i--;
  return 7 * oct + i;
}

/**
 * The ostinato in fourths: each step plays the chord root (moved into [lo, lo + 11]) plus pattern[k] diatonic fourths
 * (three scale steps each) above it, so the line is a stack of fourths (D G C, A D G), hard where the key makes one
 * augmented (B flat E). -1 rests.
 */
function fourths(chords: readonly ChordSpan[], pattern: readonly number[], o: { step: number; vel: number; lo: number; accents?: readonly number[]; accent?: number }): MusicEvent[] {
  const end = chords[chords.length - 1].at + chords[chords.length - 1].beats;
  const out: MusicEvent[] = [];
  let k = 0;
  for (let t = 0; t < end - 1e-9; t += o.step, k++) {
    const idx = pattern[k % pattern.length];
    if (idx < 0) continue;
    const root = fit(chordAt(chords, t).notes[0], o.lo, o.lo + 11);
    const note = degreeNote(D2, 'minor', stepOf(root) + 3 * idx);
    const accented = o.accents?.includes(k % pattern.length) === true;
    out.push({ at: t, len: o.step * 0.85, note, vel: Math.min(1, o.vel * (accented ? (o.accent ?? 1.3) : 1)), art: 'short' });
  }
  return out;
}

type LeadInst = 'horn' | 'strings' | 'brass' | 'anvil' | 'choir' | 'bell';

interface Lead {
  inst: LeadInst;
  form: MotifForm;
  answer?: boolean;
  /** Brass played short: the hammering figure. */
  stab?: boolean;
}

interface Plan {
  name: string;
  role: BattleSection['role'];
  chords: ChordSpan[];
  /** The ostinato in fourths: stack indices in eighths (build) and sixteenths (combat). */
  ostBuild: readonly number[];
  ostCombat: readonly number[];
  /** Two bars of sixteenths: the snare, and the anvil (its pitch below). */
  snare: string;
  anvil: string;
  anvilNote: number;
  /** Two bars of eighths for the combat timpani and the brass stabs, on the chord roots. */
  timp: string;
  stabs: string;
  build: readonly Lead[];
  combat: readonly Lead[];
  tense: readonly Lead[];
  prep: readonly Lead[];
}

function leads(list: readonly Lead[]): MusicPart[] {
  return list.map((l) => {
    const art = l.inst === 'strings' ? 'long' : l.stab ? 'stab' : undefined;
    return part(l.inst, motif(l.answer ? SOVIET_ANSWER : SOVIET_MOTIF, { art, ...l.form }));
  });
}

const beats = (p: Plan): number => p.chords.reduce((n, c) => n + c.beats, 0);

function rep(pattern: string, reps: number): string {
  return Array.from({ length: Math.round(reps) }, () => pattern).join('');
}

/** The draught through the broken halls: a low band of wind for the whole section. */
function draught(p: Plan, vel: number, note = 70): MusicEvent[] {
  return line([[0, beats(p), note, vel]]);
}

/** Calm: the fourths ticking softly, the pad, the anvil off-beats far back, a timpani on each phrase, the draught. */
function buildLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  return [
    part('strings', fourths(p.chords, p.ostBuild, { step: 0.5, vel: 0.3, lo: D2, accents: [0] })),
    part('pad', held(p.chords, { vel: 0.52, voices: [0, 1, 2] })),
    part('anvil', tile(hits('..o...o.', { step: 0.5, vel: 0.22, note: p.anvilNote }), 2 * BAR, n / (2 * BAR))),
    part('timpani', onRoots(p.chords, rep('o...............|................', n / (4 * BAR)), { step: 0.5, vel: 0.34, range: TIMP })),
    part('wind', draught(p, 0.34)),
    ...leads(p.build),
  ];
}

/** The fight in the halls: sixteenth fourths, the snare, the anvil hammering the off-beats, timpani and brass stabs. */
function combatLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  const reps = n / (2 * BAR);
  const snare = tile(hits(p.snare, { vel: 0.68 }), 2 * BAR, reps).filter((e) => e.at < n - BAR);
  const fill = swell(hits('x.xxx.xxR-------', { at: n - BAR, vel: 0.68 }), 0.7, 1.1);
  return [
    part('strings', fourths(p.chords, p.ostCombat, { step: 0.25, vel: 0.5, lo: D2, accents: [0, 6, 12] }), bass(p.chords, 'X...x...', { step: 0.5, vel: 0.42, shift: 12 })),
    part('snare', snare, fill),
    part('anvil', tile(hits(p.anvil, { vel: 0.5, note: p.anvilNote }), 2 * BAR, reps)),
    part('timpani', onRoots(p.chords, rep(p.timp, reps), { step: 0.5, vel: 0.62, range: TIMP })),
    part('brass', onRoots(p.chords, rep(p.stabs, reps), { step: 0.5, vel: 0.62, range: [38, 50] }).map((e) => ({ ...e, len: 0.4, art: 'stab' as const }))),
    part('pad', held(p.chords, { vel: 0.4, voices: [1, 2] })),
    ...leads(p.combat),
  ];
}

/** A cluster: the chord's top note an octave up with the semitone and minor third above it, glassy and close. */
function cluster(chords: readonly ChordSpan[]): ChordSpan[] {
  return chords.map((c) => {
    const top = c.notes[c.notes.length - 1] + 12;
    return { ...c, notes: [top, top + 1, top + 3] };
  });
}

/** Breaking through: the high cluster tremolo, the fourths pulsing in eighths, a rim and a heartbeat, a low pedal. */
function tenseLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  return [
    part('strings', held(cluster(p.chords), { vel: 0.22, art: 'trem' }), fourths(p.chords, [0, -1, 1, -1], { step: 0.5, vel: 0.36, lo: D2 })),
    part('snare', tile(hits('r...r.g.r...r.g.', { vel: 0.3 }), BAR, n / BAR - 1), swell(hits('R---------------', { at: n - BAR, vel: 0.42 }), 0.3, 1)),
    part('timpani', onRoots(p.chords, rep('o..o............', n / BAR), { step: 0.25, vel: 0.48, range: TIMP })),
    part('brass', held(p.chords.filter((_, i) => i % 2 === 0).map((c) => ({ ...c, beats: 2 * BAR })), { vel: 0.3, voices: [0] })),
    part('anvil', tile(hits('o.......', { step: 0.5, vel: 0.26, note: p.anvilNote + 5 }), BAR, n / BAR)),
    ...leads(p.tense),
  ];
}

/** Waiting for them: a slow metallic clank, low timpani, a held pedal and harmonics, a roll into the last bar. */
function prepLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  return [
    part('pad', held(p.chords, { vel: 0.46, voices: [0, 1] })),
    part('strings', held(p.chords, { vel: 0.15, voices: [3], shift: 24, art: 'long' }), bass(p.chords, 'x.......|........', { step: 0.5, vel: 0.3 })),
    part('anvil', tile(hits('o.......|....o...', { step: 0.5, vel: 0.36, note: p.anvilNote - 12 }), 2 * BAR, n / (2 * BAR))),
    part('timpani', onRoots(p.chords, rep('o.......|..o.....', n / (2 * BAR)), { step: 0.5, vel: 0.36, range: TIMP })),
    part('snare', swell(hits('R---------------', { at: n - BAR, vel: 0.34 }), 0.3, 1)),
    part('wind', draught(p, 0.3, 66)),
    ...leads(p.prep),
  ];
}

/** The shop floor at night: choir, wind, one anvil far off; the other layers keep its shape, quietly. */
function quietSection(p: Plan): BattleSection {
  const n = beats(p);
  return {
    name: p.name,
    bars: n / BAR,
    role: 'quiet',
    layers: {
      build: [
        part('choir', held(p.chords, { vel: 0.5, voices: [1, 2, 3] })),
        part('wind', draught(p, 0.42, 74)),
        part('anvil', hits('o', { at: 2 * BAR + 2.5, vel: 0.2, note: p.anvilNote }), hits('o', { at: 6 * BAR + 0.5, vel: 0.16, note: p.anvilNote - 5 })),
        part('timpani', onRoots(p.chords, 'o', { step: 1, vel: 0.26, range: TIMP })),
        ...leads(p.build),
      ],
      combat: [
        part('choir', held(p.chords, { vel: 0.46, voices: [1, 2, 3] })),
        part('strings', fourths(p.chords, p.ostBuild, { step: 0.5, vel: 0.3, lo: D2 })),
        part('brass', held(p.chords, { vel: 0.36, voices: [0] })),
        part('timpani', swell(onRoots(p.chords, 'R-------', { at: n - 2 * BAR, step: 1, vel: 0.56, range: TIMP }), 0.6, 1)),
        part('snare', swell(hits('R-------', { at: n - 2 * BAR, step: 1, vel: 0.42 }), 0.5, 1)),
        ...leads(p.combat),
      ],
      tense: [
        part('strings', held(cluster(p.chords), { vel: 0.2, art: 'trem' })),
        part('snare', tile(hits('r...', { step: 1, vel: 0.26 }), BAR, n / BAR)),
        part('timpani', tile(onRoots(p.chords, 'o..o', { step: 0.25, vel: 0.38, range: TIMP }), 2 * BAR, n / (2 * BAR))),
        part('wind', draught(p, 0.3, 74)),
        ...leads(p.tense),
      ],
      prep: [
        part('choir', held(p.chords, { vel: 0.5, voices: [1, 2] })),
        part('anvil', tile(hits('o.......|........', { step: 0.5, vel: 0.3, note: p.anvilNote - 12 }), 2 * BAR, n / (2 * BAR))),
        part('wind', draught(p, 0.38, 70)),
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

const PLANS: Plan[] = [
  {
    name: 'The furnaces are cold',
    role: 'intro',
    chords: prog(BAR, [[1, Dm5], [1, Dm5], [1, Bb], [1, Bb], [1, Gm], [1, Gm], [1, Asus], [1, A5]]),
    ostBuild: [0, 1, 2, 1, 0, 1, 2, 1],
    ostCombat: [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 0, 2, 1, 2],
    snare: 'X..x..x.X.r.x...|X..x..x.x...X.x.',
    anvil: '..o...o...o...o.|..o...o...o..oo.',
    anvilNote: 81,
    timp: 'o.....o.|o...o...',
    stabs: 'x.......|....x...',
    build: [{ inst: 'horn', form: { tonic: 62, at: 16, vel: 0.38 } }],
    combat: [
      { inst: 'anvil', form: { tonic: 86, at: 0, augment: 0.5, vel: 0.55 } },
      { inst: 'brass', form: { tonic: 38, at: 8, augment: 0.5, vel: 0.8 }, stab: true },
      { inst: 'brass', form: { tonic: 38, at: 16, vel: 0.8 } },
    ],
    tense: [{ inst: 'horn', form: { tonic: 62, at: 8, invert: true, take: 5, colour: PH, vel: 0.44 } }],
    prep: [{ inst: 'horn', form: { tonic: 62, at: 16, take: 4, augment: 2, vel: 0.3 } }],
  },
  {
    name: 'Rails in the yard',
    role: 'main',
    chords: prog(BAR, [[1, Dm], [1, C5], [1, Bb], [1, A5], [1, Dm], [1, C5], [1, Gm], [1, Asus]]),
    ostBuild: [0, 1, 0, 2, 0, 1, 0, 2],
    ostCombat: [0, 1, 0, 2, 0, 1, 0, 2, 0, 1, 0, 2, 1, 2, 1, 0],
    snare: 'X.x.x.xxX.x.x.x.|X.x.x.xxX.r.x.r.',
    anvil: '..o...o...o...o.|..o...o...o...o.',
    anvilNote: 79,
    timp: 'o.o.o...|o.o.o.oo',
    stabs: 'x...x...|x.x.....',
    build: [{ inst: 'strings', form: { tonic: 74, at: 0, vel: 0.26 } }],
    combat: [
      { inst: 'brass', form: { tonic: 38, at: 0, augment: 0.5, vel: 0.8 }, stab: true },
      { inst: 'brass', form: { tonic: 38, at: 6, augment: 0.5, step: 2, vel: 0.8 }, stab: true },
      { inst: 'horn', form: { tonic: 62, at: 16, vel: 0.55 } },
    ],
    tense: [{ inst: 'horn', form: { tonic: 62, at: 0, take: 4, augment: 2, vel: 0.44 } }],
    prep: [{ inst: 'bell', form: { tonic: 74, at: 0, take: 4, vel: 0.3 } }],
  },
  {
    name: 'Hall by hall',
    role: 'main',
    chords: prog(BAR, [[1, Dm5], [1, EbonD], [1, Dm5], [1, EbonD], [1, Gm], [1, F], [1, EbonD], [1, A5]]),
    ostBuild: [0, 0, 1, 0, 0, 0, 2, 0],
    ostCombat: [0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 1, 0, 2, 1, 0, 1],
    snare: 'X...X...X...X.x.|X...X...X..xX.x.',
    anvil: '.o.o.o.o.o.o.o.o|.o.o.o.o.o.ooo.o',
    anvilNote: 84,
    timp: 'o.o.o.o.|o.o.o.oo',
    stabs: 'x.x.....|x.x.....',
    build: [
      { inst: 'horn', form: { tonic: 62, at: 4, take: 4, colour: PH, vel: 0.38 } },
      { inst: 'horn', form: { tonic: 62, at: 20, take: 4, colour: PH, step: -1, vel: 0.36 } },
    ],
    combat: [
      { inst: 'brass', form: { tonic: 38, at: 0, augment: 2, take: 6, colour: PH, vel: 0.84 } },
      { inst: 'anvil', form: { tonic: 86, at: 24, augment: 0.5, colour: PH, vel: 0.5 } },
    ],
    tense: [{ inst: 'strings', form: { tonic: 74, at: 0, invert: true, augment: 2, take: 5, colour: PH, vel: 0.28 } }],
    prep: [{ inst: 'horn', form: { tonic: 62, at: 8, take: 4, colour: PH, augment: 2, vel: 0.3 } }],
  },
  {
    name: 'The hammering',
    role: 'main',
    chords: prog(BAR, [[1, Gm], [1, Dm], [1, Bb], [1, F], [1, Gm], [1, Dm], [1, Bb], [1, Asus]]),
    ostBuild: [0, 1, 2, 1, 2, 1, 0, 1],
    ostCombat: [0, 1, 2, 1, 0, 1, 2, 1, 0, 2, 0, 2, 1, 2, 1, 2],
    snare: 'F..x.xx.X.xx.x..|F..x.xx.X.x.x.xx',
    anvil: '..o...o...o...o.|..o.o.o...o.o.o.',
    anvilNote: 82,
    timp: 'o...o.o.|o...o.oo',
    stabs: 'x...x...|x...x.x.',
    build: [
      { inst: 'horn', form: { tonic: 62, at: 0, vel: 0.4 } },
      { inst: 'horn', form: { tonic: 62, at: 12, vel: 0.38 }, answer: true },
    ],
    combat: [
      { inst: 'anvil', form: { tonic: 86, at: 0, augment: 0.5, vel: 0.55 } },
      { inst: 'brass', form: { tonic: 38, at: 0, augment: 0.5, vel: 0.82 }, stab: true },
      { inst: 'anvil', form: { tonic: 86, at: 8, augment: 0.5, step: 1, vel: 0.55 } },
      { inst: 'brass', form: { tonic: 38, at: 8, augment: 0.5, step: 1, vel: 0.82 }, stab: true },
      { inst: 'brass', form: { tonic: 38, at: 16, colour: H, vel: 0.85 } },
      { inst: 'brass', form: { tonic: 38, at: 28, colour: H, vel: 0.8 }, answer: true },
    ],
    tense: [{ inst: 'horn', form: { tonic: 62, at: 0, invert: true, colour: H, vel: 0.44 } }],
    prep: [{ inst: 'anvil', form: { tonic: 74, at: 16, take: 5, augment: 2, vel: 0.3 } }],
  },
  {
    name: 'The shop floor at night',
    role: 'quiet',
    chords: prog(BAR, [[1, Dsus4], [1, Dm5], [1, Bb], [1, Bb], [1, Gm4], [1, Gm4], [1, Asus], [1, Asus]]),
    ostBuild: [0, -1, 1, -1, 2, -1, 1, -1],
    ostCombat: [],
    snare: '',
    anvil: '',
    anvilNote: 79,
    timp: '',
    stabs: '',
    build: [{ inst: 'horn', form: { tonic: 62, at: 4, augment: 2, take: 6, vel: 0.36 } }],
    combat: [{ inst: 'brass', form: { tonic: 38, at: 8, augment: 2, take: 5, vel: 0.6 } }],
    tense: [{ inst: 'horn', form: { tonic: 62, at: 8, invert: true, augment: 2, take: 4, vel: 0.34 } }],
    prep: [{ inst: 'choir', form: { tonic: 50, at: 4, augment: 2, take: 5, vel: 0.4 } }],
  },
  {
    name: 'No ground beyond the Volga',
    role: 'main',
    chords: prog(BAR, [[1, Bb], [1, F], [1, C5], [1, Dm], [1, Bb], [1, F], [1, Asus], [1, A5]]),
    ostBuild: [0, 1, 2, 1, 0, 2, 1, 2],
    ostCombat: [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 2, 1, 2, 1, 0],
    snare: 'X.xxX.x.X.xxX.x.|X.xxX.x.X.x.F...',
    anvil: '..o...o...o...o.|..o...o.o.o.o...',
    anvilNote: 80,
    timp: 'o.oo....|o.oo..oo',
    stabs: 'x...x...|x...xxx.',
    build: [
      { inst: 'choir', form: { tonic: 50, at: 0, vel: 0.5 } },
      { inst: 'horn', form: { tonic: 62, at: 16, take: 6, vel: 0.36 } },
    ],
    combat: [
      { inst: 'brass', form: { tonic: 38, at: 0, vel: 0.85 } },
      { inst: 'brass', form: { tonic: 38, at: 12, vel: 0.82 }, answer: true },
      { inst: 'anvil', form: { tonic: 86, at: 16, augment: 0.5, vel: 0.52 } },
      { inst: 'horn', form: { tonic: 62, at: 22, take: 6, augment: 0.5, vel: 0.55 } },
    ],
    tense: [{ inst: 'horn', form: { tonic: 62, at: 16, take: 6, colour: H, vel: 0.44 } }],
    prep: [{ inst: 'choir', form: { tonic: 50, at: 16, take: 4, vel: 0.38 } }],
  },
];

/** Victory: the answer in D major hammered on anvil and brass, then the open fifth held in choir and strings. */
const VICTORY: BattleSting = {
  beats: 14,
  parts: [
    part('brass', motif(SOVIET_ANSWER, { tonic: 38, colour: 'major', vel: 0.84 }), motif(SOVIET_ANSWER, { tonic: 50, colour: 'major', vel: 0.7 }), line([[4, 10, 38, 0.72], [4, 10, 45, 0.62]])),
    part('anvil', motif(SOVIET_ANSWER, { tonic: 86, colour: 'major', vel: 0.5 }), hits('o...o', { at: 4, step: 1, vel: 0.36, note: 81 })),
    part('choir', line([[4, 10, 50, 0.5], [4, 10, 54, 0.44], [4, 10, 57, 0.44]])),
    part('strings', line([[4, 10, 74, 0.28], [4, 10, 81, 0.26]], 'trem')),
    part('timpani', swell(hits('R---', { step: 1, vel: 0.56, note: 38 }), 0.5, 1), hits('o', { at: 4, vel: 0.85, note: 38 })),
    part('snare', swell(hits('R---', { step: 1, vel: 0.46 }), 0.4, 1), hits('F', { at: 4, vel: 0.75 })),
  ],
};

/** Defeat: the motif's head in the Phrygian colour on low brass, the anvil slowing, a bare fifth left in the draught. */
const DEFEAT: BattleSting = {
  beats: 14,
  parts: [
    part('brass', motif(SOVIET_MOTIF, { tonic: 38, take: 4, augment: 1.5, colour: PH, vel: 0.68 }), line([[6, 8, 38, 0.5], [6, 8, 45, 0.42]])),
    part('anvil', hits('o...o.....o', { step: 1, vel: 0.36, note: 72 })),
    part('strings', line([[0, 14, 69, 0.2], [0, 14, 74, 0.18]], 'trem')),
    part('timpani', hits('o.....o', { step: 1, vel: 0.6, note: 38 })),
    part('wind', line([[0, 14, 70, 0.5]])),
  ],
};

export const FACTORIES: BattleTrackDef = {
  title: 'The Cold Furnaces',
  theme: 'sovietWinter',
  bpm: 136,
  beatsPerBar: BAR,
  tonic: 2,
  layerLevel: { build: 1.5, combat: 1, tense: 1.27, prep: 1.45 },
  gain: 0.8,
  humanize: { time: 0.005, velocity: 0.08 },
  seed: 421014,
  instruments: SOVIET_KIT,
  mix: SOVIET_MIX,
  reverb: { ...SOVIET_REVERB, seconds: 2.2, seed: 421014 },
  sections: PLANS.map(section),
  stings: { victory: VICTORY, defeat: DEFEAT },
};
