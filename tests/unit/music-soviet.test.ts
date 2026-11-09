/**
 * The Soviet campaign's music (docs/MUSIC.md, docs/campaigns/STALINGRAD.md): the motif "The Long Winter", the cold
 * battle tracks and their two new instruments (choir and wind), the thinned reverb, the Stalingrad map track, and the
 * table that tells every Stalingrad mission which track to play.
 */
import { describe, expect, it } from 'vitest';
import { battleGraph, battlePieces, distinctSeconds, pieceParts, trackBytes } from '../../src/audio/music/battle';
import { playBattleChoir, playWind } from '../../src/audio/music/instruments';
import type { NoiseBank } from '../../src/audio/synth';
import { CAMPAIGNS } from '../../src/data/campaigns';
import { MINOR_SCALE, MUSIC_TRACKS } from '../../src/data/music';
import { STALINGRAD_MISSIONS } from '../../src/data/missions/stalingrad';
import { MUSIC_BATTLE, type BattleTrackDef } from '../../src/data/musicBattle';
import { STALINGRAD_MUSIC, type StalingradMissionId } from '../../src/data/musicCampaigns';
import { STALINGRAD_MAP } from '../../src/data/musicMapSoviet';
import { degreeNote, motif, SOVIET_ANSWER, SOVIET_MOTIF, THEMES } from '../../src/data/musicThemes';
import { BATTLE_TRACKS, BATTLE_TRACK_NAMES } from '../../src/data/musicTracks';
import { BATTLE_MIX } from '../../src/data/musicTracks/kit';
import { SOVIET_KIT, SOVIET_MIX } from '../../src/data/musicTracks/sovietKit';

/** Recording stand-ins for the WebAudio nodes the instruments touch. */
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
}

class Node {
  outputs: unknown[] = [];
  started: number | null = null;
  stopped: number | null = null;
  buffer: unknown = null;
  loop = false;
  normalize = false;
  type = '';
  readonly gain = new Param();
  readonly frequency = new Param();
  readonly detune = new Param();
  readonly Q = new Param();
  constructor(readonly kind: string) {
    this.gain.value = 1;
  }
  connect(t: unknown): void {
    this.outputs.push(t);
  }
  start(t = 0): void {
    this.started = t;
  }
  stop(t = 0): void {
    this.stopped = t;
  }
}

class Context {
  sampleRate = 16000;
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
  createBiquadFilter(): Node {
    return this.make('filter');
  }
  createOscillator(): Node {
    return this.make('oscillator');
  }
  createBufferSource(): Node {
    return this.make('bufferSource');
  }
  createConvolver(): Node {
    return this.make('convolver');
  }
  createBuffer(_c: number, length: number, sampleRate: number): { length: number; sampleRate: number; duration: number; getChannelData: () => Float32Array } {
    const data = new Float32Array(length);
    return { length, sampleRate, duration: length / sampleRate, getChannelData: () => data };
  }
}

const bank: NoiseBank = { get: () => ({ duration: 2, sampleRate: 16000 }) as unknown as AudioBuffer };

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

const SOVIET = BATTLE_TRACK_NAMES.filter((n) => BATTLE_TRACKS[n].theme === 'sovietWinter');

