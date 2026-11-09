/**
 * Mission 1010, Operation Ring, January 1943: "The Frozen Ring". The campaign's finale on the cold kit
 * (src/data/musicTracks/sovietKit.ts): E minor to E major at 124 BPM, in the largest room. It gives the Soviet motif
 * "The Long Winter" (src/data/musicThemes.ts) in every form: each section has its own (plain, inverted, backwards, at
 * half and at double speed, in the harmonic, Phrygian and Dorian colours, and in the major in the last section).
 * While calm the theme is frozen: the bells play it at half speed over the pad and string harmonics, nothing else
 * moving. In the fight it is full: low brass in octaves and the strings above them, a choir, the strings pulsing in
 * eighths with a run up into every second bar, timpani rolls swelling into the downbeats and a snare roll into every
 * four-bar phrase, no backbeat. When the pocket strikes back (tense) the theme's head becomes the ostinato itself, in
 * the low strings at double speed, under a high tremolo. The prep layer is the frozen front before the guns: pad,
 * choir, a bell every two bars, a far timpani roll. "The Univermag" is in E major, the theme in the major colour; the
 * quiet section is the silence after the guns. The victory sting is the whole theme in E major and an open fifth held
 * into the wind. Six sections (the quiet one six bars) in four layers, plus two stings. Written for Tin Hats; it quotes
 * no existing melody, march, call, hymn, folk tune or score.
 */
import type { BattleSection, BattleSting, BattleTrackDef, MusicEvent, MusicPart } from '../musicBattle';
import { chordAt, fit, held, hits, line, onRoots, ostinato, part, prog, swell, tile, type ChordSpan } from '../musicKit';
import { motif, SOVIET_ANSWER, SOVIET_MOTIF, type Colour } from '../musicThemes';
import { SOVIET_KIT, SOVIET_MIX, SOVIET_REVERB } from './sovietKit';
import { leads, rep, spanBeats, windBand, type Lead } from './sovietParts';

const BAR = 4;
const TIMP: readonly [number, number] = [38, 52];

// Chords, low to high (MIDI). E minor with the major dominant (B) for weight, the Phrygian F over E for the blizzard,
// the borrowed C minor for the ruins; E major with C and D (the flat sixth and seventh) for the last section.
const Em5 = [40, 47, 52, 59];
const Em = [40, 47, 55, 59];
const Esus2 = [40, 47, 54, 59];
const C = [36, 43, 48, 52];
const Cmaj7 = [36, 43, 52, 59];
const Cm = [36, 43, 48, 51];
const G = [43, 50, 55, 59];
const D = [38, 45, 50, 54];
const Am = [45, 52, 57, 60];
const Bsus4 = [47, 52, 54, 59];
const B = [47, 54, 59, 63];
const FonE = [40, 48, 53, 57];
const E = [40, 47, 52, 56];
const A = [45, 52, 57, 61];
const Csm = [49, 56, 61, 64];
const B5 = [47, 54, 59, 66];
const D5 = [38, 45, 50, 57];

interface Plan {
  name: string;
  role: BattleSection['role'];
  chords: ChordSpan[];
  /** The section's colour for the tense ostinato on the theme's head. */
  colour: Colour;
  build: readonly Lead[];
  combat: readonly Lead[];
  tense: readonly Lead[];
  prep: readonly Lead[];
}

const beats = (p: Plan): number => spanBeats(p.chords);

/** The strings pulsing: the chord's upper tones struck together on every eighth, beats one and three harder. */
function pulse(p: Plan, vel: number, to = beats(p)): MusicEvent[] {
  const out: MusicEvent[] = [];
  for (let t = 0; t < to - 1e-9; t += 0.5) {
    const c = chordAt(p.chords, t);
    const k = Math.abs(t % 2) < 1e-9 ? 1.3 : 1;
    for (const v of [3, 2, 1]) out.push({ at: t, len: 0.4, note: c.notes[v] + 12, vel: Math.min(1, vel * k), art: 'short' });
  }
  return out;
}

