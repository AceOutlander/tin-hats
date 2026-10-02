/**
 * Listening page for the menu theme: renders it like the game does, measures it, draws the whole loop and every
 * section (waveform and spectrogram), shows the mix against the rain and the thunder, and plays it, including an
 * audition of the loop point (the last 8 s running into the first 8 s).
 */
import { band, db, drumBeats, measureMix, peakOf, renderTrack, rmsOf, seamOf, secondsPerBeat, sectionTimes, type RenderedTrack } from '../src/audio/music';
import { findOfflineContext } from '../src/audio/render';
import { MUSIC, MUSIC_TRACKS } from '../src/data/music';

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
let source: AudioBufferSourceNode | null = null;

function play(track: RenderedTrack, offset: number, seconds: number | null): void {
  stop();
  live = live ?? new AudioContext();
  void live.resume();
  const gain = live.createGain();
  gain.gain.value = MUSIC.player.level;
  gain.connect(live.destination);
  const s = live.createBufferSource();
  s.buffer = track.buffer;
  s.loop = true;
  s.loopStart = 0;
  s.loopEnd = track.loopSeconds;
  s.connect(gain);
  s.start(live.currentTime, offset);
  if (seconds !== null) s.stop(live.currentTime + seconds);
  source = s;
  const started = live.currentTime;
  const tick = (): void => {
    if (source !== s || !live) return;
    const t = (offset + live.currentTime - started) % track.loopSeconds;
    byId('now').textContent = `${t.toFixed(1)} s`;
    requestAnimationFrame(tick);
  };
  tick();
}

function stop(): void {
  if (source) {
    try {
      source.stop();
    } catch {
      // Already stopped.
    }
  }
  source = null;
  byId('now').textContent = '';
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
  const stopBtn = byId<HTMLButtonElement>('stop');
  const seamBtn = byId<HTMLButtonElement>('seam');
  playBtn.onclick = () => play(track, 0, null);
  stopBtn.onclick = () => stop();
  seamBtn.onclick = () => play(track, track.loopSeconds - SEAM_SECONDS, 2 * SEAM_SECONDS);
  for (const b of [playBtn, stopBtn, seamBtn]) b.disabled = false;

  const mix = await measureMix(Offline, track);
  const rows: [string, number, string][] = [
    ['rain over the music in its band (dB)', mix.rainOverMusicDb, `>= ${MUSIC.mix.rainOverMusicDb}`],
    ['music loudest second over the rain (dB)', mix.musicOverRainDb, `${MUSIC.mix.musicOverRain[0]} to ${MUSIC.mix.musicOverRain[1]}`],
    ['thunder peak over the music peak (dB)', mix.thunderOverMusicDb, `>= ${MUSIC.mix.thunderOverMusicDb}`],
    ['thunder lows over the music lows (dB)', mix.thunderLowOverMusicDb, `>= ${MUSIC.mix.thunderLowOverMusicDb}`],
  ];
  const table = document.createElement('table');
  for (const [name, value, target] of rows) {
    const row = document.createElement('tr');
    cell(row, name);
    cell(row, value.toFixed(1));
    cell(row, target);
    table.append(row);
  }
  const verdict = document.createElement('p');
  verdict.className = mix.pass ? 'pass' : 'fail';
  verdict.textContent = mix.pass ? 'All mix targets met.' : `Missed: ${mix.failures.join('; ')}`;
  const mixEl = byId('mix');
  mixEl.replaceChildren(table, verdict);
  Reflect.set(window, '__music', { track: { seconds: track.loopSeconds, renderMs: track.renderMs, buildMs: track.buildMs, bytes: track.bytes, rawPeak: track.rawPeak }, seam, mix });
  Reflect.set(window, '__ready', true);
}

main().catch((err: unknown) => {
  byId('summary').textContent = `Failed: ${String(err)}`;
  Reflect.set(window, '__ready', true);
});
