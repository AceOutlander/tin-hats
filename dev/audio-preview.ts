/**
 * Audio preview and self-check (dev server only).
 *
 * Nobody on the build side can listen, so this page measures instead: every
 * one-shot and loop is rendered through OfflineAudioContext and checked for
 * silence, clipping, length, onset and (where it matters) whether it rises or
 * falls in pitch. The whole engine is then run offline with 80 units firing to
 * check the voice limiter and the master chain. A waveform and a spectrogram
 * are drawn for each sound so a screenshot shows its shape.
 *
 * Results: a table on the page, window.__audioReport, and window.__ready = true.
 * Any failed check is also sent to console.error so tools/shot.ts --strict fails.
 */
import { createAudio, type GameAudio } from '../src/audio';
import { peakOf, seededRandom } from '../src/audio/dsp';
import { findOfflineContext, levelSound, renderLoop, renderSoundRaw, startRendering } from '../src/audio/render';
import { createNoiseBank } from '../src/audio/synth';
import {
  AUDIO,
  LOOP_NAMES,
  LOOPS,
  ONE_SHOT_NAMES,
  SOUNDS,
  soundDuration,
  type LoopDef,
  type LoopName,
  type OneShotName,
  type SoundDef,
} from '../src/data/sounds';

const SAMPLE_RATE = 44100;
/** A sample counts as audible above this level (about -48 dB below full scale). */
const AUDIBLE = 0.004;
const WAVE_W = 170;
const SPEC_W = 220;
const ROW_H = 38;
const SPEC_LOW_HZ = 40;
const SPEC_HIGH_HZ = 12000;
const SPEC_RANGE_DB = 60;
const LOOP_SECONDS = 4;

interface Expectation {
  /** Audible length in seconds, [min, max]. */
  dur: [number, number];
  /** Whether the brightness (spectral centroid) must fall or rise from the first half to the second. */
  trend?: 'falling' | 'rising';
  /** Allowed overall spectral centroid in Hz. */
  centroid?: [number, number];
  /** The sound swells in slowly, so the fast-onset check does not apply. */
  slowStart?: boolean;
}

/** What each sound should measure like, written from the intent of the sound, not from its layer data. */
const EXPECT: Record<OneShotName, Expectation> = {
  rifleShot: { dur: [0.1, 0.4], trend: 'falling', centroid: [500, 4000] },
  mgShot: { dur: [0.05, 0.2], centroid: [400, 4000] },
  smgShot: { dur: [0.03, 0.12], centroid: [800, 5000] },
  sniperShot: { dur: [0.45, 1.2], trend: 'falling', centroid: [500, 4000] },
  bunkerMg: { dur: [0.06, 0.22], centroid: [250, 2500] },
  grenadeExplosion: { dur: [0.25, 0.7], trend: 'falling', centroid: [150, 2000] },
  mortarLaunch: { dur: [0.1, 0.35], centroid: [100, 900] },
  shellWhistle: { dur: [0.8, 1.1], trend: 'falling', centroid: [600, 2600], slowStart: true },
  explosionMedium: { dur: [0.8, 1.7], trend: 'falling', centroid: [120, 1500] },
  explosionLarge: { dur: [1.6, 3], trend: 'falling', centroid: [100, 1200] },
  tankGun: { dur: [0.4, 1], trend: 'falling', centroid: [200, 2500] },
  rocketLaunch: { dur: [0.45, 0.9] },
  ricochet: { dur: [0.15, 0.4], trend: 'falling', centroid: [1000, 5000] },
  dirtHit: { dur: [0.03, 0.12], centroid: [150, 1500] },
  uiClick: { dur: [0.015, 0.06] },
  uiDeny: { dur: [0.25, 0.35], trend: 'falling', centroid: [100, 1500] },
  uiConfirm: { dur: [0.18, 0.4], trend: 'rising' },
  whistleFallBack: { dur: [0.6, 0.72], trend: 'falling', centroid: [2000, 4500] },
  whistleHold: { dur: [0.42, 0.52], centroid: [2000, 4500] },
  whistleAdvance: { dur: [0.5, 0.6], trend: 'rising', centroid: [2000, 4500] },
  unitTrained: { dur: [0.38, 0.5] },
  suppliesDelivered: { dur: [0.4, 0.75], trend: 'rising' },
  airdrop: { dur: [1.22, 1.4], slowStart: true },
  planeFlyby: { dur: [2.2, 2.65], centroid: [60, 900], slowStart: true },
  victorySting: { dur: [1.9, 2.15], trend: 'rising' },
  defeatSting: { dur: [2.4, 2.65], trend: 'falling' },
  thunder: { dur: [3.2, 5.5], trend: 'falling' },
};

