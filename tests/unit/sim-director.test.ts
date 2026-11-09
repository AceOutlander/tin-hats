/**
 * The mission director (src/sim/director.ts, FOUNDATIONS.md 3): phases and their objectives, loss conditions and
 * clocks, side objectives, the new triggers and events, a prep phase at a phase's start, AI postures, the per-force
 * leash, the HQ-door wave rule, admin "jump to phase", and the medal score's new inputs. Every battle here is the
 * test field with a few placed units and human (silent) commanders unless a test says otherwise.
 */
import { describe, expect, it } from 'vitest';
import { MEDALS } from '../../src/data/medals';
import type { MissionDef, PhaseDef } from '../../src/data/schema';
import { defaultScoring, scoreWin } from '../../src/meta';
import { directorScore, missionTime, normalPhases } from '../../src/sim';
import { FIELD } from './fixtures';
import { checkInvariants, collect, makeBattle, run, runUntil, snapshot, testMission, unitsOf, type MissionOverrides } from './sim-helpers';

/** The test field with these phases (and events), no forces unless given. */
function phased(phases: PhaseDef[], over: MissionOverrides = {}): MissionDef {
  return testMission({ phases, ...over });
}

const TRENCH = { id: 7, x: 3000, width: 140, slots: 6, owner: 1 as const };

describe('a mission without phases', () => {
  it('becomes one phase with only the enemy HQ as its objective (none for a mission with no enemy HQ)', () => {
    expect(normalPhases(FIELD)).toEqual([{ id: 'battle', title: '', objectives: [{ id: 'hq', type: 'destroyHq', side: 1 }], next: null }]);
    const survival = { ...FIELD, start: [FIELD.start[0], { ...FIELD.start[1], hasHq: false }] } as MissionDef;
    expect(normalPhases(survival)[0].objectives).toEqual([]);
  });

  it('plays exactly as the same mission written as that one phase', () => {
    const one = makeBattle({ mission: FIELD, commanders: ['bot', 'ai'], seed: 3 });
    const two = makeBattle({ mission: { ...FIELD, phases: normalPhases(FIELD) }, commanders: ['bot', 'ai'], seed: 3 });
    for (let i = 0; i < 6; i++) {
      run(one, 30);
      run(two, 30);
      expect(snapshot(two)).toBe(snapshot(one));
    }
  });

  it('keeps the survival clock deciding a survival mission (timerSurvived at the same tick)', () => {
    const m = testMission({ mode: 'survival', timer: { seconds: 20, onExpire: 'win', label: 'Hold' }, b: { hasHq: false } });
    const b = makeBattle({ mission: m });
    run(b, 25);
    expect(b.state.over).toBe(true);
    expect(b.state.endReason).toBe('timerSurvived');
    expect(b.state.time).toBeCloseTo(20, 6);
  });
});

