import type { MissionDef } from '../schema';

/**
 * Mission 7: Sword Beach, Normandy, 6 June 1944. A weak beachhead HQ with low income under
 * pillboxes overlooking the beach; a panzer counter-attack arrives late. Introduces the PIAT Team.
 * FIRST DRAFT (placeholder layout and plans): valid and loadable, to be replaced by the mission author.
 */
export const M07: MissionDef = {
  id: 7,
  key: 'sword',
  title: 'Sword Beach',
  location: 'Sword Beach, Normandy',
  date: '6 June 1944',
  mapPos: { lon: -0.3, lat: 49.29 },
  briefing: [
    'D-Day. You are ashore with a thin beachhead, and pillboxes look straight down onto the sand.',
    'Supplies are short until the beach is cleared. Expect panzers later in the day: the PIAT Teams are for them.',
    'Clear the pillboxes, hold off the counter-attack and destroy the German HQ.',
  ],
  objective: 'Clear the beach defences and destroy the German HQ.',
  theatre: 'normandy',
  timeOfDay: 'dawn',
  mode: 'assault',
  length: 10500,
  newUnit: 'at',
  newSupport: null,
  units: [
    ['sapper', 'rifle', 'lmg', 'assault', 'mortar', 'sniper', 'medic', 'at'],
    ['sapper', 'rifle', 'lmg', 'mortar', 'sniper', 'medic', 'at', 'tank'],
  ],
  supports: [['artillery', 'smoke'], ['artillery']],
  start: [
    {
      faction: 'british',
      hasHq: true,
      supplies: 300,
      hqHpMul: 0.6,
      incomeMul: 0.7,
      sappers: 2,
      forces: [
        { kind: 'rifle', count: 5 },
        { kind: 'assault', count: 3 },
        { kind: 'mortar', count: 1 },
      ],
    },
    {
      faction: 'german',
      hasHq: true,
      supplies: 200,
      hqHpMul: 1,
      incomeMul: 0.7,
      sappers: 2,
      forces: [
        { kind: 'rifle', count: 4, trenchId: 1 },
        { kind: 'lmg', count: 1, trenchId: 1 },
        { kind: 'rifle', count: 3, trenchId: 2 },
      ],
    },
  ],
  trenches: [
    { id: 1, x: 3000, width: 160, slots: 6, owner: 1 },
    { id: 2, x: 6000, width: 160, slots: 6, owner: 1 },
  ],
  pillboxes: [
    { id: 1, x: 2300, side: 1, hpMul: 0.9 },
    { id: 2, x: 2700, side: 1, hpMul: 0.9 },
  ],
  wire: [{ id: 1, x: 2050, width: 120, owner: 1 }],
  timer: null,
  events: [
    { type: 'hint', when: { at: 4 }, text: 'PIAT Teams knock out tanks and pillboxes. They are poor against infantry.' },
    {
      type: 'wave',
      when: { at: 480 },
      side: 1,
      forces: [
        { kind: 'tank', count: 2, behaviour: 'assault' },
        { kind: 'rifle', count: 4, behaviour: 'assault' },
      ],
      announce: 'Panzers! The counter-attack is coming in.',
    },
  ],
  ai: {
    sappers: 2,
    build: [
      { kind: 'rifle', count: 5, after: 0 },
      { kind: 'lmg', count: 1, after: 60 },
      { kind: 'mortar', count: 1, after: 120 },
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
      { kind: 'at', count: 3, after: 60 },
      { kind: 'medic', count: 1, after: 80 },
      { kind: 'rifle', count: 9, after: 120 },
      { kind: 'at', count: 4, after: 300 },
    ],
    firstAttackAfter: 160,
  },
  expectedMinutes: [8, 11],
};
