/**
 * The "Show FPS" readout: the meter's numbers over the last second, and the app handing them to the HUD only while the
 * setting is on.
 */
import { describe, expect, it } from 'vitest';
import { App } from '../../src/app/app';
import { FpsMeter } from '../../src/app/fpsMeter';
import { APP } from '../../src/data/app';
import { createMemoryStorage, loadSave } from '../../src/meta';
import type { FpsState, HudState } from '../../src/ui/contracts';
import { formatFps } from '../../src/ui/hud/format';
import { createFakeAudio, createFakeUi, createFakeView, quickMission } from './app-helpers';

describe('fps meter', () => {
  it('reports fps, the average and the worst frame of the last second, a few times a second', () => {
    const m = new FpsMeter();
    const seq0 = m.state.seq;
    // Less than one update interval: nothing published yet.
    for (let i = 0; i < 5; i++) m.frame(20);
    expect(m.state.seq).toBe(seq0);
    for (let i = 0; i < 60; i++) m.frame(20);
    expect(m.state.seq).toBeGreaterThan(seq0);
    expect(m.state.fps).toBeCloseTo(50, 5);
    expect(m.state.avgMs).toBeCloseTo(20, 5);
    expect(m.state.worstMs).toBe(20);
    // One hitch shows as the worst frame for about a second, then drops out of the window.
    m.frame(90);
    for (let i = 0; i < 20; i++) m.frame(16);
    expect(m.state.worstMs).toBe(90);
    for (let i = 0; i < 120; i++) m.frame(16);
    expect(m.state.worstMs).toBe(16);
    expect(m.state.fps).toBeCloseTo(62.5, 5);
  });

  it('updates about every APP.fps.updateMs and ignores nonsense frame times', () => {
    const m = new FpsMeter();
    const seq0 = m.state.seq;
    for (let i = 0; i < 60; i++) m.frame(1000 / 60);
    const updates = m.state.seq - seq0;
    expect(updates).toBeGreaterThanOrEqual(Math.floor(1000 / APP.fps.updateMs) - 1);
    expect(updates).toBeLessThanOrEqual(Math.ceil(1000 / APP.fps.updateMs));
    const before = { ...m.state };
    m.frame(Number.NaN);
    m.frame(-5);
    m.frame(0);
    m.frame(Number.POSITIVE_INFINITY);
    expect(m.state).toEqual(before);
  });

  it('starts over on reset, and the ring keeps far more than a second at a high refresh rate', () => {
    const m = new FpsMeter();
    for (let i = 0; i < 100; i++) m.frame(500);
    m.reset();
    expect(m.state.fps).toBe(0);
    for (let i = 0; i < 300; i++) m.frame(1000 / 240);
    expect(m.state.fps).toBeCloseTo(240, 3);
    expect(APP.fps.ring * (1000 / 240)).toBeGreaterThanOrEqual(APP.fps.windowMs);
  });

  it('formats a compact readout', () => {
    expect(formatFps(59.6, 16.78, 41.84)).toBe('60 fps · 16.8 ms avg · 41.8 max');
    expect(formatFps(Number.NaN, Number.NaN, Number.NaN)).toBe('0 fps · 0.0 ms avg · 0.0 max');
  });
});

describe('the "Show FPS" setting in a battle', () => {
  it('hands the meter to the HUD only while the setting is on, and saves it', () => {
    const view = createFakeView();
    const storage = createMemoryStorage();
    const app = new App({ view, audio: createFakeAudio(), storage, missions: [quickMission(1, true)], upgradeDefs: [] });
    const ui = createFakeUi();
    let last: FpsState | null | undefined;
    ui.updateHud = (state: HudState) => {
      last = state.fps;
    };
    app.attachUi(ui);
    expect(app.campaign().settings.showFps).toBe(false);
    app.startMission(1, 'normal');
    expect(ui.current()).toBe('battle');
    const frame = view.frame;
    expect(frame).toBeTruthy();
    if (!frame) return;
    for (let i = 0; i < 40; i++) frame(1000 / 60);
    expect(last).toBeNull();

    app.setSetting('showFps', true);
    expect(loadSave(storage).data.settings.showFps).toBe(true);
    for (let i = 0; i < 40; i++) frame(1000 / 60);
    expect(last).not.toBeNull();
    expect(last?.fps).toBeCloseTo(60, 3);
    expect(last?.avgMs).toBeCloseTo(1000 / 60, 3);

    app.setSetting('showFps', false);
    frame(1000 / 60);
    expect(last).toBeNull();
  });
});
