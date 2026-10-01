/**
 * Draws a ParticleSystem (src/fx) with pooled Images, one pool per FX layer
 * (src/data/fx.ts FX_LAYERS). Allocation free once the pools have grown.
 */
import Phaser from 'phaser';
import { FX_LAYERS, FX_SPRITE_KEYS } from '../../data/fx';
import { RENDER } from '../../data/render';
import type { ParticleSystem } from '../../fx';
import type { SpriteFrame, SpriteRegistry } from '../atlas';
import { addImage } from '../layers';

type Img = Phaser.GameObjects.Image;

export class ParticleDrawer {
  private readonly pools: Img[][] = [];
  private readonly spriteOf: number[][] = [];
  private readonly used: number[] = [];
  private readonly shownLast: number[] = [];
  private readonly frames: SpriteFrame[];
  private total = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    /** Phaser layer for each FX layer index. */
    private readonly targets: Phaser.GameObjects.Layer[],
    reg: SpriteRegistry,
  ) {
    this.frames = FX_SPRITE_KEYS.map((k) => reg.get(k));
    for (let i = 0; i < FX_LAYERS.length; i++) {
      this.pools.push([]);
      this.spriteOf.push([]);
      this.used.push(0);
      this.shownLast.push(0);
    }
  }

  private readonly visit = (x: number, y: number, rotation: number, scale: number, alpha: number, sprite: number, layer: number): void => {
    if (this.total >= RENDER.shots.maxParticleImages) return;
    const pool = this.pools[layer];
    const n = this.used[layer];
    let img: Img;
    if (n < pool.length) {
      img = pool[n];
    } else {
      img = addImage(this.scene, this.targets[layer], this.frames[sprite].frame);
      if (FX_LAYERS[layer].additive) img.setBlendMode(Phaser.BlendModes.ADD);
      pool.push(img);
      this.spriteOf[layer].push(sprite);
    }
    const fr = this.frames[sprite];
    if (this.spriteOf[layer][n] !== sprite) {
      img.setFrame(fr.frame);
      this.spriteOf[layer][n] = sprite;
    }
    img.visible = true;
    img.x = x;
    img.y = y;
    img.rotation = rotation;
    img.scaleX = scale / fr.scale;
    img.scaleY = scale / fr.scale;
    img.alpha = alpha;
    this.used[layer] = n + 1;
    this.total++;
  };

  /** Copy every visible particle onto images; hide the rest. */
  draw(ps: ParticleSystem): void {
    for (let l = 0; l < this.used.length; l++) this.used[l] = 0;
    this.total = 0;
    ps.forEach(this.visit);
    for (let l = 0; l < this.pools.length; l++) {
      const pool = this.pools[l];
      for (let i = this.used[l]; i < this.shownLast[l]; i++) pool[i].visible = false;
      this.shownLast[l] = this.used[l];
    }
  }

  hideAll(): void {
    for (let l = 0; l < this.pools.length; l++) {
      for (const img of this.pools[l]) img.visible = false;
      this.shownLast[l] = 0;
    }
  }

  count(): number {
    return this.total;
  }
}
