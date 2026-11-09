/**
 * Music, as data for the synthesiser in src/audio/music: the instruments, the mix, the player's fades and the scores.
 * Every track is rendered once at load (OfflineAudioContext) into a buffer that loops on the Music bus.
 *
 * Times in a score are in beats from the start of their section; pitches are MIDI note numbers (60 = middle C,
 * 69 = A 440 Hz). A pitch outside the track's key is marked as a deliberate accidental.
 *
 * The menu theme ("Requiem for the Fields") is an original composition written for Tin Hats: a slow lament in D minor
 * over a dark string pad, carried by a distant muted horn and, in the third section, a soft piano, with far-off drum
 * hits at irregular times. It quotes no existing melody, call, hymn or score.
 */
import { CAMPAIGN_MAP } from './musicMap';
import { STALINGRAD_MAP } from './musicMapSoviet';

export type MusicInstrument = 'pad' | 'horn' | 'piano' | 'drum';

/** Dark string pad: several detuned voices per note through a low-pass that swells open and closes again. */
export interface PadSettings {
  wave: 'sawtooth' | 'triangle';
  /** Voices per note, spread evenly across +-detuneCents. */
  voices: number;
  detuneCents: number;
  /** Low-pass cutoff (Hz) at rest and at the top of the swell, and its resonance. */
  cutoff: number;
  swellCutoff: number;
  q: number;
  /** Share of the full level the chord has at its start and end: it swells from there to full in its middle and back. */
  rest: number;
  /** Seconds to fade in and to fade out after the chord ends. */
  attack: number;
  release: number;
  /** Level of one note (all its voices together). */
  level: number;
  /** Lowest and highest MIDI note it may play. */
  range: readonly [number, number];
}

/** A distant muted horn: soft attack, a gentle vibrato that comes in late, heavily low-passed. */
export interface HornSettings {
  /** Low-pass cutoff (Hz) at velocity 0, plus `brightness` Hz at velocity 1, and its resonance. */
  cutoff: number;
  brightness: number;
  q: number;
  /** A triangle an octave below the sawtooth, for body, at this share. */
  bodyMix: number;
  attack: number;
  release: number;
  /** Vibrato: rate (Hz), depth (cents), the delay before it starts and the time it takes to reach full depth. */
  vibratoRate: number;
  vibratoCents: number;
  vibratoDelay: number;
  vibratoRise: number;
  /** Breath noise through a band-pass at breathHz, as a share of the level. */
  breath: number;
  breathHz: number;
  level: number;
  range: readonly [number, number];
}

/** A soft piano: quick attack, long exponential decay, slightly inharmonic partials, a felt hammer. */
export interface PianoSettings {
  /** [partial number, level] pairs; partial n sounds at n * sqrt(1 + inharmonicity * n^2) times the fundamental. */
  partials: readonly (readonly [number, number])[];
  inharmonicity: number;
  /** Seconds for the fundamental to fall 60 dB; partial n decays in decay / n^decayPower. */
  decay: number;
  decayPower: number;
  attack: number;
  /** Seconds the damper takes once the written length is over. */
  damp: number;
  /** Felt: everything goes through a low-pass at this cutoff (Hz). */
  cutoff: number;
  /** The hammer's thud: a short burst of filtered noise at this share of the level. */
  hammer: number;
  level: number;
  range: readonly [number, number];
}

/** A timpani or a far-off gun: a low thump that drops in pitch, a little noise, a long tail. */
export interface DrumSettings {
  /** Pitch (Hz) at the strike and where it falls to, in `drop` seconds. */
  pitch: number;
  pitchEnd: number;
  drop: number;
  /** A second, inharmonic partial: frequency ratio and level. */
  overtone: number;
  overtoneGain: number;
  /** Seconds for the body to fall 60 dB. */
  decay: number;
  /** Noise burst: level share, low-pass cutoff (Hz) and decay (s). */
  noise: number;
  noiseCutoff: number;
  noiseDecay: number;
  level: number;
}

/** The big dark reverb: an impulse response made of decaying noise that grows darker as it fades. */
export interface ReverbSettings {
  /** Seconds to fall 60 dB. */
  seconds: number;
  preDelay: number;
  /** Low-pass of the tail, from brightHz at the start to darkHz at the end. */
  brightHz: number;
  darkHz: number;
  /** Seed of the noise, so the room is the same every time. */
  seed: number;
}

/** How loud an instrument goes straight to the mix and into the reverb. */
export interface MixSend {
  dry: number;
  send: number;
}

