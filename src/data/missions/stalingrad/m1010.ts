import { STALINGRAD_MUSIC } from '../../musicCampaigns';
import type { MissionDef } from '../../schema';

/**
 * Stalingrad mission 10 (1010): Operation Ring, 10 January to 2 February 1943 (docs/campaigns/STALINGRAD.md,
 * mission 10). The campaign's finale: the Don Front clears the pocket from the western steppe (trenches 2 and 3)
 * through Pitomnik airfield (trench 4, the hangar is pillbox 1) and Gumrak (trench 5, the station is pillbox 2, a
 * Flak pair and a StuG without fuel) into the city's western ruins (trenches 6 and 7, strongpoints as pillboxes) and
 * the central square (trench 8) to the German headquarters in the Univermag (the enemy HQ). The Sixth Army is
 * starving and short of fuel: its tanks are on guard where they ran dry, its income is low, and it has no aircraft.
 *
 * Built with today's schema (docs/campaigns/STALINGRAD_BUILD.md, mission 1010): one battle on one backdrop, no
 * buildings or rubble, the minefield is wire, the immobile tanks are on guard, the opening bombardment, weather and
 * the surrender at 25% wait for the mission director (the HQ is destroyed instead); the KV-1S stands in as a T-34
 * (`tank`); StuG III (look `stug3f`), Panzer III (the era's Ausf. L) and Panzer IV (look `panzer4g`) are the German `tank`
 * (`lightTank` is the 1939 to 1941 Panzer III
 * Ausf. E), the Pak 40 crews the `at` kind.
 */
