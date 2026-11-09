/**
 * The game's version and the "What's new" note shown in Settings.
 *
 * The version number itself lives in package.json (one place); this file holds the release stage and the notes. While
 * the game is in beta the version starts with 0: bump the middle number for a feature update and the last number for a
 * bug-fix-only update, as part of every push to live (CLAUDE.md, "Push to live"), and put the newest notes first. A
 * unit test fails if the newest notes do not match package.json, so a bump without notes (or the reverse) is caught.
 */

/** Shown before the number: "Beta v0.9.0". */
export const RELEASE_STAGE = 'Beta';

export interface ReleaseNotes {
  /** Without the "v", e.g. "0.9.0". */
  version: string;
  /** Plain words, one short line each. */
  items: readonly string[];
}

/** Newest first. Settings shows the first entry. */
export const WHATS_NEW: readonly ReleaseNotes[] = [
  {
    version: '0.10.0',
    items: [
      'Quartermaster upgrades for every unit you can buy, new ones included: health and damage, 3 levels each.',
      'Upgrades for the Bomber, Fighter and Recon plane call-ins.',
      'Every upgrade level now shows a clear change on your men, vehicles, HQ, guns, dump and sappers.',
    ],
  },
  {
    version: '0.9.0',
    items: [
      'The game now shows its version number (we are in beta).',
      'New units: Universal Carrier, Flamethrower, Lieutenant, Bofors crew, and Bomber, Fighter and Recon plane call-ins.',
      'Medals and the Armoury: win medals in missions and spend them on unit types and call-ins.',
      'Every unit type you have bought can be used in every mission, replays included.',
      'Missions lend you the types they are built around if you have not bought them yet.',
      'The flamethrower shoots real-looking flames and wears a gas mask.',
      'Call-ins fold into one "Call-ins" button; unit buttons use short names.',
      'New campaign map music, "Roll of Honour".',
      'Show FPS setting, and a cap of 100 men per side on every difficulty.',
    ],
  },
];
