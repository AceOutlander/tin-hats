import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/data/config';
import type { ForceDef, MissionDef } from '../../src/data/schema';
import { UNITS } from '../../src/data/units';
import { WEAPONS } from '../../src/data/weapons';
import { spawnSmoke } from '../../src/sim/projectiles';
import type { World } from '../../src/sim/world';
import { checkInvariants, collect, eventsOf, makeBattle, run, testMission, type Seen } from './sim-helpers';

const DT = 1 / CONFIG.tickRate;

/** Side 0 `shooters` against a stream of stationary side-1 sappers (no HQ, so they never move) at `targetX`. */
function range(shooters: ForceDef[], targetX: number, count = 1, every = 1.5): MissionDef {
  return testMission({
    length: 3000,
    a: { forces: shooters },
    b: { hasHq: false },
    events: [{ type: 'wave', when: { every, from: 0 }, side: 1, forces: [{ kind: 'sapper', count, x: targetX }] }],
  });
}

/** A unit posted at x that stays there and fires at whatever is in range. */
const posted = (kind: ForceDef['kind'], x: number): ForceDef => ({ kind, count: 1, x, behaviour: 'guard' });

describe('projectiles', () => {
  for (const [kind, weapon] of [
    ['mortar', 'mortar'],
    ['tank', 'tankGun'],
  ] as const) {
    it(`${weapon}: a shot launches a projectile that lands after its flight time and explodes`, () => {
      const b = makeBattle({ mission: range([posted(kind, 700)], 1050) });
      const w = WEAPONS[weapon];
      const events: Seen[] = [];
      run(b, 20, () => {
        checkInvariants(b);
        for (const p of b.state.projectiles) {
          if (!p.alive) continue;
          expect(p.x).toBeGreaterThanOrEqual(Math.min(p.fromX, p.toX) - 1e-9);
          expect(p.x).toBeLessThanOrEqual(Math.max(p.fromX, p.toX) + 1e-9);
        }
        for (let i = 0; i < b.events.count; i++) {
          const e = b.events.items[i];
          if (e.type === 'projectile' || e.type === 'explosion' || e.type === 'shot') events.push({ ...e, time: b.state.time });
        }
      });
      const launched = events.filter((e) => e.type === 'projectile');
      expect(launched.length).toBeGreaterThan(1);
      for (const p of launched) {
        expect(p).toMatchObject({ side: 0, weapon, source: 'unit', x: 700 });
        expect(p.value).toBeCloseTo(Math.abs(p.x2 - p.x) / w.projectileSpeed, 9);
        // Scatter: within four standard deviations of the aim point.
        expect(Math.abs(p.x2 - 1050)).toBeLessThan(4 * w.scatter);
        // The shot that launched it is reported in the same step, without a hit roll.
        expect(events.some((e) => e.type === 'shot' && e.time === p.time && e.weapon === weapon && !e.hit)).toBe(true);
        const boom = events.find((e) => e.type === 'explosion' && e.time > p.time && e.x === p.x2);
        if (p.time + p.value < b.state.time - DT) {
          expect(boom).toBeDefined();
          expect(boom?.value).toBe(w.splashRadius);
          expect(boom?.cause).toBe(w.damageType);
          expect(boom?.time ?? 0).toBeGreaterThanOrEqual(p.time + p.value - 1e-6);
          expect(boom?.time ?? 0).toBeLessThanOrEqual(p.time + p.value + DT + 1e-6);
        }
      }
    });
  }

  it('keeps a mortar from firing inside its minimum range', () => {
    const near = makeBattle({ mission: range([posted('mortar', 700)], 700 + WEAPONS.mortar.minRange - 40) });
    expect(collect(near, 20, 'shot').filter((e) => e.weapon === 'mortar')).toHaveLength(0);
    const far = makeBattle({ mission: range([posted('mortar', 700)], 700 + WEAPONS.mortar.minRange + 40) });
    expect(collect(far, 20, 'shot').filter((e) => e.weapon === 'mortar').length).toBeGreaterThan(0);
  });

  it('splashes enemies with damage falling off linearly from the edge of each footprint, and spares friends', () => {
    const b = makeBattle({ mission: range([posted('mortar', 700)], 1100, 4, 2) });
    const w = WEAPONS.mortar;
    const half = UNITS.sapper.width / 2;
    let checked = 0;
    let partial = 0;
    run(b, 60, () => {
      const booms = eventsOf(b, 'explosion');
      const hits = eventsOf(b, 'unitHit');
      for (const h of hits) expect(h.side).toBe(1);
      if (booms.length !== 1) return;
      for (const h of hits) {
        const d = Math.max(0, Math.abs(h.x - booms[0].x) - half);
        expect(d).toBeLessThanOrEqual(w.splashRadius);
        expect(h.value).toBeCloseTo(w.damage * (1 - d / w.splashRadius), 9);
        checked++;
        if (d > 0) partial++;
      }
    });
    expect(checked).toBeGreaterThan(3);
    expect(partial).toBeGreaterThan(0);
  });
});

describe('smoke', () => {
  it('blocks direct and hitscan fire through the cloud, but not lobbed fire, until it blows away', () => {
    const b = makeBattle({ mission: range([{ kind: 'rifle', count: 2 }, { kind: 'at', count: 1 }, posted('mortar', 700)], 1050) });
    const world = b as unknown as World;
    spawnSmoke(world, 950, 40, 10, 0);
    const spawned = eventsOf(b, 'smokeSpawned');
    expect(spawned).toHaveLength(1);
    expect(spawned[0]).toMatchObject({ side: 0, x: 950, value: 40, x2: 10 });
    expect(world.smokeCount).toBe(1);
    expect(b.state.smokes.filter((s) => s.alive)).toHaveLength(1);

    const during = collect(b, 9.5, 'shot');
    expect(during.filter((e) => e.weapon === 'rifle' || e.weapon === 'rocket')).toHaveLength(0);
    expect(during.filter((e) => e.weapon === 'mortar').length).toBeGreaterThan(0);

    run(b, 1);
    expect(world.smokeCount).toBe(0);
    expect(b.state.smokes.every((s) => !s.alive)).toBe(true);
    const after = collect(b, 10, 'shot');
    expect(after.filter((e) => e.weapon === 'rifle').length).toBeGreaterThan(0);
    expect(after.filter((e) => e.weapon === 'rocket').length).toBeGreaterThan(0);
  });

  it('does not stop a shooter at point-blank range', () => {
    const mission = testMission({
      length: 3000,
      a: { forces: [{ kind: 'assault', count: 1 }] },
      b: { hasHq: false, forces: [{ kind: 'sapper', count: 1, x: 1300 }] },
    });
    const b = makeBattle({ mission });
    spawnSmoke(b as unknown as World, 1300, 100, 60, 1);
    b.command(0, { type: 'order', order: 'advance' });
    const shots = collect(b, 30, 'shot').filter((e) => e.weapon === 'smg');
    expect(shots.length).toBeGreaterThan(0);
    for (const e of shots) expect(Math.abs(e.x2 - e.x)).toBeLessThanOrEqual(CONFIG.smokePointBlank);
  });
});
