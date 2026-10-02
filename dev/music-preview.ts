/**
 * Listening page for the menu theme: renders it like the game does, measures it, draws the whole loop and every
 * section (waveform and spectrogram), shows the mix against the rain and the thunder, and plays it, including an
 * audition of the loop point (the last 8 s running into the first 8 s).
 */
import { makeClipCurve } from '../src/audio/dsp';
import { band, db, drumBeats, measureMix, peakOf, renderTrack, rmsOf, seamOf, secondsPerBeat, sectionTimes, type RenderedTrack } from '../src/audio/music';
import { findOfflineContext } from '../src/audio/render';
import { buildThunder, RainBed } from '../src/audio/storm';
import { createNoiseBank } from '../src/audio/synth';
import { MENU_STORM } from '../src/data/menuStorm';
import { MUSIC, MUSIC_TRACKS } from '../src/data/music';
import { AUDIO, VOLUME, volumeGain } from '../src/data/sounds';

const TRACK = MUSIC_TRACKS.menu;
const ROW_H = 90;
const OVERVIEW_W = 1100;
const SECTION_W = 420;
const SPEC_W = 420;
const SPEC_LOW = 40;
const SPEC_HIGH = 6000;
const SPEC_RANGE_DB = 50;
const SEAM_SECONDS = 8;

function byId<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`#${id} is missing`);
  return node as T;
}

function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    const wr = Math.cos(angle);
    const wi = Math.sin(angle);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k;
        const b = a + half;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const next = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = next;
      }
    }
  }
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (!g) throw new Error('no 2D context');
  return [c, g];
}

/** Min/max waveform of data[from, to). */
function waveform(data: Float32Array, from: number, to: number, w: number, h: number, colour = '#b9d36a'): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const [c, g] = canvas(w, h);
  const mid = h / 2;
  g.fillStyle = '#26301a';
  g.fillRect(0, mid, w, 1);
  g.fillStyle = colour;
  const per = (to - from) / w;
  for (let x = 0; x < w; x++) {
    let lo = 0;
    let hi = 0;
    const end = Math.min(to, from + Math.ceil((x + 1) * per));
    for (let i = from + Math.floor(x * per); i < end; i++) {
      if (data[i] < lo) lo = data[i];
      if (data[i] > hi) hi = data[i];
    }
    const top = mid - Math.min(1, hi) * mid;
    const bottom = mid - Math.max(-1, lo) * mid;
    g.fillRect(x, top, 1, Math.max(1, bottom - top));
  }
  return [c, g];
}

/** Log-frequency spectrogram of data[from, to). */
function spectrogram(data: Float32Array, from: number, to: number, rate: number): HTMLCanvasElement {
  const [c, g] = canvas(SPEC_W, ROW_H);
  const size = 4096;
  const bins = size / 2 + 1;
  const columns: Float32Array[] = [];
  let loudest = 1e-12;
  const re = new Float32Array(size);
  const im = new Float32Array(size);
  for (let x = 0; x < SPEC_W; x++) {
    const centre = from + ((x + 0.5) / SPEC_W) * (to - from);
    re.fill(0);
    im.fill(0);
    const first = Math.round(centre - size / 2);
    for (let i = 0; i < size; i++) {
      const k = first + i;
      if (k < from || k >= to) continue;
      re[i] = data[k] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1)));
    }
    fft(re, im);
    const col = new Float32Array(bins);
    for (let b = 0; b < bins; b++) {
      col[b] = re[b] * re[b] + im[b] * im[b];
      if (b > 0 && col[b] > loudest) loudest = col[b];
    }
    columns.push(col);
  }
  const image = g.createImageData(SPEC_W, ROW_H);
  const span = Math.log(SPEC_HIGH / SPEC_LOW);
  for (let y = 0; y < ROW_H; y++) {
    const hzTop = SPEC_LOW * Math.exp(span * (1 - y / ROW_H));
    const hzBottom = SPEC_LOW * Math.exp(span * (1 - (y + 1) / ROW_H));
    const b0 = Math.max(1, Math.floor((hzBottom / rate) * size));
    const b1 = Math.min(bins - 1, Math.max(b0, Math.ceil((hzTop / rate) * size)));
    for (let x = 0; x < SPEC_W; x++) {
      let strongest = 0;
      for (let b = b0; b <= b1; b++) if (columns[x][b] > strongest) strongest = columns[x][b];
      const v = Math.max(0, Math.min(1, 1 + (10 * Math.log10(strongest / loudest + 1e-12)) / SPEC_RANGE_DB));
      const at = (y * SPEC_W + x) * 4;
      image.data[at] = Math.min(255, v * 3 * 255);
      image.data[at + 1] = Math.max(0, Math.min(255, (v * 3 - 1) * 255));
      image.data[at + 2] = Math.max(0, Math.min(255, (v * 3 - 2) * 255)) + (v > 0 && v < 0.34 ? 60 * v : 0);
      image.data[at + 3] = 255;
    }
  }
  g.putImageData(image, 0, 0);
  return c;
}

