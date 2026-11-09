/**
 * Mission 1001, Brest Fortress, 22 June 1941: "Four in the Morning". The first of the campaign and the only summer
 * dawn among the cold tracks (src/data/musicTracks/sovietKit.ts): D minor at 112 BPM. The opening is one high violin
 * tremolo over distant timpani, a morning shattered. While calm, a cold pulse of open fifths in the strings; in the
 * fight a driving snare and low brass stabs in a 3 + 3 + 2 grouping (the groove of this track, under every layer),
 * with the Soviet motif "The Long Winter" (src/data/musicThemes.ts) on unison brass; when the walls are about to fall,
 * the high tremolo in octaves over a low pedal. The prep layer is a ticking rim-shot in the same grouping over a string
 * pedal that rises step by step. The quiet section is the muted horn alone with the theme, over choir and smoke. Six
 * sections (a four-bar opening, four of eight bars, a six-bar quiet one) in four layers, plus two stings; the defeat
 * sting ends on a bare fifth. Written for Tin Hats; it quotes no existing melody, march, call, hymn, folk tune or score.
 */
import type { BattleSection, BattleSting, BattleTrackDef, MusicEvent, MusicPart } from '../musicBattle';
import { bass, fit, held, hits, line, onRoots, part, prog, swell, tile, chordAt, type ChordSpan } from '../musicKit';
import { motif, SOVIET_ANSWER, SOVIET_MOTIF } from '../musicThemes';
import { SOVIET_KIT, SOVIET_MIX, SOVIET_REVERB } from './sovietKit';
import { leads, rep, spanBeats, windBand, type Lead } from './sovietParts';

const BAR = 4;
const TIMP: readonly [number, number] = [38, 50];

// Chords, low to high (MIDI). D minor kept bare: open fifths, a sus2, the Phrygian E flat over D for the shock.
const Dm5 = [38, 45, 50, 57];
const Dm = [38, 45, 50, 53];
const Dsus2 = [38, 45, 50, 52];
const Bb = [46, 53, 58, 62];
const Gm = [43, 50, 55, 58];
const Gm5 = [43, 50, 55, 62];
const C5 = [36, 43, 48, 55];
const F5 = [41, 48, 53, 60];
const A5 = [45, 52, 57, 64];
const Asus = [45, 50, 52, 57];
const EbonD = [38, 46, 51, 55];

interface Plan {
  name: string;
  role: BattleSection['role'];
  chords: ChordSpan[];
  /** Two bars of eighths: the open-fifth pulse of the build layer (x, X accented). */
  pulse: string;
  /** Two bars of sixteenths: the combat snare (the section's last bar is its fill) and the string drive under it. */
  snare: string;
  drive: string;
  /** Two bars of eighths for the brass stabs and the combat timpani, on the chord roots. */
  stabs: string;
  timp: string;
  /** The prep layer's string pedal: one note every two bars, climbing. */
  pedal: readonly number[];
  build: readonly Lead[];
  combat: readonly Lead[];
  tense: readonly Lead[];
  prep: readonly Lead[];
}

const beats = (p: Plan): number => spanBeats(p.chords);

/** Open fifths struck together on the chord roots (moved into [lo, lo + 11]), on the pattern's eighths. */
function fifths(chords: readonly ChordSpan[], pattern: string, o: { vel: number; lo: number; step?: number; len?: number }): MusicEvent[] {
  const step = o.step ?? 0.5;
  const out: MusicEvent[] = [];
  for (const e of hits(pattern, { step, vel: o.vel })) {
    const root = fit(chordAt(chords, e.at).notes[0], o.lo, o.lo + 11);
    const len = step * (o.len ?? 0.7);
    out.push({ at: e.at, len, note: root, vel: e.vel, art: 'short' }, { at: e.at, len, note: root + 7, vel: e.vel * 0.85, art: 'short' });
  }
  return out;
}

/** The high violin of the opening: the chord's fifth far up, held in tremolo (and its octave below when `octave`). */
function shard(chords: readonly ChordSpan[], vel: number, octave = false): MusicEvent[] {
  const out: MusicEvent[] = [];
  for (const c of chords) {
    const top = fit(c.notes[0] + 7, 81, 92);
    out.push({ at: c.at, len: c.beats, note: top, vel, art: 'trem' });
    if (octave) out.push({ at: c.at, len: c.beats, note: top - 12, vel: vel * 0.8, art: 'trem' });
  }
  return out;
}

