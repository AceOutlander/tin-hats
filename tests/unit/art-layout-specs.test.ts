import { describe, expect, it } from 'vitest';
import {
  AIR_LAYOUT,
  DAMAGE_STATES,
  DECAL_LAYOUT,
  HQ_LAYOUT,
  PILLBOX_LAYOUT,
  SUPPLY_LAYOUT,
  TANK_LAYOUT,
  TRENCH_LAYOUT,
  WIRE_LAYOUT,
  FLAG_LAYOUT,
  type ArtBox,
  type ArtPoint,
} from '../../src/data/artLayout';
import { VIEW } from '../../src/data/view';
import { DECAL_KEYS, RUBBLE_KEYS, SUPPLY_KEYS, propSpecs } from '../../src/art/props';
import { FLAG_KEYS, TRENCH_KEYS, WIRE_KEYS, hqKey, pillboxKey, structureSpecs, trenchSpec } from '../../src/art/structures';
import { AIR_KEYS, TANK_KEYS, TANK_LOOKS, vehicleSpecs } from '../../src/art/vehicles';
import type { SpriteSpec } from '../../src/art/types';

const structures = structureSpecs();
const vehicles = vehicleSpecs();
const props = propSpecs();
const all = [...structures, ...vehicles, ...props];

/** Everything a recording stand-in for a 2D context saw while a sprite drew. */
interface Trace {
  hash: number;
  paints: number;
  depth: number;
  minDepth: number;
  /** State that differs from the defaults once the draw has finished. */
  leaked: string[];
}

const DEFAULTS: Record<string, unknown> = {
  globalAlpha: 1,
  globalCompositeOperation: 'source-over',
  lineWidth: 1,
  lineCap: 'butt',
  lineJoin: 'miter',
  miterLimit: 10,
  fillStyle: '#000000',
  strokeStyle: '#000000',
  shadowBlur: 0,
  shadowColor: 'rgba(0, 0, 0, 0)',
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  lineDashOffset: 0,
  filter: 'none',
  font: '10px sans-serif',
  textAlign: 'start',
  textBaseline: 'alphabetic',
};

const PAINT_CALLS = new Set(['fill', 'stroke', 'fillRect', 'strokeRect', 'drawImage', 'fillText', 'strokeText']);
const GRADIENTS = new Set(['createLinearGradient', 'createRadialGradient', 'createConicGradient']);

