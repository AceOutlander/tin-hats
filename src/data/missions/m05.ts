import type { MissionDef } from '../schema';

/**
 * Mission 5: Primosole Bridge, Sicily, 1943. Timed: destroy the enemy HQ before nightfall (the
 * sky darkens as the deadline nears). Enemy snipers appear. Introduces the Sniper.
 * FIRST DRAFT (placeholder layout and plans): valid and loadable, to be replaced by the mission author.
 */
export const M05: MissionDef = {
  id: 5,
  key: 'primosole',
  title: 'Primosole Bridge',
  location: 'Primosole Bridge, Sicily',
  date: 'July 1943',
  mapPos: { lon: 15.06, lat: 37.4 },
  briefing: [
    'The bridge over the Simeto must be in our hands before dark. German paratroops hold the far bank.',
    'Their snipers are good. Ours are better, and they have just arrived.',
    'Destroy the German HQ before nightfall.',
  ],
  objective: 'Destroy the German HQ before nightfall.',
  theatre: 'sicily',
  timeOfDay: 'dusk',
  mode: 'assault',
  length: 9000,
  newUnit: 'sniper',
  newSupport: null,
  units: [
    ['sapper', 'rifle', 'lmg', 'assault', 'mortar', 'sniper'],
    ['sapper', 'rifle', 'lmg', 'mortar', 'sniper'],
  ],
  supports: [['artillery'], []],
  start: [
    {
      faction: 'british',
      hasHq: true,
      supplies: 350,
      hqHpMul: 1,
      incomeMul: 1,
      sappers: 3,
      forces: [
        { kind: 'rifle', count: 5, trenchId: 1 },
        { kind: 'sniper', count: 1 },
        { kind: 'assault', count: 2 },
      ],
    },
    {
      faction: 'german',
      hasHq: true,
      supplies: 150,
      hqHpMul: 0.9,
      incomeMul: 0.7,
      sappers: 2,
      forces: [
        { kind: 'rifle', count: 4, trenchId: 2 },
        { kind: 'sniper', count: 1 },
        { kind: 'lmg', count: 1, trenchId: 2 },
      ],
    },
  ],
  trenches: [
    { id: 1, x: 1500, width: 160, slots: 6, owner: 0 },
    { id: 2, x: 5200, width: 160, slots: 6, owner: 1 },
  ],
  pillboxes: [{ id: 1, x: 6800, side: 1, hpMul: 0.8 }],
  wire: [{ id: 1, x: 4950, width: 100, owner: 1 }],
  timer: { seconds: 600, onExpire: 'lose', label: 'Nightfall' },
  events: [
    { type: 'hint', when: { at: 4 }, text: 'Snipers pick off machine gunners, mortar crews and medics from very long range.' },
    { type: 'announce', when: { at: 480 }, text: 'Two minutes of daylight left.' },
  ],
  ai: {
    sappers: 2,
    build: [
      { kind: 'rifle', count: 5, after: 0 },
      { kind: 'sniper', count: 2, after: 60 },
      { kind: 'lmg', count: 2, after: 120 },
      { kind: 'rifle', count: 8, after: 240 },
    ],
    firstAttackAfter: 300,
  },
  bot: {
    sappers: 4,
    build: [
      { kind: 'rifle', count: 5, after: 0 },
      { kind: 'sniper', count: 2, after: 20 },
      { kind: 'assault', count: 5, after: 40 },
      { kind: 'mortar', count: 2, after: 60 },
      { kind: 'rifle', count: 9, after: 120 },
      { kind: 'assault', count: 8, after: 160 },
    ],
    firstAttackAfter: 150,
  },
  expectedMinutes: [6, 9],
};
