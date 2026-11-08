# Soviet campaign: Stalingrad (June 1941 to February 1943)

Campaign id `stalingrad`, missions 1001 to 1010, built straight after the foundations (`FOUNDATIONS.md`). Nation data
in `NATIONS.md` (Soviet, German, Romanian); sources and the equipment-by-date table in `HISTORY.md`.

## Campaign

- **Card**: "Stalingrad: June 1941 to February 1943. From the first morning at Brest to the ruins on the Volga."
- **Flag**: the Soviet red flag with the gold hammer and sickle and the gold-edged star (the state flag of the time).
  HQ pennants show a plain red banner. The 1942 pattern regimental colour (red, gold-fringed, star and unit
  number) appears as the victory flourish in mission 10.
- **Map region**: lon 22 to 47 E, lat 46 to 57.5 N. Land shapes: the western USSR from the Bug to the Volga. Rivers
  drawn: Bug, Pripyat marshes as a shaded area, Dnieper, Don, Volga, Moskva (stub). Labels: Brest, Minsk, Kiev,
  Moscow, Kalinin, Klin, Voronezh, Rostov, Stalingrad, Kalach. Pins: the ten missions. The Stalingrad pins (5 to 8 and
  10) sit within 10 km of each other, so the map shows a city inset (Volga, Mamayev Kurgan, the factories, the central
  landing, the Univermag) when the camera reaches mission 5.
- **Theme**: "The Long Winter" (`sovietWinter`, in `musicThemes.ts`), an original two-bar motif in natural minor:
  `0 (1) 0 (.5) -1 (.5) 0 (2) | 3 (1.5) 2 (.5) 4 (1) 3 (1) 2 (1) -3 (3)`. It is level and hushed, steps up to the
  minor third, reaches the fifth, and falls a fourth below the tonic to end open on the low dominant. Its answer climbs
  back `-3 0 2 3 0`. Forms: muted horn over a pad (cold, distant), low brass unison (grim), bells and high string
  harmonics (ice), and in mission 10 a full major-colour statement. The composer must check it against well-known
  Russian and Soviet tunes ("Polyushko-pole", "Svyashchennaya voyna", "Katyusha", "Korobeiniki", "Kalinka") and change
  any phrase that comes close.
- **Cold sound for every Soviet track** (owner: "Russian battles should sound cold"): sparse open fifths and fourths
  in the strings, glassy high tremolo, bell and anvil used as icy percussion (short, high, little reverb mass), a long
  bright reverb tail with the low end thinned, low brass in unison rather than full chords, timpani dry. The driving
  battle feel (snare, ostinato strings, minor keys) stays.
- **Map track**: `stalingradMap`, a slow, reflective variant of the theme for the between-missions screen (like
  "Between the Lines").
- **Theatres needed** (new, in `theatres.ts`):
  - `russiaSummer`: birch and pine woods, rye fields, wooden izbas, an onion-dome church, telegraph poles.
  - Its `winter` variant: snow-laden firs, smoke from chimneys, a pale sky.
  - `stalingrad`: gutted apartment blocks, factory chimneys, the grain elevator on the skyline, smoke columns, the
    Volga as a far strip. Variants `autumn` (smoke and dust) and `winter` (snow on the ruins).
  - `steppe`: flat open land, balkas (gullies), haystacks, a distant railway. Variant `winter`.
- **Units the player fields**: see `NATIONS.md`. In short:
  - 1941: Mosin rifles, DP-27 gunners, PPD troopers, militia conscripts, 50 mm and 82 mm mortars, snipers with the PE
    scope, medics.
  - "Tank Hunters" (grenade bundles and bottles) until the PTRD arrives in November 1941.
  - T-26 and BT-7 (light), T-34/76, KV-1 and KV-2 (heavy).
  - The Katyusha from mission 3 (first used 14 July 1941).
  - 1942: PPSh-41, PTRD/PTRS, ROKS-3 flamethrowers, T-60 and T-70, KV-1S, the two-seat Il-2.
  - Lend-Lease Universal Carriers as the APC from 1942.

### Enemy roster by date (German, plus Romanian in mission 9)

| Missions | Date | Infantry | Anti-tank | Armour | Air and guns |
| --- | --- | --- | --- | --- | --- |
| 1 Brest | 22 Jun 1941 | Kar98k, MG34, MP40, GrW 34, pioneers with FmW 35/41 | none needed | StuG III Ausf. B battery (2) | 10.5 cm guns, 21 cm mortars, Nebelwerfer 41, 60 cm Karl siege mortar (scripted); no air on the first day (the only documented raids were Ju 88s on 29 June) |
| 2 Dubno | 27 Jun 1941 | same | Pak 36, a few Pak 38, 8.8 cm Flak in the ground role | Panzer III Ausf. E (3.7 cm), Panzer III with 5 cm, Panzer IV Ausf. D/E (short 7.5 cm), Panzer II as scouts | Ju 87, Bf 109F |
| 3 Volokolamsk | 16 Nov 1941 | same | Pak 36, Pak 38 | Panzer III (5 cm), Panzer III Ausf. E still possible (owner window to Dec 1941), Panzer IV short, StuG III | Ju 87 |
| 4 Klin | Dec 1941 | same, no winter clothing | Pak 38 | a few Pz 38(t) and Panzer IV (the 7th Panzer Division had no Panzer IIIs), several frozen in place | sparse |
| 5 to 8 Stalingrad city | Sep to Oct 1942 | Kar98k, MG34 and MG42, MP40, GrW 34, pioneers with FmW 41, snipers | Pak 38, Pak 40, Hafthohlladung magnetic charges | Panzer III Ausf. J and L (5 cm long), Panzer IV Ausf. F2/G (long 7.5 cm), StuG III Ausf. F | Ju 87 (ever present), He 111, Nebelwerfer, 8.8 cm Flak |
| 9 Uranus | 19 to 23 Nov 1942 | Romanian: Mannlicher and ZB rifles, ZB vz. 30 LMG, 37 mm Pak; German 22nd Panzer | Pak 38/40 | Romanian R-2 (Czech LT vz. 35); German Pz 38(t), Pz III, Pz IV | little air (fog) |
| 10 Ring | Jan 1943 | the 6th Army in greatcoats and improvised winter wear; MG42, MP40 | Pak 40, Flak 88 | a few Pz III/IV and StuG, mostly out of fuel | no air support; Nebelwerfer |

**No Tiger or Panther anywhere in this campaign.** The first Tigers were at Mga near Leningrad from late August
1942. None were inside the Stalingrad pocket; the nearest were outside it with the 503rd from January 1943.

### How "mighty" the Germans are (setup only)

Brest and Dubno: overwhelming fire support (Stukas every 90 to 120 s, the opening barrage, siege guns), more men, the
initiative. Volokolamsk: more tanks than the player has anti-tank weapons, until the PTRDs and Katukov's tanks arrive.
Klin: the Germans are thin and frozen, the first turn of the tide. Stalingrad city: the Germans own the air and bring
tanks and pioneers; the player owns the ruins and the far bank's guns. Uranus and Ring: the player has the mass.
Enemy income never exceeds the player's (FOUNDATIONS 9.2).

### Era note for loans

The player may not have bought anti-tank, mortar or assault troops yet. The loans below cover every phase with tanks
or strongpoints. In 1941 the Soviet anti-tank kind is the "Tank Hunter" (grenade bundles), from mission 3 the "PTRD
Team".

---

## Mission 1: Brest Fortress (tutorial)

- **Id** 1001, key `brest`. **Date** 22 June 1941 (`1941-06-22`), the first day of the invasion. **Place** the
  citadel of Brest-Litovsk, 52.083 N, 23.656 E. **Mode** survival, with a prep phase. **Length** about 13 minutes
  (60 s prep plus 12 min). **Map** 7,000 wu. **Climate** temperate, theatre `russiaSummer`.
- **History**: the 45th Infantry Division (Generalmajor Fritz Schlieper, about 17,000 men) assaulted the fortress from
  about 04:15 Moscow time. It had no tanks of its own, but had a StuG battery lent by the 34th Division, Karl siege
  mortars, Nebelwerfers and flamethrowers. About 9,000 Soviet soldiers and NKVD border guards of the 6th and 42nd Rifle
  Divisions were inside, many of them in barracks with their families. Organised resistance ended at the East Fort on
  29 June after heavy bombing; scattered fighting went on into July. The "32 days" and the wall inscription dated
  20 July are post-war traditions: legend, not established fact.

### Briefing (a captain of the 6th Rifle Division)

1. It is a little after four in the morning. The guns opened up across the Bug without warning and the west of the
   fortress is burning. The Germans are already on the islands and coming over the bridges. Nobody has told us
   anything, so we will fight with what we have.
