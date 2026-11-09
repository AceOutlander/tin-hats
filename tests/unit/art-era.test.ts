/**
 * The era art (docs/campaigns/STALINGRAD_BUILD.md, era looks; src/data/eras.ts selects it): the 1941 T-26, BT-7, KV-2
 * and I-16, the PPD, the Tank Hunters' bottle; the German Panzer III Ausf. H and the later Ausf. L, the long Panzer IV,
 * the StuG III Ausf. B and F, the PzB 39, the winter helmet cover and suit; the Romanian look. Each draws with shapes
 * of its own (not its rig's), shares its rig's running gear, and every look an era or a force can select exists.
 */
import { describe, expect, it } from 'vitest';
import {
  FACTION_FIGURE_KEYS,
  MOLOTOV_KEY,
  createFigureAnim,
  createFigureInput,
  createFigureLayout,
  figureSpriteMap,
  layoutFigure,
  setFigureClothing,
  setFigureHeadgear,
  setFigureRocketItem,
  setFigureWeapon,
  updateFigure,
} from '../../src/art/figure';
import type { SpriteSpec } from '../../src/art/types';
import { KV2_KEYS, TANK_KEYS, aircraftLookKey, hullOf, planeKey, rigOf, vehicleSpecs } from '../../src/art/vehicles';
import { HULL, TURRET } from '../../src/art/vehicles/tanks';
import { AIRCRAFT_LOOKS, ERA_VEHICLE_LOOKS, PLANE_LAYOUT, TANK_LAYOUT, VEHICLE_LOOK_RIG, type AircraftLook } from '../../src/data/artLayout';
import { INFANTRY_LOOKS, NATION_ERAS, missionEra } from '../../src/data/eras';
import { FACTION_IDS } from '../../src/data/factions';
import { WEAPON_GEOM } from '../../src/data/figure';
import { STALINGRAD_MISSIONS } from '../../src/data/missions/stalingrad';

const vehicles = new Map(vehicleSpecs().map((s) => [s.key, s]));

