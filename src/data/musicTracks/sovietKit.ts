/**
 * The cold orchestra of the Soviet tracks (docs/campaigns/STALINGRAD.md, "Cold sound for every Soviet track"): the
 * battle kit made glassy and bleak. Strings narrowly detuned and bright, with a fast, shallow tremolo and more bow air;
 * low brass dark and in unison; a straight muted horn with little vibrato; a celesta-like bell (near-harmonic
 * partials, short rings); a short high anvil; dry timpani; a tight martial snare; the wordless choir and the wind.
 * The room is long and bright with its low end thinned (a high-pass on the reverb return), and the timpani, anvil and
 * bell send little to it. Each Soviet track starts from these and changes what its mission needs.
 */
import type { ReverbSettings } from '../music';
import type { BattleInstruments, BattleMix } from '../musicBattle';
import { BATTLE_KIT, BATTLE_MIX } from './kit';

export const SOVIET_KIT: BattleInstruments = {
  ...BATTLE_KIT,
  strings: { ...BATTLE_KIT.strings, detuneCents: 6, cutoff: 1100, brightness: 2900, q: 1, tremRate: 16, tremDepth: 0.4, bowNoise: 0.08, range: [36, 93] },
  brass: { ...BATTLE_KIT.brass, cutoff: 220, envCutoff: 1500, envDecay: 0.45, scoopCents: 30, level: 0.32 },
  horn: { ...BATTLE_KIT.horn, cutoff: 760, brightness: 1000, vibratoCents: 5, vibratoDelay: 0.7, breath: 0.06, breathHz: 1100 },
  pad: { ...BATTLE_KIT.pad, cutoff: 560, swellCutoff: 1300, level: 0.1 },
  timpani: { ...BATTLE_KIT.timpani, decay: 1.05, noise: 0.42, glideCents: 22 },
  snare: { ...BATTLE_KIT.snare, toneHz: 236, toneEndHz: 196, toneMix: 0.38, highpassHz: 1700, lowpassHz: 7400, decay: 0.13, rimHz: 2300, rimDecay: 0.04, level: 0.37 },
  // Celesta-like: the octave and twelfth over the fundamental, short rings, a soft strike.
  bell: {
    partials: [
      [1, 1, 1.5],
      [2, 0.3, 0.8],
      [3, 0.1, 0.45],
      [4.1, 0.06, 0.3],
    ],
    strike: 0.12,
    level: 0.2,
    range: [60, 96],
  },
  anvil: { ...BATTLE_KIT.anvil, decay: 0.2, noise: 0.45, noiseHz: 4800, level: 0.2 },
};

export const SOVIET_MIX: BattleMix = {
  ...BATTLE_MIX,
  strings: { dry: 0.75, send: 0.45 },
  horn: { dry: 0.55, send: 0.65 },
  timpani: { dry: 0.9, send: 0.15 },
  snare: { dry: 0.8, send: 0.25 },
  bell: { dry: 0.6, send: 0.35 },
  anvil: { dry: 0.85, send: 0.2 },
  choir: { dry: 0.5, send: 0.65 },
  wind: { dry: 0.8, send: 0.25 },
  reverb: 0.5,
  lowpass: 7200,
  reverbHighpass: 380,
};

/** Long and bright: the tail stays open (darkHz high) instead of turning to a warm murmur. */
export const SOVIET_REVERB: ReverbSettings = { seconds: 2.4, preDelay: 0.03, brightHz: 5200, darkHz: 1500, seed: 1941 };