describe('phases', () => {
  it('move on when every objective is done, announce the new phase and fire its events on the phase clock', () => {
    const m = phased(
      [
        { id: 'one', title: 'First', objectives: [{ id: 'wait', type: 'survive', seconds: 5 }], next: 'two' },
        { id: 'two', title: 'Second', objectives: [{ id: 'wait2', type: 'survive', seconds: 4 }], next: null },
      ],
      { events: [{ type: 'announce', when: { phase: 'two', delay: 2 }, text: 'Two seconds into phase two' }] },
    );
    const b = makeBattle({ mission: m });
    const started = collect(b, 6, 'phaseStarted');
    expect(started.map((e) => e.text)).toEqual(['Phase 2: Second']);
    expect(b.state.director.phaseId).toBe('two');
    expect(b.state.director.phaseStarts.two).toBeCloseTo(5, 6);
    const said = collect(b, 2, 'announce');
    expect(said).toHaveLength(1);
    expect(said[0].time - b.state.director.phaseStarts.two).toBeGreaterThanOrEqual(2);
    run(b, 5);
    expect(b.state.over).toBe(true);
    expect([b.state.winner, b.state.endReason]).toEqual([0, 'timerSurvived']);
  });

  it('never completes a phase that has no objectives (it is decided by the HQ rule or a clock)', () => {
    const b = makeBattle({ mission: phased([{ id: 'p', title: 'Nothing', objectives: [], next: null }]) });
    run(b, 20);
    expect(b.state.over).toBe(false);
  });

  it('repeat phaseEvery events only during their phase, from their own start', () => {
    const m = phased(
      [
        { id: 'a', title: 'A', objectives: [{ id: 's', type: 'survive', seconds: 10 }], next: 'b' },
        { id: 'b', title: 'B', objectives: [], next: null },
      ],
      { events: [{ type: 'hint', when: { phaseEvery: 3, phase: 'b', from: 1 }, text: 'Every three seconds in B' }] },
    );
    const b = makeBattle({ mission: m });
    expect(collect(b, 10, 'hint')).toHaveLength(0);
    const hints = collect(b, 10, 'hint');
    // 1, 4, 7 and 10 s into phase B.
    expect(hints.length).toBe(4);
  });

  it('capture and hold: a hold restarts when the point is lost, and the phase ends after a full unbroken hold', () => {
    const m = phased(
      [
        {
          id: 'hold',
          title: 'Hold it',
          objectives: [{ id: 'h', type: 'hold', point: { trench: 7 }, seconds: 10 }],
          next: null,
        },
      ],
      {
        trenches: [TRENCH],
        events: [
          { type: 'setOwner', when: { at: 1 }, ref: { trench: 7 }, owner: 0 },
          { type: 'setOwner', when: { at: 6 }, ref: { trench: 7 }, owner: 1 },
          { type: 'setOwner', when: { at: 8 }, ref: { trench: 7 }, owner: 0 },
        ],
      },
    );
    const b = makeBattle({ mission: m });
    run(b, 7);
    expect(b.state.director.objectives[0].value).toBe(0);
    run(b, 6);
    expect(b.state.over).toBe(false);
    expect(b.state.director.objectives[0].value).toBeGreaterThan(4);
    run(b, 6);
    expect(b.state.over).toBe(true);
    expect(b.state.endReason).toBe('objectives');
  });

  it('kill: counts the units of a side (and kinds) that died over the whole mission, and the kills trigger fires', () => {
    const m = phased([{ id: 'k', title: 'Kill', objectives: [{ id: 'k3', type: 'kill', side: 1, kinds: ['rifle'], count: 3 }], next: null }], {
      b: { forces: [{ kind: 'rifle', count: 5, x: 5000 }] },
      events: [{ type: 'announce', when: { kills: 2, side: 1, kinds: ['rifle'] }, text: 'Two down' }],
    });
    const b = makeBattle({ mission: m });
    const rifles = unitsOf(b, 1, 'rifle');
    b.admin({ type: 'kill', side: 1, unit: rifles[0].id });
    b.admin({ type: 'kill', side: 1, unit: rifles[1].id });
    expect(collect(b, 1, 'announce').map((e) => e.text)).toEqual(['Two down']);
    expect(b.state.director.objectives[0].value).toBe(2);
    b.admin({ type: 'kill', side: 1, unit: rifles[2].id });
    run(b, 1);
    expect([b.state.over, b.state.winner, b.state.endReason]).toEqual([true, 0, 'objectives']);
    expect(b.state.sides[1].stats.lostByKind.rifle).toBe(3);
  });

  it('a phase clock that loses ends the battle; one that completes ends the phase', () => {
    const lose = makeBattle({ mission: phased([{ id: 'p', title: 'P', objectives: [], timer: { seconds: 4, label: 'Dawn', onExpire: 'lose' }, next: null }]) });
    run(lose, 5);
    expect([lose.state.winner, lose.state.endReason]).toEqual([1, 'timerExpired']);
    const done = makeBattle({ mission: phased([{ id: 'p', title: 'P', objectives: [], timer: { seconds: 4, label: 'Dawn', onExpire: 'complete' }, next: null }]) });
    run(done, 5);
    expect([done.state.winner, done.state.endReason]).toEqual([0, 'timerSurvived']);
  });

  it('the 1002 rule is data: a kill count not met when the clock runs out keeps the phase going, with waves every 60 s', () => {
    const m = phased(
      [{ id: 'h', title: 'Hold', objectives: [{ id: 's', type: 'survive', seconds: 10 }, { id: 'k', type: 'kill', side: 1, count: 1 }], next: null }],
      { events: [{ type: 'wave', when: { phaseEvery: 60, phase: 'h', from: 10 }, side: 1, forces: [{ kind: 'rifle', count: 1, x: 5200 }] }] },
    );
    const b = makeBattle({ mission: m });
    run(b, 11);
    expect(b.state.over).toBe(false);
    expect(unitsOf(b, 1, 'rifle')).toHaveLength(1);
    run(b, 60);
    expect(unitsOf(b, 1, 'rifle')).toHaveLength(2);
    b.admin({ type: 'kill', side: 1, unit: unitsOf(b, 1, 'rifle')[0].id });
    run(b, 1);
    expect([b.state.over, b.state.winner]).toEqual([true, 0]);
  });
});

