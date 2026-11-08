/**
 * Mission 7, Sword Beach, 6 June 1944: "Sword at Dawn". The biggest of the British tracks: the low brass in full
 * chords and octaves, a snare that drives sixteenths without a break, timpani like the ships' guns, and the strings
 * racing underneath. The British motif "The Line" (src/data/musicThemes.ts) is played whole and loud, doubled in
 * octaves by the brass and the horn, cut into hammered fragments, pushed off the beat, and once, at the link-up,
 * answered in D major. D minor, 144 BPM, 4/4, eight sections of eight bars (13.3 s per layer, 320 s of distinct music
 * in three layers), plus two stings. Written for Tin Hats; it quotes no existing melody, march, call or score.
 */
import type { BattleSection, BattleSting, BattleTrackDef, MusicPart } from '../musicBattle';
import { bass, held, hits, line, onRoots, ostinato, part, prog, swell, tile, type ChordSpan } from '../musicKit';
import { BRITISH_ANSWER, BRITISH_MOTIF, motif, type MotifForm } from '../musicThemes';
import { BATTLE_KIT, BATTLE_MIX, BATTLE_REVERB } from './kit';

const BAR = 4;
const TIMP: readonly [number, number] = [38, 52];

// Chords, low to high (MIDI). D minor, the B flat and G minor of the advance, the E flat (flattened second) of the
// wire, the A major dominant, and the D major of the link-up.
const Dm = [38, 50, 53, 57];
const Dm9 = [38, 52, 53, 57];
const Bb = [46, 50, 53, 58];
const Bbmaj7 = [46, 50, 53, 57];
const C = [36, 48, 52, 55];
const A = [45, 49, 52, 57];
const Asus = [45, 50, 52, 57];
const Gm = [43, 50, 55, 58];
const F = [41, 48, 53, 57];
const Eb = [39, 51, 55, 58];
const D = [38, 50, 54, 57];
const AonCs = [37, 49, 52, 57];

/** Where the motif comes in, per layer: the instrument, the form, and an octave doubling below on the brass. */
interface Lead {
  inst: 'horn' | 'strings' | 'brass';
  form: MotifForm;
  answer?: boolean;
  /** Also play it an octave lower on the brass (the big unison). */
  octave?: boolean;
}

interface Plan {
  name: string;
  role: BattleSection['role'];
  chords: ChordSpan[];
  /** String ostinato: chord tones in eighths (build) and sixteenths (combat). */
  ostBuild: readonly number[];
  ostCombat: readonly number[];
  /** Two bars of sixteenths for the combat snare, played four times; the last bar gets a roll fill. */
  snare: string;
  /** Two bars of sixteenths for the build layer's snare (the boats coming in: soft, but already moving). */
  snareBuild: string;
  /** Two bars of eighths: combat timpani on the roots, and the brass chord stabs. */
  timp: string;
  stabs: string;
  build: readonly Lead[];
  combat: readonly Lead[];
  tense: readonly Lead[];
}

function leads(list: readonly Lead[]): MusicPart[] {
  const out: MusicPart[] = [];
  for (const l of list) {
    const m = l.answer ? BRITISH_ANSWER : BRITISH_MOTIF;
    out.push(part(l.inst, motif(m, { art: l.inst === 'strings' ? 'long' : undefined, ...l.form })));
    if (l.octave) out.push(part('brass', motif(m, { ...l.form, tonic: l.form.tonic - 12, vel: (l.form.vel ?? 0.7) * 0.85 })));
  }
  return out;
}

const beats = (p: Plan): number => p.chords.reduce((n, c) => n + c.beats, 0);

/** A pattern written for two bars, repeated `reps` times. */
function tilePattern(pattern: string, reps: number): string {
  return Array.from({ length: Math.round(reps) }, () => pattern).join('');
}

/** The calm layer: eighth-note strings, the pad, a soft snare already on the move, the motif on a far horn. */
function buildLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  return [
    part('strings', ostinato(p.chords, p.ostBuild, { step: 0.5, vel: 0.34, accents: [0, 3], accent: 1.3 }), bass(p.chords, 'x...x.x.', { step: 0.5, vel: 0.3 })),
    part('pad', held(p.chords, { vel: 0.58, voices: [0, 1, 2] })),
    part('snare', swell(tile(hits(p.snareBuild, { vel: 0.3 }), 2 * BAR, n / (2 * BAR)), 0.75, 1.2)),
    part('timpani', onRoots(p.chords, 'o.......|....o...', { step: 0.5, vel: 0.36, range: TIMP })),
    ...leads(p.build),
  ];
}

