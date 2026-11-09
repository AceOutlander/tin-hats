/**
 * Debug and test hooks. Installed only when the URL has ?debug=1; without it
 * nothing is exposed on window. The browser smoke tests drive the game
 * through window.__TH (start a mission, read a state summary, fast-forward).
 */
import { createAudio, type BattleMusicStats, type GameAudio, type MusicStats } from '../audio';
import { measureBattleMix, type BattleMixReport, type MixedLayer } from '../audio/music/battleMix';
import { db, measureMix, peakOf, rmsOf, seamOf, sectionTimes, type MixReport, type SeamReport } from '../audio/music';
import { BattleMusicPlayer } from '../audio/music/battlePlayer';
import { seededRandom } from '../audio/dsp';
import { findOfflineContext, startRendering } from '../audio/render';
import { APP } from '../data/app';
import { CONFIG } from '../data/config';
import { MUSIC_TRACKS, type MusicTrackName } from '../data/music';
import { MUSIC_BATTLE, type MusicLayer } from '../data/musicBattle';
import { RENDER } from '../data/render';
import { SANDBOX, SANDBOX_MIRROR } from '../data/missions/sandbox';
import { getStalingradMission } from '../data/missions/stalingrad';
import type { Difficulty, MissionMode, Order, SupportKind, UnitKind, UpgradeLevels } from '../data/schema';
import { SUPPORT_KINDS } from '../data/supports';
import { UNIT_KINDS } from '../data/units';
import type { SaveData } from '../meta';
import type { BattleView, WeatherMode, WeatherStats } from '../render/contracts';
import type { EndReason } from '../sim';
import type { UiHandle } from '../ui';
import type { ResultView } from '../ui/contracts';
import type { AdminController } from './admin';
import type { App } from './app';
import { MENU_MUSIC, type MenuStormStats } from './menuStorm';
import type { LayerChange } from './musicIntensity';
import { newTally, type EventTally } from './session';

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
  /** The player's per-kind order overrides (null = that kind follows the army order). */
  kindOrders: Record<UnitKind, Order | null>;
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
  /** The prep phase: running or not, seconds left, and build sites still being built; null for a mission without one. */
  prep: { active: boolean; secondsLeft: number; sites: number; trenches: number; wires: number; pillboxes: number } | null;
  /** The upgrade levels this battle was built with (empty outside a battle). */
  upgrades: UpgradeLevels;
  /** How far toward night the view has been told to darken the sky (0..1; only a deadline mission darkens). */
  darkness: number;
  /** True once the result is known (the result screen follows shortly). */
  resultReady: boolean;
  /** The player's unit under direct control, or null. `inTrench` = it holds a trench slot. */
  controlled: { id: number; kind: UnitKind; x: number; hp: number; maxHp: number; action: string; inTrench: boolean } | null;
  /** Availability and seconds of cooldown left (0 = ready) of each support for the player. */
  supports: Record<SupportKind, { available: boolean; cooldown: number }>;
  /** The support the player is aiming (the targeting banner is up), or null. */
  targeting: SupportKind | null;
  /** Live smoke clouds. */
  smokes: number;
  trenches: { id: number; x: number; owner: number; occupants: number }[];
  pillboxes: { id: number; x: number; side: number; hp: number; maxHp: number; alive: boolean }[];
  /** Standing wire belts. */
  wires: number;
  /** Counts of sim events seen so far in this battle (support calls are the player's own). */
  tally: EventTally;
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

/** One living unit, for visual QA scripts that follow a unit across frames. */
export interface UnitInfo {
  id: number;
  kind: UnitKind;
  side: 0 | 1;
  action: string;
  x: number;
  row: number;
  hp: number;
  maxHp: number;
  carrying: boolean;
  inside: boolean;
  /** Seconds since the current action started. */
  actionTime: number;
  /** Id of the trench the unit occupies, or -1. */
  trench: number;
}

/** One round in flight (shell, rocket, grenade, bomb), for visual QA scripts. */
export interface ProjectileInfo {
  side: number;
  weapon: string;
  fromX: number;
  toX: number;
  x: number;
  /** Fraction of the flight done (0..1). */
  t: number;
}

