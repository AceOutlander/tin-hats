import { afterEach, describe, expect, it } from 'vitest';
import { BattleSession } from '../../src/app/session';
import { M01 } from '../../src/data/missions/m01';
import type { MissionDef } from '../../src/data/schema';
import { SIM_FEATURES, createBattle, type Battle, type Command } from '../../src/sim';
import { createFakeAudio, createFakeView } from './app-helpers';

const original = { ...SIM_FEATURES };

afterEach(() => {
  Object.assign(SIM_FEATURES, original);
});

function enable(features: Partial<typeof SIM_FEATURES>): void {
  Object.assign(SIM_FEATURES, features);
}

function setup(mission: MissionDef = M01) {
  const battle = createBattle({ mission, difficulty: 'normal', seed: 3, upgrades: {}, commanders: ['human', 'ai'] });
  const sent: Command[] = [];
  const command = battle.command.bind(battle);
  battle.command = (side, cmd) => {
    if (side === 0) sent.push({ ...cmd });
    command(side, cmd);
  };
  const view = createFakeView();
  const audio = createFakeAudio();
  let ended = 0;
  const session = new BattleSession(battle, 'normal', 3, view, audio, { hints: () => true, sound: () => true, onEnded: () => ended++ });
  return { battle, view, audio, session, sent, ended: () => ended };
}

function withSupports(): MissionDef {
  const m: MissionDef = structuredClone(M01);
  m.supports = [['smoke', 'artillery'], []];
  return m;
}

function firstOwnUnit(battle: Battle, kind: string): number {
  for (let i = 0; i < battle.state.unitCount; i++) {
    const u = battle.state.units[i];
    if (u.alive && u.side === 0 && u.kind === kind) return u.id;
  }
  return -1;
}

