/**
 * The app controller: screen flow, the current battle, progress and settings.
 * It implements AppApi for the UI and owns the game loop.
 *
 *   title -> campaign -> briefing -> battle -> result -> campaign
 *
 * Nothing here touches the DOM, so the flow runs in unit tests with fakes for
 * the view, the audio and the UI.
 */
import type { GameAudio } from '../audio';
import { APP } from '../data/app';
import { DIFFICULTY_LIST } from '../data/difficulty';
import { MISSIONS } from '../data/missions';
import type { Difficulty, MissionDef, UpgradeDef, UpgradeLevels } from '../data/schema';
import { UI_SOUND } from '../data/sounds';
import { UPGRADES } from '../data/upgrades';
import {
  buyUpgrade,
  clearSave,
  defaultSave,
  loadSave,
  maxLevel,
  nextMissionId,
  recordClear,
  refundAll,
  refundUpgrade,
  writeSave,
  type SaveData,
  type StorageLike,
} from '../meta';
import type { BattleView, WeatherMode } from '../render/contracts';
import { createBattle } from '../sim';
import type { AppApi, CampaignView, HudAction, ResultView, ScreenId, SettingsView, UiApi } from '../ui/contracts';
import { buildCampaignView, buildResult } from './campaignView';
import { GameLoop } from './loop';
import { BattleSession } from './session';

export interface AppDeps {
  view: BattleView;
  audio: GameAudio;
  storage: StorageLike | null;
  /** Campaign order. Default: every mission in src/data/missions. */
  missions?: readonly MissionDef[];
  /** Quartermaster upgrades. Default: every upgrade in src/data/upgrades.ts. */
  upgradeDefs?: readonly UpgradeDef[];
  /** Clock for the frame-time averages. */
  now?: () => number;
  /** Random numbers in 0..1 for battle seeds. */
  random?: () => number;
}

export class App implements AppApi {
  readonly loop: GameLoop;
  readonly missions: readonly MissionDef[];
  readonly upgradeDefs: readonly UpgradeDef[];
  save: SaveData;
  session: BattleSession | null = null;
  /** The result of the last finished battle, kept for the debug hooks. */
  lastResult: ResultView | null = null;
  /** Weather requested for the next battle (debug can force rain or clear). */
  weatherMode: WeatherMode = 'auto';

  private ui: UiApi | null = null;
  private darkness = 0;
  /** Set by the debug hook: every mission is open on the map. Never saved. */
  private unlockedAll = false;
  private pendingResult: ResultView | null = null;
  private readonly view: BattleView;
  private readonly audio: GameAudio;
  private readonly storage: StorageLike | null;
  private readonly random: () => number;

  constructor(deps: AppDeps) {
    this.view = deps.view;
    this.audio = deps.audio;
    this.storage = deps.storage;
    this.missions = deps.missions ?? MISSIONS;
    this.upgradeDefs = deps.upgradeDefs ?? UPGRADES;
    this.random = deps.random ?? Math.random;
    this.save = loadSave(deps.storage, { missionIds: this.missions.map((m) => m.id), upgradeDefs: this.upgradeDefs }).data;
    this.audio.setMuted(this.save.settings.muted);

    this.loop = new GameLoop(
      {
        begin: () => this.session?.flushControl(),
        step: () => this.session?.step(),
        over: () => this.session === null || this.session.battle.state.over,
        render: (alpha, dt) => this.renderFrame(alpha, dt),
        hud: () => this.updateHud(),
        setEffects: (enabled) => this.view.setEffectsEnabled(enabled),
        endDelayElapsed: () => this.showResult(),
      },
      deps.now,
    );

    this.view.onTapGround = (x) => {
      if (this.session && !this.loop.paused) this.session.tapGround(x);
    };
    this.view.onTapUnit = (id) => {
      if (this.session && !this.loop.paused) this.session.tapUnit(id);
    };
    this.view.setFrameHandler((dtMs) => {
      if (this.session) this.loop.frame(dtMs);
    });
  }

