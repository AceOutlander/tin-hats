import type { MissionDef } from '../schema';

/**
 * Mission 10: the Siegfried Line, Reichswald, February 1945. The longest map: four German belts
 * (wire, a pillbox, the trench, a second pillbox), nine pillboxes in all, and a King Tiger on guard
 * before the German HQ. The enemy fields every unit plus Barrage and Smoke, and sends reserves from
 * its HQ as each line falls. The player gets reinforcements at each capture and a free echelon every
 * 120 s from minute 8 (the walk from the HQ takes 3 minutes and the long slogs never ended without
 * them). Introduces the Typhoon Air Strike: harsh on columns and trenches, mild on armour, so the
 * PIAT Teams are the answer to the King Tiger.
 */
export const M10: MissionDef = {
  id: 10,
  key: 'reichswald',
  title: 'The Siegfried Line',
  location: 'Reichswald, Germany',
  date: 'February 1945',
  mapPos: { lon: 6.05, lat: 51.76 },
  briefing: [
    'Operation Veritable: First Canadian Army, with XXX Corps under command, is to drive south-east from Nijmegen through the Reichswald and into the Rhineland. The Germans have flooded the low ground and the thaw has done the rest, so the roads are rivers and the fields are porridge. The attack goes in behind the heaviest barrage the army has yet fired, which is as well, because the Siegfried Line lies directly across the way.',
    'It is not a line so much as a belt: successive trench systems, each fronted with wire and covered by concrete pillboxes, begun before the war by people who expected one day to be glad of them. The garrison has everything the German Army can still spare, mortars, snipers, Panzers and guns, and in front of their headquarters intelligence reports a King Tiger. Rifles will not trouble it. PIATs will, and so will the Typhoons.',
    'The Typhoon Air Strike is now available: a flight of rocket-armed fighters sweeps a long strip of ground when you call it in. The pilots describe the weather as flyable, a judgement they have been known to revise. Use them on tanks, on trenches and on columns on the road. Break each belt in turn with artillery, PIAT teams and Churchills, rest in the captured trenches while the next echelon comes up, and take the German headquarters. It will take most of the afternoon.',
  ],
  objective: 'Break the Siegfried Line and destroy the German HQ.',
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
      hqHpMul: 1.1,
      incomeMul: 0.75,
      sappers: 3,
      forces: [
        { kind: 'rifle', count: 5, trenchId: 2 },
        { kind: 'lmg', count: 2, trenchId: 2 },
        // The last two belts keep their own garrisons (they hold their trench until it falls).
        { kind: 'rifle', count: 4, trenchId: 3 },
        { kind: 'at', count: 1, trenchId: 3 },
        { kind: 'rifle', count: 3, trenchId: 4, behaviour: 'garrison' },
        { kind: 'rifle', count: 2, trenchId: 5, behaviour: 'garrison' },
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
    { id: 5, x: 9000, side: 1, hpMul: 1.3 },
    { id: 6, x: 9550, side: 1, hpMul: 1.3 },
    { id: 7, x: 9780, side: 1, hpMul: 1.3 },
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
      text: 'The Typhoon Air Strike rakes a long strip of ground with rockets. Tap its button, then the target: tanks, trenches and columns.',
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
        { kind: 'assault', count: 3, x: 3900 },
        { kind: 'rifle', count: 3, x: 3800 },
      ],
      announce: 'Reinforcements are up from the Reichswald.',
    },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 2, delay: 20 },
      side: 1,
      forces: [
        { kind: 'rifle', count: 5, behaviour: 'assault' },
        { kind: 'lmg', count: 1, behaviour: 'assault' },
        { kind: 'at', count: 1, behaviour: 'assault' },
      ],
      announce: 'German reserves are moving up.',
    },
    { type: 'announce', when: { trenchCapturedBy: 0, trenchId: 3 }, text: 'Second belt broken.' },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 3, delay: 10 },
      side: 0,
      forces: [
        { kind: 'tank', count: 2, x: 6500 },
        { kind: 'at', count: 3, x: 6400 },
        { kind: 'medic', count: 1, x: 6300 },
      ],
      announce: 'A troop of Churchills has come up.',
    },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 3, delay: 20 },
      side: 1,
      forces: [
        { kind: 'tank', count: 1, behaviour: 'assault' },
        { kind: 'rifle', count: 4, behaviour: 'assault' },
      ],
      announce: 'German reserves are counter-attacking.',
    },
    { type: 'announce', when: { trenchCapturedBy: 0, trenchId: 4 }, text: 'Third belt broken. The last line lies ahead.' },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 4, delay: 10 },
      side: 0,
      forces: [
        { kind: 'tank', count: 2, x: 8900 },
        { kind: 'at', count: 4, x: 8800 },
      ],
      announce: 'The last PIAT teams are up for the King Tiger.',
    },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 4, delay: 20 },
      side: 1,
      forces: [
        { kind: 'tank', count: 1, behaviour: 'assault' },
        { kind: 'at', count: 1, behaviour: 'assault' },
        { kind: 'rifle', count: 3, behaviour: 'assault' },
      ],
      announce: 'The last German reserves are thrown in.',
    },
    {
      type: 'announce',
      when: { trenchCapturedBy: 0, trenchId: 5 },
      text: 'The last line is broken. The King Tiger waits ahead.',
    },
    {
      type: 'hint',
      when: { trenchCapturedBy: 0, trenchId: 5, delay: 3 },
      text: 'The King Tiger shrugs off bullets. Bring up every PIAT Team at once, and call in the Typhoons to help.',
    },
    {
      type: 'wave',
      when: { every: 120, from: 480 },
      side: 0,
      forces: [
        { kind: 'tank', count: 1 },
        { kind: 'at', count: 2 },
        { kind: 'rifle', count: 2 },
      ],
      announce: 'Another echelon has come up from Nijmegen.',
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
      { kind: 'mortar', count: 2, after: 100 },
      { kind: 'at', count: 2, after: 150 },
      { kind: 'sniper', count: 1, after: 200 },
      { kind: 'tank', count: 1, after: 220 },
      { kind: 'rifle', count: 12, after: 300 },
      { kind: 'tank', count: 2, after: 380 },
      { kind: 'at', count: 3, after: 400 },
      { kind: 'tank', count: 3, after: 560 },
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
      { kind: 'at', count: 8, after: 300 },
      { kind: 'tank', count: 3, after: 400 },
    ],
    firstAttackAfter: 160,
  },
  expectedMinutes: [12, 15],
};
