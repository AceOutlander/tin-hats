import type { MissionDef } from '../../schema';

/**
 * Stalingrad 3: the Volokolamsk Highway, 16 November 1941 (docs/campaigns/STALINGRAD.md, mission 3). The 1075th Rifle
 * Regiment of Panfilov's 316th Division holds the railway halt at Dubosekovo against the 2nd Panzer Division, with a
 * few of the first PTRD anti-tank rifles, until Katukov's tanks come up; then it throws the Germans back past the
 * wood's edge. The mission depicts the real battle, not the "28 Panfilov men" legend, and names no individuals.
 *
 * Built on the mission director (docs/campaigns/STALINGRAD_BUILD.md, mission 1003): a hold. A 60 s prep phase comes
 * first: wire, foxholes, a trench, road blocks and the steel tank traps of the Moscow defences (FOUNDATIONS.md 4.8;
 * the bot puts the traps across the road at x 6,000 and wire at 5,900); phases 1 and 2 hold the halt (P1, held through trench 2) for 360 s each and are lost
 * if it falls; the German barrage on the halt, the Stuka and the Pak 38 and mortar posture are scripted; the Katyusha
 * is offered from phase 2; phase 3 brings Katukov's tanks and takes the wood's edge (P2, through trench 3, a forward
 * spawn once ours), where the Germans counter-attack 90 s after it falls; it is held for 150 s. The ground is snow, the
 * birch wood forest. The halt hut (B1) and two izbas of the hamlet are buildings (FOUNDATIONS.md 4.3) and the HQ is a
 * log dugout (`hqLook`).
 */
