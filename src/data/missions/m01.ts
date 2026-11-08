import type { MissionDef } from '../schema';

/**
 * Mission 1: Arras, 1940. The tutorial. An open field, riflemen and sappers
 * only on both sides, no trenches or pillboxes. The German command post is
 * weakly held: a competent player wins in three to four minutes.
 */
export const M01: MissionDef = {
  id: 1,
  key: 'arras',
  title: 'Counter-attack at Arras',
  location: 'Arras, France',
  date: 'May 1940',
  mapPos: { lon: 2.78, lat: 50.29 },
  briefing: [
    'The panzers have broken through and the army is falling back to the coast. Someone has to buy it time.',
    'A German command post has set up in the fields south of Arras. Its infantry screen is thin and it is not dug in.',
    'Put your sappers to work, raise a company of riflemen, and knock that command post out.',
  ],
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
      text: 'Sappers carry supplies from the dump to your HQ. Train another Sapper to earn faster.',
    },
    {
      type: 'hint',
      when: { at: 16 },
      text: 'Supplies buy troops. Train Riflemen to build your company.',
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
  /* Urgent and uncertain, France 1940, on the British campaign theme. */
  music: 'arras',
};
