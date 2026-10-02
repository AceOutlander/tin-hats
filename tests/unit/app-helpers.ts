/** Fakes for the view, the audio and the UI, so the app controller runs in Node. */
import type { AudioBus, GameAudio, MixStats } from '../../src/audio';
import type { MissionDef } from '../../src/data/schema';
import { M01 } from '../../src/data/missions/m01';
import type { AttachOptions, BattleCamera, BattleView, RenderStats } from '../../src/render/contracts';
import type { Battle } from '../../src/sim';
import type { HudState, ResultView, ScreenId, UiApi } from '../../src/ui/contracts';

export interface FakeCamera extends BattleCamera {
  centerX: number;
  viewWidthWu: number;
  jumps: number[];
  /** Every x the app asked the view to glide to. */
  centers: number[];
  /** Like the real camera rig: true while a finger drags the view. */
  dragging: boolean;
}

export interface FakeView extends BattleView {
  camera: FakeCamera;
  attached: Battle | null;
  attachOptions: AttachOptions | null;
  afterSteps: number;
  renders: { alpha: number; dt: number }[];
  effects: boolean[];
  darkness: number[];
  controlled: number[];
  targeting: (string | null)[];
  frame: ((dtMs: number) => void) | null;
  /** The title storm scene: whether it is up, and the storm dt and fade of every menu frame drawn. */
  menuScene: boolean;
  menuFrames: { dt: number; fade: number; flash: number }[];
  reducedFlashing: boolean;
}

export function createFakeView(): FakeView {
  const camera: FakeCamera = {
    centerX: 500,
    viewWidthWu: 1000,
    jumps: [],
    centers: [],
    dragging: false,
    setCenter(x) {
      camera.centers.push(x);
      camera.centerX = x;
    },
    jumpToFrac(f) {
      camera.jumps.push(f);
    },
  };
  const stats: RenderStats = {
    fps: 60,
    renderMs: 0,
    afterStepMs: 0,
    unitViews: 0,
    unitViewsDrawn: 0,
    images: 0,
    imagesVisible: 0,
    tracers: 0,
    particles: 0,
    particlesLive: 0,
    quality: 0,
    atlasPages: 0,
    atlasPixels: 0,
    backdropPixels: 0,
    canvasW: 0,
    canvasH: 0,
    dpr: 1,
  };
  const view: FakeView = {
    camera,
    attached: null,
    attachOptions: null,
    afterSteps: 0,
    renders: [],
    effects: [],
    darkness: [],
    controlled: [],
    targeting: [],
    frame: null,
    menuScene: false,
    menuFrames: [],
    reducedFlashing: false,
    onTapUnit: null,
    onTapGround: null,
    attach(battle, opts) {
      view.attached = battle;
      view.attachOptions = opts;
    },
    detach() {
      view.attached = null;
    },
    setFrameHandler(fn) {
      view.frame = fn;
    },
    afterStep() {
      view.afterSteps++;
    },
    render(alpha, dt) {
      view.renders.push({ alpha, dt });
    },
    setControlled(id) {
      view.controlled.push(id);
    },
    setTargeting(kind) {
      view.targeting.push(kind);
    },
    setEffectsEnabled(enabled) {
      view.effects.push(enabled);
    },
    setAudio() {},
    setDarkness(d) {
      view.darkness.push(d);
    },
    forceWeather() {},
    forceThunder() {},
    weatherStats: () => ({ raining: false, checksMade: 0, strikes: 0 }),
    setReducedFlashing(on) {
      view.reducedFlashing = on;
    },
    setMenuScene(on) {
      view.menuScene = on;
    },
    renderMenu(storm, dt, fade) {
      view.menuFrames.push({ dt, fade, flash: storm.flash });
    },
    menuStats: () => ({ shown: view.menuScene, drops: [0, 0, 0], splashes: 0, rainShare: 1, spireX: 0, spireY: 0, forkDrawn: false, skyFlash: 0 }),
    unitScreenPos: () => null,
    getStats: () => stats,
    resize() {},
    destroy() {},
  };
  return view;
}

