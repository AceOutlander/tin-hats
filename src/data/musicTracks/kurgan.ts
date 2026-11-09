/**
 * Mission 1006, Mamayev Kurgan, 19 September 1942: "Height 102". The climbing track of the cold kit
 * (src/data/musicTracks/sovietKit.ts): G minor at 128 BPM, in a trudging triplet feel. Every main section is a
 * staircase: its chords climb the key bar by bar, the strings' ostinato climbs a chord tone with every beat in triplet
 * eighths (a rising sequence over a rising bass), the horn states the head of the Soviet motif "The Long Winter"
 * (src/data/musicThemes.ts) a step higher each time, and a heavy timpani lands on every bar. The section's last bar is
 * the arrival: everything stops on a held tremolo chord while the timpani roll toward the next climb. Under fire
 * (tense) a snare roll swells into every bar like an incoming shell. On the summit the bells ring high and cold; in
 * the hold the low brass give the theme in full, in octaves. The prep layer is a muffled snare roll under string
 * harmonics. The quiet section is the city seen from the crest: choir, wind and one high bell. Six sections (the quiet
 * one six bars) in four layers, plus two stings. Written for Tin Hats; it quotes no existing melody, march, call, hymn,
 * folk tune or score.
 */
import type { BattleSection, BattleSting, BattleTrackDef, MusicEvent, MusicPart } from '../musicBattle';
import { between, chordAt, fit, held, hits, line, onRoots, ostinato, part, prog, swell, tile, type ChordSpan } from '../musicKit';
import { motif, SOVIET_ANSWER, SOVIET_MOTIF } from '../musicThemes';
import { SOVIET_KIT, SOVIET_MIX, SOVIET_REVERB } from './sovietKit';
import { leads, rep, spanBeats, windBand, type Lead } from './sovietParts';

const BAR = 4;
/** A triplet eighth. */
const TRIP = 1 / 3;
const TIMP: readonly [number, number] = [38, 50];

// Chords, low to high (MIDI). G minor laid out as a staircase: the bass climbs G A B flat C D E flat F, kept open
// (fifths, sus chords, the half-diminished A as the hard step), with the Phrygian A flat over G for the water tanks.
const G5 = [43, 50, 55, 62];
const Gm = [43, 50, 55, 58];
const Gsus2 = [43, 50, 55, 57];
const Ahalf = [45, 51, 55, 60];
const Bb = [46, 53, 58, 62];
const Cm = [48, 55, 60, 63];
const C5 = [48, 55, 60, 67];
const Dm = [50, 57, 62, 65];
const D5 = [50, 57, 62, 69];
const Dsus4 = [50, 55, 57, 62];
const Eb = [51, 58, 63, 67];
const F = [53, 60, 65, 69];
const AbonG = [43, 51, 56, 60];

interface Plan {
  name: string;
  role: BattleSection['role'];
  chords: ChordSpan[];
  /** The summit: bells high and cold in every layer. */
  summit?: boolean;
  /** Two bars of triplet eighths (12 a bar) for the trudging snare. */
  snare: string;
  build: readonly Lead[];
  combat: readonly Lead[];
  tense: readonly Lead[];
  prep: readonly Lead[];
}

const beats = (p: Plan): number => spanBeats(p.chords);

/** The climb: chord tones in triplet eighths, one tone higher on every beat (0 1 2, 1 2 3, 2 3 4, 3 4 5). */
const CLIMB = [0, 1, 2, 1, 2, 3, 2, 3, 4, 3, 4, 5];

/** The climb over the first bars, swelling toward the top; the last bar is left for the arrival. */
function climb(p: Plan, vel: number, shift: number, step = TRIP): MusicEvent[] {
  const n = beats(p);
  const pattern = step === TRIP ? CLIMB : [0, 1, 2, 3];
  return swell(ostinato(p.chords, pattern, { step, vel, shift, to: n - BAR, accents: [0], accent: 1.3, len: 0.8 }), 0.75, 1.15);
}

/** The arrival: the last chord held (a tremolo in the fight), the root low and the chord an octave up. */
function arrival(p: Plan, vel: number, art: 'trem' | 'long' = 'trem'): MusicEvent[] {
  const n = beats(p);
  const c = chordAt(p.chords, n - BAR);
  return [{ at: n - BAR, len: BAR, note: c.notes[0], vel: vel * 0.8, art }, ...c.notes.slice(1).map((note) => ({ at: n - BAR, len: BAR, note: note + 12, vel, art }))];
}