/** Loops are background beds: their peak must sit well under a single rifle shot (0.32). */
const LOOP_EXPECT: Record<LoopName, { peak: [number, number]; centroid: [number, number] }> = {
  rain: { peak: [0.05, 0.2], centroid: [1200, 7000] },
  tankEngine: { peak: [0.08, 0.25], centroid: [150, 1200] },
};

/** Phone speakers reproduce little below this frequency... */
const PHONE_LOW_HZ = 250;
/** ...so at least this share of every sound's energy must lie above it. */
const PHONE_MIN_SHARE = 0.25;

interface Analysis {
  finite: boolean;
  peak: number;
  rms: number;
  /** Seconds to the first and last audible sample. */
  onset: number;
  audible: number;
  /** Power-weighted spectral centroid of the first and second half of the audible part, and overall. */
  earlyHz: number;
  lateHz: number;
  centroidHz: number;
  /** Share (0..1) of the energy that lies above PHONE_LOW_HZ. */
  phoneShare: number;
}

interface SoundRow extends Analysis {
  name: string;
  kind: 'one-shot' | 'loop';
  layers: number;
  nominal: number;
  rawPeak: number;
  target: number;
  problems: string[];
}

interface MixRow {
  name: string;
  seconds: number;
  peak: number;
  rms: number;
  overKnee: number;
  requested: number;
  played: number;
  dropped: number;
  stolen: number;
  maxVoices: number;
  problems: string[];
}

/** In-place radix-2 FFT. */
function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
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

/** Power spectrum (bins 0..size/2) of a Hann-windowed frame centred on `centre`; zero beyond the data. */
function powerSpectrum(data: Float32Array, centre: number, size: number, out: Float32Array): void {
  const re = new Float32Array(size);
  const im = new Float32Array(size);
  const first = Math.round(centre - size / 2);
  for (let i = 0; i < size; i++) {
    const index = first + i;
    if (index < 0 || index >= data.length) continue;
    re[i] = data[index] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1)));
  }
  fft(re, im);
  for (let i = 0; i <= size / 2; i++) out[i] = re[i] * re[i] + im[i] * im[i];
}

function fftSizeFor(samples: number): number {
  return samples >= 0.3 * SAMPLE_RATE ? 2048 : 512;
}

function analyse(data: Float32Array): Analysis {
  let finite = true;
  let power = 0;
  let first = -1;
  let last = -1;
  for (let i = 0; i < data.length; i++) {
    const value = data[i];
    if (!Number.isFinite(value)) finite = false;
    power += value * value;
    if (Math.abs(value) > AUDIBLE) {
      if (first < 0) first = i;
      last = i;
    }
  }
  const result: Analysis = {
    finite,
    peak: peakOf(data),
    rms: Math.sqrt(power / Math.max(1, data.length)),
    onset: first < 0 ? 0 : first / SAMPLE_RATE,
    audible: (last + 1) / SAMPLE_RATE,
    earlyHz: 0,
    lateHz: 0,
    centroidHz: 0,
    phoneShare: 0,
  };
  if (last <= 0) return result;

  const size = fftSizeFor(last);
  const hop = size / 4;
  const spectrum = new Float32Array(size / 2 + 1);
  const binHz = SAMPLE_RATE / size;
  const sums = [0, 0];
  const weights = [0, 0];
  let above = 0;
  for (let centre = 0; centre <= last; centre += hop) {
    powerSpectrum(data, centre, size, spectrum);
    const half = centre < last / 2 ? 0 : 1;
    // Skip the DC bin: it carries no pitch.
    for (let bin = 1; bin < spectrum.length; bin++) {
      sums[half] += spectrum[bin] * bin * binHz;
      weights[half] += spectrum[bin];
      if (bin * binHz >= PHONE_LOW_HZ) above += spectrum[bin];
    }
  }
  result.earlyHz = weights[0] > 0 ? sums[0] / weights[0] : 0;
  result.lateHz = weights[1] > 0 ? sums[1] / weights[1] : 0;
  const total = weights[0] + weights[1];
  result.centroidHz = total > 0 ? (sums[0] + sums[1]) / total : 0;
  result.phoneShare = total > 0 ? above / total : 0;
  return result;
}