/** Calm: the cold pulse of fifths, the low pad, a high harmonic, a far timpani on each phrase; the motif far off. */
function buildLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  return [
    part('strings', fifths(p.chords, rep(p.pulse, n / (2 * BAR)), { vel: 0.34, lo: 50 }), held(p.chords, { vel: 0.13, voices: [3], shift: 24, art: 'long' })),
    part('pad', held(p.chords, { vel: 0.5, voices: [0, 1] })),
    part('timpani', onRoots(p.chords, rep('o...............|................', n / (4 * BAR)), { step: 0.5, vel: 0.3, range: TIMP })),
    ...leads(p.build),
  ];
}

/** The assault: the driving snare and its fill, brass stabs in 3 + 3 + 2, the strings driving in sixteenths, timpani. */
function combatLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  const reps = n / (2 * BAR);
  // The snare and the stabs grow through the section (the section's climb to its second half, the fill on top).
  const snare = swell(tile(hits(p.snare, { vel: 0.7 }), 2 * BAR, reps).filter((e) => e.at < n - BAR), 0.84, 1.1);
  const fill = swell(hits('X.xxX.xxX.xxRRRR', { at: n - BAR, vel: 0.7 }), 0.75, 1.1);
  return [
    part('strings', bass(p.chords, p.drive, { step: 0.25, vel: 0.44, shift: 12 }), fifths(p.chords, rep('X..X..X.|X..X..X.', reps), { vel: 0.36, lo: 57, len: 0.9 })),
    part('snare', snare, fill),
    part('brass', swell(onRoots(p.chords, rep(p.stabs, reps), { step: 0.5, vel: 0.64, range: [38, 50] }), 0.86, 1.1).map((e) => ({ ...e, len: 0.35, art: 'stab' as const }))),
    part('timpani', onRoots(p.chords, rep(p.timp, reps), { step: 0.5, vel: 0.6, range: TIMP })),
    // Ricochets: a short high anvil twice in two bars.
    part('anvil', tile(hits('.......o........|...........o....', { vel: 0.26, note: 86 }), 2 * BAR, reps)),
    ...leads(p.combat),
  ];
}

/** The walls about to go: the high tremolo in octaves, a rim on the 3 + 3 + 2, a heartbeat, a low unison pedal. */
function tenseLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  return [
    part('strings', shard(p.chords, 0.24, true), bass(p.chords, 'x..x..x.', { step: 0.5, vel: 0.36 })),
    part('snare', tile(hits('r..r..r.r..r..r.', { vel: 0.3 }), BAR, n / BAR - 1), swell(hits('R---------------', { at: n - BAR, vel: 0.42 }), 0.3, 1)),
    part('timpani', onRoots(p.chords, rep('o..o............', n / BAR), { step: 0.25, vel: 0.46, range: TIMP })),
    part('brass', held(p.chords.filter((_, i) => i % 2 === 0).map((c) => ({ ...c, beats: 2 * BAR })), { vel: 0.3, voices: [0] })),
    ...leads(p.tense),
  ];
}

/** Before the guns: the ticking rim in 3 + 3 + 2, a string pedal climbing every two bars, the pad, a far timpani. */
function prepLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  const pedal: MusicEvent[] = p.pedal.map((note, i) => ({ at: i * 2 * BAR, len: Math.min(2 * BAR, n - i * 2 * BAR), note, vel: 0.15 + 0.035 * i, art: 'trem' as const }));
  return [
    part('snare', tile(hits('r.rr.rr.', { step: 0.5, vel: 0.26 }), BAR, n / BAR)),
    part('strings', pedal, held(p.chords, { vel: 0.12, voices: [3], shift: 24, art: 'long' })),
    part('pad', held(p.chords, { vel: 0.45, voices: [0, 1] })),
    part('timpani', onRoots(p.chords, rep('o...............|................', n / (4 * BAR)), { step: 0.5, vel: 0.3, range: TIMP })),
    part('wind', windBand(n, 72, 0.22)),
    ...leads(p.prep),
  ];
}

