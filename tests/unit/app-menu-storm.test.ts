import { describe, expect, it } from 'vitest';
import { App } from '../../src/app/app';
import { MENU_STORM } from '../../src/data/menuStorm';
import { createMemoryStorage, loadSave } from '../../src/meta';
import { createFakeAudio, createFakeUi, createFakeView, quickMission } from './app-helpers';

function makeApp() {
  const view = createFakeView();
  const audio = createFakeAudio();
  const ui = createFakeUi();
  const storage = createMemoryStorage();
  const app = new App({ view, audio, storage, missions: [quickMission(1, true)], upgradeDefs: [], random: () => 0.25 });
  app.attachUi(ui);
  return { app, view, audio, ui, storage };
}

/** Real frames through the view's frame handler, like Phaser would call it. */
function play(view: ReturnType<typeof createFakeView>, seconds: number, dtMs = 1000 / 60): void {
  const n = Math.round((seconds * 1000) / dtMs);
  for (let i = 0; i < n; i++) view.frame?.(dtMs);
}

describe('the title storm in the app', () => {
  it('runs on the title: the scene, the rain bed, a flash every interval and a thunder after each', () => {
    const { app, view, audio, ui } = makeApp();
    app.onScreen('title');
    expect(app.storm.running).toBe(true);
    expect(view.menuScene).toBe(true);
    expect(audio.bedOn).toBe(true);
    play(view, MENU_STORM.thunderInterval * 4 + 1.5);
    expect(app.storm.logic.flashes).toBe(4);
    expect(audio.thunders.length).toBe(4);
    for (const [loud, length] of audio.thunders) {
      expect(loud).toBeGreaterThanOrEqual(MENU_STORM.thunder.loudness[0]);
      expect(length).toBeGreaterThanOrEqual(MENU_STORM.thunder.length[0]);
    }
    expect(view.menuFrames.length).toBeGreaterThan(100);
    expect(view.menuFrames[view.menuFrames.length - 1].fade).toBe(1);
    // The drops on the panel go to the UI every frame.
    expect(ui.dropFrames).toBe(view.menuFrames.length);
    expect(ui.dropVersion).toBeGreaterThan(0);
  });

  it('keeps going behind Settings opened from the title, and stops with a fade anywhere else', () => {
    const { app, view, audio } = makeApp();
    app.onScreen('title');
    play(view, 1);
    app.onScreen('settings');
    expect(app.storm.running).toBe(true);
    const flashes = app.storm.logic.flashes;
    play(view, MENU_STORM.thunderInterval);
    expect(app.storm.logic.flashes).toBe(flashes + 1);
    app.onScreen('title');
    app.onScreen('campaign');
    expect(app.storm.running).toBe(false);
    expect(audio.bedOn).toBe(false);
    // Rain and light fade out, then the scene comes down; storm time stands still meanwhile.
    const time = app.storm.logic.time;
    view.menuFrames.length = 0;
    play(view, MENU_STORM.fadeOut + 0.2);
    expect(view.menuScene).toBe(false);
    expect(view.menuFrames.length).toBeGreaterThan(0);
    for (let i = 1; i < view.menuFrames.length; i++) expect(view.menuFrames[i].fade).toBeLessThan(view.menuFrames[i - 1].fade);
    expect(app.storm.logic.time).toBe(time);
    // Back on the title it starts again.
    app.onScreen('title');
    expect(app.storm.running).toBe(true);
    expect(view.menuScene).toBe(true);
    expect(audio.bedOn).toBe(true);
  });

  it('plays the menu theme with the storm: on the title and behind Settings from it, off anywhere else', () => {
    const { app, audio } = makeApp();
    expect(audio.music).toBe(null);
    app.onScreen('title');
    expect(audio.music).toBe('menu');
    app.onScreen('settings');
    expect(audio.music).toBe('menu');
    app.onScreen('title');
    app.onScreen('campaign');
    expect(audio.music).toBe(null);
    app.onScreen('title');
    expect(audio.music).toBe('menu');
    app.startMission(1, 'normal');
    app.onScreen('battle');
    expect(audio.music).toBe(null);
  });

  it('does not run behind Settings opened from somewhere else, nor in a battle', () => {
    const { app, view, audio } = makeApp();
    app.onScreen('campaign');
    app.onScreen('settings');
    expect(app.storm.running).toBe(false);
    expect(view.menuScene).toBe(false);
    app.onScreen('title');
    app.startMission(1, 'normal');
    app.onScreen('battle');
    expect(app.storm.running).toBe(false);
    expect(audio.bedOn).toBe(false);
  });

  it('freezes while the page is hidden or blurred and carries on when it is back', () => {
    const { app, view, audio } = makeApp();
    app.onScreen('title');
    play(view, 1);
    app.pageHidden();
    expect(audio.suspended).toBe(true);
    const time = app.storm.logic.time;
    play(view, 12);
    expect(app.storm.logic.time).toBe(time);
    expect(view.menuFrames[view.menuFrames.length - 1].dt).toBe(0);
    app.pageShown();
    expect(audio.suspended).toBe(false);
    play(view, 1);
    expect(app.storm.logic.time).toBeGreaterThan(time);
    // A blurred window: the storm and its sound freeze too, and come back with the focus.
    app.pageBlurred();
    expect(audio.suspended).toBe(true);
    const t2 = app.storm.logic.time;
    play(view, 3);
    expect(app.storm.logic.time).toBe(t2);
    app.pageFocused();
    expect(audio.suspended).toBe(false);
    play(view, 1);
    expect(app.storm.logic.time).toBeGreaterThan(t2);
  });

  it('leaves the menu sound alone when the window blurs on another menu', () => {
    const { app, audio } = makeApp();
    app.onScreen('campaign');
    app.pageBlurred();
    expect(audio.suspended).toBe(false);
  });

  it('applies the three volumes, clamped and saved, and reduce flashing to the view and the storm', () => {
    const { app, view, audio, storage } = makeApp();
    expect(audio.volumes).toEqual({ music: 1, ambience: 1, sfx: 1 });
    app.setSetting('musicVolume', 40);
    app.setSetting('ambienceVolume', 250);
    app.setSetting('sfxVolume', -5);
    expect(audio.volumes.music).toBeCloseTo(0.4, 9);
    expect(audio.volumes.ambience).toBe(1);
    expect(audio.volumes.sfx).toBe(0);
    app.setSetting('sfxVolume', 33.4);
    expect(audio.volumes.sfx).toBeCloseTo(0.33, 9);
    const saved = loadSave(storage).data.settings;
    expect([saved.musicVolume, saved.ambienceVolume, saved.sfxVolume]).toEqual([40, 100, 33]);
    expect(app.campaign().settings.ambienceVolume).toBe(100);
    app.setSetting('reduceFlash', true);
    expect(view.reducedFlashing).toBe(true);
    expect(app.storm.logic.reduced).toBe(true);
    expect(loadSave(storage).data.settings.reduceFlash).toBe(true);
    // A reset puts everything back.
    app.resetSave();
    expect(audio.volumes).toEqual({ music: 1, ambience: 1, sfx: 1 });
    expect(view.reducedFlashing).toBe(false);
    expect(app.storm.logic.reduced).toBe(false);
  });

  it('starts with the saved volumes and reduce flashing', () => {
    const storage = createMemoryStorage({
      'tinhats.save': JSON.stringify({ version: 3, settings: { musicVolume: 10, ambienceVolume: 20, sfxVolume: 30, reduceFlash: true } }),
    });
    const view = createFakeView();
    const audio = createFakeAudio();
    const app = new App({ view, audio, storage, missions: [quickMission(1, true)], upgradeDefs: [] });
    expect(audio.volumes.music).toBeCloseTo(0.1, 9);
    expect(audio.volumes.ambience).toBeCloseTo(0.2, 9);
    expect(audio.volumes.sfx).toBeCloseTo(0.3, 9);
    expect(view.reducedFlashing).toBe(true);
    expect(app.storm.logic.reduced).toBe(true);
  });

  it('can be frozen and stepped by hand for a picture exactly mid-flash', () => {
    const { app, view } = makeApp();
    app.onScreen('title');
    play(view, 0.5);
    app.storm.freeze(true);
    const time = app.storm.logic.time;
    play(view, 3);
    expect(app.storm.logic.time).toBe(time);
    app.storm.forceFlash(true);
    app.storm.advance(0.03);
    expect(app.storm.logic.time).toBeCloseTo(time + 0.03, 9);
    expect(app.storm.logic.flash).toBeGreaterThan(0.8);
    view.frame?.(16);
    // The picture moves by the stepped time once, then holds.
    expect(view.menuFrames[view.menuFrames.length - 1].dt).toBeCloseTo(0.03, 9);
    view.frame?.(16);
    expect(view.menuFrames[view.menuFrames.length - 1].dt).toBe(0);
    const s = app.storm.stats();
    expect(s.frozen).toBe(true);
    expect(s.flash).toBeGreaterThan(0.8);
    expect(s.fork).toBeGreaterThan(0.8);
  });
});
