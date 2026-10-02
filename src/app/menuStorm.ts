/**
 * Runs the title screen's storm: the timing (src/fx/menuStorm.ts), the picture (view.renderMenu), the rain bed and
 * the thunder (the audio engine) and the drops on the panel (the UI). The menu theme (src/data/music.ts) shares its
 * life: it starts and stops with the storm.
 *
 * - It runs while the title is up, and keeps running behind Settings opened from the title, so the volume sliders
 *   can be heard against it. Anything else (campaign map, briefing, battle) stops it with a short fade.
 * - While the page is away (tab hidden, window blurred, page put away) nothing advances: the picture freezes and the
 *   app suspends the audio.
 * - The debug hooks can freeze it and step it by hand, so a picture can be taken exactly mid-flash.
 */
import type { GameAudio } from '../audio';
import { MENU_STORM } from '../data/menuStorm';
import type { MusicTrackName } from '../data/music';
import { MenuStorm, PanelDrops } from '../fx';
import type { BattleView } from '../render/contracts';
import type { UiApi } from '../ui/contracts';

/** The storm's own random seed (the title is the same storm every time; only its time moves on). */
const STORM_SEED = 0x7135;
/** The track the title plays (src/data/music.ts). */
export const MENU_MUSIC: MusicTrackName = 'menu';
/** Longest real frame the storm advances by: a long stall does not unleash a burst of flashes. */
const MAX_FRAME = 0.25;
/** Step used when the debug hooks advance a frozen storm by hand. */
const ADVANCE_STEP = 1 / 60;

export interface MenuStormStats {
  running: boolean;
  /** Frozen because the page is away (hidden, blurred). */
  paused: boolean;
  /** Frozen by the debug hooks. */
  frozen: boolean;
  /** 0..1: the fade in and out. */
  fade: number;
  /** Storm seconds advanced so far. */
  time: number;
  flashes: number;
  forks: number;
  thundersScheduled: number;
  thundersPlayed: number;
  /** Rumbles the audio engine actually synthesised (none while muted or before the first touch). */
  thundersHeard: number;
  /** Sky and fork brightness now, 0..1. */
  flash: number;
  fork: number;
  reduced: boolean;
  /** The thunder made for the last flash. */
  lastThunder: { delay: number; loudness: number; length: number };
  /** Rain streaks falling per layer (back to front), splashes on the grass, drops on the panel. */
  drops: number[];
  splashes: number;
  panelDrops: number;
  /** The scene: whether it is up, a fork drawn, the sky light's opacity, where the spire is. */
  scene: { shown: boolean; forkDrawn: boolean; skyFlash: number; rainShare: number; spireX: number; spireY: number };
  /** The mix: bus gains, the rain bed's fade and its level after the Ambience bus, the output RMS, muted. */
  audio: { music: number; ambience: number; sfx: number; bedOn: boolean; bed: number; rain: number; output: number; muted: boolean; state: string };
}

export class MenuStormDirector {
  readonly logic = new MenuStorm(STORM_SEED);
  readonly drops = new PanelDrops(STORM_SEED);
  running = false;
  /** Debug: false keeps the storm off (for before-and-after measurements). */
  enabled = true;
  /** The page is away: nothing advances. */
  away = false;
  /** Debug: frozen by hand. */
  frozen = false;
  private fading = false;
  private fade = 0;
  /** Storm time stepped by hand that the picture has not moved by yet. */
  private pendingDt = 0;

  constructor(
    private readonly view: BattleView,
    private readonly audio: GameAudio,
    private readonly ui: () => UiApi | null,
  ) {}

  /** The title is up: the storm starts (or carries on). */
  start(): void {
    if (this.running || !this.enabled) return;
    this.running = true;
    this.fading = false;
    this.view.setMenuScene(true);
    this.audio.startRainBed();
    // The menu theme shares the storm's life: on with the title (and behind Settings), off everywhere else.
    this.audio.startMusic(MENU_MUSIC);
  }

  /** The player left the title: rain and sound fade out, then the scene comes down. */
  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.fading = true;
    this.audio.stopRainBed();
    this.audio.stopMusic();
  }

  setAway(away: boolean): void {
    this.away = away;
  }

  setReduced(on: boolean): void {
    this.logic.setReduced(on);
  }

  /** One frame of the app loop with no battle attached. */
  frame(dtMs: number): void {
    if (!this.running && !this.fading) return;
    const real = Math.min(MAX_FRAME, Math.max(0, dtMs / 1000));
    const moving = this.running && !this.away && !this.frozen;
    const dt = (moving ? real : 0) + this.pendingDt;
    this.pendingDt = 0;
    if (moving) this.advanceLogic(real);
    if (this.running) {
      this.fade = Math.min(1, this.fade + real / Math.max(0.01, MENU_STORM.fadeIn));
    } else {
      this.fade = Math.max(0, this.fade - real / Math.max(0.01, MENU_STORM.fadeOut));
      if (this.fade <= 0) {
        this.fading = false;
        this.view.setMenuScene(false);
        return;
      }
    }
    this.audio.tickRainBed();
    this.view.renderMenu(this.logic, dt, this.fade);
    if (this.running) this.ui()?.updateTitleDrops(this.drops);
  }

  private advanceLogic(dt: number): void {
    const due = this.logic.update(dt);
    for (let i = 0; i < due; i++) {
      const cue = this.logic.due[i];
      this.audio.thunder(cue.loudness, cue.length);
    }
    this.drops.update(dt);
  }

  // --- debug hooks ---------------------------------------------------------

  forceFlash(fork?: boolean): void {
    this.logic.forceFlash(fork);
  }

  freeze(on: boolean): void {
    this.frozen = on;
  }

  /** Move storm time on by `seconds` (in 1/60 s steps, as frames would), whether or not it is frozen. */
  advance(seconds: number): void {
    let left = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    while (left > 1e-9) {
      const step = Math.min(ADVANCE_STEP, left);
      this.advanceLogic(step);
      this.pendingDt += step;
      left -= step;
    }
  }

  stats(): MenuStormStats {
    const s = this.logic;
    const scene = this.view.menuStats();
    const mix = this.audio.mixStats();
    let panel = 0;
    for (let i = 0; i < this.drops.count; i++) if (this.drops.alpha[i] > 0) panel++;
    return {
      running: this.running,
      paused: this.away,
      frozen: this.frozen,
      fade: this.fade,
      time: s.time,
      flashes: s.flashes,
      forks: s.forks,
      thundersScheduled: s.thundersScheduled,
      thundersPlayed: s.thundersPlayed,
      thundersHeard: mix.thunders,
      flash: s.flash,
      fork: s.fork,
      reduced: s.reduced,
      lastThunder: { delay: s.lastCue.delay, loudness: s.lastCue.loudness, length: s.lastCue.length },
      drops: [...scene.drops],
      splashes: scene.splashes,
      panelDrops: panel,
      scene: { shown: scene.shown, forkDrawn: scene.forkDrawn, skyFlash: scene.skyFlash, rainShare: scene.rainShare, spireX: scene.spireX, spireY: scene.spireY },
      audio: {
        music: mix.music,
        ambience: mix.ambience,
        sfx: mix.sfx,
        bedOn: mix.bedOn,
        bed: mix.bed,
        rain: mix.rain,
        output: mix.output,
        muted: this.audio.isMuted(),
        state: this.audio.getStats().state,
      },
    };
  }
}
