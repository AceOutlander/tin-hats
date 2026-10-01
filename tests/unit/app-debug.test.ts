import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app/app';
import { debugEnabled, installDebug } from '../../src/app/debug';
import { createMemoryStorage } from '../../src/meta';
import type { UiHandle } from '../../src/ui';
import { createFakeAudio, createFakeUi, createFakeView, quickMission } from './app-helpers';

/** The debug hooks put themselves on `window`: give Node a stand-in for the test. */
let fakeWindow: Record<string, unknown>;

beforeEach(() => {
  fakeWindow = {};
  vi.stubGlobal('window', fakeWindow);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function setup() {
  const view = createFakeView();
  const audio = createFakeAudio();
  const fakeUi = createFakeUi();
  const app = new App({ view, audio, storage: createMemoryStorage(), missions: [quickMission(1, true)], random: () => 0.25 });
  app.attachUi(fakeUi);
  const ui: UiHandle = Object.assign(fakeUi, {
    getHudButtonRects: () => ({}),
  }) as unknown as UiHandle;
  const api = installDebug(app, view, ui, audio);
  return { app, view, audio, api };
}

describe('debug hooks', () => {
  it('are enabled only by ?debug=1', () => {
    expect(debugEnabled('?debug=1')).toBe(true);
    expect(debugEnabled('?a=1&debug=1')).toBe(true);
    expect(debugEnabled('')).toBe(false);
    expect(debugEnabled('?debug=0')).toBe(false);
  });

  it('install on window.__TH', () => {
    const { api } = setup();
    expect(fakeWindow.__TH).toBe(api);
  });

  it('report the sound engine state', () => {
    const { api } = setup();
    expect(api.audio()).toEqual({ state: 'running', played: 0, dropped: 0 });
  });

  it('describe the field before and during a battle', () => {
    const { api, app } = setup();
    expect(api.field()).toBeNull();
    expect(api.state().inBattle).toBe(false);

    app.beginMission(1, 'normal');
    const f = api.field();
    expect(f).not.toBeNull();
    if (!f) return;
    // Mission 1 puts the player's HQ on the left and the enemy's on the right.
    expect(f.playerHqX).toBeLessThan(f.enemyHqX);
    // The quick mission starts the player's riflemen near the enemy HQ; sappers never count as the front.
    expect(f.playerFrontX).not.toBeNull();
    expect(f.playerFrontX ?? 0).toBeGreaterThan(f.playerHqX);
    if (f.enemyFrontX !== null && f.playerFrontX !== null) expect(f.gap).toBeCloseTo(Math.abs(f.enemyFrontX - f.playerFrontX), 6);
    expect(f.sappersCarrying).toBeGreaterThanOrEqual(0);
  });

  it('count a sapper that carries supplies', () => {
    const { api, app } = setup();
    app.beginMission(1, 'normal');
    const state = app.session?.battle.state;
    expect(state).toBeDefined();
    if (!state) return;
    expect(api.field()?.sappersCarrying).toBe(0);
    for (let i = 0; i < state.unitCount; i++) {
      const u = state.units[i];
      if (u.alive && u.side === 0 && u.kind === 'sapper') {
        u.carrying = 10;
        break;
      }
    }
    expect(api.field()?.sappersCarrying).toBe(1);
  });

  it('list the living units for visual QA scripts', () => {
    const { api, app } = setup();
    expect(api.units()).toEqual([]);
    app.beginMission(1, 'normal');
    const state = app.session?.battle.state;
    if (!state) throw new Error('no battle');
    const list = api.units();
    let alive = 0;
    for (let i = 0; i < state.unitCount; i++) if (state.units[i].alive) alive++;
    expect(list.length).toBe(alive);
    expect(list.length).toBeGreaterThan(0);
    const first = state.units.slice(0, state.unitCount).find((u) => u.alive);
    const info = list.find((u) => u.id === first?.id);
    expect(info).toMatchObject({ kind: first?.kind, side: first?.side, action: first?.action, x: first?.x, row: first?.row, inside: first?.inside });
  });

  it('move the camera and grant supplies', () => {
    const { api, app, view } = setup();
    app.beginMission(1, 'normal');
    const before = api.state().supplies;
    api.grantSupplies(250);
    expect(api.state().supplies).toBe(before + 250);
    api.lookAt(1234);
    expect(view.camera.centerX).toBe(1234);
  });

  describe('on the proving ground', () => {
    it('start the sandbox, which is not in the campaign, and its mirrored twin', () => {
      const { api, app } = setup();
      expect(api.startSandbox(7)).toBe(true);
      expect(api.state()).toMatchObject({ inBattle: true, missionId: 901, seed: 7, difficulty: 'normal' });
      expect(app.missions.map((m) => m.id)).not.toContain(901);
      api.startSandbox(8, true);
      expect(api.state()).toMatchObject({ missionId: 902, seed: 8 });
    });

    it('report trenches, pillboxes, wire, supports and smoke', () => {
      const { api } = setup();
      api.startSandbox(7);
      const s = api.state();
      expect(s.trenches.map((t) => [t.id, t.owner])).toEqual([
        [1, 0],
        [2, 1],
        [3, 1],
      ]);
      expect(s.trenches[0].occupants).toBeGreaterThan(0);
      expect(s.pillboxes).toHaveLength(2);
      expect(s.pillboxes.every((p) => p.alive && p.hp === p.maxHp && p.side === 1)).toBe(true);
      expect(s.wires).toBe(2);
      expect(s.smokes).toBe(0);
      expect(s.targeting).toBeNull();
      expect(s.controlled).toBeNull();
      for (const kind of ['artillery', 'smoke', 'airStrike'] as const) expect(s.supports[kind]).toEqual({ available: true, cooldown: 0 });
    });

    it('report the controlled man, the support the player is aiming, and the cooldown after a call', () => {
      const { api, app } = setup();
      api.startSandbox(7);
      const session = app.session;
      if (!session) throw new Error('no session');
      const rifle = api.units().find((u) => u.side === 0 && u.kind === 'rifle');
      if (!rifle) throw new Error('no rifleman');
      session.tapUnit(rifle.id);
      session.step();
      const taken = api.state().controlled;
      expect(taken).toMatchObject({ id: rifle.id, kind: 'rifle', inTrench: true });
      session.tapUnit(rifle.id);
      session.step();
      expect(api.state().controlled).toBeNull();

      session.dispatch({ type: 'support', kind: 'artillery' });
      expect(api.state().targeting).toBe('artillery');
      session.tapGround(3000);
      session.step();
      const after = api.state();
      expect(after.targeting).toBeNull();
      expect(after.supports.artillery.cooldown).toBeGreaterThan(0);
      expect(after.tally.supportCalled.artillery).toBe(1);
    });

    it('grant population on top of supplies, so one of every kind can be trained', () => {
      const { api } = setup();
      api.startSandbox(7);
      const before = api.state();
      api.grantPopulation(25);
      expect(api.state().popCap).toBe(before.popCap + 25);
    });

    it('give the camera scale for converting a world x to a screen x', () => {
      const { api, view } = setup();
      const stats = view.getStats();
      view.getStats = () => ({ ...stats, canvasW: 1688, dpr: 2 });
      // An 844 CSS px wide canvas showing 1000 wu.
      expect(api.camera().cssPerWu).toBeCloseTo(0.844, 6);
      expect(api.camera().left).toBe(view.camera.centerX - view.camera.viewWidthWu / 2);
    });
  });

  it('keep the time scale within the limits', () => {
    const { api } = setup();
    api.setTimeScale(1e9);
    expect(api.getTimeScale()).toBeLessThanOrEqual(240);
    api.setTimeScale(-5);
    expect(api.getTimeScale()).toBe(0);
    api.setTimeScale(Number.NaN);
    expect(api.getTimeScale()).toBe(1);
  });
});
