# Stalingrad: build status

What each part of the campaign has today, and what waits for which foundation feature (FOUNDATIONS.md).

## The mission director (FOUNDATIONS.md 3.1 to 3.4)

**In** (`src/sim/director.ts`, types in `src/data/schema.ts`; DECISIONS E1-1 to E1-12; tests
`tests/unit/sim-director.test.ts`, `tests/unit/hud-phase.test.ts`, `tests/unit/stalingrad-director.test.ts`, the 1009 case
of `tests/unit/sim-budget.test.ts`). This is the foundation the later jobs build on; how to write a mission with it:

- **`MissionDef.phases: PhaseDef[]`**, in order, the first is where the mission starts. A phase is
  `{ id, title (40 chars), objectives, sideObjectives?, lose?, timer?, prep?, onEnter?, next, assume? }`. All objectives
  done: the director enters `next`, or wins with `next: null`. A phase with no objectives never completes by itself. A
  mission without `phases` is one phase whose only objective is the enemy HQ (none without one) and plays as before.
  `MissionDef.timer` stays as a clock over the whole mission beside the phases (the survival missions keep theirs).
- **Objectives** (`ObjectiveDef`, each `{ id, text? }`): `destroyHq { side }`, `capture { point }`, `hold { point, seconds }`
  (unbroken; a loss starts it again), `survive { seconds }`, `kill { side, kinds?, count }` (the dead of that side over
  the whole mission), `destroy { structures }`, `reach { x, count, kinds? }`, `surrender { side, hqBelow }` (wins as a
  surrender). The HUD line is `text`, or a default by type.
- **Losses** (`PhaseDef.lose`, `LossDef`): `pointLost { point }` (after side 0 has held it), `enemyReached { x, count,
  kinds? }` (living enemies at or past x at once), `structureLost { structures }`, `lost { count, kinds? }` (own losses
  since the phase began). A phase timer `{ seconds, label, onExpire: 'complete' | 'lose' }`.
- **Side objectives** (`SideObjectiveDef { id, text, objective?, failIf?, within?, withinPhase?, atEnd?, until?, bonus }`):
  watched from their phase to the end; `bonus` is added to the 0..1 medal score (capped at 1).
- **Points and structures** are references: `PointRef = { trench }`, `StructureRef = { trench } | { pillbox } | { wire } |
  { hq }`. Capture points, buildings and bridges (FOUNDATIONS 4.3 to 4.5) add their members (`{ point }`, `{ building }`,
  `{ bridge }`) and teach `pointOwner`, `structureGone` and `structureHealth` in `src/sim/director.ts` about them.
- **Triggers** (`MissionTrigger`, added to the old four, on the mission clock that leaves out every prep phase): `phase
  { phase, delay? }`, `phaseEvery { phaseEvery, phase, from?, until? }`, `objective { objective, delay? }` (with no
  delay it fires on the very tick the objective is done, even the last one), `pointCapturedBy`, `kills { kills, side,
  kinds? }`, `structureDestroyed`, `enemyNear { x, dist, side }`. Every event may carry an `id`.
- **Events** (added to wave, airdrop, hint, announce): `banner { text, sound }`, `barrage { side, x, spread, rounds,
  duration, weapon, warning?, delay? }` (free, for any side; weapons `siegeShell`, `heavyBomb`, `nebelwerfer`, `mortar21`
  and the old shells), `airRaid { side, support, x }` (a free call-in), `income { side, mul }`, `posture { side, posture:
  hold | counterattack | free, point?, seconds? }`, `support { side, kind, enabled }` (with `SideStart.supportsOff` for a
  call-in offered later), `disguise { side, seconds, x0, x1 }`, `reveal { side, seconds }`, `setOwner { ref, owner }`,
  `endMission { winner, text }`.
- **Forces**: `ForceDef.at` (a wave comes in just behind a point its side holds: the forward spawn), `ForceDef.leash`
  (0 = a frozen or dug-in guard). `SideStart.supportCooldown` gives a call-in its own cooldown for the mission.
