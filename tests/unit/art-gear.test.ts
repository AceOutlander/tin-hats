import { describe, expect, it } from 'vitest';
import {
  FACTION_FIGURE_KEYS,
  FIGURE_PART_COUNT,
  createFigureAnim,
  createFigureInput,
  createFigureLayout,
  figureSpriteMap,
  layoutFigure,
  resetFigureAnim,
  setFigureCrateKey,
  setFigureGear,
  setFigurePushing,
  updateFigure,
  type FigureAnim,
  type FigurePart,
} from '../../src/art/figure';
import { flamePackKey } from '../../src/art/figure/parts';
import { J_NHAND, J_FHAND } from '../../src/art/figure/pose';
import { TANK_KEYS, TANK_LOOKS, createTankPose, layoutTank, tankGearKeys, tankGearSpecs } from '../../src/art/vehicles';
import { TANK_LAYOUT } from '../../src/data/artLayout';
import { FIGURE_KINDS, FIGURE_KIND_LIST, type FigureKind } from '../../src/data/figure';
import { GEAR_NONE, TANK_GEAR_ART } from '../../src/data/looksGear';
import type { FactionId, UnitAction } from '../../src/data/schema';
import { SAPPER_CART_HANDLE, type GearLevels, type LookStage } from '../../src/data/upgradeLooks';

const FACTIONS: readonly FactionId[] = ['british', 'german'];
const ACTIONS: readonly UnitAction[] = ['idle', 'move', 'aim', 'load', 'heal'];

function run(a: FigureAnim, kind: FigureKind, action: UnitAction, frames: number, parts: FigurePart[], speed = 0, carrying = false): void {
  const inp = createFigureInput(kind);
  inp.action = action;
  inp.speed = speed;
  inp.carrying = carrying;
  for (let i = 0; i < frames; i++) {
    inp.moved = speed / 60;
    updateFigure(a, inp, 1 / 60);
  }
  layoutFigure(a, parts);
}

function visibleKeys(parts: readonly FigurePart[]): string[] {
  return parts.map((p) => (p.visible ? p.key : ''));
}

function gear(h: LookStage, d: LookStage): GearLevels {
  return { health: h, damage: d };
}