2. The walls of the ring barracks are a metre and more of brick and earth. Get the men inside, put the machine gun in
   the Kholm Gate where it sweeps the bridge, and keep the sappers carrying ammunition from the stores. A wall is worth
   ten men in the open.
3. Their infantry will come first, then assault parties with flamethrowers, then the heavy guns. Hold the citadel
   through the day and make them pay for every courtyard.

**Objective**: Hold the citadel until nightfall.

### Map and sectors

| x (wu) | Sector | Ground | Structures |
| --- | --- | --- | --- |
| 0 to 2,600 | Ring barracks | cobble | player HQ (look `casemate`); building B1 ring barracks (x 1,500, 2 floors, 6 slots each); building B2 the garrison club, a former church (x 2,250, 2 floors, 5 slots) |
| 2,600 to 3,600 | Kholm Gate | rubble | building B3 Kholm Gate (x 3,100, 2 floors, 6 slots, owner 0) |
| 3,600 to 4,400 | Mukhavets | water | bridge 1 (x 3,700 to 4,300) |
| 4,400 to 7,000 | South Island | grass, forest | enemy entry edge |

### Forces

- **Player**: 2 sappers; 6 riflemen in B1; 4 riflemen and 1 DP gunner garrisoning B3; 200 Money; HQ hp x1.0.
  Trainable: sapper, rifle (free), plus whatever the Armoury holds. Supports: artillery barrage only from phase 3
  (the guns behind the citadel recover).
- **Loans**: 1 DP gunner (start), 3 Tank Hunters (phase 3), 2 mortar teams (phase 2): "from the 84th Regiment's
  stores".
- **Enemy (no HQ, waves from the right)**: riflemen, MG34 teams, MP40 troopers, Granatwerfer teams, pioneers with
  flamethrowers (job 7 `flame`), 2 StuG III Ausf. B (the `tank` kind with the `stug3b` look; no turret). Scripted call-ins
  only.

### Phases and events

0. **Prep (60 s)**: barbed wire and sandbag walls, zone 900 to 3,500 (FOUNDATIONS 7.3).
   - Hint: "Sappers build during the prep phase. Wire in front of the gate slows their infantry."
1. **"The first morning"** (survive 240 s).
   - 0 s: barrage (side 1, x 2,500, spread 900, 14 rounds over 8 s), banner "Artillery!".
   - 6 s: wave of 6 riflemen.
   - Then every 25 s: 4 riflemen.
   - 60 s and 150 s: 2 MG34 teams plus 4 riflemen.
   - 120 s: "assault boats", 6 MP40 troopers.
   - Hints: buildings (soldiers inside take a fraction of rifle fire), Money and sappers, Hold, more sappers.
2. **"Assault parties"** (survive 240 s).
   - Time dawn to day over 60 s; weather `smoke` over 30 s.
   - 20 s: Stuka raid on B3 (`airRaid`, side 1, airStrike).
   - 40 s and 140 s: 2 pioneers with flamethrowers plus 4 MP40 troopers plus 1 MG.
   - 90 s: 2 Granatwerfer teams plus 6 riflemen.
   - Hints: flamethrowers burn men out of buildings, so shoot them at range; mortars (loaned) answer mortars.
3. **"The guns"** (survive 240 s).
   - 10 s: banner "Assault guns on the bridge!"; 2 StuG III with 6 riflemen.
   - 90 s and 180 s: siege mortar, `barrage` weapon `siegeShell` with 1 round, warning 4 s, banner "Heavy siege
     mortar: get clear!".
   - 120 s: Ju 87 raid on the HQ.
   - Final waves every 20 s from 150 s.
   - Hints: Tank Hunters must get close, so strike the assault guns from the flanks or rear (job 7 front/rear armour);
     Fall Back shelters everyone while the siege shells land.

### Side objectives

- **The Kholm Gate holds**: B3 never captured (+15%).
- **Knock out both assault guns** (+10%).

### Medals

Fixed scoring. Target casualties 25. HQ health weight 0.3.

### Music, weather, time

- **Music**: `brest` (new). D minor, 112 BPM. Opens with a single high violin tremolo and distant timpani, like a
  morning shattered. The build layer is a cold pulse of open fifths. The combat layer is a driving snare with low brass
  stabs. The theme appears as a muted horn in the quiet section. The prep layer is a ticking rim-shot with a rising
  string pedal. The defeat sting ends on a bare fifth.
- **Weather and time**: clear, dawn turning to day, smoke haze from phase 2.

### How a sensible player wins on Normal

1. Two more sappers at once.
2. During prep, wire in front of the Kholm Gate and sandbags at the bridge foot.
3. Keep B1 and B3 full of riflemen, with the DP gunner in B3's upper floor.
4. Train riflemen steadily and use the loaned mortars on the Granatwerfer teams.
5. In phase 3, wait for the StuGs to close on the gate. Send the Tank Hunters along the barracks to hit them side-on,
   and Fall Back on each siege-mortar warning.

Expected 12 to 13 minutes (fixed).

---

## Mission 2: Dubno

- **Id** 1002, key `dubno`. **Date** 27 June 1941 (`1941-06-27`). **Place** Dubno, Volhynia, 50.42 N, 25.73 E.
  **Mode** delay. **Length** about 22 minutes. **Map** 22,000 wu. **Theatre** `russiaSummer`.
- **History**: the largest tank battle of 1941 (Dubno, Lutsk and Brody, 23 to 30 June). Soviet mechanised corps of
  the Southwestern Front (Kirponos) counter-attacked Panzer Group 1 (Kleist). On 27 June Brigade Commissar Popel's
  group of the 8th Mechanized Corps, built around the 34th Tank Division, attacked alone at 14:00 and took Dubno,
  cutting the panzers' supply road. The rest of the corps never arrived, the group was encircled, and Soviet tank
  losses were catastrophic. Sources disagree widely on tank numbers (about 2,500 to 3,500 Soviet against about 750
  German). The German 11th and 16th Panzer Divisions fielded Panzer IIIs with both 3.7 cm and 5 cm guns, and Panzer
  IVs with the short gun. 8.8 cm Flak guns were used against KVs.

### Briefing (a tank officer of the 34th Tank Division)

1. The order came at dawn: we turn south-west and strike for Dubno. Half the corps is strung out behind us, broken
   down or dry of fuel, and the German bombers have had the sky to themselves since Sunday. We go with what is running.
2. Their panzers have raced ahead of their infantry and their columns. The Panzer IIIs are quick and well handled,
   but their small guns bounce off our KVs. The eighty-eights do not, so find them first. Our T-34s are the best
   tanks on this field; spend them wisely.
3. One corps cannot throw the enemy back across the border. We can cut his road at Dubno, burn his tanks and hold him
   until dark, so the armies behind us can form a line. Destroy twelve of his tanks and keep him off the crossings.

**Objective**: Take Dubno, destroy 12 German tanks, and hold until dark.

### Map and sectors

| x (wu) | Sector | Ground | Structures |
| --- | --- | --- | --- |
| 0 to 3,000 | Assembly area | field | HQ (look `dugout`) |
| 3,000 to 9,000 | Rye fields | field | trench T1 (x 7,500, German, 6 slots); Flak 88 pair at 8,600 (guard) |
| 9,000 to 12,500 | Oak wood | forest | |
| 12,500 to 16,000 | Dubno | cobble | buildings B1 to B4 (houses, 1 to 2 floors); capture point P1 "Dubno crossroads" (x 14,500, 15 s, spawn) |
| 16,000 to 22,000 | The Ikva road | road | enemy HQ (supply column park) at 21,850 |

### Forces

- **Player**: 3 sappers; 2 KV-1 and 1 KV-2 (`heavyTank`, looks `kv1` and `kv2`); 4 T-34/76; 3 BT-7 (`lightTank`);
  8 riflemen; 1 DP gunner; 400 Money. Population at start about 62. Supports: artillery (one battery).
  No Soviet air.
- **Loans**: 3 Tank Hunters (start, resend 120 s in phase 2); 2 mortar teams (start).
- **Enemy**:
  - HQ with income no higher than the player's.
  - Start: T1 garrison (6 riflemen, 1 MG34, 1 Pak 36 crew as `at` with the look `pak36`).
  - 2 Flak 88 guarding the crossroads approach (`aaGun`, German signature: engages vehicles).
  - 2 Panzer III Ausf. E and 2 Panzer II scouts patrolling the fields.
  - In Dubno: 6 riflemen and 1 MG in houses.
  - AI build: riflemen, MG, Pak, Panzer III E, Panzer IV D. Waves below.
  - Supports: Stuka every 100 s from 60 s (airStrike), artillery.

### Phases and events

