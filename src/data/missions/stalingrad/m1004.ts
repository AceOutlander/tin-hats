import { STALINGRAD_MUSIC } from '../../musicCampaigns';
import type { MissionDef } from '../../schema';

/**
 * Stalingrad 4: the Moscow counter-offensive at Klin, 12 December 1941 (docs/campaigns/STALINGRAD.md, mission 4). The
 * 371st Rifle Division of the 30th Army pushes through the forest by night, takes the villages one by one, cuts the
 * highway and the railway that are the Third Panzer Group's only road west, and takes Klin. The Germans are thin and
 * frozen: the 1st Panzer Division holds the town with a few Panzer IIIs and IVs, two of them frozen in place.
 *
 * Built on the mission director (docs/campaigns/STALINGRAD_BUILD.md, mission 1004): four phases on the brief's capture
 * points (FOUNDATIONS.md 4.5): take the first village (P1, held through its izba B2), then the forest edge (P2) past
 * the forest trench (with a scripted counter-attack from it), cut the highway (P3) and hold it for 300 s against three
 * columns (the Il-2 is offered from then on), then Klin, where the Germans wait in the houses for 240 s before their
 * own judgement takes over. Klin is prepared by the army, not only the player's call-ins (DECISIONS 431): the 8th Tank
 * Brigade with tank riders, the division's guns one shell at a time, three Katyusha salvoes on the last strongpoint,
 * and the 365th Rifle Division when the garrison makes its last stand. The village's izbas and Klin's houses, church and station are buildings (B1 to B8, 4.3). Trained units deploy
 * at the positions taken (the points are forward spawns), the PTRD loan comes up at the village; the two frozen panzers
 * in Klin cannot move (leash 0). Deep snow slows everyone but the ski troops (the `skis` tag).
 *
 * Weather and time (FOUNDATIONS.md 4.7): the night approach in a blizzard (visibility 0.65, men on foot slowed, no air),
 * a German flare over the village at 200 s; snow and dawn through the forest; clear and day for the highway, when the
 * Il-2s fly. The backdrop is the russiaSummer winter forest, crossfading into the stalingrad theatre's winter ruins
 * (Klin's streets) at the town.
 */
