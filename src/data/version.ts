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
    version: '0.17.0',
    items: [
      'The game now updates itself: when a new version is out it shows "Updating…" and loads it, never during a battle.',
      'The German flag is now the Iron Cross. German vehicles keep their straight-armed cross markings.',
    ],
  },
  {
    version: '0.16.0',
    items: [
      'The Soviet anti-tank unit is now the AT Rifle Team: two men with the long PTRD rifle, no rockets.',
      'At Brest and Dubno the early-war Tank Hunters crawl up to tanks and throw grenade bundles and petrol bottles.',
      'German anti-tank teams use rifles until late 1943, when the Panzerschreck arrives.',
      'Briefings are Soviet combat orders, and each call-in in the loadout is named.',
      'Labels that were cut off now fit, sandbags sit on the ground, and the pause menu blocks taps underneath.',
    ],
  },
  {
    version: '0.15.1',
    items: [
      'Every flag now flies from a proper flagpole, fixed to the roof, the ground or the sandbags.',
      'A quick double tap on Play no longer skips past the campaign select.',
    ],
  },
  {
    version: '0.15.0',
    items: [
      'Behind-the-scenes testing tools for the developer. Nothing changes in how the game plays.',
    ],
  },
  {
    version: '0.14.0',
    items: [
      'Pressing Play now opens a campaign select: Stalingrad, with D-Day, Road to Berlin and North Africa coming soon.',
      'Missions are numbered 1 to 10 on the map and in briefings, and map names are no longer hidden behind markers.',
      'The Soviet Quartermaster has its own Red Army upgrade names, descriptions and pictures.',
      'Incoming shells now whistle the classic way: high and faint, falling and growing louder until they land.',
    ],
  },
  {
    version: '0.13.0',
    items: [
      'New campaign: Stalingrad. Ten long Red Army missions, from Brest Fortress in 1941 to Operation Ring in 1943.',
      'Missions have phases, objectives, capture points, ruined buildings, weather, night, rivers, bridges and minefields.',
      'Defensive missions start with a prep phase to build wire, foxholes, trenches and pillboxes.',
      'Call-ins are now charges bought with medals in the Shop. Pick your loadout before each mission.',
      'Upgrades use their own upgrade points, earned by winning missions. Your levels and medals were kept.',
      'Artillery fires from off the map: shells whistle in and land one by one. Tank guns hit much harder but reload slowly.',
      'New Basic Training, a music track for every mission, Begin starts in under 2 seconds, and unit labels always fit.',
    ],
  },
  {
    version: '0.12.0',
    items: [
      'Units are unlocked by playing the missions again, not bought. Once unlocked, a unit can be used in every mission.',
      'Medals you spent on units have been given back. Units you bought stay yours.',
      'Medals now buy Quartermaster upgrades and the plane call-ins.',
      'Upgrades re-priced: 10, 20 and 30 medals for levels 1, 2 and 3 (any difference was refunded).',
      'The Carrier, Flamethrower, Lieutenant and Bofors crew are unlocked in missions 8, 6, 5 and 10.',
    ],
  },
  {
    version: '0.11.0',
    items: [
      'A hidden admin panel for testing (behind a passcode; players never see it).',
    ],
  },
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
