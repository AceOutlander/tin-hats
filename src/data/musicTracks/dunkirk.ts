/**
 * Mission 2, the Dunkirk perimeter 1940: "The Last Perimeter". Desperate and rushing: C minor at 152 BPM, strings
 * running in sixteenths even while calm, the snare racing, harmony pulled down to the flattened second (D flat) and
 * hanging on G major, the British motif "The Line" (src/data/musicThemes.ts) hurried into diminution and chased by
 * itself in stretto. A survival mission spends most of its time on the clock or with the enemy at the trench, so the
 * tense layer is the fullest one here: a low pedal ostinato, a ticking rim, the heartbeat timpani and the motif in
 * canon between horn and strings. The prep layer builds: a pedal, a tremolo swelling, timpani strokes closing in and
 * the head of the motif climbing step by step. Seven sections of eight bars in four layers (354 s of distinct music),
 * plus two stings. Written for Tin Hats; it quotes no existing melody, march, call or score.
 */
import type { BattleSection, BattleSting, BattleTrackDef, MusicPart } from '../musicBattle';
import { bass, held, hits, line, onRoots, ostinato, part, prog, swell, tile, type ChordSpan } from '../musicKit';
import { BRITISH_ANSWER, BRITISH_MOTIF, motif, type MotifForm } from '../musicThemes';
import { BATTLE_KIT, BATTLE_MIX, BATTLE_REVERB } from './kit';

const BAR = 4;
const TIMP: readonly [number, number] = [36, 52];

// Chords, low to high (MIDI), C minor with the Neapolitan D flat, the leading-tone B diminished and the G major dominant.
const Cm = [36, 48, 51, 55];
const Cm9 = [36, 50, 51, 55];
const CmG = [43, 51, 55, 60];
const AbC = [36, 48, 51, 56];
const Ab = [44, 48, 51, 56];
const Abmaj7 = [44, 48, 51, 55];
const Fm = [41, 48, 53, 56];
const Eb = [39, 51, 55, 58];
const Bb = [46, 50, 53, 58];
const G = [43, 50, 55, 59];
const Gsus = [43, 50, 55, 60];
const Db = [37, 49, 53, 56];
const Bdim7 = [47, 50, 53, 56];

interface Lead {
  inst: 'horn' | 'strings' | 'brass';
  form: MotifForm;
  answer?: boolean;
}

interface Plan {
  name: string;
  role: BattleSection['role'];
  chords: ChordSpan[];
  /** Sixteenth-note string ostinatos (chord-tone indices): soft and low while calm, an octave up in combat. */
  ostBuild: readonly number[];
  ostCombat: readonly number[];
  /** The tense layer's low pedal figure in sixteenths. */
  ostTense: readonly number[];
  /** Two bars of sixteenths for the combat snare (the last bar of the section is a fill). */
  snare: string;
  /** Two bars of eighths: combat timpani and brass stabs on the chord roots. */
  timp: string;
  stabs: string;
  build: readonly Lead[];
  combat: readonly Lead[];
  tense: readonly Lead[];
  prep: readonly Lead[];
}

function leads(list: readonly Lead[]): MusicPart[] {
  return list.map((l) => part(l.inst, motif(l.answer ? BRITISH_ANSWER : BRITISH_MOTIF, { art: l.inst === 'strings' ? 'long' : undefined, ...l.form })));
}

const beats = (p: Plan): number => p.chords.reduce((n, c) => n + c.beats, 0);

function rep(pattern: string, times: number): string {
  return Array.from({ length: Math.round(times) }, () => pattern).join('');
}

/** Calm, but never at rest: soft low sixteenths, a pad, a ghosted snare and the motif far off. */
function buildLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  return [
    part('strings', ostinato(p.chords, p.ostBuild, { step: 0.25, vel: 0.26, accents: [0, 8], accent: 1.35 }), bass(p.chords, 'x...x...', { step: 0.5, vel: 0.28 })),
    part('pad', held(p.chords, { vel: 0.55, voices: [0, 1, 2] })),
    part('snare', tile(hits('....g.......g...|....g.......g.g.', { vel: 0.28 }), 2 * BAR, n / (2 * BAR))),
    part('timpani', onRoots(p.chords, 'o.......|....o...', { step: 0.5, vel: 0.34, range: TIMP })),
    ...leads(p.build),
  ];
}