export const M1010: MissionDef = {
  id: 1010,
  key: 'ring',
  title: 'Operation Ring',
  location: 'The Stalingrad pocket to the Univermag',
  date: 'January 1943',
  dateIso: '1943-01-10',
  climate: 'winter',
  // The ring: Pitomnik airfield inside the pocket, where the battle starts (DECISIONS 296).
  mapPos: { lon: 44.04, lat: 48.73 },
  briefing: [
    'The German Sixth Army is inside a ring, and tomorrow the ring begins to close. They were offered honourable terms yesterday and their commander let them lapse. Very well: at dawn seven thousand guns will give our answer, and then the whole front goes forward together.',
    'They are hungry, frozen and short of everything, but they are not finished, and a starving man in a cellar with a machine gun is still dangerous. First the steppe and the airfield at Pitomnik, where their transports land, then Gumrak, then the ruins. Use every gun we have; we have more than they do now.',
    'Their army headquarters is out at Gumrak. Take the airfields and it will have nowhere to go but the ruins, and we will dig it out of whatever cellar it chooses. When it falls, the Sixth Army falls with it. Take the city back, street by street, to the river.',
  ],
  objective: 'Clear the pocket and take the German headquarters in the Univermag.',
  intel: {
    enemy: [
      'The 6th Army, starving and short of shells and fuel',
      'About 100 riflemen and MP40 troopers in trenches and ruins',
      'About 14 tanks and StuGs, most dug in without fuel',
      'Pak teams, flamethrowers; artillery, no aircraft',
    ],
    friendly: [
      'Don Front: 2 T-34s, a T-60, 8 riflemen, 6 PPSh troopers',
      '5 conscript squads, 2 DPs, mortars, a sniper, a flamethrower',
      'More tanks, carriers and squads at every line you take',
      'Artillery, Katyusha, smoke, the Il-2, the Pe-2 and the Po-2',
    ],
  },
  theatre: 'germany',
  timeOfDay: 'overcast',
  mode: 'assault',
  length: 28000,
  newUnit: null,
  newSupport: 'bomber',
  units: [
    ['sapper', 'rifle', 'lmg', 'assault', 'mortar', 'sniper', 'medic', 'at', 'tank', 'apc', 'flame', 'conscript'],
    ['sapper', 'rifle', 'lmg', 'assault', 'mortar', 'sniper', 'medic', 'at', 'flame'],
  ],
  supports: [
    ['artillery', 'smoke', 'katyusha', 'airStrike', 'bomber', 'recon'],
    ['artillery'],
  ],
  start: [
    {
      faction: 'soviet',
      hasHq: true,
      supplies: 900,
      hqHpMul: 1,
      incomeMul: 1,
      sappers: 5,
      forces: [
        { kind: 'rifle', count: 8, trenchId: 1 },
        { kind: 'lmg', count: 2, trenchId: 1 },
        // T-34/76s and a T-60; the rest of the armour comes up as the advance goes on.
        { kind: 'tank', count: 2, x: 1700 },
        { kind: 'lightTank', count: 1, x: 1300 },
        { kind: 'assault', count: 6 },
        { kind: 'conscript', count: 5 },
        { kind: 'mortar', count: 2 },
        { kind: 'sniper', count: 1 },
        { kind: 'flame', count: 1 },
      ],
    },
    {
      faction: 'german',
      hasHq: true,
      supplies: 200,
      // The Univermag's cellars: the last headquarters is dug deep.
      hqHpMul: 3,
      // Starving and short of everything.
      incomeMul: 0.5,
      sappers: 2,
      // Their tanks and assault guns have no fuel: dug in where they stopped, they are the pocket's anti-tank guns.
      forces: [
        // The western steppe.
        { kind: 'rifle', count: 4, trenchId: 2 },
        { kind: 'lmg', count: 1, trenchId: 2 },
        { kind: 'rifle', count: 3, trenchId: 3, behaviour: 'garrison' },
        { kind: 'lmg', count: 1, trenchId: 3, behaviour: 'garrison' },
        // Pitomnik airfield.
        { kind: 'rifle', count: 4, trenchId: 4, behaviour: 'garrison' },
        { kind: 'at', count: 1, trenchId: 4, behaviour: 'garrison' },
        { kind: 'tank', count: 1, x: 11500, behaviour: 'guard' },
        // Gumrak: the station and two assault guns without fuel.
        { kind: 'rifle', count: 4, trenchId: 5, behaviour: 'garrison' },
        { kind: 'at', count: 1, trenchId: 5, behaviour: 'garrison' },
        { kind: 'tank', count: 2, x: 16800, behaviour: 'guard', look: 'stug3f' },
        // The city's western ruins.
        { kind: 'rifle', count: 2, trenchId: 6, behaviour: 'garrison' },
        { kind: 'assault', count: 2, trenchId: 6, behaviour: 'garrison' },
        { kind: 'tank', count: 1, x: 20300, behaviour: 'guard' },
        { kind: 'rifle', count: 2, trenchId: 7, behaviour: 'garrison' },
        { kind: 'assault', count: 2, trenchId: 7, behaviour: 'garrison' },
        { kind: 'at', count: 1, trenchId: 7, behaviour: 'garrison' },
        { kind: 'tank', count: 1, x: 22300, behaviour: 'guard', look: 'panzer4g' },
        // The central square.
        { kind: 'rifle', count: 2, trenchId: 8, behaviour: 'garrison' },
        { kind: 'assault', count: 2, trenchId: 8, behaviour: 'garrison' },
        { kind: 'at', count: 1, trenchId: 8, behaviour: 'garrison' },
        { kind: 'tank', count: 2, x: 26300, behaviour: 'guard' },
      ],
    },
  ],
  trenches: [
    // The jump-off line.
    { id: 1, x: 2000, width: 180, slots: 10, owner: 0 },
    // The western steppe.
    { id: 2, x: 4500, width: 190, slots: 8, owner: 1 },
    { id: 3, x: 7000, width: 190, slots: 8, owner: 1 },
    // Pitomnik airfield.
    { id: 4, x: 11000, width: 200, slots: 8, owner: 1 },
    // Gumrak.
    { id: 5, x: 16500, width: 200, slots: 8, owner: 1 },
    // The western ruins.
    { id: 6, x: 20000, width: 200, slots: 8, owner: 1 },
    { id: 7, x: 22000, width: 200, slots: 8, owner: 1 },
    // The central square.
    { id: 8, x: 25500, width: 200, slots: 8, owner: 1 },
  ],
  pillboxes: [
    // The hangar at Pitomnik.
    { id: 1, x: 10700, side: 1, hpMul: 1 },
    // Gumrak station.
    { id: 2, x: 16200, side: 1, hpMul: 1.2 },
    // Strongpoints in the ruins and on the square.
    { id: 3, x: 19700, side: 1, hpMul: 1.6 },
    { id: 4, x: 21700, side: 1, hpMul: 1.6 },
    { id: 5, x: 23200, side: 1, hpMul: 1.6 },
    { id: 6, x: 24700, side: 1, hpMul: 1.6 },
    { id: 7, x: 26500, side: 1, hpMul: 1.8 },
    { id: 8, x: 27200, side: 1, hpMul: 1.8 },
  ],
  wire: [
    // The minefield and wire on the western steppe.
    { id: 1, x: 4200, width: 140, owner: 1 },
    { id: 2, x: 6600, width: 160, owner: 1 },
    { id: 3, x: 19400, width: 140, owner: 1 },
  ],
  timer: null,
  events: [
    { type: 'announce', when: { at: 2 }, text: 'The bombardment! Seven thousand guns are firing.' },
    {
      type: 'hint',
      when: { at: 4 },
      text: 'Let the guns land, then tanks and infantry through the wire together. Your tanks crush wire; your men cannot.',
    },
    {
      type: 'hint',
      when: { at: 40 },
      text: 'The Pe-2 Bomber lays a heavy stick of bombs along a strip of ground. It costs money, so save it for strongpoints and their tanks.',
    },
    { type: 'announce', when: { trenchCapturedBy: 0, trenchId: 3 }, text: 'The western steppe is clear. Pitomnik is ahead.' },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 3, delay: 5 },
      side: 0,
      forces: [
        { kind: 'at', count: 4, x: 6800 },
        { kind: 'tank', count: 2, x: 6600 },
        { kind: 'lightTank', count: 1, x: 6400 },
      ],
      announce: 'A tank company and four PTRD teams are up.',
    },
    {
      type: 'wave',
      when: { at: 300 },
      side: 1,
      forces: [
        { kind: 'rifle', count: 4, behaviour: 'assault' },
        { kind: 'assault', count: 4, behaviour: 'assault' },
      ],
      announce: 'A counter-attack from Pitomnik!',
    },
    // Small, desperate counter-attacks, wherever the ring presses hardest.
    {
      type: 'wave',
      when: { every: 300, from: 600, until: 2100 },
      side: 1,
      forces: [
        { kind: 'assault', count: 4, behaviour: 'assault' },
        { kind: 'flame', count: 2, behaviour: 'assault' },
      ],
      announce: 'A desperate German counter-attack!',
    },
    {
      type: 'hint',
      when: { at: 320 },
      text: 'Their tanks have no fuel. They cannot move far, but they can still shoot: take them from the flank or from the air.',
    },
    { type: 'announce', when: { trenchCapturedBy: 0, trenchId: 4 }, text: 'Pitomnik has fallen. Their transports have nowhere to land.' },
    // As each line falls the Sixth Army pulls back what it can into the next one, and at last into the ruins.
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 2, delay: 10 },
      side: 1,
      forces: [
        { kind: 'tank', count: 1, x: 11700, behaviour: 'guard' },
        { kind: 'assault', count: 4, x: 11200, behaviour: 'guard' },
        { kind: 'rifle', count: 4, x: 11400, behaviour: 'guard' },
      ],
      announce: 'They are pulling back on Pitomnik.',
    },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 3, delay: 20 },
      side: 1,
      forces: [
        { kind: 'tank', count: 1, x: 17000, behaviour: 'guard' },
        { kind: 'assault', count: 4, x: 16900, behaviour: 'guard' },
        { kind: 'rifle', count: 4, x: 17100, behaviour: 'guard' },
      ],
      announce: 'They are pulling back on Gumrak.',
    },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 5, delay: 20 },
      side: 1,
      forces: [
        { kind: 'tank', count: 2, x: 21400, behaviour: 'guard' },
        { kind: 'assault', count: 6, x: 21200, behaviour: 'guard' },
        { kind: 'lmg', count: 2, x: 21600, behaviour: 'guard' },
      ],
      announce: 'The Sixth Army is falling back into the ruins.',
    },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 7, delay: 20 },
      side: 1,
      forces: [
        { kind: 'tank', count: 2, x: 25900, behaviour: 'guard' },
        { kind: 'assault', count: 6, x: 25700, behaviour: 'guard' },
        { kind: 'rifle', count: 4, x: 26100, behaviour: 'guard' },
      ],
      announce: 'Every German who can still fight is round the central square.',
    },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 4, delay: 5 },
      side: 0,
      forces: [
        { kind: 'apc', count: 2, x: 10800 },
        { kind: 'rifle', count: 4, x: 10600 },
      ],
      announce: 'Universal Carriers bring a rifle company up to the airfield.',
    },
    // The rest of the Don Front's rifle divisions, moving up behind the advance.
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 2, delay: 30 },
      side: 0,
      forces: [
        { kind: 'conscript', count: 5 },
        { kind: 'rifle', count: 2 },
      ],
      announce: 'Another rifle battalion is moving up.',
    },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 5, delay: 30 },
      side: 0,
      forces: [
        { kind: 'conscript', count: 5 },
        { kind: 'rifle', count: 2 },
      ],
      announce: 'Another rifle battalion is moving up.',
    },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 7, delay: 30 },
      side: 0,
      forces: [
        { kind: 'conscript', count: 5 },
        { kind: 'rifle', count: 2 },
      ],
      announce: 'Another rifle battalion is moving up.',
    },
    { type: 'announce', when: { trenchCapturedBy: 0, trenchId: 5 }, text: 'Gumrak is ours. Their army headquarters has fled into the city.' },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 5, delay: 10 },
      side: 0,
      forces: [{ kind: 'tank', count: 2, x: 16200 }],
      announce: 'Two more T-34s have come up from the steppe.',
    },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 6, delay: 5 },
      side: 0,
      forces: [{ kind: 'flame', count: 2, x: 19800 }],
      announce: 'Two ROKS flamethrowers for the cellars.',
    },
    { type: 'wave', when: { every: 180, from: 900, until: 1800 }, side: 0, forces: [{ kind: 'flame', count: 1 }] },
    {
      type: 'hint',
      when: { trenchCapturedBy: 0, trenchId: 6, delay: 8 },
      text: 'In the ruins keep the tanks behind the infantry: magnetic charges wait in the rubble. Mortars and flamethrowers on the strongpoints.',
    },
    {
      type: 'announce',
      when: { trenchCapturedBy: 0, trenchId: 6, delay: 120 },
      text: 'A sniper and a machine-gun nest have shown themselves in the ruins.',
    },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 6, delay: 200 },
      side: 1,
      forces: [
        { kind: 'flame', count: 2, behaviour: 'assault' },
        { kind: 'assault', count: 4, behaviour: 'assault' },
      ],
      announce: 'Pioneers are counter-attacking in the ruins!',
    },
    { type: 'announce', when: { trenchCapturedBy: 0, trenchId: 7 }, text: 'The western ruins are clear. The central square is ahead.' },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 8, delay: 100 },
      side: 1,
      forces: [
        { kind: 'tank', count: 1, behaviour: 'assault', look: 'stug3f' },
        { kind: 'assault', count: 4, behaviour: 'assault' },
        { kind: 'rifle', count: 4, behaviour: 'assault' },
      ],
      announce: 'Their last armour and every man who can still stand.',
    },
    {
      type: 'announce',
      when: { hqHpBelow: 0.25, side: 1 },
      text: 'White flags in the Univermag. The southern pocket is surrendering.',
    },
    {
      type: 'hint',
      when: { hqHpBelow: 0.5, side: 0 },
      text: 'They have broken through behind you. Fall Back lets the HQ machine gun fight while you rebuild.',
    },
  ],
  ai: {
    sappers: 2,
    // Counts include the garrisons placed at the start (21 riflemen, 2 machine guns, 6 assault troops, 4 Pak crews).
    build: [
      { kind: 'rifle', count: 24, after: 0 },
      { kind: 'lmg', count: 4, after: 120 },
      { kind: 'at', count: 6, after: 200 },
      { kind: 'assault', count: 12, after: 240 },
      { kind: 'mortar', count: 2, after: 400 },
      { kind: 'flame', count: 2, after: 600 },
    ],
    firstAttackAfter: 900,
  },
  bot: {
    sappers: 6,
    // Counts include the forces placed at the start.
    build: [
      { kind: 'rifle', count: 14, after: 0 },
      { kind: 'at', count: 2, after: 60 },
      { kind: 'medic', count: 2, after: 120 },
      { kind: 'tank', count: 7, after: 180 },
      { kind: 'assault', count: 8, after: 240 },
      { kind: 'at', count: 4, after: 360 },
      { kind: 'conscript', count: 20, after: 420 },
      { kind: 'tank', count: 8, after: 600 },
    ],
    firstAttackAfter: 30,
  },
  expectedMinutes: [9, 26],
  music: STALINGRAD_MUSIC.missions[1010],
};
