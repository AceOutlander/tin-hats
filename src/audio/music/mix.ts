/**
 * The music in its mix, measured (nobody here can listen): the rendered music at its player level, the title's rain bed
 * and one thunder rumble, each rendered offline at the music's sample rate, at default slider volumes, compared in
 * level against the targets in src/data/music.ts (MUSIC.mix).
 */
import { MENU_STORM } from '../../data/menuStorm';
import { MUSIC, type MusicMixTargets } from '../../data/music';
import { VOLUME, volumeGain } from '../../data/sounds';
import { seededRandom } from '../dsp';
import { startRendering, type OfflineContextCtor } from '../render';
import { buildThunder, RainBed } from '../storm';
import { createNoiseBank } from '../synth';
import { band, db, loudestWindow, rmsOf } from './analyse';
import type { RenderedTrack } from './render';

export interface MixReport {
  /** In the rain's band: the rain's average and the music's loudest second (dB), and the margin. */
  rainBandDb: number;
  musicBandLoudestDb: number;
  rainOverMusicDb: number;
  /** All bands: the music's loudest second and the rain's average (dB), and how far the music sits above. */
  musicLoudestDb: number;
  rainDb: number;
  musicOverRainDb: number;
  /** Loudest 50 ms of thunder and of music (dB), and the margin. */
  thunderPeakDb: number;
  musicPeakDb: number;
  thunderOverMusicDb: number;
  /** In the low band: loudest 100 ms of thunder and of music (dB), and the margin. */
  thunderLowDb: number;
  musicLowDb: number;
  thunderLowOverMusicDb: number;
  pass: boolean;
  failures: string[];
}

const RAIN_SECONDS = 20;
const THUNDER_SECONDS = 9;

export async function measureMix(Offline: OfflineContextCtor, track: RenderedTrack, targets: MusicMixTargets = MUSIC.mix): Promise<MixReport> {
  const rate = track.sampleRate;
  const bank = createNoiseBank();
  const rng = seededRandom(0x5eed);
  const musicGain = MUSIC.player.level * volumeGain(VOLUME.defaults.music);
  const ambienceGain = volumeGain(VOLUME.defaults.ambience);

  const music = new Float32Array(track.loopFrames);
  const src = track.buffer.getChannelData(0);
  for (let i = 0; i < music.length; i++) music[i] = src[i] * musicGain;

  // The rain bed at its full level (no fade), drifting as it does on the title.
  const rainCtx = new Offline(1, RAIN_SECONDS * rate, rate);
  const bed = new RainBed(rainCtx, rainCtx.destination, MENU_STORM.rainAudio.layers, rng, bank);
  bed.out.gain.setValueAtTime(MENU_STORM.rainAudio.volume * ambienceGain, 0);
  for (let k = 0; k < 200; k++) bed.drift(RAIN_SECONDS);
  const rain = (await startRendering(rainCtx)).getChannelData(0).slice(rate);

  const thunderCtx = new Offline(1, THUNDER_SECONDS * rate, rate);
  const thunderOut = thunderCtx.createGain();
  thunderOut.gain.value = ambienceGain;
  thunderOut.connect(thunderCtx.destination);
  buildThunder(thunderCtx, thunderOut, 0.05, targets.thunderLoudness, targets.thunderLength, MENU_STORM.thunder.synth, rng, bank);
  const thunder = (await startRendering(thunderCtx)).getChannelData(0);

  const [bLow, bHigh] = targets.rainBand;
  const rainBandDb = db(rmsOf(band(rain, rate, bLow, bHigh)));
  const musicBandLoudestDb = db(loudestWindow(band(music, rate, bLow, bHigh), rate, 1));
  const musicLoudestDb = db(loudestWindow(music, rate, 1));
  const rainDb = db(rmsOf(rain));
  const thunderPeakDb = db(loudestWindow(thunder, rate, 0.05));
  const musicPeakDb = db(loudestWindow(music, rate, 0.05));
  const [lLow, lHigh] = targets.lowBand;
  const thunderLowDb = db(loudestWindow(band(thunder, rate, lLow, lHigh), rate, 0.1));
  const musicLowDb = db(loudestWindow(band(music, rate, lLow, lHigh), rate, 0.1));

  const report: MixReport = {
    rainBandDb,
    musicBandLoudestDb,
    rainOverMusicDb: rainBandDb - musicBandLoudestDb,
    musicLoudestDb,
    rainDb,
    musicOverRainDb: musicLoudestDb - rainDb,
    thunderPeakDb,
    musicPeakDb,
    thunderOverMusicDb: thunderPeakDb - musicPeakDb,
    thunderLowDb,
    musicLowDb,
    thunderLowOverMusicDb: thunderLowDb - musicLowDb,
    pass: true,
    failures: [],
  };
  const fail = (what: string): void => {
    report.pass = false;
    report.failures.push(what);
  };
  if (report.rainOverMusicDb < targets.rainOverMusicDb) fail(`rain only ${report.rainOverMusicDb.toFixed(1)} dB over the music in its band (want ${targets.rainOverMusicDb})`);
  if (report.musicOverRainDb < targets.musicOverRain[0] || report.musicOverRainDb > targets.musicOverRain[1]) {
    fail(`music ${report.musicOverRainDb.toFixed(1)} dB over the rain (want ${targets.musicOverRain[0]} to ${targets.musicOverRain[1]})`);
  }
  if (report.thunderOverMusicDb < targets.thunderOverMusicDb) fail(`thunder only ${report.thunderOverMusicDb.toFixed(1)} dB over the music (want ${targets.thunderOverMusicDb})`);
  if (report.thunderLowOverMusicDb < targets.thunderLowOverMusicDb) fail(`thunder lows only ${report.thunderLowOverMusicDb.toFixed(1)} dB over the music's (want ${targets.thunderLowOverMusicDb})`);
  return report;
}
