import type { Difficulty, FactionId, MissionDef } from '../schema';

/**
 * Basic Training: the standalone tutorial on the title screen (owner, 2026-11-08). It belongs to no campaign (it is not
 * in MISSIONS and campaignOf gives null), so a win never counts as a clear; finishing it once pays MEDALS.trainingReward.
 * The guided steps that walk a new player through it are in src/data/tutorial.ts.
 *
 * A training ground behind the lines, 6000 wu (FOUNDATIONS.md: tutorials are 6,000 to 9,000), played as the Red Army
 * (it ships with Stalingrad, the only campaign: DECISIONS 438). From the player's side: the HQ, a trench of our own in
 * front of it, an empty trench to take (also a capture point, so the Deploy lesson has a forward point to send new men
 * to), an old enemy pillbox (the practice target for the call-in), a trench held by a few men of the mock enemy, and
 * the mock enemy's HQ. The mock enemy is weak on purpose: a thin HQ, a trickle of income, a handful of
 * riflemen, and it never attacks while the lesson is on, so the course takes 5 to 10 minutes and cannot be lost by
 * a player who follows the tips.
 */

/** The mission id: four digits, outside every campaign's range (FOUNDATIONS.md: 1001 to 1010 is Stalingrad). */
export const BASIC_TRAINING_ID = 9001;

/** Always played on the easiest difficulty, whatever the briefing was last set to. */
export const BASIC_TRAINING_DIFFICULTY: Difficulty = 'normal';

export const BASIC_TRAINING: MissionDef = {
  id: BASIC_TRAINING_ID,
  key: 'basicTraining',
  title: 'Basic Training',
  location: 'Training ground, behind the lines',
  date: '1940s',
  mapPos: { lon: 37.6, lat: 55.8 },
  briefing: [
    'Welcome to the training ground. Short tips show you the ropes, one at a time.',
    'Ahead of you: an empty trench to take, an old pillbox to shell, and a mock enemy that will not put up much of a fight.',
  ],
  objective: 'Follow the tips, then destroy the mock enemy HQ.',
  theatre: 'russiaSummer',
  timeOfDay: 'day',
  mode: 'assault',
  length: 6000,
  newUnit: null,
  newSupport: null,
  units: [
    ['sapper', 'rifle', 'lmg'],
    ['sapper', 'rifle'],
  ],
  supports: [['artillery'], []],
  start: [
    {
      faction: 'soviet',
      hasHq: true,
      supplies: 200,
      // Call-ins are medal-bought charges (DECISIONS 413): the course lends its own two barrages (one for the lesson,
      // one spare), so it never spends the save's charges and no call-in costs money.
      supportCharges: { artillery: 2 },
      hqHpMul: 1.5,
      incomeMul: 1.3,
      sappers: 2,
      // Two Bren gunners from the start, so the per-unit-type orders have a second type to speak to.
      forces: [
        { kind: 'rifle', count: 2 },
        { kind: 'lmg', count: 2 },
      ],
    },
    {
      faction: 'german',
      hasHq: true,
      supplies: 0,
      hqHpMul: 1.2,
      incomeMul: 0.25,
      sappers: 1,
      // The practice targets that shoot back: a few men dug in, who stay in their trench until it falls.
      forces: [{ kind: 'rifle', count: 4, trenchId: 3, behaviour: 'garrison' }],
    },
  ],
  trenches: [
    { id: 1, x: 900, width: 130, slots: 8, owner: 0 },
    { id: 2, x: 2100, width: 130, slots: 8, owner: -1 },
    { id: 3, x: 4600, width: 130, slots: 6, owner: 1 },
  ],
  // The old pillbox: the practice target for the call-in, nearly a ruin (56 of 700 hp), so the one barrage the lesson
  // asks for destroys it however its shells scatter. At a third of its health it survived about nine barrages in ten,
  // and riflemen barely scratch a pillbox: the army then stood under its gun for minutes (DECISIONS 321).
  pillboxes: [{ id: 1, x: 3900, side: 1, hpMul: 0.08 }],
  wire: [],
  // The course opens with a short prep phase: the first lesson is building (the student wires the ground ahead).
  // The empty trench is a capture point: once taken, new men can deploy there (the Deploy lesson).
  capturePoints: [{ id: 'P1', x: 2100, width: 300, label: 'Forward trench', owner: -1, captureTime: 0, spawn: true, contestRadius: 600, structure: { trench: 2 } }],
  prep: { seconds: 45, buildables: ['wire', 'foxhole'], bot: [{ kind: 'wire', x: 1250 }] },
  timer: null,
  events: [],
  ai: {
    sappers: 1,
    build: [{ kind: 'rifle', count: 3, after: 150 }],
    // Never on the attack while the course runs (the lesson takes about five minutes).
    firstAttackAfter: 900,
  },
  bot: {
    sappers: 3,
    build: [
      { kind: 'rifle', count: 5, after: 0 },
      { kind: 'rifle', count: 10, after: 60 },
    ],
    firstAttackAfter: 120,
  },
  expectedMinutes: [5, 10],
  music: 'arras',
};

/**
 * Basic Training played as a nation: the player side is the nation of the campaign on show (the Red Army for
 * Stalingrad); the mock enemy is always German.
 */
export function trainingMission(nation: FactionId = 'soviet'): MissionDef {
  const [own, enemy] = BASIC_TRAINING.start;
  if (nation === own.faction) return BASIC_TRAINING;
  return { ...BASIC_TRAINING, start: [{ ...own, faction: nation }, enemy] };
}
