import { describe, expect, it } from 'vitest';
import { DAMAGE_STATES, FLAG_LAYOUT, HQ_LAYOUT, type ArtBox, type ArtPoint } from '../../src/data/artLayout';
import { HQ_STYLE_LAYOUT } from '../../src/data/looksHq';
import type { FactionId } from '../../src/data/schema';
import { NATION_LOOKS, type HqStyle } from '../../src/data/upgradeLooks';
import { VIEW } from '../../src/data/view';
import { hqKey, hqSpecs } from '../../src/art/structures';
import { hqStyleKey, hqStyleSpecs } from '../../src/art/structures/hqStyles';
import type { SpriteSpec } from '../../src/art/types';

const FACTION_IDS = Object.keys(NATION_LOOKS) as FactionId[];

/** Every (style, faction) pair a nation's HQ upgrade track can show. */
const PAIRS: { style: HqStyle; faction: FactionId }[] = FACTION_IDS.flatMap((faction) =>
  [...new Set(NATION_LOOKS[faction].hq)].map((style) => ({ style, faction })),
);

interface Trace {
  paints: number;
  depth: number;
  minDepth: number;
  strokes: number;
}

/** Run spec.draw against a recording stand-in for a 2D context. */
function traceDraw(spec: SpriteSpec): Trace {
  const store = new Map<string, unknown>();
  const trace: Trace = { paints: 0, depth: 0, minDepth: 0, strokes: 0 };
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
          if (prop === 'stroke') trace.strokes++;
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

function expectInside(box: ArtBox, p: ArtPoint, what: string): void {
  expect(box.ox + p.x, `${what} x`).toBeGreaterThanOrEqual(0);
  expect(box.ox + p.x, `${what} x`).toBeLessThanOrEqual(box.w);
  expect(box.oy + p.y, `${what} y`).toBeGreaterThanOrEqual(0);
  expect(box.oy + p.y, `${what} y`).toBeLessThanOrEqual(box.h);
}

describe('HQ upgrade styles', () => {
  it('give every style on every nation track three specs with unique keys, sized to the layout box', () => {
    const keys = new Set<string>();
    for (const { style, faction } of PAIRS) {
      const specs = hqStyleSpecs(style, faction);
      const box = HQ_STYLE_LAYOUT[style].box;
      expect(specs.map((s) => s.key)).toEqual(DAMAGE_STATES.map((state) => hqStyleKey(style, faction, state)));
      for (const s of specs) {
        expect(keys.has(s.key), `duplicate key ${s.key}`).toBe(false);
        keys.add(s.key);
        expect(s.key.startsWith('st/'), s.key).toBe(true);
        expect(s.w, s.key).toBe(box.w);
        expect(s.h, s.key).toBe(box.h);
        expect(s.ax * s.w, `${s.key} origin x`).toBeCloseTo(box.ox, 9);
        expect(s.ay * s.h, `${s.key} origin y`).toBeCloseTo(box.oy, 9);
        expect(Number.isInteger(s.w * VIEW.textureScale), `${s.key} width`).toBe(true);
        expect(Number.isInteger(s.h * VIEW.textureScale), `${s.key} height`).toBe(true);
      }
    }
    // Every HQ style is used by some nation.
    expect(new Set(PAIRS.map((p) => p.style)).size).toBe(Object.keys(HQ_STYLE_LAYOUT).length);
  });

  it('keep the doorway inside the body and the gun position clear beyond its right edge', () => {
    for (const style of Object.keys(HQ_STYLE_LAYOUT) as HqStyle[]) {
      const L = HQ_STYLE_LAYOUT[style];
      expect(L.doorW, `${style} door width`).toBeGreaterThanOrEqual(30);
      expect(L.doorH, `${style} door height`).toBeGreaterThanOrEqual(58);
      expect(L.doorX - L.doorW / 2, `${style} door left`).toBeGreaterThanOrEqual(-L.bodyW / 2);
      expect(L.doorX + L.doorW / 2, `${style} door right`).toBeLessThanOrEqual(L.bodyW / 2);
      expect(L.doorH, `${style} door under the roof`).toBeLessThanOrEqual(L.bodyH);
      expect(L.gunNest.y, `${style} gun on the ground`).toBe(0);
      expect(L.gunNest.x - L.bodyW / 2, `${style} gun clear of the body`).toBeGreaterThanOrEqual(30);
      expectInside(L.box, { x: L.doorX - L.doorW / 2, y: 0 }, `${style} door left foot`);
      expectInside(L.box, { x: L.doorX + L.doorW / 2, y: -L.doorH }, `${style} door right top`);
      expectInside(L.box, { x: -L.bodyW / 2, y: -L.bodyH }, `${style} body top left`);
      expectInside(L.box, { x: L.bodyW / 2, y: 0 }, `${style} body bottom right`);
      expectInside(L.box, L.flagBase, `${style} flag base`);
      expectInside(L.box, L.flagTop, `${style} flag top`);
      expectInside(L.box, { x: L.flagTop.x + FLAG_LAYOUT.w, y: L.flagTop.y + FLAG_LAYOUT.h + FLAG_LAYOUT.wave.droop }, `${style} flag fly`);
      expect(L.flagTop.y).toBeLessThan(L.flagBase.y);
      expect(L.fires.length, `${style} fires`).toBeGreaterThan(0);
      for (const f of L.fires) expectInside(L.box, f, `${style} fire`);
    }
  });

  it('grow from tent to bunker', () => {
    const w = (s: HqStyle): number => HQ_STYLE_LAYOUT[s].bodyW;
    expect(w('tent')).toBeLessThan(w('bigTent'));
    expect(w('bigTent')).toBeLessThan(w('dugout'));
    expect(w('dugout')).toBeLessThanOrEqual(w('bunkerBritish'));
    expect(HQ_STYLE_LAYOUT.bunkerBritish.box).toEqual(HQ_LAYOUT.british.box);
    expect(HQ_STYLE_LAYOUT.bunkerGerman.doorX).toBe(HQ_LAYOUT.german.doorX);
  });

  it('draw something with balanced save and restore', () => {
    for (const { style, faction } of PAIRS) {
      for (const s of hqStyleSpecs(style, faction)) {
        const t = traceDraw(s);
        expect(t.paints, `${s.key} paints`).toBeGreaterThan(0);
        expect(t.depth, `${s.key} save/restore balance`).toBe(0);
        expect(t.minDepth, `${s.key} restore without save`).toBe(0);
      }
    }
  });

  it('draw the bunkers without the gun the old HQ sprites have in the slit', () => {
    const old = new Map(hqSpecs().map((s) => [s.key, s]));
    const bunkers: [HqStyle, FactionId][] = [
      ['bunkerBritish', 'british'],
      ['bunkerGerman', 'german'],
    ];
    for (const [style, faction] of bunkers) {
      for (const [i, s] of hqStyleSpecs(style, faction).entries()) {
        const before = old.get(hqKey(faction, DAMAGE_STATES[i]));
        expect(before, style).toBeDefined();
        if (!before) continue;
        // The machine gun is four strokes; nothing else differs.
        expect(traceDraw(before).strokes - traceDraw(s).strokes, s.key).toBe(4);
      }
    }
  });
});
