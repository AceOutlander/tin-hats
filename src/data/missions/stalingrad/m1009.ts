import { STALINGRAD_MUSIC } from '../../musicCampaigns';
import type { MissionDef } from '../../schema';

/**
 * Stalingrad mission 9 (1009): Operation Uranus, 19 to 23 November 1942 (docs/campaigns/STALINGRAD.md, mission 9).
 * An armoured breakthrough: a brigade of the 26th Tank Corps breaks the Romanian line out of the Serafimovich
 * bridgehead in fog (trenches 2 and 3), races across the steppe to Perelazovsky (trench 4), beats off the 22nd
 * Panzer Division and the Romanian armour in the Don hills (trench 5), rushes the Kalach bridge (its guard post is
 * pillbox 2) and drives on to Sovetsky (trench 6) and the German supply depot (the enemy HQ).
 *
 * Built on the mission director (docs/campaigns/STALINGRAD_BUILD.md, mission 1009): the full 30,000 wu in four phases.
 * Siren: the free opening barrage and a Katyusha salvo on the Romanian line, which is taken (trench 3 for P1); the
 * steppe: Perelazovsky (trench 4 for P2) and the Don hills (trench 5 for P3), with the Il-2 and the Po-2 offered from
 * here; the Kalach bridge: its guard post (pillbox 2) is destroyed while the column drives in disguised for 40 s;
 * Sovetsky (trench 6 for P4), whose capture closes the ring with the green flares. Reinforcements come up at the
 * positions taken (ForceDef.at). The Romanians field as German troops in the `romanian` look (khaki-brown greatcoat,
 * Adrian helmet; no Romanian nation yet); every German and Romanian tank (Pz 38(t), Panzer III, Panzer IV, R-2) is the
 * `tank` kind (the era's Panzer III Ausf. L, the Panzer IV Ausf. G by look, the R-2s as the short-gun Panzer III
 * stand-in `panzer3h`; no Pz 38(t) or R-2 is drawn), since `lightTank` is the 1939 to 1941 Panzer III Ausf. E; the
 * 37 mm and Pak 38/40 crews are the `at` kind; the KV-1S stands in as a T-34 (`tank`). The fog, the blizzard and the
 * bridge's demolition (bridges, FOUNDATIONS.md 4.4) wait for their features.
 */
