import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/data/config';
import { nationFields } from '../../src/data/factions';
import { MISSIONS } from '../../src/data/missions';
import { SANDBOX, SANDBOX_MIRROR } from '../../src/data/missions/sandbox';
import type { ForceDef, MissionDef, UnitKind } from '../../src/data/schema';
import { UNITS } from '../../src/data/units';
import { createBattle, runBattle, type Battle } from '../../src/sim';
import { checkInvariants, configOf, countAlive, makeBattle, run, snapshot } from './sim-helpers';

const ALL_KINDS = Object.keys(UNITS) as UnitKind[];
/** Every kind the nation of a sandbox side fields (other nations' signature kinds, such as Soviet conscripts, are not). */
const sideKinds = (side: 0 | 1): UnitKind[] => ALL_KINDS.filter((kind) => nationFields(SANDBOX.start[side].faction, kind));

describe('the sandbox grounds', () => {
  it('give both sides everything on an 8000 wu field with one friendly and two enemy trench lines, wire and two enemy pillboxes', () => {
    expect(MISSIONS).not.toContain(SANDBOX);
    expect(MISSIONS).not.toContain(SANDBOX_MIRROR);
    expect(SANDBOX.length).toBe(8000);
    expect(SANDBOX.trenches.filter((t) => t.owner === 0)).toHaveLength(1);
    expect(SANDBOX.trenches.filter((t) => t.owner === 1)).toHaveLength(2);
    expect(SANDBOX.pillboxes.filter((p) => p.side === 1)).toHaveLength(2);
    expect(SANDBOX.wire.length).toBeGreaterThan(0);
    for (const side of [0, 1] as const) {
      expect([...SANDBOX.units[side]].sort()).toEqual(sideKinds(side).sort());
      // The player also gets the plane call-ins; the enemy keeps the classic three.
      expect([...SANDBOX.supports[side]].sort()).toEqual(side === 0 ? ['airStrike', 'artillery', 'bomber', 'fighter', 'recon', 'smoke'] : ['airStrike', 'artillery', 'smoke']);
      expect(SANDBOX.start[side].supplies).toBeGreaterThanOrEqual(2000);
    }
    const b = makeBattle({ mission: SANDBOX });
    for (const side of b.state.sides) {
      for (const kind of ALL_KINDS) expect(side.available[kind]).toBe(UNITS[kind].trainable && nationFields(side.faction, kind));
      expect(side.pop).toBeLessThanOrEqual(side.popCap);
    }
  });

  it('mirrors the fairness ground exactly about its middle', () => {
    const m = SANDBOX_MIRROR;
    const mirror = (x: number) => m.length - x;
    const [t0, t1] = m.trenches;
    expect(t0.owner).toBe(0);
    expect(t1.owner).toBe(1);
    expect(mirror(t0.x)).toBe(t1.x);
    expect([t0.width, t0.slots]).toEqual([t1.width, t1.slots]);
    const [w0, w1] = m.wire;
    expect([w0.owner, w1.owner]).toEqual([0, 1]);
    expect(mirror(w0.x)).toBe(w1.x);
    expect(w0.width).toBe(w1.width);
    expect(m.pillboxes).toHaveLength(0);
    const strip = (forces: ForceDef[]) => forces.map((f) => ({ ...f, trenchId: f.trenchId === undefined ? undefined : 'own' }));
    const [s0, s1] = m.start;
    expect({ ...s0, faction: '', forces: strip(s0.forces) }).toEqual({ ...s1, faction: '', forces: strip(s1.forces) });
    for (const f of s0.forces) if (f.trenchId !== undefined) expect(f.trenchId).toBe(t0.id);
    for (const f of s1.forces) if (f.trenchId !== undefined) expect(f.trenchId).toBe(t1.id);
  });
});

