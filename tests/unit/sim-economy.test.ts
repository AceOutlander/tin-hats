import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/data/config';
import { DIFFICULTIES } from '../../src/data/difficulty';
import type { UpgradeDef } from '../../src/data/schema';
import { UNITS } from '../../src/data/units';
import { collect, eventsOf, makeBattle, run, runUntil, testMission, unitsOf } from './sim-helpers';

const ROUND_TRIP_SLACK = 2 * (CONFIG.dumpSpread / 2) / UNITS.sapper.speed + 0.2;
/** Seconds for a sapper to walk to the dump and back plus the loading time, for a dump at the exact centre. */
const ROUND_TRIP = (2 * CONFIG.dumpDistance) / UNITS.sapper.speed + CONFIG.sapperLoadTime;

describe('passive income', () => {
  it('trickles in at hqIncomePerSec for each living HQ', () => {
    const b = makeBattle();
    run(b, 10);
    for (const side of b.state.sides) {
      expect(side.supplies).toBeCloseTo(CONFIG.hqIncomePerSec * 10, 6);
      expect(side.stats.suppliesGathered).toBeCloseTo(CONFIG.hqIncomePerSec * 10, 6);
      expect(side.income).toBeCloseTo(CONFIG.hqIncomePerSec, 6);
    }
  });

  it('is scaled by the mission income multiplier', () => {
    const b = makeBattle({ mission: testMission({ b: { incomeMul: 2 } }) });
    run(b, 10);
    expect(b.state.sides[1].supplies).toBeCloseTo(2 * b.state.sides[0].supplies, 6);
  });

  it('is scaled by the difficulty for AI-commanded sides only', () => {
    const b = makeBattle({ difficulty: 'insane', commanders: ['human', 'ai'] });
    run(b, 10);
    const human = b.state.sides[0].stats.suppliesGathered;
    const ai = b.state.sides[1].stats.suppliesGathered;
    expect(ai / human).toBeCloseTo(DIFFICULTIES.insane.aiIncomeMul, 6);
  });

  it('stops when the HQ is gone', () => {
    const b = makeBattle({ mission: testMission({ timer: { seconds: 1000, onExpire: 'win', label: '' } }) });
    run(b, 1);
    const hq = b.state.sides[0].hq;
    expect(hq).not.toBeNull();
    const before = b.state.sides[0].supplies;
    if (hq) hq.alive = false; // the view must not do this; the test simulates a destroyed HQ
    b.step();
    expect(b.state.sides[0].supplies).toBe(before);
    expect(b.state.sides[0].income).toBe(0);
  });
});