1. **"Strike for Dubno"** (capture P1).
   - 30 s: hint "The KV's armour stops their guns. The eighty-eight does not: kill it with mortars or infantry first."
   - 240 s: wave of 3 Panzer III E plus 6 riflemen from the right, announced "A panzer company is coming back up the
     road."
   - On capturing T1: announce "Their supply columns are on the road ahead!"
2. **"Hold the crossroads"**: survive 600 s; kill 12 tanks, counted over the whole mission. Lose if 8 enemies get
   past x 10,000.
   - Phase start: `income` side 0 x0.4 ("The road behind us is cut. Fuel and shells will be short.").
   - 30 s, 180 s, 330 s and 480 s: panzer counter-attacks, each of 2 Panzer III E, 1 Panzer IV D and 6 riflemen, the
     last one with 2 more Panzer IIIs.
   - 120 s: Stuka raid; 250 s: artillery on Dubno.
   - 400 s: time to dusk over 90 s.
   - If 12 tanks are not yet dead when the timer ends, the phase continues until they are, with waves every 60 s.

### Side objectives

- **Dubno by six minutes**: capture P1 within 360 s (+15%).
- **Twenty tanks** (+10%).

### Medals

Fixed scoring (delay). Target casualties 45 (tanks count 5 or 8). Kill bonus above 12.

### Music, weather, time

- **Music**: `dubno` (new). A minor, 132 BPM, heavy and mechanical but cold. Anvil and low string ostinato like
  tracks. The combat layer has brass in unison on the theme, augmented. A summer heat shimmer is given by high
  sustained strings with a narrow tremolo (still glassy, not warm).
- **Weather and time**: hot, dust (visibility 0.8 when tanks move: weather `dust` from 60 s), day to dusk.

### How a sensible player wins on Normal

1. Mortars and Tank Hunters with the riflemen take T1.
2. Mortar the Flak 88s from beyond their reach while the KVs hang back.
3. Use the BT-7s to run down the Panzer IIs. Capture Dubno with infantry in the houses and the tanks behind them.
4. In phase 2, hold the houses. Park the KVs hull-on at the crossroads; T-34s flank the Panzer III Es from the wood.
   Keep Tank Hunters in the buildings.

Expected 20 to 24 minutes.

---

## Mission 3: The Volokolamsk Highway

- **Id** 1003, key `volokolamsk`. **Date** 16 November 1941 (`1941-11-16`). **Place** the railway halt at
  Dubosekovo, south-east of Volokolamsk, 55.98 N, 36.07 E. **Mode** hold, with a prep phase. **Length** about 20
  minutes. **Map** 16,000 wu. **Theatre** `russiaSummer` winter variant.
- **History**:
  - The 316th Rifle Division (Major General Ivan Panfilov), raised in Alma-Ata and largely Kazakh and Kyrgyz, held a
    41 km front of Rokossovsky's 16th Army from mid-October. Volokolamsk fell on 27 or 28 October.
  - The first snow fell on 7 October; the mud stopped the Germans; by mid-November the ground froze and the panzers
    rolled again.
  - On 16 November the 2nd Panzer Division attacked the 1075th Regiment at Dubosekovo and overran it.
  - PTRD anti-tank rifles had just been issued to the division.
  - Katukov's tank brigade, made the 1st Guards Tank Brigade on 11 November, fought on the same axis.
  - Panfilov was killed on 18 November; the division became the 8th Guards Rifle Division.
  - The story of the "28 Panfilov men" destroying 18 tanks was shown by a 1948 Soviet prosecutor's inquiry to be
    largely invented. The mission depicts the real battle, not the legend, and names no individuals.

### Briefing (a battalion commander of the 1075th Rifle Regiment)

1. The snow came early this year and the mud with it, and for a month the Germans sat in it. Now the ground has
   frozen hard and the panzers can roll again. Behind us is the highway, and at the end of the highway is Moscow.
2. Most of you came from Alma-Ata and Frunze, from the steppe and the mountains, and you have held them for a month
   already. This week the division gave us something new: long anti-tank rifles that can hole a Panzer's side at close
   range. Fire them from the trenches and let the tanks come near.
3. Dig in at the railway halt, wire the approaches and set the steel obstacles across the road. Hold until our tanks
   come up from the rear, then throw the Germans back to the edge of the wood.

**Objective**: Hold the railway halt, then retake the wood's edge.

### Map and sectors

| x (wu) | Sector | Ground | Structures |
| --- | --- | --- | --- |
| 0 to 3,000 | Nelidovo village | snow | HQ (look `logDugout`); 2 izbas |
| 3,000 to 6,500 | Dubosekovo halt | snow | trenches T1 (x 4,200, 8 slots) and T2 (x 5,600, 8 slots), owner 0; building B1 the halt hut; capture point P1 "the halt" (x 5,000, structure T2) |
| 6,500 to 9,500 | Frozen fields | snow | |
| 9,500 to 12,000 | Birch wood | forest (snow) | trench T3 (x 9,800, German); capture point P2 "wood's edge" (spawn) |
| 12,000 to 16,000 | German start | snow | enemy HQ at 15,850 |

### Forces

- **Player**: 3 sappers; 10 riflemen in T2; 2 DP gunners in T2; 1 PTRD team; 1 sniper; 350 Money. Supports:
  artillery, smoke, and the Katyusha (Soviet signature) from phase 2.
- **Loans**: 4 PTRD teams (start); 2 mortar teams (start); 1 medic.
- **Enemy**:
  - HQ, income at most the player's. Start: T3 garrison (6 riflemen, 2 MG34).
  - Waves from 2nd Panzer Division: Panzer III with 5 cm (`tank` look `pz3h`), Panzer III Ausf. E (`lightTank`),
    Panzer IV short, StuG III B; riflemen, MP40, mortars, Pak 38.
  - Supports: artillery, Stuka (fewer as the weather closes).

### Phases and events

0. **Prep (60 s)**: wire, foxholes, tank traps (the steel "hedgehogs" of the Moscow defences), a trench; zone
   3,000 to 6,400.
1. **"The morning attack"**: survive 360 s; lose if P1 is lost.
   - 0 s: German barrage on T2.
   - 30 s: 4 tanks (2 Panzer III, 1 Panzer III E, 1 Panzer IV) plus 8 riflemen.
   - 60 s: Stuka.
   - 150 s: 2 StuG plus 6 MP40.
   - 250 s: 3 tanks plus 2 MG plus 8 riflemen.
   - Hints: PTRD teams kill tanks from the side; tank traps stop vehicles.
2. **"They come again"**: survive 360 s; lose if P1 is lost.
   - Phase start: weather `snow` over 60 s; Katyusha enabled, hint "The Katyusha rocket battery: a salvo over a
     wide area, slow to reload."
   - 40 s: 6 tanks plus 10 infantry.
   - 160 s: Pak 38s and mortars set up at 8,000 (`posture: 'hold'`) to shell the halt.
   - 260 s: the last big push, 5 tanks plus 12 infantry.
3. **"Katukov's tanks"** (capture P2).
   - Phase start: wave side 0 at x 2,500: 3 T-34/76 and 1 KV-1, announce "Tanks of the 1st Guards Tank Brigade are up
     from the rear."
   - Time to dusk over 120 s.
   - The German posture turns to `counterattack` at P2 when it falls (90 s).

### Side objectives

- **No tank reaches the halt**: no enemy vehicle past x 5,200 in phases 1 and 2 (+15%).
- **Ten tanks** (+10%).

### Medals

Fixed scoring for phases 1 and 2, then timed for phase 3: use `scoring: 'timed'`, target 21 minutes, target
casualties 40.

### Music, weather, time

- **Music**: `volokolamsk` (new). E minor, 120 BPM. First snow: celesta-like bell figures over string harmonics in
  the build layer. The combat layer is a march-like snare with low brass, with the theme inverted in the horns. The
  prep layer is a slow timpani heartbeat with rising open fifths.
- **Weather and time**: overcast and frosty, snow from phase 2; day to dusk.

### How a sensible player wins on Normal

1. During prep, put tank traps across the road at 6,000 and wire at 5,900.
2. PTRD teams sit in T2 and riflemen fill T1 and T2; mortars stay behind T1.
3. The sniper kills the MG teams.
4. Save the Katyusha for the massed infantry behind the tanks.
5. When the T-34s arrive, advance behind them with the PTRDs to take the wood's edge.

Expected 20 to 23 minutes.

---

## Mission 4: The Moscow counter-offensive: Klin

- **Id** 1004, key `klin`. **Date** 6 to 15 December 1941; the mission depicts the push on Klin
  (`1941-12-12`). **Place** Klin, 56.33 N, 36.73 E. **Mode** assault. **Length** about 26 minutes. **Map** 26,000 wu.
  **Theatre** `russiaSummer` winter variant, with the `stalingrad` theatre's winter variant reused for the town ruins
  in the last sector.
