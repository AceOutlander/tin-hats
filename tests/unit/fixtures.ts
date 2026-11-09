/**
 * Test missions that belong to no campaign. The game's own missions are the Stalingrad campaign's (src/data/missions);
 * these are the plain grounds the sim, session and app tests were written against.
 */
import type { MissionDef } from '../../src/data/schema';

/**
 * The test field: an open French field in daylight, riflemen and sappers only on both sides, no trenches, pillboxes or
 * wire, a weakly held enemy command post. Its rules are those of the removed British mission 1 (Arras), so the tests
 * built on it keep testing the same battle; it is a fixture, not a mission of the game (id 901, outside every
 * campaign). Its scripted hints are the plain "how to play" lines a first battle shows.
 */
export const FIELD: MissionDef = {
  id: 901,
  key: 'testField',
  title: 'Test field',
  location: 'A field in France',
  date: 'May 1940',
  mapPos: { lon: 2.78, lat: 50.29 },
  briefing: ['A plain field for the tests: an enemy command post, thinly held and not dug in.'],
  objective: 'Destroy the German command post.',
  theatre: 'france',
  timeOfDay: 'day',
  mode: 'assault',
  length: 6000,
  newUnit: 'rifle',
  newSupport: null,
  units: [
    ['sapper', 'rifle'],
    ['sapper', 'rifle'],
  ],
  supports: [[], []],
  start: [
    {
      faction: 'british',
      hasHq: true,
      supplies: 150,
      hqHpMul: 1,
      incomeMul: 1,
      sappers: 2,
      forces: [{ kind: 'rifle', count: 2 }],
    },
    {
      faction: 'german',
      hasHq: true,
      supplies: 60,
      hqHpMul: 0.7,
      incomeMul: 0.55,
      sappers: 1,
      forces: [{ kind: 'rifle', count: 2 }],
    },
  ],
  trenches: [],
  pillboxes: [],
  wire: [],
  timer: null,
  events: [
    {
      type: 'hint',
      when: { at: 2 },
      text: 'Sappers carry boxes from the dump to your HQ: that is your money. Train another Sapper to earn faster.',
    },
    {
      type: 'hint',
      when: { at: 16 },
      text: 'Money buys troops. Train Riflemen to build your company.',
    },
    {
      type: 'hint',
      when: { at: 38 },
      text: 'Orders move the whole army. Hold keeps the line, Advance attacks, Fall Back shelters everyone in the HQ.',
    },
    {
      type: 'hint',
      when: { at: 75 },
      text: 'When you outnumber the enemy, order Advance and destroy their command post.',
    },
    {
      type: 'hint',
      when: { hqHpBelow: 0.5, side: 0 },
      text: 'Your HQ is taking a beating. Fall Back lets its machine gun do the work while you rebuild.',
    },
  ],
  ai: {
    sappers: 1,
    build: [
      { kind: 'rifle', count: 3, after: 0 },
      { kind: 'rifle', count: 5, after: 60 },
      { kind: 'rifle', count: 8, after: 150 },
      { kind: 'rifle', count: 12, after: 270 },
    ],
    firstAttackAfter: 150,
  },
  bot: {
    sappers: 4,
    build: [
      { kind: 'rifle', count: 4, after: 0 },
      { kind: 'rifle', count: 8, after: 40 },
      { kind: 'rifle', count: 14, after: 80 },
      { kind: 'rifle', count: 20, after: 150 },
    ],
    firstAttackAfter: 105,
  },
  expectedMinutes: [3, 4],
  music: 'arras',
};
