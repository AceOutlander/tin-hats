/**
 * Campaign rules over a SaveData: which missions are unlocked or cleared, and buying and refunding Quartermaster
 * upgrades with upgrade points (src/meta/medals.ts earns them). Pure functions; the functions that change a save change it in place.
 */
import { META } from '../data/meta';
import type { Difficulty, UpgradeDef } from '../data/schema';
import { UPGRADES } from '../data/upgrades';
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
}

/** Record a victory. Marks the mission cleared on this difficulty (the medals are paid by recordWin in medals.ts). */
export function recordClear(save: SaveData, missionId: number, difficulty: Difficulty): ClearResult {
  const key = String(missionId);
  const list = save.cleared[key] ?? [];
  const firstClear = list.length === 0;
  if (!list.includes(difficulty)) list.push(difficulty);
  save.cleared[key] = list;
  return { firstClear };
}

export function upgradeLevel(save: SaveData, id: string): number {
  return save.upgrades[id] ?? 0;
}

/** Highest level an upgrade can reach. */
export function maxLevel(def: UpgradeDef): number {
  return Math.min(META.maxUpgradeLevel, def.levels.length);
}

/** Upgrade points for buying level `level` (1 = the first) of an upgrade. */
export function levelCost(def: UpgradeDef, level: number): number {
  return def.levelCosts?.[level - 1] ?? def.costPerLevel;
}

/** Upgrade points for levels 1 to `level` together. */
export function costUpTo(def: UpgradeDef, level: number): number {
  let sum = 0;
  for (let n = 1; n <= level; n += 1) sum += levelCost(def, n);
  return sum;
}

/** Upgrade points tied up in upgrades the definitions know about (what Refund all would give back). */
export function pointsSpent(save: SaveData, defs: readonly UpgradeDef[]): number {
  let spent = 0;
  for (const def of defs) spent += costUpTo(def, Math.min(upgradeLevel(save, def.id), maxLevel(def)));
  return spent;
}

/** Upgrade points left to spend; never negative. */
export function pointsAvailable(save: SaveData): number {
  return Math.max(0, save.points);
}

/** Upgrade points to spend plus those in upgrades. */
export function pointsEarned(save: SaveData, defs: readonly UpgradeDef[] = UPGRADES): number {
  return pointsAvailable(save) + pointsSpent(save, defs);
}

export function canBuy(save: SaveData, defs: readonly UpgradeDef[], id: string): boolean {
  const def = defs.find((d) => d.id === id);
  if (def === undefined) return false;
  const level = upgradeLevel(save, id);
  return level < maxLevel(def) && save.points >= levelCost(def, level + 1);
}

export function canRefund(save: SaveData, id: string): boolean {
  return upgradeLevel(save, id) > 0;
}

/** Buy the next level for its price in upgrade points. Returns false (and changes nothing) if it is not allowed. */
export function buyUpgrade(save: SaveData, defs: readonly UpgradeDef[], id: string): boolean {
  if (!canBuy(save, defs, id)) return false;
  const def = defs.find((d) => d.id === id) as UpgradeDef;
  save.points -= levelCost(def, upgradeLevel(save, id) + 1);
  save.upgrades[id] = upgradeLevel(save, id) + 1;
  return true;
}

/** Give back the top level. Refunds are free and complete: its points come back. */
export function refundUpgrade(save: SaveData, id: string, defs: readonly UpgradeDef[] = UPGRADES): boolean {
  const level = upgradeLevel(save, id);
  if (level <= 0) return false;
  const def = defs.find((d) => d.id === id);
  if (def) save.points += levelCost(def, Math.min(level, maxLevel(def)));
  if (level === 1) delete save.upgrades[id];
  else save.upgrades[id] = level - 1;
  return true;
}

/** Give back every upgrade level, and its points. */
export function refundAll(save: SaveData, defs: readonly UpgradeDef[] = UPGRADES): void {
  save.points += pointsSpent(save, defs);
  save.upgrades = {};
}