function drawWaveform(data: Float32Array, width: number, scale: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = ROW_H;
  const g = canvas.getContext('2d');
  if (!g) return canvas;
  const mid = ROW_H / 2;
  g.fillStyle = '#26301a';
  g.fillRect(0, mid, width, 1);
  g.fillStyle = '#b9d36a';
  const per = data.length / width;
  for (let x = 0; x < width; x++) {
    let min = 0;
    let max = 0;
    const end = Math.min(data.length, Math.ceil((x + 1) * per));
    for (let i = Math.floor(x * per); i < end; i++) {
      if (data[i] < min) min = data[i];
      if (data[i] > max) max = data[i];
    }
    const top = mid - Math.min(1, max * scale) * mid;
    const bottom = mid - Math.max(-1, min * scale) * mid;
    g.fillRect(x, top, 1, Math.max(1, bottom - top));
  }
  return canvas;
}

function drawSpectrogram(data: Float32Array, samples: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = SPEC_W;
  canvas.height = ROW_H;
  const g = canvas.getContext('2d');
  if (!g || samples <= 0) return canvas;
  const size = fftSizeFor(samples) * 2;
  const bins = size / 2 + 1;
  const columns: Float32Array[] = [];
  let loudest = 1e-12;
  for (let x = 0; x < SPEC_W; x++) {
    const spectrum = new Float32Array(bins);
    powerSpectrum(data, ((x + 0.5) / SPEC_W) * samples, size, spectrum);
    for (let bin = 1; bin < bins; bin++) if (spectrum[bin] > loudest) loudest = spectrum[bin];
    columns.push(spectrum);
  }
  const image = g.createImageData(SPEC_W, ROW_H);
  const octaves = Math.log(SPEC_HIGH_HZ / SPEC_LOW_HZ);
  for (let y = 0; y < ROW_H; y++) {
    // Each pixel row covers a band of frequencies; show the strongest bin inside it.
    const hzTop = SPEC_LOW_HZ * Math.exp(octaves * (1 - y / ROW_H));
    const hzBottom = SPEC_LOW_HZ * Math.exp(octaves * (1 - (y + 1) / ROW_H));
    const binFrom = Math.max(1, Math.floor((hzBottom / SAMPLE_RATE) * size));
    const binTo = Math.min(bins - 1, Math.max(binFrom, Math.ceil((hzTop / SAMPLE_RATE) * size)));
    for (let x = 0; x < SPEC_W; x++) {
      let strongest = 0;
      for (let bin = binFrom; bin <= binTo; bin++) if (columns[x][bin] > strongest) strongest = columns[x][bin];
      const db = 10 * Math.log10(strongest / loudest + 1e-12);
      const v = Math.max(0, Math.min(1, 1 + db / SPEC_RANGE_DB));
      const at = (y * SPEC_W + x) * 4;
      image.data[at] = Math.min(255, v * 3 * 255);
      image.data[at + 1] = Math.max(0, Math.min(255, (v * 3 - 1) * 255));
      image.data[at + 2] = Math.max(0, Math.min(255, (v * 3 - 2) * 255)) + (v > 0 && v < 0.34 ? 60 * v : 0);
      image.data[at + 3] = 255;
    }
  }
  g.putImageData(image, 0, 0);
  return canvas;
}

function cell(row: HTMLTableRowElement, content: string | Node, className = ''): HTMLTableCellElement {
  const td = document.createElement('td');
  if (className) td.className = className;
  if (typeof content === 'string') td.textContent = content;
  else td.appendChild(content);
  row.appendChild(td);
  return td;
}

function resultCell(row: HTMLTableRowElement, problems: string[]): void {
  cell(row, problems.length === 0 ? 'PASS' : `FAIL: ${problems.join('; ')}`, `note ${problems.length === 0 ? 'pass' : 'fail'}`);
}

function within(value: number, range: [number, number]): boolean {
  return value >= range[0] && value <= range[1];
}

function phoneProblem(share: number): string {
  return `only ${(share * 100).toFixed(0)}% of the energy is above ${PHONE_LOW_HZ} Hz: too faint on a phone speaker`;
}

function maxDifference(a: Float32Array, b: Float32Array): number {
  let most = 0;
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i++) most = Math.max(most, Math.abs(a[i] - b[i]));
  return most;
}

