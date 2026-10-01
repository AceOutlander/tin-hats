/** Fakes for the view, the audio and the UI, so the app controller runs in Node. */
import type { GameAudio } from '../../src/audio';
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
}

export function createFakeAudio(): FakeAudio {
  const audio: FakeAudio = {
    played: [],
    muted: false,
    suspended: false,
    unlock() {},
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
}

export function createFakeUi(): FakeUi {
  let current: ScreenId = 'title';
  const ui: FakeUi = {
    screens: [],
    results: [],
    huds: 0,
    show(screen, payload) {
      current = screen;
      ui.screens.push(screen);
      if (payload && payload.result) ui.results.push(payload.result);
    },
    current: () => current,
    updateHud(_state: HudState) {
      ui.huds++;
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