/** The heavy timpani on every bar, and its triplet pickup into the next. */
function heavy(p: Plan, vel: number, pickup: boolean): MusicEvent[] {
  const n = beats(p);
  const down = onRoots(p.chords, rep('X...', n / BAR), { step: 1, vel, range: TIMP });
  if (!pickup) return down;
  const pick = onRoots(p.chords, rep('..........oo', n / BAR - 1), { step: TRIP, vel: vel * 0.55, range: TIMP });
  return [...down, ...pick];
}

/** The low brass stepping on each bar: root and octave in unison, a dotted half. */
function treads(p: Plan, vel: number): MusicEvent[] {
  const out: MusicEvent[] = [];
  for (let b = 0; b < beats(p) / BAR - 1; b++) {
    const root = fit(chordAt(p.chords, b * BAR).notes[0], 38, 49);
    out.push({ at: b * BAR, len: 3, note: root, vel, art: 'long' }, { at: b * BAR, len: 3, note: root + 12, vel: vel * 0.8, art: 'long' });
  }
  return out;
}

/** The summit's bells: chord tones two octaves up on beats one and three, ringing short. */
function summitBells(p: Plan, vel: number): MusicEvent[] {
  return ostinato(p.chords, [3, -1, 2, -1], { step: 1, vel, shift: 24, accents: [0], accent: 1.2, len: 0.5 }).filter((e) => e.note <= 96);
}

/** Calm on the slope: the pad, the climb in quarter notes, the heavy timpani soft on every bar, smoke; the motif far off. */
function buildLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  return [
    part('pad', held(p.chords, { vel: 0.5, voices: [0, 1, 2] })),
    part('strings', climb(p, 0.24, 0, 1), arrival(p, 0.16, 'long')),
    part('timpani', heavy(p, 0.34, false)),
    part('wind', windBand(n, 74, 0.3)),
    ...(p.summit ? [part('bell', summitBells(p, 0.34))] : []),
    ...leads(p.build),
  ];
}

/** The assault: the triplet climb, the trudging snare, the heavy timpani with its pickup, the brass treading, the arrival. */
function combatLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  const snare = between(tile(hits(p.snare, { step: TRIP, vel: 0.62 }), 2 * BAR, n / (2 * BAR)), 0, n - BAR);
  return [
    part('strings', climb(p, 0.48, 12), arrival(p, 0.36), between(ostinato(p.chords, [0, -1, -1], { step: TRIP, vel: 0.42, accents: [0], accent: 1.2 }), 0, n - BAR)),
    part('snare', swell(snare, 0.8, 1.1), hits('R----------', { at: n - BAR + TRIP, step: TRIP, vel: 0.55 })),
    part('timpani', heavy(p, 0.68, true), hits('R-----', { at: n - 2, step: TRIP, vel: 0.5, note: fit(p.chords[0].notes[0], TIMP[0], TIMP[1]) })),
    part('brass', treads(p, 0.38)),
    ...(p.summit ? [part('bell', summitBells(p, 0.42))] : []),
    ...leads(p.combat),
  ];
}

/** Under the mortars: a snare roll swelling into every bar, the shell landing on the timpani, a high tremolo, a pedal. */
function tenseLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  return [
    part('strings', held(p.chords, { vel: 0.24, voices: [2, 3], shift: 24, art: 'trem' }), ostinato(p.chords, [0, -1, 0, 0, -1, 0], { step: TRIP, vel: 0.3, accents: [0], accent: 1.4 })),
    part('snare', tile(hits('........R---', { step: TRIP, vel: 0.4 }), BAR, n / BAR)),
    part('timpani', heavy(p, 0.56, false)),
    part('brass', held(p.chords.filter((_, i) => i % 2 === 0).map((c) => ({ ...c, beats: 2 * BAR })), { vel: 0.28, voices: [0] })),
    part('wind', windBand(n, 72, 0.24)),
    ...(p.summit ? [part('bell', summitBells(p, 0.3))] : []),
    ...leads(p.tense),
  ];
}

