import { describe, expect, it } from 'vitest';
import type { ArtBox } from '../../src/data/artLayout';
import { FIGURE_CRATE } from '../../src/data/figure';
import { BIG_LOAD_BOX, CART_LAYOUT, DUMP_STYLE_LAYOUT, SUPPLY_TRUCK_LAYOUT } from '../../src/data/looksSupply';
import type { FactionId } from '../../src/data/schema';
import { NATION_LOOKS, SAPPER_CART_HANDLE } from '../../src/data/upgradeLooks';
import { VIEW } from '../../src/data/view';
import {
  DUMP_STYLE_LIST,
  TRUCK_STATES,
  bigLoadKey,
  bigLoadSpec,
  cartKey,
  cartSpecs,
  dumpStyleKey,
  dumpStyleSpecs,
  supplyLookSpecs,
  truckKey,
  truckSpecs,
} from '../../src/art/props/supplyLooks';
import type { SpriteSpec } from '../../src/art/types';

const FACTIONS: FactionId[] = ['british', 'german', 'soviet'];

interface DrawCounts {
  paints: number;
  depth: number;
  /** Horizontal extent of the geometry, in sprite space (translations only). */
  minX: number;
  maxX: number;
}

/**
 * A do-nothing stand-in for a 2D context that counts paint calls and save/restore balance, and tracks the x extent
 * of path points and rectangles under translations (sprites that rotate or scale would need more).
 */
function drawCounts(spec: SpriteSpec): DrawCounts {
  const counts: DrawCounts = { paints: 0, depth: 0, minX: Infinity, maxX: -Infinity };
  const paint = new Set(['fill', 'stroke', 'fillRect', 'strokeRect']);
  let tx = 0;
  const stack: number[] = [];
  const see = (x: number): void => {
    counts.minX = Math.min(counts.minX, x + tx);
    counts.maxX = Math.max(counts.maxX, x + tx);
  };
  const ctx = new Proxy(
    {},
    {
      get(_t, prop): unknown {
        if (prop === 'save') {
          return (): void => {
            stack.push(tx);
            counts.depth++;
          };
        }
        if (prop === 'restore') {
          return (): void => {
            tx = stack.pop() ?? 0;
            counts.depth--;
          };
        }
        if (prop === 'translate') return (x: number): void => void (tx += x);
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => ({ addColorStop: (): void => undefined });
        return (...a: number[]): void => {
          if (prop === 'moveTo' || prop === 'lineTo') see(a[0]);
          if (prop === 'fillRect') {
            see(a[0]);
            see(a[0] + a[2]);
          }
          if (prop === 'arc') {
            see(a[0] - a[2]);
            see(a[0] + a[2]);
          }
          if (typeof prop === 'string' && paint.has(prop)) counts.paints++;
        };
      },
      set: (): boolean => true,
    },
  ) as unknown as CanvasRenderingContext2D;
  spec.draw(ctx);
  return counts;
}

function expectBox(spec: SpriteSpec, box: ArtBox): void {
  expect(spec.w, `${spec.key} w`).toBe(box.w);
  expect(spec.h, `${spec.key} h`).toBe(box.h);
  expect(spec.ax * spec.w, `${spec.key} origin x`).toBeCloseTo(box.ox, 9);
  expect(spec.ay * spec.h, `${spec.key} origin y`).toBeCloseTo(box.oy, 9);
}

