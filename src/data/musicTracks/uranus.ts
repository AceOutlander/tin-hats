/**
 * Mission 1009, Operation Uranus, 19 to 23 November 1942: "Fog on the Don". The tank offensive of the cold kit
 * (src/data/musicTracks/sovietKit.ts): A minor moving to C minor, 140 BPM, the fastest of the cold tracks. It opens in
 * fog: a pad that swells in slowly and a distant drum. Then the engines: a low string ostinato in sixteenths, the root
 * with an octave kicked in on a five, five and six grouping (a motor that does not quite run even), the timpani on the
 * same kicks and a snare on two and four. Over it the brass and horn in octaves blow fanfares built from the answer of
 * the Soviet motif "The Long Winter" (src/data/musicThemes.ts), climbing a third at a time, and the low brass give the
 * motif itself. The first sections are in A minor (the fog, the barrage, the steppe, Perelazovsky); the last are in
 * C minor (the blizzard, with icy bells on every beat, and the Kalach bridge at night). The tense layer is the motor
 * stalling into a timpani pulse under a high tremolo; the prep layer is the radio net, short high pips over the fog.
 * The quiet section is the night on the Don: choir and wind. The victory sting gives the theme in full in C major.
 * Seven sections (the opening and the quiet one six bars) in four layers, plus two stings. Written for Tin Hats; it
 * quotes no existing melody, march, call, hymn, folk tune or score.
 */
import type { BattleSection, BattleSting, BattleTrackDef, MusicEvent, MusicPart } from '../musicBattle';
import { held, hits, line, onRoots, ostinato, part, prog, swell, tile, type ChordSpan } from '../musicKit';
import { motif, SOVIET_MOTIF } from '../musicThemes';
import { SOVIET_KIT, SOVIET_MIX, SOVIET_REVERB } from './sovietKit';
import { leads, rep, spanBeats, windBand, type Lead } from './sovietParts';

const BAR = 4;
const TIMP: readonly [number, number] = [40, 52];

// Chords, low to high (MIDI). A minor first: open fifths, F and C, the Phrygian B flat over A, E as the open end.
const Am5 = [45, 52, 57, 64];
const Am = [45, 52, 57, 60];
const Fmaj7 = [41, 48, 52, 57];
const F = [41, 48, 53, 57];
const C = [48, 55, 60, 64];
const G5 = [43, 50, 55, 62];
const Dm = [50, 57, 62, 65];
const E5 = [40, 47, 52, 59];
const Esus4 = [40, 45, 47, 52];
const BbonA = [45, 53, 58, 62];
// Then C minor: A flat, E flat, B flat, F minor, the Phrygian D flat over C, G as the open end.
const Cm5 = [48, 55, 60, 67];
const Cm = [48, 55, 60, 63];
const Ab = [44, 51, 56, 60];
const Eb = [51, 58, 63, 67];
const Bb5 = [46, 53, 58, 65];
const Fm = [41, 48, 53, 56];
const Gsus4 = [43, 48, 50, 55];
const DbonC = [48, 56, 61, 65];

interface Plan {
  name: string;
  role: BattleSection['role'];
  chords: ChordSpan[];
  /** The opening in fog: no engines idling, only the pad and the distant drum. */
  fog?: boolean;
  /** The blizzard: icy bells on every beat in every layer. */
  blizzard?: boolean;
  /** Two bars of sixteenths: the snare over the engines (the section's last bar is a fill). */
  snare: string;
  build: readonly Lead[];
  combat: readonly Lead[];
  tense: readonly Lead[];
  prep: readonly Lead[];
}

const beats = (p: Plan): number => spanBeats(p.chords);

/** The engine: the root in sixteenths, the octave kicked in on a 5 + 5 + 6 grouping of the bar (and the fifth once). */
const ENGINE = [4, 0, 0, 0, 0, 4, 0, 0, 0, 0, 4, 0, 0, 1, 0, 0];
const KICKS = [0, 5, 10];

/** The low brass and the horn in octaves: a fanfare on the motif's answer, stated `count` times a third higher each. */
function fanfare(at: number, low: number, vel: number, count = 3, colour?: 'phrygian' | 'harmonic'): Lead[] {
  const out: Lead[] = [];
  for (let i = 0; i < count; i++) {
    const form = { at: at + 4 * i, step: 2 * i, colour, vel: vel * (1 + 0.05 * i) };
    out.push({ inst: 'brass', form: { ...form, tonic: low }, answer: true, stab: true }, { inst: 'horn', form: { ...form, tonic: low + 12, vel: form.vel * 0.7 }, answer: true });
  }
  return out;
}