function cell(row: HTMLTableRowElement, content: string | Node): void {
  const td = document.createElement('td');
  if (typeof content === 'string') td.textContent = content;
  else td.append(content);
  row.append(td);
}

let live: AudioContext | null = null;
/** Stops whatever is playing. */
let stopper: (() => void) | null = null;
let phoneOn = false;

function context(): AudioContext {
  live = live ?? new AudioContext();
  void live.resume();
  return live;
}

/** Where the sound goes: straight out, or first through the phone speaker model (mono, high-pass, top roll-off). */
function output(ctx: AudioContext): AudioNode {
  if (!phoneOn) return ctx.destination;
  const P = MUSIC.mix.phone;
  const stages: BiquadFilterNode[] = [];
  const stage = (type: BiquadFilterType, hz: number): void => {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = hz;
    f.Q.value = Math.SQRT1_2;
    stages.push(f);
  };
  for (let i = 0; i < P.highpassOrder / 2; i++) stage('highpass', P.highpassHz);
  for (let i = 0; i < P.lowpassOrder / 2; i++) stage('lowpass', P.lowpassHz);
  stages[0].channelCount = 1;
  stages[0].channelCountMode = 'explicit';
  for (let i = 1; i < stages.length; i++) stages[i - 1].connect(stages[i]);
  stages[stages.length - 1].connect(ctx.destination);
  return stages[0];
}

/** A copy of the engine's master chain (compressor, master gain, soft clipper) into `out`. */
function masterChain(ctx: AudioContext, out: AudioNode): AudioNode {
  const c = ctx.createDynamicsCompressor();
  c.threshold.value = AUDIO.compressor.threshold;
  c.knee.value = AUDIO.compressor.knee;
  c.ratio.value = AUDIO.compressor.ratio;
  c.attack.value = AUDIO.compressor.attack;
  c.release.value = AUDIO.compressor.release;
  const master = ctx.createGain();
  master.gain.value = AUDIO.masterGain / AUDIO.clipRange;
  const clip = ctx.createWaveShaper();
  clip.curve = makeClipCurve();
  c.connect(master);
  master.connect(clip);
  clip.connect(out);
  return c;
}

function showTime(read: () => number): void {
  const tick = (): void => {
    if (!stopper) return;
    byId('now').textContent = `${read().toFixed(1)} s`;
    requestAnimationFrame(tick);
  };
  tick();
}

function stop(): void {
  const s = stopper;
  stopper = null;
  if (s) s();
  byId('now').textContent = '';
}

/** The music alone at its default level, from `offset`, for `seconds` (null = until stopped). */
function playMusic(track: RenderedTrack, offset: number, seconds: number | null): void {
  stop();
  const ctx = context();
  const chain = masterChain(ctx, output(ctx));
  const gain = ctx.createGain();
  gain.gain.value = MUSIC.player.level * volumeGain(VOLUME.defaults.music);
  gain.connect(chain);
  const s = ctx.createBufferSource();
  s.buffer = track.buffer;
  s.loop = true;
  s.loopStart = 0;
  s.loopEnd = track.loopSeconds;
  s.connect(gain);
  s.start(ctx.currentTime, offset);
  if (seconds !== null) s.stop(ctx.currentTime + seconds);
  const started = ctx.currentTime;
  stopper = () => {
    try {
      s.stop();
    } catch {
      // Already stopped.
    }
    gain.disconnect();
  };
  showTime(() => (offset + ctx.currentTime - started) % track.loopSeconds);
}

