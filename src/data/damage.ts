import type { DamageMatrix } from './schema';

/**
 * Damage multiplier by damage type (row) and target class (column).
 * Final damage = weapon damage x DAMAGE[type][class] x upgrade and control multipliers.
 */
export const DAMAGE: DamageMatrix = {
  bullet: { infantryOpen: 1.0, infantryTrench: 0.3, fortification: 0.05, vehicle: 0.05, hq: 0.35 },
  explosive: { infantryOpen: 1.0, infantryTrench: 1.0, fortification: 0.6, vehicle: 0.5, hq: 0.6 },
  antiTank: { infantryOpen: 0.15, infantryTrench: 0.1, fortification: 0.8, vehicle: 2, hq: 0.8 },
};
