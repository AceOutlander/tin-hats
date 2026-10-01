/**
 * Ground decals (craters, scorch marks): a ring of pooled images that lie on
 * the ground under the units, hold for a while and then fade away. The oldest
 * decal is recycled when the ring is full.
 */
import type Phaser from 'phaser';
import { RENDER } from '../../data/render';
import type { SpriteFrame, SpriteRegistry } from '../atlas';
import { addImage } from '../layers';

type Img = Phaser.GameObjects.Image;

const D = RENDER.fx.decal;

export class DecalPool {
  private readonly images: Img[] = [];
  private readonly age: Float32Array;
  private readonly alpha: Float32Array;
  private readonly keys: string[] = [];
  private next = 0;

  constructor(
    scene: Phaser.Scene,
    layer: Phaser.GameObjects.Layer,
    private readonly reg: SpriteRegistry,
  ) {
    this.age = new Float32Array(D.max).fill(Infinity);
    this.alpha = new Float32Array(D.max);
    const first = reg.get('rd/white');
    for (let i = 0; i < D.max; i++) {
      const img = addImage(scene, layer, first.frame);
      img.visible = false;
      this.images.push(img);
      this.keys.push('');
    }
  }

  /** Lay a decal (sprite key) centred at (x, y) at `scale` times the sprite's own size, with peak opacity `alpha`. */
  add(key: string, x: number, y: number, scale: number, alpha: number = D.alpha): void {
    const i = this.next;
    this.next = (this.next + 1) % D.max;
    const img = this.images[i];
    const fr: SpriteFrame = this.reg.get(key);
    if (this.keys[i] !== key) {
      img.setFrame(fr.frame);
      this.keys[i] = key;
    }
    img.setScale(scale / fr.scale);
    img.x = x;
    img.y = y;
    img.alpha = alpha;
    img.visible = true;
    this.age[i] = 0;
    this.alpha[i] = alpha;
  }

  update(dt: number): void {
    for (let i = 0; i < D.max; i++) {
      const a = this.age[i];
      if (a === Infinity) continue;
      const t = a + dt;
      this.age[i] = t;
      if (t < D.hold) continue;
      const k = 1 - (t - D.hold) / D.fade;
      if (k <= 0) {
        this.age[i] = Infinity;
        this.images[i].visible = false;
      } else {
        this.images[i].alpha = this.alpha[i] * k;
      }
    }
  }

  clear(): void {
    for (let i = 0; i < D.max; i++) {
      this.age[i] = Infinity;
      this.images[i].visible = false;
    }
  }
}