- **Prep at a phase's start**: `PhaseDef.prep` (as `MissionDef.prep`, with its own `bot` plan); the mission clock stops.
- **Spawning**: no wave appears behind the enemy line from any spawn (the HQ door too, which broke 1004 and 1006).
- **Commanders**: posture events steer the AI; the test bot attacks while a phase needs ground taken and holds when it
  only has to hold out.
- **HUD and tools**: the phase line under the objective plate ("Phase 2/3 · Hold the crossroads · Tanks destroyed 7 /
  12"), the phase's clock or its hold-out countdown, a banner and horn on each new phase, scripted banners; side
  objectives on the pause screen and the result screen; call-in buttons that come and go with `support` events; admin
  "jump to phase" (`AdminAction jumpPhase`, `PhaseDef.assume`) in the panel's Events section.
- **Medals** (`MissionMedalDef`): `scoring` (timed or fixed; default by mode: assault and special timed, survival, hold
  and delay fixed), `timedFrom` (a phase), `hqHealthWeight`, `structureWeight`, `killBonus`; the side objectives' bonuses.

**The missions on it** (each mission file's header says what it stands in for):

| Mission | Mode | Phases | Director features used |
| --- | --- | --- | --- |
| 1001 Brest | survival | 3 x 240 s under the 720 s clock | opening barrage, Nebelwerfer, siege mortar x2, 21 cm mortars; side objectives gate, StuGs |
| 1002 Dubno | delay | strike, hold the crossroads | capture, survive 600 + kill 12, enemyReached (x 5,000, then x 10,000), income x0.4, Stuka raid, artillery, overtime waves; Dubno by 6 min, twenty tanks |
| 1003 Volokolamsk | hold | 2 x 360 s holds, Katukov's tanks | pointLost (the halt), barrage, Stuka, Katyusha from phase 2, AI hold and counter-attack postures, capture + hold 150 s; no tank at the halt (until phase 3), ten tanks; timed from phase 3 |
| 1004 Klin | assault | village, forest, highway (+ hold 120 s), Klin | forward spawns (`at`), frozen panzers (leash 0), counter-attack posture, Il-2 from phase 3, hold for 240 s then free, artillery, the last counter-attack; the station, the highway in 20 min |
| 1005 Volga | special | landing (hold 180 s), high bank, station, hold the station | pointLost (landing), Nebelwerfer, Stukas, a 45 s prep at phase 4; battalion ashore (lost < 10), nail factory |
| 1006 Kurgan | hold | foot, slope, water tanks + summit, summit hold | destroy (pillboxes), 45 s prep at phase 4 with a zone, Stukas, Nebelwerfer, banner, AI hold on the summit; both tanks by 12 min, no assault gun survives |
| 1007 Pavlov's House | survival | take the house, day one, night one, day two, last night | capture with a 180 s deadline, prep after phase 0, pointLost (day one), Stuka raid, Katyusha for the last night, artillery cooldown 90 s; the trench stays open, no German inside; house health in the score |
| 1008 Tractor Factory | survival (scored as the brief's delay) | 3 x 420 s under the clock | enemyReached x 2,000 count 6, barrage, Stukas, heavy bomb, Nebelwerfer; machine shops at dark (`atEnd`), 25 tanks; kill bonus |
| 1009 Uranus | assault | Siren, steppe, Kalach bridge, Sovetsky | side 0's free barrages and Katyusha, Il-2 and Po-2 from phase 2, disguise, forward spawns, green flares on the objective; the bridge in 180 s (`withinPhase`), fifteen tanks |
| 1010 Ring | assault (surrender) | guns, Gumrak, ruins, Univermag | five free barrages, frozen tanks, German artillery cooldown 180 s, nests (hold postures), Nebelwerfer, last counter-attack, surrender at 25% with the closing words; Pitomnik in 8 min, Gumrak without a tank lost, under 28 min |

**Waits for** (other jobs build these on the director): capture points, forward spawn points and Fall Back to them
(FOUNDATIONS 4.5: `PointRef.point`); buildings and floors (4.3: 1008's heavy bomb knocking off a floor, 1007's top
floor bonus, `StructureRef.building`); bridges, demolition and the ford (4.4: 1009's bridge, 1005's ferry loads);
weather and time-of-day events (4.7: snow, blizzard, fog, flares); loans by phase (7.2); `unlockKind`, `demolish` and
`spawnPointState` events; the AI aiming a counter-attack at its `point`; per-mission medal numbers tuned on real play;
mid-mission autosave and resume (FOUNDATIONS section 2, DECISIONS E1-12).

## Soviet nation data (shared by every mission)

**In** (FOUNDATIONS.md section 5, NATIONS.md section 3):

- `FactionId` / `NationId` `'soviet'`: `FACTIONS.soviet` (Red Army; 1942 to 1943 unit and call-in names; tint `#7b7650` /
  `#4f4b31`, UI accent `#b3261e`; helmet `ssh40`, flag `sovietRed`, tank `t34`, heavy tank `kv1`; signature
  `conscript` and `katyusha`), speech lines, figure loadout, gear, HQ looks, FX, art layouts. Every table keyed by
  nation has a Soviet row (`tests/unit/nations.test.ts`).
- Signature unit `conscript`: 5 men per training order, cheap, frail, poor shots; counters LMG and mortar
  (`tests/balance/nations.test.ts`). `nationFields(nation, kind)` says who may field it.
- Signature call-in `katyusha`: a wide, inaccurate 16-rocket salvo, long cooldown (`tests/unit/sim-soviet.test.ts`).
  Missions offer it from mission 1003 on (first used 14 July 1941).
- Campaign registry `src/data/campaigns.ts` (`stalingrad`, ids 1001 to 1010, released: the only campaign since the British placeholders were removed).

**Waits for**:

- Unit tags (`ForceDef.tags: ['skis']`; Klin's ski troops have the `skiTroops` look but no deep-snow rule yet) and the
  Romanian nation (1009's Romanians field as German troops in the Romanian look, see "Era-correct forces" below).
- Buildings for the Katyusha's second counter (explosive x0.7 inside).
- The campaign theme field (`theme: 'sovietWinter'`; the map music field is in, see "Campaign select" below).

## Campaign select, the campaign map and the unlocks

**In** (DECISIONS 295 to 302; `tests/unit/campaign-select.test.ts`, `tests/unit/stalingrad-unlocks.test.ts`,
`tests/e2e/campaign-select.spec.ts`). Screenshots `docs/screenshots/stalingrad-select.png`, `stalingrad-map.png`,
`stalingrad-map-1943.png`, `stalingrad-briefing-1001.png` (local only).

- **Campaign select** (`src/ui/screens/campaigns.ts`, screen id `campaigns`): one dossier card per offered campaign in
  the registry's order, Stalingrad first: flag, name, dates, pitch, a tick per mission cleared ("2 / 10") and the next
  mission. Touch and keyboard (arrows, Enter, Escape); stacks in portrait under the rotate notice. Play opens it when
  more than one campaign is offered; with one (today: Stalingrad, since the British missions went) Play goes straight to the map.
  Unreleased campaigns show on the dev server, with `?unreleased=1`, or after the admin panel's unlock.
- **Campaigns in the app**: `App.campaigns` (every campaign and its missions), `App.offered`, `App.current`,
  `selectCampaign`; `Campaign.map` and `Campaign.mapMusic` in `src/data/campaigns.ts`. Saves keep each campaign's
  progress (`SaveRules.campaigns`), unit unlocks count every offered campaign, a battle puts its campaign on the map,
  Basic Training is played as the nation of the campaign on the map. Debug: `__TH.campaigns()`, `__TH.selectCampaign(id)`.
- **The Stalingrad map** (`src/data/campaignMapStalingrad.ts`, drawn by `src/ui/screens/mapPaint.ts` in the campaign
  map style): lon 22 to 47, lat 46 to 57.5; the Gulf of Riga, the Black Sea and the Sea of Azov; the Volga, Don,
  Dnieper, Pripyat, Bug and a stub of the Moskva; the Pripyat marshes; the brief's ten towns; the ten markers at Brest,
  Dubno, Dubosekovo, Klin, the central landing, Mamayev Kurgan, Pavlov's House, the Tractor Factory, the Serafimovich
  bridgehead (Uranus) and Pitomnik (the ring); locked, open, cleared and selected states; the briefing from a marker.
  The front line of the selected mission's date: 22 and 27 June 1941, 16 November and 5 December 1941, 13 September
  1942, 10 January 1943 with the pocket ringed. The map plays `STALINGRAD_MUSIC.map`.
- **Briefings**: every mission has `intel` (enemy forces with era names and rough numbers, our forces), shown between
  the objective and the orders; NEW UNIT cards only for what the mission unlocks.
- **Unlock order** (newUnit and unlocks in the mission files; each mission's list holds everything unlocked by then):

| Mission | Unlocks | Lent (not unlocked yet) |
| --- | --- | --- |
| 1001 Brest | DP Gunner, Tank Hunters (with sapper and rifleman) | 2 mortar crews (phase 2 wave) |
| 1002 Dubno | T-34, Mortar Crew | (none) |
| 1003 Volokolamsk | PPD Trooper (the anti-tank kind is the PTRD Team by date) | sniper, sanitarka |
| 1004 Klin | Sanitarka, Militia Squad (conscripts) | (none) |
| 1005 Volga | ROKS-3 Flamethrower | (none) |
| 1006 Mamayev Kurgan | Sniper, AA Gun Crew | (none) |
| 1007 Pavlov's House | Lieutenant | (none) |
| 1008 Tractor Factory | (none) | (none) |
| 1009 Uranus | Universal Carrier | (none) |
| 1010 Ring | (none) | (none) |

**Waits for**: the city inset for the four city markers (they are pushed apart with leaders), tuning the first-cut
Stalingrad medal targets on real play (DECISIONS 306), the campaign theme field, unlock rules after a mission of
another campaign (Road to Berlin; `unlock.afterMission` is read by the cards but no campaign uses it), and a card
for the save's "Continue" strip (mid-mission resume).

## The British placeholder missions removed (owner, docs/QUEUE.md; DECISIONS 303 to 308)

**In**:

- Missions 1 to 10 (m01 to m10), their briefings, medal targets, map markers and tests are gone. `MISSIONS` is the
  Stalingrad campaign; `CampaignId` is `'stalingrad'`; Stalingrad is released and the only campaign, so Play goes
  straight to its map and the map's Back goes to the title (the select screen returns with a second campaign).
- Kept for later campaigns: the ten British battle tracks and "Between the Lines", every backdrop, the British nation,
  and the western map (`WEST_MAP` in src/data/campaignMap.ts, used by no campaign). The matchup harness has its own
  base mission with the old values; the engine tests use the test field fixture (`tests/unit/fixtures.ts`).
- Save version 10: medals, upgrades, bought planes, Basic Training and settings kept; every unit type the British
  missions had unlocked stays unlocked (added to the `armoury` list from `META.legacyCampaign`); the British clears
  and wins archived in `legacy`; `lastMission` 1 to 10 becomes 0. `tests/unit/meta-save-british.test.ts`.
- First-cut medal targets for 1001 to 1010 (`MEDALS.missions`, from bot runs).
- The tests that looped over the old missions loop over the Stalingrad ones (DECISIONS 307 lists them and what was not
  carried over). New balance file `tests/balance/missions-design.test.ts`.

**Balance on the moved checks** (`tests/balance/missions.test.ts`, 2026-11-09, `CAMPAIGN_RUNS.seeds` seeds each): 1001, 1003, 1007 and 1008
pass every check. Failing: 1002 (the idle commander leaves one seed undecided at the 40-minute cap; known before),
1004 (a battle breaks the "lines never cross" invariant at tick 22938, near the enemy HQ; known before), 1005 (the
bot wins too few seeds; known before), 1006 (the same invariant breaks at tick 20446; first time checked), 1009 (the
bot's median win takes about 26 minutes against the expected 9 to 24) and 1010 (the idle commander leaves seeds
undecided at the cap). Tuning these is not part of the removal job.
The medals run (the campaign in order, seed 1) wins all ten and buys a sensible set of upgrades.

**Unit test waiting for the music job**: `tests/unit/music-score.test.ts` "give every campaign mission a track of its
own" now checks the Stalingrad missions and fails here (7 distinct tracks for 10 missions: 1001 to 1005 still play
British tracks, 1006 to 1010 share `factories` and `volokolamsk`). The Stalingrad battle tracks being composed on the
`stalingrad` branch (`STALINGRAD_MUSIC.planned`) give every mission its own; it should pass after the merge.

**Browser specs run** (port 4183, the other job holds 4173): campaign-select, tutorial, campaign, armoury and sandbox pass,
but for the proving ground's "wins ground" test, which failed twice in different places under load (it plays the
unchanged sandbox mission). Not run: missions, smoke, polish, the music specs, admin-panel, phase1-shots, pwa, perf,
upgrade-looks, menu-music. The keen player of `playToEnd` holds the line in a survival mission (Brest is the first).

**At push to live** (not before): update the Tin Hats card text on hunteracedev.com so it describes the game as a
whole instead of the old British campaign (owner, docs/QUEUE.md). The live site's save players migrate to version 10
on their first load.

**Soviet art: drawn** (no British or German stand-ins left; `tests/unit/art-soviet.test.ts` guards it). Screenshots in
`docs/screenshots/stalingrad-art-*.png` (local only).

- Soldiers (src/art/figure/soviet.ts): the SSh-40, the skatka greatcoat roll over the shoulder, the duffel bag, the
  belt with the two-cell pouch, bread bag and spade. Small arms: Mosin-Nagant 1891/30 with the spike bayonet, the
  Mosin with the PU scope, the DP-27 with its pan, the PPSh-41 with its drum, the 82 mm mortar, the PTRD-41, the TT-33
  (the officer's pistol, `tt33`), the F-1 grenade and the PTRD round.
- Headgear (`setFigureHeadgear`, FIGURE_HEADGEAR): pilotka, ushanka, the SSh-40 over the ushanka, and the snow smock's
  white hood (`snowHood`).
- Winter clothing (`setFigureClothing(anim, 'telogreika' | 'snowSmock')`, FIGURE_CLOTHING in src/data/looksGear.ts):
  the quilted telogreika (torso and sleeves) and the white two-piece snow smock (torso, sleeves and thighs; the dark
  valenki and shins still show). Drawn in place of the body sprites, so the figure keeps its rim and its 38 parts.
- Vehicles (src/art/vehicles): the T-34/76 (./t34), the KV-1 model 1941 on a rig of its own (./kv: six small road
  wheels, three return rollers, the welded turret with the rear DT, the ZiS-5; upgrade gear: track links, the 1941
  bolted screens, sandbags, turret box, pintle DT, long ZiS-5), the T-60 on a rig of its own (./t60: four road wheels,
  the driver's cab, the faceted turret and the long 20 mm TNSh; drawn a little over life size like the other light
  tanks), the Lend-Lease Universal Carrier with a Soviet crew, a red star and a DP on the mount (now a gear look, so
  the APC upgrades show), the GAZ-AA supply truck (tall rounded cab, upright radiator shell, swooping Ford-pattern
  wing, lamps on stalks) for the dump and haul looks.
- Aircraft (./sovietPlanes, same boxes and anchors as the other nations' types, so the plane upgrades show): Pe-2
  (glazed nose, long greenhouse canopy, long nacelles, twin oval fins), Yak-1 (pointed spinner, razorback, belly
  radiator), Po-2 (fabric biplane, open cockpits, the bare radial), and the Il-2 Shturmovik for the air strike
  (`AIR_STRIKE_PLANE` in src/data/artLayout.ts; the sky pool picks the calling side's plane with `airStrikeKey`).
- HQ: the four stages (rain-cape tent, zemlyanka, log dugout, concrete DOT) and the gun positions; the heavy gun is the
  Maxim M1910/30 (the big winter filler cap) on the Sokolov mount with its shield. The flag `sovietRed`; the trench
  pennant `sovietBanner` is the plain red cloth (`pennant.soviet` in src/data/artLayout.ts), as NATIONS.md asks. The
  Katyusha HUD icon (three rockets) is drawn.

**Drawn and registered for a later job to select** (no data selects them yet):

- The BM-13 Katyusha launcher on the ZiS-6 (`KATYUSHA_LAUNCHER_KEY`, `BM13_LAYOUT`: rail pivot, angle and length); in
  the vehicle atlas. The salvo still flies in from off screen; showing the trucks is the call-in's job.
- Not drawn: the RGD-33 grenade, the ROKS flamethrower (the shared flamethrower stands in), the 37 mm 61-K AA gun (the
  AA crew works the DP), the T-70 and KV-1S (the T-60 and T-34 stand in, under their own names), and the 1943 looks
  (shoulder boards, camouflage suits).

## Era-correct forces by date (FOUNDATIONS 5.1 and 5.2)

**In** (`src/data/eras.ts`, `src/data/equipment.ts`; DECISIONS 287 to 294; `tests/unit/eras.test.ts` and
`tests/unit/art-era.test.ts` guard it). Screenshots in `docs/screenshots/stalingrad-era-*.png` (local only).

- The era table `NATION_ERAS` for every nation: missions carry `dateIso` and `climate`, and each nation's names and
  looks merge by date over its defaults. Missions without a date (the British campaign, the proving ground, Basic
  Training) are unchanged. The HUD, mission cards, admin panel, unit portraits, figures, tanks and planes read it.
- Soviet 1941 (1001 to 1004): PPD Trooper (the PPD-40), Militia Squad, ROKS-2, the I-16 fighter; "Tank Hunters" (a
  Mosin and a petrol bottle) until October, the PTRD Team from November; the BT-7 as the summer light tank (T-60 from
  October); the T-26 and the KV-2 at Dubno by force look. 1942 (1005 to 1010): today's names, the ROKS-3.
- Soviet looks by date and climate: the pilotka for the rear kinds in summer 1941 and 1942; in the winter missions (1003,
  1004, 1009, 1010) the helmet over the ushanka at the front, the ushanka behind, the telogreika for all, snipers in
  the snow smock and hood, Klin's ski troops (`skiTroops`) in white.
- German 1939 to 1941: the short Panzer IV, the Panzer III Ausf. E (`lightTank`), the Ausf. H with the short 5 cm and
  the StuG III Ausf. B by force look (Brest's battery, Dubno, Volokolamsk, Klin). Mid-1942 on: the later Panzer III
  (Ausf. L: long 5 cm, spaced plates on mantlet and bow, no skirts) is the era's tank; the Panzer IV Ausf. G (long
  7.5 cm) and the StuG III Ausf. F by force look. The anti-tank kind is the PzB 39 Team until October 1943 (no
  Panzerschreck). Infantry: no winter kit in 1941; white helmet covers and the white winter suit (front-line kinds) in
  November 1942; covered helmets only in the pocket (1010).
- `ForceDef.look` (vehicle variants and infantry looks), `ForceDef.nation` and `SideStart.rosterNation` reach the units
  (`UnitState.look`, `UnitState.faction`); names and art only. The Romanian line of 1009 fields as German troops in the
  Romanian look (khaki-brown greatcoat, Adrian helmet, Romanian names); its R-2s are the `panzer3h` stand-in.
- The equipment table: the service window of every vehicle, small-arms, aircraft and infantry look; the test resolves
  every Stalingrad mission's rosters, forces, waves and call-ins for both sides.
- Art: the T-26 (./t26) and BT-7 (./bt7) rigs; the KV-2, Panzer III Ausf. H and L, Panzer IV Ausf. G and StuG III
  Ausf. B and F (./germanEra) on their rigs' running gear (`VEHICLE_LOOK_RIG`); the I-16 (`aircraftLookKey`); the PPD,
  the PzB 39 and the bottle (src/art/figure/eraWeapons.ts); the German helmet cover, the Adrian helmet and the
  Romanian greatcoat. Dev previews: `dev/art-structures.html?sec=tanks&looks=t26,bt7,kv2`,
  `dev/art-figures.html?mode=sheet&nations=soviet,german&mission=1004`.

**Waits for**: the Romanian nation (its R-2, ZB vz. 30, its own HQ), the Pak and Flak 88 gun-crew looks (`pak36`,
`pak40`, the 8.8 cm in the ground role), the Pz 38(t), Opel Blitz and MG42 looks, per-battle atlas pages for the era
sprites (they add about 4.8 MB to the boot atlas), unit tags (`skis`), and era looks for the British (no British
mission has a date yet).

## Music (theme, battle tracks, map track)

**In** (docs/MUSIC.md, "The Soviet motif and the cold tracks"):

- Theme "The Long Winter" (`sovietWinter`: `SOVIET_MOTIF`, `SOVIET_ANSWER` in src/data/musicThemes.ts). Three bars
  plus a one-bar answer (the brief's rhythm adds up to twelve beats); one phrase changed from the brief because it
  matched Korobeiniki.
- The cold kit (`src/data/musicTracks/sovietKit.ts`) with two new battle instruments, `choir` and `wind`, and a
  high-pass on the reverb return (`mix.reverbHighpass`).
- Battle track `volokolamsk` ("First Snow on the Highway", the 1941 snow) and `factories` ("The Cold Furnaces", the
  Stalingrad ruins), both with a prep layer, both PASS the battle music report (mix against the army of 80), within
  the memory budget and quicker to render than Arras (see MUSIC.md for the numbers).
- Map track `stalingradMap` ("Versts of Snow") in `MUSIC_TRACKS`.
- The table `STALINGRAD_MUSIC` (src/data/musicCampaigns.ts): mission writers set `music: STALINGRAD_MUSIC.missions[id]`.

| Mission | Plays today | The brief's own track (to compose) |
| --- | --- | --- |
| 1001 Brest | `volokolamsk` | `brest` (D minor, 112) |
| 1002 Dubno | `volokolamsk` | `dubno` (A minor, 132) |
| 1003 Volokolamsk | `volokolamsk` | (its own) |
| 1004 Klin | `volokolamsk` | `klin` (F# minor to A major, 126) |
| 1005 Volga crossing | `factories` | `volga` (C minor, 118) |
| 1006 Mamayev Kurgan | `factories` | `kurgan` (G minor, 128) |
| 1007 Pavlov's House | `factories` | `pavlov` (B minor, 104) |
| 1008 Tractor Factory | `factories` | (its own) |
| 1009 Uranus | `volokolamsk` | `uranus` (A minor to C minor, 140) |
| 1010 Ring | `factories` | `ring` (E minor to E major, 124) |

**Waits for**:

- Eight more battle tracks, so that no two missions share one (QUEUE "Music for the new campaigns"). Each is a plan
  file on the cold kit like the two above; the brief's music paragraph of each mission says what it should be.
- (Done by the campaign select job: the Stalingrad map, briefing, Quartermaster and Armoury play
  `STALINGRAD_MUSIC.map` through `Campaign.mapMusic`; `MAP_MUSIC` in src/app/app.ts is the British map's track.)
- The prep phase (FOUNDATIONS): both tracks have a prep layer, heard once `app.setPrepPhase(true)` is called.
- Owner's lag report: battle music must be fully rendered at mission load, never mid-battle. Today the engine still
  renders a track after the battle starts (MUSIC.md, Budgets); moving that to the load screen is the engine's job and
  applies to these tracks unchanged.