export interface FakeAudio extends GameAudio {
  played: string[];
  muted: boolean;
  suspended: boolean;
  /** Slider positions 0..1 per bus, as the app set them. */
  volumes: Record<AudioBus, number>;
  bedOn: boolean;
  /** Every thunder asked for: [loudness, length]. */
  thunders: [number, number][];
  /** The music asked for (null = none), and the tracks asked to be rendered. */
  music: string | null;
  prepared: string[];
}

export function createFakeAudio(): FakeAudio {
  const mix: MixStats = { music: 0, ambience: 0, sfx: 0, bedOn: false, bed: 0, rain: 0, thunders: 0, output: 0 };
  const audio: FakeAudio = {
    played: [],
    muted: false,
    suspended: false,
    volumes: { music: 1, ambience: 1, sfx: 1 },
    bedOn: false,
    thunders: [],
    unlock() {},
    setVolume(bus, level) {
      audio.volumes[bus] = level;
    },
    startRainBed() {
      audio.bedOn = true;
    },
    stopRainBed() {
      audio.bedOn = false;
    },
    tickRainBed() {},
    thunder(loudness, length) {
      audio.thunders.push([loudness, length]);
      return !audio.muted && !audio.suspended;
    },
    mixStats() {
      mix.bedOn = audio.bedOn;
      mix.thunders = audio.thunders.length;
      return mix;
    },
    music: null,
    prepared: [],
    prepareMusic(name) {
      audio.prepared.push(name);
    },
    startMusic(name) {
      audio.music = name;
    },
    stopMusic() {
      audio.music = null;
    },
    musicStats: () => ({
      wanted: audio.music,
      render: 'idle',
      playing: false,
      fade: 0,
      level: 0,
      seconds: 0,
      sampleRate: 0,
      channels: 0,
      bytes: 0,
      renderMs: 0,
      buildMs: 0,
    }),
    musicTrack: () => null,
    play(name) {
      audio.played.push(name);
    },
    playAt(name) {
      audio.played.push(name);
    },
    setListener() {},
    startLoop() {},
    stopLoop() {},
    setMuted(m) {
      audio.muted = m;
    },
    isMuted: () => audio.muted,
    suspend() {
      audio.suspended = true;
    },
    resume() {
      audio.suspended = false;
    },
    whenReady: () => Promise.resolve(),
    getStats: () => ({ voices: 0, played: 0, dropped: 0, stolen: 0, rendered: 0, state: 'running' }),
  };
  return audio;
}

export interface FakeUi extends UiApi {
  screens: ScreenId[];
  results: ResultView[];
  huds: number;
  /** Frames of panel drops handed over, and the last drops version seen. */
  dropFrames: number;
  dropVersion: number;
}

export function createFakeUi(): FakeUi {
  let current: ScreenId = 'title';
  const ui: FakeUi = {
    screens: [],
    results: [],
    huds: 0,
    dropFrames: 0,
    dropVersion: -1,
    show(screen, payload) {
      current = screen;
      ui.screens.push(screen);
      if (payload && payload.result) ui.results.push(payload.result);
    },
    current: () => current,
    updateHud(_state: HudState) {
      ui.huds++;
    },
    updateTitleDrops(drops) {
      ui.dropFrames++;
      ui.dropVersion = drops.version;
    },
    refresh() {},
  };
  return ui;
}

/** Mission 1 with the numbers changed so a battle ends within a few simulated seconds. */
export function quickMission(id: number, playerWins: boolean): MissionDef {
  const m: MissionDef = structuredClone(M01);
  m.id = id;
  m.key = `quick${id}`;
  m.events = [];
  m.start[0].supplies = 500;
  if (playerWins) {
    m.start[1].hqHpMul = 0.01;
    m.start[0].forces = [{ kind: 'rifle', count: 8, x: m.length - 700 }];
  } else {
    m.start[0].hqHpMul = 0.01;
    m.start[1].forces = [{ kind: 'rifle', count: 8, x: 700 }];
    m.ai.firstAttackAfter = 0;
  }
  return m;
}
