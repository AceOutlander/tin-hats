import { describe, expect, it } from 'vitest';
import {
  FIGURE_PART_COUNT,
  allFigureSprites,
  createFigureAnim,
  createFigureInput,
  createFigureLayout,
  figureSpriteMap,
  layoutFigure,
  updateFigure,
} from '../../src/art/figure';
import { FIGURE_KIND_LIST } from '../../src/data/figure';
import type { FactionId, UnitAction } from '../../src/data/schema';

const FACTIONS: readonly FactionId[] = ['british', 'german', 'soviet'];
const ACTIONS: readonly UnitAction[] = ['idle', 'move', 'aim', 'fire', 'reload', 'throw', 'load', 'heal', 'deploy'];

describe('figure layout and sprites', () => {
  it('has unique, namespaced sprite keys with sane sizes and anchors', () => {
    const specs = allFigureSprites();
    const keys = new Set<string>();
    for (const s of specs) {
      expect(s.key.startsWith('fig/')).toBe(true);
      expect(keys.has(s.key)).toBe(false);
      keys.add(s.key);
      expect(s.w).toBeGreaterThan(0);
      expect(s.h).toBeGreaterThan(0);
      expect(s.w).toBeLessThan(60);
      expect(s.ax).toBeGreaterThanOrEqual(0);
      expect(s.ax).toBeLessThanOrEqual(1);
      expect(s.ay).toBeGreaterThanOrEqual(0);
      expect(s.ay).toBeLessThanOrEqual(1);
    }
  });

  it('only references existing sprites, with a stable part count, for every kind, faction and action', () => {
    const map = figureSpriteMap();
    for (const f of FACTIONS) {
      for (const kind of FIGURE_KIND_LIST) {
        const a = createFigureAnim(kind, f, 4);
        const inp = createFigureInput(kind);
        const parts = createFigureLayout();
        for (const action of ACTIONS) {
          inp.action = action;
          inp.speed = action === 'move' ? 70 : 0;
          inp.carrying = kind === 'sapper' && action === 'move';
          for (let i = 0; i < 40; i++) {
            inp.moved = inp.speed / 60;
            updateFigure(a, inp, 1 / 60);
            layoutFigure(a, parts);
            expect(parts.length).toBe(FIGURE_PART_COUNT);
            for (const p of parts) {
              if (!p.visible) continue;
              expect(map.has(p.key), p.key).toBe(true);
              expect(Number.isFinite(p.x + p.y + p.rotation + p.scaleX + p.scaleY)).toBe(true);
            }
          }
        }
      }
    }
  });

  it('shows the helmet of the faction and the weapon of the kind', () => {
    const parts = createFigureLayout();
    const a = createFigureAnim('lmg', 'german', 2);
    updateFigure(a, createFigureInput('lmg'), 1 / 60);
    layoutFigure(a, parts);
    const keys = parts.filter((p) => p.visible).map((p) => p.key);
    expect(keys).toContain('fig/german/helmet');
    expect(keys).toContain('fig/weapon/mg34');
    const b = createFigureAnim('lmg', 'british', 2);
    updateFigure(b, createFigureInput('lmg'), 1 / 60);
    layoutFigure(b, parts);
    const bkeys = parts.filter((p) => p.visible).map((p) => p.key);
    expect(bkeys).toContain('fig/british/helmet');
    expect(bkeys).toContain('fig/weapon/bren');
  });

  it('lays out without allocating: the same part objects are reused', () => {
    const a = createFigureAnim('rifle', 'british', 3);
    const inp = createFigureInput('rifle');
    inp.action = 'move';
    inp.speed = 80;
    const parts = createFigureLayout();
    const before = parts.slice();
    for (let i = 0; i < 1000; i++) {
      inp.moved = 80 / 60;
      updateFigure(a, inp, 1 / 60);
      layoutFigure(a, parts);
    }
    expect(parts.length).toBe(FIGURE_PART_COUNT);
    for (let i = 0; i < parts.length; i++) expect(parts[i]).toBe(before[i]);
    // Rough heap check: 200k frames of update + layout must not leave garbage behind at a per-frame rate.
    const gc = (globalThis as { gc?: () => void }).gc;
    gc?.();
    const heap0 = process.memoryUsage().heapUsed;
    for (let i = 0; i < 200_000; i++) {
      inp.moved = 80 / 60;
      updateFigure(a, inp, 1 / 60);
      layoutFigure(a, parts);
    }
    gc?.();
    const grown = process.memoryUsage().heapUsed - heap0;
    expect(grown).toBeLessThan(8 * 1024 * 1024);
  });
});
