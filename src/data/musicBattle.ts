/**
 * Battle music, as data for the synthesiser in src/audio/music (see docs/MUSIC.md): the battle instruments' settings,
 * the layered track format, the player's fades and sequencing, the intensity rules that pick a layer from the battle,
 * the memory and render budgets, and the mix targets against the gunfire.
 *
 * A battle track is a set of sections on one tempo and bar grid. Every section is written once per layer (build,
 * combat, tense, and prep for defensive missions); the player plays all layers of a section in sync and crossfades
 * their gains, and strings sections together in a varied order with occasional rests, so a long mission never sounds
 * like one loop. The tracks themselves live in src/data/musicTracks (one file each) and are registered there.
 */
import type { HornSettings, MixSend, PadSettings, ReverbSettings } from './music';
import type { PhoneSpeaker } from './music';

/** The layers of a battle track, in the order their buffers are rendered within a section. */
export type MusicLayer = 'build' | 'combat' | 'tense' | 'prep';
export const MUSIC_LAYERS: readonly MusicLayer[] = ['build', 'combat', 'tense', 'prep'];

/** The battle instruments. pad and horn are the menu theme's own builders; the rest are battle-only. */
export type BattleInstrument = 'strings' | 'brass' | 'horn' | 'pad' | 'timpani' | 'snare' | 'hand' | 'bell' | 'anvil';
export const BATTLE_INSTRUMENTS: readonly BattleInstrument[] = ['strings', 'brass', 'horn', 'pad', 'timpani', 'snare', 'hand', 'bell', 'anvil'];

/**
 * How a note is played. Snare: hit, ghost, flam, rim, roll (a roll lasts the note's length). Timpani: hit, roll.
 * Hand drum: dum (low, open), tek (high, dry). Strings: short (a bowed stab), long, trem (tremolo for the length).
 * Brass: long, stab. Everything else ignores it.
 */
export type Articulation = 'hit' | 'ghost' | 'flam' | 'rim' | 'roll' | 'dum' | 'tek' | 'short' | 'long' | 'trem' | 'stab';

/** One note or stroke. Times in beats from the start of its section; `note` is MIDI (0 for unpitched drums). */
export interface MusicEvent {
  at: number;
  /** Length in beats (a drum stroke: 0, except a roll). */
  len: number;
  note: number;
  /** 0..1 */
  vel: number;
  art?: Articulation;
}

/** One instrument's notes in one layer of one section. */
export interface MusicPart {
  inst: BattleInstrument;
  events: readonly MusicEvent[];
}

/** What each layer plays in a section. `prep` is left out by a track that has no prep layer (it falls back to build). */
export interface SectionLayers {
  build: readonly MusicPart[];
  combat: readonly MusicPart[];
  tense: readonly MusicPart[];
  prep?: readonly MusicPart[];
}

export interface BattleSection {
  name: string;
  bars: number;
  /**
   * 'intro' plays first when the music starts; 'main' carries the track; 'quiet' is a sparse stretch that the player
   * only chooses now and then, and only while the battle is calm (build or prep).
   */
  role: 'intro' | 'main' | 'quiet';
  layers: SectionLayers;
}

/** An end-of-battle sting: a few bars on the track's tempo, played once over the layers fading out. */
export interface BattleSting {
  beats: number;
  parts: readonly MusicPart[];
}

/** Snare: a body tone that drops in pitch, a noise burst (the wires), a rim click, flams and rolls. */
export interface SnareSettings {
  toneHz: number;
  toneEndHz: number;
  toneDecay: number;
  toneMix: number;
  /** The wires: noise between highpassHz and lowpassHz, falling 60 dB in `decay` seconds. */
  highpassHz: number;
  lowpassHz: number;
  decay: number;
  noiseMix: number;
  /** Rim click: band-passed noise and a short tone at rimHz. */
  rimHz: number;
  rimDecay: number;
  rimMix: number;
  /** A ghost stroke's share of the velocity. */
  ghost: number;
  /** Flam: the grace stroke this many seconds before, at this share of the velocity. */
  flamGap: number;
  flamVel: number;
  /** Roll: strokes a second, the level it starts at (share of the velocity, rising to full), each stroke's decay (s). */
  rollRate: number;
  rollStart: number;
  rollDecay: number;
  level: number;
}