- **History**:
  - The Kalinin Front attacked on 5 December and the Western Front on 6 December.
  - Klin, the anchor of the 3rd and 4th Panzer Groups' salient north-west of Moscow, was encircled on 13 December and
    liberated on 15 December (371st and 365th Rifle Divisions, 30th Army).
  - Temperatures: official lows about -29 °C in December, with unofficial readings far lower.
  - The Germans had no proper winter clothing (more than 130,000 frostbite cases).
  - Several divisions came from the Far East, but the "Siberians saved Moscow" story is overstated: most of the
    December armies were fresh reserves raised in European Russia.
  - Ski battalions fought in the forests.

### Briefing (a regimental commander of the 371st Rifle Division)

1. For five months we have given ground. Tonight we take some back. The Germans stand thirty kilometres from Moscow
   with frozen engines, and their men are wrapped in blankets and summer boots. They expected to be in the city by now;
   instead they are out in our winter.
2. The whole front attacks at once. Our road is to Klin, where their panzer groups have their depots and their way
   home. The ski battalions go first, through the forest in the dark; the frost is thirty below, and every village they
   hold is a stove they will not want to leave.
3. Take the villages one by one and use them as stepping stones; your reinforcements can come up to any you hold.
   Cut the highway and the railway, then take Klin.

**Objective**: Advance through the forest, cut the highway and take Klin.

### Map and sectors

| x (wu) | Sector | Ground | Structures |
| --- | --- | --- | --- |
| 0 to 3,000 | Assembly in the forest | deepSnow | HQ (`logDugout`) |
| 3,000 to 8,000 | Snowfields | deepSnow | village V1: buildings B1 and B2 (izbas, German garrison); capture point P1 (x 7,000, spawn, structure B2) |
| 8,000 to 14,000 | Fir forest | forest (snow) | trench T1 (x 11,000, German, 7 slots); capture point P2 "forest edge" (x 13,200, spawn) |
| 14,000 to 19,000 | Highway and railway | road, snow | wire at 15,000; trench T2 (x 16,500, German); capture point P3 "the highway" (x 17,000, spawn) |
| 19,000 to 26,000 | Klin | rubble, cobble | buildings B3 to B8 (houses, a church, the railway station); enemy HQ at 25,850 (look `bunkerGerman`) |

### Forces

- **Player**: 4 sappers; 10 riflemen; 6 ski troopers (`assault` with the `skis` tag: deep snow does not slow them);
  2 DP gunners; 1 T-34/76; 1 T-60 (`lightTank`); 600 Money. Supports: artillery, smoke, Katyusha, and from phase 3
  the Il-2 (airStrike).
