import type { MissionDef } from '../schema';

/**
 * Mission 4: El Alamein, Egypt, 1942. Two trench lines, wire and the first pillboxes.
 * Introduces the Mortar Team and the Artillery Barrage.
 * FIRST DRAFT (placeholder layout and plans): valid and loadable, to be replaced by the mission author.
 */
export const M04: MissionDef = {
  id: 4,
  key: 'alamein',
  title: 'El Alamein',
  location: 'El Alamein, Egypt',
  date: 'October 1942',
  mapPos: { lon: 28.95, lat: 30.83 },
  briefing: [
    'Eighth Army attacks at El Alamein. The enemy holds two trench lines behind wire, with pillboxes covering the gaps.',
    'Mortar Teams and the divisional artillery have come up. Use them to crack the line before the infantry go in.',
    'Break both lines and destroy the German HQ.',
  ],
  objective: 'Break both trench lines and destroy the German HQ.',
  theatre: 'desert',
  timeOfDay: 'dawn',
  mode: 'assault',
  length: 8500,
  newUnit: 'mortar',
  newSupport: 'artillery',
  units: [
    ['sapper', 'rifle', 'lmg', 'assault', 'mortar'],
    ['sapper', 'rifle', 'lmg', 'mortar'],
  ],
  supports: [['artillery'], []],
  start: [
    {
      faction: 'british',
      hasHq: true,
      supplies: 300,
      hqHpMul: 1,
      incomeMul: 1,
      sappers: 3,
      forces: [
        { kind: 'rifle', count: 4, trenchId: 1 },
        { kind: 'lmg', count: 1, trenchId: 1 },
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
      ],
    },
  ],
  trenches: [
    { id: 1, x: 1500, width: 160, slots: 6, owner: 0 },
    { id: 2, x: 4600, width: 160, slots: 6, owner: 1 },
    { id: 3, x: 6300, width: 160, slots: 6, owner: 1 },
  ],
  pillboxes: [{ id: 1, x: 4850, side: 1, hpMul: 0.8 }],
  wire: [{ id: 1, x: 4350, width: 100, owner: 1 }],
  timer: null,
  events: [
    { type: 'hint', when: { at: 4 }, text: 'Mortar Teams lob shells into trenches and onto pillboxes from long range.' },
    { type: 'hint', when: { at: 30 }, text: 'Call an Artillery Barrage on the enemy trench before you Advance.' },
  ],
  ai: {
    sappers: 2,
    build: [
      { kind: 'rifle', count: 5, after: 0 },
      { kind: 'lmg', count: 1, after: 60 },
      { kind: 'mortar', count: 1, after: 120 },
      { kind: 'rifle', count: 8, after: 240 },
    ],
    firstAttackAfter: 300,
  },
  bot: {
    sappers: 4,
    build: [
      { kind: 'rifle', count: 5, after: 0 },
      { kind: 'mortar', count: 2, after: 20 },
      { kind: 'assault', count: 5, after: 40 },
      { kind: 'lmg', count: 2, after: 60 },
      { kind: 'rifle', count: 9, after: 120 },
      { kind: 'assault', count: 8, after: 160 },
    ],
    firstAttackAfter: 150,
  },
  expectedMinutes: [5, 8],
};
