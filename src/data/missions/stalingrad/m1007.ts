import { STALINGRAD_MUSIC } from '../../musicCampaigns';
import type { MissionDef } from '../../schema';

/**
 * Stalingrad mission 7 (1007): the House on the Square, 9 January Square, late September to November 1942
 * (docs/campaigns/STALINGRAD.md, mission 7). Survival: Sergeant Pavlov's four men take the four-storey house
 * (building B1, two Germans inside), Lieutenant Afanasyev's section comes up the communication trench from the mill
 * (trench 1), and the garrison holds the house through two days and three nights compressed into 22 minutes: rifle
 * attacks by day, raiding parties by night, tanks on the second day, flamethrowers on the last night.
 *
 * Built on the mission director (docs/campaigns/STALINGRAD_BUILD.md, mission 1007): phase 0 takes the house (a building
 * of four floors with seven windows each, FOUNDATIONS.md 4.3; two Germans inside) before first light, and brings
 * Afanasyev's section
 * up the communication trench; the 60 s prep phase follows it (the bot wires the doors); then day one (lost if the house
 * falls, a Stuka raid), night one, day two with the tanks and the last night (the Katyusha comes up for it), all under
 * the one 22-minute clock. The attackers have no HQ: their Stukas are scripted raids. The artillery reloads in 90 s here.
 * StuG III Ausf. F and Panzer III J are the `tank` kind (the era's Panzer III Ausf. L; the StuG by look `stug3f`).
 * The anti-tank rifles on the top floor fire down on the tanks (BUILDINGS.topFloorVsVehicles); the side objective "no
 * German sets foot inside" is the `contested` loss; the HQ is the Gerhardt mill (`hqLook`), and the blocks across the
 * square (B2 to B4) are German cover, their snipers in B2.
 */
