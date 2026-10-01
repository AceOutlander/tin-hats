import type { MissionDef } from '../schema';

/**
 * Mission 10: the Siegfried Line, Reichswald, February 1945. The longest map: four German trench
 * lines with wire in front and pillboxes in pairs, and a King Tiger on guard before the German HQ.
 * The enemy fields every unit and both of its supports. Introduces the Typhoon Air Strike, the
 * answer to the King Tiger and to tanks in general.
 */
export const M10: MissionDef = {
  id: 10,
  key: 'reichswald',
  title: 'The Siegfried Line',
  location: 'Reichswald, Germany',
  date: 'February 1945',
  mapPos: { lon: 6.05, lat: 51.76 },
  briefing: [
    'Operation Veritable: the First Canadian Army is to drive south-east from Nijmegen through the Reichswald and break into the Rhineland. The Germans have flooded the low ground and the thaw has done the rest, so the roads are rivers and the fields are porridge. The attack goes in behind the heaviest barrage of the war so far, which is as well, because the Siegfried Line lies directly across the way.',
    'It is not a line so much as a belt: four successive trench systems, each fronted with wire and covered by pairs of concrete pillboxes, built over six years by people who expected to be using them. The garrison has everything the German Army can still spare, mortars, snipers, Panzers and guns, and behind the last trench, guarding the headquarters, there is a King Tiger. A PIAT will tickle it. The Typhoons will not.',
    'The Typhoon Air Strike is now available. A flight of rocket-armed fighters will sweep a long strip of ground when you call them in; save them for tanks and for the King Tiger. Break each belt in turn with artillery, PIATs and the Churchills, rest your men in the captured trenches, and take the German headquarters. It will take most of the afternoon.',
  ],
  objective: 'Break the Siegfried Line, destroy the King Tiger and the German HQ.',
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
        { kind: 'rifle', count: 5, trenchId: 2 },
        { kind: 'lmg', count: 2, trenchId: 2 },
        { kind: 'rifle', count: 4, trenchId: 3 },
        { kind: 'at', count: 1, trenchId: 3 },
        { kind: 'rifle', count: 3, trenchId: 4 },
        { kind: 'rifle', count: 2, trenchId: 5 },
        { kind: 'heavyTank', count: 1, x: 12800, behaviour: 'guard' },
      ],
    },
  ],
  trenches: [
    { id: 1, x: 1700, width: 160, slots: 6, owner: 0 },
    { id: 2, x: 4400, width: 190, slots: 8, owner: 1 },
    { id: 3, x: 6900, width: 190, slots: 8, owner: 1 },
    { id: 4, x: 9300, width: 190, slots: 8, owner: 1 },
    { id: 5, x: 11600, width: 190, slots: 8, owner: 1 },
  ],
  pillboxes: [
    { id: 1, x: 4150, side: 1, hpMul: 1.2 },
    { id: 2, x: 4650, side: 1, hpMul: 1.2 },
    { id: 3, x: 6650, side: 1, hpMul: 1.2 },
    { id: 4, x: 7150, side: 1, hpMul: 1.2 },
    { id: 5, x: 9050, side: 1, hpMul: 1.3 },
    { id: 6, x: 9300, side: 1, hpMul: 1.3 },
    { id: 7, x: 9550, side: 1, hpMul: 1.3 },
    { id: 8, x: 11350, side: 1, hpMul: 1.4 },
    { id: 9, x: 11850, side: 1, hpMul: 1.4 },
  ],
  wire: [
    { id: 1, x: 3950, width: 140, owner: 1 },
    { id: 2, x: 6450, width: 140, owner: 1 },
    { id: 3, x: 8800, width: 140, owner: 1 },
    { id: 4, x: 11100, width: 140, owner: 1 },
  ],
  timer: null,
  events: [
    {
      type: 'hint',
      when: { at: 3 },
      text: 'The Typhoon Air Strike rakes a long strip of ground with rockets. Tap its button, then the target. Save it for tanks.',
    },
    {
      type: 'hint',
      when: { at: 40 },
      text: 'Four belts of trench, wire and pillboxes. Break one at a time: artillery on the trench, PIAT Teams on the pillboxes.',
    },
    { type: 'announce', when: { trenchCapturedBy: 0, trenchId: 2 }, text: 'The first belt of the Siegfried Line is broken.' },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 2, delay: 10 },
      side: 0,
      forces: [
        { kind: 'at', count: 2, x: 4000 },
        { kind: 'rifle', count: 3, x: 3900 },
      ],
      announce: 'Reinforcements are up from the Reichswald.',
    },
    { type: 'announce', when: { trenchCapturedBy: 0, trenchId: 3 }, text: 'Second belt broken.' },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 3, delay: 10 },
      side: 0,
      forces: [
        { kind: 'tank', count: 1, x: 6500 },
        { kind: 'at', count: 2, x: 6400 },
        { kind: 'medic', count: 1, x: 6300 },
      ],
      announce: 'A troop of Churchills has come up.',
    },
    { type: 'announce', when: { trenchCapturedBy: 0, trenchId: 4 }, text: 'Third belt broken. The last line lies ahead.' },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 4, delay: 10 },
      side: 0,
      forces: [
        { kind: 'tank', count: 1, x: 8900 },
        { kind: 'at', count: 3, x: 8800 },
      ],
      announce: 'The last PIAT teams are up for the King Tiger.',
    },
    {
      type: 'announce',
      when: { trenchCapturedBy: 0, trenchId: 5 },
      text: 'The last line is broken. The King Tiger waits ahead.',
    },
    {
      type: 'hint',
      when: { trenchCapturedBy: 0, trenchId: 5, delay: 3 },
      text: 'The King Tiger shrugs off most weapons. Call in the Typhoons and bring up every PIAT Team at once.',
    },
    {
      type: 'hint',
      when: { hqHpBelow: 0.5, side: 0 },
      text: 'The HQ is under fire. Fall Back lets its machine gun do the work while you rebuild.',
    },
  ],
  ai: {
    sappers: 4,
    build: [
      { kind: 'rifle', count: 6, after: 0 },
      { kind: 'lmg', count: 2, after: 40 },
      { kind: 'mortar', count: 1, after: 100 },
      { kind: 'at', count: 2, after: 150 },
      { kind: 'sniper', count: 1, after: 200 },
      { kind: 'tank', count: 1, after: 240 },
      { kind: 'rifle', count: 12, after: 300 },
      { kind: 'tank', count: 2, after: 420 },
    ],
    firstAttackAfter: 480,
  },
  bot: {
    sappers: 5,
    build: [
      { kind: 'rifle', count: 5, after: 0 },
      { kind: 'mortar', count: 2, after: 20 },
      { kind: 'assault', count: 5, after: 40 },
      { kind: 'at', count: 3, after: 60 },
      { kind: 'medic', count: 2, after: 80 },
      { kind: 'tank', count: 2, after: 120 },
      { kind: 'rifle', count: 9, after: 150 },
      { kind: 'at', count: 5, after: 300 },
      { kind: 'tank', count: 3, after: 400 },
    ],
    firstAttackAfter: 200,
  },
  expectedMinutes: [12, 15],
};