describe('figure upgrade gear', () => {
  it('gear (0,0) draws exactly the same parts as a figure without gear, for every kind, nation and action', () => {
    for (const f of FACTIONS) {
      for (const kind of FIGURE_KIND_LIST) {
        for (const action of ACTIONS) {
          const plain = createFigureLayout();
          const geared = createFigureLayout();
          run(createFigureAnim(kind, f, 5), kind, action, 30, plain, action === 'move' ? 60 : 0, kind === 'sapper');
          const a = createFigureAnim(kind, f, 5);
          setFigureGear(a, GEAR_NONE);
          run(a, kind, action, 30, geared, action === 'move' ? 60 : 0, kind === 'sapper');
          expect(geared).toEqual(plain);
          // And those are today's faction keys.
          const keys = visibleKeys(plain);
          const K = FACTION_FIGURE_KEYS[f];
          expect(keys).toContain(K.helmet);
          expect(keys).toContain(K.helmetRim);
          expect(keys.includes(K.pack)).toBe(FIGURE_KINDS[kind].pack);
          expect(keys.includes(K.pouches)).toBe(FIGURE_KINDS[kind].pouches);
          expect(keys.includes(K.satchel)).toBe(FIGURE_KINDS[kind].satchel);
          expect(keys.some((k) => k.includes('/gear/'))).toBe(false);
        }
      }
    }
  });

  it('each step changes the expected slot, and every key exists', () => {
    const map = figureSpriteMap();
    for (const f of FACTIONS) {
      const K = FACTION_FIGURE_KEYS[f];
      for (const kind of FIGURE_KIND_LIST) {
        const keysAt = (h: LookStage, d: LookStage): string[] => {
          const parts = createFigureLayout();
          const a = createFigureAnim(kind, f, 3);
          setFigureGear(a, gear(h, d));
          run(a, kind, 'idle', 5, parts);
          const ks = visibleKeys(parts).filter((k) => k !== '');
          for (const k of ks) expect(map.has(k), k).toBe(true);
          return ks;
        };
        const g = (style: string): string => `fig/${f}/gear/${style}`;
        // The flamethrower wears his fuel tanks in the pack slot at every level.
        expect(keysAt(1, 0)).toContain(kind === 'flame' ? flamePackKey(f) : g(FIGURE_KINDS[kind].pack ? 'fullPack' : 'haversack'));
        if (kind === 'flame') expect(keysAt(0, 0)).toContain(flamePackKey(f));
        expect(keysAt(1, 0)).toContain(K.helmet);
        expect(keysAt(2, 0)).toContain(g('helmetNet'));
        expect(keysAt(2, 0)).not.toContain(K.helmet);
        expect(keysAt(3, 0)).toContain(g('helmetScrim'));
        expect(keysAt(3, 0)).not.toContain(g('helmetNet'));
        expect(keysAt(3, 0)).not.toContain(K.helmetRim);
        if (kind === 'medic') {
          expect(keysAt(0, 1)).toContain(g('medicSatchel'));
          expect(keysAt(0, 2)).toContain(g('aidPouches'));
          expect(keysAt(0, 3)).toContain(g('aidStrap'));
          expect(keysAt(0, 3)).toContain(g('medicSatchel'));
          for (const k of keysAt(3, 3)) expect(['fullPouches', 'bandolier', 'grenades'].some((s) => k === g(s))).toBe(false);
        } else {
          expect(keysAt(0, 1)).toContain(g('fullPouches'));
          expect(keysAt(0, 1)).not.toContain(K.pouches);
          expect(keysAt(0, 2)).toContain(g('bandolier'));
          expect(keysAt(0, 3)).toContain(g('grenades'));
          expect(keysAt(0, 3)).not.toContain(g('fullPouches'));
          expect(keysAt(0, 3)).toContain(g('bandolier'));
          // Different slots add up.
          const all = keysAt(3, 3);
          for (const s of ['helmetScrim', 'grenades', 'bandolier']) expect(all).toContain(g(s));
        }
      }
    }
  });

  it('lays out without allocating with gear set: the same part objects are reused', () => {
    const a = createFigureAnim('rifle', 'german', 3);
    setFigureGear(a, gear(3, 3));
    const inp = createFigureInput('rifle');
    inp.action = 'move';
    inp.speed = 80;
    const parts = createFigureLayout();
    const before = parts.slice();
    const gearKeys = a.gear;
    for (let i = 0; i < 1000; i++) {
      inp.moved = 80 / 60;
      updateFigure(a, inp, 1 / 60);
      layoutFigure(a, parts);
    }
    expect(a.gear).toBe(gearKeys);
    expect(parts.length).toBe(FIGURE_PART_COUNT);
    for (let i = 0; i < parts.length; i++) expect(parts[i]).toBe(before[i]);
    // Setting the same gear again reuses the cached key set.
    setFigureGear(a, gear(3, 3));
    expect(a.gear).toBe(gearKeys);
    const gc = (globalThis as { gc?: () => void }).gc;
    gc?.();
    const heap0 = process.memoryUsage().heapUsed;
    for (let i = 0; i < 200_000; i++) {
      inp.moved = 80 / 60;
      updateFigure(a, inp, 1 / 60);
      layoutFigure(a, parts);
    }
    gc?.();
    expect(process.memoryUsage().heapUsed - heap0).toBeLessThan(8 * 1024 * 1024);
  });

  it('a reset returns to level 0, the nation crate and no pushing', () => {
    const a = createFigureAnim('sapper', 'british', 2);
    setFigureGear(a, gear(3, 3));
    setFigureCrateKey(a, 'fig/british/gear/fullPack');
    setFigurePushing(a, true);
    resetFigureAnim(a, 'sapper', 'british', 2);
    expect(a.gear).toBeNull();
    expect(a.crateKey).toBeNull();
    expect(a.pushing).toBe(false);
    const parts = createFigureLayout();
    run(a, 'sapper', 'move', 30, parts, 60, true);
    const keys = visibleKeys(parts);
    expect(keys).toContain(FACTION_FIGURE_KEYS.british.crate);
    expect(keys.some((k) => k.includes('/gear/'))).toBe(false);
  });

  it('gear set for another kind or nation falls back to level 0', () => {
    const a = createFigureAnim('rifle', 'british', 2);
    setFigureGear(a, gear(3, 3));
    resetFigureAnim(a, 'lmg', 'german', 2);
    a.gear = createFigureAnim('rifle', 'british', 1).gear;
    const parts = createFigureLayout();
    run(a, 'lmg', 'idle', 5, parts);
    expect(visibleKeys(parts)).toContain(FACTION_FIGURE_KEYS.german.helmet);
  });

  it('a swapped crate key is drawn instead of the crate', () => {
    const a = createFigureAnim('sapper', 'german', 2);
    setFigureCrateKey(a, 'load/big');
    const parts = createFigureLayout();
    run(a, 'sapper', 'move', 20, parts, 60, true);
    expect(visibleKeys(parts)).toContain('load/big');
    expect(visibleKeys(parts)).not.toContain(FACTION_FIGURE_KEYS.german.crate);
  });

  it('a pushing sapper shows no crate and grips the cart handle standing and walking', () => {
    for (const [action, speed] of [
      ['idle', 0],
      ['move', 50],
      ['move', 85],
      ['load', 0],
    ] as const) {
      const a = createFigureAnim('sapper', 'british', 4);
      setFigurePushing(a, true);
      const parts = createFigureLayout();
      const inp = createFigureInput('sapper');
      inp.action = action;
      inp.speed = speed;
      inp.carrying = true;
      for (let i = 0; i < 180; i++) {
        inp.moved = speed / 60;
        updateFigure(a, inp, 1 / 60);
        layoutFigure(a, parts);
        if (i < 60) continue;
        expect(a.crateVisible).toBe(false);
        expect(visibleKeys(parts)).not.toContain(FACTION_FIGURE_KEYS.british.crate);
        for (const h of [J_NHAND, J_FHAND]) {
          const dx = a.joints[h * 2] - SAPPER_CART_HANDLE.x;
          const dy = a.joints[h * 2 + 1] - SAPPER_CART_HANDLE.y;
          expect(Math.hypot(dx, dy), `${action} ${speed}`).toBeLessThan(1.5);
        }
      }
    }
  });
});

