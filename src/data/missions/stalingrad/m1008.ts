import { STALINGRAD_MUSIC } from '../../musicCampaigns';
import type { MissionDef } from '../../schema';

/**
 * Stalingrad mission 8 (1008): the Tractor Factory, 14 October 1942 (docs/campaigns/STALINGRAD.md, mission 8). A delay:
 * the 37th Guards Rifle Division holds the Dzerzhinsky Tractor Factory against the 14th Panzer Division and two
 * infantry divisions from first light until dark. The yard (trench 1), the machine shops (B3), the foundry (B2) and the
 * assembly hall (B1) are held in turn, the T-34s straight off the line dug in among the halls, while panzers and
 * infantry come through the workers' settlement wave after wave.
 *
 * Built on the mission director (docs/campaigns/STALINGRAD_BUILD.md, mission 1008): the brief's delay, in three 420 s
 * phases under the one clock to dark (the bombers, hall by hall, until dark), lost if six Germans get past the cliffs
 * (x 2,000) at once. The halls are two-floor buildings (FOUNDATIONS.md 4.3), goods wagons in the yard are cover props
 * (the snipers' post), the HQ a log dugout in the bank; the machine shops are the capture point P2 (held through B3), a
 * forward spawn and the rally point Fall Back sends the men in the yard to; the ground is rubble throughout; a 60 s
 * prep phase of wire, sandbags, AP mines, tank traps and road blocks comes first (FOUNDATIONS.md 4.6 and 4.8: the bot
 * wires, mines and traps the yard and sandbags the machine shops); the barrage, the Stukas (scripted raids: the attackers have no HQ),
 * the heavy bomb that brings down a floor of the machine shops and the Nebelwerfer are scripted; the loans are
 * scripted waves. The mode stays `survival` (no enemy HQ, a winning clock) and the medals score it as a delay, with a
 * kill bonus. StuG III Ausf. F, Panzer III J and L and Panzer IV Ausf. G are the `tank` kind (the era's Panzer III
 * Ausf. L; `stug3f` and `panzer4g` by look), the Pak 40 crew the `at` kind.
 */