/** Heavy fighting: brass chords stabbing on the off-beats, the snare driving sixteenths, big timpani, racing strings. */
function combatLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  const reps = n / (2 * BAR);
  const snare = tile(hits(p.snare, { vel: 0.72 }), 2 * BAR, reps).filter((e) => e.at < n - BAR);
  const fill = swell(hits('X.xxX.xxR-------', { at: n - BAR, vel: 0.74 }), 0.7, 1.15);
  const stabs = onRoots(p.chords, tilePattern(p.stabs, reps), { step: 0.5, vel: 0.6, range: [38, 50] });
  // Each stab is the whole chord in the brass (root, third and fifth from the chord's own voicing).
  const chordStabs = stabs.flatMap((e) => {
    const c = p.chords.find((s) => e.at >= s.at - 1e-9 && e.at < s.at + s.beats - 1e-9) ?? p.chords[0];
    return [e.note, c.notes[1], c.notes[2]].map((note, i) => ({ ...e, note, len: 0.4, vel: e.vel * (i === 0 ? 1 : 0.7), art: 'stab' as const }));
  });
  return [
    part('strings', ostinato(p.chords, p.ostCombat, { step: 0.25, vel: 0.54, shift: 12, accents: [0, 3, 6, 8, 11, 14], accent: 1.3 }), bass(p.chords, 'X.xxX.xx', { step: 0.5, vel: 0.5 })),
    part('pad', held(p.chords, { vel: 0.45, voices: [1, 2, 3] })),
    part('snare', snare, fill),
    part('timpani', onRoots(p.chords, tilePattern(p.timp, reps), { step: 0.5, vel: 0.66, range: TIMP })),
    part('brass', chordStabs),
    ...leads(p.combat),
  ];
}

/** HQ in danger: high tremolo, the snare down to a nervous rim, a pounding timpani, the motif's head hammered. */
function tenseLayer(p: Plan): MusicPart[] {
  const n = beats(p);
  return [
    part('strings', held(p.chords, { vel: 0.3, voices: [1, 2, 3], shift: 12, art: 'trem' }), bass(p.chords, 'x.x.x.x.', { step: 0.5, vel: 0.42 })),
    part('snare', tile(hits('r.grr.grr.grr.gr', { vel: 0.3 }), BAR, n / BAR), tile(hits('................|............R---', { vel: 0.4 }), 2 * BAR, n / (2 * BAR))),
    part('timpani', onRoots(p.chords, tilePattern('o.o.....o.o.....', n / BAR), { step: 0.25, vel: 0.52, range: TIMP })),
    part('brass', held(p.chords, { vel: 0.32, voices: [0] })),
    ...leads(p.tense),
  ];
}

