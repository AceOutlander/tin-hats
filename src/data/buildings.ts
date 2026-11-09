import type { DamageType } from './schema';

/**
 * Tunables of buildings, rubble and cover props (FOUNDATIONS.md 4.3; src/sim/buildings.ts). They live beside CONFIG
 * rather than in GameConfig so the shared contract in schema.ts stays as it is (like SPECIALS in config.ts).
 * First-pass numbers; the balance tests tune them.
 */
export interface BuildingsDef {
  /** Health of a building at hpMul 1. */
  hp: number;
  /**
   * The share of an explosion's damage (weapon damage x falloff) the walls take, by damage type: shells and bombs
   * bring floors down, bullets do nothing. The flamethrower never harms the walls.
   */
  wallDamage: Record<DamageType, number>;
  /** Men on floor 2 and up (0-based floor 1 and up) see further: range x this. */
  upperFloorRange: number;
  /** Anti-tank weapons fired from the top floor of a building standing this many floors or more... */
  topFloorMinFloors: number;
  /** ...do this much more damage to vehicles (config.topFloorVsVehicles: firing down on thin roof armour). */
  topFloorVsVehicles: number;
  /** Explosive damage to each man on a floor that falls in (before the matrix: the building column applies). */
  collapseDamage: number;
  /** The rubble of a fallen building gives cover to this fraction of its slots (at least one). */
  rubbleSlots: number;
  /** Slot spacing along the footprint (wu), the same as a trench's at most. */
  slotSpacing: number;
  /**
   * Building (or cover prop) b's slots are a slot record in state.trenches with id idBase + b's id, so ForceDef,
   * PointRef and the trench code reach it by id. Mission trench ids stay below idBase; buildings and props share ids.
   */
  idBase: number;
}

export const BUILDINGS: BuildingsDef = {
  hp: 1200,
  wallDamage: { bullet: 0, explosive: 0.5, antiTank: 0.4 },
  upperFloorRange: 1.08,
  topFloorMinFloors: 3,
  topFloorVsVehicles: 1.3,
  collapseDamage: 60,
  rubbleSlots: 0.5,
  slotSpacing: 24,
  idBase: 10000,
};
