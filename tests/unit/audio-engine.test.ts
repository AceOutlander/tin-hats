import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAudio, LOOP_NAMES, ONE_SHOT_NAMES, SOUND_NAMES, type GameAudio } from '../../src/audio';
import { AUDIO, SOUNDS, soundDuration } from '../../src/data/sounds';

/**
 * A stand-in for the WebAudio graph that records what the engine asks of it.
 * It makes no sound; it lets the voice limiter, rate limiter and loop handling
 * run in Node with a clock the test controls.
 */
class FakeParam {
  value = 0;
  events: Array<[string, number, number]> = [];
  setValueAtTime(value: number, time: number): this {
    this.value = value;
    this.events.push(['set', value, time]);
    return this;
  }
  linearRampToValueAtTime(value: number, time: number): this {
    this.events.push(['linear', value, time]);
    return this;
  }
  exponentialRampToValueAtTime(value: number, time: number): this {
    this.events.push(['exp', value, time]);
    return this;
  }
  setTargetAtTime(value: number, time: number): this {
    this.events.push(['target', value, time]);
    return this;
  }
  cancelScheduledValues(time: number): this {
    this.events.push(['cancel', 0, time]);
    return this;
  }
  last(kind: string): [string, number, number] | undefined {
    for (let i = this.events.length - 1; i >= 0; i--) if (this.events[i][0] === kind) return this.events[i];
    return undefined;
  }
}

class FakeNode {
  readonly kind: string;
  outputs: unknown[] = [];
  started: number | null = null;
  stopped: number | null = null;
  buffer: FakeBuffer | null = null;
  loop = false;
  type = '';
  curve: Float32Array | null = null;
  readonly gain = new FakeParam();
  readonly pan = new FakeParam();
  readonly frequency = new FakeParam();
  readonly detune = new FakeParam();
  readonly Q = new FakeParam();
  readonly playbackRate = new FakeParam();
  readonly threshold = new FakeParam();
  readonly knee = new FakeParam();
  readonly ratio = new FakeParam();
  readonly attack = new FakeParam();
  readonly release = new FakeParam();
  constructor(kind: string) {
    this.kind = kind;
    this.gain.value = 1;
    this.playbackRate.value = 1;
  }
  connect(target: unknown): void {
    this.outputs.push(target);
  }
  disconnect(): void {
    this.outputs.length = 0;
  }
  start(when = 0): void {
    this.started = when;
  }
  stop(when = 0): void {
    this.stopped = when;
  }
}

class FakeBuffer {
  readonly sampleRate: number;
  readonly length: number;
  readonly duration: number;
  private readonly data: Float32Array;
  constructor(length: number, sampleRate: number) {
    this.length = length;
    this.sampleRate = sampleRate;
    this.duration = length / sampleRate;
    this.data = new Float32Array(length);
  }
  getChannelData(): Float32Array {
    return this.data;
  }
}

class FakeContext {
  static created: FakeContext[] = [];
  currentTime = 0;
  sampleRate = 8000;
  state = 'suspended';
  destination = new FakeNode('destination');
  nodes: FakeNode[] = [];
  suspendCalls = 0;
  resumeCalls = 0;
  constructor() {
    FakeContext.created.push(this);
  }
  private make(kind: string): FakeNode {
    const node = new FakeNode(kind);
    this.nodes.push(node);
    return node;
  }
  createGain(): FakeNode {
    return this.make('gain');
  }
  createStereoPanner(): FakeNode {
    const node = this.make('panner');
    node.pan.value = 0;
    return node;
  }
  createDynamicsCompressor(): FakeNode {
    return this.make('compressor');
  }
  createWaveShaper(): FakeNode {
    return this.make('shaper');
  }
  createBiquadFilter(): FakeNode {
    return this.make('filter');
  }
  createOscillator(): FakeNode {
    return this.make('oscillator');
  }
  createBufferSource(): FakeNode {
    return this.make('bufferSource');
  }
  createBuffer(_channels: number, length: number, sampleRate: number): FakeBuffer {
    return new FakeBuffer(length, sampleRate);
  }
  suspend(): Promise<void> {
    this.suspendCalls++;
    this.state = 'suspended';
    return Promise.resolve();
  }
  resume(): Promise<void> {
    this.resumeCalls++;
    this.state = 'running';
    return Promise.resolve();
  }
  count(kind: string): number {
    return this.nodes.filter((node) => node.kind === kind).length;
  }
  /** Sources (oscillators and noise) that have been started and not yet stopped at the current time. */
  sounding(): FakeNode[] {
    return this.nodes.filter(
      (node) => node.started !== null && (node.stopped === null || node.stopped > this.currentTime),
    );
  }
}

