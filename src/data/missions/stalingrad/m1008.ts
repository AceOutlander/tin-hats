import { STALINGRAD_MUSIC } from '../../musicCampaigns';
import type { MissionDef } from '../../schema';

/**
 * Stalingrad mission 8 (1008): the Tractor Factory, 14 October 1942 (docs/campaigns/STALINGRAD.md, mission 8).
 * A delay: the 37th Guards Rifle Division holds the Dzerzhinsky Tractor Factory against the 14th Panzer Division and
 * two infantry divisions from first light until dark. The yard (trench 1), the machine shops (trench 2), the foundry
 * (trench 3) and the assembly hall (trench 4) are held in turn, the T-34s straight off the line dug in among the
 * halls, while panzers and infantry come through the workers' settlement wave after wave.
 *
 * Built with today's schema (docs/campaigns/STALINGRAD_BUILD.md, mission 1008): the halls are trenches (no
 * buildings, floors or rubble yet), the prep phase's wire is laid at the start, "lose if six get past the cliffs"
 * is the HQ, the loans are scripted waves, StuG III Ausf. F, Panzer III J and L and Panzer IV Ausf. G are the `tank`
 * kind, the Pak 40 crew the `at` kind. The attackers have no HQ, so they call in no Stukas.
 */
export const M1008: MissionDef = {
  id: 1008,
  key: 'factories',
  title: 'The Tractor Factory',
  location: 'Dzerzhinsky Tractor Factory, Stalingrad',
  date: '14 October 1942',
  mapPos: { lon: 44.585, lat: 48.795 },
  briefing: [
    'Guards, in peacetime this works made tractors, and since before the war it has made tanks. Today it is a fortress, and we are its garrison. The bombers have been overhead since first light and there is a panzer division in the workers\' settlement, with two infantry divisions behind it.',
    'We cannot keep them out of the factory for ever. We can make them take it hall by hall, so that the division and the bank behind us hold. Every hall has walls a metre thick and rubble to hide in; every hall they take must cost them a day\'s strength. The last two tanks off the line are dug in among the halls.',
    'The sappers have wired the gaps and the yard. When a hall can no longer be held, fall back to the next one; the anti-tank rifles go where the tanks come. Hold until dark: every hour they spend here is an hour the rest of the bank holds.',
  ],
  objective: 'Hold the factory until dark. Do not let the Germans reach the river.',
  theatre: 'italy',
  timeOfDay: 'day',
  mode: 'survival',
  length: 14000,
  newUnit: null,
  newSupport: null,
  units: [
    ['sapper', 'rifle', 'lmg', 'assault', 'mortar', 'sniper', 'medic', 'at', 'tank', 'flame', 'conscript'],
    ['rifle', 'lmg', 'assault', 'mortar', 'sniper', 'at', 'flame', 'tank'],
  ],
  supports: [['artillery', 'smoke', 'katyusha'], []],
  start: [
    {
      faction: 'soviet',
      hasHq: true,
      supplies: 450,
      hqHpMul: 1,
      incomeMul: 1,
      sappers: 3,
      forces: [
        { kind: 'rifle', count: 8, trenchId: 1 },
        { kind: 'assault', count: 8, trenchId: 2 },
        { kind: 'at', count: 2, trenchId: 2 },
        { kind: 'lmg', count: 3, trenchId: 3 },
        { kind: 'sniper', count: 2, x: 6200 },
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
    // The machine shops.
    { id: 2, x: 6300, width: 210, slots: 8, owner: 0 },
    // The foundry.
    { id: 3, x: 5200, width: 210, slots: 8, owner: 0 },
    // The assembly hall.
    { id: 4, x: 3200, width: 260, slots: 10, owner: 0 },
  ],
  pillboxes: [],
  // The prep phase's wire: the yard gate and the gap in front of the machine shops.
  wire: [
    { id: 1, x: 8350, width: 140, owner: 0 },
    { id: 2, x: 6650, width: 120, owner: 0 },
  ],
  timer: { seconds: 1260, onExpire: 'win', label: 'Until dark' },
  events: [
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
        { kind: 'tank', count: 2 },
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
      text: 'When a hall cannot be held, Fall Back and let the next hall fight. A trench lost is not the factory lost.',
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
        { kind: 'tank', count: 3 },
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
        { kind: 'tank', count: 3 },
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
  expectedMinutes: [21, 21.2],
  music: STALINGRAD_MUSIC.missions[1008],
};