/** Music, the title's rain bed and a thunder every storm interval, all at their default levels, as on the title. */
function playMix(track: RenderedTrack): void {
  stop();
  const ctx = context();
  const chain = masterChain(ctx, output(ctx));
  const music = ctx.createGain();
  music.gain.value = MUSIC.player.level * volumeGain(VOLUME.defaults.music);
  music.connect(chain);
  const ambience = ctx.createGain();
  ambience.gain.value = volumeGain(VOLUME.defaults.ambience);
  ambience.connect(chain);
  const s = ctx.createBufferSource();
  s.buffer = track.buffer;
  s.loop = true;
  s.loopStart = 0;
  s.loopEnd = track.loopSeconds;
  s.connect(music);
  s.start();
  const rng = Math.random;
  const bank = createNoiseBank();
  const bed = new RainBed(ctx, ambience, MENU_STORM.rainAudio.layers, rng, bank);
  bed.fadeTo(MENU_STORM.rainAudio.volume, 0.5);
  const T = MENU_STORM.thunder;
  const strike = (): void => {
    const loud = T.loudness[0] + (T.loudness[1] - T.loudness[0]) * rng();
    const length = T.length[0] + (T.length[1] - T.length[0]) * rng();
    buildThunder(ctx, ambience, ctx.currentTime + T.delay[0] + (T.delay[1] - T.delay[0]) * rng(), loud, length, T.synth, rng, bank);
  };
  const drift = window.setInterval(() => bed.drift(MENU_STORM.rainAudio.lookahead), 100);
  const first = window.setTimeout(strike, 3000);
  const every = window.setInterval(strike, MENU_STORM.thunderInterval * 1000);
  const started = ctx.currentTime;
  stopper = () => {
    window.clearInterval(drift);
    window.clearTimeout(first);
    window.clearInterval(every);
    try {
      s.stop();
    } catch {
      // Already stopped.
    }
    bed.stop(0);
    music.disconnect();
    ambience.disconnect();
  };
  showTime(() => ctx.currentTime - started);
}

