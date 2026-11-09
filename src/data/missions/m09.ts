import type { MissionDef } from '../schema';

/**
 * Mission 9: Arnhem Bridge, Netherlands, September 1944. Survival: hold the bridgehead for six
 * minutes against infantry and then armour. There is no enemy HQ (waves walk in from the right
 * edge), the player has no tanks and no sappers, and the only supplies are periodic airdrops.
 * Every Panzer is answered by PIAT Teams, so each drop has to be spent with care.
 */
export const M09: MissionDef = {
  id: 9,
  key: 'arnhem',
  title: 'Arnhem Bridge',
  location: 'Arnhem, Netherlands',
  date: 'September 1944',
  mapPos: { lon: 5.91, lat: 51.98 },
  briefing: [
    'The 1st Airborne Division was to seize the bridge at Arnhem and hold it for two days, until XXX Corps came up the road from the south. The drop went well enough. Unfortunately two SS panzer divisions were refitting a few miles away, nobody had mentioned it, and the radios have been behaving with great independence.',
    'Your battalion has the northern end of the bridge. You have a trench, a section of riflemen, a Bren gun, two PIATs and a medical orderly. You have no armour of your own, and nobody to spare to carry supplies. The only resupply is what the RAF can drop, a crate every half minute, and the Germans can see where each one lands.',
    'Hold the position. The relief column is said to be close, which in this campaign means that nobody knows how close. We have asked the staff for six minutes of your time and the signallers will tell you when the road is open. Spend each drop as it arrives; a PIAT team in the trench is worth three on the lorry.',
  ],
  objective: 'Hold the bridge until the relief column arrives.',
  theatre: 'holland',
  timeOfDay: 'day',
  mode: 'survival',
  length: 7000,
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
        { kind: 'at', count: 1, trenchId: 1 },
        { kind: 'at', count: 1 },
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
  wire: [{ id: 1, x: 2150, width: 110, owner: 0 }],
  timer: { seconds: 360, onExpire: 'win', label: 'Until relieved' },
  events: [
    {
      type: 'hint',
      when: { at: 3 },
      text: 'No sappers and no income here. Money comes only from the airdrops, so spend each one on what the line needs.',
    },
    {
      type: 'hint',
      when: { at: 20 },
      text: 'Panzers are coming. PIAT Teams in the trench are the answer: they outlast a tank that shells them from the open.',
    },
    { type: 'airdrop', when: { every: 30, from: 15, until: 345 }, side: 0, supplies: 140 },
    { type: 'wave', when: { every: 30, from: 0, until: 300 }, side: 1, forces: [{ kind: 'rifle', count: 3 }] },
    {
      type: 'wave',
      when: { at: 40 },
      side: 1,
      forces: [
        { kind: 'rifle', count: 2 },
        { kind: 'assault', count: 3 },
      ],
    },
    {
      type: 'wave',
      when: { at: 80 },
      side: 1,
      forces: [
        { kind: 'tank', count: 1 },
        { kind: 'rifle', count: 3 },
      ],
      announce: 'A Panzer on the bridge approach.',
    },
    {
      type: 'hint',
      when: { at: 120 },
      text: 'Keep the PIAT Teams in the trench with riflemen around them. A tank that cannot reach them is a tank that is being shot.',
    },
    {
      type: 'wave',
      when: { at: 150 },
      side: 1,
      forces: [
        { kind: 'tank', count: 1 },
        { kind: 'assault', count: 3 },
      ],
      announce: 'More armour is coming up the road.',
    },
    {
      type: 'wave',
      when: { at: 210 },
      side: 1,
      forces: [
        { kind: 'tank', count: 2 },
        { kind: 'lmg', count: 1 },
        { kind: 'rifle', count: 4 },
      ],
      announce: 'A heavy attack with Panzers.',
    },
    {
      type: 'wave',
      when: { at: 250 },
      side: 1,
      forces: [
        { kind: 'tank', count: 1 },
        { kind: 'assault', count: 4 },
        { kind: 'rifle', count: 3 },
      ],
      announce: 'The SS are throwing in everything they have.',
    },
    { type: 'announce', when: { at: 300 }, text: 'Sixty seconds. The relief column is on the road.' },
    {
      type: 'hint',
      when: { hqHpBelow: 0.5, side: 0 },
      text: 'They are at the HQ. Fall Back shelters everyone inside while its machine gun fights; Hold again once they thin out.',
    },
  ],
  // Side 1 has no HQ: everything it fields arrives in the scripted waves.
  ai: { sappers: 0, build: [], firstAttackAfter: 0 },
  bot: {
    sappers: 0,
    build: [
      { kind: 'at', count: 3, after: 0 },
      { kind: 'rifle', count: 7, after: 0 },
      { kind: 'lmg', count: 2, after: 30 },
      { kind: 'at', count: 5, after: 90 },
      { kind: 'rifle', count: 10, after: 150 },
      { kind: 'at', count: 7, after: 200 },
    ],
    firstAttackAfter: 9999,
  },
  expectedMinutes: [6, 6.2],
  music: 'arnhem',
};