export interface Chord {
  at: number;
  beats: number;
  notes: readonly number[];
  /** Notes of this chord that are deliberately outside the key. */
  accidentals?: readonly number[];
}

export interface MelodyNote {
  at: number;
  beats: number;
  note: number;
  /** 0..1 */
  vel: number;
  /** True when the pitch is deliberately outside the key. */
  accidental?: boolean;
}

export interface DrumHit {
  at: number;
  vel: number;
  /** Pitch multiplier for this hit (1 = as set). */
  pitch: number;
}

export interface MusicSection {
  name: string;
  bars: number;
  /** Level of the pad in this section (1 = as set). */
  padLevel: number;
  chords: readonly Chord[];
  horn: readonly MelodyNote[];
  piano: readonly MelodyNote[];
  drums: readonly DrumHit[];
}

export interface TrackDef {
  title: string;
  bpm: number;
  beatsPerBar: number;
  /** Tonic pitch class (0 = C, 2 = D) and mode; the natural minor scale is the key's notes. */
  key: { tonic: number; mode: 'minor' };
  /** Render settings: sample rate and channels of the buffer (memory on phones), and the seconds rendered past the
   * loop for the tails, which are then folded back onto the start so they carry across the loop point. */
  sampleRate: number;
  channels: 1 | 2;
  tail: number;
  /** The rendered loop is scaled so its peak is this. */
  peak: number;
  /** Small random shifts in timing (s) and velocity (share), so it does not sound like a sequencer. */
  humanize: { time: number; velocity: number };
  seed: number;
  instruments: { pad: PadSettings; horn: HornSettings; piano: PianoSettings; drum: DrumSettings };
  /** Per-instrument dry and reverb levels, the reverb return, and a last low-pass over everything (Hz). */
  mix: Record<MusicInstrument, MixSend> & { reverb: number; lowpass: number };
  reverb: ReverbSettings;
  sections: readonly MusicSection[];
}

/** The natural minor scale as semitones above the tonic. */
export const MINOR_SCALE: readonly number[] = [0, 2, 3, 5, 7, 8, 10];

const D = 2;