- **Loans**: 2 mortar teams (start); 3 PTRD teams (phase 2); 4 conscripts squads (phase 1, "the militia battalion").
- **Enemy**:
  - HQ with low income (at most the player's; mission `incomeMul` 0.7). Start garrisons: V1 (8 riflemen, 1 MG34),
    T1 (6 riflemen, 1 MG, 1 Granatwerfer), T2 (6 riflemen, 2 MG, 1 Pak 38).
  - Klin: 12 riflemen in houses, 2 MG, 2 mortars, 1 Pak 38, 2 Panzer III and 1 Panzer IV, of which 2 are frozen in
    place (`behaviour: 'guard'`, leash 0).
  - AI build: riflemen and MGs, rarely tanks.
  - Supports: artillery; no air in blizzard.

### Phases and events

1. **"Night approach"** (capture P1). Weather `blizzard` (visibility 0.7), time night (0.65).
   - 60 s: hint "Ski troops cross deep snow at full speed."
   - 200 s: flare event over V1 (20 s visibility 1.0).
2. **"Through the forest"** (capture P2).
   - Phase start: weather to `snow` over 120 s; time to dawn over 180 s.
   - 120 s: counter-attack from T1 (`posture: 'counterattack'` at P1, 6 riflemen and 1 Panzer III).
   - Hint: "Deploy at the village: your new troops start there."
3. **"Cut the highway"**: capture P3, then hold it 120 s.
   - Phase start: weather `clear` over 60 s, time day; Il-2 enabled.
   - 60 s: German column on the highway (2 trucks as `apc` with the `opelBlitz` look, 8 riflemen, 1 Panzer IV).
4. **"Klin"** (destroy the enemy HQ).
   - Phase start: the German posture is `hold` for 240 s (they wait in the houses).
   - 200 s: artillery on the player's front.
   - At enemy HQ hp below 50%: the last counter-attack, of every German unit.

### Side objectives

- **The station**: capture building B7 (+10%).
- **Under 20 minutes to the highway**: P3 by 1,200 s (+15%).

### Medals

Timed: target 27 minutes, target casualties 55.

### Music, weather, time

- **Music**: `klin` (new). F# minor rising to A major in the last section, 126 BPM. The coldest and brightest track:
  sleigh-like high bells (`bell`, short), a pad of open fifths, and a snare and timpani march building toward
  triumph. The theme is in the low brass in its "answer" form (rising).
- **Weather and time**: blizzard to snow to clear; night to dawn to day.

### How a sensible player wins on Normal

1. Ski troops and riflemen take V1 at night. Mortars stay behind.
2. Deploy at V1 and march the next wave through the forest to T1, using smoke before the trench.
3. PTRDs and the T-34 meet the counter-attack. Cut the highway with artillery on T2 and Katyusha on its reserves.
4. In Klin, house by house: mortars and assault troops on each building; Il-2 on the frozen tanks.

Expected 24 to 28 minutes.

---

## Mission 5: Crossing the Volga

- **Id** 1005, key `volga`. **Date** night of 14 to 15 September 1942 (`1942-09-15`). **Place** the central landing
  stage, Stalingrad, 48.709 N, 44.527 E. **Mode** special (river crossing, then assault and hold). **Length** about 21
  minutes. **Map** 12,000 wu. **Theatre** `stalingrad` (autumn variant).
- **History**:
  - The 13th Guards Rifle Division (Major General Alexander Rodimtsev, about 10,000 men, about 1,000 of them without
    rifles) crossed under fire overnight on 14 to 15 September 1942 on Volga Flotilla boats, barges and anything that
    floated.
  - The vanguard was the 1st Battalion of the 42nd Guards Regiment.
  - The German 71st Infantry Division was pushing to the river in the centre. The central railway station was fought
    over room by room for days; Lieutenant Anton Dragan's small group held part of it for nearly three weeks. Claims
    that it "changed hands 15 times" are not well sourced.
  - The Volga at the city is commonly given as one to two kilometres wide; sources vary.
  - The Luftwaffe owned the daylight; crossings soon went night-only.

### Briefing (a battalion commander, 42nd Guards Rifle Regiment)

1. Guardsmen, the city is burning from end to end and the Germans are almost at the river. If they take the central
   landing, the army over there has no door left. Tonight we cross.
2. There are not enough boats and not enough rifles. Some of you will land with grenades and nothing else; take a
   rifle from the first man who no longer needs it. The guns on this bank and the rocket batteries will fire for us.
   The boats will keep coming, one load at a time.
3. Get off the sand and up the bank before it is light. Clear the houses along the river, then take the railway
   station and hold it. Every hour we hold the centre, another regiment gets across.

**Objective**: Land, clear the river bank and hold the central station.

### Map and sectors

| x (wu) | Sector | Ground | Structures |
| --- | --- | --- | --- |
| 0 to 2,500 | East bank (Krasnaya Sloboda) | sand | HQ (`logDugout`), dump |
| 2,500 to 4,500 | The Volga | water | no bridge |
| 4,500 to 6,000 | Landing stage and high bank | sand, slope | capture point P1 "central landing" (x 4,700, owner 0, spawn, `batchEvery` 40 s: the ferry) |
| 6,000 to 9,000 | Riverside blocks | rubble | buildings B1 to B4 (apartments, 3 to 4 floors; B1 and B2 German-held); capture point P2 (x 7,400, structure B2, spawn) |
| 9,000 to 12,000 | Central station | rubble, cobble | building B5 the station (x 10,200, 2 floors, 10 slots each); B6 a nail factory hall; enemy HQ at 11,850 |

### Forces

- **Player**: 3 sappers (east bank). At the landing: 10 riflemen, 4 PPSh troopers (`assault`), 1 DP gunner.
  120 Money; `incomeMul` 0.75. Trained units cross with the ferry. Supports: artillery and Katyusha from the east bank.
- **Loans**: 4 PPSh troopers (start); 2 PTRD teams (phase 3); 1 flamethrower (phase 2, ROKS-3).
- **Enemy**:
  - HQ (71st Infantry Division), `incomeMul` 0.7. Start: B1 and B2 (6 riflemen, 2 MG42 each), the station (8 riflemen,
    2 MG), B6 (4 riflemen, 1 mortar).
  - Waves: Panzer III Ausf. J, StuG III Ausf. F, pioneers with flamethrowers.
  - Supports: Stuka every 90 s from daylight, artillery, Nebelwerfer (artillery-style barrage).

### Phases and events

1. **"The landing"**: hold P1 for 180 s; lose if P1 is lost. Time night.
   - Flares every 40 s over the landing (the enemy lights it up).
   - 20 s and 100 s: MG teams fire from B1 and B2; counter-attack of 8 riflemen from B1.
   - 60 s: barrage on the river: the next ferry load loses 30% (scripted).
   - Hint: "New troops arrive with each boat. Hold the landing until the battalion is ashore."
2. **"The high bank"** (capture P2).
   - Phase start: hint "Buildings work like trenches and pillboxes. Grenades and flamethrowers clear them."
   - 120 s: Nebelwerfer barrage on B2.
3. **"The station"** (capture B5). Time to dawn over 120 s, then the Stukas begin.
   - 90 s: 2 Panzer III J plus 8 riflemen.
   - 200 s: StuG plus 6 MP40.
4. **"Hold the station"**: prep 45 s (sandbags in the windows, wire); hold B5 for 240 s.
   - 30 s, 120 s and 200 s: counter-attacks, with 2 tanks in the second.

### Side objectives

- **The whole battalion ashore**: lose fewer than 2 ferry loads (+10%).
- **The nail factory**: capture B6 (+10%).

### Medals

Timed: target 22 minutes, target casualties 45.

### Music, weather, time

- **Music**: `volga` (new). C minor, 118 BPM. Night water: a low pad with slow tremolo, oar-like hand-drum figures in
  the build layer, distant timpani like artillery across the river. The combat layer has urgent strings and brass, the
  theme fragmented (`take: 3`). The tense layer is a clock-like rim-shot.
- **Weather and time**: smoke; night to dawn to day.

### How a sensible player wins on Normal

1. Keep everything at the landing until two ferry loads are in.
2. PPSh troopers and the flamethrower take B1, then B2. Katyusha on the station's reserves.
3. Deploy at P2. Mortars on the station; riflemen go in behind grenade attacks.
4. PTRDs in the station windows for the tanks. Use the prep to wire the doors.

Expected 20 to 23 minutes.

---

## Mission 6: Mamayev Kurgan

- **Id** 1006, key `kurgan`. **Date** 18 September 1942 (`1942-09-18`). **Place** Height 102.0, Stalingrad,
  48.7425 N, 44.5369 E. **Mode** hold (assault, then hold with prep). **Length** about 24 minutes. **Map** 14,000 wu.
  **Theatre** `stalingrad` (autumn).
- **History**:
  - The German 295th Infantry Division took the hill on 13 to 14 September.
  - The 13th Guards and the 112th Rifle Division's 416th Regiment retook part of it on 16 September.
  - Colonel Gorishny's 95th Rifle Division crossed and took the summit on 18 September, then lost more than 5,000 men
    in a week holding it.
  - From late September Batyuk's 284th Rifle Division held the slopes. The summit and its water tanks became no-man's
    land, then German-held, until January 1943.
  - From the crest you can see the whole city and the river crossings.
  - Vasily Zaitsev, the sniper, served in Batyuk's division here.

### Briefing (a regimental commander of the 95th Rifle Division)

1. From the top of Height 102 you can see the whole city, the river and every boat that crosses it. While the Germans
   sit up there, nothing moves on the Volga by day. We crossed last night and we go straight up.
2. The slope is bare and churned with shell holes, and the railway curls round its foot. Use the holes as trenches.
   On the crest stand two water tanks the Germans have turned into blockhouses; grenades and the flamethrowers will
   open them.
3. Once the crest is ours, dig in at once. They will come back at us with everything, and the guns on the far bank will
   help only if we are still on top to tell them where.

**Objective**: Take the summit of Mamayev Kurgan and hold it.

### Map and sectors

| x (wu) | Sector | Ground | Structures |
| --- | --- | --- | --- |
| 0 to 3,000 | The ravine by the river | rubble | HQ (`logDugout`) |
| 3,000 to 5,000 | The railway at the foot | rubble | trench T1 (railway cutting, German, 8 slots); capture point P1 (x 4,200, structure T1, spawn) |
| 5,000 to 9,500 | The eastern slope | slope | shell-hole trenches T2 (x 6,300, 4 slots) and T3 (x 7,800, 4 slots), German, small; wire at 8,600 |
| 9,500 to 11,500 | The summit | rock (heightBonus 1.1) | buildings B1 and B2, the water tanks (x 10,100 and 10,900, 1 floor, 6 slots, `waterTank`); capture point P2 "summit" (x 10,500) |
| 11,500 to 14,000 | The western slope | slope (down) | enemy HQ at 13,850 |

### Forces

- **Player**: 3 sappers; 12 riflemen; 4 PPSh troopers; 2 DP gunners; 1 sniper; 350 Money. Supports: artillery and
  Katyusha (far bank), smoke.
- **Loans**: 2 mortar teams (start); 2 flamethrowers (phase 3); 3 PTRD teams (phase 4).
- **Enemy**:
  - HQ (295th Infantry Division), `incomeMul` 0.8.
  - Start: T1 (6 riflemen, 1 MG42), T2 and T3 (3 riflemen and 1 MG each), B1 and B2 (4 riflemen and 1 MG34 each),
    2 snipers, 2 mortars behind the crest.
  - Waves: StuG III Ausf. F, Panzer III J, pioneers, MP40 troopers.
  - Supports: Stuka every 100 s, artillery, Nebelwerfer.

### Phases and events

1. **"The foot of the hill"** (capture P1).
   - 120 s: Stuka.
2. **"The slope"** (capture T2 and T3). Lose nothing; the mortar duel.
   - Phase start: hint "Units climbing a slope move slower, and men on the crest see further. Smoke the slope before
     you climb it."
   - 150 s: German counter-attack down the slope (8 riflemen).
3. **"The water tanks"** (capture B1 and B2).
   - 60 s: Nebelwerfer on T3.
4. **"Hold the summit"**: prep 45 s (sandbags, foxholes, wire; zone 9,500 to 11,300); hold P2 for 360 s.
   - 20 s: banner "They are coming back!"; 2 StuG plus 12 infantry.
   - 120 s: Stuka on the summit.
   - 180 s: pioneers with flamethrowers plus 6 MP40.
   - 280 s: the last attack, 2 Panzer III J, 1 StuG and 14 infantry.

### Side objectives

- **Both water tanks by 12 minutes** (+15%).
- **No assault gun survives**: all German vehicles of phase 4 destroyed (+10%).

### Medals

Timed: target 24 minutes, target casualties 55.

### Music, weather, time

- **Music**: `kurgan` (new). G minor, 128 BPM. Climbing: rising string ostinato sequences, a heavy timpani on every
  bar, bells high and cold on the summit section. The theme is given in full by unison low brass in the hold phase.
  The prep layer is a muffled snare roll with string harmonics.
- **Weather and time**: overcast, smoke; day.

### How a sensible player wins on Normal

1. Riflemen and PPSh troopers clear T1 behind a barrage.
2. Mortars and the sniper duel the German mortars and gunners on the slope. Smoke, then push T2 and T3 one at a time.
3. Flamethrowers burn out the water tanks with the riflemen behind.
4. Wire and sandbag the crest, PTRDs in the water tanks. Katyusha on each wave as it forms on the western slope.

Expected 22 to 26 minutes.

---

## Mission 7: The House on the Square

- **Id** 1007, key `pavlov`. **Date** 27 September to 25 November 1942, compressed into four days and nights
  (`1942-10-15`). **Place** 9 January Square, Stalingrad, 48.7160 N, 44.5315 E. **Mode** survival, with a prep phase.
  **Length** about 22 minutes. **Map** 7,000 wu. **Theatre** `stalingrad` (autumn, turning winter in the last phase).
- **History**:
  - Sergeant Yakov Pavlov and three or four men of the 42nd Guards Rifle Regiment (13th Guards) took a four-storey
    apartment block facing 9 January Square in late September.
  - Lieutenant Ivan Afanasyev then commanded its reinforced garrison: officially 24, more likely 25 to 30 at a time,
    of many nationalities (Russian, Ukrainian, Georgian, Uzbek, Kazakh, Tatar, Jewish and more).
  - They held it for about two months (58 or 60 days, sources differ) with machine guns in the windows, an anti-tank
    rifle on the roof firing down at thin turret roofs, mortars, minefields, wire and a communication trench back to
    their battalion's positions.
  - Civilians sheltered in the cellar throughout.
  - The garrison's claims of German losses and Chuikov's famous comparison are memoir hyperbole; German records show
    only limited assaults on the house.

### Briefing (a company commander, 42nd Guards Rifle Regiment)

1. Sergeant, see that four-storey house standing alone on the square? From its upper windows you can see half a
   kilometre into the German lines. Take it tonight with your three men. If it is empty, hold it until help comes.
2. Lieutenant Afanasyev will bring up a machine-gun section, anti-tank rifles and mortars, and the sappers will wire
   and mine the square. Dig a trench back to the mill so ammunition and soup can reach you. There are families in the
   cellar; they stay.
3. The Germans will try to take it back by day with tanks and by night with raiding parties. We do not need you to go
   forward. We need the house to be there in the morning.

**Objective**: Take the house, then hold it until the counter-offensive.

### Map and sectors

| x (wu) | Sector | Ground | Structures |
| --- | --- | --- | --- |
| 0 to 1,600 | The mill and the battalion's positions | rubble | HQ (look `mill`: the Gerhardt mill, the battalion's position) and dump |
| 1,600 to 2,200 | The communication trench | rubble | trench T1 (x 1,900, 6 slots, owner 0); capture point P1 "the trench" (structure T1) |
| 2,200 to 2,800 | Pavlov's House | cobble | building B1 (x 2,450, 4 floors, 7 slots each, owner -1, 2 German riflemen inside at start) |
| 2,800 to 4,400 | 9 January Square | cobble | open ground for prep wire and mines |
| 4,400 to 7,000 | German-held blocks | rubble | buildings B2 to B4 (enemy cover only, `owner 1`); enemy entry edge |

