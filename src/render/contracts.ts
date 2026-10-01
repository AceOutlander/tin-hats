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
import type { Battle } from '../sim';

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
  /** Game objects in the scene (all layers) and how many are visible. */
  images: number;
  imagesVisible: number;
  /** Live effect counts. */
  tracers: number;
  particles: number;
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
  /** False while fast-forwarding: skip tracers, flashes and particles. */
  setEffectsEnabled(enabled: boolean): void;
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
