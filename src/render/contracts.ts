/**
 * Public contract of the battlefield renderer. The app owns the game loop:
 *
 *   const view = await createBattleView(parentElement);
 *   view.attach(battle, { playerSide: 0, visualSeed: 7 });
 *   view.setFrameHandler((dtMs) => {
 *     // fixed-step accumulator: for each sim step
 *     battle.step(); view.afterStep();
 *     // then once per frame
 *     view.render(accumulator / DT, dtMs / 1000);
 *   });
 *
 * The handler runs inside the Phaser scene update, right before Phaser draws
 * the frame. Coordinates: world units (wu) for the battlefield, CSS px for
 * anything on screen (unitScreenPos, taps).
 */
import type { Side, SupportKind } from '../data/schema';
import type { MenuStormState } from '../fx';
import type { Battle } from '../sim';
import type { HpReveal } from './hpReveal';

/** What the title storm scene is drawing, for the debug hooks and the tests. */
export interface MenuSceneStats {
  shown: boolean;
  /** Streaks falling per layer, back to front (behind the trees, in front of the field, nearest). */
  drops: number[];
  /** Splashes on the grass right now. */
  splashes: number;
  /** Share of the rain drawn (1 = all): the quality governor and the load guard thin it when frames are slow. */
  rainShare: number;
  /** World position of the spire's tip (x on screen = (spireX - camera left) in wu). */
  spireX: number;
  spireY: number;
  /** True while a fork is drawn. */
  forkDrawn: boolean;
  /** Opacity of the light over the sky right now. */
  skyFlash: number;
}

export type WeatherMode = 'auto' | 'rain' | 'clear';

export interface AttachOptions {
  /** The side the local player commands: picking only returns its units. */
  playerSide: Side;
  /** Visual weather; the full weather pass reads it (default 'auto'). */
  weather?: WeatherMode;
  /** Seed for everything purely visual (backdrop details, animation variety, effects). */
  visualSeed: number;
}

/** What a tap on the battlefield is for while a support is being aimed. */
export type TargetingKind = SupportKind;

/**
 * The part of the audio engine (src/audio GameAudio) the view uses. A GameAudio fits it as it is:
 * `view.setAudio(audio)`. The view works with no sink set.
 */
export interface AudioSink {
  play(name: string, opts?: { pan?: number; volume?: number; pitch?: number }): void;
  playAt(name: string, worldX: number, opts?: { volume?: number; pitch?: number }): void;
  startLoop(name: string, volume?: number): void;
  stopLoop(name: string): void;
  setListener(centerX: number, viewWidth: number): void;
}

/** What the weather did so far, for the debug hooks and the tests. */
export interface WeatherStats {
  /** True while rain is falling in this battle. */
  raining: boolean;
  /** Thunder checks made since the weather was decided (one per full 2 s of battle time while raining). */
  checksMade: number;
  /** Lightning strikes since then, natural and forced. */
  strikes: number;
}

export interface BattleCamera {
  /** World x at the centre of the view. */
  readonly centerX: number;
  /** World units visible across the view (heightWu x aspect ratio). */
  readonly viewWidthWu: number;
  /** Move the view centre (clamped to the map). Glides there unless `immediate`. */
  setCenter(x: number, immediate?: boolean): void;
  /** Centre the view at this fraction (0..1) of the map length, immediately (minimap tap or drag). */
  jumpToFrac(f: number): void;
}

export interface RenderStats {
  /** Frames per second measured by Phaser's loop. */
  fps: number;
  /** Smoothed JS milliseconds spent in render() (layout of every view, not Phaser's own draw). */
  renderMs: number;
  /** Smoothed JS milliseconds spent in afterStep(). */
  afterStepMs: number;
  /** Unit views alive (including dying bodies) and how many were laid out this frame (on screen). */
  unitViews: number;
  unitViewsDrawn: number;
  /** Blood pools on the ground now (at most RENDER.blood.maxPools), and the gunfire deaths of soldiers this battle (pools or not). */
  bloodPools: number;
  bloodDeaths: number;
  /** Blood pools drawn last frame (on screen). */
  bloodDrawn: number;
  /** Health pips drawn last frame over the player's own units and over the enemy's (0 unless enemy health is revealed). */
  pipsOwn: number;
  pipsEnemy: number;
  /** Game objects in the scene (all layers) and how many are visible. */
  images: number;
  imagesVisible: number;
  /** Live effect counts. */
  tracers: number;
  /** Particle images drawn last frame. */
  particles: number;
  /** Particles alive in the system (drawn or waiting out a delay). */
  particlesLive: number;
  /** Effect quality level chosen by the frame-time governor: 0 = full, higher = thinner effects. */
  quality: number;
  /** Atlas pages and their total texture pixels; backdrop texture pixels. */
  atlasPages: number;
  atlasPixels: number;
  backdropPixels: number;
  /** Canvas size in device pixels and the device pixel ratio in use. */
  canvasW: number;
  canvasH: number;
  dpr: number;
}

