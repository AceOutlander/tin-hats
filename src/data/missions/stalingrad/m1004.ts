import type { MissionDef } from '../../schema';

/**
 * Stalingrad 4: the Moscow counter-offensive at Klin, 12 December 1941 (docs/campaigns/STALINGRAD.md, mission 4). The
 * 371st Rifle Division of the 30th Army pushes through the forest by night, takes the villages one by one, cuts the
 * highway and the railway that are the Third Panzer Group's only road west, and takes Klin. The Germans are thin and
 * frozen: the 1st Panzer Division holds the town with a few Panzer IIIs and IVs, two of them frozen in place.
 *
 * Built with today's engine (docs/campaigns/STALINGRAD_BUILD.md, mission 1004): the villages and Klin's houses are
 * trenches, and the capture points' forward spawns are reinforcement waves that come up at each captured position.
 * The blizzard, deep snow, ski troops' tag, the flare, the night-to-day changes, the Il-2 arriving in phase 3 and the
 * German hold posture wait for their features; the Il-2 is offered from the start.
 */
export const M1004: MissionDef = {
  id: 1004,
  key: 'klin',
  title: 'The Road to Klin',
  location: 'Klin, Moscow Oblast',
  date: '12 December 1941',
  dateIso: '1941-12-12',
  climate: 'winter',
  mapPos: { lon: 36.73, lat: 56.33 },
  briefing: [
    'For five months we have given ground. Tonight we take some back. The Germans stand thirty kilometres from Moscow with frozen engines, and their men are wrapped in blankets and summer boots. They expected to be in the city by now; instead they are out in our winter.',
    'The whole front attacks at once. Our road is to Klin, where their panzer groups have their depots and their only road home. The ski battalions go first, through the forest in the dark; the frost is thirty below, and every village they hold is a stove they will not want to leave.',
    'Take the villages one by one and use them as stepping stones; your reinforcements can come up to any you hold. Cut the highway and the railway, then take Klin.',
  ],
  objective: 'Advance through the forest, cut the highway and take Klin.',
  intel: {
    enemy: [
      '1st Panzer Division, frozen and short of fuel',
      'About 70 riflemen in the villages, trenches and Klin',
      'MG34 teams, Granatwerfer teams and PzB 39 teams',
      '5 tanks, some frozen in place; 2 SdKfz 251',
      'Artillery; no aircraft in the blizzard',
    ],
    friendly: [
      '371st Rifle Division: 10 riflemen, 6 ski troopers, 2 DPs',
      'A T-34, a T-60, 2 mortar crews and 4 militia squads',
      'PTRD teams and fresh riflemen at every village you take',
      'Artillery, smoke, Katyusha, and the Il-2 when it clears',
    ],
  },
  // Stand-ins until the russiaSummer winter variant and the stalingrad winter ruins exist (STALINGRAD_BUILD.md).
  theatre: 'germany',
  timeOfDay: 'dawn',
  mode: 'assault',
  length: 26000,
  // The unlock order (DECISIONS 295): the sanitarka for the long winter attack, and the militia battalions (the
  // Militia Squad of 1941, the Conscript Squad of 1942; listed in every Soviet mission from here on).
  newUnit: 'medic',
  unlocks: ['conscript'],
  newSupport: 'airStrike',
  units: [
    ['sapper', 'rifle', 'lmg', 'assault', 'mortar', 'medic', 'at', 'tank', 'conscript'],
    ['sapper', 'rifle', 'lmg', 'mortar', 'at', 'tank'],
  ],
  supports: [
    ['artillery', 'smoke', 'katyusha', 'airStrike'],
    ['artillery'],
  ],
  start: [
    {
      faction: 'soviet',
      hasHq: true,
      supplies: 600,
      hqHpMul: 1,
      incomeMul: 1,
      sappers: 4,
      forces: [
        { kind: 'rifle', count: 10 },
        // Ski troopers (the assault kind until the skis tag exists) in white snow smocks (the `skiTroops` look).
        { kind: 'assault', count: 6, look: 'skiTroops' },
        { kind: 'lmg', count: 2 },
        { kind: 'tank', count: 1, x: 1200 },
        // T-60 (the lightTank kind).
        { kind: 'lightTank', count: 1, x: 1350 },
        // Two mortar crews and the militia battalion's four squads.
        { kind: 'mortar', count: 2 },
        { kind: 'conscript', count: 20 },
      ],
    },
    {
      faction: 'german',
      hasHq: true,
      supplies: 150,
      hqHpMul: 1,
      incomeMul: 0.7,
      sappers: 2,
      forces: [
        // V1, the first village (izbas).
        { kind: 'rifle', count: 8, trenchId: 1 },
        { kind: 'lmg', count: 1, trenchId: 1 },
        // T1 in the fir forest.
        { kind: 'rifle', count: 6, trenchId: 2, behaviour: 'garrison' },
        { kind: 'lmg', count: 1, trenchId: 2, behaviour: 'garrison' },
        { kind: 'mortar', count: 1, x: 11600, behaviour: 'guard' },
        // T2 on the highway, with a Pak 38 crew (the at kind).
        { kind: 'rifle', count: 6, trenchId: 3, behaviour: 'garrison' },
        { kind: 'lmg', count: 2, trenchId: 3, behaviour: 'garrison' },
        { kind: 'at', count: 1, trenchId: 3, behaviour: 'garrison' },
        // Klin: houses, the church and the station.
        { kind: 'rifle', count: 6, trenchId: 4, behaviour: 'garrison' },
        { kind: 'lmg', count: 1, trenchId: 4, behaviour: 'garrison' },
        { kind: 'rifle', count: 6, trenchId: 5, behaviour: 'garrison' },
        { kind: 'lmg', count: 1, trenchId: 5, behaviour: 'garrison' },
        { kind: 'at', count: 1, trenchId: 5, behaviour: 'garrison' },
        { kind: 'mortar', count: 2, x: 24200, behaviour: 'guard' },
        // The 1st Panzer Division's tanks in Klin: a Panzer III and a Panzer IV frozen in place, one Panzer IV running.
        { kind: 'lightTank', count: 1, x: 24600, behaviour: 'guard', look: 'panzer3h' },
        { kind: 'tank', count: 1, x: 24900, behaviour: 'guard' },
        { kind: 'tank', count: 1, x: 22600, behaviour: 'guard' },
      ],
    },
  ],
  trenches: [
    // V1, the first village (P1).
    { id: 1, x: 7000, width: 190, slots: 8, owner: 1 },
    // T1 in the fir forest (near P2, the forest edge).
    { id: 2, x: 11000, width: 180, slots: 7, owner: 1 },
    // T2 on the highway (P3).
    { id: 3, x: 16500, width: 190, slots: 8, owner: 1 },
    // Klin: the houses at the edge of town and the church by the station.
    { id: 4, x: 21000, width: 190, slots: 8, owner: 1 },
    { id: 5, x: 23500, width: 200, slots: 8, owner: 1 },
  ],
  pillboxes: [],
  wire: [{ id: 1, x: 15000, width: 120, owner: 1 }],
  timer: null,
  events: [
    // Phase 1, "Night approach" (V1).
    { type: 'announce', when: { at: 1 }, text: 'Night approach: the ski battalions are moving off into the forest.' },
    {
      type: 'hint',
      when: { at: 5 },
      text: 'The ski troops are fast. Send them with the riflemen at the first village; the mortars stay behind and shell it.',
    },
    {
      type: 'hint',
      when: { at: 60 },
      about: 'conscript',
      text: 'New: Militia Squad. One order brings a whole squad, cheap and many. They will not win a firefight alone, but they soak up the machine guns.',
    },
    {
      type: 'hint',
      when: { at: 30 },
      about: 'medic',
      text: 'New: Sanitarka. She patches up the wounded near her but carries no weapon. Keep her just behind the attack.',
    },
    { type: 'announce', when: { trenchCapturedBy: 0, trenchId: 1 }, text: 'The first village is ours. The men crowd into the izbas to get warm.' },
    // Phase 2, "Through the forest".
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 1, delay: 8 },
      side: 0,
      forces: [
        { kind: 'at', count: 3, x: 6800 },
        { kind: 'rifle', count: 6, x: 6700 },
      ],
      announce: 'PTRD teams and a fresh company have come up to the village.',
    },
    {
      type: 'hint',
      when: { trenchCapturedBy: 0, trenchId: 1, delay: 12 },
      text: 'Each position you take brings your next troops up to it. Smoke before the forest trench saves lives.',
    },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 1, delay: 120 },
      side: 1,
      forces: [
        { kind: 'rifle', count: 6, x: 10600, behaviour: 'assault' },
        { kind: 'lightTank', count: 1, x: 10800, behaviour: 'assault' },
      ],
      announce: 'Counter-attack from the forest!',
    },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 1, delay: 25 },
      side: 1,
      forces: [
        { kind: 'rifle', count: 5, x: 12400 },
        { kind: 'lmg', count: 1, x: 12500 },
      ],
      announce: 'German reserves are hurrying into the forest trench.',
    },
    // Phase 3, "Cut the highway".
    { type: 'announce', when: { trenchCapturedBy: 0, trenchId: 2 }, text: 'Through the forest. The highway lies ahead.' },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 2, delay: 8 },
      side: 0,
      forces: [
        { kind: 'rifle', count: 6, x: 10800 },
        { kind: 'lmg', count: 1, x: 10700 },
        { kind: 'mortar', count: 1, x: 10600 },
      ],
      announce: 'The next battalion has come up through the forest.',
    },
    {
      type: 'hint',
      when: { trenchCapturedBy: 0, trenchId: 2, delay: 15 },
      text: 'The weather is clearing. The Il-2s can fly: use them on the column on the highway and on their tanks.',
    },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 2, delay: 60 },
      side: 1,
      forces: [
        { kind: 'apc', count: 2, x: 18600, behaviour: 'assault' },
        { kind: 'rifle', count: 8, x: 18400, behaviour: 'assault' },
        { kind: 'tank', count: 1, x: 18800, behaviour: 'assault' },
      ],
      announce: 'A German column is on the highway!',
    },
    // Phase 4, "Klin".
    { type: 'announce', when: { trenchCapturedBy: 0, trenchId: 3 }, text: 'The highway is cut. Their only road home is closed.' },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 3, delay: 8 },
      side: 0,
      forces: [
        { kind: 'assault', count: 4, x: 16300 },
        { kind: 'rifle', count: 6, x: 16200 },
        { kind: 'at', count: 2, x: 16100 },
      ],
      announce: 'Reinforcements are up at the highway.',
    },
    {
      type: 'hint',
      when: { trenchCapturedBy: 0, trenchId: 3, delay: 15 },
      text: 'Klin, house by house: mortars and Katyusha on each strongpoint, then the assault troops. Their tanks in the town are frozen; the Il-2s will find them.',
    },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 3, delay: 25 },
      side: 1,
      forces: [
        { kind: 'rifle', count: 6, x: 22200 },
        { kind: 'lmg', count: 1, x: 22300 },
        { kind: 'mortar', count: 1, x: 22500 },
      ],
      announce: 'The Klin garrison is manning the houses at the edge of town.',
    },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 4, delay: 20 },
      side: 1,
      forces: [
        { kind: 'rifle', count: 6, behaviour: 'assault' },
        { kind: 'at', count: 1, behaviour: 'assault' },
      ],
      announce: 'Rear-guard troops are counter-attacking from the station.',
    },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 4, delay: 8 },
      side: 0,
      forces: [
        { kind: 'rifle', count: 6, x: 20800 },
        { kind: 'at', count: 2, x: 20700 },
      ],
      announce: 'More men are coming into the town.',
    },
    {
      type: 'wave',
      when: { hqHpBelow: 0.5, side: 1 },
      side: 1,
      forces: [
        { kind: 'rifle', count: 8, behaviour: 'assault' },
        { kind: 'lmg', count: 2, behaviour: 'assault' },
      ],
      announce: 'Every German in Klin is counter-attacking!',
    },
    {
      type: 'hint',
      when: { hqHpBelow: 0.5, side: 0 },
      text: 'The HQ is under fire. Fall Back lets its machine gun do the work while you rebuild.',
    },
  ],
  ai: {
    sappers: 3,
    build: [
      { kind: 'rifle', count: 8, after: 0 },
      { kind: 'lmg', count: 2, after: 40 },
      { kind: 'rifle', count: 14, after: 150 },
      { kind: 'mortar', count: 2, after: 240 },
      { kind: 'lmg', count: 3, after: 300 },
      { kind: 'at', count: 2, after: 400 },
      { kind: 'rifle', count: 18, after: 500 },
      { kind: 'tank', count: 1, after: 900 },
    ],
    firstAttackAfter: 600,
  },
  bot: {
    sappers: 6,
    build: [
      { kind: 'rifle', count: 8, after: 0 },
      { kind: 'mortar', count: 2, after: 0 },
      { kind: 'assault', count: 6, after: 20 },
      { kind: 'at', count: 3, after: 60 },
      { kind: 'lmg', count: 2, after: 90 },
      { kind: 'medic', count: 1, after: 120 },
      { kind: 'rifle', count: 12, after: 180 },
      { kind: 'at', count: 5, after: 300 },
      { kind: 'tank', count: 2, after: 400 },
    ],
    firstAttackAfter: 30,
  },
  // The design's 24 to 28 minutes assume deep snow, the night phases and the hold posture (STALINGRAD_BUILD.md).
  expectedMinutes: [13, 28],
  music: 'reichswald',
};
