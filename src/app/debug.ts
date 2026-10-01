/**
 * Debug and test hooks. Installed only when the URL has ?debug=1; without it
 * nothing is exposed on window. The browser smoke tests drive the game
 * through window.__TH (start a mission, read a state summary, fast-forward).
 */
import type { GameAudio } from '../audio';
import { APP } from '../data/app';
import type { Difficulty, Order, UnitKind } from '../data/schema';
import { UNIT_KINDS } from '../data/units';
import type { BattleView, WeatherMode, WeatherStats } from '../render/contracts';
import type { EndReason } from '../sim';
import type { UiHandle } from '../ui';
import type { App } from './app';

export interface ScreenPoint {
  x: number;
  y: number;
}

export type UnitCounts = Record<UnitKind, number>;

export interface DebugState {
  screen: string;
  inBattle: boolean;
  missionId: number;
  difficulty: Difficulty;
  seed: number;
  tick: number;
  time: number;
  over: boolean;
  /** 0 or 1, or -1 while running and for a draw. */
  winner: number;
  endReason: EndReason;
  /** Player supplies, rounded down. */
  supplies: number;
  pop: number;
  popCap: number;
  order: Order;
  /** Player queue per kind. */
  queue: UnitCounts;
  /** Living units per kind for side 0 and side 1. */
  units: [UnitCounts, UnitCounts];
  /** HQ health and maximum per side; null for a side with no HQ. */
  hq: [{ hp: number; max: number } | null, { hp: number; max: number } | null];
  paused: boolean;
  timeScale: number;
  /** Seconds left on the mission timer, or null. */
  timer: number | null;
  /** True once the result is known (the result screen follows shortly). */
  resultReady: boolean;
}

/** Where the two armies are, for tests and screenshots that wait for a moment on the battlefield. */
export interface FieldInfo {
  playerHqX: number;
  enemyHqX: number;
  /** World x of the player's / the enemy's foremost fighting unit (sappers and garrisoned units excluded), or null. */
  playerFrontX: number | null;
  enemyFrontX: number | null;
  /** Distance between the two foremost fighters, or null if either side has none. */
  gap: number | null;
  /** Player sappers that are carrying supplies right now. */
  sappersCarrying: number;
}

export interface DebugApi {
  ready: boolean;
  /** Sound engine state: 'running' once a first gesture has unlocked it, and how many sounds have played. */
  audio(): { state: string; played: number; dropped: number };
  /** Centre the camera on world x. */
  lookAt(x: number): void;
  field(): FieldInfo | null;
  startMission(id: number, difficulty?: Difficulty, seed?: number): boolean;
  state(): DebugState;
  setTimeScale(n: number): void;
  getTimeScale(): number;
  grantSupplies(n: number): void;
  forceWeather(w: WeatherMode): void;
  forceThunder(): void;
  weatherStats(): WeatherStats;
  buttonRects(): unknown;
  camera(): { centerX: number; left: number; viewWidthWu: number; length: number };
  unitScreenPos(id: number): ScreenPoint | null;
  firstUnitScreenPos(side: 0 | 1, kind: UnitKind): (ScreenPoint & { id: number }) | null;
  perf(): { fps: number; stepMsAvg: number; renderMsAvg: number };
}

function zeroCounts(): UnitCounts {
  const out = {} as UnitCounts;
  for (const kind of UNIT_KINDS) out[kind] = 0;
  return out;
}

function copyCounts(from: UnitCounts): UnitCounts {
  const out = zeroCounts();
  for (const kind of UNIT_KINDS) out[kind] = from[kind];
  return out;
}

export function debugEnabled(search: string): boolean {
  return new URLSearchParams(search).get('debug') === '1';
}

