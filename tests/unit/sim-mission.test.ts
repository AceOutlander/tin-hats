/**
 * Mission mechanics: every trigger and event kind, survival and deadline timers, mission rules
 * (unit and support availability, no sappers), airdrops, starting forces, the guard boss and the
 * difficulty scaling of the AI.
 */
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/data/config';
import { DIFFICULTIES } from '../../src/data/difficulty';
import type { MissionDef } from '../../src/data/schema';
import { UNITS } from '../../src/data/units';
import { checkInvariants, collect, makeBattle, run, testMission, unitsOf } from './sim-helpers';

const FAR = 50; // hqHpMul large enough that no HQ falls by accident

describe('mission triggers and events', () => {
  it('fires each trigger kind (at, every, trenchCapturedBy, hqHpBelow) with each event type', () => {
    const mission = testMission({
      length: 4000,
      a: { forces: [{ kind: 'rifle', count: 4, x: 1300 }] },
      b: { hqHpMul: FAR },
      trenches: [{ id: 5, x: 1700, width: 130, slots: 6, owner: 1 }],
      events: [
        { type: 'announce', when: { at: 2 }, text: 'at' },
        { type: 'airdrop', when: { every: 4, from: 3, until: 12 }, side: 0, supplies: 25 },
        { type: 'hint', when: { trenchCapturedBy: 0, trenchId: 5, delay: 2 }, text: 'captured' },
        { type: 'wave', when: { hqHpBelow: 0.9999, side: 1 }, side: 1, forces: [{ kind: 'rifle', count: 2 }], announce: 'hurt' },
        { type: 'hint', when: { trenchCapturedBy: 1, trenchId: 5 }, text: 'never' },
      ],
    });
    const b = makeBattle({ mission });
    b.command(0, { type: 'order', order: 'advance' });
    const seen = collect(b, 120, 'announce', 'airdrop', 'hint', 'wave', 'trenchCaptured');

    const at = seen.filter((e) => e.type === 'announce');
    expect(at.map((e) => e.text)).toEqual(['at']);
    expect(at[0].time).toBeCloseTo(2, 1);

    expect(seen.filter((e) => e.type === 'airdrop').map((e) => Math.round(e.time))).toEqual([3, 7, 11]);

    const captured = seen.find((e) => e.type === 'trenchCaptured' && e.side === 0);
    const hint = seen.filter((e) => e.type === 'hint');
    expect(captured).toBeDefined();
    expect(hint.map((e) => e.text)).toEqual(['captured']);
    expect(hint[0].time - (captured?.time ?? 0)).toBeCloseTo(2, 1);

    const waves = seen.filter((e) => e.type === 'wave');
    expect(waves).toHaveLength(1);
    expect(waves[0].text).toBe('hurt');
    expect(waves[0].value).toBe(2);
  });
});

/** A survival mission: side 1 has no HQ, waves of riflemen every 10 s from the right edge. */
function survival(seconds: number, extra: Partial<MissionDef> = {}, hqHpMul = FAR): MissionDef {
  return testMission({
    length: 4000,
    mode: 'survival',
    timer: { seconds, onExpire: 'win', label: 'Hold on' },
    a: { hqHpMul, supplies: 300, forces: [{ kind: 'rifle', count: 4, trenchId: 1 }] },
    b: { hasHq: false, supplies: 500, sappers: 3, forces: [] },
    trenches: [{ id: 1, x: 1200, width: 130, slots: 6, owner: 0 }],
    events: [{ type: 'wave', when: { every: 10, from: 2 }, side: 1, forces: [{ kind: 'rifle', count: 3 }], announce: 'Wave' }],
    ...extra,
  });
}

