import { describe, expect, it } from 'vitest';
import { App } from '../../src/app/app';
import { buildCampaignView, describeEffect, describeLevel } from '../../src/app/campaignView';
import { APP } from '../../src/data/app';
import { M01 } from '../../src/data/missions/m01';
import { SANDBOX } from '../../src/data/missions/sandbox';
import type { UpgradeDef } from '../../src/data/schema';
import { createMemoryStorage, defaultSave, loadSave, recordClear, writeSave } from '../../src/meta';
import { createFakeAudio, createFakeUi, createFakeView, quickMission } from './app-helpers';

function makeApp(missions = [quickMission(1, true), quickMission(2, false)], upgradeDefs: UpgradeDef[] = []) {
  const view = createFakeView();
  const audio = createFakeAudio();
  const ui = createFakeUi();
  const storage = createMemoryStorage();
  const app = new App({ view, audio, storage, missions, upgradeDefs, random: () => 0.25 });
  app.attachUi(ui);
  return { app, view, audio, ui, storage, missions };
}

/** Drive the loop through the view's frame handler, like Phaser would. */
function frames(view: ReturnType<typeof createFakeView>, count: number, dtMs = 100): void {
  for (let i = 0; i < count; i++) view.frame?.(dtMs);
}

describe('app flow', () => {
  it('starts a mission: attaches the view, shows the battle and builds the HUD', () => {
    const { app, view, ui } = makeApp();
    app.startMission(1, 'hard');
    expect(view.attached).toBe(app.session?.battle);
    expect(view.attachOptions?.playerSide).toBe(0);
    expect(ui.current()).toBe('battle');
    expect(app.session?.difficulty).toBe('hard');
    expect(app.session?.hud.state.train.length).toBeGreaterThan(0);
    frames(view, 3);
    expect(view.renders.length).toBe(3);
    expect(ui.huds).toBe(3);
  });

  it('ignores a mission that does not exist', () => {
    const { app, ui } = makeApp();
    expect(app.beginMission(99, 'normal')).toBe(false);
    expect(app.session).toBeNull();
    expect(ui.screens).toEqual([]);
  });

  describe('a mission outside the campaign (the sandbox grounds)', () => {
    /** The proving ground with its HQ already as good as down, so the battle is over within seconds. */
    function quickGround() {
      const m = structuredClone(SANDBOX);
      m.events = [];
      m.start[1].hqHpMul = 0.001;
      m.start[1].forces = [];
      m.trenches = [];
      m.pillboxes = [];
      m.wire = [];
      m.start[0].forces = [{ kind: 'rifle', count: 8, x: m.length - 700 }];
      return m;
    }

    it('starts without being listed, and a win on it never reaches the save', () => {
      const { app, view, ui, storage } = makeApp();
      const ground = quickGround();
      app.beginUnlisted(ground, 'normal', 5);
      expect(ui.current()).toBe('battle');
      expect(app.missions.some((m) => m.id === ground.id)).toBe(false);
      expect(app.campaign().missions.some((m) => m.id === ground.id)).toBe(false);
      app.dispatch({ type: 'order', order: 'advance' });
      for (let i = 0; i < 2000 && !app.lastResult; i++) frames(view, 1, 250);
      expect(app.lastResult?.won).toBe(true);
      expect(app.lastResult?.nextMissionId).toBeNull();
      expect(app.lastResult?.pointsAwarded).toBe(0);
      expect(app.save.cleared).toEqual({});
      expect(storage.getItem('tinhats.save')).toBeNull();
    });

    it('restarts the same ground from the pause menu', () => {
      const { app, view } = makeApp();
      const ground = quickGround();
      app.beginUnlisted(ground, 'normal', 5);
      frames(view, 3);
      const first = app.session;
      expect(first?.mission.id).toBe(ground.id);
      app.dispatch({ type: 'restart' });
      expect(app.session).not.toBe(first);
      expect(app.session?.mission.id).toBe(ground.id);
      expect(app.session?.battle.state.tick).toBe(0);
    });
  });

  it('maps HUD actions to sim commands', () => {
    const { app, view } = makeApp();
    app.startMission(1, 'normal');
    app.dispatch({ type: 'train', kind: 'rifle' });
    app.dispatch({ type: 'order', order: 'advance' });
    frames(view, 2);
    const s = app.session?.battle.state;
    expect(s?.sides[0].order).toBe('advance');
    expect(s?.sides[0].queue.rifle).toBe(1);
    expect(s?.sides[0].supplies).toBeLessThan(M01.start[0].supplies + 500);
    app.dispatch({ type: 'minimap', frac: 0.4 });
    expect(view.camera.jumps).toEqual([0.4]);
  });

  it('runs steps, view passes and the camera jump from the loop', () => {
    const { app, view } = makeApp();
    app.startMission(1, 'normal');
    frames(view, 10, 100);
    expect(app.session?.battle.state.tick).toBe(30);
    expect(view.afterSteps).toBe(30);
  });

  it('pauses and resumes from the HUD: no steps while paused, sound suspended', () => {
    const { app, view, audio } = makeApp();
    app.startMission(1, 'normal');
    frames(view, 3);
    const tick = app.session?.battle.state.tick;
    app.dispatch({ type: 'pause' });
    expect(audio.suspended).toBe(true);
    frames(view, 5);
    expect(app.session?.battle.state.tick).toBe(tick);
    expect(app.session?.hud.state.paused).toBe(true);
    expect(view.renders[view.renders.length - 1].dt).toBe(0);
    // Battle input is ignored while paused.
    app.dispatch({ type: 'order', order: 'fallBack' });
    app.dispatch({ type: 'resume' });
    expect(audio.suspended).toBe(false);
    frames(view, 3);
    expect(app.session?.battle.state.tick).toBeGreaterThan(tick ?? 0);
    expect(app.session?.battle.state.sides[0].order).not.toBe('fallBack');
  });

  it('auto-pauses once and never resumes by itself', () => {
    const { app, view } = makeApp();
    app.startMission(1, 'normal');
    frames(view, 2);
    app.autoPause();
    expect(app.loop.paused).toBe(true);
    const tick = app.session?.battle.state.tick;
    frames(view, 20);
    app.autoPause();
    expect(app.loop.paused).toBe(true);
    expect(app.session?.battle.state.tick).toBe(tick);
  });

  it('does not auto-pause outside a battle', () => {
    const { app } = makeApp();
    app.autoPause();
    expect(app.loop.paused).toBe(false);
  });

  it('restarts the mission with a fresh battle on the same difficulty', () => {
    const { app, view } = makeApp();
    app.startMission(1, 'hard');
    frames(view, 10);
    app.dispatch({ type: 'pause' });
    const first = app.session;
    app.dispatch({ type: 'restart' });
    expect(app.session).not.toBe(first);
    expect(app.session?.battle.state.tick).toBe(0);
    expect(app.session?.difficulty).toBe('hard');
    expect(app.loop.paused).toBe(false);
  });

  it('quits to the campaign map without recording anything', () => {
    const { app, view, ui, storage } = makeApp();
    app.startMission(1, 'normal');
    app.dispatch({ type: 'pause' });
    app.dispatch({ type: 'quit' });
    expect(app.session).toBeNull();
    expect(view.attached).toBeNull();
    expect(ui.current()).toBe('campaign');
    expect(app.loop.paused).toBe(false);
    expect(loadSave(storage).data.cleared).toEqual({});
  });

  it('leaving the battle screens ends the battle', () => {
    const { app } = makeApp();
    app.startMission(1, 'normal');
    app.onScreen('result');
    expect(app.session).not.toBeNull();
    app.onScreen('briefing');
    expect(app.session).toBeNull();
  });

  it('shows the victory result after a short delay, records the clear and unlocks the next mission', () => {
    const { app, view, ui, storage, audio } = makeApp();
    app.startMission(1, 'normal');
    app.dispatch({ type: 'order', order: 'advance' });
    app.loop.timeScale = APP.soundMaxTimeScale;
    for (let i = 0; i < 3000 && ui.current() !== 'result'; i++) view.frame?.(100);
    expect(ui.current()).toBe('result');
    const result = ui.results[0];
    expect(result.won).toBe(true);
    expect(result.missionId).toBe(1);
    expect(result.pointsAwarded).toBe(2);
    expect(result.nextMissionId).toBe(2);
    expect(result.reason).toBe(APP.reasons.hqDestroyed.win);
    expect(result.enemiesKilled).toBeGreaterThanOrEqual(0);

    const saved = loadSave(storage).data;
    expect(saved.cleared['1']).toEqual(['normal']);
    const view2 = app.campaign();
    expect(view2.missions.map((m) => m.unlocked)).toEqual([true, true]);
    expect(view2.pointsEarned).toBe(2);
    expect(audio.played).toContain('victorySting');
  });

  it('awards the points only on the first clear', () => {
    const { app, view, ui } = makeApp();
    for (let round = 0; round < 2; round++) {
      app.startMission(1, 'normal');
      app.dispatch({ type: 'order', order: 'advance' });
      app.loop.timeScale = 60;
      for (let i = 0; i < 400 && ui.results.length <= round; i++) view.frame?.(100);
    }
    expect(ui.results.map((r) => r.pointsAwarded)).toEqual([2, 0]);
    expect(app.campaign().pointsEarned).toBe(2);
  });

  it('shows the defeat result and records nothing when the HQ falls', () => {
    const { app, view, ui, storage, audio } = makeApp();
    app.startMission(2, 'normal');
    app.loop.timeScale = APP.soundMaxTimeScale;
    for (let i = 0; i < 3000 && ui.current() !== 'result'; i++) view.frame?.(100);
    expect(ui.current()).toBe('result');
    expect(ui.results[0].won).toBe(false);
    expect(ui.results[0].pointsAwarded).toBe(0);
    expect(ui.results[0].reason).toBe(APP.reasons.hqDestroyed.lose);
    expect(loadSave(storage).data.cleared).toEqual({});
    expect(audio.played).toContain('defeatSting');
  });

  it('never shows the result while paused', () => {
    const { app, view, ui } = makeApp();
    app.startMission(1, 'normal');
    app.dispatch({ type: 'order', order: 'advance' });
    app.loop.timeScale = APP.soundMaxTimeScale;
    for (let i = 0; i < 3000 && !app.session?.ended; i++) view.frame?.(33);
    expect(app.session?.ended).toBe(true);
    app.dispatch({ type: 'pause' });
    frames(view, 60, 250);
    expect(ui.current()).toBe('battle');
    app.dispatch({ type: 'resume' });
    frames(view, 60, 250);
    expect(ui.current()).toBe('result');
  });

  it('shows the unit, mute and upgrade settings through the AppApi and saves them', () => {
    const upgrades: UpgradeDef[] = [
      { id: 'hqIncome', name: 'Supply lines', description: 'More supplies.', unit: null, levels: [[{ stat: 'hqIncome', mul: 1.1 }], [{ stat: 'hqIncome', mul: 1.2 }]], costPerLevel: 1 },
    ];
    const { app, audio, storage } = makeApp([quickMission(1, true)], upgrades);
    app.setSetting('muted', true);
    expect(audio.muted).toBe(true);
    app.setSetting('difficulty', 'insane');
    app.setSetting('hints', false);
    expect(loadSave(storage).data.settings).toEqual({ muted: true, difficulty: 'insane', hints: false });
    expect(app.campaign().settings).toEqual({ muted: true, difficulty: 'insane', hints: false });

    expect(app.campaign().upgrades[0].canBuy).toBe(false);
    recordClear(app.save, 1, 'normal');
    expect(app.campaign().pointsAvailable).toBe(2);
    app.buyUpgrade('hqIncome');
    expect(app.campaign().upgrades[0].level).toBe(1);
    expect(app.campaign().pointsAvailable).toBe(1);
    expect(loadSave(storage).data.upgrades).toEqual({ hqIncome: 1 });
    app.refundAll();
    expect(app.campaign().pointsAvailable).toBe(2);

    app.resetSave();
    expect(loadSave(storage).status).toBe('fresh');
    expect(app.campaign().settings.muted).toBe(false);
    expect(audio.muted).toBe(false);
  });

  it('toggles and persists mute from the HUD', () => {
    const { app, audio, storage } = makeApp();
    app.startMission(1, 'normal');
    app.dispatch({ type: 'toggleMute' });
    expect(audio.muted).toBe(true);
    expect(loadSave(storage).data.settings.muted).toBe(true);
  });

  it('starts muted when the save says so', () => {
    const storage = createMemoryStorage();
    const save = defaultSave();
    save.settings.muted = true;
    writeSave(storage, save);
    const audio = createFakeAudio();
    new App({ view: createFakeView(), audio, storage, missions: [quickMission(1, true)] });
    expect(audio.muted).toBe(true);
  });

  it('keeps going with corrupt save data', () => {
    const storage = createMemoryStorage({ 'tinhats.save': '{{{' });
    const app = new App({ view: createFakeView(), audio: createFakeAudio(), storage, missions: [quickMission(1, true)] });
    expect(app.campaign().missions[0].unlocked).toBe(true);
    expect(app.campaign().pointsEarned).toBe(0);
  });

  it('lists only the missions that exist, in campaign order', () => {
    const { app } = makeApp();
    expect(app.campaign().missions.map((m) => m.id)).toEqual([1, 2]);
    expect(app.campaign().missions.map((m) => m.unlocked)).toEqual([true, false]);
  });
});