describe('losses', () => {
  it('enemyReached: the battle is lost when that many enemies stand at or past x at once', () => {
    const m = phased([{ id: 'p', title: 'P', objectives: [], lose: [{ type: 'enemyReached', x: 4000, count: 3 }], next: null }], {
      events: [{ type: 'wave', when: { at: 1 }, side: 1, forces: [{ kind: 'rifle', count: 3, x: 4200, behaviour: 'assault' }] }],
    });
    const b = makeBattle({ mission: m });
    expect(runUntil(b, 60, (x) => x.state.over)).toBe(true);
    expect([b.state.winner, b.state.endReason]).toEqual([1, 'objectiveFailed']);
    expect(b.state.director.endText).toBe('The enemy broke through.');
  });

  it('pointLost: only once side 0 has held the point and the enemy takes it back', () => {
    const m = phased([{ id: 'p', title: 'P', objectives: [], lose: [{ type: 'pointLost', point: { trench: 7 } }], next: null }], {
      trenches: [TRENCH],
      events: [
        { type: 'setOwner', when: { at: 2 }, ref: { trench: 7 }, owner: 0 },
        { type: 'setOwner', when: { at: 4 }, ref: { trench: 7 }, owner: 1 },
      ],
    });
    const b = makeBattle({ mission: m });
    run(b, 3);
    expect(b.state.over).toBe(false);
    run(b, 2);
    expect([b.state.over, b.state.endReason]).toEqual([true, 'objectiveFailed']);
  });
});

