/**
 * Nothing floats (owner, 2026-11-09: "floating flags with no pole"; the sweep: "every structure, flag and prop sprite's
 * base sits on the ground line"). Every sprite that stands on the ground (the HQs of every nation and style and their
 * damage states, the mission HQ buildings, the pillbox, the supply dumps, the battlefield buildings and cover props,
 * the obstacles, the dropped crate and the rubble) is drawn against a recording stand-in for a canvas, and the lowest
 * thing it paints must reach its origin's ground line: no lower edge hanging above the ground by more than a hair.
 * Sprites may sink a little into the ground (a dugout, a sandbagged foot); that is allowed. Flags are held to their
 * poles by tests/unit/flag-mounts.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { FACTIONS } from '../../src/data/factions';
import { MISSION_HQ_STYLES } from '../../src/data/looksBuilding';
import { HQ_STYLE_LAYOUT } from '../../src/data/looksHq';
import type { FactionId } from '../../src/data/schema';
import type { DumpStyle, HqStyle } from '../../src/data/upgradeLooks';
import { STALINGRAD_MISSIONS } from '../../src/data/missions/stalingrad';
import { hqSpecs } from '../../src/art/structures';
import { buildingSpecs, coverPropSpecs } from '../../src/art/structures/buildings';
import { missionHqSpecs } from '../../src/art/structures/hqBuildings';
import { hqStyleSpecs } from '../../src/art/structures/hqStyles';
import { OBSTACLE_KEYS, obstacleSpecs } from '../../src/art/structures/obstacles';
import { pillboxSpecs } from '../../src/art/structures/pillbox';
import { decalSpecs, supplySpecs } from '../../src/art/props';
import { dumpStyleSpecs } from '../../src/art/props/supplyLooks';
import type { SpriteSpec } from '../../src/art/types';

const NATIONS = Object.keys(FACTIONS) as FactionId[];
const DUMPS: readonly DumpStyle[] = ['crates', 'stacked', 'drums', 'truck'];
/** How far (sprite px) the lowest paint may stop above the origin's ground line: a hair, for anti-aliased edges. */
const HOVER_TOLERANCE = 1.5;

type M = [number, number, number, number, number, number];

/**
 * The lowest y (sprite pixels, down is +) a sprite paints with an opaque fill or stroke. Paths are followed through
 * translate, scale, rotate and save/restore, curves are sampled, rects and arcs are traced; paint with globalAlpha or a
 * fill that is fully transparent, and 'destination-out' cuts, do not count.
 */