  /** Hand over the UI (it is created after the app, because it needs the AppApi). */
  attachUi(ui: UiApi): void {
    this.ui = ui;
  }

  /** The UI changed screen: leaving the battle screens ends the battle. */
  onScreen(screen: ScreenId): void {
    if (screen !== 'battle' && screen !== 'result') this.endSession();
  }

  get currentUi(): UiApi | null {
    return this.ui;
  }

  // --- battle lifecycle ----------------------------------------------------

  /** Start a campaign battle and show the battle screen. Returns false if the mission does not exist. */
  beginMission(id: number, difficulty: Difficulty, seed: number = this.newSeed()): boolean {
    const mission = this.missions.find((m) => m.id === id);
    if (!mission) return false;
    this.launch(mission, difficulty, seed);
    return true;
  }

  /**
   * Start a battle on a mission that is not in the campaign (the sandbox grounds, through the debug hooks).
   * A win or loss there is never written to the save.
   */
  beginUnlisted(mission: MissionDef, difficulty: Difficulty, seed: number = this.newSeed()): void {
    this.launch(mission, difficulty, seed);
  }

  private launch(mission: MissionDef, difficulty: Difficulty, seed: number): void {
    this.endSession();
    // The map opens on the mission last played (the sandbox grounds are not part of the campaign).
    if (this.missions.some((m) => m.id === mission.id) && this.save.lastMission !== mission.id) {
      this.save.lastMission = mission.id;
      this.persist();
    }
    const battle = createBattle({
      mission,
      difficulty,
      seed,
      upgrades: { ...this.save.upgrades },
      commanders: ['human', 'ai'],
      upgradeDefs: this.upgradeDefs,
    });
    this.view.attach(battle, { playerSide: 0, weather: this.weatherMode, visualSeed: seed + APP.visualSeedOffset });
    this.view.setAudio(this.audio);
    this.view.setDarkness(0);
    this.darkness = 0;
    this.session = new BattleSession(battle, difficulty, seed, this.view, this.audio, {
      hints: () => this.save.settings.hints,
      sound: () => this.loop.timeScale <= APP.soundMaxTimeScale,
      onEnded: () => this.battleEnded(),
    });
    this.pendingResult = null;
    this.lastResult = null;
    this.loop.reset();
    // A new battle always starts at normal speed; only the debug hooks change it.
    this.loop.timeScale = 1;
    this.audio.resume();
    this.ui?.show('battle', { missionId: mission.id });
  }

  /** Throw the current battle away without recording anything. */
  endSession(): void {
    if (this.session) {
      this.session.stopInputs();
      this.view.detach();
      this.session = null;
    }
    this.pendingResult = null;
    if (this.loop.paused) {
      // Leaving from the pause menu: the menus need their sounds back.
      this.loop.paused = false;
      this.audio.resume();
    }
  }

  private newSeed(): number {
    return Math.floor(this.random() * 0x7fffffff);
  }

  private battleEnded(): void {
    const session = this.session;
    if (!session) return;
    const mission = session.mission;
    let points = 0;
    // Only campaign missions count: a win on the sandbox grounds must leave the save alone.
    if (session.battle.state.winner === 0 && this.missions.some((m) => m.id === mission.id)) {
      points = recordClear(this.save, mission.id, session.difficulty).pointsAwarded;
      this.persist();
    }
    const ids = this.missions.map((m) => m.id);
    this.pendingResult = buildResult(session.battle, session.difficulty, points, nextMissionId(ids, mission.id));
    this.lastResult = this.pendingResult;
  }

  private showResult(): void {
    const result = this.pendingResult;
    if (!result || !this.ui) return;
    this.pendingResult = null;
    this.ui.show('result', { result });
  }

  private renderFrame(alpha: number, dt: number): void {
    if (!this.session) return;
    const timer = this.session.battle.state.timer;
    // A deadline mission slides from its own light into night as the time runs out.
    const darkness = timer && timer.onExpire === 'lose' ? Math.min(1, Math.max(0, timer.progress)) : 0;
    if (darkness !== this.darkness) {
      this.darkness = darkness;
      this.view.setDarkness(darkness);
    }
    this.view.render(alpha, dt);
    this.audio.setListener(this.view.camera.centerX, this.view.camera.viewWidthWu);
  }