describe('side objectives', () => {
  const sideMission = (extraEvents: MissionDef['events'] = []): MissionDef =>
    phased(
      [
        {
          id: 'p',
          title: 'P',
          objectives: [{ id: 's', type: 'survive', seconds: 10 }],
          sideObjectives: [
            { id: 'keep', text: 'The trench never falls', failIf: { type: 'pointLost', point: { trench: 7 } }, bonus: 0.15 },
            { id: 'fast', text: 'Take it in 5 s', objective: { id: 'take', type: 'capture', point: { trench: 7 } }, within: 5, bonus: 0.1 },
            { id: 'quick', text: 'Win inside 8 s', within: 8, bonus: 0.1 },
          ],
          next: null,
        },
      ],
      { trenches: [TRENCH], events: [{ type: 'setOwner', when: { at: 3 }, ref: { trench: 7 }, owner: 0 }, ...extraEvents] },
    );

  it('are earned or missed by what happened, settled at the end of the battle', () => {
    const b = makeBattle({ mission: sideMission() });
    run(b, 12);
    expect(b.state.over).toBe(true);
    expect(b.state.director.side.map((so) => [so.id, so.status])).toEqual([
      ['keep', 'done'],
      ['fast', 'done'],
      ['quick', 'failed'],
    ]);
    expect(b.state.director.doneAt.take).toBeGreaterThan(2);
  });

  it('a failIf fails one for good, and a loss fails every open one', () => {
    const b = makeBattle({ mission: sideMission([{ type: 'setOwner', when: { at: 6 }, ref: { trench: 7 }, owner: 1 }]) });
    run(b, 7);
    expect(b.state.director.side[0].status).toBe('failed');
    b.admin({ type: 'end', winner: 1 });
    // Earned for good already (no failIf can take it back) stays earned; the open ones fail.
    expect(b.state.director.side.map((so) => so.status)).toEqual(['failed', 'done', 'failed']);
  });

  it('add their bonus to the medal score (capped at 1), with the kill bonus and phase-timed scoring', () => {
    const def = { ...MEDALS.fallback, targetSeconds: 100, roughSeconds: 300, targetLost: 0, roughLost: 10 };
    const base = scoreWin('assault', def, { seconds: 200, lost: 5, hqFrac: 1 }, 'normal', 0);
    expect(base.bonus).toBeNull();
    const withSide = scoreWin('assault', def, { seconds: 200, lost: 5, hqFrac: 1, sideObjectives: [{ id: 'a', text: 'A', bonus: 0.2, done: true }, { id: 'b', text: 'B', bonus: 0.1, done: false }] }, 'normal', 0);
    expect(withSide.score).toBeCloseTo(base.score + 0.2, 9);
    expect(withSide.medals).toBeGreaterThan(base.medals);
    const capped = scoreWin('assault', def, { seconds: 0, lost: 0, hqFrac: 1, sideObjectives: [{ id: 'a', text: 'A', bonus: 0.5, done: true }] }, 'normal', 0);
    expect(capped.score).toBe(1);
    // Timed from a phase: only the time since that phase began counts.
    const timed = scoreWin('assault', { ...def, timedFrom: 'counter' }, { seconds: 900, lost: 5, hqFrac: 1, missionSeconds: 800, phaseStarts: { counter: 700 } }, 'normal', 0);
    expect(timed.time?.value).toBe(100);
    // The delay kill bonus: tanks over the objective.
    const kills = scoreWin('delay', { ...def, killBonus: { kinds: ['tank', 'lightTank'], above: 12, per: 0.02, max: 0.1 } }, { seconds: 900, lost: 5, hqFrac: 0.5, enemyLost: { tank: 10, lightTank: 6 } }, 'normal', 0);
    expect(kills.bonus?.kills).toEqual({ value: 16, above: 12, score: 0.08 });
  });

  it('read from a battle by directorScore', () => {
    const b = makeBattle({ mission: sideMission() });
    run(b, 12);
    const score = directorScore(b.state);
    expect(score.sideObjectives.map((so) => so.done)).toEqual([true, true, false]);
    expect(score.missionSeconds).toBeCloseTo(missionTime(b.state), 9);
  });
});

describe('medal scoring by mode', () => {
  it('scores survival, hold and delay fixed, assault and special timed, and survival exactly as before', () => {
    expect(['assault', 'survival', 'hold', 'delay', 'special'].map((m) => defaultScoring(m as MissionDef['mode']))).toEqual(['timed', 'fixed', 'fixed', 'fixed', 'timed']);
    const def = MEDALS.fallback;
    const old = scoreWin('survival', def, { seconds: 800, lost: 30, hqFrac: 0.7 }, 'normal', 0);
    const w = MEDALS.weights.survival;
    expect(old.score).toBeCloseTo(w.casualties * old.casualties.score + w.hq * (old.hq?.score ?? 0), 12);
    // A structure weight: the house's health counts too.
    const house = scoreWin('survival', { ...def, hqHealthWeight: 0.2, structureWeight: { ref: { trench: 2 }, weight: 0.2 } }, { seconds: 800, lost: 30, hqFrac: 0.7, structureFrac: 1 }, 'normal', 0);
    expect(house.structure).toEqual({ value: 1, target: 1, score: 1 });
    expect(house.score).toBeCloseTo(0.6 * house.casualties.score + 0.2 * (house.hq?.score ?? 0) + 0.2, 12);
  });
});

