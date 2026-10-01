import type { MissionDef } from '../schema';

/**
 * Mission 9: Arnhem Bridge, Netherlands, 1944. Survival: hold for six minutes against armour with
 * no tanks and no sappers. Supplies arrive only as periodic airdrops (no passive income).
 * FIRST DRAFT (placeholder layout and waves): valid and loadable, to be replaced by the mission author.
 */
export const M09: MissionDef = {
  id: 9,
  key: 'arnhem',
  title: 'Arnhem Bridge',
  location: 'Arnhem, Netherlands',
  date: 'September 1944',
  mapPos: { lon: 5.91, lat: 51.98 },
  briefing: [
    'The airborne have the north end of the bridge at Arnhem. XXX Corps is on its way. Somewhere.',
    'There are no tanks and no sappers, and the only supplies are what the RAF can drop to you.',
    'Hold for six minutes against whatever the SS panzer divisions send.',
  ],
  objective: 'Hold the bridge until relieved.',
  theatre: 'holland',
  timeOfDay: 'day',
  mode: 'survival',
  length: 9500,
  newUnit: null,
  newSupport: null,
  units: [
    ['rifle', 'lmg', 'assault', 'mortar', 'sniper', 'medic', 'at'],
    ['rifle', 'lmg', 'assault', 'mortar', 'sniper', 'medic', 'at', 'tank'],
  ],
  supports: [['artillery', 'smoke'], []],
  start: [
    {
      faction: 'british',
      hasHq: true,
      supplies: 400,
      hqHpMul: 1,
      incomeMul: 0,
      sappers: 0,
      forces: [
        { kind: 'rifle', count: 5, trenchId: 1 },
        { kind: 'lmg', count: 1, trenchId: 1 },
        { kind: 'at', count: 2 },
        { kind: 'medic', count: 1 },
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
  trenches: [{ id: 1, x: 1800, width: 180, slots: 7, owner: 0 }],
  pillboxes: [],
  wire: [{ id: 1, x: 2050, width: 100, owner: 0 }],
  timer: { seconds: 360, onExpire: 'win', label: 'Until relieved' },
  events: [
    { type: 'hint', when: { at: 3 }, text: 'No sappers here: supplies come only from the airdrops.' },
    { type: 'airdrop', when: { every: 30, from: 20, until: 340 }, side: 0, supplies: 120 },
    { type: 'wave', when: { every: 30, from: 10, until: 300 }, side: 1, forces: [{ kind: 'rifle', count: 4 }] },
    {
      type: 'wave',
      when: { at: 90 },
      side: 1,
      forces: [
        { kind: 'tank', count: 1 },
        { kind: 'rifle', count: 3 },
      ],
      announce: 'Armour on the bridge approach.',
    },
    {
      type: 'wave',
      when: { at: 200 },
      side: 1,
      forces: [
        { kind: 'tank', count: 2 },
        { kind: 'assault', count: 4 },
        { kind: 'rifle', count: 4 },
      ],
      announce: 'A heavy attack with panzers.',
    },
  ],
  ai: { sappers: 0, build: [], firstAttackAfter: 0 },
  bot: {
    sappers: 0,
    build: [
      { kind: 'at', count: 3, after: 0 },
      { kind: 'rifle', count: 7, after: 0 },
      { kind: 'lmg', count: 2, after: 30 },
      { kind: 'at', count: 5, after: 120 },
      { kind: 'rifle', count: 10, after: 150 },
    ],
    firstAttackAfter: 9999,
  },
  expectedMinutes: [6, 6.2],
};
