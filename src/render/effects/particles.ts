/**
 * Draws a ParticleSystem (src/fx) with pooled Images. Each (target layer,
 * sprite) pair has its own pool, so an image never changes frame; fireballs go
 * to a target of their own, drawn above the night tint so blasts stay bright at
 * night. Allocation free once the pools have grown.
 */
import Phaser from 'phaser';
import { FX_LAYERS, FX_SPRITES, FX_SPRITE_KEYS } from '../../data/fx';
import { RENDER_PERF } from '../../data/renderPerf';
import type { ParticleSystem } from '../../fx';
import type { SpriteFrame, SpriteRegistry } from '../atlas';
import { addImage } from '../layers';
import type { PresetId } from './presets';

type Img = Phaser.GameObjects.Image;

const EFFECTS_LAYER = FX_LAYERS.findIndex((l) => l.name === 'effects');
const SPRITES = FX_SPRITE_KEYS.length;
/** Most particle images drawn in a frame: the particle pool never holds more than this. */
const MAX_IMAGES = RENDER_PERF.quality.levels[0].hardCap;

export class ParticleDrawer {
  /** pools[target * SPRITES + sprite]: the images drawing that sprite on that target layer. */
  private readonly pools: Img[][] = [];
  /** Images in use this frame and last frame, per pool. */
  private used: Int16Array;
  private shown: Int16Array;
  private readonly frames: SpriteFrame[];
  /** Per sprite index: true for fireball frames. */
  private readonly lit: Uint8Array;
  private readonly litTarget = FX_LAYERS.length;
  private total = 0;
  /** Particles outside [cullLeft, cullRight] (world x) are not drawn. */
  private cullLeft = -Infinity;
  private cullRight = Infinity;

  constructor(
    private readonly scene: Phaser.Scene,
    /** Phaser layer for each FX layer index, then the layer for fireballs. */
    private readonly targets: Phaser.GameObjects.Layer[],
    reg: SpriteRegistry,
  ) {
    this.frames = FX_SPRITE_KEYS.map((k) => reg.get(k));
    this.lit = new Uint8Array(SPRITES);
    for (const key of FX_SPRITES.fireball) this.lit[FX_SPRITE_KEYS.indexOf(key)] = 1;
    const n = (FX_LAYERS.length + 1) * SPRITES;
    for (let i = 0; i < n; i++) this.pools.push([]);
    this.used = new Int16Array(n);
    this.shown = new Int16Array(n);
  }

  private readonly visit = (x: number, y: number, rotation: number, scale: number, alpha: number, sprite: number, layer: number): void => {
    if (this.total >= MAX_IMAGES || x < this.cullLeft || x > this.cullRight) return;
    const target = layer === EFFECTS_LAYER && this.lit[sprite] === 1 ? this.litTarget : layer;
    const p = target * SPRITES + sprite;
    const pool = this.pools[p];
    const n = this.used[p];
    const fr = this.frames[sprite];
    let img: Img;
    if (n < pool.length) {
      img = pool[n];
    } else {
      img = addImage(this.scene, this.targets[target], fr.frame);
      if (target < FX_LAYERS.length && FX_LAYERS[target].additive) img.setBlendMode(Phaser.BlendModes.ADD);
      pool.push(img);
    }
    img.visible = true;
    img.x = x;
    img.y = y;
    img.rotation = rotation;
    img.scaleX = scale / fr.scale;
    img.scaleY = scale / fr.scale;
    img.alpha = alpha;
    this.used[p] = n + 1;
    this.total++;
  };

  /** Copy every visible particle between world x left and ight onto images; hide the rest. */
  draw(ps: ParticleSystem<PresetId>, left: number, right: number): void {
    this.cullLeft = left;
    this.cullRight = right;
    const used = this.used;
    const shown = this.shown;
    this.used = shown;
    this.shown = used;
    this.used.fill(0);
    this.total = 0;
    ps.forEach(this.visit);
    for (let p = 0; p < this.pools.length; p++) {
      const pool = this.pools[p];
      for (let j = this.used[p]; j < this.shown[p]; j++) pool[j].visible = false;
    }
  }

  hideAll(): void {
    for (const pool of this.pools) for (const img of pool) img.visible = false;
    this.used.fill(0);
    this.shown.fill(0);
    this.total = 0;
  }

  count(): number {
    return this.total;
  }
}
