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
import type { MusicTrackName } from '../data/music';
import type { MusicLayer } from '../data/musicBattle';
import type { Difficulty, MissionDef, UpgradeDef, UpgradeLevels } from '../data/schema';
import { UI_SOUND } from '../data/sounds';
import { UPGRADES } from '../data/upgrades';
import {
  buyUpgrade,
  cleanSetting,
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
import { MenuStormDirector } from './menuStorm';
import { MusicIntensity } from './musicIntensity';
import { BattleSession } from './session';
import { TipMemory, Tutorial } from './tutorial';

/** The campaign map track, and the screens it plays on (and behind Settings opened from one of them). */
export const MAP_MUSIC: MusicTrackName = 'map';
const MAP_SCREENS: readonly ScreenId[] = ['campaign', 'briefing', 'quartermaster'];

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
  /** How far the sky has been pushed toward night for a deadline mission (0..1); what the view was last told. */
  darkness = 0;
  /** Set by the debug hook: every mission is open on the map. Never saved. */
  private unlockedAll = false;
  /** Debug only: battles started from now on are played for the player by the sim's test bot. */
  autopilot = false;
  private pendingResult: ResultView | null = null;
  /** Which tutorial tips have ended; they never come back (until the player asks for them again). */
  readonly tips: TipMemory;
  /** The title screen's storm. */
  readonly storm: MenuStormDirector;
  /** Picks the battle-music layer from the battle (null outside a battle). */
  musicIntensity: MusicIntensity | null = null;
  /** The campaign map track is on. */
  private mapMusic = false;
  private readonly view: BattleView;
  private readonly audio: GameAudio;
  private readonly storage: StorageLike | null;
  private readonly random: () => number;

  constructor(deps: AppDeps) {
    this.view = deps.view;
    this.audio = deps.audio;
    this.storage = deps.storage;
    this.tips = new TipMemory(deps.storage);
    this.missions = deps.missions ?? MISSIONS;
    this.upgradeDefs = deps.upgradeDefs ?? UPGRADES;
    this.random = deps.random ?? Math.random;
    this.save = loadSave(deps.storage, { missionIds: this.missions.map((m) => m.id), upgradeDefs: this.upgradeDefs }).data;
    this.storm = new MenuStormDirector(this.view, this.audio, () => this.ui);
    this.applySettings();

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
      else this.storm.frame(dtMs);
    });
  }

  /** Hand every saved setting to the audio, the view and the storm (at start and after a reset). */
  private applySettings(): void {
    const s = this.save.settings;
    this.audio.setMuted(s.muted);
    this.audio.setVolume('music', s.musicVolume / 100);
    this.audio.setVolume('ambience', s.ambienceVolume / 100);
    this.audio.setVolume('sfx', s.sfxVolume / 100);
    this.view.setReducedFlashing(s.reduceFlash);
    this.storm.setReduced(s.reduceFlash);
  }

  /** Hand over the UI (it is created after the app, because it needs the AppApi). */
  attachUi(ui: UiApi): void {
    this.ui = ui;
  }

  /**
   * The UI changed screen: leaving the battle screens ends the battle. The title starts its storm; Settings opened
   * from the title keeps it going (so the volume sliders can be heard against the rain); anything else stops it.
   */
  onScreen(screen: ScreenId): void {
    if (screen !== 'battle' && screen !== 'result') this.endSession();
    // The campaign map track: on the map, the briefing and the Quartermaster (and behind Settings from them).
    const map = MAP_SCREENS.includes(screen) || (screen === 'settings' && this.mapMusic);
    if (!map && this.mapMusic) {
      this.mapMusic = false;
      this.audio.stopMusic();
    }
    if (screen === 'title') this.storm.start();
    else if (!(screen === 'settings' && this.storm.running)) this.storm.stop();
    if (map && !this.mapMusic) {
      this.mapMusic = true;
      // Rendered the first time the map opens (and again after a battle, which lets go of it).
      this.audio.prepareMusic(MAP_MUSIC);
      this.audio.startMusic(MAP_MUSIC);
    }
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
    // A restart of the same mission keeps its rendered music and starts it again from the top.
    const sameMusic = this.session !== null && this.session.mission.music === mission.music;
    this.endSession(sameMusic);
    const campaign = this.missions.some((m) => m.id === mission.id);
    // The map opens on the mission last played (the sandbox grounds are not part of the campaign).
    if (campaign && this.save.lastMission !== mission.id) {
      this.save.lastMission = mission.id;
      this.persist();
    }
    const battle = createBattle({
      mission,
      difficulty,
      seed,
      upgrades: { ...this.save.upgrades },
      commanders: [this.autopilot ? 'bot' : 'human', 'ai'],
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
      // Guided tips belong to the campaign: the proving ground and a bot at the controls need none.
      tutorial: campaign && !this.autopilot ? new Tutorial(mission, this.tips) : null,
    });
    this.pendingResult = null;
    this.lastResult = null;
    this.loop.reset();
    // A new battle always starts at normal speed; only the debug hooks change it.
    this.loop.timeScale = 1;
    // The battle music: the map track lets go of its buffer, and the mission's track renders in the background.
    this.audio.releaseMusic(MAP_MUSIC);
    this.musicIntensity = new MusicIntensity();
    this.audio.setBattleLayer('build');
    this.audio.prepareBattleMusic(mission.music);
    this.audio.resume();
    this.ui?.show('battle', { missionId: mission.id });
  }

  /** Throw the current battle away without recording anything; its music is let go of too, unless `keepMusic`. */
  endSession(keepMusic = false): void {
    if (this.session) {
      this.session.stopInputs();
      this.view.detach();
      this.session = null;
      this.musicIntensity = null;
      if (!keepMusic) this.audio.releaseBattleMusic();
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
    // The sting was played with the battleEnded event if sound was on; either way the layers fade out now.
    this.audio.endBattleMusic(session.battle.state.winner === 0, false);
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
    const intensity = this.musicIntensity;
    if (intensity && !this.session.battle.state.over) this.audio.setBattleLayer(intensity.update(this.session.battle.state));
    this.audio.tickBattleMusic();
  }

  private updateHud(): void {
    const session = this.session;
    if (!session) return;
    const state = session.fill(this.loop.paused, this.save.settings.muted);
    if (this.ui && this.ui.current() === 'battle') this.ui.updateHud(state);
  }

  /** The prep phase of a defensive mission (a later job adds it): the music's prep layer while it lasts. */
  setPrepPhase(on: boolean): void {
    this.musicIntensity?.setPrep(on);
  }

  /** Debug: hold the battle music on a layer (null hands it back to the battle). */
  forceMusicLayer(layer: MusicLayer | null): void {
    const intensity = this.musicIntensity;
    if (!intensity) return;
    intensity.force(layer);
    this.audio.setBattleLayer(intensity.layer);
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

  /** The page went to the background (tab hidden, app switched away, phone locked): pause a running battle and silence the audio, menus included. */
  pageHidden(): void {
    this.autoPause();
    this.storm.setAway(true);
    this.audio.suspend();
  }

  /** The page is back in front: sound returns, unless a battle is still paused (the player resumes that). */
  pageShown(): void {
    this.storm.setAway(false);
    if (!this.loop.paused) this.audio.resume();
  }

  /**
   * The window lost focus (another window or app in front). A running battle pauses (autoPause); the title storm
   * freezes and its sound is suspended. Other menus keep their sound.
   */
  pageBlurred(): void {
    this.autoPause();
    if (this.storm.running && !this.storm.away) {
      this.storm.setAway(true);
      this.audio.suspend();
    }
  }

  /** The window has focus again (and is visible): the storm carries on where it froze. */
  pageFocused(): void {
    if (!this.storm.away) return;
    this.storm.setAway(false);
    if (!this.loop.paused) this.audio.resume();
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

  /** Change one setting: checked and clamped like a stored one (volumes are whole numbers 0..100), applied at once and saved. */
  setSetting<K extends keyof SettingsView>(key: K, value: SettingsView[K]): void {
    const settings = this.save.settings;
    const clean = cleanSetting(key, value);
    settings[key] = clean;
    switch (key) {
      case 'muted':
        this.audio.setMuted(settings.muted);
        break;
      case 'musicVolume':
        this.audio.setVolume('music', settings.musicVolume / 100);
        break;
      case 'ambienceVolume':
        this.audio.setVolume('ambience', settings.ambienceVolume / 100);
        break;
      case 'sfxVolume':
        this.audio.setVolume('sfx', settings.sfxVolume / 100);
        break;
      case 'reduceFlash':
        this.view.setReducedFlashing(settings.reduceFlash);
        this.storm.setReduced(settings.reduceFlash);
        break;
      default:
        break;
    }
    this.persist();
  }

  resetSave(): void {
    this.save = defaultSave();
    clearSave(this.storage);
    this.tips.clear();
    this.applySettings();
  }

  replayHints(): void {
    this.tips.clear();
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

