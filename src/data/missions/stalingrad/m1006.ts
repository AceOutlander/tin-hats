import { STALINGRAD_MUSIC } from '../../musicCampaigns';
import type { MissionDef } from '../../schema';

/**
 * Stalingrad mission 6 (1006): Mamayev Kurgan, 19 September 1942 (docs/campaigns/STALINGRAD.md, mission 6).
 * The 95th Rifle Division crossed the night before and goes straight up Height 102.0: the railway cutting at the foot
 * (trench 2), two shell-hole positions on the eastern slope (trenches 3 and 4) behind wire, and on the summit the two
 * water tanks the Germans turned into blockhouses (pillboxes 1 and 2) with a trench between them (trench 5). When the
 * summit falls the 295th Infantry Division comes back at it four times; then the western slope and the German HQ.
 *
 * Built with today's schema (docs/campaigns/STALINGRAD_BUILD.md, mission 1006): the phases are trench captures, the
 * hold on the summit is the counter-attack waves that follow its capture, the water tanks are pillboxes, the loans
 * are scripted waves, and StuG III Ausf. F and Panzer III J are the `tank` kind (drawn as the era's Panzer III Ausf. L and,
 * by look, the StuG III Ausf. F; the `lightTank` kind is the 1939 to 1941 Panzer III Ausf. E).
 */
