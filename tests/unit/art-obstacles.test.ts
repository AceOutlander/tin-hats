/**
 * Obstacle and water art (src/art/structures/obstacles.ts): every sprite draws something, leaves the context as it found
 * it, and keys stay unique; the battle view registers them for the missions that can show them (obstaclesNeeded).
 */
import { describe, expect, it } from 'vitest';
import { OBSTACLE_KEYS, obstacleSpecs } from '../../src/art/structures/obstacles';
import type { SpriteSpec } from '../../src/art/types';
import { getMission, MISSIONS } from '../../src/data/missions';
import { obstaclesNeeded } from '../../src/data/obstacles';

function traceDraw(spec: SpriteSpec): { paints: number; depth: number; minDepth: number; text: number } {
  const store = new Map<string, unknown>();
  const trace = { paints: 0, depth: 0, minDepth: 0, text: 0 };
  const ctx = new Proxy(
    {},
    {
      get(_target, prop): unknown {
        if (typeof prop !== 'string') return undefined;
        if (store.has(prop)) return store.get(prop);
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => ({ addColorStop: (): void => undefined });
        return (): void => {
          if (prop === 'save') trace.depth++;
          if (prop === 'restore') {
            trace.depth--;
            trace.minDepth = Math.min(trace.minDepth, trace.depth);
          }
          if (prop === 'fill' || prop === 'stroke' || prop === 'fillRect') trace.paints++;
          if (prop === 'fillText' || prop === 'strokeText') trace.text++;
        };
      },
      set(_target, prop, value): boolean {
        if (typeof prop === 'string') store.set(prop, value);
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  spec.draw(ctx);
  return trace;
}

describe('obstacle and water art', () => {
  it('draws every sprite, balanced, with no lettering (the mine signs are plain)', () => {
    const specs = obstacleSpecs();
    expect(specs.map((s) => s.key).sort()).toEqual(Object.values(OBSTACLE_KEYS).sort());
    expect(new Set(specs.map((s) => s.key)).size).toBe(specs.length);
    for (const spec of specs) {
      expect(spec.w, spec.key).toBeGreaterThan(0);
      expect(spec.h, spec.key).toBeGreaterThan(0);
      const t = traceDraw(spec);
      expect(t.paints, spec.key).toBeGreaterThan(0);
      expect(t.depth, `${spec.key} save/restore`).toBe(0);
      expect(t.minDepth, `${spec.key} restore before save`).toBe(0);
      expect(t.text, spec.key).toBe(0);
    }
  });

  it('is registered for the missions with obstacles, fields, bridges, ferries or such builds, and no others', () => {
    for (const id of [1001, 1003, 1005, 1006, 1007, 1008, 1009, 1010]) expect(obstaclesNeeded(getMission(id)!), String(id)).toBe(true);
    expect(obstaclesNeeded(getMission(1002)!)).toBe(false);
    expect(obstaclesNeeded(getMission(1004)!)).toBe(false);
    expect(MISSIONS.length).toBeGreaterThan(0);
  });
});