/** Heavy fighting: high racing strings, the snare at full tilt with a fill, timpani and brass stabs, the motif hurried. */
function combatLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  const reps = n / (2 * BAR);
  const snare = tile(hits(p.snare, { vel: 0.7 }), 2 * BAR, reps).filter((e) => e.at < n - BAR);
  const fill = swell(hits('x.xxx.xxR-------', { at: n - BAR, vel: 0.72 }), 0.7, 1.1);
  return [
    part('strings', ostinato(p.chords, p.ostCombat, { step: 0.25, vel: 0.55, shift: 12, accents: [0, 6, 12], accent: 1.35 }), bass(p.chords, 'X.x.x.x.', { step: 0.5, vel: 0.5 })),
    part('pad', held(p.chords, { vel: 0.48, voices: [1, 2, 3] })),
    part('snare', snare, fill),
    part('timpani', onRoots(p.chords, rep(p.timp, reps), { step: 0.5, vel: 0.62, range: TIMP })),
    part('brass', onRoots(p.chords, rep(p.stabs, reps), { step: 0.5, vel: 0.62, range: [36, 52] }).map((e) => ({ ...e, len: 0.4, art: 'stab' as const }))),
    ...leads(p.combat),
  ];
}

/**
 * The trench about to fall or the clock nearly out, which is most of this mission: a low pedal in sixteenths under a
 * high tremolo, a ticking rim that rolls up every fourth bar, a heartbeat on the timpani, the motif chasing itself.
 */
function tenseLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  const clock = tile(hits('r.g.r.g.r.g.r.g.|r.g.r.g.r.g.r.g.|r.g.r.g.r.g.r.g.|r.g.r.g.', { vel: 0.3 }), 4 * BAR, n / (4 * BAR));
  const rolls = [0, 1].flatMap((k) => swell(hits('R-------', { at: (k + 1) * 4 * BAR - 2, vel: 0.5 }), 0.4, 1));
  return [
    part('strings', held(p.chords, { vel: 0.28, voices: [1, 2, 3], shift: 12, art: 'trem' }), ostinato(p.chords, p.ostTense, { step: 0.25, vel: 0.4, shift: 12, accents: [0], accent: 1.3 })),
    part('snare', clock.filter((e) => e.at < n), rolls),
    part('timpani', onRoots(p.chords, rep('o.o.....|o.o...o.', n / (2 * BAR)), { step: 0.5, vel: 0.5, range: TIMP })),
    part('brass', held(p.chords, { vel: 0.32, voices: [0] })),
    ...leads(p.tense),
  ];
}

/** Eight bars of eighths for the prep timpani: strokes closing in towards the attack. */
const PREP_TIMP = 'o.......|........|o.......|....o...|o...o...|o...o...|o.o.o.o.|o.o.oooo';

/** Waiting for them: a pedal, a tremolo that swells each phrase, timpani closing in, a rim on two and four, then a roll. */
function prepLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  const half = n / 2;
  const trem = held(p.chords, { vel: 0.3, voices: [1, 2], art: 'trem' });
  return [
    part('pad', held(p.chords, { vel: 0.5, voices: [0, 1] })),
    part('strings', swell(trem.filter((e) => e.at < half), 0.45, 1), swell(trem.filter((e) => e.at >= half), 0.6, 1.2), bass(p.chords, 'x.......', { step: 0.5, vel: 0.3 })),
    part('timpani', onRoots(p.chords, PREP_TIMP, { step: 0.5, vel: 0.42, range: TIMP })),
    part('snare', tile(hits('....r.......r...', { vel: 0.3 }), BAR, n / BAR - 1), swell(hits('R---------------', { at: n - BAR, vel: 0.45 }), 0.3, 1)),
    ...leads(p.prep),
  ];
}

