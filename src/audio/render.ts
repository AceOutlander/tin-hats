/**
 * Renders sound definitions to AudioBuffers through OfflineAudioContext.
 * The engine uses this once per sound after the first user gesture; the dev
 * preview page uses it to measure every sound.
 */
import { AUDIO, soundDuration, type LoopDef, type SoundDef } from '../data/sounds';
import { normalise } from './dsp';
import { buildLoop, buildOneShot, type NoiseBank } from './synth';

export type OfflineContextCtor = new (channels: number, length: number, sampleRate: number) => OfflineAudioContext;

/** The browser's OfflineAudioContext constructor (prefixed on old Safari), or null in Node and old browsers. */
export function findOfflineContext(): OfflineContextCtor | null {
  const scope = globalThis as unknown as {
    OfflineAudioContext?: OfflineContextCtor;
    webkitOfflineAudioContext?: OfflineContextCtor;
  };
  return scope.OfflineAudioContext ?? scope.webkitOfflineAudioContext ?? null;
}

/** Runs an offline render to completion. Handles both the promise form and the old event form of startRendering. */
export function startRendering(ctx: OfflineAudioContext): Promise<AudioBuffer> {
  return new Promise<AudioBuffer>((resolve, reject) => {
    ctx.oncomplete = (event) => resolve(event.renderedBuffer);
    try {
      const pending = ctx.startRendering() as Promise<AudioBuffer> | undefined;
      if (pending && typeof pending.then === 'function') pending.then(resolve, reject);
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

/** One mono render of a one-shot sound exactly as its layers sum, before any levelling. */
export function renderSoundRaw(
  Offline: OfflineContextCtor,
  def: SoundDef,
  sampleRate: number,
  rng: () => number,
  bank: NoiseBank,
): Promise<AudioBuffer> {
  const frames = Math.max(1, Math.ceil((soundDuration(def) + AUDIO.renderTail) * sampleRate));
  const ctx = new Offline(1, frames, sampleRate);
  buildOneShot(ctx, def, ctx.destination, 0, rng, bank, 1, null);
  return startRendering(ctx);
}

/** Scales a raw render so its peak is the sound's `volume` and fades the very end. Returns the peak before scaling. */
export function levelSound(buffer: AudioBuffer, def: SoundDef): number {
  return normalise(buffer.getChannelData(0), def.volume, Math.round(AUDIO.renderFadeOut * buffer.sampleRate));
}

/** A one-shot sound rendered and levelled, ready to play. */
export function renderSound(
  Offline: OfflineContextCtor,
  def: SoundDef,
  sampleRate: number,
  rng: () => number,
  bank: NoiseBank,
): Promise<AudioBuffer> {
  return renderSoundRaw(Offline, def, sampleRate, rng, bank).then((buffer) => {
    levelSound(buffer, def);
    return buffer;
  });
}

/** `seconds` of a loop at its own volume, without fades. Only the preview page needs this. */
export function renderLoop(
  Offline: OfflineContextCtor,
  def: LoopDef,
  seconds: number,
  sampleRate: number,
  rng: () => number,
  bank: NoiseBank,
): Promise<AudioBuffer> {
  const ctx = new Offline(1, Math.max(1, Math.ceil(seconds * sampleRate)), sampleRate);
  const master = ctx.createGain();
  master.gain.value = def.volume;
  master.connect(ctx.destination);
  buildLoop(ctx, def, master, 0, rng, bank, []);
  return startRendering(ctx);
}
