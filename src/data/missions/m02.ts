import type { MissionDef } from '../schema';

/**
 * Mission 2: the Dunkirk perimeter, 1940. Survival: hold one trench for four minutes while the
 * German waves grow. There is no enemy HQ: the waves walk in from the right edge and always
 * advance. Introduces the Bren Gunner.
 */
export const M02: MissionDef = {
  id: 2,
  key: 'dunkirk',
  title: 'The Dunkirk Perimeter',
  location: 'Dunkirk, France',
  date: 'May 1940',
  mapPos: { lon: 2.38, lat: 51.03 },
  briefing: [
    'The Expeditionary Force is being lifted off the beaches at Dunkirk. Every hour the perimeter holds puts a few thousand more men aboard the little ships. Our sector is a stretch of canal bank east of the town, and the enemy knows it.',
    'You have one trench, a section of riflemen, and a Bren gun that came up with the last lorry. Ammunition is adequate. Reinforcement is not expected, though the dump behind battalion headquarters remains open for business.',
    'The navy asks for four more minutes. Hold the line until the clock runs out. There is nothing to be gained by going forward; the trench is your friend, and the Bren is its best argument.',
  ],
  objective: 'Hold your trench until the evacuation clock runs out.',
  theatre: 'france',
  timeOfDay: 'overcast',
  mode: 'survival',
  length: 6500,
  newUnit: 'lmg',
  newSupport: null,
  units: [
    ['sapper', 'rifle', 'lmg'],
    ['rifle', 'lmg', 'assault'],
  ],
  supports: [[], []],
  start: [
    {
      faction: 'british',
      hasHq: true,
      supplies: 200,
      hqHpMul: 1,
      incomeMul: 1,
      sappers: 2,
      forces: [
        { kind: 'rifle', count: 4, trenchId: 1 },
        { kind: 'lmg', count: 1, trenchId: 1 },
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
  trenches: [{ id: 1, x: 1700, width: 180, slots: 7, owner: 0 }],
  pillboxes: [],
  wire: [],
  timer: { seconds: 240, onExpire: 'win', label: 'Evacuation' },
  events: [
    {
      type: 'hint',
      when: { at: 2 },
      text: 'Survive until the clock runs out. There is no enemy HQ to take, so stay on Hold and let them come to you.',
    },
    { type: 'wave', when: { at: 4 }, side: 1, forces: [{ kind: 'rifle', count: 4 }], announce: 'German infantry are probing the perimeter.' },
    {
      type: 'hint',
      when: { at: 14 },
      text: 'Train a Bren Gunner. His long bursts cut down infantry in the open, and the trench keeps him alive.',
    },
    { type: 'wave', when: { every: 24, from: 26, until: 190 }, side: 1, forces: [{ kind: 'rifle', count: 3 }] },
    {
      type: 'hint',
      when: { at: 40 },
      text: 'Men in a trench take only a fraction of rifle fire. Keep it full; whoever does not fit waits just behind it.',
    },
    {
      type: 'wave',
      when: { at: 60 },
      side: 1,
      forces: [
        { kind: 'rifle', count: 3 },
        { kind: 'assault', count: 2 },
      ],
      announce: 'Assault troops with grenades are coming in.',
    },
    {
      type: 'hint',
      when: { at: 75 },
      text: 'Grenades ignore trench cover. Kill the assault troops before they get close: Bren Gunners do that best.',
    },
    {
      type: 'wave',
      when: { at: 100 },
      side: 1,
      forces: [
        { kind: 'rifle', count: 4 },
        { kind: 'lmg', count: 1 },
        { kind: 'assault', count: 3 },
      ],
      announce: 'A heavy attack is forming up.',
    },
    {
      type: 'wave',
      when: { at: 140 },
      side: 1,
      forces: [
        { kind: 'rifle', count: 5 },
        { kind: 'lmg', count: 2 },
        { kind: 'assault', count: 4 },
      ],
    },
    {
      type: 'wave',
      when: { at: 175 },
      side: 1,
      forces: [
        { kind: 'rifle', count: 6 },
        { kind: 'lmg', count: 2 },
        { kind: 'assault', count: 5 },
      ],
      announce: 'The last German push of the day.',
    },
    {
      type: 'hint',
      when: { hqHpBelow: 0.5, side: 0 },
      text: 'They are at the HQ. Fall Back shelters everyone inside while its machine gun fights; Hold again once they thin out.',
    },
  ],
  // Side 1 has no HQ: everything it fields arrives in the scripted waves.
  ai: { sappers: 0, build: [], firstAttackAfter: 0 },
  bot: {
    sappers: 4,
    build: [
      { kind: 'rifle', count: 6, after: 0 },
      { kind: 'lmg', count: 2, after: 15 },
      { kind: 'rifle', count: 9, after: 50 },
      { kind: 'lmg', count: 4, after: 80 },
      { kind: 'rifle', count: 14, after: 120 },
      { kind: 'lmg', count: 6, after: 150 },
    ],
    firstAttackAfter: 9999,
  },
  expectedMinutes: [4, 4.2],
};
