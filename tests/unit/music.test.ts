import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAudio } from '../../src/audio';
import {
  band,
  db,
  drumBeats,
  inKey,
  loopBeats,
  loopSeconds,
  loudestWindow,
  loudnessOf,
  MusicPlayer,
  peakOf,
  phoneSpeaker,
  rmsOf,
  scoreNotes,
  seamOf,
  sectionTimes,
  sumLoudness,
} from '../../src/audio/music';
import type { RenderedTrack } from '../../src/audio/music';
import { MINOR_SCALE, MUSIC, MUSIC_TRACKS, REQUIEM, type TrackDef } from '../../src/data/music';

/** A recording stand-in for the few WebAudio nodes the player and the engine's music path touch. */
class Param {
  value = 0;
  events: [string, number, number][] = [];
  setValueAtTime(v: number, t: number): this {
    this.value = v;
    this.events.push(['set', v, t]);
    return this;
  }
  linearRampToValueAtTime(v: number, t: number): this {
    this.events.push(['linear', v, t]);
    return this;
  }
  exponentialRampToValueAtTime(v: number, t: number): this {
    this.events.push(['exp', v, t]);
    return this;
  }
  setTargetAtTime(v: number, t: number): this {
    this.events.push(['target', v, t]);
    return this;
  }
  cancelScheduledValues(t: number): this {
    this.events.push(['cancel', 0, t]);
    return this;
  }
}

class Node {
  outputs: unknown[] = [];
  started: number | null = null;
  stopped: number | null = null;
  buffer: unknown = null;
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  type = '';
  curve: unknown = null;
  readonly gain = new Param();
  readonly pan = new Param();
  readonly frequency = new Param();
  readonly detune = new Param();
  readonly Q = new Param();
  readonly playbackRate = new Param();
  readonly threshold = new Param();
  readonly knee = new Param();
  readonly ratio = new Param();
  readonly attack = new Param();
  readonly release = new Param();
  constructor(readonly kind: string) {
    this.gain.value = 1;
  }
  connect(t: unknown): void {
    this.outputs.push(t);
  }
  disconnect(): void {
    this.outputs.length = 0;
  }
  start(t = 0): void {
    this.started = t;
  }
  stop(t = 0): void {
    this.stopped = t;
  }
}

class Context {
  currentTime = 0;
  sampleRate = 8000;
  state = 'running';
  destination = new Node('destination');
  nodes: Node[] = [];
  private make(kind: string): Node {
    const n = new Node(kind);
    this.nodes.push(n);
    return n;
  }
  createGain(): Node {
    return this.make('gain');
  }
  createStereoPanner(): Node {
    return this.make('panner');
  }
  createDynamicsCompressor(): Node {
    return this.make('compressor');
  }
  createWaveShaper(): Node {
    return this.make('shaper');
  }
  createBiquadFilter(): Node {
    return this.make('filter');
  }
  createOscillator(): Node {
    return this.make('oscillator');
  }
  createBufferSource(): Node {
    return this.make('bufferSource');
  }
  createBuffer(_c: number, length: number, sampleRate: number): { length: number; sampleRate: number; duration: number; getChannelData: () => Float32Array } {
    const data = new Float32Array(length);
    return { length, sampleRate, duration: length / sampleRate, getChannelData: () => data };
  }
}

