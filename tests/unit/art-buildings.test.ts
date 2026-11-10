/**
 * Building, cover-prop and mission-HQ art (FOUNDATIONS.md 4.3; src/art/structures/buildings.ts and hqBuildings.ts):
 * every look draws every piece, leaves the context as it found it, keys stay unique, and the mission HQ layouts' points
 * sit inside their boxes.
 */
import { describe, expect, it } from 'vitest';
import { BUILDING_PIECES, buildingKey, buildingSpecs, coverPropSpecs, propKey, windowXs } from '../../src/art/structures/buildings';
import { missionHqKey, missionHqSpecs } from '../../src/art/structures/hqBuildings';
import type { SpriteSpec } from '../../src/art/types';
import { DAMAGE_STATES, type ArtPoint } from '../../src/data/artLayout';
import { BUILDING_STYLES, MISSION_HQ_LAYOUT, MISSION_HQ_STYLES, PROP_LAYOUT } from '../../src/data/looksBuilding';
import type { BuildingLook, CoverPropLook } from '../../src/data/schema';
import { MISSIONS } from '../../src/data/missions';

const LOOKS = Object.keys(BUILDING_STYLES) as BuildingLook[];
const PROPS = Object.keys(PROP_LAYOUT) as CoverPropLook[];

interface Trace {
  paints: number;
  depth: number;
  minDepth: number;
}

/** Run spec.draw against a recording stand-in for a 2D context. */
function traceDraw(spec: SpriteSpec): Trace {
  const store = new Map<string, unknown>();
  const trace: Trace = { paints: 0, depth: 0, minDepth: 0 };
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

function expectDraws(spec: SpriteSpec): void {
  expect(spec.w, spec.key).toBeGreaterThan(0);
  expect(spec.h, spec.key).toBeGreaterThan(0);
  const t = traceDraw(spec);
  expect(t.paints, spec.key).toBeGreaterThan(0);
  expect(t.depth, `${spec.key} save/restore`).toBe(0);
  expect(t.minDepth, `${spec.key} restore before save`).toBe(0);
}

describe('building art', () => {
  it('has a style for each of the twelve looks the brief names', () => {
    expect(new Set(LOOKS)).toEqual(
      new Set(['casemate', 'church', 'izba', 'house', 'apartment', 'station', 'factoryHall', 'waterTank', 'mill', 'store', 'hangar', 'sheds']),
    );
  });

  it.each(LOOKS)('draws every piece of a %s, intact, damaged and as rubble', (look) => {
    const specs = buildingSpecs(look, 180, 4);
    expect(specs.map((s) => s.key)).toEqual(BUILDING_PIECES.map((p) => buildingKey(look, 180, 4, p)));
    for (const spec of specs) expectDraws(spec);
  });

  it('puts one window per slot inside the footprint', () => {
    for (const [width, slots] of [
      [120, 3],
      [220, 7],
      [260, 10],
    ]) {
      const xs = windowXs(width, slots);
      expect(xs).toHaveLength(slots);
      for (const x of xs) expect(Math.abs(x)).toBeLessThan(width / 2);
      for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1]);
    }
  });

  it.each(PROPS)('draws the %s cover prop, back and front', (look) => {
    const specs = coverPropSpecs(look, 160);
    expect(specs.map((s) => s.key)).toEqual([propKey(look, 160, 'back'), propKey(look, 160, 'front')]);
    for (const spec of specs) expectDraws(spec);
  });

  it('has art for every building and prop of every mission, with unique keys', () => {
    const keys = new Set<string>();
    for (const m of MISSIONS) {
      for (const b of m.buildings ?? []) {
        expect(LOOKS, `${m.id} B${b.id}`).toContain(b.look);
        for (const s of buildingSpecs(b.look, b.width, b.slotsPerFloor)) keys.add(s.key);
      }
      for (const p of m.props ?? []) {
        expect(PROPS, `${m.id} prop ${p.id}`).toContain(p.look);
        for (const s of coverPropSpecs(p.look, p.width)) keys.add(s.key);
      }
    }
    expect(keys.size).toBeGreaterThan(0);
  });
});

describe('mission HQ buildings', () => {
  const inside = (box: { ox: number; oy: number; w: number; h: number }, p: ArtPoint, what: string): void => {
    expect(box.ox + p.x, `${what} x`).toBeGreaterThanOrEqual(0);
    expect(box.ox + p.x, `${what} x`).toBeLessThanOrEqual(box.w);
    expect(box.oy + p.y, `${what} y`).toBeGreaterThanOrEqual(0);
    expect(box.oy + p.y, `${what} y`).toBeLessThanOrEqual(box.h);
  };

  it.each(MISSION_HQ_STYLES)('draws the %s in its three damage states, its points inside the box', (style) => {
    const specs = missionHqSpecs(style, 'soviet');
    expect(specs.map((s) => s.key)).toEqual(DAMAGE_STATES.map((st) => missionHqKey(style, 'soviet', st)));
    for (const spec of specs) expectDraws(spec);
    const L = MISSION_HQ_LAYOUT[style];
    inside(L.box, L.flagTop, `${style} flag`);
    for (const [i, f] of L.fires.entries()) inside(L.box, f, `${style} fire ${i}`);
    expect(L.doorX - L.doorW / 2).toBeGreaterThan(-L.bodyW / 2);
    expect(L.doorX + L.doorW / 2).toBeLessThan(L.bodyW / 2);
  });

  it('is what the Stalingrad missions put their HQs in', () => {
    const looks = (id: number): (string | undefined)[] => MISSIONS.find((m) => m.id === id)?.start.map((s) => s.hqLook) ?? [];
    expect(looks(1001)).toContain('casemate');
    expect(looks(1002)).toContain('dugout');
    expect(looks(1004)).toContain('bunkerGerman');
    expect(looks(1007)).toContain('mill');
    expect(looks(1010)).toContain('store');
  });
});