describe('sappers', () => {
  it('walk to the dump, load, and carry sapperCarry supplies back to the HQ door', () => {
    const b = makeBattle({ mission: testMission({ a: { sappers: 1 } }) });
    const hq = b.state.sides[0].hq;
    const dump = b.state.dumps[0];
    expect(hq).not.toBeNull();
    expect(dump).not.toBeNull();
    if (!hq || !dump) return;
    expect(dump.x).toBeCloseTo(hq.doorX + CONFIG.dumpDistance, 6);

    const sapper = unitsOf(b, 0, 'sapper')[0];
    expect(sapper.carrying).toBe(0);
    let loadedAt = -1;
    let carriedWhileWalking = false;
    let reachedDump = false;
    let tooEarly = false;
    const deliveries = [] as { time: number; value: number; x: number }[];
    run(b, 40, () => {
      if (Math.abs(sapper.x - dump.x) <= CONFIG.dumpSpread / 2 + 1) reachedDump = true;
      if (sapper.action === 'load') {
        if (loadedAt < 0) loadedAt = sapper.actionTime;
        if (sapper.carrying !== 0) tooEarly = true;
      }
      if (sapper.carrying > 0 && sapper.velX < 0) carriedWhileWalking = true;
      for (const e of eventsOf(b, 'supplyDelivered')) deliveries.push({ time: e.time, value: e.value, x: e.x });
    });
    expect(reachedDump).toBe(true);
    expect(loadedAt).toBeGreaterThanOrEqual(0);
    expect(tooEarly).toBe(false);
    expect(carriedWhileWalking).toBe(true);
    expect(deliveries.length).toBeGreaterThanOrEqual(3);
    for (const d of deliveries) {
      expect(d.value).toBe(CONFIG.sapperCarry);
      expect(d.x).toBeCloseTo(hq.doorX, 0);
    }
    // First delivery: half a trip out, loading, a full trip back. Then one round trip apart.
    const first = (1.5 * CONFIG.dumpDistance) / UNITS.sapper.speed + CONFIG.sapperLoadTime;
    expect(Math.abs(deliveries[0].time - first)).toBeLessThan(ROUND_TRIP_SLACK);
    for (let i = 1; i < deliveries.length; i++) {
      expect(Math.abs(deliveries[i].time - deliveries[i - 1].time - ROUND_TRIP)).toBeLessThan(ROUND_TRIP_SLACK);
    }
  });

  it('credit supplies at the HQ door and count them as gathered', () => {
    const b = makeBattle({ mission: testMission({ a: { sappers: 1 } }) });
    let delivered = 0;
    run(b, 60, () => {
      for (const e of eventsOf(b, 'supplyDelivered')) delivered += e.value;
    });
    const side = b.state.sides[0];
    expect(delivered).toBeGreaterThanOrEqual(4 * CONFIG.sapperCarry);
    expect(side.stats.suppliesGathered).toBeCloseTo(CONFIG.hqIncomePerSec * 60 + delivered, 5);
    expect(side.supplies).toBeCloseTo(side.stats.suppliesGathered, 5);
  });

  it('multiply income roughly in proportion to their number', () => {
    const gathered = (sappers: number): number => {
      const b = makeBattle({ mission: testMission({ a: { sappers } }) });
      run(b, 70);
      return b.state.sides[0].stats.suppliesGathered - CONFIG.hqIncomePerSec * 70;
    };
    const one = gathered(1);
    const four = gathered(4);
    expect(one).toBeGreaterThan(0);
    expect(four / one).toBeGreaterThan(3.2);
    expect(four / one).toBeLessThan(4.8);
  });

  it('carry more and walk faster with the sapper drill upgrade', () => {
    const drill: UpgradeDef = {
      id: 'drill',
      name: 'Sapper drill',
      description: '',
      unit: null,
      levels: [[{ stat: 'sapperCarry', mul: 1.5 }, { stat: 'sapperSpeed', mul: 1.25 }]],
      costPerLevel: 1,
    };
    const carrying = (levels: Record<string, number>): { value: number; time: number } => {
      const b = makeBattle({
        mission: testMission({ a: { sappers: 1 } }),
        upgrades: levels,
        upgradeDefs: [drill],
      });
      let value = 0;
      let time = 0;
      runUntil(b, 30, () => {
        const d = eventsOf(b, 'supplyDelivered')[0];
        if (d) {
          value = d.value;
          time = d.time;
        }
        return d !== undefined;
      });
      return { value, time };
    };
    const base = carrying({});
    const upgraded = carrying({ drill: 1 });
    expect(base.value).toBe(CONFIG.sapperCarry);
    expect(upgraded.value).toBe(CONFIG.sapperCarry * 1.5);
    expect(upgraded.time).toBeLessThan(base.time);
  });

  it('give mirrored sides the same income', () => {
    const b = makeBattle({ mission: testMission({ a: { sappers: 3 }, b: { sappers: 3 } }) });
    run(b, 100);
    const [s0, s1] = b.state.sides;
    expect(Math.abs(s0.stats.suppliesGathered - s1.stats.suppliesGathered)).toBeLessThanOrEqual(CONFIG.sapperCarry);
  });

  it('are not counted twice: collected supplies are exactly what the events report', () => {
    const b = makeBattle({ mission: testMission({ a: { sappers: 2 }, b: { sappers: 2 } }) });
    const delivered = [0, 0];
    run(b, 90, () => {
      for (const e of eventsOf(b, 'supplyDelivered')) delivered[e.side] += e.value;
    });
    for (let si = 0; si < 2; si++) {
      expect(b.state.sides[si].stats.suppliesGathered).toBeCloseTo(CONFIG.hqIncomePerSec * 90 + delivered[si], 4);
    }
  });
});

