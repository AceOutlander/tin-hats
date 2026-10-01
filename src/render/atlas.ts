/**
 * Sprite atlases: rasterise SpriteSpecs into as few canvas pages as possible
 * with a shelf packer, then register each page as a Phaser texture whose
 * frames carry the spec's anchor as a custom pivot (so Image.setFrame()
 * applies the origin by itself).
 *
 * Every frame is surrounded by RENDER.atlasPadding texture pixels filled with
 * copies of its own edge pixels (edge extrusion), so linear filtering at any
 * scale never pulls in a neighbour's pixels.
 */
import type Phaser from 'phaser';
import type { SpriteSpec } from '../art/types';
import { RENDER } from '../data/render';

/** One rasterised sprite, ready for Image.setFrame(). */
export interface SpriteFrame {
  key: string;
  frame: Phaser.Textures.Frame;
  /** Texture pixels per wu. Give an Image scale (1 / scale) to draw it at its size in wu. */
  scale: number;
  /** Size in wu. */
  w: number;
  h: number;
}

interface Cell {
  spec: SpriteSpec;
  page: number;
  /** Frame rectangle in page pixels (padding excluded). */
  x: number;
  y: number;
  pw: number;
  ph: number;
}

interface PackedPage {
  w: number;
  h: number;
  cells: Cell[];
}

/** Shelf packer: tallest first, left to right, new shelf when the row is full, new page when the page is full. */
export function packSprites(specs: readonly SpriteSpec[], scale: number, pad: number, maxSize: number): PackedPage[] {
  const sorted = specs.slice().sort((a, b) => Math.ceil(b.h * scale) - Math.ceil(a.h * scale) || (a.key < b.key ? -1 : 1));
  const pages: PackedPage[] = [];
  let page: PackedPage | null = null;
  let cx = 0;
  let shelfY = 0;
  let shelfH = 0;
  for (const spec of sorted) {
    const pw = Math.max(1, Math.ceil(spec.w * scale));
    const ph = Math.max(1, Math.ceil(spec.h * scale));
    const cw = pw + pad * 2;
    const ch = ph + pad * 2;
    if (cw > maxSize || ch > maxSize) throw new Error(`sprite ${spec.key} (${pw}x${ph}) does not fit an atlas page of ${maxSize}`);
    if (page && cx + cw > maxSize) {
      shelfY += shelfH;
      cx = 0;
      shelfH = 0;
    }
    if (!page || shelfY + ch > maxSize) {
      page = { w: 0, h: 0, cells: [] };
      pages.push(page);
      cx = 0;
      shelfY = 0;
      shelfH = 0;
    }
    page.cells.push({ spec, page: pages.length - 1, x: cx + pad, y: shelfY + pad, pw, ph });
    cx += cw;
    shelfH = Math.max(shelfH, ch);
    page.w = Math.max(page.w, cx);
    page.h = Math.max(page.h, shelfY + shelfH);
  }
  for (const p of pages) {
    // Round up to a multiple of 4 (friendlier to some GPUs' row alignment).
    p.w = Math.ceil(p.w / 4) * 4;
    p.h = Math.ceil(p.h / 4) * 4;
  }
  return pages;
}

/** Copy a frame's outermost pixels outward into its padding. */
function extrude(ctx: CanvasRenderingContext2D, c: Cell, pad: number): void {
  if (pad <= 0) return;
  const cv = ctx.canvas;
  const { x, y, pw, ph } = c;
  ctx.drawImage(cv, x, y, 1, ph, x - pad, y, pad, ph);
  ctx.drawImage(cv, x + pw - 1, y, 1, ph, x + pw, y, pad, ph);
  ctx.drawImage(cv, x - pad, y, pw + pad * 2, 1, x - pad, y - pad, pw + pad * 2, pad);
  ctx.drawImage(cv, x - pad, y + ph - 1, pw + pad * 2, 1, x - pad, y + ph, pw + pad * 2, pad);
}

function rasterisePage(page: PackedPage, scale: number, pad: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = page.w;
  canvas.height = page.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2D context for an atlas page');
  for (const c of page.cells) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.beginPath();
    ctx.rect(0, 0, c.pw, c.ph);
    ctx.clip();
    ctx.scale(scale, scale);
    c.spec.draw(ctx);
    ctx.restore();
  }
  ctx.imageSmoothingEnabled = false;
  for (const c of page.cells) extrude(ctx, c, pad);
  ctx.imageSmoothingEnabled = true;
  return canvas;
}

