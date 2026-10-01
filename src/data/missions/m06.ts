import type { MissionDef } from '../schema';

/**
 * Mission 6: Monte Cassino, Italy, May 1944. Three fortified lines in succession, each with a
 * belt of wire, pillboxes and a bigger garrison than the last (the heaviest defences so far),
 * and an empty trench (a forward post, owner -1) 500 wu short of each line to stage from.
 * The grind that needs staying power and a way across the open ground: introduces the Medic and
 * the Smoke Screen. The Germans have no artillery here; their strength is the three lines.
 */
export const M06: MissionDef = {
  id: 6,
  key: 'cassino',
  title: 'Monte Cassino',
  location: 'Cassino, Italy',
  date: 'May 1944',
  mapPos: { lon: 13.81, lat: 41.49 },
  briefing: [
    'Three times since January the Allies have attacked the Gustav Line at Cassino, and three times they have been held. The fourth attempt is under way, with every corps in Italy attacking together. The monastery on the hill is the famous part of the problem; the rest of it is a valley in which every yard is covered by guns on the heights.',
    'Your sector offers three fortified lines in succession, each with wire, a pillbox and gunners who have had four months to settle in. Every line will cost you men, so the Medics have come forward. A Medic cannot fight, but a wounded man he patches up is a man you need not train again. The Germans keep medical orderlies of their own, which is only civilised.',
    'The other new issue is smoke. A Smoke Screen laid between your men and the line ahead blinds the machine guns for a few seconds, and a few seconds is all it takes to cross open ground if nobody stops to look about. Break all three lines, in order, and then destroy the German headquarters.',
  ],
  objective: 'Break three fortified lines and destroy the German HQ.',
  theatre: 'italy',
  timeOfDay: 'day',
  mode: 'assault',
  length: 10000,
  newUnit: 'medic',
  newSupport: 'smoke',
  units: [
    ['sapper', 'rifle', 'lmg', 'assault', 'mortar', 'sniper', 'medic'],
    ['sapper', 'rifle', 'lmg', 'assault', 'mortar', 'sniper', 'medic'],
  ],
  supports: [['artillery', 'smoke'], []],
  start: [
    {
      faction: 'british',
      hasHq: true,
      supplies: 400,
      hqHpMul: 1,
      incomeMul: 1,
      sappers: 3,
      forces: [
        { kind: 'rifle', count: 5, trenchId: 1 },
        { kind: 'lmg', count: 1, trenchId: 1 },
        { kind: 'medic', count: 1 },
        { kind: 'mortar', count: 1 },
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
        { kind: 'rifle', count: 5, trenchId: 3 },
        { kind: 'lmg', count: 1, trenchId: 3 },
        { kind: 'rifle', count: 5, trenchId: 5 },
        { kind: 'lmg', count: 2, trenchId: 5 },
        { kind: 'rifle', count: 5, trenchId: 7, behaviour: 'garrison' },
        { kind: 'lmg', count: 2, trenchId: 7, behaviour: 'garrison' },
        { kind: 'mortar', count: 1 },
        { kind: 'sniper', count: 1 },
        { kind: 'medic', count: 1 },
      ],
    },
  ],
  trenches: [
    { id: 1, x: 1500, width: 160, slots: 6, owner: 0 },
    { id: 2, x: 3550, width: 160, slots: 6, owner: -1 },
    { id: 3, x: 4050, width: 180, slots: 7, owner: 1 },
    { id: 4, x: 5600, width: 160, slots: 6, owner: -1 },
    { id: 5, x: 6100, width: 180, slots: 7, owner: 1 },
    { id: 6, x: 7650, width: 160, slots: 6, owner: -1 },
    { id: 7, x: 8150, width: 180, slots: 7, owner: 1 },
  ],
  pillboxes: [
    { id: 1, x: 3940, side: 1, hpMul: 0.85 },
    { id: 2, x: 5990, side: 1, hpMul: 1 },
    { id: 3, x: 8040, side: 1, hpMul: 1 },
    { id: 4, x: 8330, side: 1, hpMul: 1 },
  ],
  wire: [
    { id: 1, x: 3780, width: 100, owner: 1 },
    { id: 2, x: 5830, width: 100, owner: 1 },
    { id: 3, x: 7880, width: 100, owner: 1 },
  ],
  timer: null,
  events: [
    {
      type: 'hint',
      when: { at: 3 },
      text: 'New: Medic. He heals every wounded infantryman near him but carries no weapon. Keep one with the attack, behind the line.',
    },
    {
      type: 'hint',
      when: { at: 28 },
      text: 'New: Smoke Screen. It blocks direct fire for a few seconds. Tap it, then tap the ground between your men and the enemy line.',
    },
    {
      type: 'hint',
      when: { at: 55 },
      text: 'An empty trench lies short of every German line. Take it, Hold there, and let the Medics and mortars work from behind it.',
    },
    {
      type: 'hint',
      when: { at: 85 },
      text: 'Three lines stand between you and the HQ. Take them one at a time: Hold at each, heal, reinforce, then press on.',
    },
    {
      type: 'hint',
      when: { trenchCapturedBy: 0, trenchId: 2, delay: 1 },
      text: 'Forward post taken. Hold here, shell the line ahead, then lay Smoke and Advance.',
    },
    {
      type: 'hint',
      when: { trenchCapturedBy: 0, trenchId: 3, delay: 1 },
      text: 'First line taken. Let the Medics work and bring up fresh men before you go on.',
    },
    {
      type: 'hint',
      when: { trenchCapturedBy: 0, trenchId: 5, delay: 1 },
      text: 'Second line broken. One more, and then the HQ. Smoke first, then Advance.',
    },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 5, delay: 20 },
      side: 1,
      forces: [
        { kind: 'rifle', count: 3 },
        { kind: 'assault', count: 2 },
      ],
      announce: 'German assault troops are counter-attacking from the last line.',
    },
    {
      type: 'announce',
      when: { trenchCapturedBy: 0, trenchId: 7 },
      text: 'The last line has fallen. The way to the German headquarters is open.',
    },
    {
      type: 'hint',
      when: { hqHpBelow: 0.5, side: 0 },
      text: 'Your HQ is under fire. Fall Back lets its machine gun do the work while you rebuild.',
    },
  ],
  ai: {
    sappers: 2,
    build: [
      { kind: 'rifle', count: 6, after: 0 },
      { kind: 'lmg', count: 3, after: 60 },
      { kind: 'mortar', count: 2, after: 120 },
      { kind: 'medic', count: 1, after: 150 },
      { kind: 'sniper', count: 2, after: 200 },
      { kind: 'rifle', count: 9, after: 260 },
    ],
    firstAttackAfter: 420,
  },
  bot: {
    sappers: 4,
    build: [
      { kind: 'rifle', count: 6, after: 0 },
      { kind: 'medic', count: 1, after: 15 },
      { kind: 'mortar', count: 2, after: 25 },
      { kind: 'assault', count: 4, after: 40 },
      { kind: 'lmg', count: 2, after: 60 },
      { kind: 'medic', count: 2, after: 90 },
      { kind: 'rifle', count: 10, after: 100 },
      { kind: 'assault', count: 6, after: 130 },
    ],
    firstAttackAfter: 170,
  },
  expectedMinutes: [8, 11],
};
