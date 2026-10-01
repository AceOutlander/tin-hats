/**
 * Turns sound definitions (src/data/sounds.ts) into WebAudio node graphs.
 *
 * The builders only use BaseAudioContext, so the same code feeds the live
 * AudioContext, the OfflineAudioContext that pre-renders every one-shot, and
 * the dev preview page.
 */
import { AUDIO, type FilterDef, type LfoDef, type LoopDef, type NoiseColor, type SoundDef } from '../data/sounds';
import { makeNoise } from './dsp';

/** Looping noise buffers, made once per colour and shared by every context of the same sample rate. */
export interface NoiseBank {
  get(ctx: BaseAudioContext, color: NoiseColor): AudioBuffer;
}

export function createNoiseBank(): NoiseBank {
  const cache = new Map<NoiseColor, AudioBuffer>();
  return {
    get(ctx, color) {
      const cached = cache.get(color);
      if (cached && cached.sampleRate === ctx.sampleRate) return cached;
      const length = Math.round(AUDIO.noiseSeconds * ctx.sampleRate);
      const data = makeNoise(color, length, Math.round(AUDIO.noiseCrossfade * ctx.sampleRate));
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      buffer.getChannelData(0).set(data);
      cache.set(color, buffer);
      return buffer;
    },
  };
}

function clampFreq(freq: number): number {
  return Math.min(AUDIO.freqMax, Math.max(AUDIO.freqMin, freq));
}

/** A value in -1..1 from a 0..1 generator. */
function spread(rng: () => number): number {
  return rng() * 2 - 1;
}

function startNoise(
  ctx: BaseAudioContext,
  bank: NoiseBank,
  color: NoiseColor,
  rate: number,
  start: number,
  rng: () => number,
): AudioBufferSourceNode {
  const source = ctx.createBufferSource();
  const buffer = bank.get(ctx, color);
  source.buffer = buffer;
  source.loop = true;
  source.playbackRate.value = rate;
  // A random place in the table, so two bursts never share the same grain.
  source.start(start, Math.min(0.999, Math.max(0, rng())) * buffer.duration);
  return source;
}

function addFilter(
  ctx: BaseAudioContext,
  input: AudioNode,
  def: FilterDef,
  freqMul: number,
  start: number,
  stop: number,
): AudioNode {
  const filter = ctx.createBiquadFilter();
  filter.type = def.kind;
  filter.Q.value = def.q;
  const from = clampFreq(def.freq * freqMul);
  filter.frequency.value = from;
  if (def.freqEnd !== undefined && stop > start) {
    filter.frequency.setValueAtTime(from, start);
    const sweepEnd = def.sweep !== undefined ? start + def.sweep : stop;
    filter.frequency.exponentialRampToValueAtTime(clampFreq(def.freqEnd * freqMul), sweepEnd);
  }
  input.connect(filter);
  return filter;
}

/** Starts a sine LFO feeding `target` through a gain of `amount`. `stop` < 0 means it runs until stopped. */
function addLfo(
  ctx: BaseAudioContext,
  target: AudioParam,
  rate: number,
  amount: number,
  start: number,
  stop: number,
  sources: AudioScheduledSourceNode[] | null,
): void {
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = rate;
  const depth = ctx.createGain();
  depth.gain.value = amount;
  lfo.connect(depth);
  depth.connect(target);
  lfo.start(start);
  if (stop >= 0) lfo.stop(stop);
  if (sources) sources.push(lfo);
}

/** Tremolo stage: the level swings between 1 and 1 - depth. */
function addTremolo(
  ctx: BaseAudioContext,
  input: AudioNode,
  def: LfoDef,
  start: number,
  stop: number,
  sources: AudioScheduledSourceNode[] | null,
): AudioNode {
  const stage = ctx.createGain();
  stage.gain.value = 1 - def.depth / 2;
  addLfo(ctx, stage.gain, def.rate, def.depth / 2, start, stop, sources);
  input.connect(stage);
  return stage;
}

/**
 * Schedules every layer of a one-shot sound into `dest`, starting at `t0`.
 * `pitch` scales every frequency. Sources are pushed onto `sources` when given,
 * so a voice can be cut short. Returns the time the last layer ends.
 */
