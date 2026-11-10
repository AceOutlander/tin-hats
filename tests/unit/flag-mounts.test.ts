/**
 * No flag without a pole (owner, 2026-11-09): "Every flag must hang from a visible flagpole that's attached to
 * something: planted in the ground, fixed to a roof or wall, or stuck into sandbags. The flag's edge attaches to the
 * pole and waves away from it, and the pole stands straight and sits on the surface it's mounted on."
 *
 * Every flag the battle shows is one of: an HQ's flag (the Quartermaster's HQ styles, the nations' bunkers and the
 * missions' own HQ buildings such as Brest's casemate), a capture point's flag, or a trench's pennant. For each, the
 * cloth's hoist is on its pole, within the pole's height (src/render/flagMounts.ts); every HQ sprite really draws that
 * pole, straight, from its foot on the ground, roof or dugout top up past the flag (traced from its drawing calls).
 */
import { describe, expect, it } from 'vitest';
import { DAMAGE_STATES, FLAG_LAYOUT, HQ_LAYOUT, type ArtBox, type ArtPoint } from '../../src/data/artLayout';
import { BUILDING_LAYOUT, MISSION_HQ_LAYOUT, MISSION_HQ_STYLES, ROOF_FLAGPOLE_H } from '../../src/data/looksBuilding';
import { HQ_STYLE_LAYOUT } from '../../src/data/looksHq';
import type { FactionId } from '../../src/data/schema';
import type { HqStyle } from '../../src/data/upgradeLooks';
import { VIEW } from '../../src/data/view';
import { hqSpecs } from '../../src/art/structures';
import { missionHqSpecs } from '../../src/art/structures/hqBuildings';
import { hqStyleSpecs } from '../../src/art/structures/hqStyles';
import type { SpriteSpec } from '../../src/art/types';
import { hangsOnPole, hqFlag, pointFlag, trenchPennant } from '../../src/render/flagMounts';

const FACTIONS: readonly FactionId[] = ['british', 'german', 'soviet'];
const STYLES = Object.keys(HQ_STYLE_LAYOUT) as HqStyle[];

interface Segment {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  width: number;
}