export const M1008: MissionDef = {
  id: 1008,
  key: 'factories',
  title: 'The Tractor Factory',
  location: 'Dzerzhinsky Tractor Factory, Stalingrad',
  date: '14 October 1942',
  dateIso: '1942-10-14',
  climate: 'city',
  mapPos: { lon: 44.585, lat: 48.795 },
  briefing: [
    'Guards, in peacetime this works made tractors, and since before the war it has made tanks. Today it is a fortress, and we are its garrison. The bombers have been overhead since first light and there is a panzer division in the workers\' settlement, with two infantry divisions behind it.',
    'We cannot keep them out of the factory for ever. We can make them take it hall by hall, so that the division and the bank behind us hold. Every hall has walls a metre thick and rubble to hide in; every hall they take must cost them a day\'s strength. The last two tanks off the line are dug in among the halls.',
    'The sappers have wired the gaps and the yard. When a hall can no longer be held, fall back to the next one; the anti-tank rifles go where the tanks come. Hold until dark: every hour they spend here is an hour the rest of the bank holds.',
  ],
  objective: 'Hold the factory until dark. Do not let the Germans reach the river.',
  intel: {
    enemy: [
      '14th Panzer and two infantry divisions, from the settlement',
      'About 17 tanks: Panzer III, Panzer IV Ausf. G, StuG III',
      'About 110 riflemen and MP40 troopers, 9 flamethrowers',
      'Pioneers, a Pak 40, mortars; bombers overhead',
    ],
    friendly: [
      '37th Guards: 8 riflemen, 8 PPSh troopers, 3 DPs, 2 snipers',
      '2 T-34s dug in among the halls, 2 PTRD teams, 2 mortars',
      'Flamethrowers and more PTRD teams come up later',
      'Artillery, smoke and Katyusha from the far bank',
    ],
  },
  theatre: 'italy',
  timeOfDay: 'day',
  mode: 'survival',
  length: 14000,
  newUnit: null,
  newSupport: null,
  units: [
    ['sapper', 'rifle', 'lmg', 'assault', 'mortar', 'sniper', 'medic', 'at', 'tank', 'flame', 'aa', 'commander', 'conscript'],
    ['rifle', 'lmg', 'assault', 'mortar', 'sniper', 'at', 'flame', 'tank'],
  ],
  supports: [['artillery', 'smoke', 'katyusha'], []],
  start: [
    {
      faction: 'soviet',
      hasHq: true,
      supplies: 450,
      hqHpMul: 1,
      hqLook: 'logDugout',
      incomeMul: 1,
      sappers: 3,
      forces: [
        { kind: 'rifle', count: 8, trenchId: 1 },
        // The machine shops (B3) and the foundry (B2).
        { kind: 'assault', count: 8, buildingId: 3 },
        { kind: 'at', count: 2, buildingId: 3 },
        { kind: 'lmg', count: 3, buildingId: 2 },
        // The snipers among the goods wagons on the sidings.
        { kind: 'sniper', count: 2, buildingId: 4, behaviour: 'garrison' },
        // The last two T-34s off the factory line, dug in among the halls.
        { kind: 'tank', count: 2, x: 6600, behaviour: 'guard' },
        // Loan from the start: two mortar teams.
        { kind: 'mortar', count: 2, x: 5000 },
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
  trenches: [
    // The factory yard and its sidings.
    { id: 1, x: 8000, width: 170, slots: 7, owner: 0 },
  ],
  buildings: [
    // The assembly hall, the foundry and the machine shops (whose upper floor the heavy bomb brings in: at 900 hp one
    // bomb on its own walls, 462, takes it below the 450 the upper floor needs and leaves the ground floor standing).
    { id: 1, x: 3200, width: 260, floors: 2, slotsPerFloor: 10, hpMul: 2, owner: 0, look: 'factoryHall', spawn: true },
    { id: 2, x: 5200, width: 210, floors: 2, slotsPerFloor: 8, hpMul: 1.6, owner: 0, look: 'factoryHall' },
    { id: 3, x: 6300, width: 210, floors: 2, slotsPerFloor: 8, hpMul: 0.6, owner: 0, look: 'factoryHall' },
  ],
  // Goods wagons on the sidings behind the yard trench.
  props: [{ id: 4, x: 7450, width: 150, slots: 4, look: 'wagons', owner: 0 }],
  pillboxes: [],
  wire: [],
  // The brief's sectors (FOUNDATIONS.md 4.1): rubble from the cliffs to the workers' settlement.
  sectors: [
    { from: 0, to: 2000, ground: 'rubble', label: 'The Volga cliffs' },
    { from: 2000, to: 4500, ground: 'rubble', label: 'Assembly hall' },
    { from: 4500, to: 7000, ground: 'rubble', label: 'Machine shops' },
    { from: 7000, to: 9500, ground: 'rubble', label: 'Factory yard' },
    { from: 9500, to: 14000, ground: 'rubble', label: "Workers' settlement" },
  ],
  // The machine shops (FOUNDATIONS.md 4.5), held through the building B3. A forward
  // spawn point, and the rally point Fall Back sends the men in the yard to.
  capturePoints: [{ id: 'P2', x: 6300, width: 260, label: 'Machine shops', owner: 0, captureTime: 0, spawn: true, contestRadius: 500, structure: { building: 3 } }],
  // A minute to wire, mine and trap the yard and sandbag the machine shops; the line is past half the field, so the zone
  // is given.
  prep: {
    seconds: 60,
    zone: { from: 1000, to: 8600 },
    buildables: ['wire', 'sandbags', 'minefield', 'tankTrap', 'roadBlock'],
    bot: [
      { kind: 'wire', x: 8180 },
      { kind: 'tankTrap', x: 8535 },
      { kind: 'minefield', x: 8350 },
      { kind: 'sandbags', x: 6300 },
      { kind: 'wire', x: 6650 },
    ],
  },
  timer: { seconds: 1260, onExpire: 'win', label: 'Until dark' },
  // The mission director (FOUNDATIONS.md 3): three phases of the brief (STALINGRAD.md, mission 8) on the old clock.
  phases: [
    {
      id: 'bombers',
      title: 'The bombers',
      objectives: [{ id: 'bombers', type: 'survive', seconds: 420, text: 'Hold the factory' }],
      lose: [{ type: 'enemyReached', x: 2000, count: 6 }],
      sideObjectives: [
        { id: 'shops', text: 'The machine shops by night', objective: { id: 'shopsHeld', type: 'capture', point: { point: 'P2' } }, atEnd: true, bonus: 0.2 },
        { id: 'tanks25', text: 'Twenty-five tanks', objective: { id: 'tanks25Dead', type: 'kill', side: 1, kinds: ['tank'], count: 25 }, bonus: 0.1 },
      ],
      next: 'halls',
    },
    {
      id: 'halls',
      title: 'Hall by hall',
      objectives: [{ id: 'halls', type: 'survive', seconds: 420, text: 'Hold the halls' }],
      lose: [{ type: 'enemyReached', x: 2000, count: 6 }],
      next: 'dark',
    },
    {
      id: 'dark',
      title: 'Until dark',
      objectives: [{ id: 'dark', type: 'survive', seconds: 420, text: 'Until dark' }],
      lose: [{ type: 'enemyReached', x: 2000, count: 6 }],
      next: null,
    },
  ],
  events: [
    // The director's events: the opening barrage and Stukas on the yard, the Stuka on the foundry, the heavy bomb on the
    // machine shops, the Nebelwerfer at dusk.
    { id: 'openingBarrage', type: 'barrage', when: { phase: 'bombers' }, side: 1, x: 8000, spread: 300, rounds: 8, duration: 5, weapon: 'artilleryShell', warning: 'Artillery!' },
    { id: 'stukaYard', type: 'airRaid', when: { phase: 'bombers', delay: 2 }, side: 1, support: 'airStrike', x: 8000 },
    { id: 'stukaFoundry', type: 'airRaid', when: { phase: 'bombers', delay: 150 }, side: 1, support: 'airStrike', x: 5200 },
    { id: 'heavyBomb', type: 'barrage', when: { phase: 'halls', delay: 240 }, side: 1, x: 6300, spread: 60, rounds: 1, duration: 0, weapon: 'heavyBomb' },
    { id: 'nebelwerfer', type: 'barrage', when: { phase: 'dark', delay: 100 }, side: 1, x: 5200, spread: 300, rounds: 10, duration: 3, weapon: 'nebelwerfer' },
    {
      type: 'hint',
      when: { at: 3 },
      text: 'A delay: hold the factory until dark. PTRD Teams and the dug-in T-34s make the yard a tank trap.',
    },
    { type: 'announce', when: { at: 50 }, text: 'The bombers! The whole sky is full of them.' },
    // Phase 1: the bombers.
    {
      type: 'wave',
      when: { at: 60 },
      side: 1,
      forces: [
        { kind: 'tank', count: 3 },
        { kind: 'rifle', count: 8 },
        { kind: 'lmg', count: 2 },
        { kind: 'assault', count: 2 },
      ],
      announce: 'Panzers in the workers\' settlement!',
    },
    {
      type: 'hint',
      when: { at: 90 },
      text: 'Fire the Katyusha Salvo on each wave while it is still bunched up in the settlement.',
    },
    {
      type: 'wave',
      when: { at: 230 },
      side: 1,
      forces: [
        { kind: 'tank', count: 2, look: 'panzer4g' },
        { kind: 'at', count: 1 },
        { kind: 'rifle', count: 8 },
        { kind: 'mortar', count: 2 },
      ],
      announce: 'More tanks behind the bombing.',
    },
    {
      type: 'wave',
      when: { at: 330 },
      side: 1,
      forces: [
        { kind: 'flame', count: 3 },
        { kind: 'assault', count: 4 },
      ],
      announce: 'Pioneers with flamethrowers are working along the sidings.',
    },
    // Phase 2: hall by hall.
    { type: 'announce', when: { at: 420 }, text: 'They are in the yard. Make them pay for every hall.' },
    {
      type: 'hint',
      when: { at: 422 },
      text: 'When a hall cannot be held, Fall Back and let the next hall fight. A hall lost is not the factory lost.',
    },
    {
      type: 'wave',
      when: { at: 425 },
      side: 0,
      forces: [
        { kind: 'flame', count: 2, x: 5000 },
        { kind: 'at', count: 3, x: 4900 },
      ],
      announce: 'Two flamethrowers and three PTRD teams are up from the cliffs.',
    },
    { type: 'wave', when: { every: 120, from: 545, until: 840 }, side: 0, forces: [{ kind: 'at', count: 1, x: 4900 }] },
    {
      type: 'wave',
      when: { every: 140, from: 480, until: 760 },
      side: 1,
      forces: [
        { kind: 'tank', count: 3, look: 'stug3f' },
        { kind: 'rifle', count: 8 },
        { kind: 'assault', count: 4 },
        { kind: 'flame', count: 2 },
      ],
      announce: 'Another combined attack: tanks, infantry and pioneers.',
    },
    { type: 'announce', when: { at: 660 }, text: 'A heavy bomb on the machine shops!' },
    // Phase 3: until dark.
    { type: 'announce', when: { at: 840 }, text: 'Dusk is coming. Hold until dark.' },
    {
      type: 'wave',
      when: { every: 40, from: 850, until: 1200 },
      side: 1,
      forces: [
        { kind: 'rifle', count: 4 },
        { kind: 'assault', count: 1 },
      ],
    },
    { type: 'announce', when: { at: 940 }, text: 'Rocket mortars on the halls!' },
    {
      type: 'wave',
      when: { at: 1140 },
      side: 1,
      forces: [
        { kind: 'tank', count: 3, look: 'panzer4g' },
        { kind: 'rifle', count: 6 },
      ],
      announce: 'The last tank push before dark!',
    },
    { type: 'announce', when: { at: 1230 }, text: 'Night is falling. The 138th Division is crossing to relieve you.' },
    {
      type: 'hint',
      when: { hqHpBelow: 0.5, side: 0 },
      text: 'They are at the cliffs. Fall Back shelters everyone while the HQ machine gun fights.',
    },
  ],
  // Side 1 has no HQ: everything it fields arrives in the scripted waves.
  ai: { sappers: 0, build: [], firstAttackAfter: 0 },
  bot: {
    sappers: 4,
    // Counts include the garrison placed at the start.
    build: [
      { kind: 'at', count: 4, after: 0 },
      { kind: 'rifle', count: 10, after: 20 },
      { kind: 'at', count: 6, after: 200 },
      { kind: 'rifle', count: 14, after: 300 },
      { kind: 'medic', count: 1, after: 400 },
      { kind: 'at', count: 8, after: 500 },
    ],
    firstAttackAfter: 9999,
  },
  // The 21 min clock plus up to a minute of prep.
  expectedMinutes: [21, 22.2],
  music: STALINGRAD_MUSIC.missions[1008],
};
