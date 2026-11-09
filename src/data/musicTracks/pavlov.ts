/**
 * Mission 1007, the house on 9 January Square, autumn 1942: "The Lamp in the Window". The most intimate of the cold
 * tracks (src/data/musicTracks/sovietKit.ts): B minor at 104 BPM, chamber-sized, in a small room. Its sections follow
 * the mission's days and nights. By day a solo high string line sings the Soviet motif "The Long Winter"
 * (src/data/musicThemes.ts) over a soft pad and a plucked bass note a bar; by night a clock ticks (a rim on one and
 * three, a knock on two and four) under string harmonics and the theme on a single muted horn. The fight stays light
 * and driving: a running snare of ghost notes and short string chords on the off-beats over a plucked bass, the horn
 * and the high strings trading the theme; only on the day of the tanks do low brass and timpani come in. When the house
 * is about to fall the clock runs twice as fast. The prep layer is the night's work on mines and wire: harmonics, a
 * pluck, a spade on the last beat. The quiet section, "A home again", is the one place the theme turns major (B
 * major), tender, on the horn over a humming choir and a music-box bell. Six sections (four of six bars, two of eight)
 * in four layers, plus two stings. Written for Tin Hats; it quotes no existing melody, march, call, hymn, folk tune or
 * score.
 */
import type { BattleSection, BattleSting, BattleTrackDef, MusicEvent, MusicPart } from '../musicBattle';
import { bass, held, hits, line, onRoots, ostinato, part, prog, swell, tile, type ChordSpan } from '../musicKit';
import { motif, SOVIET_ANSWER, SOVIET_MOTIF } from '../musicThemes';
import { SOVIET_KIT, SOVIET_MIX, SOVIET_REVERB } from './sovietKit';
import { leads, rep, spanBeats, windBand, type Lead } from './sovietParts';

const BAR = 4;
const TIMP: readonly [number, number] = [40, 52];

// Chords, low to high (MIDI). B minor, close and quiet: fifths and add9s in the middle register, the Phrygian C over B
// at night; B major, E major 7 and F sharp for the one tender section.
const Bm5 = [47, 54, 59, 66];
const Bm = [47, 54, 59, 62];
const Bmadd9 = [47, 54, 61, 62];
const G = [43, 50, 55, 59];
const Gmaj7 = [43, 50, 54, 59];
const D = [50, 57, 62, 66];
const A = [45, 52, 57, 61];
const Asus2 = [45, 52, 57, 59];
const Em7 = [40, 47, 50, 55];
const Em = [40, 47, 52, 55];
const Fssus4 = [42, 49, 54, 59];
const Fs5 = [42, 49, 54, 61];
const Fs = [42, 49, 54, 58];
const ConB = [47, 55, 60, 64];
const B = [47, 54, 59, 63];
const Emaj7 = [40, 47, 51, 56];

interface Plan {
  name: string;
  role: BattleSection['role'];
  chords: ChordSpan[];
  /** Night: the clock and the harmonics instead of the day's solo strings and pad. */
  night: boolean;
  /** The day of the tanks: low brass and timpani join the light fight. */
  tanks?: boolean;
  /** Two bars of sixteenths: the running snare of the fight. */
  snare: string;
  build: readonly Lead[];
  combat: readonly Lead[];
  tense: readonly Lead[];
  prep: readonly Lead[];
}

const beats = (p: Plan): number => spanBeats(p.chords);

/** The clock: a rim ("tick") and a knock ("tock") taking turns every `every` beats, starting `from` beats in. */
function clock(n: number, every: number, vel: number, from = 0): { tick: MusicEvent[]; tock: MusicEvent[] } {
  const tick: MusicEvent[] = [];
  const tock: MusicEvent[] = [];
  for (let k = 0, t = from; t < n - 1e-9; k++, t += every) {
    if (k % 2 === 0) tick.push({ at: t, len: 0, note: 0, vel, art: 'rim' });
    else tock.push({ at: t, len: 0, note: 0, vel: vel * 0.9, art: 'tek' });
  }
  return { tick, tock };
}

