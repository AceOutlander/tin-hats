/** Rules and keys of the save data and campaign progress (src/meta). */
import type { Difficulty } from './schema';
import { VOLUME } from './sounds';

export interface MetaTunables {
  /** Storage key of the save. */
  saveKey: string;
  /** Written into every save; a save from a newer version is not understood and is replaced, an older one is migrated step by step (src/meta/save.ts). */
  saveVersion: number;
  /**
   * Where a stored save that could not be used as it was (damaged, from a newer version, or one whose upgrade failed)
   * is copied before the game carries on, so it is not lost when the next save overwrites it. One slot; longer texts
   * than unreadableMaxChars are not kept.
   */
  unreadableKey: string;
  unreadableMaxChars: number;
  /** Upgrade points for the first clear of a mission (on any difficulty). */
  firstClearPoints: number;
  /** Upgrade levels per upgrade (an upgrade definition may have fewer). */
  maxUpgradeLevel: number;
  /** Settings of a fresh save. */
  defaultDifficulty: Difficulty;
  defaultMuted: boolean;
  defaultHints: boolean;
  /** Volume sliders (0..100) of a fresh save, from VOLUME.defaults in src/data/sounds.ts. */
  defaultMusicVolume: number;
  defaultAmbienceVolume: number;
  defaultSfxVolume: number;
  /** "Reduce flashing" (lightning as a slow soft glow) of a fresh save. */
  defaultReduceFlash: boolean;
  /**
   * The volume defaults save version 3 was written with. A version 3 save still holding one of them was never moved
   * by the player, so the step to version 4 brings it to today's default; a value the player chose is kept.
   */
  v3DefaultVolumes: { music: number; ambience: number; sfx: number };
}

export const META: MetaTunables = {
  saveKey: 'tinhats.save',
  saveVersion: 4,
  unreadableKey: 'tinhats.save.unreadable',
  unreadableMaxChars: 100_000,
  firstClearPoints: 2,
  maxUpgradeLevel: 3,
  defaultDifficulty: 'normal',
  defaultMuted: false,
  defaultHints: true,
  defaultMusicVolume: VOLUME.defaults.music,
  defaultAmbienceVolume: VOLUME.defaults.ambience,
  defaultSfxVolume: VOLUME.defaults.sfx,
  defaultReduceFlash: false,
  v3DefaultVolumes: { music: 100, ambience: 100, sfx: 100 },
};