/** Timpani: tuned membrane modes over a low thump, with a slight downward glide; rolls as repeated soft strokes. */
export interface TimpaniSettings {
  /** [frequency ratio, level, decay share of `decay`] for each mode. */
  modes: readonly (readonly [number, number, number])[];
  decay: number;
  /** The pitch starts this many cents sharp and settles in glideTime seconds. */
  glideCents: number;
  glideTime: number;
  noise: number;
  noiseCutoff: number;
  noiseDecay: number;
  rollRate: number;
  level: number;
  range: readonly [number, number];
}

/** Low brass: detuned sawtooths with a filter that blares open on the attack and settles; stabs are short and hard. */
export interface BrassSettings {
  voices: number;
  detuneCents: number;
  /** Low-pass at rest, plus envCutoff Hz at velocity 1 on the attack, settling over envDecay seconds to sustainShare of it. */
  cutoff: number;
  envCutoff: number;
  envDecay: number;
  sustainShare: number;
  q: number;
  attack: number;
  release: number;
  /** The note scoops up from this many cents flat over scoopTime seconds. */
  scoopCents: number;
  scoopTime: number;
  /** Seconds a stab lasts. */
  stab: number;
  level: number;
  range: readonly [number, number];
}

/** Bowed strings: short ostinato notes, long notes and tremolo; detuned sawtooths, a resonant low-pass, bow noise. */
export interface StringSettings {
  voices: number;
  detuneCents: number;
  cutoff: number;
  /** Extra cutoff (Hz) at velocity 1. */
  brightness: number;
  q: number;
  attack: number;
  /** Seconds a short note lasts at most, and the release after any note. */
  short: number;
  release: number;
  /** Tremolo: strokes a second and how deep each dips (0..1). */
  tremRate: number;
  tremDepth: number;
  bowNoise: number;
  level: number;
  range: readonly [number, number];
}

/** A hand drum: a deep open "dum" and a dry high "tek". */
export interface HandSettings {
  dumHz: number;
  dumEndHz: number;
  dumDecay: number;
  tekHz: number;
  tekDecay: number;
  /** Noise share of the slap. */
  slap: number;
  level: number;
}

/** A bell: inharmonic partials, each ringing for its own time. */
export interface BellSettings {
  /** [frequency ratio, level, seconds to fall 60 dB]. */
  partials: readonly (readonly [number, number, number])[];
  strike: number;
  level: number;
  range: readonly [number, number];
}

/** A mechanical anvil hit: hard metal partials, a short ring and a clank of noise. */
export interface AnvilSettings {
  partials: readonly (readonly [number, number])[];
  decay: number;
  noise: number;
  noiseHz: number;
  level: number;
}

export interface BattleInstruments {
  strings: StringSettings;
  brass: BrassSettings;
  horn: HornSettings;
  pad: PadSettings;
  timpani: TimpaniSettings;
  snare: SnareSettings;
  hand: HandSettings;
  bell: BellSettings;
  anvil: AnvilSettings;
}

export interface BattleTrackDef {
  title: string;
  /** The campaign theme it is built on (src/data/musicThemes.ts). */
  theme: string;
  bpm: number;
  beatsPerBar: number;
  /** Tonic pitch class (0 = C, 4 = E). */
  tonic: number;
  /** Level of each layer on the track's bus (prep may be left out with the layer). */
  layerLevel: Record<MusicLayer, number>;
  /** Fixed output gain of every rendered piece (no per-piece levelling, so layers and sections keep their balance). */
  gain: number;
  humanize: { time: number; velocity: number };
  seed: number;
  instruments: BattleInstruments;
  /** Per-instrument dry and reverb levels, the reverb return, a last low-pass over everything (Hz). */
  mix: Record<BattleInstrument, MixSend> & { reverb: number; lowpass: number };
  reverb: ReverbSettings;
  sections: readonly BattleSection[];
  stings: { victory: BattleSting; defeat: BattleSting };
}