/** The shape a sprite draws, without its colours (as in tests/unit/art-soviet.test.ts). */
function shapeOf(spec: SpriteSpec | undefined): string {
  if (!spec) return '';
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

const sprite = (key: string): SpriteSpec | undefined => vehicles.get(key);

describe('era vehicles', () => {
  it('registers every part of every era look, sharing its rig’s track and wheels', () => {
    for (const look of ERA_VEHICLE_LOOKS) {
      const K = TANK_KEYS[look];
      for (const key of [K.hull, K.turret, K.barrel, K.husk, ...K.track, ...K.wheels]) expect(vehicles.has(key), `${look}: ${key}`).toBe(true);
      const rig = rigOf(look);
      expect(K.track, look).toEqual(TANK_KEYS[rig].track);
      expect(K.wheels, look).toEqual(TANK_KEYS[rig].wheels);
      expect(K.hull, look).toBe(TANK_KEYS[hullOf(look)].hull);
      if (VEHICLE_LOOK_RIG[look]) expect(TANK_LAYOUT[look].wheels, look).toEqual(TANK_LAYOUT[rig].wheels);
    }
    // The KV-2's turret and howitzer keep their registered keys.
    expect([TANK_KEYS.kv2.turret, TANK_KEYS.kv2.barrel]).toEqual([KV2_KEYS.turret, KV2_KEYS.barrel]);
  });

  it('draws the T-26 and BT-7 on rigs and painters of their own', () => {
    for (const look of ['t26', 'bt7'] as const) {
      expect(rigOf(look)).toBe(look);
      for (const other of ['t60', 't34', 'panzer3', 'cruiser'] as const) {
        expect(HULL[look], `${look} hull vs ${other}`).not.toBe(HULL[other]);
        expect(TURRET[look], `${look} turret vs ${other}`).not.toBe(TURRET[other]);
      }
    }
    // The T-26 has eight small road wheels in bogies and return rollers; the BT-7 four big Christie wheels and none.
    const roads = (look: 't26' | 'bt7'): number => TANK_LAYOUT[look].wheels.filter((w) => w.kind === 'road').length;
    expect([roads('t26'), roads('bt7')]).toEqual([8, 4]);
    expect(TANK_LAYOUT.bt7.wheels.some((w) => w.kind === 'return')).toBe(false);
    expect(Math.max(...TANK_LAYOUT.bt7.wheels.map((w) => w.r))).toBeGreaterThan(Math.max(...TANK_LAYOUT.t26.wheels.map((w) => w.r)));
    expect(TANK_LAYOUT.t26.faction).toBe('soviet');
    expect(TANK_LAYOUT.bt7.faction).toBe('soviet');
  });

  it('gives the KV-2 its tall turret and howitzer on the KV-1', () => {
    expect(TANK_LAYOUT.kv2.height).toBeGreaterThan(TANK_LAYOUT.kv1.height);
    expect(shapeOf(sprite(TANK_KEYS.kv2.turret))).not.toBe(shapeOf(sprite(TANK_KEYS.kv1.turret)));
    expect(shapeOf(sprite(TANK_KEYS.kv2.barrel))).not.toBe(shapeOf(sprite(TANK_KEYS.kv1.barrel)));
    expect(TANK_LAYOUT.kv2.barrelLength).toBeLessThan(TANK_LAYOUT.kv1.barrelLength);
  });

  it('makes the later Panzer III clearly different: long 5 cm gun, spaced armour, its own hull and turret', () => {
    const P = TANK_LAYOUT;
    expect(P.panzer3.barrelLength).toBeLessThan(P.panzer3h.barrelLength);
    expect(P.panzer3h.barrelLength).toBeLessThan(P.panzer3l.barrelLength);
    for (const part of ['turret', 'barrel', 'husk'] as const) {
      expect(shapeOf(sprite(TANK_KEYS.panzer3l[part])), part).not.toBe(shapeOf(sprite(TANK_KEYS.panzer3[part])));
      expect(shapeOf(sprite(TANK_KEYS.panzer3l[part])), part).not.toBe(shapeOf(sprite(TANK_KEYS.panzer3h[part])));
      expect(shapeOf(sprite(TANK_KEYS.panzer3h[part])), part).not.toBe(shapeOf(sprite(TANK_KEYS.panzer3[part])));
    }
    // The spaced plate on the bow: a hull of its own (no side skirts before 1943: the hull box is the Ausf. E's).
    expect(TANK_KEYS.panzer3l.hull).not.toBe(TANK_KEYS.panzer3.hull);
    expect(shapeOf(sprite(TANK_KEYS.panzer3l.hull))).not.toBe(shapeOf(sprite(TANK_KEYS.panzer3.hull)));
    expect(P.panzer3l.hullBox).toEqual(P.panzer3.hullBox);
    // The Ausf. H keeps the Ausf. E's hull.
    expect(TANK_KEYS.panzer3h.hull).toBe(TANK_KEYS.panzer3.hull);
  });

  it('draws the long Panzer IV and the StuG III Ausf. B and F', () => {
    expect(TANK_LAYOUT.panzer4g.barrelLength).toBeGreaterThan(TANK_LAYOUT.panzer4.barrelLength * 1.6);
    expect(shapeOf(sprite(TANK_KEYS.panzer4g.barrel))).not.toBe(shapeOf(sprite(TANK_KEYS.panzer4.barrel)));
    // The StuG: low, no turret (a casemate on the hull), its own hull, the short gun on the B and the long on the F.
    for (const look of ['stug3b', 'stug3f'] as const) {
      expect(TANK_LAYOUT[look].height).toBeLessThan(TANK_LAYOUT.panzer3.height);
      expect(shapeOf(sprite(TANK_KEYS[look].hull))).not.toBe(shapeOf(sprite(TANK_KEYS.panzer3.hull)));
      expect(shapeOf(sprite(TANK_KEYS[look].turret))).not.toBe(shapeOf(sprite(TANK_KEYS.panzer3.turret)));
    }
    expect(TANK_KEYS.stug3f.hull).toBe(TANK_KEYS.stug3b.hull);
    expect(shapeOf(sprite(TANK_KEYS.stug3f.turret))).not.toBe(shapeOf(sprite(TANK_KEYS.stug3b.turret)));
    expect(TANK_LAYOUT.stug3f.barrelLength).toBeGreaterThan(TANK_LAYOUT.stug3b.barrelLength * 1.6);
  });
});

describe('era aircraft', () => {
  it('flies the I-16 in the fighter’s box, a shape of its own', () => {
    for (const look of Object.keys(AIRCRAFT_LOOKS) as AircraftLook[]) {
      const A = AIRCRAFT_LOOKS[look];
      const s = vehicles.get(aircraftLookKey(look));
      expect(s, look).toBeDefined();
      expect([s?.w, s?.h], look).toEqual([PLANE_LAYOUT[A.kind].box.w, PLANE_LAYOUT[A.kind].box.h]);
      expect(shapeOf(s), look).not.toBe(shapeOf(vehicles.get(planeKey(A.kind, A.faction))));
    }
    expect(AIRCRAFT_LOOKS.i16).toEqual({ kind: 'fighter', faction: 'soviet' });
  });
});

describe('era figures', () => {
  const map = figureSpriteMap();

  /** The keys a figure shows aiming (or loading, for the anti-tank round). */
  function shown(setup: (a: ReturnType<typeof createFigureAnim>) => void, kind: 'assault' | 'at' | 'rifle', faction: 'soviet' | 'german', action: 'aim' | 'reload' = 'aim', t = 0.6): string[] {
    const a = createFigureAnim(kind, faction, 5);
    setup(a);
    const inp = createFigureInput(kind);
    inp.action = action;
    updateFigure(a, inp, t);
    const parts = createFigureLayout();
    layoutFigure(a, parts);
    return parts.filter((p) => p.visible).map((p) => p.key);
  }

  it('arms the 1941 assault troops with the PPD and the German anti-tank team with the PzB 39', () => {
    for (const key of ['fig/weapon/ppd', 'fig/weapon/pzb39', MOLOTOV_KEY]) expect(map.has(key), key).toBe(true);
    const ppd = shown((a) => setFigureWeapon(a, 'ppd'), 'assault', 'soviet');
    expect(ppd).toContain('fig/weapon/ppd');
    expect(ppd).not.toContain('fig/weapon/ppsh');
    const pzb = shown((a) => setFigureWeapon(a, 'pzb39'), 'at', 'german');
    expect(pzb).toContain('fig/weapon/pzb39');
    expect(pzb).not.toContain('fig/weapon/panzerschreck');
    // The weapon brings its own muzzle.
    const a = createFigureAnim('assault', 'soviet', 1);
    setFigureWeapon(a, 'ppd');
    expect(a.geom).toBe(WEAPON_GEOM.ppd);
    setFigureWeapon(a, null);
    expect(a.model).toBe('ppsh');
    expect(a.weaponKeys).toBeNull();
  });

  it('gives the Tank Hunters a rifle and the bottle while they make ready', () => {
    // Step through a whole reload, collecting every key drawn on the way.
    const keys = new Set<string>();
    const a = createFigureAnim('at', 'soviet', 5);
    setFigureWeapon(a, 'mosin');
    setFigureRocketItem(a, MOLOTOV_KEY);
    const inp = createFigureInput('at');
    inp.action = 'reload';
    const parts = createFigureLayout();
    for (let i = 0; i < 90; i++) {
      updateFigure(a, inp, 1 / 30);
      layoutFigure(a, parts);
      for (const p of parts) if (p.visible) keys.add(p.key);
    }
    expect(keys.has('fig/weapon/mosin')).toBe(true);
    expect(keys.has('fig/weapon/ptrd')).toBe(false);
    expect(keys.has(MOLOTOV_KEY)).toBe(true);
    expect(keys.has('fig/item/ptrdRound')).toBe(false);
  });

  it('dresses German figures in the winter cover and suit, and the Romanian look; the British ignore both', () => {
    const g = FACTION_FIGURE_KEYS.german;
    for (const id of ['helmetCover', 'adrian'] as const) {
      const keys = g.headgear[id];
      expect(keys, id).toBeDefined();
      if (keys) for (const k of [keys.helmet, keys.rim]) expect(map.has(k), k).toBe(true);
    }
    for (const id of ['snowSmock', 'greatcoatRomanian'] as const) {
      const keys = g.clothing[id];
      expect(keys, id).toBeDefined();
      if (keys) for (const k of Object.values(keys)) if (k) expect(map.has(k), k).toBe(true);
    }
    const winter = shown((a) => {
      setFigureHeadgear(a, 'helmetCover');
      setFigureClothing(a, 'snowSmock');
    }, 'rifle', 'german');
    expect(winter).toContain(g.headgear.helmetCover?.helmet);
    expect(winter).toContain(g.clothing.snowSmock?.torsoUpper);
    const romanian = shown((a) => {
      setFigureHeadgear(a, INFANTRY_LOOKS.romanian.headgear);
      setFigureClothing(a, INFANTRY_LOOKS.romanian.clothing);
    }, 'rifle', 'german');
    expect(romanian).toContain(g.headgear.adrian?.helmet);
    expect(romanian).toContain(g.clothing.greatcoatRomanian?.thigh);
    // The Romanian greatcoat is not the German winter suit.
    expect(g.clothing.greatcoatRomanian?.torsoUpper).not.toBe(g.clothing.snowSmock?.torsoUpper);
    const b = createFigureAnim('rifle', 'british', 3);
    setFigureHeadgear(b, 'helmetCover');
    setFigureClothing(b, 'greatcoatRomanian');
    expect([b.headgear, b.clothing]).toEqual([null, null]);
  });

  it('has a sprite for every look an era or a Stalingrad mission selects', () => {
    for (const f of FACTION_IDS) {
      const K = FACTION_FIGURE_KEYS[f];
      for (const e of NATION_ERAS[f]) {
        for (const h of Object.values(e.look?.headgear ?? {})) if (h) expect(K.headgear[h], `${e.id} ${h}`).toBeDefined();
        for (const c of Object.values(e.look?.clothing ?? {})) if (c) expect(K.clothing[c], `${e.id} ${c}`).toBeDefined();
        for (const w of Object.values(e.look?.weapon ?? {})) expect(map.has(`fig/weapon/${w}`), `${e.id} ${w}`).toBe(true);
        for (const v of Object.values(e.look?.vehicle ?? {})) expect(vehicles.has(TANK_KEYS[v].turret), `${e.id} ${v}`).toBe(true);
        for (const a of Object.values(e.look?.aircraft ?? {})) expect(vehicles.has(aircraftLookKey(a)), `${e.id} ${a}`).toBe(true);
      }
    }
    for (const m of STALINGRAD_MISSIONS) {
      for (const side of [0, 1] as const) {
        const e = missionEra(m, m.start[side].faction);
        for (const v of Object.values(e.vehicle)) expect(vehicles.has(TANK_KEYS[v].hull), `${m.id} ${v}`).toBe(true);
      }
    }
  });
});