/** A breath: long chords and space, the motif slowed right down; the other layers keep their shape at low strength. */
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
        part('strings', ostinato(p.chords, p.ostBuild, { step: 0.25, vel: 0.3 })),
        part('brass', held(p.chords, { vel: 0.4, voices: [0, 1] })),
        part('timpani', swell(onRoots(p.chords, 'R-------', { at: n - 2 * BAR, step: 1, vel: 0.6, range: TIMP }), 0.6, 1)),
        part('snare', swell(hits('R-------', { at: n - 2 * BAR, step: 1, vel: 0.45 }), 0.5, 1)),
        ...leads(p.combat),
      ],
      tense: [
        part('strings', held(p.chords, { vel: 0.26, voices: [1, 2, 3], shift: 12, art: 'trem' }), ostinato(p.chords, p.ostTense, { step: 0.5, vel: 0.32, shift: 12 })),
        part('snare', tile(hits('r.r.', { step: 1, vel: 0.26 }), BAR, n / BAR)),
        part('timpani', tile(onRoots(p.chords, 'o.o.', { step: 0.5, vel: 0.42, range: TIMP }), BAR, n / BAR)),
        ...leads(p.tense),
      ],
      prep: [
        part('pad', held(p.chords, { vel: 0.5, voices: [0, 1, 2] })),
        part('strings', swell(held(p.chords, { vel: 0.28, voices: [1, 2], art: 'trem' }), 0.5, 1.1)),
        part('timpani', onRoots(p.chords, 'o.......|........|o.......|........|o.......|....o...|o...o...|o.o.o.o.', { step: 0.5, vel: 0.38, range: TIMP })),
        ...leads(p.prep),
      ],
    },
  };
}

function section(p: Plan): BattleSection {
  if (p.role === 'quiet') return quietSection(p);
  return { name: p.name, bars: beats(p) / BAR, role: p.role, layers: { build: buildLayer(p), combat: combatLayer(p), tense: tenseLayer(p), prep: prepLayer(p) } };
}

const H = 'harmonic' as const;
const P = 'phrygian' as const;

