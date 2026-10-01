/**
 * Pooled particle system. Pure TypeScript: no Phaser, no DOM, its own RNG.
 *
 * Struct-of-arrays with a fixed capacity. Live particles are kept packed in
 * [0, count) in spawn order (oldest first), so the renderer can simply walk the
 * arrays. spawn() and update() allocate nothing.
 *
 * The presets it plays are data: src/data/fx.ts.
 */
import {
  FX,
  FX_LAYERS,
  FX_PRESETS,
  FX_SPRITE_KEYS,
  type FxEmitterDef,
  type FxPresetDef,
  type FxPresetId,
} from '../data/fx';
import { VIEW } from '../data/view';
import type { Rng01 } from './rng';

const TAU = Math.PI * 2;
const UP = -Math.PI / 2;

const AIM_DIR = 0;
const AIM_UP = 1;
const AIM_ANY = 2;
const AIM_SIDES = 3;

const GROUND_NONE = 0;
const GROUND_BOUNCE = 1;
const GROUND_STICK = 2;
const GROUND_DIE = 3;

const ROT_NONE = 0;
const ROT_RANDOM = 1;
const ROT_AIM = 2;
const ROT_VELOCITY = 3;

/** An emitter with every default filled in and every name turned into a number. */
interface Emitter {
  sprites: Uint16Array;
  animate: boolean;
  layer: number;
  countMin: number;
  countMax: number;
  delayMin: number;
  delayMax: number;
  lifeMin: number;
  lifeMax: number;
  aim: number;
  turnUp: number;
  spread: number;
  speedMin: number;
  speedMax: number;
  forwardMin: number;
  forwardMax: number;
  jitterX: number;
  jitterY: number;
  gravity: number;
  drag: number;
  wind: number;
  ground: number;
  bounce: number;
  friction: number;
  scaleMin: number;
  scaleMax: number;
  grow: number;
  growEase: number;
  alpha: number;
  fadeIn: number;
  fadeOut: number;
  rotation: number;
  spinMin: number;
  spinMax: number;
}

function spriteIndex(key: string): number {
  const index = FX_SPRITE_KEYS.indexOf(key);
  if (index < 0) throw new Error(`fx: unknown particle sprite "${key}"`);
  return index;
}

function layerIndex(name: string): number {
  const index = FX_LAYERS.findIndex((layer) => layer.name === name);
  if (index < 0) throw new Error(`fx: unknown layer "${name}"`);
  return index;
}

function compileEmitter(def: FxEmitterDef): Emitter {
  const aim = def.aim === 'dir' ? AIM_DIR : def.aim === 'up' ? AIM_UP : def.aim === 'any' ? AIM_ANY : AIM_SIDES;
  const ground =
    def.ground === 'bounce'
      ? GROUND_BOUNCE
      : def.ground === 'stick'
        ? GROUND_STICK
        : def.ground === 'die'
          ? GROUND_DIE
          : GROUND_NONE;
  const rotation =
    def.rotation === 'random'
      ? ROT_RANDOM
      : def.rotation === 'aim'
        ? ROT_AIM
        : def.rotation === 'velocity'
          ? ROT_VELOCITY
          : ROT_NONE;
  return {
    sprites: Uint16Array.from(def.sprites, spriteIndex),
    animate: def.spriteMode === 'animate',
    layer: layerIndex(def.layer),
    countMin: def.count[0],
    countMax: def.count[1],
    delayMin: def.delay ? def.delay[0] : 0,
    delayMax: def.delay ? def.delay[1] : 0,
    lifeMin: def.life[0],
    lifeMax: def.life[1],
    aim,
    turnUp: def.turnUp ?? 0,
    spread: def.spread,
    speedMin: def.speed[0],
    speedMax: def.speed[1],
    forwardMin: def.forward ? def.forward[0] : 0,
    forwardMax: def.forward ? def.forward[1] : 0,
    jitterX: def.jitterX ?? 0,
    jitterY: def.jitterY ?? 0,
    gravity: def.gravity ?? 0,
    drag: def.drag ?? 0,
    wind: def.wind ?? 0,
    ground,
    bounce: def.bounce ?? 0,
    friction: def.friction ?? 1,
    scaleMin: def.scale[0],
    scaleMax: def.scale[1],
    grow: def.grow ?? 1,
    growEase: def.growEase ?? 1,
    alpha: def.alpha ?? 1,
    fadeIn: def.fadeIn ?? 0,
    fadeOut: def.fadeOut ?? 0.6,
    rotation,
    spinMin: def.spin ? def.spin[0] : 0,
    spinMax: def.spin ? def.spin[1] : 0,
  };
}