function withFake(options: { muted?: boolean; random?: () => number } = {}): { audio: GameAudio; ctx: FakeContext } {
  const ctx = new FakeContext();
  const audio = createAudio({ ...options, context: ctx as unknown as BaseAudioContext, random: options.random ?? (() => 0.5) });
  return { audio, ctx };
}

function exerciseEverything(audio: GameAudio): void {
  audio.unlock();
  audio.setListener(500, 1000);
  for (const name of SOUND_NAMES) {
    audio.play(name);
    audio.play(name, { pan: -1, volume: 0.5, pitch: 1.2 });
    audio.playAt(name, 1234);
    audio.playAt(name, -400, { volume: 2, pitch: 0.7 });
    audio.startLoop(name);
    audio.startLoop(name, 0.4);
    audio.stopLoop(name);
  }
  audio.play('no such sound');
  audio.playAt('no such sound', 0);
  audio.startLoop('no such sound');
  audio.stopLoop('no such sound');
  audio.suspend();
  audio.resume();
  audio.unlock();
}

afterEach(() => {
  vi.unstubAllGlobals();
  FakeContext.created.length = 0;
});

describe('audio engine without WebAudio (Node, old browsers)', () => {
  it('imports and exports the sound names', () => {
    expect(typeof createAudio).toBe('function');
    expect(SOUND_NAMES.length).toBe(ONE_SHOT_NAMES.length + LOOP_NAMES.length);
    expect('AudioContext' in globalThis).toBe(false);
  });

  it('makes every method a safe no-op', async () => {
    const audio = createAudio();
    expect(() => exerciseEverything(audio)).not.toThrow();
    const stats = audio.getStats();
    expect(stats.state).toBe('none');
    expect(stats.voices).toBe(0);
    expect(stats.played).toBe(0);
    await expect(audio.whenReady()).resolves.toBeUndefined();
  });

  it('still remembers the mute setting', () => {
    const audio = createAudio();
    expect(audio.isMuted()).toBe(false);
    audio.setMuted(true);
    expect(audio.isMuted()).toBe(true);
    audio.setMuted(false);
    expect(audio.isMuted()).toBe(false);
    expect(createAudio({ muted: true }).isMuted()).toBe(true);
  });

  it('survives a context constructor that throws', () => {
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          throw new Error('no audio device');
        }
      },
    );
    const audio = createAudio();
    expect(() => exerciseEverything(audio)).not.toThrow();
    expect(audio.getStats().state).toBe('none');
  });
});