const liveAudio = createAudio();
const loopsOn = new Set<string>();

function soundButton(name: string, isLoop: boolean): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = isLoop ? `${name} (loop)` : name;
  button.dataset.sound = name;
  button.addEventListener('click', () => {
    liveAudio.unlock();
    if (!isLoop) {
      liveAudio.play(name);
    } else if (loopsOn.has(name)) {
      loopsOn.delete(name);
      liveAudio.stopLoop(name);
      button.classList.remove('on');
    } else {
      loopsOn.add(name);
      liveAudio.startLoop(name);
      button.classList.add('on');
    }
  });
  return button;
}

function addSoundRow(body: HTMLElement, row: SoundRow, data: Float32Array, expected: string): void {
  const tr = document.createElement('tr');
  cell(tr, soundButton(row.name, row.kind === 'loop'), 'left');
  cell(tr, String(row.layers));
  cell(tr, row.kind === 'loop' ? 'loop' : row.nominal.toFixed(3));
  cell(tr, row.audible.toFixed(3));
  cell(tr, expected);
  cell(tr, row.onset.toFixed(3));
  cell(tr, row.rawPeak.toFixed(3));
  cell(tr, row.peak.toFixed(3));
  cell(tr, row.target.toFixed(2));
  cell(tr, row.rms.toFixed(3));
  cell(tr, row.earlyHz.toFixed(0));
  cell(tr, row.lateHz.toFixed(0));
  cell(tr, (row.phoneShare * 100).toFixed(0));
  const samples = Math.max(1, Math.round(row.audible * SAMPLE_RATE));
  cell(tr, drawWaveform(data.subarray(0, samples), WAVE_W, 1 / Math.max(row.peak, 1e-6)), 'left');
  cell(tr, drawSpectrogram(data, samples), 'left');
  resultCell(tr, row.problems);
  body.appendChild(tr);
}

async function checkOneShot(name: OneShotName, Offline: NonNullable<ReturnType<typeof findOfflineContext>>): Promise<{ row: SoundRow; data: Float32Array }> {
  const def: SoundDef = SOUNDS[name];
  const expect = EXPECT[name];
  const bank = createNoiseBank();
  const rng = seededRandom(1234);
  const buffer = await renderSoundRaw(Offline, def, SAMPLE_RATE, rng, bank);
  const rawPeak = levelSound(buffer, def);
  const data = buffer.getChannelData(0);
  const analysis = analyse(data);
  const nominal = soundDuration(def);
  const problems: string[] = [];

  if (!analysis.finite) problems.push('non-finite samples');
  if (rawPeak < 0.05) problems.push(`silent before levelling (raw peak ${rawPeak.toFixed(4)})`);
  if (analysis.rms < 0.004) problems.push(`silent (rms ${analysis.rms.toFixed(4)})`);
  if (analysis.peak > 0.95) problems.push(`peak ${analysis.peak.toFixed(3)} is too close to clipping`);
  if (Math.abs(analysis.peak - def.volume) > 0.01) problems.push(`peak ${analysis.peak.toFixed(3)} is not the target ${def.volume}`);
  if (!within(analysis.audible, expect.dur)) problems.push(`audible ${analysis.audible.toFixed(3)} s outside ${expect.dur[0]}..${expect.dur[1]}`);
  if (analysis.audible > nominal + AUDIO.renderTail + 0.001) problems.push('audible past its nominal end');
  if (!expect.slowStart && analysis.onset > 0.02) problems.push(`slow onset ${analysis.onset.toFixed(3)} s`);
  if (expect.trend === 'falling' && !(analysis.lateHz < analysis.earlyHz * 0.9)) problems.push('pitch does not fall');
  if (expect.trend === 'rising' && !(analysis.lateHz > analysis.earlyHz * 1.1)) problems.push('pitch does not rise');
  if (expect.centroid && !within(analysis.centroidHz, expect.centroid)) {
    problems.push(`centroid ${analysis.centroidHz.toFixed(0)} Hz outside ${expect.centroid[0]}..${expect.centroid[1]}`);
  }
  if (analysis.phoneShare < PHONE_MIN_SHARE) problems.push(phoneProblem(analysis.phoneShare));
  if (def.variants > 1) {
    // A second render with the next random draws must come out different.
    const other = await renderSoundRaw(Offline, def, SAMPLE_RATE, rng, bank);
    levelSound(other, def);
    if (maxDifference(data, other.getChannelData(0)) < 0.02) problems.push('variants are identical');
  }

  return {
    row: { ...analysis, name, kind: 'one-shot', layers: def.layers.length, nominal, rawPeak, target: def.volume, problems },
    data,
  };
}

