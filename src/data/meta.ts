/** Rules and keys of the save data and campaign progress (src/meta). */
import type { Difficulty } from './schema';

export interface MetaTunables {
  /** Storage key of the save. */
  saveKey: string;
  /** Written into every save; a save from a newer version is not understood and is replaced. */
  saveVersion: number;
  /** Upgrade points for the first clear of a mission (on any difficulty). */
  firstClearPoints: number;
  /** Upgrade levels per upgrade (an upgrade definition may have fewer). */
  maxUpgradeLevel: number;
  /** Settings of a fresh save. */
  defaultDifficulty: Difficulty;
  defaultMuted: boolean;
  defaultHints: boolean;
}

export const META: MetaTunables = {
  saveKey: 'tinhats.save',
  saveVersion: 1,
  firstClearPoints: 2,
  maxUpgradeLevel: 3,
  defaultDifficulty: 'normal',
  defaultMuted: false,
  defaultHints: true,
};
