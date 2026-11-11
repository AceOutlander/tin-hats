/**
 * The German flag is the Iron Cross (owner, 2026-11-11): "a black cross with flared arms widening toward the ends and a
 * white edge, centred on the flag ... German vehicles can keep the straight-armed Balkenkreuz markings". For every
 * campaign, current and future: every German flag in the game is this one sprite.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ART_COLORS, FLAG_LAYOUT } from '../../src/data/artLayout';
import { FACTIONS } from '../../src/data/factions';
import { IRON_CROSS, ironCrossOutline } from '../../src/art/props/kit';
import { FLAG_KEYS, flagSpecs } from '../../src/art/structures';
import { IRON_CROSS_FLAG_SHARE } from '../../src/art/structures/flags';

interface Call {
  fn: string;
  args: number[];
  fill: unknown;
  stroke: unknown;
}

/** Paint a sprite against a stand-in canvas that writes down every call with the fill and stroke colours of the moment. */
function record(paint: (ctx: CanvasRenderingContext2D) => void): Call[] {
  const calls: Call[] = [];
  const store: Record<string, unknown> = {};
  const ctx = new Proxy(
    {},
    {
      get: (_t, name: string) => {
        if (name in store) return store[name];
        return (...args: number[]) => {
          calls.push({ fn: name, args, fill: store.fillStyle, stroke: store.strokeStyle });
        };
      },
      set: (_t, name: string, value: unknown) => {
        store[name] = value;
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  paint(ctx);
  return calls;
}

describe('the Iron Cross', () => {
  it('has four arms that widen toward their ends', () => {
    const size = 100;
    const pts = ironCrossOutline(size);
    expect(pts).toHaveLength(12);
    // Flared: an arm is much wider at its end than at the centre, and the sides between are curved.
    expect(IRON_CROSS.end).toBeGreaterThan(IRON_CROSS.waist * 2);
    const ends = pts.filter((p) => Math.max(Math.abs(p.x), Math.abs(p.y)) === size / 2);
    expect(ends).toHaveLength(8);
    for (const p of ends) expect(Math.min(Math.abs(p.x), Math.abs(p.y))).toBeCloseTo(size * IRON_CROSS.end);
    const waist = pts.filter((p) => Math.abs(p.x) === Math.abs(p.y));
    expect(waist).toHaveLength(4);
    for (const p of waist) expect(Math.abs(p.x)).toBeCloseTo(size * IRON_CROSS.waist);
    expect(pts.filter((p) => p.curve !== null)).toHaveLength(8);
    // The same from every side: a quarter turn maps the outline onto itself.
    const key = (x: number, y: number): string => `${Math.round(x * 100)},${Math.round(y * 100)}`;
    const all = new Set(pts.map((p) => key(p.x, p.y)));
    for (const p of pts) expect(all.has(key(-p.y, p.x))).toBe(true);
    // Centred: the corners balance out.
    expect(pts.reduce((s, p) => s + p.x, 0)).toBeCloseTo(0);
    expect(pts.reduce((s, p) => s + p.y, 0)).toBeCloseTo(0);
  });

  it('is the German flag: black with a white edge, centred on field grey, and it fits the flag', () => {
    expect(FACTIONS.german.look.flag).toBe('ironCross');
    const spec = flagSpecs().find((s) => s.key === FLAG_KEYS.ironCross);
    expect(spec).toBeDefined();
    const calls = record((ctx) => spec?.draw(ctx));
    // The field, and nothing else made of straight bars (the Balkenkreuz is four filled rectangles).
    const rects = calls.filter((c) => c.fn === 'fillRect');
    expect(rects).toHaveLength(1);
    expect(rects[0].args).toEqual([0, 0, FLAG_LAYOUT.w, FLAG_LAYOUT.h]);
    expect(rects[0].fill).toBe(ART_COLORS.flagFieldGrey);
    // The cross: one closed outline with eight curved sides, edged white, filled black.
    expect(calls.filter((c) => c.fn === 'quadraticCurveTo')).toHaveLength(8);
    const stroke = calls.find((c) => c.fn === 'stroke');
    const fill = calls.find((c) => c.fn === 'fill');
    expect(stroke?.stroke).toBe(ART_COLORS.flagWhite);
    expect(fill?.fill).toBe(ART_COLORS.flagBlack);
    expect(calls.indexOf(stroke as Call)).toBeLessThan(calls.indexOf(fill as Call));
    // Centred on the flag, and inside it with its white edge.
    const xs: number[] = [];
    const ys: number[] = [];
    for (const c of calls) {
      if (c.fn === 'moveTo' || c.fn === 'lineTo') {
        xs.push(c.args[0]);
        ys.push(c.args[1]);
      } else if (c.fn === 'quadraticCurveTo') {
        xs.push(c.args[2]);
        ys.push(c.args[3]);
      }
    }
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(FLAG_LAYOUT.w / 2);
    expect((Math.min(...ys) + Math.max(...ys)) / 2).toBeCloseTo(FLAG_LAYOUT.h / 2);
    const edge = FLAG_LAYOUT.h * IRON_CROSS_FLAG_SHARE * IRON_CROSS.edge;
    expect(Math.min(...ys) - edge).toBeGreaterThanOrEqual(0);
    expect(Math.max(...ys) + edge).toBeLessThanOrEqual(FLAG_LAYOUT.h);
    expect(Math.min(...xs) - edge).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs) + edge).toBeLessThanOrEqual(FLAG_LAYOUT.w);
  });

  it('stays off vehicles and aircraft, which keep the straight-armed Balkenkreuz', () => {
    const dir = join(__dirname, '../../src/art/vehicles');
    const sources = readdirSync(dir)
      .filter((f) => f.endsWith('.ts'))
      .map((f) => readFileSync(join(dir, f), 'utf8'));
    expect(sources.some((s) => /\bbalkenkreuz\(ctx/.test(s))).toBe(true);
    for (const s of sources) expect(/\bironCross\(/.test(s)).toBe(false);
  });
});