/** A run up the chord in sixteenths on the last beat of every second bar, into the next phrase. */
function runs(p: Plan, vel: number): MusicEvent[] {
  const n = beats(p);
  const out: MusicEvent[] = [];
  for (let t = 2 * BAR - 1; t < n - 1e-9; t += 2 * BAR) out.push(...swell(ostinato(p.chords, [2, 3, 4, 5], { step: 0.25, vel, shift: 12, from: t, to: t + 1, len: 0.8 }), 0.7, 1.2));
  return out;
}

/** The theme's head at double speed, over and over: the tense layer's ostinato in the low strings. */
function headOstinato(p: Plan, tonic: number, vel: number): MusicEvent[] {
  const n = beats(p);
  const out: MusicEvent[] = [];
  for (let t = 0; t < n - BAR - 1e-9; t += 2) out.push(...motif(SOVIET_MOTIF, { tonic, colour: p.colour, take: 4, augment: 0.5, at: t, vel, art: 'short' }));
  return out;
}

/** Unison low brass: the root and its octave held for a bar. */
function unison(p: Plan, vel: number): MusicEvent[] {
  const out: MusicEvent[] = [];
  for (const c of p.chords) {
    const root = fit(c.notes[0], 36, 47);
    out.push({ at: c.at, len: c.beats, note: root, vel, art: 'long' }, { at: c.at, len: c.beats, note: root + 12, vel: vel * 0.8, art: 'long' });
  }
  return out;
}

/** Frozen: the pad, string harmonics, a far timpani roll at the end of each phrase, the wind; the bells play the theme. */
function buildLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  return [
    part('pad', held(p.chords, { vel: 0.5, voices: [0, 1, 2] })),
    part('strings', held(p.chords, { vel: 0.15, voices: [2, 3], shift: 24, art: 'long' })),
    part('timpani', onRoots(p.chords, rep('............R---', n / (4 * BAR)), { step: 1, vel: 0.22, range: TIMP })),
    part('wind', windBand(n, 84, 0.3)),
    ...leads(p.build),
  ];
}

/** The full orchestra: brass in octaves, pulsing strings and their runs, choir, timpani and snare rolls into the phrases. */
function combatLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  return [
    part('strings', swell(pulse(p, 0.34), 0.85, 1.1), runs(p, 0.42)),
    part('brass', unison(p, 0.32)),
    part('choir', held(p.chords, { vel: 0.36, voices: [1, 2, 3] })),
    part('timpani', onRoots(p.chords, rep('X.......|....R---', n / (2 * BAR)), { step: 0.5, vel: 0.62, range: TIMP })),
    part('snare', tile(hits('F...........R---', { step: 1, vel: 0.5 }), 4 * BAR, n / (4 * BAR))),
    ...leads(p.combat),
  ];
}

/** The pocket strikes back: the theme's head as an ostinato low, a high tremolo, short timpani rolls, a rim, a pedal. */
function tenseLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  return [
    part('strings', headOstinato(p, 52, 0.36), held(p.chords, { vel: 0.3, voices: [2, 3], shift: 24, art: 'trem' })),
    part('timpani', onRoots(p.chords, rep('......R-', n / BAR), { step: 0.5, vel: 0.4, range: TIMP })),
    part('snare', tile(hits('r.......', { vel: 0.3 }), 2, n / 2 - 2), swell(hits('R---------------', { at: n - BAR, vel: 0.42 }), 0.3, 1)),
    part('brass', held(p.chords.filter((_, i) => i % 2 === 0).map((c) => ({ ...c, beats: 2 * BAR })), { vel: 0.28, voices: [0] })),
    part('wind', windBand(n, 82, 0.22)),
    ...leads(p.tense),
  ];
}

/** The frozen front before the guns: pad and choir low, a bell every two bars, a far timpani roll every four. */
function prepLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  return [
    part('pad', held(p.chords, { vel: 0.44, voices: [0, 1] })),
    part('choir', held(p.chords, { vel: 0.34, voices: [0, 1] }).map((e) => ({ ...e, note: fit(e.note, 40, 60) }))),
    part('bell', onRoots(p.chords, rep('o.......', n / (2 * BAR)), { step: 1, vel: 0.24, range: [76, 87] })),
    part('timpani', onRoots(p.chords, rep('............R---', n / (4 * BAR)), { step: 1, vel: 0.26, range: TIMP })),
    part('wind', windBand(n, 84, 0.28)),
    ...leads(p.prep),
  ];
}