/** Every stroked straight segment of a sprite's drawing, in sprite pixels (translate, scale and save/restore tracked). */
function strokedSegments(spec: SpriteSpec): Segment[] {
  type M = [number, number, number, number, number, number];
  let m: M = [1, 0, 0, 1, 0, 0];
  const stack: M[] = [];
  let path: [number, number][][] = [];
  let lineWidth = 1;
  const out: Segment[] = [];
  const at = (x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const store = new Map<string, unknown>();
  const fns: Record<string, (...a: number[]) => unknown> = {
    save: () => void stack.push([...m] as M),
    restore: () => void (m = stack.pop() ?? m),
    translate: (x, y) => void (m = [m[0], m[1], m[2], m[3], m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]),
    scale: (sx, sy) => void (m = [m[0] * sx, m[1] * sx, m[2] * sy, m[3] * sy, m[4], m[5]]),
    rotate: (a) => {
      const c = Math.cos(a);
      const s = Math.sin(a);
      m = [m[0] * c + m[2] * s, m[1] * c + m[3] * s, m[2] * c - m[0] * s, m[3] * c - m[1] * s, m[4], m[5]];
    },
    setTransform: (a, b, c, d, e, f) => void (m = [a, b, c, d, e, f]),
    beginPath: () => void (path = []),
    moveTo: (x, y) => void path.push([at(x, y)]),
    lineTo: (x, y) => {
      if (path.length === 0) path.push([]);
      path[path.length - 1].push(at(x, y));
    },
    stroke: () => {
      for (const sub of path) for (let i = 1; i < sub.length; i++) out.push({ x0: sub[i - 1][0], y0: sub[i - 1][1], x1: sub[i][0], y1: sub[i][1], width: lineWidth });
    },
    createLinearGradient: () => ({ addColorStop: (): void => undefined }),
    createRadialGradient: () => ({ addColorStop: (): void => undefined }),
    createPattern: () => null,
    measureText: () => ({ width: 10 }),
  };
  const ctx = new Proxy(
    {},
    {
      get(_t, prop): unknown {
        if (typeof prop !== 'string') return undefined;
        if (prop === 'lineWidth') return lineWidth;
        if (prop in fns) return fns[prop];
        if (store.has(prop)) return store.get(prop);
        return (): void => undefined;
      },
      set(_t, prop, value): boolean {
        if (prop === 'lineWidth') lineWidth = value as number;
        else if (typeof prop === 'string') store.set(prop, value);
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  spec.draw(ctx);
  return out;
}

/** True when the sprite strokes a straight upright pole at foot.x, at least 2 px thick, from the foot up past the top. */
function drawsPole(spec: SpriteSpec, box: ArtBox, foot: ArtPoint, top: ArtPoint): boolean {
  const x = box.ox + foot.x;
  const yFoot = box.oy + foot.y;
  const yTop = box.oy + top.y;
  return strokedSegments(spec).some(
    (s) =>
      s.width >= 2 &&
      Math.abs(s.x0 - x) < 0.6 &&
      Math.abs(s.x1 - x) < 0.6 &&
      Math.max(s.y0, s.y1) >= yFoot - 0.5 &&
      Math.min(s.y0, s.y1) <= yTop,
  );
}

const byState = (specs: SpriteSpec[], state: string): SpriteSpec => {
  const s = specs.find((x) => x.key.endsWith(`/${state}`));
  if (!s) throw new Error(`no ${state} sprite`);
  return s;
};

describe('no flag without a pole', () => {
  it('hangs every HQ flag by its hoist from the top of a straight pole, the pole well longer than the flag', () => {
    const layouts = [...STYLES.map((s) => [s, HQ_STYLE_LAYOUT[s]] as const), ...MISSION_HQ_STYLES.map((s) => [s, MISSION_HQ_LAYOUT[s]] as const), ...FACTIONS.map((f) => [`bunker ${f}`, HQ_LAYOUT[f]] as const)];
    for (const [name, L] of layouts) {
      expect(L.flagTop.x, `${name}: straight`).toBe(L.flagBase.x);
      expect(L.flagBase.y - L.flagTop.y, `${name}: the pole shows below the flag`).toBeGreaterThan(FLAG_LAYOUT.h + 10);
      for (const dir of [1, -1] as const) expect(hangsOnPole(hqFlag(L, 400, dir, VIEW.groundY)), `${name} facing ${dir}`).toBe(true);
    }
  });

  it('stands a mission HQ\'s pole on its roof, close above the building (Brest\'s casemate, the mill, the store)', () => {
    const floors = { casemate: 2, mill: 3, store: 3 } as const;
    for (const style of MISSION_HQ_STYLES) {
      const L = MISSION_HQ_LAYOUT[style];
      expect(L.flagBase.y, style).toBe(-floors[style] * BUILDING_LAYOUT.floorH);
      expect(L.flagBase.y - L.flagTop.y, style).toBe(ROOF_FLAGPOLE_H);
      expect(ROOF_FLAGPOLE_H, 'not hovering high above the roof').toBeLessThan(FLAG_LAYOUT.h * 2.2);
    }
  });

  it('plants a ground HQ\'s pole on the ground, a dugout\'s on its top and a bunker\'s in the earth over its roof', () => {
    for (const style of STYLES) {
      const L = HQ_STYLE_LAYOUT[style];
      expect(L.flagBase.y, style).toBeLessThanOrEqual(0);
      // At most the earth cover (16) above the body: the foot is in the bank, never in the air above it.
      expect(-L.flagBase.y, style).toBeLessThanOrEqual(L.bodyH + 16);
    }
  });

  it.each(STYLES.flatMap((s) => FACTIONS.map((f) => [s, f] as const)))('the %s HQ of the %s draws its pole (intact and damaged)', (style, faction) => {
    const L = HQ_STYLE_LAYOUT[style];
    const specs = hqStyleSpecs(style, faction);
    for (const state of ['intact', 'damaged']) expect(drawsPole(byState(specs, state), L.box, L.flagBase, L.flagTop), state).toBe(true);
  });

  it.each(MISSION_HQ_STYLES.flatMap((s) => FACTIONS.map((f) => [s, f] as const)))('the %s mission HQ (%s) draws its roof pole (intact and damaged)', (style, faction) => {
    const L = MISSION_HQ_LAYOUT[style];
    const specs = missionHqSpecs(style, faction);
    for (const state of ['intact', 'damaged']) expect(drawsPole(byState(specs, state), L.box, L.flagBase, L.flagTop), state).toBe(true);
  });

  it('the nations\' bunker HQs draw their poles (intact and damaged)', () => {
    const specs = hqSpecs();
    for (const f of FACTIONS) {
      const L = HQ_LAYOUT[f];
      for (const state of DAMAGE_STATES.filter((s) => s !== 'ruin')) {
        const spec = specs.find((s) => s.key === `st/hq/${f}/${state}`);
        expect(spec, `${f} ${state}`).toBeDefined();
        if (spec) expect(drawsPole(spec, L.box, L.flagBase, L.flagTop), `${f} ${state}`).toBe(true);
      }
    }
  });

  it('ties every trench pennant to a stake standing on the lip, flying back toward its own side', () => {
    for (const dir of [1, -1] as const) {
      const m = trenchPennant(1000, dir, VIEW.groundY);
      expect(hangsOnPole(m)).toBe(true);
      expect(m.cloth.top).toBe(m.pole.top);
      expect(m.cloth.dir).toBe(-dir);
      expect(m.pole.base).toBeGreaterThanOrEqual(VIEW.groundY);
    }
  });

  it('runs a capture point\'s flag up its pole and never off it', () => {
    for (const dir of [1, -1] as const) {
      for (const hoist of [0, 0.3, 0.7, 1]) {
        const m = pointFlag(500, dir, hoist, VIEW.groundY);
        expect(hangsOnPole(m), `${dir} ${hoist}`).toBe(true);
        expect(m.cloth.dir).toBe(dir);
      }
    }
  });

  it('catches a floating flag (the check itself works)', () => {
    const m = hqFlag(MISSION_HQ_LAYOUT.casemate, 400, 1, VIEW.groundY);
    expect(hangsOnPole({ ...m, cloth: { ...m.cloth, top: m.pole.top - 60 } })).toBe(false);
    expect(hangsOnPole({ ...m, cloth: { ...m.cloth, hoistX: m.pole.x + 30 } })).toBe(false);
  });
});