/** String harmonics: the chord's upper tones two octaves up, held. */
function harmonics(p: Plan, vel: number, art: 'long' | 'trem' = 'long'): MusicEvent[] {
  return held(p.chords, { vel, voices: [2, 3], shift: 24, art }).map((e) => (e.note > 93 ? { ...e, note: e.note - 12 } : e));
}

/** Calm. Day: the soft pad and a plucked bass note a bar under the solo strings. Night: the clock and the harmonics. */
function buildLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  if (p.night) {
    const c = clock(n, 1, 0.24);
    return [
      part('snare', c.tick),
      part('hand', c.tock),
      part('strings', harmonics(p, 0.14)),
      part('pad', held(p.chords, { vel: 0.34, voices: [0, 1] })),
      ...leads(p.build),
    ];
  }
  return [
    part('pad', held(p.chords, { vel: 0.48, voices: [0, 1, 2] })),
    part('strings', bass(p.chords, 'x.......', { step: 0.5, vel: 0.26 })),
    part('wind', windBand(n, 70, 0.2)),
    ...leads(p.build),
  ];
}

/** The fight on the stairs: a running snare, short string chords on the off-beats, a plucked bass; tanks bring brass. */
function combatLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  const reps = n / (2 * BAR);
  const snare = tile(hits(p.snare, { vel: 0.62 }), 2 * BAR, reps).filter((e) => e.at < n - BAR);
  const fill = swell(hits('g.g.x.g.x.x.xxxx', { at: n - BAR, vel: 0.62 }), 0.7, 1.1);
  const chops = ostinato(p.chords, [-1, 1, -1, 2, -1, 3, -1, 2], { step: 0.5, vel: 0.46, shift: 12, accents: [3], accent: 1.2, len: 0.6 });
  const pluck = bass(p.chords, 'X.x.5.x.', { step: 0.5, vel: 0.5 });
  const out: MusicPart[] = [part('snare', snare, fill), part('strings', chops, pluck), part('pad', held(p.chords, { vel: 0.3, voices: [1, 2] }))];
  if (p.tanks) {
    out.push(
      part('brass', held(p.chords.filter((_, i) => i % 2 === 0).map((c) => ({ ...c, beats: 2 * BAR })), { vel: 0.32, voices: [0] })),
      part('timpani', onRoots(p.chords, rep('o.......|....o...', reps), { step: 0.5, vel: 0.5, range: TIMP })),
    );
  }
  if (p.night) out.push(part('strings', harmonics(p, 0.12)));
  return [...out, ...leads(p.combat)];
}

/** The house about to fall: the clock twice as fast, the harmonics trembling, a low pulse on the beat. */
function tenseLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  const c = clock(n, 0.5, 0.4);
  return [
    part('snare', c.tick, p.night ? [] : swell(hits('R---------------', { at: n - BAR, vel: 0.36 }), 0.3, 1)),
    part('hand', c.tock),
    part('strings', harmonics(p, 0.3, 'trem'), bass(p.chords, 'x.x.x.x.', { step: 0.5, vel: 0.44 })),
    part('pad', held(p.chords, { vel: 0.3, voices: [0, 1] })),
    ...leads(p.tense),
  ];
}

/** The night's work, mines across the square and wire at the doors: harmonics, a pluck, a spade on the last beat. */
function prepLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  return [
    part('strings', harmonics(p, 0.14), bass(p.chords, 'x.5.............', { step: 0.5, vel: 0.24 })),
    part('hand', tile(hits('............T...', { vel: 0.34 }), BAR, n / BAR)),
    part('pad', held(p.chords, { vel: 0.4, voices: [0, 1] })),
    part('wind', windBand(n, 68, 0.2)),
    ...leads(p.prep),
  ];
}

