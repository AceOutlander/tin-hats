/**
 * Battlefield effects: a particle system (src/fx) drawn with pooled images,
 * pooled tracers, and the event dispatch table in ./handlers.
 *
 * The full effects pass (explosions, projectiles, decals, weather, audio)
 * extends EFFECT_HANDLERS and may add its own pools here; everything it needs
 * is on the EffectContext.
 */
import type Phaser from 'phaser';
import { FX_LAYERS } from '../../data/fx';
import { RENDER } from '../../data/render';
import { VIEW } from '../../data/view';
import { createParticles, createRng, type ParticleSystem, type Rng01 } from '../../fx';
import type { BattleState, SimEvent } from '../../sim';
import type { SpriteRegistry } from '../atlas';
import type { Layers } from '../layers';
import type { StructureViews } from '../structures';
import type { UnitViews } from '../units';
import { EFFECT_HANDLERS } from './handlers';
import { ParticleDrawer } from './particles';
import { TracerPool } from './tracers';

export { EFFECT_HANDLERS, type EffectHandler } from './handlers';
export { ParticleDrawer } from './particles';
export { TracerPool } from './tracers';

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
  readonly particles: ParticleSystem;
  readonly tracers: TracerPool;
  readonly rng: Rng01;
  /** Scratch points for handlers (never keep references to them). */
  readonly p0: Point = { x: 0, y: 0 };
  readonly p1: Point = { x: 0, y: 0 };
  readonly p2: Point = { x: 0, y: 0 };
  /** The battle being shown (null when detached). */
  state: BattleState | null = null;
  /** World x of the view edges this frame. */
  camLeft = 0;
  camRight = 0;

  constructor(
    readonly scene: Phaser.Scene,
    readonly layers: Layers,
    readonly reg: SpriteRegistry,
    readonly units: UnitViews,
    readonly structures: StructureViews,
  ) {
    this.rng = createRng(1);
    this.particles = createParticles(this.rng);
    this.tracers = new TracerPool(scene, layers.byName.projectiles, reg);
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
      if (v && v.row === row && Math.abs(v.x - v.jitter - e.x2) < RENDER.unit.xJitter * 2) {
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

  constructor(scene: Phaser.Scene, layers: Layers, reg: SpriteRegistry, units: UnitViews, structures: StructureViews) {
    this.ctx = new EffectContext(scene, layers, reg, units, structures);
    const targets: Phaser.GameObjects.Layer[] = [];
    for (const l of FX_LAYERS) {
      targets.push(l.name === 'ground' ? layers.byName.shadows : l.name === 'smokeScreen' ? layers.byName.smokeScreen : l.additive ? layers.glow : layers.byName.effects);
    }
    this.drawer = new ParticleDrawer(scene, targets, reg);
  }

  /** Run the dispatch table for one event (only while enabled). */
  handle(e: SimEvent): void {
    if (!this.enabled) return;
    const h = EFFECT_HANDLERS[e.type];
    if (h) h(this.ctx, e);
  }

  update(dt: number): void {
    this.ctx.particles.update(dt);
    this.ctx.tracers.update(dt);
    this.drawer.draw(this.ctx.particles);
  }

  clear(): void {
    this.ctx.particles.clear();
    this.ctx.tracers.clear();
    this.drawer.hideAll();
  }

  particleCount(): number {
    return this.drawer.count();
  }
}