export const M1004: MissionDef = {
  id: 1004,
  key: 'klin',
  title: 'The Road to Klin',
  location: 'Klin, Moscow Oblast',
  date: '12 December 1941',
  dateIso: '1941-12-12',
  climate: 'winter',
  mapPos: { lon: 36.73, lat: 56.33 },
  briefing: [
    'For five months we have given ground. Tonight we take some back. The Germans stand thirty kilometres from Moscow with frozen engines, and their men are wrapped in blankets and summer boots. They expected to be in the city by now; instead they are out in our winter.',
    'The whole front attacks at once. Our road is to Klin, where their panzer groups have their depots and their only road home. The ski battalions go first, through the forest in the dark; the frost is thirty below, and every village they hold is a stove they will not want to leave.',
    'Take the villages one by one and use them as stepping stones; your reinforcements can come up to any you hold. Cut the highway and the railway, then take Klin.',
  ],
  objective: 'Advance through the forest, cut the highway and take Klin.',
  intel: {
    enemy: [
      '1st Panzer Division, frozen and short of fuel',
      'About 80 riflemen in the villages, trenches and Klin',
      'MG34 teams, Granatwerfer teams and PzB 39 teams',
      '5 tanks, two frozen in place; 3 SdKfz 251',
      'Artillery; no aircraft in the blizzard',
    ],
    friendly: [
      '371st Rifle Division: 10 riflemen, 6 ski troopers, 2 DPs',
      'A T-34, a T-60, 2 mortar crews and 4 militia squads',
      'PTRD teams at the village; at Klin 2 T-34s with riders',
      'Artillery, smoke, Katyusha, and the Il-2 when it clears',
    ],
  },
  theatre: 'russiaSummer',
  timeOfDay: 'night',
  weather: 'blizzard',
  mode: 'assault',
  length: 26000,
  // The unlock order (DECISIONS 334): the sanitarka for the long winter attack, and the militia battalions (the
  // Militia Squad of 1941, the Conscript Squad of 1942; listed in every Soviet mission from here on).
  newUnit: 'medic',
  unlocks: ['conscript'],
  newSupport: 'airStrike',
  units: [
    ['sapper', 'rifle', 'lmg', 'assault', 'mortar', 'medic', 'at', 'tank', 'conscript'],
    ['sapper', 'rifle', 'lmg', 'mortar', 'at', 'tank'],
  ],
  supports: [
    ['artillery', 'smoke', 'katyusha', 'airStrike'],
    ['artillery'],
  ],
  start: [
    {
      faction: 'soviet',
      // The Il-2s fly once the weather clears (phase 3).
      supportsOff: ['airStrike'],
      hasHq: true,
      supplies: 600,
      hqHpMul: 1,
      hqLook: 'logDugout',
      incomeMul: 1,
      sappers: 4,
      forces: [
        { kind: 'rifle', count: 10 },
        // Ski troopers in white snow smocks (the `skiTroops` look): deep snow does not slow them (the `skis` tag).
        { kind: 'assault', count: 6, look: 'skiTroops', tags: ['skis'] },
        { kind: 'lmg', count: 2 },
        { kind: 'tank', count: 1, x: 1200 },
        // T-60 (the lightTank kind).
        { kind: 'lightTank', count: 1, x: 1350 },
        // Two mortar crews and the militia battalion's four squads.
        { kind: 'mortar', count: 2 },
        { kind: 'conscript', count: 20 },
      ],
    },
    {
      faction: 'german',
      hasHq: true,
      supplies: 150,
      hqHpMul: 1,
      hqLook: 'bunkerGerman',
      incomeMul: 0.5,
      sappers: 2,
      forces: [
        // V1, the first village: its two izbas.
        { kind: 'rifle', count: 4, buildingId: 1 },
        { kind: 'rifle', count: 4, buildingId: 2 },
        { kind: 'lmg', count: 1, buildingId: 2 },
        // T1 in the fir forest.
        { kind: 'rifle', count: 6, trenchId: 2, behaviour: 'garrison' },
        { kind: 'lmg', count: 1, trenchId: 2, behaviour: 'garrison' },
        { kind: 'mortar', count: 1, x: 11600, behaviour: 'guard' },
        // T2 on the highway, with a Pak 38 crew (the at kind).
        { kind: 'rifle', count: 6, trenchId: 3, behaviour: 'garrison' },
        { kind: 'lmg', count: 2, trenchId: 3, behaviour: 'garrison' },
        { kind: 'at', count: 1, trenchId: 3, behaviour: 'garrison' },
        // Klin: the houses at the edge of town (B3), the church (B6) and the station (B7).
        { kind: 'rifle', count: 6, buildingId: 3, behaviour: 'garrison' },
        { kind: 'lmg', count: 1, buildingId: 3, behaviour: 'garrison' },
        { kind: 'rifle', count: 2, buildingId: 6, behaviour: 'garrison' },
        { kind: 'rifle', count: 4, buildingId: 7, behaviour: 'garrison' },
        { kind: 'lmg', count: 1, buildingId: 7, behaviour: 'garrison' },
        { kind: 'at', count: 1, buildingId: 7, behaviour: 'garrison' },
        { kind: 'mortar', count: 2, x: 24200, behaviour: 'guard' },
        // The 1st Panzer Division's tanks in Klin: two Panzer IIIs frozen in place, one Panzer IV running.
        { kind: 'lightTank', count: 1, x: 24600, behaviour: 'guard', look: 'panzer3h', leash: 0 },
        { kind: 'lightTank', count: 1, x: 24900, behaviour: 'guard', look: 'panzer3h', leash: 0 },
        { kind: 'tank', count: 1, x: 22600, behaviour: 'guard' },
      ],
    },
  ],
  trenches: [
    // T1 in the fir forest (near P2, the forest edge).
    { id: 2, x: 11000, width: 180, slots: 7, owner: 1 },
    // T2 on the highway (P3).
    { id: 3, x: 16500, width: 190, slots: 8, owner: 1 },
  ],
  buildings: [
    // V1, the first village: two izbas (B2 is P1).
    { id: 1, x: 6650, width: 130, floors: 1, slotsPerFloor: 4, hpMul: 0.6, owner: 1, look: 'izba' },
    { id: 2, x: 7050, width: 150, floors: 1, slotsPerFloor: 5, hpMul: 0.6, owner: 1, look: 'izba' },
    // Klin: houses at the edge of town, more houses, the church, the railway station (the side objective) and a house.
    { id: 3, x: 20950, width: 170, floors: 2, slotsPerFloor: 4, hpMul: 1, owner: 1, look: 'house' },
    { id: 4, x: 21450, width: 130, floors: 1, slotsPerFloor: 4, hpMul: 0.8, owner: 1, look: 'house' },
    { id: 5, x: 22150, width: 140, floors: 2, slotsPerFloor: 3, hpMul: 0.8, owner: 1, look: 'house' },
    { id: 6, x: 23000, width: 160, floors: 2, slotsPerFloor: 3, hpMul: 1.2, owner: 1, look: 'church' },
    { id: 7, x: 23550, width: 200, floors: 2, slotsPerFloor: 4, hpMul: 1.2, owner: 1, look: 'station' },
    { id: 8, x: 24350, width: 130, floors: 1, slotsPerFloor: 4, hpMul: 0.8, owner: 1, look: 'house' },
  ],
  pillboxes: [],
  wire: [{ id: 1, x: 15000, width: 120, owner: 1 }],
  // The brief's sectors (FOUNDATIONS.md 4.1): deep snow to the first village, the fir forest, the highway and Klin.
  sectors: [
    { from: 0, to: 3000, ground: 'deepSnow', label: 'Assembly in the forest' },
    { from: 3000, to: 8000, ground: 'deepSnow', label: 'Snowfields' },
    { from: 8000, to: 14000, ground: 'forest', label: 'Fir forest' },
    { from: 14000, to: 19000, ground: 'road', label: 'Highway and railway' },
    { from: 19000, to: 22500, ground: 'rubble', label: 'Klin', backdrop: 'stalingrad' },
    { from: 22500, to: 26000, ground: 'cobble', label: 'Klin', backdrop: 'stalingrad' },
  ],
  // The capture points and forward spawns (4.5): the village is held through its izba B2, the forest edge and the
  // highway are open ground taken by holding it.
  capturePoints: [
    { id: 'P1', x: 7000, width: 300, label: 'The village', owner: 1, captureTime: 0, spawn: true, contestRadius: 600, structure: { building: 2 } },
    { id: 'P2', x: 13200, width: 400, label: 'Forest edge', owner: -1, captureTime: 10, spawn: true, contestRadius: 600 },
    { id: 'P3', x: 17000, width: 400, label: 'The highway', owner: -1, captureTime: 10, spawn: true, contestRadius: 600 },
  ],
  timer: null,
  // The mission director (FOUNDATIONS.md 3): the four phases of the brief (STALINGRAD.md, mission 4).
  phases: [
    {
      id: 'night',
      title: 'Night approach',
      objectives: [{ id: 'village', type: 'capture', point: { point: 'P1' }, text: 'Take the first village' }],
      sideObjectives: [
        { id: 'station', text: 'The station', objective: { id: 'stationTaken', type: 'capture', point: { building: 7 } }, bonus: 0.1 },
        { id: 'fast', text: 'The highway inside 20 minutes', objective: { id: 'highwayFast', type: 'capture', point: { point: 'P3' } }, within: 1200, bonus: 0.15 },
      ],
      next: 'forest',
    },
    {
      id: 'forest',
      title: 'Through the forest',
      objectives: [{ id: 'forestEdge', type: 'capture', point: { point: 'P2' }, text: 'Take the forest edge' }],
      next: 'highway',
    },
    {
      id: 'highway',
      title: 'Cut the highway',
      objectives: [
        { id: 'highway', type: 'capture', point: { point: 'P3' }, text: 'Take the highway' },
        { id: 'highwayHeld', type: 'hold', point: { point: 'P3' }, seconds: 300, text: 'Hold the highway' },
      ],
      next: 'klin',
    },
    {
      id: 'klin',
      title: 'Klin',
      objectives: [{ id: 'klinHq', type: 'destroyHq', side: 1, text: 'Take Klin' }],
      next: null,
    },
  ],
  events: [
    // The director's events: the counter-attack from the forest, the Il-2s, the Germans waiting in Klin, the guns.
    { id: 'forestCounter', type: 'posture', when: { phase: 'forest', delay: 120 }, side: 1, posture: 'counterattack', point: { point: 'P1' }, seconds: 60 },
    { id: 'il2', type: 'support', when: { phase: 'highway' }, side: 0, kind: 'airStrike', enabled: true },
    // Night in the blizzard, a flare over the village, then snow at dawn and a clear day (FOUNDATIONS.md 4.7).
    { id: 'villageFlare', type: 'flare', when: { phase: 'night', delay: 75 }, side: 1, x: 7000 },
    { id: 'snowAtDawn', type: 'weather', when: { phase: 'forest' }, to: 'snow', over: 120 },
    { id: 'dawn', type: 'time', when: { phase: 'forest' }, to: 'dawn', over: 180 },
    { id: 'clears', type: 'weather', when: { phase: 'highway' }, to: 'clear', over: 60 },
    { id: 'day', type: 'time', when: { phase: 'highway' }, to: 'day', over: 60 },
    // Klin's garrison stays in the town while the columns try to force the highway (DECISIONS 431).
    { id: 'highwayWaits', type: 'posture', when: { phase: 'highway' }, side: 1, posture: 'hold' },
    { id: 'klinWaits', type: 'posture', when: { phase: 'klin' }, side: 1, posture: 'hold' },
    { id: 'klinFree', type: 'posture', when: { phase: 'klin', delay: 240 }, side: 1, posture: 'free' },
    { id: 'klinGuns', type: 'barrage', when: { phase: 'klin', delay: 200 }, side: 1, x: 18500, spread: 600, rounds: 8, duration: 18, weapon: 'artilleryShell', warning: 'Artillery on our line!' },
    // The division's guns prepare the assault on Klin one shell at a time: the houses at the edge of town, then the
    // church and the station (DECISIONS 431).
    { id: 'klinEdgeShelled', type: 'barrage', when: { phase: 'klin', delay: 40 }, side: 0, x: 21000, spread: 300, rounds: 10, duration: 25, weapon: 'artilleryShell', warning: 'Our guns are shelling the edge of Klin.' },
    { id: 'klinCentreShelled', type: 'barrage', when: { phase: 'klin', delay: 180 }, side: 0, x: 23300, spread: 400, rounds: 10, duration: 25, weapon: 'artilleryShell', warning: 'Our guns are shelling the church and the station.' },
    // The army's Guards mortar battalion ripples a Katyusha salvo onto the last German strongpoint around their HQ, twice
    // (DECISIONS 431): Klin is not left to the player's own call-ins.
    { id: 'klinRockets1', type: 'barrage', when: { phase: 'klin', delay: 300 }, side: 0, x: 25200, spread: 450, rounds: 12, duration: 10, weapon: 'katyushaRocket', warning: 'Katyushas on the centre of Klin!' },
    { id: 'klinRockets2', type: 'barrage', when: { phase: 'klin', delay: 540 }, side: 0, x: 25000, spread: 500, rounds: 12, duration: 10, weapon: 'katyushaRocket', warning: 'Katyushas on the centre of Klin!' },
    { id: 'klinRockets3', type: 'barrage', when: { phase: 'klin', delay: 780 }, side: 0, x: 25100, spread: 500, rounds: 12, duration: 10, weapon: 'katyushaRocket', warning: 'Katyushas on the centre of Klin!' },
    { id: 'lastCounter', type: 'posture', when: { hqHpBelow: 0.5, side: 1 }, side: 1, posture: 'counterattack', seconds: 90 },
    // Phase 1, "Night approach" (V1).
    { type: 'announce', when: { at: 1 }, text: 'Night approach: the ski battalions are moving off into the forest.' },
    {
      type: 'hint',
      when: { at: 5 },
      text: 'The ski troops are fast. Send them with the riflemen at the first village; the mortars stay behind and shell it.',
    },
    {
      type: 'hint',
      when: { at: 60 },
      about: 'conscript',
      text: 'New: Militia Squad. One order brings a whole squad, cheap and many. They will not win a firefight alone, but they soak up the machine guns.',
    },
    {
      type: 'hint',
      when: { at: 30 },
      about: 'medic',
      text: 'New: Sanitarka. She patches up the wounded near her but carries no weapon. Keep her just behind the attack.',
    },
    { type: 'announce', when: { pointCapturedBy: 0, point: { point: 'P1' } }, text: 'The first village is ours. The men crowd into the izbas to get warm.' },
    // Phase 2, "Through the forest".
    {
      type: 'wave',
      when: { pointCapturedBy: 0, point: { point: 'P1' }, delay: 8 },
      side: 0,
      forces: [
        // The brief's loan of phase 2. The rifle companies that came up with them stood in for forward deploy.
        { kind: 'at', count: 3, at: { point: 'P1' } },
      ],
      announce: 'PTRD teams have come up to the village.',
    },
    {
      type: 'hint',
      when: { pointCapturedBy: 0, point: { point: 'P1' }, delay: 12 },
      text: 'Deploy at the village: your new troops start there. Smoke before the forest trench saves lives.',
    },
    {
      type: 'wave',
      when: { pointCapturedBy: 0, point: { point: 'P1' }, delay: 120 },
      side: 1,
      forces: [
        { kind: 'rifle', count: 6, x: 10600, behaviour: 'assault' },
        { kind: 'lightTank', count: 1, x: 10800, behaviour: 'assault' },
      ],
      announce: 'Counter-attack from the forest!',
    },
    {
      type: 'wave',
      when: { pointCapturedBy: 0, point: { point: 'P1' }, delay: 25 },
      side: 1,
      forces: [
        { kind: 'rifle', count: 5, x: 12400 },
        { kind: 'lmg', count: 1, x: 12500 },
      ],
      announce: 'German reserves are hurrying into the forest trench.',
    },
    // Phase 3, "Cut the highway".
    { type: 'announce', when: { pointCapturedBy: 0, point: { point: 'P2' } }, text: 'Through the forest. The highway lies ahead.' },
    {
      type: 'hint',
      when: { pointCapturedBy: 0, point: { point: 'P2' }, delay: 15 },
      text: 'The weather is clearing. The Il-2s can fly: use them on the column on the highway and on their tanks.',
    },
    {
      type: 'wave',
      when: { pointCapturedBy: 0, point: { point: 'P2' }, delay: 60 },
      side: 1,
      forces: [
        { kind: 'apc', count: 2, x: 18600, behaviour: 'assault' },
        { kind: 'rifle', count: 8, x: 18400, behaviour: 'assault' },
        { kind: 'tank', count: 1, x: 18800, behaviour: 'assault' },
      ],
      announce: 'A German column is on the highway!',
    },
    {
      // The road is the Third Panzer Group's only way west: a second column tries to force it during the hold
      // (DECISIONS 431).
      type: 'wave',
      when: { pointCapturedBy: 0, point: { point: 'P3' }, delay: 110 },
      side: 1,
      forces: [
        { kind: 'apc', count: 1, x: 19400, behaviour: 'assault' },
        { kind: 'rifle', count: 5, x: 19200, behaviour: 'assault' },
      ],
      announce: 'Another German column is trying to force the road west!',
    },
    {
      type: 'wave',
      when: { pointCapturedBy: 0, point: { point: 'P3' }, delay: 230 },
      side: 1,
      forces: [
        { kind: 'rifle', count: 4, x: 19300, behaviour: 'assault' },
        { kind: 'at', count: 1, x: 19400, behaviour: 'assault' },
      ],
      announce: 'A rear guard is coming out of Klin to reopen the road!',
    },
    // Phase 4, "Klin".
    {
      type: 'wave',
      when: { phase: 'klin', delay: 30 },
      side: 0,
      forces: [
        // The 8th Tank Brigade of the 30th Army, with tank riders (DECISIONS 431).
        { kind: 'tank', count: 2, at: { point: 'P3' } },
        { kind: 'assault', count: 6, at: { point: 'P3' } },
      ],
      announce: 'The 8th Tank Brigade has come up the highway with tank riders.',
    },
    { type: 'announce', when: { pointCapturedBy: 0, point: { point: 'P3' } }, text: 'The highway is cut. Their only road home is closed.' },
    {
      type: 'hint',
      when: { pointCapturedBy: 0, point: { point: 'P3' }, delay: 15 },
      text: 'Klin, house by house: mortars and Katyusha on each strongpoint, then the assault troops. Their tanks in the town are frozen; the Il-2s will find them.',
    },
    {
      type: 'wave',
      when: { pointCapturedBy: 0, point: { point: 'P3' }, delay: 25 },
      side: 1,
      forces: [
        { kind: 'rifle', count: 6, x: 22200 },
        { kind: 'lmg', count: 1, x: 22300 },
      ],
      announce: 'The Klin garrison is manning the houses at the edge of town.',
    },
    {
      type: 'wave',
      when: { pointCapturedBy: 0, point: { building: 3 }, delay: 20 },
      side: 1,
      forces: [
        { kind: 'rifle', count: 6, behaviour: 'assault' },
        { kind: 'at', count: 1, behaviour: 'assault' },
      ],
      announce: 'Rear-guard troops are counter-attacking from the station.',
    },
    {
      type: 'wave',
      when: { hqHpBelow: 0.5, side: 1 },
      side: 1,
      forces: [
        { kind: 'rifle', count: 8, behaviour: 'assault' },
        { kind: 'lmg', count: 2, behaviour: 'assault' },
      ],
      announce: 'Every German in Klin is counter-attacking!',
    },
    {
      // Klin was taken by the 371st and the 365th Rifle Divisions together: the 365th comes in from the north as the
      // garrison makes its last stand (DECISIONS 431).
      type: 'wave',
      when: { hqHpBelow: 0.5, side: 1 },
      side: 0,
      forces: [
        { kind: 'rifle', count: 8, at: { point: 'P3' } },
        { kind: 'lmg', count: 2, at: { point: 'P3' } },
      ],
      announce: 'The 365th Rifle Division is coming into Klin from the north!',
    },
    {
      type: 'hint',
      when: { hqHpBelow: 0.5, side: 0 },
      text: 'The HQ is under fire. Fall Back lets its machine gun do the work while you rebuild.',
    },
  ],
  ai: {
    sappers: 3,
    build: [
      { kind: 'rifle', count: 8, after: 0 },
      { kind: 'lmg', count: 2, after: 40 },
      { kind: 'rifle', count: 14, after: 150 },
      { kind: 'mortar', count: 1, after: 240 },
      { kind: 'lmg', count: 3, after: 300 },
      { kind: 'at', count: 2, after: 400 },
      { kind: 'rifle', count: 14, after: 500 },
      { kind: 'tank', count: 1, after: 900 },
    ],
    firstAttackAfter: 900,
  },
  bot: {
    sappers: 6,
    build: [
      { kind: 'rifle', count: 8, after: 0 },
      { kind: 'mortar', count: 2, after: 0 },
      { kind: 'assault', count: 6, after: 20 },
      { kind: 'at', count: 3, after: 60 },
      { kind: 'lmg', count: 2, after: 90 },
      { kind: 'medic', count: 1, after: 120 },
      { kind: 'rifle', count: 12, after: 180 },
      { kind: 'at', count: 5, after: 300 },
      { kind: 'tank', count: 2, after: 400 },
    ],
    firstAttackAfter: 30,
  },
  // About 5 minutes to the highway, its 5-minute hold, then Klin: the bot wins in about 16 minutes with unlimited calls and
  // about 21 with none (DECISIONS 431).
  expectedMinutes: [15, 24],
  music: STALINGRAD_MUSIC.missions[1004],
};