/** A home again: the choir humming, a music-box bell, the theme in B major; the other layers keep its shape, quietly. */
function quietSection(p: Plan): BattleSection {
  const n = beats(p);
  const box = ostinato(p.chords, [3, -1, 2, -1, 1, -1, 2, -1], { step: 0.5, vel: 0.22, shift: 24, len: 0.5 }).filter((e) => e.note <= 96);
  const c = clock(n, 1, 0.18);
  return {
    name: p.name,
    bars: n / BAR,
    role: 'quiet',
    layers: {
      build: [part('choir', held(p.chords, { vel: 0.44, voices: [1, 2, 3] })), part('pad', held(p.chords, { vel: 0.3, voices: [0] })), part('bell', box), part('wind', windBand(n, 76, 0.26)), ...leads(p.build)],
      combat: [
        part('choir', held(p.chords, { vel: 0.42, voices: [1, 2, 3] })),
        part('strings', ostinato(p.chords, [-1, 1, -1, 2, -1, 3, -1, 2], { step: 0.5, vel: 0.28, shift: 12, len: 0.6 }), bass(p.chords, 'x...5...', { step: 0.5, vel: 0.32 })),
        part('snare', swell(hits('R-------', { at: n - 2 * BAR, step: 1, vel: 0.34 }), 0.5, 1)),
        ...leads(p.combat),
      ],
      tense: [part('snare', c.tick), part('hand', c.tock), part('strings', harmonics(p, 0.2, 'trem')), part('wind', windBand(n, 76, 0.3)), ...leads(p.tense)],
      prep: [part('choir', held(p.chords, { vel: 0.38, voices: [1, 2] })), part('bell', box.filter((_, i) => i % 2 === 0)), part('wind', windBand(n, 72, 0.28)), ...leads(p.prep)],
    },
  };
}

function section(p: Plan): BattleSection {
  if (p.role === 'quiet') return quietSection(p);
  return { name: p.name, bars: beats(p) / BAR, role: p.role, layers: { build: buildLayer(p), combat: combatLayer(p), tense: tenseLayer(p), prep: prepLayer(p) } };
}

const PH = 'phrygian' as const;
const H = 'harmonic' as const;
const MAJ = 'major' as const;