describe('a prep phase at the start of a phase', () => {
  it('stops the mission clock and the phase clock while it runs, and the enemy is told to hold', () => {
    const m = phased([
      { id: 'one', title: 'One', objectives: [{ id: 's', type: 'survive', seconds: 3 }], next: 'two' },
      { id: 'two', title: 'Two', prep: { seconds: 10 }, objectives: [{ id: 's2', type: 'survive', seconds: 5 }], next: null },
    ]);
    const b = makeBattle({ mission: m });
    b.command(1, { type: 'order', order: 'advance' });
    run(b, 4);
    expect(b.state.prep?.active).toBe(true);
    const clock = missionTime(b.state);
    run(b, 5);
    expect(missionTime(b.state)).toBe(clock);
    expect(b.state.sides[1].order).toBe('hold');
    expect(b.state.director.objectives[0].value).toBe(0);
    run(b, 6);
    expect(b.state.prep?.active).toBe(false);
    expect(b.state.prep?.before).toBe(0);
    run(b, 6);
    expect(b.state.over).toBe(true);
    // Battle time = 3 s of phase one, 10 s of prep, 5 s of phase two (and the ticks between).
    expect(b.state.time).toBeGreaterThanOrEqual(18);
    expect(missionTime(b.state)).toBeLessThan(8.5);
  });

  it('lets the player build in it, with a zone behind the front', () => {
    const m = phased([
      { id: 'one', title: 'One', objectives: [{ id: 's', type: 'survive', seconds: 1 }], next: 'two' },
      { id: 'two', title: 'Two', prep: { seconds: 20 }, objectives: [], next: null },
    ], { a: { supplies: 500, sappers: 2 } });
    const b = makeBattle({ mission: m });
    run(b, 2);
    const p = b.state.prep;
    expect(p?.active).toBe(true);
    if (!p) return;
    expect(p.zoneTo).toBeGreaterThan(p.zoneFrom);
    b.command(0, { type: 'build', kind: 'wire', x: (p.zoneFrom + p.zoneTo) / 2 });
    run(b, 1);
    expect(b.state.sites.length + b.state.wires.length).toBe(1);
  });
});