/** The intensity rules (src/app/musicIntensity.ts): which layer the battle asks for, checked once a second. */
export interface IntensityRules {
  /** Seconds of battle time between checks. */
  checkEvery: number;
  combat: {
    /** Armed soldiers per side in the fight to start combat, and the count it must fall below to end it (hysteresis). */
    enter: number;
    exit: number;
    /** "In the fight": within this distance (wu) of the other side's front line, while the two fronts are this close. */
    band: number;
  };
  tense: {
    /** The player's HQ took damage within this many seconds... */
    damageSeconds: number;
    /** ...or an enemy is within this distance (wu) of it (and leaving needs it to be clear by exitDistance). */
    enterDistance: number;
    exitDistance: number;
    /** A survival or deadline clock with fewer than this many seconds left. */
    timerSeconds: number;
  };
  /** A raw condition must hold this long (s) before the layer changes... */
  confirm: Record<MusicLayer, number>;
  /** ...and once changed, the layer holds at least this long (s) before it may calm down again... */
  hold: Record<MusicLayer, number>;
  /** ...or this long (s) before it may rise to a more urgent layer (build or prep, then combat, then tense). */
  escalateHold: number;
}

export interface BattleMixTargets {
  /** The army of 80 firing over each layer at default sliders (K-weighted LU), [min, max]: the battle stays on top, the music still there. */
  armyOverLayer: Record<'build' | 'combat' | 'tense', readonly [number, number]>;
  /** The sting over the army is not checked; the stings over the layers stay under this peak (dBFS before the master chain). */
  maxPeakDb: number;
  phone: PhoneSpeaker;
}

export const MUSIC_BATTLE = {
  render: {
    /** Battle buffers are mono at this rate (a phone speaker gives nothing above about 8 kHz and the music sits under the guns). */
    sampleRate: 16000,
    /** If a browser refuses that rate, the next try. */
    fallbackRate: 22050,
    /** Seconds rendered past each section for its tails (they ring over the start of whatever comes next). */
    tail: 2,
    /** Milliseconds after the battle loads before the first piece is rendered (the first frames stay smooth)... */
    startDelayMs: 900,
    /** ...and between pieces, so the page keeps drawing while the music is made. */
    gapMs: 24,
  },
  budget: {
    /** Bytes of Float32 samples one mission's music may hold, every layer and sting together. */
    maxBytes: 30_000_000,
    /** Seconds of distinct music a track must have (every layer of every section). */
    minSeconds: 180,
    /** Headless-Chromium render of a whole track (ms) and the longest main-thread graph build of one piece (ms). */
    maxRenderMs: 45_000,
    maxBuildMs: 60,
  },
  player: {
    /** Gain of the battle music on the Music bus at full Music volume. */
    level: 0.85,
    /** Seconds it fades in once ready, and out when the battle is left. */
    fadeIn: 4,
    fadeOut: 1.2,
    /** Crossfade length (s) into each layer. */
    crossfade: { build: 6, combat: 3, tense: 4, prep: 6 } as Record<MusicLayer, number>,
    /** A crossfade starts on a bar line at least this far ahead (s). */
    lead: 0.15,
    /** The next section is scheduled this long (s) before the current one ends. */
    lookahead: 1.5,
    /** Calm stretches: now and then a rest of a few bars instead of a section, never twice within minGap sections. */
    rest: { chance: 0.12, bars: [2, 4] as readonly [number, number], minGap: 4 },
    /** Calm sections: a quiet-role section is chosen with this weight, never within minGap sections of the last one. */
    quiet: { weight: 0.6, minGap: 3 },
    /** Layer colour: while calm, a section sometimes carries a second layer softly underneath. */
    blend: { chance: 0.22, layer: 'combat' as MusicLayer, level: 0.28 },
    /** The end: layers fade out over this (s) while the sting plays at this level. */
    stingFade: 1.6,
    stingLevel: 1,
  },
  intensity: {
    checkEvery: 1,
    combat: { enter: 20, exit: 14, band: 450 },
    tense: { damageSeconds: 8, enterDistance: 650, exitDistance: 900, timerSeconds: 60 },
    confirm: { build: 6, combat: 2, tense: 1, prep: 0 },
    hold: { build: 10, combat: 20, tense: 15, prep: 5 },
    escalateHold: 4,
  } as IntensityRules,
  mix: {
    armyOverLayer: { build: [12, 22], combat: [8, 18], tense: [10, 20] },
    maxPeakDb: -0.5,
    phone: { highpassHz: 350, highpassOrder: 4, lowpassHz: 10000, lowpassOrder: 2 },
  } as BattleMixTargets,
} as const;
