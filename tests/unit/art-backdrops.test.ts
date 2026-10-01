import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BACKDROP_SLOTS,
  backdropLayerX,
  backdropRasterArea,
  getBackdrop,
  getTheatreColours,
  type BackdropLayer,
} from '../../src/art/backdrops';
import { BACKDROP, THEATRE_IDS, THEATRES, TIMES_OF_DAY, TIME_GRADES } from '../../src/data/theatres';
import { DEPTH, PARALLAX, VIEW } from '../../src/data/view';

/**
 * A context that draws nothing and records every call and property write, so
 * the painters can be run (and compared) without a canvas.
 */
function recorder(): { ctx: CanvasRenderingContext2D; hash: () => number; calls: () => number } {
  let h = 0x811c9dc5;
  let n = 0;
  const feed = (s: string): void => {
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  };
  const fmt = (v: unknown): string => (typeof v === 'number' ? v.toFixed(3) : typeof v === 'string' ? v : typeof v);
  const gradient = { addColorStop: (o: number, c: string) => feed(`stop${fmt(o)}${c}`) };
  const target = {} as Record<string, unknown>;
  const proxy = new Proxy(target, {
    get(_t, prop: string) {
      if (prop in target) return target[prop];
      return (...args: unknown[]) => {
        n++;
        feed(prop + args.map(fmt).join(','));
        return prop.startsWith('create') ? gradient : undefined;
      };
    },
    set(_t, prop: string, value: unknown) {
      target[prop] = value;
      feed(`${prop}=${fmt(value)}`);
      return true;
    },
  });
  return { ctx: proxy as unknown as CanvasRenderingContext2D, hash: () => h >>> 0, calls: () => n };
}

function transcript(layer: BackdropLayer): { hash: number; calls: number } {
  const r = recorder();
  layer.draw(r.ctx);
  return { hash: r.hash(), calls: r.calls() };
}

function luminance(hex: string): number {
  const v = parseInt(hex.slice(1), 16);
  return (0.2126 * ((v >> 16) & 255) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255)) / 255;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('backdrop layers', () => {
  it('give one layer per slot, back to front, with namespaced unique keys', () => {
    for (const theatre of THEATRE_IDS) {
      for (const time of TIMES_OF_DAY) {
        const layers = getBackdrop(theatre, time, 7);
        expect(layers.map((l) => l.slot)).toEqual([...BACKDROP_SLOTS]);
        const keys = layers.map((l) => l.key);
        expect(new Set(keys).size).toBe(keys.length);
        for (const l of layers) expect(l.key).toBe(`bg/${theatre}/${time}/${l.slot}`);
      }
    }
  });

  it('state sensible sizes, raster scales, parallax and depths', () => {
    for (const theatre of THEATRE_IDS) {
      for (const l of getBackdrop(theatre, 'day', 1)) {
        expect(l.w).toBeGreaterThan(0);
        expect(l.w).toBeLessThanOrEqual(2048);
        expect(l.h).toBeGreaterThan(0);
        expect(l.h).toBeLessThanOrEqual(VIEW.heightWu);
        // The sun and moon sprite is a square centred on the body, so it may start above the screen.
        expect(l.y).toBeGreaterThanOrEqual(l.slot === 'celestial' ? -BACKDROP.celestialSize : 0);
        expect(l.y + l.h).toBeLessThanOrEqual(VIEW.heightWu + 1e-6);
        expect(l.scale).toBe(BACKDROP.rasterScale[l.slot]);
        expect(l.parallax).toBe(PARALLAX[l.slot]);
        expect(l.depth).toBe(DEPTH[l.slot]);
        expect(l.tile).toBe(l.slot !== 'celestial');
      }
    }
  });

  it('cover the view: sky and backdrops run below the horizon, the ground reaches the bottom', () => {
    for (const theatre of THEATRE_IDS) {
      const by = new Map(getBackdrop(theatre, 'day', 1).map((l) => [l.slot, l]));
      for (const slot of ['sky', 'farBackdrop', 'midBackdrop', 'nearBackdrop'] as const) {
        const l = by.get(slot)!;
        expect(l.y + l.h).toBeGreaterThanOrEqual(VIEW.horizonY);
      }
      const ground = by.get('ground')!;
      expect(ground.y).toBeLessThanOrEqual(VIEW.horizonY);
      expect(ground.y + ground.h).toBe(VIEW.heightWu);
      const fg = by.get('foreground')!;
      expect(fg.y).toBeGreaterThanOrEqual(BACKDROP.foregroundLimit - 10);
      expect(fg.y + fg.h).toBe(VIEW.heightWu);
    }
  });

  it('keep the raster area of one theatre under 12 megapixels', () => {
    for (const theatre of THEATRE_IDS) {
      for (const time of TIMES_OF_DAY) {
        expect(backdropRasterArea(getBackdrop(theatre, time, 1))).toBeLessThan(12e6);
      }
    }
  });

  it('paint every layer of every theatre at every time of day without error or Math.random', () => {
    const rand = vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random is not allowed in backdrop code');
    });
    for (const theatre of THEATRE_IDS) {
      for (const time of TIMES_OF_DAY) {
        for (const l of getBackdrop(theatre, time, 3)) {
          expect(transcript(l).calls).toBeGreaterThan(0);
        }
      }
    }
    expect(rand).not.toHaveBeenCalled();
  });

  it('are deterministic from the seed and change with it', () => {
    for (const theatre of THEATRE_IDS) {
      const a = getBackdrop(theatre, 'day', 5);
      const b = getBackdrop(theatre, 'day', 5);
      const c = getBackdrop(theatre, 'day', 6);
      for (const slot of ['clouds', 'farBackdrop', 'midBackdrop', 'nearBackdrop', 'ground', 'foreground'] as const) {
        const ia = a.findIndex((l) => l.slot === slot);
        expect(transcript(a[ia]).hash).toBe(transcript(b[ia]).hash);
        expect(transcript(a[ia]).hash).not.toBe(transcript(c[ia]).hash);
      }
    }
  });

  it('re-grade the same scene for each time of day', () => {
    for (const theatre of THEATRE_IDS) {
      const hashes = new Set(TIMES_OF_DAY.map((t) => transcript(getBackdrop(theatre, t, 2)[3]).hash));
      expect(hashes.size).toBe(TIMES_OF_DAY.length);
    }
  });

  it('place tiles in (-w, 0] and the sun or moon by its slow parallax', () => {
    const layers = getBackdrop('france', 'day', 1);
    for (const l of layers) {
      for (const camX of [0, 123, 5000, 99999, -300]) {
        const x = backdropLayerX(l, camX);
        if (l.tile) {
          expect(x).toBeLessThanOrEqual(0);
          expect(x).toBeGreaterThan(-l.w);
        } else {
          expect(x).toBeCloseTo(l.x - camX * l.parallax, 6);
        }
      }
    }
  });
});