### Forces

- **Player**: 2 sappers; Pavlov's group of 4 riflemen (`commanderName` "Sgt. Pavlov") at x 1,900; 150 Money;
  `incomeMul` 0.6. Money stays tight on purpose, so the garrison stays around 30 men without any change to the cap.
  Supports: artillery from the far bank (cooldown 90 s), mortars; Katyusha from day 3.
- **Loans**: Afanasyev's section arrives as a scripted wave (see phase 1); 2 PTRS teams (day 2); 1 sniper (night 1).
- **Enemy (no HQ, waves from the right)**: riflemen, MG42 teams, MP40 troopers, snipers, Granatwerfer teams, pioneers
  with flamethrowers, Panzer III J and StuG III F. Supports: Stuka (by day), artillery.

### Phases and events

0. **"Take the house"** (capture B1). Time night.
   - Hint: "Enter the building to take it. Kill the men inside first."
   - On capture: wave side 0 at x 1,900: 6 riflemen, 2 DP gunners, 1 Maxim team (`lmg`), 1 mortar team, announce
     "Lieutenant Afanasyev's section is up."
1. **Prep (60 s)**: wire, AP minefields, sandbags in windows; zone 2,200 to 4,000. Hint: "Mines on the square, wire
   across the doors."
2. **"Day one"** (survive 300 s; lose if B1 is lost). Time day.
   - Every 30 s: 4 riflemen.
   - 60 s and 200 s: 2 MG teams plus 6 riflemen.
   - 120 s: Stuka on B1.
3. **"Night one"** (survive 240 s). Time to night over 40 s.
   - Raiding parties: 4 MP40 troopers and 2 pioneers every 50 s.
   - German snipers in B2.
   - Flares.
4. **"Day two: the tanks"** (survive 300 s).
   - 30 s and 180 s: 2 Panzer III J or StuG plus 8 infantry.
   - Hint: "The anti-tank rifle on the top floor fires down on the thin roof of a tank's turret."
   - Gives men on floor 4 of B1 an `at` bonus vs vehicles x1.3 (building height rule, data `topFloorVsVehicles`).
5. **"The last night"** (survive 300 s). Weather `snow` over 60 s (November).
   - 60 s and 200 s: pioneers with flamethrowers (4) plus MP40 troopers (8).
   - 260 s: final mixed assault.
   - At the end, announce "The guns to the north have opened. The counter-offensive has begun."

### Side objectives

- **The trench stays open**: P1 never lost (+15%).
- **No German sets foot inside**: B1 never contested (no enemy inside its span) after phase 0 (+15%).

### Medals

Fixed scoring. Target casualties 20 (the garrison was small). HQ health weight 0.2, plus house health weight 0.2
(`structureWeight`).

### Music, weather, time

- **Music**: `pavlov` (new). B minor, 104 BPM. The most intimate track: solo high strings and a soft pad by day; a
  clock-like rim-shot and string harmonics at night; the theme on a single muted horn, then in a tender major colour
  once, as if the house were a home again. The combat layer stays driving but light (snare and short strings).
- **Weather and time**: smoke; night, day, night, day, night; snow at the end.

### How a sensible player wins on Normal

1. Take the house, then spend the prep on mines across the square and wire at the door line.
2. DP gunners on floors 2 and 3, the Maxim on floor 1, riflemen on every floor, PTRS on floor 4.
3. The mortar hits MG teams setting up in B2 to B4. The sniper deals with their snipers at night.
4. Keep two sappers running: money buys replacements, not a big army. Call the far-bank artillery on each tank wave.

Fixed 22 minutes.

---

## Mission 8: The Tractor Factory

- **Id** 1008, key `factories`. **Date** 14 October 1942 (`1942-10-14`). **Place** the Dzerzhinsky Tractor Factory,
  northern Stalingrad, 48.795 N, 44.585 E. **Mode** delay, with a prep phase. **Length** about 21 minutes. **Map**
  14,000 wu. **Theatre** `stalingrad` (autumn, factory dressing).
- **History**:
  - On 14 October 1942 the Germans threw their biggest attack of the battle at the factory district: the 14th Panzer
    Division, the 305th and 389th Infantry Divisions, heavy air attacks from first light.
  - The 37th Guards Rifle Division (Major General Viktor Zholudev, formed from airborne troops; about 7,000 men when it
    crossed on 2 October) was all but destroyed: about 250 men left by 15 October.
  - Zholudev's command post was buried by bombs; he survived.
  - The tractor factory fell that day; the 138th Division (Lyudnikov) relieved the survivors on the night of 16 to
    17 October.
  - The factory had built T-34s until the late summer.
  - The mission does not pretend the factory held. It is a delay: keep the Germans off the Volga bank until dark.

### Briefing (a battalion commander, 37th Guards Rifle Division)

1. Guards, in peacetime this works made tractors and this summer it made tanks. Today it is a fortress, and we are
   its garrison. The bombers have been overhead since first light and there is a panzer division in the workers'
   settlement.
2. We cannot keep them out of the factory for ever. We can make them take it hall by hall, so that the division and
   the bank behind us hold. Every hall has walls a metre thick and rubble to hide in; every hall they take must cost
   them a day's strength.
3. Prepare the halls now: wire the gaps, sandbag the windows, mine the yard. When a hall can no longer be held, fall
   back to the next one. Hold until dark; the Volga bank must be ours in the morning.

**Objective**: Hold the factory until dark. Do not let the Germans reach the river.

### Map and sectors

| x (wu) | Sector | Ground | Structures |
| --- | --- | --- | --- |
| 0 to 2,000 | The Volga cliffs | rubble | HQ (`logDugout`, in the bank) |
| 2,000 to 4,500 | Assembly hall | rubble | building B1 (`factoryHall`, 2 floors, 10 slots each, owner 0, spawn) |
| 4,500 to 7,000 | Foundry and machine shops | rubble | B2 and B3 (`factoryHall`, 2 floors, 8 slots, owner 0); capture point P2 (structure B3, spawn) |
| 7,000 to 9,500 | Factory yard and sidings | rubble | trench T1 (x 8,000, owner 0, 7 slots); wagons as cover props |
| 9,500 to 14,000 | Workers' settlement | rubble | enemy entry edge |

### Forces

- **Player**: 3 sappers; 8 riflemen in T1; 8 PPSh troopers in B3; 2 DP and 1 Maxim in B2; 2 PTRD teams in B3;
  2 snipers; 2 T-34/76 dug in (`behaviour: 'guard'`, leash 0) at x 6,600; 450 Money. Supports: Katyusha (far bank),
  artillery, smoke.
- **Loans**: 2 flamethrowers (phase 2); 2 mortar teams (start); 3 PTRD teams (phase 2, resend 120 s).
- **Enemy (no HQ, waves from the right)**:
  - Panzer III Ausf. J and L, Panzer IV Ausf. G (long 7.5 cm), StuG III F, riflemen, MG42 teams, MP40 troopers,
    pioneers with flamethrowers, Pak 40, mortars.
  - Supports: Stukas every 75 s in phase 1, then every 120 s; Nebelwerfer.