describe('the Soviet motif, "The Long Winter"', () => {
  it('is three bars of 4/4 in degrees, level on the tonic, ending open on the low dominant; its one-bar answer comes home', () => {
    expect(THEMES.sovietWinter.motif).toBe(SOVIET_MOTIF);
    expect(THEMES.sovietWinter.answer).toBe(SOVIET_ANSWER);
    expect(SOVIET_MOTIF.beats).toBe(12);
    expect(SOVIET_MOTIF.notes.map((n) => n[2])).toEqual([0, 0, -1, 0, 3, 2, 4, 1, 2, -3]);
    expect(Math.max(...SOVIET_MOTIF.notes.map(([at, len]) => at + len))).toBe(12);
    expect(SOVIET_ANSWER.beats).toBe(4);
    expect(SOVIET_ANSWER.notes.map((n) => n[2])).toEqual([-3, 0, 2, 3, 0]);
    expect(Math.max(...SOVIET_ANSWER.notes.map(([at, len]) => at + len))).toBe(4);
    // Motif and answer together are a four-bar phrase: two of them fill an eight-bar section.
    expect(SOVIET_MOTIF.beats + SOVIET_ANSWER.beats).toBe(16);
  });

  it('sounds in E minor as E E D E, A G B F# G, and the low B', () => {
    const E4 = 64;
    expect(motif(SOVIET_MOTIF, { tonic: E4 }).map((e) => e.note)).toEqual([64, 64, 62, 64, 69, 67, 71, 66, 67, 59]);
    expect(motif(SOVIET_ANSWER, { tonic: E4 }).map((e) => e.note)).toEqual([59, 64, 67, 69, 64]);
    expect(degreeNote(E4, 'minor', -3)).toBe(59);
  });
});

describe('the cold battle tracks', () => {
  it('are registered, at least one for the 1941 snow and one for the Stalingrad ruins', () => {
    expect(SOVIET).toContain('volokolamsk');
    expect(SOVIET).toContain('factories');
    for (const name of ['brest', 'dubno', 'klin', 'volga']) expect(SOVIET).toContain(name);
  });

  for (const name of SOVIET) {
    const def: BattleTrackDef = BATTLE_TRACKS[name];
    describe(`${name}: ${def.title}`, () => {
      it('is built on the cold kit: the thinned bright room, dry timpani, choir and wind in calm stretches', () => {
        expect(def.mix.reverbHighpass ?? 0).toBeGreaterThan(200);
        expect(def.mix.timpani.send).toBeLessThan(BATTLE_MIX.timpani.send);
        expect(def.reverb.darkHz).toBeGreaterThan(1000);
        const used = new Set(battlePieces(def).flatMap((p) => pieceParts(def, p).map((q) => q.inst)));
        expect(used.has('choir')).toBe(true);
        expect(used.has('wind')).toBe(true);
        expect(used.has('bell') || used.has('anvil')).toBe(true);
      });

      it('keeps choir and wind notes inside their ranges, and holds them (no zero-length voices)', () => {
        for (const p of battlePieces(def)) {
          for (const part of pieceParts(def, p)) {
            if (part.inst !== 'choir' && part.inst !== 'wind') continue;
            const r = def.instruments[part.inst].range;
            for (const e of part.events) {
              expect(e.note, `${part.inst} ${e.note}`).toBeGreaterThanOrEqual(r[0]);
              expect(e.note, `${part.inst} ${e.note}`).toBeLessThanOrEqual(r[1]);
              expect(e.len).toBeGreaterThan(0);
            }
          }
        }
      });

      it('has a prep layer in every section, and stays in the memory budget near the British tracks', () => {
        for (const s of def.sections) expect(s.layers.prep?.length ?? 0, s.name).toBeGreaterThan(0);
        expect(trackBytes(def)).toBeLessThanOrEqual(MUSIC_BATTLE.budget.maxBytes);
        expect(distinctSeconds(def)).toBeGreaterThanOrEqual(MUSIC_BATTLE.budget.minSeconds);
        // Comparable to the British tracks: within a tenth of the largest of them.
        const british = Math.max(...BATTLE_TRACK_NAMES.filter((n) => BATTLE_TRACKS[n].theme === 'british').map((n) => trackBytes(BATTLE_TRACKS[n])));
        expect(trackBytes(def)).toBeLessThanOrEqual(british * 1.1);
      });
    });
  }
});

