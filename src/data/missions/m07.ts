import type { MissionDef } from '../schema';

/**
 * Mission 7: Sword Beach, Normandy, 6 June 1944. The player lands with a weak beachhead HQ and a
 * thin income. A sea-wall strongpoint (wire, four tough pillboxes and a garrisoned trench) covers
 * the sand, two more lines lie inland, and a panzer counter-attack arrives late: 80 s after the sea
 * wall falls, when the second wave lands behind the player. Riflemen cannot hurt concrete: the PIAT
 * Team (rocket, strong against fortifications and tanks) is the answer to both the pillboxes and the
 * panzers. The Germans have no supports here; the mission is the geometry.
 */
export const M07: MissionDef = {
  id: 7,
  key: 'sword',
  title: 'Sword Beach',
  location: 'Sword Beach, Normandy',
  date: '6 June 1944',
  mapPos: { lon: -0.29, lat: 49.3 },
  briefing: [
    'H-Hour is 0725 and the Navy has put you ashore on Sword, a strip of sand between Ouistreham and Lion-sur-Mer. The tide is making, the obstacles are mined, and the beachhead consists of a headquarters in a shell hole and whatever the landing craft could be persuaded to leave behind. Supplies will trickle in until the beach is open. It was never advertised as a comfortable morning.',
    'The Germans have built the sea wall into a strongpoint: wire, a trench, and concrete pillboxes sited to rake the whole beach. Rifle bullets bounce off concrete with a cheerful ping and achieve nothing else. The answer is the PIAT, a spring-powered projector that throws a hollow-charge bomb a short way and with great conviction. It is poor against infantry, remarkable against a pillbox, and the only thing in the section that will frighten a Panzer.',
    'Clear the sea wall, push inland through the second and third lines, and put the German headquarters out of action. The 21st Panzer Division is known to be somewhere near Caen and will certainly be along later in the day. Once the sea wall is ours the second wave will land behind you with more PIAT teams. Keep them back for the Panzers, and keep riflemen in front of them.',
  ],
  objective: 'Clear the beach defences, beat the panzers and destroy the German HQ.',
  theatre: 'normandy',
  timeOfDay: 'dawn',
  mode: 'assault',
  length: 10500,
  newUnit: 'at',
  newSupport: null,
  units: [
    ['sapper', 'rifle', 'lmg', 'assault', 'mortar', 'sniper', 'medic', 'at'],
    ['sapper', 'rifle', 'lmg', 'assault', 'mortar', 'sniper', 'medic', 'at', 'tank'],
  ],
  supports: [['artillery', 'smoke'], []],
  start: [
    {
      faction: 'british',
      hasHq: true,
      supplies: 250,
      hqHpMul: 0.6,
      incomeMul: 0.7,
      sappers: 2,
      forces: [
        { kind: 'rifle', count: 4, trenchId: 1 },
        { kind: 'rifle', count: 2 },
        { kind: 'assault', count: 2 },
        { kind: 'at', count: 1 },
      ],
    },
    {
      faction: 'german',
      hasHq: true,
      supplies: 100,
      hqHpMul: 1,
      incomeMul: 0.6,
      sappers: 2,
      forces: [
        { kind: 'rifle', count: 6, trenchId: 2 },
        { kind: 'lmg', count: 2, trenchId: 2 },
        { kind: 'rifle', count: 4, trenchId: 3 },
        { kind: 'rifle', count: 3, trenchId: 4 },
        { kind: 'at', count: 1, trenchId: 4 },
        { kind: 'rifle', count: 2 },
      ],
    },
  ],
  trenches: [
    { id: 1, x: 1000, width: 120, slots: 4, owner: 0 },
    { id: 2, x: 2300, width: 190, slots: 8, owner: 1 },
    { id: 3, x: 5600, width: 170, slots: 7, owner: 1 },
    { id: 4, x: 8200, width: 160, slots: 6, owner: 1 },
  ],
  pillboxes: [
    { id: 1, x: 1800, side: 1, hpMul: 1.2 },
    { id: 2, x: 2050, side: 1, hpMul: 1.2 },
    { id: 3, x: 2550, side: 1, hpMul: 1.2 },
    { id: 4, x: 2800, side: 1, hpMul: 1.2 },
    { id: 5, x: 5900, side: 1, hpMul: 1 },
    { id: 6, x: 8450, side: 1, hpMul: 1 },
  ],
  wire: [
    { id: 1, x: 1650, width: 160, owner: 1 },
    { id: 2, x: 5350, width: 120, owner: 1 },
    { id: 3, x: 7950, width: 100, owner: 1 },
  ],
  timer: null,
  events: [
    {
      type: 'hint',
      when: { at: 3 },
      text: 'Weak HQ, thin income. Spend supplies on what the beach needs: Sappers first, then a PIAT Team or two.',
    },
    {
      type: 'hint',
      when: { at: 16 },
      text: 'Pillboxes shrug off rifle fire. Train PIAT Teams: their rockets wreck concrete and knock out tanks.',
    },
    {
      type: 'hint',
      when: { at: 70 },
      text: 'PIAT Teams are poor against infantry. Keep riflemen in front of them, and Mortar Teams behind.',
    },
    { type: 'announce', when: { trenchCapturedBy: 0, trenchId: 2 }, text: 'The sea wall is ours.' },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 2, delay: 8 },
      side: 0,
      forces: [
        { kind: 'at', count: 2, x: 1500 },
        { kind: 'rifle', count: 3, x: 1450 },
      ],
      announce: 'The second wave is ashore with more PIAT Teams.',
    },
    {
      type: 'hint',
      when: { trenchCapturedBy: 0, trenchId: 2, delay: 30 },
      text: 'Panzers are on the road. Hold the captured trench with riflemen in front and PIAT Teams close behind.',
    },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 2, delay: 80 },
      side: 1,
      forces: [
        { kind: 'tank', count: 2, behaviour: 'assault' },
        { kind: 'rifle', count: 3, behaviour: 'assault' },
      ],
      announce: 'Panzers! The counter-attack is coming in.',
    },
    {
      type: 'hint',
      when: { hqHpBelow: 0.5, side: 0 },
      text: 'The HQ is badly hurt. Fall Back lets its machine gun do the work while you rebuild.',
    },
  ],
  ai: {
    sappers: 2,
    build: [
      { kind: 'rifle', count: 4, after: 0 },
      { kind: 'lmg', count: 1, after: 40 },
      { kind: 'mortar', count: 1, after: 100 },
      { kind: 'rifle', count: 8, after: 200 },
      { kind: 'lmg', count: 2, after: 260 },
      { kind: 'at', count: 2, after: 320 },
      { kind: 'rifle', count: 10, after: 400 },
    ],
    firstAttackAfter: 420,
  },
  bot: {
    sappers: 4,
    build: [
      { kind: 'rifle', count: 5, after: 0 },
      { kind: 'at', count: 4, after: 5 },
      { kind: 'mortar', count: 1, after: 30 },
      { kind: 'assault', count: 2, after: 50 },
      { kind: 'at', count: 8, after: 60 },
      { kind: 'medic', count: 1, after: 100 },
      { kind: 'rifle', count: 8, after: 140 },
      { kind: 'mortar', count: 2, after: 200 },
    ],
    firstAttackAfter: 160,
  },
  expectedMinutes: [8, 11.5],
  /* Its own track comes with the next music stage; until then it plays the opening British track. */
  music: 'arras',
};