/** The guns fall silent: choir and wind, one bell; the other layers keep its shape, quietly. */
function quietSection(p: Plan): BattleSection {
  const n = beats(p);
  const bell = onRoots(p.chords, rep('o.......', n / (2 * BAR)), { step: 1, vel: 0.22, range: [76, 87] });
  return {
    name: p.name,
    bars: n / BAR,
    role: 'quiet',
    layers: {
      build: [part('choir', held(p.chords, { vel: 0.5, voices: [1, 2, 3] })), part('wind', windBand(n, 86, 0.4)), part('bell', bell), ...leads(p.build)],
      combat: [
        part('choir', held(p.chords, { vel: 0.46, voices: [1, 2, 3] })),
        part('strings', pulse(p, 0.24)),
        part('brass', held(p.chords, { vel: 0.34, voices: [0] })),
        part('timpani', swell(onRoots(p.chords, 'R-------', { at: n - 2 * BAR, step: 1, vel: 0.54, range: TIMP }), 0.6, 1)),
        part('snare', hits('R-------', { at: n - 2 * BAR, step: 1, vel: 0.4 })),
        ...leads(p.combat),
      ],
      tense: [part('strings', held(p.chords, { vel: 0.22, voices: [2, 3], shift: 24, art: 'trem' })), part('timpani', onRoots(p.chords, rep('......R-', n / BAR), { step: 0.5, vel: 0.3, range: TIMP })), part('wind', windBand(n, 86, 0.3)), ...leads(p.tense)],
      prep: [part('choir', held(p.chords, { vel: 0.4, voices: [1, 2] })), part('bell', bell), part('wind', windBand(n, 84, 0.34)), ...leads(p.prep)],
    },
  };
}

function section(p: Plan): BattleSection {
  if (p.role === 'quiet') return quietSection(p);
  return { name: p.name, bars: beats(p) / BAR, role: p.role, layers: { build: buildLayer(p), combat: combatLayer(p), tense: tenseLayer(p), prep: prepLayer(p) } };
}

const PH = 'phrygian' as const;
const H = 'harmonic' as const;
const DOR = 'dorian' as const;
const MAJ = 'major' as const;

/** The theme on the low brass in octaves (and the answer after it when `answer`). */
function octaves(at: number, vel: number, form: { colour?: Colour; invert?: boolean; retrograde?: boolean; augment?: number; take?: number } = {}, answer = false): Lead[] {
  const out: Lead[] = [
    { inst: 'brass', form: { ...form, tonic: 40, at, vel } },
    { inst: 'brass', form: { ...form, tonic: 52, at, vel: vel * 0.78 } },
  ];
  if (answer) out.push({ inst: 'brass', form: { tonic: 40, at: at + 12, colour: form.colour, vel }, answer: true }, { inst: 'brass', form: { tonic: 52, at: at + 12, colour: form.colour, vel: vel * 0.78 }, answer: true });
  return out;
}

