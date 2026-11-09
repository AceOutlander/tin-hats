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

**Art the art job must add** (stand-ins today, so everything renders):

- SSh-40 helmet: a first simple shape (`ssh40Path` in src/art/figure/parts.ts); also the pilotka and ushanka headgear,
  greatcoat roll, telogreika, snow smocks.
- Small arms: Mosin-Nagant (drawn as `kar98`), Mosin with PU scope (`kar98Scoped`), DP-27 with its pan magazine
  (`bren`), PPSh-41 with its drum (`mp40`), PTRD-41 (`panzerschreck`), F-1 grenade (`mills`), TT-33 (`pistol`), the
  Maxim for the HQ gun (draws the German MG today).
- Vehicles: T-34/76 (Panzer IV rig with a Soviet turret), KV-1 (Churchill rig with a Soviet turret), T-60 (small tank
  rig), the Soviet Universal Carrier (British carrier with Soviet crew), a GAZ-AA truck (Bedford shape), the BM-13
  launcher if the salvo is to show its trucks.
- Aircraft: Il-2, Pe-2, Yak-1, Po-2 (the British shapes with a red star today).
- HQ stages: rain-cape tent, zemlyanka, log dugout, concrete DOT (British tent, big tent, dugout, bunker today); the
  plain red `sovietBanner` pennant (a plain red pennant colour today).
- A Katyusha HUD icon is drawn (three rockets); the art job may refine it.

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
- The campaign select job: play `STALINGRAD_MUSIC.map` on the Stalingrad map screen (today `MAP_MUSIC` in
  src/app/app.ts is always the British "Between the Lines").
- The prep phase (FOUNDATIONS): both tracks have a prep layer, heard once `app.setPrepPhase(true)` is called.
- Owner's lag report: battle music must be fully rendered at mission load, never mid-battle. Today the engine still
  renders a track after the battle starts (MUSIC.md, Budgets); moving that to the load screen is the engine's job and
  applies to these tracks unchanged.
