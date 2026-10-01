import { describe, expect, it } from 'vitest';
import { AI } from '../../src/data/ai';
import { CONFIG } from '../../src/data/config';
import { getMission } from '../../src/data/missions';
import type { MissionAiPlan, MissionDef, UnitKind } from '../../src/data/schema';
import { UNITS } from '../../src/data/units';
import { collect, makeBattle, mirrored, run, testMission, unitsOf, type MissionOverrides } from './sim-helpers';

const PLAN_ONLY_RIFLES: MissionAiPlan = {
  sappers: 3,
  build: [{ kind: 'rifle', count: 4, after: 0 }],
  firstAttackAfter: 100_000,
};

/** A field where side 1 is run by the AI with `plan` and side 0 is whatever the test makes it. */
function aiField(plan: MissionAiPlan, over: MissionOverrides = {}): MissionDef {
  return testMission({ ai: plan, ...over });
}

describe('AI economy and build plan', () => {
  it('trains sappers up to the plan, then follows the build order', () => {
    const mission = aiField(PLAN_ONLY_RIFLES, { b: { supplies: 500, sappers: 1 } });
    const b = makeBattle({ mission, commanders: ['idle', 'ai'] });
    const mostQueued: Partial<Record<UnitKind, number>> = {};
    run(b, 90, () => {
      const side = b.state.sides[1];
      for (const kind of ['sapper', 'rifle'] as const) {
        mostQueued[kind] = Math.max(mostQueued[kind] ?? 0, side.queue[kind]);
      }
      expect(side.pop).toBeLessThanOrEqual(CONFIG.popCap);
    });
    const side = b.state.sides[1];
    expect(side.alive.sapper).toBe(PLAN_ONLY_RIFLES.sappers);
    expect(side.alive.rifle).toBeGreaterThanOrEqual(4);
    expect(mostQueued.sapper).toBeLessThanOrEqual(AI.maxQueueDepth);
    expect(mostQueued.rifle).toBeLessThanOrEqual(AI.maxQueueDepth);
    // It never builds what the mission does not offer.
    expect(side.alive.lmg + side.alive.tank + side.alive.at).toBe(0);
    // The idle side did nothing at all.
    expect(b.state.sides[0].stats.trained).toBe(0);
  });

  it('waits for the plan step to come due', () => {
    const plan: MissionAiPlan = {
      sappers: 1,
      build: [
        { kind: 'rifle', count: 2, after: 0 },
        { kind: 'rifle', count: 6, after: 60 },
      ],
      firstAttackAfter: 100_000,
    };
    // Modest income: by 58 s it can afford another rifleman (and is below the surplus rule), but the plan does not want one yet.
    const mission = aiField(plan, { b: { supplies: 100, sappers: 1, incomeMul: 0.4 } });
    const b = makeBattle({ mission, commanders: ['idle', 'ai'] });
    run(b, 58);
    const side = b.state.sides[1];
    expect(side.alive.rifle + side.queue.rifle).toBe(2);
    expect(side.supplies).toBeGreaterThanOrEqual(UNITS.rifle.cost);
    expect(side.supplies).toBeLessThan(AI.surplusSupplies);
    run(b, 40);
    expect(side.alive.rifle + side.queue.rifle).toBeGreaterThanOrEqual(3);
  });

  it('reacts to what it sees: anti-tank men against tanks, mortars and assault troops against pillboxes, machine guns against crowds', () => {
    const offered: [UnitKind[], UnitKind[]] = [
      ['sapper', 'rifle'],
      ['sapper', 'rifle', 'at', 'mortar', 'assault', 'lmg'],
    ];
    const plan: MissionAiPlan = { sappers: 1, build: [{ kind: 'rifle', count: 2, after: 0 }], firstAttackAfter: 100_000 };
    const built = (over: MissionOverrides): Record<string, number> => {
      const mission = aiField(plan, { units: offered, b: { supplies: 4000, sappers: 1 }, ...over });
      const b = makeBattle({ mission, commanders: ['idle', 'ai'] });
      run(b, 120);
      const s = b.state.sides[1];
      return {
        at: s.alive.at + s.queue.at,
        mortar: s.alive.mortar + s.queue.mortar,
        assault: s.alive.assault + s.queue.assault,
        lmg: s.alive.lmg + s.queue.lmg,
      };
    };
    const calm = built({});
    expect(calm).toEqual({ at: 0, mortar: 0, assault: 0, lmg: 0 });

    const tanks = built({ a: { forces: [{ kind: 'tank', count: 1, x: 2500, behaviour: 'guard' }] } });
    expect(tanks.at).toBeGreaterThanOrEqual(1);

    const dugIn = built({ pillboxes: [{ id: 1, x: 1500, side: 0, hpMul: 1 }] });
    expect(dugIn.mortar).toBeGreaterThanOrEqual(1);
    expect(dugIn.assault).toBeGreaterThanOrEqual(1);

    const crowd = built({ a: { forces: [{ kind: 'rifle', count: AI.infantryPerLmg * 2 }] } });
    expect(crowd.lmg).toBeGreaterThanOrEqual(1);
  });

  it('gives the bot the same income whatever the difficulty, and the AI more on harder ones', () => {
    const mission = getMission(1) as MissionDef;
    const gathered = (difficulty: 'normal' | 'insane'): [number, number] => {
      const b = makeBattle({ mission: mirrored(mission), difficulty, commanders: ['bot', 'ai'] });
      run(b, 40);
      return [b.state.sides[0].stats.suppliesGathered, b.state.sides[1].stats.suppliesGathered];
    };
    const normal = gathered('normal');
    const insane = gathered('insane');
    expect(insane[0]).toBeCloseTo(normal[0], 6);
    expect(insane[1]).toBeGreaterThan(normal[1] * 1.3);
  });
});