describe('campaign view', () => {
  it('describes mission cards and the new unit', () => {
    const save = defaultSave();
    const view = buildCampaignView(save, [M01], []);
    const card = view.missions[0];
    expect(card.title).toBe(M01.title);
    expect(card.newUnit?.kind).toBe('rifle');
    expect(card.newUnit?.name).toBe('Rifleman');
    expect(card.newSupport).toBeNull();
    expect(card.cleared).toEqual({ normal: false, hard: false, insane: false });
    expect(view.difficulties.map((d) => d.id)).toEqual(['normal', 'hard', 'insane']);
    expect(view.upgrades).toEqual([]);
  });

  it('reads effects as percentages', () => {
    expect(describeEffect({ stat: 'unitHealth', unit: 'rifle', mul: 1.1 })).toBe('+10% health');
    expect(describeEffect({ stat: 'hqGunRate', mul: 0.85 })).toBe('-15% fire rate');
    expect(describeEffect({ stat: 'hqIncome', mul: 1 })).toBe('');
    expect(describeLevel([{ stat: 'unitHealth', unit: 'rifle', mul: 1.1 }, { stat: 'unitDamage', unit: 'rifle', mul: 1.05 }])).toBe('+10% health, +5% damage');
    expect(describeLevel([])).toBe(APP.effectNone);
  });
});