const PLANS: Plan[] = [
  {
    name: 'The terms refused',
    role: 'intro',
    colour: 'minor',
    chords: prog(BAR, [[1, Em5], [1, Em5], [1, C], [1, C], [1, Am], [1, Am], [1, Bsus4], [1, B]]),
    build: [
      { inst: 'bell', form: { tonic: 76, at: 0, augment: 2, vel: 0.42 } },
      { inst: 'bell', form: { tonic: 76, at: 24, augment: 2, vel: 0.36 }, answer: true },
    ],
    combat: [...octaves(0, 0.82, {}, true), { inst: 'strings', form: { tonic: 76, at: 16, vel: 0.38 } }, { inst: 'strings', form: { tonic: 76, at: 28, vel: 0.36 }, answer: true }],
    tense: [{ inst: 'horn', form: { tonic: 64, at: 16, take: 6, vel: 0.42 } }],
    prep: [{ inst: 'choir', form: { tonic: 52, at: 8, take: 4, augment: 2, vel: 0.36 } }],
  },
  {
    name: 'Seven thousand guns',
    role: 'main',
    colour: 'harmonic',
    chords: prog(BAR, [[1, Em], [1, C], [1, G], [1, D], [1, Em], [1, C], [1, Am], [1, B]]),
    build: [{ inst: 'bell', form: { tonic: 76, at: 0, invert: true, augment: 2, vel: 0.4 } }, { inst: 'bell', form: { tonic: 76, at: 24, take: 4, vel: 0.34 } }],
    combat: [...octaves(0, 0.84, { colour: H }, true), { inst: 'strings', form: { tonic: 76, at: 16, colour: H, vel: 0.4 } }, { inst: 'horn', form: { tonic: 64, at: 16, invert: true, vel: 0.54 } }],
    tense: [{ inst: 'horn', form: { tonic: 64, at: 16, take: 5, colour: H, vel: 0.42 } }],
    prep: [{ inst: 'bell', form: { tonic: 88, at: 16, take: 4, vel: 0.28 } }],
  },
  {
    name: 'Gumrak',
    role: 'main',
    colour: 'phrygian',
    chords: prog(BAR, [[1, Em5], [1, FonE], [1, Em5], [1, FonE], [1, Am], [1, G], [1, FonE], [1, B]]),
    build: [{ inst: 'bell', form: { tonic: 76, at: 0, augment: 2, colour: PH, vel: 0.4 } }],
    combat: [...octaves(0, 0.86, { colour: PH, augment: 2, take: 6 }), { inst: 'strings', form: { tonic: 76, at: 16, invert: true, colour: PH, vel: 0.4 } }],
    tense: [{ inst: 'horn', form: { tonic: 64, at: 0, invert: true, augment: 2, take: 5, colour: PH, vel: 0.4 } }],
    prep: [{ inst: 'horn', form: { tonic: 64, at: 8, take: 4, colour: PH, augment: 2, vel: 0.3 } }],
  },
  {
    name: 'The ruins',
    role: 'main',
    colour: 'dorian',
    chords: prog(BAR, [[1, Em], [1, Cm], [1, Em], [1, Cm], [1, Am], [1, D5], [1, Bsus4], [1, B]]),
    build: [{ inst: 'bell', form: { tonic: 76, at: 0, retrograde: true, augment: 2, vel: 0.4 } }],
    combat: [
      { inst: 'strings', form: { tonic: 76, at: 0, augment: 0.5, vel: 0.4 } },
      { inst: 'strings', form: { tonic: 76, at: 8, augment: 0.5, step: 2, vel: 0.42 } },
      ...octaves(16, 0.84, { retrograde: true, colour: DOR }),
      { inst: 'horn', form: { tonic: 64, at: 28, vel: 0.54 }, answer: true },
    ],
    tense: [{ inst: 'horn', form: { tonic: 64, at: 16, take: 6, colour: DOR, vel: 0.42 } }],
    prep: [{ inst: 'choir', form: { tonic: 52, at: 16, take: 4, vel: 0.36 } }],
  },
  {
    name: 'The Univermag',
    role: 'main',
    colour: 'major',
    chords: prog(BAR, [[1, E], [1, A], [1, Csm], [1, B5], [1, C], [1, D], [1, E], [1, Bsus4]]),
    build: [
      { inst: 'bell', form: { tonic: 76, at: 0, augment: 2, colour: MAJ, vel: 0.42 } },
      { inst: 'choir', form: { tonic: 52, at: 24, colour: MAJ, vel: 0.42 }, answer: true },
    ],
    combat: [
      ...octaves(0, 0.86, { colour: MAJ }, true),
      { inst: 'strings', form: { tonic: 76, at: 0, colour: MAJ, vel: 0.4 } },
      { inst: 'strings', form: { tonic: 88, at: 16, take: 4, colour: MAJ, vel: 0.42 } },
      { inst: 'horn', form: { tonic: 64, at: 16, colour: MAJ, vel: 0.56 } },
      ...octaves(28, 0.88, { colour: MAJ, take: 4, augment: 0.5 }),
    ],
    tense: [{ inst: 'horn', form: { tonic: 64, at: 16, take: 6, colour: MAJ, vel: 0.42 } }],
    prep: [{ inst: 'choir', form: { tonic: 52, at: 0, take: 4, augment: 2, colour: MAJ, vel: 0.36 } }],
  },
  {
    name: 'The guns fall silent',
    role: 'quiet',
    colour: 'minor',
    chords: prog(BAR, [[1, Esus2], [1, Esus2], [1, Cmaj7], [1, Am], [1, Bsus4], [1, Bsus4]]),
    build: [{ inst: 'horn', form: { tonic: 64, at: 4, augment: 2, take: 6, vel: 0.34 } }],
    combat: [{ inst: 'brass', form: { tonic: 40, at: 8, augment: 2, take: 5, vel: 0.58 } }],
    tense: [{ inst: 'horn', form: { tonic: 64, at: 8, invert: true, augment: 2, take: 4, vel: 0.32 } }],
    prep: [{ inst: 'bell', form: { tonic: 88, at: 0, augment: 2, take: 4, vel: 0.26 } }],
  },
];