async function main(): Promise<void> {
  const Offline = findOfflineContext();
  if (!Offline) {
    byId('summary').textContent = 'This browser has no OfflineAudioContext.';
    return;
  }
  byId('title').textContent = `Tin Hats music preview: ${TRACK.title}`;
  const track = await renderTrack(TRACK, Offline);
  const data = track.buffer.getChannelData(0);
  const rate = track.sampleRate;
  const frames = track.loopFrames;
  const seam = seamOf(data, frames, rate);
  const loop = data.subarray(0, frames);
  const total = rmsOf(loop) ** 2;
  const high = rmsOf(band(loop, rate, 2000, rate / 2)) ** 2;
  const low = rmsOf(band(loop, rate, 0, 250)) ** 2;
  byId('summary').textContent =
    `energy below 250 Hz ${((100 * low) / total).toFixed(1)}%, above 2 kHz ${((100 * high) / total).toFixed(2)}%. ` +
    `${track.loopSeconds.toFixed(1)} s loop, ${TRACK.bpm} BPM, ${rate} Hz x ${track.channels} ch, ${(track.bytes / 1048576).toFixed(1)} MB; ` +
    `rendered in ${track.renderMs.toFixed(0)} ms (graph built in ${track.buildMs.toFixed(0)} ms); peak ${peakOf(data, 0, frames).toFixed(3)} ` +
    `(raw ${track.rawPeak.toFixed(3)}), rms ${db(rmsOf(data, 0, frames)).toFixed(1)} dB; loop seam step ${seam.step.toExponential(2)} ` +
    `(largest step near it ${seam.localStep.toExponential(2)}), rms ${db(seam.rmsBefore).toFixed(1)} dB before, ${db(seam.rmsAfter).toFixed(1)} dB after`;

  // The whole loop, with the sections and the drum hits marked.
  const [over, og] = waveform(data, 0, frames, OVERVIEW_W, ROW_H);
  const sections = sectionTimes(TRACK);
  og.fillStyle = '#e3c06c';
  og.font = '10px monospace';
  for (const s of sections) {
    const x = Math.round((s.start / track.loopSeconds) * OVERVIEW_W);
    og.fillRect(x, 0, 1, ROW_H);
    og.fillText(s.name, x + 3, 11);
  }
  og.fillStyle = '#ff5a4a';
  for (const beat of drumBeats(TRACK)) og.fillRect(Math.round(((beat * secondsPerBeat(TRACK)) / track.loopSeconds) * OVERVIEW_W), ROW_H - 10, 2, 10);
  byId('overview').append(over);

  const body = byId('sections');
  for (const s of sections) {
    const a = Math.round(s.start * rate);
    const b = Math.min(frames, Math.round(s.end * rate));
    const row = document.createElement('tr');
    cell(row, s.name);
    cell(row, `${s.start.toFixed(1)} to ${s.end.toFixed(1)} s`);
    cell(row, db(rmsOf(data, a, b)).toFixed(1));
    cell(row, db(peakOf(data, a, b)).toFixed(1));
    cell(row, waveform(data, a, b, SECTION_W, ROW_H)[0]);
    cell(row, spectrogram(data, a, b, rate));
    body.append(row);
  }

  const playBtn = byId<HTMLButtonElement>('play');
  const mixBtn = byId<HTMLButtonElement>('playmix');
  const stopBtn = byId<HTMLButtonElement>('stop');
  const seamBtn = byId<HTMLButtonElement>('seam');
  const phoneBox = byId<HTMLInputElement>('phone');
  let last: (() => void) | null = null;
  const start = (fn: () => void): void => {
    last = fn;
    fn();
  };
  playBtn.onclick = () => start(() => playMusic(track, 0, null));
  mixBtn.onclick = () => start(() => playMix(track));
  stopBtn.onclick = () => {
    last = null;
    stop();
  };
  seamBtn.onclick = () => start(() => playMusic(track, track.loopSeconds - SEAM_SECONDS, 2 * SEAM_SECONDS));
  phoneBox.onchange = () => {
    phoneOn = phoneBox.checked;
    // Switching the model restarts what was playing, through the new output.
    if (stopper && last) last();
  };
  for (const b of [playBtn, mixBtn, stopBtn, seamBtn]) b.disabled = false;
  phoneBox.disabled = false;

  const mix = await measureMix(Offline, track);
  const T = MUSIC.mix;
  const table = document.createElement('table');
  const head = document.createElement('tr');
  for (const h of ['measure', 'full range', 'phone speaker', 'target']) {
    const th = document.createElement('th');
    th.textContent = h;
    head.append(th);
  }
  table.append(head);
  const rows: [string, number, number, string][] = [
    ['music integrated loudness (LUFS)', mix.full.musicLufs, mix.phone.musicLufs, ''],
    ['rain bed integrated loudness (LUFS)', mix.full.rainLufs, mix.phone.rainLufs, ''],
    ['music over rain (LU)', mix.full.musicOverRain, mix.phone.musicOverRain, `${T.musicOverRain[0]} to ${T.musicOverRain[1]}`],
    ['thunder momentary over music + rain (LU)', mix.full.thunderMomentaryOverBed, mix.phone.thunderMomentaryOverBed, `>= ${T.thunderMomentaryOverBed}`],
    ['thunder short-term over music + rain (LU)', mix.full.thunderShortTermOverBed, mix.phone.thunderShortTermOverBed, `>= ${T.thunderShortTermOverBed}`],
    ['thunder peak over music + rain (dB)', mix.full.thunderPeakOverBed, mix.phone.thunderPeakOverBed, `>= ${T.thunderPeakOverBed}`],
  ];
  for (const [name, full, phone, target] of rows) {
    const row = document.createElement('tr');
    cell(row, name);
    cell(row, full.toFixed(1));
    cell(row, phone.toFixed(1));
    cell(row, target);
    table.append(row);
  }
  const chain = document.createElement('p');
  chain.textContent =
    `Master chain at default sliders (music ${mix.sliders.music}, ambience ${mix.sliders.ambience}, sfx ${mix.sliders.sfx}), thunder loudness ${mix.thunderLoudness.toFixed(2)}: ` +
    `output peak ${mix.chain.outputPeak.toFixed(2)} (knee ${AUDIO.clipKnee}), compressor ${mix.chain.bedReductionDb.toFixed(1)} dB on music and rain alone, ` +
    `${mix.chain.maxReductionDb.toFixed(1)} dB at most during the thunder, ${mix.chain.pumpSeconds.toFixed(2)} s deeper than ${T.pumpDb} dB. ` +
    `Every slider full: output peak ${mix.chainAtFull.outputPeak.toFixed(2)}, compressor ${mix.chainAtFull.maxReductionDb.toFixed(1)} dB at most.`;
  table.after(chain);
  const verdict = document.createElement('p');
  verdict.className = mix.pass ? 'pass' : 'fail';
  verdict.textContent = mix.pass ? 'All mix targets met.' : `Missed: ${mix.failures.join('; ')}`;
  const mixEl = byId('mix');
  mixEl.replaceChildren(table, chain, verdict);
  Reflect.set(window, '__music', { track: { seconds: track.loopSeconds, renderMs: track.renderMs, buildMs: track.buildMs, bytes: track.bytes, rawPeak: track.rawPeak }, seam, mix });
  Reflect.set(window, '__ready', true);
}

main().catch((err: unknown) => {
  byId('summary').textContent = `Failed: ${String(err)}`;
  Reflect.set(window, '__ready', true);
});