export const M1009: MissionDef = {
  id: 1009,
  key: 'uranus',
  title: 'Operation Uranus',
  location: 'Serafimovich bridgehead to Kalach-na-Donu',
  date: '19 to 23 November 1942',
  dateIso: '1942-11-19',
  climate: 'winter',
  // The breakthrough: the Serafimovich bridgehead on the Don, where the 26th Tank Corps went in (DECISIONS 296).
  mapPos: { lon: 42.74, lat: 49.58 },
  briefing: [
    'For two months the city has held them. Now it is their turn to be surrounded. At twenty past seven every gun on the front opens fire, and when the guns lift we go, fog or no fog. Steer by compass if you must, and keep the tank riders on the hulls until we reach their trenches.',
    'In front of us are Romanian divisions, brave men badly armed, with few anti-tank guns. Behind them are open steppe, a German panzer division short of fuel, and the Don. We do not stop to finish every trench: break the line, and the rifle divisions coming behind us will mop up.',
    'Our objective is the bridge at Kalach, a hundred kilometres away, before they blow it. Then on with the corps beside us to Sovetsky, where the tanks of the Stalingrad Front are coming the other way. When you meet them, fire green flares, and make sure they see them.',
  ],
  objective: 'Break through, take the Kalach bridge and link up at Sovetsky.',
  intel: {
    enemy: [
      'Romanian 3rd Army: about 25 infantry with ZB machine guns',
      'Few anti-tank guns; a few R-2 light tanks',
      '22nd Panzer behind them: about 18 Panzer III and IV',
      'German riflemen, MP40 troopers and PzB 39 teams',
      'Little air: fog, then a blizzard',
    ],
    friendly: [
      '26th Tank Corps: 6 T-34s and 3 T-60s, with tank riders',
      '8 riflemen, 2 DPs, 2 PTRD teams, 2 mortar crews',
      'Universal Carriers and PTRD teams after the first line',
      'Artillery, smoke, Katyusha, the Il-2 and the Po-2',
    ],
  },
  theatre: 'france',
  timeOfDay: 'dawn',
  mode: 'assault',
  length: 30000,
  // The unlock order (DECISIONS 295): the Lend-Lease Universal Carrier.
  newUnit: 'apc',
  newSupport: 'recon',
  units: [
    ['sapper', 'rifle', 'lmg', 'assault', 'mortar', 'sniper', 'medic', 'at', 'tank', 'apc', 'flame', 'aa', 'commander', 'conscript'],
    ['sapper', 'rifle', 'lmg', 'assault', 'mortar', 'medic', 'at', 'tank', 'apc'],
  ],
  supports: [
    ['artillery', 'smoke', 'katyusha', 'airStrike', 'recon'],
    ['artillery'],
  ],
  start: [
    {
      faction: 'soviet',
      // The Il-2s and the Po-2 come up once the line is broken (phase 2).
      supportsOff: ['airStrike', 'recon'],
      hasHq: true,
      supplies: 800,
      hqHpMul: 1,
      incomeMul: 1,
      sappers: 4,
      forces: [
        { kind: 'rifle', count: 8, trenchId: 1 },
        { kind: 'lmg', count: 2, trenchId: 1 },
        // The brigade: T-34/76s with two KV-1S among them, a company of T-60 and T-70 light tanks, tank riders.
        { kind: 'tank', count: 6, x: 1700 },
        { kind: 'lightTank', count: 3, x: 1300 },
        { kind: 'assault', count: 6, x: 1500 },
        { kind: 'at', count: 2 },
        { kind: 'mortar', count: 2 },
      ],
    },
    {
      faction: 'german',
      hasHq: true,
      supplies: 400,
      // The supply depot at Sovetsky: every German unit west of the city drew from it.
      hqHpMul: 2,
      incomeMul: 0.6,
      sappers: 3,
      forces: [
        // The Romanian 3rd Army's line.
        { kind: 'rifle', count: 8, trenchId: 2, behaviour: 'garrison', look: 'romanian' },
        { kind: 'lmg', count: 2, trenchId: 2, behaviour: 'garrison', look: 'romanian' },
        { kind: 'rifle', count: 7, trenchId: 3, look: 'romanian' },
        { kind: 'lmg', count: 1, trenchId: 3, look: 'romanian' },
        // A 37 mm anti-tank gun, one of the few the Romanians had.
        { kind: 'at', count: 1, trenchId: 3, look: 'romanian' },
        // A Romanian R-2 light tank behind the second trench.
        { kind: 'tank', count: 1, x: 5900, behaviour: 'guard', look: 'panzer3h' },
        // Perelazovsky, with a Romanian corps headquarters.
        { kind: 'rifle', count: 4, trenchId: 4, behaviour: 'garrison', look: 'romanian' },
        { kind: 'lmg', count: 1, trenchId: 4, behaviour: 'garrison', look: 'romanian' },
        { kind: 'assault', count: 2, trenchId: 4, behaviour: 'garrison', look: 'romanian' },
        // The 22nd Panzer Division's screen in the Don hills: tank-hunting grenadiers with magnetic charges.
        { kind: 'rifle', count: 4, trenchId: 5, behaviour: 'garrison' },
        { kind: 'assault', count: 2, trenchId: 5, behaviour: 'garrison' },
        { kind: 'tank', count: 2, x: 21300, behaviour: 'guard' },
        { kind: 'at', count: 1, trenchId: 5, behaviour: 'garrison' },
        // Sovetsky.
        { kind: 'rifle', count: 4, trenchId: 6, behaviour: 'garrison' },
        { kind: 'lmg', count: 1, trenchId: 6, behaviour: 'garrison' },
        { kind: 'tank', count: 1, x: 29100, behaviour: 'guard' },
      ],
    },
  ],
  trenches: [
    // The Serafimovich bridgehead's jump-off line.
    { id: 1, x: 2000, width: 180, slots: 10, owner: 0 },
    // The Romanian line.
    { id: 2, x: 4200, width: 200, slots: 8, owner: 1 },
    { id: 3, x: 5600, width: 200, slots: 8, owner: 1 },
    // Perelazovsky.
    { id: 4, x: 13000, width: 220, slots: 8, owner: 1 },
    // The Don hills.
    { id: 5, x: 21000, width: 180, slots: 6, owner: 1 },
    // Sovetsky.
    { id: 6, x: 28800, width: 200, slots: 8, owner: 1 },
  ],
  pillboxes: [
    // The Romanian corps headquarters in Perelazovsky.
    { id: 1, x: 13250, side: 1, hpMul: 1 },
    // The guard post at the Kalach bridge.
    { id: 2, x: 24300, side: 1, hpMul: 1.2 },
  ],
  wire: [
    { id: 1, x: 3800, width: 160, owner: 1 },
    { id: 2, x: 5300, width: 120, owner: 1 },
    // The wired bridge.
    { id: 3, x: 23800, width: 140, owner: 1 },
  ],
  timer: null,
  // The mission director (FOUNDATIONS.md 3): the four phases of the brief (STALINGRAD.md, mission 9).
  phases: [
    {
      id: 'siren',
      title: 'Siren',
      objectives: [{ id: 'romanianLine', type: 'capture', point: { trench: 3 }, text: 'Break the Romanian line' }],
      sideObjectives: [
        { id: 'tanks15', text: 'Fifteen tanks', objective: { id: 'tanks15Dead', type: 'kill', side: 1, kinds: ['tank'], count: 15 }, bonus: 0.1 },
      ],
      next: 'steppe',
    },
    {
      id: 'steppe',
      title: 'The steppe',
      objectives: [
        { id: 'perelazovsky', type: 'capture', point: { trench: 4 }, text: 'Take Perelazovsky' },
        { id: 'donHills', type: 'capture', point: { trench: 5 }, text: 'Take the Don hills' },
      ],
      next: 'bridge',
    },
    {
      id: 'bridge',
      title: 'The Kalach bridge',
      objectives: [{ id: 'bridgePost', type: 'destroy', structures: [{ pillbox: 2 }], text: 'Take the bridge' }],
      sideObjectives: [
        // Before they can blow it: 180 s from the start of the phase (the demolition itself waits for bridges).
        { id: 'bridgeIntact', text: 'The bridge intact', objective: { id: 'bridgeFast', type: 'destroy', structures: [{ pillbox: 2 }] }, withinPhase: 180, bonus: 0.2 },
      ],
      next: 'sovetsky',
    },
    {
      id: 'sovetsky',
      title: 'Sovetsky',
      objectives: [{ id: 'sovetsky', type: 'capture', point: { trench: 6 }, text: 'Take Sovetsky' }],
      next: null,
    },
  ],
  events: [
    // Siren: three free strikes of twelve rounds on the Romanian trenches, then a Katyusha salvo (FOUNDATIONS.md 3.3).
    { id: 'siren', type: 'banner', when: { phase: 'siren' }, text: 'Siren!', sound: 'horn' },
    { id: 'strike1', type: 'barrage', when: { phase: 'siren' }, side: 0, x: 4200, spread: 160, rounds: 12, duration: 4, weapon: 'artilleryShell' },
    { id: 'strike2', type: 'barrage', when: { phase: 'siren', delay: 3 }, side: 0, x: 5600, spread: 160, rounds: 12, duration: 4, weapon: 'artilleryShell' },
    { id: 'strike3', type: 'barrage', when: { phase: 'siren', delay: 6 }, side: 0, x: 4900, spread: 600, rounds: 12, duration: 4, weapon: 'artilleryShell' },
    { id: 'sirenKatyusha', type: 'airRaid', when: { phase: 'siren', delay: 10 }, side: 0, support: 'katyusha', x: 5000 },
    { id: 'il2', type: 'support', when: { phase: 'steppe' }, side: 0, kind: 'airStrike', enabled: true },
    { id: 'po2', type: 'support', when: { phase: 'steppe' }, side: 0, kind: 'recon', enabled: true },
    // Headlights on: the column is not engaged on the road to the bridge for 40 s unless it opens fire.
    { id: 'headlights', type: 'disguise', when: { phase: 'bridge' }, side: 0, seconds: 40, x0: 21000, x1: 24600 },
    { type: 'announce', when: { at: 2 }, text: 'Siren! Every gun on the front has opened fire.' },
    {
      type: 'hint',
      when: { at: 4 },
      text: 'The Romanian line is thin and short of anti-tank guns. T-34s and tank riders on the second trench, infantry on the first.',
    },
    {
      type: 'hint',
      when: { at: 20 },
      about: 'apc',
      text: 'New: Universal Carrier. Fast and bullet-proof, with a machine gun: it carries a squad up behind the tanks.',
    },
    {
      type: 'hint',
      when: { at: 40 },
      text: 'The Il-2 Shturmovik is the answer to their panzers, and the Po-2 Recon Plane shows where their tanks are waiting.',
    },
    { type: 'announce', when: { trenchCapturedBy: 0, trenchId: 3 }, text: 'The Romanian line is broken. Into the steppe!' },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 3, delay: 5 },
      side: 0,
      forces: [
        { kind: 'apc', count: 2, at: { trench: 3 } },
        { kind: 'at', count: 4, at: { trench: 3 } },
        { kind: 'mortar', count: 2, at: { trench: 3 } },
      ],
      announce: 'Lend-Lease Universal Carriers, PTRD teams and mortars are up.',
    },
    {
      type: 'hint',
      when: { trenchCapturedBy: 0, trenchId: 3, delay: 10 },
      text: 'The Universal Carrier is fast and bullet-proof and carries a squad to the front. Use it to keep the infantry up with the tanks.',
    },
    {
      type: 'wave',
      when: { every: 150, from: 600, until: 1500 },
      side: 0,
      forces: [
        { kind: 'at', count: 1 },
        { kind: 'rifle', count: 3 },
      ],
      announce: 'Rifle divisions are coming up behind the tanks.',
    },
    {
      type: 'wave',
      when: { phase: 'steppe', delay: 200 },
      side: 1,
      forces: [
        { kind: 'tank', count: 4, behaviour: 'assault' },
        { kind: 'rifle', count: 8, behaviour: 'assault' },
        { kind: 'assault', count: 2, behaviour: 'assault' },
      ],
      announce: 'The 22nd Panzer Division is counter-attacking!',
    },
    {
      type: 'wave',
      when: { phase: 'steppe', delay: 400 },
      side: 1,
      forces: [{ kind: 'tank', count: 3, behaviour: 'assault', look: 'panzer3h' }],
      announce: 'Romanian armour on the steppe: their R-2 light tanks.',
    },
    { type: 'announce', when: { phase: 'steppe', delay: 500 }, text: 'A blizzard is blowing up over the steppe.' },
    { type: 'announce', when: { trenchCapturedBy: 0, trenchId: 4 }, text: 'Perelazovsky is ours, and a Romanian corps headquarters with it.' },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 4, delay: 5 },
      side: 0,
      forces: [
        { kind: 'rifle', count: 4, at: { trench: 4 } },
        { kind: 'assault', count: 2, at: { trench: 4 } },
      ],
      announce: 'A motor-rifle battalion has caught up at Perelazovsky.',
    },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 4, delay: 5 },
      side: 1,
      forces: [
        { kind: 'tank', count: 4, x: 21700, behaviour: 'guard', look: 'panzer4g' },
        { kind: 'at', count: 2, x: 21500, behaviour: 'guard' },
        { kind: 'assault', count: 4, x: 21400, behaviour: 'guard' },
      ],
      announce: 'The main body of the 22nd Panzer Division is digging in on the Don hills.',
    },
    {
      type: 'wave',
      when: { trenchCapturedBy: 0, trenchId: 5, delay: 10 },
      side: 1,
      forces: [
        { kind: 'assault', count: 4, x: 24500, behaviour: 'guard' },
        { kind: 'rifle', count: 4, x: 24600, behaviour: 'guard' },
      ],
    },
    {
      type: 'announce',
      when: { trenchCapturedBy: 0, trenchId: 5 },
      text: 'The Don! The bridge at Kalach is ahead. Headlights on: drive as if you own the road.',
    },
    {
      type: 'hint',
      when: { trenchCapturedBy: 0, trenchId: 5, delay: 3 },
      text: 'Go for the bridge at once with the fastest tanks, before they can blow it.',
    },
    {
      type: 'wave',
      when: { phase: 'sovetsky', delay: 60 },
      side: 1,
      forces: [
        { kind: 'tank', count: 3, behaviour: 'assault' },
        { kind: 'rifle', count: 6, behaviour: 'assault' },
        { kind: 'assault', count: 2, behaviour: 'assault' },
      ],
      announce: 'A last-ditch German counter-attack from Kalach!',
    },
    { type: 'announce', when: { trenchCapturedBy: 0, trenchId: 6 }, text: 'Sovetsky! The tanks of the Stalingrad Front are close.' },
    { type: 'announce', when: { objective: 'sovetsky' }, text: 'Green flares over Sovetsky. The ring is closed.' },
    {
      type: 'hint',
      when: { hqHpBelow: 0.5, side: 0 },
      text: 'They have got round behind you. Fall Back lets the HQ machine gun fight while you rebuild.',
    },
  ],
  ai: {
    sappers: 3,
    // Counts include the garrisons placed at the start (27 riflemen, 5 machine guns, 2 anti-tank crews).
    build: [
      { kind: 'rifle', count: 30, after: 0 },
      { kind: 'lmg', count: 6, after: 60 },
      { kind: 'at', count: 4, after: 90 },
      { kind: 'mortar', count: 2, after: 120 },
      { kind: 'tank', count: 2, after: 240 },
      { kind: 'assault', count: 4, after: 300 },
      { kind: 'apc', count: 1, after: 400 },
      { kind: 'tank', count: 3, after: 600 },
    ],
    firstAttackAfter: 600,
  },
  bot: {
    sappers: 5,
    // Counts include the brigade placed at the start.
    build: [
      { kind: 'rifle', count: 12, after: 0 },
      { kind: 'at', count: 3, after: 60 },
      { kind: 'tank', count: 7, after: 120 },
      { kind: 'medic', count: 1, after: 180 },
      { kind: 'apc', count: 1, after: 240 },
      { kind: 'rifle', count: 16, after: 300 },
      { kind: 'at', count: 6, after: 360 },
      { kind: 'tank', count: 9, after: 480 },
    ],
    firstAttackAfter: 30,
  },
  expectedMinutes: [9, 24],
  music: STALINGRAD_MUSIC.missions[1009],
};
