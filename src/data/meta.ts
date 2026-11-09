/** Rules and keys of the save data and campaign progress (src/meta). */
import type { Difficulty, UnitKind } from './schema';
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
  /**
   * Upgrade points a save from before medals (version 5 and older) earned for the first clear of a mission. Only the
   * step to version 6 uses it, to work out the points the player had left.
   */
  firstClearPoints: number;
  /**
   * Medals for each unspent upgrade point of an old save: one point bought one upgrade level, so it converts to the
   * medal price one level had then (20), and the player could buy exactly what the points would have bought.
   */
  legacyPointMedals: number;
  /**
   * Medals every upgrade level cost before the re-pricing of save version 8. The step to version 8 gives back the
   * difference to v8UpgradeLevelMedals for the levels a save holds.
   */
  legacyUpgradeLevelMedals: number;
  /**
   * Medals of upgrade levels 1, 2 and 3 from save version 8 to 10 (upgrade points replaced medals in the
   * Quartermaster in version 11): the step to version 8 re-prices to these.
   */
  v8UpgradeLevelMedals: readonly number[];
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
  /** "Show blood" (a small dark pool under each soldier killed by gunfire) of a fresh save, and of a save from before it existed. */
  defaultShowBlood: boolean;
  /** "Show FPS" (a small frame-rate readout in a corner of the battle) of a fresh save, and of a save from before it existed. */
  defaultShowFps: boolean;
  /**
   * The volume defaults save version 3 was written with. A version 3 save still holding one of them was never moved
   * by the player, so the step to version 4 brings it to today's default; a value the player chose is kept.
   */
  v3DefaultVolumes: { music: number; ambience: number; sfx: number };
  /**
   * The ten British placeholder missions, removed in save version 10 (owner, docs/QUEUE.md): their ids in campaign
   * order, and the unit types reaching each one unlocked (its newUnit, unlocks and its own unit list, as
   * missionUnlocks in src/meta/medals.ts read them). The step to version 10 keeps every type a save had unlocked
   * there; the step to version 6 reads the ids to count an old save's clears.
   */
  legacyCampaign: { ids: readonly number[]; unlocks: Readonly<Record<number, readonly UnitKind[]>> };
}

export const META: MetaTunables = {
  saveKey: 'tinhats.save',
  saveVersion: 11,
  unreadableKey: 'tinhats.save.unreadable',
  unreadableMaxChars: 100_000,
  firstClearPoints: 2,
  legacyPointMedals: 20,
  legacyUpgradeLevelMedals: 20,
  v8UpgradeLevelMedals: [10, 20, 30],
  maxUpgradeLevel: 3,
  defaultDifficulty: 'normal',
  defaultMuted: false,
  defaultHints: true,
  defaultMusicVolume: VOLUME.defaults.music,
  defaultAmbienceVolume: VOLUME.defaults.ambience,
  defaultSfxVolume: VOLUME.defaults.sfx,
  defaultReduceFlash: false,
  defaultShowBlood: true,
  defaultShowFps: false,
  v3DefaultVolumes: { music: 100, ambience: 100, sfx: 100 },
  legacyCampaign: {
    ids: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    unlocks: {
      1: ['rifle', 'sapper'],
      2: ['lmg', 'sapper', 'rifle'],
      3: ['assault', 'sapper', 'rifle', 'lmg'],
      4: ['mortar', 'sapper', 'rifle', 'lmg', 'assault'],
      5: ['sniper', 'commander', 'sapper', 'rifle', 'lmg', 'assault', 'mortar'],
      6: ['medic', 'flame', 'sapper', 'rifle', 'lmg', 'assault', 'mortar', 'sniper'],
      7: ['at', 'sapper', 'rifle', 'lmg', 'assault', 'mortar', 'sniper', 'medic'],
      8: ['tank', 'apc', 'sapper', 'rifle', 'lmg', 'assault', 'mortar', 'sniper', 'medic', 'at'],
      9: ['rifle', 'lmg', 'assault', 'mortar', 'sniper', 'medic', 'at'],
      10: ['aa', 'sapper', 'rifle', 'lmg', 'assault', 'mortar', 'sniper', 'medic', 'at', 'tank'],
    },
  },
};
