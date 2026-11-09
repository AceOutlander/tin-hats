import type { MissionDef } from '../../schema';

/**
 * Stalingrad 3: the Volokolamsk Highway, 16 November 1941 (docs/campaigns/STALINGRAD.md, mission 3). The 1075th Rifle
 * Regiment of Panfilov's 316th Division holds the railway halt at Dubosekovo against the 2nd Panzer Division, with a
 * few of the first PTRD anti-tank rifles, until Katukov's tanks come up; then it throws the Germans back past the
 * wood's edge. The mission depicts the real battle, not the "28 Panfilov men" legend, and names no individuals.
 *
 * Built with today's engine (docs/campaigns/STALINGRAD_BUILD.md, mission 1003): two 360 s holds and the counter-attack
 * are one timeline (the bot holds until Katukov's tanks arrive at 720 s); the win is the German HQ beyond the wood, as
 * no capture point can end a phase yet. A 60 s prep phase comes first (the bot wires the halt); the tank traps, snow, the
 * opening barrage, the Pak 38 and mortar posture and the "lose if the halt falls" rule wait for their features.
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
  // Today's win rule: the German HQ beyond the wood (the wood's-edge capture point waits for the director).
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
  mode: 'assault',
  length: 16000,
  // The unlock order (DECISIONS 295): the PPD submachine gunners. The anti-tank kind came with Brest (the Tank Hunters);
  // it is the PTRD Team from November 1941 (src/data/eras.ts). The sniper and the sanitarka are lent.
  newUnit: 'assault',
  newSupport: 'katyusha',
  units: [
    ['sapper', 'rifle', 'lmg', 'assault', 'mortar', 'at'],
    ['sapper', 'rifle', 'lmg', 'assault', 'mortar', 'at', 'tank'],
  ],
  supports: [
    ['artillery', 'smoke', 'katyusha'],
    ['artillery', 'airStrike'],
  ],
  start: [
    {
      faction: 'soviet',
      hasHq: true,
      supplies: 350,
      hqHpMul: 1,
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
  pillboxes: [],
  // The prep phase's wire in front of the halt, laid before the battle until the prep phase exists.
  wire: [],
  // A minute to wire the halt before the first attack (the bot builds what used to be laid before the battle).
  prep: { seconds: 60, bot: [{ kind: 'wire', x: 5900 }] },
  timer: null,
  events: [
    // Phase 1, "The morning attack" (0 to 360 s).
    { type: 'announce', when: { at: 1 }, text: 'The morning attack: the ground is frozen and the panzers are moving.' },
    {
      type: 'hint',
      when: { at: 4 },
      text: 'Your anti-tank men carry the PTRD now. The long rifle holes a Panzer at close range: keep them in the trenches and let the tanks come near.',
    },
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
      when: { at: 362 },
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
      when: { at: 720 },
      side: 0,
      forces: [
        { kind: 'tank', count: 3, x: 2500 },
        { kind: 'heavyTank', count: 1, x: 2300 },
      ],
      announce: 'Tanks of the 1st Guards Tank Brigade are up from the rear.',
    },
    {
      type: 'hint',
      when: { at: 724 },
      text: 'Advance behind the tanks with the PTRD Teams and take the wood\'s edge, then go on to their headquarters.',
    },
    { type: 'announce', when: { trenchCapturedBy: 0, trenchId: 3 }, text: 'The wood\'s edge is ours again.' },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 3, delay: 90 },
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
