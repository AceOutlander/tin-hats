import { STALINGRAD_MUSIC } from '../../musicCampaigns';
import type { MissionDef } from '../../schema';

/**
 * Stalingrad mission 9 (1009): Operation Uranus, 19 to 23 November 1942 (docs/campaigns/STALINGRAD.md, mission 9). An
 * armoured breakthrough: a brigade of the 26th Tank Corps breaks the Romanian line out of the Serafimovich bridgehead
 * in fog (trenches 2 and 3), races across the steppe to Perelazovsky (buildings B1 to B3), beats off the 22nd Panzer
 * Division and the Romanian armour in the Don hills (trench 5), rushes the Kalach bridge (its guard post is pillbox 2)
 * and drives on to Sovetsky (trench 6) and the German supply depot (the enemy HQ).
 *
 * Built on the mission director (docs/campaigns/STALINGRAD_BUILD.md, mission 1009): the full 30,000 wu in five phases.
 * Siren: the free opening barrage and a Katyusha salvo on the Romanian line, which is taken (P1, held through trench
 * 3); the steppe: Perelazovsky (P2, held through its house B2; B3 is the Romanian corps headquarters; FOUNDATIONS.md
 * 4.3) and the Don hills (P3, open ground taken by holding it 10 s), with the Il-2 and the Po-2 offered from here; the
 * Kalach bridge (FOUNDATIONS.md 4.4): bridge 1 over the Don, German and wired, is taken (its point P5, within 180 s for
 * the side objective) while the column drives in disguised for 40 s past its guard post (pillbox 2); at 180 s the
 * Germans blow it unless P5 is ours (holding it cuts the wires), and then infantry wade the ford (the river itself, at
 * 0.35) while the tanks wait 180 s for the engineers' pontoon (bridge 2, the `bridge` event); Sovetsky (P4,
 * through trench 6, past the houses of Kalach, B4 and B5), with the 4th Tank Corps beside us; and the link-up, Sovetsky
 * held 270 s against three breakout attempts, the depot cut off (no German income), until the green flares close the
 * ring (DECISIONS 436). The Front's guns and two Il-2 raids hit the Don hills as the 22nd Panzer digs in. The HQ
 * is a log dugout (`hqLook`). Trained units deploy at the positions taken (P1 to P3 are the Soviet forward spawns,
 * spawnFor 0), and the loaned carriers, PTRDs and mortars come up at P1. The ground is the brief's sectors (snow, the
 * steppe under snow, the climb into the Don hills, the Don under the Kalach bridge). An AP minefield lies in front of the
 * Romanian line at x 3,800 (4.6), unmarked: the barrage or the first blast shows it, then sappers clear it. The Romanians field
 * as German troops in the `romanian` look (khaki-brown greatcoat, Adrian helmet; no Romanian nation yet); every German
 * and Romanian tank (Pz 38(t), Panzer III, Panzer IV, R-2) is the `tank` kind (the era's Panzer III Ausf. L, the Panzer
 * IV Ausf. G by look, the R-2s as the short-gun Panzer III stand-in `panzer3h`; no Pz 38(t) or R-2 is drawn), since
 * `lightTank` is the 1939 to 1941 Panzer III Ausf. E; the 37 mm and Pak 38/40 crews are the `at` kind; the KV-1S stands
 * in as a T-34 (`tank`).
 *
 * Weather and time (FOUNDATIONS.md 4.7): the steppe theatre's winter look; the attack goes in at dawn in fog
 * (visibility 0.6, no air); it lifts over 120 s into a clear day, the short window for the Il-2s, until the blizzard
 * (0.7, no air) 500 s into the steppe; night falls at the bridge (only the Po-2 flies by night), and green flares
 * go up over Sovetsky at the end.
 */