### Phases and events

0. **Prep (60 s)**: wire, sandbags, AP mines, tank traps; zone 2,000 to 8,600.
1. **"The bombers"**: survive 360 s; lose if 6 enemies get past x 2,000.
   - 0 s: barrage plus Stuka on T1.
   - 30 s: 4 tanks plus 12 infantry.
   - 150 s: Stuka on B3.
   - 200 s: 3 tanks plus 10 infantry.
   - 300 s: pioneers.
2. **"Hall by hall"**: survive 420 s.
   - Phase start: hint "When a hall can't be held, Fall Back sends your men to the next one you own."
   - 60 s, 200 s and 340 s: combined waves, each of 3 to 4 tanks and 12 to 14 infantry with 2 pioneers.
   - 240 s: building B3 takes a scripted heavy bomb (`barrage`, weapon `heavyBomb`) and loses a floor.
3. **"Until dark"**: survive 360 s. Time to dusk over 120 s, then night.
   - Infantry waves every 40 s.
   - Nebelwerfer at 100 s.
   - 300 s: the last tank push.

### Side objectives

- **The machine shops by night**: B3 still owned at the end (+20%).
- **Twenty-five tanks** (+10%).

### Medals

Fixed scoring (delay). Target casualties 60. Kill bonus.

### Music, weather, time

- **Music**: `factories` (new). D minor, 136 BPM. Industrial and cold: anvil on the off-beats, low string ostinato
  in fourths, brass stabs, the theme in diminution (`augment: 0.5`) as a hammering figure. The tense layer is a high
  cluster tremolo. The prep layer is a slow metallic clank.
- **Weather and time**: smoke, dust (visibility 0.85); day to dusk to night.

### How a sensible player wins on Normal

1. During prep, mine and trap the yard, wire T1's front, sandbag B3.
2. PTRDs, the dug-in T-34s and the sidings make the yard a tank trap. Katyusha on each wave in the settlement.
3. When T1 is lost, fall back to B3 and B2 (Fall Back to the rally point).
4. Flamethrowers and PPSh troopers counter-attack any hall the Germans enter. Snipers hunt the pioneers before they
   reach the walls.

Fixed 21 minutes.

---

## Mission 9: Operation Uranus

- **Id** 1009, key `uranus`. **Date** 19 to 23 November 1942 (`1942-11-19`). **Place** from the Serafimovich
  bridgehead to the Don bridge at Kalach; pin at Kalach-na-Donu, 48.69 N, 43.53 E. **Mode** assault with tanks.
  **Length** about 28 minutes. **Map** 30,000 wu (the longest in the campaign). **Theatre** `steppe` (winter).
- **History**:
  - The Southwestern Front (Vatutin) and the Stalingrad Front (Yeremenko) struck the Romanian 3rd and 4th Armies on the
    flanks.
  - On 19 November thick fog hid the bombardment, which opened at 07:20 Moscow time (codeword "Siren"); the
    Katyushas fired at 07:30.
  - The 26th Tank Corps' forward detachment under Lieutenant Colonel Filippov took the Kalach bridge intact by driving
    up with headlights on and passing as friendly traffic (most accounts give early 22 November; details vary between
    sources).
  - On 23 November at about 16:00 tanks of the two fronts met near Sovetsky, sealing the ring. Agreed green flares were
    not fired at first, and the two sides briefly shot at each other.
  - The German XLVIII Panzer Corps, with the 22nd Panzer and the Romanian 1st Armoured Division (Czech-built R-2
    tanks), counter-attacked with fewer than a hundred serviceable tanks.

### Briefing (a tank brigade commander, 26th Tank Corps)

1. For two months the city has held them. Now it is their turn to be surrounded. At twenty past seven every gun on
   the front opens fire, and then we go, fog or no fog. Steer by compass if you must.
2. In front of us are Romanian divisions, brave men badly armed, with few anti-tank guns. Behind them are open steppe,
   a German panzer division short of fuel, and the Don. We do not stop to finish every trench: break the line, and the
   rifle divisions will mop up.
3. Our objective is the bridge at Kalach, a hundred kilometres away, before they blow it. Then on to Sovetsky, where
   the tanks of the Stalingrad Front are coming the other way. When you meet them, fire green flares, and make sure
   they see them.

**Objective**: Break through, take the Kalach bridge and link up at Sovetsky.

### Map and sectors

| x (wu) | Sector | Ground | Structures |
| --- | --- | --- | --- |
| 0 to 3,000 | Serafimovich bridgehead | snow | HQ (`logDugout`) |
| 3,000 to 7,000 | Romanian line | snow | trenches T1 (x 4,200) and T2 (x 5,600), Romanian, 8 slots each; wire; AP minefield at 3,800; capture point P1 (structure T2, spawn) |
| 7,000 to 16,000 | Open steppe | steppe (snow), balkas | village of Perelazovsky as P2 (x 13,000, buildings B1 to B3, spawn) |
| 16,000 to 23,000 | Don hills | snow, slope | German 22nd Panzer screen; capture point P3 (x 21,000, spawn) |
| 23,000 to 25,000 | The Don at Kalach | water (ice not thick enough) | bridge 1 (x 23,600 to 24,400, German, wired) |
| 25,000 to 30,000 | Kalach and the road to Sovetsky | road, snow | buildings; capture point P4 "Sovetsky" (x 29,200); enemy HQ at 29,850 (a supply depot) |

### Forces

- **Player**: 4 sappers; 6 T-34/76; 2 KV-1S (`heavyTank`); 3 T-70 (`lightTank`); 12 riflemen; 6 tank riders
  (`assault`, look `telogreika`); 2 DP; 2 PTRD; 2 mortars; 800 Money. Supports: artillery, Katyusha, smoke, and
  from phase 2 the Il-2 (two-seat) and the Po-2 recon (job 7 recon).
- **Loans**: 2 Universal Carriers (`apc`, Lend-Lease, phase 2); 4 PTRD teams (phase 2, resend 150 s);
  2 mortar teams.
- **Enemy**:
  - Romanian line (`rosterNation: romanian`): T1 and T2 (8 infantry, 2 ZB LMG each), 2 37 mm Pak crews, 1 R-2 tank.
  - German HQ for the AI economy, `incomeMul` 0.6.
  - 22nd Panzer waves of Pz 38(t) (`lightTank` look `pz38t`), Pz III, Pz IV, with Panzergrenadiers and Pak 40.
  - Romanian 1st Armoured: R-2s.
  - Supports: artillery; air only after the fog lifts and before the blizzard (a small window).

### Phases and events

1. **"Siren"** (capture P1). Weather `fog` (visibility 0.6).
   - 0 s: free barrage on T1 and T2 (`barrage`, side 0, 3 strikes of 12 rounds), then a Katyusha salvo at 10 s.
     Banner "Siren!".
   - Hint: "Fog hides you and them alike. Push close before you fire."
2. **"The steppe"** (capture P2, then P3). Fog lifts over 120 s.
   - 200 s: 22nd Panzer counter-attack (4 Pz 38(t), 2 Pz III, 8 grenadiers).
   - 400 s: Romanian armour (3 R-2).
   - 500 s: weather to `blizzard` over 60 s (visibility 0.7, no air).
   - Hint at P2: "Deploy at Perelazovsky: the next wave starts there, not 13 km back."