export interface BattleView {
  /** Show a battle. Rebuilds the backdrop textures if the theatre or time of day changed. */
  attach(battle: Battle, opts: AttachOptions): void;
  /** Stop showing the current battle and recycle every view. */
  detach(): void;
  /** The app's per-frame callback (dtMs = real milliseconds since the last frame). Pass null to clear. */
  setFrameHandler(fn: ((dtMs: number) => void) | null): void;
  /** Consume battle.events of the step that just ran. Call after EVERY battle.step(). */
  afterStep(): void;
  /**
   * Draw: alpha = 0..1 interpolation between the last two sim steps; dtSeconds = frame time in battle seconds
   * (real time x time scale, 0 while paused) that drives animation and effects. The camera always uses real time.
   */
  render(alpha: number, dtSeconds: number): void;
  readonly camera: BattleCamera;
  /** Tap on a friendly unit (its unique id), or on the ground (world x). */
  onTapUnit: ((unitId: number) => void) | null;
  onTapGround: ((worldX: number) => void) | null;
  /** Mark the directly controlled unit (or -1 for none). */
  setControlled(unitId: number): void;
  /** Show the support targeting reticle (taps then always report the ground), or null to leave targeting. */
  setTargeting(kind: TargetingKind | null): void;
  /** False while fast-forwarding: skip tracers, flashes, particles, rain streaks and sounds. */
  setEffectsEnabled(enabled: boolean): void;
  /** Sound for the battle's events (shots, blasts, deliveries, orders, rain, thunder, tank engines); null for silence. */
  setAudio(audio: AudioSink | null): void;
  /** Night tint: 0 = the mission's own time of day, 1 = full night (mission 5 slides from dusk to night). */
  setDarkness(darkness: number): void;
  /** Debug: make it rain or clear up now (restarts the thunder checks). */
  forceWeather(mode: 'rain' | 'clear'): void;
  /** Debug: a lightning strike now (flash, then thunder after its delay), rain or not. */
  forceThunder(): void;
  weatherStats(): WeatherStats;
  /** "Reduce flashing": lightning in battle and on the title screen only swells into a slow soft glow, with no bolt. */
  setReducedFlashing(on: boolean): void;
  /**
   * Whose unit health the player sees (own units yes, the enemy's no, by default). The Recon plane and the admin panel
   * reveal enemy health through it: setEnemyShown(on) for the whole side, revealEnemy(x, radius, seconds) for an area.
   * attach() resets it to the data defaults (RENDER.hpReveal).
   */
  readonly hpReveal: HpReveal;
  /** "Show blood": a small dark pool under each soldier killed by gunfire. Off removes every pool at once and starts no more. */
  setShowBlood(on: boolean): void;
  /**
   * The title screen's storm scene (src/render/weather/menuStorm.ts): on puts up the French fields under a storm light
   * (building the backdrop when a battle replaced it), off takes it down. A battle attach takes it down too.
   */
  setMenuScene(on: boolean): void;
  /**
   * Draw one frame of the title storm while no battle is attached. `dt` = storm seconds advanced (0 while it is paused
   * or frozen: nothing moves), `fade` 0..1 scales the rain and the light (for the fade in and out).
   */
  renderMenu(storm: MenuStormState, dt: number, fade: number): void;
  menuStats(): MenuSceneStats;
  /**
   * Where a unit is drawn (body centre), in CSS px from the parent element's top-left corner; null if it is not
   * on screen. Returns a shared object: read it before the next call.
   */
  unitScreenPos(unitId: number): { x: number; y: number } | null;
  getStats(): RenderStats;
  /** Re-measure the parent element (called automatically on window resize and orientation change). */
  resize(): void;
  destroy(): void;
}