const PLANS: Plan[] = [
  {
    name: 'Take the house',
    role: 'intro',
    night: true,
    chords: prog(BAR, [[1, Bm5], [1, Bm5], [1, G], [1, G], [1, Fssus4], [1, Fs5]]),
    snare: 'g.g.x.g.g.g.x.gg|g.g.x.g.g.gxx.g.',
    build: [{ inst: 'horn', form: { tonic: 59, at: 8, take: 4, vel: 0.34 } }],
    combat: [
      { inst: 'horn', form: { tonic: 59, at: 0, vel: 0.5 } },
      { inst: 'strings', form: { tonic: 83, at: 12, vel: 0.34 }, answer: true },
    ],
    tense: [{ inst: 'strings', form: { tonic: 83, at: 4, take: 4, invert: true, vel: 0.26 } }],
    prep: [{ inst: 'horn', form: { tonic: 59, at: 8, take: 4, augment: 2, vel: 0.28 } }],
  },
  {
    name: 'Day one',
    role: 'main',
    night: false,
    chords: prog(BAR, [[1, Bm], [1, G], [1, D], [1, A], [1, Bmadd9], [1, Em7], [1, Gmaj7], [1, Fssus4]]),
    snare: 'g.ggx.ggg.ggx.gg|g.ggx.ggg.gxx.gg',
    build: [
      { inst: 'strings', form: { tonic: 83, at: 0, vel: 0.28 } },
      { inst: 'strings', form: { tonic: 83, at: 12, vel: 0.26 }, answer: true },
      { inst: 'horn', form: { tonic: 59, at: 16, take: 6, vel: 0.3 } },
    ],
    combat: [
      { inst: 'horn', form: { tonic: 59, at: 0, vel: 0.52 } },
      { inst: 'horn', form: { tonic: 59, at: 12, vel: 0.5 }, answer: true },
      { inst: 'strings', form: { tonic: 83, at: 16, take: 6, step: 2, vel: 0.36 } },
    ],
    tense: [{ inst: 'horn', form: { tonic: 59, at: 16, take: 5, colour: H, vel: 0.4 } }],
    prep: [{ inst: 'strings', form: { tonic: 83, at: 16, take: 4, vel: 0.22 } }],
  },
  {
    name: 'Night one',
    role: 'main',
    night: true,
    chords: prog(BAR, [[1, Bm5], [1, ConB], [1, Bm5], [1, ConB], [1, Em], [1, D], [1, ConB], [1, Fs5]]),
    snare: 'g...x.g.g.g.x.g.|g...x.g.g.gxx.g.',
    build: [
      { inst: 'horn', form: { tonic: 59, at: 4, take: 4, colour: PH, vel: 0.34 } },
      { inst: 'horn', form: { tonic: 59, at: 20, take: 4, colour: PH, step: -1, vel: 0.32 } },
    ],
    combat: [
      { inst: 'horn', form: { tonic: 71, at: 0, invert: true, colour: PH, vel: 0.5 } },
      { inst: 'strings', form: { tonic: 83, at: 16, augment: 0.5, colour: PH, vel: 0.34 } },
    ],
    tense: [{ inst: 'strings', form: { tonic: 83, at: 0, invert: true, augment: 2, take: 5, colour: PH, vel: 0.24 } }],
    prep: [{ inst: 'horn', form: { tonic: 59, at: 8, take: 4, colour: PH, augment: 2, vel: 0.28 } }],
  },
  {
    name: 'Day two: the tanks',
    role: 'main',
    night: false,
    tanks: true,
    chords: prog(BAR, [[1, Em7], [1, Bm], [1, G], [1, D], [1, Gmaj7], [1, Fssus4]]),
    snare: 'x.ggx.ggx.ggx.gx|x.ggx.ggx.gxx.xx',
    build: [
      { inst: 'strings', form: { tonic: 83, at: 0, retrograde: true, vel: 0.26 } },
      { inst: 'horn', form: { tonic: 59, at: 16, vel: 0.3 }, answer: true },
    ],
    combat: [
      { inst: 'horn', form: { tonic: 59, at: 0, colour: H, vel: 0.54 } },
      { inst: 'strings', form: { tonic: 83, at: 12, vel: 0.36 }, answer: true },
      { inst: 'horn', form: { tonic: 71, at: 16, invert: true, take: 4, vel: 0.5 } },
    ],
    tense: [{ inst: 'horn', form: { tonic: 59, at: 8, take: 6, vel: 0.4 } }],
    prep: [{ inst: 'strings', form: { tonic: 83, at: 8, take: 4, augment: 2, vel: 0.2 } }],
  },
  {
    name: 'The last night',
    role: 'main',
    night: true,
    chords: prog(BAR, [[1, G], [1, D], [1, Asus2], [1, Bm], [1, G], [1, Fs5]]),
    snare: 'g.g.x.g.g.g.x.g.|g.g.x.g.g.g.xxgg',
    build: [
      { inst: 'horn', form: { tonic: 59, at: 0, vel: 0.34 } },
      { inst: 'horn', form: { tonic: 59, at: 12, vel: 0.3 }, answer: true },
    ],
    combat: [
      { inst: 'strings', form: { tonic: 83, at: 0, vel: 0.36 } },
      { inst: 'horn', form: { tonic: 59, at: 12, vel: 0.5 }, answer: true },
      { inst: 'horn', form: { tonic: 59, at: 16, take: 4, step: 2, vel: 0.5 } },
    ],
    tense: [{ inst: 'strings', form: { tonic: 83, at: 12, take: 4, colour: H, vel: 0.26 } }],
    prep: [{ inst: 'horn', form: { tonic: 59, at: 4, take: 4, retrograde: true, vel: 0.26 } }],
  },
  {
    name: 'A home again',
    role: 'quiet',
    night: false,
    chords: prog(BAR, [[1, B], [1, Emaj7], [1, Fs], [1, B], [1, Emaj7], [1, Fssus4]]),
    snare: '',
    // The theme's one tender statement in the major colour.
    build: [
      { inst: 'horn', form: { tonic: 59, at: 0, colour: MAJ, vel: 0.36 } },
      { inst: 'horn', form: { tonic: 59, at: 12, colour: MAJ, vel: 0.32 }, answer: true },
    ],
    combat: [{ inst: 'strings', form: { tonic: 83, at: 0, colour: MAJ, vel: 0.3 } }],
    tense: [{ inst: 'horn', form: { tonic: 59, at: 8, invert: true, take: 4, augment: 2, colour: MAJ, vel: 0.3 } }],
    prep: [{ inst: 'choir', form: { tonic: 59, at: 4, take: 4, augment: 2, colour: MAJ, vel: 0.36 } }],
  },
];

