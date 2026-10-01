import type { MissionDef } from '../schema';

/**
 * Mission 3: Operation Crusader, Libya, 1941. The first enemy trench line to storm: one German
 * trench across the track, garrisoned from the start, with the HQ behind it. Introduces the
 * Assault Trooper, whose grenades ignore trench cover.
 */
export const M03: MissionDef = {
  id: 3,
  key: 'crusader',
  title: 'Operation Crusader',
  location: 'Sidi Rezegh, Libya',
  date: 'November 1941',
  mapPos: { lon: 24.1, lat: 31.95 },
  briefing: [
    'Eighth Army has gone over to the offensive to relieve Tobruk. The armour is somewhere to the south, disputing the escarpment with Rommel; the infantry have been told to get on with it, which is what infantry are for.',
    'Ahead of you the enemy has dug a trench line across the track, garrisoned with riflemen and a machine gun, and his headquarters sits behind it. Riflemen alone will not shift men in a trench. The Assault Troopers have arrived from the depot with sub-machine guns and a generous issue of grenades.',
    'Build up a mixed company, then rush the trench with Assault Troopers in the lead, take it, and carry on to the headquarters. Water is rationed; daylight is not, but do not waste it.',
  ],
  objective: 'Storm the German trench and destroy their HQ.',
  theatre: 'desert',
  timeOfDay: 'day',
  mode: 'assault',
  length: 7500,
  newUnit: 'assault',
  newSupport: null,
  units: [
    ['sapper', 'rifle', 'lmg', 'assault'],
    ['sapper', 'rifle', 'lmg'],
  ],
  supports: [[], []],
  start: [
    {
      faction: 'british',
      hasHq: true,
      supplies: 250,
      hqHpMul: 1,
      incomeMul: 1,
      sappers: 2,
      forces: [
        { kind: 'rifle', count: 4, trenchId: 1 },
        { kind: 'lmg', count: 1, trenchId: 1 },
        { kind: 'assault', count: 2 },
      ],
    },
    {
      faction: 'german',
      hasHq: true,
      supplies: 100,
      hqHpMul: 1,
      incomeMul: 0.6,
      sappers: 2,
      forces: [
        { kind: 'rifle', count: 4, trenchId: 2 },
        { kind: 'lmg', count: 1, trenchId: 2 },
        { kind: 'rifle', count: 2 },
      ],
    },
  ],
  trenches: [
    { id: 1, x: 1500, width: 160, slots: 6, owner: 0 },
    { id: 2, x: 4900, width: 180, slots: 7, owner: 1 },
  ],
  pillboxes: [],
  wire: [],
  timer: null,
  events: [
    {
      type: 'hint',
      when: { at: 3 },
      text: 'The enemy is dug in. Men in a trench shrug off most rifle and machine-gun fire.',
    },
    {
      type: 'hint',
      when: { at: 18 },
      text: 'Train Assault Troopers. They are fast, and their grenades hit men in a trench as hard as men in the open.',
    },
    {
      type: 'hint',
      when: { at: 60 },
      text: 'Riflemen and Bren Gunners screen the attack. Wait until you have five or six Assault Troopers, then Advance together.',
    },
    {
      type: 'hint',
      when: { trenchCapturedBy: 0, trenchId: 2, delay: 1 },
      text: 'Trench taken. Your hold line moves up to it: Hold here to regroup, or press on to the HQ.',
    },
    {
      type: 'announce',
      when: { trenchCapturedBy: 0, trenchId: 2 },
      text: 'The German line is broken.',
    },
    {
      type: 'hint',
      when: { hqHpBelow: 0.5, side: 0 },
      text: 'Your HQ is under fire. Fall Back lets its machine gun do the work while you rebuild.',
    },
  ],
  ai: {
    sappers: 2,
    build: [
      { kind: 'rifle', count: 4, after: 0 },
      { kind: 'lmg', count: 1, after: 60 },
      { kind: 'rifle', count: 6, after: 150 },
      { kind: 'lmg', count: 2, after: 240 },
      { kind: 'rifle', count: 9, after: 300 },
    ],
    firstAttackAfter: 270,
  },
  bot: {
    sappers: 4,
    build: [
      { kind: 'rifle', count: 4, after: 0 },
      { kind: 'assault', count: 4, after: 20 },
      { kind: 'lmg', count: 2, after: 40 },
      { kind: 'assault', count: 7, after: 70 },
      { kind: 'rifle', count: 8, after: 90 },
      { kind: 'assault', count: 10, after: 150 },
      { kind: 'rifle', count: 12, after: 200 },
    ],
    firstAttackAfter: 130,
  },
  expectedMinutes: [4, 7],
};