export const M1007: MissionDef = {
  id: 1007,
  key: 'pavlov',
  title: 'The House on the Square',
  location: '9 January Square, Stalingrad',
  date: 'September to November 1942',
  // The defence began on 27 September; its era is the autumn's (the snow of the last phase is view-only).
  dateIso: '1942-09-27',
  climate: 'city',
  mapPos: { lon: 44.5315, lat: 48.716 },
  briefing: [
    'Sergeant, see that four-storey house standing alone on the square? From its upper windows you can see half a kilometre into the German lines. Take it tonight with your three men. If it is empty, hold it until help comes. If it is not empty, make it empty, quietly.',
    'Lieutenant Afanasyev will bring up a machine-gun section, anti-tank rifles and mortars, and the sappers will wire and mine the square. Dig a trench back to the mill so ammunition and soup can reach you. There are families in the cellar; they stay, and they will need the soup more than you do.',
    'The Germans will try to take it back by day with tanks and by night with raiding parties. We do not need you to go forward. We need the house to be there in the morning, and the morning after that, until the whole front moves. Money is short: spend it on men for the windows, not on a big army.',
  ],
  objective: 'Take the house, then hold it until the counter-offensive.',
  intel: {
    enemy: [
      'Attacks from the square, day after day, from the blocks opposite',
      'Over 150 riflemen and MP40 troopers, MG teams',
      'About 18 pioneers with flamethrowers, mostly by night',
      '3 Panzer III and 2 StuG III on the second day; 2 snipers',
    ],
    friendly: [
      'Sgt. Pavlov and 3 men, plus 2 sappers and 150 Money',
      'Lt. Afanasyev\'s section soon after: 6 riflemen, 3 DPs, a mortar',
      'Later a sniper and 2 PTRS teams; guns from the far bank',
    ],
  },
  theatre: 'holland',
  timeOfDay: 'dusk',
  mode: 'survival',
  length: 7000,
  // The unlock order (DECISIONS 295): the Lieutenant, after Afanasyev, who came up with his section and took command.
  newUnit: 'commander',
  newSupport: null,
  units: [
    ['sapper', 'rifle', 'lmg', 'assault', 'mortar', 'sniper', 'medic', 'at', 'tank', 'flame', 'aa', 'commander', 'conscript'],
    ['rifle', 'lmg', 'assault', 'mortar', 'sniper', 'flame', 'tank'],
  ],
  supports: [['artillery', 'katyusha'], []],
  start: [
    {
      faction: 'soviet',
      hasHq: true,
      supplies: 150,
      hqHpMul: 1,
      hqLook: 'mill',
      incomeMul: 0.6,
      sappers: 2,
      // The heavy batteries across the river reload slowly here (FOUNDATIONS.md 3.3); the rocket battery comes up for the
      // last night.
      supportCooldown: { artillery: 90 },
      supportsOff: ['katyusha'],
      forces: [
        // Sergeant Pavlov's group in the rubble behind the house.
        { kind: 'rifle', count: 4, x: 2150 },
      ],
    },
    {
      faction: 'german',
      hasHq: false,
      supplies: 0,
      hqHpMul: 1,
      incomeMul: 0,
      sappers: 0,
      // Two Germans in the house.
      forces: [{ kind: 'rifle', count: 2, buildingId: 1, behaviour: 'garrison' }],
    },
  ],
  trenches: [
    // The communication trench back to the mill.
    { id: 1, x: 1900, width: 150, slots: 6, owner: 0 },
  ],
  buildings: [
    // Pavlov's House: four floors of seven windows (nobody's until the two Germans inside are placed).
    { id: 1, x: 2450, width: 220, floors: 4, slotsPerFloor: 7, hpMul: 2.2, owner: -1, look: 'apartment' },
    // The German-held blocks across the square: cover for their snipers and machine guns.
    { id: 2, x: 4800, width: 200, floors: 3, slotsPerFloor: 4, hpMul: 1.5, owner: 1, look: 'apartment' },
    { id: 3, x: 5600, width: 180, floors: 3, slotsPerFloor: 3, hpMul: 1.5, owner: 1, look: 'apartment' },
    { id: 4, x: 6400, width: 200, floors: 4, slotsPerFloor: 3, hpMul: 1.5, owner: 1, look: 'apartment' },
  ],
  pillboxes: [],
  wire: [],
  timer: { seconds: 1320, onExpire: 'win', label: 'Until the counter-offensive' },
  // The mission director (FOUNDATIONS.md 3): take the house, dig in, then two days and two nights. Phase 0 runs at least
  // 110 s (the section comes up), so the day and night phases keep the old clock: 110 to 420, 660, 960 and 1320 s.
  phases: [
    {
      id: 'house',
      title: 'Take the house',
      objectives: [
        { id: 'house', type: 'capture', point: { building: 1 }, text: 'Take the house' },
        { id: 'section', type: 'survive', seconds: 110, text: 'The section comes up' },
      ],
      timer: { seconds: 180, label: 'Before first light', onExpire: 'lose' },
      next: 'dayOne',
    },
    {
      id: 'dayOne',
      title: 'Day one',
      // A minute to wire the doors and the square before the first attack.
      prep: {
        seconds: 60,
        zone: { from: 2200, to: 4000 },
        bot: [
          { kind: 'wire', x: 2760 },
          { kind: 'wire', x: 3400 },
        ],
      },
      objectives: [{ id: 'dayOne', type: 'survive', seconds: 310, text: 'Hold the house' }],
      lose: [{ type: 'pointLost', point: { building: 1 } }],
      sideObjectives: [
        { id: 'trenchOpen', text: 'The trench stays open', failIf: { type: 'pointLost', point: { trench: 1 } }, bonus: 0.15 },
        { id: 'noGerman', text: 'No German sets foot inside', failIf: { type: 'contested', point: { building: 1 } }, bonus: 0.15 },
      ],
      next: 'nightOne',
    },
    { id: 'nightOne', title: 'Night one', objectives: [{ id: 'nightOne', type: 'survive', seconds: 240, text: 'Hold the house' }], next: 'dayTwo' },
    { id: 'dayTwo', title: 'Day two: the tanks', objectives: [{ id: 'dayTwo', type: 'survive', seconds: 300, text: 'Hold the house' }], next: 'lastNight' },
    { id: 'lastNight', title: 'The last night', objectives: [{ id: 'lastNight', type: 'survive', seconds: 360, text: 'Until the counter-offensive' }], next: null },
  ],
  events: [
    {
      type: 'hint',
      when: { at: 3 },
      text: 'Two Germans are in the house. Kill the men inside first, then walk in to take it: every man you train should go to its windows.',
    },
    // The brief's Stuka on the house: its walls and floors take the bombs now (DECISIONS E1, E3).
    { id: 'stuka', type: 'airRaid', when: { phase: 'dayOne', delay: 120 }, side: 1, support: 'airStrike', x: 2450 },
    { id: 'katyusha', type: 'support', when: { phase: 'lastNight' }, side: 0, kind: 'katyusha', enabled: true },
    {
      type: 'wave',
      when: { pointCapturedBy: 0, point: { building: 1 } },
      side: 0,
      forces: [
        { kind: 'rifle', count: 6, x: 1900 },
        { kind: 'lmg', count: 2, x: 1850 },
        { kind: 'lmg', count: 1, x: 1800 },
        { kind: 'mortar', count: 1, x: 1700 },
      ],
      announce: "Lieutenant Afanasyev's section is up.",
    },
    {
      type: 'hint',
      when: { at: 48 },
      text: 'Wire across the doors and on the square. DP Gunners in the windows; the mortar answers their machine guns.',
    },
    {
      type: 'hint',
      when: { at: 70 },
      about: 'commander',
      text: 'New: Lieutenant. Only a pistol, but the men near him fight harder. One at a time: keep him in the house, out of the windows.',
    },
    // Day one: rifle attacks across the square.
    { type: 'announce', when: { at: 110 }, text: 'Day one. They are forming up across the square.' },
    { type: 'wave', when: { every: 30, from: 120, until: 400 }, side: 1, forces: [{ kind: 'rifle', count: 6 }] },
    {
      type: 'wave',
      when: { at: 180 },
      side: 1,
      forces: [
        { kind: 'lmg', count: 2 },
        { kind: 'rifle', count: 6 },
      ],
      announce: 'Machine-gun teams are setting up in the blocks opposite.',
    },
    {
      type: 'wave',
      when: { at: 320 },
      side: 1,
      forces: [
        { kind: 'lmg', count: 2 },
        { kind: 'rifle', count: 6 },
      ],
    },
    // Night one: raiding parties.
    { type: 'announce', when: { at: 420 }, text: 'Night one. Listen for boots on the square.' },
    {
      type: 'wave',
      when: { at: 425 },
      side: 0,
      forces: [{ kind: 'sniper', count: 1, x: 1800 }],
      announce: 'A sniper has come up the trench.',
    },
    {
      type: 'wave',
      when: { every: 50, from: 440, until: 640 },
      side: 1,
      forces: [
        { kind: 'assault', count: 6 },
        { kind: 'flame', count: 2 },
      ],
      announce: 'A raiding party!',
    },
    {
      type: 'wave',
      when: { at: 450 },
      side: 1,
      forces: [{ kind: 'sniper', count: 2, buildingId: 2, behaviour: 'garrison' }],
    },
    {
      type: 'hint',
      when: { at: 460 },
      text: 'Their snipers are in the blocks opposite. Your Sniper answers them; keep him in the house.',
    },
    // Day two: the tanks.
    { type: 'announce', when: { at: 660 }, text: 'Day two. Engines behind the blocks.' },
    {
      type: 'wave',
      when: { at: 665 },
      side: 0,
      forces: [{ kind: 'at', count: 2, x: 1900 }],
      announce: 'Two PTRS teams are up for the top floor.',
    },
    {
      type: 'hint',
      when: { at: 670 },
      text: 'The anti-tank rifle in the house fires down on the thin roof of a tank. Keep the PTRD Teams in the house.',
    },
    {
      type: 'wave',
      when: { at: 690 },
      side: 1,
      forces: [
        { kind: 'tank', count: 2 },
        { kind: 'rifle', count: 8 },
      ],
      announce: 'Tanks on the square!',
    },
    { type: 'wave', when: { every: 60, from: 720, until: 940 }, side: 1, forces: [{ kind: 'rifle', count: 5 }] },
    {
      type: 'wave',
      when: { at: 840 },
      side: 1,
      forces: [
        { kind: 'tank', count: 2, look: 'stug3f' },
        { kind: 'rifle', count: 8 },
      ],
      announce: 'More tanks are coming round the blocks.',
    },
    // The last night.
    { type: 'announce', when: { at: 960 }, text: 'The last night. It has started to snow.' },
    {
      type: 'wave',
      when: { at: 1020 },
      side: 1,
      forces: [
        { kind: 'flame', count: 4 },
        { kind: 'assault', count: 8 },
      ],
      announce: 'Pioneers with flamethrowers!',
    },
    {
      type: 'wave',
      when: { at: 1160 },
      side: 1,
      forces: [
        { kind: 'flame', count: 4 },
        { kind: 'assault', count: 8 },
      ],
      announce: 'Flamethrowers again, from the left-hand block!',
    },
    {
      type: 'wave',
      when: { at: 1220 },
      side: 1,
      forces: [
        { kind: 'tank', count: 1 },
        { kind: 'lmg', count: 2 },
        { kind: 'assault', count: 4 },
        { kind: 'rifle', count: 8 },
      ],
      announce: 'Everything they have left.',
    },
    { type: 'announce', when: { at: 1290 }, text: 'The guns to the north have opened. The counter-offensive has begun.' },
    {
      type: 'hint',
      when: { hqHpBelow: 0.5, side: 0 },
      text: 'They are at the mill. Fall Back shelters everyone while the HQ machine gun fights.',
    },
  ],
  // Side 1 has no HQ: everything it fields arrives in the scripted waves.
  ai: { sappers: 0, build: [], firstAttackAfter: 0 },
  bot: {
    sappers: 3,
    // Counts include Pavlov's four riflemen and Afanasyev's section.
    build: [
      { kind: 'rifle', count: 12, after: 0 },
      { kind: 'lmg', count: 3, after: 60 },
      { kind: 'at', count: 3, after: 300 },
      { kind: 'rifle', count: 14, after: 400 },
      { kind: 'at', count: 4, after: 600 },
      { kind: 'medic', count: 1, after: 700 },
    ],
    firstAttackAfter: 30,
  },
  // The 22 min clock plus up to a minute of prep.
  expectedMinutes: [22, 23.2],
  music: STALINGRAD_MUSIC.missions[1007],
};
