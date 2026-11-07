import { describe, expect, it } from 'vitest';
import { BattleSession } from '../../src/app/session';
import { APP } from '../../src/data/app';
import { M01 } from '../../src/data/missions/m01';
import type { MissionDef, UnitKind } from '../../src/data/schema';
import { createBattle, type Battle, type Command, type UnitState } from '../../src/sim';
import { createFakeAudio, createFakeView } from './app-helpers';

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

function firstOwnUnit(battle: Battle, kind: UnitKind): UnitState {
  for (let i = 0; i < battle.state.unitCount; i++) {
    const u = battle.state.units[i];
    if (u.alive && u.side === 0 && u.kind === kind) return u;
  }
  throw new Error(`no ${kind} on side 0`);
}

/** Mission 1 with one lone British rifleman on the open field and three German machine guns dug in ahead of him. */
function loneRifleman(): MissionDef {
  const m: MissionDef = structuredClone(M01);
  m.events = [];
  m.start[0].forces = [{ kind: 'rifle', count: 1, x: 3000 }];
  m.start[1].forces = [{ kind: 'lmg', count: 3, x: 3500, behaviour: 'guard' }];
  return m;
}

/** One rendered frame at normal speed: forward the held controls, then run two sim ticks. */
function frame(session: BattleSession, ticks = 2): void {
  session.flushControl();
  for (let i = 0; i < ticks; i++) session.step();
  session.fill(false, false);
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

  it('sends orders for one unit kind and Follow army, and the sim applies them to that kind only', () => {
    const { session, sent, battle } = setup();
    expect(session.dispatch({ type: 'order', order: 'advance' })).toBe(true);
    expect(session.dispatch({ type: 'order', order: 'hold', kind: 'rifle' })).toBe(true);
    session.step();
    expect(battle.state.sides[0].order).toBe('advance');
    expect(battle.state.sides[0].kindOrders.rifle).toBe('hold');
    expect(battle.state.sides[0].kindOrders.sapper).toBeNull();
    expect(session.dispatch({ type: 'followArmy', kind: 'rifle' })).toBe(true);
    expect(session.dispatch({ type: 'followArmy' })).toBe(true);
    session.step();
    expect(battle.state.sides[0].kindOrders.rifle).toBeNull();
    expect(sent).toEqual([
      { type: 'order', order: 'advance' },
      { type: 'order', order: 'hold', kind: 'rifle' },
      { type: 'followArmy', kind: 'rifle' },
      { type: 'followArmy' },
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

  describe('support call-ins', () => {
    it('ignores a call-in the mission does not offer', () => {
      // Mission 1 has no supports at all.
      const { session, view, sent } = setup();
      expect(session.fill(false, false).supports).toEqual([]);
      session.dispatch({ type: 'support', kind: 'smoke' });
      expect(view.targeting).toEqual([]);
      session.tapGround(1000);
      session.step();
      expect(sent).toEqual([]);
      expect(session.fill(false, false).targeting).toBeNull();
    });

    it('targets a support, calls it on the next ground tap, and the sim starts its cooldown', () => {
      const { session, battle, view, sent } = setup(withSupports());
      expect(session.fill(false, false).supports.map((s) => s.kind)).toEqual(['artillery', 'smoke']);
      session.dispatch({ type: 'support', kind: 'smoke' });
      expect(session.fill(false, false).targeting).toBe('smoke');
      expect(session.aiming).toBe('smoke');
      expect(view.targeting).toEqual(['smoke']);
      session.tapGround(2222);
      expect(sent).toEqual([{ type: 'support', kind: 'smoke', x: 2222 }]);
      expect(session.fill(false, false).targeting).toBeNull();
      expect(view.targeting).toEqual(['smoke', null]);

      session.step();
      expect(battle.state.sides[0].supportCooldown.smoke).toBeGreaterThan(0);
      expect(session.tally.supportCalled.smoke).toBe(1);
      expect(session.tally.supportCalled.artillery).toBe(0);
      const hud = session.fill(false, false);
      expect(hud.supports.find((s) => s.kind === 'smoke')?.charge ?? 1).toBeLessThan(1);
    });

    it('counts the smoke cloud once the call-in has run its delay, and the incoming warning before it', () => {
      const { session, battle } = setup(withSupports());
      session.dispatch({ type: 'support', kind: 'smoke' });
      session.tapGround(2222);
      for (let i = 0; i < 30 * 4; i++) session.step();
      expect(session.tally.supportIncoming.smoke).toBe(1);
      expect(session.tally.smokeSpawned).toBe(1);
      expect(battle.state.smokes.some((s) => s.alive)).toBe(true);
    });

    it('will not aim a support that is cooling down, nor call one twice', () => {
      const { session, view, sent } = setup(withSupports());
      session.dispatch({ type: 'support', kind: 'smoke' });
      session.tapGround(2000);
      session.step();
      sent.length = 0;
      view.targeting.length = 0;
      session.dispatch({ type: 'support', kind: 'smoke' });
      expect(session.aiming).toBeNull();
      expect(view.targeting).toEqual([]);
      session.tapGround(2100);
      expect(sent).toEqual([]);
    });

    it('cancels targeting without calling anything', () => {
      const { session, sent } = setup(withSupports());
      session.dispatch({ type: 'support', kind: 'artillery' });
      session.dispatch({ type: 'cancelTargeting' });
      session.tapGround(1000);
      expect(sent).toEqual([]);
    });

    it('leaves targeting when the battle ends', () => {
      const mission = withSupports();
      mission.start[0].hqHpMul = 0.01;
      mission.start[1].forces = [{ kind: 'rifle', count: 8, x: 700 }];
      const { session } = setup(mission);
      session.dispatch({ type: 'support', kind: 'artillery' });
      expect(session.aiming).toBe('artillery');
      for (let i = 0; i < 30 * 600 && !session.ended; i++) session.step();
      session.fill(false, false);
      expect(session.aiming).toBeNull();
    });
  });

  describe('direct control', () => {
    it('takes control on a tap, drives the unit with the stick and lets go on a second tap', () => {
      const { session, battle, view, sent } = setup();
      const rifle = firstOwnUnit(battle, 'rifle');
      session.tapUnit(rifle.id);
      expect(sent).toEqual([{ type: 'control', unit: rifle.id }]);
      frame(session);
      expect(battle.state.sides[0].controlled).toBe(rifle.index);
      expect(rifle.controlled).toBe(true);
      expect(view.controlled).toContain(rifle.id);
      expect(session.hud.state.control?.kind).toBe('rifle');
      expect(session.hud.state.control?.hasAbility).toBe(false);

      sent.length = 0;
      const startX = rifle.x;
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
      for (let i = 0; i < 60; i++) frame(session);
      expect(Math.abs(rifle.x - startX)).toBeGreaterThan(20);

      sent.length = 0;
      session.tapUnit(rifle.id);
      expect(sent).toEqual([
        { type: 'controlInput', moveX: 0, fire: false, ability: false },
        { type: 'control', unit: -1 },
      ]);
      frame(session);
      expect(battle.state.sides[0].controlled).toBe(-1);
      expect(session.hud.state.control).toBeNull();
      expect(view.controlled[view.controlled.length - 1]).toBe(-1);
    });

    it('tells the sim to stop him once when the stick and fire are let go (pause, lost focus)', () => {
      const { session, battle, sent } = setup();
      const rifle = firstOwnUnit(battle, 'rifle');
      session.tapUnit(rifle.id);
      frame(session);
      session.dispatch({ type: 'stick', x: -1 });
      session.dispatch({ type: 'fire', down: true });
      frame(session);
      sent.length = 0;
      session.stopInputs();
      session.flushControl();
      session.flushControl();
      expect(sent).toEqual([{ type: 'controlInput', moveX: 0, fire: false, ability: false }]);
    });

    it('switches to another man when he is tapped, and lets go on the release button', () => {
      const { session, battle, sent } = setup();
      const sapper = firstOwnUnit(battle, 'sapper');
      const rifle = firstOwnUnit(battle, 'rifle');
      session.tapUnit(sapper.id);
      expect(sent).toEqual([]);
      session.tapUnit(rifle.id);
      frame(session);
      expect(battle.state.sides[0].controlled).toBe(rifle.index);
      session.dispatch({ type: 'release' });
      frame(session);
      expect(battle.state.sides[0].controlled).toBe(-1);
      expect(session.hud.state.control).toBeNull();
    });

    it('does not take control of a sapper or an enemy', () => {
      const { session, battle, sent } = setup();
      session.tapUnit(firstOwnUnit(battle, 'sapper').id);
      const enemy = battle.state.units.find((u) => u.alive && u.side === 1);
      if (enemy) session.tapUnit(enemy.id);
      expect(sent).toEqual([]);
    });

    it('ignores taps on units while a support is being aimed', () => {
      const { session, battle, sent } = setup(withSupports());
      session.dispatch({ type: 'support', kind: 'smoke' });
      session.tapUnit(firstOwnUnit(battle, 'rifle').id);
      expect(sent).toEqual([]);
    });

    it('lets everything go when the controlled man is killed', () => {
      const { session, battle, view } = setup(loneRifleman());
      const rifle = firstOwnUnit(battle, 'rifle');
      session.tapUnit(rifle.id);
      frame(session);
      expect(session.hud.state.control).not.toBeNull();
      session.dispatch({ type: 'stick', x: 1 });
      session.dispatch({ type: 'fire', down: true });
      for (let i = 0; i < 30 * 40 && session.tally.controlLost === 0; i++) frame(session, 1);
      expect(session.tally.controlLost).toBe(1);
      expect(rifle.alive).toBe(false);
      expect(session.tally.controlledShots).toBeGreaterThan(0);
      expect(battle.state.sides[0].controlled).toBe(-1);
      expect(session.hud.state.control).toBeNull();
      expect(view.controlled[view.controlled.length - 1]).toBe(-1);

      // The stick the HUD still held is gone: nothing more is sent for a man who no longer exists.
      const commands: Command[] = [];
      const command = battle.command.bind(battle);
      battle.command = (side, cmd) => {
        commands.push({ ...cmd });
        command(side, cmd);
      };
      frame(session);
      frame(session);
      expect(commands).toEqual([]);
    });

    it('throws the secondary weapon when the ability button is pressed, and not before', () => {
      const m: MissionDef = structuredClone(M01);
      m.events = [];
      m.trenches = [{ id: 1, x: 3120, width: 130, slots: 6, owner: 1 }];
      m.start[0].forces = [{ kind: 'assault', count: 1, x: 3000 }];
      m.start[1].forces = [{ kind: 'rifle', count: 3, trenchId: 1 }];
      const { session, battle } = setup(m);
      const grenadier = firstOwnUnit(battle, 'assault');
      session.tapUnit(grenadier.id);
      frame(session);
      expect(session.hud.state.control?.hasAbility).toBe(true);
      expect(session.hud.state.control?.abilityName).toBe(APP.abilityNames.assault);
      for (let i = 0; i < 20; i++) frame(session);
      expect(session.tally.explosion).toBe(0);

      session.dispatch({ type: 'ability' });
      for (let i = 0; i < 30 && session.tally.explosion === 0; i++) frame(session);
      expect(session.tally.explosion).toBeGreaterThan(0);
      // The grenade is reloading: the HUD shows the button charging.
      expect(session.hud.state.control?.abilityCharge ?? 1).toBeLessThan(1);
    });

    it('counts the shots of the man under control, and only his', () => {
      const { session, battle } = setup(loneRifleman());
      const rifle = firstOwnUnit(battle, 'rifle');
      for (let i = 0; i < 30 * 10; i++) frame(session, 1);
      expect(session.tally.controlledShots).toBe(0);
      session.tapUnit(rifle.id);
      frame(session);
      session.dispatch({ type: 'stick', x: 1 });
      session.dispatch({ type: 'fire', down: true });
      for (let i = 0; i < 30 * 40 && session.tally.controlLost === 0; i++) frame(session, 1);
      expect(session.tally.controlledShots).toBeGreaterThan(0);
    });

    describe('camera', () => {
      function controlled() {
        const ctx = setup();
        const rifle = firstOwnUnit(ctx.battle, 'rifle');
        ctx.session.tapUnit(rifle.id);
        frame(ctx.session);
        return { ...ctx, rifle };
      }

      // The dead zone is anchored `lead` behind the centre (away from the enemy), so the view looks ahead of him.
      it('stays still while the man is inside the dead zone', () => {
        const { session, view, rifle } = controlled();
        const lead = APP.follow.lead * view.camera.viewWidthWu;
        view.camera.centers.length = 0;
        view.camera.centerX = rifle.x + lead + 0.5 * APP.follow.deadZone * view.camera.viewWidthWu;
        session.fill(false, false);
        expect(view.camera.centers).toEqual([]);
        view.camera.centerX = rifle.x + lead - 0.5 * APP.follow.deadZone * view.camera.viewWidthWu;
        session.fill(false, false);
        expect(view.camera.centers).toEqual([]);
      });

      it('glides after him once he leaves it, to either side, leaving him inside the zone', () => {
        const { session, view, rifle } = controlled();
        const dead = APP.follow.deadZone * view.camera.viewWidthWu;
        const lead = APP.follow.lead * view.camera.viewWidthWu;
        view.camera.centers.length = 0;
        view.camera.centerX = rifle.x - 3 * dead;
        session.fill(false, false);
        expect(view.camera.centers).toEqual([rifle.x + lead - dead * APP.follow.settle]);
        view.camera.centerX = rifle.x + lead + 3 * dead;
        session.fill(false, false);
        expect(view.camera.centers[1]).toBeCloseTo(rifle.x + lead + dead * APP.follow.settle, 6);
        expect(dead * APP.follow.settle).toBeLessThan(dead);
      });

      it('keeps him behind the centre, away from the enemy, so the view shows what is ahead', () => {
        const { session, view, rifle } = controlled();
        view.camera.centers.length = 0;
        view.camera.centerX = rifle.x - 2000;
        session.fill(false, false);
        const settled = view.camera.centers[0];
        expect(settled).toBeGreaterThan(rifle.x);
        expect(settled - rifle.x).toBeLessThan(APP.follow.lead * view.camera.viewWidthWu);
      });

      it('leaves a view the player is dragging alone', () => {
        const { session, view, rifle } = controlled();
        view.camera.centers.length = 0;
        view.camera.centerX = rifle.x - 2000;
        view.camera.dragging = true;
        session.fill(false, false);
        expect(view.camera.centers).toEqual([]);
        view.camera.dragging = false;
        session.fill(false, false);
        expect(view.camera.centers).toHaveLength(1);
      });

      it('does nothing when no one is controlled', () => {
        const { session, view } = setup();
        view.camera.centers.length = 0;
        view.camera.centerX = -5000;
        session.fill(false, false);
        expect(view.camera.centers).toEqual([]);
      });
    });
  });

  describe('event tally', () => {
    it('starts empty and counts only what the player did or suffered', () => {
      const { session } = setup();
      expect(session.tally.smokeSpawned).toBe(0);
      expect(session.tally.controlLost).toBe(0);
      expect(session.tally.supportCalled).toEqual({ artillery: 0, smoke: 0, airStrike: 0 });
    });
  });
});
