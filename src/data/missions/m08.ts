import type { MissionDef } from '../schema';

/**
 * Mission 8: Hill 112, Normandy, July 1944. Open ground and armour on both sides: two German
 * trench lines on the slopes, a little wire, no pillboxes, panzers in the field and anti-tank teams
 * in the trenches. Introduces the Churchill: bullets barely scratch it, its gun smashes trenches
 * and its tracks crush wire, but German anti-tank teams will hunt it, so infantry must go with it.
 */
export const M08: MissionDef = {
  id: 8,
  key: 'hill112',
  title: 'Hill 112',
  location: 'Hill 112, Normandy',
  date: 'July 1944',
  mapPos: { lon: -0.51, lat: 49.12 },
  briefing: [
    'Hill 112 is not much of a hill: a long bare swell of cornfield between the Odon and the Orne, a hundred and twelve metres at its crest. But whoever holds the top can see everything for miles, and for three weeks both sides have been finding that out the expensive way. Our infantry have taken it twice and been shelled off it twice.',
    'This time the tanks have come up with the infantry. The Churchill is slow, rather ugly and quite remarkably well armoured; rifle bullets bounce off it and the Germans have little else at hand except anti-tank teams and their own Panzers. The ground is open and there is nowhere to hide a tank, so expect the Panzers to be waiting for you.',
    'Bring a Churchill or two up behind the riflemen, let them roll over the wire and flatten the trenches, and keep the infantry close enough to deal with the anti-tank teams that will come for it. Take the crest, then the village behind it, and put the German headquarters out of action.',
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
  supports: [['artillery', 'smoke'], []],
  start: [
    {
      faction: 'british',
      hasHq: true,
      supplies: 450,
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
      supplies: 200,
      hqHpMul: 1,
      incomeMul: 0.7,
      sappers: 3,
      forces: [
        { kind: 'rifle', count: 7, trenchId: 2 },
        { kind: 'rifle', count: 4, trenchId: 3 },
        { kind: 'lmg', count: 1, trenchId: 3 },
        { kind: 'at', count: 1, trenchId: 3 },
        { kind: 'rifle', count: 3, trenchId: 4 },
        { kind: 'tank', count: 1, x: 6900 },
      ],
    },
  ],
  trenches: [
    { id: 1, x: 1800, width: 160, slots: 6, owner: 0 },
    { id: 2, x: 4900, width: 170, slots: 7, owner: 1 },
    { id: 3, x: 7400, width: 190, slots: 8, owner: 1 },
    { id: 4, x: 9300, width: 160, slots: 6, owner: 1 },
  ],
  pillboxes: [],
  wire: [
    { id: 1, x: 4650, width: 100, owner: 1 },
    { id: 2, x: 7150, width: 120, owner: 1 },
  ],
  timer: null,
  events: [
    { type: 'hint', when: { at: 3 }, text: 'Open ground, and armour on both sides. Whoever uses tanks best takes the hill.' },
    {
      type: 'hint',
      when: { at: 12 },
      text: 'Train a Churchill. Bullets barely scratch it, its gun smashes infantry and trenches, and it flattens wire.',
    },
    {
      type: 'hint',
      when: { at: 70 },
      text: 'Panzerschreck Teams hunt tanks. Keep riflemen beside the Churchill and shoot the teams before they get close.',
    },
    { type: 'announce', when: { trenchCapturedBy: 0, trenchId: 3 }, text: 'The crest of Hill 112 is ours.' },
    {
      type: 'hint',
      when: { trenchCapturedBy: 0, trenchId: 3, delay: 2 },
      text: 'Hold the crest and rebuild your armour. The Germans will come for it.',
    },
    {
      type: 'wave',
      when: { at: 400 },
      side: 1,
      forces: [
        { kind: 'tank', count: 2, x: 8200, behaviour: 'assault' },
        { kind: 'rifle', count: 4, x: 7900, behaviour: 'assault' },
      ],
      announce: 'German armour is counter-attacking.',
    },
    {
      type: 'hint',
      when: { hqHpBelow: 0.5, side: 0 },
      text: 'The HQ is under heavy fire. Fall Back lets its machine gun do the work while you rebuild.',
    },
  ],
  ai: {
    sappers: 3,
    build: [
      { kind: 'rifle', count: 5, after: 0 },
      { kind: 'tank', count: 1, after: 100 },
      { kind: 'lmg', count: 1, after: 150 },
      { kind: 'rifle', count: 8, after: 200 },
      { kind: 'tank', count: 2, after: 300 },
    ],
    firstAttackAfter: 330,
  },
  bot: {
    sappers: 5,
    build: [
      { kind: 'rifle', count: 5, after: 0 },
      { kind: 'tank', count: 2, after: 20 },
      { kind: 'at', count: 2, after: 40 },
      { kind: 'lmg', count: 2, after: 90 },
      { kind: 'mortar', count: 1, after: 120 },
      { kind: 'rifle', count: 9, after: 150 },
      { kind: 'tank', count: 3, after: 200 },
    ],
    firstAttackAfter: 200,
  },
  expectedMinutes: [8, 11],
};