describe('events', () => {
  it('banner: text and sound', () => {
    const b = makeBattle({ mission: phased([{ id: 'p', title: 'P', objectives: [], next: null }], { events: [{ type: 'banner', when: { at: 1 }, text: 'Artillery!', sound: 'alarm' }] }) });
    const banners = collect(b, 2, 'banner');
    expect(banners.map((e) => [e.text, e.value])).toEqual([['Artillery!', 1]]);
  });

  it('barrage: free rounds for a side without an HQ, deterministic, with a warning banner before them', () => {
    const m = testMission({
      mode: 'survival',
      timer: { seconds: 60, onExpire: 'win', label: 'Hold' },
      b: { hasHq: false },
      a: { forces: [{ kind: 'rifle', count: 6, x: 2000 }] },
      events: [{ type: 'barrage', when: { at: 1 }, side: 1, x: 2000, spread: 100, rounds: 6, duration: 2, weapon: 'mortar21', warning: 'Heavy mortars!' }],
    });
    const runOnce = (): [number, string, number] => {
      const b = makeBattle({ mission: m, seed: 5 });
      const seen = collect(b, 10, 'banner', 'projectile', 'explosion');
      return [seen.filter((e) => e.type === 'projectile' && e.weapon === 'mortar21').length, seen.find((e) => e.type === 'banner')?.text ?? '', b.state.sides[0].stats.lost];
    };
    const first = runOnce();
    expect(first[0]).toBe(6);
    expect(first[1]).toBe('Heavy mortars!');
    expect(runOnce()).toEqual(first);
  });

  it('airRaid: a free call-in that leaves the side\'s own cooldown alone; income: the side earns at the new rate', () => {
    const m = testMission({
      supports: [['artillery'], []],
      a: { supplies: 0, sappers: 0 },
      events: [
        { type: 'airRaid', when: { at: 1 }, side: 0, support: 'artillery', x: 4500 },
        { type: 'income', when: { at: 1 }, side: 0, mul: 0.4 },
      ],
    });
    const b = makeBattle({ mission: m });
    const called = collect(b, 2, 'supportCalled');
    expect(called.map((e) => e.support)).toEqual(['artillery']);
    expect(b.state.sides[0].supportCooldown.artillery).toBe(0);
    const cut = makeBattle({ mission: m });
    const full = makeBattle({ mission: { ...m, events: [] } });
    run(cut, 30);
    run(full, 30);
    expect(cut.state.sides[0].supplies).toBeLessThan(full.state.sides[0].supplies * 0.6);
  });

  it('support: a call-in offered later, and a mission\'s own cooldown', () => {
    const m = testMission({
      supports: [['artillery', 'smoke'], []],
      a: { supportsOff: ['artillery'], supportCooldown: { smoke: 90 } },
      events: [{ type: 'support', when: { at: 2 }, side: 0, kind: 'artillery', enabled: true }],
    });
    const b = makeBattle({ mission: m });
    expect(b.state.sides[0].supportAvailable.artillery).toBe(false);
    expect(b.state.sides[0].supportCooldownFull.smoke).toBe(90);
    run(b, 3);
    expect(b.state.sides[0].supportAvailable.artillery).toBe(true);
  });

  it('endMission ends the battle with its winner and words; setOwner hands a trench over', () => {
    const m = phased([{ id: 'p', title: 'P', objectives: [], next: null }], {
      trenches: [TRENCH],
      events: [
        { type: 'setOwner', when: { at: 1 }, ref: { trench: 7 }, owner: 0 },
        { type: 'endMission', when: { pointCapturedBy: 0, point: { trench: 7 }, delay: 1 }, winner: 0, text: 'The pocket surrenders.' },
      ],
    });
    const b = makeBattle({ mission: m });
    run(b, 3);
    expect([b.state.over, b.state.winner, b.state.endReason, b.state.director.endText]).toEqual([true, 0, 'scripted', 'The pocket surrenders.']);
  });

  it('a surrender objective wins as a surrender, and its objective events fire on the same tick', () => {
    const m = phased([{ id: 'p', title: 'P', objectives: [{ id: 'give', type: 'surrender', side: 1, hqBelow: 0.99 }], next: null }], {
      a: { forces: [{ kind: 'rifle', count: 8, x: 5200, behaviour: 'assault' }] },
      events: [{ type: 'announce', when: { objective: 'give' }, text: 'They give up.' }],
    });
    const b = makeBattle({ mission: m });
    const said = collect(b, 120, 'announce');
    expect([b.state.over, b.state.winner, b.state.endReason]).toEqual([true, 0, 'surrender']);
    expect(said.map((e) => e.text)).toEqual(['They give up.']);
  });

  it('posture: hold keeps the AI from advancing; counterattack sends it in for a while, then free', () => {
    const base = testMission({ a: { supplies: 0 }, b: { supplies: 0, forces: [{ kind: 'rifle', count: 10 }] }, ai: { sappers: 0, build: [], firstAttackAfter: 0 } });
    const held = makeBattle({ mission: { ...base, events: [{ type: 'posture', when: { at: 0 }, side: 1, posture: 'hold' }] }, commanders: ['human', 'ai'] });
    run(held, 60);
    expect(held.state.sides[1].order).toBe('hold');
    const sent = makeBattle({
      mission: { ...base, events: [{ type: 'posture', when: { at: 0 }, side: 1, posture: 'hold' }, { type: 'posture', when: { at: 20 }, side: 1, posture: 'counterattack', seconds: 30 }] },
      commanders: ['human', 'ai'],
    });
    run(sent, 30);
    expect(sent.state.sides[1].order).toBe('advance');
    run(sent, 25);
    expect(sent.state.director.posture[1]).toBe('free');
  });

  it('disguise: units inside the window are not shot at until they fire or the time is up', () => {
    // Riflemen out of their own range of two mortars that can reach them: only the mortars can fire.
    const open = testMission({
      a: { forces: [{ kind: 'rifle', count: 6, x: 2500, leash: 0 }] },
      b: { forces: [{ kind: 'mortar', count: 2, x: 3150, leash: 0 }] },
    });
    const hurt = (b: ReturnType<typeof makeBattle>): number =>
      b.state.sides[0].stats.lost + unitsOf(b, 0, 'rifle').filter((u) => u.hp < u.maxHp).length;
    const seen = makeBattle({ mission: open });
    run(seen, 15);
    expect(hurt(seen)).toBeGreaterThan(0);
    const masked = makeBattle({ mission: { ...open, events: [{ type: 'disguise', when: { at: 0 }, side: 0, seconds: 20, x0: 2300, x1: 2700 }] } });
    run(masked, 15);
    expect(hurt(masked)).toBe(0);
    // The time is up: they are fair game again.
    run(masked, 40);
    expect(hurt(masked)).toBeGreaterThan(0);
  });
});

