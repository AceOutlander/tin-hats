/**
 * Battle sounds rendered through the real audio engine (its buses, voice pool, compressor, master gain and soft
 * clipper) into an OfflineAudioContext, and measured: peak, K-weighted loudness and the compressor's gain reduction.
 * Used by tools/battle-loudness.ts to compare the engine of one source tree with another's (?root=/path/to/tree/),
 * at the default slider levels (?sliders=default) or with every slider at full (?sliders=full).
 *
 * Only engine calls that every version since the three buses has are used: createAudio, play, playAt, setListener,
 * startLoop, setVolume, whenReady, and for the title's own sounds (?menu=1) startRainBed, tickRainBed, thunder and the
 * music calls.
 */
import type { GameAudio } from '../src/audio';
import { seededRandom } from '../src/audio/dsp';
import { db, loudnessOf, peakOf } from '../src/audio/music';
import { AUDIO } from '../src/data/sounds';

type CreateAudio = (options: { context?: BaseAudioContext; random?: () => number }) => GameAudio;

export interface BattleMeasure {
  name: string;
  peakDb: number;
  /** Gated integrated and loudest momentary loudness (LUFS) of the mid channel over the measured window. */
  lufs: number;
  momentaryMax: number;
  /** The engine's compressor: most and mean gain reduction (dB) over the measured window. */
  maxReductionDb: number;
  meanReductionDb: number;
  /** Share (%) of output samples past the soft clipper's knee: where it is bending the signal. */
  overKnee: number;
}

const RATE = 48000;
const AT = 2;
const PROBE = 0.05;

interface Scenario {
  name: string;
  seconds: number;
  /** Measured window (s). */
  from: number;
  to: number;
  /** Calls into the engine at time `t` (suspend points, seconds). */
  events: { t: number; run: (audio: GameAudio) => void }[];
}

const SHOTS = ['rifleShot', 'mgShot', 'smgShot', 'bunkerMg', 'sniperShot', 'tankGun', 'grenadeExplosion'];

function single(name: string, sound: string, seconds: number, volume?: number): Scenario {
  return { name, seconds, from: AT, to: seconds, events: [{ t: AT, run: (a) => a.play(sound, volume === undefined ? undefined : { volume }) }] };
}

function scenarios(): Scenario[] {
  const burst: Scenario['events'] = [];
  for (let i = 0; i < 10; i++) burst.push({ t: AT + i * 0.08 + 0.003, run: (a) => a.play('mgShot') });
  // A whole army firing: 80 shots a tick at 30 ticks a second for 6 s across the screen and beyond, a big blast every half second.
  const army: Scenario['events'] = [{ t: 1.003, run: (a) => a.setListener(2000, 1000) }];
  const ticks = 6 * 30;
  for (let k = 0; k < ticks; k++) {
    const t = AT + k / 30 + 0.003;
    army.push({
      t,
      run: (a) => {
        for (let u = 0; u < 80; u++) a.playAt(SHOTS[(u + k) % SHOTS.length], 1500 + u * 12);
        if (k % 15 === 0) a.playAt('explosionLarge', 1800 + ((k * 37) % 400));
      },
    });
  }
  return [
    single('rifle shot', 'rifleShot', 4),
    { name: 'machine-gun burst', seconds: 4, from: AT, to: 4, events: burst },
    single('large explosion', 'explosionLarge', 6),
    single('tank gun', 'tankGun', 5),
    single('UI click', 'uiClick', 3),
    { name: 'battle rain loop', seconds: 14, from: 5, to: 14, events: [{ t: 1.003, run: (a) => a.startLoop('rain', 1) }] },
    single('battle thunder', 'thunder', 10, 1),
    single('victory sting', 'victorySting', 6),
    single('defeat sting', 'defeatSting', 6),
    { name: 'army of 80 firing', seconds: 9, from: AT, to: AT + 6, events: army },
  ];
}

/** The title's own sounds through the engine (?menu=1): they have their own levels and must not move with the battle's. */
function menuScenarios(): Scenario[] {
  const bed: Scenario['events'] = [{ t: 0.503, run: (a) => a.startRainBed() }];
  for (let t = 0.6; t < 12; t += 0.1) bed.push({ t: t + 0.0013, run: (a) => a.tickRainBed() });
  return [
    { name: 'menu rain bed', seconds: 12, from: 4, to: 12, events: bed },
    { name: 'menu thunder', seconds: 10, from: AT, to: 10, events: [{ t: AT, run: (a) => void a.thunder(0.725, 4) }] },
    { name: 'menu music', seconds: 20, from: 5, to: 20, events: [] },
  ];
}

