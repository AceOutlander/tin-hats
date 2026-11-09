import { STALINGRAD_MUSIC } from '../../musicCampaigns';
import type { MissionDef } from '../../schema';

/**
 * Stalingrad 5: Crossing the Volga, night of 14 to 15 September 1942 (docs/campaigns/STALINGRAD.md, mission 5). The
 * 13th Guards Rifle Division crosses to the central landing under fire, clears the houses along the high bank and takes
 * the central railway station against the 71st Infantry Division.
 *
 * Built on the mission director (docs/campaigns/STALINGRAD_BUILD.md, mission 1005): a special mission of four phases.
 * Hold the landing (P1, held through trench 1, the forward spawn and the ferry landing: FOUNDATIONS.md 4.4, a boat
 * every 40 s from the east bank brings over the men trained or sent since the last) for 180 s, lost if it falls; take the high bank (the riverside apartment blocks B1 to B4, FOUNDATIONS.md 4.3; P2 is held through B2, a
 * forward spawn once ours, with a Nebelwerfer salvo on it); take the station (B5; the Stukas come with daylight); then
 * a 45 s prep phase and hold the station for 240 s against three counter-attacks. B6 is the nail factory hall, the HQ a
 * log dugout (`hqLook`). The Volga is water: waded at a crawl, and no vehicle crosses it. The free reinforcement waves
 * go on the boats too, and the barrage on the river at 66 s sinks 30% of the boat then crossing; the side objective
 * "the whole battalion ashore" fails at two loads hit. Sandbags go in the station's windows in the last prep. The ground
 * is the brief's sectors (sand, water, the high bank's slope, rubble).
 *
 * Weather and time (FOUNDATIONS.md 4.7): the stalingrad theatre; night under the smoke of the burning city (visibility
 * 0.65), the Germans' flares over the landing every 40 s, dawn at the station (no Stukas fly before it), day for the
 * hold.
 */