const PLANS: Plan[] = [
  {
    name: 'Dawn on the perimeter',
    role: 'intro',
    chords: prog(BAR, [[1, Cm], [1, Cm], [1, AbC], [1, AbC], [1, Fm], [1, Fm], [1, Gsus], [1, G]]),
    ostBuild: [1, 2, 3, 2, 1, 2, 3, 4, 1, 2, 3, 2, 4, 3, 2, 1],
    ostCombat: [0, 1, 2, 1, 3, 1, 2, 1, 0, 2, 3, 2, 4, 3, 2, 1],
    ostTense: [0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 2, 1, 0],
    snare: 'X..x..x.x.xxX...|X..x..x.x.r.F.x.',
    timp: 'o.....o.|o...o...',
    stabs: 'x.......|....x...',
    build: [{ inst: 'horn', form: { tonic: 60, at: 16, take: 5, vel: 0.38 } }],
    combat: [
      { inst: 'brass', form: { tonic: 48, at: 0, vel: 0.8 } },
      { inst: 'brass', form: { tonic: 48, at: 16, augment: 0.5, colour: H, vel: 0.8 } },
      { inst: 'brass', form: { tonic: 48, at: 20, augment: 0.5, step: 2, colour: H, vel: 0.8 } },
    ],
    tense: [
      { inst: 'horn', form: { tonic: 60, at: 0, colour: H, vel: 0.45 } },
      { inst: 'strings', form: { tonic: 72, at: 2, colour: H, vel: 0.3 } },
      { inst: 'horn', form: { tonic: 60, at: 16, take: 5, step: 1, vel: 0.45 } },
      { inst: 'strings', form: { tonic: 72, at: 18, take: 5, step: 1, vel: 0.3 } },
    ],
    prep: [0, 1, 2, 3].map((k) => ({ inst: 'horn' as const, form: { tonic: 60, at: 8 * k, take: 3, step: k, vel: 0.32 } })),
  },
  {
    name: 'Rearguard',
    role: 'main',
    chords: prog(BAR, [[1, Cm], [1, Bb], [1, Ab], [1, G], [1, Cm], [1, Bb], [1, Db], [1, G]]),
    ostBuild: [1, 2, 1, 3, 1, 2, 1, 4, 1, 2, 1, 3, 4, 3, 2, 1],
    ostCombat: [0, 2, 1, 2, 0, 3, 1, 3, 0, 2, 1, 2, 4, 3, 2, 1],
    ostTense: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 2, 0, 1, 0, 2],
    snare: 'X.xxX.x.X.xxX.x.|X.xxX.x.F.x.xxxx',
    timp: 'o.o.o...|o.o.o.oo',
    stabs: 'x...x...|x.x.....',
    build: [{ inst: 'strings', form: { tonic: 60, at: 0, vel: 0.28 } }],
    combat: [
      { inst: 'brass', form: { tonic: 36, at: 0, augment: 0.5, vel: 0.85 } },
      { inst: 'brass', form: { tonic: 36, at: 4, augment: 0.5, step: 1, vel: 0.85 } },
      { inst: 'brass', form: { tonic: 48, at: 16, displace: 0.5, vel: 0.78 } },
    ],
    tense: [
      { inst: 'horn', form: { tonic: 60, at: 0, invert: true, colour: H, vel: 0.45 } },
      { inst: 'strings', form: { tonic: 72, at: 4, invert: true, colour: H, vel: 0.3 } },
      { inst: 'horn', form: { tonic: 60, at: 16, take: 5, colour: P, vel: 0.45 } },
    ],
    prep: [{ inst: 'horn', form: { tonic: 60, at: 8, take: 5, augment: 2, vel: 0.32 } }],
  },
  {
    name: 'The canal line',
    role: 'main',
    chords: prog(BAR, [[1, Fm], [1, Cm], [1, Fm], [1, Cm], [1, Ab], [1, Eb], [1, Db], [1, G]]),
    ostBuild: [1, 3, 2, 3, 1, 3, 2, 4, 1, 3, 2, 3, 1, 2, 3, 4],
    ostCombat: [0, 1, 0, 2, 0, 3, 0, 2, 0, 1, 0, 2, 3, 2, 1, 0],
    ostTense: [0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 2, 1, 0, 0],
    snare: 'x.x.X.x.x.x.X.xx|x.x.X.x.x.xxX.F.',
    timp: 'o..o..o.|o..o.ooo',
    stabs: '...x....|...x..x.',
    build: [{ inst: 'horn', form: { tonic: 60, at: 0, take: 5, colour: P, vel: 0.38 } }],
    combat: [
      { inst: 'brass', form: { tonic: 41, at: 0, vel: 0.8 } },
      { inst: 'brass', form: { tonic: 48, at: 16, retrograde: true, colour: H, vel: 0.8 } },
    ],
    tense: [
      { inst: 'strings', form: { tonic: 72, at: 0, retrograde: true, colour: P, vel: 0.3 } },
      { inst: 'horn', form: { tonic: 60, at: 2, retrograde: true, colour: P, vel: 0.42 } },
      { inst: 'horn', form: { tonic: 60, at: 24, augment: 0.5, vel: 0.42 } },
      { inst: 'horn', form: { tonic: 60, at: 28, augment: 0.5, step: 1, colour: H, vel: 0.42 } },
    ],
    prep: [
      { inst: 'horn', form: { tonic: 65, at: 0, take: 3, vel: 0.32 } },
      { inst: 'horn', form: { tonic: 65, at: 16, take: 3, step: 1, vel: 0.32 } },
    ],
  },
  {
    name: 'Dive bombers over the dunes',
    role: 'main',
    chords: prog(BAR, [[1, Cm], [1, Db], [1, Cm], [1, Db], [1, Ab], [1, Bb], [1, Bdim7], [1, G]]),
    ostBuild: [1, 2, 3, 4, 3, 2, 1, 2, 1, 2, 3, 4, 5, 4, 3, 2],
    ostCombat: [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 4, 3, 2, 1],
    ostTense: [0, 0, 1, 1, 0, 0, 2, 2, 0, 0, 1, 1, 0, 2, 1, 0],
    snare: 'F.xxF.xxX.xxX.xx|F.xxF.xxX.xxR---',
    timp: 'o.oo.oo.|o.oo.ooo',
    stabs: 'x.x.....|x.x...x.',
    build: [
      { inst: 'horn', form: { tonic: 60, at: 4, take: 3, colour: P, vel: 0.38 } },
      { inst: 'horn', form: { tonic: 60, at: 20, take: 3, step: 1, colour: P, vel: 0.38 } },
    ],
    combat: [
      { inst: 'brass', form: { tonic: 36, at: 0, colour: P, vel: 0.85 } },
      { inst: 'brass', form: { tonic: 36, at: 16, augment: 0.5, colour: P, vel: 0.85 } },
      { inst: 'brass', form: { tonic: 36, at: 20, augment: 0.5, step: 1, colour: H, vel: 0.85 } },
    ],
    tense: [
      { inst: 'horn', form: { tonic: 60, at: 0, augment: 2, invert: true, colour: P, vel: 0.45 } },
      { inst: 'strings', form: { tonic: 72, at: 8, augment: 2, invert: true, colour: P, vel: 0.28 } },
    ],
    prep: [
      { inst: 'horn', form: { tonic: 60, at: 4, take: 3, colour: P, vel: 0.3 } },
      { inst: 'horn', form: { tonic: 60, at: 20, take: 5, colour: H, vel: 0.32 } },
    ],
  },
  {
    name: 'Smoke over the beaches',
    role: 'quiet',
    chords: prog(BAR, [[1, Cm9], [1, Abmaj7], [1, Cm9], [1, Abmaj7], [1, Fm], [1, Fm], [1, Gsus], [1, G]]),
    ostBuild: [1, 2, 3, 2, -1, -1, 3, 2, 1, 2, 3, 2, -1, -1, -1, -1],
    ostCombat: [0, 2, 1, 2],
    ostTense: [0, -1, 1, -1],
    snare: '',
    timp: '',
    stabs: '',
    build: [{ inst: 'horn', form: { tonic: 60, at: 4, augment: 2, take: 5, vel: 0.36 } }],
    combat: [{ inst: 'brass', form: { tonic: 48, at: 8, augment: 2, take: 5, vel: 0.6 } }],
    tense: [{ inst: 'horn', form: { tonic: 60, at: 8, invert: true, augment: 2, take: 4, vel: 0.36 } }],
    prep: [{ inst: 'strings', form: { tonic: 60, at: 16, augment: 2, take: 3, vel: 0.26 } }],
  },
  {
    name: 'Every boat that floats',
    role: 'main',
    chords: prog(BAR, [[1, Eb], [1, Bb], [1, Cm], [1, Ab], [1, Fm], [1, Cm], [1, Gsus], [1, G]]),
    ostBuild: [1, 2, 3, 4, 1, 2, 3, 4, 1, 3, 2, 4, 3, 2, 1, 2],
    ostCombat: [0, 2, 1, 3, 0, 2, 1, 3, 0, 2, 1, 3, 2, 3, 4, 5],
    ostTense: [0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 1, 2, 3, 2],
    snare: 'X...x.x.X...x.xx|X...x.x.X.x.x.xx',
    timp: 'o...o...|o...o.o.',
    stabs: 'x.......|x...x...',
    build: [
      { inst: 'horn', form: { tonic: 63, at: 0, colour: 'major', vel: 0.4 } },
      { inst: 'horn', form: { tonic: 60, at: 16, take: 5, vel: 0.38 } },
    ],
    combat: [
      { inst: 'brass', form: { tonic: 39, at: 0, colour: 'major', vel: 0.8 } },
      { inst: 'brass', form: { tonic: 48, at: 16, colour: H, vel: 0.8 } },
    ],
    tense: [
      { inst: 'horn', form: { tonic: 63, at: 0, colour: 'major', vel: 0.45 } },
      { inst: 'strings', form: { tonic: 75, at: 2, colour: 'major', vel: 0.28 } },
      { inst: 'horn', form: { tonic: 60, at: 16, colour: H, vel: 0.45 } },
    ],
    prep: [
      { inst: 'horn', form: { tonic: 63, at: 0, take: 5, colour: 'major', vel: 0.32 } },
      { inst: 'horn', form: { tonic: 60, at: 16, take: 5, vel: 0.32 } },
    ],
  },
  {
    name: 'The last ditch',
    role: 'main',
    chords: prog(BAR, [[1, Cm], [1, Ab], [1, Fm], [1, Db], [1, CmG], [1, G], [1, Ab], [1, G]]),
    ostBuild: [1, 2, 3, 2, 1, 2, 3, 2, 1, 2, 3, 4, 3, 4, 5, 4],
    ostCombat: [0, 1, 2, 3, 0, 1, 2, 3, 4, 3, 2, 1, 4, 3, 2, 1],
    ostTense: [0, 0, 1, 0, 2, 0, 1, 0, 0, 0, 1, 0, 2, 0, 3, 0],
    snare: 'XxxxX.xxXxxxX.xx|XxxxX.xxF.F.F.F.',
    timp: 'oooo.o.o|oooo.ooo',
    stabs: 'x..x..x.|x..x..xx',
    build: [
      { inst: 'strings', form: { tonic: 60, at: 0, colour: H, vel: 0.28 } },
      { inst: 'strings', form: { tonic: 60, at: 16, take: 5, step: 2, vel: 0.28 } },
    ],
    combat: [
      { inst: 'brass', form: { tonic: 36, at: 0, vel: 0.85 } },
      ...[0, 1, 2, 3].map((k) => ({ inst: 'brass' as const, form: { tonic: 36, at: 16 + 4 * k, augment: 0.5, step: k, colour: H, vel: 0.82 } })),
    ],
    tense: [
      { inst: 'horn', form: { tonic: 60, at: 0, vel: 0.45 } },
      { inst: 'strings', form: { tonic: 72, at: 1, vel: 0.28 } },
      { inst: 'horn', form: { tonic: 60, at: 16, augment: 0.5, colour: H, vel: 0.45 } },
      { inst: 'strings', form: { tonic: 72, at: 18, augment: 0.5, colour: H, vel: 0.28 } },
      { inst: 'horn', form: { tonic: 60, at: 24, take: 5, step: 2, vel: 0.45 } },
    ],
    prep: [0, 1, 2, 3].map((k) => ({ inst: 'horn' as const, form: { tonic: 60, at: 8 * k, take: 3, invert: true, step: k, colour: H, vel: 0.32 } })),
  },
];