  private updateHud(): void {
    const session = this.session;
    if (!session) return;
    const state = session.fill(this.loop.paused, this.save.settings.muted);
    if (this.ui && this.ui.current() === 'battle') this.ui.updateHud(state);
  }

  // --- pause ---------------------------------------------------------------

  setPaused(paused: boolean): void {
    if (this.loop.paused === paused) return;
    this.loop.paused = paused;
    if (paused) {
      this.session?.stopInputs();
      this.audio.suspend();
    } else {
      this.audio.resume();
    }
  }

  /** The tab or window lost focus, or the phone locked: pause a running battle and never resume by itself. */
  autoPause(): void {
    const session = this.session;
    if (!session || session.ended || this.loop.paused) return;
    if (this.ui && this.ui.current() !== 'battle') return;
    this.setPaused(true);
  }

  // --- AppApi --------------------------------------------------------------

  campaign(): CampaignView {
    return buildCampaignView(this.save, this.missions, this.upgradeDefs, this.unlockedAll);
  }

  /** Start a campaign mission on a difficulty. The difficulty is remembered as the one the briefing starts on. */
  startMission(id: number, difficulty: Difficulty): void {
    const chosen = DIFFICULTY_LIST.includes(difficulty) ? difficulty : this.save.settings.difficulty;
    if (!this.missions.some((m) => m.id === id)) return;
    if (this.save.settings.difficulty !== chosen) {
      this.save.settings.difficulty = chosen;
      this.persist();
    }
    this.beginMission(id, chosen);
  }

  // --- debug hooks (src/app/debug.ts) -----------------------------------------

  /** Open every mission on the map. Records nothing: clears, points and the save stay as they are. */
  unlockAll(): void {
    this.unlockedAll = true;
    this.ui?.refresh();
  }

  /**
   * Replace the upgrade levels: unknown upgrades are dropped and levels are capped at each upgrade's maximum, but the
   * points are not checked (a test can try a full set on a fresh save). The next load clamps what the points cannot pay for.
   */
  setUpgrades(levels: UpgradeLevels): void {
    const next: UpgradeLevels = {};
    for (const def of this.upgradeDefs) {
      const level = Math.floor(levels[def.id] ?? 0);
      if (level >= 1) next[def.id] = Math.min(level, maxLevel(def));
    }
    this.save.upgrades = next;
    this.persist();
    this.ui?.refresh();
  }

  buyUpgrade(id: string): void {
    if (buyUpgrade(this.save, this.upgradeDefs, id)) this.persist();
  }

  refundUpgrade(id: string): void {
    if (refundUpgrade(this.save, id)) this.persist();
  }

  refundAll(): void {
    refundAll(this.save);
    this.persist();
  }

  setSetting<K extends keyof SettingsView>(key: K, value: SettingsView[K]): void {
    Object.assign(this.save.settings, { [key]: value });
    if (key === 'muted') this.audio.setMuted(value === true);
    this.persist();
  }

  resetSave(): void {
    this.save = defaultSave();
    clearSave(this.storage);
    this.audio.setMuted(this.save.settings.muted);
  }

  uiSound(name: 'click' | 'deny' | 'confirm'): void {
    this.audio.play(UI_SOUND[name]);
  }

  dispatch(action: HudAction): void {
    switch (action.type) {
      case 'pause':
        if (this.session) this.setPaused(true);
        return;
      case 'resume':
        this.setPaused(false);
        return;
      case 'restart':
        if (this.session) this.launch(this.session.mission, this.session.difficulty, this.newSeed());
        return;
      case 'quit':
        this.endSession();
        this.ui?.show('campaign');
        return;
      case 'toggleMute':
        this.setSetting('muted', !this.save.settings.muted);
        return;
      default:
        if (this.session && !this.loop.paused) this.session.dispatch(action);
    }
  }

  private persist(): void {
    writeSave(this.storage, this.save);
  }
}