describe('the choir and the wind', () => {
  it('choir: sawtooth voices through the vowel formants, swelling in and released to silence', () => {
    const ctx = new Context();
    const dest = new Node('dest');
    const s = SOVIET_KIT.choir;
    playBattleChoir(ctx as unknown as BaseAudioContext, dest as unknown as AudioNode, 1, 4, 52, 0.8, s, bank, seeded(3));
    const oscs = ctx.nodes.filter((n) => n.kind === 'oscillator');
    // The voices plus the vibrato.
    expect(oscs.length).toBe(s.voices + 1);
    for (const o of oscs) {
      expect(o.started).toBe(1);
      expect(o.stopped ?? 0).toBeGreaterThanOrEqual(5 + s.release);
    }
    const bands = ctx.nodes.filter((n) => n.kind === 'filter');
    expect(bands.map((b) => b.frequency.value)).toEqual(s.formants.map((f) => f[0]));
    const env = ctx.nodes.find((n) => n.outputs.includes(dest));
    const ev = env?.gain.events ?? [];
    expect(ev[ev.length - 1]).toEqual(['linear', 0, 5 + s.release]);
    const top = Math.max(...ev.map((e) => e[1]));
    expect(top).toBeCloseTo(s.level * 0.8, 9);
  });

  it('wind: a noise band on the note that wanders within its drift and gusts, the same every time for one seed', () => {
    const run = (): Context => {
      const ctx = new Context();
      playWind(ctx as unknown as BaseAudioContext, new Node('dest') as unknown as AudioNode, 0, 16, 81, 0.5, SOVIET_KIT.wind, bank, seeded(11));
      return ctx;
    };
    const a = run();
    const s = SOVIET_KIT.wind;
    const src = a.nodes.find((n) => n.kind === 'bufferSource');
    expect(src?.loop).toBe(true);
    expect(src?.started).toBe(0);
    expect(src?.stopped ?? 0).toBeGreaterThanOrEqual(16 + s.release);
    const band = a.nodes.find((n) => n.kind === 'filter');
    expect(band?.type).toBe('bandpass');
    const f = 440 * Math.pow(2, (81 - 69) / 12);
    const moves = (band?.frequency.events ?? []).filter((e) => e[0] === 'linear');
    expect(moves.length).toBeGreaterThan(3);
    for (const m of moves) {
      expect(Math.abs(1200 * Math.log2(m[1] / f))).toBeLessThanOrEqual(s.driftCents + 1e-6);
      expect(m[2]).toBeLessThan(16);
    }
    const gain = a.nodes.find((n) => n.kind === 'gain');
    const levels = (gain?.gain.events ?? []).map((e) => e[1]);
    expect(Math.max(...levels)).toBeLessThanOrEqual(s.level * 0.5 + 1e-9);
    expect(levels[levels.length - 1]).toBe(0);
    // Deterministic: the same seed schedules the same gusts.
    expect(run().nodes.map((n) => n.frequency.events)).toEqual(a.nodes.map((n) => n.frequency.events));
  });

  it('the cold mix puts a high-pass on the reverb return, and a track without one has none', () => {
    const graph = (def: BattleTrackDef): Context => {
      const ctx = new Context();
      battleGraph(ctx as unknown as BaseAudioContext, ctx.destination as unknown as AudioNode, def, bank, 1);
      return ctx;
    };
    const cold = graph(BATTLE_TRACKS.volokolamsk).nodes.filter((n) => n.kind === 'filter' && n.type === 'highpass');
    expect(cold.length).toBe(1);
    expect(cold[0].frequency.value).toBe(SOVIET_MIX.reverbHighpass);
    expect(graph(BATTLE_TRACKS.arras).nodes.filter((n) => n.kind === 'filter' && n.type === 'highpass').length).toBe(0);
  });
});