/** Victory, the boats away: the answer slowed and lifted into C major over a timpani roll, home on a wide C major. */
const VICTORY: BattleSting = {
  beats: 16,
  parts: [
    part('brass', motif(BRITISH_ANSWER, { tonic: 48, colour: 'major', augment: 1.5, vel: 0.8 }), line([[12, 4, 36, 0.8], [12, 4, 43, 0.7]])),
    part('horn', motif(BRITISH_ANSWER, { tonic: 60, colour: 'major', augment: 1.5, vel: 0.5 })),
    part('pad', line([[0, 16, 36, 0.6], [0, 16, 48, 0.5], [6, 10, 52, 0.5], [6, 10, 55, 0.5]])),
    part('strings', line([[12, 4, 64, 0.5], [12, 4, 67, 0.45], [12, 4, 72, 0.45]], 'trem')),
    part('timpani', swell(hits('R-------------------------------', { step: 0.375, vel: 0.55, note: 36 }), 0.4, 1), hits('o', { at: 12, vel: 0.9, note: 36 })),
    part('snare', swell(hits('R-----------------------', { step: 0.5, vel: 0.45 }), 0.4, 1), hits('F', { at: 12, vel: 0.8 })),
  ],
};

/** Defeat, the trench lost: the head of the motif sinking in the Phrygian colour over a bass that falls to G and stops. */
const DEFEAT: BattleSting = {
  beats: 16,
  parts: [
    part('brass', motif(BRITISH_MOTIF, { tonic: 36, take: 4, augment: 2, colour: P, vel: 0.7 }), line([[8, 2, 44, 0.55], [10, 6, 43, 0.5]])),
    part('strings', line([[0, 16, 63, 0.3], [0, 16, 67, 0.26], [8, 8, 61, 0.26]], 'trem')),
    part('pad', line([[0, 8, 36, 0.55], [0, 16, 43, 0.45], [8, 8, 37, 0.45]])),
    part('timpani', hits('o...o...o.......o', { step: 0.75, vel: 0.7, note: 36 })),
  ],
};

export const DUNKIRK: BattleTrackDef = {
  title: 'The Last Perimeter',
  theme: 'british',
  bpm: 152,
  beatsPerBar: BAR,
  tonic: 0,
  layerLevel: { build: 1.5, combat: 1, tense: 1.15, prep: 1.4 },
  gain: 0.8,
  humanize: { time: 0.005, velocity: 0.08 },
  seed: 400526,
  instruments: { ...BATTLE_KIT, snare: { ...BATTLE_KIT.snare, toneHz: 225, toneEndHz: 182, decay: 0.15 } },
  mix: BATTLE_MIX,
  reverb: { ...BATTLE_REVERB, seconds: 1.5, seed: 400526 },
  sections: PLANS.map(section),
  stings: { victory: VICTORY, defeat: DEFEAT },
};