describe('survival', () => {
  it('has no enemy HQ or economy, sends assault waves from the right edge, and is won when the timer runs out', () => {
    const b = makeBattle({ mission: survival(40), commanders: ['bot', 'ai'] });
    const s = b.state;
    expect(s.sides[1].hq).toBeNull();
    expect(s.dumps[1]).toBeNull();
    expect(unitsOf(b, 1, 'sapper')).toHaveLength(0);
    const first = collect(b, 2.1, 'wave');
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ side: 1, value: 3, text: 'Wave' });
    for (const u of unitsOf(b, 1)) {
      expect(u.behaviour).toBe('assault');
      expect(u.x).toBeGreaterThan(s.length - 200);
    }
    const orders: string[] = [];
    const ended = collect(b, 60, 'battleEnded', 'orderChanged');
    for (const e of ended) if (e.type === 'orderChanged' && e.side === 0) orders.push(e.order ?? '');
    // The bot never leaves its trench to chase waves: there is no HQ to take.
    expect(orders).not.toContain('advance');
    expect(s.sides[1].supplies).toBe(500);
    expect(s.sides[1].stats.suppliesGathered).toBe(0);
    expect(s.sides[1].stats.trained).toBe(0);
    expect(s.over).toBe(true);
    expect(s.winner).toBe(0);
    expect(s.endReason).toBe('timerSurvived');
    const end = ended.find((e) => e.type === 'battleEnded');
    expect(end?.side).toBe(0);
    expect(end?.time).toBeCloseTo(40, 1);
    expect(s.timer?.secondsLeft).toBe(0);
    expect(s.timer?.progress).toBe(1);
  });

  it('is lost if the HQ falls before the timer runs out', () => {
    const mission = survival(600, { events: [{ type: 'wave', when: { at: 1 }, side: 1, forces: [{ kind: 'rifle', count: 6 }] }] }, 0.03);
    const b = makeBattle({ mission: { ...mission, start: [{ ...mission.start[0], forces: [] }, mission.start[1]] } });
    run(b, 200, checkInvariants);
    expect(b.state.over).toBe(true);
    expect(b.state.winner).toBe(1);
    expect(b.state.endReason).toBe('hqDestroyed');
  });
});

describe('deadline', () => {
  it('reports 0..1 progress and loses the battle when it expires', () => {
    const mission = testMission({ b: { hqHpMul: FAR }, timer: { seconds: 20, onExpire: 'lose', label: 'Before nightfall' } });
    const b = makeBattle({ mission });
    expect(b.state.timer?.progress).toBe(0);
    run(b, 10);
    expect(b.state.timer?.progress).toBeCloseTo(0.5, 2);
    expect(b.state.timer?.secondsLeft).toBeCloseTo(10, 2);
    const ended = collect(b, 15, 'battleEnded');
    expect(ended).toHaveLength(1);
    expect(ended[0].side).toBe(1);
    expect(ended[0].time).toBeCloseTo(20, 1);
    expect(b.state.endReason).toBe('timerExpired');
    expect(b.state.timer?.progress).toBe(1);
  });
});