/** Smoke over the citadel: the muted horn with the theme over choir and smoke; the other layers keep its shape. */
function quietSection(p: Plan): BattleSection {
  const n = beats(p);
  return {
    name: p.name,
    bars: n / BAR,
    role: 'quiet',
    layers: {
      build: [
        part('choir', held(p.chords, { vel: 0.46, voices: [1, 2, 3] })),
        part('pad', held(p.chords, { vel: 0.4, voices: [0] })),
        part('strings', held(p.chords, { vel: 0.12, voices: [3], shift: 24, art: 'long' })),
        part('wind', windBand(n, 76, 0.36)),
        part('timpani', onRoots(p.chords, 'o', { step: 1, vel: 0.24, range: TIMP })),
        ...leads(p.build),
      ],
      combat: [
        part('choir', held(p.chords, { vel: 0.46, voices: [1, 2, 3] })),
        part('strings', fifths(p.chords, rep('x..x..x.', n / BAR), { vel: 0.26, lo: 50 })),
        part('brass', held(p.chords, { vel: 0.34, voices: [0] })),
        part('timpani', swell(onRoots(p.chords, 'R-------', { at: n - 2 * BAR, step: 1, vel: 0.54, range: TIMP }), 0.6, 1)),
        part('snare', swell(hits('R-------', { at: n - 2 * BAR, step: 1, vel: 0.4 }), 0.5, 1)),
        ...leads(p.combat),
      ],
      tense: [
        part('strings', shard(p.chords, 0.2, true)),
        part('snare', tile(hits('r..r..r.', { step: 0.5, vel: 0.24 }), BAR, n / BAR)),
        part('timpani', tile(onRoots(p.chords, 'o..o', { step: 0.25, vel: 0.36, range: TIMP }), 2 * BAR, n / (2 * BAR))),
        part('wind', windBand(n, 76, 0.28)),
        ...leads(p.tense),
      ],
      prep: [
        part('choir', held(p.chords, { vel: 0.4, voices: [1, 2] })),
        part('snare', tile(hits('r..r..r.', { step: 0.5, vel: 0.2 }), BAR, n / BAR)),
        part('strings', p.pedal.map((note, i) => ({ at: i * 2 * BAR, len: Math.min(2 * BAR, n - i * 2 * BAR), note, vel: 0.14 + 0.03 * i, art: 'trem' as const }))),
        part('wind', windBand(n, 72, 0.3)),
        ...leads(p.prep),
      ],
    },
  };
}

/** The opening: one high violin tremolo and distant timpani; the other layers break the morning open. */
function introSection(p: Plan): BattleSection {
  const n = beats(p);
  return {
    name: p.name,
    bars: n / BAR,
    role: 'intro',
    layers: {
      build: [
        part('strings', line([[0, n, 81, 0.26]], 'trem')),
        part('timpani', onRoots(p.chords, 'o.......|......o.|o.......|o...R---', { step: 0.5, vel: 0.32, range: TIMP })),
        part('pad', line([[2 * BAR, 2 * BAR, 38, 0.36]])),
        ...leads(p.build),
      ],
      combat: [
        part('strings', line([[0, n, 81, 0.28]], 'trem'), bass(p.chords, 'X..X..X.', { step: 0.25, vel: 0.46, shift: 12 })),
        part('brass', onRoots(p.chords, 'x..x..x.|x..x..x.|x..x..x.|x.x.x.x.', { step: 0.5, vel: 0.66, range: [38, 50] }).map((e) => ({ ...e, len: 0.35, art: 'stab' as const }))),
        part('snare', hits('X...............|X..x..x.X..x..x.|X.xX.xX.X.xX.xX.|RRRR------------', { vel: 0.68 })),
        part('timpani', onRoots(p.chords, 'o.....o.|o..o..o.|o..o..o.|R-------', { step: 0.5, vel: 0.62, range: TIMP })),
        ...leads(p.combat),
      ],
      tense: [
        part('strings', shard(p.chords, 0.26, true)),
        part('snare', tile(hits('r..r..r.r..r..r.', { vel: 0.3 }), BAR, n / BAR - 1), swell(hits('R---------------', { at: n - BAR, vel: 0.42 }), 0.3, 1)),
        part('timpani', onRoots(p.chords, rep('o..o............', n / BAR), { step: 0.25, vel: 0.46, range: TIMP })),
        part('brass', line([[0, n, 38, 0.3]])),
        ...leads(p.tense),
      ],
      prep: [
        part('strings', line([[0, n, 81, 0.2]], 'trem'), p.pedal.map((note, i) => ({ at: i * 2 * BAR, len: 2 * BAR, note, vel: 0.16 + 0.04 * i, art: 'trem' as const }))),
        part('snare', tile(hits('r.rr.rr.', { step: 0.5, vel: 0.24 }), BAR, n / BAR)),
        part('timpani', onRoots(p.chords, 'o.......|........|o.......|....o...', { step: 0.5, vel: 0.28, range: TIMP })),
        part('wind', windBand(n, 72, 0.22)),
        ...leads(p.prep),
      ],
    },
  };
}