export const M1005: MissionDef = {
  id: 1005,
  key: 'volga',
  title: 'Crossing the Volga',
  location: 'Central landing, Stalingrad',
  date: '15 September 1942',
  dateIso: '1942-09-15',
  climate: 'city',
  mapPos: { lon: 44.527, lat: 48.709 },
  briefing: [
    'Guardsmen, the city is burning from end to end and the Germans are almost at the river. If they take the central landing, the army over there has no door left. Tonight we cross.',
    'There are not enough boats and not enough rifles. Some of you will land with grenades and nothing else; take a rifle from the first man who no longer needs it. The guns on this bank and the rocket batteries will fire for us. The boats will keep coming, one load at a time.',
    'Get off the sand and up the bank before it is light. Clear the houses along the river, then take the railway station and hold it. Every hour we hold the centre, another regiment gets across.',
  ],
  objective: 'Land, clear the river bank, then take the central station and hold it.',
  intel: {
    enemy: [
      '71st Infantry Division holds the bank and the station',
      'About 65 riflemen with MG34 and MG42 teams',
      '4 Panzer III, a StuG III, pioneers with flamethrowers',
      'Stukas from first light',
    ],
    friendly: [
      '13th Guards: 10 riflemen, 8 PPSh troopers, a DP gunner',
      'More boats keep landing: about a hundred men',
      'Only 120 Money: the ferries are slow',
      'Artillery and Katyusha from the east bank',
    ],
  },
  theatre: 'stalingrad',
  timeOfDay: 'night',
  weather: 'smoke',
  mode: 'special',
  length: 12000,
  // The unlock order (DECISIONS 334): the ROKS-3, for the houses on the bank. The sniper comes with Mamayev Kurgan.
  newUnit: 'flame',
  newSupport: null,
  units: [
    ['sapper', 'rifle', 'lmg', 'assault', 'mortar', 'medic', 'at', 'tank', 'flame', 'conscript'],
    // The AI trains riflemen, MGs and Pak crews; its assault troops, mortars, pioneers and panzers come in the waves.
    ['sapper', 'rifle', 'lmg', 'at'],
  ],
  supports: [
    ['artillery', 'katyusha'],
    ['airStrike'],
  ],
  start: [
    {
      faction: 'soviet',
      hasHq: true,
      supplies: 120,
      hqHpMul: 1,
      hqLook: 'logDugout',
      incomeMul: 1,
      sappers: 3,
      forces: [
        // The first boats at the landing stage: riflemen, PPSh troopers (four of them loaned) and a DP gunner.
        { kind: 'rifle', count: 10, trenchId: 1 },
        { kind: 'assault', count: 8, x: 4560 },
        { kind: 'lmg', count: 1, trenchId: 1 },
      ],
    },
    {
      faction: 'german',
      hasHq: true,
      supplies: 150,
      hqHpMul: 1,
      incomeMul: 0.5,
      sappers: 2,
      forces: [
        // B1 and B2, the riverside apartment blocks.
        { kind: 'rifle', count: 6, buildingId: 1 },
        { kind: 'lmg', count: 2, buildingId: 1 },
        { kind: 'rifle', count: 6, buildingId: 2, behaviour: 'garrison' },
        { kind: 'lmg', count: 2, buildingId: 2, behaviour: 'garrison' },
        // B5, the central station.
        { kind: 'rifle', count: 8, buildingId: 5, behaviour: 'garrison' },
        { kind: 'lmg', count: 2, buildingId: 5, behaviour: 'garrison' },
        // B6, the nail factory hall.
        { kind: 'rifle', count: 4, buildingId: 6, behaviour: 'garrison' },
        { kind: 'mortar', count: 1, x: 11250, behaviour: 'guard' },
      ],
    },
  ],
  trenches: [
    // P1, the central landing.
    { id: 1, x: 4700, width: 230, slots: 10, owner: 0 },
  ],
  buildings: [
    // The riverside blocks on the high bank: B1 and B2 (P2) German-held, B3 an empty shell between them, B4 over the
    // landing stage, ours.
    { id: 1, x: 6500, width: 180, floors: 3, slotsPerFloor: 3, hpMul: 1.2, owner: 1, look: 'apartment' },
    { id: 2, x: 7400, width: 180, floors: 4, slotsPerFloor: 2, hpMul: 1.2, owner: 1, look: 'apartment' },
    { id: 3, x: 6950, width: 150, floors: 3, slotsPerFloor: 3, hpMul: 1, owner: -1, look: 'apartment' },
    { id: 4, x: 5600, width: 160, floors: 4, slotsPerFloor: 2, hpMul: 1, owner: 0, look: 'apartment' },
    // B5 the central station, B6 the nail factory hall.
    { id: 5, x: 10200, width: 230, floors: 2, slotsPerFloor: 6, hpMul: 1.5, owner: 1, look: 'station' },
    { id: 6, x: 11000, width: 170, floors: 1, slotsPerFloor: 6, hpMul: 1.2, owner: 1, look: 'factoryHall' },
  ],
  pillboxes: [],
  wire: [],
  // The brief's sectors (FOUNDATIONS.md 4.1): the east bank, the Volga (waded at a crawl: trained units cross on the
  // ferry to the landing, its forward spawn point), the landing stage and the climb up the high bank, then rubble.
  sectors: [
    { from: 0, to: 2500, ground: 'sand', label: 'East bank' },
    { from: 2500, to: 4500, ground: 'water', label: 'The Volga' },
    { from: 4500, to: 5200, ground: 'sand', label: 'Landing stage' },
    { from: 5200, to: 6000, ground: 'slopeUp', label: 'The high bank' },
    { from: 6000, to: 9000, ground: 'rubble', label: 'Riverside blocks' },
    { from: 9000, to: 10600, ground: 'rubble', label: 'Central station' },
    { from: 10600, to: 12000, ground: 'cobble', label: 'Central station' },
  ],
  // The capture points (4.5): the landing (held through trench 1) and the riverside blocks (held through the building
  // B2), both forward spawn points. The landing is the ferry's (4.4): a boat every 40 s from the east bank, 20 s over.
  capturePoints: [
    {
      id: 'P1',
      x: 4700,
      width: 300,
      label: 'Central landing',
      owner: 0,
      captureTime: 0,
      spawn: true,
      contestRadius: 500,
      structure: { trench: 1 },
      batchEvery: 40,
      ferry: { from: 2450, crossSeconds: 20, hitShare: 0.3 },
    },
    { id: 'P2', x: 7400, width: 300, label: 'Riverside blocks', owner: 1, captureTime: 0, spawn: true, contestRadius: 600, structure: { building: 2 } },
  ],
  timer: null,
  // The mission director (FOUNDATIONS.md 3): the four phases of the brief (STALINGRAD.md, mission 5).
  phases: [
    {
      id: 'landing',
      title: 'The landing',
      objectives: [{ id: 'landing', type: 'hold', point: { point: 'P1' }, seconds: 180, text: 'Hold the landing' }],
      lose: [{ type: 'pointLost', point: { point: 'P1' } }],
      sideObjectives: [
        // Fewer than two boat loads hit on the way over (the barrage on the river takes one).
        { id: 'ashore', text: 'The whole battalion ashore', failIf: { type: 'ferryLoads', point: 'P1', count: 2 }, bonus: 0.1 },
        { id: 'nails', text: 'The nail factory', objective: { id: 'nailFactory', type: 'capture', point: { building: 6 } }, bonus: 0.1 },
      ],
      next: 'bank',
    },
    {
      id: 'bank',
      title: 'The high bank',
      objectives: [{ id: 'bank', type: 'capture', point: { point: 'P2' }, text: 'Take the riverside blocks' }],
      // Off the beach before first light, when the Stukas can fly (DECISIONS 387): a battalion still on the sand at
      // dawn is lost.
      timer: { seconds: 600, label: 'Before first light', onExpire: 'lose' },
      next: 'station',
    },
    {
      id: 'station',
      title: 'The station',
      objectives: [{ id: 'station', type: 'capture', point: { building: 5 }, text: 'Take the station' }],
      next: 'holdStation',
    },
    {
      id: 'holdStation',
      title: 'Hold the station',
      prep: { seconds: 45, buildables: ['wire', 'foxhole', 'sandbags'], bot: [{ kind: 'sandbags', x: 10200 }] },
      objectives: [{ id: 'stationHeld', type: 'hold', point: { building: 5 }, seconds: 240, text: 'Hold the station' }],
      next: null,
    },
  ],
  events: [
    // The director's events: the Nebelwerfer on the high bank, the Stukas once it is light.
    { id: 'nebelwerfer', type: 'barrage', when: { phase: 'bank', delay: 120 }, side: 1, x: 7400, spread: 220, rounds: 10, duration: 3, weapon: 'nebelwerfer', warning: 'Nebelwerfer!' },
    // Flares over the landing while it is held, dawn at the station, then day (FOUNDATIONS.md 4.7).
    { id: 'landingFlares', type: 'flare', when: { phaseEvery: 40, phase: 'landing', from: 10 }, side: 1, x: 4800 },
    { id: 'dawn', type: 'time', when: { phase: 'station' }, to: 'dawn', over: 120 },
    { id: 'day', type: 'time', when: { phase: 'holdStation' }, to: 'day', over: 90 },
    { id: 'stukasDawn', type: 'airRaid', when: { phase: 'station', delay: 130 }, side: 1, support: 'airStrike', x: 7400 },
    { id: 'stukasStation', type: 'airRaid', when: { phase: 'holdStation', delay: 90 }, side: 1, support: 'airStrike', x: 10000 },
    // Phase 1, "The landing".
    { type: 'announce', when: { at: 1 }, text: 'The landing: the first boats are grinding onto the sand.' },
    {
      type: 'hint',
      when: { at: 4 },
      text: 'New troops arrive with each boat. Hold the landing until the battalion is ashore.',
    },
    {
      type: 'wave',
      when: { at: 20 },
      side: 1,
      forces: [{ kind: 'rifle', count: 8, x: 6300, behaviour: 'assault' }],
      announce: 'Counter-attack from the houses!',
    },
    // The boats (the ferry at P1): each wave goes aboard the boat that puts out 2 s later and lands 20 s after that.
    {
      type: 'wave',
      when: { at: 18 },
      side: 0,
      forces: [
        { kind: 'rifle', count: 4, at: { point: 'P1' } },
        { kind: 'assault', count: 1, at: { point: 'P1' } },
      ],
      announce: 'Another boat is putting out from the east bank.',
    },
    {
      type: 'wave',
      when: { at: 58 },
      side: 0,
      forces: [{ kind: 'rifle', count: 4, at: { point: 'P1' } }],
      announce: 'Another boat is putting out from the east bank.',
    },
    // The barrage on the river (STALINGRAD.md: "the next ferry load loses 30%"): on the boat in mid-stream.
    { id: 'riverBarrage', type: 'barrage', when: { at: 66 }, side: 1, x: 3290, spread: 120, rounds: 12, duration: 4, weapon: 'artilleryShell' },
    { type: 'announce', when: { at: 68 }, text: 'Shells on the river: the boat has been hit.' },
    {
      type: 'wave',
      when: { at: 100 },
      side: 1,
      forces: [
        { kind: 'rifle', count: 8, x: 6300, behaviour: 'assault' },
        { kind: 'lmg', count: 1, x: 6400, behaviour: 'assault' },
      ],
      announce: 'They are coming down to the water again.',
    },
    {
      type: 'wave',
      when: { at: 98 },
      side: 0,
      forces: [
        { kind: 'rifle', count: 4, at: { point: 'P1' } },
        { kind: 'lmg', count: 1, at: { point: 'P1' } },
      ],
      announce: 'Another boat is putting out from the east bank.',
    },
    {
      type: 'wave',
      when: { at: 138 },
      side: 0,
      forces: [
        { kind: 'rifle', count: 4, at: { point: 'P1' } },
        { kind: 'assault', count: 2, at: { point: 'P1' } },
      ],
      announce: 'The last of the battalion is in the boats.',
    },
    // Phase 2, "The high bank".
    { type: 'announce', when: { at: 180 }, text: 'The high bank: clear the houses along the river.' },
    {
      type: 'wave',
      when: { at: 182 },
      side: 0,
      forces: [{ kind: 'flame', count: 1, at: { point: 'P1' } }],
      announce: 'A ROKS flamethrower is coming over with the engineers.',
    },
    {
      type: 'hint',
      when: { at: 186 },
      about: 'flame',
      text: 'New: ROKS-3 Flamethrower. Buildings work like trenches; grenades and flamethrowers clear them.',
    },
    {
      type: 'wave',
      when: { every: 60, from: 240, until: 1500 },
      side: 0,
      forces: [
        { kind: 'rifle', count: 3, at: { point: 'P1' } },
        { kind: 'assault', count: 1, at: { point: 'P1' } },
      ],
      announce: 'Another regiment\'s boats are getting across.',
    },
    { type: 'announce', when: { pointCapturedBy: 0, point: { point: 'P2' } }, text: 'The riverside blocks are ours. The station lies ahead.' },
    // Phase 3, "The station".
    {
      type: 'wave',
      when: { phase: 'station', delay: 6 },
      side: 0,
      forces: [{ kind: 'at', count: 3, buildingId: 2, behaviour: 'garrison' }],
      announce: 'Three PTRD teams have come up to the high bank.',
    },
    {
      type: 'hint',
      when: { phase: 'station', delay: 10 },
      text: 'Mortars on the station, the Katyusha on its reserves; then the riflemen go in behind the grenades.',
    },
    {
      type: 'wave',
      when: { phase: 'station', delay: 90 },
      side: 1,
      forces: [
        { kind: 'tank', count: 2, x: 11400, behaviour: 'assault' },
        { kind: 'rifle', count: 8, x: 11300, behaviour: 'assault' },
      ],
      announce: 'Panzers are coming down from the station square.',
    },
    {
      type: 'wave',
      when: { phase: 'station', delay: 200 },
      side: 1,
      forces: [
        { kind: 'tank', count: 1, x: 11400, behaviour: 'assault', look: 'stug3f' },
        { kind: 'assault', count: 6, x: 11300, behaviour: 'assault' },
      ],
      announce: 'An assault gun with sub-machine gunners.',
    },
    // Phase 4, "Hold the station".
    { type: 'announce', when: { pointCapturedBy: 0, point: { building: 5 } }, text: 'The station is ours. Hold it.' },
    {
      type: 'wave',
      when: { phase: 'holdStation', delay: 30 },
      side: 1,
      forces: [{ kind: 'rifle', count: 6, behaviour: 'assault' }],
      announce: 'Counter-attack on the station!',
    },
    {
      type: 'wave',
      when: { phase: 'holdStation', delay: 120 },
      side: 1,
      forces: [
        { kind: 'tank', count: 2, behaviour: 'assault' },
        { kind: 'rifle', count: 6, behaviour: 'assault' },
      ],
      announce: 'Panzers are counter-attacking the station.',
    },
    {
      type: 'wave',
      when: { phase: 'holdStation', delay: 200 },
      side: 1,
      forces: [
        { kind: 'rifle', count: 6, behaviour: 'assault' },
        { kind: 'flame', count: 2, behaviour: 'assault' },
      ],
      announce: 'Their pioneers are coming with flamethrowers.',
    },
    {
      type: 'hint',
      when: { hqHpBelow: 0.5, side: 0 },
      text: 'The HQ is under fire. Fall Back lets its machine gun do the work while you rebuild.',
    },
  ],
  ai: {
    sappers: 2,
    build: [
      { kind: 'rifle', count: 6, after: 0 },
      { kind: 'lmg', count: 2, after: 60 },
      { kind: 'rifle', count: 10, after: 240 },
      { kind: 'at', count: 2, after: 300 },
    ],
    firstAttackAfter: 900,
  },
  bot: {
    sappers: 4,
    build: [
      { kind: 'rifle', count: 6, after: 0 },
      { kind: 'assault', count: 6, after: 20 },
      { kind: 'mortar', count: 2, after: 60 },
      { kind: 'flame', count: 2, after: 120 },
      { kind: 'at', count: 3, after: 180 },
      { kind: 'rifle', count: 10, after: 240 },
      { kind: 'at', count: 5, after: 360 },
    ],
    firstAttackAfter: 185,
  },
  // The design's 20 to 23 minutes include the 180 s landing hold and the 240 s station hold (STALINGRAD_BUILD.md).
  expectedMinutes: [9, 23],
  music: STALINGRAD_MUSIC.missions[1005],
};
