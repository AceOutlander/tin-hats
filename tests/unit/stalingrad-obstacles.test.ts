/**
 * The Stalingrad missions on obstacles and water (FOUNDATIONS.md 4.4, 4.6 and 4.8; STALINGRAD_BUILD.md): the Mukhavets
 * and the Don under their bridges, the Kalach bridge's demolition and the pontoon, the Volga ferry and its river
 * barrage, the tank traps, sandbags and minefields the preps offer, and the minefields in front of the Romanian line
 * and on the western steppe.
 */
import { describe, expect, it } from 'vitest';
import { getMission } from '../../src/data/missions';
import { STALINGRAD_MISSIONS } from '../../src/data/missions/stalingrad';
import type { BuildableId, MissionDef } from '../../src/data/schema';
import { PREP } from '../../src/data/prep';
import type { Battle } from '../../src/sim';
import { groundCell, type World } from '../../src/sim/world';
import { collect, makeBattle, run } from './sim-helpers';

const world = (b: Battle): World => b as unknown as World;
const mission = (id: number): MissionDef => getMission(id)!;

function offered(m: MissionDef): Set<BuildableId> {
  const out = new Set<BuildableId>();
  for (const p of [m.prep, ...(m.phases ?? []).map((ph) => ph.prep)]) for (const b of p?.buildables ?? []) out.add(b);
  return out;
}

describe('the Stalingrad missions on obstacles and water', () => {
  it('span every river a vehicle must cross with a bridge, and keep the Volga bridgeless', () => {
    for (const id of [1001, 1009]) {
      const m = mission(id);
      const water = (m.sectors ?? []).filter((s) => s.ground === 'water');
      expect(water.length).toBeGreaterThan(0);
      for (const w of water) expect((m.bridges ?? []).some((b) => b.x0 <= w.from && b.x1 >= w.to && b.standing !== false)).toBe(true);
    }
    const volga = mission(1005);
    expect((volga.sectors ?? []).some((s) => s.ground === 'water')).toBe(true);
    expect(volga.bridges ?? []).toHaveLength(0);
    // The battles start with the bridges down as road and the Volga a barrier.
    const brest = makeBattle({ mission: mission(1001) });
    const g = world(brest).ground!;
    expect(g.block[groundCell(g, 3900)]).toBe(0);
    const crossing = makeBattle({ mission: volga });
    const v = world(crossing).ground!;
    expect(v.block[groundCell(v, 3500)]).toBe(1);
  });

  it('offer what each brief asks of its prep phases', () => {
    const want: [number, BuildableId[]][] = [
      [1001, ['wire', 'sandbags']],
      [1003, ['tankTrap', 'roadBlock', 'wire', 'foxhole', 'trench']],
      [1005, ['sandbags']],
      [1006, ['sandbags']],
      [1007, ['minefield', 'sandbags', 'wire']],
      [1008, ['tankTrap', 'roadBlock', 'minefield', 'sandbags', 'wire']],
    ];
    for (const [id, kinds] of want) for (const k of kinds) expect(offered(mission(id)).has(k), `${id} ${k}`).toBe(true);
    // Every buildable a mission names exists.
    for (const m of STALINGRAD_MISSIONS) for (const k of offered(m)) expect(PREP.buildables[k]).toBeDefined();
    // 1003's bot puts the traps across the road at 6,000 and 1008's in the yard.
    expect(mission(1003).prep?.bot?.some((s) => s.kind === 'tankTrap' && Math.abs(s.x - 6000) <= 50)).toBe(true);
    expect(mission(1008).prep?.bot?.some((s) => s.kind === 'tankTrap' && s.x > 7000 && s.x < 9500)).toBe(true);
  });

  it('lay the brief minefields: AP at 3,800 in 1009, mixed at 6,600 in 1010 (in place of the wire that stood in)', () => {
    const u = mission(1009).minefields ?? [];
    expect(u.some((f) => f.mines === 'ap' && Math.abs(f.x - 3800) <= 100 && f.owner === 1)).toBe(true);
    const r = mission(1010);
    expect((r.minefields ?? []).some((f) => Math.abs(f.x - 6600) <= 100 && f.owner === 1)).toBe(true);
    expect(r.wire.some((w) => w.x === 6600)).toBe(false);
    // The bombardment's fifth barrage lands on it.
    expect(r.events.some((e) => e.type === 'barrage' && e.side === 0 && Math.abs(e.x - 6600) <= 100)).toBe(true);
  });

  it('wire the Kalach bridge to P5: the demolition at 180 s, and the pontoon 180 s after it goes', () => {
    const m = mission(1009);
    const bridge = (m.bridges ?? []).find((b) => b.id === 1)!;
    expect(bridge.point).toBe('P5');
    expect(bridge.demolition).toEqual({ side: 1, wired: true });
    expect((m.capturePoints ?? []).some((p) => p.id === 'P5' && p.x >= bridge.x0 && p.x <= bridge.x1)).toBe(true);
    expect(m.events.some((e) => e.type === 'demolish' && e.bridge === 1 && JSON.stringify(e.when) === JSON.stringify({ phase: 'bridge', delay: 180 }))).toBe(true);
    const pontoon = (m.bridges ?? []).find((b) => b.standing === false)!;
    expect(pontoon.look).toBe('pontoon');
    expect(m.events.some((e) => e.type === 'bridge' && e.bridge === pontoon.id && 'structureDestroyed' in e.when)).toBe(true);
    const phase = m.phases!.find((p) => p.id === 'bridge')!;
    expect(phase.objectives[0]).toMatchObject({ type: 'capture', point: { point: 'P5' } });
    expect(phase.sideObjectives?.[0]).toMatchObject({ withinPhase: 180, objective: { type: 'capture', point: { point: 'P5' } } });
  });

  it('bring 1005 over the Volga by ferry: a boat every 40 s, the river barrage taking 30% of the 80 s load', () => {
    const m = mission(1005);
    const landing = (m.capturePoints ?? []).find((p) => p.id === 'P1')!;
    expect(landing.batchEvery).toBe(40);
    expect(landing.ferry?.hitShare).toBe(0.3);
    const side = m.phases![0].sideObjectives!.find((s) => s.id === 'ashore')!;
    expect(side.failIf).toEqual({ type: 'ferryLoads', point: 'P1', count: 2 });
    for (const seed of [1, 2, 3]) {
      const b = makeBattle({ mission: m, seed, commanders: ['bot', 'ai'] });
      const hits = collect(b, 82, 'ferryHit');
      expect(hits, `seed ${seed}`).toHaveLength(1);
      expect(hits[0].time).toBeGreaterThan(60);
      expect(hits[0].time).toBeLessThan(80);
      const f = b.state.ferries[0];
      expect(f.loadsLost).toBe(1);
      expect(f.landed).toBe(2);
    }
  });

  it('play the Kalach demolition: blown at 180 s when P5 is not taken, then the pontoon', () => {
    const m = mission(1009);
    // Jump to the bridge phase with nobody near the bridge: the Germans blow it on time.
    const b = makeBattle({ mission: m, commanders: ['idle', 'idle'] });
    const w = world(b);
    b.admin({ type: 'jumpPhase', phase: 'bridge' });
    const blown = collect(b, 185, 'bridgeBlown');
    expect(blown).toHaveLength(1);
    expect(b.state.bridges[0].standing).toBe(false);
    const g = w.ground!;
    expect(g.block[groundCell(g, 24000)]).toBe(1);
    expect(collect(b, 185, 'bridgeBuilt')).toHaveLength(1);
    expect(g.block[groundCell(g, 24000)]).toBe(0);
    run(b, 1);
  });
});
