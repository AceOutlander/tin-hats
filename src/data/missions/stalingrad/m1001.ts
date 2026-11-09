import type { MissionDef } from '../../schema';

/**
 * Stalingrad 1: Brest Fortress, 22 June 1941 (docs/campaigns/STALINGRAD.md, mission 1). Survival: hold the citadel
 * through the first day against the 45th Infantry Division's waves, which cross from the South Island on the right.
 *
 * Built with today's engine (docs/campaigns/STALINGRAD_BUILD.md, mission 1001): the ring barracks (B1), the garrison
 * club (B2) and the Kholm Gate (B3) are trenches standing in for buildings, a 60 s prep phase comes first (the test bot
 * wires the gate), and the three phases are three 240 s stretches of the one clock (720 s, from the end of the prep
 * phase). The opening barrage, the Nebelwerfer salvo, the 21 cm mortars and the Karl siege mortar wait for scripted
 * call-ins (side 1 has no HQ, so no commander calls anything). The two StuG III Ausf. B are the `tank` kind until the
 * `stug3b` look exists.
 */
export const M1001: MissionDef = {
  id: 1001,
  key: 'brest',
  title: 'Brest Fortress',
  location: 'Brest-Litovsk, Byelorussian SSR',
  date: '22 June 1941',
  mapPos: { lon: 23.656, lat: 52.083 },
  briefing: [
    'It is a little after four in the morning. The guns opened up across the Bug without warning and the west of the fortress is burning. The Germans are already on the islands and coming over the bridges. Nobody has told us anything, so we will fight with what we have.',
    'The walls of the ring barracks are a metre and more of brick and earth. Get the men inside, put the machine gun in the Kholm Gate where it sweeps the bridge, and keep the sappers carrying ammunition from the stores. A wall is worth ten men in the open.',
    'Their infantry will come first, then assault parties with flamethrowers, then the heavy guns. Hold the citadel through the day and make them pay for every courtyard.',
  ],
  objective: 'Hold the citadel until nightfall.',
  // Stand-ins until the russiaSummer theatre exists (STALINGRAD_BUILD.md).
  theatre: 'france',
  timeOfDay: 'dawn',
  mode: 'survival',
  length: 7000,
  newUnit: null,
  newSupport: null,
  units: [
    // Sapper and rifleman are free; the rest of the 1941 company (DP gunner, mortars, Tank Hunters) arrive as loans.
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
      incomeMul: 1.25,
      sappers: 2,
      forces: [
        // B1, the ring barracks: 6 riflemen.
        { kind: 'rifle', count: 6, trenchId: 1 },
        // B3, the Kholm Gate: 4 riflemen and the loaned DP gunner.
        { kind: 'rifle', count: 4, trenchId: 3 },
        { kind: 'lmg', count: 1, trenchId: 3 },
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
  trenches: [
    // Buildings until FOUNDATIONS 4.3 lands: B1 ring barracks, B2 the garrison club (a former church), B3 Kholm Gate.
    { id: 1, x: 1500, width: 160, slots: 6, owner: 0 },
    { id: 2, x: 2250, width: 140, slots: 5, owner: 0 },
    { id: 3, x: 3100, width: 160, slots: 6, owner: 0 },
  ],
  pillboxes: [],
  wire: [],
  // Sixty seconds to dig in before the first wave: the bot wires the Kholm Gate and digs a foxhole behind it.
  prep: { seconds: 60, bot: [{ kind: 'wire', x: 3420 }, { kind: 'foxhole', x: 2700 }] },
  timer: { seconds: 720, onExpire: 'win', label: 'Until nightfall' },
  events: [
    // Phase 1, "The first morning" (0 to 240 s).
    { type: 'announce', when: { at: 1 }, text: 'The first morning: the guns across the Bug have opened fire.' },
    {
      type: 'hint',
      when: { at: 3 },
      text: 'The ring barracks and the Kholm Gate shelter your men like trenches. Keep them full; a wall is worth ten men in the open.',
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
      forces: [{ kind: 'at', count: 3, trenchId: 3 }],
      announce: 'Tank Hunters with grenade bundles have come up from the stores.',
    },
    {
      type: 'wave',
      when: { at: 565 },
      side: 0,
      forces: [{ kind: 'at', count: 2, trenchId: 3 }],
      announce: 'Two more Tank Hunters have made it across the courtyard.',
    },
    {
      type: 'wave',
      when: { at: 490 },
      side: 1,
      forces: [
        { kind: 'tank', count: 1, x: 5600 },
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
        { kind: 'tank', count: 1, x: 5600 },
        { kind: 'rifle', count: 4, x: 5400 },
      ],
      announce: 'A second assault gun is on the bridge.',
    },
    {
      type: 'hint',
      when: { at: 495 },
      text: 'Tank Hunters must get close. Keep them in the gate and let the assault guns come to them; strike from the side if you can.',
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
