/**
 * Tunables of obstacles and water (FOUNDATIONS.md 4.4, 4.6 and 4.8): tank traps and road blocks (src/sim/obstacles.ts),
 * minefields (src/sim/mines.ts), rivers, bridges and ferries (src/sim/water.ts), and sandbags. They live beside CONFIG,
 * as BUILDINGS does, so GameConfig in the shared schema stays as it is. First-pass numbers; the balance tests tune them.
 */
import type { MineKind, ObstacleKind } from './schema';

export interface ObstacleKindDef {
  /** Health; explosive splash, the Clear job and the vehicles held at it wear it down. */
  hp: number;
  /** Share of an explosion's damage (weapon damage x falloff) it takes: steel hedgehogs shrug most of it off. */
  blastMul: number;
  /** The other side's infantry crossing it are slowed like wire (CONFIG.wireSlow). */
  slowsInfantry: boolean;
}

export interface ObstacleTunables {
  kinds: Record<ObstacleKind, ObstacleKindDef>;
  /** Damage a second a vehicle held at an obstacle with nothing to shoot at does to it (tow cables, the gun, the hull). */
  breachDps: number;
  /** Health a second one sapper on a Clear job takes off an obstacle. */
  clearRate: number;
  /** A sapper works a Clear job standing within this of the job's spot (the near edge of the field or obstacle). */
  clearReach: number;
  /** Sandbags in a building's windows: bullet and explosive damage to the men inside x these. */
  sandbagBullet: number;
  sandbagExplosive: number;
}

export const OBSTACLES: ObstacleTunables = {
  kinds: {
    tankTrap: { hp: 900, blastMul: 0.4, slowsInfantry: false },
    roadBlock: { hp: 450, blastMul: 1, slowsInfantry: true },
  },
  breachDps: 8,
  clearRate: 30,
  clearReach: 24,
  sandbagBullet: 0.7,
  sandbagExplosive: 0.85,
};

export interface MineTunables {
  /** Chance per 10 wu moved inside a field, before the density, by mine type and by the mover's class. */
  chance: Record<MineKind, { infantry: number; vehicle: number }>;
  /** Damage of a blast to the one who set it off (straight onto the hp: belly armour and boots do not help). */
  damage: Record<MineKind, { infantry: number; vehicle: number }>;
  /** Wu moved between rolls. */
  step: number;
  /** Density a blast takes away. */
  blastDensity: number;
  /** Density an explosive round takes away over the ground its splash covers, per 100 weapon damage. */
  splashDensity: number;
  /** A field this thin (or narrower than minWidth) is gone. */
  minDensity: number;
  minWidth: number;
  /** Wu of field a second one sapper on a Clear job clears, from the near edge in. */
  clearRate: number;
  /** Splash radius of the blast drawn for a mine (the explosion event), AP and AT. */
  blastRadius: { ap: number; at: number };
  /** The prep buildable `minefield`: AP mines at this density, unmarked. */
  prepDensity: number;
}

export const MINES: MineTunables = {
  chance: {
    ap: { infantry: 0.05, vehicle: 0.01 },
    at: { infantry: 0, vehicle: 0.06 },
    mixed: { infantry: 0.035, vehicle: 0.04 },
  },
  damage: {
    ap: { infantry: 90, vehicle: 40 },
    at: { infantry: 0, vehicle: 380 },
    mixed: { infantry: 90, vehicle: 300 },
  },
  step: 10,
  blastDensity: 0.05,
  splashDensity: 0.08,
  minDensity: 0.02,
  minWidth: 10,
  clearRate: 6,
  blastRadius: { ap: 26, at: 45 },
  prepDensity: 0.5,
};

export interface WaterTunables {
  /** Health of a bridge at hpMul 1. */
  bridgeHp: number;
  /** Share of an explosion's damage a bridge takes (only demolition charges bring one down quickly). */
  bridgeBlastMul: number;
  /** Explosive damage to each vehicle on a bridge when it is blown (they go into the river with it). */
  bridgeFallDamage: number;
  /** Seconds a ferry's crossing takes, unless the ferry gives its own. */
  ferryCross: number;
  /** Share of a boat's load lost when it is hit, unless the ferry gives its own. */
  ferryHitShare: number;
  /** A round of the other side landing within this of the boat hits it. */
  ferryHitRadius: number;
}

export const WATER: WaterTunables = {
  bridgeHp: 3000,
  bridgeBlastMul: 0.2,
  bridgeFallDamage: 2000,
  ferryCross: 20,
  ferryHitShare: 0.3,
  ferryHitRadius: 90,
};
