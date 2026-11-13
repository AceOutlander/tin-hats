/**
 * Startup: the sprite atlas is built without copying its page for every sprite (the "Page Unresponsive" freeze of
 * November 2026), it can be built in small pieces with progress, and the loading bar's arithmetic.
 * The time budget itself is held in the browser by tests/perf/startup.perf.spec.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import type { SpriteSpec } from '../../src/art/types';
import { STARTUP_MARKS, STARTUP_PROGRESS, barPercent, bootBar, viewProgress } from '../../src/app/startup';
import { RENDER } from '../../src/data/render';
import { SpriteRegistry, extrudePage, packSprites, type PackedCell } from '../../src/render/atlas';
import { nextTask } from '../../src/render/task';

// --- a small software canvas: pixels as numbers, and a count of what was drawn from where --------------------------

interface DrawCall {
  source: FakeCanvas;
  /** True when the whole source was drawn (a copy of a page). */
  whole: boolean;
}

class FakeCanvas {
  private w = 0;
  private h = 0;
  pixels = new Uint32Array(0);
  readonly calls: DrawCall[] = [];
  readonly ctx: FakeCtx = new FakeCtx(this);

  get width(): number {
    return this.w;
  }
  set width(v: number) {
    this.w = v;
    this.pixels = new Uint32Array(this.w * this.h);
  }
  get height(): number {
    return this.h;
  }
  set height(v: number) {
    this.h = v;
    this.pixels = new Uint32Array(this.w * this.h);
  }
  getContext(): FakeCtx {
    return this.ctx;
  }
  at(x: number, y: number): number {
    return this.pixels[y * this.w + x] ?? 0;
  }
  set(x: number, y: number, v: number): void {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.pixels[y * this.w + x] = v;
  }
}

class FakeCtx {
  imageSmoothingEnabled = true;
  private tx = 0;
  private ty = 0;
  private readonly stack: [number, number][] = [];
  constructor(readonly canvas: FakeCanvas) {}

  save(): void {
    this.stack.push([this.tx, this.ty]);
  }
  restore(): void {
    const s = this.stack.pop();
    if (s) [this.tx, this.ty] = s;
  }
  translate(x: number, y: number): void {
    this.tx += x;
    this.ty += y;
  }
  beginPath(): void {}
  rect(): void {}
  clip(): void {}
  scale(): void {}
  /** A sprite's draw: fill its cell with a value that differs at every pixel. */
  fillCell(w: number, h: number, base: number): void {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) this.canvas.set(this.tx + x, this.ty + y, base + y * 100 + x + 1);
  }
  drawImage(src: FakeCanvas, sx = 0, sy = 0, sw = src.width, sh = src.height, dx = sx, dy = sy, dw = sw, dh = sh): void {
    const whole = arguments.length <= 3;
    this.canvas.calls.push({ source: src, whole });
    // A browser reads the source as it was when the call began.
    const from = src === this.canvas ? src.pixels.slice() : src.pixels;
    for (let y = 0; y < dh; y++) {
      for (let x = 0; x < dw; x++) {
        const px = sx + Math.min(sw - 1, Math.floor((x * sw) / dw));
        const py = sy + Math.min(sh - 1, Math.floor((y * sh) / dh));
        this.canvas.set(dx + x, dy + y, from[py * src.width + px] ?? 0);
      }
    }
  }
}

function spec(key: string, w: number, h: number, base: number): SpriteSpec {
  return {
    key,
    w,
    h,
    ax: 0.5,
    ay: 1,
    draw: (ctx) => (ctx as unknown as FakeCtx).fillCell(w, h, base),
  };
}

/** The part of Phaser's texture manager the registry uses. */
function fakeTextures(): { textures: Phaser.Textures.TextureManager; pages: { key: string; canvas: FakeCanvas; frames: Map<string, number[]> }[] } {
  const pages: { key: string; canvas: FakeCanvas; frames: Map<string, number[]> }[] = [];
  const textures = {
    addCanvas(key: string, canvas: FakeCanvas) {
      const frames = new Map<string, number[]>();
      pages.push({ key, canvas, frames });
      const tex = {
        key,
        add(name: string, _i: number, x: number, y: number, w: number, h: number) {
          frames.set(name, [x, y, w, h]);
          return { texture: tex, customPivot: false, pivotX: 0, pivotY: 0, cutX: x, cutY: y, cutWidth: w, cutHeight: h };
        },
      };
      return tex;
    },
    remove() {},
  };
  return { textures: textures as unknown as Phaser.Textures.TextureManager, pages };
}

const made: FakeCanvas[] = [];