/** Digging in on the crest: a muffled snare roll swelling every two bars, string harmonics, the low pad. */
function prepLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  const rolls: MusicEvent[] = [];
  for (let t = 0; t < n - 1e-9; t += 2 * BAR) rolls.push({ at: t, len: 2 * BAR - 0.5, note: 0, vel: 0.16 + (0.1 * t) / n, art: 'roll' });
  return [
    part('pad', held(p.chords, { vel: 0.44, voices: [0, 1] })),
    part('strings', held(p.chords, { vel: 0.16, voices: [2, 3], shift: 24, art: 'long' })),
    part('snare', rolls),
    part('timpani', onRoots(p.chords, rep('o.......', n / (2 * BAR)), { step: 1, vel: 0.3, range: TIMP })),
    part('wind', windBand(n, 74, 0.26)),
    ...(p.summit ? [part('bell', summitBells(p, 0.26))] : []),
    ...leads(p.prep),
  ];
}

/** The city from the crest: choir and wind, one high bell a bar; the other layers keep its shape, quietly. */
function quietSection(p: Plan): BattleSection {
  const n = beats(p);
  const bell = onRoots(p.chords, rep('o...', n / BAR), { step: 1, vel: 0.24, range: [79, 90] });
  return {
    name: p.name,
    bars: n / BAR,
    role: 'quiet',
    layers: {
      build: [part('choir', held(p.chords, { vel: 0.5, voices: [1, 2, 3] })), part('wind', windBand(n, 78, 0.4)), part('bell', bell), part('timpani', onRoots(p.chords, 'o', { step: 1, vel: 0.24, range: TIMP })), ...leads(p.build)],
      combat: [
        part('choir', held(p.chords, { vel: 0.46, voices: [1, 2, 3] })),
        part('strings', swell(ostinato(p.chords, CLIMB, { step: TRIP, vel: 0.28, shift: 12, len: 0.8 }), 0.7, 1.1)),
        part('brass', held(p.chords, { vel: 0.34, voices: [0] })),
        part('timpani', heavy(p, 0.46, false)),
        part('snare', hits('R-------', { at: n - 2 * BAR, step: 1, vel: 0.4 })),
        ...leads(p.combat),
      ],
      tense: [
        part('strings', held(p.chords, { vel: 0.22, voices: [2, 3], shift: 24, art: 'trem' })),
        part('snare', tile(hits('........R---', { step: TRIP, vel: 0.3 }), 2 * BAR, n / (2 * BAR))),
        part('timpani', heavy(p, 0.4, false)),
        part('wind', windBand(n, 78, 0.3)),
        ...leads(p.tense),
      ],
      prep: [
        part('choir', held(p.chords, { vel: 0.42, voices: [1, 2] })),
        part('snare', line([[0, 2 * BAR - 0.5, 0, 0.16], [3 * BAR, 2 * BAR - 0.5, 0, 0.14]], 'roll')),
        part('bell', bell),
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

/** The head of the motif climbing: four notes, a scale step higher every `every` beats. */
function ascent(inst: 'horn' | 'brass' | 'strings', tonic: number, at: number, every: number, count: number, vel: number, from = 0): Lead[] {
  return Array.from({ length: count }, (_, i) => ({ inst, form: { tonic, at: at + i * every, take: 4, step: from + i, vel: vel * (1 + 0.06 * i) } }));
}

const PLANS: Plan[] = [
  {
    name: 'The foot of the hill',
    role: 'intro',
    chords: prog(BAR, [[1, G5], [1, G5], [1, Bb], [1, Bb], [1, C5], [1, Cm], [1, Dsus4], [1, D5]]),
    snare: 'X..x.gX..x.g|X..x.gX.gx.g',
    build: [{ inst: 'horn', form: { tonic: 55, at: 16, take: 4, vel: 0.36 } }, { inst: 'horn', form: { tonic: 55, at: 24, take: 4, step: 1, vel: 0.36 } }],
    combat: ascent('horn', 67, 0, 8, 4, 0.52),
    tense: [{ inst: 'strings', form: { tonic: 79, at: 0, take: 4, invert: true, vel: 0.28 } }],
    prep: [{ inst: 'horn', form: { tonic: 55, at: 8, take: 4, augment: 2, vel: 0.3 } }],
  },
  {
    name: 'The slope',
    role: 'main',
    chords: prog(BAR, [[1, Gm], [1, Ahalf], [1, Bb], [1, Cm], [1, Dm], [1, Eb], [1, F], [1, D5]]),
    snare: 'X..x.gX..xgg|X..x.gX.gx.x',
    build: [
      { inst: 'strings', form: { tonic: 67, at: 0, vel: 0.24 } },
      { inst: 'horn', form: { tonic: 55, at: 12, vel: 0.32 }, answer: true },
    ],
    combat: [{ inst: 'brass', form: { tonic: 43, at: 0, vel: 0.78 } }, { inst: 'brass', form: { tonic: 43, at: 12, vel: 0.76 }, answer: true }, ...ascent('horn', 67, 16, 4, 3, 0.54, 2)],
    tense: [{ inst: 'horn', form: { tonic: 55, at: 16, take: 5, colour: H, vel: 0.42 } }],
    prep: [{ inst: 'bell', form: { tonic: 79, at: 16, take: 4, vel: 0.3 } }],
  },
  {
    name: 'The water tanks',
    role: 'main',
    chords: prog(BAR, [[1, Gm], [1, AbonG], [1, Gm], [1, AbonG], [1, Cm], [1, Bb], [1, AbonG], [1, D5]]),
    snare: 'X.gx.gX.gx.g|X.gx.gX.gxxx',
    build: [
      { inst: 'horn', form: { tonic: 55, at: 4, take: 4, colour: PH, vel: 0.36 } },
      { inst: 'horn', form: { tonic: 55, at: 20, take: 4, colour: PH, step: -1, vel: 0.34 } },
    ],
    combat: [
      { inst: 'brass', form: { tonic: 43, at: 0, augment: 2, take: 6, colour: PH, vel: 0.84 } },
      { inst: 'horn', form: { tonic: 67, at: 16, invert: true, colour: PH, vel: 0.54 } },
    ],
    tense: [{ inst: 'strings', form: { tonic: 79, at: 0, invert: true, augment: 2, take: 5, colour: PH, vel: 0.26 } }],
    prep: [{ inst: 'horn', form: { tonic: 55, at: 8, take: 4, colour: PH, augment: 2, vel: 0.3 } }],
  },
  {
    name: 'The summit',
    role: 'main',
    summit: true,
    chords: prog(BAR, [[1, Bb], [1, F], [1, Gm], [1, Eb], [1, Bb], [1, F], [1, Cm], [1, Dsus4]]),
    snare: 'X..x..X..x.g|X..x..X.gx.g',
    build: [
      { inst: 'bell', form: { tonic: 79, at: 0, vel: 0.42 } },
      { inst: 'bell', form: { tonic: 79, at: 12, vel: 0.36 }, answer: true },
    ],
    combat: [
      { inst: 'strings', form: { tonic: 79, at: 0, vel: 0.4 } },
      { inst: 'brass', form: { tonic: 43, at: 16, retrograde: true, vel: 0.8 } },
    ],
    tense: [{ inst: 'bell', form: { tonic: 79, at: 16, take: 4, invert: true, vel: 0.34 } }],
    prep: [{ inst: 'bell', form: { tonic: 79, at: 0, take: 4, augment: 2, vel: 0.28 } }],
  },
  {
    name: 'Hold the summit',
    role: 'main',
    chords: prog(BAR, [[1, G5], [1, Cm], [1, D5], [1, Gm], [1, G5], [1, Cm], [1, Dsus4], [1, D5]]),
    snare: 'X..x.gX..x.g|X.gx.gX.gx.g',
    build: [
      { inst: 'horn', form: { tonic: 55, at: 0, vel: 0.36 } },
      { inst: 'horn', form: { tonic: 55, at: 12, vel: 0.32 }, answer: true },
    ],
    // The theme in full on the low brass in octaves, then again in the harder harmonic colour.
    combat: [
      { inst: 'brass', form: { tonic: 43, at: 0, vel: 0.86 } },
      { inst: 'brass', form: { tonic: 55, at: 0, vel: 0.66 } },
      { inst: 'brass', form: { tonic: 43, at: 12, vel: 0.82 }, answer: true },
      { inst: 'brass', form: { tonic: 55, at: 12, vel: 0.62 }, answer: true },
      { inst: 'brass', form: { tonic: 43, at: 16, colour: H, vel: 0.88 } },
      { inst: 'brass', form: { tonic: 55, at: 16, colour: H, vel: 0.68 } },
      { inst: 'brass', form: { tonic: 43, at: 28, vel: 0.84 }, answer: true },
    ],
    tense: [{ inst: 'horn', form: { tonic: 55, at: 16, take: 6, colour: H, vel: 0.42 } }],
    prep: [{ inst: 'choir', form: { tonic: 55, at: 16, take: 4, vel: 0.38 } }],
  },
  {
    name: 'The city below',
    role: 'quiet',
    chords: prog(BAR, [[1, Gsus2], [1, Gsus2], [1, Eb], [1, Cm], [1, Dsus4], [1, Dsus4]]),
    snare: '',
    build: [{ inst: 'horn', form: { tonic: 55, at: 4, augment: 2, take: 6, vel: 0.34 } }],
    combat: [{ inst: 'brass', form: { tonic: 43, at: 8, augment: 2, take: 5, vel: 0.58 } }],
    tense: [{ inst: 'horn', form: { tonic: 55, at: 8, invert: true, augment: 2, take: 4, vel: 0.32 } }],
    prep: [{ inst: 'bell', form: { tonic: 79, at: 0, augment: 2, take: 6, vel: 0.26 } }],
  },
];

/** Victory (the crest taken): the climb runs up to a high G, the answer in G major on unison brass, bells on the top. */
const VICTORY: BattleSting = {
  beats: 12,
  parts: [
    part('strings', ostinato(prog(BAR, [[1, Gm]]), CLIMB, { step: TRIP, vel: 0.44, shift: 12, len: 0.8 }), line([[4, 8, 67, 0.36], [4, 8, 74, 0.34], [4, 8, 79, 0.32]], 'trem')),
    part('brass', motif(SOVIET_ANSWER, { tonic: 43, colour: 'major', at: 4, vel: 0.84 }), motif(SOVIET_ANSWER, { tonic: 55, colour: 'major', at: 4, vel: 0.66 }), line([[8, 4, 43, 0.7], [8, 4, 50, 0.6]])),
    part('bell', hits('o..o', { at: 4, step: 1, vel: 0.44, note: 91 }), hits('o', { at: 8, vel: 0.4, note: 86 })),
    part('choir', line([[8, 4, 55, 0.48], [8, 4, 59, 0.42], [8, 4, 62, 0.42]])),
    part('timpani', hits('X...X...', { step: 1 / 2, vel: 0.7, note: 43 }), hits('R---', { at: 6, step: 0.5, vel: 0.5, note: 43 }), hits('X', { at: 8, vel: 0.85, note: 43 })),
    part('wind', line([[6, 6, 78, 0.4]])),
  ],
};

/** Defeat (the crest lost): the motif's head slipping down the slope a step at a time, the timpani fading, the wind. */
const DEFEAT: BattleSting = {
  beats: 12,
  parts: [
    part('brass', ...[0, -1, -2].map((s, i) => motif(SOVIET_MOTIF, { tonic: 43, take: 4, step: s, at: 3 * i, augment: 0.75, vel: 0.7 - 0.08 * i })), line([[9, 3, 38, 0.46], [9, 3, 45, 0.38]])),
    part('strings', line([[0, 12, 74, 0.2], [0, 12, 79, 0.18]], 'trem')),
    part('timpani', hits('X..o..o.....', { step: 1, vel: 0.6, note: 43 })),
    part('wind', line([[0, 12, 74, 0.55]])),
  ],
};

export const KURGAN: BattleTrackDef = {
  title: 'Height 102',
  theme: 'sovietWinter',
  bpm: 128,
  beatsPerBar: BAR,
  tonic: 7,
  layerLevel: { build: 1.5, combat: 1, tense: 1.27, prep: 1.45 },
  gain: 0.8,
  humanize: { time: 0.006, velocity: 0.08 },
  seed: 420919,
  instruments: {
    ...SOVIET_KIT,
    // The heavy step on every bar: a deeper, longer timpani, struck harder.
    timpani: { ...SOVIET_KIT.timpani, decay: 1.25, level: 0.56 },
  },
  mix: SOVIET_MIX,
  // The hill in the open, smoke over the city: a long room, a little less bright than the snow tracks.
  reverb: { ...SOVIET_REVERB, seconds: 2.5, brightHz: 4800, seed: 420919 },
  sections: PLANS.map(section),
  stings: { victory: VICTORY, defeat: DEFEAT },
};
