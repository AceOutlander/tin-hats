/**
 * Battlefield effects. EffectsSystem owns the particle system (src/fx) drawn
 * with pooled images, tracers, ground decals, projectile flights, aircraft and
 * parachutes, markers and floating text, screen shake, the ambient effects that
 * follow the battle's state (footsteps, fires, smoke clouds) and the sound
 * director. Events reach it through EFFECT_HANDLERS (./handlers).
 *
 * Everything is pooled and capped; low-priority effects thin out under load.
 * With `enabled` false (fast-forward) events are ignored and nothing is drawn.
 */
import type Phaser from 'phaser';
import { FX_LAYERS } from '../../data/fx';
import { RENDER } from '../../data/render';
import { type QualityLevel, RENDER_PERF } from '../../data/renderPerf';
import { VIEW } from '../../data/view';
import { createRng, createShake, mixSeed, ParticleSystem, type Rng01, type ScreenShake, shakeStrength } from '../../fx';
import type { BattleState, SimEvent } from '../../sim';
import type { SpriteRegistry } from '../atlas';
import type { Layers } from '../layers';
import type { StructureViews } from '../structures';
import { burstDensity } from '../quality';
import type { UnitViews } from '../units';
import { Ambient } from './ambient';
import { DecalPool } from './decals';
import { FlightPool } from './flights';
import { EFFECT_HANDLERS, explodeAt } from './handlers';
import { Floaters, OrderMarkers, TargetMarkers } from './markers';
import { ParticleDrawer } from './particles';
import { PRESET_DEFS, type PresetId } from './presets';
import { SkyPool } from './sky';
import { SoundDirector } from './sound';
import { TracerPool } from './tracers';

export { EFFECT_HANDLERS, type EffectHandler } from './handlers';
export { ParticleDrawer } from './particles';
export { TracerPool } from './tracers';

const R = RENDER.fx;
const SEED_SALT = 0x3f1a9d;

export interface Point {
  x: number;
  y: number;
}

const GUN = { x: 0, y: 0, dir: 1 };

