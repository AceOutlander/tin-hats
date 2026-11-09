import { describe, expect, it, vi } from 'vitest';
import { M1001 } from '../../src/data/missions/stalingrad/m1001';
import { App, MAP_MUSIC } from '../../src/app/app';
import { BASIC_TRAINING_ID, trainingMission } from '../../src/data/missions/training';
import { MUSIC_BATTLE } from '../../src/data/musicBattle';
import { createMemoryStorage } from '../../src/meta';
import { createFakeAudio, createFakeUi, createFakeView, quickMission } from './app-helpers';

function makeApp(wins = true) {
  const view = createFakeView();
  const audio = createFakeAudio();
  const ui = createFakeUi();
  const app = new App({ view, audio, storage: createMemoryStorage(), missions: [quickMission(1, wins), quickMission(2, wins)], upgradeDefs: [], random: () => 0.25 });
  app.attachUi(ui);
  return { app, view, audio, ui };
}

function play(view: ReturnType<typeof createFakeView>, seconds: number, dtMs = 1000 / 60): void {
  const n = Math.round((seconds * 1000) / dtMs);
  for (let i = 0; i < n; i++) view.frame?.(dtMs);
}

describe('music around the campaign and the battles', () => {
  it('renders the map track the first time the map opens, plays it on the map, briefing and Quartermaster, and behind Settings from them', () => {
    const { app, audio } = makeApp();
    app.onScreen('title');
    expect(audio.prepared).not.toContain(MAP_MUSIC);
    app.onScreen('campaign');
    expect(audio.prepared).toContain(MAP_MUSIC);
    expect(audio.music).toBe(MAP_MUSIC);
    for (const screen of ['briefing', 'quartermaster', 'settings', 'campaign'] as const) {
      app.onScreen(screen);
      expect(audio.music, screen).toBe(MAP_MUSIC);
    }
    app.onScreen('title');
    expect(audio.music).toBe('menu');
    // Settings from the title keeps the menu theme, not the map.
    app.onScreen('settings');
    expect(audio.music).toBe('menu');
  });

  it('starts the mission\'s own track when the battle starts and lets go of the map track', () => {
    const { app, audio } = makeApp();
    app.onScreen('campaign');
    expect(audio.battleTrack).toBe(null);
    app.startMission(1, 'normal');
    app.onScreen('battle');
    expect(audio.battleTrack).toBe(app.missions[0].music);
    expect(audio.releasedMusic).toContain(MAP_MUSIC);
    expect(audio.music).toBe(null);
    expect(app.musicIntensity).not.toBe(null);
  });

  it('loads the mission\'s track before its battle (Basic Training too), and asks for no load once it runs', async () => {
    const { app, view, audio } = makeApp();
    app.onScreen('campaign');
    app.onScreen('briefing');
    const progress: number[] = [];
    expect(await app.loadMission(1, (f) => progress.push(f))).toBe(true);
    expect(audio.battleLoads).toEqual([app.missions[0].music]);
    expect(progress).toEqual([1]);
    // Loading starts nothing: the battle music begins with the battle.
    expect(audio.battleTrack).toBe(null);
    app.startMission(1, 'normal');
    app.onScreen('battle');
    play(view, 5);
    app.dispatch({ type: 'restart' });
    play(view, 5);
    expect(audio.battleLoads.length).toBe(1);
    expect(await app.loadMission(BASIC_TRAINING_ID)).toBe(true);
    expect(audio.battleLoads[1]).toBe(trainingMission().music);
    // An unknown mission loads nothing and holds nobody up.
    expect(await app.loadMission(777)).toBe(true);
    expect(audio.battleLoads.length).toBe(2);
  });

  it('starts without music when the load takes too long, and drops a load the player backed out of', async () => {
    vi.useFakeTimers();
    try {
      const { app, audio } = makeApp();
      audio.loadBattleMusic = (name) => {
        audio.battleLoads.push(name);
        return new Promise<boolean>(() => undefined);
      };
      app.onScreen('briefing');
      let answer: boolean | null = null;
      void app.loadMission(1).then((ok) => {
        answer = ok;
      });
      await vi.advanceTimersByTimeAsync(MUSIC_BATTLE.render.loadTimeoutMs - 100);
      expect(answer).toBe(null);
      await vi.advanceTimersByTimeAsync(200);
      expect(answer, 'the battle may start (without music)').toBe(true);
      // Back to the map while it loads: the music is let go of and the start is called off.
      let released = 0;
      audio.releaseBattleMusic = () => {
        released++;
      };
      const backedOut = app.loadMission(1);
      app.onScreen('campaign');
      expect(released).toBe(1);
      await vi.advanceTimersByTimeAsync(MUSIC_BATTLE.render.loadTimeoutMs);
      expect(await backedOut).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('lets go of the menu theme in a battle and renders it again when the title comes back', () => {
    const { app, audio } = makeApp();
    app.onScreen('title');
    expect(audio.prepared).not.toContain('menu');
    app.startMission(1, 'normal');
    app.onScreen('battle');
    // Only the mission's music is held in a battle.
    expect(audio.releasedMusic).toContain('menu');
    app.onScreen('campaign');
    expect(audio.prepared).not.toContain('menu');
    app.onScreen('title');
    expect(audio.prepared.filter((n) => n === 'menu').length).toBe(1);
    expect(audio.music).toBe('menu');
    // Once is enough: the title again without a battle in between renders nothing new.
    app.onScreen('campaign');
    app.onScreen('title');
    expect(audio.prepared.filter((n) => n === 'menu').length).toBe(1);
  });

  it('asks the music for a layer during the battle, ends it with the battle and frees it on leaving', () => {
    const { app, view, audio } = makeApp();
    app.onScreen('campaign');
    app.startMission(1, 'normal');
    app.onScreen('battle');
    play(view, 3);
    expect(audio.battleLayers[0]).toBe('build');
    // Debug: hold it on combat, as the browser test does.
    app.forceMusicLayer('combat');
    expect(audio.battleLayers[audio.battleLayers.length - 1]).toBe('combat');
    // The quick mission is won once the riflemen advance; the music fades out with the battle.
    app.dispatch({ type: 'order', order: 'advance' });
    for (let i = 0; i < 2000 && app.lastResult === null; i++) view.frame?.(250);
    expect(app.lastResult).not.toBe(null);
    expect(audio.battleEnds.length).toBeGreaterThan(0);
    expect(audio.battleEnds[audio.battleEnds.length - 1][0]).toBe(true);
    // Back to the map: the battle's buffers go, the map track renders again.
    audio.prepared.length = 0;
    app.onScreen('result');
    expect(audio.battleTrack).not.toBe(null);
    app.onScreen('campaign');
    expect(audio.battleTrack).toBe(null);
    expect(app.musicIntensity).toBe(null);
    expect(audio.prepared).toContain(MAP_MUSIC);
  });

  it('keeps the rendered music for a restart of the same mission', () => {
    const { app, audio } = makeApp();
    app.startMission(1, 'normal');
    const releases: string[] = [];
    const release = audio.releaseBattleMusic.bind(audio);
    audio.releaseBattleMusic = () => {
      releases.push('released');
      release();
    };
    app.dispatch({ type: 'restart' });
    expect(releases).toEqual([]);
    expect(audio.battleTrack).toBe(app.missions[0].music);
    app.dispatch({ type: 'quit' });
    expect(releases).toEqual(['released']);
    expect(audio.battleTrack).toBe(null);
  });

  it('plays the prep layer while the prep phase of a defensive mission runs, and leaves it on Ready', () => {
    const { app, view } = makeApp();
    app.beginUnlisted(M1001, 'normal');
    play(view, 15);
    expect(app.musicIntensity?.layer).toBe('prep');
    app.session?.dispatch({ type: 'ready' });
    play(view, 15);
    expect(app.musicIntensity?.layer).not.toBe('prep');
  });
});
