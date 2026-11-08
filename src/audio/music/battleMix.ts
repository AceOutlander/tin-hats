/**
 * The battle mix, measured (nobody here can listen): the measured "army of 80 firing" (80 shots a tick, 30 ticks a
 * second, for 6 s, a big blast every half second, as in dev/battle-loudness.ts) rendered through the real engine at
 * the default sliders, against each battle-music layer at its player level on the Music bus at the default slider,
 * in K-weighted loudness (BS.1770), full range and through the phone speaker model. The army comes out of the
 * engine's master chain (its compressor already holds it down), the music is taken before the chain with only the
 * master gain applied, so the margins measured are, if anything, smaller than what a player hears.
 *
 * Kept out of the music index: it builds a whole engine, and the engine imports the music index.
 */
import { MUSIC_BATTLE, type BattleMixTargets, type BattleTrackDef } from '../../data/musicBattle';
import { AUDIO, VOLUME, volumeGain } from '../../data/sounds';
import { seededRandom } from '../dsp';
import type { GameAudio } from '../engine';
import { startRendering, type OfflineContextCtor } from '../render';
import { db, loudnessOf, peakOf, phoneSpeaker } from './analyse';

type CreateAudio = (options: { context?: BaseAudioContext; random?: () => number }) => GameAudio;

export type MixedLayer = 'build' | 'combat' | 'tense';

export interface BattleMixLayer {
  layer: MixedLayer;
  /** Integrated loudness of the layer as heard (LUFS) and the army's margin over it (LU), full range and on a phone. */
  fullLufs: number;
  phoneLufs: number;
  armyOverFull: number;
  armyOverPhone: number;
  /** Sample peak of the layer before the player level (dBFS). */
  peakDb: number;
}

export interface BattleMixReport {
  track: string;
  sliders: { music: number; sfx: number };
  army: { fullLufs: number; phoneLufs: number; peakDb: number };
  layers: BattleMixLayer[];
  /** Loudest sample of the stings before the player level (dBFS). */
  stingPeakDb: number;
  pass: boolean;
  failures: string[];
}

const RATE = 48000;
const AT = 2;
const SECONDS = 9;
const SHOTS = ['rifleShot', 'mgShot', 'smgShot', 'bunkerMg', 'sniperShot', 'tankGun', 'grenadeExplosion'];

/** The army of 80 through the engine at the default sliders: the mid channel over the 6 s it fires. */
async function renderArmy(Offline: OfflineContextCtor, createAudio: CreateAudio): Promise<Float32Array> {
  const ctx = new Offline(2, SECONDS * RATE, RATE);
  const audio = createAudio({ context: ctx, random: seededRandom(1944) });
  await audio.whenReady();
  const points = new Map<number, (() => void)[]>();
  const at = (t: number, fn: () => void): void => {
    const q = Math.round((t * RATE) / 128);
    const list = points.get(q) ?? [];
    list.push(fn);
    points.set(q, list);
  };
  at(1.003, () => audio.setListener(2000, 1000));
  for (let k = 0; k < 6 * 30; k++) {
    at(AT + k / 30 + 0.003, () => {
      for (let u = 0; u < 80; u++) audio.playAt(SHOTS[(u + k) % SHOTS.length], 1500 + u * 12);
      if (k % 15 === 0) audio.playAt('explosionLarge', 1800 + ((k * 37) % 400));
    });
  }
  for (const [q, fns] of points) {
    if (q * 128 >= ctx.length) continue;
    void ctx.suspend((q * 128) / RATE).then(() => {
      for (const fn of fns) fn();
      void ctx.resume();
    });
  }
  const out = await startRendering(ctx);
  const l = out.getChannelData(0);
  const r = out.getChannelData(1);
  const a = AT * RATE;
  const b = (AT + 6) * RATE;
  const mid = new Float32Array(b - a);
  for (let i = a; i < b; i++) mid[i - a] = (l[i] + r[i]) / 2;
  return mid;
}

/**
 * Measure a battle track: `layers` holds each layer's sections back to back (as rendered, before any level), at
 * `rate`; `stingPeak` the loudest sting sample.
 */
export async function measureBattleMix(
  Offline: OfflineContextCtor,
  createAudio: CreateAudio,
  def: BattleTrackDef,
  layers: Record<MixedLayer, Float32Array>,
  rate: number,
  stingPeak: number,
  targets: BattleMixTargets = MUSIC_BATTLE.mix,
): Promise<BattleMixReport> {
  const sliders = { music: VOLUME.defaults.music, sfx: VOLUME.defaults.sfx };
  const army = await renderArmy(Offline, createAudio);
  const P = targets.phone;
  const armyFull = loudnessOf(army, RATE).integrated;
  const armyPhone = loudnessOf(phoneSpeaker(army, RATE, P), RATE).integrated;
  const report: BattleMixReport = {
    track: def.title,
    sliders,
    army: { fullLufs: armyFull, phoneLufs: armyPhone, peakDb: db(peakOf(army)) },
    layers: [],
    stingPeakDb: db(stingPeak),
    pass: true,
    failures: [],
  };
  const fail = (what: string): void => {
    report.pass = false;
    report.failures.push(what);
  };
  for (const layer of ['build', 'combat', 'tense'] as const) {
    const data = layers[layer];
    const k = MUSIC_BATTLE.player.level * def.layerLevel[layer] * volumeGain(sliders.music) * AUDIO.masterGain;
    const heard = data.map((x) => x * k);
    const full = loudnessOf(heard, rate).integrated;
    const phone = loudnessOf(phoneSpeaker(heard, rate, P), rate).integrated;
    const l: BattleMixLayer = { layer, fullLufs: full, phoneLufs: phone, armyOverFull: armyFull - full, armyOverPhone: armyPhone - phone, peakDb: db(peakOf(data)) };
    report.layers.push(l);
    const [lo, hi] = targets.armyOverLayer[layer];
    for (const [name, v] of [
      ['full range', l.armyOverFull],
      ['phone speaker', l.armyOverPhone],
    ] as const) {
      if (v < lo) fail(`${layer}, ${name}: the army is only ${v.toFixed(1)} LU over the music (want at least ${lo})`);
      if (v > hi) fail(`${layer}, ${name}: the music is ${v.toFixed(1)} LU under the army, lost (want at most ${hi})`);
    }
    if (l.peakDb > targets.maxPeakDb) fail(`${layer} peaks at ${l.peakDb.toFixed(1)} dBFS`);
  }
  if (report.stingPeakDb > targets.maxPeakDb) fail(`a sting peaks at ${report.stingPeakDb.toFixed(1)} dBFS`);
  return report;
}