describe('AI orders', () => {
  const rush: MissionAiPlan = {
    sappers: 1,
    build: [{ kind: 'rifle', count: 8, after: 0 }],
    firstAttackAfter: 50,
  };

  it('holds until it is ready, then advances', () => {
    const mission = aiField(rush, { b: { supplies: 600, sappers: 1 } });
    const b = makeBattle({ mission, commanders: ['idle', 'ai'] });
    const changes = collect(b, 120, 'orderChanged').filter((e) => e.side === 1);
    expect(changes.length).toBeGreaterThanOrEqual(1);
    expect(changes[0].order).toBe('advance');
    expect(changes[0].time).toBeGreaterThanOrEqual(rush.firstAttackAfter);
    expect(changes[0].time).toBeLessThan(rush.firstAttackAfter + 20);
    // Nothing to stop it, so it marches on the idle side's HQ and wins.
    run(b, 400);
    expect(b.state.winner).toBe(1);
  });

  it('does not attack with a token force', () => {
    const plan: MissionAiPlan = { sappers: 1, build: [{ kind: 'rifle', count: 3, after: 0 }], firstAttackAfter: 10 };
    // Money for exactly three riflemen (135) and no income: below minAttackStrength.
    const mission = aiField(plan, { b: { supplies: 140, sappers: 1, incomeMul: 0 } });
    const b = makeBattle({ mission, commanders: ['idle', 'ai'] });
    const changes = collect(b, 60, 'orderChanged');
    expect(b.state.sides[1].alive.rifle).toBe(3);
    expect(AI.minAttackStrength).toBeGreaterThan(3 * 45);
    expect(changes.filter((e) => e.side === 1 && e.order === 'advance')).toHaveLength(0);
  });

  it('falls back when a bigger force reaches its line', () => {
    const plan: MissionAiPlan = { sappers: 1, build: [{ kind: 'rifle', count: 2, after: 0 }], firstAttackAfter: 100_000 };
    const mission = aiField(plan, {
      length: 6000,
      a: { forces: [{ kind: 'rifle', count: 12, x: 5000 }] },
      b: { forces: [{ kind: 'rifle', count: 2 }], sappers: 1 },
    });
    const b = makeBattle({ mission, commanders: ['human', 'ai'] });
    b.command(0, { type: 'order', order: 'advance' });
    const changes = collect(b, 10, 'orderChanged').filter((e) => e.side === 1);
    expect(changes[0]?.order).toBe('fallBack');
    expect(b.state.sides[1].order).toBe('fallBack');
    run(b, 10);
    expect(b.state.sides[1].hq?.garrison).toBeGreaterThan(0);
    expect(unitsOf(b, 1, 'rifle').some((u) => u.inside)).toBe(true);
  });

  it('never changes its mind faster than minOrderInterval', () => {
    const mission = mirrored(getMission(1) as MissionDef);
    for (const seed of [1, 2]) {
      const b = makeBattle({ mission, seed, commanders: ['ai', 'ai'] });
      const changes = collect(b, 1500, 'orderChanged');
      for (const side of [0, 1]) {
        const mine = changes.filter((e) => e.side === side);
        expect(mine.length).toBeGreaterThanOrEqual(4);
        for (let i = 1; i < mine.length; i++) {
          expect(mine[i].time - mine[i - 1].time).toBeGreaterThanOrEqual(AI.minOrderInterval - 1e-6);
        }
      }
    }
  });

  it('goes back to Hold after a retreat once the threat has passed', () => {
    const plan: MissionAiPlan = { sappers: 1, build: [{ kind: 'rifle', count: 6, after: 0 }], firstAttackAfter: 100_000 };
    const mission = aiField(plan, {
      length: 6000,
      a: { supplies: 0, forces: [{ kind: 'rifle', count: 12, x: 5000 }] },
      b: { supplies: 400, forces: [{ kind: 'rifle', count: 2 }], sappers: 1 },
    });
    const b = makeBattle({ mission, commanders: ['human', 'ai'] });
    b.command(0, { type: 'order', order: 'advance' });
    run(b, 6);
    expect(b.state.sides[1].order).toBe('fallBack');
    // The attackers pull back; with nobody near the line the AI comes out again.
    b.command(0, { type: 'order', order: 'fallBack' });
    run(b, 120);
    expect(b.state.sides[1].order).toBe('hold');
  });
});
