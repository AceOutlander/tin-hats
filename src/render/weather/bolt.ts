/**
 * Draws a lightning bolt (src/fx generateBolt) as stretched, rotated sprites
 * from the atlas: a soft glow blob along every segment and a thin bright core.
 * Images, not a Graphics object, so the sprite batch is not broken in the
 * middle of the frame (see the note in view.ts about texture units).
 */
import type Phaser from 'phaser';
import { FX_SPRITES } from '../../data/fx';
import { RENDER } from '../../data/render';
import { WEATHER } from '../../data/weather';
import type { LightningBolt } from '../../fx';
import type { SpriteFrame, SpriteRegistry } from '../atlas';
import { addImage } from '../layers';
import { RENDER_KEYS } from '../sprites';

type Img = Phaser.GameObjects.Image;

function hex(s: string): number {
  return parseInt(s.slice(1), 16);
}

const GLOW = hex(WEATHER.lightning.boltGlow);
const CORE = hex(WEATHER.lightning.boltColor);
const W = RENDER.weather;

export class BoltView {
  private readonly glow: Img[] = [];
  private readonly core: Img[] = [];
  private glowUsed = 0;
  private coreUsed = 0;
  private readonly glowFrame: SpriteFrame;
  private readonly coreFrame: SpriteFrame;
  /** Scale per wu of length or width for each sprite (its own size and the texture scale taken out). */
  private readonly glowUnit: number;
  private readonly coreUnit: number;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layer: Phaser.GameObjects.Layer,
    reg: SpriteRegistry,
  ) {
    this.glowFrame = reg.get(FX_SPRITES.glow[0]);
    this.coreFrame = reg.get(RENDER_KEYS.white);
    this.glowUnit = 1 / (this.glowFrame.w * this.glowFrame.scale);
    this.coreUnit = 1 / (this.coreFrame.w * this.coreFrame.scale);
  }

  private take(pool: Img[], used: number, frame: SpriteFrame, tint: number): Img {
    if (used < pool.length) return pool[used];
    const img = addImage(this.scene, this.layer, frame.frame);
    img.setTint(tint);
    pool.push(img);
    return img;
  }

  /** Show the bolt at brightness `a` (0..1). */
  draw(bolt: LightningBolt, a: number): void {
    let g = 0;
    let c = 0;
    for (let l = 0; l < bolt.count; l++) {
      const first = bolt.start[l];
      const n = bolt.length[l];
      const alpha = a * bolt.alpha[l];
      const coreW = bolt.width[l];
      const glowW = coreW * W.boltGlowWidth;
      for (let k = 1; k < n; k++) {
        const x0 = bolt.points[(first + k - 1) * 2];
        const y0 = bolt.points[(first + k - 1) * 2 + 1];
        const x1 = bolt.points[(first + k) * 2];
        const y1 = bolt.points[(first + k) * 2 + 1];
        const len = Math.hypot(x1 - x0, y1 - y0);
        if (len < 0.01) continue;
        const rot = Math.atan2(y1 - y0, x1 - x0);
        const mx = (x0 + x1) / 2;
        const my = (y0 + y1) / 2;
        const gi = this.take(this.glow, g, this.glowFrame, GLOW);
        g++;
        gi.visible = true;
        gi.x = mx;
        gi.y = my;
        gi.rotation = rot;
        gi.scaleX = (len + glowW) * this.glowUnit;
        gi.scaleY = glowW * this.glowUnit;
        gi.alpha = alpha * W.boltGlowAlpha;
        const ci = this.take(this.core, c, this.coreFrame, CORE);
        c++;
        ci.visible = true;
        ci.x = mx;
        ci.y = my;
        ci.rotation = rot;
        ci.scaleX = (len + coreW * 0.8) * this.coreUnit;
        ci.scaleY = coreW * this.coreUnit;
        ci.alpha = alpha;
      }
    }
    for (let i = g; i < this.glowUsed; i++) this.glow[i].visible = false;
    for (let i = c; i < this.coreUsed; i++) this.core[i].visible = false;
    this.glowUsed = g;
    this.coreUsed = c;
  }

  hide(): void {
    for (let i = 0; i < this.glowUsed; i++) this.glow[i].visible = false;
    for (let i = 0; i < this.coreUsed; i++) this.core[i].visible = false;
    this.glowUsed = 0;
    this.coreUsed = 0;
  }
}