function fakeTrack(seconds = 130): RenderedTrack {
  return {
    buffer: { duration: seconds + 8 } as unknown as AudioBuffer,
    loopFrames: seconds * 24000,
    loopSeconds: seconds,
    sampleRate: 24000,
    channels: 1,
    renderMs: 1,
    buildMs: 1,
    bytes: 4,
    rawPeak: 1,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the menu theme as a score', () => {
  const def: TrackDef = REQUIEM;

  it('is a slow minor piece of at least two minutes before it repeats', () => {
    expect(MUSIC_TRACKS.menu).toBe(REQUIEM);
    expect(def.bpm).toBeGreaterThanOrEqual(55);
    expect(def.bpm).toBeLessThanOrEqual(65);
    expect(def.key.mode).toBe('minor');
    expect(MINOR_SCALE).toEqual([0, 2, 3, 5, 7, 8, 10]);
    expect(loopSeconds(def)).toBeGreaterThanOrEqual(120);
    // The sections add up to the loop, back to back.
    const times = sectionTimes(def);
    expect(times[0].start).toBe(0);
    for (let i = 1; i < times.length; i++) expect(times[i].start).toBeCloseTo(times[i - 1].end, 9);
    expect(times[times.length - 1].end).toBeCloseTo(loopSeconds(def), 9);
    expect(loopBeats(def)).toBe(def.sections.reduce((n, s) => n + s.bars * def.beatsPerBar, 0));
    expect(def.sections.length).toBeGreaterThanOrEqual(4);
  });

  it('keeps every note in the key unless it is marked as a deliberate accidental, and every accidental really is one', () => {
    const notes = scoreNotes(def).filter((n) => n.instrument !== 'drum');
    expect(notes.length).toBeGreaterThan(50);
    for (const n of notes) {
      if (n.accidental) expect(inKey(def, n.note), `${n.instrument} ${n.note} is marked but in key`).toBe(false);
      else expect(inKey(def, n.note), `${n.instrument} ${n.note} at ${n.at.toFixed(1)} s`).toBe(true);
    }
    // Accidentals are rare.
    expect(notes.filter((n) => n.accidental).length).toBeLessThanOrEqual(6);
  });

  it('keeps every note inside its instrument\'s range and every event inside its section', () => {
    const I = def.instruments;
    const range = { pad: I.pad.range, horn: I.horn.range, piano: I.piano.range } as const;
    for (const n of scoreNotes(def)) {
      if (n.instrument === 'drum') continue;
      const [lo, hi] = range[n.instrument];
      expect(n.note, `${n.instrument} ${n.note}`).toBeGreaterThanOrEqual(lo);
      expect(n.note, `${n.instrument} ${n.note}`).toBeLessThanOrEqual(hi);
    }
    for (const s of def.sections) {
      const beats = s.bars * def.beatsPerBar;
      const events = [...s.chords, ...s.horn, ...s.piano];
      for (const e of events) {
        expect(e.at, s.name).toBeGreaterThanOrEqual(0);
        expect(e.at + e.beats, s.name).toBeLessThanOrEqual(beats + 1e-9);
      }
      for (const d of s.drums) {
        expect(d.at).toBeGreaterThanOrEqual(0);
        expect(d.at).toBeLessThan(beats);
      }
    }
  });

  it('is sparse: long notes and plenty of room between them', () => {
    const spb = 60 / def.bpm;
    const melody = scoreNotes(def).filter((n) => n.instrument === 'horn' || n.instrument === 'piano');
    const sounding = melody.reduce((t, n) => t + n.length, 0);
    // Fewer than one melody note every two seconds, and the average note longer than a beat.
    expect(melody.length / loopSeconds(def)).toBeLessThan(0.5);
    expect(sounding / melody.length).toBeGreaterThan(spb);
    // Sections differ: the horn sings in some, the piano in another, and their registers move.
    const lead = def.sections.map((s) => (s.horn.length > 0 ? 'horn' : '') + (s.piano.length > 0 ? 'piano' : ''));
    expect(new Set(lead).size).toBeGreaterThanOrEqual(3);
    const mean = def.sections.map((s) => {
      const ns = [...s.horn, ...s.piano].map((n) => n.note);
      return ns.reduce((a, b) => a + b, 0) / Math.max(1, ns.length);
    });
    expect(Math.max(...mean) - Math.min(...mean)).toBeGreaterThan(10);
  });

  it('puts the drum hits at irregular times that never fall into a steady pulse', () => {
    const beats = drumBeats(def);
    expect(beats.length).toBeGreaterThanOrEqual(6);
    const loop = loopBeats(def);
    const gaps: number[] = [];
    for (let i = 1; i < beats.length; i++) gaps.push(beats[i] - beats[i - 1]);
    gaps.push(loop - beats[beats.length - 1] + beats[0]);
    // No three consecutive equal gaps (round the loop too), and in fact no two.
    for (let i = 0; i < gaps.length; i++) {
      const a = gaps[i];
      const b = gaps[(i + 1) % gaps.length];
      expect(Math.abs(a - b), `gaps ${i} and ${i + 1}`).toBeGreaterThan(0.2);
    }
    // Far apart and spread: no hit on every bar line.
    expect(Math.min(...gaps)).toBeGreaterThan(2);
    const offBar = beats.filter((b) => b % def.beatsPerBar !== 0).length;
    expect(offBar).toBe(beats.length);
  });

  it('keeps its tunables where the brief asks: tempo, key, instruments, volumes and fades in data', () => {
    expect(MUSIC.player.fadeIn).toBeCloseTo(3, 9);
    expect(MUSIC.player.level).toBeGreaterThan(0);
    expect(MUSIC.player.level).toBeLessThanOrEqual(1);
    expect(def.sampleRate).toBeLessThanOrEqual(32000);
    // A two-minute mono buffer at the render rate stays far below the 46 MB of stereo at 44.1 kHz.
    expect((loopSeconds(def) + def.tail) * def.sampleRate * def.channels * 4).toBeLessThan(16e6);
  });
});

