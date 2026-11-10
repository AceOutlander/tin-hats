import { describe, expect, it } from 'vitest';
import { App } from '../../src/app/app';
import { createAudio } from '../../src/audio';
import {
  barSeconds,
  battlePieces,
  distinctSeconds,
  introSection,
  pieceFrames,
  pieceParts,
  pieceSeconds,
  resolveLayer,
  sectionSeconds,
  trackBytes,
  trackLayers,
  type BattlePiece,
  type RenderedPiece,
} from '../../src/audio/music/battle';
import { BattleMusicPlayer } from '../../src/audio/music/battlePlayer';
import { MISSIONS } from '../../src/data/missions';
import { SANDBOX, SANDBOX_MIRROR } from '../../src/data/missions/sandbox';
import { MUSIC_BATTLE, MUSIC_LAYERS, type BattleTrackDef, type MusicEvent } from '../../src/data/musicBattle';
import { bass, hits, ostinato, prog, tile } from '../../src/data/musicKit';
import { BRITISH_ANSWER, BRITISH_MOTIF, degreeNote, motif, THEMES } from '../../src/data/musicThemes';
import { BATTLE_TRACK_NAMES, BATTLE_TRACKS } from '../../src/data/musicTracks';
import { createMemoryStorage } from '../../src/meta';
import { createFakeUi, createFakeView, quickMission } from './app-helpers';

/** Recording stand-ins for the WebAudio nodes the battle player and the engine touch. */
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
  createBuffer(_c: number, length: number, sampleRate: number): ReturnType<typeof fakeBuffer> {
    return fakeBuffer(length, sampleRate);
  }
  sources(): Node[] {
    return this.nodes.filter((n) => n.kind === 'bufferSource' && n.buffer !== null && (n.buffer as { tag?: string }).tag !== undefined);
  }
}

function fakeBuffer(length: number, sampleRate: number, tag?: string): { length: number; sampleRate: number; duration: number; numberOfChannels: number; tag?: string; getChannelData: () => Float32Array } {
  const data = new Float32Array(Math.min(length, 16));
  return { length, sampleRate, duration: length / sampleRate, numberOfChannels: 1, tag, getChannelData: () => data };
}

const RATE = MUSIC_BATTLE.render.sampleRate;

function pieceBuffer(def: BattleTrackDef, p: BattlePiece): AudioBuffer {
  return fakeBuffer(pieceFrames(def, p, RATE), RATE, p.sting ?? `${p.section}/${p.layer}`) as unknown as AudioBuffer;
}

const ARRAS = BATTLE_TRACKS.arras;

/** Every pitched instrument's range in a track. */
function ranges(def: BattleTrackDef): Partial<Record<string, readonly [number, number]>> {
  const I = def.instruments;
  return { strings: I.strings.range, brass: I.brass.range, horn: I.horn.range, pad: I.pad.range, timpani: I.timpani.range, bell: I.bell.range };
}