/** The blizzard's icy bells: a chord tone two octaves up on every beat, short. */
function ice(p: Plan, vel: number): MusicEvent[] {
  return ostinato(p.chords, [3, 2, 3, 1], { step: 1, vel, shift: 24, accents: [0], accent: 1.25, len: 0.3 });
}

/** The pad of the fog: chords held, swelling in slowly (the kit's long attack). */
function fogPad(p: Plan, vel: number): MusicEvent[] {
  return held(p.chords, { vel, voices: [0, 1, 2] });
}

/** Calm: the fog pad, the engines idling in soft eighths, a distant drum every two bars, the wind; the theme far off. */
function buildLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  const out: MusicPart[] = [
    part('pad', fogPad(p, 0.52)),
    part('timpani', onRoots(p.chords, rep('....o...|........', n / (2 * BAR)), { step: 0.5, vel: 0.3, range: TIMP })),
    part('wind', windBand(n, 76, p.fog ? 0.36 : 0.26)),
  ];
  if (!p.fog) out.push(part('strings', ostinato(p.chords, [0, -1, 0, -1, 0, -1, 0, 0], { step: 0.5, vel: 0.22, len: 0.5 })));
  else out.push(part('strings', held(p.chords, { vel: 0.12, voices: [3], shift: 24, art: 'long' })));
  if (p.blizzard) out.push(part('bell', ice(p, 0.26)));
  return [...out, ...leads(p.build)];
}

/** The tank column: the engine ostinato, timpani on its kicks, a snare on two and four, a low pedal, the fanfares. */
function combatLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  const reps = n / (2 * BAR);
  const snare = tile(hits(p.snare, { vel: 0.62 }), 2 * BAR, reps).filter((e) => e.at < n - BAR);
  const fill = swell(hits('x.xxx.xxX.xxRRRR', { at: n - BAR, vel: 0.64 }), 0.75, 1.1);
  const out: MusicPart[] = [
    part('strings', ostinato(p.chords, ENGINE, { step: 0.25, vel: 0.46, accents: KICKS, accent: 1.45, len: 0.8 }), held(p.chords, { vel: 0.14, voices: [3], shift: 24, art: 'trem' })),
    part('timpani', onRoots(p.chords, rep('X....o....o.....', n / BAR - 1), { step: 0.25, vel: 0.6, range: TIMP }), onRoots(p.chords, 'X...R-----------', { at: n - BAR, step: 0.25, vel: 0.55, range: TIMP })),
    part('snare', snare, fill),
    part('brass', held(p.chords.filter((_, i) => i % 2 === 0).map((c) => ({ ...c, beats: 2 * BAR })), { vel: 0.3, voices: [0] })),
    part('pad', held(p.chords, { vel: 0.32, voices: [1, 2] })),
  ];
  if (p.blizzard) out.push(part('bell', ice(p, 0.4)));
  return [...out, ...leads(p.combat)];
}

/** The 22nd Panzer coming: the motor stalls into a timpani pulse in eighths, rims on its kicks, a high tremolo. */
function tenseLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  const out: MusicPart[] = [
    part('timpani', onRoots(p.chords, rep('oooooooo', n / BAR), { step: 0.5, vel: 0.38, range: TIMP })),
    part('snare', tile(hits('r....r....r.....', { vel: 0.32 }), BAR, n / BAR - 1), swell(hits('R---------------', { at: n - BAR, vel: 0.42 }), 0.3, 1)),
    part('strings', held(p.chords, { vel: 0.3, voices: [2, 3], shift: 24, art: 'trem' })),
    part('brass', held(p.chords.filter((_, i) => i % 2 === 0).map((c) => ({ ...c, beats: 2 * BAR })), { vel: 0.3, voices: [0] })),
    part('wind', windBand(n, 80, 0.24)),
  ];
  if (p.blizzard) out.push(part('bell', ice(p, 0.3)));
  return [...out, ...leads(p.tense)];
}

