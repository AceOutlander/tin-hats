/**
 * The Red Army's own art (docs/campaigns/STALINGRAD_BUILD.md, Soviet art): every unit, vehicle and aircraft the
 * Soviet nation fields draws with art of its own, not a British or German stand-in; every key it names exists with a
 * sensible size; the era pieces (caps, winter clothing, the KV-2, the Katyusha launcher) are registered for the era
 * looks to select.
 */
import { describe, expect, it } from 'vitest';
import {
  FACTION_FIGURE_KEYS,
  createFigureAnim,
  createFigureInput,
  createFigureLayout,
  figureSpriteMap,
  layoutFigure,
  setFigureClothing,
  setFigureHeadgear,
  updateFigure,
} from '../../src/art/figure';
import { truckKey, truckSpecs, TRUCK_STATES } from '../../src/art/props/supplyLooks';
import type { SpriteSpec } from '../../src/art/types';
import {
  AIR_KEYS,
  KATYUSHA_LAUNCHER_KEY,
  KV2_KEYS,
  PLANE_KINDS,
  TANK_KEYS,
  airStrikeKey,
  planeKey,
  planeSpecs,
  vehicleLookOf,
  vehicleSpecs,
} from '../../src/art/vehicles';
import { HULL, TURRET } from '../../src/art/vehicles/tanks';
import { AIR_LAYOUT, BM13_LAYOUT, KV2_TURRET, TANK_LAYOUT, type ArtBox } from '../../src/data/artLayout';
import { FACTION_IDS } from '../../src/data/factions';
import { FIGURE, FIGURE_KIND_LIST, FIGURE_LOADOUT } from '../../src/data/figure';
import { FIGURE_CLOTHING, FIGURE_CLOTHING_LIST, FIGURE_HEADGEAR, FIGURE_HEADGEAR_LIST } from '../../src/data/looksGear';
import type { UnitKind } from '../../src/data/schema';

const VEHICLE_KINDS: readonly UnitKind[] = ['tank', 'heavyTank', 'lightTank', 'apc'];
const vehicles = new Map(vehicleSpecs().map((s) => [s.key, s]));

/**
 * The shape a sprite draws, without its colours: every path and paint call with its numbers, in order. Two sprites
 * with the same shape are the same drawing in another paint (a stand-in).
 */
function shapeOf(spec: SpriteSpec): string {
  const out: string[] = [];
  const ctx = new Proxy(
    {},
    {
      get(_t, prop): unknown {
        if (typeof prop !== 'string') return undefined;
        if (prop.startsWith('create')) return () => ({ addColorStop: (): void => undefined });
        return (...args: unknown[]): void => {
          out.push(`${prop}(${args.filter((a) => typeof a === 'number').map((n) => Math.round((n as number) * 100)).join(',')})`);
        };
      },
      set(): boolean {
        return true;
      },
    },
  ) as unknown as CanvasRenderingContext2D;
  spec.draw(ctx);
  return out.join(';');
}

function expectBox(s: SpriteSpec | undefined, box: ArtBox, what: string): void {
  expect(s, what).toBeDefined();
  if (!s) return;
  expect(s.w, `${what} w`).toBe(box.w);
  expect(s.h, `${what} h`).toBe(box.h);
  expect(s.ax * s.w, `${what} origin x`).toBeCloseTo(box.ox, 9);
  expect(s.ay * s.h, `${what} origin y`).toBeCloseTo(box.oy, 9);
}

