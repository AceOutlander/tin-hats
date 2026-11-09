import type { MissionDef } from '../../schema';

/**
 * Stalingrad 1: Brest Fortress, 22 June 1941 (docs/campaigns/STALINGRAD.md, mission 1). Survival: hold the citadel
 * through the first day against the 45th Infantry Division's waves, which cross from the South Island on the right.
 *
 * Built with today's engine (docs/campaigns/STALINGRAD_BUILD.md, mission 1001): the ring barracks (B1), the garrison
 * club (B2, a former church) and the Kholm Gate (B3) are buildings of two floors (FOUNDATIONS.md 4.3), the HQ is a
 * casemate of the ring barracks (`hqLook`), a 60 s prep phase of wire and sandbag walls comes first (FOUNDATIONS.md
 * 4.8; the test bot wires the bridge foot and sandbags the gate), and the three phases are the mission director's (FOUNDATIONS.md 3: 240 s each, under the one 720 s
 * clock to nightfall). The opening barrage, the Nebelwerfer salvo, the Karl siege mortar and the 21 cm mortars are
 * scripted barrages (side 1 has no HQ, so no commander calls anything); the side objectives are the brief's. The ground
 * is the brief's sectors (FOUNDATIONS.md 4.1): cobbles, the Kholm Gate's rubble, the Mukhavets (water, 4.4) under
 * bridge 1, which the Germans cross from the South Island's wood. The two StuG III Ausf. B are the `tank` kind with the `stug3b`
 * look (src/data/eras.ts).
 */