/** Victory (the colour raised on the ruins): the whole theme in E major, then an open fifth held, fading into wind. */
const VICTORY: BattleSting = {
  beats: 18,
  parts: [
    part('brass', motif(SOVIET_MOTIF, { tonic: 40, colour: MAJ, vel: 0.84 }), motif(SOVIET_MOTIF, { tonic: 52, colour: MAJ, vel: 0.66 }), line([[12, 6, 40, 0.7], [12, 6, 47, 0.6]])),
    part('strings', motif(SOVIET_MOTIF, { tonic: 76, colour: MAJ, art: 'long', vel: 0.4 }), line([[12, 6, 71, 0.3], [12, 6, 76, 0.3], [12, 6, 83, 0.26]], 'trem')),
    part('bell', motif(SOVIET_MOTIF, { tonic: 88, colour: MAJ, take: 4, vel: 0.36 }), hits('o', { at: 12, vel: 0.4, note: 88 })),
    part('choir', line([[4, 8, 52, 0.42], [4, 8, 56, 0.38], [4, 8, 59, 0.38], [12, 5, 52, 0.4], [12, 5, 59, 0.36]])),
    part('timpani', hits('X...........', { step: 1, vel: 0.7, note: 40 }), hits('R---', { at: 8, step: 1, vel: 0.5, note: 47 }), hits('X', { at: 12, vel: 0.85, note: 40 })),
    part('snare', hits('F.......R---', { step: 1, vel: 0.5 }), hits('F', { at: 12, vel: 0.7 })),
    part('wind', line([[10, 8, 84, 0.5]])),
  ],
};

/** Defeat (the ring broken): the theme's head frozen on the bells in the Phrygian colour, a low E held, the wind. */
const DEFEAT: BattleSting = {
  beats: 12,
  parts: [
    part('bell', motif(SOVIET_MOTIF, { tonic: 76, take: 4, augment: 2, colour: PH, vel: 0.4 })),
    part('brass', motif(SOVIET_ANSWER, { tonic: 40, colour: PH, retrograde: true, vel: 0.62 }), line([[4, 8, 40, 0.5], [4, 8, 47, 0.42]])),
    part('pad', line([[0, 12, 40, 0.46], [0, 12, 47, 0.4]])),
    part('timpani', hits('R---....o', { step: 1, vel: 0.4, note: 40 })),
    part('wind', line([[0, 12, 84, 0.55]])),
  ],
};

export const RING: BattleTrackDef = {
  title: 'The Frozen Ring',
  theme: 'sovietWinter',
  bpm: 124,
  beatsPerBar: BAR,
  tonic: 4,
  layerLevel: { build: 1.65, combat: 1, tense: 1.45, prep: 1.55 },
  gain: 0.8,
  humanize: { time: 0.006, velocity: 0.08 },
  seed: 430131,
  instruments: {
    ...SOVIET_KIT,
    // The finale: the low brass a little fuller.
    brass: { ...SOVIET_KIT.brass, level: 0.35 },
  },
  mix: SOVIET_MIX,
  // The largest hall of the cold tracks: long and open.
  reverb: { ...SOVIET_REVERB, seconds: 2.7, brightHz: 5600, seed: 430131 },
  sections: PLANS.map(section),
  stings: { victory: VICTORY, defeat: DEFEAT },
};
