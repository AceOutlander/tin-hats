import type { DamageMatrix, TargetClass } from './schema';

/**
 * Damage multiplier by damage type (row) and target class (column).
 * Final damage = weapon damage x DAMAGE[type][class] x upgrade and control multipliers.
 * infantryBuilding and rubbleCover (FOUNDATIONS.md 4.3): men at a building's windows are as safe from bullets as a
 * pillbox crew (0.15) and well sheltered from shells; rubble keeps less (bullets x0.4).
 */
export const DAMAGE: DamageMatrix = {
  bullet: { infantryOpen: 1.0, infantryTrench: 0.3, fortification: 0.05, vehicle: 0.05, hq: 0.35, infantryBuilding: 0.15, rubbleCover: 0.4 },
  explosive: { infantryOpen: 1.0, infantryTrench: 1.0, fortification: 0.6, vehicle: 0.5, hq: 0.6, infantryBuilding: 0.7, rubbleCover: 0.9 },
  antiTank: { infantryOpen: 0.17, infantryTrench: 0.12, fortification: 0.8, vehicle: 2, hq: 0.8, infantryBuilding: 0.5, rubbleCover: 0.15 },
};

/**
 * Fire (the flamethrower, FLUSH_WEAPONS) on men in cover, in place of the matrix value times its trench multiplier:
 * fire pours through a building's windows (x1.8, and it burns the men out). Classes not listed keep the matrix value
 * (and SPECIALS.flameTrenchMul in a trench).
 */
export const FIRE_DAMAGE: Partial<Record<TargetClass, number>> = { infantryBuilding: 1.8 };
