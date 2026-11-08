/**
 * Pooled effects of the new units: the flamethrower's flame jet and the commander's speech bubbles (the King Tiger's
 * warning is a HUD banner, see app/session.ts). Nothing allocates per frame.
 */
import type Phaser from 'phaser';
import { RENDER } from '../../data/render';
import type { FactionId, Order } from '../../data/schema';
import type { SpriteRegistry } from '../atlas';
import { addImage, type Layers } from '../layers';
import { FLAME_H, FLAME_W, flameKey, speechKey } from '../sprites';
import { showAlpha } from './callinMath';
import type { EffectContext } from './index';

export { showAlpha, speechLine, speechOrder } from './callinMath';

type Img = Phaser.GameObjects.Image;

const FL = RENDER.flame;
const SP = RENDER.speech;

class Jet {
  live = false;
  age = 0;
  frame = 0;
  constructor(readonly img: Img) {}
}

export class FlameJets {
  private readonly jets: Jet[] = [];
  private next = 0;
  private readonly inv: number;
  private readonly keys: string[] = [];

  constructor(scene: Phaser.Scene, layers: Layers, private readonly reg: SpriteRegistry) {
    for (let f = 0; f < FL.frames; f++) this.keys.push(flameKey(f));
    const fr = reg.get(this.keys[0]);
    this.inv = 1 / fr.scale;
    for (let i = 0; i < FL.max; i++) {
      const img = addImage(scene, layers.byName.effects, fr.frame);
      img.visible = false;
      this.jets.push(new Jet(img));
    }
  }

  clear(): void {
    for (const j of this.jets) {
      j.live = false;
      j.img.visible = false;
    }
  }

  /** A burst from the nozzle at (x0, y0) to (x1, y1). */
  spray(x0: number, y0: number, x1: number, y1: number, scale: number): void {
    const j = this.jets[this.next];
    this.next = (this.next + 1) % this.jets.length;
    j.live = true;
    j.age = 0;
    j.frame = -1;
    const img = j.img;
    img.x = x0;
    img.y = y0;
    const dx = x1 - x0;
    const dy = y1 - y0;
    img.rotation = Math.atan2(dy, dx);
    img.scaleX = (Math.max(8, Math.hypot(dx, dy)) / FLAME_W) * this.inv;
    img.scaleY = (FL.thickness * scale * this.inv * FLAME_H) / FLAME_H;
    if (dx < 0) img.scaleY = -img.scaleY;
    img.visible = true;
  }

  update(dt: number): void {
    for (const j of this.jets) {
      if (!j.live) continue;
      j.age += dt;
      if (j.age >= FL.life) {
        j.live = false;
        j.img.visible = false;
        continue;
      }
      const f = Math.floor(j.age * FL.flickerRate) % this.keys.length;
      if (f !== j.frame) {
        j.frame = f;
        j.img.setFrame(this.reg.get(this.keys[f]).frame);
      }
      const k = j.age / FL.life;
      j.img.alpha = FL.alpha * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85);
    }
  }
}

class Bubble {
  live = false;
  age = 0;
  unitId = -1;
  x = 0;
  y = 0;
  key = '';
  inv = 1;
  constructor(readonly img: Img) {}
}

export class SpeechBubbles {
  private readonly bubbles: Bubble[] = [];

  constructor(scene: Phaser.Scene, layers: Layers, private readonly reg: SpriteRegistry) {
    const first = reg.get(speechKey('british', 'advance', 0));
    for (let i = 0; i < SP.max; i++) {
      const img = addImage(scene, layers.byName.markers, first.frame);
      img.visible = false;
      this.bubbles.push(new Bubble(img));
    }
  }

  clear(): void {
    for (const b of this.bubbles) {
      b.live = false;
      b.img.visible = false;
    }
  }

  /** Bubbles on screen now. */
  shown(): number {
    let n = 0;
    for (const b of this.bubbles) if (b.live) n++;
    return n;
  }

  /** The commander `unitId` (at x, y if his view is not found) shouts line `index` for `order`. */
  say(unitId: number, faction: FactionId, order: Order, index: number, x: number, y: number): void {
    // One bubble per speaker: a new order replaces his old line.
    let b: Bubble | null = null;
    for (const q of this.bubbles) if (q.live && q.unitId === unitId) b = q;
    if (!b) for (const q of this.bubbles) if (!q.live) b = b ?? q;
    if (!b) {
      b = this.bubbles[0];
      for (const q of this.bubbles) if (q.age > b.age) b = q;
    }
    b.live = true;
    b.age = 0;
    b.unitId = unitId;
    b.x = x;
    b.y = y;
    const k = speechKey(faction, order, index);
    if (k !== b.key && this.reg.has(k)) {
      const fr = this.reg.get(k);
      b.img.setFrame(fr.frame);
      b.inv = 1 / fr.scale;
      b.key = k;
    }
  }

  update(dt: number, fx: EffectContext): void {
    for (const b of this.bubbles) {
      if (!b.live) continue;
      b.age += dt;
      const a = showAlpha(b.age, SP.time, SP.pop, SP.fade);
      if (a <= 0 && b.age > 0) {
        b.live = false;
        b.img.visible = false;
        continue;
      }
      const v = fx.units.findById(b.unitId);
      if (v && v.state !== 0) {
        b.x = v.x;
        b.y = v.y + v.sink - v.bodyH * v.s - SP.lift * v.s;
      }
      const pop = b.age < SP.pop ? 0.7 + 0.3 * (b.age / SP.pop) : 1;
      b.img.visible = fx.onScreen(b.x - 80, b.x + 80);
      b.img.x = b.x;
      b.img.y = b.y;
      b.img.setScale(SP.scale * pop * b.inv);
      b.img.alpha = a;
    }
  }
}
