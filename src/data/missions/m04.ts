import type { MissionDef } from '../schema';

/**
 * Mission 4: El Alamein, Egypt, October 1942. Two trench lines behind wire, each backed by a
 * pillbox: the first time rifles and grenades alone are the wrong tools. An empty trench lies
 * short of the first belt of wire (a forward post, owner -1): whoever takes it moves the hold
 * line up to it, which puts the Mortar Teams (reach 750 wu) within range of the German trench.
 * Introduces the Mortar Team and the Artillery Barrage.
 */
export const M04: MissionDef = {
  id: 4,
  key: 'alamein',
  title: 'El Alamein',
  location: 'El Alamein, Egypt',
  date: 'October 1942',
  mapPos: { lon: 28.95, lat: 30.83 },
  briefing: [
    'Eighth Army has a new commander, a great many new guns and a fixed date. The Axis line at El Alamein runs from the sea to the Qattara Depression and cannot be turned, so it will be broken instead. Before it lie belts of wire and two lines of trenches, with machine-gun pillboxes covering the gaps.',
    'Rifles alone will not do it. Wire holds a man still in the open while the pillbox works on him, and a rifle bullet makes little impression on concrete. The battalions have been issued Mortar Teams, who drop bombs on trenches and bunkers from well behind the front rank, and the gunners will fire an Artillery Barrage on request once a minute. Ask for it early; it is wasted on an empty trench.',
    'The sequence is simple, if not easy. Seize the abandoned trench short of the wire, so that the mortars can reach the German line from it, and shell the garrison. Then send the Assault Troopers in behind a barrage with the riflemen close after them, and repeat the exercise at the second line. When both are ours the German headquarters can be dealt with. Daylight will be unkind to anyone still in the open.',
  ],
  objective: 'Break both trench lines and destroy the German HQ.',
  theatre: 'desert',
  timeOfDay: 'dawn',
  mode: 'assault',
  length: 8500,
  newUnit: 'mortar',
  newSupport: 'artillery',
  units: [
    ['sapper', 'rifle', 'lmg', 'assault', 'mortar'],
    ['sapper', 'rifle', 'lmg', 'mortar'],
  ],
  supports: [['artillery'], []],
  start: [
    {
      faction: 'british',
      hasHq: true,
      supplies: 300,
      hqHpMul: 1,
      incomeMul: 1,
      sappers: 3,
      forces: [
        { kind: 'rifle', count: 4, trenchId: 1 },
        { kind: 'lmg', count: 1, trenchId: 1 },
        { kind: 'mortar', count: 1 },
      ],
    },
    {
      faction: 'german',
      hasHq: true,
      supplies: 100,
      hqHpMul: 1,
      incomeMul: 0.5,
      sappers: 2,
      forces: [
        { kind: 'rifle', count: 5, trenchId: 3 },
        { kind: 'lmg', count: 1, trenchId: 3 },
        { kind: 'rifle', count: 4, trenchId: 4 },
        { kind: 'lmg', count: 2, trenchId: 4 },
        { kind: 'mortar', count: 1 },
      ],
    },
  ],
  trenches: [
    { id: 1, x: 1500, width: 160, slots: 6, owner: 0 },
    { id: 2, x: 3900, width: 160, slots: 6, owner: -1 },
    { id: 3, x: 4400, width: 180, slots: 7, owner: 1 },
    { id: 4, x: 6400, width: 180, slots: 7, owner: 1 },
  ],
  pillboxes: [
    { id: 1, x: 4290, side: 1, hpMul: 0.75 },
    { id: 2, x: 6290, side: 1, hpMul: 0.85 },
  ],
  wire: [
    { id: 1, x: 4130, width: 100, owner: 1 },
    { id: 2, x: 5960, width: 120, owner: 1 },
  ],
  timer: null,
  events: [
    {
      type: 'hint',
      when: { at: 3 },
      about: 'mortar',
      text: 'New: Mortar Teams. They outrange every rifle and drop shells into trenches and onto bunkers. Keep them behind your line.',
    },
    {
      type: 'hint',
      when: { at: 22 },
      text: 'Wire slows infantry to a crawl while the guns work on them. Mortar shells and the Barrage cut it; do not walk men through it.',
    },
    {
      type: 'hint',
      when: { at: 45 },
      text: 'Rifles barely scratch a pillbox. Mortars, grenades and the Artillery Barrage will.',
    },
    {
      type: 'hint',
      when: { at: 70 },
      text: 'Artillery Barrage: tap the button, then tap the battlefield where the shells should fall. Call it as you Advance, not before.',
    },
    {
      type: 'hint',
      when: { at: 100 },
      text: 'An empty trench lies short of the German wire. Take it and Hold there: from it your Mortar Teams can reach the German line.',
    },
    {
      type: 'hint',
      when: { trenchCapturedBy: 0, trenchId: 2, delay: 1 },
      text: 'Forward post taken. Hold here and let the Mortar Teams work, then call the Barrage and Advance on the trench.',
    },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 3, delay: 15 },
      side: 1,
      forces: [
        { kind: 'rifle', count: 3 },
        { kind: 'lmg', count: 1 },
      ],
      announce: 'German reserves are moving up to hold the second line.',
    },
    {
      type: 'hint',
      when: { trenchCapturedBy: 0, trenchId: 3, delay: 1 },
      text: 'First line taken. Bring the Mortar Teams up behind it and shell the second line before you go on.',
    },
    {
      type: 'announce',
      when: { trenchCapturedBy: 0, trenchId: 4 },
      text: 'The second line has gone. The German headquarters lies open.',
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
      { kind: 'lmg', count: 2, after: 60 },
      { kind: 'mortar', count: 2, after: 120 },
      { kind: 'rifle', count: 9, after: 200 },
    ],
    firstAttackAfter: 330,
  },
  bot: {
    sappers: 4,
    build: [
      { kind: 'rifle', count: 5, after: 0 },
      { kind: 'mortar', count: 2, after: 15 },
      { kind: 'assault', count: 4, after: 30 },
      { kind: 'lmg', count: 2, after: 50 },
      { kind: 'mortar', count: 3, after: 80 },
      { kind: 'rifle', count: 8, after: 100 },
      { kind: 'assault', count: 7, after: 130 },
    ],
    firstAttackAfter: 170,
  },
  expectedMinutes: [5.5, 9],
  music: 'alamein',
};
