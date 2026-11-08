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
  guardAlertTime: 6,

  maxUnits: 160,
  maxProjectiles: 128,
  maxSmokes: 8,
  maxEvents: 256,
  maxCommands: 64,
};
