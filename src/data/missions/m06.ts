import type { MissionDef } from '../schema';

/**
 * Mission 6: Monte Cassino, Italy, 1944. Three fortified lines, the heaviest defences so far.
 * Introduces the Medic and the Smoke Screen.
 * FIRST DRAFT (placeholder layout and plans): valid and loadable, to be replaced by the mission author.
 */
export const M06: MissionDef = {
  id: 6,
  key: 'cassino',
  title: 'Monte Cassino',
  location: 'Cassino, Italy',
  date: 'May 1944',
  mapPos: { lon: 13.81, lat: 41.49 },
  briefing: [
    'The Gustav Line has held all spring. Three fortified lines stand between us and the monastery hill.',
    'Medics will keep your men in the fight, and smoke will hide them while they cross the open ground.',
    'Break all three lines and destroy the German HQ.',
  ],
  objective: 'Break three fortified lines and destroy the German HQ.',
  theatre: 'italy',
  timeOfDay: 'day',
  mode: 'assault',
  length: 10000,
  newUnit: 'medic',
  newSupport: 'smoke',
  units: [
    ['sapper', 'rifle', 'lmg', 'assault', 'mortar', 'sniper', 'medic'],
    ['sapper', 'rifle', 'lmg', 'assault', 'mortar', 'sniper', 'medic'],
  ],
  supports: [['artillery', 'smoke'], ['artillery']],
  start: [
    {
      faction: 'british',
      hasHq: true,
      supplies: 400,
      hqHpMul: 1,
      incomeMul: 1,
      sappers: 3,
      forces: [
        { kind: 'rifle', count: 5, trenchId: 1 },
        { kind: 'lmg', count: 1, trenchId: 1 },
        { kind: 'medic', count: 1 },
        { kind: 'mortar', count: 1 },
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
        { kind: 'rifle', count: 4, trenchId: 2 },
        { kind: 'rifle', count: 3, trenchId: 3 },
        { kind: 'lmg', count: 1, trenchId: 3 },
        { kind: 'rifle', count: 3, trenchId: 4 },
      ],
    },
  ],
  trenches: [
    { id: 1, x: 1500, width: 160, slots: 6, owner: 0 },
    { id: 2, x: 4500, width: 160, slots: 6, owner: 1 },
    { id: 3, x: 6200, width: 160, slots: 6, owner: 1 },
    { id: 4, x: 7900, width: 160, slots: 6, owner: 1 },
  ],
  pillboxes: [
    { id: 1, x: 4750, side: 1, hpMul: 0.8 },
    { id: 2, x: 6450, side: 1, hpMul: 1 },
  ],
  wire: [
    { id: 1, x: 4250, width: 100, owner: 1 },
    { id: 2, x: 5950, width: 100, owner: 1 },
  ],
  timer: null,
  events: [
    { type: 'hint', when: { at: 4 }, text: 'Medics heal wounded infantry near them. Keep one behind every attack.' },
    { type: 'hint', when: { at: 40 }, text: 'A Smoke Screen blocks direct fire. Lay it in front of your men as they Advance.' },
  ],
  ai: {
    sappers: 2,
    build: [
      { kind: 'rifle', count: 5, after: 0 },
      { kind: 'lmg', count: 1, after: 60 },
      { kind: 'mortar', count: 1, after: 120 },
      { kind: 'medic', count: 1, after: 180 },
      { kind: 'rifle', count: 8, after: 300 },
    ],
    firstAttackAfter: 360,
  },
  bot: {
    sappers: 4,
    build: [
      { kind: 'rifle', count: 5, after: 0 },
      { kind: 'mortar', count: 2, after: 20 },
      { kind: 'assault', count: 5, after: 40 },
      { kind: 'medic', count: 2, after: 60 },
      { kind: 'lmg', count: 2, after: 80 },
      { kind: 'rifle', count: 9, after: 120 },
      { kind: 'assault', count: 8, after: 160 },
    ],
    firstAttackAfter: 160,
  },
  expectedMinutes: [7, 10],
};
