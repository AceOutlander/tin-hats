/**
 * Integration seam: every art module feeds one shared texture atlas, so a key
 * defined twice, a sprite with no size or an anchor outside the sprite would
 * silently corrupt the renderer. This collects the specs of every art module.
 */
import { describe, expect, it } from 'vitest';
import { BACKDROP_SLOTS, getBackdrop } from '../../src/art/backdrops';
import { listFxSprites } from '../../src/art/fx';
import { allFigureSprites } from '../../src/art/figure';
import { propSpecs } from '../../src/art/props';
import { structureSpecs, trenchSpec } from '../../src/art/structures';
import type { SpriteSpec } from '../../src/art/types';
import { vehicleSpecs } from '../../src/art/vehicles';
import type { TheatreId, TimeOfDay } from '../../src/data/schema';

interface Module {
  name: string;
  prefix: string;
  specs: () => SpriteSpec[];
}

const MODULES: Module[] = [
  { name: 'figure', prefix: 'fig/', specs: allFigureSprites },
  { name: 'structures', prefix: 'st/', specs: structureSpecs },
  { name: 'vehicles', prefix: 'veh/', specs: vehicleSpecs },
  { name: 'props', prefix: 'prop/', specs: propSpecs },
  { name: 'fx', prefix: 'fx/', specs: listFxSprites },
];

const THEATRE_IDS: TheatreId[] = ['france', 'desert', 'sicily', 'italy', 'normandy', 'holland', 'germany'];
const TIMES: TimeOfDay[] = ['dawn', 'day', 'overcast', 'dusk', 'night'];

/** One-piece trench sprites are built on demand by the renderer; make a few the way it will. */
function onDemandTrenches(): SpriteSpec[] {
  return [trenchSpec('back', 104), trenchSpec('front', 104), trenchSpec('back', 300), trenchSpec('front', 300), trenchSpec('back', 640), trenchSpec('front', 640)];
}

function duplicates(keys: string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const k of keys) {
    if (seen.has(k)) dup.add(k);
    seen.add(k);
  }
  return [...dup];
}

describe('art sprite keys', () => {
  it('lists a non-trivial number of sprites from every module', () => {
    for (const m of MODULES) expect(m.specs().length, m.name).toBeGreaterThan(5);
  });

  it('keeps every module inside its own key namespace', () => {
    for (const m of MODULES) {
      const stray = m.specs().filter((s) => !s.key.startsWith(m.prefix));
      expect(
        stray.map((s) => s.key),
        `${m.name} keys outside ${m.prefix}`,
      ).toEqual([]);
    }
  });

  it('has no duplicate key inside a module', () => {
    for (const m of MODULES) {
      expect(duplicates(m.specs().map((s) => s.key)), m.name).toEqual([]);
    }
  });

  it('has unique keys across every art module, on-demand trenches included', () => {
    const keys: string[] = [];
    for (const m of MODULES) for (const s of m.specs()) keys.push(s.key);
    for (const s of onDemandTrenches()) keys.push(s.key);
    expect(keys.length).toBeGreaterThan(100);
    expect(duplicates(keys)).toEqual([]);
  });

  it('gives every sprite a positive size, a draw function and an anchor inside 0..1', () => {
    const all: SpriteSpec[] = [...onDemandTrenches()];
    for (const m of MODULES) all.push(...m.specs());
    const bad: string[] = [];
    for (const s of all) {
      const ok =
        typeof s.key === 'string' &&
        s.key.length > 0 &&
        Number.isFinite(s.w) &&
        Number.isFinite(s.h) &&
        s.w > 0 &&
        s.h > 0 &&
        s.ax >= 0 &&
        s.ax <= 1 &&
        s.ay >= 0 &&
        s.ay <= 1 &&
        typeof s.draw === 'function';
      if (!ok) bad.push(`${s.key} (w=${s.w} h=${s.h} ax=${s.ax} ay=${s.ay})`);
    }
    expect(bad).toEqual([]);
  });

  it('keeps sprites small enough for the atlas (no side over 4096 wu)', () => {
    const all: SpriteSpec[] = [];
    for (const m of MODULES) all.push(...m.specs());
    const huge = all.filter((s) => s.w > 4096 || s.h > 4096).map((s) => s.key);
    expect(huge).toEqual([]);
  });
});

describe('backdrop layer keys', () => {
  it('has unique keys across all theatres and times of day, outside the sprite namespaces', () => {
    const keys: string[] = [];
    for (const theatre of THEATRE_IDS) {
      for (const time of TIMES) {
        const layers = getBackdrop(theatre, time, 1);
        expect(layers.map((l) => l.slot)).toEqual([...BACKDROP_SLOTS]);
        for (const l of layers) {
          expect(l.key.startsWith('bg/'), l.key).toBe(true);
          expect(l.w, l.key).toBeGreaterThan(0);
          expect(l.h, l.key).toBeGreaterThan(0);
          keys.push(l.key);
        }
      }
    }
    expect(keys.length).toBe(THEATRE_IDS.length * TIMES.length * BACKDROP_SLOTS.length);
    expect(duplicates(keys)).toEqual([]);

    const spriteKeys = new Set<string>();
    for (const m of MODULES) for (const s of m.specs()) spriteKeys.add(s.key);
    expect(keys.filter((k) => spriteKeys.has(k))).toEqual([]);
  });
});