describe('mission rules', () => {
  it('enforces per-side unit and support availability on every command', () => {
    const mission = testMission({
      units: [['sapper', 'rifle'], ['sapper', 'rifle', 'lmg']],
      supports: [[], ['artillery']],
      a: { supplies: 1000 },
      b: { supplies: 1000 },
    });
    const b = makeBattle({ mission });
    b.command(0, { type: 'train', kind: 'lmg' });
    b.command(0, { type: 'train', kind: 'heavyTank' });
    b.command(0, { type: 'support', kind: 'artillery', x: 3000 });
    b.command(1, { type: 'train', kind: 'lmg' });
    b.command(1, { type: 'support', kind: 'artillery', x: 1000 });
    const seen = collect(b, 1, 'trainStarted', 'supportCalled');
    expect(seen.map((e) => `${e.side}:${e.type}:${e.kind ?? e.support}`)).toEqual(['1:trainStarted:lmg', '1:supportCalled:artillery']);
    expect(b.state.sides[0].supplies).toBeCloseTo(1000 + CONFIG.hqIncomePerSec * 1, 6);
  });

  it('has no sappers at all when the mission leaves them out (mission 9): none start and none can be trained', () => {
    const mission = testMission({ units: [['rifle'], ['sapper', 'rifle']], a: { sappers: 3, supplies: 500 }, b: { sappers: 2 } });
    const b = makeBattle({ mission });
    expect(unitsOf(b, 0, 'sapper')).toHaveLength(0);
    expect(unitsOf(b, 1, 'sapper')).toHaveLength(2);
    expect(b.state.sides[0].available.sapper).toBe(false);
    b.command(0, { type: 'train', kind: 'sapper' });
    b.command(0, { type: 'train', kind: 'rifle' });
    const started = collect(b, 1, 'trainStarted');
    expect(started.map((e) => e.kind)).toEqual(['rifle']);
  });

  it('credits airdrops in full even with no other income, scaled only by the difficulty for an AI side', () => {
    const mission = testMission({
      a: { incomeMul: 0 },
      b: { incomeMul: 0 },
      events: [
        { type: 'airdrop', when: { at: 1 }, side: 0, supplies: 150 },
        { type: 'airdrop', when: { at: 1 }, side: 1, supplies: 150 },
      ],
    });
    const b = makeBattle({ mission, difficulty: 'hard', commanders: ['human', 'ai'] });
    const drops = collect(b, 3, 'airdrop');
    expect(drops.map((e) => e.side)).toEqual([0, 1]);
    expect(drops[0].value).toBe(150);
    expect(drops[1].value).toBeCloseTo(150 * DIFFICULTIES.hard.aiIncomeMul, 9);
    expect(b.state.sides[0].supplies).toBe(150);
    expect(b.state.sides[0].stats.suppliesGathered).toBe(150);
  });

  it('places starting forces at x, one spacing apart going back, or seated in a trench', () => {
    const mission = testMission({
      length: 5000,
      a: { forces: [{ kind: 'rifle', count: 3, x: 1234 }] },
      b: { forces: [{ kind: 'lmg', count: 2, x: 4000 }, { kind: 'rifle', count: 2, trenchId: 3 }] },
      trenches: [{ id: 3, x: 3500, width: 130, slots: 6, owner: -1 }],
    });
    const b = makeBattle({ mission });
    expect(unitsOf(b, 0, 'rifle').map((u) => u.x)).toEqual([1234, 1234 - CONFIG.spacing, 1234 - 2 * CONFIG.spacing]);
    expect(unitsOf(b, 1, 'lmg').map((u) => u.x)).toEqual([4000, 4000 + CONFIG.spacing]);
    for (const u of unitsOf(b, 1, 'rifle')) expect(u.trenchId).toBe(3);
    expect(b.state.trenches[0].owner).toBe(1);
    expect(b.state.trenches[0].occupants).toBe(2);
  });

  it('keeps a guard boss at its post within the leash whatever the order', () => {
    const post = 4300;
    const mission = testMission({ length: 5000, b: { forces: [{ kind: 'heavyTank', count: 1, x: post, behaviour: 'guard' }] } });
    const b = makeBattle({ mission });
    b.command(1, { type: 'order', order: 'advance' });
    run(b, 40);
    const [boss] = unitsOf(b, 1, 'heavyTank');
    expect(boss.behaviour).toBe('guard');
    expect(Math.abs(boss.x - post)).toBeLessThanOrEqual(CONFIG.guardLeash);
  });
});

describe('difficulty', () => {
  it('scales the AI side income and wave sizes, never unit stats, and leaves the player alone', () => {
    const mission = testMission({
      a: { hasHq: true },
      b: { hasHq: true, forces: [{ kind: 'rifle', count: 2, x: 5000 }] },
      events: [{ type: 'wave', when: { at: 1 }, side: 1, forces: [{ kind: 'rifle', count: 5, x: 5200 }] }],
    });
    const gathered = (difficulty: 'normal' | 'insane'): [number, number, number, number] => {
      const b = makeBattle({ mission, difficulty, commanders: ['human', 'ai'] });
      const wave = collect(b, 4, 'wave')[0].value;
      const hp = unitsOf(b, 1, 'rifle')[0].maxHp;
      return [b.state.sides[0].stats.suppliesGathered, b.state.sides[1].stats.suppliesGathered, wave, hp];
    };
    const normal = gathered('normal');
    const insane = gathered('insane');
    expect(insane[0]).toBeCloseTo(normal[0], 9);
    expect(insane[1]).toBeCloseTo(normal[1] * DIFFICULTIES.insane.aiIncomeMul, 6);
    expect(normal[2]).toBe(5);
    expect(insane[2]).toBe(Math.round(5 * DIFFICULTIES.insane.aiWaveMul));
    expect(insane[3]).toBe(UNITS.rifle.hp);
    expect(normal[3]).toBe(UNITS.rifle.hp);
  });
});
