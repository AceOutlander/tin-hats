import { describe, expect, it } from 'vitest';
import { listFxSprites } from '../../src/art/fx';
import { FX_KEYS, FX_PROJECTILE_SPRITE, FX_SPRITE_KEYS, FX_TRACERS } from '../../src/data/fx';
import { VIEW } from '../../src/data/view';

const specs = listFxSprites();
const keys = specs.map((spec) => spec.key);

describe('effect sprite specs', () => {
  it('have unique keys namespaced fx/', () => {
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key.startsWith('fx/')).toBe(true);
  });

  it('cover every particle sprite the presets can ask for', () => {
    for (const key of FX_SPRITE_KEYS) expect(keys).toContain(key);
  });

  it('cover every tracer type, projectile, rain, marker and decal key', () => {
    for (const look of Object.values(FX_TRACERS)) expect(keys).toContain(look.sprite);
    for (const byFaction of Object.values(FX_PROJECTILE_SPRITE)) {
      for (const key of Object.values(byFaction)) expect(keys).toContain(key);
    }
    const flat = [
      ...Object.values(FX_KEYS.tracer),
      ...Object.values(FX_KEYS.projectile),
      ...Object.values(FX_KEYS.rain),
      ...Object.values(FX_KEYS.ui),
      ...FX_KEYS.decal.crater,
      FX_KEYS.decal.scorch,
    ];
    for (const key of flat) expect(keys).toContain(key);
  });

  it('list nothing that no data key refers to', () => {
    const known = new Set<string>([
      ...FX_SPRITE_KEYS,
      ...Object.values(FX_KEYS.tracer),
      ...Object.values(FX_KEYS.projectile),
      ...Object.values(FX_KEYS.rain),
      ...Object.values(FX_KEYS.ui),
      ...FX_KEYS.decal.crater,
      FX_KEYS.decal.scorch,
    ]);
    for (const key of keys) expect(known.has(key)).toBe(true);
  });

  it('have sensible sizes and anchors, on whole texture pixels', () => {
    for (const spec of specs) {
      expect(spec.w).toBeGreaterThan(0);
      expect(spec.h).toBeGreaterThan(0);
      expect(spec.w).toBeLessThanOrEqual(160);
      expect(spec.h).toBeLessThanOrEqual(160);
      expect(Number.isInteger(spec.w * VIEW.textureScale)).toBe(true);
      expect(Number.isInteger(spec.h * VIEW.textureScale)).toBe(true);
      expect(spec.ax).toBeGreaterThanOrEqual(0);
      expect(spec.ax).toBeLessThanOrEqual(1);
      expect(spec.ay).toBeGreaterThanOrEqual(0);
      expect(spec.ay).toBeLessThanOrEqual(1);
      expect(typeof spec.draw).toBe('function');
    }
  });

  it('has several variants of the soft puffs and enough fireball frames to animate', () => {
    expect(keys.filter((key) => key.startsWith('fx/smoke/')).length).toBeGreaterThanOrEqual(3);
    expect(keys.filter((key) => key.startsWith('fx/fireball/')).length).toBeGreaterThanOrEqual(5);
    expect(keys.filter((key) => key.startsWith('fx/flash/')).length).toBeGreaterThanOrEqual(2);
  });

  it('is the same list every time', () => {
    expect(listFxSprites().map((spec) => `${spec.key}:${spec.w}x${spec.h}@${spec.ax},${spec.ay}`)).toEqual(
      specs.map((spec) => `${spec.key}:${spec.w}x${spec.h}@${spec.ax},${spec.ay}`),
    );
  });
});
