/**
 * The idle rule (MissionDef.idle, src/sim/director.ts; owner, 2026-11-15, DECISIONS 550): the enemy counter-attacks a
 * player who has stopped giving commands where no clock runs, until the battle has ended or he gives one. Here: the
 * rule's mechanics on the test field, the Stalingrad data (no phase without a clock or the rule), and the battle that
 * brought it: mission 10 abandoned in its ruins. That an idle player's battle ends in every phase of every mission is
 * tests/balance/idle.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/data/config';
import { STALINGRAD_MISSIONS } from '../../src/data/missions/stalingrad';
import { STALINGRAD_IDLE } from '../../src/data/missions/stalingrad/idle';
import type { IdleCounterDef, MissionDef, PhaseDef } from '../../src/data/schema';
import { UNITS } from '../../src/data/units';
import type { Battle } from '../../src/sim';
import { checkInvariants, collect, makeBattle, run, snapshot, testMission, unitsOf, type MissionOverrides } from './sim-helpers';

const RULE: IdleCounterDef = {
  after: 30,
  every: 10,
  waves: [[{ kind: 'rifle', count: 2 }], [{ kind: 'rifle', count: 3 }]],
  banner: 'They are coming!',
  announce: 'More of them.',
};

const TAKE_HQ: PhaseDef = { id: 'attack', title: 'Attack', objectives: [{ id: 'hq', type: 'destroyHq', side: 1 }], next: null };

/** The empty test field with the rule and one phase that waits for the player (nobody commands either side). */
function field(over: MissionOverrides = {}): MissionDef {
  return testMission({ phases: [TAKE_HQ], idle: RULE, ...over });
}

function press(b: Battle): void {
  b.command(0, { type: 'order', order: 'hold' });
}