async function measure(create: CreateAudio, s: Scenario, full: boolean): Promise<BattleMeasure> {
  const ctx = new OfflineAudioContext(2, Math.round(s.seconds * RATE), RATE);
  // Keep hold of the engine's compressor to read its gain reduction.
  let compressor: DynamicsCompressorNode | null = null;
  const make = ctx.createDynamicsCompressor.bind(ctx);
  ctx.createDynamicsCompressor = () => {
    compressor = make();
    return compressor;
  };
  const audio = create({ context: ctx, random: seededRandom(1944) });
  await audio.whenReady();
  if (s.name === 'menu music') {
    // Asked for first, then rendered once in the background: it starts (fading in from the top) when the render is done.
    audio.startMusic('menu');
    audio.prepareMusic('menu');
    while (audio.musicStats().render === 'rendering') await new Promise((ok) => setTimeout(ok, 200));
  }
  if (full) for (const bus of ['music', 'ambience', 'sfx'] as const) audio.setVolume(bus, 1);
  const reductions: number[] = [];
  const points = new Map<number, (() => void)[]>();
  const at = (t: number, fn: () => void): void => {
    const q = Math.round((t * RATE) / 128);
    const list = points.get(q) ?? [];
    list.push(fn);
    points.set(q, list);
  };
  for (const e of s.events) at(e.t, () => e.run(audio));
  for (let t = s.from + PROBE / 2; t < s.to; t += PROBE) {
    at(t, () => {
      if (compressor) reductions.push(Math.abs(compressor.reduction));
    });
  }
  for (const [q, fns] of points) {
    // A suspend must fall inside the render.
    if (q * 128 >= ctx.length) continue;
    void ctx.suspend((q * 128) / RATE).then(() => {
      for (const fn of fns) fn();
      void ctx.resume();
    });
  }
  const out = await ctx.startRendering();
  const l = out.getChannelData(0);
  const r = out.getChannelData(1);
  const a = Math.round(s.from * RATE);
  const b = Math.min(l.length, Math.round(s.to * RATE));
  const mid = new Float32Array(b - a);
  let over = 0;
  for (let i = a; i < b; i++) {
    mid[i - a] = (l[i] + r[i]) / 2;
    if (Math.abs(l[i]) > AUDIO.clipKnee || Math.abs(r[i]) > AUDIO.clipKnee) over++;
  }
  const loud = loudnessOf(mid, RATE);
  return {
    name: s.name,
    peakDb: db(Math.max(peakOf(l, a, b), peakOf(r, a, b))),
    lufs: loud.integrated,
    momentaryMax: loud.momentaryMax,
    maxReductionDb: reductions.length > 0 ? Math.max(...reductions) : 0,
    meanReductionDb: reductions.length > 0 ? reductions.reduce((x, y) => x + y, 0) / reductions.length : 0,
    overKnee: (100 * over) / Math.max(1, b - a),
  };
}

async function main(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const root = params.get('root') ?? '/';
  const full = params.get('sliders') === 'full';
  document.getElementById('what')?.replaceChildren(`engine from ${root}, sliders ${full ? 'all at full' : 'at their defaults'}`);
  const mod = (await import(/* @vite-ignore */ `${root}src/audio/index.ts`)) as { createAudio: CreateAudio };
  const results: BattleMeasure[] = [];
  const list = params.get('menu') === '1' ? menuScenarios() : scenarios();
  for (const s of list) results.push(await measure(mod.createAudio, s, full));
  const table = document.getElementById('out');
  if (table) {
    table.innerHTML = '<tr><th>sound</th><th>peak dB</th><th>LUFS</th><th>momentary</th><th>max GR dB</th><th>mean GR dB</th></tr>';
    for (const m of results) {
      const row = document.createElement('tr');
      for (const v of [m.name, m.peakDb.toFixed(2), m.lufs.toFixed(2), m.momentaryMax.toFixed(2), m.maxReductionDb.toFixed(2), m.meanReductionDb.toFixed(2)]) {
        const td = document.createElement('td');
        td.textContent = v;
        row.append(td);
      }
      table.append(row);
    }
  }
  Reflect.set(window, '__battle', results);
  Reflect.set(window, '__ready', true);
}

main().catch((err: unknown) => {
  document.getElementById('what')?.replaceChildren(`Failed: ${String(err)}`);
  Reflect.set(window, '__battleError', String(err));
  Reflect.set(window, '__ready', true);
});
