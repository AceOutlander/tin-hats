# Stalingrad: build status

What each part of the campaign has today, and what waits for which foundation feature (FOUNDATIONS.md).

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
- Campaign registry `src/data/campaigns.ts` (`stalingrad`, ids 1001 to 1010, unreleased).

**Waits for**:

- Era-by-date names and looks (`NationEraDef`, FOUNDATIONS 5.1): today one set of 1942 to 1943 names (PPSh Trooper,
  PTRD Team, T-60, Universal Carrier). Missions 1001 to 1004 (1941) need the era table for PPD, militia, "Tank
  Hunters" until 1941-11, T-26 and BT-7, KV-2, the I-16 and the pilotka and ushanka looks.
- Per-force look and tags (`ForceDef.look`, `tags: ['skis']`) and `SideStart.rosterNation`: Romanians in 1009 field as
  German troops until the Romanian nation exists.
- The equipment test (`src/data/equipment.ts`, FOUNDATIONS 5.2).
- Buildings for the Katyusha's second counter (explosive x0.7 inside).
- The campaign select screen, campaign map (bounds lon 22 to 47, lat 46 to 57.5), theme and map music fields.

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

- The 1941 and winter looks: the pilotka, the ushanka, the helmet over the ushanka, the telogreika, the snow smock and
  hood. The headgear and clothing setters exist; the era table (`NationEraDef`, FOUNDATIONS 5.1) or a weather or
  mission field must call them per unit (for example the snow smock for snipers and scouts in the winter missions).
- The KV-2 (1941, Dubno): `KV2_KEYS` (turret and 152 mm howitzer, worn on the KV-1 rig) with `KV2_TURRET` (turret box,
  trunnion in turret space, gun length). Fielding it needs a vehicle look that swaps turret, trunnion and barrel.
- The BM-13 Katyusha launcher on the ZiS-6 (`KATYUSHA_LAUNCHER_KEY`, `BM13_LAYOUT`: rail pivot, angle and length); in
  the vehicle atlas. The salvo still flies in from off screen; showing the trucks is the call-in's job.
- Not drawn: the 1941 T-26, BT-7 and I-16, the PPD, the RGD-33 grenade, the ROKS flamethrower (the shared flamethrower
  stands in), the 37 mm 61-K AA gun (the AA crew works the DP), and the 1943 looks (shoulder boards, camouflage suits).

## Music (theme, battle tracks, map track)

**In** (docs/MUSIC.md, "The Soviet motif and the cold tracks"):

- Theme "The Long Winter" (`sovietWinter`: `SOVIET_MOTIF`, `SOVIET_ANSWER` in src/data/musicThemes.ts). Three bars
  plus a one-bar answer (the brief's rhythm adds up to twelve beats); one phrase changed from the brief because it
  matched Korobeiniki.
- The cold kit (`src/data/musicTracks/sovietKit.ts`) with two new battle instruments, `choir` and `wind`, and a
  high-pass on the reverb return (`mix.reverbHighpass`).
- Six battle tracks, each with a prep layer, each PASSing the battle music report (mix against the army of 80) within
  the memory and render budgets (see MUSIC.md for the numbers): `volokolamsk` ("First Snow on the Highway", the 1941
  snow), `factories` ("The Cold Furnaces", the Stalingrad ruins), `brest` ("Four in the Morning"), `dubno` ("Iron in
  the Rye"), `klin` ("Forty Below") and `volga` ("The Far Bank").
- Map track `stalingradMap` ("Versts of Snow") in `MUSIC_TRACKS`.
- The table `STALINGRAD_MUSIC` (src/data/musicCampaigns.ts): every mission file sets
  `music: STALINGRAD_MUSIC.missions[id]` (1001 to 1005 played British stand-ins until now), and
  `tests/unit/music-soviet.test.ts` fails if two missions on their own tracks share one.

| Mission | Plays today | Key, tempo | Its own track |
| --- | --- | --- | --- |
| 1001 Brest | `brest` | D minor, 112 | written |
| 1002 Dubno | `dubno` | A minor, 132 | written |
| 1003 Volokolamsk | `volokolamsk` | E minor, 120 | written |
| 1004 Klin | `klin` | F# minor to A major, 126 | written |
| 1005 Volga crossing | `volga` | C minor, 118 | written |
| 1006 Mamayev Kurgan | `factories` (stand-in) | G minor, 128 | `kurgan`, to compose |
| 1007 Pavlov's House | `factories` (stand-in) | B minor, 104 | `pavlov`, to compose |
| 1008 Tractor Factory | `factories` | D minor, 136 | written |
| 1009 Uranus | `volokolamsk` (stand-in) | A minor to C minor, 140 | `uranus`, to compose |
| 1010 Ring | `factories` (stand-in) | E minor to E major, 124 | `ring`, to compose |

**Waits for**:

- Four more battle tracks (`kurgan`, `pavlov`, `uranus`, `ring`), so that no two missions share one (QUEUE "Music for
  the new campaigns"). Each is a plan file on the cold kit like the six above; the brief's music paragraph of each
  mission says what it should be. Writing one: register it, move its id from `planned` to `missions` in
  `STALINGRAD_MUSIC`, and the distinct-track test then covers it.
- The campaign select job: play `STALINGRAD_MUSIC.map` on the Stalingrad map screen (today `MAP_MUSIC` in
  src/app/app.ts is always the British "Between the Lines").
- The prep phase (FOUNDATIONS): every cold track has a prep layer, heard once `app.setPrepPhase(true)` is called.
- Owner's lag report: battle music must be fully rendered at mission load, never mid-battle. Today the engine still
  renders a track after the battle starts (MUSIC.md, Budgets); moving that to the load screen is the engine's job and
  applies to these tracks unchanged.