/** Requiem for the Fields: the menu theme. 32 bars at 58 BPM, 132.4 s before it repeats. */
export const REQUIEM: TrackDef = {
  title: 'Requiem for the Fields',
  bpm: 58,
  beatsPerBar: 4,
  key: { tonic: D, mode: 'minor' },
  sampleRate: 24000,
  channels: 1,
  tail: 8,
  peak: 0.95,
  humanize: { time: 0.018, velocity: 0.06 },
  seed: 1918,
  instruments: {
    pad: { wave: 'sawtooth', voices: 3, detuneCents: 9, cutoff: 750, swellCutoff: 2100, q: 0.6, rest: 0.55, attack: 2.8, release: 3.6, level: 0.2, range: [24, 64] },
    horn: {
      cutoff: 700,
      brightness: 900,
      q: 0.9,
      bodyMix: 0.35,
      attack: 0.42,
      release: 1.3,
      vibratoRate: 4.6,
      vibratoCents: 11,
      vibratoDelay: 0.7,
      vibratoRise: 1.1,
      breath: 0.05,
      breathHz: 850,
      level: 0.36,
      range: [45, 70],
    },
    piano: {
      partials: [
        [1, 1],
        [2, 0.42],
        [3, 0.2],
        [4, 0.09],
        [5, 0.05],
        [7, 0.02],
      ],
      inharmonicity: 0.00035,
      decay: 6.5,
      decayPower: 0.75,
      attack: 0.005,
      damp: 1.4,
      cutoff: 2300,
      hammer: 0.05,
      level: 0.3,
      range: [57, 88],
    },
    drum: { pitch: 66, pitchEnd: 39, drop: 0.38, overtone: 1.58, overtoneGain: 0.3, decay: 3.2, noise: 0.35, noiseCutoff: 320, noiseDecay: 0.45, level: 0.22 },
  },
  mix: {
    pad: { dry: 0.8, send: 0.45 },
    horn: { dry: 0.5, send: 0.75 },
    piano: { dry: 0.62, send: 0.6 },
    drum: { dry: 0.2, send: 0.95 },
    reverb: 0.6,
    lowpass: 3200,
  },
  reverb: { seconds: 6.2, preDelay: 0.045, brightHz: 2600, darkHz: 320, seed: 1916 },
  sections: [
    {
      // Low and almost empty: the pad alone, the horn far off in the second half.
      name: 'Mist over the fields',
      bars: 8,
      padLevel: 0.85,
      chords: [
        { at: 0, beats: 8, notes: [38, 45, 50, 53] },
        { at: 8, beats: 8, notes: [34, 46, 50, 53] },
        { at: 16, beats: 8, notes: [31, 43, 50, 58] },
        { at: 24, beats: 8, notes: [38, 45, 50, 53] },
      ],
      horn: [
        { at: 17, beats: 3, note: 57, vel: 0.55 },
        { at: 20.5, beats: 1, note: 58, vel: 0.48 },
        { at: 21.5, beats: 2, note: 57, vel: 0.5 },
        { at: 24, beats: 3.5, note: 53, vel: 0.55 },
        { at: 28.5, beats: 1, note: 52, vel: 0.45 },
        { at: 29.5, beats: 2.5, note: 50, vel: 0.5 },
      ],
      piano: [],
      drums: [
        { at: 6.5, vel: 0.5, pitch: 1 },
        { at: 23.25, vel: 0.72, pitch: 0.94 },
      ],
    },
    {
      // The horn climbs and the harmony moves away from home, then turns toward it (A major, with its C sharp).
      name: 'The long road',
      bars: 8,
      padLevel: 1,
      chords: [
        { at: 0, beats: 8, notes: [34, 46, 53, 58] },
        { at: 8, beats: 8, notes: [41, 48, 53, 57] },
        { at: 16, beats: 4, notes: [36, 48, 55, 60] },
        { at: 20, beats: 4, notes: [33, 45, 52, 60] },
        { at: 24, beats: 4, notes: [31, 46, 50, 55] },
        { at: 28, beats: 4, notes: [33, 45, 49, 52], accidentals: [49] },
      ],
      horn: [
        { at: 1, beats: 3, note: 62, vel: 0.6 },
        { at: 4.5, beats: 2.5, note: 65, vel: 0.64 },
        { at: 7.5, beats: 1, note: 64, vel: 0.5 },
        { at: 8.5, beats: 3.5, note: 60, vel: 0.55 },
        { at: 13, beats: 2, note: 57, vel: 0.5 },
        { at: 16.5, beats: 3, note: 67, vel: 0.62 },
        { at: 19.5, beats: 1.5, note: 65, vel: 0.6 },
        { at: 21, beats: 3, note: 64, vel: 0.55 },
        { at: 25, beats: 2, note: 62, vel: 0.5 },
        { at: 27, beats: 1, note: 58, vel: 0.45 },
        { at: 28.5, beats: 3.5, note: 61, vel: 0.55, accidental: true },
      ],
      piano: [],
      drums: [
        { at: 9, vel: 0.45, pitch: 1.05 },
        { at: 13.75, vel: 0.6, pitch: 0.97 },
        { at: 26.5, vel: 0.8, pitch: 0.9 },
      ],
    },
    {
      // Higher and thinner: the horn rests, a soft piano lets single notes hang over a quieter pad.
      name: 'Names on a wall',
      bars: 8,
      padLevel: 0.55,
      chords: [
        { at: 0, beats: 8, notes: [41, 50, 53, 57] },
        { at: 8, beats: 8, notes: [43, 50, 55, 58] },
        { at: 16, beats: 8, notes: [34, 50, 53, 58] },
        { at: 24, beats: 8, notes: [33, 45, 52, 57, 61], accidentals: [61] },
      ],
      horn: [],
      piano: [
        { at: 0.5, beats: 2, note: 69, vel: 0.5 },
        { at: 2.5, beats: 1.5, note: 65, vel: 0.4 },
        { at: 4, beats: 4, note: 74, vel: 0.55 },
        { at: 9, beats: 2, note: 70, vel: 0.5 },
        { at: 11, beats: 1, note: 69, vel: 0.4 },
        { at: 12, beats: 3, note: 67, vel: 0.45 },
        { at: 16.5, beats: 2.5, note: 77, vel: 0.5 },
        { at: 19, beats: 1.5, note: 74, vel: 0.45 },
        { at: 20.5, beats: 3.5, note: 70, vel: 0.45 },
        { at: 25, beats: 2, note: 76, vel: 0.5 },
        { at: 27, beats: 3, note: 73, vel: 0.5, accidental: true },
        { at: 30, beats: 2, note: 69, vel: 0.4 },
      ],
      drums: [
        { at: 5.5, vel: 0.5, pitch: 1.02 },
        { at: 19.75, vel: 0.66, pitch: 0.96 },
      ],
    },
    {
      // The lowest and heaviest: the pad goes down an octave, the horn sings low, one piano note is left hanging.
      name: 'Requiem',
      bars: 8,
      padLevel: 1,
      chords: [
        { at: 0, beats: 8, notes: [26, 38, 45, 50, 53] },
        { at: 8, beats: 8, notes: [34, 41, 50, 53] },
        { at: 16, beats: 8, notes: [31, 43, 50, 55, 58] },
        { at: 24, beats: 8, notes: [38, 45, 50, 53] },
      ],
      horn: [
        { at: 2, beats: 4, note: 53, vel: 0.5 },
        { at: 6.5, beats: 1.5, note: 52, vel: 0.45 },
        { at: 8, beats: 4, note: 50, vel: 0.5 },
        { at: 13, beats: 2, note: 53, vel: 0.45 },
        { at: 15.5, beats: 4, note: 55, vel: 0.55 },
        { at: 20, beats: 2, note: 57, vel: 0.5 },
        { at: 22.5, beats: 1, note: 58, vel: 0.45 },
        { at: 24, beats: 5, note: 57, vel: 0.5 },
      ],
      piano: [
        { at: 29, beats: 3, note: 74, vel: 0.3 },
        { at: 30.5, beats: 1.5, note: 69, vel: 0.25 },
      ],
      drums: [
        { at: 1.5, vel: 0.55, pitch: 1 },
        { at: 8.75, vel: 0.4, pitch: 1.04 },
        { at: 22, vel: 0.75, pitch: 0.92 },
      ],
    },
  ],
};