describe('the battle track format', () => {
  for (const name of BATTLE_TRACK_NAMES) {
    const def = BATTLE_TRACKS[name];
    describe(`${name}: ${def.title}`, () => {
      it('keeps every layer of a section on one tempo and bar grid, every note inside its section', () => {
        expect(def.bpm).toBeGreaterThanOrEqual(90);
        expect(def.sections.length).toBeGreaterThanOrEqual(6);
        for (let i = 0; i < def.sections.length; i++) {
          const s = def.sections[i];
          expect(Number.isInteger(s.bars), s.name).toBe(true);
          const beats = s.bars * def.beatsPerBar;
          const lengths = new Set<number>();
          for (const layer of trackLayers(def)) {
            const p: BattlePiece = { section: i, layer, sting: null };
            lengths.add(pieceSeconds(def, p));
            const parts = pieceParts(def, p);
            expect(parts.length, `${s.name} ${layer}`).toBeGreaterThan(0);
            for (const part of parts) {
              for (const e of part.events) {
                expect(e.at, `${s.name} ${layer} ${part.inst}`).toBeGreaterThanOrEqual(0);
                expect(e.at + e.len, `${s.name} ${layer} ${part.inst} at ${e.at}`).toBeLessThanOrEqual(beats + 1e-9);
              }
            }
          }
          // The same length for every layer: the bar grid lines up, so a crossfade never drifts.
          expect(lengths.size).toBe(1);
          expect(sectionSeconds(def, i)).toBeCloseTo(s.bars * barSeconds(def), 9);
        }
      });

      it('has at least three minutes of distinct material, sections and layers all different', () => {
        expect(distinctSeconds(def)).toBeGreaterThanOrEqual(MUSIC_BATTLE.budget.minSeconds);
        const seen = new Set<string>();
        for (const s of def.sections) {
          for (const layer of trackLayers(def)) {
            const key = JSON.stringify(layer === 'prep' ? s.layers.prep : s.layers[layer]);
            expect(seen.has(key), `${s.name} ${layer} repeats another piece`).toBe(false);
            seen.add(key);
          }
        }
        // An opening, quiet stretches to drop in now and then, and enough main sections to vary the order.
        expect(def.sections[introSection(def)].role).toBe('intro');
        expect(def.sections.filter((s) => s.role === 'quiet').length).toBeGreaterThanOrEqual(1);
        expect(def.sections.filter((s) => s.role === 'main').length).toBeGreaterThanOrEqual(4);
      });

      it('keeps every note inside its instrument and every velocity in 0..1', () => {
        const range = ranges(def);
        const check = (where: string, events: readonly MusicEvent[], inst: string): void => {
          const r = range[inst];
          for (const e of events) {
            expect(e.vel, where).toBeGreaterThan(0);
            expect(e.vel, where).toBeLessThanOrEqual(1);
            if (!r) continue;
            expect(e.note, `${where} ${inst} ${e.note}`).toBeGreaterThanOrEqual(r[0]);
            expect(e.note, `${where} ${inst} ${e.note}`).toBeLessThanOrEqual(r[1]);
          }
        };
        for (const p of battlePieces(def)) {
          for (const part of pieceParts(def, p)) check(p.sting ?? `${def.sections[p.section].name} ${p.layer}`, part.events, part.inst);
        }
      });

      it('has both stings, short and inside their length', () => {
        for (const sting of ['victory', 'defeat'] as const) {
          const s = def.stings[sting];
          const seconds = s.beats * (60 / def.bpm);
          expect(seconds).toBeGreaterThan(3);
          expect(seconds).toBeLessThan(10);
          for (const part of s.parts) for (const e of part.events) expect(e.at + e.len).toBeLessThanOrEqual(s.beats + 1e-9);
        }
      });

      it('fits the memory budget and renders its opening build layer first', () => {
        expect(trackBytes(def)).toBeLessThanOrEqual(MUSIC_BATTLE.budget.maxBytes);
        const pieces = battlePieces(def);
        expect(pieces[0]).toEqual({ section: introSection(def), layer: 'build', sting: null });
        // Every layer of every section and both stings, once each.
        expect(pieces.length).toBe(def.sections.length * trackLayers(def).length + 2);
        expect(new Set(pieces.map((p) => `${p.section}/${p.layer}/${p.sting}`)).size).toBe(pieces.length);
      });
    });
  }

  it('falls back to build for prep when a track has no prep layer', () => {
    expect(trackLayers(ARRAS)).toEqual(['build', 'combat', 'tense']);
    expect(resolveLayer(ARRAS, 'prep')).toBe('build');
    expect(resolveLayer(ARRAS, 'combat')).toBe('combat');
    const withPrep: BattleTrackDef = { ...ARRAS, sections: ARRAS.sections.map((s) => ({ ...s, layers: { ...s.layers, prep: s.layers.tense.slice(0, 1) } })) };
    expect(trackLayers(withPrep)).toEqual(['build', 'combat', 'tense', 'prep']);
    expect(resolveLayer(withPrep, 'prep')).toBe('prep');
  });

  it('is named by every mission, and every name is a registered track', () => {
    for (const m of [...MISSIONS, SANDBOX, SANDBOX_MIRROR]) {
      expect(BATTLE_TRACK_NAMES, `${m.key} names ${m.music}`).toContain(m.music);
      expect(BATTLE_TRACKS[m.music]).toBeDefined();
    }
    // The British placeholder missions are gone, but their ten tracks stay for the campaigns to come (docs/QUEUE.md).
    for (const name of ['arras', 'dunkirk', 'crusader', 'alamein', 'primosole', 'cassino', 'sword', 'hill112', 'arnhem', 'reichswald']) {
      expect(BATTLE_TRACK_NAMES, name).toContain(name);
    }
  });
});

