import { describe, expect, it } from 'vitest';
import { HQ_GUN_LAYOUT } from '../../src/data/looksGun';
import type { FactionId } from '../../src/data/schema';
import { NATION_LOOKS, type HqGunStyle } from '../../src/data/upgradeLooks';
import { VIEW } from '../../src/data/view';
import { hqGunKey, hqGunSpecs } from '../../src/art/structures/hqGun';
import type { SpriteSpec } from '../../src/art/types';

const STYLES: readonly HqGunStyle[] = ['gunner', 'emplacement', 'tripod', 'nest'];
const FACTIONS: readonly FactionId[] = ['british', 'german'];

/** Run spec.draw against a stand-in 2D context; report paint calls and the save/restore balance. */
function traceDraw(spec: SpriteSpec): { paints: number; depth: number; minDepth: number } {
  const t = { paints: 0, depth: 0, minDepth: 0 };
  const store = new Map<string, unknown>();
  const ctx = new Proxy(
    {},
    {
      get(_target, prop): unknown {
        if (typeof prop !== 'string') return undefined;
        if (store.has(prop)) return store.get(prop);
        if (prop === 'save') return (): void => void t.depth++;
        if (prop === 'restore') {
          return (): void => {
            t.depth--;
            t.minDepth = Math.min(t.minDepth, t.depth);
          };
        }
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => ({ addColorStop: (): void => undefined });
        return (): void => {
          if (prop === 'fill' || prop === 'stroke' || prop === 'fillRect' || prop === 'strokeRect' || prop === 'drawImage') t.paints++;
        };
      },
      set(_target, prop, value): boolean {
        if (typeof prop === 'string') store.set(prop, value);
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  spec.draw(ctx);
  return t;
}

describe('HQ gun position sprites', () => {
  it('every nation names a style for every stage', () => {
    for (const f of FACTIONS) for (const style of NATION_LOOKS[f].hqGun) expect(STYLES).toContain(style);
  });

  it('build intact and ruin for every style and nation with unique keys and the layout box', () => {
    const keys = new Set<string>();
    for (const style of STYLES) {
      const box = HQ_GUN_LAYOUT[style].box;
      for (const f of FACTIONS) {
        const specs = hqGunSpecs(style, f);
        expect(specs.map((s) => s.key)).toEqual([hqGunKey(style, f, 'intact'), hqGunKey(style, f, 'ruin')]);
        for (const s of specs) {
          expect(keys.has(s.key), s.key).toBe(false);
          keys.add(s.key);
          expect(s.key.startsWith('st/hqgun/'), s.key).toBe(true);
          expect(s.w).toBe(box.w);
          expect(s.h).toBe(box.h);
          expect(s.ax * s.w).toBeCloseTo(box.ox, 9);
          expect(s.ay * s.h).toBeCloseTo(box.oy, 9);
          expect(Number.isInteger(s.w * VIEW.textureScale), `${s.key} width`).toBe(true);
          expect(Number.isInteger(s.h * VIEW.textureScale), `${s.key} height`).toBe(true);
        }
      }
    }
    expect(keys.size).toBe(STYLES.length * FACTIONS.length * 2);
  });

  it('put the muzzle inside the box, above the ground and toward the enemy', () => {
    for (const style of STYLES) {
      const { box, muzzle } = HQ_GUN_LAYOUT[style];
      const sx = box.ox + muzzle.x;
      const sy = box.oy + muzzle.y;
      expect(sx, `${style} muzzle x`).toBeGreaterThanOrEqual(0);
      expect(sx, `${style} muzzle x`).toBeLessThanOrEqual(box.w);
      expect(sy, `${style} muzzle y`).toBeGreaterThanOrEqual(0);
      expect(sy, `${style} muzzle y`).toBeLessThanOrEqual(box.h);
      expect(muzzle.y, `${style} muzzle above ground`).toBeLessThan(0);
      expect(muzzle.x, `${style} muzzle forward`).toBeGreaterThan(0);
    }
  });

  it('stand on the ground line: origin inside the box near its bottom, base centred', () => {
    for (const style of STYLES) {
      const { box } = HQ_GUN_LAYOUT[style];
      expect(box.oy, style).toBeGreaterThan(0);
      expect(box.oy, style).toBeLessThanOrEqual(box.h);
      // Only the dark footing strip may hang below the ground line.
      expect(box.h - box.oy, style).toBeLessThanOrEqual(8);
      expect(box.ox, style).toBeGreaterThan(box.w * 0.3);
      expect(box.ox, style).toBeLessThan(box.w * 0.7);
    }
  });

  it('draw something and leave the context balanced', () => {
    for (const style of STYLES) {
      for (const f of FACTIONS) {
        for (const s of hqGunSpecs(style, f)) {
          const t = traceDraw(s);
          expect(t.paints, s.key).toBeGreaterThan(20);
          expect(t.depth, s.key).toBe(0);
          expect(t.minDepth, s.key).toBe(0);
        }
      }
    }
  });
});