export const M1009: MissionDef = {
  id: 1009,
  key: 'uranus',
  title: 'Operation Uranus',
  location: 'Serafimovich bridgehead to Kalach-na-Donu',
  date: '19 to 23 November 1942',
  dateIso: '1942-11-19',
  climate: 'winter',
  // The breakthrough: the Serafimovich bridgehead on the Don, where the 26th Tank Corps went in (DECISIONS 335).
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
      '22nd Panzer behind them: about 15 Panzer III and IV',
      'German riflemen, MP40 troopers and PzB 39 teams',
      'Little air: fog, then a blizzard',
    ],
    friendly: [
      '26th Tank Corps: 6 T-34s and 3 T-60s, with tank riders',
      '8 riflemen, 2 DPs, 2 PTRD teams, 2 mortar crews',
      'Universal Carriers and PTRD teams after the first line',
      'The Front artillery and Il-2s for the breakthrough and the Don hills',
      'The 4th Tank Corps beside us for the push on Sovetsky',
    ],
  },
  theatre: 'steppe',
  timeOfDay: 'dawn',
  weather: 'fog',
  mode: 'assault',
  length: 30000,
  // The unlock order (DECISIONS 334): the Lend-Lease Universal Carrier.
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
      hqLook: 'logDugout',
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
        // Perelazovsky, with a Romanian corps headquarters (B3).
        { kind: 'rifle', count: 4, buildingId: 2, behaviour: 'garrison', look: 'romanian' },
        { kind: 'lmg', count: 1, buildingId: 2, behaviour: 'garrison', look: 'romanian' },
        { kind: 'assault', count: 2, buildingId: 2, behaviour: 'garrison', look: 'romanian' },
        { kind: 'rifle', count: 2, buildingId: 3, behaviour: 'garrison', look: 'romanian' },
        { kind: 'lmg', count: 1, buildingId: 3, behaviour: 'garrison', look: 'romanian' },
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
    // The Don hills.
    { id: 5, x: 21000, width: 180, slots: 6, owner: 1 },
    // Sovetsky.
    { id: 6, x: 28800, width: 200, slots: 8, owner: 1 },
  ],
  buildings: [
    // Perelazovsky: an izba, the village houses (P2) and the Romanian corps headquarters.
    { id: 1, x: 12550, width: 130, floors: 1, slotsPerFloor: 4, hpMul: 0.6, owner: -1, look: 'izba' },
    { id: 2, x: 13000, width: 200, floors: 2, slotsPerFloor: 4, hpMul: 1, owner: 1, look: 'house' },
    { id: 3, x: 13400, width: 160, floors: 2, slotsPerFloor: 3, hpMul: 1, owner: 1, look: 'house' },
    // Kalach, on the road to Sovetsky.
    { id: 4, x: 27900, width: 150, floors: 2, slotsPerFloor: 3, hpMul: 0.8, owner: -1, look: 'house' },
    { id: 5, x: 28350, width: 130, floors: 1, slotsPerFloor: 4, hpMul: 0.6, owner: -1, look: 'izba' },
  ],
  pillboxes: [
    // The guard post at the Kalach bridge.
    { id: 2, x: 24300, side: 1, hpMul: 1.2 },
  ],
  wire: [
    { id: 1, x: 3800, width: 160, owner: 1 },
    { id: 2, x: 5300, width: 120, owner: 1 },
  ],
  // The Romanian AP minefield in front of their line, under the wire (FOUNDATIONS.md 4.6).
  minefields: [{ id: 1, x: 3800, width: 260, owner: 1, mines: 'ap', density: 0.45, marked: false }],
  // The Kalach bridge (FOUNDATIONS.md 4.4): German, held through P5, wired for demolition; and the engineers' pontoon,
  // put across 180 s after the bridge goes (the `bridge` event).
  bridges: [
    { id: 1, x0: 23600, x1: 24400, owner: 1, point: 'P5', demolition: { side: 1, wired: true } },
    { id: 2, x0: 23600, x1: 24400, owner: 0, standing: false, look: 'pontoon' },
  ],
  // The brief's sectors (FOUNDATIONS.md 4.1): snow, the open steppe under snow, the climb into the Don hills, the Don
  // (water: vehicles cross only on the bridge, 4.4) and the road to Sovetsky.
  sectors: [
    { from: 0, to: 3000, ground: 'snow', label: 'Serafimovich bridgehead' },
    { from: 3000, to: 7000, ground: 'snow', label: 'Romanian line' },
    { from: 7000, to: 16000, ground: 'steppe', label: 'Open steppe' },
    { from: 16000, to: 19500, ground: 'slopeUp', label: 'Don hills' },
    { from: 19500, to: 23000, ground: 'snow', label: 'Don hills' },
    { from: 23000, to: 23600, ground: 'snow', label: 'The Don at Kalach' },
    { from: 23600, to: 24400, ground: 'water', label: 'The Don' },
    { from: 24400, to: 25000, ground: 'snow', label: 'The Don at Kalach' },
    { from: 25000, to: 30000, ground: 'road', label: 'Road to Sovetsky' },
  ],
  // The capture points and forward spawns (4.5): the Romanian line is held through its trench and Perelazovsky through
  // its house B2, the Don hills are open ground taken by holding it, and Sovetsky is held through trench 6 (the town
  // has no buildings of its own on this map). P1 to P3 are the Soviet forward spawns (spawnFor 0): the 22nd Panzer's
  // reserves come from its own depot, not the Romanian trenches.
  capturePoints: [
    { id: 'P1', x: 5600, width: 300, label: 'Romanian line', owner: 1, captureTime: 0, spawn: true, spawnFor: 0, contestRadius: 600, structure: { trench: 3 } },
    { id: 'P2', x: 13000, width: 320, label: 'Perelazovsky', owner: 1, captureTime: 0, spawn: true, spawnFor: 0, contestRadius: 600, structure: { building: 2 } },
    { id: 'P3', x: 21000, width: 400, label: 'Don hills', owner: 1, captureTime: 10, spawn: true, spawnFor: 0, contestRadius: 600 },
    { id: 'P4', x: 28800, width: 300, label: 'Sovetsky', owner: 1, captureTime: 0, spawn: false, contestRadius: 600, structure: { trench: 6 } },
    // The Kalach bridge: taken by holding the span alone for 5 s; holding it cuts the demolition wires.
    { id: 'P5', x: 24000, width: 800, label: 'Kalach bridge', owner: 1, captureTime: 5, spawn: false, contestRadius: 400 },
  ],
  timer: null,
  // The mission director (FOUNDATIONS.md 3): the four phases of the brief (STALINGRAD.md, mission 9).
  phases: [
    {
      id: 'siren',
      title: 'Siren',
      objectives: [{ id: 'romanianLine', type: 'capture', point: { point: 'P1' }, text: 'Break the Romanian line' }],
      sideObjectives: [
        // Twelve, not fifteen (DECISIONS 436): the day brings about 18 and the bot kills 13 to 17.
        { id: 'tanks12', text: 'Twelve tanks', objective: { id: 'tanks12Dead', type: 'kill', side: 1, kinds: ['tank'], count: 12 }, bonus: 0.1 },
      ],
      next: 'steppe',
    },
    {
      id: 'steppe',
      title: 'The steppe',
      objectives: [
        { id: 'perelazovsky', type: 'capture', point: { point: 'P2' }, text: 'Take Perelazovsky' },
        { id: 'donHills', type: 'capture', point: { point: 'P3' }, text: 'Take the Don hills' },
      ],
      next: 'bridge',
    },
    {
      id: 'bridge',
      title: 'The Kalach bridge',
      objectives: [{ id: 'bridgeTaken', type: 'capture', point: { point: 'P5' }, text: 'Take the bridge' }],
      sideObjectives: [
        // Before they can blow it: 180 s from the start of the phase, when the demolition comes.
        { id: 'bridgeIntact', text: 'The bridge intact', objective: { id: 'bridgeFast', type: 'capture', point: { point: 'P5' } }, withinPhase: 180, bonus: 0.2 },
      ],
      next: 'sovetsky',
    },
    {
      id: 'sovetsky',
      title: 'Sovetsky',
      objectives: [{ id: 'sovetsky', type: 'capture', point: { point: 'P4' }, text: 'Take Sovetsky' }],
      next: 'linkup',
    },
    {
      // The link-up (DECISIONS 436): Sovetsky is held until the Stalingrad Front's tanks arrive and see the flares, so
      // the ring is not closed by a dash past the town.
      id: 'linkup',
      title: 'The link-up',
      objectives: [{ id: 'linkup', type: 'hold', point: { point: 'P4' }, seconds: 270, text: 'Hold Sovetsky for the link-up' }],
      next: null,
    },
  ],
  events: [
    // Siren: three free strikes of twelve rounds on the Romanian trenches, then a Katyusha salvo (FOUNDATIONS.md 3.3).
    { id: 'siren', type: 'banner', when: { phase: 'siren' }, text: 'Siren!', sound: 'horn' },
    // One shell at a time (DECISIONS 436): each strike lands over 12 s, the three walking from trench 2 to trench 3.
    { id: 'strike1', type: 'barrage', when: { phase: 'siren' }, side: 0, x: 4200, spread: 160, rounds: 12, duration: 12, weapon: 'artilleryShell' },
    { id: 'strike2', type: 'barrage', when: { phase: 'siren', delay: 6 }, side: 0, x: 5600, spread: 160, rounds: 12, duration: 12, weapon: 'artilleryShell' },
    { id: 'strike3', type: 'barrage', when: { phase: 'siren', delay: 12 }, side: 0, x: 4900, spread: 600, rounds: 12, duration: 12, weapon: 'artilleryShell' },
    { id: 'sirenKatyusha', type: 'airRaid', when: { phase: 'siren', delay: 20 }, side: 0, support: 'katyusha', x: 5000 },
    { id: 'il2', type: 'support', when: { phase: 'steppe' }, side: 0, kind: 'airStrike', enabled: true },
    { id: 'po2', type: 'support', when: { phase: 'steppe' }, side: 0, kind: 'recon', enabled: true },
    // Fog, then clear, then the blizzard; night at the bridge; the green flares (FOUNDATIONS.md 4.7).
    { id: 'fogLifts', type: 'weather', when: { phase: 'steppe' }, to: 'clear', over: 120 },
    { id: 'day', type: 'time', when: { phase: 'steppe' }, to: 'day', over: 120 },
    { id: 'blizzard', type: 'weather', when: { phase: 'steppe', delay: 500 }, to: 'blizzard', over: 60 },
    { id: 'night', type: 'time', when: { phase: 'bridge' }, to: 'night', over: 60 },
    { id: 'greenFlares', type: 'flare', when: { objective: 'linkup' }, side: 0, x: 28800, color: 'green' },
    // Headlights on: the column is not engaged on the road to the bridge for 40 s unless it opens fire.
    { id: 'headlights', type: 'disguise', when: { phase: 'bridge' }, side: 0, seconds: 40, x0: 21000, x1: 24600 },
    { type: 'announce', when: { at: 2 }, text: 'Siren! Every gun on the front has opened fire.' },
    {
      type: 'hint',
      when: { at: 4 },
      text: 'Fog hides you and them alike: push close before you fire. The Romanians are short of anti-tank guns: T-34s and tank riders on the second trench, infantry on the first.',
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
    { type: 'announce', when: { pointCapturedBy: 0, point: { point: 'P1' } }, text: 'The Romanian line is broken. Into the steppe!' },
    {
      type: 'wave',
      when: { pointCapturedBy: 0, point: { point: 'P1' }, delay: 5 },
      side: 0,
      forces: [
        { kind: 'apc', count: 2, at: { point: 'P1' } },
        { kind: 'at', count: 4, at: { point: 'P1' } },
        { kind: 'mortar', count: 2, at: { point: 'P1' } },
      ],
      announce: 'Lend-Lease Universal Carriers, PTRD teams and mortars are up.',
    },
    {
      type: 'hint',
      when: { pointCapturedBy: 0, point: { point: 'P1' }, delay: 10 },
      text: 'The Universal Carrier is fast and bullet-proof and carries a squad to the front. Use it to keep the infantry up with the tanks.',
    },
    {
      type: 'wave',
      when: { every: 150, from: 600, until: 2100 },
      side: 0,
      // They come up at the Don hills once those are ours, not 21 km back at the bridgehead (DECISIONS 436).
      forces: [
        { kind: 'at', count: 1, at: { point: 'P3' } },
        { kind: 'rifle', count: 3, at: { point: 'P3' } },
      ],
      announce: 'Rifle divisions are coming up behind the tanks.',
    },
    {
      type: 'wave',
      when: { phase: 'steppe', delay: 200 },
      side: 1,
      // Out of the Don hills onto the steppe by Perelazovsky, not from Sovetsky 17 km away (DECISIONS 436).
      forces: [
        { kind: 'tank', count: 4, x: 17500, behaviour: 'assault' },
        { kind: 'rifle', count: 8, x: 17700, behaviour: 'assault' },
        { kind: 'assault', count: 2, x: 17700, behaviour: 'assault' },
      ],
      announce: 'The 22nd Panzer Division is counter-attacking!',
    },
    {
      type: 'wave',
      when: { phase: 'steppe', delay: 400 },
      side: 1,
      forces: [{ kind: 'tank', count: 3, x: 19500, behaviour: 'assault', look: 'panzer3h' }],
      announce: 'Romanian armour on the steppe: their R-2 light tanks.',
    },
    { type: 'announce', when: { phase: 'steppe', delay: 500 }, text: 'A blizzard is blowing up over the steppe.' },
    { type: 'announce', when: { pointCapturedBy: 0, point: { point: 'P2' } }, text: 'Perelazovsky is ours, and a Romanian corps headquarters with it.' },
    // The motor-rifle battalion that came up here stood in for forward deploy: trained units now start at P2.
    { type: 'hint', when: { pointCapturedBy: 0, point: { point: 'P2' }, delay: 5 }, text: 'Deploy at Perelazovsky: the next wave starts there, not 13 km back.' },
    {
      type: 'wave',
      when: { pointCapturedBy: 0, point: { point: 'P2' }, delay: 5 },
      side: 1,
      forces: [
        { kind: 'tank', count: 3, x: 21700, behaviour: 'guard', look: 'panzer4g' },
        { kind: 'at', count: 2, x: 21500, behaviour: 'guard' },
        { kind: 'assault', count: 4, x: 21400, behaviour: 'guard' },
      ],
      announce: 'The main body of the 22nd Panzer Division is digging in on the Don hills.',
    },
    // The Front's guns and Il-2s on the 22nd Panzer's main body as it digs in (DECISIONS 436): the shells one at a time,
    // the Il-2s in the clear window before the blizzard (a raid after it is grounded).
    { type: 'announce', when: { pointCapturedBy: 0, point: { point: 'P2' }, delay: 90 }, text: 'The Front artillery is shelling the Don hills.' },
    { id: 'hillsGuns', type: 'barrage', when: { pointCapturedBy: 0, point: { point: 'P2' }, delay: 90 }, side: 0, x: 21300, spread: 450, rounds: 10, duration: 25, weapon: 'artilleryShell' },
    { id: 'hillsIl2', type: 'airRaid', when: { pointCapturedBy: 0, point: { point: 'P2' }, delay: 150 }, side: 0, support: 'airStrike', x: 21600 },
    { id: 'hillsIl2b', type: 'airRaid', when: { pointCapturedBy: 0, point: { point: 'P2' }, delay: 230 }, side: 0, support: 'airStrike', x: 21300 },
    {
      type: 'wave',
      when: { pointCapturedBy: 0, point: { point: 'P3' }, delay: 10 },
      side: 1,
      forces: [
        { kind: 'assault', count: 4, x: 24500, behaviour: 'guard' },
        { kind: 'rifle', count: 4, x: 24600, behaviour: 'guard' },
      ],
    },
    {
      type: 'announce',
      when: { pointCapturedBy: 0, point: { point: 'P3' } },
      text: 'The Don! The bridge at Kalach is ahead. Headlights on: drive as if you own the road.',
    },
    {
      type: 'hint',
      when: { pointCapturedBy: 0, point: { point: 'P3' }, delay: 3 },
      text: 'Go for the bridge at once with the fastest tanks, before they can blow it.',
    },
    // The demolition (FOUNDATIONS.md 4.4): at 180 s into the phase, unless P5 is ours by then (the wires are cut).
    { id: 'blowBridge', type: 'demolish', when: { phase: 'bridge', delay: 180 }, bridge: 1 },
    { type: 'banner', when: { structureDestroyed: { bridge: 1 } }, text: 'They have blown the Kalach bridge!', sound: 'alarm' },
    {
      type: 'hint',
      when: { structureDestroyed: { bridge: 1 }, delay: 3 },
      text: 'Infantry can wade the ford below the bridge. The tanks must wait for the pontoon the engineers are building.',
    },
    { id: 'pontoon', type: 'bridge', when: { structureDestroyed: { bridge: 1 }, delay: 180 }, bridge: 2 },
    { type: 'announce', when: { structureDestroyed: { bridge: 1 }, delay: 181 }, text: 'The pontoon bridge is across. Tanks over the Don!' },
    {
      type: 'wave',
      when: { phase: 'sovetsky', delay: 60 },
      side: 1,
      forces: [
        { kind: 'tank', count: 2, behaviour: 'assault' },
        { kind: 'rifle', count: 6, behaviour: 'assault' },
        { kind: 'assault', count: 2, behaviour: 'assault' },
      ],
      announce: 'A last-ditch German counter-attack from Kalach!',
    },
    // "On with the corps beside us" (DECISIONS 436): the 4th Tank Corps comes up over the Don for the last push, so a
    // brigade bled white at the bridge is not left facing the counter-attack alone.
    {
      type: 'wave',
      when: { phase: 'sovetsky', delay: 40 },
      side: 0,
      forces: [
        { kind: 'tank', count: 2, at: { point: 'P3' } },
        { kind: 'assault', count: 4, at: { point: 'P3' } },
        { kind: 'at', count: 2, at: { point: 'P3' } },
      ],
      announce: 'The 4th Tank Corps is over the Don beside us: on to Sovetsky together.',
    },
    { type: 'announce', when: { pointCapturedBy: 0, point: { point: 'P4' } }, text: 'Sovetsky! The tanks of the Stalingrad Front are close. Hold the town until they arrive.' },
    // The depot at Sovetsky fed every German unit west of the city: with the town lost it feeds no new ones (DECISIONS
    // 436), so the hold is fought against what is left, not a stream from the depot door.
    { type: 'income', when: { pointCapturedBy: 0, point: { point: 'P4' } }, side: 1, mul: 0 },
    {
      type: 'wave',
      when: { phase: 'linkup', delay: 40 },
      side: 1,
      forces: [
        { kind: 'rifle', count: 5, behaviour: 'assault' },
        { kind: 'assault', count: 3, behaviour: 'assault' },
        { kind: 'at', count: 1, behaviour: 'assault' },
      ],
      announce: 'The depot guard is trying to break out of the ring!',
    },
    // The hold is filled (DECISIONS 436): three breakout attempts over its 270 s, the last with the 22nd Panzer's last tank.
    {
      type: 'wave',
      when: { phase: 'linkup', delay: 130 },
      side: 1,
      forces: [
        { kind: 'rifle', count: 4, behaviour: 'assault' },
        { kind: 'lmg', count: 1, behaviour: 'assault' },
        { kind: 'assault', count: 2, behaviour: 'assault' },
      ],
      announce: 'Rear services from Kalach are trying to get out to the west!',
    },
    {
      type: 'wave',
      when: { phase: 'linkup', delay: 210 },
      side: 1,
      forces: [
        { kind: 'tank', count: 1, behaviour: 'assault' },
        { kind: 'assault', count: 4, behaviour: 'assault' },
      ],
      announce: 'A last panzer is leading a breakout!',
    },
    { type: 'announce', when: { objective: 'linkup' }, text: 'Green flares over Sovetsky. The tanks of the Stalingrad Front have seen them: the ring is closed.' },
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
      // Two kept, not three from 600 s (DECISIONS 436): the 22nd Panzer had fewer than thirty tanks and its waves bring
      // them.
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
  // 15 to 26 (DECISIONS 436; was 9 to 24): the bot takes about 18 minutes with every call-in and about 19 with none.
  expectedMinutes: [15, 26],
  music: STALINGRAD_MUSIC.missions[1009],
};
