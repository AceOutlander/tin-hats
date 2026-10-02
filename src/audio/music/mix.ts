/**
 * The menu mix, measured (nobody here can listen): the rendered music at its player level, the title's rain bed and a
 * thunder of middling loudness, each rendered offline at the music's sample rate and set at the default slider
 * levels, compared in perceived loudness (K-weighted, BS.1770) full range and through the phone speaker model, then
 * played together through a copy of the engine's master chain (compressor, master gain, soft clipper) to read the
 * compressor's gain reduction and the output peak. Every number and target comes from the data
 * (src/data/music.ts MUSIC, src/data/menuStorm.ts, src/data/sounds.ts).
 */
import { MENU_STORM } from '../../data/menuStorm';
import { MUSIC, type MusicMixTargets } from '../../data/music';
import { AUDIO, VOLUME, volumeGain } from '../../data/sounds';
import { makeClipCurve, seededRandom } from '../dsp';
import { startRendering, type OfflineContextCtor } from '../render';
import { buildThunder, RainBed } from '../storm';
import { createNoiseBank } from '../synth';
import { db, loudestStart, loudnessOf, peakOf, phoneSpeaker } from './analyse';
import type { RenderedTrack } from './render';

/** Loudness of the three sounds and the margins, through one listening model. */
export interface LoudnessReport {
  /** Integrated loudness (LUFS relative to the engine's full scale) of the music over its loop and of the rain bed. */
  musicLufs: number;
  rainLufs: number;
  /** music - rain (LU): the target is a little above zero. */
  musicOverRain: number;
  /** Music and rain together: loudest momentary and short-term loudness, sample peak (dB). */
  bedMomentary: number;
  bedShortTerm: number;
  bedPeakDb: number;
  /** The thunder: loudest momentary and short-term loudness, sample peak (dB). */
  thunderMomentary: number;
  thunderShortTerm: number;
  thunderPeakDb: number;
  thunderMomentaryOverBed: number;
  thunderShortTermOverBed: number;
  thunderPeakOverBed: number;
}

/** Music, rain and a thunder through the engine's master chain. */
export interface ChainReport {
  /** Peak of what leaves the chain (the soft clipper bends above AUDIO.clipKnee and never passes AUDIO.clipCeiling). */
  outputPeak: number;
  /** Compressor gain reduction (dB): the most the music and rain alone cause, the most overall, and the seconds deeper than the pump threshold. */
  bedReductionDb: number;
  maxReductionDb: number;
  pumpSeconds: number;
  /** The reduction (dB) every PROBE_STEP seconds, for the preview page's curve. */
  series: number[];
}

export interface MixReport {
  /** Slider levels the mix was measured at (the defaults). */
  sliders: { music: number; ambience: number; sfx: number };
  thunderLoudness: number;
  full: LoudnessReport;
  phone: LoudnessReport;
  /** The master chain at the default slider levels, and with every slider at full. */
  chain: ChainReport;
  chainAtFull: ChainReport;
  pass: boolean;
  failures: string[];
}

const RAIN_SECONDS = 20;
const THUNDER_SECONDS = 9;
/**
 * The chain run: the browser's compressor starts fully closed and takes about a second to open (AUDIO.warmup says the
 * same of the live engine), so nothing is judged before CHAIN_SETTLE; then music and rain alone until THUNDER_AT, then
 * the thunder and its tail.
 */
const CHAIN_SECONDS = 17;
const CHAIN_SETTLE = 2;
const THUNDER_AT = 6;
const PROBE_STEP = 0.05;

function loudnessReport(music: Float32Array, rain: Float32Array, thunder: Float32Array, rate: number): LoudnessReport {
  const m = loudnessOf(music, rate);
  const r = loudnessOf(rain, rate);
  const bed = new Float32Array(music.length);
  for (let i = 0; i < bed.length; i++) bed[i] = music[i] + rain[i % rain.length];
  const b = loudnessOf(bed, rate);
  const t = loudnessOf(thunder, rate);
  const bedPeakDb = db(peakOf(bed));
  const thunderPeakDb = db(peakOf(thunder));
  return {
    musicLufs: m.integrated,
    rainLufs: r.integrated,
    musicOverRain: m.integrated - r.integrated,
    bedMomentary: b.momentaryMax,
    bedShortTerm: b.shortTermMax,
    bedPeakDb,
    thunderMomentary: t.momentaryMax,
    thunderShortTerm: t.shortTermMax,
    thunderPeakDb,
    thunderMomentaryOverBed: t.momentaryMax - b.momentaryMax,
    thunderShortTermOverBed: t.shortTermMax - b.shortTermMax,
    thunderPeakOverBed: thunderPeakDb - bedPeakDb,
  };
}