describe('the British campaign motif', () => {
  it('is two bars of 4/4 in scale degrees, opening on the tonic and ending open on the fifth', () => {
    expect(THEMES.british.motif).toBe(BRITISH_MOTIF);
    expect(BRITISH_MOTIF.beats).toBe(8);
    expect(BRITISH_MOTIF.notes[0][2]).toBe(0);
    expect(BRITISH_MOTIF.notes[BRITISH_MOTIF.notes.length - 1][2]).toBe(4);
    expect(BRITISH_ANSWER.notes[BRITISH_ANSWER.notes.length - 1][2]).toBe(0);
    const end = Math.max(...BRITISH_MOTIF.notes.map(([at, len]) => at + len));
    expect(end).toBe(8);
  });

  it('plays in any key and colour, inverted, backwards, slower, displaced, cut short and moved by scale steps', () => {
    const E3 = 52;
    expect(motif(BRITISH_MOTIF, { tonic: E3 }).map((e) => e.note)).toEqual([52, 59, 57, 59, 55, 54, 55, 59]);
    expect(degreeNote(E3, 'major', 2)).toBe(56);
    expect(degreeNote(E3, 'phrygian', 1)).toBe(53);
    expect(degreeNote(E3, 'minor', -1)).toBe(50);
    expect(motif(BRITISH_MOTIF, { tonic: E3, colour: 'major' })[4].note).toBe(56);
    const inverted = motif(BRITISH_MOTIF, { tonic: E3, invert: true }).map((e) => e.note);
    expect(inverted[0]).toBe(52);
    expect(inverted[1]).toBe(degreeNote(E3, 'minor', -4));
    const slow = motif(BRITISH_MOTIF, { tonic: E3, augment: 2, at: 4 });
    expect(slow[1].at).toBe(4 + 3);
    expect(slow[1].len).toBe(1);
    expect(motif(BRITISH_MOTIF, { tonic: E3, displace: 0.5 })[0].at).toBe(0.5);
    expect(motif(BRITISH_MOTIF, { tonic: E3, take: 3 }).length).toBe(3);
    const back = motif(BRITISH_MOTIF, { tonic: E3, retrograde: true });
    expect(back[0].note).toBe(59);
    expect(back[0].len).toBe(2);
    expect(motif(BRITISH_MOTIF, { tonic: E3, step: 1 })[0].note).toBe(54);
  });
});

describe('the composing helpers', () => {
  it('reads step patterns: hits, accents, flams, rims and rolls held through dashes', () => {
    const e = hits('X.x.|f.r.|R---', { step: 0.25, vel: 0.5 });
    expect(e.map((x) => x.art)).toEqual(['hit', 'hit', 'flam', 'rim', 'roll']);
    expect(e.map((x) => x.at)).toEqual([0, 0.5, 1, 1.5, 2]);
    expect(e[0].vel).toBeGreaterThan(e[1].vel);
    expect(e[4].len).toBe(1);
    expect(tile(e, 4, 3).length).toBe(15);
  });

  it('writes ostinatos and bass lines from the harmony', () => {
    const chords = prog(4, [
      [1, [40, 52, 55, 59]],
      [1, [36, 48, 52, 55]],
    ]);
    const o = ostinato(chords, [0, 2, 1, -1], { step: 1, vel: 0.5 });
    expect(o.map((x) => x.note)).toEqual([40, 55, 52, 36, 52, 48]);
    const b = bass(chords, 'x.5.', { step: 1, vel: 0.5 });
    expect(b.map((x) => x.note)).toEqual([40, 47, 36, 43]);
  });
});

/** A player with every piece of a track already rendered (fake buffers), on a fake context. */
function loaded(def: BattleTrackDef, seed = 1): { ctx: Context; bus: Node; player: BattleMusicPlayer } {
  const ctx = new Context();
  const bus = new Node('bus');
  let s = seed;
  const rng = (): number => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const player = new BattleMusicPlayer(def, rng);
  player.attach(ctx as unknown as BaseAudioContext, bus as unknown as AudioNode);
  for (const p of battlePieces(def)) player.add(p, pieceBuffer(def, p));
  return { ctx, bus, player };
}

/** Run the player's clock forward in 50 ms frames. */
function run(ctx: Context, player: BattleMusicPlayer, seconds: number): void {
  const end = ctx.currentTime + seconds;
  while (ctx.currentTime < end) {
    ctx.currentTime += 0.05;
    player.tick();
  }
}

