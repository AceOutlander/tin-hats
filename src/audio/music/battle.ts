/**
 * Battle tracks (src/data/musicTracks): reading the layered format and rendering it piece by piece. A piece is one
 * layer of one section, or a sting; each is rendered in its own OfflineAudioContext, so the work is cut into small
 * chunks that the engine awaits one after another between frames (src/audio/engine.ts), and the first section's build
 * layer is ready long before the rest. Every piece keeps `tail` seconds past its end: the player starts the next
 * section on the bar line while the last one's tail is still ringing.
 */
import type { BattleInstrument, BattleTrackDef, MusicLayer, MusicPart } from '../../data/musicBattle';
import { MUSIC_BATTLE } from '../../data/musicBattle';
import { seededRandom } from '../dsp';
import { startRendering, type OfflineContextCtor } from '../render';
import { createNoiseBank, type NoiseBank } from '../synth';
import { makeImpulse, playAnvil, playBell, playBrass, playHand, playHorn, playPad, playSnare, playStrings, playTimpani } from './instruments';

export type StingName = 'victory' | 'defeat';

/** One renderable piece of a battle track. */
export interface BattlePiece {
  /** Section index, or -1 for a sting. */
  section: number;
  layer: MusicLayer | null;
  sting: StingName | null;
}

export function secondsPerBeat(def: BattleTrackDef): number {
  return 60 / def.bpm;
}

export function barSeconds(def: BattleTrackDef): number {
  return def.beatsPerBar * secondsPerBeat(def);
}

export function sectionSeconds(def: BattleTrackDef, section: number): number {
  return def.sections[section].bars * barSeconds(def);
}

/** The layers this track really has: build, combat and tense always; prep only when every section writes one. */
export function trackLayers(def: BattleTrackDef): MusicLayer[] {
  const out: MusicLayer[] = ['build', 'combat', 'tense'];
  if (def.sections.length > 0 && def.sections.every((s) => s.layers.prep !== undefined)) out.push('prep');
  return out;
}

/** The layer that sounds when `layer` is asked for: a track with no prep layer plays build in its place. */
export function resolveLayer(def: BattleTrackDef, layer: MusicLayer): MusicLayer {
  if (layer === 'prep' && !trackLayers(def).includes('prep')) return 'build';
  return layer;
}

/** The section the music starts on: the first 'intro', else the first section. */
export function introSection(def: BattleTrackDef): number {
  const i = def.sections.findIndex((s) => s.role === 'intro');
  return i >= 0 ? i : 0;
}

/**
 * Every piece in the order it is rendered: the opening section's layers (build first, so it can start alone on a slow
 * phone), then both stings, then the other sections, each build first.
 */
export function battlePieces(def: BattleTrackDef): BattlePiece[] {
  const layers = trackLayers(def);
  const first = introSection(def);
  const out: BattlePiece[] = [];
  const section = (i: number): void => {
    for (const layer of layers) out.push({ section: i, layer, sting: null });
  };
  section(first);
  out.push({ section: -1, layer: null, sting: 'victory' });
  out.push({ section: -1, layer: null, sting: 'defeat' });
  def.sections.forEach((_, i) => {
    if (i !== first) section(i);
  });
  return out;
}

export function pieceParts(def: BattleTrackDef, piece: BattlePiece): readonly MusicPart[] {
  if (piece.sting) return def.stings[piece.sting].parts;
  const layers = def.sections[piece.section].layers;
  const layer = piece.layer ?? 'build';
  return (layer === 'prep' ? layers.prep : layers[layer]) ?? layers.build;
}

/** Seconds of music in a piece (without its tail). */
export function pieceSeconds(def: BattleTrackDef, piece: BattlePiece): number {
  return piece.sting ? def.stings[piece.sting].beats * secondsPerBeat(def) : sectionSeconds(def, piece.section);
}

/** Frames a piece's buffer holds at `rate`, tail included. */
export function pieceFrames(def: BattleTrackDef, piece: BattlePiece, rate: number = MUSIC_BATTLE.render.sampleRate): number {
  return Math.ceil((pieceSeconds(def, piece) + MUSIC_BATTLE.render.tail) * rate);
}

/** Bytes of Float32 samples the whole track holds once rendered (mono). */
export function trackBytes(def: BattleTrackDef, rate: number = MUSIC_BATTLE.render.sampleRate): number {
  let frames = 0;
  for (const p of battlePieces(def)) frames += pieceFrames(def, p, rate);
  return frames * 4;
}

/** Seconds of distinct material: every layer of every section (stings not counted). */
export function distinctSeconds(def: BattleTrackDef): number {
  let s = 0;
  for (let i = 0; i < def.sections.length; i++) s += sectionSeconds(def, i) * trackLayers(def).length;
  return s;
}

/** The reverb's impulse, made once per track and rate (it is the same room for every piece). */
const impulses = new WeakMap<BattleTrackDef, Map<number, AudioBuffer>>();