describe('training', () => {
  it('charges the cost the moment a unit is queued and reports it', () => {
    const b = makeBattle({ mission: testMission({ a: { supplies: 200 } }) });
    b.command(0, { type: 'train', kind: 'rifle' });
    b.step();
    const side = b.state.sides[0];
    expect(side.supplies).toBeCloseTo(200 - UNITS.rifle.cost + CONFIG.hqIncomePerSec / CONFIG.tickRate, 6);
    expect(side.queue.rifle).toBe(1);
    expect(side.pop).toBe(UNITS.rifle.pop);
    expect(side.stats.suppliesSpent).toBe(UNITS.rifle.cost);
    const started = eventsOf(b, 'trainStarted');
    expect(started).toHaveLength(1);
    expect(started[0].side).toBe(0);
    expect(started[0].kind).toBe('rifle');
    expect(started[0].value).toBe(1);
  });

  it('drops a command that cannot be paid for', () => {
    const b = makeBattle({ mission: testMission({ a: { supplies: UNITS.rifle.cost - 1 } }) });
    b.command(0, { type: 'train', kind: 'rifle' });
    b.step();
    const side = b.state.sides[0];
    expect(side.queue.rifle).toBe(0);
    expect(side.pop).toBe(0);
    expect(side.stats.suppliesSpent).toBe(0);
    expect(eventsOf(b, 'trainStarted')).toHaveLength(0);
  });

  it('drops kinds the mission does not offer and malformed commands', () => {
    const b = makeBattle({ mission: testMission({ a: { supplies: 5000 } }) });
    b.command(0, { type: 'train', kind: 'lmg' });
    b.command(0, { type: 'train', kind: 'tank' });
    b.command(0, { type: 'train', kind: 'heavyTank' });
    b.command(0, { type: 'order', order: 'sideways' as 'hold' });
    b.command(2 as 0, { type: 'train', kind: 'rifle' });
    b.step();
    const side = b.state.sides[0];
    expect(side.pop).toBe(0);
    expect(side.supplies).toBeCloseTo(5000 + CONFIG.hqIncomePerSec / CONFIG.tickRate, 6);
    expect(side.order).toBe('hold');
  });

  it('trains one unit at a time per kind, in the order queued', () => {
    const b = makeBattle({ mission: testMission({ a: { supplies: 1000 } }) });
    for (let i = 0; i < 3; i++) b.command(0, { type: 'train', kind: 'rifle' });
    const done = collect(b, 3 * UNITS.rifle.trainTime + 1, 'trainDone');
    expect(done).toHaveLength(3);
    for (let i = 0; i < 3; i++) {
      expect(Math.abs(done[i].time - (i + 1) * UNITS.rifle.trainTime)).toBeLessThanOrEqual(2 / CONFIG.tickRate);
    }
    expect(b.state.sides[0].queue.rifle).toBe(0);
    expect(b.state.sides[0].alive.rifle).toBe(3);
    expect(b.state.sides[0].stats.trained).toBe(3);
  });

  it('shows progress while a unit trains', () => {
    const b = makeBattle({ mission: testMission({ a: { supplies: 1000 } }) });
    b.command(0, { type: 'train', kind: 'rifle' });
    run(b, UNITS.rifle.trainTime / 2);
    expect(b.state.sides[0].progress.rifle).toBeCloseTo(0.5, 1);
    expect(b.state.sides[0].progress.sapper).toBe(0);
  });

  it('limits one queue to maxQueue units', () => {
    const b = makeBattle({ mission: testMission({ a: { supplies: 5000 } }) });
    for (let i = 0; i < CONFIG.maxQueue + 3; i++) b.command(0, { type: 'train', kind: 'rifle' });
    b.step();
    expect(b.state.sides[0].queue.rifle).toBe(CONFIG.maxQueue);
    expect(b.state.sides[0].pop).toBe(CONFIG.maxQueue * UNITS.rifle.pop);
  });

  it('trains different kinds in parallel', () => {
    const b = makeBattle({ mission: testMission({ a: { supplies: 1000 } }) });
    b.command(0, { type: 'train', kind: 'rifle' });
    b.command(0, { type: 'train', kind: 'sapper' });
    const done = collect(b, UNITS.rifle.trainTime + 0.5, 'trainDone');
    expect(done.map((e) => e.kind).sort()).toEqual(['rifle', 'sapper']);
    // Done one after the other the pair would need trainTime(rifle) + trainTime(sapper).
    const sapper = done.find((e) => e.kind === 'sapper');
    expect(sapper).toBeDefined();
    expect(sapper?.time).toBeLessThan(UNITS.sapper.trainTime + 0.2);
  });

  it('puts a finished unit at the HQ door', () => {
    const b = makeBattle({ mission: testMission({ a: { supplies: 100 } }) });
    b.command(0, { type: 'train', kind: 'rifle' });
    const spawned = collect(b, UNITS.rifle.trainTime + 1, 'unitSpawned');
    expect(spawned).toHaveLength(1);
    const hq = b.state.sides[0].hq;
    expect(spawned[0].x).toBeCloseTo(hq ? hq.doorX : -1, 6);
    expect(spawned[0].kind).toBe('rifle');
    expect(spawned[0].side).toBe(0);
    expect(spawned[0].value).toBe(1);
    expect(spawned[0].hit).toBe(false);
  });

  it('never lets population pass the cap, counting queued units', () => {
    const mission = testMission({
      a: { supplies: 100_000 },
      units: [
        ['sapper', 'rifle', 'lmg', 'at', 'tank'],
        ['sapper', 'rifle'],
      ],
    });
    const b = makeBattle({ mission });
    const wanted = [
      ...Array<'tank'>(CONFIG.maxQueue).fill('tank'),
      ...Array<'at'>(CONFIG.maxQueue).fill('at'),
      ...Array<'lmg'>(CONFIG.maxQueue).fill('lmg'),
      ...Array<'rifle'>(CONFIG.maxQueue).fill('rifle'),
    ];
    for (const kind of wanted) b.command(0, { type: 'train', kind });
    b.step();
    const side = b.state.sides[0];
    expect(side.pop).toBeLessThanOrEqual(CONFIG.popCap);
    expect(side.pop).toBe(CONFIG.popCap);
    // 5 tanks (25) + 5 at (10) + 2 lmg (4) + 1 rifle (1) = 40; the rest were refused.
    expect(side.queue.tank).toBe(5);
    expect(side.queue.at).toBe(5);
    expect(side.queue.lmg).toBe(2);
    expect(side.queue.rifle).toBe(1);

    let worst = 0;
    run(b, 140, () => {
      worst = Math.max(worst, b.state.sides[0].pop);
      b.command(0, { type: 'train', kind: 'rifle' });
    });
    expect(worst).toBeLessThanOrEqual(CONFIG.popCap);
    expect(b.state.sides[0].alive.tank).toBe(5);
    expect(b.state.sides[0].pop).toBe(CONFIG.popCap);
  });

  it('counts units placed by the mission towards population, and frees it when they die', () => {
    const b = makeBattle({ mission: testMission({ a: { sappers: 2, forces: [{ kind: 'rifle', count: 3 }] } }) });
    expect(b.state.sides[0].pop).toBe(2 * UNITS.sapper.pop + 3 * UNITS.rifle.pop);
    expect(b.state.sides[0].alive.rifle).toBe(3);
    expect(b.state.sides[0].alive.sapper).toBe(2);
  });

  it('refuses to train once the HQ is destroyed', () => {
    const b = makeBattle({ mission: testMission({ a: { supplies: 500 } }) });
    const hq = b.state.sides[0].hq;
    if (hq) hq.alive = false;
    b.command(0, { type: 'train', kind: 'rifle' });
    b.step();
    expect(b.state.sides[0].queue.rifle).toBe(0);
  });

  it('spawns trained units inside the HQ while the army is falling back', () => {
    const b = makeBattle({ mission: testMission({ a: { supplies: 100 } }) });
    b.command(0, { type: 'order', order: 'fallBack' });
    b.command(0, { type: 'train', kind: 'rifle' });
    const spawned = collect(b, UNITS.rifle.trainTime + 1, 'unitSpawned');
    expect(spawned).toHaveLength(1);
    expect(spawned[0].hit).toBe(true);
    const rifle = unitsOf(b, 0, 'rifle')[0];
    expect(rifle.inside).toBe(true);
    expect(rifle.action).toBe('inside');
    expect(b.state.sides[0].hq?.garrison).toBe(1);
  });
});
