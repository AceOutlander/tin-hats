/**
 * Brief on-screen markers: the chevron that drops onto the hold line when the
 * player changes the order, the circle that shows where a call-in will land,
 * and the floating "+N" of supplies.
 */
import type Phaser from 'phaser';
import { FX_KEYS } from '../../data/fx';
import { RENDER } from '../../data/render';
import type { Order } from '../../data/schema';
import type { SpriteRegistry } from '../atlas';
import { addImage, type Layers } from '../layers';
import { GLYPH_ADVANCE, glyphKey } from '../sprites';

type Img = Phaser.GameObjects.Image;

const O = RENDER.fx.order;
const FL = RENDER.fx.floater;
const MAX_ORDER = 3;
const MAX_TARGET = 4;
const MAX_GLYPHS = 6;

export class OrderMarkers {
  private readonly images: Img[] = [];
  private readonly age: Float32Array;
  private readonly x: Float32Array;
  private readonly y: Float32Array;
  private readonly inv: number;
  private next = 0;

  constructor(scene: Phaser.Scene, layers: Layers, reg: SpriteRegistry) {
    const fr = reg.get(FX_KEYS.ui.orderMarker);
    this.inv = 1 / fr.scale;
    this.age = new Float32Array(MAX_ORDER).fill(Infinity);
    this.x = new Float32Array(MAX_ORDER);
    this.y = new Float32Array(MAX_ORDER);
    for (let i = 0; i < MAX_ORDER; i++) {
      const img = addImage(scene, layers.byName.markers, fr.frame);
      img.visible = false;
      this.images.push(img);
    }
  }

  /** Drop a marker onto the ground at (x, y), tinted for the order. */
  add(order: Order, x: number, y: number): void {
    const i = this.next;
    this.next = (this.next + 1) % MAX_ORDER;
    this.age[i] = 0;
    this.x[i] = x;
    this.y[i] = y;
    this.images[i].setTint(O.tint[order] ?? 0xffffff);
    this.images[i].visible = true;
  }

  update(dt: number): void {
    for (let i = 0; i < MAX_ORDER; i++) {
      if (this.age[i] === Infinity) continue;
      const t = this.age[i] + dt;
      this.age[i] = t;
      const img = this.images[i];
      if (t >= O.time) {
        this.age[i] = Infinity;
        img.visible = false;
        continue;
      }
      // Drops in from above with a small overshoot, bobs, then fades.
      const pop = Math.min(1, t / O.popTime);
      const drop = (1 - pop) * (1 - pop) * 46;
      const k = O.scaleStart + (O.scale - O.scaleStart) * (1 - (1 - pop) * (1 - pop));
      img.x = this.x[i];
      img.y = this.y[i] - drop - Math.max(0, Math.sin((t - O.popTime) * 7)) * O.bob * (1 - t / O.time);
      img.setScale(k * this.inv);
      const fadeAt = O.time * O.fadeStart;
      img.alpha = t < fadeAt ? 1 : 1 - (t - fadeAt) / (O.time - fadeAt);
    }
  }

  clear(): void {
    this.age.fill(Infinity);
    for (const img of this.images) img.visible = false;
  }
}

/** Reticle circles that show where a call-in will land, until its first round arrives. */
export class TargetMarkers {
  private readonly images: Img[] = [];
  private readonly age: Float32Array;
  private readonly life: Float32Array;
  private readonly x: Float32Array;
  private readonly width: Float32Array;
  private readonly peak: Float32Array;
  private readonly w: number;
  private readonly inv: number;
  private next = 0;

  constructor(scene: Phaser.Scene, layers: Layers, reg: SpriteRegistry) {
    const fr = reg.get(FX_KEYS.ui.reticle);
    this.inv = 1 / fr.scale;
    this.w = fr.w;
    this.age = new Float32Array(MAX_TARGET).fill(Infinity);
    this.life = new Float32Array(MAX_TARGET);
    this.x = new Float32Array(MAX_TARGET);
    this.width = new Float32Array(MAX_TARGET);
    this.peak = new Float32Array(MAX_TARGET);
    for (let i = 0; i < MAX_TARGET; i++) {
      const img = addImage(scene, layers.byName.markers, fr.frame);
      img.visible = false;
      this.images.push(img);
    }
  }

  /** Show a circle of the given half-width (wu) at x for `time` seconds, at opacity `peak`. */
  add(x: number, halfWidth: number, time: number, peak: number): void {
    // The same call-in announced twice reuses its circle.
    let i = -1;
    for (let k = 0; k < MAX_TARGET; k++) {
      if (this.age[k] !== Infinity && Math.abs(this.x[k] - x) < 12) {
        i = k;
        break;
      }
    }
    if (i < 0) {
      i = this.next;
      this.next = (this.next + 1) % MAX_TARGET;
    }
    this.age[i] = 0;
    this.life[i] = Math.max(0.3, time);
    this.x[i] = x;
    this.width[i] = halfWidth * 2;
    this.peak[i] = peak;
    this.images[i].visible = true;
  }

