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
import { CAMPAIGNS } from '../data/campaigns';
import { DIFFICULTY_LIST } from '../data/difficulty';
import { STALINGRAD_MISSIONS } from '../data/missions/stalingrad';
import { BASIC_TRAINING_DIFFICULTY, BASIC_TRAINING_ID, trainingMission } from '../data/missions/training';
import type { MusicTrackName } from '../data/music';
import { MUSIC_BATTLE, type MusicLayer } from '../data/musicBattle';
import type { CampaignId, Difficulty, MissionDef, UpgradeDef, UpgradeLevels } from '../data/schema';
import { UI_SOUND } from '../data/sounds';
import { UPGRADES } from '../data/upgrades';
import {
  addMedals,
  applyRoster,
  buyItem,
  buyUpgrade,
  cleanSetting,
  clearSave,
  completeTraining,
  defaultSave,
  isUnlocked,
  loadSave,
  maxLevel,
  missionMedals,
  missionRoster,
  newsFor,
  withNews,
  nextMissionId,
  recordClear,
  recordWin,
  refundAll,
  refundUpgrade,
  writeSave,
  type MedalBreakdown,
  type SaveData,
  type StorageLike,
} from '../meta';
import type { BattleView, WeatherMode } from '../render/contracts';
import { createBattle, directorScore, structureHealth } from '../sim';
import type { AppApi, CampaignView, HudAction, ResultView, ScreenId, SettingsView, UiApi } from '../ui/contracts';
import { buildCampaignCards, buildCampaignView, buildResult, progressOf } from './campaignView';
import { FpsMeter } from './fpsMeter';
import { GameLoop } from './loop';
import { MENU_MUSIC, MenuStormDirector } from './menuStorm';
import { MusicIntensity } from './musicIntensity';
import { BattleSession } from './session';
import { TipMemory, Tutorial, isTraining } from './tutorial';

/**
 * The first campaign's map track (each campaign's map plays its own, `Campaign.mapMusic`; Stalingrad is the only one
 * today), and the screens a map track plays on (and behind Settings opened from one of them).
 */
export const MAP_MUSIC: MusicTrackName = CAMPAIGNS.stalingrad.mapMusic;
const MAP_SCREENS: readonly ScreenId[] = ['campaign', 'briefing', 'quartermaster', 'armoury'];
/** The menu screens the title storm and the menu theme play behind (and Settings opened from them). */
const STORM_SCREENS: readonly ScreenId[] = ['title', 'campaigns'];

/** One campaign as the app plays it: its id (src/data/campaigns.ts) and its missions in order. */
export interface CampaignPlay {
  id: CampaignId;
  missions: readonly MissionDef[];
}

/** Every campaign there is, in select-screen order (src/data/campaigns.ts CAMPAIGN_IDS). */
export const DEFAULT_CAMPAIGNS: readonly CampaignPlay[] = [{ id: 'stalingrad', missions: STALINGRAD_MISSIONS }];

export interface AppDeps {
  view: BattleView;
  audio: GameAudio;
  storage: StorageLike | null;
  /** One campaign's order (played as the Stalingrad campaign; the tests use it). Ignored when `campaigns` is given. */
  missions?: readonly MissionDef[];
  /** The campaigns and their missions. Default: DEFAULT_CAMPAIGNS (or `missions` as the Stalingrad campaign). */
  campaigns?: readonly CampaignPlay[];
  /**
   * Offer the campaigns still being built (`released: false`) on the select screen: the dev server and ?unreleased=1
   * do, the live site does not (the admin panel's unlock shows them for its session). Default false.
   */
  showUnreleased?: boolean;
  /** Quartermaster upgrades. Default: every upgrade in src/data/upgrades.ts. */
  upgradeDefs?: readonly UpgradeDef[];
  /** Clock for the frame-time averages. */
  now?: () => number;
  /** Random numbers in 0..1 for battle seeds. */
  random?: () => number;
}

