# Stalingrad: build status

What each part of the campaign has today, and what waits for which foundation feature (FOUNDATIONS.md).

## The mission director (FOUNDATIONS.md 3.1 to 3.4)

**In** (`src/sim/director.ts`, types in `src/data/schema.ts`; DECISIONS 309 to 320; tests
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
- **Points and structures** are references: `PointRef = { trench } | { point }` (a capture point, next section), `StructureRef = { trench } | { pillbox } | { wire } |
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
| 1006 Kurgan | hold | foot, slope, water tanks + summit, summit hold | destroy (the water tanks, buildings), 45 s prep at phase 4 with a zone, Stukas, Nebelwerfer, banner, AI hold on the summit; both tanks by 12 min, no assault gun survives |
| 1007 Pavlov's House | survival | take the house, day one, night one, day two, last night | capture with a 180 s deadline, prep after phase 0, pointLost (day one), Stuka raid, Katyusha for the last night, artillery cooldown 90 s; the trench stays open, no German inside; house health in the score |
| 1008 Tractor Factory | survival (scored as the brief's delay) | 3 x 420 s under the clock | enemyReached x 2,000 count 6, barrage, Stukas, heavy bomb, Nebelwerfer; machine shops at dark (`atEnd`), 25 tanks; kill bonus |
| 1009 Uranus | assault | Siren, steppe, Kalach bridge, Sovetsky | side 0's free barrages and Katyusha, Il-2 and Po-2 from phase 2, disguise, forward spawns, green flares on the objective; the bridge in 180 s (`withinPhase`), fifteen tanks |
| 1010 Ring | assault (surrender) | guns, Gumrak, ruins, Univermag | five free barrages, frozen tanks, German artillery cooldown 180 s, nests (hold postures), Nebelwerfer, last counter-attack, surrender at 25% with the closing words; Pitomnik in 8 min, Gumrak without a tank lost, under 28 min |

**Waits for** (other jobs build these on the director; capture points, forward spawns and Fall Back to them are in,
see "The long-map battlefield", buildings and floors, see "Buildings, rubble and cover props", and weather, time of
day and flares, see "Weather and time of day"); bridges, demolition and the ford (4.4: 1009's bridge, 1005's ferry
loads); loans by phase (7.2); `unlockKind`, `demolish` and
`spawnPointState` events; the AI aiming a counter-attack at its `point`; per-mission medal numbers tuned on real play;
mid-mission autosave and resume (FOUNDATIONS section 2, DECISIONS 320).

## The long-map battlefield (FOUNDATIONS.md 4.1, 4.2 and 4.5)

**In** (`src/data/ground.ts`, `src/sim/points.ts`, the ground tables in `src/sim/world.ts`; DECISIONS 321 to 330;
tests `tests/unit/sim-battlefield.test.ts`, `tests/unit/hud-battlefield.test.ts`). How a mission uses it:

- **`MissionDef.sectors: SectorDef[]`**, left to right: `{ from, to, ground, backdrop?, label?, heightBonus? }`. `ground`
  is a `GroundId` (`grass`, `field`, `steppe`, `road`, `cobble`, `forest`, `mud`, `sand`, `rock`, `snow`, `deepSnow`,
  `rubble`, `slopeUp` (rises toward +x), `slopeDown`, `water`); `GROUND` in `src/data/ground.ts` has each one's speeds
  (infantry and vehicles, each way), bullet cover (forest and rubble x0.85 for infantry in the open) and art (a winter
  mission draws open ground under snow). `heightBonus` multiplies the range of weapons fired from the sector (1006's
  summit 1.1). `label` names it on the minimap; `backdrop` is data only until the backdrop crossfade exists. No sectors
  = even ground, as before. The sim reads per-cell tables (one entry per 50 wu, built once); `setGround(w, from, to,
  ground)` rewrites a stretch during the battle (rubble). Sappers are not slowed.
- **`ForceDef.tags: ['skis']`**: deep snow does not slow these units (1004's ski troopers).
- **`MissionDef.capturePoints: CapturePointDef[]`**: `{ id: 'P1', x, width, label, owner (-1 nobody), captureTime (s;
  0 = at once), spawn, spawnFor?, contestRadius, structure? }`. Armed units alone in the zone for `captureTime` take
  it; with `structure: { trench }` or `{ building }` (MissionDef.buildings, held through the building's slot record)
  it goes with the structure. Name it in the director as `{ point: 'P1' }` (capture, hold, pointLost, pointCapturedBy, setOwner,
  assume, `ForceDef.at`).
- **Forward spawns**: an owned, uncontested spawn point with the enemy's front still ahead of it is where trained units
  walk out (the default is the forward-most one, else the HQ; the AI and the test bot use the default). The player picks
  with the "Deploy at" chip on the training bar (auto, HQ, each spawn point); sappers always use the HQ.
- **The hold line** is the forward-most owned trench, building or point (a trench or building in or ahead of the
  point's zone wins; a cover prop is never a line).
- **Fall Back** goes to the nearest available rally (spawn) point behind each man, or into the HQ within 2,500 wu of it.
- **Art and HUD**: snow, deep snow, rubble and steppe ground styles, a 200 wu blend between sectors, a flagpole with the
  holder's colours and a capture bar for each point, minimap shading by sector with the points' flags, the "Deploy at"
  chip, a capture sound for open-ground points.

**The missions on it:**

| Mission | Sectors | Capture points |
| --- | --- | --- |
| 1001 Brest | cobbles, Kholm Gate rubble, the bridge (road), South Island forest and grass | none |
| 1002 Dubno | fields, oak wood, Dubno's cobbles, the Ikva road | P1 the crossroads (15 s, open ground, forward spawn) |
| 1003 Volokolamsk | snow, the halt, frozen fields, birch wood | P1 the halt (trench 2), P2 the wood's edge (trench 3) |
| 1004 Klin | deep snow, fir forest, highway, Klin's rubble and cobbles | P1 the village (building B2), P2 forest edge, P3 highway (10 s); ski troopers |
| 1005 Volga | sand, the Volga (water), the high bank (slope), rubble, the station | P1 the landing (trench 1), P2 the riverside blocks (building B2) |
| 1006 Kurgan | rubble, the eastern slope, the summit (rock, heightBonus 1.1), the western slope | P1 the railway cutting (trench 2), P2 the summit (10 s, not a spawn) |
| 1007 Pavlov's House | the mill's rubble, the communication trench, 9 January Square | P1 the communication trench (trench 1) |
| 1008 Tractor Factory | rubble throughout (cliffs, halls, yard) | P2 the machine shops (building B3): forward spawn and Fall Back's rally point |
| 1009 Uranus (30,000 wu) | snow, the open steppe, the Don hills (slope), the Don, Kalach bridge (road), the road to Sovetsky | P1 to P3 Soviet spawns only (`spawnFor: 0`): the Romanian line (trench 3), Perelazovsky (building B2), the Don hills (10 s); P4 Sovetsky (trench 6: the map has no buildings in Sovetsky; not a spawn) |
| 1010 Ring | snow, the steppe, Pitomnik, Gumrak, the western ruins, the central square | P1 Pitomnik, P2 Gumrak, P3 the ruins (10 s each, open ground) |

**Waits for**: bridges (water stops vehicles at the bank,
FOUNDATIONS 4.4). Buildings are in (next section): the points that were "building later" are held through their
building, and a fallen building's footprint becomes rubble ground (DECISIONS 340).

## Buildings, rubble and cover props (FOUNDATIONS.md 4.3; DECISIONS 331 to 339)

**In.** The engine is `src/sim/buildings.ts`, its numbers `BUILDINGS` in `src/data/buildings.ts`, the art
`src/art/structures/buildings.ts` and `hqBuildings.ts` (layouts in `src/data/looksBuilding.ts`), the views
`src/render/buildings.ts`. Tests: `tests/unit/buildings.test.ts`, `art-buildings.test.ts`, the new columns in
`sim-matrix.test.ts`, and 1010 in `sim-budget.test.ts` (0.031 ms a tick; 1009 0.023 ms).

- **`MissionDef.buildings: BuildingDef[]`**: `id`, `x`, `width`, `floors` (1 to 4), `slotsPerFloor`, `hpMul` (x
  `BUILDINGS.hp` 1500), `owner` (-1 = nobody), `look`, optional `spawn` and `collapse` (`'rubble'` default, `'none'` =
  the walls take no damage). Looks: casemate, church, izba, house, apartment, station, factoryHall, waterTank, mill,
  store, hangar, sheds.
- **Occupancy** is the trench code's: each building's window slots are a slot record in `state.trenches` (id
  `BUILDINGS.idBase` 10000 + the building's id, `TrenchState.building` its index), appended after the mission's
  trenches. So infantry take it by entering it empty, `ForceDef.buildingId` seats men (with `behaviour: 'garrison'` they
  hold it), vehicles never enter, it is a hold line for the AI, the bot and Fall Back, and the bot and AI clear and take
  it as they do a trench. Slots fill the ground floor first; anti-tank teams climb to the top floor.
- **Points and structures**: `{ building: id }` is a `PointRef` (capture, hold, pointLost, `at` spawns, setOwner,
  `pointCapturedBy`) and a `StructureRef` (destroyed = taken from its first owner, or rubble; its health feeds
  `structureWeight`). New loss `{ type: 'contested', point }`: side 1 infantry inside a point side 0 holds
  (`BuildingState.contested`, `inside`).
- **Damage**: target classes `infantryBuilding` (bullet 0.15, explosive 0.7, antiTank 0.5) and `rubbleCover` (bullet
  0.4, explosive 0.9, antiTank 0.15) in `src/data/damage.ts`; every weapon's `targets` lists them with the infantry
  classes; the grenade and the mortar's dug-in preference count men in buildings as dug in. Fire (the flamethrower) on
  men at the windows is x1.8 (`FIRE_DAMAGE`) and burns them out of their slots. This is the Katyusha's second counter:
  its rockets do x0.7 to men inside.
- **Floors**: range x1.08 from floor 2 up (`upperFloorRange`); anti-tank weapons on the top floor of a building with 3
  or more floors standing do x1.3 to vehicles (`topFloorVsVehicles`, 1007).
- **Walls**: explosions damage the walls of buildings their side does not own (explosive x0.35, anti-tank x0.25 of the
  blast, bullets and fire nothing; the heavy bomb x6 and siege shell x3 more). The top floor falls each time health drops
  below its share (a 2-floor building loses its upper floor below half), hurting its men, who drop to a floor below if
  there is room. At 0 hp it is rubble: everyone is thrown out and hurt, and half the slots (at least one) give
  `rubbleCover`. `onCollapse(w, b)` then turns its footprint to `rubble` ground through `setGround` (slower going and
  bullet cover in the open, as a rubble sector; a mission with no sectors gets ground tables at that moment).
- **Cover props**: `MissionDef.props: CoverPropDef[]` (`wagons`, `ju52Wreck`, `he111Wreck`): rubble cover from the
  start, no damage, taken by entering, never a hold line; ids share the buildings' id space.
- **HQ look**: `SideStart.hqLook` draws the HQ as a Quartermaster style (`dugout`, `logDugout`, `bunkerGerman`, ...) or
  a mission building (`casemate`, `mill`, `store`, three damage states each). Names and art only.
- **Rendering**: dark interior strips under the men, a facade per standing floor and the roof over them, so men show at
  their floor's windows; damaged pieces at 60% health, a broken top once a floor falls, rubble stumps and a heap; the
  admin overlay marks buildings. Gallery: `dev/art-structures.html?sec=buildings`.

**The missions on it** (the stand-ins in each header are gone):

| Mission | Buildings, props, HQ look |
| --- | --- |
| 1001 Brest | B1 ring barracks and B3 Kholm Gate (casemates), B2 the club (church), 2 floors each; HQ casemate |
| 1002 Dubno | B1 to B4 houses (B3 held); HQ dugout |
| 1003 Volokolamsk | B1 the halt hut (station look), B2 and B3 izbas; HQ log dugout |
| 1004 Klin | V1's izbas B1 and B2 (P1 is B2), Klin's houses B3 to B5 and B8, church B6, station B7 (side objective); HQs log dugout and German bunker |
| 1005 Volga | riverside apartment blocks B1 to B4 (P2 is B2), station B5, nail factory B6; HQ log dugout |
| 1006 Kurgan | the water tanks B1 and B2 (were pillboxes; "take the water tanks"); HQ log dugout |
| 1007 Pavlov's House | B1 Pavlov's House, 4 floors x 7, two Germans inside; enemy blocks B2 to B4 (snipers in B2); `contested` side objective; the Stuka on the house; HQ the mill |
| 1008 Tractor Factory | assembly hall B1 (spawn), foundry B2, machine shops B3 (the heavy bomb takes its upper floor); wagons prop; HQ log dugout |
| 1009 Uranus | Perelazovsky B1 to B3 (P2 is B2, B3 the Romanian corps HQ), Kalach B4 and B5; HQ log dugout |
| 1010 Ring | Pitomnik hangar B1 and the Ju 52 and He 111 wrecks, Gumrak station B2 and sheds B3, ruins B4 to B9, the square B10 to B12; German HQ the Univermag (store) |

**Waits for**: `BuildingDef.spawn` is stored but not read: a building that is a forward spawn is a capture point with
`structure: { building }` (1004 P1, 1005 P2, 1008 P2, 1009 P2), and 1008's assembly hall has no point yet (DECISIONS
341); direct fire at walls (only blasts hurt them); men drawn at the windows of the mission HQ buildings (the HQ is not
a building with slots).

## Weather and time of day, and the Soviet theatres (FOUNDATIONS.md 4.1 and 4.7; DECISIONS 343 to 354)

**In.** The sim side is `src/sim/sky.ts` (state `BattleState.sky`, numbers `WEATHER_SIM` in `src/data/weather.ts`); the
view side `src/fx/sky.ts` (crossfades, drifting fields), `src/render/weather/sky.ts` (veils, particles, flares, the
time-of-day grade) and `src/render/backdrop.ts` (`BackdropExtras`: the skies of every time, the land tint, the second
theatre); the theatres in `src/data/theatres.ts` and `src/art/backdrops/theatres/russiaSummer.ts`, `stalingrad.ts`,
`steppe.ts`. Tests: `tests/unit/sim-weather.test.ts`, `tests/unit/fx-sky.test.ts`, the backdrop tests over every
theatre (`art-backdrops.test.ts`), and the 1009 case of `sim-budget.test.ts`. How a mission uses it:

- **`MissionDef.weather`** (`WeatherKind`: `clear`, `overcast`, `rain`, `snow`, `blizzard`, `fog`, `dust`, `smoke`)
  and **`timeOfDay`** are the start; **`MissionDef.nightVisibility`** overrides the night's 0.65 (a full moon 0.8).
  A mission with neither weather nor weather events is clear and plays exactly as before (tested), with the view's
  random rain; scripted weather turns the random rain off (scripted `rain` turns the streaks on).
- **Events**: `{ type: 'weather', to, over }` and `{ type: 'time', to, over }`: the sim switches at the midpoint, the
  view crossfades over the whole span. `{ type: 'flare', x, side?, seconds?, width?, color? }`: visibility 1 over
  `width` (1,500 wu) centred on x for `seconds` (20), for both sides; `color` white or green (the view's).
- **Visibility** (the lower of weather and time): fog 0.6, night 0.65, blizzard 0.7, dust 0.8, smoke 0.85, else 1. It
  caps the range at which direct-fire and hitscan weapons pick and keep a target, for both sides (units, the HQ gun,
  pillbox guns); a target inside a burning flare's stretch is seen at full range; lobbed weapons (mortars, grenades)
  are not limited.
- **Aircraft** (the air strike, bomber, fighter and recon plane) do not fly in fog or a blizzard, nor at night but for
  a nation's night flyers (`WEATHER_SIM.nightAir`: the Soviet recon plane, the Po-2). The player's button shows
  "Fog", "Storm" or "Night" instead of its clock; the AI cannot call them; a scripted `airRaid` does not fly either.
- **The blizzard** slows men on foot x0.9 (not vehicles, not sappers on the supply road) and multiplies every hitscan
  weapon's `accuracyFar` by 0.85.
- **The view**: a veil over the sky and the backdrop and a lighter one over the scene by weather; drifting fields of
  snowflakes, driven blizzard snow, dust clouds and grit, city smoke and ash, fog banks along the ground (existing FX
  sprites); flares sink under their parachutes with a halo and a pool of light (strong at night). A mission whose
  time of day changes paints its land in the brightest of its times and tints it darker for the others; its skies
  (sky, sun or moon, clouds) are painted for each time it passes through and crossfaded; the night tint follows.
- **Theatres**: `russiaSummer` (birch woods, rye, log izbas round an onion-domed church, telegraph poles), `stalingrad`
  (the Volga and its low east bank, gutted blocks, factory chimneys, the grain elevator, smoke columns; autumn) and
  `steppe` (a table-flat horizon with a railway and a goods train, balkas, haystacks, a post windmill, feather grass),
  each with a `winter` variant (`TheatreDef.winter`: palette, ground and foreground; painters lay snow on roofs, firs,
  ledges and drifts, and chimneys smoke) that a mission with `climate: 'winter'` gets (`theatreVariant`). The older
  theatres have no winter look and are unchanged. Gallery: `dev/art-backdrops.html?theatre=steppe&variant=winter`.
- **Two backdrops**: `SectorDef.backdrop` names a second theatre for some sectors; its far, mid and near strips fade in
  over 600 wu around each edge of those sectors by where the camera looks (the sky stays the mission's).
- **Admin panel**: the Weather and Time of day entries gain rows that change the sim's weather and time (over 10 s).

**The missions on it** (the stand-ins in each header are gone):

| Mission | Theatre | Weather and time |
| --- | --- | --- |
| 1001 Brest | russiaSummer | clear at dawn; phase 2: day over 60 s, smoke over 30 s |
| 1002 Dubno | russiaSummer | clear, day; dust from 60 s; dusk 400 s into the hold |
| 1003 Volokolamsk | russiaSummer winter | overcast; snow at phase 2; dusk at phase 3 |
| 1004 Klin | russiaSummer winter, then stalingrad winter for Klin | blizzard by night, a flare over the village at 200 s; snow and dawn in the forest; clear and day for the highway (the Il-2 flies) |
| 1005 Volga | stalingrad | smoke by night, the Germans' flares over the landing every 40 s; dawn at the station (Stukas from then), day for the hold; the high bank before first light (600 s) |
| 1006 Kurgan | stalingrad | overcast and smoke |
| 1007 Pavlov's House | stalingrad | smoke; night, day one, night one (flares), day two, the last night (flares, snow) |
| 1008 Tractor Factory | stalingrad | smoke; brick dust after the heavy bomb; smoke again, dusk, then night in the last phase |
| 1009 Uranus | steppe winter | fog at dawn (no air); clear and day from the steppe (the Il-2 window); blizzard at 500 s; night at the bridge (the Po-2 only); green flares over Sovetsky |
| 1010 Ring | steppe winter, then stalingrad winter for the city | snow, overcast; blizzard 300 to 420 s at Gumrak; clear in the ruins; dusk at the Univermag |

**Balance with the weather** (2026-11-09; missions, missions-design, stalingrad-m1001-1005, medals, missions-smoke and
difficulty all pass): bot wins over 16 seeds and median minutes 1001 16 (12.8), 1002 16 (19.1), 1003 15 (17.7), 1004 16
(14.1), 1005 16 (13.3), 1006 16 (18.4), 1007 16 (23.0), 1008 16 (22.0), 1009 16 (12.5), 1010 16 (13.9); the idle
commander loses every seed. 1009 and 1010 got quicker (20.8 and 20.0 before): the defenders' long sight is cut by fog,
snow and blizzard. 1001 needed the wave fix (DECISIONS 347), 1005 the dawn clock (348).

**Waits for**: searchlights (Seelow) and flares as a call-in (FOUNDATIONS 4.7); breath puffs on figures and the snow
on figures' shoulders; the sound of wind and snow (ambience by weather); the stalingrad theatre's own Klin (a small
Russian town in snow rather than the city's ruins).

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

- The Romanian nation (1009's Romanians field as German troops in the Romanian look, see "Era-correct forces" below).
  Unit tags are in (`ForceDef.tags: ['skis']`, see "The long-map battlefield").
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

**Balance on the moved checks** (`tests/balance/missions.test.ts`, `CAMPAIGN_RUNS.seeds` seeds each): since the mission
director (2026-11-09, on its phases) every mission passes every check, with missions-design, missions-smoke, medals,
difficulty and the campaign-order roster check too. Bot wins over 16 seeds and median minutes: 1001 16 (12.8), 1002 14
(18.0), 1003 16 (17.6), 1004 16 (15.4), 1005 16 (14.1), 1006 16 (17.9), 1007 14 (23.0), 1008 15 (22.0), 1009 16 (20.8),
1010 16 (20.0); the idle commander loses every seed of every mission. 1002 and 1007 sit at the 85 percent line (14 of
16). Before the director 1002, 1004, 1005, 1006, 1009 and 1010 failed (the idle commander undecided, the lines crossing
at the HQ door, too few bot wins, a 26-minute median).
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