describe('the idle rule', () => {
  it('counter-attacks after `after` seconds without a command: an alarm banner, then groups in order, the last again and again', () => {
    const b = makeBattle({ mission: field() });
    run(b, RULE.after - 1);
    expect(b.state.director.idle).toBe(false);
    expect(unitsOf(b, 1)).toHaveLength(0);

    const events = collect(b, 2, 'banner', 'wave');
    expect(b.state.director.idle).toBe(true);
    expect(events.map((e) => [e.type, e.text])).toEqual([
      ['banner', RULE.banner],
      ['wave', null],
    ]);
    expect(events[0].time).toBeCloseTo(RULE.after, 1);
    // The first group: two riflemen who attack whatever the order (assault), at the enemy's door.
    const first = unitsOf(b, 1);
    expect(first.map((u) => u.kind)).toEqual(['rifle', 'rifle']);
    expect(first.every((u) => u.behaviour === 'assault')).toBe(true);

    const later = collect(b, 2 * RULE.every + 1, 'wave');
    expect(later.map((e) => [e.value, e.text])).toEqual([
      [3, RULE.announce],
      [3, RULE.announce],
    ]);
    expect(b.state.director.idleWaves).toBe(3);
  });

  it('ends with any command from the player, and the count starts again from it', () => {
    const b = makeBattle({ mission: field() });
    run(b, RULE.after + 1);
    expect(b.state.director.idle).toBe(true);
    press(b);
    run(b, 1);
    expect(b.state.director.idle).toBe(false);
    const quiet = collect(b, RULE.after - 2, 'wave', 'banner');
    expect(quiet).toHaveLength(0);
    // Idle again: a new spell begins with the first group.
    const again = collect(b, 3, 'wave', 'banner');
    expect(again.map((e) => e.type)).toEqual(['banner', 'wave']);
    expect(again[1].value).toBe(2);
  });

  it('never touches a player who keeps giving commands, and such a battle is the same with and without the rule', () => {
    const withRule = makeBattle({ mission: field(), commanders: ['human', 'ai'], seed: 4 });
    const without = makeBattle({ mission: field({ idle: undefined }), commanders: ['human', 'ai'], seed: 4 });
    for (let i = 0; i < 12; i++) {
      press(withRule);
      press(without);
      run(withRule, RULE.after - 1);
      run(without, RULE.after - 1);
      expect(withRule.state.director.idle).toBe(false);
      expect(snapshot(withRule)).toBe(snapshot(without));
    }
  });

  it('does not apply under a clock, the mission\'s or the phase\'s', () => {
    const missionClock = makeBattle({ mission: field({ timer: { seconds: 400, onExpire: 'win', label: 'Hold' } }) });
    const phaseClock = makeBattle({ mission: field({ phases: [{ ...TAKE_HQ, timer: { seconds: 400, label: 'Deadline', onExpire: 'lose' } }] }) });
    for (const b of [missionClock, phaseClock]) {
      run(b, RULE.after * 4);
      expect(b.state.director.idle).toBe(false);
      expect(unitsOf(b, 1)).toHaveLength(0);
    }
  });

  it('does not apply while holding out is all that is left, and counts from the moment the phase waits for the player again', () => {
    const phases: PhaseDef[] = [
      { id: 'wait', title: 'Hold out', objectives: [{ id: 'wait', type: 'survive', seconds: RULE.after * 2 }], next: 'attack' },
      TAKE_HQ,
    ];
    const b = makeBattle({ mission: field({ phases }) });
    run(b, RULE.after * 2 - 1);
    expect(b.state.director.idle).toBe(false);
    // The attack phase has begun: the player gets the rule's full time from here, not from his last command.
    run(b, RULE.after - 1);
    expect(b.state.director.phaseId).toBe('attack');
    expect(b.state.director.idle).toBe(false);
    run(b, 3);
    expect(b.state.director.idle).toBe(true);
  });

  it('turns the enemy commander to the attack, whatever posture the script gave it', () => {
    const mission = field({
      b: { forces: [{ kind: 'rifle', count: 6 }] },
      events: [{ type: 'posture', when: { at: 0 }, side: 1, posture: 'hold' }],
      idle: { ...RULE, waves: [[{ kind: 'rifle', count: 1 }]], every: 1000 },
    });
    const b = makeBattle({ mission, commanders: ['human', 'ai'] });
    run(b, RULE.after - 1);
    expect(b.state.sides[1].order).toBe('hold');
    run(b, 20);
    expect(b.state.director.posture[1]).toBe('hold');
    expect(b.state.sides[1].order).toBe('advance');
    // The player takes the battle up again: the script's Hold is back.
    press(b);
    run(b, 20);
    expect(b.state.sides[1].order).toBe('hold');
  });

  it('brings a group in over the enemy population cap while the unit pool has room, and counts what it brought', () => {
    const full = Math.floor(CONFIG.popCap / UNITS.rifle.pop);
    const mission = field({ b: { forces: [{ kind: 'rifle', count: full, x: 5000, behaviour: 'guard', leash: 0 }] } });
    const b = makeBattle({ mission });
    expect(b.state.sides[1].pop).toBe(b.state.sides[1].popCap);
    run(b, RULE.after + 1, checkInvariants);
    expect(b.state.sides[1].pop).toBe(b.state.sides[1].popCap + 2 * UNITS.rifle.pop);
    expect(b.state.director.idleOverCap).toBe(2 * UNITS.rifle.pop);
    expect(b.state.sides[1].reservePop).toBe(0);
  });

  it('is a mission\'s own data: a mission without it is left alone', () => {
    const b = makeBattle({ mission: field({ idle: undefined }) });
    run(b, RULE.after * 4);
    expect(b.state.director.idle).toBe(false);
    expect(unitsOf(b, 1)).toHaveLength(0);
  });

  it('ends the battle: the groups take the HQ of a player who never answers', () => {
    const b = makeBattle({ mission: field({ a: { forces: [{ kind: 'rifle', count: 4 }] } }) });
    run(b, 900, checkInvariants);
    expect(b.state.over).toBe(true);
    expect(b.state.winner).toBe(1);
    expect(b.state.endReason).toBe('hqDestroyed');
  });
});