describe('theatre colours', () => {
  it('give valid colours, the data rain grade and the data night tint', () => {
    for (const theatre of THEATRE_IDS) {
      for (const time of TIMES_OF_DAY) {
        const c = getTheatreColours(theatre, time);
        for (const hex of [c.ground, c.groundDark, c.soil, c.soilDark, c.dust, c.haze, c.nightTint]) {
          expect(hex).toMatch(/^#[0-9a-f]{6}$/);
        }
        expect(c.int.ground).toBe(parseInt(c.ground.slice(1), 16));
        expect(c.int.soil).toBe(parseInt(c.soil.slice(1), 16));
        expect(c.int.nightTint).toBe(parseInt(c.nightTint.slice(1), 16));
        expect(c.nightTint).toBe(THEATRES[theatre].nightTint);
        expect(c.nightTintAlpha).toBe(TIME_GRADES[time].tintAlpha);
        expect(c.rain).toBe(THEATRES[theatre].rain);
        expect(c.rain.darken).toBeGreaterThan(0);
        expect(c.rain.darken).toBeLessThan(1);
        expect(c.rain.desaturate).toBeGreaterThan(0);
        expect(c.rain.desaturate).toBeLessThan(1);
      }
    }
  });

  it('keep the ground under the units mid-to-light by day, with the soil darker than it', () => {
    for (const theatre of THEATRE_IDS) {
      const c = getTheatreColours(theatre, 'day');
      expect(luminance(c.ground)).toBeGreaterThan(0.38);
      expect(luminance(c.ground)).toBeLessThan(0.82);
      expect(luminance(c.soil)).toBeLessThan(luminance(c.ground));
      expect(luminance(c.soilDark)).toBeLessThan(luminance(c.soil));
    }
  });

  it('darken the ground at night', () => {
    for (const theatre of THEATRE_IDS) {
      expect(luminance(getTheatreColours(theatre, 'night').ground)).toBeLessThan(luminance(getTheatreColours(theatre, 'day').ground));
    }
  });
});