function section(p: Plan): BattleSection {
  if (p.role === 'quiet') return quietSection(p);
  if (p.role === 'intro') return introSection(p);
  return { name: p.name, bars: beats(p) / BAR, role: p.role, layers: { build: buildLayer(p), combat: combatLayer(p), tense: tenseLayer(p), prep: prepLayer(p) } };
}

const PH = 'phrygian' as const;
const H = 'harmonic' as const;

// Every main section climbs to its loudest in bars 5 to 7 (the motif's second statement, the stabs' densest bars) and
// ends open on A or a chord that leads anywhere.
const PLANS: Plan[] = [
  {
    name: 'Four in the morning',
    role: 'intro',
    chords: prog(BAR, [[2, Dm5], [1, EbonD], [1, A5]]),
    pulse: '',
    snare: '',
    drive: '',
    stabs: '',
    timp: '',
    pedal: [50, 52],
    build: [],
    combat: [{ inst: 'brass', form: { tonic: 38, at: 0, take: 4, vel: 0.8 } }],
    tense: [{ inst: 'horn', form: { tonic: 62, at: 4, take: 4, colour: PH, vel: 0.42 } }],
    prep: [{ inst: 'horn', form: { tonic: 62, at: 4, take: 4, augment: 2, vel: 0.28 } }],
  },
  {
    name: 'Across the Bug',
    role: 'main',
    chords: prog(BAR, [[1, Dm], [1, Bb], [1, Gm], [1, A5], [1, Dm], [1, Bb], [1, C5], [1, Asus]]),
    pulse: 'X.x.x.x.|x.x.X.x.',
    snare: 'X.xgx.X.xgx.X.x.|X.xgx.X.xgx.XxxX',
    drive: 'X.xX.xX.X.xX.xX.',
    stabs: 'x..x..x.|x..x..x.',
    timp: 'o..o..o.|o..o..oo',
    pedal: [50, 52, 53, 55],
    build: [{ inst: 'strings', form: { tonic: 74, at: 16, vel: 0.22 } }],
    combat: [
      { inst: 'brass', form: { tonic: 38, at: 0, vel: 0.82 } },
      { inst: 'brass', form: { tonic: 38, at: 12, vel: 0.78 }, answer: true },
      { inst: 'horn', form: { tonic: 62, at: 16, invert: true, vel: 0.55 } },
    ],
    tense: [{ inst: 'horn', form: { tonic: 62, at: 16, take: 4, colour: PH, vel: 0.42 } }],
    prep: [{ inst: 'strings', form: { tonic: 74, at: 16, take: 4, augment: 2, vel: 0.2 } }],
  },
  {
    name: 'The Kholm Gate',
    role: 'main',
    chords: prog(BAR, [[1, Dm5], [1, C5], [1, Bb], [1, A5], [1, Dm5], [1, EbonD], [1, Gm], [1, A5]]),
    pulse: 'X..x..x.|X..x..x.',
    snare: 'X..x..X..x..X.x.|X..x..X..x..XxXx',
    drive: 'X.x.X.xxX.x.X.xx',
    stabs: 'x..x..x.|x..x....',
    timp: 'o..o..o.|o..o.o.o',
    pedal: [45, 46, 48, 50],
    build: [
      { inst: 'strings', form: { tonic: 74, at: 0, vel: 0.2 }, answer: true },
      { inst: 'horn', form: { tonic: 62, at: 16, take: 6, vel: 0.34 } },
    ],
    combat: [
      { inst: 'brass', form: { tonic: 38, at: 0, augment: 0.5, vel: 0.8 }, stab: true },
      { inst: 'brass', form: { tonic: 38, at: 8, augment: 0.5, step: 2, vel: 0.82 }, stab: true },
      { inst: 'horn', form: { tonic: 62, at: 16, colour: H, vel: 0.56 } },
    ],
    tense: [{ inst: 'strings', form: { tonic: 74, at: 0, invert: true, augment: 2, take: 5, vel: 0.26 } }],
    prep: [{ inst: 'horn', form: { tonic: 62, at: 16, take: 4, vel: 0.3 } }],
  },
  {
    name: 'The ring barracks',
    role: 'main',
    chords: prog(BAR, [[1, Gm], [1, Dm], [1, Bb], [1, F5], [1, Gm], [1, Dm], [1, EbonD], [1, Asus]]),
    pulse: 'x.x.X.x.|x.X.x.x.',
    snare: 'X.gx.gX.gx.gX.g.|X.gx.gX.gx.gXxgX',
    drive: 'Xx.Xx.Xx.Xx.X.x.',
    stabs: 'x..x..x.|....x.x.',
    timp: 'o..o..o.|o...o.oo',
    pedal: [43, 45, 46, 48],
    build: [
      { inst: 'horn', form: { tonic: 62, at: 4, take: 4, colour: PH, vel: 0.36 } },
      { inst: 'horn', form: { tonic: 62, at: 20, take: 4, colour: PH, step: -1, vel: 0.34 } },
    ],
    combat: [
      { inst: 'brass', form: { tonic: 38, at: 0, augment: 2, take: 6, colour: PH, vel: 0.84 } },
      { inst: 'horn', form: { tonic: 62, at: 18, invert: true, take: 6, colour: PH, vel: 0.52 } },
    ],
    tense: [{ inst: 'horn', form: { tonic: 62, at: 16, invert: true, take: 5, vel: 0.42 } }],
    prep: [{ inst: 'horn', form: { tonic: 62, at: 8, take: 4, colour: PH, augment: 2, vel: 0.28 } }],
  },
  {
    name: 'Every courtyard',
    role: 'main',
    chords: prog(BAR, [[1, Bb], [1, C5], [1, Dm], [1, Dm], [1, Bb], [1, C5], [1, Asus], [1, A5]]),
    pulse: 'X.xxX.x.|X.xxX.xx',
    snare: 'X.xXx.X.xXx.X.xx|X.xXx.X.xXx.XxXX',
    drive: 'X.xX.xX.X.xX.xX5',
    stabs: 'x..x..x.|x..x..xx',
    timp: 'o..o..o.|o..o..oo',
    pedal: [46, 48, 50, 52],
    build: [
      { inst: 'horn', form: { tonic: 62, at: 0, vel: 0.38 } },
      { inst: 'horn', form: { tonic: 62, at: 12, vel: 0.36 }, answer: true },
      { inst: 'strings', form: { tonic: 74, at: 16, take: 6, step: 2, vel: 0.22 } },
    ],
    combat: [
      { inst: 'brass', form: { tonic: 38, at: 0, vel: 0.86 } },
      { inst: 'brass', form: { tonic: 38, at: 12, vel: 0.82 }, answer: true },
      { inst: 'horn', form: { tonic: 62, at: 16, step: 2, vel: 0.6 } },
      { inst: 'brass', form: { tonic: 50, at: 28, vel: 0.74 }, answer: true },
    ],
    tense: [{ inst: 'horn', form: { tonic: 62, at: 16, take: 6, colour: H, vel: 0.44 } }],
    prep: [{ inst: 'strings', form: { tonic: 74, at: 0, take: 5, retrograde: true, vel: 0.2 } }],
  },
  {
    name: 'Smoke over the citadel',
    role: 'quiet',
    chords: prog(BAR, [[1, Dsus2], [1, Dm5], [1, Bb], [1, Gm5], [1, Asus], [1, A5]]),
    pulse: '',
    snare: '',
    drive: '',
    stabs: '',
    timp: '',
    pedal: [50, 52, 53],
    // The muted horn alone with the whole theme: the motif, then its answer.
    build: [
      { inst: 'horn', form: { tonic: 62, at: 0, vel: 0.4 } },
      { inst: 'horn', form: { tonic: 62, at: 12, vel: 0.36 }, answer: true },
    ],
    combat: [{ inst: 'brass', form: { tonic: 38, at: 0, augment: 2, take: 5, vel: 0.6 } }],
    tense: [{ inst: 'horn', form: { tonic: 62, at: 4, invert: true, augment: 2, take: 4, vel: 0.32 } }],
    prep: [{ inst: 'horn', form: { tonic: 62, at: 8, take: 4, vel: 0.28 } }],
  },
];