async function checkLoop(name: LoopName, Offline: NonNullable<ReturnType<typeof findOfflineContext>>): Promise<{ row: SoundRow; data: Float32Array }> {
  const def: LoopDef = LOOPS[name];
  const expect = LOOP_EXPECT[name];
  const buffer = await renderLoop(Offline, def, LOOP_SECONDS, SAMPLE_RATE, seededRandom(99), createNoiseBank());
  const data = buffer.getChannelData(0);
  const analysis = analyse(data);
  const problems: string[] = [];
  if (!analysis.finite) problems.push('non-finite samples');
  if (analysis.rms < 0.01) problems.push(`silent (rms ${analysis.rms.toFixed(4)})`);
  if (!within(analysis.peak, expect.peak)) problems.push(`peak ${analysis.peak.toFixed(3)} outside ${expect.peak[0]}..${expect.peak[1]}`);
  if (!within(analysis.centroidHz, expect.centroid)) {
    problems.push(`centroid ${analysis.centroidHz.toFixed(0)} Hz outside ${expect.centroid[0]}..${expect.centroid[1]}`);
  }
  if (analysis.phoneShare < PHONE_MIN_SHARE) problems.push(phoneProblem(analysis.phoneShare));
  // A loop must never drop out: every half second has to carry a fair share of the level.
  const window = SAMPLE_RATE / 2;
  for (let from = 0; from + window <= data.length; from += window) {
    let power = 0;
    for (let i = from; i < from + window; i++) power += data[i] * data[i];
    if (Math.sqrt(power / window) < analysis.rms * 0.4) {
      problems.push(`gap at ${(from / SAMPLE_RATE).toFixed(1)} s`);
      break;
    }
  }
  return {
    row: { ...analysis, name, kind: 'loop', layers: def.layers.length, nominal: LOOP_SECONDS, rawPeak: analysis.peak, target: def.volume, problems },
    data,
  };
}

interface MixExpectation {
  peak: [number, number];
  /** Largest share of samples allowed above the clipper's knee, in percent. */
  overKnee: number;
  minPlayed: number;
  /** True when the scenario is meant to overload the engine, so sounds must have been refused. */
  mustDrop: boolean;
}

interface Scenario {
  name: string;
  seconds: number;
  expect: MixExpectation;
  /** Called once per 30 Hz tick. Returns how many one-shots it asked for. */
  tick(audio: GameAudio, tick: number, rng: () => number): number;
}

const ARMY_SHOTS: Array<{ name: OneShotName; chance: number }> = [
  { name: 'rifleShot', chance: 0.1 },
  { name: 'rifleShot', chance: 0.1 },
  { name: 'rifleShot', chance: 0.1 },
  { name: 'rifleShot', chance: 0.1 },
  { name: 'mgShot', chance: 0.5 },
  { name: 'mgShot', chance: 0.5 },
  { name: 'smgShot', chance: 0.4 },
  { name: 'bunkerMg', chance: 0.4 },
];

/** 80 units firing at once across and beyond the screen, with explosions, UI, a sting, thunder and both loops. */
function armyTick(audio: GameAudio, tick: number, rng: () => number): number {
  let requested = 0;
  if (tick === 0) {
    audio.setListener(1000, 1000);
    audio.startLoop('rain');
    audio.startLoop('tankEngine');
  }
  for (let unit = 0; unit < 80; unit++) {
    const shot = ARMY_SHOTS[unit % ARMY_SHOTS.length];
    if (rng() < shot.chance) {
      audio.playAt(shot.name, 200 + unit * 20);
      requested++;
    }
  }
  const x = 400 + rng() * 1200;
  const every: Array<[number, OneShotName]> = [
    [5, 'dirtHit'],
    [7, 'ricochet'],
    [12, 'grenadeExplosion'],
    [25, 'explosionMedium'],
    [25, 'mortarLaunch'],
    [40, 'tankGun'],
    [45, 'explosionLarge'],
    [50, 'rocketLaunch'],
    [55, 'shellWhistle'],
  ];
  for (const [period, name] of every) {
    if (tick % period === period - 1) {
      audio.playAt(name, x);
      requested++;
    }
  }
  const once: Array<[number, OneShotName]> = [
    [10, 'uiClick'],
    [20, 'whistleAdvance'],
    [30, 'thunder'],
    [40, 'unitTrained'],
    [50, 'suppliesDelivered'],
    [60, 'victorySting'],
    [70, 'planeFlyby'],
    [80, 'uiConfirm'],
  ];
  for (const [when, name] of once) {
    if (tick === when) {
      audio.play(name);
      requested++;
    }
  }
  return requested;
}