/** Victory (the guns to the north): the answer in B major on the solo strings, echoed by the horn, over pad and choir. */
const VICTORY: BattleSting = {
  beats: 12,
  parts: [
    part('strings', motif(SOVIET_ANSWER, { tonic: 83, colour: MAJ, art: 'long', vel: 0.38 }), line([[4, 8, 78, 0.24], [4, 8, 83, 0.24]], 'trem')),
    part('horn', motif(SOVIET_ANSWER, { tonic: 59, colour: MAJ, at: 2, vel: 0.42 }), line([[6, 6, 63, 0.3]])),
    part('pad', line([[0, 12, 47, 0.42], [0, 12, 54, 0.38], [4, 8, 63, 0.3]])),
    part('choir', line([[4, 8, 54, 0.42], [4, 8, 59, 0.38], [4, 8, 63, 0.36]])),
    part('snare', hits('r...', { step: 1, vel: 0.22 })),
    part('hand', hits('.t..', { step: 1, vel: 0.2 })),
    part('wind', line([[3, 9, 74, 0.3]])),
  ],
};

/** Defeat (the house lost): the clock slowing to a stop, the motif's head sinking on the horn, a bare fifth in the snow. */
const DEFEAT: BattleSting = {
  beats: 12,
  parts: [
    part('horn', motif(SOVIET_MOTIF, { tonic: 59, take: 4, augment: 1.5, colour: PH, vel: 0.4 }), line([[6, 6, 54, 0.3]])),
    part('snare', line([[0, 0, 0, 0.24], [2, 0, 0, 0.2], [5, 0, 0, 0.16]], 'rim')),
    part('hand', line([[1, 0, 0, 0.22], [3.5, 0, 0, 0.18]], 'tek')),
    part('strings', line([[0, 12, 78, 0.16], [0, 12, 83, 0.14]], 'long')),
    part('pad', line([[0, 12, 47, 0.42], [0, 12, 54, 0.36]])),
    part('wind', line([[0, 12, 74, 0.45]])),
  ],
};

export const PAVLOV: BattleTrackDef = {
  title: 'The Lamp in the Window',
  theme: 'sovietWinter',
  bpm: 104,
  beatsPerBar: BAR,
  tonic: 11,
  layerLevel: { build: 1.7, combat: 1.35, tense: 1.65, prep: 1.6 },
  gain: 0.8,
  humanize: { time: 0.007, velocity: 0.09 },
  seed: 421015,
  instruments: {
    ...SOVIET_KIT,
    // Chamber strings: two close voices, short and light chords, a gentler tremolo.
    strings: { ...SOVIET_KIT.strings, voices: 2, detuneCents: 4, short: 0.12, tremDepth: 0.3 },
    // The single muted horn, darker and closer.
    horn: { ...SOVIET_KIT.horn, cutoff: 640, brightness: 820, vibratoCents: 4 },
    // A lighter snare for the running ghost notes, and a dry wooden knock for the clock.
    snare: { ...SOVIET_KIT.snare, ghost: 0.42, level: 0.32 },
    hand: { ...SOVIET_KIT.hand, tekHz: 900, tekDecay: 0.05, level: 0.3 },
  },
  mix: { ...SOVIET_MIX, horn: { dry: 0.7, send: 0.45 } },
  // A room in a ruined house: shorter and closer than the other cold tracks.
  reverb: { ...SOVIET_REVERB, seconds: 1.7, preDelay: 0.015, brightHz: 4600, darkHz: 1300, seed: 421015 },
  sections: PLANS.map(section),
  stings: { victory: VICTORY, defeat: DEFEAT },
};
