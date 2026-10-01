import type { MissionDef } from '../schema';

/**
 * Mission 5: Primosole Bridge, Sicily, July 1943. A race against the light: destroy the German
 * HQ before nightfall (the sky darkens as the deadline nears). German paratroops hold two lines
 * with machine guns left standing in the open behind small trenches, and their snipers (two of
 * them posted forward in the fields on guard) work on the gunners and mortar crews. An empty
 * trench (a forward post, owner -1) lies 500 wu short of the first line: from it a Sniper
 * (reach 660 wu) covers the German gunners. Introduces the Sniper.
 */
export const M05: MissionDef = {
  id: 5,
  key: 'primosole',
  title: 'Primosole Bridge',
  location: 'Primosole Bridge, Sicily',
  date: 'July 1943',
  mapPos: { lon: 15.06, lat: 37.4 },
  briefing: [
    'The invasion of Sicily is a week old and the road to Catania is blocked by a river. The Simeto is not wide, but its bridge at Primosole is the only crossing fit for lorries. British parachutists took it by night and held it until their ammunition ran out; German paratroops, flown in the same evening, have since dug in along the far bank.',
    'Their snipers are a nuisance of the first order. A rifleman can be replaced; a Bren gunner or a mortar crew under a marksman\'s eye is another matter, and a Medic does not last long either. The battalion has found a few marksmen of its own, and a Sniper outranges everything on that bank. Let him clear the enemy gunners and snipers before the infantry go in.',
    'There is no time to be thorough. Nightfall is ten minutes away, and after dark the Germans will be reinforced and the crossing will be rather more expensive. Take their positions quickly and destroy their headquarters before the light goes.',
  ],
  objective: 'Destroy the German HQ before nightfall.',
  theatre: 'sicily',
  timeOfDay: 'dusk',
  mode: 'assault',
  length: 9200,
  newUnit: 'sniper',
  newSupport: null,
  units: [
    ['sapper', 'rifle', 'lmg', 'assault', 'mortar', 'sniper'],
    ['sapper', 'rifle', 'lmg', 'mortar', 'sniper'],
  ],
  supports: [['artillery'], []],
  start: [
    {
      faction: 'british',
      hasHq: true,
      supplies: 350,
      hqHpMul: 1,
      incomeMul: 1,
      sappers: 3,
      forces: [
        { kind: 'rifle', count: 5, trenchId: 1 },
        { kind: 'sniper', count: 1 },
        { kind: 'assault', count: 2 },
      ],
    },
    {
      faction: 'german',
      hasHq: true,
      supplies: 100,
      hqHpMul: 0.9,
      incomeMul: 0.55,
      sappers: 2,
      forces: [
        { kind: 'rifle', count: 4, trenchId: 3 },
        { kind: 'lmg', count: 3, trenchId: 3 },
        { kind: 'sniper', count: 1, trenchId: 3 },
        { kind: 'rifle', count: 3, trenchId: 4 },
        { kind: 'lmg', count: 1, trenchId: 4 },
        { kind: 'sniper', count: 2, x: 3000, behaviour: 'guard' },
      ],
    },
  ],
  trenches: [
    { id: 1, x: 1500, width: 160, slots: 6, owner: 0 },
    { id: 2, x: 3850, width: 160, slots: 6, owner: -1 },
    { id: 3, x: 4400, width: 120, slots: 4, owner: 1 },
    { id: 4, x: 6800, width: 120, slots: 4, owner: 1 },
  ],
  pillboxes: [{ id: 1, x: 7100, side: 1, hpMul: 0.8 }],
  wire: [{ id: 1, x: 4120, width: 100, owner: 1 }],
  timer: { seconds: 600, onExpire: 'lose', label: 'Nightfall' },
  events: [
    {
      type: 'hint',
      when: { at: 3 },
      text: 'The light is failing. Destroy the German HQ before the clock runs out; the sky darkens as nightfall nears.',
    },
    {
      type: 'hint',
      when: { at: 16 },
      text: 'New: Sniper. He outranges every rifle and one shot kills most men in the open. He prefers gunners, mortar crews and medics.',
    },
    {
      type: 'hint',
      when: { at: 32 },
      text: 'Tap a Sniper to take direct control of him. Walk him forward and fire from beyond the range of their rifles.',
    },
    {
      type: 'hint',
      when: { at: 55 },
      text: 'An empty trench lies ahead of the German line. Take it and Hold there: your Snipers can reach the gunners behind their trench.',
    },
    {
      type: 'wave',
      when: { at: 70 },
      side: 1,
      forces: [{ kind: 'sniper', count: 2 }],
      announce: 'German snipers have moved up to the far bank.',
    },
    {
      type: 'hint',
      when: { at: 85 },
      text: 'Enemy snipers are shooting your Bren Gunners and mortar crews first. Answer with Snipers of your own and keep the gunners back.',
    },
    {
      type: 'hint',
      when: { at: 110 },
      text: 'Snipers are posted in the fields ahead of their first trench. Find them before they find your gunners.',
    },
    {
      type: 'wave',
      when: { at: 240 },
      side: 1,
      forces: [
        { kind: 'rifle', count: 2 },
        { kind: 'sniper', count: 1 },
      ],
      announce: 'More German paratroops are coming up from the bridge.',
    },
    {
      type: 'hint',
      when: { trenchCapturedBy: 0, trenchId: 2, delay: 1 },
      text: 'Forward post taken. Hold here and let the Snipers work on the gunners, then Advance with the barrage.',
    },
    {
      type: 'hint',
      when: { trenchCapturedBy: 0, trenchId: 3, delay: 1 },
      text: 'First line taken. Do not stop: the light will not wait for a tidy reorganisation.',
    },
    { type: 'announce', when: { at: 300 }, text: 'Half the light has gone.' },
    {
      type: 'wave',
      when: { at: 400 },
      side: 1,
      forces: [
        { kind: 'rifle', count: 3 },
        { kind: 'lmg', count: 1 },
      ],
      announce: 'The Germans are throwing in their last reserves.',
    },
    { type: 'announce', when: { at: 480 }, text: 'Two minutes of daylight left.' },
    {
      type: 'hint',
      when: { hqHpBelow: 0.5, side: 0 },
      text: 'Your HQ is under fire. Fall Back lets its machine gun do the work while you rebuild.',
    },
  ],
  ai: {
    sappers: 2,
    build: [
      { kind: 'rifle', count: 5, after: 0 },
      { kind: 'sniper', count: 2, after: 50 },
      { kind: 'lmg', count: 3, after: 100 },
      { kind: 'rifle', count: 8, after: 200 },
      { kind: 'mortar', count: 1, after: 260 },
    ],
    firstAttackAfter: 300,
  },
  bot: {
    sappers: 4,
    build: [
      { kind: 'rifle', count: 5, after: 0 },
      { kind: 'sniper', count: 2, after: 15 },
      { kind: 'assault', count: 4, after: 30 },
      { kind: 'mortar', count: 1, after: 50 },
      { kind: 'rifle', count: 9, after: 90 },
      { kind: 'assault', count: 7, after: 120 },
    ],
    firstAttackAfter: 130,
  },
  expectedMinutes: [5, 8.5],
};
