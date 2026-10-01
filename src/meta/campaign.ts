/**
 * Campaign rules over a SaveData: which missions are unlocked or cleared, how
 * many upgrade points exist, and buying and refunding Quartermaster upgrades.
 * Pure functions; the functions that change a save change it in place.
 */
import { META } from '../data/meta';
import type { Difficulty, UpgradeDef } from '../data/schema';
import type { SaveData } from './save';

/** Difficulties a mission has been cleared on (empty if never). */
export function clearedOn(save: SaveData, missionId: number): readonly Difficulty[] {
  return save.cleared[String(missionId)] ?? [];
}

/** True if the mission has been cleared on this difficulty, or on any difficulty when none is given. */
export function isCleared(save: SaveData, missionId: number, difficulty?: Difficulty): boolean {
  const list = clearedOn(save, missionId);
  return difficulty === undefined ? list.length > 0 : list.includes(difficulty);
}

/**
 * The first mission is always open; every other one opens when the one before it in `missionIds`
 * (campaign order, only missions that exist) has been cleared on any difficulty.
 */
export function isUnlocked(save: SaveData, missionIds: readonly number[], missionId: number): boolean {
  const index = missionIds.indexOf(missionId);
  if (index < 0) return false;
  if (index === 0) return true;
  return isCleared(save, missionIds[index - 1]);
}

/** The mission after this one in campaign order, or null for the last (or an unknown) one. */
export function nextMissionId(missionIds: readonly number[], missionId: number): number | null {
  const index = missionIds.indexOf(missionId);
  return index >= 0 && index + 1 < missionIds.length ? missionIds[index + 1] : null;
}

export interface ClearResult {
  /** True the first time the mission was cleared on any difficulty. */
  firstClear: boolean;
  /** Upgrade points this clear is worth (firstClearPoints on a first clear, else 0). */
  pointsAwarded: number;
}

/** Record a victory. Marks the mission cleared on this difficulty. */
export function recordClear(save: SaveData, missionId: number, difficulty: Difficulty): ClearResult {
  const key = String(missionId);
  const list = save.cleared[key] ?? [];
  const firstClear = list.length === 0;
  if (!list.includes(difficulty)) list.push(difficulty);
  save.cleared[key] = list;
  return { firstClear, pointsAwarded: firstClear ? META.firstClearPoints : 0 };
}

/** Upgrade points earned so far: a fixed award for each mission cleared at least once. */
export function pointsEarned(save: SaveData): number {
  return Object.keys(save.cleared).length * META.firstClearPoints;
}

export function upgradeLevel(save: SaveData, id: string): number {
  return save.upgrades[id] ?? 0;
}

/** Highest level an upgrade can reach. */
export function maxLevel(def: UpgradeDef): number {
  return Math.min(META.maxUpgradeLevel, def.levels.length);
}

/** Points tied up in upgrades the definitions know about. */
export function pointsSpent(save: SaveData, defs: readonly UpgradeDef[]): number {
  let spent = 0;
  for (const def of defs) spent += Math.min(upgradeLevel(save, def.id), maxLevel(def)) * def.costPerLevel;
  return spent;
}

/** Points left to spend; never negative. */
export function pointsAvailable(save: SaveData, defs: readonly UpgradeDef[]): number {
  return Math.max(0, pointsEarned(save) - pointsSpent(save, defs));
}

export function canBuy(save: SaveData, defs: readonly UpgradeDef[], id: string): boolean {
  const def = defs.find((d) => d.id === id);
  return def !== undefined && upgradeLevel(save, id) < maxLevel(def) && pointsAvailable(save, defs) >= def.costPerLevel;
}

export function canRefund(save: SaveData, id: string): boolean {
  return upgradeLevel(save, id) > 0;
}

/** Buy the next level. Returns false (and changes nothing) if it is not allowed. */
export function buyUpgrade(save: SaveData, defs: readonly UpgradeDef[], id: string): boolean {
  if (!canBuy(save, defs, id)) return false;
  save.upgrades[id] = upgradeLevel(save, id) + 1;
  return true;
}

/** Give back the top level. Refunds are free and complete. */
export function refundUpgrade(save: SaveData, id: string): boolean {
  const level = upgradeLevel(save, id);
  if (level <= 0) return false;
  if (level === 1) delete save.upgrades[id];
  else save.upgrades[id] = level - 1;
  return true;
}

export function refundAll(save: SaveData): void {
  save.upgrades = {};
}