describe('the Stalingrad map track, "Versts of Snow"', () => {
  const def = STALINGRAD_MAP;
  const inKey = (note: number): boolean => MINOR_SCALE.includes((((note - def.key.tonic) % 12) + 12) % 12);

  it('is registered, slow, minor and at least two minutes before it repeats', () => {
    expect(MUSIC_TRACKS.stalingradMap).toBe(def);
    expect(def.bpm).toBeLessThanOrEqual(72);
    const seconds = def.sections.reduce((n, s) => n + s.bars, 0) * def.beatsPerBar * (60 / def.bpm);
    expect(seconds).toBeGreaterThanOrEqual(120);
  });

  it('keeps every note in the key unless marked as an accidental, inside its instrument and its section', () => {
    const I = def.instruments;
    for (const s of def.sections) {
      const beats = s.bars * def.beatsPerBar;
      for (const c of s.chords) {
        for (const n of c.notes) {
          expect(inKey(n) || (c.accidentals ?? []).includes(n), `${s.name} chord ${n}`).toBe(true);
          expect(n).toBeGreaterThanOrEqual(I.pad.range[0]);
          expect(n).toBeLessThanOrEqual(I.pad.range[1]);
        }
        expect(c.at + c.beats).toBeLessThanOrEqual(beats);
      }
      for (const [inst, notes] of [
        ['horn', s.horn],
        ['piano', s.piano],
      ] as const) {
        // A map track need not have a piano (the instruments type makes it optional); this one has it.
        const range = I[inst]?.range;
        expect(range, `${s.name} ${inst} settings`).toBeDefined();
        if (!range) continue;
        for (const m of notes) {
          expect(inKey(m.note) || m.accidental === true, `${s.name} ${inst} ${m.note}`).toBe(true);
          expect(m.accidental !== true || !inKey(m.note), `${s.name} ${inst} ${m.note} marked but in key`).toBe(true);
          expect(m.note).toBeGreaterThanOrEqual(range[0]);
          expect(m.note).toBeLessThanOrEqual(range[1]);
          expect(m.at + m.beats).toBeLessThanOrEqual(beats + 1e-9);
        }
      }
      for (const d of s.drums) expect(d.at).toBeLessThan(beats);
    }
  });

  it('states the motif in more than one section', () => {
    const shape = motif(SOVIET_MOTIF, { tonic: 0 }).map((e, i, a) => (i === 0 ? 0 : e.note - a[i - 1].note));
    let found = 0;
    for (const s of def.sections) {
      for (const notes of [s.horn, s.piano]) {
        const iv = notes.map((m, i) => (i === 0 ? 0 : m.note - notes[i - 1].note));
        for (let i = 0; i + 4 <= iv.length; i++) if (iv.slice(i + 1, i + 4).join() === shape.slice(1, 4).join()) found++;
      }
    }
    expect(found).toBeGreaterThanOrEqual(2);
  });
});

describe('the Stalingrad music table', () => {
  it('gives every Stalingrad mission a registered Soviet track, the theme and the map track', () => {
    expect(STALINGRAD_MUSIC.theme).toBe('sovietWinter');
    expect(MUSIC_TRACKS[STALINGRAD_MUSIC.map]).toBeDefined();
    const ids = CAMPAIGNS.stalingrad.missionIds as readonly StalingradMissionId[];
    expect(Object.keys(STALINGRAD_MUSIC.missions).map(Number).sort()).toEqual([...ids].sort());
    for (const id of ids) {
      const name = STALINGRAD_MUSIC.missions[id];
      expect(BATTLE_TRACK_NAMES, `${id}`).toContain(name);
      expect(BATTLE_TRACKS[name].theme, `${id}`).toBe('sovietWinter');
    }
    // The brief's own tracks, where written.
    expect(STALINGRAD_MUSIC.missions[1001]).toBe('brest');
    expect(STALINGRAD_MUSIC.missions[1002]).toBe('dubno');
    expect(STALINGRAD_MUSIC.missions[1003]).toBe('volokolamsk');
    expect(STALINGRAD_MUSIC.missions[1004]).toBe('klin');
    expect(STALINGRAD_MUSIC.missions[1005]).toBe('volga');
    expect(STALINGRAD_MUSIC.missions[1008]).toBe('factories');
    // A planned track is never one that is already registered (it would be in `missions` instead).
    for (const planned of Object.values(STALINGRAD_MUSIC.planned)) expect(BATTLE_TRACK_NAMES).not.toContain(planned);
  });

  it('gives every Stalingrad mission a track of its own: no two share one, a stand-in only while its own is planned', () => {
    const ids = CAMPAIGNS.stalingrad.missionIds as readonly StalingradMissionId[];
    const own = ids.filter((id) => STALINGRAD_MUSIC.planned[id] === undefined);
    const tracks = own.map((id) => STALINGRAD_MUSIC.missions[id]);
    // Missions on their own tracks never share one.
    expect(new Set(tracks).size, tracks.join(', ')).toBe(tracks.length);
    // A mission still on a stand-in borrows another mission's own track, and the track it is to get is unique too, so
    // once every planned track is written all ten are different.
    for (const id of ids.filter((i) => STALINGRAD_MUSIC.planned[i] !== undefined)) expect(tracks, `${id}`).toContain(STALINGRAD_MUSIC.missions[id]);
    const finalTracks = ids.map((id) => STALINGRAD_MUSIC.planned[id] ?? STALINGRAD_MUSIC.missions[id]);
    expect(new Set(finalTracks).size, finalTracks.join(', ')).toBe(ids.length);
    // Every new track written for a mission is that mission's alone.
    for (const name of ['brest', 'dubno', 'klin', 'volga'] as const) expect(ids.filter((id) => STALINGRAD_MUSIC.missions[id] === name).length, name).toBe(1);
  });

  it('is what every Stalingrad mission file plays', () => {
    expect(STALINGRAD_MISSIONS.length).toBe(10);
    for (const m of STALINGRAD_MISSIONS) expect(m.music, `${m.id}`).toBe(STALINGRAD_MUSIC.missions[m.id as StalingradMissionId]);
  });
});