describe('measuring audio', () => {
  const rate = 8000;
  const sine = (hz: number, seconds: number, amp = 1): Float32Array => {
    const out = new Float32Array(Math.round(seconds * rate));
    for (let i = 0; i < out.length; i++) out[i] = amp * Math.sin((2 * Math.PI * hz * i) / rate);
    return out;
  };

  it('measures peak, RMS and dB', () => {
    const s = sine(100, 1, 0.5);
    expect(peakOf(s)).toBeCloseTo(0.5, 2);
    expect(rmsOf(s)).toBeCloseTo(0.5 / Math.SQRT2, 2);
    expect(db(1)).toBeCloseTo(0, 9);
    expect(db(0.1)).toBeCloseTo(-20, 9);
  });

  it('keeps a tone inside the band and rejects one outside it', () => {
    const inside = sine(2500, 2);
    const outside = sine(150, 2);
    expect(db(rmsOf(band(inside, rate, 1500, 3500))) - db(rmsOf(inside))).toBeGreaterThan(-3);
    expect(db(rmsOf(band(outside, rate, 1500, 3500))) - db(rmsOf(outside))).toBeLessThan(-30);
  });

  it('finds the loudest window', () => {
    const s = sine(200, 3, 0.1);
    for (let i = rate; i < 1.5 * rate; i++) s[i] *= 8;
    expect(loudestWindow(s, rate, 0.25)).toBeCloseTo(0.8 / Math.SQRT2, 1);
    expect(rmsOf(s)).toBeLessThan(0.3);
  });

  it('measures perceived loudness the BS.1770 way', () => {
    const r = 48000;
    const tone = (hz: number, seconds: number, amp: number): Float32Array => {
      const out = new Float32Array(Math.round(seconds * r));
      for (let i = 0; i < out.length; i++) out[i] = amp * Math.sin((2 * Math.PI * hz * i) / r);
      return out;
    };
    // The standard's reference: a full-scale 997 Hz sine in one channel reads -3.01 LUFS.
    expect(loudnessOf(tone(997, 5, 1), r).integrated).toBeCloseTo(-3.01, 0);
    // Half the amplitude: 6 dB quieter.
    expect(loudnessOf(tone(997, 5, 0.5), r).integrated).toBeCloseTo(-9.03, 0);
    // The head's shelf: the same level at 4 kHz reads louder, at 60 Hz a little quieter.
    expect(loudnessOf(tone(4000, 5, 0.5), r).integrated).toBeGreaterThan(loudnessOf(tone(997, 5, 0.5), r).integrated + 2.5);
    expect(loudnessOf(tone(60, 5, 0.5), r).integrated).toBeLessThan(loudnessOf(tone(997, 5, 0.5), r).integrated);
    // Gating: silence around a tone does not dilute it.
    const gapped = new Float32Array(r * 10);
    gapped.set(tone(997, 4, 0.5), r * 3);
    expect(loudnessOf(gapped, r).integrated).toBeCloseTo(-9.03, 0);
    // Momentary and short-term maxima find the loud part.
    expect(loudnessOf(gapped, r).momentaryMax).toBeCloseTo(-9.03, 0);
    // Two equal uncorrelated sounds together: 3 dB louder.
    expect(sumLoudness(-20, -20)).toBeCloseTo(-16.99, 2);
  });

  it('models a phone speaker: no bass, the middle untouched', () => {
    const phone = MUSIC.mix.phone;
    expect(phone.highpassHz).toBeGreaterThanOrEqual(300);
    expect(phone.highpassHz).toBeLessThanOrEqual(400);
    expect(phone.highpassOrder).toBeGreaterThanOrEqual(2);
    expect(phone.lowpassHz).toBeGreaterThanOrEqual(9000);
    const r = 24000;
    const tone = (hz: number): Float32Array => {
      const out = new Float32Array(r * 2);
      for (let i = 0; i < out.length; i++) out[i] = Math.sin((2 * Math.PI * hz * i) / r);
      return out;
    };
    const through = (hz: number): number => db(rmsOf(phoneSpeaker(tone(hz), r, phone), r / 2)) - db(rmsOf(tone(hz)));
    expect(through(80)).toBeLessThan(-40);
    expect(through(150)).toBeLessThan(-25);
    expect(through(2000)).toBeGreaterThan(-1);
    expect(through(1000)).toBeGreaterThan(-1);
  });

  it('tells a seamless loop from one with a click', () => {
    // 100 Hz fits a whole number of cycles into one second: the loop is continuous.
    const smooth = sine(100, 1);
    const good = seamOf(smooth, smooth.length, rate);
    expect(good.step).toBeLessThanOrEqual(good.localStep * 1.01);
    expect(Math.abs(db(good.rmsBefore) - db(good.rmsAfter))).toBeLessThan(0.5);
    const clicky = sine(100, 1);
    clicky[0] = 1;
    clicky[clicky.length - 1] = -1;
    const bad = seamOf(clicky, clicky.length, rate);
    expect(bad.step).toBeGreaterThan(1.5);
  });
});

