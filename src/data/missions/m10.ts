import type { MissionDef } from '../schema';

/**
 * Mission 10: the Siegfried Line, Reichswald, 1945. The longest map: four trench lines, many
 * pillboxes, and the enemy uses everything. A King Tiger boss tank guards the German HQ.
 * Introduces the Typhoon Air Strike.
 * FIRST DRAFT (placeholder layout and plans): valid and loadable, to be replaced by the mission author.
 */
export const M10: MissionDef = {
  id: 10,
  key: 'reichswald',
  title: 'The Siegfried Line',
  location: 'Reichswald, Germany',
  date: 'February 1945',
  mapPos: { lon: 6.03, lat: 51.74 },
  briefing: [
    'Operation Veritable: through the Reichswald and the Siegfried Line, into Germany itself.',
    'Four trench lines, pillboxes everywhere, and a King Tiger guarding the German HQ. The Typhoons will help.',
    'Break the line and destroy the German HQ.',
  ],
  objective: 'Break the Siegfried Line and destroy the German HQ.',
  theatre: 'germany',
  timeOfDay: 'overcast',
  mode: 'assault',
  length: 14000,
  newUnit: null,
  newSupport: 'airStrike',
  units: [
    ['sapper', 'rifle', 'lmg', 'assault', 'mortar', 'sniper', 'medic', 'at', 'tank'],
    ['sapper', 'rifle', 'lmg', 'assault', 'mortar', 'sniper', 'medic', 'at', 'tank'],
  ],
  supports: [
    ['artillery', 'smoke', 'airStrike'],
    ['artillery', 'smoke'],
  ],
  start: [
    {
      faction: 'british',
      hasHq: true,
      supplies: 600,
      hqHpMul: 1.2,
      incomeMul: 1.1,
      sappers: 4,
      forces: [
        { kind: 'rifle', count: 5, trenchId: 1 },
        { kind: 'lmg', count: 1, trenchId: 1 },
        { kind: 'mortar', count: 1 },
        { kind: 'tank', count: 1 },
      ],
    },
    {
      faction: 'german',
      hasHq: true,
      supplies: 300,
      hqHpMul: 1.3,
      incomeMul: 0.8,
      sappers: 3,
      forces: [
        { kind: 'rifle', count: 4, trenchId: 2 },
        { kind: 'rifle', count: 4, trenchId: 3 },
        { kind: 'rifle', count: 3, trenchId: 4 },
        { kind: 'lmg', count: 1, trenchId: 4 },
        { kind: 'rifle', count: 3, trenchId: 5 },
        { kind: 'heavyTank', count: 1, x: 13000, behaviour: 'guard' },
      ],
    },
  ],
  trenches: [
    { id: 1, x: 1600, width: 160, slots: 6, owner: 0 },
    { id: 2, x: 4500, width: 160, slots: 6, owner: 1 },
    { id: 3, x: 7000, width: 160, slots: 6, owner: 1 },
    { id: 4, x: 9500, width: 160, slots: 6, owner: 1 },
    { id: 5, x: 11800, width: 160, slots: 6, owner: 1 },
  ],
  pillboxes: [
    { id: 1, x: 4750, side: 1, hpMul: 1 },
    { id: 2, x: 7250, side: 1, hpMul: 1 },
    { id: 3, x: 9750, side: 1, hpMul: 1 },
    { id: 4, x: 12050, side: 1, hpMul: 1.2 },
  ],
  wire: [
    { id: 1, x: 4250, width: 100, owner: 1 },
    { id: 2, x: 6750, width: 100, owner: 1 },
    { id: 3, x: 9250, width: 100, owner: 1 },
    { id: 4, x: 11550, width: 100, owner: 1 },
  ],
  timer: null,
  events: [
    { type: 'hint', when: { at: 4 }, text: 'The Typhoon Air Strike rakes a strip of ground with rockets. Save it for tanks.' },
    { type: 'announce', when: { trenchCapturedBy: 0, trenchId: 5 }, text: 'The last line is broken. The King Tiger waits ahead.' },
  ],
  ai: {
    sappers: 3,
    build: [
      { kind: 'rifle', count: 5, after: 0 },
      { kind: 'lmg', count: 1, after: 60 },
      { kind: 'mortar', count: 1, after: 120 },
      { kind: 'at', count: 1, after: 180 },
      { kind: 'tank', count: 1, after: 300 },
      { kind: 'rifle', count: 9, after: 420 },
    ],
    firstAttackAfter: 480,
  },
  bot: {
    sappers: 5,
    build: [
      { kind: 'rifle', count: 5, after: 0 },
      { kind: 'mortar', count: 2, after: 20 },
      { kind: 'assault', count: 5, after: 40 },
      { kind: 'at', count: 2, after: 60 },
      { kind: 'medic', count: 2, after: 80 },
      { kind: 'tank', count: 2, after: 120 },
      { kind: 'rifle', count: 9, after: 150 },
      { kind: 'at', count: 4, after: 300 },
    ],
    firstAttackAfter: 200,
  },
  expectedMinutes: [12, 15],
};