/** Victory (nightfall, the citadel held): the answer in D major on horn and brass, the fifths stopping on a D chord. */
const VICTORY: BattleSting = {
  beats: 12,
  parts: [
    part('horn', motif(SOVIET_ANSWER, { tonic: 62, colour: 'major', vel: 0.6 })),
    part('brass', motif(SOVIET_ANSWER, { tonic: 38, colour: 'major', vel: 0.78 }), line([[4, 8, 38, 0.72], [4, 8, 45, 0.62]])),
    part('strings', fifths(prog(BAR, [[1, Dm5]]), 'X..X..X.', { vel: 0.4, lo: 50 }), line([[4, 8, 78, 0.28], [4, 8, 81, 0.26]], 'trem')),
    part('choir', line([[4, 8, 50, 0.48], [4, 8, 54, 0.42], [4, 8, 57, 0.42]])),
    part('timpani', swell(hits('R---', { step: 1, vel: 0.54, note: 38 }), 0.5, 1), hits('o', { at: 4, vel: 0.85, note: 38 })),
    part('snare', hits('X..x..x.', { step: 0.5, vel: 0.6 }), hits('F', { at: 4, vel: 0.75 })),
  ],
};

/** Defeat: the motif's head sinking in the Phrygian colour on low brass, onto a bare fifth (D and A) in smoke. */
const DEFEAT: BattleSting = {
  beats: 12,
  parts: [
    part('brass', motif(SOVIET_MOTIF, { tonic: 38, take: 4, augment: 1.5, colour: 'phrygian', vel: 0.66 }), line([[6, 6, 38, 0.5], [6, 6, 45, 0.42]])),
    part('strings', line([[0, 12, 81, 0.2]], 'trem'), line([[6, 6, 62, 0.18], [6, 6, 69, 0.16]], 'long')),
    part('pad', line([[0, 12, 38, 0.48], [0, 12, 45, 0.4]])),
    part('snare', hits('r..r..r.', { step: 0.5, vel: 0.24 })),
    part('timpani', hits('o.....o', { step: 1, vel: 0.6, note: 38 })),
    part('wind', line([[0, 12, 72, 0.45]])),
  ],
};

export const BREST: BattleTrackDef = {
  title: 'Four in the Morning',
  theme: 'sovietWinter',
  bpm: 112,
  beatsPerBar: BAR,
  tonic: 2,
  layerLevel: { build: 1.5, combat: 1.08, tense: 1.4, prep: 1.45 },
  gain: 0.8,
  humanize: { time: 0.006, velocity: 0.08 },
  seed: 410622,
  // The muted horn of the quiet section: darker and closer than the kit's.
  instruments: { ...SOVIET_KIT, horn: { ...SOVIET_KIT.horn, cutoff: 640, brightness: 880, vibratoCents: 4 } },
  mix: SOVIET_MIX,
  // Stone courtyards: a little shorter than the snowfields.
  reverb: { ...SOVIET_REVERB, seconds: 2.1, seed: 410622 },
  sections: PLANS.map(section),
  stings: { victory: VICTORY, defeat: DEFEAT },
};