function lowestPaint(spec: SpriteSpec): number {
  let m: M = [1, 0, 0, 1, 0, 0];
  const stack: Array<{ m: M; store: Map<string, unknown> }> = [];
  let store = new Map<string, unknown>([
    ['globalAlpha', 1],
    ['globalCompositeOperation', 'source-over'],
    ['fillStyle', '#000'],
    ['strokeStyle', '#000'],
    ['lineWidth', 1],
  ]);
  let pts: Array<[number, number]> = [];
  let last: [number, number] = [0, 0];
  let lowest = -Infinity;
  const at = (x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const add = (x: number, y: number): void => {
    last = [x, y];
    pts.push(at(x, y));
  };
  const transparent = (style: unknown): boolean => {
    if (typeof style !== 'string') return false; // a gradient or pattern: counts as paint
    const s = style.replace(/\s+/g, '');
    return /rgba\([^)]*,0(\.0+)?\)$/.test(s) || s === 'transparent';
  };
  const visible = (style: unknown): boolean =>
    Number(store.get('globalAlpha')) > 0.05 && store.get('globalCompositeOperation') !== 'destination-out' && !transparent(style);
  const paint = (points: Array<[number, number]>, extra = 0): void => {
    for (const [, y] of points) lowest = Math.max(lowest, y + extra);
  };
  const fns: Record<string, (...a: number[]) => unknown> = {
    save: () => void stack.push({ m: [...m] as M, store: new Map(store) }),
    restore: () => {
      const s = stack.pop();
      if (s) {
        m = s.m;
        store = s.store;
      }
    },
    translate: (x, y) => void (m = [m[0], m[1], m[2], m[3], m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]),
    scale: (sx, sy) => void (m = [m[0] * sx, m[1] * sx, m[2] * sy, m[3] * sy, m[4], m[5]]),
    rotate: (a) => {
      const c = Math.cos(a);
      const s = Math.sin(a);
      m = [m[0] * c + m[2] * s, m[1] * c + m[3] * s, m[2] * c - m[0] * s, m[3] * c - m[1] * s, m[4], m[5]];
    },
    transform: (a, b, c, d, e, f) => void (m = [m[0] * a + m[2] * b, m[1] * a + m[3] * b, m[0] * c + m[2] * d, m[1] * c + m[3] * d, m[0] * e + m[2] * f + m[4], m[1] * e + m[3] * f + m[5]]),
    setTransform: (a, b, c, d, e, f) => void (m = [a, b, c, d, e, f]),
    resetTransform: () => void (m = [1, 0, 0, 1, 0, 0]),
    beginPath: () => void (pts = []),
    moveTo: (x, y) => add(x, y),
    lineTo: (x, y) => add(x, y),
    closePath: () => undefined,
    quadraticCurveTo: (cx, cy, x, y) => {
      const [x0, y0] = last;
      for (let i = 1; i <= 8; i++) {
        const t = i / 8;
        add((1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * x, (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t * t * y);
      }
    },
    bezierCurveTo: (c1x, c1y, c2x, c2y, x, y) => {
      const [x0, y0] = last;
      for (let i = 1; i <= 10; i++) {
        const t = i / 10;
        const u = 1 - t;
        add(u ** 3 * x0 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t ** 3 * x, u ** 3 * y0 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t ** 3 * y);
      }
    },
    rect: (x, y, w, h) => {
      add(x, y);
      add(x + w, y);
      add(x + w, y + h);
      add(x, y + h);
    },
    roundRect: (x, y, w, h) => fns.rect(x, y, w, h),
    arc: (cx, cy, r, a0, a1, ccw) => {
      let span = (a1 ?? Math.PI * 2) - (a0 ?? 0);
      if (ccw) span = -(((-span % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) || Math.PI * 2);
      else span = ((span % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) || Math.PI * 2;
      for (let i = 0; i <= 16; i++) {
        const a = (a0 ?? 0) + (span * i) / 16;
        add(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
    },
    ellipse: (cx, cy, rx, ry, rot, a0, a1) => {
      for (let i = 0; i <= 16; i++) {
        const a = a0 + ((a1 - a0) * i) / 16;
        const ex = Math.cos(a) * rx;
        const ey = Math.sin(a) * ry;
        add(cx + ex * Math.cos(rot) - ey * Math.sin(rot), cy + ex * Math.sin(rot) + ey * Math.cos(rot));
      }
    },
    fill: () => {
      if (visible(store.get('fillStyle'))) paint(pts);
    },
    stroke: () => {
      if (visible(store.get('strokeStyle'))) paint(pts, (Number(store.get('lineWidth')) || 1) / 2);
    },
    fillRect: (x, y, w, h) => {
      if (visible(store.get('fillStyle'))) paint([at(x, y), at(x + w, y), at(x + w, y + h), at(x, y + h)]);
    },
    strokeRect: (x, y, w, h) => {
      if (visible(store.get('strokeStyle'))) paint([at(x, y), at(x + w, y), at(x + w, y + h), at(x, y + h)], (Number(store.get('lineWidth')) || 1) / 2);
    },
  };
  const ctx = new Proxy(
    {},
    {
      get(_t, prop): unknown {
        if (typeof prop !== 'string') return undefined;
        if (prop in fns) return fns[prop];
        if (store.has(prop)) return store.get(prop);
        if (prop.startsWith('create')) return () => ({ addColorStop: () => undefined });
        return () => undefined;
      },
      set(_t, prop, value): boolean {
        if (typeof prop === 'string') store.set(prop, value);
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  // Sprite space: draw() works from the sprite's top-left corner (src/art/types.ts SpriteSpec.draw).
  spec.draw(ctx);
  return lowest;
}

/** How far (px) the lowest paint stops above the sprite's ground line: its anchor, ay * h below its top-left corner. */
function hover(spec: SpriteSpec): number {
  return spec.ay * spec.h - lowestPaint(spec);
}

/** Two pieces drawn at the same anchor, as one sprite (same box). */
function unionOf(a: SpriteSpec, b: SpriteSpec): SpriteSpec {
  return { ...a, key: `${a.key}+${b.key}`, draw: (ctx) => {
    a.draw(ctx);
    ctx.save();
    // b's box against a's: line up the anchors.
    ctx.translate(a.ax * a.w - b.ax * b.w, a.ay * a.h - b.ay * b.h);
    b.draw(ctx);
    ctx.restore();
  } };
}

/** Every sprite that stands on the ground, by what it is. */
function groundSprites(): Array<[string, SpriteSpec]> {
  const out: Array<[string, SpriteSpec]> = [];
  const push = (what: string, specs: SpriteSpec[], keep: (s: SpriteSpec) => boolean = () => true): void => {
    for (const s of specs) if (keep(s)) out.push([`${what} ${s.key}`, s]);
  };
  push('HQ', hqSpecs());
  push('pillbox', pillboxSpecs());
  for (const style of Object.keys(HQ_STYLE_LAYOUT) as HqStyle[]) for (const n of NATIONS) push('HQ style', hqStyleSpecs(style, n));
  for (const style of MISSION_HQ_STYLES) for (const n of NATIONS) push('mission HQ', missionHqSpecs(style, n));
  for (const style of DUMPS) for (const n of NATIONS) push('dump', dumpStyleSpecs(style, n));
  push('supplies', supplySpecs(), (s) => !s.key.includes('parachute') && !s.key.includes('crate'));
  push('rubble', decalSpecs(), (s) => s.key.includes('rubble'));
  // An obstacle's back and front pieces stand at one anchor (the front drawn over the men, the back behind them):
  // together they reach the ground. The boat's load rides in the boat (its own anchor on the water), not on the ground.
  const obstacles = obstacleSpecs();
  const byKey = new Map(obstacles.map((s) => [s.key, s]));
  for (const s of obstacles) {
    if (s.key === OBSTACLE_KEYS.boatLoad) continue;
    const pair = s.key.endsWith('Back') ? byKey.get(s.key.replace(/Back$/, 'Front')) : undefined;
    if (s.key.endsWith('Front') && byKey.has(s.key.replace(/Front$/, 'Back'))) continue;
    out.push([`obstacle ${s.key}${pair ? ' with its front' : ''}`, pair ? unionOf(s, pair) : s]);
  }
  const seen = new Set<string>();
  for (const m of STALINGRAD_MISSIONS) {
    for (const b of m.buildings ?? []) {
      const id = `${b.look}|${b.width}|${b.slotsPerFloor}`;
      if (seen.has(id)) continue;
      seen.add(id);
      push(`building ${m.id}`, buildingSpecs(b.look, b.width, b.slotsPerFloor), (s) => /ground|rubble/.test(s.key));
    }
    for (const p of m.props ?? []) {
      const id = `${p.look}|${p.width}`;
      if (seen.has(id)) continue;
      seen.add(id);
      push(`cover prop ${m.id}`, coverPropSpecs(p.look, p.width));
    }
  }
  return out;
}

describe('every structure and prop stands on the ground', () => {
  const sprites = groundSprites();

  it('finds the sprites to check', () => {
    expect(sprites.length).toBeGreaterThan(60);
  });

  it('paints every ground sprite down to its ground line (nothing hovers)', () => {
    const floating = sprites.map(([what, s]) => [what, hover(s)] as const).filter(([, h]) => h > HOVER_TOLERANCE);
    expect(floating.map(([what, h]) => `${what}: lowest paint ${h.toFixed(1)} px above the ground`)).toEqual([]);
  });
});
