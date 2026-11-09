import type { GameConfig } from './schema';

/**
 * Global rules. First-pass numbers; the balance phase tunes them.
 * Distances are world units (wu, about 1000 per screen), times are seconds.
 */
export const CONFIG: GameConfig = {
  tickRate: 30,
  popCap: 100,
  maxQueue: 5,

  hqHp: 1000,
  hqIncomePerSec: 1.5,
  hqInset: 150,
  hqWidth: 180,
  hqDoorOffset: 70,
  hqGunOffset: 50,
  hqGunWeapon: 'hqGun',
  doorInterval: 0.25,

  dumpDistance: 420,
  dumpSpread: 50,
  sapperLoadTime: 2,
  sapperCarry: 10,

  holdLineOffset: 700,
  holdLineTolerance: 30,
  contactGap: 30,
  spacing: 22,
  formationColumns: 64,
  rows: 4,
  formationRowOrder: [1, 2, 0, 3],
  engageSpread: 100,
  mapMargin: 20,
  fallBackSpeedMul: 1.25,
  moveDeadband: 14,

  firePoseTime: 0.18,
  retargetInterval: 0.5,
  targetSpread: 60,
  switchAimFrac: 0.4,

  controlDamageMul: 1.25,
  controlReloadMul: 1.25,
  guardLeash: 400,

  wireSlow: 0.4,
  wireHp: 120,
  pillboxHp: 700,
  pillboxGunWeapon: 'pillboxGun',
  trenchSlotSpacing: 24,
  smokePointBlank: 60,
  trenchFormGap: 26,
  pillboxWidth: 70,

  scatterMinFrac: 0.3,
  clusterMin: 3,
  clusterRadius: 50,
  throwReleaseTime: 0.35,
  throwPoseTime: 0.8,
  knockSpeed: 260,
  knockReach: 2,
  knockDugIn: 0.5,
  guardAlertTime: 6,

  // The King Tiger escort: tougher and steadier than the line.
  veteran: { hpMul: 1.4, accuracyMul: 1.25 },

  // Shared by both sides: two full armies (2 x popCap) plus headroom for scripted waves and survival attackers.
  maxUnits: 216,
  maxProjectiles: 128,
  maxSmokes: 8,
  maxEvents: 256,
  maxCommands: 64,
};

/**
 * Tunables of the new units and the aircraft (job 7). They live beside CONFIG rather than in
 * GameConfig so the shared contract in schema.ts stays as it is (like AI_RECOVERY in ai.ts).
 */
export interface SpecialsDef {
  /** APC: friendly infantry within this distance (wu) of an APC with room climb aboard. */
  apcBoardRadius: number;
  /** APC: under Advance it unloads once the enemy front is this close (wu), or when it stops to fight. */
  apcUnloadDistance: number;
  /** APC: unloaded men step off this far apart (wu), behind the carrier. */
  apcUnloadSpacing: number;
  /** Flamethrower: a man burned out of a trench slot may not take a slot again for this long (s). */
  flushSeconds: number;
  /** Flamethrower: extra multiplier on its damage to pillboxes (it burns out the crew). */
  flamePillboxMul: number;
  /** Flamethrower: extra multiplier on its damage to men in a trench (fire pours into it). */
  flameTrenchMul: number;
  /** Flamethrower: multiplier on its damage to a vehicle (burning fuel on the engine deck; DECISIONS 424). */
  flameVehicleMul: number;
  /** Flamethrower fuel tank going up: radius (wu) of the explosion the view draws. */
  igniteRadius: number;
}

export const SPECIALS: SpecialsDef = {
  apcBoardRadius: 70,
  apcUnloadDistance: 300,
  apcUnloadSpacing: 16,
  flushSeconds: 6,
  flamePillboxMul: 3,
  flameTrenchMul: 2,
  flameVehicleMul: 0.4,
  igniteRadius: 40,
};