/** One campaign mission as the tests need to know it. */
export interface DebugMission {
  id: number;
  key: string;
  title: string;
  mode: MissionMode;
  length: number;
  timer: { seconds: number; onExpire: 'win' | 'lose'; label: string } | null;
  newUnit: UnitKind | null;
  newSupport: SupportKind | null;
  /** Further unit types the mission unlocks (MissionDef.unlocks). */
  unlocks: UnitKind[];
  /** What the player may train and call in. */
  units: UnitKind[];
  supports: SupportKind[];
  /** True when the enemy side has an HQ (false in a survival mission). */
  enemyHq: boolean;
}

export interface DebugApi {
  ready: boolean;
  /** The campaign in order. */
  missions(): DebugMission[];
  /** Open every mission on the campaign map. Records no clear and awards nothing. */
  unlockAll(): void;
  /** Replace the upgrade levels (unknown upgrades dropped, levels capped; the points are not checked). Saved. */
  setUpgrades(levels: UpgradeLevels): void;
  /** A copy of the save as it is in memory. */
  save(): SaveData;
  /** Medals to spend. */
  medals(): number;
  /** Give medals (whole numbers; saved). Returns the new balance. */
  giveMedals(n: number): number;
  /** Take medals, never below zero (saved). Returns the new balance. */
  takeMedals(n: number): number;
  /** The result of the last finished battle, or null. */
  result(): ResultView | null;
  /** Every living unit (empty outside a battle). */
  units(): UnitInfo[];
  /** Rounds in flight. */
  projectiles(): ProjectileInfo[];
  /** Sound engine state: 'running' once a first gesture has unlocked it, and how many sounds have played. */
  audio(): { state: string; played: number; dropped: number; muted: boolean; rendered: number };
  /** Centre the camera on world x. */
  lookAt(x: number): void;
  field(): FieldInfo | null;
  /**
   * Start a campaign mission. By default the player gets the mission's own roster (as the data lists it); with
   * `armoury` true, what the Armoury owns cut to what the mission allows, plus loans, as when started from the briefing.
   */
  startMission(id: number, difficulty?: Difficulty, seed?: number, armoury?: boolean): boolean;
  /** Battles started after this are played for the player by the sim's test bot (real mid-battle scenes for captures). */
  autopilot(on: boolean): void;
  /**
   * Start the proving ground (every unit and support for both sides, trenches, pillboxes and wire), which is never
   * listed in the campaign and never saved. `mirror` = the symmetric ground used for fairness tests.
   */
  startSandbox(seed?: number, mirror?: boolean): boolean;
  /** Start a Stalingrad mission (1001 to 1010) on its own, never saved: the campaign is not on the map yet. */
  startStalingrad(id: number, difficulty?: Difficulty, seed?: number): boolean;
  /** Start Basic Training, as the title screen's button does. */
  startTraining(): boolean;
  /**
   * The guided tip on screen (null when none), and how far the battle's steps have got: `done` of `total` steps have
   * ended, `finished` once all have. Null outside a battle with guided tips.
   */
  tutorial(): { tip: { id: string; text: string; target: string } | null; done: number; total: number; finished: boolean } | null;
  state(): DebugState;
  setTimeScale(n: number): void;
  getTimeScale(): number;
  grantSupplies(n: number): void;
  /** Raise the player's population cap by n, never above CONFIG.popCap (100 everywhere, even in test battles). */
  grantPopulation(n: number): void;
  forceWeather(w: WeatherMode): void;
  forceThunder(): void;
  weatherStats(): WeatherStats;
  /** Blood pools on the ground now and drawn on screen, the cap, the soldiers killed by gunfire this battle, and the "Show blood" setting. */
  blood(): { pools: number; drawn: number; cap: number; deaths: number; shown: boolean };
  /** Health pips drawn last frame over the player's own units and over the enemy's, and whether the enemy's whole side is revealed. */
  hpPips(): { own: number; enemy: number; enemyRevealed: boolean };
  /** Reveal (true) or hide again (false) the enemy's unit health everywhere, as the admin panel will. */
  revealEnemyHp(on: boolean): void;
  buttonRects(): unknown;
  /** `cssPerWu` converts a world distance to CSS px on screen: screen x = (world x - left) * cssPerWu. */
  camera(): { centerX: number; left: number; viewWidthWu: number; length: number; cssPerWu: number };
  unitScreenPos(id: number): ScreenPoint | null;
  firstUnitScreenPos(side: 0 | 1, kind: UnitKind): (ScreenPoint & { id: number }) | null;
  perf(): { fps: number; stepMsAvg: number; renderMsAvg: number };
  /** The title screen's storm. */
  menuStorm: MenuStormHooks;
  /** The menu and campaign map music. */
  music: MusicHooks;
  /** The battle music. */
  battleMusic: BattleMusicHooks;
  /** The hidden admin panel (null when the page has none). */
  admin: AdminHooks | null;
}

