/**
 * Lookup tables compiled once from src/data so the tick never searches by
 * string: unit kinds, target classes, damage types and weapons all get small
 * integer indices.
 */
import { DAMAGE } from '../data/damage';
import type { DamageType, TargetClass, UnitDef, UnitKind, WeaponDef } from '../data/schema';
import { UNITS, UNIT_KINDS } from '../data/units';
import { WEAPONS } from '../data/weapons';

export const KIND_LIST: readonly UnitKind[] = UNIT_KINDS;
export const KIND_COUNT = KIND_LIST.length;

function buildKindIndex(): Record<UnitKind, number> {
  const out = {} as Record<UnitKind, number>;
  for (let i = 0; i < KIND_LIST.length; i++) out[KIND_LIST[i]] = i;
  return out;
}

export const KIND_INDEX: Record<UnitKind, number> = buildKindIndex();
export const KIND_SAPPER = KIND_INDEX.sapper;
export const KIND_DEFS: readonly UnitDef[] = KIND_LIST.map((kind) => UNITS[kind]);

/** Target classes as indices (damage matrix columns) and as bits (weapon target masks). */
export const CLASS_LIST: readonly TargetClass[] = ['infantryOpen', 'infantryTrench', 'fortification', 'vehicle', 'hq'];
export const CLASS_OPEN = 0;
export const CLASS_TRENCH = 1;
export const CLASS_FORT = 2;
export const CLASS_VEHICLE = 3;
export const CLASS_HQ = 4;

export const DAMAGE_TYPES: readonly DamageType[] = ['bullet', 'explosive', 'antiTank'];

/** DAMAGE flattened: DAMAGE_TABLE[typeIndex * CLASS_LIST.length + classIndex]. */
export const DAMAGE_TABLE: Float64Array = (() => {
  const table = new Float64Array(DAMAGE_TYPES.length * CLASS_LIST.length);
  for (let t = 0; t < DAMAGE_TYPES.length; t++) {
    for (let c = 0; c < CLASS_LIST.length; c++) {
      table[t * CLASS_LIST.length + c] = DAMAGE[DAMAGE_TYPES[t]][CLASS_LIST[c]];
    }
  }
  return table;
})();

export function damageFactor(typeIndex: number, classIndex: number): number {
  return DAMAGE_TABLE[typeIndex * CLASS_LIST.length + classIndex];
}

export const WEAPON_LIST: readonly WeaponDef[] = Object.keys(WEAPONS).map((id) => WEAPONS[id]);

/** Index of a weapon id in the weapon tables, or -1 for null or an unknown id. */
export function weaponIndex(id: string | null): number {
  if (id === null) return -1;
  for (let i = 0; i < WEAPON_LIST.length; i++) {
    if (WEAPON_LIST[i].id === id) return i;
  }
  return -1;
}

/** Per weapon: bit c set if it may engage target class c. */
export const WEAPON_MASK: Int32Array = (() => {
  const masks = new Int32Array(WEAPON_LIST.length);
  for (let i = 0; i < WEAPON_LIST.length; i++) {
    let mask = 0;
    for (const cls of WEAPON_LIST[i].targets) mask |= 1 << CLASS_LIST.indexOf(cls);
    masks[i] = mask;
  }
  return masks;
})();

/** Rank given to unit kinds a weapon does not prefer. Lower ranks are chosen first. */
export const NO_PREFERENCE = 100;

/** Per weapon, per kind index: position in the weapon's `prefer` list, or NO_PREFERENCE. */
export const WEAPON_PREFER: readonly Int8Array[] = WEAPON_LIST.map((weapon) => {
  const ranks = new Int8Array(KIND_COUNT).fill(NO_PREFERENCE);
  for (let p = 0; p < weapon.prefer.length; p++) ranks[KIND_INDEX[weapon.prefer[p]]] = p;
  return ranks;
});

/** Per weapon: true if it has a `prefer` list at all. */
export const WEAPON_HAS_PREFER: readonly boolean[] = WEAPON_LIST.map((weapon) => weapon.prefer.length > 0);

/** Per weapon: index of its damage type in DAMAGE_TYPES. */
export const WEAPON_DTYPE: Int8Array = (() => {
  const out = new Int8Array(WEAPON_LIST.length);
  for (let i = 0; i < WEAPON_LIST.length; i++) out[i] = DAMAGE_TYPES.indexOf(WEAPON_LIST[i].damageType);
  return out;
})();
