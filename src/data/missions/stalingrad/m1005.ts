import type { MissionDef } from '../../schema';

/**
 * Stalingrad 5: Crossing the Volga, night of 14 to 15 September 1942 (docs/campaigns/STALINGRAD.md, mission 5). The
 * 13th Guards Rifle Division crosses to the central landing under fire, clears the houses along the high bank and
 * takes the central railway station against the 71st Infantry Division.
 *
 * Built with today's engine (docs/campaigns/STALINGRAD_BUILD.md, mission 1005): the river has no water yet, so trained
 * units walk across from the east bank; the boats are free reinforcement waves landing at the landing stage, one load
 * at a time, and the barrage on the river is a smaller load. The houses, the station and the nail factory are
 * trenches; the win is the German HQ beyond the station. Flares, the ferry's batching of trained units, the night to
 * day changes, the Stukas from daylight, the station hold's prep phase and its timer wait for their features.
 */
export const M1005: MissionDef = {
  id: 1005,
  key: 'volga',
  title: 'Crossing the Volga',
  location: 'Central landing, Stalingrad',
  date: '15 September 1942',
  dateIso: '1942-09-15',
  climate: 'city',
  mapPos: { lon: 44.527, lat: 48.709 },
  briefing: [
    'Guardsmen, the city is burning from end to end and the Germans are almost at the river. If they take the central landing, the army over there has no door left. Tonight we cross.',
    'There are not enough boats and not enough rifles. Some of you will land with grenades and nothing else; take a rifle from the first man who no longer needs it. The guns on this bank and the rocket batteries will fire for us. The boats will keep coming, one load at a time.',
    'Get off the sand and up the bank before it is light. Clear the houses along the river, then take the railway station and hold it. Every hour we hold the centre, another regiment gets across.',
  ],
  // Today's win rule: the German HQ beyond the station (the station hold's timer waits for the director).
  objective: 'Land, clear the river bank, take the central station and destroy the German HQ.',
  intel: {
    enemy: [
      '71st Infantry Division holds the bank and the station',
      'About 65 riflemen with MG34 and MG42 teams',
      '4 Panzer III, a StuG III, pioneers with flamethrowers',
      'Stukas from first light',
    ],
    friendly: [
      '13th Guards: 10 riflemen, 8 PPSh troopers, a DP gunner',
      'More boats keep landing: about a hundred men',
      'Only 120 Money: the ferries are slow',
      'Artillery and Katyusha from the east bank',
    ],
  },
  // Stand-ins until the stalingrad theatre (autumn ruins) exists (STALINGRAD_BUILD.md).
  theatre: 'holland',
  timeOfDay: 'night',
  mode: 'assault',
  length: 12000,
  // The unlock order (DECISIONS 295): the ROKS-3, for the houses on the bank. The sniper comes with Mamayev Kurgan.
  newUnit: 'flame',
  newSupport: null,
  units: [
    ['sapper', 'rifle', 'lmg', 'assault', 'mortar', 'medic', 'at', 'tank', 'flame', 'conscript'],
    // The AI trains riflemen, MGs and Pak crews; its assault troops, mortars, pioneers and panzers come in the waves.
    ['sapper', 'rifle', 'lmg', 'at'],
  ],
  supports: [
    ['artillery', 'katyusha'],
    ['airStrike'],
  ],
  start: [
    {
      faction: 'soviet',
      hasHq: true,
      supplies: 120,
      hqHpMul: 1,
      incomeMul: 1,
      sappers: 3,
      forces: [
        // The first boats at the landing stage: riflemen, PPSh troopers (four of them loaned) and a DP gunner.
        { kind: 'rifle', count: 10, trenchId: 1 },
        { kind: 'assault', count: 8, x: 4560 },
        { kind: 'lmg', count: 1, trenchId: 1 },
      ],
    },
    {
      faction: 'german',
      hasHq: true,
      supplies: 150,
      hqHpMul: 1,
      incomeMul: 0.5,
      sappers: 2,
      forces: [
        // B1 and B2, the riverside apartment blocks.
        { kind: 'rifle', count: 6, trenchId: 2 },
        { kind: 'lmg', count: 2, trenchId: 2 },
        { kind: 'rifle', count: 6, trenchId: 3, behaviour: 'garrison' },
        { kind: 'lmg', count: 2, trenchId: 3, behaviour: 'garrison' },
        // B5, the central station.
        { kind: 'rifle', count: 8, trenchId: 4, behaviour: 'garrison' },
        { kind: 'lmg', count: 2, trenchId: 4, behaviour: 'garrison' },
        // B6, the nail factory hall.
        { kind: 'rifle', count: 4, trenchId: 5, behaviour: 'garrison' },
        { kind: 'mortar', count: 1, x: 11250, behaviour: 'guard' },
      ],
    },
  ],
  trenches: [
    // P1, the central landing.
    { id: 1, x: 4700, width: 230, slots: 10, owner: 0 },
    // Buildings until FOUNDATIONS 4.3: B1 and B2 (P2) on the high bank, B5 the station, B6 the nail factory.
    { id: 2, x: 6500, width: 180, slots: 8, owner: 1 },
    { id: 3, x: 7400, width: 180, slots: 8, owner: 1 },
    { id: 4, x: 10200, width: 230, slots: 10, owner: 1 },
    { id: 5, x: 11000, width: 170, slots: 6, owner: 1 },
  ],
  pillboxes: [],
  wire: [],
  timer: null,
  events: [
    // Phase 1, "The landing".
    { type: 'announce', when: { at: 1 }, text: 'The landing: the first boats are grinding onto the sand.' },
    {
      type: 'hint',
      when: { at: 4 },
      text: 'New troops arrive with each boat. Hold the landing until the battalion is ashore.',
    },
    {
      type: 'wave',
      when: { at: 20 },
      side: 1,
      forces: [{ kind: 'rifle', count: 8, x: 6300, behaviour: 'assault' }],
      announce: 'Counter-attack from the houses!',
    },
    {
      type: 'wave',
      when: { at: 40 },
      side: 0,
      forces: [
        { kind: 'rifle', count: 4, x: 4600 },
        { kind: 'assault', count: 1, x: 4560 },
      ],
      announce: 'Another boat is in.',
    },
    { type: 'announce', when: { at: 62 }, text: 'Shells on the river: the next boat has been hit.' },
    {
      type: 'wave',
      when: { at: 80 },
      side: 0,
      forces: [{ kind: 'rifle', count: 2, x: 4600 }],
      announce: 'What is left of the boat\'s load has struggled ashore.',
    },
    {
      type: 'wave',
      when: { at: 100 },
      side: 1,
      forces: [
        { kind: 'rifle', count: 8, x: 6300, behaviour: 'assault' },
        { kind: 'lmg', count: 1, x: 6400, behaviour: 'assault' },
      ],
      announce: 'They are coming down to the water again.',
    },
    {
      type: 'wave',
      when: { at: 120 },
      side: 0,
      forces: [
        { kind: 'rifle', count: 4, x: 4600 },
        { kind: 'lmg', count: 1, x: 4560 },
      ],
      announce: 'Another boat is in.',
    },
    {
      type: 'wave',
      when: { at: 160 },
      side: 0,
      forces: [
        { kind: 'rifle', count: 4, x: 4600 },
        { kind: 'assault', count: 2, x: 4560 },
      ],
      announce: 'The last of the battalion is ashore.',
    },
    // Phase 2, "The high bank".
    { type: 'announce', when: { at: 180 }, text: 'The high bank: clear the houses along the river.' },
    {
      type: 'wave',
      when: { at: 182 },
      side: 0,
      forces: [{ kind: 'flame', count: 1, x: 4600 }],
      announce: 'A ROKS flamethrower has come over with the engineers.',
    },
    {
      type: 'hint',
      when: { at: 186 },
      about: 'flame',
      text: 'New: ROKS-3 Flamethrower. Buildings work like trenches; grenades and flamethrowers clear them.',
    },
    {
      type: 'wave',
      when: { every: 60, from: 240, until: 1500 },
      side: 0,
      forces: [
        { kind: 'rifle', count: 3, x: 4600 },
        { kind: 'assault', count: 1, x: 4560 },
      ],
      announce: 'Another regiment\'s boats are getting across.',
    },
    { type: 'announce', when: { trenchCapturedBy: 0, trenchId: 3 }, text: 'The riverside blocks are ours. The station lies ahead.' },
    // Phase 3, "The station".
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 3, delay: 6 },
      side: 0,
      forces: [{ kind: 'at', count: 3, trenchId: 3, behaviour: 'garrison' }],
      announce: 'Three PTRD teams have come up to the high bank.',
    },
    {
      type: 'hint',
      when: { trenchCapturedBy: 0, trenchId: 3, delay: 10 },
      text: 'Mortars on the station, the Katyusha on its reserves; then the riflemen go in behind the grenades.',
    },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 3, delay: 90 },
      side: 1,
      forces: [
        { kind: 'tank', count: 2, x: 11400, behaviour: 'assault' },
        { kind: 'rifle', count: 8, x: 11300, behaviour: 'assault' },
      ],
      announce: 'Panzers are coming down from the station square.',
    },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 3, delay: 200 },
      side: 1,
      forces: [
        { kind: 'tank', count: 1, x: 11400, behaviour: 'assault', look: 'stug3f' },
        { kind: 'assault', count: 6, x: 11300, behaviour: 'assault' },
      ],
      announce: 'An assault gun with sub-machine gunners.',
    },
    // Phase 4, "Hold the station".
    { type: 'announce', when: { trenchCapturedBy: 0, trenchId: 4 }, text: 'The station is ours. Hold it.' },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 4, delay: 30 },
      side: 1,
      forces: [{ kind: 'rifle', count: 6, behaviour: 'assault' }],
      announce: 'Counter-attack on the station!',
    },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 4, delay: 120 },
      side: 1,
      forces: [
        { kind: 'tank', count: 2, behaviour: 'assault' },
        { kind: 'rifle', count: 6, behaviour: 'assault' },
      ],
      announce: 'Panzers are counter-attacking the station.',
    },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 4, delay: 200 },
      side: 1,
      forces: [
        { kind: 'rifle', count: 6, behaviour: 'assault' },
        { kind: 'flame', count: 2, behaviour: 'assault' },
      ],
      announce: 'Their pioneers are coming with flamethrowers.',
    },
    {
      type: 'hint',
      when: { hqHpBelow: 0.5, side: 0 },
      text: 'The HQ is under fire. Fall Back lets its machine gun do the work while you rebuild.',
    },
  ],
  ai: {
    sappers: 2,
    build: [
      { kind: 'rifle', count: 6, after: 0 },
      { kind: 'lmg', count: 2, after: 60 },
      { kind: 'rifle', count: 10, after: 240 },
      { kind: 'at', count: 2, after: 300 },
    ],
    firstAttackAfter: 900,
  },
  bot: {
    sappers: 4,
    build: [
      { kind: 'rifle', count: 6, after: 0 },
      { kind: 'assault', count: 6, after: 20 },
      { kind: 'mortar', count: 2, after: 60 },
      { kind: 'flame', count: 2, after: 120 },
      { kind: 'at', count: 3, after: 180 },
      { kind: 'rifle', count: 10, after: 240 },
      { kind: 'at', count: 5, after: 360 },
    ],
    firstAttackAfter: 185,
  },
  // The design's 20 to 23 minutes include the 180 s landing hold and the 240 s station hold (STALINGRAD_BUILD.md).
  expectedMinutes: [9, 23],
  music: 'arnhem',
};