/** Test hooks of the admin panel. The real code is never needed: a test compares against a hash of its own code. */
export interface AdminHooks {
  /** From now on the prompt accepts the code whose salted hash (adminLock.codeHash) this is. */
  useHash(hex: string): void;
  unlocked(): boolean;
}

/** The rendered menu theme, measured. */
export interface MusicAnalysis {
  seconds: number;
  sampleRate: number;
  channels: number;
  bytes: number;
  renderMs: number;
  buildMs: number;
  peak: number;
  rms: number;
  /** Share of 1 s windows quieter than -60 dB: the silences in the piece. */
  silentShare: number;
  seam: SeamReport;
  sections: { name: string; start: number; rmsDb: number; peakDb: number }[];
}

export interface MusicHooks {
  stats(): MusicStats;
  /** Null until the track is rendered. */
  analyse(name?: MusicTrackName): MusicAnalysis | null;
  /** The music against the rain bed and a thunder at default volumes (renders those offline); null until ready. */
  mix(): Promise<MixReport | null>;
}

/** One rendered piece of the battle music, measured. */
export interface BattlePieceAnalysis {
  section: string;
  layer: string;
  seconds: number;
  peakDb: number;
  rmsDb: number;
  /** The first sample (a piece must start from silence) and the peak of its last 5 ms (its tail must have died away). */
  startAbs: number;
  endPeakDb: number;
}

/**
 * The battle player run offline over the rendered pieces, with layer changes at set times: the largest sample step
 * within 1.5 ms of each seam (a section starting, a crossfade beginning or ending) over the largest step in the 40 ms
 * around it, and the same at the bar lines that are not seams (the music's own downbeats), for comparison.
 */
export interface BattleSeamReport {
  seconds: number;
  sections: number;
  crossfades: number;
  seams: number;
  /** Largest seam ratio and where; largest bar-line ratio away from the seams. */
  seamRatio: number;
  seamAt: number;
  barRatio: number;
  peak: number;
}

export interface BattleMusicHooks {
  stats(): BattleMusicStats;
  /** Hold the music on a layer (null hands it back to the battle), as the intensity rules would ask for it. */
  force(layer: MusicLayer | null): void;
  /** The prep phase hook. */
  setPrep(on: boolean): void;
  /** The intensity rules now: the layer asked for, the armed soldiers of each side in the fight, the latest changes. */
  intensity(): { layer: MusicLayer; fighting: [number, number]; changes: LayerChange[] } | null;
  /** Every rendered piece measured; null without battle music. */
  analyse(): BattlePieceAnalysis[] | null;
  /** The army of 80 against each layer at default volumes; null until every piece is rendered. */
  mix(): Promise<BattleMixReport | null>;
  /** Clicks at the seams (BattleSeamReport); null until every piece is rendered. */
  seams(seconds?: number): Promise<BattleSeamReport | null>;
}