/** Receives one live particle. `sprite` indexes FX_SPRITE_KEYS; `layer` indexes FX_LAYERS. */
export type FxVisitor = (
  x: number,
  y: number,
  rotation: number,
  scale: number,
  alpha: number,
  sprite: number,
  layer: number,
) => void;

export class ParticleSystem<Id extends string = FxPresetId> {
  readonly capacity: number;
  /** Live particles occupy indices [0, count), oldest first. */
  count = 0;
  /** Spawns refused because the pool was full (for the debug overlay). */
  dropped = 0;
  /** Sideways drift (wu/s) picked up by particles according to their emitter's wind share. */
  wind: number = FX.wind;
  /** Ground line used when spawn() is not given one. */
  groundY: number = VIEW.groundY;
  /**
   * Share of each emitter's particles that spawn() creates (1 = all, 0 = none). The renderer lowers it as the pool fills
   * or the frame rate drops; a burst keeps at least one particle per emitter while it is above 0.
   */
  density = 1;

  /**
   * Render state, valid for indices [0, count) after update() or spawn().
   * A particle with alpha 0 is waiting out its delay and should not be drawn.
   */
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly rotation: Float32Array;
  readonly scale: Float32Array;
  readonly alpha: Float32Array;
  /** Index into FX_SPRITE_KEYS. */
  readonly sprite: Uint16Array;
  /** Index into FX_LAYERS. */
  readonly layer: Uint8Array;

  private readonly vx: Float32Array;
  private readonly vy: Float32Array;
  private readonly spin: Float32Array;
  /** Negative while the particle waits out its delay. */
  private readonly age: Float32Array;
  private readonly life: Float32Array;
  private readonly scale0: Float32Array;
  private readonly ground: Float32Array;
  private readonly emitter: Uint16Array;
  /** Which of the emitter's sprites a 'pick' particle uses. */
  private readonly pick: Uint8Array;
  private readonly resting: Uint8Array;

  private readonly rng01: Rng01;
  private readonly emitters: Emitter[] = [];
  private readonly presetFirst: Record<string, number> = {};
  private readonly presetCount: Record<string, number> = {};
  /** Per-emitter velocity kept this frame, recomputed once per update. */
  private readonly keep: Float32Array;

