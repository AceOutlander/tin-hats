/**
 * Mission 1005, crossing the Volga, night of 14 to 15 September 1942: "The Far Bank". Night water on the cold kit
 * (src/data/musicTracks/sovietKit.ts): C minor at 118 BPM. Its groove is the oars: a deep hand-drum stroke every two
 * beats with two light strokes on the recovery, under a low pad and the strings' slow measured tremolo rising and
 * falling with each stroke like water against the hull; the timpani fall irregularly and far off, artillery across
 * the river. In the fight the oars double their rate, the strings turn urgent (bariolage sixteenths), and the Soviet
 * motif "The Long Winter" (src/data/musicThemes.ts) comes in fragments of three notes thrown between brass and horn,
 * as well as whole on the strings; when the landing is about to be lost, a clock-like rim on every beat with a
 * tick-tock on the bell. The prep layer is the dawn on the bank: the water, a far chime every two bars, the guns
 * across the river. The quiet section is halfway across: choir, wind and the oars far off. Six sections (a six-bar
 * opening and quiet section, four of eight bars) in four layers, plus two stings. Written for Tin Hats; it quotes no
 * existing melody, march, call, hymn, folk tune or score.
 */
import type { BattleSection, BattleSting, BattleTrackDef, MusicEvent, MusicPart } from '../musicBattle';
import { chordAt, held, hits, line, onRoots, ostinato, part, prog, swell, tile, type ChordSpan } from '../musicKit';
import { motif, SOVIET_ANSWER, SOVIET_MOTIF } from '../musicThemes';
import { SOVIET_KIT, SOVIET_MIX, SOVIET_REVERB } from './sovietKit';
import { leads, rep, spanBeats, windBand, type Lead } from './sovietParts';

const BAR = 4;
const TIMP: readonly [number, number] = [36, 50];

// Chords, low to high (MIDI). C minor, dark and wide: open fifths, A flat and E flat, the Phrygian D flat over C.
const Cm5 = [36, 43, 48, 55];
const Cm = [36, 43, 48, 51];
const Csus2 = [36, 43, 48, 50];
const Ab = [44, 51, 56, 60];
const Abmaj7 = [44, 51, 55, 60];
const Fm = [41, 48, 53, 56];
const G5 = [43, 50, 55, 62];
const Gsus = [43, 48, 50, 55];
const Eb = [39, 46, 51, 55];
const Bb5 = [46, 53, 58, 65];
const DbonC = [36, 44, 49, 53];

interface Plan {
  name: string;
  role: BattleSection['role'];
  chords: ChordSpan[];
  /** One bar of sixteenths for the oars (d D dum, t T tek), and the doubled rate of the fight. */
  oars: string;
  rowing: string;
  /** Two bars of eighths: the far artillery (timpani, o a stroke, R a roll). */
  guns: string;
  /** Two bars of sixteenths: the combat snare (the section's last bar is a fill). */
  snare: string;
  build: readonly Lead[];
  combat: readonly Lead[];
  tense: readonly Lead[];
  prep: readonly Lead[];
}

const beats = (p: Plan): number => spanBeats(p.chords);

/**
 * The strings' slow measured tremolo: chord tones re-bowed every eighth, their level rising and falling over two beats
 * with the oar stroke (the swell peaks on the pull).
 */
function water(chords: readonly ChordSpan[], voices: readonly number[], vel: number, shift = 0): MusicEvent[] {
  const end = spanBeats(chords);
  const out: MusicEvent[] = [];
  for (const c of chords) {
    for (let t = c.at; t < Math.min(end, c.at + c.beats) - 1e-9; t += 0.5) {
      const k = 0.72 + 0.28 * Math.cos(Math.PI * (t - 0.5));
      for (const v of voices) if (v < c.notes.length) out.push({ at: t, len: 0.5, note: c.notes[v] + shift, vel: Math.min(1, vel * k), art: 'long' });
    }
  }
  return out;
}

/** A low unison pedal: the root sounding at each two-bar line, held to the next one (or the section end). */
function lowPedal(chords: readonly ChordSpan[], vel: number): MusicEvent[] {
  const n = spanBeats(chords);
  const out: MusicEvent[] = [];
  for (let t = 0; t < n - 1e-9; t += 2 * BAR) out.push({ at: t, len: Math.min(2 * BAR, n - t), note: chordAt(chords, t).notes[0], vel, art: 'long' });
  return out;
}

