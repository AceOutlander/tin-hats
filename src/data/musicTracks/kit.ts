/**
 * The battle orchestra's default settings: every battle track starts from these and overrides what its setting needs
 * (a drier desert, a bigger hall, a harder snare). Tuned for mono at MUSIC_BATTLE.render.sampleRate, under gunfire.
 */
import type { MixSend, ReverbSettings } from '../music';
import type { BattleInstrument, BattleInstruments } from '../musicBattle';

export const BATTLE_KIT: BattleInstruments = {
  strings: { voices: 3, detuneCents: 11, cutoff: 900, brightness: 2300, q: 0.8, attack: 0.012, short: 0.17, release: 0.12, tremRate: 13, tremDepth: 0.55, bowNoise: 0.05, level: 0.2, range: [36, 88] },
  brass: { voices: 2, detuneCents: 8, cutoff: 260, envCutoff: 1900, envDecay: 0.38, sustainShare: 0.5, q: 1.3, attack: 0.045, release: 0.25, scoopCents: 45, scoopTime: 0.06, stab: 0.24, level: 0.3, range: [28, 67] },
  horn: {
    cutoff: 900,
    brightness: 1300,
    q: 0.9,
    bodyMix: 0.3,
    attack: 0.08,
    release: 0.5,
    vibratoRate: 5,
    vibratoCents: 9,
    vibratoDelay: 0.45,
    vibratoRise: 0.6,
    breath: 0.04,
    breathHz: 900,
    level: 0.3,
    range: [45, 76],
  },
  pad: { wave: 'sawtooth', voices: 3, detuneCents: 9, cutoff: 650, swellCutoff: 1500, q: 0.6, rest: 0.65, attack: 1, release: 1.2, level: 0.11, range: [28, 72] },
  timpani: {
    modes: [
      [1, 1, 1],
      [1.5, 0.42, 0.55],
      [1.98, 0.24, 0.42],
      [2.44, 0.12, 0.3],
    ],
    decay: 1.5,
    glideCents: 30,
    glideTime: 0.08,
    noise: 0.5,
    noiseCutoff: 420,
    noiseDecay: 0.12,
    rollRate: 14,
    level: 0.5,
    range: [36, 55],
  },
  snare: {
    toneHz: 210,
    toneEndHz: 172,
    toneDecay: 0.09,
    toneMix: 0.45,
    highpassHz: 1300,
    lowpassHz: 6800,
    decay: 0.17,
    noiseMix: 0.9,
    rimHz: 1900,
    rimDecay: 0.05,
    rimMix: 0.7,
    ghost: 0.35,
    flamGap: 0.028,
    flamVel: 0.55,
    rollRate: 22,
    rollStart: 0.3,
    rollDecay: 0.06,
    level: 0.38,
  },
  hand: { dumHz: 96, dumEndHz: 72, dumDecay: 0.32, tekHz: 520, tekDecay: 0.08, slap: 0.5, level: 0.35 },
  bell: {
    partials: [
      [0.5, 0.35, 4],
      [1, 1, 3.2],
      [1.19, 0.45, 2.6],
      [1.5, 0.35, 2],
      [2, 0.4, 1.6],
      [2.52, 0.25, 1.2],
      [3.01, 0.18, 0.9],
    ],
    strike: 0.25,
    level: 0.18,
    range: [52, 84],
  },
  anvil: {
    partials: [
      [1, 1],
      [2.76, 0.6],
      [5.4, 0.35],
      [8.93, 0.2],
    ],
    decay: 0.35,
    noise: 0.6,
    noiseHz: 3000,
    level: 0.25,
  },
};

export const BATTLE_MIX: Record<BattleInstrument, MixSend> & { reverb: number; lowpass: number } = {
  strings: { dry: 0.8, send: 0.35 },
  brass: { dry: 0.8, send: 0.4 },
  horn: { dry: 0.6, send: 0.6 },
  pad: { dry: 0.7, send: 0.5 },
  timpani: { dry: 0.8, send: 0.45 },
  snare: { dry: 0.75, send: 0.3 },
  hand: { dry: 0.85, send: 0.25 },
  bell: { dry: 0.5, send: 0.7 },
  anvil: { dry: 0.8, send: 0.35 },
  reverb: 0.45,
  lowpass: 6500,
};

export const BATTLE_REVERB: ReverbSettings = { seconds: 1.7, preDelay: 0.02, brightHz: 3600, darkHz: 500, seed: 1940 };