/** Play music (already at its level), rain and thunder (at full ambience) through a copy of the engine's master chain. */
async function chainReport(Offline: OfflineContextCtor, rate: number, music: Float32Array, rain: Float32Array, thunder: Float32Array, musicBus: number, ambienceBus: number, targets: MusicMixTargets): Promise<ChainReport> {
  const frames = Math.round(CHAIN_SECONDS * rate);
  const ctx = new Offline(1, frames, rate);
  const buffer = (data: Float32Array): AudioBuffer => {
    const b = ctx.createBuffer(1, data.length, rate);
    b.getChannelData(0).set(data);
    return b;
  };
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = AUDIO.compressor.threshold;
  compressor.knee.value = AUDIO.compressor.knee;
  compressor.ratio.value = AUDIO.compressor.ratio;
  compressor.attack.value = AUDIO.compressor.attack;
  compressor.release.value = AUDIO.compressor.release;
  const master = ctx.createGain();
  master.gain.value = AUDIO.masterGain / AUDIO.clipRange;
  const clipper = ctx.createWaveShaper();
  clipper.curve = makeClipCurve();
  compressor.connect(master);
  master.connect(clipper);
  clipper.connect(ctx.destination);
  const play = (data: Float32Array, at: number, gain: number, loop: boolean): void => {
    const source = ctx.createBufferSource();
    source.buffer = buffer(data);
    source.loop = loop;
    const g = ctx.createGain();
    g.gain.value = gain;
    source.connect(g);
    g.connect(compressor);
    source.start(at);
  };
  play(music, 0, musicBus, true);
  play(rain, 0, ambienceBus, true);
  play(thunder, THUNDER_AT, ambienceBus, false);
  const reduction: number[] = [];
  for (let t = PROBE_STEP; t < CHAIN_SECONDS - PROBE_STEP; t += PROBE_STEP) {
    void ctx.suspend(t).then(() => {
      reduction.push(Math.abs(compressor.reduction));
      void ctx.resume();
    });
  }
  const out = (await startRendering(ctx)).getChannelData(0);
  let bedReduction = 0;
  let maxReduction = 0;
  let pump = 0;
  const settled: number[] = [];
  reduction.forEach((r, i) => {
    const t = (i + 1) * PROBE_STEP;
    if (t < CHAIN_SETTLE) return;
    settled.push(r);
    if (t < THUNDER_AT) bedReduction = Math.max(bedReduction, r);
    maxReduction = Math.max(maxReduction, r);
    if (r > targets.pumpDb) pump += PROBE_STEP;
  });
  return {
    outputPeak: peakOf(out, Math.round(CHAIN_SETTLE * rate)),
    bedReductionDb: bedReduction,
    maxReductionDb: maxReduction,
    pumpSeconds: pump,
    series: settled,
  };
}