export class App implements AppApi {
  readonly loop: GameLoop;
  /** Every campaign the game has, offered or not (a save keeps the progress of each). */
  readonly campaigns: readonly CampaignPlay[];
  /** The campaign on the map: chosen on the select screen, or that of the mission last played. */
  campaignId: CampaignId;
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
  /** Set by the debug hook or the admin panel: every mission is open on the map. Never saved. */
  private unlockedAll = false;
  /**
   * Set by the admin panel's unlock: a win on a mission the real progress has not opened yet is not recorded, so the
   * unlock stays for this session only and the save never gets a clear with a gap before it.
   */
  private adminUnlocked = false;
  /** The admin panel's time of day: a night tint that replaces the mission's own (null = the mission decides). */
  adminDarkness: number | null = null;
  /** The admin panel's spawn and pick modes take battlefield taps first while armed (true = the tap was used). */
  adminTaps: { ground(x: number): boolean; unit(id: number): boolean } | null = null;
  /**
   * The mission of the current battle as the data defines it (the battle itself plays a copy cut to the player's
   * Armoury, with loans), and whether the Armoury applied: a restart starts the same mission the same way.
   */
  private launched: { mission: MissionDef; armoury: boolean } | null = null;
  /** The medals of the last campaign win (for the result screen and the debug hooks). */
  lastMedals: MedalBreakdown | null = null;
  /** The guided tips of the current battle (null outside a battle, on the proving ground and under the bot). */
  tutorial: Tutorial | null = null;
  /** Debug only: battles started from now on are played for the player by the sim's test bot. */
  autopilot = false;
  private pendingResult: ResultView | null = null;
  /** Which tutorial tips have ended; they never come back (until the player asks for them again). */
  readonly tips: TipMemory;
  /** The title screen's storm. */
  readonly storm: MenuStormDirector;
  /** The "Show FPS" readout's numbers (measured in every battle frame, shown only with the setting on). */
  readonly fps = new FpsMeter();
  /** Picks the battle-music layer from the battle (null outside a battle). */
  musicIntensity: MusicIntensity | null = null;
  /** The campaign map track that is on, or null. */
  private mapMusic: MusicTrackName | null = null;
  /** Offer unreleased campaigns (AppDeps.showUnreleased). */
  private readonly showUnreleased: boolean;
  /** A battle let go of the menu theme's buffer: the title renders it again. */
  private menuReleased = false;
  /** Counts battle-music loads; a load whose number is no longer current was let go of or taken over. */
  private loadToken = 0;
  private readonly view: BattleView;
  private readonly audio: GameAudio;
  private readonly storage: StorageLike | null;
  private readonly random: () => number;

