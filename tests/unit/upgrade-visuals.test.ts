/**
 * Every Quartermaster upgrade shows in battle: each one has a visual in the data (upgradeVisual), and each of its
 * levels draws something different from the level before, for every nation, with sprites that exist. A new upgrade
 * track (a new unit type or call-in from the Armoury, or a new kind of upgrade) fails here until it declares a look.
 */
import { describe, expect, it } from 'vitest';
import { figureGearKeys, figureSpriteMap } from '../../src/art/figure';
import { PLANE_KINDS, isGearLook, planeGearKey, planeGearSpecs, planeKey, tankGearKeys, tankGearSpecs, vehicleLookOf } from '../../src/art/vehicles';
import { TANK_KEYS } from '../../src/art/vehicles/tankLayout';
import { FIGURE_KIND_LIST, type FigureKind } from '../../src/data/figure';
import type { FactionId, UpgradeDef } from '../../src/data/schema';
import { NATION_LOOKS, upgradeVisual, type GearLevels, type LookStage } from '../../src/data/upgradeLooks';
import { UPGRADES, upgradableKinds, upgradableSupports } from '../../src/data/upgrades';
import { sideLooks } from '../../src/meta/looks';

const NATIONS: readonly FactionId[] = ['british', 'german', 'soviet'];

function stage(n: number): LookStage {
  return n as LookStage;
}

/** What a unit kind draws at these gear levels: its sprite keys (figure slots, or vehicle hull, turret and gun). */
function unitSignature(kind: UpgradeDef['unit'], f: FactionId, gear: GearLevels): string {
  if (kind === null) throw new Error('no unit');
  if ((FIGURE_KIND_LIST as readonly string[]).includes(kind)) {
    const k = figureGearKeys(f, kind as FigureKind, gear.health, gear.damage);
    const map = figureSpriteMap();
    const shown = [k.helmet, k.helmetRim, k.packShow ? k.pack : '', k.pouchesShow ? k.pouches : '', k.satchelShow ? k.satchel : '', k.bandolier ?? ''];
    for (const key of shown) if (key !== '') expect(map.has(key), key).toBe(true);
    return shown.join('|');
  }
  const look = vehicleLookOf(kind, f);
  expect(isGearLook(look), `${kind} ${look} carries gear`).toBe(true);
  if (!isGearLook(look)) return '';
  const g = tankGearKeys(look, gear);
  const made = new Set([...tankGearSpecs(look, gear).map((s) => s.key), TANK_KEYS[look].hull, TANK_KEYS[look].turret, TANK_KEYS[look].barrel]);
  for (const key of [g.hull, g.turret, g.barrel]) expect(made.has(key), key).toBe(true);
  return [g.hull, g.turret, g.barrel].join('|');
}

/** What upgrade `def` draws at `level` for nation f (its other upgrades at 0). */
function signature(def: UpgradeDef, f: FactionId, level: number): string {
  const v = upgradeVisual(def);
  if (!v) throw new Error(`${def.id} has no visual`);
  switch (v.type) {
    case 'track':
      return NATION_LOOKS[f][v.track][stage(level)];
    case 'gear': {
      const gear: GearLevels = { health: 0, damage: 0 };
      gear[v.source] = stage(level);
      return unitSignature(v.unit, f, gear);
    }
    case 'plane': {
      const kind = PLANE_KINDS.find((k) => k === v.support);
      if (!kind) throw new Error(`${def.id}: ${v.support} flies no plane`);
      const key = planeGearKey(kind, f, level);
      if (level === 0) expect(key).toBe(planeKey(kind, f));
      else expect(planeGearSpecs(kind, f, level).map((s) => s.key)).toEqual([key]);
      return key;
    }
  }
}

describe('upgrade visuals', () => {
  it('every upgrade has a visual defined in the data', () => {
    for (const def of UPGRADES) expect(upgradeVisual(def), def.id).not.toBeNull();
  });

  it('every level of every upgrade looks different from the level before, for every nation', () => {
    for (const def of UPGRADES) {
      for (const f of NATIONS) {
        let before = signature(def, f, 0);
        for (let level = 1; level <= def.levels.length; level++) {
          const now = signature(def, f, level);
          expect(now, `${def.id} level ${level} (${f})`).not.toBe(before);
          before = now;
        }
      }
    }
  });

  it('covers every unit type and call-in the player can buy, and the battle looks follow the saved levels', () => {
    for (const kind of upgradableKinds()) {
      const own = UPGRADES.filter((d) => d.unit === kind);
      expect(own.map((d) => upgradeVisual(d)?.type), kind).toEqual(['gear', 'gear']);
    }
    for (const kind of upgradableSupports()) expect(UPGRADES.filter((d) => d.support === kind).map((d) => upgradeVisual(d)?.type), kind).toEqual(['plane']);
    const levels: Record<string, number> = {};
    UPGRADES.forEach((d, i) => (levels[d.id] = (i % 3) + 1));
    const looks = sideLooks('british', levels);
    for (const def of UPGRADES) {
      const v = upgradeVisual(def);
      if (v?.type === 'gear') expect(looks.gear[v.unit]?.[v.source], def.id).toBe(levels[def.id]);
      if (v?.type === 'plane') expect(looks.support[v.support], def.id).toBe(levels[def.id]);
    }
    // A side with no Quartermaster (the enemy) shows no gear and plain planes.
    const enemy = sideLooks('german', null);
    expect(enemy.gear).toEqual({});
    expect(enemy.support).toEqual({});
  });

  it('an upgrade without a look is caught', () => {
    const odd: UpgradeDef = { id: 'odd', name: 'Odd', description: 'Nothing to see.', unit: null, levels: [[{ stat: 'hqIncome', mul: 1.1 }]], costPerLevel: 1 };
    expect(upgradeVisual(odd)).toBeNull();
  });
});