export const M1003: MissionDef = {
  id: 1003,
  key: 'volokolamsk',
  title: 'The Volokolamsk Highway',
  location: 'Dubosekovo, near Volokolamsk',
  date: '16 November 1941',
  dateIso: '1941-11-16',
  climate: 'winter',
  mapPos: { lon: 36.07, lat: 55.98 },
  briefing: [
    'The snow came early this year and the mud with it, and for a month the Germans sat in it. Now the ground has frozen hard and the panzers can roll again. Behind us is the highway, and at the end of the highway is Moscow.',
    'Most of you came from Alma-Ata and Frunze, from the steppe and the mountains, and you have held them for a month already. This week the division gave us something new: a few long anti-tank rifles that can hole a Panzer\'s side at close range. There are not many, so fire them from the trenches and let the tanks come near.',
    'Dig in at the railway halt, wire the approaches and set the steel obstacles across the road. Hold until our tanks come up from the rear, then throw the Germans back to the edge of the wood.',
  ],
  // The win: the last phase takes the wood's edge (capture point P2) and holds it.
  objective: 'Hold the railway halt, then retake the wood\'s edge and destroy the German HQ.',
  intel: {
    enemy: [
      '2nd Panzer Division, out of the birch wood',
      'About 13 tanks: Panzer IV, Panzer III and a StuG III',
      'About 50 riflemen and MP40 troopers, MG34 teams, mortars',
      'Stukas while the weather holds; artillery',
    ],
    friendly: [
      '316th Rifle Division: 10 riflemen, 2 DP gunners, a sniper',
      '5 PTRD teams with the new anti-tank rifles, 2 mortar crews',
      'Katukov\'s tanks later: 3 T-34s and a KV-1',
      'Artillery, smoke and the first Katyusha salvoes',
    ],
  },
  // Stand-ins until the russiaSummer winter variant exists (STALINGRAD_BUILD.md).
  theatre: 'germany',
  timeOfDay: 'overcast',
  mode: 'hold',
  length: 16000,
  // The unlock order (DECISIONS 295): the PPD submachine gunners. The anti-tank kind came with Brest (the Tank Hunters);
  // it is the PTRD Team from November 1941 (src/data/eras.ts). The sniper and the sanitarka are lent.
  newUnit: 'assault',
  newSupport: 'katyusha',
  units: [
    ['sapper', 'rifle', 'lmg', 'assault', 'mortar', 'at', 'tank'],
    ['sapper', 'rifle', 'lmg', 'assault', 'mortar', 'at', 'tank'],
  ],
  supports: [
    ['artillery', 'smoke', 'katyusha'],
    ['artillery', 'airStrike'],
  ],
  start: [
    {
      faction: 'soviet',
      // The rocket battery comes up behind the halt in phase 2.
      supportsOff: ['katyusha'],
      hasHq: true,
      supplies: 350,
      hqHpMul: 1,
      hqLook: 'logDugout',
      incomeMul: 1,
      sappers: 3,
      forces: [
        { kind: 'rifle', count: 10, trenchId: 1 },
        { kind: 'lmg', count: 2, trenchId: 2 },
        { kind: 'at', count: 1, trenchId: 2 },
        { kind: 'sniper', count: 1, trenchId: 2 },
        // Four more PTRD teams, two mortar crews and a sanitarka (lent: the sanitarka is unlocked at Klin).
        { kind: 'at', count: 4, trenchId: 2 },
        { kind: 'mortar', count: 2 },
        { kind: 'medic', count: 1 },
      ],
    },
    {
      faction: 'german',
      hasHq: true,
      supplies: 200,
      hqHpMul: 1,
      incomeMul: 0.6,
      sappers: 2,
      forces: [
        // T3 at the birch wood's edge.
        { kind: 'rifle', count: 6, trenchId: 3 },
        { kind: 'lmg', count: 2, trenchId: 3 },
      ],
    },
  ],
  trenches: [
    { id: 1, x: 4200, width: 190, slots: 8, owner: 0 },
    // T2 at the halt (P1 "the halt").
    { id: 2, x: 5600, width: 230, slots: 10, owner: 0 },
    // T3 at the wood's edge (P2).
    { id: 3, x: 9800, width: 180, slots: 7, owner: 1 },
  ],
  // The halt hut behind T2, and two izbas of the hamlet behind the battalion (FOUNDATIONS.md 4.3).
  buildings: [
    { id: 1, x: 5150, width: 120, floors: 1, slotsPerFloor: 4, hpMul: 0.7, owner: 0, look: 'station' },
    { id: 2, x: 1500, width: 120, floors: 1, slotsPerFloor: 3, hpMul: 0.6, owner: 0, look: 'izba' },
    { id: 3, x: 2250, width: 120, floors: 1, slotsPerFloor: 3, hpMul: 0.6, owner: 0, look: 'izba' },
  ],
  pillboxes: [],
  // The prep phase's wire in front of the halt, laid before the battle until the prep phase exists.
  wire: [],
  // The brief's sectors (FOUNDATIONS.md 4.1): snow everywhere, the birch wood's trunks for cover; the halt and the
  // wood's edge are capture points held through their trenches (4.5), the wood's edge a spawn point once it is ours.
  sectors: [
    { from: 0, to: 3000, ground: 'snow', label: "The battalion's rear" },
    { from: 3000, to: 6500, ground: 'snow', label: 'Dubosekovo halt' },
    { from: 6500, to: 9500, ground: 'snow', label: 'Frozen fields' },
    { from: 9500, to: 12000, ground: 'forest', label: 'Birch wood' },
    { from: 12000, to: 16000, ground: 'snow', label: 'German start' },
  ],
  capturePoints: [
    { id: 'P1', x: 5600, width: 300, label: 'The halt', owner: 0, captureTime: 0, spawn: false, contestRadius: 600, structure: { trench: 2 } },
    { id: 'P2', x: 9800, width: 300, label: "Wood's edge", owner: 1, captureTime: 0, spawn: true, contestRadius: 600, structure: { trench: 3 } },
  ],
  // A minute to wire the halt before the first attack (the bot builds what used to be laid before the battle).
  // The brief's prep (STALINGRAD.md, mission 3): wire, foxholes, tank traps, a trench; zone 3,000 to 6,400.
  prep: {
    seconds: 60,
    buildables: ['wire', 'foxhole', 'tankTrap', 'roadBlock', 'trench'],
    zone: { from: 3000, to: 6400 },
    bot: [
      { kind: 'tankTrap', x: 6010 },
      { kind: 'wire', x: 5900 },
    ],
  },
  timer: null,
  // The mission director (FOUNDATIONS.md 3): two holds of the halt, then the counter-attack to the wood's edge.
  phases: [
    {
      id: 'morning',
      title: 'The morning attack',
      objectives: [{ id: 'morning', type: 'survive', seconds: 360, text: 'Hold the halt' }],
      lose: [{ type: 'pointLost', point: { point: 'P1' } }],
      sideObjectives: [
        {
          id: 'noTank',
          text: 'No tank reaches the halt',
          failIf: { type: 'enemyReached', x: 5200, count: 1, kinds: ['lightTank', 'tank', 'heavyTank'] },
          until: 'katukov',
          bonus: 0.15,
        },
        { id: 'ten', text: 'Ten tanks', objective: { id: 'tenTanks', type: 'kill', side: 1, kinds: ['lightTank', 'tank', 'heavyTank'], count: 10 }, bonus: 0.1 },
      ],
      next: 'again',
    },
    {
      id: 'again',
      title: 'They come again',
      objectives: [{ id: 'again', type: 'survive', seconds: 360, text: 'Hold the halt' }],
      lose: [{ type: 'pointLost', point: { point: 'P1' } }],
      next: 'katukov',
    },
    {
      id: 'katukov',
      title: "Katukov's tanks",
      // Take the wood's edge, then hold it through the counter-attack that comes 90 s after it falls.
      objectives: [
        { id: 'woodEdge', type: 'capture', point: { point: 'P2' }, text: "Take the wood's edge" },
        { id: 'woodHeld', type: 'hold', point: { point: 'P2' }, seconds: 150, text: 'Hold the edge' },
      ],
      next: null,
    },
  ],
  events: [
    // The director's events: the barrage on the halt, the Stuka, the rocket battery, the German posture.
    { id: 'openingBarrage', type: 'barrage', when: { phase: 'morning' }, side: 1, x: 5600, spread: 400, rounds: 5, duration: 5, weapon: 'artilleryShell', warning: 'Artillery on the halt!' },
    // The Stuka goes for the rear trench and the road behind the halt (on the halt itself it broke the hold, DECISIONS 318).
    { id: 'stuka', type: 'airRaid', when: { phase: 'morning', delay: 60 }, side: 1, support: 'airStrike', x: 4200 },
    { id: 'katyusha', type: 'support', when: { phase: 'again' }, side: 0, kind: 'katyusha', enabled: true },
    { id: 'pakHold', type: 'posture', when: { phase: 'again', delay: 160 }, side: 1, posture: 'hold' },
    { id: 'katukovFree', type: 'posture', when: { phase: 'katukov' }, side: 1, posture: 'free' },
    { id: 'woodCounter', type: 'posture', when: { pointCapturedBy: 0, point: { point: 'P2' }, delay: 90 }, side: 1, posture: 'counterattack', point: { point: 'P2' }, seconds: 120 },
    // Phase 1, "The morning attack" (0 to 360 s).
    { type: 'announce', when: { at: 1 }, text: 'The morning attack: the ground is frozen and the panzers are moving.' },
    {
      type: 'hint',
      when: { at: 4 },
      text: 'Your anti-tank men carry the PTRD now. The long rifle holes a Panzer at close range: keep them in the trenches and let the tanks come near.',
    },
    { type: 'hint', when: { at: 9 }, text: 'PTRD teams kill tanks from the side. Tank traps stop vehicles until they work them loose or blow them.' },
    {
      type: 'hint',
      when: { at: 14 },
      about: 'assault',
      text: 'New: PPD Trooper. Fast, with a sub-machine gun and grenades: he clears a trench at close quarters. Keep him back until the counter-attack.',
    },
    {
      type: 'wave',
      when: { at: 30 },
      side: 1,
      forces: [
        // A Panzer III with the 5 cm gun (the `panzer3h` look) and an Ausf. E.
        { kind: 'tank', count: 1, x: 10800, behaviour: 'assault', look: 'panzer3h' },
        { kind: 'lightTank', count: 1, x: 10900, behaviour: 'assault' },
        { kind: 'rifle', count: 8, x: 10600, behaviour: 'assault' },
      ],
      announce: 'Panzers are coming out of the wood!',
    },
    {
      type: 'hint',
      when: { at: 70 },
      text: 'Hold. Your riflemen fight from the trenches; the wire in front of the halt holds their infantry while the guns work.',
    },
    {
      type: 'hint',
      when: { at: 110 },
      text: 'The sniper picks off machine-gun teams from far back. Keep him in the rear trench.',
    },
    {
      type: 'wave',
      when: { at: 150 },
      side: 1,
      forces: [
        { kind: 'tank', count: 1, x: 10800, behaviour: 'assault', look: 'stug3b' },
        { kind: 'assault', count: 6, x: 10600, behaviour: 'assault' },
      ],
      announce: 'Assault guns with sub-machine gunners.',
    },
    {
      type: 'wave',
      when: { at: 250 },
      side: 1,
      forces: [
        { kind: 'tank', count: 2, x: 10800, behaviour: 'assault' },
        { kind: 'lmg', count: 2, x: 10700, behaviour: 'assault' },
        { kind: 'rifle', count: 6, x: 10600, behaviour: 'assault' },
      ],
      announce: 'Another attack is forming up at the wood.',
    },
    // Phase 2, "They come again" (360 to 720 s).
    { type: 'announce', when: { at: 360 }, text: 'They come again. The rocket battery has come up behind the halt.' },
    {
      type: 'hint',
      when: { phase: 'again', delay: 2 },
      about: 'katyusha',
      text: 'The Katyusha rocket battery: a salvo over a wide area, slow to reload. Save it for the infantry massed behind the tanks.',
    },
    {
      type: 'wave',
      when: { at: 400 },
      side: 1,
      forces: [
        { kind: 'tank', count: 2, x: 10800, behaviour: 'assault', look: 'panzer3h' },
        { kind: 'lightTank', count: 1, x: 10900, behaviour: 'assault' },
        { kind: 'rifle', count: 6, x: 10600, behaviour: 'assault' },
        { kind: 'assault', count: 4, x: 10500, behaviour: 'assault' },
      ],
      announce: 'A whole panzer battalion is on the move.',
    },
    {
      type: 'wave',
      when: { at: 520 },
      side: 1,
      forces: [
        { kind: 'at', count: 2, x: 8000, behaviour: 'guard' },
        { kind: 'mortar', count: 2, x: 8100, behaviour: 'guard' },
      ],
      announce: 'Pak guns and mortars are setting up in the fields to shell the halt.',
    },
    {
      type: 'wave',
      when: { at: 620 },
      side: 1,
      forces: [
        { kind: 'tank', count: 3, x: 10800, behaviour: 'assault' },
        { kind: 'rifle', count: 8, x: 10600, behaviour: 'assault' },
        { kind: 'assault', count: 4, x: 10500, behaviour: 'assault' },
      ],
      announce: 'The last big push of the day.',
    },
    // Phase 3, "Katukov's tanks".
    {
      type: 'wave',
      when: { phase: 'katukov' },
      side: 0,
      forces: [
        { kind: 'tank', count: 3, x: 2500 },
        { kind: 'heavyTank', count: 1, x: 2300 },
      ],
      announce: 'Tanks of the 1st Guards Tank Brigade are up from the rear.',
    },
    {
      type: 'hint',
      when: { phase: 'katukov', delay: 4 },
      text: 'Advance behind the tanks with the PTRD Teams and take the wood\'s edge, then hold it: they will counter-attack.',
    },
    { type: 'announce', when: { pointCapturedBy: 0, point: { point: 'P2' } }, text: 'The wood\'s edge is ours again.' },
    {
      type: 'wave',
      when: { pointCapturedBy: 0, point: { point: 'P2' }, delay: 90 },
      side: 1,
      forces: [
        { kind: 'tank', count: 2, x: 13500, behaviour: 'assault' },
        { kind: 'rifle', count: 6, x: 13300, behaviour: 'assault' },
      ],
      announce: 'They are counter-attacking the wood\'s edge.',
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
      { kind: 'mortar', count: 1, after: 150 },
      { kind: 'rifle', count: 10, after: 300 },
      { kind: 'tank', count: 1, after: 720 },
      { kind: 'at', count: 2, after: 500 },
    ],
    firstAttackAfter: 900,
  },
  bot: {
    sappers: 5,
    build: [
      { kind: 'rifle', count: 6, after: 0 },
      { kind: 'at', count: 4, after: 10 },
      { kind: 'rifle', count: 10, after: 60 },
      { kind: 'at', count: 7, after: 120 },
      { kind: 'mortar', count: 2, after: 200 },
      { kind: 'lmg', count: 3, after: 260 },
      { kind: 'at', count: 9, after: 380 },
      { kind: 'assault', count: 4, after: 600 },
    ],
    firstAttackAfter: 720,
  },
  expectedMinutes: [16, 23],
  music: 'hill112',
};