const SCENARIOS: Scenario[] = [
  {
    name: '80 units firing, explosions, thunder, sting, rain and engine',
    seconds: 4,
    expect: { peak: [0.3, AUDIO.clipCeiling], overKnee: 5, minPlayed: 150, mustDrop: true },
    tick: armyTick,
  },
  {
    name: 'one rifle shot',
    seconds: 0.6,
    expect: { peak: [0.12, 0.6], overKnee: 0, minPlayed: 1, mustDrop: false },
    tick: (audio, tick) => {
      if (tick !== 0) return 0;
      audio.play('rifleShot');
      return 1;
    },
  },
  {
    name: 'one large explosion',
    seconds: 3,
    expect: { peak: [0.4, AUDIO.clipCeiling], overKnee: 3, minPlayed: 1, mustDrop: false },
    tick: (audio, tick) => {
      if (tick !== 0) return 0;
      audio.play('explosionLarge');
      return 1;
    },
  },
  {
    name: 'rain and one UI click',
    seconds: 3,
    expect: { peak: [0.05, 0.5], overKnee: 0, minPlayed: 1, mustDrop: false },
    tick: (audio, tick) => {
      if (tick === 0) audio.startLoop('rain');
      if (tick !== 60) return 0;
      audio.play('uiClick');
      return 1;
    },
  },
];

async function runScenario(
  scenario: Scenario,
  Offline: NonNullable<ReturnType<typeof findOfflineContext>>,
): Promise<{ row: MixRow; data: Float32Array }> {
  const frames = Math.ceil(scenario.seconds * SAMPLE_RATE);
  const ctx = new Offline(2, frames, SAMPLE_RATE);
  const rng = seededRandom(2024);
  const audio = createAudio({ context: ctx, random: seededRandom(7) });
  await audio.whenReady();

  let requested = 0;
  let maxVoices = 0;
  const step = (tick: number): void => {
    requested += scenario.tick(audio, tick, rng);
    maxVoices = Math.max(maxVoices, audio.getStats().voices);
  };
  const problems: string[] = [];
  step(0);
  // The render pauses at every 30 Hz tick so the engine sees time pass exactly as it does in the game.
  for (let tick = 1; tick / 30 < scenario.seconds - 0.05; tick++) {
    ctx.suspend(tick / 30).then(
      () => {
        step(tick);
        return ctx.resume();
      },
      (err: unknown) => problems.push(`suspend failed: ${String(err)}`),
    );
  }
  const buffer = await startRendering(ctx);

  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);
  const loudest = new Float32Array(left.length);
  let power = 0;
  let over = 0;
  let finite = true;
  for (let i = 0; i < left.length; i++) {
    const a = Math.abs(left[i]);
    const b = Math.abs(right[i]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) finite = false;
    loudest[i] = Math.abs(left[i]) >= Math.abs(right[i]) ? left[i] : right[i];
    power += (a * a + b * b) / 2;
    if (a > AUDIO.clipKnee || b > AUDIO.clipKnee) over++;
  }
  const stats = audio.getStats();
  const row: MixRow = {
    name: scenario.name,
    seconds: scenario.seconds,
    peak: peakOf(loudest),
    rms: Math.sqrt(power / Math.max(1, left.length)),
    overKnee: (over / Math.max(1, left.length)) * 100,
    requested,
    played: stats.played,
    dropped: stats.dropped,
    stolen: stats.stolen,
    maxVoices,
    problems,
  };
  const expect = scenario.expect;
  if (!finite) problems.push('non-finite samples');
  if (row.peak >= 1) problems.push(`clips: peak ${row.peak.toFixed(3)}`);
  if (!within(row.peak, [expect.peak[0], expect.peak[1] + 1e-4])) problems.push(`peak ${row.peak.toFixed(3)} outside ${expect.peak[0]}..${expect.peak[1]}`);
  if (row.rms < 0.003) problems.push('silent');
  if (row.overKnee > expect.overKnee) problems.push(`${row.overKnee.toFixed(2)}% of samples in the clipper (limit ${expect.overKnee}%)`);
  if (row.played < expect.minPlayed) problems.push(`only ${row.played} sounds played`);
  if (row.played + row.dropped !== requested) problems.push('played + dropped does not match requested');
  if (row.maxVoices > AUDIO.maxVoices) problems.push(`${row.maxVoices} voices exceeds the cap of ${AUDIO.maxVoices}`);
  if (expect.mustDrop && row.dropped === 0) problems.push('the limiter never refused a sound');
  if (!expect.mustDrop && row.dropped > 0) problems.push(`${row.dropped} sounds refused in a quiet scene`);
  return { row, data: loudest };
}