describe('the cold tracks sound different from one another', () => {
  const cold = SOVIET.map((n) => BATTLE_TRACKS[n]);
  /** The instruments that carry at least 8% of a track's combat notes. */
  const profile = (d: BattleTrackDef): string => {
    const count = new Map<string, number>();
    for (const s of d.sections) for (const p of s.layers.combat) count.set(p.inst, (count.get(p.inst) ?? 0) + p.events.length);
    const total = [...count.values()].reduce((a, b) => a + b, 0);
    return [...count.entries()]
      .filter(([, k]) => k / total >= 0.08)
      .map(([inst]) => inst)
      .sort()
      .join('+');
  };
  /** The groove: where in the bar (sixteenths) the combat drums, brass and strings strike, weighted by velocity. */
  const groove = (d: BattleTrackDef): number[] => {
    const h = Array<number>(16).fill(0);
    for (const s of d.sections) {
      for (const p of s.layers.combat) {
        if (!['snare', 'hand', 'anvil', 'timpani', 'brass', 'strings'].includes(p.inst)) continue;
        for (const e of p.events) if (Math.abs(e.at * 4 - Math.round(e.at * 4)) < 1e-6) h[Math.round(e.at * 4) % 16] += e.vel;
      }
    }
    const total = h.reduce((a, b) => a + b, 0);
    return h.map((x) => x / total);
  };

  it('each has its own tempo or key, title and seed', () => {
    expect(new Set(cold.map((d) => `${d.bpm}/${d.tonic}`)).size).toBe(cold.length);
    expect(new Set(cold.map((d) => d.title)).size).toBe(cold.length);
    expect(new Set(cold.map((d) => d.seed)).size).toBe(cold.length);
  });

  it('no two fight on the same instruments in the same groove', () => {
    // Two tracks whose combat layers lean on the same instruments must put their weight on different sixteenths:
    // at least a fifth of it (L1 distance 0.2; British tracks of one kit are mostly 0.1 to 0.2 apart).
    const clashes: string[] = [];
    for (let i = 0; i < cold.length; i++) {
      for (let j = i + 1; j < cold.length; j++) {
        if (profile(cold[i]) !== profile(cold[j])) continue;
        const a = groove(cold[i]);
        const b = groove(cold[j]);
        const dist = a.reduce((s, x, k) => s + Math.abs(x - b[k]), 0);
        if (dist < 0.2) clashes.push(`${cold[i].title} and ${cold[j].title}: ${profile(cold[i])}, groove ${dist.toFixed(2)} apart`);
      }
    }
    expect(clashes).toEqual([]);
  });
});