export async function measureMix(Offline: OfflineContextCtor, track: RenderedTrack, targets: MusicMixTargets = MUSIC.mix): Promise<MixReport> {
  const rate = track.sampleRate;
  const bank = createNoiseBank();
  const rng = seededRandom(0x5eed);
  const sliders = { music: VOLUME.defaults.music, ambience: VOLUME.defaults.ambience, sfx: VOLUME.defaults.sfx };
  const musicBus = volumeGain(sliders.music);
  const ambienceBus = volumeGain(sliders.ambience);
  const T = MENU_STORM.thunder;
  const thunderLoudness = (T.loudness[0] + T.loudness[1]) / 2;

  // The three sounds as they reach their buses (player level, bed volume, thunder loudness), mono.
  const music = new Float32Array(track.loopFrames);
  const src = track.buffer.getChannelData(0);
  for (let i = 0; i < music.length; i++) music[i] = src[i] * MUSIC.player.level;

  const rainCtx = new Offline(1, RAIN_SECONDS * rate, rate);
  const bed = new RainBed(rainCtx, rainCtx.destination, MENU_STORM.rainAudio.layers, rng, bank);
  bed.out.gain.setValueAtTime(MENU_STORM.rainAudio.volume, 0);
  for (let k = 0; k < 200; k++) bed.drift(RAIN_SECONDS);
  const rain = (await startRendering(rainCtx)).getChannelData(0).slice(rate);

  const thunderCtx = new Offline(1, THUNDER_SECONDS * rate, rate);
  buildThunder(thunderCtx, thunderCtx.destination, 0.05, thunderLoudness, targets.thunderLength, T.synth, rng, bank);
  const thunder = (await startRendering(thunderCtx)).getChannelData(0);

  // Perceived loudness at the default slider levels, full range and through the phone speaker.
  const scale = (data: Float32Array, k: number): Float32Array => data.map((x) => x * k);
  const atMusic = scale(music, musicBus);
  const atRain = scale(rain, ambienceBus);
  const atThunder = scale(thunder, ambienceBus);
  const full = loudnessReport(atMusic, atRain, atThunder, rate);
  const P = targets.phone;
  const phone = loudnessReport(phoneSpeaker(atMusic, rate, P), phoneSpeaker(atRain, rate, P), phoneSpeaker(atThunder, rate, P), rate);

  // The master chain, over the loudest stretch of the music.
  const from = loudestStart(music, rate, CHAIN_SECONDS);
  const stretch = music.slice(from, from + Math.round(CHAIN_SECONDS * rate));
  const chain = await chainReport(Offline, rate, stretch, rain, thunder, musicBus, ambienceBus, targets);
  const chainAtFull = await chainReport(Offline, rate, stretch, rain, thunder, 1, 1, targets);

  const report: MixReport = { sliders, thunderLoudness, full, phone, chain, chainAtFull, pass: true, failures: [] };
  const fail = (what: string): void => {
    report.pass = false;
    report.failures.push(what);
  };
  for (const [name, l] of [
    ['full range', full],
    ['phone speaker', phone],
  ] as const) {
    if (l.musicOverRain < targets.musicOverRain[0] || l.musicOverRain > targets.musicOverRain[1]) {
      fail(`${name}: music ${l.musicOverRain.toFixed(1)} LU over the rain (want ${targets.musicOverRain[0]} to ${targets.musicOverRain[1]})`);
    }
    if (l.thunderMomentaryOverBed < targets.thunderMomentaryOverBed) fail(`${name}: thunder momentary only ${l.thunderMomentaryOverBed.toFixed(1)} LU over music and rain`);
    if (l.thunderShortTermOverBed < targets.thunderShortTermOverBed) fail(`${name}: thunder short-term only ${l.thunderShortTermOverBed.toFixed(1)} LU over music and rain`);
    if (l.thunderPeakOverBed < targets.thunderPeakOverBed) fail(`${name}: thunder peak only ${l.thunderPeakOverBed.toFixed(1)} dB over music and rain`);
  }
  if (chain.outputPeak > AUDIO.clipKnee) fail(`output peak ${chain.outputPeak.toFixed(2)} reaches the soft clipper's knee at default levels`);
  if (chain.bedReductionDb > targets.bedReductionDb) fail(`the compressor already takes ${chain.bedReductionDb.toFixed(1)} dB off the music and rain`);
  if (chain.maxReductionDb > targets.maxReductionDb) fail(`the compressor takes ${chain.maxReductionDb.toFixed(1)} dB off during the thunder`);
  if (chain.pumpSeconds > targets.pumpSeconds) fail(`the compressor holds more than ${targets.pumpDb} dB for ${chain.pumpSeconds.toFixed(2)} s`);
  if (chainAtFull.outputPeak > targets.maxOutputPeakAtFull) fail(`with every slider full the output peaks at ${chainAtFull.outputPeak.toFixed(2)}`);
  return report;
}