/** The quiet stretch behind the dunes: long notes, a far snare; combat and tense stay muffled. */
function quietSection(p: Plan): BattleSection {
  const n = beats(p);
  return {
    name: p.name,
    bars: n / BAR,
    role: 'quiet',
    layers: {
      build: [part('pad', held(p.chords, { vel: 0.55 })), part('strings', held(p.chords, { vel: 0.22, voices: [0], art: 'long' })), part('snare', tile(hits('g.......g.......', { vel: 0.22 }), BAR, n / BAR)), ...leads(p.build)],
      combat: [
        part('pad', held(p.chords, { vel: 0.5 })),
        part('strings', ostinato(p.chords, p.ostBuild, { step: 0.5, vel: 0.3 })),
        part('brass', held(p.chords, { vel: 0.42, voices: [0, 1, 2] })),
        part('timpani', swell(onRoots(p.chords, 'R-------', { at: n - 2 * BAR, step: 1, vel: 0.6, range: TIMP }), 0.6, 1)),
        part('snare', swell(hits('R-------', { at: n - 2 * BAR, step: 1, vel: 0.48 }), 0.5, 1)),
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

const PLANS: Plan[] = [
  {
    name: 'Landing craft away',
    role: 'intro',
    chords: prog(BAR, [[1, Dm], [1, Dm], [1, Bb], [1, Bb], [1, Gm], [1, Gm], [1, Asus], [1, A]]),
    ostBuild: [0, 2, 3, 2, 1, 2, 3, 2],
    ostCombat: [0, 1, 2, 1, 3, 1, 2, 1, 0, 2, 3, 2, 1, 2, 3, 2],
    snare: 'X.xxX.x.X.xxX.x.|X.xxX.x.X.xxF.x.',
    snareBuild: 'g.g.g.g.g.g.g.g.|g.g.g.g.g.ggR---',
    timp: 'o.....o.|o...o...',
    stabs: '..x.....|..x...x.',
    build: [{ inst: 'horn', form: { tonic: 62, at: 16, take: 5, vel: 0.4 } }],
    combat: [
      { inst: 'horn', form: { tonic: 62, at: 0, vel: 0.6 }, octave: true },
      { inst: 'horn', form: { tonic: 62, at: 16, vel: 0.62, colour: 'harmonic' }, octave: true },
    ],
    tense: [{ inst: 'horn', form: { tonic: 62, at: 8, invert: true, colour: 'phrygian', vel: 0.45 } }],
  },
  {
    name: 'Onto the sand',
    role: 'main',
    chords: prog(BAR, [[1, Dm], [1, C], [1, Bb], [1, A], [1, Dm], [1, C], [1, Bb], [1, A]]),
    ostBuild: [0, 1, 2, 3, 2, 1, 2, 1],
    ostCombat: [0, 2, 1, 2, 0, 3, 1, 3, 0, 2, 1, 2, 4, 3, 2, 1],
    snare: 'X.xxX.xxX.xxX.x.|X.xxX.xxX.x.X.xx',
    snareBuild: 'x...g.g.x...g.g.|x...g.g.x.g.g.g.',
    timp: 'o.o.o...|o.o.o.oo',
    stabs: '..x...x.|..x.x...',
    build: [{ inst: 'strings', form: { tonic: 50, at: 0, vel: 0.32 } }],
    combat: [
      { inst: 'brass', form: { tonic: 50, at: 0, vel: 0.8 }, octave: true },
      { inst: 'brass', form: { tonic: 50, at: 16, displace: 0.5, vel: 0.8 }, octave: true },
    ],
    tense: [{ inst: 'horn', form: { tonic: 62, at: 0, take: 3, augment: 2, vel: 0.45 } }],
  },
  {
    name: 'Through the wire',
    role: 'main',
    chords: prog(BAR, [[1, Dm], [1, Eb], [1, Dm], [1, Eb], [1, Gm], [1, F], [1, Eb], [1, A]]),
    ostBuild: [0, 2, 3, 2, 0, 2, 3, 2],
    ostCombat: [0, 1, 0, 2, 0, 3, 0, 2, 0, 1, 0, 2, 3, 2, 1, 0],
    snare: 'X..xX.x.X..xX.x.|X..xX.x.X.xxXxxx',
    snareBuild: 'r.......r.......|r.......r...r.r.',
    timp: 'o..o..o.|o..o.o.o',
    stabs: '...x....|...x..x.',
    build: [{ inst: 'horn', form: { tonic: 62, at: 0, take: 5, colour: 'phrygian', vel: 0.4 } }],
    combat: [
      { inst: 'brass', form: { tonic: 38, at: 0, take: 3, vel: 0.85 } },
      { inst: 'brass', form: { tonic: 38, at: 4, take: 3, step: 1, vel: 0.85 } },
      { inst: 'brass', form: { tonic: 38, at: 8, take: 3, step: 2, vel: 0.88 } },
      { inst: 'horn', form: { tonic: 62, at: 16, invert: true, colour: 'phrygian', vel: 0.58 }, octave: true },
    ],
    tense: [{ inst: 'horn', form: { tonic: 62, at: 16, retrograde: true, colour: 'phrygian', vel: 0.45 } }],
  },
  {
    name: 'The road to Hermanville',
    role: 'main',
    chords: prog(BAR, [[1, Dm], [1, Bb], [1, F], [1, C], [1, Dm], [1, Bb], [1, Gm], [1, A]]),
    ostBuild: [0, 3, 2, 3, 1, 3, 2, 3],
    ostCombat: [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 4, 3, 2, 1],
    snare: 'F.xxX.xxX.xxX.xx|F.xxX.xxX.x.F.xx',
    snareBuild: 'x.g.x.g.x.g.x.g.|x.g.x.g.x.g.x.gg',
    timp: 'o...o.o.|o...o.oo',
    stabs: '..x...x.|..x...xx',
    build: [
      { inst: 'horn', form: { tonic: 50, at: 0, vel: 0.45 } },
      { inst: 'horn', form: { tonic: 50, at: 16, vel: 0.42, colour: 'harmonic' }, answer: true },
    ],
    combat: [
      { inst: 'horn', form: { tonic: 62, at: 0, vel: 0.62 }, octave: true },
      { inst: 'horn', form: { tonic: 62, at: 16, vel: 0.62, colour: 'harmonic' }, answer: true, octave: true },
    ],
    tense: [{ inst: 'horn', form: { tonic: 62, at: 0, invert: true, colour: 'harmonic', vel: 0.45 } }],
  },
  {
    name: 'Behind the dunes',
    role: 'quiet',
    chords: prog(BAR, [[1, Dm9], [1, Bbmaj7], [1, Dm9], [1, Bbmaj7], [1, Gm], [1, Gm], [1, Asus], [1, A]]),
    ostBuild: [0, 2, 3, 2, 1, 2, 3, 2],
    ostCombat: [0, 2, 1, 2],
    snare: '',
    snareBuild: '',
    timp: '',
    stabs: '',
    build: [{ inst: 'horn', form: { tonic: 62, at: 4, augment: 2, take: 5, vel: 0.38 } }],
    combat: [{ inst: 'brass', form: { tonic: 50, at: 8, augment: 2, take: 5, vel: 0.62 } }],
    tense: [{ inst: 'horn', form: { tonic: 62, at: 8, invert: true, augment: 2, take: 4, vel: 0.36 } }],
  },
  {
    name: 'The ships open fire',
    role: 'main',
    chords: prog(BAR, [[1, Gm], [1, Dm], [1, Gm], [1, Dm], [1, Bb], [1, F], [1, Gm], [1, A]]),
    ostBuild: [0, 2, 1, 3, 0, 2, 1, 3],
    ostCombat: [0, 2, 0, 3, 0, 2, 0, 1, 0, 2, 0, 3, 1, 2, 3, 4],
    snare: 'X.xxX.x.X.xxX.x.|X.xxX.x.X.x.F...',
    snareBuild: '....g.......g...|....g.......g.g.',
    timp: 'o.oo....|o.oo..oo',
    stabs: 'x.....x.|x...x.x.',
    build: [{ inst: 'strings', form: { tonic: 50, at: 16, take: 5, vel: 0.32 } }],
    combat: [
      { inst: 'brass', form: { tonic: 50, at: 0, augment: 2, vel: 0.85 }, octave: true },
      { inst: 'horn', form: { tonic: 62, at: 20, take: 5, vel: 0.55 } },
    ],
    tense: [{ inst: 'horn', form: { tonic: 62, at: 8, take: 5, invert: true, step: 3, vel: 0.45 } }],
  },
  {
    name: 'Off the beach',
    role: 'main',
    chords: prog(BAR, [[1, F], [1, C], [1, Dm], [1, Bb], [1, F], [1, C], [1, Gm], [1, AonCs]]),
    ostBuild: [0, 1, 2, 1, 3, 1, 2, 1],
    ostCombat: [0, 2, 1, 3, 0, 2, 1, 3, 0, 2, 1, 3, 2, 3, 4, 5],
    snare: 'X.x.X.xxX.x.X.xx|X.x.X.xxF.F.x.xx',
    snareBuild: 'x.......x...g.g.|x.......x.g.g.g.',
    timp: 'o...o...|o.o.o.oo',
    stabs: '..x...x.|..x.xxx.',
    build: [
      { inst: 'horn', form: { tonic: 62, at: 0, step: 2, take: 5, vel: 0.42 } },
      { inst: 'strings', form: { tonic: 62, at: 16, take: 5, vel: 0.28 } },
    ],
    combat: [
      { inst: 'brass', form: { tonic: 50, at: 0, step: 2, vel: 0.82 }, octave: true },
      { inst: 'horn', form: { tonic: 62, at: 16, vel: 0.6 }, octave: true },
    ],
    tense: [{ inst: 'horn', form: { tonic: 62, at: 16, take: 5, vel: 0.45 } }],
  },
  {
    name: 'Linking up',
    role: 'main',
    chords: prog(BAR, [[1, Bb], [1, C], [1, Dm], [1, Dm], [1, Bb], [1, C], [1, D], [1, A]]),
    ostBuild: [0, 1, 2, 1, 3, 1, 2, 1],
    ostCombat: [0, 1, 2, 3, 0, 1, 2, 3, 0, 2, 1, 3, 2, 3, 4, 5],
    snare: 'X.xxX.x.X.xxX.x.|X.xxX.x.X.xxXxxx',
    snareBuild: 'x...x...x...x...|x...x...x.x.x.x.',
    timp: 'o...o...|o...o.oo',
    stabs: '..x...x.|..x...x.',
    build: [
      { inst: 'horn', form: { tonic: 62, at: 0, vel: 0.42 } },
      { inst: 'horn', form: { tonic: 62, at: 16, vel: 0.42, colour: 'major' }, answer: true },
    ],
    combat: [
      { inst: 'horn', form: { tonic: 62, at: 0, vel: 0.62 }, octave: true },
      { inst: 'horn', form: { tonic: 62, at: 16, vel: 0.65, colour: 'major' }, answer: true, octave: true },
    ],
    tense: [{ inst: 'horn', form: { tonic: 62, at: 8, take: 5, retrograde: true, vel: 0.45 } }],
  },
];

/** Victory: the answer in D major in brass octaves over a snare roll, home on a held D major chord. */
const VICTORY: BattleSting = {
  beats: 12,
  parts: [
    part('brass', motif(BRITISH_ANSWER, { tonic: 50, colour: 'major', vel: 0.85 }), motif(BRITISH_ANSWER, { tonic: 38, colour: 'major', vel: 0.7 }), line([[8, 4, 45, 0.6]])),
    part('horn', motif(BRITISH_ANSWER, { tonic: 62, colour: 'major', vel: 0.55 })),
    part('pad', line([[0, 12, 38, 0.6], [0, 12, 50, 0.5], [4, 8, 54, 0.5], [4, 8, 57, 0.5]])),
    part('strings', line([[8, 4, 62, 0.5], [8, 4, 66, 0.45], [8, 4, 69, 0.45]], 'trem')),
    part('timpani', swell(hits('R-------', { step: 1, vel: 0.6, note: 38 }), 0.5, 1), hits('o', { at: 8, vel: 0.92, note: 38 })),
    part('snare', swell(hits('R-------', { step: 1, vel: 0.52 }), 0.4, 1), hits('F', { at: 8, vel: 0.85 })),
  ],
};

/** Defeat: the head of the motif sinking in the Phrygian colour on the low brass, a last stroke under the tremolo. */
const DEFEAT: BattleSting = {
  beats: 12,
  parts: [
    part('brass', motif(BRITISH_MOTIF, { tonic: 38, take: 3, augment: 2, colour: 'phrygian', vel: 0.72 }), line([[8, 4, 39, 0.55], [8, 4, 38, 0.5]])),
    part('strings', line([[0, 12, 62, 0.32], [0, 12, 63, 0.28], [0, 12, 69, 0.26]], 'trem')),
    part('pad', line([[0, 12, 38, 0.55], [0, 12, 45, 0.45]])),
    part('snare', swell(hits('x...x...x.......', { step: 0.5, vel: 0.5 }), 1, 0.5)),
    part('timpani', hits('o...o...o', { step: 1, vel: 0.72, note: 38 })),
  ],
};

export const SWORD: BattleTrackDef = {
  title: 'Sword at Dawn',
  theme: 'british',
  bpm: 144,
  beatsPerBar: BAR,
  tonic: 2,
  layerLevel: { build: 1.5, combat: 1, tense: 1.27, prep: 1.5 },
  gain: 0.78,
  humanize: { time: 0.005, velocity: 0.07 },
  seed: 1944_06,
  instruments: {
    ...BATTLE_KIT,
    brass: { ...BATTLE_KIT.brass, voices: 3, envCutoff: 2200, level: 0.3 },
    snare: { ...BATTLE_KIT.snare, highpassHz: 1500, lowpassHz: 7200, decay: 0.15, toneHz: 225, level: 0.4 },
  },
  mix: { ...BATTLE_MIX, brass: { dry: 0.85, send: 0.4 } },
  reverb: { ...BATTLE_REVERB, seconds: 1.9, seed: 1944 },
  sections: PLANS.map(section),
  stings: { victory: VICTORY, defeat: DEFEAT },
};