/** Calm: the oars, the low pad and the water, the far guns, a breeze off the river; the theme low on the strings. */
function buildLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  return [
    part('hand', tile(hits(p.oars, { vel: 0.5 }), BAR, n / BAR)),
    part('pad', held(p.chords, { vel: 0.5, voices: [0, 1, 2] })),
    part('strings', water(p.chords, [1, 2], 0.2)),
    part('timpani', onRoots(p.chords, rep(p.guns, n / (2 * BAR)), { step: 0.5, vel: 0.3, range: TIMP })),
    part('wind', windBand(n, 70, 0.2)),
    ...leads(p.build),
  ];
}

/** Under fire on the water: the oars doubled, urgent bariolage strings, a running snare, the guns closer, the theme torn. */
function combatLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  const reps = n / (2 * BAR);
  const snare = tile(hits(p.snare, { vel: 0.6 }), 2 * BAR, reps).filter((e) => e.at < n - BAR);
  const fill = swell(hits('x.xxx.xxX.X.RRRR', { at: n - BAR, vel: 0.66 }), 0.75, 1.1);
  return [
    part('hand', tile(hits(p.rowing, { vel: 0.6 }), BAR, n / BAR)),
    part('strings', ostinato(p.chords, [0, 4, 0, 4, 1, 4, 1, 4, 0, 4, 0, 4, 2, 4, 3, 4], { step: 0.25, vel: 0.44, shift: 12, accents: [0, 8], accent: 1.3 }), held(p.chords, { vel: 0.16, voices: [3], shift: 24, art: 'trem' })),
    part('snare', snare, fill),
    part('timpani', onRoots(p.chords, rep(p.guns, reps), { step: 0.5, vel: 0.6, range: TIMP })),
    part('brass', lowPedal(p.chords, 0.32)),
    part('pad', held(p.chords, { vel: 0.38, voices: [1, 2] })),
    ...leads(p.combat),
  ];
}

/** The landing about to be lost: a clock-like rim on every beat, a tick-tock on the bell, a high tremolo, the far guns. */
function tenseLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  return [
    part('snare', tile(hits('r...r...r...r...', { vel: 0.32 }), BAR, n / BAR - 1), swell(hits('R---------------', { at: n - BAR, vel: 0.42 }), 0.3, 1)),
    part('bell', tile(hits('o.......', { step: 0.25, vel: 0.22, note: 84 }), 4, n / 4), tile(hits('o.......', { at: 2, step: 0.25, vel: 0.18, note: 79 }), 4, n / 4)),
    part('strings', held(p.chords, { vel: 0.22, voices: [2, 3], shift: 24, art: 'trem' }), water(p.chords, [0], 0.26, 12)),
    part('timpani', onRoots(p.chords, rep(p.guns, n / (2 * BAR)), { step: 0.5, vel: 0.44, range: TIMP })),
    part('brass', lowPedal(p.chords, 0.3)),
    ...leads(p.tense),
  ];
}

/** Dawn on the bank: the water, a far chime every two bars, the guns across the river, the wind. */
function prepLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  return [
    part('pad', held(p.chords, { vel: 0.46, voices: [0, 1] })),
    part('strings', swell(water(p.chords, [1, 2], 0.18), 0.8, 1.2)),
    part('bell', onRoots(p.chords, rep('o...............', n / (2 * BAR)), { step: 0.5, vel: 0.26, range: [72, 83] })),
    part('timpani', onRoots(p.chords, rep(p.guns, n / (2 * BAR)), { step: 0.5, vel: 0.26, range: TIMP })),
    part('wind', windBand(n, 70, 0.26)),
    ...leads(p.prep),
  ];
}