describe('sandbox battles with the AI on both sides', () => {
  it('keep every invariant on every tick over 20 seeds', () => {
    let kills = 0;
    let captures = 0;
    let wrecked = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const b = makeBattle({ mission: SANDBOX, seed, commanders: ['ai', 'ai'] });
      run(b, 240, () => {
        checkInvariants(b);
        for (let i = 0; i < b.events.count; i++) {
          const e = b.events.items[i];
          if (e.type === 'trenchCaptured') captures++;
          else if (e.type === 'structureDestroyed' && e.target === 'pillbox') wrecked++;
        }
      });
      kills += b.state.sides[0].stats.kills + b.state.sides[1].stats.kills;
    }
    // The battles really fought over the fortifications.
    expect(kills).toBeGreaterThan(200);
    expect(captures).toBeGreaterThan(0);
    expect(wrecked).toBeGreaterThan(0);
  });

  it('are deterministic: the same seed gives the same battle, another seed another', () => {
    const play = (seed: number): string => {
      const b = makeBattle({ mission: SANDBOX, seed, commanders: ['ai', 'ai'] });
      let digest = 0;
      run(b, 200, () => {
        for (let i = 0; i < b.events.count; i++) {
          const e = b.events.items[i];
          digest = (digest * 31 + e.type.length * 7 + Math.round(e.x * 10) + Math.round(e.x2 * 10) + Math.round(e.value * 1000)) % 1_000_000_007;
        }
      });
      return `${snapshot(b)}#${digest}`;
    };
    const first = play(5);
    expect(play(5)).toBe(first);
    expect(play(6)).not.toBe(first);
  });

  it('are fair on the mirrored ground: over 20 seeds each side wins a fair share', () => {
    const wins = [0, 0];
    for (let seed = 1; seed <= 20; seed++) {
      const r = runBattle(configOf({ mission: SANDBOX_MIRROR, seed, commanders: ['ai', 'ai'] }), 1200);
      if (r.winner === 0 || r.winner === 1) wins[r.winner]++;
    }
    expect(wins[0] + wins[1]).toBeGreaterThanOrEqual(15);
    expect(Math.min(wins[0], wins[1])).toBeGreaterThanOrEqual(5);
  });
});

describe('sandbox performance', () => {
  /** Forty units a side (80 in all) of every kind on the sandbox, garrisons in the trenches, the AI on both sides attacking at once. */
  function crowd(seed: number): Battle {
    const army = (trenchId: number): ForceDef[] => [
      { kind: 'rifle', count: 6, trenchId },
      { kind: 'rifle', count: 14 },
      { kind: 'lmg', count: 3 },
      { kind: 'assault', count: 4 },
      { kind: 'mortar', count: 2 },
      { kind: 'sniper', count: 2 },
      { kind: 'medic', count: 2 },
      { kind: 'at', count: 2 },
      { kind: 'tank', count: 1 },
    ];
    const mission: MissionDef = {
      ...SANDBOX,
      ai: { ...SANDBOX.ai, firstAttackAfter: 0 },
      start: [
        { ...SANDBOX.start[0], sappers: 4, forces: army(1) },
        { ...SANDBOX.start[1], sappers: 4, forces: army(2) },
      ],
    };
    return createBattle(configOf({ mission, commanders: ['ai', 'ai'], seed }));
  }

  function warmUp(): void {
    for (const seed of [11, 12]) {
      const b = crowd(seed);
      while (!b.state.over && b.state.tick < 9000) b.step();
    }
  }

  it('steps 80 units of every kind in well under a millisecond', () => {
    warmUp();
    const b = crowd(3);
    expect(countAlive(b)).toBe(80);
    run(b, 5);
    let units = 0;
    let steps = 0;
    const t0 = performance.now();
    // The march into contact and the first clash.
    run(b, 25, () => {
      steps++;
      units += countAlive(b);
    });
    const perStep = (performance.now() - t0) / steps;
    expect(units / steps).toBeGreaterThan(60);
    expect(perStep).toBeLessThan(0.5);
  });

  it('does not allocate in the steady state, projectiles and all', () => {
    warmUp();
    const b = crowd(3);
    const heap = (): number => process.memoryUsage().heapUsed;
    const before = heap();
    const steps = 3000;
    let projectiles = 0;
    for (let i = 0; i < steps; i++) {
      b.step();
      for (let k = 0; k < b.events.count; k++) if (b.events.items[k].type === 'projectile') projectiles++;
    }
    const grown = heap() - before;
    expect(projectiles).toBeGreaterThan(20);
    expect(grown).toBeLessThan(steps * 100);
    expect(CONFIG.maxProjectiles).toBeGreaterThanOrEqual(64);
  });
});