  constructor(deps: AppDeps) {
    this.view = deps.view;
    this.audio = deps.audio;
    this.storage = deps.storage;
    this.tips = new TipMemory(deps.storage);
    this.campaigns = deps.campaigns ?? (deps.missions ? [{ id: 'stalingrad', missions: deps.missions }] : DEFAULT_CAMPAIGNS);
    this.showUnreleased = deps.showUnreleased ?? false;
    this.upgradeDefs = deps.upgradeDefs ?? UPGRADES;
    this.random = deps.random ?? Math.random;
    this.save = loadSave(deps.storage, this.saveRules).data;
    // The map opens on the campaign of the mission last played, else on the first one offered.
    this.campaignId = (this.campaignFor(this.save.lastMission) ?? this.offered[0] ?? this.campaigns[0]).id;
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
      if (this.adminTaps && this.session && this.adminTaps.ground(x)) return;
      if (this.session && !this.loop.paused) this.session.tapGround(x);
    };
    this.view.onTapUnit = (id) => {
      if (this.adminTaps && this.session && this.adminTaps.unit(id)) return;
      if (this.session && !this.loop.paused) this.session.tapUnit(id);
    };
    this.view.setFrameHandler((dtMs) => {
      if (this.session) {
        this.fps.frame(dtMs);
        this.loop.frame(dtMs);
      } else {
        this.storm.frame(dtMs);
      }
    });
  }

  // --- campaigns -------------------------------------------------------------

  /** The campaigns the select screen offers: the released ones, and the rest where unreleased ones may show. */
  get offered(): readonly CampaignPlay[] {
    const all = this.showUnreleased || this.adminUnlocked;
    return this.campaigns.filter((c) => all || CAMPAIGNS[c.id].released);
  }

  /** The campaign on the map. */
  get current(): CampaignPlay {
    return this.offered.find((c) => c.id === this.campaignId) ?? this.offered[0] ?? this.campaigns[0];
  }

  /** The campaign on the map, in order. */
  get missions(): readonly MissionDef[] {
    return this.current.missions;
  }

  /** The offered campaign a mission belongs to, or null (the proving ground, Basic Training, an unoffered campaign). */
  campaignFor(missionId: number): CampaignPlay | null {
    return this.offered.find((c) => c.missions.some((m) => m.id === missionId)) ?? null;
  }

  /** What a stored save is checked against: every campaign's missions, each in its own order, and the upgrades. */
  get saveRules(): { missionIds: number[]; campaigns: number[][]; upgradeDefs: readonly UpgradeDef[] } {
    const campaigns = this.campaigns.map((c) => c.missions.map((m) => m.id));
    return { missionIds: campaigns.flat(), campaigns, upgradeDefs: this.upgradeDefs };
  }

  /** Put another offered campaign on the map (the campaign select screen). */
  selectCampaign(id: CampaignId): void {
    if (this.offered.some((c) => c.id === id)) this.campaignId = id;
  }

  /** The track the current campaign's map plays. */
  get mapTrack(): MusicTrackName {
    return CAMPAIGNS[this.current.id].mapMusic;
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
    this.view.setShowBlood(s.showBlood);
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
    // Back on the map or the title with no battle: a briefing's battle music (loaded or loading) is let go of.
    if (!this.session && (screen === 'campaign' || screen === 'title')) {
      this.loadToken++;
      this.audio.releaseBattleMusic();
    }
    // The campaign map track: on the map, the briefing and the Quartermaster (and behind Settings from them). Each
    // campaign's map plays its own track.
    const map = MAP_SCREENS.includes(screen) || (screen === 'settings' && this.mapMusic !== null);
    const track = this.mapTrack;
    if (this.mapMusic !== null && (!map || this.mapMusic !== track)) {
      this.mapMusic = null;
      this.audio.stopMusic();
    }
    const storm = STORM_SCREENS.includes(screen);
    if (storm && this.menuReleased) {
      this.menuReleased = false;
      this.audio.prepareMusic(MENU_MUSIC);
    }
    // The title storm and the menu theme: on the title and the campaign select (and behind Settings from them).
    if (storm) this.storm.start();
    else if (!(screen === 'settings' && this.storm.running)) this.storm.stop();
    if (map && this.mapMusic === null) {
      this.mapMusic = track;
      // Rendered the first time the map opens (and again after a battle, which lets go of it).
      this.audio.prepareMusic(track);
      this.audio.startMusic(track);
    }
  }

  get currentUi(): UiApi | null {
    return this.ui;
  }

  // --- battle lifecycle ----------------------------------------------------

  /**
   * Start a campaign battle and show the battle screen. Returns false if the mission does not exist. With `armoury`
   * the player fields what the Armoury owns (cut to what the mission allows, plus loans), as a player starting it from
   * the briefing does; without it the mission's own roster is used (the debug hooks and tests drive missions that way).
   */
  beginMission(id: number, difficulty: Difficulty, seed: number = this.newSeed(), armoury = false): boolean {
    const campaign = this.campaignFor(id);
    const mission = campaign?.missions.find((m) => m.id === id);
    if (!campaign || !mission) return false;
    // The battle's campaign goes on the map: quitting or winning comes back to it.
    this.campaignId = campaign.id;
    this.launch(mission, difficulty, seed, armoury);
    return true;
  }

  /**
   * Start a battle on a mission that is not in the campaign (the sandbox grounds, through the debug hooks).
   * A win or loss there is never written to the save.
   */
  beginUnlisted(mission: MissionDef, difficulty: Difficulty, seed: number = this.newSeed()): void {
    this.launch(mission, difficulty, seed);
  }

  private launch(mission: MissionDef, difficulty: Difficulty, seed: number, armoury = false): void {
    // The battle music held stays for prepareBattleMusic below: this mission's track (a restart, a replay, or the one
    // loaded for it) plays again from the top; any other is let go of there.
    this.endSession(true);
    const campaign = this.campaignFor(mission.id) !== null;
    // The map opens on the mission last played (the sandbox grounds are not part of the campaign).
    if (campaign && this.save.lastMission !== mission.id) {
      this.save.lastMission = mission.id;
      this.persist();
    }
    // "New:" hints and tips only for what this mission really unlocks for this player (owner, 2026-11-09); what the
    // player has unlocked counts every offered campaign.
    const p = this.progress();
    const shown = campaign ? withNews(mission, newsFor(this.save, p.all, p.progressed, mission)) : mission;
    const played = armoury && campaign ? applyRoster(shown, missionRoster(this.save, mission, p.unlocked)) : shown;
    this.launched = { mission, armoury };
    this.lastMedals = null;
    const battle = createBattle({
      mission: played,
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
    // Guided tips belong to the campaign and to Basic Training: the proving ground and a bot at the controls need none.
    this.tutorial = (campaign || isTraining(mission)) && !this.autopilot ? new Tutorial(shown, this.tips) : null;
    this.session = new BattleSession(battle, difficulty, seed, this.view, this.audio, {
      hints: () => this.save.settings.hints,
      sound: () => this.loop.timeScale <= APP.soundMaxTimeScale,
      onEnded: () => this.battleEnded(),
      tutorial: this.tutorial,
    });
    this.pendingResult = null;
    this.lastResult = null;
    this.loop.reset();
    this.fps.reset();
    // A new battle always starts at normal speed; only the debug hooks change it.
    this.loop.timeScale = 1;
    // The battle music: the map track and the menu theme let go of their buffers (only the mission's music is held in
    // a battle), and the mission's track, rendered before the battle (loadMission), starts. Nothing renders from here
    // on: a battle started without a load (the debug hooks) plays without music.
    this.audio.releaseMusic(this.mapTrack);
    if (this.mapMusic !== null && this.mapMusic !== this.mapTrack) this.audio.releaseMusic(this.mapMusic);
    this.audio.releaseMusic(MENU_MUSIC);
    this.menuReleased = true;
    this.musicIntensity = new MusicIntensity();
    this.audio.setBattleLayer('build');
    this.loadToken++;
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
      this.tutorial = null;
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
    let medals: MedalBreakdown | null = null;
    const training = isTraining(mission);
    const adminEnded = session.battle.state.endReason === 'admin';
    if (training && session.battle.state.winner === 0 && !adminEnded) {
      // Basic Training is no campaign mission: its first finish is recorded and pays its one-time reward.
      points = completeTraining(this.save);
      this.persist();
    }
    // Only campaign missions count: a win on the sandbox grounds must leave the save alone. So does a battle the admin
    // panel ended, and a win on a mission only the admin panel's unlock had opened.
    const ids = (this.campaignFor(mission.id)?.missions ?? []).map((m) => m.id);
    const admin = adminEnded || (this.adminUnlocked && !isUnlocked(this.save, ids, mission.id));
    if (session.battle.state.winner === 0 && ids.includes(mission.id) && !admin) {
      recordClear(this.save, mission.id, session.difficulty);
      const s = session.battle.state;
      const hq = s.sides[0].hq;
      const guarded = missionMedals(mission.id).structureWeight;
      medals = recordWin(this.save, mission, session.difficulty, {
        seconds: s.time,
        lost: s.sides[0].stats.lost,
        hqFrac: hq && hq.maxHp > 0 ? Math.max(0, hq.hp) / hq.maxHp : 0,
        // The mission director's figures: side objectives, kills by kind, phase times, a defended building.
        ...directorScore(s),
        ...(guarded ? { structureFrac: structureHealth(s, guarded.ref) } : {}),
      });
      points = medals.medals;
      this.lastMedals = medals;
      this.persist();
    }
    // The sting was played with the battleEnded event if sound was on; either way the layers fade out now.
    this.audio.endBattleMusic(session.battle.state.winner === 0, false);
    const result = buildResult(session.battle, session.difficulty, points, training ? null : nextMissionId(ids, mission.id), medals);
    if (training) result.training = true;
    this.pendingResult = result;
    this.lastResult = result;
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
    const darkness = this.adminDarkness ?? (timer && timer.onExpire === 'lose' ? Math.min(1, Math.max(0, timer.progress)) : 0);
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
    state.fps = this.save.settings.showFps ? this.fps.state : null;
    // The music's prep layer plays while the prep phase runs.
    this.musicIntensity?.setPrep(state.prep !== null);
    if (this.ui && this.ui.current() === 'battle') this.ui.updateHud(state);
  }

  /** Debug: the music's prep layer on or off (the battle sets it from the prep phase every frame). */
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

  /** How the save's progress stands, over every offered campaign (what is unlocked counts all of them). */
  private progress(): ReturnType<typeof progressOf> {
    return progressOf(
      this.save,
      this.missions,
      this.unlockedAll,
      this.offered.map((c) => c.missions),
    );
  }

  campaign(): CampaignView {
    const c = this.current;
    const def = CAMPAIGNS[c.id];
    const view = buildCampaignView(this.save, c.missions, this.upgradeDefs, this.unlockedAll, def.nation, this.offered.map((o) => o.missions));
    view.campaignId = c.id;
    view.campaignTitle = def.title;
    view.map = def.map;
    view.campaigns = buildCampaignCards(this.save, this.offered, c.id);
    return view;
  }

  /**
   * Render a mission's battle music: the briefing starts it when it opens and its Begin waits on the opening calm layer
   * only (the rest renders during the battle), as do the result screen's Replay and the title's Basic Training.
   * Resolves true when the battle may start (the calm layer is in, the music could not be made, or it took over
   * MUSIC_BATTLE.render.loadTimeoutMs, and then the battle starts without it); false when the load was let go of first
   * (back to the map) or a later call took over. Never rejects. The track already held (a replay, a restart) resolves
   * at once. `onProgress` hears 0..1 (1 once the calm layer is in).
   */
  loadMission(id: number, onProgress?: (fraction: number) => void): Promise<boolean> {
    const mission = id === BASIC_TRAINING_ID ? trainingMission() : this.campaignFor(id)?.missions.find((m) => m.id === id);
    if (!mission) return Promise.resolve(true);
    const token = ++this.loadToken;
    const report = onProgress ? (ready: number, total: number): void => onProgress(total > 0 ? Math.min(1, ready / total) : 1) : undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, MUSIC_BATTLE.render.loadTimeoutMs);
    });
    // The whole track renders; the start waits only for its opening calm layer (owner, 2026-11-09, DECISIONS 406).
    const all = this.audio.loadBattleMusic(mission.music, report && ((ready) => report(Math.min(ready, 1), 1)));
    const music = Promise.race([all, this.audio.battleMusicStartable(mission.music)]).then(
      () => undefined,
      () => undefined,
    );
    return Promise.race([music, timeout]).then(() => {
      clearTimeout(timer);
      return token === this.loadToken;
    });
  }

  /** Start a campaign mission on a difficulty. The difficulty is remembered as the one the briefing starts on. */
  startMission(id: number, difficulty: Difficulty): void {
    // Replaying Basic Training from its result screen.
    if (id === BASIC_TRAINING_ID) {
      this.startTraining();
      return;
    }
    const chosen = DIFFICULTY_LIST.includes(difficulty) ? difficulty : this.save.settings.difficulty;
    if (this.campaignFor(id) === null) return;
    if (this.save.settings.difficulty !== chosen) {
      this.save.settings.difficulty = chosen;
      this.persist();
    }
    this.beginMission(id, chosen, this.newSeed(), true);
  }

  /**
   * Start Basic Training, the standalone tutorial: its own training ground, outside every campaign, played as the
   * nation of the campaign on the map (the one last chosen or played), always on Normal.
   */
  startTraining(): void {
    this.launch(trainingMission(CAMPAIGNS[this.current.id].nation), BASIC_TRAINING_DIFFICULTY, this.newSeed());
  }

  /** The player turned down the Basic Training offer on the title screen: it is not offered again (the button stays). */
  skipTraining(): void {
    if (this.save.training.skipped) return;
    this.save.training.skipped = true;
    this.persist();
    this.ui?.refresh();
  }

  // --- debug hooks (src/app/debug.ts) -----------------------------------------

  /** Open every mission on the map. Records nothing: clears, points and the save stay as they are. */
  unlockAll(): void {
    this.unlockedAll = true;
    this.ui?.refresh();
  }

  /**
   * The admin panel's unlock: every campaign (the unreleased ones too) and every mission open for this session, and
   * nothing about it written to the save.
   */
  adminUnlockMissions(): void {
    this.adminUnlocked = true;
    this.unlockAll();
  }

  /** True while every mission is open (the admin panel or the debug hook unlocked them). */
  get missionsUnlocked(): boolean {
    return this.unlockedAll;
  }

  /** Start the current battle again from the top on another difficulty (the admin panel). */
  restartOn(difficulty: Difficulty): void {
    const session = this.session;
    if (!session) return;
    const again = this.launched ?? { mission: session.mission, armoury: false };
    this.launch(again.mission, difficulty, this.newSeed(), again.armoury);
  }

  /** Take in a save that sanitizeSave has already checked (the admin panel's import): stored, applied and shown. */
  replaceSave(data: SaveData): void {
    this.save = data;
    this.persist();
    this.applySettings();
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

  /** Buy a unit type or plane call-in in the Armoury with medals. */
  buyArmoury(id: string): void {
    if (buyItem(this.save, id)) this.persist();
  }

  refundUpgrade(id: string): void {
    if (refundUpgrade(this.save, id, this.upgradeDefs)) this.persist();
  }

  refundAll(): void {
    refundAll(this.save, this.upgradeDefs);
    this.persist();
  }

  /** Debug: give medals (a negative number takes them, never below zero). Returns the new balance. */
  giveMedals(n: number): number {
    const balance = addMedals(this.save, n);
    this.persist();
    this.ui?.refresh();
    return balance;
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
      case 'showBlood':
        this.view.setShowBlood(settings.showBlood);
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
        if (this.session) {
          const again = this.launched ?? { mission: this.session.mission, armoury: false };
          this.launch(again.mission, this.session.difficulty, this.newSeed(), again.armoury);
        }
        return;
      case 'quit': {
        // Basic Training is started from the title screen, so quitting it goes back there.
        const training = this.session !== null && isTraining(this.session.mission);
        this.endSession();
        this.ui?.show(training ? 'title' : 'campaign');
        return;
      }
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

