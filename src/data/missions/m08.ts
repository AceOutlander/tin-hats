import type { MissionDef } from '../schema';

/**
 * Mission 8: Hill 112, Normandy, 1944. Open ground and armour on both sides.
 * Introduces the Churchill tank.
 * FIRST DRAFT (placeholder layout and plans): valid and loadable, to be replaced by the mission author.
 */
export const M08: MissionDef = {
  id: 8,
  key: 'hill112',
  title: 'Hill 112',
  location: 'Hill 112, Normandy',
  date: 'July 1944',
  mapPos: { lon: -0.52, lat: 49.13 },
  briefing: [
    'Hill 112 overlooks half of Normandy. Whoever holds it holds the Odon valley.',
    'The ground is open and the enemy has armour. So, at last, do we: the Churchills have arrived.',
    'Take the hill and destroy the German HQ.',
  ],
  objective: 'Take Hill 112 and destroy the German HQ.',
  theatre: 'france',
  timeOfDay: 'day',
  mode: 'assault',
  length: 11000,
  newUnit: 'tank',
  newSupport: null,
  units: [
    ['sapper', 'rifle', 'lmg', 'assault', 'mortar', 'sniper', 'medic', 'at', 'tank'],
    ['sapper', 'rifle', 'lmg', 'assault', 'mortar', 'sniper', 'medic', 'at', 'tank'],
  ],
  supports: [['artillery', 'smoke'], ['artillery']],
  start: [
    {
      faction: 'british',
      hasHq: true,
      supplies: 500,
      hqHpMul: 1,
      incomeMul: 1,
      sappers: 4,
      forces: [
        { kind: 'rifle', count: 5, trenchId: 1 },
        { kind: 'at', count: 1 },
        { kind: 'tank', count: 1 },
      ],
    },
    {
      faction: 'german',
      hasHq: true,
      supplies: 300,
      hqHpMul: 1,
      incomeMul: 0.75,
      sappers: 3,
      forces: [
        { kind: 'rifle', count: 4, trenchId: 2 },
        { kind: 'at', count: 1 },
        { kind: 'tank', count: 1 },
      ],
    },
  ],
  trenches: [
    { id: 1, x: 1600, width: 160, slots: 6, owner: 0 },
    { id: 2, x: 7500, width: 160, slots: 6, owner: 1 },
  ],
  pillboxes: [],
  wire: [],
  timer: null,
  events: [{ type: 'hint', when: { at: 4 }, text: 'The Churchill shrugs off bullets but fears anti-tank teams. Keep infantry with it.' }],
  ai: {
    sappers: 3,
    build: [
      { kind: 'rifle', count: 5, after: 0 },
      { kind: 'at', count: 2, after: 60 },
      { kind: 'tank', count: 1, after: 120 },
      { kind: 'lmg', count: 1, after: 180 },
      { kind: 'tank', count: 2, after: 360 },
      { kind: 'rifle', count: 8, after: 360 },
    ],
    firstAttackAfter: 360,
  },
  bot: {
    sappers: 5,
    build: [
      { kind: 'rifle', count: 5, after: 0 },
      { kind: 'at', count: 2, after: 20 },
      { kind: 'tank', count: 2, after: 60 },
      { kind: 'lmg', count: 2, after: 90 },
      { kind: 'mortar', count: 1, after: 120 },
      { kind: 'rifle', count: 9, after: 150 },
      { kind: 'tank', count: 3, after: 200 },
    ],
    firstAttackAfter: 200,
  },
  expectedMinutes: [8, 12],
};