/** Halfway across: choir and wind, the oars far off; the other layers keep its shape, quietly. */
function quietSection(p: Plan): BattleSection {
  const n = beats(p);
  return {
    name: p.name,
    bars: n / BAR,
    role: 'quiet',
    layers: {
      build: [
        part('choir', held(p.chords, { vel: 0.5, voices: [1, 2, 3] })),
        part('hand', tile(hits('d...............', { vel: 0.3 }), 2, n / 2)),
        part('wind', windBand(n, 72, 0.4)),
        part('timpani', onRoots(p.chords, 'o', { step: 1, vel: 0.22, range: TIMP })),
        ...leads(p.build),
      ],
      combat: [
        part('choir', held(p.chords, { vel: 0.46, voices: [1, 2, 3] })),
        part('hand', tile(hits(p.oars, { vel: 0.42 }), BAR, n / BAR)),
        part('strings', water(p.chords, [1, 2], 0.26)),
        part('brass', held(p.chords, { vel: 0.34, voices: [0] })),
        part('timpani', swell(onRoots(p.chords, 'R-------', { at: n - 2 * BAR, step: 1, vel: 0.54, range: TIMP }), 0.6, 1)),
        ...leads(p.combat),
      ],
      tense: [
        part('snare', tile(hits('r...', { step: 1, vel: 0.26 }), BAR, n / BAR)),
        part('bell', tile(hits('o.......', { step: 0.25, vel: 0.18, note: 84 }), 4, n / 4)),
        part('strings', held(p.chords, { vel: 0.2, voices: [2, 3], shift: 24, art: 'trem' })),
        part('wind', windBand(n, 72, 0.3)),
        ...leads(p.tense),
      ],
      prep: [
        part('choir', held(p.chords, { vel: 0.4, voices: [1, 2] })),
        part('bell', onRoots(p.chords, rep('o...............', n / (2 * BAR)), { step: 0.5, vel: 0.22, range: [72, 83] })),
        part('wind', windBand(n, 70, 0.34)),
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

/** The theme torn: its first three notes thrown between brass and horn, two beats apart, climbing a step each time. */
function torn(at: number, vel: number): Lead[] {
  return [0, 1, 2, 3].map((i) => (i % 2 === 0 ? { inst: 'brass' as const, form: { tonic: 48, at: at + 2 * i, take: 3, step: i, vel } } : { inst: 'horn' as const, form: { tonic: 60, at: at + 2 * i, take: 3, step: i, vel: vel * 0.7 } }));
}

const PLANS: Plan[] = [
  {
    name: 'The landing stage',
    role: 'intro',
    chords: prog(BAR, [[2, Cm5], [1, Ab], [1, Fm], [1, Gsus], [1, G5]]),
    oars: 'D...t.t.d...t.t.',
    rowing: 'D.t.D.t.D.t.D.tt',
    guns: '......o.|........',
    snare: 'g.x.g.xgg.x.g.xX|g.x.g.xgg.x.gxxX',
    build: [{ inst: 'strings', form: { tonic: 60, at: 8, vel: 0.24 } }],
    combat: [{ inst: 'strings', form: { tonic: 72, at: 0, vel: 0.36 } }, ...torn(12, 0.72)],
    tense: [{ inst: 'horn', form: { tonic: 60, at: 4, take: 4, colour: PH, vel: 0.42 } }],
    prep: [{ inst: 'horn', form: { tonic: 60, at: 8, take: 4, augment: 2, vel: 0.28 } }],
  },
  {
    name: 'The far bank',
    role: 'main',
    chords: prog(BAR, [[1, Cm], [1, Ab], [1, Fm], [1, G5], [1, Cm], [1, Ab], [1, Eb], [1, Gsus]]),
    oars: 'D...t.t.D...t.t.',
    rowing: 'D.t.D.t.D.t.D.t.',
    guns: '.....o..|...o....',
    snare: 'g.x.g.xgg.x.g.xX|g.x.g.xgg.xxg.xX',
    build: [
      { inst: 'strings', form: { tonic: 60, at: 0, vel: 0.24 } },
      { inst: 'horn', form: { tonic: 60, at: 12, vel: 0.32 }, answer: true },
    ],
    combat: [
      { inst: 'strings', form: { tonic: 72, at: 0, vel: 0.38 } },
      { inst: 'brass', form: { tonic: 36, at: 12, vel: 0.76 }, answer: true },
      ...torn(16, 0.74),
      { inst: 'brass', form: { tonic: 36, at: 24, take: 6, vel: 0.8 } },
    ],
    tense: [{ inst: 'strings', form: { tonic: 72, at: 16, take: 4, vel: 0.28 } }],
    prep: [{ inst: 'horn', form: { tonic: 60, at: 16, take: 4, vel: 0.28 } }],
  },
  {
    name: 'Flares over the water',
    role: 'main',
    chords: prog(BAR, [[1, Cm5], [1, DbonC], [1, Cm5], [1, DbonC], [1, Fm], [1, Eb], [1, DbonC], [1, G5]]),
    oars: 'D...t...d...t.t.',
    rowing: 'D.tTD.t.D.tTD.t.',
    guns: '..o.....|......R-',
    snare: 'g.x.g.x.X.x.g.xX|g.x.g.x.X.x.gxxX',
    build: [
      { inst: 'horn', form: { tonic: 60, at: 4, take: 4, colour: PH, vel: 0.36 } },
      { inst: 'horn', form: { tonic: 60, at: 20, take: 4, colour: PH, step: -1, vel: 0.34 } },
    ],
    combat: [
      { inst: 'brass', form: { tonic: 36, at: 0, augment: 2, take: 6, colour: PH, vel: 0.84 } },
      { inst: 'strings', form: { tonic: 72, at: 16, invert: true, colour: PH, vel: 0.36 } },
      ...torn(4, 0.66).slice(1, 3),
    ],
    tense: [{ inst: 'strings', form: { tonic: 72, at: 0, invert: true, augment: 2, take: 5, colour: PH, vel: 0.26 } }],
    prep: [{ inst: 'bell', form: { tonic: 72, at: 8, take: 4, augment: 2, colour: PH, vel: 0.28 } }],
  },
  {
    name: 'The high bank',
    role: 'main',
    chords: prog(BAR, [[1, Ab], [1, Eb], [1, Bb5], [1, Cm], [1, Ab], [1, Eb], [1, Fm], [1, Gsus]]),
    oars: 'D...t.t.D.t.t.t.',
    rowing: 'D.t.D.ttD.t.D.tt',
    guns: '...o....|.o......',
    snare: 'g.x.g.xgX.x.g.xX|g.x.g.xgX.x.X.xX',
    build: [
      { inst: 'choir', form: { tonic: 48, at: 0, vel: 0.46 } },
      { inst: 'strings', form: { tonic: 60, at: 16, take: 6, step: 2, vel: 0.22 } },
    ],
    combat: [
      { inst: 'brass', form: { tonic: 36, at: 0, vel: 0.84 } },
      { inst: 'brass', form: { tonic: 36, at: 12, vel: 0.8 }, answer: true },
      { inst: 'strings', form: { tonic: 72, at: 16, step: 2, vel: 0.38 } },
      ...torn(28, 0.7).slice(0, 2),
    ],
    tense: [{ inst: 'horn', form: { tonic: 60, at: 16, invert: true, take: 5, vel: 0.42 } }],
    prep: [{ inst: 'choir', form: { tonic: 48, at: 16, take: 4, vel: 0.36 } }],
  },
  {
    name: 'Halfway across',
    role: 'quiet',
    chords: prog(BAR, [[1, Csus2], [1, Cm5], [1, Abmaj7], [1, Abmaj7], [1, Gsus], [1, Gsus]]),
    oars: 'd.......t.......',
    rowing: '',
    guns: '',
    snare: '',
    build: [{ inst: 'horn', form: { tonic: 60, at: 4, augment: 2, take: 6, vel: 0.34 } }],
    combat: [{ inst: 'brass', form: { tonic: 36, at: 8, augment: 2, take: 5, vel: 0.58 } }],
    tense: [{ inst: 'horn', form: { tonic: 60, at: 8, invert: true, augment: 2, take: 4, vel: 0.32 } }],
    prep: [{ inst: 'strings', form: { tonic: 60, at: 0, retrograde: true, take: 5, vel: 0.2 } }],
  },
  {
    name: 'The station',
    role: 'main',
    chords: prog(BAR, [[1, Fm], [1, Cm], [1, Ab], [1, Eb], [1, Fm], [1, Cm], [1, DbonC], [1, G5]]),
    oars: 'D...t.t.D...tTt.',
    rowing: 'D.tTD.tTD.tTD.tT',
    guns: 'o....o..|o..o..R-',
    snare: 'g.xXg.xgX.xXg.xX|g.xXg.xgX.xXXxxX',
    build: [
      { inst: 'strings', form: { tonic: 60, at: 0, colour: H, vel: 0.24 } },
      { inst: 'strings', form: { tonic: 60, at: 12, vel: 0.22 }, answer: true },
      { inst: 'horn', form: { tonic: 60, at: 16, take: 6, vel: 0.34 } },
    ],
    combat: [
      { inst: 'strings', form: { tonic: 72, at: 0, colour: H, vel: 0.4 } },
      { inst: 'brass', form: { tonic: 36, at: 0, colour: H, vel: 0.86 } },
      { inst: 'brass', form: { tonic: 48, at: 12, vel: 0.74 }, answer: true },
      ...torn(16, 0.78),
      { inst: 'horn', form: { tonic: 60, at: 24, take: 6, step: 2, vel: 0.58 } },
    ],
    tense: [{ inst: 'horn', form: { tonic: 60, at: 16, take: 6, colour: H, vel: 0.44 } }],
    prep: [{ inst: 'horn', form: { tonic: 60, at: 0, take: 5, retrograde: true, vel: 0.28 } }],
  },
];

/** Victory (the station held at dawn): the answer in C major on strings and brass over the oars, a held C chord. */
const VICTORY: BattleSting = {
  beats: 12,
  parts: [
    part('strings', motif(SOVIET_ANSWER, { tonic: 72, colour: 'major', art: 'long', vel: 0.42 }), line([[4, 8, 72, 0.3], [4, 8, 79, 0.28]], 'trem')),
    part('brass', motif(SOVIET_ANSWER, { tonic: 36, colour: 'major', vel: 0.8 }), line([[4, 8, 36, 0.72], [4, 8, 43, 0.62]])),
    part('choir', line([[4, 8, 48, 0.5], [4, 8, 52, 0.44], [4, 8, 55, 0.44]])),
    part('hand', hits('D...t.t.D...t.t.', { vel: 0.5 }), hits('D', { at: 4, vel: 0.6 })),
    part('timpani', swell(hits('R---', { step: 1, vel: 0.54, note: 36 }), 0.5, 1), hits('o', { at: 4, vel: 0.85, note: 36 })),
    part('wind', line([[2, 10, 72, 0.4]])),
  ],
};

/** Defeat: the motif's head sinking in the Phrygian colour, the oars stopping, a bare fifth left on the water. */
const DEFEAT: BattleSting = {
  beats: 12,
  parts: [
    part('brass', motif(SOVIET_MOTIF, { tonic: 36, take: 4, augment: 1.5, colour: PH, vel: 0.66 }), line([[6, 6, 36, 0.5], [6, 6, 43, 0.42]])),
    part('hand', hits('D.......d.......', { vel: 0.44 }), hits('d', { at: 6, vel: 0.26 })),
    part('strings', water(prog(BAR, [[3, Cm5]]), [1, 2], 0.2)),
    part('pad', line([[0, 12, 36, 0.48], [0, 12, 43, 0.4]])),
    part('timpani', hits('..o......o', { step: 1, vel: 0.4, note: 38 })),
    part('wind', line([[0, 12, 70, 0.55]])),
  ],
};

export const VOLGA: BattleTrackDef = {
  title: 'The Far Bank',
  theme: 'sovietWinter',
  bpm: 118,
  beatsPerBar: BAR,
  tonic: 0,
  layerLevel: { build: 1.7, combat: 1.12, tense: 1.5, prep: 1.6 },
  gain: 0.8,
  humanize: { time: 0.007, velocity: 0.09 },
  seed: 420915,
  instruments: {
    ...SOVIET_KIT,
    // The oars: a deep, damp stroke and a light knock.
    hand: { ...SOVIET_KIT.hand, dumHz: 82, dumEndHz: 60, dumDecay: 0.4, tekHz: 430, tekDecay: 0.07, level: 0.34 },
    // The guns across the river: a longer boom.
    timpani: { ...SOVIET_KIT.timpani, decay: 1.25 },
  },
  // The timpani further back in the room: across the water.
  mix: { ...SOVIET_MIX, timpani: { dry: 0.75, send: 0.36 }, hand: { dry: 0.8, send: 0.3 } },
  // Over the water: the longest tail of the cold tracks.
  reverb: { ...SOVIET_REVERB, seconds: 2.8, seed: 420915 },
  sections: PLANS.map(section),
  stings: { victory: VICTORY, defeat: DEFEAT },
};