describe('forces', () => {
  it('a leash of 0 keeps a guard where it stands, even when hit by what it cannot reach', () => {
    const m = testMission({
      b: { forces: [{ kind: 'tank', count: 1, x: 4000, leash: 0 }] },
      a: { forces: [{ kind: 'mortar', count: 2, x: 3300, behaviour: 'guard' }] },
    });
    const b = makeBattle({ mission: m });
    const tank = unitsOf(b, 1, 'tank')[0];
    expect(tank.behaviour).toBe('guard');
    run(b, 40);
    if (tank.alive) expect(Math.abs(tank.x - 4000)).toBeLessThan(1);
  });

  it('a wave at the HQ door never appears behind the other side\'s line (the 1004 counter-attack)', () => {
    const m = testMission({
      a: { forces: [{ kind: 'rifle', count: 3, x: 5500, behaviour: 'guard', leash: 0 }] },
      b: { hqHpMul: 50 },
      events: [{ type: 'wave', when: { at: 1 }, side: 1, forces: [{ kind: 'rifle', count: 6, behaviour: 'assault' }] }],
    });
    const b = makeBattle({ mission: m });
    run(b, 3, checkInvariants);
    for (const u of unitsOf(b, 1, 'rifle')) expect(u.x).toBeGreaterThan(5500);
  });

  it('a wave `at` a point its side holds comes in just behind it; otherwise at the door', () => {
    const m = testMission({
      trenches: [{ ...TRENCH, owner: 0 }],
      events: [
        { type: 'wave', when: { at: 1 }, side: 0, forces: [{ kind: 'rifle', count: 2, at: { trench: 7 } }] },
        { type: 'wave', when: { at: 1 }, side: 1, forces: [{ kind: 'rifle', count: 1, at: { trench: 7 } }] },
      ],
    });
    const b = makeBattle({ mission: m });
    run(b, 1.1);
    for (const u of unitsOf(b, 0, 'rifle')) expect(Math.abs(u.x - 3000)).toBeLessThan(200);
    const door = b.state.sides[1].hq?.doorX ?? 0;
    for (const u of unitsOf(b, 1, 'rifle')) expect(Math.abs(u.x - door)).toBeLessThan(60);
  });
});

describe('admin jump to phase', () => {
  it('puts the phase\'s assumptions in place and enters it', () => {
    const m = phased(
      [
        { id: 'one', title: 'One', objectives: [{ id: 'never', type: 'survive', seconds: 9999 }], next: 'two' },
        {
          id: 'two',
          title: 'Two',
          objectives: [{ id: 'h', type: 'hold', point: { trench: 7 }, seconds: 999 }],
          assume: { owners: [{ ref: { trench: 7 }, owner: 0 }], supplies: [777, 0], forces: [[{ kind: 'rifle', count: 3, trenchId: 7 }], []] },
          next: null,
        },
      ],
      { trenches: [TRENCH] },
    );
    const b = makeBattle({ mission: m });
    run(b, 1);
    expect(b.admin({ type: 'jumpPhase', phase: 'two' })).toBe(1);
    expect(b.state.director.phaseId).toBe('two');
    expect(b.state.trenches[0].owner).toBe(0);
    expect(b.state.sides[0].supplies).toBe(777);
    expect(unitsOf(b, 0, 'rifle')).toHaveLength(3);
    expect(b.admin({ type: 'jumpPhase', phase: 'nowhere' })).toBe(0);
  });
});

describe('the test bot', () => {
  it('holds in a phase it only has to hold out, and attacks in one that needs ground taken', () => {
    const m = phased(
      [
        { id: 'wait', title: 'Wait', objectives: [{ id: 's', type: 'survive', seconds: 60 }], next: 'go' },
        { id: 'go', title: 'Go', objectives: [{ id: 'hq', type: 'destroyHq', side: 1 }], next: null },
      ],
      { a: { supplies: 0, forces: [{ kind: 'rifle', count: 12 }] }, bot: { sappers: 0, build: [], firstAttackAfter: 0 } },
    );
    const b = makeBattle({ mission: m, commanders: ['bot', 'human'] });
    let advanced = false;
    run(b, 55, (x) => {
      if (x.state.sides[0].order === 'advance') advanced = true;
    });
    expect(advanced).toBe(false);
    expect(runUntil(b, 60, (x) => x.state.sides[0].order === 'advance')).toBe(true);
  });
});