export const M1001: MissionDef = {
  id: 1001,
  key: 'brest',
  title: 'Brest Fortress',
  location: 'Brest-Litovsk, Byelorussian SSR',
  date: '22 June 1941',
  dateIso: '1941-06-22',
  climate: 'temperate',
  mapPos: { lon: 23.656, lat: 52.083 },
  briefing: [
    'It is a little after four in the morning. The guns opened up across the Bug without warning and the west of the fortress is burning. The Germans are already on the islands and coming over the bridges. Nobody has told us anything, so we will fight with what we have.',
    'The walls of the ring barracks are a metre and more of brick and earth. Get the men inside, put the machine gun in the Kholm Gate where it sweeps the bridge, and keep the sappers carrying ammunition from the stores. A wall is worth ten men in the open.',
    'Their infantry will come first, then assault parties with flamethrowers, then the heavy guns. Hold the citadel through the day and make them pay for every courtyard.',
  ],
  objective: 'Hold the citadel until nightfall.',
  intel: {
    enemy: [
      '45th Infantry Division, in waves over the bridges',
      'About 90 riflemen and MP40 troopers, 6 MG34 teams',
      'Pioneers: 4 flamethrowers, 2 Granatwerfer teams',
      '2 StuG III Ausf. B assault guns late in the day',
      'Heavy guns across the Bug; no aircraft today',
    ],
    friendly: [
      '10 riflemen and a DP gunner in the barracks and the gate',
      '2 sappers and 200 Money: the walls stop most rifle fire',
      'Later, from the stores: 2 mortar crews, 5 Tank Hunters',
    ],
  },
  // Stand-ins until the russiaSummer theatre exists (STALINGRAD_BUILD.md).
  theatre: 'france',
  timeOfDay: 'dawn',
  mode: 'survival',
  length: 7000,
  // The campaign's unlock order (DECISIONS 295): Brest brings the rifle company's two basics, the DP gunner and the
  // Tank Hunters (grenade bundles and bottles, the 1941 answer to the StuGs); the mortars arrive as a loan.
  newUnit: 'lmg',
  unlocks: ['at'],
  newSupport: null,
  units: [
    ['sapper', 'rifle', 'lmg', 'at'],
    ['rifle', 'lmg', 'assault', 'mortar', 'flame', 'tank'],
  ],
  supports: [[], []],
  start: [
    {
      faction: 'soviet',
      hasHq: true,
      supplies: 200,
      hqHpMul: 1,
      hqLook: 'casemate',
      incomeMul: 1.25,
      sappers: 2,
      forces: [
        // B1, the ring barracks: 6 riflemen.
        { kind: 'rifle', count: 6, buildingId: 1 },
        // B3, the Kholm Gate: 4 riflemen and the loaned DP gunner.
        { kind: 'rifle', count: 4, buildingId: 3 },
        { kind: 'lmg', count: 1, buildingId: 3 },
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
  trenches: [],
  // B1 the ring barracks, B2 the garrison club (a former church), B3 the Kholm Gate: two floors each.
  buildings: [
    { id: 1, x: 1500, width: 160, floors: 2, slotsPerFloor: 6, hpMul: 1.4, owner: 0, look: 'casemate' },
    { id: 2, x: 2250, width: 140, floors: 2, slotsPerFloor: 5, hpMul: 1, owner: 0, look: 'church' },
    { id: 3, x: 3100, width: 160, floors: 2, slotsPerFloor: 6, hpMul: 1.4, owner: 0, look: 'casemate' },
  ],
  pillboxes: [],
  wire: [],
  // The brief's sectors (FOUNDATIONS.md 4.1): the Mukhavets is water (4.4), crossed by bridge 1.
  sectors: [
    { from: 0, to: 2600, ground: 'cobble', label: 'Ring barracks' },
    { from: 2600, to: 3250, ground: 'rubble', label: 'Kholm Gate' },
    { from: 3250, to: 3550, ground: 'cobble', label: 'The bridge foot' },
    { from: 3550, to: 4300, ground: 'water', label: 'Mukhavets' },
    { from: 4300, to: 4400, ground: 'road', label: 'South Island' },
    { from: 4400, to: 5400, ground: 'forest', label: 'South Island' },
    { from: 5400, to: 7000, ground: 'grass', label: 'South Island' },
  ],
  // Sixty seconds to dig in before the first wave: the bot wires the Kholm Gate and digs a foxhole behind it.
  // The bridge over the Mukhavets (FOUNDATIONS.md 4.4): nobody holds it, nobody has wired it.
  bridges: [{ id: 1, x0: 3550, x1: 4300, owner: -1 }],
  // The brief's prep (STALINGRAD.md, mission 1): barbed wire and sandbag walls, zone 900 to 3,500.
  prep: {
    seconds: 60,
    buildables: ['wire', 'sandbags'],
    zone: { from: 900, to: 3500 },
    bot: [
      { kind: 'wire', x: 3440 },
      { kind: 'sandbags', x: 2700 },
      { kind: 'sandbags', x: 3330 },
    ],
  },
  timer: { seconds: 720, onExpire: 'win', label: 'Until nightfall' },
  // The mission director (FOUNDATIONS.md 3): three 240 s phases under the one clock to nightfall.
  phases: [
    {
      id: 'morning',
      title: 'The first morning',
      objectives: [{ id: 'morning', type: 'survive', seconds: 240, text: 'Hold the citadel' }],
      sideObjectives: [
        { id: 'gate', text: 'The Kholm Gate holds', failIf: { type: 'pointLost', point: { building: 3 } }, bonus: 0.15 },
        { id: 'stugs', text: 'Knock out both assault guns', objective: { id: 'stugsDead', type: 'kill', side: 1, kinds: ['tank'], count: 2 }, bonus: 0.1 },
      ],
      next: 'parties',
    },
    {
      id: 'parties',
      title: 'Assault parties',
      objectives: [{ id: 'parties', type: 'survive', seconds: 240, text: 'Hold the citadel' }],
      next: 'guns',
    },
    {
      id: 'guns',
      title: 'The guns',
      objectives: [{ id: 'guns', type: 'survive', seconds: 240, text: 'Hold until nightfall' }],
      next: null,
    },
  ],
  events: [
    // The scripted fire of a side with no HQ (FOUNDATIONS.md 3.3): the opening barrage, the Nebelwerfer, the siege
    // mortar and the 21 cm mortars, free and on the phase clocks.
    { id: 'openingBarrage', type: 'banner', when: { phase: 'morning' }, text: 'Artillery!', sound: 'alarm' },
    { type: 'barrage', when: { phase: 'morning' }, side: 1, x: 2500, spread: 900, rounds: 14, duration: 8, weapon: 'artilleryShell' },
    { id: 'nebelwerfer', type: 'barrage', when: { phase: 'parties', delay: 20 }, side: 1, x: 3100, spread: 220, rounds: 12, duration: 3, weapon: 'nebelwerfer', warning: 'Nebelwerfer!' },
    { id: 'karl1', type: 'barrage', when: { phase: 'guns', delay: 90 }, side: 1, x: 2900, spread: 260, rounds: 1, duration: 0, weapon: 'siegeShell', warning: 'Heavy siege mortar: get clear!', delay: 4 },
    { id: 'karl2', type: 'barrage', when: { phase: 'guns', delay: 180 }, side: 1, x: 2900, spread: 260, rounds: 1, duration: 0, weapon: 'siegeShell', warning: 'Heavy siege mortar: get clear!', delay: 4 },
    { id: 'mortar21', type: 'barrage', when: { phase: 'guns', delay: 120 }, side: 1, x: 250, spread: 200, rounds: 6, duration: 5, weapon: 'mortar21', warning: 'Heavy mortars!' },
    // Phase 1, "The first morning" (0 to 240 s).
    { type: 'announce', when: { at: 1 }, text: 'The first morning: the guns across the Bug have opened fire.' },
    {
      type: 'hint',
      when: { at: 3 },
      text: 'The ring barracks and the Kholm Gate stop most rifle fire, and men upstairs see further. Keep them full; a wall is worth ten men in the open.',
    },
    {
      type: 'wave',
      when: { at: 6 },
      side: 1,
      forces: [{ kind: 'rifle', count: 6, x: 5200 }],
      announce: 'German infantry are coming over the bridge.',
    },
    { type: 'wave', when: { every: 25, from: 31, until: 235 }, side: 1, forces: [{ kind: 'rifle', count: 4, x: 5400 }] },
    {
      type: 'hint',
      when: { at: 12 },
      about: 'lmg',
      text: 'New: DP Gunner. His pan-fed gun shreds infantry in the open. Put him in the Kholm Gate where he sweeps the bridge.',
    },
    {
      type: 'hint',
      when: { at: 20 },
      text: 'Sappers carry ammunition from the stores to the HQ. Train two more at once: every crate buys riflemen.',
    },
    {
      type: 'wave',
      when: { at: 60 },
      side: 1,
      forces: [
        { kind: 'lmg', count: 2, x: 5300 },
        { kind: 'rifle', count: 4, x: 5200 },
      ],
      announce: 'Machine-gun teams are setting up on the South Island.',
    },
    {
      type: 'hint',
      when: { at: 75 },
      text: 'Keep the order on Hold. Your men fight from the Kholm Gate; going forward only gives the bridge to their guns.',
    },
    {
      type: 'wave',
      when: { at: 120 },
      side: 1,
      forces: [{ kind: 'assault', count: 6, x: 4700 }],
      announce: 'Assault boats on the Mukhavets!',
    },
    {
      type: 'wave',
      when: { at: 150 },
      side: 1,
      forces: [
        { kind: 'lmg', count: 2, x: 5300 },
        { kind: 'rifle', count: 4, x: 5200 },
      ],
    },
    {
      type: 'hint',
      when: { at: 180 },
      text: 'If the Kholm Gate falls, the line steps back to the garrison club and the barracks. Train riflemen to win it back.',
    },
    // Phase 2, "Assault parties" (240 to 480 s): the loaned mortars arrive.
    { type: 'announce', when: { at: 240 }, text: 'Assault parties: their pioneers are bringing up flamethrowers.' },
    {
      type: 'wave',
      when: { at: 242 },
      side: 0,
      forces: [{ kind: 'mortar', count: 2, x: 2000 }],
      announce: 'Two mortar crews from the 84th Regiment\'s stores.',
    },
    {
      type: 'hint',
      when: { at: 248 },
      text: 'Mortars answer mortars: your crews outrange their Granatwerfer teams. Flamethrowers burn men out of cover, so shoot them at range.',
    },
    {
      type: 'wave',
      when: { at: 280 },
      side: 1,
      forces: [
        { kind: 'flame', count: 2, x: 5000 },
        { kind: 'assault', count: 4, x: 4900 },
        { kind: 'lmg', count: 1, x: 5300 },
      ],
      announce: 'Flamethrowers at the bridge!',
    },
    {
      type: 'wave',
      when: { at: 330 },
      side: 1,
      forces: [
        { kind: 'mortar', count: 2, x: 3480, behaviour: 'guard' },
        { kind: 'rifle', count: 6, x: 5200 },
      ],
      announce: 'Granatwerfer teams are ranging on the gate.',
    },
    {
      type: 'wave',
      when: { at: 380 },
      side: 1,
      forces: [
        { kind: 'flame', count: 2, x: 5000 },
        { kind: 'assault', count: 4, x: 4900 },
        { kind: 'lmg', count: 1, x: 5300 },
      ],
      announce: 'Another assault party is crossing.',
    },
    // Phase 3, "The guns" (480 to 720 s): the Tank Hunters and the two assault guns.
    { type: 'announce', when: { at: 480 }, text: 'The guns: the heavy batteries have found the range.' },
    {
      type: 'wave',
      when: { at: 482 },
      side: 0,
      forces: [{ kind: 'at', count: 3, buildingId: 3 }],
      announce: 'Tank Hunters with grenade bundles have come up from the stores.',
    },
    {
      type: 'wave',
      when: { at: 565 },
      side: 0,
      forces: [{ kind: 'at', count: 2, buildingId: 3 }],
      announce: 'Two more Tank Hunters have made it across the courtyard.',
    },
    {
      type: 'wave',
      when: { at: 490 },
      side: 1,
      forces: [
        { kind: 'tank', count: 1, x: 5600, look: 'stug3b' },
        { kind: 'rifle', count: 6, x: 5400 },
      ],
      announce: 'Assault guns on the bridge!',
    },
    {
      // The battery's second gun follows the first across the bridge.
      type: 'wave',
      when: { at: 560 },
      side: 1,
      forces: [
        { kind: 'tank', count: 1, x: 5600, look: 'stug3b' },
        { kind: 'rifle', count: 4, x: 5400 },
      ],
      announce: 'A second assault gun is on the bridge.',
    },
    {
      type: 'hint',
      when: { at: 495 },
      about: 'at',
      text: 'New: Tank Hunters. They must get close. Keep them in the gate and let the assault guns come to them; strike from the side if you can.',
    },
    {
      type: 'wave',
      when: { every: 20, from: 630, until: 700 },
      side: 1,
      forces: [{ kind: 'rifle', count: 3, x: 5300 }],
    },
    { type: 'announce', when: { at: 660 }, text: 'One more minute. The sun is going down behind the West Island.' },
    {
      type: 'hint',
      when: { hqHpBelow: 0.5, side: 0 },
      text: 'The HQ is under fire. Fall Back lets its machine gun do the work while you rebuild.',
    },
  ],
  // Side 1 has no HQ: everything it fields arrives in the scripted waves.
  ai: { sappers: 0, build: [], firstAttackAfter: 0 },
  bot: {
    sappers: 4,
    build: [
      { kind: 'rifle', count: 12, after: 0 },
      { kind: 'lmg', count: 2, after: 20 },
      { kind: 'rifle', count: 16, after: 90 },
      { kind: 'lmg', count: 3, after: 150 },
      { kind: 'rifle', count: 22, after: 240 },
      { kind: 'lmg', count: 4, after: 360 },
      { kind: 'at', count: 3, after: 400 },
      { kind: 'at', count: 6, after: 480 },
      { kind: 'rifle', count: 26, after: 480 },
    ],
    firstAttackAfter: 9999,
  },
  // The 12 min clock plus up to a minute of prep (the bot calls Ready once its builds stand).
  expectedMinutes: [12, 13.2],
  // Stand-in until the `brest` track exists (STALINGRAD_BUILD.md).
  music: 'dunkirk',
};