describe('Soviet art', () => {
  it('gives every nation vehicles of its own: no look borrows the rig of another nation', () => {
    for (const f of FACTION_IDS) {
      for (const kind of VEHICLE_KINDS) {
        const look = vehicleLookOf(kind, f);
        expect(TANK_LAYOUT[look].faction, `${f} ${kind} (${look})`).toBe(f);
        for (const key of [TANK_KEYS[look].hull, TANK_KEYS[look].turret, TANK_KEYS[look].barrel, TANK_KEYS[look].husk]) {
          expect(vehicles.has(key), key).toBe(true);
        }
      }
    }
  });

  it('draws the KV-1 and T-60 with painters and shapes of their own', () => {
    for (const other of ['churchill', 'panzer4', 'kingTiger', 't34'] as const) {
      expect(HULL.kv1, `KV-1 hull vs ${other}`).not.toBe(HULL[other]);
      expect(TURRET.kv1, `KV-1 turret vs ${other}`).not.toBe(TURRET[other]);
    }
    for (const other of ['panzer3', 'cruiser'] as const) {
      expect(HULL.t60, `T-60 hull vs ${other}`).not.toBe(HULL[other]);
      expect(TURRET.t60, `T-60 turret vs ${other}`).not.toBe(TURRET[other]);
    }
    // The KV-1 is the heavier tank: longer and taller than the T-34, the T-60 smaller than both.
    expect(TANK_LAYOUT.kv1.length).toBeGreaterThan(TANK_LAYOUT.t34.length);
    expect(TANK_LAYOUT.kv1.height).toBeGreaterThan(TANK_LAYOUT.t34.height);
    expect(TANK_LAYOUT.t60.length).toBeLessThan(TANK_LAYOUT.t34.length);
    // The Soviet carrier is the Lend-Lease British vehicle, but in Soviet paint, with its own gun and marks.
    const sovietHull = vehicles.get(TANK_KEYS.carrierSoviet.hull);
    const britishHull = vehicles.get(TANK_KEYS.carrier.hull);
    expect(sovietHull && britishHull && shapeOf(sovietHull) !== shapeOf(britishHull)).toBe(true);
    const sovietGun = vehicles.get(TANK_KEYS.carrierSoviet.barrel);
    const britishGun = vehicles.get(TANK_KEYS.carrier.barrel);
    expect(sovietGun && britishGun && shapeOf(sovietGun) !== shapeOf(britishGun)).toBe(true);
  });

  it('flies Soviet aircraft of their own shapes, in the shared boxes, and the Il-2 on the air strike', () => {
    const planes = new Map(planeSpecs().map((s) => [s.key, s]));
    for (const kind of PLANE_KINDS) {
      const soviet = planes.get(planeKey(kind, 'soviet'));
      const british = planes.get(planeKey(kind, 'british'));
      expect(soviet && british, kind).toBeTruthy();
      if (!soviet || !british) continue;
      expect(soviet.w, kind).toBe(british.w);
      expect(soviet.h, kind).toBe(british.h);
      expect(shapeOf(soviet), `${kind}: the Soviet plane is not the British shape`).not.toBe(shapeOf(british));
    }
    for (const f of FACTION_IDS) expect(vehicles.has(airStrikeKey(f)), `${f} air strike plane`).toBe(true);
    expect(airStrikeKey('soviet')).toBe(AIR_KEYS.il2);
    expect(airStrikeKey('british')).toBe(AIR_KEYS.plane);
    expectBox(vehicles.get(AIR_KEYS.il2), AIR_LAYOUT.planeBox, 'Il-2');
  });

  it('registers the KV-2 turret and the Katyusha launcher with their layout boxes', () => {
    expectBox(vehicles.get(KV2_KEYS.turret), KV2_TURRET.turretBox, 'KV-2 turret');
    expectBox(vehicles.get(KV2_KEYS.barrel), KV2_TURRET.barrelBox, 'KV-2 howitzer');
    // The howitzer's trunnion lies inside the turret, and the gun is short and thick next to the KV-1's.
    const B = KV2_TURRET.turretBox;
    expect(KV2_TURRET.trunnion.x + B.ox).toBeGreaterThan(0);
    expect(KV2_TURRET.trunnion.x + B.ox).toBeLessThan(B.w);
    expect(KV2_TURRET.trunnion.y + B.oy).toBeGreaterThan(0);
    expect(KV2_TURRET.barrelLength).toBeLessThan(TANK_LAYOUT.kv1.barrelLength);
    expect(KV2_TURRET.barrelBox.h).toBeGreaterThan(TANK_LAYOUT.kv1.barrelBox.h);
    expectBox(vehicles.get(KATYUSHA_LAUNCHER_KEY), BM13_LAYOUT.box, 'BM-13');
    // The raised rails stay inside the launcher sprite.
    const tipX = BM13_LAYOUT.railPivot.x + BM13_LAYOUT.railLength * Math.cos(BM13_LAYOUT.railAngle);
    const tipY = BM13_LAYOUT.railPivot.y - BM13_LAYOUT.railLength * Math.sin(BM13_LAYOUT.railAngle);
    expect(tipX + BM13_LAYOUT.box.ox).toBeLessThan(BM13_LAYOUT.box.w);
    expect(tipY + BM13_LAYOUT.box.oy).toBeGreaterThan(0);
  });

  it('draws the GAZ-AA, not the Bedford, for the Soviet supply truck', () => {
    for (const state of TRUCK_STATES) {
      const soviet = truckSpecs('soviet').find((s) => s.key === truckKey('soviet', state));
      const british = truckSpecs('british').find((s) => s.key === truckKey('british', state));
      expect(soviet && british, state).toBeTruthy();
      if (soviet && british) expect(shapeOf(soviet), state).not.toBe(shapeOf(british));
    }
  });

  it('arms the Red Army with its own small arms', () => {
    const own = ['rifle', 'conscript', 'lmg', 'assault', 'mortar', 'sniper', 'at', 'commander'] as const;
    for (const kind of own) {
      const model = FIGURE_LOADOUT.soviet.weapon[kind];
      expect(model, kind).not.toBe(FIGURE_LOADOUT.british.weapon[kind]);
      expect(model, kind).not.toBe(FIGURE_LOADOUT.german.weapon[kind]);
    }
    expect(FIGURE_LOADOUT.soviet.grenade).toBe('f1');
  });

  it('has every figure key of every nation in the sprite map, caps and winter clothing included', () => {
    const map = figureSpriteMap();
    for (const f of FACTION_IDS) {
      const k = FACTION_FIGURE_KEYS[f];
      const keys = [k.helmet, k.helmetRim, k.pack, k.pouches, k.satchel, k.crate, ...(k.coatRoll ? [k.coatRoll] : [])];
      for (const kind of FIGURE_KIND_LIST) for (const key of [k.weapon[kind], k.bipod[kind], k.plate[kind]]) if (key) keys.push(key);
      for (const key of Object.values(k.item)) if (key) keys.push(key);
      for (const id of FIGURE_HEADGEAR[f]) {
        const h = k.headgear[id];
        expect(h, `${f} ${id}`).toBeDefined();
        if (h) keys.push(h.helmet, h.rim);
      }
      for (const id of FIGURE_CLOTHING[f]) {
        const c = k.clothing[id];
        expect(c, `${f} ${id}`).toBeDefined();
        if (c) for (const key of Object.values(c)) if (key) keys.push(key);
      }
      for (const key of keys) expect(map.has(key), `${f}: ${key}`).toBe(true);
    }
    expect(FIGURE_HEADGEAR.soviet).toEqual(FIGURE_HEADGEAR_LIST);
    expect(FIGURE_CLOTHING.soviet).toEqual(FIGURE_CLOTHING_LIST);
  });

  it('draws winter clothing over the body parts it covers, a little fuller than the body, for the Red Army only', () => {
    const map = figureSpriteMap();
    for (const id of FIGURE_CLOTHING_LIST) {
      const keys = FACTION_FIGURE_KEYS.soviet.clothing[id];
      expect(keys, id).toBeDefined();
      if (!keys) continue;
      // The torso and arms always; the smock reaches over the thighs, the jacket does not.
      for (const part of ['torsoLower', 'torsoUpper', 'upperArm', 'upperArmFar', 'forearm', 'forearmFar'] as const) expect(keys[part], `${id} ${part}`).not.toBeNull();
      expect(keys.thigh !== null, `${id} thigh`).toBe(id === 'snowSmock');
      const torso = keys.torsoUpper ? map.get(keys.torsoUpper) : undefined;
      const body = map.get('fig/body/torsoUpper');
      expect(torso && body && torso.h > body.h && torso.h < body.h + 2 * FIGURE.rimWidth, `${id} torso size`).toBe(true);
      // Worn on a figure, the clothing replaces the body sprites in the layout.
      const a = createFigureAnim('rifle', 'soviet', 3);
      setFigureClothing(a, id);
      setFigureHeadgear(a, id === 'snowSmock' ? 'snowHood' : 'ushanka');
      const inp = createFigureInput('rifle');
      inp.action = 'aim';
      updateFigure(a, inp, 0.6);
      const parts = createFigureLayout();
      layoutFigure(a, parts);
      const shown = parts.filter((p) => p.visible).map((p) => p.key);
      expect(shown, id).toContain(keys.torsoUpper);
      expect(shown, id).toContain(keys.upperArm);
      expect(shown, id).not.toContain('fig/body/torsoUpper');
      for (const key of shown) expect(map.has(key), key).toBe(true);
    }
    // Another nation ignores it and keeps its plain body.
    const b = createFigureAnim('rifle', 'british', 3);
    setFigureClothing(b, 'snowSmock');
    expect(b.clothing).toBeNull();
  });
});
