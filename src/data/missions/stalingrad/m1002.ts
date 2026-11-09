import type { MissionDef } from '../../schema';

/**
 * Stalingrad 2: Dubno, 27 June 1941 (docs/campaigns/STALINGRAD.md, mission 2). Popel's group of the 8th Mechanized
 * Corps strikes north-east through Verba into the rear of the 11th Panzer Division and cuts its supply road at Dubno.
 * The player starts with a large, mostly obsolete tank force: one KV-1 and one KV-2, three T-34s, and three BT-7s and
 * two T-26s (the light tanks are the majority, as in the 34th Tank Division).
 *
 * Built with today's engine (docs/campaigns/STALINGRAD_BUILD.md, mission 1002): the mission is an assault on the
 * German supply column park at the end of the Ikva road (the enemy HQ); the "delay" mode, the 12-tank kill count, the
 * capture point at the crossroads and the phase 2 income cut wait for the mission director. Dubno's houses are trenches,
 * the two Flak 88s are anti-tank teams on guard (no German gun kind engages tanks yet), and phase 2's counter-attacks
 * are keyed to the capture of the crossroads trench.
 */
export const M1002: MissionDef = {
  id: 1002,
  key: 'dubno',
  title: 'Dubno',
  location: 'Dubno, Volhynia, Ukrainian SSR',
  date: '27 June 1941',
  dateIso: '1941-06-27',
  climate: 'temperate',
  mapPos: { lon: 25.73, lat: 50.42 },
  briefing: [
    'The order came this morning: we strike north-east through Verba for Dubno, this afternoon. Half the corps is strung out behind us, broken down or dry of fuel, and the German bombers have had the sky to themselves since Sunday. We go with what is running.',
    'Their panzers have raced ahead of their infantry and their columns. The Panzer IIIs are quick and well handled, but their small guns bounce off our KVs. The eighty-eights do not, so find them first. Most of our tanks are old T-26s and BTs; the few KVs and T-34s are the best tanks on this field, so spend them wisely.',
    'One corps cannot throw the enemy back across the border. We can cut his road at Dubno, burn his tanks and hold him until dark, so the armies behind us can form a line. Destroy twelve of his tanks and keep him off the crossings.',
  ],
  // Today's win rule: the HQ is the supply column park on the Ikva road (the kill count and the hold wait, see above).
  objective: 'Take Dubno, then cut the road: destroy the German supply park on the Ikva road.',
  theatre: 'france',
  timeOfDay: 'day',
  mode: 'assault',
  length: 22000,
  newUnit: null,
  newSupport: null,
  units: [
    ['sapper', 'rifle', 'lmg', 'assault', 'mortar', 'at', 'tank'],
    ['sapper', 'rifle', 'lmg', 'mortar', 'at', 'tank'],
  ],
  supports: [['artillery'], ['airStrike', 'artillery']],
  start: [
    {
      faction: 'soviet',
      hasHq: true,
      supplies: 400,
      hqHpMul: 1,
      incomeMul: 1,
      sappers: 3,
      forces: [
        // KV-1 and KV-2 (the heavyTank kind; the second is the kv2 look, one spacing (22 wu) behind the first, as before).
        { kind: 'heavyTank', count: 1, x: 1300 },
        { kind: 'heavyTank', count: 1, x: 1278, look: 'kv2' },
        { kind: 'tank', count: 3, x: 1500 },
        // Three BT-7s (the era's light tank) and two T-26s behind them, in the same five places as one force of five.
        { kind: 'lightTank', count: 3, x: 1750 },
        { kind: 'lightTank', count: 2, x: 1684, look: 't26' },
        { kind: 'rifle', count: 8 },
        { kind: 'lmg', count: 1 },
        // Loans: three Tank Hunters and two mortar crews.
        { kind: 'at', count: 3 },
        { kind: 'mortar', count: 2 },
      ],
    },
    {
      faction: 'german',
      hasHq: true,
      supplies: 150,
      hqHpMul: 1,
      incomeMul: 0.6,
      sappers: 2,
      forces: [
        // T1 in the rye fields: riflemen, an MG34 and a Pak 36 crew (the `at` kind until the pak36 look exists).
        { kind: 'rifle', count: 6, trenchId: 1 },
        { kind: 'lmg', count: 1, trenchId: 1 },
        { kind: 'at', count: 1, trenchId: 1 },
        // Two Panzer III Ausf. E and two Panzer II scouts patrolling the fields.
        { kind: 'lightTank', count: 4, x: 6200, behaviour: 'guard' },
        // The Flak 88 pair on the crossroads approach.
        { kind: 'at', count: 2, x: 8600, behaviour: 'guard' },
        // Dubno: riflemen and an MG in the houses.
        { kind: 'rifle', count: 3, trenchId: 2, behaviour: 'garrison' },
        { kind: 'rifle', count: 3, trenchId: 3, behaviour: 'garrison' },
        { kind: 'lmg', count: 1, trenchId: 3, behaviour: 'garrison' },
        // The column park's guard.
        { kind: 'rifle', count: 4, trenchId: 4, behaviour: 'garrison' },
        { kind: 'at', count: 1, trenchId: 4, behaviour: 'garrison' },
      ],
    },
  ],
  trenches: [
    { id: 1, x: 7500, width: 170, slots: 6, owner: 1 },
    // Dubno's houses until buildings exist: the western edge and the crossroads (P1).
    { id: 2, x: 13400, width: 170, slots: 6, owner: 1 },
    { id: 3, x: 14500, width: 190, slots: 8, owner: 1 },
    // The supply column park's guard on the Ikva road.
    { id: 4, x: 20200, width: 170, slots: 6, owner: 1 },
  ],
  pillboxes: [],
  wire: [],
  timer: null,
  events: [
    { type: 'announce', when: { at: 1 }, text: 'Strike for Dubno: the group moves off through Verba.' },
    {
      type: 'hint',
      when: { at: 4 },
      text: 'Your KVs shrug off the small panzer guns. Lead with them and keep the light tanks and riflemen just behind.',
    },
    {
      type: 'hint',
      when: { at: 30 },
      text: 'The KV\'s armour stops their guns. The eighty-eight does not: kill it with mortars or infantry first.',
    },
    {
      type: 'hint',
      when: { at: 90 },
      text: 'Stukas will come for your tanks. Keep moving and spread out; Tank Hunters and riflemen are cheap to replace, KVs are not.',
    },
    {
      type: 'wave',
      when: { at: 240 },
      side: 1,
      forces: [
        { kind: 'lightTank', count: 3, x: 15500, behaviour: 'assault' },
        { kind: 'rifle', count: 6, x: 15300, behaviour: 'assault' },
      ],
      announce: 'A panzer company is coming back up the road.',
    },
    { type: 'announce', when: { trenchCapturedBy: 0, trenchId: 1 }, text: 'Their supply columns are on the road ahead!' },
    {
      type: 'hint',
      when: { trenchCapturedBy: 0, trenchId: 1, delay: 3 },
      text: 'Riflemen in the houses of Dubno are as good as a trench. Take the western edge, then the crossroads.',
    },
    { type: 'announce', when: { trenchCapturedBy: 0, trenchId: 3 }, text: 'The crossroads are ours. The road behind us is cut; fuel and shells will be short.' },
    {
      type: 'hint',
      when: { trenchCapturedBy: 0, trenchId: 3, delay: 5 },
      text: 'Hold the crossroads. Park the KVs facing the road and keep the Tank Hunters in the houses for the panzers.',
    },
    // Phase 2, "Hold the crossroads": panzer counter-attacks from the Ikva road.
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 3, delay: 30 },
      side: 1,
      forces: [
        { kind: 'lightTank', count: 2, x: 18500, behaviour: 'assault' },
        { kind: 'tank', count: 1, x: 18700, behaviour: 'assault' },
        { kind: 'rifle', count: 6, x: 18400, behaviour: 'assault' },
      ],
      announce: 'Panzers are counter-attacking from the Ikva road.',
    },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 3, delay: 180 },
      side: 1,
      forces: [
        // Panzer IIIs with the 5 cm gun (the 11th Panzer had both guns; HISTORY.md).
        { kind: 'lightTank', count: 2, x: 18500, behaviour: 'assault', look: 'panzer3h' },
        { kind: 'tank', count: 1, x: 18700, behaviour: 'assault' },
        { kind: 'rifle', count: 6, x: 18400, behaviour: 'assault' },
      ],
      announce: 'More panzers on the road.',
    },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 3, delay: 330 },
      side: 1,
      forces: [
        { kind: 'lightTank', count: 2, x: 18500, behaviour: 'assault' },
        { kind: 'tank', count: 1, x: 18700, behaviour: 'assault' },
        { kind: 'rifle', count: 6, x: 18400, behaviour: 'assault' },
      ],
      announce: 'The 16th Panzer is feeling for our flank.',
    },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 3, delay: 480 },
      side: 1,
      forces: [
        { kind: 'lightTank', count: 4, x: 18500, behaviour: 'assault' },
        { kind: 'tank', count: 1, x: 18700, behaviour: 'assault' },
        { kind: 'rifle', count: 6, x: 18400, behaviour: 'assault' },
      ],
      announce: 'Their last panzers are coming at the crossroads.',
    },
    {
      type: 'hint',
      when: { trenchCapturedBy: 0, trenchId: 3, delay: 560 },
      text: 'Dusk is coming. Push down the Ikva road and burn the supply park before they can bring up more.',
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
      { kind: 'lmg', count: 1, after: 60 },
      { kind: 'at', count: 2, after: 120 },
      { kind: 'tank', count: 1, after: 240 },
      { kind: 'rifle', count: 10, after: 300 },
      { kind: 'at', count: 3, after: 420 },
      { kind: 'tank', count: 2, after: 600 },
    ],
    firstAttackAfter: 600,
  },
  bot: {
    sappers: 5,
    build: [
      { kind: 'rifle', count: 8, after: 0 },
      { kind: 'mortar', count: 2, after: 0 },
      { kind: 'at', count: 4, after: 30 },
      { kind: 'lmg', count: 2, after: 60 },
      { kind: 'tank', count: 2, after: 120 },
      { kind: 'rifle', count: 12, after: 200 },
      { kind: 'at', count: 6, after: 300 },
    ],
    firstAttackAfter: 20,
  },
  // The design's 20 to 24 minutes include the 600 s hold at the crossroads (STALINGRAD_BUILD.md).
  expectedMinutes: [12, 24],
  music: 'arras',
};