export interface MenuStormHooks {
  stats(): MenuStormStats;
  /** A flash now; `fork` forces the fork on or off (omitted: rolled as usual). */
  forceFlash(fork?: boolean): void;
  /** Stop storm time (true) or let it run with the frames again (false). */
  freeze(on: boolean): void;
  /** Move storm time on by this many seconds, frozen or not (thunder cues fall due as they would). */
  advance(seconds: number): void;
  /** Turn the storm off (it fades out and stays off) or back on (it starts if the title is up): for measurements. */
  enable(on: boolean): void;
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

function noKindOrders(): Record<UnitKind, Order | null> {
  const out = {} as Record<UnitKind, Order | null>;
  for (const kind of UNIT_KINDS) out[kind] = null;
  return out;
}

function noSupports(): DebugState['supports'] {
  const out = {} as DebugState['supports'];
  for (const kind of SUPPORT_KINDS) out[kind] = { available: false, cooldown: 0 };
  return out;
}

export function debugEnabled(search: string): boolean {
  return new URLSearchParams(search).get('debug') === '1';
}

/** Create the hooks and put them on window.__TH. */
export function installDebug(app: App, view: BattleView, ui: UiHandle, audio: GameAudio, admin: AdminController | null = null): DebugApi {
  const api: DebugApi = {
    ready: false,

    missions() {
      return app.missions.map((m) => ({
        id: m.id,
        key: m.key,
        title: m.title,
        mode: m.mode,
        length: m.length,
        timer: m.timer ? { ...m.timer } : null,
        newUnit: m.newUnit,
        newSupport: m.newSupport,
        unlocks: [...(m.unlocks ?? [])],
        units: [...m.units[0]],
        supports: [...m.supports[0]],
        enemyHq: m.start[1].hasHq,
      }));
    },

    unlockAll: () => app.unlockAll(),
    setUpgrades: (levels) => app.setUpgrades(levels),
    save: () => structuredClone(app.save),
    medals: () => app.save.medals,
    giveMedals: (n) => app.giveMedals(Math.max(0, Math.floor(Number(n) || 0))),
    takeMedals: (n) => app.giveMedals(-Math.max(0, Math.floor(Number(n) || 0))),
    result: () => (app.lastResult ? { ...app.lastResult } : null),

    audio() {
      const stats = audio.getStats();
      return { state: stats.state, played: stats.played, dropped: stats.dropped, muted: audio.isMuted(), rendered: stats.rendered };
    },

    lookAt: (x) => view.camera.setCenter(x, true),

    units() {
      const out: UnitInfo[] = [];
      const session = app.session;
      if (!session) return out;
      const s = session.battle.state;
      for (let i = 0; i < s.unitCount; i++) {
        const u = s.units[i];
        if (!u.alive) continue;
        out.push({
          id: u.id,
          kind: u.kind,
          side: u.side,
          action: u.action,
          x: u.x,
          row: u.row,
          hp: u.hp,
          maxHp: u.maxHp,
          carrying: u.carrying > 0,
          inside: u.inside,
          actionTime: u.actionTime,
          trench: u.trenchId,
        });
      }
      return out;
    },

    projectiles() {
      const out: ProjectileInfo[] = [];
      const session = app.session;
      if (!session) return out;
      for (const p of session.battle.state.projectiles) {
        if (!p.alive) continue;
        out.push({ side: p.side, weapon: p.weapon ? p.weapon.id : '', fromX: p.fromX, toX: p.toX, x: p.x, t: p.flightTime > 0 ? p.age / p.flightTime : 1 });
      }
      return out;
    },

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

    startMission(id, difficulty, seed, armoury) {
      return app.beginMission(id, difficulty ?? app.save.settings.difficulty, seed, armoury === true);
    },

    autopilot(on) {
      app.autopilot = on;
    },

    startStalingrad(id, difficulty, seed) {
      const m = getStalingradMission(id);
      if (!m) return false;
      app.beginUnlisted(m, difficulty ?? 'normal', seed);
      return true;
    },

    startSandbox(seed, mirror) {
      app.beginUnlisted(mirror === true ? SANDBOX_MIRROR : SANDBOX, 'normal', seed);
      return true;
    },

    startTraining() {
      app.startTraining();
      return app.session !== null;
    },

    tutorial() {
      const tutorial = app.tutorial;
      if (tutorial === null) return null;
      const tip = tutorial.tip;
      const id = tutorial.activeId;
      const { done, total } = tutorial.progress;
      return { tip: tip !== null && id !== null ? { id, text: tip.text, target: tip.target } : null, done, total, finished: tutorial.finished };
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
          kindOrders: noKindOrders(),
          queue: zeroCounts(),
          units: [zeroCounts(), zeroCounts()],
          hq: [null, null],
          timer: null,
          prep: null,
          upgrades: {},
          darkness: 0,
          resultReady: app.lastResult !== null,
          controlled: null,
          supports: noSupports(),
          targeting: null,
          smokes: 0,
          trenches: [],
          pillboxes: [],
          wires: 0,
          tally: newTally(),
        };
      }
      const s = session.battle.state;
      const me = s.sides[0];
      const hq = (side: 0 | 1): { hp: number; max: number } | null => {
        const h = s.sides[side].hq;
        return h ? { hp: h.hp, max: h.maxHp } : null;
      };
      const supports = noSupports();
      for (const kind of SUPPORT_KINDS) supports[kind] = { available: me.supportAvailable[kind], cooldown: me.supportCooldown[kind] };
      const under = me.controlled >= 0 ? s.units[me.controlled] : null;
      let smokes = 0;
      for (const smoke of s.smokes) if (smoke.alive) smokes++;
      let wires = 0;
      for (const wire of s.wires) if (wire.alive) wires++;
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
        kindOrders: { ...me.kindOrders },
        queue: copyCounts(me.queue),
        units: [copyCounts(s.sides[0].alive), copyCounts(s.sides[1].alive)],
        hq: [hq(0), hq(1)],
        timer: s.timer ? s.timer.secondsLeft : null,
        prep: s.prep
          ? { active: s.prep.active, secondsLeft: s.prep.secondsLeft, sites: s.sites.length, trenches: s.trenches.length, wires: s.wires.length, pillboxes: s.pillboxes.length }
          : null,
        upgrades: { ...session.battle.config.upgrades },
        darkness: app.darkness,
        resultReady: app.lastResult !== null,
        controlled:
          under && under.alive
            ? { id: under.id, kind: under.kind, x: under.x, hp: under.hp, maxHp: under.maxHp, action: under.action, inTrench: under.trenchId >= 0 }
            : null,
        supports,
        targeting: session.aiming,
        smokes,
        trenches: s.trenches.map((t) => ({ id: t.id, x: t.x, owner: t.owner, occupants: t.occupants })),
        pillboxes: s.pillboxes.map((p) => ({ id: p.id, x: p.x, side: p.side, hp: p.hp, maxHp: p.maxHp, alive: p.alive })),
        wires,
        tally: structuredClone(session.tally),
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

    grantPopulation(n) {
      const session = app.session;
      if (session) {
        const side = session.battle.state.sides[0];
        side.popCap = Math.min(CONFIG.popCap, side.popCap + n);
      }
    },

    forceWeather(w) {
      app.weatherMode = w;
      if (w !== 'auto') view.forceWeather(w);
    },
    forceThunder: () => view.forceThunder(),
    weatherStats: () => view.weatherStats(),
    blood() {
      const stats = view.getStats();
      return { pools: stats.bloodPools, drawn: stats.bloodDrawn, cap: RENDER.blood.maxPools, deaths: stats.bloodDeaths, shown: app.save.settings.showBlood };
    },

    hpPips() {
      const stats = view.getStats();
      return { own: stats.pipsOwn, enemy: stats.pipsEnemy, enemyRevealed: view.hpReveal.enemyShown() };
    },
    revealEnemyHp: (on) => view.hpReveal.setEnemyShown(on),

    buttonRects: () => ui.getHudButtonRects(),

    camera() {
      const c = view.camera;
      const stats = view.getStats();
      return {
        centerX: c.centerX,
        left: c.centerX - c.viewWidthWu / 2,
        viewWidthWu: c.viewWidthWu,
        length: app.session ? app.session.battle.state.length : 0,
        cssPerWu: stats.canvasW / stats.dpr / c.viewWidthWu,
      };
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

    menuStorm: {
      stats: () => app.storm.stats(),
      forceFlash: (fork) => app.storm.forceFlash(fork),
      freeze: (on) => app.storm.freeze(on),
      advance: (seconds) => app.storm.advance(seconds),
      enable(on) {
        app.storm.enabled = on;
        if (!on) app.storm.stop();
        else if (ui.current() === 'title') app.storm.start();
      },
    },

    music: {
      stats: () => ({ ...audio.musicStats() }),
      analyse(name = MENU_MUSIC) {
        const track = audio.musicTrack(name);
        if (!track) return null;
        const data = track.buffer.getChannelData(0);
        const rate = track.sampleRate;
        const frames = track.loopFrames;
        let silent = 0;
        let windows = 0;
        for (let s = 0; s + rate <= frames; s += rate) {
          windows++;
          if (db(rmsOf(data, s, s + rate)) < -60) silent++;
        }
        return {
          seconds: track.loopSeconds,
          sampleRate: rate,
          channels: track.channels,
          bytes: track.bytes,
          renderMs: track.renderMs,
          buildMs: track.buildMs,
          peak: peakOf(data, 0, frames),
          rms: rmsOf(data, 0, frames),
          silentShare: windows > 0 ? silent / windows : 0,
          seam: seamOf(data, frames, rate),
          sections: sectionTimes(MUSIC_TRACKS[name]).map((s) => {
            const a = Math.round(s.start * rate);
            const b = Math.min(frames, Math.round(s.end * rate));
            return { name: s.name, start: s.start, rmsDb: db(rmsOf(data, a, b)), peakDb: db(peakOf(data, a, b)) };
          }),
        };
      },
      async mix() {
        const track = audio.musicTrack(MENU_MUSIC);
        const Offline = findOfflineContext();
        if (!track || !Offline) return null;
        return measureMix(Offline, track);
      },
    },

    admin: admin
      ? {
          useHash: (hex) => admin.lockState.useHash(String(hex)),
          unlocked: () => admin.isUnlocked(),
        }
      : null,

    battleMusic: {
      stats: () => JSON.parse(JSON.stringify(audio.battleMusicStats())) as BattleMusicStats,
      force: (layer) => app.forceMusicLayer(layer),
      setPrep: (on) => app.setPrepPhase(on),
      intensity() {
        const i = app.musicIntensity;
        return i ? { layer: i.layer, fighting: [i.fighting[0], i.fighting[1]], changes: structuredClone(i.changes) } : null;
      },
      analyse() {
        const player = audio.battleMusic();
        if (!player) return null;
        const out: BattlePieceAnalysis[] = [];
        const add = (section: string, layer: string, buffer: AudioBuffer | null): void => {
          if (!buffer) return;
          const data = buffer.getChannelData(0);
          const end = Math.max(0, data.length - Math.round(0.005 * buffer.sampleRate));
          out.push({ section, layer, seconds: buffer.duration, peakDb: db(peakOf(data)), rmsDb: db(rmsOf(data)), startAbs: Math.abs(data[0] ?? 0), endPeakDb: db(peakOf(data, end, data.length)) });
        };
        player.def.sections.forEach((s, i) => {
          for (const layer of player.layers) add(s.name, layer, player.buffer(i, layer));
        });
        add('sting', 'victory', player.sting('victory'));
        add('sting', 'defeat', player.sting('defeat'));
        return out;
      },
      async mix() {
        const player = audio.battleMusic();
        const Offline = findOfflineContext();
        if (!player || !Offline || audio.battleMusicStats().state !== 'ready') return null;
        const join = (layer: MixedLayer): Float32Array => {
          const parts = player.def.sections.map((_, i) => player.buffer(i, layer)).filter((b): b is AudioBuffer => b !== null);
          const total = parts.reduce((n, b) => n + b.length, 0);
          const data = new Float32Array(total);
          let at = 0;
          for (const b of parts) {
            data.set(b.getChannelData(0), at);
            at += b.length;
          }
          return data;
        };
        const rate = player.buffer(0, 'build')?.sampleRate ?? 16000;
        const stingPeak = Math.max(...(['victory', 'defeat'] as const).map((n) => { const b = player.sting(n); return b ? peakOf(b.getChannelData(0)) : 0; }));
        return measureBattleMix(Offline, createAudio, player.def, { build: join('build'), combat: join('combat'), tense: join('tense') }, rate, stingPeak);
      },
      async seams(seconds = 150) {
        const live = audio.battleMusic();
        const Offline = findOfflineContext();
        const first = live?.buffer(0, 'build') ?? null;
        if (!live || !Offline || !first || audio.battleMusicStats().state !== 'ready') return null;
        const rate = first.sampleRate;
        const ctx = new Offline(1, Math.ceil(seconds * rate), rate);
        const player = new BattleMusicPlayer(live.def, seededRandom(4242));
        live.def.sections.forEach((_, i) => {
          for (const layer of live.layers) {
            const b = live.buffer(i, layer);
            if (b) player.add({ section: i, layer, sting: null }, b);
          }
        });
        player.attach(ctx, ctx.destination);
        const plan: [number, MusicLayer][] = [
          [seconds * 0.2, 'combat'],
          [seconds * 0.45, 'tense'],
          [seconds * 0.6, 'combat'],
          [seconds * 0.8, 'build'],
        ];
        const seamTimes = new Set<number>();
        const fades = new Set<number>();
        const step = 0.25;
        const look = (): void => {
          const st = player.stats();
          if (st.nextStart >= 0) seamTimes.add(Math.round(st.nextStart * rate));
          if (st.fadeAt >= 0) fades.add(st.fadeAt);
        };
        player.tick();
        look();
        for (let t = step; t < seconds - 1; t += step) {
          const at = t;
          void ctx.suspend(at).then(() => {
            for (const [when, layer] of plan) if (Math.abs(when - at) < step / 2) player.setTarget(layer);
            player.tick();
            look();
            void ctx.resume();
          });
        }
        const out = await startRendering(ctx);
        const st = player.stats();
        const data = out.getChannelData(0);
        for (const f of fades) {
          seamTimes.add(Math.round(f * rate));
          seamTimes.add(Math.round((f + MUSIC_BATTLE.player.crossfade[st.active]) * rate));
        }
        const near = Math.round(0.0015 * rate);
        const around = Math.round(0.04 * rate);
        const ratio = (n: number): number => {
          let a = 0;
          let b = 1e-6;
          for (let i = Math.max(1, n - around); i < Math.min(data.length, n + around); i++) {
            const d = Math.abs(data[i] - data[i - 1]);
            if (Math.abs(i - n) <= near) a = Math.max(a, d);
            else b = Math.max(b, d);
          }
          return a / b;
        };
        let seamRatio = 0;
        let seamAt = 0;
        for (const n of seamTimes) {
          if (n <= 0 || n >= data.length) continue;
          const r = ratio(n);
          if (r > seamRatio) {
            seamRatio = r;
            seamAt = n / rate;
          }
        }
        // Bar lines on the music's own grid (it starts 0.08 s in) that are not seams.
        const bar = Math.round(((live.def.beatsPerBar * 60) / live.def.bpm) * rate);
        let barRatio = 0;
        for (let n = Math.round(0.08 * rate) + bar; n < data.length - around; n += bar) {
          let seam = false;
          for (const m of seamTimes) if (Math.abs(m - n) < around) seam = true;
          if (!seam) barRatio = Math.max(barRatio, ratio(n));
        }
        return { seconds, sections: st.sectionsPlayed, crossfades: st.crossfades, seams: seamTimes.size, seamRatio, seamAt, barRatio, peak: peakOf(data) };
      },
    },
  };

  Reflect.set(window, '__TH', api);
  return api;
}