describe('tank upgrade gear', () => {
  it('gear (0,0) uses the normal keys and no extra sprites', () => {
    for (const look of TANK_LOOKS) {
      const g = tankGearKeys(look, GEAR_NONE);
      expect(g.hull).toBe(TANK_KEYS[look].hull);
      expect(g.turret).toBe(TANK_KEYS[look].turret);
      expect(g.barrel).toBe(TANK_KEYS[look].barrel);
      expect(g.gunExtra).toBe(0);
      expect(tankGearSpecs(look, GEAR_NONE)).toEqual([]);
    }
  });

  it('health changes the hull, damage the turret and then the gun; specs cover exactly the keys used', () => {
    for (const look of TANK_LOOKS) {
      const seen = new Set<string>();
      for (let h = 0; h < 4; h++) {
        for (let d = 0; d < 4; d++) {
          const lv = gear(h as LookStage, d as LookStage);
          const g = tankGearKeys(look, lv);
          expect(g.hull === TANK_KEYS[look].hull).toBe(h === 0);
          expect(g.turret === TANK_KEYS[look].turret).toBe(d === 0);
          expect(g.barrel === TANK_KEYS[look].barrel).toBe(d < 3);
          const specs = tankGearSpecs(look, lv);
          const keys = new Set(specs.map((s) => s.key));
          for (const k of [g.hull, g.turret, g.barrel]) {
            const base = k === TANK_KEYS[look].hull || k === TANK_KEYS[look].turret || k === TANK_KEYS[look].barrel;
            expect(keys.has(k) || base, k).toBe(true);
            if (!base) seen.add(k);
          }
          for (const s of specs) {
            expect(s.key.startsWith(`veh/${look}/`)).toBe(true);
            expect(s.w).toBeGreaterThan(0);
            expect(s.ax).toBeGreaterThanOrEqual(0);
            expect(s.ax).toBeLessThanOrEqual(1);
          }
          expect(tankGearKeys(look, lv)).toBe(g);
        }
      }
      expect(seen.size).toBe(3 + 2 + 1);
    }
  });

  it('the long gun moves the muzzle point to its tip', () => {
    for (const look of TANK_LOOKS) {
      const g = tankGearKeys(look, gear(0, 3));
      expect(g.gunExtra).toBe(TANK_GEAR_ART[look].longGun.extra);
      const base = layoutTank({ look, distance: 0, turretAim: 0, recoil: 0, hullRock: 0 }, createTankPose());
      const bx = base.muzzle.x;
      const long = layoutTank({ look, distance: 0, turretAim: 0, recoil: 0, hullRock: 0, gunExtra: g.gunExtra }, createTankPose());
      expect(long.muzzle.x - bx).toBeCloseTo(g.gunExtra, 6);
      const spec = tankGearSpecs(look, gear(0, 3)).find((s) => s.key === g.barrel);
      expect(spec).toBeDefined();
      if (spec) expect(spec.w - spec.ax * spec.w).toBeGreaterThanOrEqual(TANK_LAYOUT[look].barrelLength + g.gunExtra);
    }
  });
});