describe('the battle music player', () => {
  it('starts on the opening section with every layer in sync and only build up, fading in', () => {
    const { ctx, player } = loaded(ARRAS);
    ctx.currentTime = 1;
    player.tick();
    const started = ctx.nodes.filter((n) => n.kind === 'bufferSource');
    expect(started.length).toBe(trackLayers(ARRAS).length);
    expect(new Set(started.map((n) => n.started)).size).toBe(1);
    expect(started.map((n) => (n.buffer as { tag: string }).tag).sort()).toEqual(['0/build', '0/combat', '0/tense']);
    const s = player.stats();
    expect(s.started).toBe(true);
    expect(s.section).toBe(ARRAS.sections[introSection(ARRAS)].name);
    expect(s.active).toBe('build');
  });

  it('strings sections back to back on the bar grid, in a varied order with rests now and then', () => {
    const { ctx, player } = loaded(ARRAS, 7);
    player.tick();
    run(ctx, player, 30 * 60);
    const starts = [...new Set(ctx.nodes.filter((n) => n.kind === 'bufferSource' && n.started !== null).map((n) => n.started as number))].sort((a, b) => a - b);
    const bar = barSeconds(ARRAS);
    // Every section (and every rest) starts on the bar grid of the first.
    for (const t of starts) expect(Math.abs(((t - starts[0]) / bar) % 1) < 1e-6 || Math.abs((((t - starts[0]) / bar) % 1) - 1) < 1e-6).toBe(true);
    const s = player.stats();
    // Half an hour: well over a hundred sections, never the same one twice running, every section heard.
    expect(s.sectionsPlayed).toBeGreaterThan(100);
    for (let i = 1; i < s.order.length; i++) expect(s.order[i]).not.toBe(s.order[i - 1]);
    expect(new Set(s.order).size).toBe(ARRAS.sections.length);
    expect(s.rests).toBeGreaterThan(0);
    // The order is not a fixed cycle: some window of eight sections differs from the next one.
    const windows = new Set<string>();
    for (let i = 0; i + 8 <= s.order.length; i += 8) windows.add(s.order.slice(i, i + 8).join(','));
    expect(windows.size).toBeGreaterThan(3);
  });

  it('crossfades to another layer on the next bar line over the data crossfade time, never cutting', () => {
    const { ctx, player } = loaded(ARRAS);
    player.tick();
    const t0 = ctx.nodes.find((n) => n.kind === 'bufferSource')?.started ?? 0;
    run(ctx, player, 3.1);
    const gains = ctx.nodes.filter((n) => n.kind === 'gain').slice(1, 1 + MUSIC_LAYERS.length);
    const combat = gains[MUSIC_LAYERS.indexOf('combat')];
    const build = gains[MUSIC_LAYERS.indexOf('build')];
    combat.gain.events.length = 0;
    build.gain.events.length = 0;
    player.setTarget('combat');
    const bar = barSeconds(ARRAS);
    const ramp = combat.gain.events.find((e) => e[0] === 'linear');
    const hold = combat.gain.events.filter((e) => e[0] === 'set').map((e) => e[2]);
    const at = Math.max(...hold);
    expect(at).toBeGreaterThan(ctx.currentTime);
    expect(Math.abs(((at - t0) / bar) % 1) < 1e-6 || Math.abs((((at - t0) / bar) % 1) - 1) < 1e-6, 'on a bar line').toBe(true);
    expect(ramp?.[1]).toBe(ARRAS.layerLevel.combat);
    expect(ramp?.[2]).toBeCloseTo(at + MUSIC_BATTLE.player.crossfade.combat, 9);
    const down = build.gain.events.find((e) => e[0] === 'linear');
    expect(down?.[1]).toBe(0);
    expect(down?.[2]).toBeCloseTo(at + MUSIC_BATTLE.player.crossfade.combat, 9);
    expect(player.stats().active).toBe('combat');
    // Asking for the layer it is already on changes nothing.
    combat.gain.events.length = 0;
    player.setTarget('combat');
    expect(combat.gain.events).toEqual([]);
    // Prep on a track without a prep layer is build.
    player.setTarget('prep');
    expect(player.stats().target).toBe('build');
  });

  it('starts as soon as the opening build layer is ready, before the rest has rendered', () => {
    const ctx = new Context();
    const player = new BattleMusicPlayer(ARRAS, () => 0.5);
    player.attach(ctx as unknown as BaseAudioContext, new Node('bus') as unknown as AudioNode);
    player.tick();
    expect(player.stats().started).toBe(false);
    const first = battlePieces(ARRAS)[0];
    player.add(first, pieceBuffer(ARRAS, first));
    player.tick();
    expect(player.stats().started).toBe(true);
    expect(ctx.nodes.filter((n) => n.kind === 'bufferSource').length).toBe(1);
    // Nothing else ready when it ends: the opening plays again rather than leaving a hole.
    run(ctx, player, sectionSeconds(ARRAS, 0) + 1);
    expect(player.stats().order.slice(0, 2)).toEqual([introSection(ARRAS), introSection(ARRAS)]);
  });

  it('fades the layers out under the sting at the end, and lets go of every buffer on release', () => {
    const { ctx, player } = loaded(ARRAS);
    player.tick();
    run(ctx, player, 20);
    expect(player.bytes()).toBe(trackBytes(ARRAS));
    expect(player.end(true, true)).toBe(true);
    expect(player.stats().sting).toBe('victory');
    expect(player.end(true, true)).toBe(false);
    const sting = ctx.nodes.filter((n) => n.kind === 'bufferSource').find((n) => (n.buffer as { tag: string }).tag === 'victory');
    expect(sting?.started).toBeGreaterThan(ctx.currentTime);
    const out = ctx.nodes.filter((n) => n.kind === 'gain')[0];
    const last = out.gain.events[out.gain.events.length - 1];
    expect(last[0]).toBe('linear');
    expect(last[1]).toBe(0);
    expect(last[2]).toBeCloseTo(ctx.currentTime + MUSIC_BATTLE.player.stingFade, 9);
    // After the end nothing new is scheduled.
    const count = ctx.nodes.length;
    run(ctx, player, 60);
    expect(ctx.nodes.length).toBe(count);
    player.release();
    expect(player.bytes()).toBe(0);
    expect(player.buffer(0, 'build')).toBe(null);
  });
});