describe('the Stalingrad missions', () => {
  it('leave no phase without a clock or the idle rule', () => {
    for (const m of STALINGRAD_MISSIONS) {
      for (const p of m.phases ?? []) {
        const clock = m.timer !== null || p.timer !== undefined;
        expect(clock || m.idle !== undefined, `mission ${m.id}, phase ${p.id}: nothing ends it for an idle player`).toBe(true);
      }
    }
  });

  it('share one rule: four minutes without a command, groups of German kinds that grow, words that fit the HUD', () => {
    const withRule = STALINGRAD_MISSIONS.filter((m) => m.idle !== undefined);
    expect(withRule.map((m) => m.id)).toEqual([1002, 1003, 1004, 1005, 1006, 1009, 1010]);
    for (const m of withRule) expect(m.idle, `mission ${m.id}`).toBe(STALINGRAD_IDLE);
    const rule = STALINGRAD_IDLE;
    // Long enough that nobody who is playing meets it (the test bot's longest silence in such a phase is 160 s).
    expect(rule.after).toBeGreaterThanOrEqual(240);
    expect(rule.every).toBeGreaterThanOrEqual(60);
    expect(rule.banner.length).toBeLessThanOrEqual(40);
    expect(rule.announce.length).toBeLessThanOrEqual(40);
    let last = 0;
    for (const wave of rule.waves) {
      let size = 0;
      for (const force of wave) {
        expect(force.count).toBeGreaterThan(0);
        // Men and machines that walk to the fight from the enemy's door: nothing posted, nothing that stays put.
        expect(force.x ?? force.trenchId ?? force.buildingId ?? force.leash ?? force.behaviour).toBeUndefined();
        size += force.count;
      }
      expect(size).toBeGreaterThan(last);
      last = size;
    }
    // The biggest group fits the unit pool beside two full armies' worth of men.
    expect(last).toBeLessThanOrEqual(CONFIG.maxUnits - CONFIG.idlePoolReserve - CONFIG.popCap);
  });

  it('mission 10 abandoned in its ruins ends: riflemen sent forward for 2,500 s, then nothing (seed 1, DECISIONS 545)', () => {
    // The browser smoke spec's player (tests/e2e/helpers.ts fastForward), headless: every 15 s supplies and three
    // riflemen, Advance at fourteen; then he touches nothing. Before the rule the Germans went back to their nests
    // every two minutes and this battle never ended (20,000 s and more).
    const mission = STALINGRAD_MISSIONS.find((m) => m.id === 1010) as MissionDef;
    const b = makeBattle({ mission, seed: 1, commanders: ['human', 'ai'] });
    const s = b.state;
    const active = 2500;
    const every = 15 * CONFIG.tickRate;
    let idlePhase = '';
    while (!s.over && s.time < active + 1800) {
      if (s.time < active && s.tick % every === 0) {
        b.admin({ type: 'setSupplies', side: 0, amount: s.sides[0].supplies + 800 });
        for (let i = 0; i < 3; i++) b.command(0, { type: 'train', kind: 'rifle' });
        if (s.sides[0].alive.rifle >= 14 && s.sides[0].order !== 'advance') b.command(0, { type: 'order', order: 'advance' });
      } else if (s.time >= active && idlePhase === '') {
        idlePhase = s.director.phaseId;
      }
      b.step();
    }
    expect(idlePhase).toBe('ruins');
    expect(s.over, `still running at ${s.time.toFixed(0)} s`).toBe(true);
    expect(s.winner).toBe(1);
    expect(s.endReason).toBe('hqDestroyed');
    // The counter-attack began four minutes after his last command and took the HQ within half an hour of it.
    expect(s.director.idleWaves).toBeGreaterThan(0);
    expect(s.time).toBeLessThan(active + 1800);
  });
});