/** Create the hooks and put them on window.__TH. */
export function installDebug(app: App, view: BattleView, ui: UiHandle, audio: GameAudio): DebugApi {
  const api: DebugApi = {
    ready: false,

    audio() {
      const stats = audio.getStats();
      return { state: stats.state, played: stats.played, dropped: stats.dropped };
    },

    lookAt: (x) => view.camera.setCenter(x, true),

    field() {
      const session = app.session;
      if (!session) return null;
      const s = session.battle.state;
      const mine = s.sides[0].hq;
      const theirs = s.sides[1].hq;
      if (!mine || !theirs) return null;
      const dir = theirs.x >= mine.x ? 1 : -1;
      let playerFront: number | null = null;
      let enemyFront: number | null = null;
      let carrying = 0;
      for (let i = 0; i < s.unitCount; i++) {
        const u = s.units[i];
        if (!u.alive || u.inside) continue;
        if (u.side === 0 && u.carrying > 0) carrying++;
        if (u.kind === 'sapper') continue;
        if (u.side === 0) {
          if (playerFront === null || u.x * dir > playerFront * dir) playerFront = u.x;
        } else if (enemyFront === null || u.x * dir < enemyFront * dir) {
          enemyFront = u.x;
        }
      }
      return {
        playerHqX: mine.x,
        enemyHqX: theirs.x,
        playerFrontX: playerFront,
        enemyFrontX: enemyFront,
        gap: playerFront !== null && enemyFront !== null ? Math.abs(enemyFront - playerFront) : null,
        sappersCarrying: carrying,
      };
    },

    startMission(id, difficulty, seed) {
      return app.beginMission(id, difficulty ?? app.save.settings.difficulty, seed);
    },

    state() {
      const session = app.session;
      const base = {
        screen: ui.current(),
        paused: app.loop.paused,
        timeScale: app.loop.timeScale,
      };
      if (!session) {
        return {
          ...base,
          inBattle: false,
          missionId: 0,
          difficulty: app.save.settings.difficulty,
          seed: 0,
          tick: 0,
          time: 0,
          over: false,
          winner: -1,
          endReason: 'none',
          supplies: 0,
          pop: 0,
          popCap: 0,
          order: 'hold',
          queue: zeroCounts(),
          units: [zeroCounts(), zeroCounts()],
          hq: [null, null],
          timer: null,
          resultReady: app.lastResult !== null,
        };
      }
      const s = session.battle.state;
      const me = s.sides[0];
      const hq = (side: 0 | 1): { hp: number; max: number } | null => {
        const h = s.sides[side].hq;
        return h ? { hp: h.hp, max: h.maxHp } : null;
      };
      return {
        ...base,
        inBattle: true,
        missionId: session.mission.id,
        difficulty: session.difficulty,
        seed: session.seed,
        tick: s.tick,
        time: s.time,
        over: s.over,
        winner: s.winner,
        endReason: s.endReason,
        supplies: Math.floor(me.supplies),
        pop: me.pop,
        popCap: me.popCap,
        order: me.order,
        queue: copyCounts(me.queue),
        units: [copyCounts(s.sides[0].alive), copyCounts(s.sides[1].alive)],
        hq: [hq(0), hq(1)],
        timer: s.timer ? s.timer.secondsLeft : null,
        resultReady: app.lastResult !== null,
      };
    },

    setTimeScale(n) {
      app.loop.timeScale = Number.isFinite(n) ? Math.min(Math.max(n, 0), APP.maxTimeScale) : 1;
    },
    getTimeScale: () => app.loop.timeScale,

    grantSupplies(n) {
      const session = app.session;
      if (session) session.battle.state.sides[0].supplies += n;
    },

    forceWeather(w) {
      app.weatherMode = w;
      if (w !== 'auto') view.forceWeather(w);
    },
    forceThunder: () => view.forceThunder(),
    weatherStats: () => view.weatherStats(),

    buttonRects: () => ui.getHudButtonRects(),

    camera() {
      const c = view.camera;
      return { centerX: c.centerX, left: c.centerX - c.viewWidthWu / 2, viewWidthWu: c.viewWidthWu, length: app.session ? app.session.battle.state.length : 0 };
    },

    unitScreenPos(id) {
      const p = view.unitScreenPos(id);
      return p ? { x: p.x, y: p.y } : null;
    },

    firstUnitScreenPos(side, kind) {
      const session = app.session;
      if (!session) return null;
      const s = session.battle.state;
      for (let i = 0; i < s.unitCount; i++) {
        const u = s.units[i];
        if (!u.alive || u.inside || u.side !== side || u.kind !== kind) continue;
        const p = view.unitScreenPos(u.id);
        if (p) return { id: u.id, x: p.x, y: p.y };
      }
      return null;
    },

    perf() {
      return { fps: view.getStats().fps, stepMsAvg: app.loop.stepMsAvg, renderMsAvg: app.loop.renderMsAvg };
    },
  };

  Reflect.set(window, '__TH', api);
  return api;
}