  update(dt: number, groundY: number): void {
    for (let i = 0; i < MAX_TARGET; i++) {
      if (this.age[i] === Infinity) continue;
      const t = this.age[i] + dt;
      this.age[i] = t;
      const img = this.images[i];
      if (t >= this.life[i]) {
        this.age[i] = Infinity;
        img.visible = false;
        continue;
      }
      const k = t / this.life[i];
      img.x = this.x[i];
      img.y = groundY;
      // Closes in slightly as the call-in nears, and blinks faster.
      const s = (this.width[i] / this.w) * (1.12 - 0.12 * k);
      img.scaleX = s * this.inv;
      img.scaleY = s * this.inv * 1.1;
      img.alpha = this.peak[i] * (0.6 + 0.4 * Math.sin(t * (6 + 12 * k))) * Math.min(1, (1 - k) * 4);
    }
  }

  clear(): void {
    this.age.fill(Infinity);
    for (const img of this.images) img.visible = false;
  }
}

/** Floating "+N" text built from pooled glyph images. */
export class Floaters {
  private readonly glyphs: Img[][] = [];
  private readonly age: Float32Array;
  private readonly x: Float32Array;
  private readonly y: Float32Array;
  private readonly count: Uint8Array;
  private readonly frameKey: string[] = [];
  private readonly labels = new Map<number, string>();
  private readonly inv: number;
  private next = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layers: Layers,
    private readonly reg: SpriteRegistry,
  ) {
    this.inv = 1 / reg.get(glyphKey('0')).scale;
    this.age = new Float32Array(FL.max).fill(Infinity);
    this.x = new Float32Array(FL.max);
    this.y = new Float32Array(FL.max);
    this.count = new Uint8Array(FL.max);
    for (let i = 0; i < FL.max; i++) {
      const row: Img[] = [];
      for (let g = 0; g < MAX_GLYPHS; g++) {
        const img = addImage(this.scene, this.layers.byName.markers, reg.get(glyphKey('0')).frame);
        img.visible = false;
        row.push(img);
        this.frameKey.push('0');
      }
      this.glyphs.push(row);
    }
  }

  /** The "+N" text of a value, built once per value. */
  private label(value: number): string {
    let text = this.labels.get(value);
    if (text === undefined) {
      text = `+${value}`;
      this.labels.set(value, text);
    }
    return text;
  }

  /** Float "+value" up from (x, y). */
  add(x: number, y: number, value: number): void {
    const text = this.label(Math.max(0, Math.round(value)));
    const i = this.next;
    this.next = (this.next + 1) % FL.max;
    const n = Math.min(MAX_GLYPHS, text.length);
    this.age[i] = 0;
    this.x[i] = x;
    this.y[i] = y;
    this.count[i] = n;
    const row = this.glyphs[i];
    for (let g = 0; g < MAX_GLYPHS; g++) {
      const img = row[g];
      if (g >= n) {
        img.visible = false;
        continue;
      }
      const ch = text[g];
      if (this.frameKey[i * MAX_GLYPHS + g] !== ch) {
        img.setFrame(this.reg.get(glyphKey(ch)).frame);
        this.frameKey[i * MAX_GLYPHS + g] = ch;
      }
      img.visible = true;
    }
  }

  update(dt: number): void {
    for (let i = 0; i < FL.max; i++) {
      if (this.age[i] === Infinity) continue;
      const t = this.age[i] + dt;
      this.age[i] = t;
      const row = this.glyphs[i];
      const n = this.count[i];
      if (t >= FL.time) {
        this.age[i] = Infinity;
        for (let g = 0; g < n; g++) row[g].visible = false;
        continue;
      }
      const k = t / FL.time;
      const rise = FL.rise * (1 - (1 - k) * (1 - k));
      const pop = k < 0.12 ? 0.6 + (k / 0.12) * 0.55 : 1.15 - 0.15 * Math.min(1, (k - 0.12) / 0.2);
      const fadeAt = FL.fadeStart;
      const a = k < fadeAt ? 1 : 1 - (k - fadeAt) / (1 - fadeAt);
      const s = FL.scale * pop;
      const total = (n - 1) * GLYPH_ADVANCE * s;
      for (let g = 0; g < n; g++) {
        const img = row[g];
        img.x = this.x[i] - total / 2 + g * GLYPH_ADVANCE * s;
        img.y = this.y[i] - rise;
        img.setScale(s * this.inv);
        img.alpha = a;
      }
    }
  }

  clear(): void {
    this.age.fill(Infinity);
    for (const row of this.glyphs) for (const img of row) img.visible = false;
  }
}