describe('BattleSession', () => {
  it('queues train and order commands for the player side', () => {
    const { session, sent } = setup();
    expect(session.dispatch({ type: 'train', kind: 'rifle' })).toBe(true);
    expect(session.dispatch({ type: 'order', order: 'fallBack' })).toBe(true);
    expect(sent).toEqual([
      { type: 'train', kind: 'rifle' },
      { type: 'order', order: 'fallBack' },
    ]);
  });

  it('leaves pause, restart, quit and mute to the app', () => {
    const { session } = setup();
    for (const type of ['pause', 'resume', 'restart', 'quit', 'toggleMute'] as const) {
      expect(session.dispatch({ type })).toBe(false);
    }
  });

  it('runs the view pass after every step', () => {
    const { session, view } = setup();
    for (let i = 0; i < 5; i++) session.step();
    expect(view.afterSteps).toBe(5);
  });

  it('shows the mission hints and expires them', () => {
    const { session } = setup();
    for (let i = 0; i < 70; i++) session.step();
    session.fill(false, false);
    expect(session.hud.state.hint).toContain('Sappers carry supplies');
    // The second hint (16 s) has come and gone by 33 s; the third arrives at 38 s.
    for (let i = 0; i < 30 * 31; i++) session.step();
    session.fill(false, false);
    expect(session.hud.state.hint).toBeNull();
  });

  it('suppresses hints when they are switched off', () => {
    const battle = createBattle({ mission: M01, difficulty: 'normal', seed: 3, upgrades: {}, commanders: ['human', 'ai'] });
    const session = new BattleSession(battle, 'normal', 3, createFakeView(), createFakeAudio(), { hints: () => false, sound: () => true, onEnded: () => undefined });
    for (let i = 0; i < 100; i++) session.step();
    session.fill(false, false);
    expect(session.hud.state.hint).toBeNull();
  });

  it('shows announcements as banners with a changing counter', () => {
    const mission: MissionDef = structuredClone(M01);
    mission.events = [
      { type: 'announce', when: { at: 1 }, text: 'First' },
      { type: 'announce', when: { at: 10 }, text: 'Second' },
    ];
    const { session } = setup(mission);
    for (let i = 0; i < 40; i++) session.step();
    session.fill(false, false);
    const first = session.hud.state.bannerSeq;
    expect(session.hud.state.banner).toBe('First');
    for (let i = 0; i < 30 * 20; i++) session.step();
    session.fill(false, false);
    expect(session.hud.state.banner).toBeNull();
    expect(session.hud.state.bannerSeq).toBe(2);
    expect(first).toBeGreaterThan(0);
  });

  it('reports the end of the battle once', () => {
    const mission: MissionDef = structuredClone(M01);
    mission.start[0].hqHpMul = 0.01;
    mission.start[1].forces = [{ kind: 'rifle', count: 8, x: 700 }];
    const { session, ended } = setup(mission);
    for (let i = 0; i < 30 * 600 && !session.ended; i++) session.step();
    expect(session.ended).toBe(true);
    expect(ended()).toBe(1);
    session.step();
    session.step();
    expect(ended()).toBe(1);
  });

  function lostBattle(sound: boolean) {
    const mission: MissionDef = structuredClone(M01);
    mission.start[0].hqHpMul = 0.01;
    mission.start[1].forces = [{ kind: 'rifle', count: 8, x: 700 }];
    const battle = createBattle({ mission, difficulty: 'normal', seed: 3, upgrades: {}, commanders: ['human', 'ai'] });
    const audio = createFakeAudio();
    const session = new BattleSession(battle, 'normal', 3, createFakeView(), audio, { hints: () => true, sound: () => sound, onEnded: () => undefined });
    for (let i = 0; i < 30 * 600 && !session.ended; i++) session.step();
    return { session, audio };
  }

  it('plays the defeat sting when the battle is lost, and the victory sting when it is won', () => {
    const { session, audio } = lostBattle(true);
    expect(session.ended).toBe(true);
    expect(audio.played).toEqual(['defeatSting']);

    const won: MissionDef = structuredClone(M01);
    won.start[1].hqHpMul = 0.01;
    won.start[0].forces = [{ kind: 'rifle', count: 8, x: won.length - 700 }];
    const battle = createBattle({ mission: won, difficulty: 'normal', seed: 3, upgrades: {}, commanders: ['human', 'ai'] });
    const winAudio = createFakeAudio();
    const winSession = new BattleSession(battle, 'normal', 3, createFakeView(), winAudio, { hints: () => true, sound: () => true, onEnded: () => undefined });
    winSession.dispatch({ type: 'order', order: 'advance' });
    for (let i = 0; i < 30 * 600 && !winSession.ended; i++) winSession.step();
    expect(winSession.ended).toBe(true);
    expect(winAudio.played).toEqual(['victorySting']);
  });

  it('is silent when sound is switched off for fast-forward', () => {
    const { session, audio } = lostBattle(false);
    expect(session.ended).toBe(true);
    expect(audio.played).toEqual([]);
  });
  describe('while the sim has no supports or direct control (Phase 1)', () => {
    it('ignores support, control and stick actions', () => {
      // The sim now has both (Phase 2): switch them off to test the Phase 1 path.
      enable({ supports: false, directControl: false });
      const { session, battle, view, sent } = setup(withSupports());
      const rifle = firstOwnUnit(battle, 'rifle');
      expect(rifle).toBeGreaterThanOrEqual(0);
      session.dispatch({ type: 'support', kind: 'smoke' });
      expect(view.targeting).toEqual([]);
      session.tapGround(1000);
      session.tapUnit(rifle);
      session.dispatch({ type: 'stick', x: 1 });
      session.dispatch({ type: 'fire', down: true });
      session.dispatch({ type: 'ability' });
      session.dispatch({ type: 'release' });
      session.flushControl();
      session.step();
      expect(sent).toEqual([]);
      expect(session.fill(false, false).control).toBeNull();
      expect(session.fill(false, false).targeting).toBeNull();
    });
  });

  describe('once the sim supports them (Phase 2 wiring)', () => {
    it('targets a support, calls it on the next ground tap and leaves targeting', () => {
      enable({ supports: true });
      const { session, view, sent } = setup(withSupports());
      expect(session.fill(false, false).supports.map((s) => s.kind)).toEqual(['artillery', 'smoke']);
      session.dispatch({ type: 'support', kind: 'smoke' });
      expect(session.fill(false, false).targeting).toBe('smoke');
      expect(view.targeting).toEqual(['smoke']);
      session.tapGround(2222);
      expect(sent).toEqual([{ type: 'support', kind: 'smoke', x: 2222 }]);
      expect(session.fill(false, false).targeting).toBeNull();
      expect(view.targeting).toEqual(['smoke', null]);
    });

    it('cancels targeting without calling anything', () => {
      enable({ supports: true });
      const { session, sent } = setup(withSupports());
      session.dispatch({ type: 'support', kind: 'artillery' });
      session.dispatch({ type: 'cancelTargeting' });
      session.tapGround(1000);
      expect(sent).toEqual([]);
    });

    it('takes control on a tap, sends the stick and buttons, and lets go on a second tap', () => {
      enable({ directControl: true });
      const { session, battle, view, sent } = setup();
      const id = firstOwnUnit(battle, 'rifle');
      session.tapUnit(id);
      expect(sent).toEqual([{ type: 'control', unit: id }]);

      // Pretend the sim has accepted it.
      const unit = battle.state.units.find((u) => u.id === id);
      if (!unit) throw new Error('unit missing');
      unit.controlled = true;
      battle.state.sides[0].controlled = unit.index;
      session.fill(false, false);
      expect(view.controlled).toContain(id);
      expect(session.hud.state.control?.kind).toBe('rifle');

      sent.length = 0;
      session.dispatch({ type: 'stick', x: 0.7 });
      session.dispatch({ type: 'fire', down: true });
      session.flushControl();
      session.dispatch({ type: 'ability' });
      session.flushControl();
      session.flushControl();
      expect(sent).toEqual([
        { type: 'controlInput', moveX: 0.7, fire: true, ability: false },
        { type: 'controlInput', moveX: 0.7, fire: true, ability: true },
        { type: 'controlInput', moveX: 0.7, fire: true, ability: false },
      ]);

      sent.length = 0;
      session.tapUnit(id);
      expect(sent).toEqual([
        { type: 'controlInput', moveX: 0, fire: false, ability: false },
        { type: 'control', unit: -1 },
      ]);
    });

    it('does not take control of a sapper or an enemy', () => {
      enable({ directControl: true });
      const { session, battle, sent } = setup();
      session.tapUnit(firstOwnUnit(battle, 'sapper'));
      const enemy = battle.state.units.find((u) => u.alive && u.side === 1);
      if (enemy) session.tapUnit(enemy.id);
      expect(sent).toEqual([]);
    });
  });
});
