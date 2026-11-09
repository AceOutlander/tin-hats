import { STALINGRAD_MUSIC } from '../../musicCampaigns';
import type { MissionDef } from '../../schema';

/**
 * Stalingrad mission 7 (1007): the House on the Square, 9 January Square, late September to November 1942
 * (docs/campaigns/STALINGRAD.md, mission 7). Survival: Sergeant Pavlov's four men take the four-storey house
 * (trench 2, two Germans inside), Lieutenant Afanasyev's section comes up the communication trench from the mill
 * (trench 1), and the garrison holds the house through two days and three nights compressed into 22 minutes: rifle
 * attacks by day, raiding parties by night, tanks on the second day, flamethrowers on the last night.
 *
 * Built with today's schema (docs/campaigns/STALINGRAD_BUILD.md, mission 1007): the house is a trench with many
 * slots (no buildings or floors yet), a 60 s prep phase comes first (the bot wires the doors), the day and night phases are timed
 * waves (no time-of-day changes), the loans are scripted waves, and StuG III Ausf. F and Panzer III J are the `tank`
 * kind (the era's Panzer III Ausf. L; the StuG by look `stug3f`). The attackers have no HQ, so they call in no Stukas.
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
    ['sapper', 'rifle', 'lmg', 'assault', 'mortar', 'sniper', 'medic', 'at', 'flame', 'commander', 'conscript'],
    ['rifle', 'lmg', 'assault', 'mortar', 'sniper', 'flame', 'tank'],
  ],
  supports: [['artillery', 'katyusha'], []],
  start: [
    {
      faction: 'soviet',
      hasHq: true,
      supplies: 150,
      hqHpMul: 1,
      incomeMul: 0.6,
      sappers: 2,
      forces: [
        // Sergeant Pavlov's group has just slipped into the house and found it empty.
        { kind: 'rifle', count: 4, trenchId: 2 },
      ],
    },
    {
      faction: 'german',
      hasHq: false,
      supplies: 0,
      hqHpMul: 1,
      incomeMul: 0,
      sappers: 0,
      forces: [],
    },
  ],
  trenches: [
    // The communication trench back to the mill.
    { id: 1, x: 1900, width: 150, slots: 6, owner: 0 },
    // Pavlov's House: four floors of windows.
    { id: 2, x: 2450, width: 220, slots: 12, owner: -1 },
  ],
  pillboxes: [],
  wire: [],
  // A minute to wire the doors and the square before the first attack (the bot builds what used to be laid at the start).
  prep: {
    seconds: 60,
    bot: [
      { kind: 'wire', x: 2760 },
      { kind: 'wire', x: 3400 },
    ],
  },
  timer: { seconds: 1320, onExpire: 'win', label: 'Until the counter-offensive' },
  events: [
    {
      type: 'hint',
      when: { at: 3 },
      text: "The house is yours and it was empty. Hold it: every man you train should go to its windows.",
    },
    {
      type: 'wave',
      when: { at: 40 },
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
      forces: [{ kind: 'sniper', count: 2, x: 4800, behaviour: 'guard' }],
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