  /**
   * @param presets the preset table to play; defaults to FX_PRESETS (tests pass their own)
   */
  constructor(
    rng01: Rng01,
    capacity: number = FX.capacity,
    presets: Record<Id, FxPresetDef> = FX_PRESETS as Record<string, FxPresetDef> as Record<Id, FxPresetDef>,
  ) {
    this.rng01 = rng01;
    this.capacity = capacity;
    this.x = new Float32Array(capacity);
    this.y = new Float32Array(capacity);
    this.rotation = new Float32Array(capacity);
    this.scale = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);
    this.sprite = new Uint16Array(capacity);
    this.layer = new Uint8Array(capacity);
    this.vx = new Float32Array(capacity);
    this.vy = new Float32Array(capacity);
    this.spin = new Float32Array(capacity);
    this.age = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.scale0 = new Float32Array(capacity);
    this.ground = new Float32Array(capacity);
    this.emitter = new Uint16Array(capacity);
    this.pick = new Uint8Array(capacity);
    this.resting = new Uint8Array(capacity);
    for (const id of Object.keys(presets) as Id[]) {
      const preset = presets[id];
      this.presetFirst[id] = this.emitters.length;
      this.presetCount[id] = preset.emitters.length;
      for (const def of preset.emitters) this.emitters.push(compileEmitter(def));
    }
    this.keep = new Float32Array(this.emitters.length);
  }

  /**
   * Play a preset at (x, y).
   * @param dirX,dirY direction for emitters that aim along it (barrel, facing, blow); need not be normalised
   * @param groundY ground line for bounce, stick and die; defaults to this.groundY
   * @param size multiplies particle scale, speed and offsets (e.g. the unit's row scale)
   */
  spawn(
    preset: Id,
    x: number,
    y: number,
    dirX = 1,
    dirY = 0,
    groundY: number = this.groundY,
    size = 1,
  ): void {
    const first = this.presetFirst[preset];
    if (first === undefined) return;
    const end = first + this.presetCount[preset];
    const rng = this.rng01;
    const facing = dirX < 0 ? -1 : 1;
    const dirAngle = dirX === 0 && dirY === 0 ? UP : Math.atan2(dirY, dirX);

    for (let e = first; e < end; e++) {
      const em = this.emitters[e];
      let n = em.countMin + Math.floor(rng() * (em.countMax - em.countMin + 1));
      if (this.density < 1) n = this.density > 0 ? Math.ceil(n * this.density) : 0;
      for (let k = 0; k < n; k++) {
        if (this.count >= this.capacity) {
          this.dropped++;
          continue;
        }
        const i = this.count++;

        let angle: number;
        if (em.aim === AIM_DIR) angle = dirAngle - facing * em.turnUp + (rng() - 0.5) * em.spread;
        else if (em.aim === AIM_UP) angle = UP + (rng() - 0.5) * em.spread;
        else if (em.aim === AIM_ANY) angle = rng() * TAU;
        else angle = rng() < 0.5 ? -rng() * em.spread : Math.PI + rng() * em.spread;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const speed = (em.speedMin + (em.speedMax - em.speedMin) * rng()) * size;
        const forward = (em.forwardMin + (em.forwardMax - em.forwardMin) * rng()) * size;

        this.x[i] = x + cos * forward + (rng() * 2 - 1) * em.jitterX * size;
        this.y[i] = y + sin * forward + (rng() * 2 - 1) * em.jitterY * size;
        this.vx[i] = cos * speed;
        this.vy[i] = sin * speed;
        this.rotation[i] = em.rotation === ROT_NONE ? 0 : em.rotation === ROT_RANDOM ? rng() * TAU : angle;
        this.spin[i] = (em.spinMin + (em.spinMax - em.spinMin) * rng()) * (rng() < 0.5 ? -1 : 1);
        this.age[i] = -(em.delayMin + (em.delayMax - em.delayMin) * rng());
        this.life[i] = em.lifeMin + (em.lifeMax - em.lifeMin) * rng();
        this.scale0[i] = (em.scaleMin + (em.scaleMax - em.scaleMin) * rng()) * size;
        this.ground[i] = groundY;
        this.emitter[i] = e;
        this.pick[i] = Math.floor(rng() * em.sprites.length);
        this.resting[i] = 0;
        this.layer[i] = em.layer;
        this.present(i, em);
      }
    }
  }

  /** Advance every particle by dt seconds: delay, gravity, drag, wind, ground contact, spin, fade and scale. */
  update(dtSeconds: number): void {
    if (!(dtSeconds > 0)) return;
    const dt = dtSeconds;
    const emitters = this.emitters;
    const keep = this.keep;
    for (let e = 0; e < emitters.length; e++) keep[e] = Math.exp(-emitters[e].drag * dt);

    const { x, y, vx, vy, rotation, spin, age, life, ground, emitter, resting } = this;
    const wind = this.wind;
    const n = this.count;
    let w = 0;
    for (let i = 0; i < n; i++) {
      const a = age[i] + dt;
      if (a >= life[i]) continue;
      const e = emitter[i];
      const em = emitters[e];
      age[i] = a;

      if (a >= 0 && resting[i] === 0) {
        let nvx = vx[i] * keep[e];
        let nvy = (vy[i] + em.gravity * dt) * keep[e];
        const nx = x[i] + (nvx + wind * em.wind) * dt;
        let ny = y[i] + nvy * dt;
        let dead = false;
        if (em.ground !== GROUND_NONE && ny >= ground[i] && nvy > 0) {
          ny = ground[i];
          if (em.ground === GROUND_DIE) {
            dead = true;
          } else if (em.ground === GROUND_STICK || nvy * em.bounce < FX.restSpeed) {
            nvx = 0;
            nvy = 0;
            spin[i] = 0;
            resting[i] = 1;
            // Elongated bits come to rest lying flat.
            if (em.ground === GROUND_BOUNCE) rotation[i] = Math.round(rotation[i] / Math.PI) * Math.PI;
          } else {
            nvy = -nvy * em.bounce;
            nvx *= em.friction;
            spin[i] *= em.friction;
          }
        }
        if (dead) continue;
        x[i] = nx;
        y[i] = ny;
        vx[i] = nvx;
        vy[i] = nvy;
        if (em.rotation === ROT_VELOCITY) {
          if (nvx !== 0 || nvy !== 0) rotation[i] = Math.atan2(nvy, nvx);
        } else {
          rotation[i] += spin[i] * dt;
        }
      }

      if (w !== i) this.move(i, w);
      this.present(w, em);
      w++;
    }
    this.count = w;
  }

  /** Call `visit` for every visible particle, oldest first. Pass a function you keep, not a new closure each frame. */
  forEach(visit: FxVisitor): void {
    const { x, y, rotation, scale, alpha, sprite, layer } = this;
    for (let i = 0; i < this.count; i++) {
      if (alpha[i] > 0) visit(x[i], y[i], rotation[i], scale[i], alpha[i], sprite[i], layer[i]);
    }
  }

  /** Remove every particle. */
  clear(): void {
    this.count = 0;
  }

  /** Work out the scale, alpha and sprite the renderer should use for particle i. */
  private present(i: number, em: Emitter): void {
    const age = this.age[i];
    if (age < 0) {
      this.alpha[i] = 0;
      this.scale[i] = this.scale0[i];
      this.sprite[i] = em.sprites[em.animate ? 0 : this.pick[i]];
      return;
    }
    const t = age / this.life[i];
    const grown = em.growEase === 1 ? t : 1 - Math.pow(1 - t, em.growEase);
    this.scale[i] = this.scale0[i] * (1 + (em.grow - 1) * grown);
    let alpha = em.alpha;
    if (t < em.fadeIn) alpha *= t / em.fadeIn;
    if (t > em.fadeOut) alpha *= (1 - t) / (1 - em.fadeOut);
    this.alpha[i] = alpha;
    const frames = em.sprites.length;
    this.sprite[i] = em.sprites[em.animate ? Math.min(frames - 1, Math.floor(t * frames)) : this.pick[i]];
  }

  private move(from: number, to: number): void {
    this.x[to] = this.x[from];
    this.y[to] = this.y[from];
    this.vx[to] = this.vx[from];
    this.vy[to] = this.vy[from];
    this.rotation[to] = this.rotation[from];
    this.spin[to] = this.spin[from];
    this.age[to] = this.age[from];
    this.life[to] = this.life[from];
    this.scale0[to] = this.scale0[from];
    this.ground[to] = this.ground[from];
    this.emitter[to] = this.emitter[from];
    this.pick[to] = this.pick[from];
    this.resting[to] = this.resting[from];
    this.layer[to] = this.layer[from];
  }
}

/** A particle system playing the presets in src/data/fx.ts. */
export function createParticles(rng01: Rng01, capacity: number = FX.capacity): ParticleSystem {
  return new ParticleSystem(rng01, capacity);
}