function addMixRow(body: HTMLElement, row: MixRow, data: Float32Array): void {
  const tr = document.createElement('tr');
  cell(tr, row.name, 'left');
  cell(tr, row.seconds.toFixed(1));
  cell(tr, row.peak.toFixed(3));
  cell(tr, row.rms.toFixed(3));
  cell(tr, row.overKnee.toFixed(2));
  cell(tr, String(row.requested));
  cell(tr, String(row.played));
  cell(tr, String(row.dropped));
  cell(tr, String(row.stolen));
  cell(tr, String(row.maxVoices));
  cell(tr, drawWaveform(data, WAVE_W + SPEC_W, 1), 'left');
  resultCell(tr, row.problems);
  body.appendChild(tr);
}

/** For listening by hand: the army scenario through the live engine. */
function wireArmyButton(): void {
  const button = document.getElementById('army');
  const status = document.getElementById('live');
  if (!button || !status) return;
  let timer = 0;
  button.addEventListener('click', () => {
    liveAudio.unlock();
    window.clearInterval(timer);
    const rng = seededRandom(5);
    let tick = 0;
    timer = window.setInterval(() => {
      armyTick(liveAudio, tick, rng);
      const stats = liveAudio.getStats();
      status.textContent = `voices ${stats.voices}, played ${stats.played}, dropped ${stats.dropped}, stolen ${stats.stolen}, buffers ${stats.rendered}`;
      if (++tick >= 120) {
        window.clearInterval(timer);
        liveAudio.stopLoop('rain');
        liveAudio.stopLoop('tankEngine');
      }
    }, 1000 / 30);
  });
}

async function main(): Promise<void> {
  const summary = document.getElementById('summary');
  const soundBody = document.getElementById('sounds');
  const mixBody = document.getElementById('mixes');
  const scope = window as unknown as Record<string, unknown>;
  const failures: string[] = [];
  const sounds: SoundRow[] = [];
  const mixes: MixRow[] = [];
  try {
    if (!summary || !soundBody || !mixBody) throw new Error('page markup is missing');
    wireArmyButton();
    const Offline = findOfflineContext();
    if (!Offline) throw new Error('OfflineAudioContext is not available in this browser');

    for (const name of ONE_SHOT_NAMES) {
      const { row, data } = await checkOneShot(name, Offline);
      const range = EXPECT[name].dur;
      addSoundRow(soundBody, row, data, `${range[0]}..${range[1]}`);
      sounds.push(row);
    }
    for (const name of LOOP_NAMES) {
      const { row, data } = await checkLoop(name, Offline);
      addSoundRow(soundBody, row, data, 'continuous');
      sounds.push(row);
    }
    for (const scenario of SCENARIOS) {
      const { row, data } = await runScenario(scenario, Offline);
      addMixRow(mixBody, row, data);
      mixes.push(row);
    }
    for (const row of [...sounds, ...mixes]) {
      for (const problem of row.problems) failures.push(`${row.name}: ${problem}`);
    }
  } catch (err) {
    failures.push(`preview crashed: ${err instanceof Error ? err.message : String(err)}`);
  }

  const ok = failures.length === 0;
  if (summary) {
    summary.textContent = ok
      ? `ALL PASS: ${sounds.length} sounds and ${mixes.length} mix scenarios rendered at ${SAMPLE_RATE} Hz.`
      : `${failures.length} FAILED of ${sounds.length} sounds and ${mixes.length} mix scenarios.`;
    summary.className = ok ? 'pass' : 'fail';
  }
  for (const failure of failures) console.error(`audio-preview: ${failure}`);
  scope.__audioReport = { ok, failures, sampleRate: SAMPLE_RATE, sounds, mixes };
  scope.__ready = true;
}

void main();