describe('battle music in the engine: rendered before its battle, one mission at a time', () => {
  function engine(): { ctx: Context; audio: ReturnType<typeof createAudio>; rendered: BattlePiece[]; flush: () => Promise<void> } {
    const ctx = new Context();
    const rendered: BattlePiece[] = [];
    const audio = createAudio({
      context: ctx as unknown as BaseAudioContext,
      wait: () => Promise.resolve(),
      renderPiece: (def, piece, rate): Promise<RenderedPiece> => {
        rendered.push(piece);
        return Promise.resolve({ piece, buffer: fakeBuffer(pieceFrames(def, piece, rate), rate, piece.sting ?? `${piece.section}/${piece.layer}`) as unknown as AudioBuffer, buildMs: 1, buildMsTotal: 1, renderMs: 2, peak: 0.5 });
      },
    });
    const flush = async (): Promise<void> => {
      for (let i = 0; i < 400; i++) await Promise.resolve();
    };
    return { ctx, audio, rendered, flush };
  }

  it('renders nothing until a load asks, every piece before the battle, and plays only once the battle starts', async () => {
    const { audio, rendered, flush } = engine();
    await flush();
    expect(rendered).toEqual([]);
    expect(audio.battleMusicStats().state).toBe('idle');
    expect(audio.battleMusicStats().bytes).toBe(0);
    const progress: [number, number][] = [];
    const load = audio.loadBattleMusic('arras', (ready, total) => progress.push([ready, total]));
    expect(audio.battleMusicStats().state).toBe('rendering');
    await flush();
    expect(await load).toBe(true);
    const s = audio.battleMusicStats();
    expect(s.state).toBe('ready');
    expect(rendered.length).toBe(battlePieces(ARRAS).length);
    expect(s.piecesReady).toBe(s.piecesTotal);
    expect(s.bytes).toBe(trackBytes(ARRAS));
    expect(s.bytes).toBeLessThanOrEqual(MUSIC_BATTLE.budget.maxBytes);
    // The progress the loading button shows: from none to all, never backwards.
    expect(progress[0]).toEqual([0, s.piecesTotal]);
    expect(progress[progress.length - 1]).toEqual([s.piecesTotal, s.piecesTotal]);
    for (let i = 1; i < progress.length; i++) expect(progress[i][0]).toBeGreaterThanOrEqual(progress[i - 1][0]);
    // Nothing plays on the briefing: the music waits for its battle.
    audio.tickBattleMusic();
    expect(audio.battleMusicStats().player?.started).toBe(false);
    audio.prepareBattleMusic('arras');
    audio.tickBattleMusic();
    const p = audio.battleMusicStats().player;
    expect(p?.started).toBe(true);
    expect(p?.active).toBe('build');
    audio.setBattleLayer('combat');
    audio.tickBattleMusic();
    expect(audio.battleMusicStats().player?.target).toBe('combat');
  });

  // Owner, 2026-11-09 (DECISIONS 406): the battle starts once the calm layer is in and the rest renders during it, one
  // piece at a time in idle moments. This replaces the earlier rule "nothing renders once the battle runs".
  it('once the battle has started: a full load renders nothing more, a load under way finishes one piece at a time in idle moments, a track never loaded stays silent', async () => {
    // Every render, every wait between pieces and every idle wait is counted; pieces finish only when the test lets them.
    const ctx = new Context();
    let renders = 0;
    let waits = 0;
    let idles = 0;
    const pending: (() => void)[] = [];
    const audio = createAudio({
      context: ctx as unknown as BaseAudioContext,
      wait: () => {
        waits++;
        return Promise.resolve();
      },
      idle: () => {
        idles++;
        return Promise.resolve();
      },
      renderPiece: (def, piece, rate): Promise<RenderedPiece> => {
        renders++;
        return new Promise((resolve) => {
          pending.push(() => resolve({ piece, buffer: fakeBuffer(pieceFrames(def, piece, rate), rate, piece.sting ?? `${piece.section}/${piece.layer}`) as unknown as AudioBuffer, buildMs: 1, buildMsTotal: 1, renderMs: 2, peak: 0.5 }));
        });
      },
    });
    const flush = async (): Promise<void> => {
      for (let i = 0; i < 50; i++) await Promise.resolve();
    };
    const finishAll = async (): Promise<void> => {
      for (let guard = 0; guard < 500 && pending.length > 0; guard++) {
        pending.shift()?.();
        await flush();
      }
    };
    /** A minute of battle: frames tick the music, the layers change, the battle ends with a sting. */
    const battle = async (): Promise<void> => {
      const layers = ['build', 'combat', 'tense', 'prep', 'build'] as const;
      for (let f = 0; f < 60 * 20; f++) {
        ctx.currentTime += 0.05;
        if (f % 240 === 0) audio.setBattleLayer(layers[(f / 240) % layers.length]);
        audio.tickBattleMusic();
        if (f % 60 === 0) await flush();
      }
      audio.endBattleMusic(true, true);
      await flush();
    };
    const total = battlePieces(ARRAS).length;

    // 1. Loaded in full on the briefing, then the battle (and a restart, and a second battle).
    const load = audio.loadBattleMusic('arras');
    await finishAll();
    expect(await load).toBe(true);
    expect(renders).toBe(total);
    const [r1, w1] = [renders, waits];
    audio.prepareBattleMusic('arras');
    await battle();
    audio.prepareBattleMusic('arras');
    await battle();
    await finishAll();
    expect(renders, 'no piece rendered after the battle started').toBe(r1);
    expect(waits, 'no render gap scheduled after the battle started').toBe(w1);
    expect(idles).toBe(0);
    expect(pending.length).toBe(0);
    expect(audio.battleMusicStats().state).toBe('ready');

    // 2. Begin as soon as the calm layer is in: the battle starts and the rest of the track renders during it.
    audio.releaseBattleMusic();
    renders = 0;
    waits = 0;
    const rest = audio.loadBattleMusic('arras');
    const startable = audio.battleMusicStartable('arras');
    pending.shift()?.();
    await flush();
    expect(await startable, 'the opening calm layer is enough to start').toBe(true);
    // The first piece renders alone, then MUSIC_BATTLE.render.lanes at a time.
    const lanes = MUSIC_BATTLE.render.lanes;
    expect(lanes).toBeGreaterThanOrEqual(1);
    expect(renders).toBe(1 + lanes);
    audio.setBattleLayer('combat');
    audio.prepareBattleMusic('arras');
    audio.tickBattleMusic();
    // Until the combat layer is in, the music stays on the calm one.
    expect(audio.battleMusicStats().player?.started).toBe(true);
    expect(audio.battleMusicStats().player?.active).toBe('build');
    expect(audio.battleMusicStats().state).toBe('rendering');
    // The pieces in flight when the battle started land; after them, one piece at a time, each after an idle wait.
    const waitsAtStart = waits;
    for (let i = 0; i < lanes; i++) {
      pending.shift()?.();
      await flush();
    }
    for (let guard = 0; guard < 200 && pending.length > 0; guard++) {
      expect(pending.length, 'one piece at a time once the battle runs').toBe(1);
      const before = idles;
      pending.shift()?.();
      await flush();
      expect(idles, 'each piece in the battle waits for an idle moment').toBe(before + 1);
    }
    expect(waits, 'the briefing gap is not used in the battle').toBe(waitsAtStart);
    expect(await rest).toBe(true);
    expect(renders, 'every piece once, none twice').toBe(total);
    expect(audio.battleMusicStats().state).toBe('ready');
    expect(audio.battleMusicStats().piecesReady).toBe(total);
    await battle();
    expect(renders).toBe(total);

    // 3. A battle on a track never loaded (the debug hooks start battles straight away) stays silent.
    audio.releaseBattleMusic();
    renders = 0;
    waits = 0;
    audio.prepareBattleMusic('arras');
    await battle();
    await finishAll();
    expect(renders).toBe(0);
    expect(waits).toBe(0);
    expect(audio.battleMusicStats().state).toBe('skipped');
    expect(audio.battleMusic()).toBe(null);
    expect(audio.endBattleMusic(true, true)).toBe(false);
  });

  it('frees the buffers when the battle is left, and drops pieces that finish rendering afterwards', async () => {
    const { audio, rendered, flush } = engine();
    void audio.loadBattleMusic('arras');
    await flush();
    audio.prepareBattleMusic('arras');
    expect(audio.battleMusicStats().bytes).toBeGreaterThan(0);
    const player = audio.battleMusic();
    audio.releaseBattleMusic();
    expect(audio.battleMusicStats().bytes).toBe(0);
    expect(audio.battleMusicStats().state).toBe('idle');
    expect(audio.battleMusic()).toBe(null);
    expect(player?.bytes()).toBe(0);
    // Released while rendering (back to the map from the briefing): what was still on its way never lands.
    rendered.length = 0;
    const load = audio.loadBattleMusic('arras');
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    const partly = audio.battleMusic();
    audio.releaseBattleMusic();
    expect(await load).toBe(false);
    await flush();
    expect(rendered.length).toBeLessThan(battlePieces(ARRAS).length);
    expect(partly?.bytes()).toBe(0);
    expect(audio.battleMusicStats().bytes).toBe(0);
  });

  it('keeps what is rendered for a restart or a replay of the same track and starts it from the top', async () => {
    const { audio, rendered, flush } = engine();
    void audio.loadBattleMusic('arras');
    await flush();
    audio.prepareBattleMusic('arras');
    audio.tickBattleMusic();
    const count = rendered.length;
    const player = audio.battleMusic();
    // The result screen's Replay loads again: nothing renders, it is ready at once.
    const progress: number[] = [];
    expect(await audio.loadBattleMusic('arras', (ready) => progress.push(ready))).toBe(true);
    expect(progress).toEqual([count]);
    audio.prepareBattleMusic('arras');
    audio.tickBattleMusic();
    await flush();
    expect(rendered.length).toBe(count);
    expect(audio.battleMusic()).toBe(player);
    expect(audio.battleMusicStats().player?.sectionsPlayed).toBeGreaterThan(0);
    // Another track replaces it.
    void audio.loadBattleMusic('brest');
    await flush();
    expect(audio.battleMusic()).not.toBe(player);
    expect(player?.bytes()).toBe(0);
    expect(audio.battleMusicStats().track).toBe('brest');
  });

  it('a second ask joins the load under way, before the battle and during it; every piece renders once', async () => {
    const { audio, rendered, flush } = engine();
    const first = audio.loadBattleMusic('arras');
    const again = audio.loadBattleMusic('arras');
    expect(again).toBe(first);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    audio.prepareBattleMusic('arras');
    // A Retry from the result screen while the battle's music is still coming in joins the same load.
    expect(audio.loadBattleMusic('arras')).toBe(first);
    expect(await first).toBe(true);
    await flush();
    const s = audio.battleMusicStats();
    expect(s.state).toBe('ready');
    expect(s.piecesReady).toBe(s.piecesTotal);
    expect(rendered.length).toBe(battlePieces(ARRAS).length);
  });

  it('answers false and never hangs when the render fails; the battle then starts without music', async () => {
    const ctx = new Context();
    const audio = createAudio({ context: ctx as unknown as BaseAudioContext, wait: () => Promise.resolve(), renderPiece: () => Promise.reject(new Error('no')) });
    expect(await audio.loadBattleMusic('arras')).toBe(false);
    expect(audio.battleMusicStats().state).toBe('failed');
    audio.prepareBattleMusic('arras');
    audio.tickBattleMusic();
    expect(audio.battleMusicStats().player?.started ?? false).toBe(false);
    expect(audio.endBattleMusic(false, true)).toBe(false);
  });

  it('the app starts a battle once the calm layer is in, the rest rendering during it; a replay renders nothing again', async () => {
    const ctx = new Context();
    let renders = 0;
    const audio = createAudio({
      context: ctx as unknown as BaseAudioContext,
      wait: () => Promise.resolve(),
      renderPiece: (def, piece, rate): Promise<RenderedPiece> => {
        renders++;
        return Promise.resolve({ piece, buffer: fakeBuffer(pieceFrames(def, piece, rate), rate, piece.sting ?? `${piece.section}/${piece.layer}`) as unknown as AudioBuffer, buildMs: 1, buildMsTotal: 1, renderMs: 2, peak: 0.5 });
      },
    });
    const view = createFakeView();
    const app = new App({ view, audio, storage: createMemoryStorage(), missions: [quickMission(1, true)], upgradeDefs: [], random: () => 0.25 });
    app.attachUi(createFakeUi());
    const flush = async (): Promise<void> => {
      for (let i = 0; i < 50; i++) await Promise.resolve();
    };
    const frames = async (n: number): Promise<void> => {
      for (let i = 0; i < n; i++) {
        ctx.currentTime += 1 / 60;
        view.frame?.(1000 / 60);
        if (i % 30 === 0) await flush();
      }
    };
    app.onScreen('campaign');
    app.onScreen('briefing');
    const music = app.missions[0].music;
    const progress: number[] = [];
    expect(await app.loadMission(1, (f) => progress.push(f))).toBe(true);
    const all = battlePieces(BATTLE_TRACKS[music]).length;
    // Begin waits for the opening calm layer only.
    expect(audio.battleMusicStats().piecesReady).toBeGreaterThanOrEqual(1);
    expect(renders).toBeLessThan(all);
    expect(progress[progress.length - 1]).toBe(1);
    app.startMission(1, 'normal');
    app.onScreen('battle');
    await frames(600);
    expect(renders, 'the rest rendered during the battle, each piece once').toBe(all);
    expect(audio.battleMusicStats().state).toBe('ready');
    expect(audio.battleMusicStats().player?.started).toBe(true);
    // Win it, then Replay from the result screen: the same music, nothing rendered again.
    app.dispatch({ type: 'order', order: 'advance' });
    for (let i = 0; i < 2000 && app.lastResult === null; i++) view.frame?.(250);
    expect(app.lastResult).not.toBe(null);
    app.onScreen('result');
    expect(await app.loadMission(1)).toBe(true);
    app.startMission(1, 'normal');
    app.onScreen('battle');
    await frames(300);
    expect(renders).toBe(all);
    // Back to the map: the music goes; the briefing renders it again.
    app.onScreen('campaign');
    expect(audio.battleMusicStats().bytes).toBe(0);
    expect(await app.loadMission(1)).toBe(true);
    await flush();
    expect(renders).toBe(all * 2);
  });

  it('carries on silently without an OfflineAudioContext', async () => {
    const bare = createAudio();
    expect(await bare.loadBattleMusic('arras')).toBe(false);
    expect(bare.battleMusicStats().state).toBe('unavailable');
    bare.prepareBattleMusic('arras');
    expect(bare.battleMusicStats().state).toBe('unavailable');
    bare.setBattleLayer('combat');
    bare.tickBattleMusic();
    expect(bare.endBattleMusic(true, true)).toBe(false);
    bare.releaseBattleMusic();
  });
});