function impulseFor(ctx: BaseAudioContext, def: BattleTrackDef): AudioBuffer {
  let byRate = impulses.get(def);
  if (!byRate) {
    byRate = new Map();
    impulses.set(def, byRate);
  }
  let buffer = byRate.get(ctx.sampleRate);
  if (!buffer) {
    buffer = makeImpulse(ctx, def.reverb, 1);
    byRate.set(ctx.sampleRate, buffer);
  }
  return buffer;
}

/** Build a piece's notes into `ctx`: instruments on their buses, the buses into the dry mix and the reverb. */
export function buildBattlePiece(ctx: BaseAudioContext, out: AudioNode, def: BattleTrackDef, parts: readonly MusicPart[], bank: NoiseBank, seed: number): void {
  const rng = seededRandom(seed);
  const top = ctx.createBiquadFilter();
  top.type = 'lowpass';
  top.frequency.value = Math.min(def.mix.lowpass, ctx.sampleRate * 0.45);
  top.Q.value = 0.5;
  const master = ctx.createGain();
  master.gain.value = def.gain;
  top.connect(master);
  master.connect(out);
  const reverb = ctx.createConvolver();
  reverb.normalize = true;
  reverb.buffer = impulseFor(ctx, def);
  const wet = ctx.createGain();
  wet.gain.value = def.mix.reverb;
  reverb.connect(wet);
  wet.connect(top);
  const buses = new Map<BattleInstrument, AudioNode>();
  const bus = (name: BattleInstrument): AudioNode => {
    const have = buses.get(name);
    if (have) return have;
    const input = ctx.createGain();
    const dry = ctx.createGain();
    dry.gain.value = def.mix[name].dry;
    const send = ctx.createGain();
    send.gain.value = def.mix[name].send;
    input.connect(dry);
    dry.connect(top);
    input.connect(send);
    send.connect(reverb);
    buses.set(name, input);
    return input;
  };
  const spb = secondsPerBeat(def);
  const I = def.instruments;
  const H = def.humanize;
  const human = (t: number): number => Math.max(0, t + (rng() * 2 - 1) * H.time);
  const velocity = (v: number): number => Math.max(0.05, Math.min(1, v * (1 + (rng() * 2 - 1) * H.velocity)));
  for (const p of parts) {
    const dest = bus(p.inst);
    for (const e of p.events) {
      const at = human(e.at * spb);
      const len = Math.max(0, e.len * spb);
      const vel = velocity(e.vel);
      const art = e.art ?? '';
      switch (p.inst) {
        case 'strings':
          playStrings(ctx, dest, at, len, e.note, vel, art || 'short', I.strings, bank, rng);
          break;
        case 'brass':
          playBrass(ctx, dest, at, len, e.note, vel, art || 'long', I.brass);
          break;
        case 'horn':
          playHorn(ctx, dest, at, len, e.note, vel, I.horn, bank, rng);
          break;
        case 'pad':
          // Chords keep their written time: the pad swells across the bar line, it does not stumble.
          playPad(ctx, dest, e.at * spb, len, e.note, I.pad.level * vel, I.pad);
          break;
        case 'timpani':
          playTimpani(ctx, dest, at, len, e.note, vel, art || 'hit', I.timpani, bank, rng);
          break;
        case 'snare':
          playSnare(ctx, dest, at, len, vel, art || 'hit', I.snare, bank, rng);
          break;
        case 'hand':
          playHand(ctx, dest, at, vel, art || 'dum', I.hand, bank, rng);
          break;
        case 'bell':
          playBell(ctx, dest, at, e.note, vel, I.bell, bank, rng);
          break;
        case 'anvil':
          playAnvil(ctx, dest, at, e.note, vel, I.anvil, bank, rng);
          break;
      }
    }
  }
}

export interface RenderedPiece {
  piece: BattlePiece;
  buffer: AudioBuffer;
  /** Main-thread milliseconds building the graph, and the whole render's wall-clock milliseconds. */
  buildMs: number;
  renderMs: number;
  peak: number;
}

/** Render one piece. Rejects when the browser cannot render; the engine then carries on without battle music. */
export async function renderBattlePiece(def: BattleTrackDef, piece: BattlePiece, Offline: OfflineContextCtor, rate: number, now: () => number = () => performance.now(), bank: NoiseBank = createNoiseBank()): Promise<RenderedPiece> {
  const started = now();
  const ctx = new Offline(1, pieceFrames(def, piece, rate), rate);
  const index = battlePieces(def).findIndex((p) => p.section === piece.section && p.layer === piece.layer && p.sting === piece.sting);
  buildBattlePiece(ctx, ctx.destination, def, pieceParts(def, piece), bank, def.seed + 7919 * (index + 1));
  const buildMs = now() - started;
  const buffer = await startRendering(ctx);
  const data = buffer.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < data.length; i++) {
    const a = Math.abs(data[i]);
    if (a > peak) peak = a;
  }
  return { piece, buffer, buildMs, renderMs: now() - started, peak };
}