/** Every sprite frame the renderer can draw, by spec key. */
export class SpriteRegistry {
  private readonly frames = new Map<string, SpriteFrame>();
  private readonly pageKeys = new Map<string, string[]>();
  private readonly pagePixels = new Map<string, number>();
  private readonly missing = new Set<string>();

  constructor(private readonly textures: Phaser.Textures.TextureManager) {}

  /**
   * Rasterise `specs` into atlas pages named `${group}/0`, `${group}/1` ...
   * Keys already registered are skipped. Returns the number of pages made.
   */
  addAtlas(group: string, specs: readonly SpriteSpec[], scale: number, maxSize: number): number {
    const fresh: SpriteSpec[] = [];
    const seen = new Set<string>();
    for (const s of specs) {
      if (this.frames.has(s.key) || seen.has(s.key)) continue;
      seen.add(s.key);
      fresh.push(s);
    }
    if (fresh.length === 0) return 0;
    const pad = RENDER.atlasPadding;
    const pages = packSprites(fresh, scale, pad, maxSize);
    const keys = this.pageKeys.get(group) ?? [];
    let pixels = this.pagePixels.get(group) ?? 0;
    for (const page of pages) {
      const texKey = `${group}/${keys.length}`;
      const canvas = rasterisePage(page, scale, pad);
      const tex = this.textures.addCanvas(texKey, canvas);
      if (!tex) throw new Error(`texture key ${texKey} is already in use`);
      keys.push(texKey);
      pixels += page.w * page.h;
      for (const c of page.cells) {
        const frame = tex.add(c.spec.key, 0, c.x, c.y, c.pw, c.ph);
        if (!frame) continue;
        frame.customPivot = true;
        frame.pivotX = (c.spec.ax * c.spec.w * scale) / c.pw;
        frame.pivotY = (c.spec.ay * c.spec.h * scale) / c.ph;
        this.frames.set(c.spec.key, { key: c.spec.key, frame, scale, w: c.spec.w, h: c.spec.h });
      }
    }
    this.pageKeys.set(group, keys);
    this.pagePixels.set(group, pixels);
    return pages.length;
  }

  /**
   * Cut a registered sprite into `n` vertical strips named `${key}#${i}`, each
   * with its origin at its own top-left corner (used for waving flags).
   */
  addStrips(key: string, n: number): void {
    const base = this.frames.get(key);
    if (!base || this.frames.has(`${key}#0`)) return;
    const tex = base.frame.texture;
    const f = base.frame;
    for (let i = 0; i < n; i++) {
      const x0 = Math.floor((f.cutWidth * i) / n);
      const x1 = Math.min(f.cutWidth, Math.ceil((f.cutWidth * (i + 1)) / n) + 1);
      const name = `${key}#${i}`;
      const frame = tex.add(name, 0, f.cutX + x0, f.cutY, x1 - x0, f.cutHeight);
      if (!frame) continue;
      frame.customPivot = true;
      frame.pivotX = 0;
      frame.pivotY = 0;
      this.frames.set(name, { key: name, frame, scale: base.scale, w: (x1 - x0) / base.scale, h: base.h });
    }
  }

  /** Remove every page of a group and its frames (the caller must stop using them first). */
  removeGroup(group: string): void {
    const keys = this.pageKeys.get(group);
    if (!keys) return;
    for (const [k, f] of this.frames) {
      if (keys.includes(f.frame.texture.key)) this.frames.delete(k);
    }
    for (const k of keys) this.textures.remove(k);
    this.pageKeys.delete(group);
    this.pagePixels.delete(group);
  }

  has(key: string): boolean {
    return this.frames.has(key);
  }

  /** The frame for a key; a missing key falls back to the first registered frame and warns once. */
  get(key: string): SpriteFrame {
    const f = this.frames.get(key);
    if (f) return f;
    if (!this.missing.has(key)) {
      this.missing.add(key);
      console.warn(`render: no sprite "${key}"`);
    }
    const first = this.frames.values().next();
    if (first.done) throw new Error('render: sprite registry is empty');
    return first.value;
  }

  pageCount(): number {
    let n = 0;
    for (const keys of this.pageKeys.values()) n += keys.length;
    return n;
  }

  pixels(): number {
    let n = 0;
    for (const p of this.pagePixels.values()) n += p;
    return n;
  }
}