3. **"The Kalach bridge"** (capture the bridge's point within 180 s of the phase start). Time to night over 60 s.
   - Phase start: `disguise` side 0 for 40 s over x 21,000 to 24,600 ("Headlights on. Drive as if you own the road.").
   - At 180 s, if the bridge is not owned: `demolish` bridge 1. The phase then continues by a slower ford downstream
     (infantry only at 0.35; vehicles must wait for a scripted pontoon at 360 s).
4. **"Sovetsky"** (capture P4).
   - 60 s: German last-ditch counter-attack.
   - On capture: announce "Green flares over Sovetsky. The ring is closed." Mission won.

### Side objectives

- **The bridge intact**: capture it before the demolition (+20%).
- **Fifteen tanks** (+10%).

### Medals

Timed: target 28 minutes, target casualties 60.

### Music, weather, time

- **Music**: `uranus` (new). A minor moving to C minor, 140 BPM. Opens in fog (a pad with very slow swells, a
  distant drum), then an engine-like ostinato of low strings and timpani, brass fanfares built from the theme's answer,
  icy bell accents on the beat in the blizzard section. The victory sting quotes the theme in full in a bright major
  colour.
- **Weather and time**: fog to clear to blizzard; dawn, day, night.

### How a sensible player wins on Normal

1. Let the barrage land, then the T-34s and tank riders hit T2 while infantry clears T1.
2. Deploy at P1, then rush the steppe in a tank column with PTRDs and mortars in the second wave.
3. Meet the 22nd Panzer at Perelazovsky from the houses; Il-2 on their tanks before the blizzard.
4. Go for the bridge immediately in phase 3 with the fastest tanks (T-70s, T-34s). The disguise window is short.

Expected 26 to 30 minutes.

---

## Mission 10: Operation Ring

- **Id** 1010, key `ring`. **Date** 10 January to 2 February 1943 (`1943-01-22`). **Place** from the western steppe
  of the pocket to the Univermag department store, central Stalingrad, 48.708 N, 44.515 E. **Mode** assault, ending
  in surrender. **Length** about 30 minutes. **Map** 28,000 wu. **Theatres** `steppe` (winter) and `stalingrad`
  (winter).
- **History**:
  - The Don Front (Rokossovsky) offered terms on 8 January; they were rejected.
  - On 10 January the attack opened with about 7,000 guns and mortars, the largest bombardment of the war to that
    date.
  - Pitomnik airfield fell on 16 January and Gumrak about 22 January (the last He 111 left that day).
  - The pocket was split at Mamayev Kurgan on 26 January.
  - Field Marshal Paulus (promoted on 30 January) was taken in the basement of the Univermag in the southern pocket on
    31 January.
  - The northern pocket around the tractor factory ceased fire on 2 February.
  - The Germans were starving, short of fuel and ammunition; most tanks were immobile. No Tigers were in the pocket.

### Briefing (a rifle corps commander, Don Front)

1. The German Sixth Army is inside a ring, and tomorrow the ring begins to close. They were offered honourable terms
   two days ago and their commander refused. Very well: at dawn seven thousand guns will give our answer.
2. They are hungry, frozen and short of everything, but they are not finished, and a starving man in a cellar with a
   machine gun is still dangerous. First the steppe and the airfield at Pitomnik, where their transports land, then
   Gumrak, then the ruins. Use every gun we have; we have more than they do now.
3. Their army headquarters sits under the department store on the central square. When it falls, the Sixth Army
   falls with it. Take the city back, street by street, to the river.

**Objective**: Clear the pocket and take the German headquarters in the Univermag.

### Map and sectors

| x (wu) | Sector | Ground | Structures |
| --- | --- | --- | --- |
| 0 to 3,000 | Jump-off line | snow | HQ (`logDugout`) |
| 3,000 to 9,000 | The western steppe | steppe (snow) | trenches T1 (x 4,500), T2 (x 7,000), German; minefield at 6,600 |
| 9,000 to 13,000 | Pitomnik airfield | snow | wrecked Ju 52 and He 111 transports (cover props); building B1 hangar; capture point P1 (x 11,000, spawn) |
| 13,000 to 18,000 | Gumrak | snow | B2 Gumrak station, B3 sheds; capture point P2 (x 16,500, spawn); a Flak 88 pair at 17,200 |
| 18,000 to 24,000 | The city's western ruins | rubble (winter) | buildings B4 to B9 (apartments, 3 to 4 floors); capture point P3 (x 22,000, spawn) |
| 24,000 to 28,000 | The central square | rubble, cobble | B10 to B12; enemy HQ (look `store`: the Univermag) at 27,850 |

### Forces

- **Player**: 5 sappers; 8 T-34/76; 2 KV-1S; 2 T-70; 16 riflemen; 8 PPSh troopers; 4 conscripts squads; 2 DP; 2
  mortars; 2 snipers; 1 flamethrower; 900 Money. Supports: artillery, Katyusha, smoke, Il-2, Pe-2 (bomber), recon.
  Population at start about 95.
- **Loans**: 2 flamethrowers (phase 3, resend 180 s); 4 PTRD teams (phase 2); 2 Universal Carriers.
- **Enemy**:
  - HQ, `incomeMul` 0.5 (starving).
  - Start: T1 and T2 garrisons (6 riflemen, 2 MG each); Pitomnik (8 riflemen, 2 MG, 1 Pak 40, 1 immobile Pz III);
    Gumrak (8 riflemen, 2 MG, Flak 88 pair, 1 immobile StuG); the city (14 riflemen in buildings, 4 MG, 2 snipers,
    2 mortars, 1 immobile Pz IV).
  - Population about 70.
  - Waves: small, desperate counter-attacks (MP40 troopers, pioneers).
  - Supports: artillery with a long cooldown (shells short), Nebelwerfer once. No air.

### Phases and events

1. **"Seven thousand guns"** (capture P1).
   - 0 s: banner "The bombardment!"; 5 free barrages (side 0) on T1, T2 and the minefield, 6 s apart.
   - Hint: "Artillery breaks the mines too. Then send the sappers to clear the rest."
   - 300 s: counter-attack from Pitomnik.
2. **"Gumrak"** (capture P2). Weather `snow`, then `blizzard` at 300 s for 120 s.
   - Hint: "Their tanks have no fuel. They cannot move, but they can still shoot."
3. **"The ruins"** (capture P3).
   - Every 120 s: sniper and MG nests reveal themselves (an announce, and German `posture: 'hold'`).
   - 200 s: pioneers counter-attack.
4. **"The Univermag"**: surrender when the enemy HQ falls below 25%.
   - 100 s: the last German armour (1 StuG, mobile) plus every unit (`posture: 'counterattack'`).
   - On surrender: `endMission` with the announcement "The southern pocket surrenders. Two days later the northern
     pocket lays down its arms. The battle of Stalingrad is over." The regimental colour is raised on the ruins in the
     victory screen.

### Side objectives

- **Pitomnik in eight minutes** (+10%).
- **The Flak guns at Gumrak taken without losing a tank** (+10%).
- **Under 28 minutes** (+10%).

### Medals

Timed: target 30 minutes, target casualties 65.

### Music, weather, time

- **Music**: `ring` (new). E minor to E major, 124 BPM. The campaign's grand finale: the theme in every form, frozen
  and slow at first (bells, pad), then full low brass and strings with timpani rolls. The victory sting is the theme in
  major, with a held open fifth fading into wind.
- **Weather and time**: overcast and freezing; snow, blizzard, then clearing; day throughout (short January day),
  dusk in phase 4.

### How a sensible player wins on Normal

1. Let the barrages land, clear mines with sappers, and drive the T-34s with tank riders through T1 and T2.
2. Deploy at Pitomnik. Il-2 on the Gumrak Flak 88s, then tanks and infantry together.
3. In the ruins, use mortars, flamethrowers and the Pe-2 on strongpoints and snipers on snipers. Keep tanks behind the
   infantry (Panzerknacker charges and Pak 40s in the rubble).
4. Mass everything on the Univermag.

Expected 28 to 32 minutes.

---

## Summary table

| # | Id | Key | Date | Mode | Prep | Map wu | Minutes | Target time / casualties | Track | Weather, time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1001 | brest | 22 Jun 1941 | survival (tutorial) | yes | 7,000 | 13 | fixed / 25 | brest | clear, dawn to day, smoke |
| 2 | 1002 | dubno | 27 Jun 1941 | delay | no | 22,000 | 22 | fixed / 45 | dubno | hot, dust, day to dusk |
| 3 | 1003 | volokolamsk | 16 Nov 1941 | hold | yes | 16,000 | 21 | 21 / 40 | volokolamsk | frost, snow, day to dusk |
| 4 | 1004 | klin | Dec 1941 | assault | no | 26,000 | 26 | 27 / 55 | klin | blizzard to clear, night to day |
| 5 | 1005 | volga | 14 to 15 Sep 1942 | special | mid (45 s) | 12,000 | 21 | 22 / 45 | volga | smoke, night to day |
| 6 | 1006 | kurgan | 18 Sep 1942 | hold | mid (45 s) | 14,000 | 24 | 24 / 55 | kurgan | overcast, smoke, day |
| 7 | 1007 | pavlov | Sep to Nov 1942 | survival | yes | 7,000 | 22 | fixed / 20 | pavlov | smoke, day-night cycle, snow |
| 8 | 1008 | factories | 14 Oct 1942 | delay | yes | 14,000 | 21 | fixed / 60 | factories | smoke and dust, day to night |
| 9 | 1009 | uranus | 19 to 23 Nov 1942 | assault | no | 30,000 | 28 | 28 / 60 | uranus | fog, blizzard, dawn to night |
| 10 | 1010 | ring | Jan 1943 | assault (surrender) | no | 28,000 | 30 | 30 / 65 | ring | freezing, snow, day |

New tracks: 10 (`brest` to `ring`), plus the theme `sovietWinter` and the map track `stalingradMap`. Missions 7, 8, 9
and 10 feature tanks or anti-tank fights; 8 to 10 feature tanks heavily (the owner's "last few generally feature
tanks").