describe('audio engine on a context', () => {
  it('creates one context on the first unlock and starts it', () => {
    vi.stubGlobal('AudioContext', FakeContext);
    const audio = createAudio();
    expect(FakeContext.created.length).toBe(0);
    audio.play('rifleShot');
    expect(FakeContext.created.length).toBe(0);
    audio.unlock();
    audio.unlock();
    expect(FakeContext.created.length).toBe(1);
    const ctx = FakeContext.created[0];
    expect(ctx.resumeCalls).toBe(1);
    expect(audio.getStats().state).toBe('running');
    // Master chain: compressor and soft clipper before the destination.
    expect(ctx.count('compressor')).toBe(1);
    expect(ctx.count('shaper')).toBe(1);
    expect(ctx.count('panner')).toBe(AUDIO.maxVoices + AUDIO.spareVoices);
    audio.play('rifleShot');
    expect(audio.getStats().played).toBe(1);
    expect(audio.getStats().voices).toBe(1);
  });

  it('survives every call, including unknown names', () => {
    vi.stubGlobal('AudioContext', FakeContext);
    const audio = createAudio();
    expect(() => exerciseEverything(audio)).not.toThrow();
    expect(audio.getStats().played).toBeGreaterThan(0);
  });

  it('discards one-shots while suspended and plays again after resume', () => {
    vi.stubGlobal('AudioContext', FakeContext);
    const audio = createAudio();
    audio.unlock();
    const ctx = FakeContext.created[0];
    audio.suspend();
    expect(ctx.suspendCalls).toBe(1);
    audio.play('uiClick');
    audio.unlock();
    expect(ctx.state).toBe('suspended');
    expect(audio.getStats().played).toBe(0);
    audio.resume();
    expect(ctx.state).toBe('running');
    audio.play('uiClick');
    expect(audio.getStats().played).toBe(1);
  });

  it('plays nothing while muted and fades the master', () => {
    const { audio, ctx } = withFake({ muted: true });
    audio.play('rifleShot');
    expect(audio.getStats().played).toBe(0);
    audio.setMuted(false);
    audio.play('rifleShot');
    expect(audio.getStats().played).toBe(1);
    audio.setMuted(true);
    const muteGain = ctx.nodes.find((node) => node.outputs.includes(ctx.destination));
    expect(muteGain?.gain.last('target')?.[1]).toBe(0);
  });

  it('rate-limits a sound unless the new one is clearly louder', () => {
    const { audio, ctx } = withFake();
    const gap = SOUNDS.rifleShot.minInterval;
    audio.play('rifleShot', { volume: 0.5 });
    audio.play('rifleShot', { volume: 0.5 });
    audio.play('rifleShot', { volume: 0.6 });
    expect(audio.getStats().played).toBe(1);
    expect(audio.getStats().dropped).toBe(2);
    audio.play('rifleShot', { volume: 0.5 * AUDIO.overrideRatio + 0.05 });
    expect(audio.getStats().played).toBe(2);
    ctx.currentTime += gap + 0.001;
    audio.play('rifleShot', { volume: 0.1 });
    expect(audio.getStats().played).toBe(3);
  });

  it('never lets one sound overlap more than its own limit', () => {
    const { audio, ctx } = withFake();
    const def = SOUNDS.sniperShot;
    for (let i = 0; i < 12; i++) {
      audio.play('sniperShot', { volume: 0.5 + i * 0.01 });
      expect(audio.getStats().voices).toBeLessThanOrEqual(def.maxVoices);
      ctx.currentTime += def.minInterval + 0.001;
    }
    expect(audio.getStats().voices).toBe(def.maxVoices);
    expect(audio.getStats().stolen).toBeGreaterThan(0);
  });

  it('caps the voices when a whole army fires at once', () => {
    const { audio, ctx } = withFake({ random: Math.random });
    audio.setListener(2000, 1000);
    const shots = ['rifleShot', 'mgShot', 'smgShot', 'bunkerMg', 'sniperShot', 'tankGun', 'grenadeExplosion'];
    // The most source nodes one sound can own: a source per layer plus one per vibrato and tremolo.
    let sourcesPerSound = 0;
    for (const name of ONE_SHOT_NAMES) {
      let count = 0;
      for (const layer of SOUNDS[name].layers) {
        count += 1 + (layer.tremolo ? 1 : 0) + (layer.src === 'tone' && layer.vibrato ? 1 : 0);
      }
      sourcesPerSound = Math.max(sourcesPerSound, count);
    }
    const sourceLimit = (AUDIO.maxVoices + AUDIO.spareVoices) * sourcesPerSound;
    let peakVoices = 0;
    let requested = 0;
    for (let tick = 0; tick < 300; tick++) {
      for (let unit = 0; unit < 80; unit++) {
        audio.playAt(shots[(unit + tick) % shots.length], 1500 + unit * 12);
        requested++;
      }
      for (const name of ONE_SHOT_NAMES) audio.play(name);
      requested += ONE_SHOT_NAMES.length;
      const stats = audio.getStats();
      peakVoices = Math.max(peakVoices, stats.voices);
      expect(stats.voices).toBeLessThanOrEqual(AUDIO.maxVoices);
      expect(ctx.sounding().length).toBeLessThanOrEqual(sourceLimit);
      ctx.currentTime += 1 / 30;
    }
    const stats = audio.getStats();
    expect(peakVoices).toBe(AUDIO.maxVoices);
    expect(stats.played + stats.dropped).toBe(requested);
    expect(stats.dropped).toBeGreaterThan(stats.played);
    expect(stats.played).toBeGreaterThan(300);
  });

  it('drops the quietest voice for a louder sound, and refuses a quieter one', () => {
    const { audio, ctx } = withFake();
    // Fill the pool in one instant with long, unprotected sounds. Each copy is louder than the last so it passes
    // the rate limiter.
    const long = ONE_SHOT_NAMES.filter(
      (name) => name !== 'ricochet' && SOUNDS[name].priority === 0 && soundDuration(SOUNDS[name]) > 0.5,
    );
    const capacity = long.reduce((sum, name) => sum + SOUNDS[name].maxVoices, 0);
    expect(capacity, 'the test needs enough long sounds to fill the pool').toBeGreaterThanOrEqual(AUDIO.maxVoices);
    for (const name of long) {
      for (let copy = 0; copy < SOUNDS[name].maxVoices; copy++) {
        audio.play(name, { volume: 0.3 * Math.pow(AUDIO.overrideRatio + 0.1, copy) });
      }
    }
    ctx.currentTime += 0.05;
    expect(audio.getStats().voices).toBe(AUDIO.maxVoices);

    const before = { ...audio.getStats() };
    audio.play('ricochet', { volume: 0.11 });
    expect(audio.getStats().dropped).toBe(before.dropped + 1);
    expect(audio.getStats().played).toBe(before.played);

    audio.play('ricochet', { volume: 4 });
    expect(audio.getStats().played).toBe(before.played + 1);
    expect(audio.getStats().stolen).toBe(before.stolen + 1);
    expect(audio.getStats().voices).toBe(AUDIO.maxVoices);

    // A protected sound always gets through.
    audio.play('uiClick', { volume: 0.2 });
    expect(audio.getStats().played).toBe(before.played + 2);
    expect(audio.getStats().voices).toBe(AUDIO.maxVoices);
  });

  it('pans across the screen and fades sounds that are far off-screen', () => {
    const { audio, ctx } = withFake();
    audio.setListener(1000, 1000);
    const panOf = (): number => {
      const panners = ctx.nodes.filter((node) => node.kind === 'panner' && node.pan.events.length > 0);
      return panners[panners.length - 1].pan.value;
    };
    const step = 1;
    audio.playAt('tankGun', 1000);
    expect(panOf()).toBeCloseTo(0, 6);
    ctx.currentTime += step;
    audio.playAt('tankGun', 1500);
    expect(panOf()).toBeCloseTo(AUDIO.panWidth, 6);
    ctx.currentTime += step;
    audio.playAt('tankGun', 625);
    expect(panOf()).toBeCloseTo(-0.75 * AUDIO.panWidth, 6);
    ctx.currentTime += step;
    audio.playAt('tankGun', 90000);
    expect(panOf()).toBeCloseTo(-0.75 * AUDIO.panWidth, 6);
    expect(audio.getStats().played).toBe(3);
    expect(audio.getStats().dropped).toBe(1);

    // On screen: full level. One falloff distance (scaled by reach) past the edge: half level.
    const levels: number[] = [];
    const voiceLevel = (x: number): number => {
      ctx.currentTime += step;
      const marks = ctx.nodes.map((node) => node.gain.events.length);
      audio.playAt('tankGun', x);
      // A voice channel is the gain node that feeds a panner (the buses do not).
      const index = ctx.nodes.findIndex(
        (node, i) =>
          node.kind === 'gain' &&
          i < marks.length &&
          node.gain.events.length > marks[i] &&
          node.outputs.some((out) => (out as FakeNode).kind === 'panner'),
      );
      return ctx.nodes[index].gain.last('set')?.[1] ?? NaN;
    };
    levels.push(voiceLevel(1400), voiceLevel(1500 + AUDIO.falloffWu * SOUNDS.tankGun.reach));
    expect(levels[1]).toBeCloseTo(levels[0] / 2, 6);
  });

  it('routes gunfire through its own bus and everything else through the main one', () => {
    const { audio, ctx } = withFake();
    // The two buses are the first gains made: main, then the gunfire bed that feeds it.
    const [main, bed] = ctx.nodes;
    expect(main.kind).toBe('gain');
    expect(bed.outputs).toEqual([main]);
    const lastOutput = (): unknown => {
      const used = ctx.nodes.filter((node) => node.kind === 'panner' && node.pan.events.length > 0);
      return used[used.length - 1].outputs[0];
    };
    audio.play('rifleShot');
    expect(lastOutput()).toBe(bed);
    audio.play('uiClick');
    expect(lastOutput()).toBe(main);
    audio.play('bunkerMg');
    expect(lastOutput()).toBe(bed);
    for (const name of ONE_SHOT_NAMES) expect(SOUNDS[name].bed === true, name).toBe(['rifleShot', 'mgShot', 'smgShot', 'bunkerMg', 'ricochet', 'dirtHit'].includes(name));
  });

  it('dips the gunfire bed under a blast, and a smaller blast does not cut a big one short', () => {
    const { audio, ctx } = withFake();
    const bed = ctx.nodes[1];
    const duck = SOUNDS.explosionLarge.duck;
    expect(duck).toBeDefined();
    if (!duck) return;
    audio.play('explosionLarge');
    const dip = bed.gain.events.find((e) => e[0] === 'target' && e[1] === 1 - duck.depth);
    const back = bed.gain.events.filter((e) => e[0] === 'target' && e[1] === 1);
    expect(dip, 'the bed dips to its floor').toBeDefined();
    expect(back.length).toBe(1);
    // The swell back starts when the duck's time is up (counted from the sound's own start).
    expect(back[0][2] - (dip?.[2] ?? 0)).toBeCloseTo(duck.seconds, 6);
    // A smaller, shorter blast during the dip changes nothing.
    ctx.currentTime += 0.05;
    const marks = bed.gain.events.length;
    audio.play('grenadeExplosion');
    expect(bed.gain.events.length).toBe(marks);
    // After the dip is over, the same small blast ducks again, to its own depth.
    ctx.currentTime += duck.seconds + 1;
    audio.play('grenadeExplosion');
    const small = SOUNDS.grenadeExplosion.duck;
    expect(bed.gain.events.some((e) => e[0] === 'target' && e[1] === 1 - (small?.depth ?? 0))).toBe(true);
    // Gunfire itself never ducks anything.
    for (const name of ['rifleShot', 'mgShot', 'smgShot', 'bunkerMg', 'uiClick']) expect(SOUNDS[name as 'rifleShot'].duck, name).toBeUndefined();
  });

  it('starts loops with a fade, retargets them and stops them with a fade', () => {
    const { audio, ctx } = withFake();
    const before = ctx.sounding().length;
    audio.startLoop('rain');
    const running = ctx.sounding().length;
    expect(running).toBeGreaterThan(before);
    audio.startLoop('rain', 0.5);
    expect(ctx.sounding().length).toBe(running);
    ctx.currentTime += 5;
    audio.stopLoop('rain');
    audio.stopLoop('rain');
    ctx.currentTime += 5;
    expect(ctx.sounding().length).toBe(before);
    audio.startLoop('tankEngine');
    expect(ctx.sounding().length).toBeGreaterThan(before);
    audio.stopLoop('tankEngine');
    ctx.currentTime += 5;
    expect(ctx.sounding().length).toBe(before);
    // One-shot names are not loops, and loops are not one-shots.
    audio.startLoop('rifleShot');
    audio.play('rain');
    expect(ctx.sounding().length).toBe(before);
    expect(audio.getStats().played).toBe(0);
  });

  it('remembers loops asked for before the first gesture', () => {
    vi.stubGlobal('AudioContext', FakeContext);
    const audio = createAudio();
    audio.startLoop('rain');
    audio.startLoop('tankEngine');
    audio.stopLoop('tankEngine');
    audio.unlock();
    const ctx = FakeContext.created[0];
    const sources = ctx.sounding().filter((node) => node.kind === 'bufferSource' && node.loop);
    expect(sources.length).toBe(3);
  });
});