describe('supply look sprites', () => {
  const all = FACTIONS.flatMap((f) => supplyLookSpecs(f));

  it('cover every dump style, the big load, both carts and every truck state per nation, with unique keys', () => {
    const keys = all.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
    const named: string[] = [];
    for (const f of FACTIONS) {
      for (const style of DUMP_STYLE_LIST) {
        const specs = dumpStyleSpecs(style, f);
        expect(specs.map((s) => s.key)).toEqual([dumpStyleKey(style, f)]);
        expectBox(specs[0], DUMP_STYLE_LAYOUT[style].box);
        named.push(dumpStyleKey(style, f));
      }
      // Every dump style a nation's look track names has a sprite.
      for (const style of NATION_LOOKS[f].dump) expect(DUMP_STYLE_LIST).toContain(style);
      expect(bigLoadSpec(f).key).toBe(bigLoadKey(f));
      named.push(bigLoadKey(f));
      expect(cartSpecs(f).map((s) => s.key).sort()).toEqual([cartKey(f, false), cartKey(f, true)].sort());
      named.push(cartKey(f, false), cartKey(f, true));
      expect(truckSpecs(f).map((s) => s.key)).toEqual(TRUCK_STATES.map((st) => truckKey(f, st)));
      named.push(...TRUCK_STATES.map((st) => truckKey(f, st)));
    }
    expect(keys.sort()).toEqual(named.sort());
  });

  it('draw something, balance save/restore and sit on whole texture pixels', () => {
    for (const s of all) {
      const c = drawCounts(s);
      expect(c.paints, s.key).toBeGreaterThan(0);
      expect(c.depth, s.key).toBe(0);
      expect(Number.isInteger(s.w * VIEW.textureScale), `${s.key} width`).toBe(true);
      expect(Number.isInteger(s.h * VIEW.textureScale), `${s.key} height`).toBe(true);
      const ox = s.ax * s.w * VIEW.textureScale;
      expect(Math.abs(ox - Math.round(ox)), `${s.key} origin on a texture pixel`).toBeLessThan(1e-6);
    }
  });

  it('keep the big load centred like the crate part and at most 1.5x its size', () => {
    const crateW = FIGURE_CRATE.halfW * 2;
    const crateH = FIGURE_CRATE.halfH * 2;
    for (const f of FACTIONS) {
      const s = bigLoadSpec(f);
      expectBox(s, BIG_LOAD_BOX);
      expect(s.ax).toBeCloseTo(0.5, 9);
      expect(s.ay).toBeCloseTo(0.5, 9);
      expect(s.w).toBeGreaterThan(crateW);
      expect(s.w).toBeLessThanOrEqual(crateW * 1.5);
      expect(s.h).toBeGreaterThan(crateH);
      expect(s.h).toBeLessThanOrEqual(crateH * 1.5);
    }
  });

  it('put the cart handle grip and wheel inside the cart box, wheel on the ground, body forward', () => {
    const b = CART_LAYOUT.box;
    const inside = (x: number, y: number): boolean => b.ox + x >= 0 && b.ox + x <= b.w && b.oy + y >= 0 && b.oy + y <= b.h;
    expect(inside(0, SAPPER_CART_HANDLE.y)).toBe(true);
    expect(inside(CART_LAYOUT.wheel.x, CART_LAYOUT.wheel.y)).toBe(true);
    expect(CART_LAYOUT.wheel.y + CART_LAYOUT.wheelRadius).toBeCloseTo(0, 9);
    expect(CART_LAYOUT.wheel.x).toBeGreaterThan(0);
    // Most of the cart lies ahead of the grip.
    expect(b.w - b.ox).toBeGreaterThan(b.ox * 4);
    for (const f of FACTIONS) for (const s of cartSpecs(f)) expectBox(s, b);
  });

  it('size the truck to its layout length', () => {
    const L = SUPPLY_TRUCK_LAYOUT;
    expect(L.length).toBeGreaterThanOrEqual(90);
    expect(L.length).toBeLessThanOrEqual(110);
    // The box holds the truck's length with a small margin for the bumper, centred on the origin.
    expect(L.box.w).toBeGreaterThanOrEqual(L.length);
    expect(L.box.w - L.length).toBeLessThanOrEqual(16);
    expect(L.box.ox).toBeCloseTo(L.box.w / 2, 9);
    expect(L.box.oy).toBeLessThanOrEqual(L.box.h);
    for (const f of FACTIONS) {
      for (const s of truckSpecs(f)) expectBox(s, L.box);
      // The painted truck (bumper to tailboard) is as long as the layout says, centred on the origin.
      const c = drawCounts(truckSpecs(f)[TRUCK_STATES.indexOf('empty')]);
      expect(c.maxX - c.minX, `${f} truck length`).toBeGreaterThanOrEqual(L.length - 4);
      expect(c.maxX - c.minX, `${f} truck length`).toBeLessThanOrEqual(L.length + 4);
      expect(Math.abs((c.minX + c.maxX) / 2 - L.box.ox), `${f} truck centre`).toBeLessThan(2);
    }
  });
});