export function buildOneShot(
  ctx: BaseAudioContext,
  def: SoundDef,
  dest: AudioNode,
  t0: number,
  rng: () => number,
  bank: NoiseBank,
  pitch: number,
  sources: AudioScheduledSourceNode[] | null,
): number {
  let end = t0;
  const layers = def.layers;
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    let at = layer.at;
    let level = layer.gain;
    let freqMul = pitch;
    const jitter = layer.jitter;
    if (jitter) {
      if (jitter.at) at = Math.max(0, at + spread(rng) * jitter.at);
      if (jitter.gain) level *= 1 + spread(rng) * jitter.gain;
      if (jitter.freq) freqMul *= 1 + spread(rng) * jitter.freq;
    }
    const start = t0 + at;
    const attackEnd = start + Math.max(AUDIO.minAttack, layer.attack);
    const holdEnd = attackEnd + layer.hold;
    const stop = holdEnd + layer.decay;
    const sourceStop = stop + AUDIO.stopPad;

    let source: AudioScheduledSourceNode;
    if (layer.src === 'tone') {
      const osc = ctx.createOscillator();
      osc.type = layer.wave;
      const from = clampFreq(layer.freq * freqMul);
      osc.frequency.setValueAtTime(from, start);
      if (layer.freqEnd !== undefined) {
        const sweepStart = start + (layer.sweepDelay ?? 0);
        const sweepEnd = layer.sweep !== undefined ? sweepStart + layer.sweep : stop;
        if (sweepStart > start) osc.frequency.setValueAtTime(from, sweepStart);
        osc.frequency.exponentialRampToValueAtTime(clampFreq(layer.freqEnd * freqMul), sweepEnd);
      }
      if (layer.detune) osc.detune.value = layer.detune;
      if (layer.vibrato) {
        addLfo(ctx, osc.frequency, layer.vibrato.rate, layer.vibrato.depth * freqMul, start, sourceStop, sources);
      }
      osc.start(start);
      source = osc;
    } else {
      source = startNoise(ctx, bank, layer.color, pitch, start, rng);
    }
    source.stop(sourceStop);
    if (sources) sources.push(source);

    let node: AudioNode = source;
    if (layer.filter) node = addFilter(ctx, node, layer.filter, freqMul, start, stop);

    const envelope = ctx.createGain();
    const gain = envelope.gain;
    gain.value = 0;
    gain.setValueAtTime(0, start);
    gain.linearRampToValueAtTime(level, attackEnd);
    if (holdEnd > attackEnd) gain.setValueAtTime(level, holdEnd);
    if (layer.decayShape === 'lin') gain.linearRampToValueAtTime(0, stop);
    else gain.exponentialRampToValueAtTime(level * AUDIO.decayFloor, stop);
    node.connect(envelope);
    node = envelope;

    if (layer.tremolo) node = addTremolo(ctx, node, layer.tremolo, start, sourceStop, sources);
    node.connect(dest);
    if (stop > end) end = stop;
  }
  return end;
}

/** Starts every layer of a loop into `dest` at `t0`. The sources run until the caller stops them. */
export function buildLoop(
  ctx: BaseAudioContext,
  def: LoopDef,
  dest: AudioNode,
  t0: number,
  rng: () => number,
  bank: NoiseBank,
  sources: AudioScheduledSourceNode[],
): void {
  const layers = def.layers;
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    let source: AudioScheduledSourceNode;
    if (layer.src === 'tone') {
      const osc = ctx.createOscillator();
      osc.type = layer.wave;
      osc.frequency.value = clampFreq(layer.freq);
      if (layer.vibrato) addLfo(ctx, osc.frequency, layer.vibrato.rate, layer.vibrato.depth, t0, -1, sources);
      osc.start(t0);
      source = osc;
    } else {
      source = startNoise(ctx, bank, layer.color, 1, t0, rng);
    }
    sources.push(source);

    let node: AudioNode = source;
    if (layer.filter) node = addFilter(ctx, node, layer.filter, 1, t0, t0);
    const level = ctx.createGain();
    level.gain.value = layer.gain;
    node.connect(level);
    node = level;
    if (layer.tremolo) node = addTremolo(ctx, node, layer.tremolo, t0, -1, sources);
    node.connect(dest);
  }
}
