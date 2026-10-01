/**
 * Pooled tracers: a streak sprite whose head flies from the muzzle to the
 * end point at the weapon's tracer speed; its tail is clipped so it never
 * pokes out behind the muzzle, and it shrinks into the end point on arrival.
 */
import type Phaser from 'phaser';
import { FX_TRACERS, type TracerLook } from '../../data/fx';
import { RENDER } from '../../data/render';
import type { SpriteFrame, SpriteRegistry } from '../atlas';
import { addImage } from '../layers';

type Img = Phaser.GameObjects.Image;

export class TracerPool {
  private readonly images: Img[] = [];
  private readonly look: (TracerLook | '')[] = [];
  private readonly x0: Float32Array;
  private readonly y0: Float32Array;
  private readonly dx: Float32Array;
  private readonly dy: Float32Array;
  private readonly dist: Float32Array;
  private readonly speed: Float32Array;
  private readonly age: Float32Array;
  private readonly alpha: Float32Array;
  private readonly frames: Record<TracerLook, SpriteFrame>;
  /** Live tracers occupy [0, count). */
  count = 0;
  readonly capacity: number;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layer: Phaser.GameObjects.Layer,
    reg: SpriteRegistry,
  ) {
    const cap = RENDER.shots.maxTracers;
    this.capacity = cap;
    this.x0 = new Float32Array(cap);
    this.y0 = new Float32Array(cap);
    this.dx = new Float32Array(cap);
    this.dy = new Float32Array(cap);
    this.dist = new Float32Array(cap);
    this.speed = new Float32Array(cap);
    this.age = new Float32Array(cap);
    this.alpha = new Float32Array(cap);
    this.frames = {
      rifle: reg.get(FX_TRACERS.rifle.sprite),
      mg: reg.get(FX_TRACERS.mg.sprite),
      smg: reg.get(FX_TRACERS.smg.sprite),
      sniper: reg.get(FX_TRACERS.sniper.sprite),
    };
  }

  /** Fire one tracer from (x0, y0) to (x1, y1). Dropped when the pool is full. */
  spawn(look: TracerLook, x0: number, y0: number, x1: number, y1: number): void {
    if (this.count >= this.capacity) return;
    const i = this.count++;
    const ddx = x1 - x0;
    const ddy = y1 - y0;
    const d = Math.hypot(ddx, ddy) || 1;
    this.x0[i] = x0;
    this.y0[i] = y0;
    this.dx[i] = ddx / d;
    this.dy[i] = ddy / d;
    this.dist[i] = d;
    this.speed[i] = FX_TRACERS[look].speed;
    this.age[i] = 0;
    this.alpha[i] = FX_TRACERS[look].alpha;
    while (this.images.length <= i) {
      const img = addImage(this.scene, this.layer, this.frames.rifle.frame);
      img.visible = false;
      this.images.push(img);
      this.look.push('');
    }
    if (this.look[i] !== look) {
      this.images[i].setFrame(this.frames[look].frame);
      this.look[i] = look;
    }
  }

  clear(): void {
    this.count = 0;
    for (const img of this.images) img.visible = false;
  }

  update(dt: number): void {
    const k = RENDER.shots.tracerScale;
    const maxLife = RENDER.shots.tracerMaxLife;
    let w = 0;
    for (let i = 0; i < this.count; i++) {
      const age = this.age[i] + dt;
      const len = this.frames[this.look[i] as TracerLook].w * k;
      if (age * this.speed[i] - len >= this.dist[i] || age > maxLife) continue;
      if (w !== i) this.move(i, w);
      this.age[w] = age;
      w++;
    }
    for (let i = w; i < this.count; i++) this.images[i].visible = false;
    this.count = w;
    for (let i = 0; i < w; i++) {
      const fr = this.frames[this.look[i] as TracerLook];
      const len = fr.w * k;
      const d = this.dist[i];
      const travelled = this.age[i] * this.speed[i];
      const head = Math.min(travelled, d);
      const visible = head - Math.max(0, travelled - len);
      const img = this.images[i];
      if (visible <= 0.5) {
        img.visible = false;
        continue;
      }
      img.visible = true;
      img.x = this.x0[i] + this.dx[i] * head;
      img.y = this.y0[i] + this.dy[i] * head;
      img.rotation = Math.atan2(this.dy[i], this.dx[i]);
      img.scaleX = (visible / fr.w) / fr.scale;
      img.scaleY = k / fr.scale;
      img.alpha = this.alpha[i];
    }
  }

  private move(from: number, to: number): void {
    this.x0[to] = this.x0[from];
    this.y0[to] = this.y0[from];
    this.dx[to] = this.dx[from];
    this.dy[to] = this.dy[from];
    this.dist[to] = this.dist[from];
    this.speed[to] = this.speed[from];
    this.alpha[to] = this.alpha[from];
    // Swap images so each slot keeps an image and its frame cache.
    const img = this.images[to];
    this.images[to] = this.images[from];
    this.images[from] = img;
    const lk = this.look[to];
    this.look[to] = this.look[from];
    this.look[from] = lk;
  }
}