describe('the music player', () => {
  it('loops the folded loop on its bus and fades in from silence', () => {
    const ctx = new Context();
    const bus = new Node('bus');
    const player = new MusicPlayer(0.3, 3, 1.5);
    ctx.currentTime = 2;
    player.start(ctx as unknown as BaseAudioContext, bus as unknown as AudioNode, 'menu', fakeTrack(130), false);
    expect(player.playing).toBe(true);
    const source = ctx.nodes.find((n) => n.kind === 'bufferSource');
    const gain = ctx.nodes.find((n) => n.kind === 'gain');
    expect(source?.loop).toBe(true);
    expect(source?.loopStart).toBe(0);
    expect(source?.loopEnd).toBe(130);
    expect(source?.outputs).toEqual([gain]);
    expect(gain?.outputs).toEqual([bus]);
    expect(gain?.gain.events[0]).toEqual(['set', 0, 2]);
    expect(gain?.gain.events[1]).toEqual(['linear', 0.3, 5]);
    // Asked again while it plays: nothing new.
    player.start(ctx as unknown as BaseAudioContext, bus as unknown as AudioNode, 'menu', fakeTrack(130), false);
    expect(ctx.nodes.filter((n) => n.kind === 'bufferSource').length).toBe(1);
  });

  it('fades out and stops, or cuts at once when the sound is frozen', () => {
    const ctx = new Context();
    const bus = new Node('bus');
    const player = new MusicPlayer(0.3, 3, 1.5);
    player.start(ctx as unknown as BaseAudioContext, bus as unknown as AudioNode, 'menu', fakeTrack(), false);
    ctx.currentTime = 10;
    player.stop(ctx as unknown as BaseAudioContext, false);
    expect(player.playing).toBe(false);
    const source = ctx.nodes.find((n) => n.kind === 'bufferSource');
    const gain = ctx.nodes.find((n) => n.kind === 'gain');
    const last = gain?.gain.events[gain.gain.events.length - 1];
    expect(last?.[0]).toBe('linear');
    expect(last?.[1]).toBe(0);
    expect(last?.[2]).toBeCloseTo(11.5, 9);
    expect(source?.stopped).toBeGreaterThan(11.5);
    // Frozen: disconnected and stopped now.
    player.start(ctx as unknown as BaseAudioContext, bus as unknown as AudioNode, 'menu', fakeTrack(), false);
    const second = ctx.nodes.filter((n) => n.kind === 'gain')[1];
    player.stop(ctx as unknown as BaseAudioContext, true);
    expect(second.outputs).toEqual([]);
  });

  it('is played by the engine on the Music bus once rendered and the sound has started, and stops on request', async () => {
    const ctx = new Context();
    let resolve: (t: RenderedTrack) => void = () => undefined;
    const rendered = new Promise<RenderedTrack>((ok) => {
      resolve = ok;
    });
    const audio = createAudio({ context: ctx as unknown as BaseAudioContext, renderMusic: () => rendered });
    const [sfx, bed, music, ambience] = ctx.nodes;
    expect(bed.outputs).toEqual([sfx]);
    audio.startMusic('menu');
    expect(audio.musicStats().render).toBe('idle');
    audio.prepareMusic('menu');
    expect(audio.musicStats().render).toBe('rendering');
    expect(audio.musicStats().playing).toBe(false);
    resolve(fakeTrack());
    await rendered;
    await Promise.resolve();
    expect(audio.musicStats().render).toBe('ready');
    expect(audio.musicStats().playing).toBe(true);
    const gain = ctx.nodes.find((n) => n.kind === 'gain' && n.outputs.includes(music));
    expect(gain, 'the music feeds the Music bus').toBeDefined();
    expect(gain?.outputs).toEqual([music]);
    expect(ctx.nodes.some((n) => n.outputs.includes(ambience)), 'nothing on Ambience').toBe(false);
    // The Music slider moves the Music bus.
    audio.setVolume('music', 0.5);
    expect(music.gain.events[music.gain.events.length - 1][1]).toBeCloseTo(0.25, 9);
    audio.stopMusic();
    expect(audio.musicStats().playing).toBe(false);
    expect(audio.musicStats().wanted).toBe(null);
  });

  it('carries on silently when the track cannot be rendered', async () => {
    const audio = createAudio({ context: new Context() as unknown as BaseAudioContext, renderMusic: () => Promise.reject(new Error('no audio')) });
    audio.prepareMusic('menu');
    audio.startMusic('menu');
    await Promise.resolve();
    await Promise.resolve();
    expect(audio.musicStats().render).toBe('failed');
    expect(audio.musicStats().playing).toBe(false);
    // No OfflineAudioContext at all (Node): unavailable, and nothing breaks.
    const bare = createAudio();
    bare.prepareMusic('menu');
    bare.startMusic('menu');
    expect(bare.musicStats().render).toBe('unavailable');
    expect(bare.musicStats().playing).toBe(false);
    bare.stopMusic();
  });
});