/** Run spec.draw against a recording stand-in context and report what happened. */
function traceDraw(spec: SpriteSpec): Trace {
  let store = new Map<string, unknown>(Object.entries(DEFAULTS));
  const stack: Map<string, unknown>[] = [];
  const trace: Trace = { hash: 2166136261, paints: 0, depth: 0, minDepth: 0, leaked: [] };
  const feed = (value: unknown): void => {
    const text = typeof value === 'number' ? String(Math.round(value * 1000)) : String(value);
    for (let i = 0; i < text.length; i++) trace.hash = Math.imul(trace.hash ^ text.charCodeAt(i), 16777619);
  };
  const ctx = new Proxy(
    {},
    {
      get(_target, prop): unknown {
        if (typeof prop !== 'string') return undefined;
        if (store.has(prop)) return store.get(prop);
        if (prop === 'save') {
          return (): void => {
            stack.push(new Map(store));
            trace.depth++;
          };
        }
        if (prop === 'restore') {
          return (): void => {
            trace.depth--;
            trace.minDepth = Math.min(trace.minDepth, trace.depth);
            const previous = stack.pop();
            if (previous) store = previous;
          };
        }
        if (GRADIENTS.has(prop)) {
          return (...args: unknown[]): unknown => {
            feed(prop);
            args.forEach(feed);
            return { addColorStop: (offset: number, color: string): void => feed(`${offset}${color}`) };
          };
        }
        return (...args: unknown[]): void => {
          feed(prop);
          args.forEach(feed);
          if (PAINT_CALLS.has(prop)) trace.paints++;
        };
      },
      set(_target, prop, value): boolean {
        if (typeof prop === 'string') {
          feed(prop);
          feed(value);
          store.set(prop, value);
        }
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  spec.draw(ctx);
  for (const [name, value] of Object.entries(DEFAULTS)) if (store.get(name) !== value) trace.leaked.push(name);
  return trace;
}

/** A sprite-space point from an offset against the sprite's origin. */
function spritePoint(box: ArtBox, p: ArtPoint): ArtPoint {
  return { x: box.ox + p.x, y: box.oy + p.y };
}

function expectInside(box: ArtBox, p: ArtPoint, what: string): void {
  const s = spritePoint(box, p);
  expect(s.x, `${what} x`).toBeGreaterThanOrEqual(0);
  expect(s.x, `${what} x`).toBeLessThanOrEqual(box.w);
  expect(s.y, `${what} y`).toBeGreaterThanOrEqual(0);
  expect(s.y, `${what} y`).toBeLessThanOrEqual(box.h);
}

describe('structure, vehicle and prop sprite specs', () => {
  it('have unique keys, namespaced st/, veh/ or prop/', () => {
    const keys = all.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const s of structures) expect(s.key.startsWith('st/'), s.key).toBe(true);
    for (const s of vehicles) expect(s.key.startsWith('veh/'), s.key).toBe(true);
    for (const s of props) expect(s.key.startsWith('prop/'), s.key).toBe(true);
  });

  it('cover exactly the keys the key tables name', () => {
    const named = new Set<string>();
    for (const faction of ['british', 'german'] as const) for (const state of DAMAGE_STATES) named.add(hqKey(faction, state));
    for (const state of DAMAGE_STATES) named.add(pillboxKey(state));
    Object.values(FLAG_KEYS).forEach((k) => named.add(k));
    Object.values(TRENCH_KEYS).forEach((k) => named.add(k));
    Object.values(WIRE_KEYS).forEach((k) => named.add(k));
    Object.values(AIR_KEYS).forEach((k) => named.add(k));
    for (const look of TANK_LOOKS) {
      const t = TANK_KEYS[look];
      [t.hull, t.turret, t.barrel, t.husk, ...t.track, ...t.wheels].forEach((k) => named.add(k));
    }
    Object.values(SUPPLY_KEYS).forEach((k) => named.add(k));
    Object.values(DECAL_KEYS).forEach((k) => named.add(k));
    RUBBLE_KEYS.forEach((k) => named.add(k));
    const keys = new Set(all.map((s) => s.key));
    for (const k of named) expect(keys.has(k), `missing sprite ${k}`).toBe(true);
    for (const k of keys) expect(named.has(k), `unlisted sprite ${k}`).toBe(true);
  });

  it('have sane sizes and anchors on whole texture pixels', () => {
    for (const s of all) {
      expect(s.w, s.key).toBeGreaterThan(0);
      expect(s.h, s.key).toBeGreaterThan(0);
      expect(Number.isInteger(s.w * VIEW.textureScale), `${s.key} width`).toBe(true);
      expect(Number.isInteger(s.h * VIEW.textureScale), `${s.key} height`).toBe(true);
      expect(s.ax, s.key).toBeGreaterThanOrEqual(0);
      expect(s.ax, s.key).toBeLessThanOrEqual(1);
      expect(s.ay, s.key).toBeGreaterThanOrEqual(0);
      expect(s.ay, s.key).toBeLessThanOrEqual(1);
    }
  });

  it('match the layout data boxes', () => {
    const byKey = new Map(all.map((s) => [s.key, s]));
    const expectBox = (key: string, box: ArtBox): void => {
      const s = byKey.get(key);
      expect(s, key).toBeDefined();
      if (!s) return;
      expect(s.w, `${key} w`).toBe(box.w);
      expect(s.h, `${key} h`).toBe(box.h);
      expect(s.ax * s.w, `${key} origin x`).toBeCloseTo(box.ox, 9);
      expect(s.ay * s.h, `${key} origin y`).toBeCloseTo(box.oy, 9);
    };
    for (const faction of ['british', 'german'] as const) for (const state of DAMAGE_STATES) expectBox(hqKey(faction, state), HQ_LAYOUT[faction].box);
    for (const state of DAMAGE_STATES) expectBox(pillboxKey(state), PILLBOX_LAYOUT.box);
    expectBox(WIRE_KEYS.back, WIRE_LAYOUT.backBox);
    expectBox(WIRE_KEYS.front, WIRE_LAYOUT.frontBox);
    expectBox(WIRE_KEYS.crushed, WIRE_LAYOUT.crushedBox);
    expectBox(WIRE_KEYS.cut, WIRE_LAYOUT.cutBox);
    expectBox(SUPPLY_KEYS.dump, SUPPLY_LAYOUT.dumpBox);
    expectBox(SUPPLY_KEYS.crate, SUPPLY_LAYOUT.crateBox);
    expectBox(SUPPLY_KEYS.dropCrate, SUPPLY_LAYOUT.dropCrateBox);
    expectBox(SUPPLY_KEYS.parachute, SUPPLY_LAYOUT.parachuteBox);
    expectBox(AIR_KEYS.plane, AIR_LAYOUT.planeBox);
    expectBox(AIR_KEYS.shadow, AIR_LAYOUT.shadowBox);
    expectBox(AIR_KEYS.rocket, AIR_LAYOUT.rocketBox);
    expectBox(AIR_KEYS.bomb, AIR_LAYOUT.bombBox);
    expectBox(DECAL_KEYS.crater, DECAL_LAYOUT.craterBox);
    expectBox(DECAL_KEYS.scorch, DECAL_LAYOUT.scorchBox);
    RUBBLE_KEYS.forEach((k) => expectBox(k, DECAL_LAYOUT.rubbleBox));
    for (const look of TANK_LOOKS) {
      const L = TANK_LAYOUT[look];
      const K = TANK_KEYS[look];
      expectBox(K.hull, L.hullBox);
      expectBox(K.turret, L.turretBox);
      expectBox(K.barrel, L.barrelBox);
      expectBox(K.husk, L.huskBox);
      K.track.forEach((k) => expectBox(k, L.trackBox));
    }
    expectBox(TRENCH_KEYS.backMid, { w: TRENCH_LAYOUT.tileW, h: TRENCH_LAYOUT.backH, ox: 0, oy: TRENCH_LAYOUT.backOy });
    expectBox(TRENCH_KEYS.frontMid, { w: TRENCH_LAYOUT.tileW, h: TRENCH_LAYOUT.frontH, ox: 0, oy: TRENCH_LAYOUT.frontOy });
    expectBox(TRENCH_KEYS.backCapL, { w: TRENCH_LAYOUT.capW, h: TRENCH_LAYOUT.backH, ox: 0, oy: TRENCH_LAYOUT.backOy });
    expectBox(TRENCH_KEYS.frontCapR, { w: TRENCH_LAYOUT.capW, h: TRENCH_LAYOUT.frontH, ox: 0, oy: TRENCH_LAYOUT.frontOy });
    expectBox(FLAG_KEYS.unionJack, { w: FLAG_LAYOUT.w, h: FLAG_LAYOUT.h, ox: 0, oy: 0 });
    expectBox(FLAG_KEYS.balkenkreuz, { w: FLAG_LAYOUT.w, h: FLAG_LAYOUT.h, ox: 0, oy: 0 });
  });

  it('draw something, keep save and restore balanced, leave no state behind, and draw the same way twice', () => {
    for (const s of all) {
      const first = traceDraw(s);
      const second = traceDraw(s);
      expect(first.paints, `${s.key} paints`).toBeGreaterThan(0);
      expect(first.depth, `${s.key} save/restore balance`).toBe(0);
      expect(first.minDepth, `${s.key} restore without save`).toBe(0);
      expect(first.leaked, `${s.key} leaked state`).toEqual([]);
      expect(second.hash, `${s.key} deterministic`).toBe(first.hash);
    }
  });

  it('build one-piece trench sprites of any width on whole pixels', () => {
    for (const width of [80, 130, 200, 331, 480, 900]) {
      for (const layer of ['back', 'front'] as const) {
        const s = trenchSpec(layer, width);
        expect(s.key.startsWith('st/trench/'), s.key).toBe(true);
        expect(s.w, s.key).toBeCloseTo(Math.max(width, 2 * TRENCH_LAYOUT.capW + TRENCH_LAYOUT.tileW * 0.5), 6);
        const t = traceDraw(s);
        expect(t.paints, s.key).toBeGreaterThan(0);
        expect(t.depth, s.key).toBe(0);
        expect(t.leaked, s.key).toEqual([]);
      }
    }
  });
});

describe('anchor points', () => {
  it('lie inside their sprite bounds for the HQ bunkers', () => {
    for (const faction of ['british', 'german'] as const) {
      const L = HQ_LAYOUT[faction];
      expectInside(L.box, { x: L.doorX - L.doorW / 2, y: 0 }, `${faction} door left foot`);
      expectInside(L.box, { x: L.doorX + L.doorW / 2, y: -L.doorH }, `${faction} door right top`);
      expectInside(L.box, L.gunSlit, `${faction} gun slit`);
      expectInside(L.box, L.flagBase, `${faction} flag base`);
      expectInside(L.box, L.flagTop, `${faction} flag top`);
      // The flag hangs from the top of the pole and extends toward +x.
      expectInside(L.box, { x: L.flagTop.x + FLAG_LAYOUT.w, y: L.flagTop.y + FLAG_LAYOUT.h + FLAG_LAYOUT.wave.droop }, `${faction} flag fly corner`);
      for (const f of L.fires) expectInside(L.box, f, `${faction} fire`);
      // The gun slit is on the enemy-facing (+x) half, the door is nearer the middle.
      expect(L.gunSlit.x).toBeGreaterThan(0);
      expect(L.gunSlit.x).toBeLessThanOrEqual(L.bodyW / 2 + 20);
      expect(L.flagTop.y).toBeLessThan(L.flagBase.y);
    }
  });

  it('lie inside their sprite bounds for the pillbox, supplies and aircraft', () => {
    expectInside(PILLBOX_LAYOUT.box, PILLBOX_LAYOUT.slit, 'pillbox slit');
    expectInside(PILLBOX_LAYOUT.box, PILLBOX_LAYOUT.centre, 'pillbox centre');
    expectInside(SUPPLY_LAYOUT.dumpBox, { x: SUPPLY_LAYOUT.dumpLoadX, y: 0 }, 'dump load point');
    expectInside(SUPPLY_LAYOUT.dropCrateBox, { x: 0, y: SUPPLY_LAYOUT.dropCrateHarnessY }, 'harness ring');
    expectInside(AIR_LAYOUT.planeBox, AIR_LAYOUT.rocketRail, 'rocket rail');
    expectInside(AIR_LAYOUT.planeBox, AIR_LAYOUT.bombBay, 'bomb bay');
  });

  it('lie inside the right parts for every tank', () => {
    for (const look of TANK_LOOKS) {
      const L = TANK_LAYOUT[look];
      const rel = (p: ArtPoint, from: ArtPoint): ArtPoint => ({ x: p.x - from.x, y: p.y - from.y });
      expectInside(L.hullBox, rel(L.turretRing, L.rockPivot), `${look} turret ring on hull`);
      expectInside(L.hullBox, rel(L.exhaust, L.rockPivot), `${look} exhaust on hull`);
      expectInside(L.hullBox, rel(L.hullMg, L.rockPivot), `${look} hull MG on hull`);
      expectInside(L.turretBox, rel(L.trunnion, L.turretRing), `${look} trunnion in turret`);
      for (const w of L.wheels) expectInside(L.trackBox, { x: w.x, y: w.y }, `${look} ${w.kind} wheel hub`);
      for (const p of L.belt) expectInside(L.trackBox, { x: p.x, y: p.y }, `${look} track pulley`);
      // The gun sticks out well past the front of the turret, and is shortest on the Panzer IV.
      expect(L.trunnion.x + L.barrelLength).toBeGreaterThan(L.turretRing.x + (L.turretBox.w - L.turretBox.ox) + 20);
    }
    const len = (look: (typeof TANK_LOOKS)[number]): number => TANK_LAYOUT[look].barrelLength;
    expect(len('panzer4')).toBeLessThan(len('churchill'));
    expect(len('churchill')).toBeLessThan(len('kingTiger'));
  });

  it('keep every tank a believable size next to a 58 wu figure', () => {
    for (const look of TANK_LOOKS) {
      const L = TANK_LAYOUT[look];
      expect(L.height).toBeGreaterThan(VIEW.figureHeight);
      expect(L.height).toBeLessThan(VIEW.figureHeight * 2.2);
      expect(L.length).toBeGreaterThan(VIEW.figureHeight * 3);
    }
    expect(TANK_LAYOUT.kingTiger.length).toBeGreaterThan(TANK_LAYOUT.churchill.length);
    expect(TANK_LAYOUT.kingTiger.height).toBeGreaterThan(TANK_LAYOUT.panzer4.height);
    expect(HQ_LAYOUT.british.bodyW).toBeCloseTo(300, -1);
    expect(PILLBOX_LAYOUT.bodyW).toBeCloseTo(90, -1);
  });
});