export const M1006: MissionDef = {
  id: 1006,
  key: 'kurgan',
  title: 'Mamayev Kurgan',
  location: 'Height 102.0, Stalingrad',
  date: '19 September 1942',
  dateIso: '1942-09-19',
  climate: 'city',
  mapPos: { lon: 44.5369, lat: 48.7425 },
  briefing: [
    'From the top of Height 102 you can see the whole city, the river and every boat that crosses it. While the Germans sit up there, nothing moves on the Volga by day. We crossed last night and we go straight up, before they understand that a whole division has come over.',
    'The slope is bare and churned with shell holes, and the railway curls round its foot. Use the holes as trenches. On the crest stand two water tanks the Germans have turned into blockhouses; grenades and the flamethrowers will open them. Their mortars sit behind the crest, so let ours and the sniper answer them before we climb.',
    'Once the crest is ours, dig in at once. They will come back at us with everything, assault guns first, and the guns on the far bank will help only if we are still on top to tell them where. Hold the summit, then follow them down the western slope to their headquarters.',
  ],
  objective: 'Take the summit of Mamayev Kurgan, hold it, and destroy the German HQ.',
  intel: {
    enemy: [
      '295th Infantry Division on the slopes and the summit',
      'About 75 riflemen and MP40 troopers, MG teams, 2 snipers',
      'Two water tanks as blockhouses; mortars behind the crest',
      '3 Panzer III and 2 StuG III; Stukas every few minutes',
    ],
    friendly: [
      '95th Rifle Division: 12 riflemen, 4 PPSh troopers, 2 DPs',
      'A sniper and 2 mortar crews; flamethrowers come up later',
      'PTRD teams for the counter-attack on the summit',
      'Artillery and Katyusha from the far bank, and smoke',
    ],
  },
  theatre: 'italy',
  timeOfDay: 'overcast',
  mode: 'assault',
  length: 14000,
  // The unlock order (DECISIONS 295): the sniper, for the duels on the hill (the city's sniper movement of autumn
  // 1942), and the AA gun crews under the Stukas that came over every few minutes.
  newUnit: 'sniper',
  unlocks: ['aa'],
  newSupport: null,
  units: [
    ['sapper', 'rifle', 'lmg', 'assault', 'mortar', 'sniper', 'medic', 'at', 'tank', 'flame', 'aa', 'conscript'],
    ['sapper', 'rifle', 'lmg', 'assault', 'mortar', 'sniper', 'medic', 'flame', 'tank'],
  ],
  supports: [
    ['artillery', 'smoke', 'katyusha'],
    ['artillery', 'airStrike'],
  ],
  start: [
    {
      faction: 'soviet',
      hasHq: true,
      supplies: 450,
      hqHpMul: 1,
      incomeMul: 1.2,
      sappers: 3,
      forces: [
        // The 13th Guards' positions in the ravine by the river, where the 95th came ashore.
        { kind: 'rifle', count: 6, trenchId: 1 },
        { kind: 'lmg', count: 2, trenchId: 1 },
        { kind: 'rifle', count: 6 },
        { kind: 'assault', count: 4 },
        { kind: 'sniper', count: 1 },
        // Loan from the start: two mortar teams.
        { kind: 'mortar', count: 2 },
      ],
    },
    {
      faction: 'german',
      hasHq: true,
      supplies: 200,
      hqHpMul: 1.6,
      incomeMul: 0.6,
      sappers: 3,
      forces: [
        // The railway cutting at the foot of the hill.
        { kind: 'rifle', count: 6, trenchId: 2 },
        { kind: 'lmg', count: 1, trenchId: 2 },
        // Shell-hole positions on the eastern slope.
        { kind: 'rifle', count: 3, trenchId: 3, behaviour: 'garrison' },
        { kind: 'lmg', count: 1, trenchId: 3, behaviour: 'garrison' },
        { kind: 'rifle', count: 3, trenchId: 4, behaviour: 'garrison' },
        { kind: 'lmg', count: 1, trenchId: 4, behaviour: 'garrison' },
        // The summit between the two water tanks.
        { kind: 'rifle', count: 6, trenchId: 5, behaviour: 'garrison' },
        { kind: 'lmg', count: 1, trenchId: 5, behaviour: 'garrison' },
        { kind: 'sniper', count: 2, x: 11300, behaviour: 'guard' },
        { kind: 'mortar', count: 2, x: 11700, behaviour: 'guard' },
      ],
    },
  ],
  trenches: [
    { id: 1, x: 2200, width: 170, slots: 8, owner: 0 },
    { id: 2, x: 4200, width: 200, slots: 8, owner: 1 },
    { id: 3, x: 6300, width: 120, slots: 4, owner: 1 },
    { id: 4, x: 7800, width: 120, slots: 4, owner: 1 },
    { id: 5, x: 10500, width: 180, slots: 8, owner: 1 },
  ],
  pillboxes: [
    // The two water tanks on the crest, held as blockhouses.
    { id: 1, x: 10100, side: 1, hpMul: 1.6 },
    { id: 2, x: 10900, side: 1, hpMul: 1.6 },
  ],
  wire: [{ id: 1, x: 8600, width: 140, owner: 1 }],
  timer: null,
  events: [
    {
      type: 'hint',
      when: { at: 3 },
      text: 'The foot of the hill first: riflemen and PPSh Troopers take the railway cutting behind an Artillery Barrage.',
    },
    {
      type: 'hint',
      when: { at: 14 },
      about: 'sniper',
      text: 'New: Sniper. Very long range and one shot kills, but he is fragile. Keep him back and let him pick off gunners and mortar crews.',
    },
    {
      type: 'hint',
      when: { at: 40 },
      about: 'aa',
      text: 'New: AA Gun Crew. A quick-firing gun that shoots down or drives off the Stukas. Set it up behind your line before they come over.',
    },
    { type: 'announce', when: { at: 120 }, text: 'Stukas over the hill. They will be back every few minutes.' },
    // The 295th Infantry Division feeds the hill from the west all day.
    {
      type: 'wave',
      when: { every: 150, from: 240, until: 1500 },
      side: 1,
      forces: [
        { kind: 'rifle', count: 3 },
        { kind: 'assault', count: 1 },
      ],
    },
    { type: 'announce', when: { trenchCapturedBy: 0, trenchId: 2 }, text: 'The railway cutting is ours. Now the slope.' },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 2, delay: 10 },
      side: 0,
      forces: [
        { kind: 'rifle', count: 4, x: 4000 },
        { kind: 'assault', count: 2, x: 3900 },
      ],
      announce: 'The 161st Regiment is coming up the ravine.',
    },
    // The rest of the 95th Rifle Division, ferried over under smoke a company at a time.
    {
      type: 'wave',
      when: { every: 180, from: 480, until: 1500 },
      side: 0,
      forces: [
        { kind: 'rifle', count: 3 },
        { kind: 'at', count: 1 },
      ],
      announce: 'Another company has crossed the Volga.',
    },
    {
      type: 'hint',
      when: { trenchCapturedBy: 0, trenchId: 2, delay: 4 },
      text: 'Their mortars sit behind the crest. Let your Mortar Crews and the Sniper duel them, smoke the slope, then climb.',
    },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 2, delay: 150 },
      side: 1,
      forces: [{ kind: 'rifle', count: 8, behaviour: 'assault' }],
      announce: 'German counter-attack down the slope!',
    },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 4, delay: 5 },
      side: 0,
      forces: [
        { kind: 'flame', count: 2, x: 7600 },
        { kind: 'rifle', count: 4, x: 7500 },
      ],
      announce: 'Two ROKS flamethrowers are up for the water tanks.',
    },
    {
      type: 'hint',
      when: { trenchCapturedBy: 0, trenchId: 4, delay: 10 },
      text: 'Flamethrowers burn out the water tanks. Keep riflemen around them: a hit from behind sets the fuel alight.',
    },
    { type: 'announce', when: { trenchCapturedBy: 0, trenchId: 4, delay: 60 }, text: 'Rocket mortars on the slope!' },
    { type: 'announce', when: { trenchCapturedBy: 0, trenchId: 5 }, text: 'The summit is ours. Dig in!' },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 5, delay: 5 },
      side: 0,
      forces: [
        { kind: 'at', count: 3, x: 10300 },
        { kind: 'rifle', count: 4, x: 10200 },
        { kind: 'lmg', count: 2, x: 10100 },
      ],
      announce: 'Three PTRD teams have come up to the crest.',
    },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 5, delay: 20 },
      side: 1,
      forces: [
        { kind: 'tank', count: 2, behaviour: 'assault', look: 'stug3f' },
        { kind: 'rifle', count: 10, behaviour: 'assault' },
      ],
      announce: 'They are coming back!',
    },
    { type: 'announce', when: { trenchCapturedBy: 0, trenchId: 5, delay: 120 }, text: 'Stukas on the summit!' },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 5, delay: 180 },
      side: 1,
      forces: [
        { kind: 'flame', count: 2, behaviour: 'assault' },
        { kind: 'assault', count: 6, behaviour: 'assault' },
      ],
      announce: 'Pioneers with flamethrowers are climbing the western slope.',
    },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 5, delay: 280 },
      side: 1,
      forces: [
        { kind: 'tank', count: 3, behaviour: 'assault' },
        { kind: 'rifle', count: 10, behaviour: 'assault' },
      ],
      announce: 'The last attack: Panzer IIIs and an assault gun with the infantry.',
    },
    {
      type: 'hint',
      when: { trenchCapturedBy: 0, trenchId: 5, delay: 30 },
      text: 'Assault guns: PTRD Teams in the summit trench, and a Katyusha Salvo on each attack while it forms on the western slope.',
    },
    {
      type: 'announce',
      when: { trenchCapturedBy: 0, trenchId: 5, delay: 380 },
      text: 'The summit held. Follow them down the western slope.',
    },
    {
      type: 'hint',
      when: { hqHpBelow: 0.5, side: 0 },
      text: 'They are at the river. Fall Back lets the HQ machine gun fight while you rebuild.',
    },
  ],
  ai: {
    sappers: 3,
    // Counts include the garrisons placed at the start (18 riflemen, 4 machine guns, 2 mortars).
    build: [
      { kind: 'rifle', count: 20, after: 0 },
      { kind: 'lmg', count: 5, after: 60 },
      { kind: 'mortar', count: 3, after: 120 },
      { kind: 'assault', count: 4, after: 200 },
      { kind: 'tank', count: 1, after: 420 },
      { kind: 'rifle', count: 26, after: 500 },
      { kind: 'flame', count: 2, after: 600 },
      { kind: 'tank', count: 2, after: 900 },
    ],
    firstAttackAfter: 420,
  },
  bot: {
    sappers: 6,
    // Counts include the start forces (12 riflemen, 4 PPSh Troopers, 2 DP Gunners, 2 mortars, the sniper).
    build: [
      { kind: 'rifle', count: 14, after: 0 },
      { kind: 'assault', count: 6, after: 20 },
      { kind: 'conscript', count: 10, after: 60 },
      { kind: 'medic', count: 2, after: 90 },
      { kind: 'lmg', count: 3, after: 120 },
      { kind: 'at', count: 3, after: 180 },
      { kind: 'flame', count: 2, after: 240 },
      { kind: 'rifle', count: 18, after: 300 },
      { kind: 'conscript', count: 20, after: 360 },
      { kind: 'at', count: 6, after: 480 },
      { kind: 'mortar', count: 3, after: 540 },
    ],
    firstAttackAfter: 300,
  },
  expectedMinutes: [12, 24],
  music: STALINGRAD_MUSIC.missions[1006],
};