/** Waiting for "Siren": the radio net (short high pips, long and short), the fog pad, harmonics, the distant drum. */
function prepLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  return [
    part('pad', fogPad(p, 0.44)),
    part('strings', held(p.chords, { vel: 0.14, voices: [2, 3], shift: 24, art: 'long' })),
    part('anvil', tile(hits('o.o.o...X.o.....|o.X.o...o...X.o.', { vel: 0.18, note: 96 }), 2 * BAR, n / (2 * BAR))),
    part('timpani', onRoots(p.chords, rep('o.......|........', n / (2 * BAR)), { step: 0.5, vel: 0.28, range: TIMP })),
    part('wind', windBand(n, 76, 0.26)),
    ...(p.blizzard ? [part('bell', ice(p, 0.2))] : []),
    ...leads(p.prep),
  ];
}

/** The night on the Don: choir and wind, a far drum; the other layers keep its shape, quietly. */
function quietSection(p: Plan): BattleSection {
  const n = beats(p);
  return {
    name: p.name,
    bars: n / BAR,
    role: 'quiet',
    layers: {
      build: [part('choir', held(p.chords, { vel: 0.5, voices: [1, 2, 3] })), part('wind', windBand(n, 78, 0.42)), part('timpani', onRoots(p.chords, rep('....o...|........', n / (2 * BAR)), { step: 0.5, vel: 0.24, range: TIMP })), ...leads(p.build)],
      combat: [
        part('choir', held(p.chords, { vel: 0.46, voices: [1, 2, 3] })),
        part('strings', ostinato(p.chords, [0, -1, 0, -1, 0, -1, 0, 0], { step: 0.5, vel: 0.3, len: 0.5 })),
        part('brass', held(p.chords, { vel: 0.34, voices: [0] })),
        part('timpani', swell(onRoots(p.chords, 'R-------', { at: n - 2 * BAR, step: 1, vel: 0.54, range: TIMP }), 0.6, 1)),
        part('snare', swell(hits('R-------', { at: n - 2 * BAR, step: 1, vel: 0.4 }), 0.5, 1)),
        ...leads(p.combat),
      ],
      tense: [
        part('strings', held(p.chords, { vel: 0.22, voices: [2, 3], shift: 24, art: 'trem' })),
        part('timpani', onRoots(p.chords, rep('o.o.o.o.', n / BAR), { step: 0.5, vel: 0.3, range: TIMP })),
        part('wind', windBand(n, 78, 0.3)),
        ...leads(p.tense),
      ],
      prep: [
        part('choir', held(p.chords, { vel: 0.4, voices: [1, 2] })),
        part('anvil', tile(hits('o.o.o...........|........X.o.....', { vel: 0.14, note: 96 }), 2 * BAR, n / (2 * BAR))),
        part('wind', windBand(n, 78, 0.34)),
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
    name: 'Siren',
    role: 'intro',
    fog: true,
    chords: prog(BAR, [[2, Am5], [2, Fmaj7], [1, Esus4], [1, E5]]),
    snare: 'g...X..g..g.X...|g...X..g..g.X.gg',
    build: [{ inst: 'horn', form: { tonic: 57, at: 8, take: 4, vel: 0.32 } }],
    combat: [{ inst: 'brass', form: { tonic: 45, at: 0, vel: 0.78 } }, ...fanfare(12, 45, 0.72)],
    tense: [{ inst: 'strings', form: { tonic: 81, at: 4, take: 4, invert: true, vel: 0.28 } }],
    prep: [{ inst: 'horn', form: { tonic: 57, at: 8, take: 4, augment: 2, vel: 0.28 } }],
  },
  {
    name: 'Seven thirty',
    role: 'main',
    chords: prog(BAR, [[1, Am], [1, Am], [1, F], [1, G5], [1, Am], [1, Dm], [1, BbonA], [1, E5]]),
    snare: 'g...X..g..g.X..g|g...X..g..g.X.xx',
    build: [
      { inst: 'horn', form: { tonic: 57, at: 0, vel: 0.34 } },
      { inst: 'horn', form: { tonic: 57, at: 12, vel: 0.3 }, answer: true },
    ],
    combat: [...fanfare(0, 45, 0.74), { inst: 'brass', form: { tonic: 45, at: 16, vel: 0.82 } }, { inst: 'strings', form: { tonic: 81, at: 28, vel: 0.36 }, answer: true }],
    tense: [{ inst: 'horn', form: { tonic: 57, at: 16, take: 5, colour: H, vel: 0.42 } }],
    prep: [{ inst: 'bell', form: { tonic: 81, at: 16, take: 4, vel: 0.26 } }],
  },
  {
    name: 'The steppe',
    role: 'main',
    chords: prog(BAR, [[1, C], [1, G5], [1, Am], [1, F], [1, C], [1, G5], [1, Dm], [1, Esus4]]),
    snare: 'g.g.X..g..g.X...|g.g.X..g..gxX.g.',
    build: [
      { inst: 'strings', form: { tonic: 69, at: 0, vel: 0.24 } },
      { inst: 'horn', form: { tonic: 57, at: 16, take: 6, vel: 0.32 } },
    ],
    combat: [...fanfare(0, 45, 0.74), { inst: 'brass', form: { tonic: 45, at: 16, augment: 2, take: 6, vel: 0.84 } }, ...fanfare(28, 45, 0.76, 1)],
    tense: [{ inst: 'strings', form: { tonic: 81, at: 0, invert: true, augment: 2, take: 5, vel: 0.26 } }],
    prep: [{ inst: 'horn', form: { tonic: 57, at: 0, take: 4, retrograde: true, vel: 0.26 } }],
  },
  {
    name: 'Perelazovsky',
    role: 'main',
    chords: prog(BAR, [[1, Am5], [1, BbonA], [1, Am5], [1, BbonA], [1, Dm], [1, C], [1, BbonA], [1, E5]]),
    snare: 'X...X..g..g.X..g|X...X..g..gxX.xx',
    build: [
      { inst: 'horn', form: { tonic: 57, at: 4, take: 4, colour: PH, vel: 0.34 } },
      { inst: 'horn', form: { tonic: 57, at: 20, take: 4, colour: PH, step: -1, vel: 0.32 } },
    ],
    combat: [{ inst: 'brass', form: { tonic: 45, at: 0, colour: PH, vel: 0.82 } }, ...fanfare(12, 45, 0.72, 1, PH), { inst: 'horn', form: { tonic: 69, at: 16, invert: true, colour: PH, vel: 0.52 } }],
    tense: [{ inst: 'strings', form: { tonic: 81, at: 0, invert: true, augment: 2, take: 5, colour: PH, vel: 0.26 } }],
    prep: [{ inst: 'horn', form: { tonic: 57, at: 8, take: 4, colour: PH, augment: 2, vel: 0.28 } }],
  },
  {
    name: 'Blizzard',
    role: 'main',
    blizzard: true,
    chords: prog(BAR, [[1, Cm5], [1, Ab], [1, Eb], [1, Bb5], [1, Cm], [1, Ab], [1, Fm], [1, G5]]),
    snare: 'g...X..g..g.X..g|g...X..g..g.X.gg',
    build: [
      { inst: 'bell', form: { tonic: 84, at: 0, vel: 0.4 } },
      { inst: 'bell', form: { tonic: 84, at: 12, vel: 0.36 }, answer: true },
    ],
    combat: [{ inst: 'brass', form: { tonic: 48, at: 0, vel: 0.84 } }, { inst: 'brass', form: { tonic: 60, at: 0, vel: 0.62 } }, ...fanfare(16, 48, 0.76)],
    tense: [{ inst: 'bell', form: { tonic: 84, at: 16, take: 4, invert: true, vel: 0.34 } }],
    prep: [{ inst: 'bell', form: { tonic: 84, at: 0, take: 4, augment: 2, vel: 0.26 } }],
  },
  {
    name: 'Headlights on',
    role: 'main',
    chords: prog(BAR, [[1, Cm], [1, DbonC], [1, Cm], [1, DbonC], [1, Ab], [1, Eb], [1, Fm], [1, Gsus4]]),
    snare: 'g.g.X.gg..g.X.g.|g.g.X.gg..gxX.xx',
    build: [
      { inst: 'horn', form: { tonic: 60, at: 0, take: 6, vel: 0.32 } },
      { inst: 'choir', form: { tonic: 60, at: 16, take: 4, vel: 0.42 } },
    ],
    combat: [
      { inst: 'strings', form: { tonic: 84, at: 0, augment: 0.5, vel: 0.38 } },
      { inst: 'brass', form: { tonic: 48, at: 8, vel: 0.78 }, answer: true, stab: true },
      { inst: 'brass', form: { tonic: 48, at: 16, colour: H, vel: 0.84 } },
      ...fanfare(28, 48, 0.78, 1, H),
    ],
    tense: [{ inst: 'horn', form: { tonic: 60, at: 16, take: 6, colour: H, vel: 0.42 } }],
    prep: [{ inst: 'choir', form: { tonic: 60, at: 0, take: 4, augment: 2, vel: 0.36 } }],
  },
  {
    name: 'Night on the Don',
    role: 'quiet',
    chords: prog(BAR, [[1, Cm5], [1, Cm5], [1, Ab], [1, Ab], [1, Gsus4], [1, G5]]),
    snare: '',
    build: [{ inst: 'horn', form: { tonic: 60, at: 4, augment: 2, take: 6, vel: 0.34 } }],
    combat: [{ inst: 'brass', form: { tonic: 48, at: 8, augment: 2, take: 5, vel: 0.58 } }],
    tense: [{ inst: 'horn', form: { tonic: 60, at: 8, invert: true, augment: 2, take: 4, vel: 0.32 } }],
    prep: [{ inst: 'strings', form: { tonic: 72, at: 0, retrograde: true, take: 5, vel: 0.2 } }],
  },
];

const MAJ = 'major' as const;

/** Victory (green flares over Sovetsky): the whole theme in bright C major on brass, horn and bells, then a held C. */
const VICTORY: BattleSting = {
  beats: 16,
  parts: [
    part('brass', motif(SOVIET_MOTIF, { tonic: 48, colour: MAJ, vel: 0.82 }), line([[12, 4, 48, 0.72], [12, 4, 55, 0.62]])),
    part('horn', motif(SOVIET_MOTIF, { tonic: 60, colour: MAJ, vel: 0.5 }), line([[12, 4, 64, 0.42]])),
    part('bell', motif(SOVIET_MOTIF, { tonic: 84, colour: MAJ, vel: 0.4 }), hits('o...', { at: 12, step: 1, vel: 0.4, note: 91 })),
    part('strings', ostinato(prog(BAR, [[3, C]]), ENGINE, { step: 0.25, vel: 0.36, accents: KICKS, accent: 1.4, len: 0.8 }), line([[12, 4, 72, 0.3], [12, 4, 79, 0.28]], 'trem')),
    part('choir', line([[12, 4, 55, 0.48], [12, 4, 60, 0.44], [12, 4, 64, 0.44]])),
    part('timpani', hits('X....o....o.....|X....o....o.....|X...R-----------', { vel: 0.56, note: 48 }), hits('X', { at: 12, vel: 0.85, note: 48 })),
    part('snare', hits('....X.......X...|....X.......X...|....X...R-------', { vel: 0.5 })),
  ],
};

/** Defeat (the column stopped): the engine dying away, the motif's head sinking in the Phrygian colour, the wind. */
const DEFEAT: BattleSting = {
  beats: 12,
  parts: [
    part('strings', line([0, 0.25, 0.5, 1, 1.75, 2.75, 4, 5.5].map((t, i) => [t, 0.2, i % 3 === 0 ? 60 : 48, 0.42 - 0.035 * i] as const), 'short')),
    part('brass', motif(SOVIET_MOTIF, { tonic: 48, take: 4, augment: 1.5, colour: PH, at: 3, vel: 0.66 }), line([[9, 3, 48, 0.46], [9, 3, 55, 0.38]])),
    part('pad', line([[0, 12, 48, 0.44], [0, 12, 55, 0.38]])),
    part('timpani', hits('o.....o.....', { step: 1, vel: 0.44, note: 48 })),
    part('wind', line([[0, 12, 80, 0.55]])),
  ],
};

export const URANUS: BattleTrackDef = {
  title: 'Fog on the Don',
  theme: 'sovietWinter',
  bpm: 140,
  beatsPerBar: BAR,
  tonic: 9,
  layerLevel: { build: 1.7, combat: 1, tense: 1.27, prep: 1.55 },
  gain: 0.8,
  humanize: { time: 0.005, velocity: 0.08 },
  seed: 421119,
  instruments: {
    ...SOVIET_KIT,
    // The fog: a pad that swells in and fades slowly.
    pad: { ...SOVIET_KIT.pad, attack: 1.8, release: 2.2 },
    // The engine's kicks: a tighter, drier timpani.
    timpani: { ...SOVIET_KIT.timpani, decay: 0.8, glideCents: 14 },
  },
  mix: SOVIET_MIX,
  // The open steppe: a shorter room than the city, still bright.
  reverb: { ...SOVIET_REVERB, seconds: 2.2, seed: 421119 },
  sections: PLANS.map(section),
  stings: { victory: VICTORY, defeat: DEFEAT },
};