/** Index of the pillbox of `side` nearest to x (shot events do not name the firing pillbox); -1 if none. */
export function pillboxAt(state: BattleState, side: number, x: number): number {
  let best = -1;
  let bestD = Infinity;
  const pbs = state.pillboxes;
  for (let i = 0; i < pbs.length; i++) {
    if (pbs[i].side !== side) continue;
    const d = Math.abs(pbs[i].x - x);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Everything an effect handler may use. */
export class EffectContext {
  readonly particles: ParticleSystem<PresetId>;
  readonly tracers: TracerPool;
  readonly shake: ScreenShake;
  readonly decals: DecalPool;
  readonly flights: FlightPool;
  readonly sky: SkyPool;
  readonly orderMarkers: OrderMarkers;
  readonly targetMarkers: TargetMarkers;
  readonly floaters: Floaters;
  readonly sound = new SoundDirector();
  readonly ambient: Ambient;
  /** The view's own random numbers (reseeded per battle). */
  readonly rng: Rng01 = () => this.source();
  /** Scratch points for handlers (never keep references to them). */
  readonly p0: Point = { x: 0, y: 0 };
  readonly p1: Point = { x: 0, y: 0 };
  readonly p2: Point = { x: 0, y: 0 };
  /** The battle being shown (null when detached). */
  state: BattleState | null = null;
  /** The side the local player commands. */
  playerSide = 0;
  /** World x of the view edges this frame. */
  camLeft = 0;
  camRight = 0;
  /** Effect time (battle seconds) and the id of the sim step being handled (for deduplicating events of one step). */
  time = 0;
  stepId = 0;
  /** How dark the scene is, 0..1 (flash glows appear as it gets dark). */
  night = 0;
  /** Smoothed real frame time (s), for thinning low-priority effects under load. */
  frameTime = 0;
  /** The effect level the frame-time governor has chosen (set by the view each frame). */
  quality: QualityLevel = RENDER_PERF.quality.levels[0];
  /** Time (effect seconds) each HQ was ruined, or -1. */
  readonly ruinedAt: [number, number] = [-1, -1];

  private source: Rng01;
  private tracerTick = 0;

  constructor(
    readonly scene: Phaser.Scene,
    readonly layers: Layers,
    readonly reg: SpriteRegistry,
    readonly units: UnitViews,
    readonly structures: StructureViews,
  ) {
    this.source = createRng(1);
    // The pool is exactly as big as the best level's hard cap: nothing can ever grow past it.
    this.particles = new ParticleSystem<PresetId>(this.rng, RENDER_PERF.quality.levels[0].hardCap, PRESET_DEFS);
    this.tracers = new TracerPool(scene, layers.lit, reg);
    this.shake = createShake();
    this.decals = new DecalPool(scene, layers.byName.groundDecals, reg);
    this.flights = new FlightPool(scene, layers.byName.projectiles, reg);
    this.sky = new SkyPool(scene, layers, reg);
    this.orderMarkers = new OrderMarkers(scene, layers, reg);
    this.targetMarkers = new TargetMarkers(scene, layers, reg);
    this.floaters = new Floaters(scene, layers, reg);
    this.ambient = new Ambient(this);
  }

  /** Restart the random source for a new battle. */
  seed(visualSeed: number): void {
    this.source = createRng(mixSeed(visualSeed, SEED_SALT));
  }

  /** Ground line (feet) of a depth row; row -1 = the middle of the band. */
  groundY(row: number): number {
    return row >= 0 && row < VIEW.rows ? VIEW.groundY + VIEW.rowDy[row] : VIEW.groundY;
  }

  /** True if the span [min(a,b), max(a,b)] touches the view (with a margin). */
  onScreen(a: number, b: number): boolean {
    const m = RENDER.unit.cullMargin;
    return Math.max(a, b) > this.camLeft - m && Math.min(a, b) < this.camRight + m;
  }

  /**
   * False when the particle pool is crowded, the frame rate is poor or the quality level is low: dust, casings and
   * exhaust then stop (partly or fully).
   */
  lowOk(): boolean {
    const q = this.quality;
    if (this.particles.count >= q.softCap) return false;
    if (q.lowShare < 1 && this.rng() >= q.lowShare) return false;
    const f = this.frameTime;
    if (f <= R.slowFrame) return true;
    if (f >= R.stopFrame) return false;
    return this.rng() < 1 - (f - R.slowFrame) / (R.stopFrame - R.slowFrame);
  }

  /**
   * Play a particle preset at (x, y): spawns it, adds the screen shake the preset asks for
   * (weaker the further the blast is off screen) and lays its ground decal.
   * @param dirX,dirY direction for presets that aim along it
   * @param ground ground line for particles that land
   * @param size scales particles, speeds, shake and decal
   */
  play(id: PresetId, x: number, y: number, dirX = 1, dirY = 0, ground: number = VIEW.groundY, size = 1): void {
    // Hard cap: past the soft cap bursts shrink the fuller the pool gets, at the hard cap nothing spawns (the shake
    // and the decal below still happen).
    const density = burstDensity(this.quality, this.particles.count);
    if (density > 0) {
      this.particles.density = density;
      this.particles.spawn(id, x, y, dirX, dirY, ground, size);
    }
    const def = PRESET_DEFS[id];
    if (def.shake) this.shake.add(def.shake, shakeStrength(x, this.camLeft, this.camRight - this.camLeft) * Math.min(1.4, Math.max(0.7, size)));
    if (def.decal) this.decals.add(def.decal, x, ground, (def.decalScale ?? 1) * size);
  }

  /** True if this tracer should be drawn: the quality level may thin them out (every Nth is kept). Shots and hits still happen. */
  keepTracer(): boolean {
    const every = this.quality.tracerEvery;
    if (every <= 1) return true;
    this.tracerTick = (this.tracerTick + 1) % every;
    return this.tracerTick === 0;
  }

  /** Muzzle of a shot event's shooter (the drawn pose when it can), into out. */
  shotOrigin(e: SimEvent, out: Point): void {
    if (e.source === 'unit') {
      const v = this.units.liveView(e.unit, e.unitId);
      if (v && v.shown) {
        v.muzzle(out);
        return;
      }
    } else if (e.source === 'hq') {
      if (this.structures.hqGun(e.side, GUN)) {
        out.x = GUN.x;
        out.y = GUN.y;
        return;
      }
    } else if (e.source === 'pillbox' && this.state) {
      const pb = this.state.pillboxes[pillboxAt(this.state, e.side, e.x)];
      if (pb) {
        this.structures.pillboxGun(pb.side, pb.x, GUN);
        out.x = GUN.x;
        out.y = GUN.y;
        return;
      }
    }
    const row = e.row >= 0 ? e.row : 1;
    out.x = e.x;
    out.y = this.groundY(row) - RENDER.shots.muzzleY * VIEW.rowScale[row];
  }

  /** Where a shot event's round ends: the target's body, or the dirt beside it on a miss. */
  shotTarget(e: SimEvent, out: Point): void {
    const S = RENDER.shots;
    const dir = e.dir === 0 ? 1 : e.dir;
    if (e.target === 'hq') {
      out.x = e.x2;
      out.y = VIEW.groundY - S.hqHitY * (1 + (this.rng() * 2 - 1) * S.hqHitSpread);
      return;
    }
    // Row -1 (a structure target): land on one of the middle rows.
    const row = e.row2 >= 0 ? e.row2 : 1 + Math.floor(this.rng() * 2);
    const gy = this.groundY(row);
    if (!e.hit) {
      out.x = e.x2 + dir * (S.missMin + this.rng() * S.missSpread);
      out.y = gy + (this.rng() - 0.5) * S.missDy;
      return;
    }
    const k = S.hitLow + this.rng() * (S.hitHigh - S.hitLow);
    out.x = e.x2;
    out.y = gy - VIEW.figureHeight * VIEW.rowScale[row] * k;
    if (e.target === 'unit') {
      // Aim at the body as drawn (it may stand a little off its sim x, or sit in a trench).
      const v = this.units.viewAtSlot(e.targetIndex);
      if (v && v.row === row && Math.abs(v.simX - e.x2) < RENDER.unit.xJitter * 2) {
        out.x = v.x;
        out.y = v.y + v.sink - v.bodyH * v.s * k;
      }
    }
  }
}

export class EffectsSystem {
  readonly ctx: EffectContext;
  private readonly drawer: ParticleDrawer;
  enabled = true;

  /** Smoke puffs behind a flight and the blast of a provisional one, as callbacks made once. */
  private readonly trailCb = (id: PresetId, x: number, y: number, dx: number, dy: number): void => {
    this.ctx.play(id, x, y, dx, dy, y);
  };
  private readonly landCb = (x: number, y: number, weaponId: string): void => {
    explodeAt(this.ctx, x, y, weaponId);
  };

  constructor(scene: Phaser.Scene, layers: Layers, reg: SpriteRegistry, units: UnitViews, structures: StructureViews) {
    this.ctx = new EffectContext(scene, layers, reg, units, structures);
    const targets: Phaser.GameObjects.Layer[] = [];
    for (const l of FX_LAYERS) {
      targets.push(l.name === 'ground' ? layers.byName.shadows : l.name === 'smokeScreen' ? layers.byName.smokeScreen : l.additive ? layers.glow : layers.byName.effects);
    }
    targets.push(layers.lit);
    this.drawer = new ParticleDrawer(scene, targets, reg);
  }

  /** Start handling a new sim step's events (call once before the events of each battle.step()). */
  beginStep(): void {
    this.ctx.stepId++;
  }

  /** Run the dispatch table for one event (only while enabled). */
  handle(e: SimEvent): void {
    if (!this.enabled) return;
    const h = EFFECT_HANDLERS[e.type];
    if (h) h(this.ctx, e);
  }

  /**
   * Advance everything by dt battle seconds (0 while paused). realDt is the real frame time, which
   * decides how much low-priority detail is affordable.
   */
  update(dt: number, realDt: number): void {
    const ctx = this.ctx;
    ctx.frameTime += (realDt - ctx.frameTime) * R.frameSmoothing;
    ctx.shake.update(dt);
    if (!this.enabled) {
      ctx.sound.tanks(0, dt);
      return;
    }
    ctx.time += dt;
    if (ctx.state && dt > 0) ctx.ambient.update(ctx, ctx.state, dt);
    if (dt > 0) {
      ctx.particles.update(dt);
      ctx.tracers.update(dt);
      ctx.flights.update(dt, this.trailCb, this.landCb);
      ctx.sky.update(dt, ctx);
      ctx.decals.update(dt);
      ctx.orderMarkers.update(dt);
      ctx.targetMarkers.update(dt, VIEW.groundY);
      ctx.floaters.update(dt);
    }
    ctx.sound.tanks(ctx.ambient.tanksNear, dt);
    const m = RENDER.unit.cullMargin;
    this.drawer.draw(ctx.particles, ctx.camLeft - m, ctx.camRight + m);
  }

  clear(): void {
    const ctx = this.ctx;
    ctx.particles.clear();
    ctx.tracers.clear();
    ctx.decals.clear();
    ctx.flights.clear();
    ctx.sky.clear();
    ctx.orderMarkers.clear();
    ctx.targetMarkers.clear();
    ctx.floaters.clear();
    ctx.ambient.clear();
    ctx.ruinedAt[0] = -1;
    ctx.ruinedAt[1] = -1;
    this.drawer.hideAll();
  }

  particleCount(): number {
    return this.drawer.count();
  }
}