beforeEach(() => {
  made.length = 0;
  vi.stubGlobal('document', {
    createElement: () => {
      const c = new FakeCanvas();
      made.push(c);
      return c;
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const SPECS: SpriteSpec[] = Array.from({ length: 40 }, (_, i) => spec(`s/${i}`, 3 + (i % 5), 4 + (i % 7), (i + 1) * 100_000));

describe('the atlas page padding', () => {
  function page(): { canvas: FakeCanvas; cells: PackedCell[] } {
    const pad = RENDER.atlasPadding;
    const [packed] = packSprites(SPECS, 1, pad, 64);
    if (!packed) throw new Error('nothing packed');
    const canvas = new FakeCanvas();
    canvas.width = packed.w;
    canvas.height = packed.h;
    for (const c of packed.cells) {
      canvas.ctx.save();
      canvas.ctx.translate(c.x, c.y);
      c.spec.draw(canvas.ctx as unknown as CanvasRenderingContext2D);
      canvas.ctx.restore();
    }
    canvas.calls.length = 0;
    return { canvas, cells: packed.cells };
  }

  it('never draws the page onto itself, and copies it twice however many sprites it holds', () => {
    const { canvas, cells } = page();
    expect(cells.length).toBeGreaterThan(10);
    extrudePage(canvas as unknown as HTMLCanvasElement, canvas.ctx as unknown as CanvasRenderingContext2D, cells, RENDER.atlasPadding);
    // The freeze: every sprite drew the page onto itself four times, and the browser copied the whole page each time.
    expect(canvas.calls.some((c) => c.source === canvas)).toBe(false);
    expect(canvas.calls.length).toBe(cells.length * 4);
    // The copies of the page: two, made by drawing the whole page once each.
    expect(made.length).toBe(2);
    for (const copy of made) expect(copy.calls).toEqual([{ source: canvas, whole: true }]);
    // And their memory is let go of.
    for (const copy of made) expect(copy.width * copy.height).toBe(0);
    expect(canvas.ctx.imageSmoothingEnabled).toBe(true);
  });

  it('fills every padding pixel with the nearest pixel of its frame, corners included', () => {
    const pad = RENDER.atlasPadding;
    const { canvas, cells } = page();
    const before = canvas.pixels.slice();
    extrudePage(canvas as unknown as HTMLCanvasElement, canvas.ctx as unknown as CanvasRenderingContext2D, cells, pad);
    for (const { x, y, pw, ph } of cells) {
      for (let py = y - pad; py < y + ph + pad; py++) {
        for (let px = x - pad; px < x + pw + pad; px++) {
          const nx = Math.min(x + pw - 1, Math.max(x, px));
          const ny = Math.min(y + ph - 1, Math.max(y, py));
          expect(canvas.at(px, py), `pixel ${px},${py}`).toBe(before[ny * canvas.width + nx]);
        }
      }
    }
  });

  it('does nothing without padding or without frames', () => {
    const { canvas, cells } = page();
    extrudePage(canvas as unknown as HTMLCanvasElement, canvas.ctx as unknown as CanvasRenderingContext2D, cells, 0);
    extrudePage(canvas as unknown as HTMLCanvasElement, canvas.ctx as unknown as CanvasRenderingContext2D, [], RENDER.atlasPadding);
    expect(canvas.calls.length).toBe(0);
    expect(made.length).toBe(0);
  });
});

describe('the atlas built in pieces', () => {
  it('makes the same pages, frames and pixels as the atlas built in one go', async () => {
    const whole = fakeTextures();
    const pagesWhole = new SpriteRegistry(whole.textures).addAtlas('g', SPECS, 1, 64);
    const sliced = fakeTextures();
    const reg = new SpriteRegistry(sliced.textures);
    const pagesSliced = await reg.addAtlasSliced('g', SPECS, 1, 64, { sliceMs: 0, pause: () => Promise.resolve() });
    expect(pagesSliced).toBe(pagesWhole);
    expect(pagesWhole).toBeGreaterThan(1);
    expect(sliced.pages.map((p) => p.key)).toEqual(whole.pages.map((p) => p.key));
    for (const [i, p] of sliced.pages.entries()) {
      const q = whole.pages[i];
      expect([...p.frames.entries()]).toEqual([...(q?.frames.entries() ?? [])]);
      expect(Array.from(p.canvas.pixels)).toEqual(Array.from(q?.canvas.pixels ?? []));
    }
    for (const s of SPECS) expect(reg.has(s.key)).toBe(true);
  });

  it('gives the browser a turn between slices and reports progress that only grows, to the end', async () => {
    const { textures } = fakeTextures();
    const reg = new SpriteRegistry(textures);
    let pauses = 0;
    const seen: [number, number][] = [];
    // A slice of 0 ms ends after every sprite.
    const pages = await reg.addAtlasSliced('g', SPECS, 1, 64, {
      sliceMs: 0,
      pause: () => {
        pauses++;
        return Promise.resolve();
      },
      onProgress: (done, total) => seen.push([done, total]),
    });
    // A turn after every sprite, and around each page's two last steps.
    expect(pauses).toBeGreaterThanOrEqual(SPECS.length + pages * 3);
    expect(seen.length).toBe(pauses);
    const total = seen[0]?.[1] ?? 0;
    expect(total).toBeGreaterThan(SPECS.length);
    expect(seen.every(([, t]) => t === total)).toBe(true);
    expect(seen.map(([d]) => d)).toEqual(seen.map(([d]) => d).sort((a, b) => a - b));
    expect(seen[seen.length - 1]).toEqual([total, total]);
  });

  it('draws a whole page in one slice when the slice is long, and skips sprites it already has', async () => {
    const { textures } = fakeTextures();
    const reg = new SpriteRegistry(textures);
    let pauses = 0;
    const pause = (): Promise<void> => {
      pauses++;
      return Promise.resolve();
    };
    const pages = await reg.addAtlasSliced('g', SPECS, 1, 64, { sliceMs: 60_000, pause });
    expect(pauses).toBe(pages * 3);
    expect(await reg.addAtlasSliced('g', SPECS, 1, 64, { sliceMs: 60_000, pause })).toBe(0);
  });

  it('nextTask resolves in a later task, after the microtasks of this one', async () => {
    const order: string[] = [];
    const turn = nextTask().then(() => order.push('task'));
    await Promise.resolve().then(() => order.push('microtask'));
    await turn;
    expect(order).toEqual(['microtask', 'task']);
  });
});

describe('the loading bar', () => {
  it('steps through the loader, the engine and the game, fills with the view, and leaves room for the app and the UI', () => {
    expect(viewProgress(0)).toBe(STARTUP_PROGRESS.game);
    expect(viewProgress(1)).toBeCloseTo(STARTUP_PROGRESS.view, 9);
    expect(viewProgress(0.5)).toBeGreaterThan(viewProgress(0.25));
    expect(viewProgress(-3)).toBe(STARTUP_PROGRESS.game);
    expect(viewProgress(7)).toBeCloseTo(STARTUP_PROGRESS.view, 9);
    expect(viewProgress(Number.NaN)).toBe(STARTUP_PROGRESS.game);
    const steps = [STARTUP_PROGRESS.script, STARTUP_PROGRESS.engine, STARTUP_PROGRESS.game, STARTUP_PROGRESS.view, STARTUP_PROGRESS.app, STARTUP_PROGRESS.ui, STARTUP_PROGRESS.scene];
    expect(steps).toEqual([...steps].sort((a, b) => a - b));
    expect(STARTUP_PROGRESS.script).toBeGreaterThan(0);
    expect(STARTUP_PROGRESS.scene).toBeLessThan(1);
    expect(STARTUP_MARKS[0]).toBe('th:script');
    expect(STARTUP_MARKS[STARTUP_MARKS.length - 1]).toBe('th:title');
  });

  it('is a whole percentage that never goes back', () => {
    expect(barPercent(0.5, 0)).toBe(50);
    expect(barPercent(0.2, 50)).toBe(50);
    expect(barPercent(2, 50)).toBe(100);
    expect(barPercent(-1, 0)).toBe(0);
    expect(barPercent(Number.NaN, 12)).toBe(12);
  });

  it('moves the bar on the page and says how far it is', () => {
    const fill = { style: { width: '' } };
    const attrs = new Map<string, string>();
    const bar = { setAttribute: (k: string, v: string) => attrs.set(k, v) };
    const doc = { getElementById: (id: string) => (id === 'boot-fill' ? fill : id === 'boot-bar' ? bar : null) } as unknown as Document;
    const move = bootBar(doc);
    move(0.3);
    expect(fill.style.width).toBe('30%');
    expect(attrs.get('aria-valuenow')).toBe('30');
    move(0.1);
    expect(fill.style.width).toBe('30%');
    move(1);
    expect(fill.style.width).toBe('100%');
    // The loading screen is gone (the title is up): moving the bar is harmless.
    const gone = bootBar({ getElementById: () => null } as unknown as Document);
    expect(() => gone(0.5)).not.toThrow();
  });
});
