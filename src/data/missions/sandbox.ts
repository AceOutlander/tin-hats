import type { MissionAiPlan, MissionDef, SideStart, UnitKind } from '../schema';

/**
 * Test grounds, not part of the campaign (not listed in MISSIONS): every unit and every support
 * for both sides, generous supplies, and all the fortifications, so tests, tools and debug pages
 * can exercise the whole simulation.
 */

const EVERY_UNIT: UnitKind[] = ['sapper', 'rifle', 'lmg', 'assault', 'mortar', 'sniper', 'medic', 'at', 'tank', 'heavyTank'];

/** A mixed army grown in steps, used by both commanders on both grounds. */
const PLAN: MissionAiPlan = {
  sappers: 4,
  build: [
    { kind: 'rifle', count: 4, after: 0 },
    { kind: 'lmg', count: 1, after: 0 },
    { kind: 'medic', count: 1, after: 20 },
    { kind: 'rifle', count: 8, after: 30 },
    { kind: 'assault', count: 2, after: 40 },
    { kind: 'mortar', count: 1, after: 50 },
    { kind: 'at', count: 1, after: 60 },
    { kind: 'sniper', count: 1, after: 70 },
    { kind: 'tank', count: 1, after: 90 },
    { kind: 'assault', count: 4, after: 120 },
    { kind: 'mortar', count: 2, after: 150 },
    { kind: 'at', count: 2, after: 150 },
  ],
  firstAttackAfter: 90,
};

const BRIEFING = ['A proving ground. Every unit and every call-in is available to both sides.'];

/**
 * 8000 wu. One British trench with wire in front; two German trench lines, each backed by a
 * pillbox, with wire before the first; a King Tiger guarding the German rear.
 */
export const SANDBOX: MissionDef = {
  id: 901,
  key: 'sandbox',
  title: 'Proving Ground',
  location: 'Salisbury Plain, England',
  date: '1944',
  mapPos: { lon: -1.8, lat: 51.2 },
  briefing: BRIEFING,
  objective: 'Destroy the enemy HQ.',
  theatre: 'france',
  timeOfDay: 'day',
  mode: 'assault',
  length: 8000,
  newUnit: null,
  newSupport: null,
  units: [EVERY_UNIT, EVERY_UNIT],
  supports: [
    ['artillery', 'smoke', 'airStrike'],
    ['artillery', 'smoke', 'airStrike'],
  ],
  start: [
    {
      faction: 'british',
      hasHq: true,
      supplies: 2500,
      hqHpMul: 1.5,
      incomeMul: 1.5,
      sappers: 4,
      forces: [
        { kind: 'rifle', count: 4, trenchId: 1 },
        { kind: 'lmg', count: 1, trenchId: 1 },
        { kind: 'medic', count: 1 },
        { kind: 'assault', count: 2 },
        { kind: 'mortar', count: 1 },
        { kind: 'sniper', count: 1 },
        { kind: 'at', count: 1 },
        { kind: 'tank', count: 1 },
      ],
    },
    {
      faction: 'german',
      hasHq: true,
      supplies: 2500,
      hqHpMul: 1.5,
      incomeMul: 1.5,
      sappers: 4,
      forces: [
        { kind: 'rifle', count: 4, trenchId: 2 },
        { kind: 'lmg', count: 1, trenchId: 2 },
        { kind: 'rifle', count: 3, trenchId: 3 },
        { kind: 'mortar', count: 1 },
        { kind: 'medic', count: 1 },
        { kind: 'assault', count: 2 },
        { kind: 'sniper', count: 1 },
        { kind: 'at', count: 1 },
        { kind: 'heavyTank', count: 1, x: 7150, behaviour: 'guard' },
      ],
    },
  ],
  trenches: [
    { id: 1, x: 1700, width: 130, slots: 6, owner: 0 },
    { id: 2, x: 4700, width: 130, slots: 6, owner: 1 },
    { id: 3, x: 6000, width: 130, slots: 6, owner: 1 },
  ],
  pillboxes: [
    { id: 1, x: 4900, side: 1, hpMul: 1 },
    { id: 2, x: 6200, side: 1, hpMul: 1 },
  ],
  wire: [
    { id: 1, x: 1930, width: 80, owner: 0 },
    { id: 2, x: 4450, width: 100, owner: 1 },
  ],
  timer: null,
  events: [{ type: 'announce', when: { at: 1 }, text: 'Proving ground: everything is available.' }],
  ai: PLAN,
  bot: PLAN,
  expectedMinutes: [4, 30],
};

function mirrorStart(faction: SideStart['faction'], trenchId: number): SideStart {
  return {
    faction,
    hasHq: true,
    supplies: 2000,
    hqHpMul: 1,
    incomeMul: 1,
    sappers: 3,
    forces: [
      { kind: 'rifle', count: 4, trenchId },
      { kind: 'lmg', count: 1, trenchId },
      { kind: 'mortar', count: 1 },
    ],
  };
}

/**
 * The fairness ground: everything mirrored about the middle. Each side has one trench with wire in
 * front of it, the same garrison, the same supplies and the same build plan.
 */
export const SANDBOX_MIRROR: MissionDef = {
  ...SANDBOX,
  id: 902,
  key: 'sandboxMirror',
  title: 'Proving Ground (mirrored)',
  start: [mirrorStart('british', 1), mirrorStart('german', 2)],
  trenches: [
    { id: 1, x: 1800, width: 130, slots: 6, owner: 0 },
    { id: 2, x: 6200, width: 130, slots: 6, owner: 1 },
  ],
  pillboxes: [],
  wire: [
    { id: 1, x: 2050, width: 80, owner: 0 },
    { id: 2, x: 5950, width: 80, owner: 1 },
  ],
  events: [],
};