/**
 * The looping tracks: the menu theme and the campaign maps, "map" for the British campaign and "stalingradMap" for
 * the Soviet one (battle tracks are layered: src/data/musicTracks).
 */
export type MusicTrackName = 'menu' | 'map' | 'stalingradMap';

export const MUSIC_TRACKS: Record<MusicTrackName, TrackDef> = {
  menu: REQUIEM,
  map: CAMPAIGN_MAP,
  stalingradMap: STALINGRAD_MAP,
};

/**
 * A model of a phone's small speaker, for measuring what a player actually hears on one: the sound summed to mono,
 * a steep high-pass (almost nothing comes out below it) and a gentle roll-off at the top.
 */
export interface PhoneSpeaker {
  highpassHz: number;
  /** Filter order: 2 = 12 dB an octave, 4 = 24 dB an octave. */
  highpassOrder: 2 | 4;
  lowpassHz: number;
  lowpassOrder: 2 | 4;
}

/**
 * The mix the menu music has to sit in at default slider levels, checked by measurement (src/audio/music/mix.ts and the
 * browser test), because nobody here can listen. Loudness is K-weighted (ITU-R BS.1770); every target must hold both
 * full range and through the phone speaker model.
 */
export interface MusicMixTargets {
  /** The music's integrated loudness minus the rain bed's (LU): the music leads, a little louder than the rain. */
  musicOverRain: readonly [number, number];
  /** Thunder over the music and the rain together: its loudest momentary (400 ms) and short-term (3 s) loudness (LU) and its sample peak (dB). */
  thunderMomentaryOverBed: number;
  thunderShortTermOverBed: number;
  thunderPeakOverBed: number;
  /** The master compressor (the engine's own chain, music + rain + a thunder): the most gain reduction during the thunder (dB)... */
  maxReductionDb: number;
  /** ...what the music and rain alone may cause (dB)... */
  bedReductionDb: number;
  /** ...and how long the reduction may stay deeper than pumpDb (s): no pumping the music down for seconds afterwards. */
  pumpDb: number;
  pumpSeconds: number;
  /** With every slider at full, the master output's peak stays under this (the soft clipper's ceiling is AUDIO.clipCeiling). */
  maxOutputPeakAtFull: number;
  /** Length (s) of the thunder measured; its loudness is the middle of the storm's range. */
  thunderLength: number;
  phone: PhoneSpeaker;
}

export const MUSIC = {
  player: {
    /** Gain of the rendered track (peak `peak`) on the Music bus at full Music volume. */
    level: 0.37,
    /** Seconds the music fades in once the sound starts (the first touch), and out when the menu is left. */
    fadeIn: 3,
    fadeOut: 1.6,
  },
  mix: {
    musicOverRain: [1, 4],
    thunderMomentaryOverBed: 3,
    thunderShortTermOverBed: 3,
    thunderPeakOverBed: 3,
    maxReductionDb: 6,
    bedReductionDb: 0.5,
    pumpDb: 2,
    pumpSeconds: 1,
    maxOutputPeakAtFull: 0.92,
    thunderLength: 4,
    phone: { highpassHz: 350, highpassOrder: 4, lowpassHz: 10000, lowpassOrder: 2 },
  } as MusicMixTargets,
} as const;
