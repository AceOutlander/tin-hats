# Soviet campaign: The Road to Berlin (July 1943 to May 1945)

Campaign id `berlin`, missions 3001 to 3010. Unlocked by clearing Stalingrad mission 10 (`FOUNDATIONS.md` section 6).
Nation data in `NATIONS.md` (Soviet 1943 to 1945, German 1943 to 1945); sources in `HISTORY.md`.

## Campaign

- **Card**: "The Road to Berlin: July 1943 to May 1945. From the Kursk salient to the Reichstag."
- **Flag**: the Soviet red flag. In mission 10 the objective is the 150th Rifle Division's assault flag (`victoryBanner`):
  red, with a star above the hammer and sickle and the division's name in white.
- **Map region**: lon 12 to 38 E, lat 49 to 56 N. Land shapes: Belarus, Ukraine, Poland, eastern Germany. Rivers: Dnieper,
  Desna, Berezina, Pripyat (marsh shading), Bug, Vistula, Oder, Spree. Labels: Kursk, Orel, Belgorod, Kiev, Bobruisk,
  Minsk, Warsaw, Sandomierz, Küstrin, Berlin. A Berlin inset (Spree, Landwehr Canal, Tiergarten, Reichstag) appears
  for missions 8 to 10.
- **Theme**: "The Road West" (`roadWest`). Original. It is the Stalingrad theme's sibling: the same opening repeated
  tonic, but it climbs instead of falling:
  `0 (1) 0 (.5) 2 (.5) 3 (2) | 4 (1) 3 (.5) 4 (.5) 6 (1.5) 4 (.5) 7 (3)`, ending on the octave. It is minor (dorian
  colour) in early missions and major in missions 9 and 10. Forms: brass fanfares, a march on snare, bells for the
  winter missions. The composer checks it against known Soviet songs and marches (as for `sovietWinter`).
- **Cold sound**: as Stalingrad (open fifths, glass and bell, thin lows) for the winter missions 5 and 6. The summer
  missions (1 to 4) stay cold in colour (bleak, sparse, wide), but with more drive. The Berlin missions are dark, urban
  and metallic.
- **Map track**: `berlinMap`, a reflective, hopeful variant of `roadWest`.
- **Theatres needed**:
  - `steppe` (summer: wheat, sunflowers, balkas, railway embankments);
  - `russiaSummer` with a `marsh` dressing (Belarus: pine, birch, corduroy roads, reeds);
  - `riverBank` (the Dnieper's high western bank, chalk cliffs);
  - the `polandWinter` variant (snowfields, brick village churches, poplars);
  - `oderbruch` (a flat wet plain, dykes, the escarpment of the Seelow Heights);
  - `berlin` (big stone apartment blocks, tram wires, S-Bahn embankments, the Zoo flak tower silhouette, the
    Reichstag's skeleton dome).

### Enemy roster by date

| Missions | Date | Infantry | Anti-tank | Armour | Air and guns |
| --- | --- | --- | --- | --- | --- |
| 1 Kursk north | 5 to 10 Jul 1943 | Grenadiers, MG42, MP40 | Pak 40 | **Tiger I** (heavy battalion 505), **Ferdinand** (653 and 654: a `heavyTank` look with no hull machine gun), Panzer IV H, Panzer III, StuG III G | Ju 87 (including the cannon-armed Ju 87G), Hs 129, Fw 190F, Nebelwerfer |
| 2 Prokhorovka | 12 Jul 1943 | Panzergrenadiers (II SS Panzer Corps, shown with no SS insignia) | Pak 40 | Panzer IV, StuG, a few Panzer III, **15 Tigers in all** on the eve, no Panthers | Ju 87, artillery |
| 3 Dnieper | 22 to 23 Sep 1943 | Grenadiers | Pak 40 | Panzer IV, StuG (19th Panzer) | Ju 87, artillery |
| 4 Bagration | 23 to 29 Jun 1944 | Grenadiers | Pak 40, Panzerfaust, Panzerschreck | Panzer IV, StuG III, a few Tiger I | Fw 190, little air |
| 5 Vistula–Oder | 12 to 13 Jan 1945 | Grenadiers | Pak 40, Panzerfaust | **King Tiger squad** (heavy battalion 424, ex-501, at Lisów) and Tiger I, Panthers (16th Panzer) | little air (fog, snow) |
| 6 Oder bridgehead | 31 Jan to Feb 1945 | Grenadiers, Volkssturm (older men) | Panzerfaust, Pak 40, 8.8 cm Flak | Panzer IV, Panther, Hetzer, StuG | Fw 190, Ju 87G |
| 7 Seelow | 16 to 18 Apr 1945 | Grenadiers, Volkssturm | Panzerfaust, Flak 88 | Panther, Hetzer, **King Tiger squad** (heavy battalion 503's counter-attack, 18 April) | artillery |
| 8 to 10 Berlin | 21 Apr to 2 May 1945 | Grenadiers, Volkssturm (older men only), naval cadets at the Reichstag, foreign volunteer units (shown as plain German) | Panzerfaust everywhere, Flak 88 and 105 mm on direct fire | Panther, StuG, Hetzer; a King Tiger in the Tiergarten (game licence: the last Tiger IIs of battalion 503 fought in central Berlin, but their exact positions on 30 April are uncertain) | flak towers (scenery and fire support) |

The Soviet player by date:
- **1943**: T-34/76, T-70, KV-1S (and Lend-Lease Churchills at Prokhorovka), SU-76, SU-122, SU-152 (a few at Kursk),
  PTRD/PTRS, ZiS-3, Katyusha BM-13N, Il-2 with PTAB anti-tank bomblets (first used at Kursk).
- **1944**: T-34-85 (from spring 1944), **IS-2** (first combat April 1944; trainable from mission 4), ISU-152, SU-76M,
  M3 halftrack and Studebaker-mounted Katyushas, Yak-9.
- **1945**: as 1944, plus trophy Panzerfausts for assault groups and heavy artillery in scripted barrages.

### How "mighty" the Germans are

1943: armour quality (Tigers, Ferdinands) and skill; the player has depth, mines and numbers. From 1944 the Soviet
side has the initiative, the mass and the air. German strength is in rare heavy tanks (the King Tiger squads), 88s
and Panzerfaust-armed defenders in cities. Enemy income never exceeds the player's.

---

## Mission 1: Kursk, the northern shoulder

- **Id** 3001, key `kursk`. **Date** 5 to 10 July 1943 (`1943-07-07`). **Place** Ponyri station, 52.3135 N,
  36.3026 E. **Mode** hold, with a prep phase (the owner's spec: hold deep defensive lines against a massive tank
  attack). **Length** about 24 minutes. **Map** 20,000 wu. **Theatre** `steppe` (summer).
- **History**:
  - The Central Front (Rokossovsky) had dug three main belts and three rear belts, with some 500,000 anti-tank and
    440,000 anti-personnel mines across the salient: up to about 2,200 anti-tank mines per kilometre at the densest.
  - It fired a counter-preparation barrage at about 02:20 on 5 July. The German 9th Army (Model) attacked at 05:30.
  - Most of the Ferdinands committed on the first day were immobilised by mines; many were later repaired.
  - Tigers of heavy battalion 505 struck the 16th Tank Corps on 6 July.
  - Ponyri village and station (school, water tower, tractor station) changed hands repeatedly from 7 to 10 July,
    fought by the 307th Rifle Division of the 13th Army (Pukhov).
  - The Ferdinand had no hull machine gun, so Soviet infantry could let it pass and attack it close.

### Briefing (a regimental commander, 307th Rifle Division)

1. For three months we have dug. Trenches, anti-tank ditches, minefields, gun pits, then more trenches behind those.
   Now the Germans are coming at the salient from the north with everything they have, and the new heavy machines are
   in the front of it.
2. Ponyri is our bit: the station, the school, the water tower and the fields of mines in front of them. Let the
   minefields do their work. When the heavy assault guns break down in the mines, the infantry can get to them; they
   cannot shoot at a man beside them.
3. We fall back only from one line to the next, never beyond the station. Every hour they spend here is an hour they
   are not spending in Kursk. Hold until the counter-blow, and then we will see who runs.

**Objective**: Hold Ponyri through three German assaults.

### Map and sectors

| x (wu) | Sector | Ground | Structures |
| --- | --- | --- | --- |
| 0 to 3,000 | Rear | field | HQ (`logDugout`) |
| 3,000 to 7,000 | Ponyri station and village | cobble | buildings B1 to B5 (school, water tower, station, tractor station); third line trench T3; capture point P3 "the station" (structure B3, spawn) |
| 7,000 to 11,000 | Second belt | field | trenches T2a and T2b; minefields M2 (AT and AP); anti-tank ditch (a `water`-like vehicle barrier with a crossing point, data `ditch`) |
| 11,000 to 15,000 | First belt | field | trenches T1a and T1b; minefields M1 (dense); wire; capture point P1 (spawn) |
| 15,000 to 20,000 | No-man's-land and the German start | field | enemy HQ at 19,850 |

### Forces

- **Player**: 4 sappers; 24 riflemen in T1 and T2; 4 DP; 2 SG-43 (`lmg`, look `sg43`); 4 PTRD teams; 2 mortars;
  1 sniper; 2 T-34/76 dug in; 1 SU-152 (`heavyTank`, look `su152`, the "beast-killer"); 700 Money. Supports: artillery
  (counter-preparation), Katyusha, smoke, Il-2 (airStrike with PTAB: data `vehicleDamageMul` higher, era-specific),
  fighter, recon.
- **Loans**: 4 PTRD teams (start); 2 45 mm gun crews (`at`, look `gun45`, phase 1); 2 T-70 (phase 2).
- **Enemy**:
  - HQ, `incomeMul` 0.9.
  - Waves (the AI attacks with `posture: 'advance'` in each phase): Ferdinands (2 to 4), Tiger I (2), Panzer IV H,
    StuG, grenadiers, pioneers to clear mines (Insane: they clear mines well).
  - Supports: Stukas every 90 s, Ju 87G cannon passes on tanks, artillery, Nebelwerfer.

### Phases and events

0. **Prep (60 s)**: extra minefields, wire, foxholes, tank traps; zone 3,000 to 14,500.
   - 50 s: counter-preparation event, a free Soviet barrage on the German start (x 16,000 to 19,000; historical).
1. **"The first day"**: survive 360 s; lose if P3 is lost.
   - 0 s: German barrage on T1.
   - 30 s: banner "Heavy assault guns!"; 3 Ferdinands plus 4 Panzer IV plus 16 grenadiers.
   - 200 s: Stukas.
   - 260 s: second assault.
   - Hint: "Mines stop tanks. Infantry can close on a Ferdinand: it has no machine gun in front."
2. **"The Tigers"**: survive 360 s.
   - 30 s: 2 Tigers plus 4 Panzer IV plus StuG plus grenadiers.
   - 200 s: weather `rain` (thunderstorm) over 30 s, no air for 90 s.
   - The Germans try T2 and the ditch.
3. **"Ponyri"**: survive 360 s; the station must hold.
   - Repeated combined attacks; at 300 s announce "The counter-offensive has begun to the north."

### Side objectives

- **The first belt holds through day one** (+15%).
- **Six heavy machines** (Tiger or Ferdinand destroyed) (+15%).

### Medals

Fixed scoring. Target casualties 60.

### Music, weather, time

- **Music**: `kursk` (new). G minor, 126 BPM. A vast, bleak summer: a wide string drone, a heartbeat timpani (the
  prep layer is all tension: low pulses and a rising brass pedal), the combat layer heavy anvil and driving low strings,
  the theme as a grim brass chorale. Cold despite the heat: no warm pad, glassy highs.
- **Weather and time**: hot (30 °C or more) with thunderstorms; day.

### How a sensible player wins on Normal

1. Spend the prep on minefields across the approaches the tanks must use.
2. PTRDs and 45 mm guns in T2 on the flanks, the SU-152 hull-down behind the ditch.
3. Il-2 on the Ferdinands stuck in the mines. Katyusha on the infantry behind them.
4. Fall back line to line; never abandon the station.

Fixed 24 minutes.

---

## Mission 2: Prokhorovka

- **Id** 3002, key `prokhorovka`. **Date** 12 July 1943 (`1943-07-12`). **Place** Prokhorovka, 51.0364 N,
  36.7364 E. **Mode** assault (a huge tank battle). **Length** about 22 minutes. **Map** 22,000 wu. **Theatre**
  `steppe`.
- **History**:
  - The 5th Guards Tank Army (Rotmistrov), with the 18th and 29th Tank Corps leading, attacked the II SS Panzer Corps
    (shown in game as plain German) in the corridor between the Psel river and the railway embankment.
  - About 900 tanks took part in the main clash, not the 1,200 to 1,500 of legend.
  - Soviet tanks charging downhill at Hill 252.2 ran into their own anti-tank ditch at its foot.
  - The Germans had only 15 serviceable Tigers that evening.
  - Losses are disputed. Soviet losses are usually given as 300 to 400 tanks destroyed or damaged. German permanent
    losses were very low (Frieser counts 3 written off), though many more were damaged. The old Soviet claim of
    hundreds of German tanks destroyed is discredited. Rotmistrov's army lost 12 Lend-Lease Churchills among others.
  - Thunderstorms in the afternoon grounded much of the air.

### Briefing (a tank brigade commander, 29th Tank Corps)

1. The enemy has broken through two of our belts in the south, and this morning we meet him head on. A whole tank
   army goes in at once, across the fields between the river and the railway. Close the range fast: their guns are
   better than ours at a distance, so we will not give them distance.
2. Their heavy tanks are few. Most of what you will see are Panzer IVs and assault guns, and a T-34 that gets close
   enough can kill any of them. Mind the ground: there is a deep ditch at the foot of the hill, dug by our own people.
   Know where it is before you charge.
3. Take the state farm and Hill 252.2, and do not let them through to Prokhorovka. A tank that stops in the open is a
   dead tank. Keep moving, keep firing, and get in among them.

**Objective**: Smash the German spearhead and take Hill 252.2.

### Map and sectors

| x (wu) | Sector | Ground | Structures |
| --- | --- | --- | --- |
| 0 to 3,000 | Prokhorovka outskirts | field | HQ (`logDugout`) |
| 3,000 to 9,000 | The corridor: open wheat | field | the anti-tank ditch at 8,400 (a vehicle barrier with 2 crossing points; data `ditch`); railway embankment props |
| 9,000 to 13,000 | Hill 252.2 | field (slope up; heightBonus 1.1 on the crest) | capture point P1 "Hill 252.2" (x 12,000, spawn) |
| 13,000 to 17,000 | Oktyabrsky state farm | cobble | buildings B1 to B4; capture point P2 (spawn) |
| 17,000 to 22,000 | The German assembly area | field | enemy HQ at 21,850 |

### Forces

- **Player**: 4 sappers; 14 T-34/76; 6 T-70; 2 Churchills (`heavyTank`, look `churchillSoviet`, Lend-Lease); 1 SU-122;
  8 tank riders; 6 riflemen; 2 PTRD; 900 Money. Supports: artillery, Katyusha, Il-2 (until the storm), smoke.
- **Loans**: 4 PTRD teams; 2 SU-76 (`lightTank`, phase 2).
- **Enemy**:
  - HQ, `incomeMul` 0.9.
  - Start: 10 Panzer IV, 4 StuG, 2 Tiger I, 3 Panzer III, 16 Panzergrenadiers, 4 Pak 40.
  - Waves: Panzer IV plus StuG reinforcements; at most 4 Tigers in the whole mission.
  - Supports: Stukas (before the storm), artillery.

### Phases and events

1. **"The charge"** (cross the ditch: reach x 9,000 with 10 units).
   - 0 s: banner "Steel, steel, steel!" (`sound: horn`); the AI posture `advance`, so the armies meet head on.
   - Hint: "Close the range: at short range a T-34 can kill a Panzer IV from any side."
2. **"Hill 252.2"** (capture P1).
   - 150 s: weather `rain` over 60 s (thunderstorm): no air for 180 s.
3. **"The state farm"** (capture P2, then destroy the enemy HQ).
   - German counter-attacks with Tigers from the left flank: the Psel side, as a wave at x 13,000.

### Side objectives

- **Nobody in the ditch**: no own tank destroyed in x 8,200 to 8,600 (+10%).
- **Every Tiger** (+15%).

### Medals

Timed: target 22 minutes, target casualties 75.

### Music, weather, time

- **Music**: `prokhorovka` (new). D minor, 152 BPM, the fastest of the campaign. Clashing brass and a galloping
  ostinato, anvil hits like shells on armour, the theme hammered out in diminution, thunder-like timpani rolls in the
  storm section.
- **Weather and time**: hot, low cloud, then thunderstorms; morning to afternoon.

### How a sensible player wins on Normal

1. Charge with the T-34s using the ditch crossings, with smoke on the Tigers.
2. Get in close, with the T-70s on the flanks.
3. Tank riders with PTRDs take the hill; Katyusha on the grenadiers.
4. Push the farm house by house.

Expected 20 to 24 minutes.

---

## Mission 3: Crossing the Dnieper

- **Id** 3003, key `dnieper`. **Date** night of 22 to 23 September 1943 (`1943-09-23`). **Place** the Bukrin bend,
  Velykyi Bukryn, 49.9472 N, 31.3158 E. **Mode** special (river assault). **Length** about 20 minutes. **Map**
  12,000 wu. **Theatre** `riverBank`.
- **History**:
  - The Voronezh Front (Vatutin) raced to the Dnieper. On 22 September motorised infantry seized a foothold at
    Zarubentsy at the tip of the Bukrin bend; the main crossings came on 23 September.
  - Men crossed on fishing boats, rafts of barrels, fences and logs, and by swimming. The Germans had burned the boats.
  - The airborne drop of 24 to 25 September was scattered.
  - Nine German divisions soon bottled the bridgehead up; Kiev was freed from the Lyutezh bridgehead on 6 November.
  - 2,438 men received the Hero of the Soviet Union title for the Dnieper battle, the largest single mass award.

### Briefing (a rifle company commander, 40th Army)

1. The Germans call this river their eastern wall, and from the west bank it looks like one: high, steep, and they
   have burned every boat for fifty kilometres. We crossed four hundred kilometres to get here, and we are not going
   to stop because of some water.
2. Tonight we go over on what the villagers have hidden and what we can build: fishing boats, rafts of barrels and
   fence posts, and anything that floats. Small parties, quiet, in the dark. Land under the cliff, climb it, and hold
   the top until the next boats come.
3. At dawn they will counter-attack with tanks and the rafts will not bring guns big enough to stop them. Hold the
   foothold with what you can carry. Every man who holds on that bank tonight will be remembered.

**Objective**: Cross the Dnieper, climb the high bank and hold the bridgehead until dawn.

### Map and sectors

| x (wu) | Sector | Ground | Structures |
| --- | --- | --- | --- |
| 0 to 2,500 | East bank | sand | HQ (`logDugout`); dump |
| 2,500 to 5,000 | The Dnieper | water | no bridge |
| 5,000 to 6,500 | Under the cliff | sand | capture point P1 "the landing" (x 5,200, spawn, `batchEvery` 45 s: rafts) |
| 6,500 to 8,500 | The high bank | slope up | trench T1 (German, 6 slots); MG nests PB1 and PB2 (Tobruks) |
| 8,500 to 12,000 | Zarubentsy | field, cobble | buildings B1 to B3 (the village); capture point P2 "Zarubentsy" (spawn); enemy HQ at 11,850 |

### Forces

- **Player**: 3 sappers (east bank); at P1, 10 riflemen, 4 PPSh troopers, 1 DP; 250 Money. Supports: artillery from
  the east bank, Katyusha, smoke (from phase 2).
- **Loans**: 4 PTRD teams (phase 3); 2 ZiS-3 crews rafted over (`at`, look `zis3`, phase 3); 2 mortar teams.
- **Enemy**:
  - HQ (XXIV Panzer Corps screen), `incomeMul` 0.8.
  - Start: T1 (6 grenadiers, 1 MG42), PB1 and PB2, the village (8 grenadiers, 1 MG, 1 Pak 40).
  - Waves: 19th Panzer Division (Panzer IV, StuG), grenadiers.
  - Supports: flares, artillery, Stukas at dawn.

### Phases and events

1. **"The rafts"** (hold P1 for 180 s). Time night; weather fog over the river (visibility 0.6).
   - Rafts every 45 s; a share sunk by barrage events.
   - Hint: "Small parties, in the dark. The fog is your friend."
2. **"The cliff"** (capture T1 and destroy PB1 and PB2).
3. **"Dawn"** (capture P2, then hold it for 300 s). Time dawn, then day; Stukas.
   - 60 s and 200 s: counter-attacks with 3 Panzer IV plus 2 StuG plus grenadiers.

### Side objectives

- **No raft lost after the first** (+10%).
- **Zarubentsy by first light** (+15%).

### Medals

Timed: target 20 minutes, target casualties 45.

### Music, weather, time

- **Music**: `dnieper` (new). C-sharp minor, 112 BPM. A wide, dark river: a low pad with a slow tremolo, oar-like hand
  drums, and the theme on solo horn far away. The combat layer brings snare and urgent strings, and dawn brings brass.
  It must differ from `volga` (key, tempo, a lighter texture with more space).
- **Weather and time**: night fog, drizzle; night to dawn to day.

### How a sensible player wins on Normal

1. Pack the landing with the first three loads.
2. PPSh troopers up the cliff on the nests, with riflemen covering; smoke.
3. Take the village with the mortars' help.
4. ZiS-3s and PTRDs in the houses for the tanks.

Expected 18 to 22 minutes.

---

## Mission 4: Operation Bagration, Bobruisk

- **Id** 3004, key `bagration`. **Date** 23 to 29 June 1944 (`1944-06-24`). **Place** Bobruisk, 53.14 N, 29.22 E.
  **Mode** assault (break through and race forward). **Length** about 26 minutes. **Map** 28,000 wu. **Theatre**
  `russiaSummer` (marsh).
- **History**:
  - Partisan attacks on the railways began on 19 to 20 June. Reconnaissance in force came on 22 June, and the main
    attacks on 23 to 24 June.
  - Four Soviet fronts with about 1.67 million men smashed Army Group Centre.
  - At Bobruisk, Rokossovsky's 1st Belorussian Front attacked with the 65th Army (Batov) and 3rd Army (Gorbatov). The
    1st Guards Tank Corps came from the south through marshes the Germans thought impassable, crossing on corduroy log
    roads built by sappers.
  - The pocket closed by 27 June. Air attacks hit the trapped German columns on the Berezina roads, and the town fell
    on 29 June. Minsk was freed on 3 July.
  - Some 220,000 Lend-Lease trucks carried the offensive forward.

### Briefing (a tank brigade commander, 1st Guards Tank Corps)

1. Three years ago they came through these forests at us. This morning we go back through them. The Germans hold the
   dry ground and the roads, and they think the marsh between them is a wall. Our sappers have spent a week laying
   log roads across it.
2. Break the line at the edge of the marsh, then do not stop. The rifle divisions will deal with the strongpoints we
   pass. Our job is to get behind them, cut the roads to Bobruisk and close the ring before their divisions can get out.
3. The new heavy tanks are with us, and their big gun will knock out anything the enemy has. Use them on the
   strongpoints. Use the air force on the roads. Finish at Bobruisk.

**Objective**: Break through, cross the marsh and take Bobruisk.

### Map and sectors

| x (wu) | Sector | Ground | Structures |
| --- | --- | --- | --- |
| 0 to 3,000 | Jump-off | forest | HQ (`logDugout`) |
| 3,000 to 8,000 | German forward line | forest, field | trenches T1 and T2; wire; minefield M1; capture point P1 (spawn) |
| 8,000 to 15,000 | The marsh | marsh, with a corduroy causeway (road) over 9,500 to 14,000 | vehicles only on the causeway: data `causeway` (a road strip in marsh); the Germans shell it |
| 15,000 to 20,000 | The dry ground and the road | field, road | buildings B1 and B2 (a village); capture point P2 "the road" (spawn) |
| 20,000 to 28,000 | Bobruisk and the Berezina | cobble, rubble | buildings B3 to B9; enemy HQ (the fortress command) at 27,850 |

### Forces

- **Player**: 5 sappers; 8 T-34-85; 2 IS-2 (`heavyTank`, look `is2`: available to train from this mission on);
  2 SU-76M; 2 M3 halftracks (`apc`) with 8 riflemen; 12 riflemen; 6 PPSh; 2 DP; 2 mortars; 1,000 Money. Supports:
  artillery, Katyusha (BM-13N), smoke, Il-2, Pe-2, Yak-9, recon.
- **Loans**: 2 IS-2 (if not bought, phase 1); 3 PTRS teams; 2 flamethrowers (phase 4).
- **Enemy**:
  - HQ (the 9th Army's corps), `incomeMul` 0.7.
  - Start: T1 and T2 (8 grenadiers, 2 MG42, 1 Pak 40 each); the road village (6 grenadiers, 1 StuG); Bobruisk
    (16 grenadiers in buildings, 4 MG, 2 Pak 40, 2 Panzer IV, 1 Tiger I).
  - Waves: 20th Panzer Division's counter-attack (Panzer IV).
  - Supports: artillery, little air.

### Phases and events

1. **"The breakthrough"** (capture P1).
   - 0 s: a free barrage of 6 strikes.
2. **"The log roads"** (reach x 15,000 with 10 units).
   - Hint: "Tanks stay on the log road; infantry can wade the marsh slowly."
   - Barrages on the causeway every 60 s (German artillery).
3. **"Cut the road"** (capture P2).
   - 100 s: 20th Panzer counter-attack (4 Panzer IV plus 8 grenadiers).
4. **"Bobruisk"** (destroy the enemy HQ).
   - German columns try to break out (`posture: 'counterattack'` toward P2): air strikes on the roads.

### Side objectives

- **No tank lost on the log road** (+10%).
- **Bobruisk in under 25 minutes** (+15%).

### Medals

Timed: target 26 minutes, target casualties 55.

### Music, weather, time

- **Music**: `bagration` (new). B minor to D major, 140 BPM. Relentless forward motion: a long-breathed ostinato, the
  theme in augmentation in the horns over driving snare, a marsh section with eerie high harmonics.
- **Weather and time**: summer, hot; morning to evening.

### How a sensible player wins on Normal

1. IS-2s on the trench strongpoints, T-34-85s and halftracks through the gap.
2. Cross the causeway in one push.
3. Deploy at P2 and meet the counter-attack.
4. Clear Bobruisk with flamethrowers and the Pe-2.

Expected 24 to 28 minutes.

---

## Mission 5: The Vistula–Oder offensive, Lisów

- **Id** 3005, key `vistula`. **Date** 12 to 13 January 1945 (`1945-01-13`). **Place** Lisów near Kielce,
  50.6911 N, 20.6661 E. **Mode** assault (a fast winter advance). **Length** about 24 minutes. **Map** 26,000 wu.
  **Theatre** the `polandWinter` variant.
- **History**:
  - Konev's 1st Ukrainian Front attacked from the Baranów–Sandomierz bridgehead on 12 January 1945, brought forward
    because a thaw was forecast; Warsaw fell on 17 January.
  - On 13 January at Lisów, T-34-85s of the 61st Guards Tank Brigade (10th Guards Tank Corps, 4th Tank Army) met
    heavy battalion 424 (the former 501st) with about 23 King Tigers and 29 Tiger Is, alongside Panthers of the 16th
    Panzer Division.
  - The Soviet brigade commander and the German battalion commander were both killed. Most of the German battalion was
    lost in the retreat over the next days.
  - Fog and snow kept aircraft away. German claims of fighting IS-2s at Lisów are disputed.

### Briefing (a tank battalion commander, 61st Guards Tank Brigade)

1. The offensive is two days early because the weathermen promise a thaw, and the general wants the ground frozen
   under our tracks. The front is broken. Now we drive, and we do not stop for the night.
2. Ahead of us, intelligence says, is a battalion of their heaviest tanks, the new King Tigers with them. In the open
   at long range they will murder us. In fog, among villages and woods, at short range, from the side, they are just
   big and slow. Do not fight them at their distance.
3. Take the villages on the Kielce road and keep the column moving. If you meet the heavy tanks, pin them from the
   front with fire and smoke, and send the rest round their flanks. Then on to Kielce.

**Objective**: Drive through the villages, destroy the heavy tank battalion's spearhead and open the road to Kielce.

### Map and sectors

| x (wu) | Sector | Ground | Structures |
| --- | --- | --- | --- |
| 0 to 3,000 | Bridgehead | snow | HQ (`logDugout`) |
| 3,000 to 9,000 | Broken front | snow | trenches T1 and T2 (German, thinly held); minefield |
| 9,000 to 15,000 | Villages and woods | snow, forest | buildings B1 to B4; capture point P1 (spawn) |
| 15,000 to 21,000 | Lisów | snow, cobble | buildings B5 to B8 (village, church); capture point P2 "Lisów" (spawn) |
| 21,000 to 26,000 | The Kielce road | road, snow | capture point P3; enemy HQ at 25,850 |

### Forces

- **Player**: 5 sappers; 12 T-34-85; 2 IS-2; 2 ISU-152 (`heavyTank` look `isu152`); 2 SU-76M; 2 M3 halftracks;
  16 riflemen; 6 PPSh; 1,000 Money. Supports: artillery, Katyusha, smoke; no air in fog.
- **Loans**: 4 PTRS teams; 4 trophy-Panzerfaust teams (`at`, look `trophyFaust`; their use in January 1945 is plausible
  but needs checking: if in doubt use PTRS).
- **Enemy**:
  - HQ, `incomeMul` 0.8.
  - Start: thin trench garrisons; village strongpoints (grenadiers, MG42, Pak 40).
  - Phase 3: the **King Tiger squad** plus 2 Tiger I plus 3 Panthers of the 16th Panzer Division, 10 grenadiers.
  - Supports: artillery.

### Phases and events

1. **"The breach"** (reach x 9,000 with 12 units). Fog (0.6).
2. **"The villages"** (capture P1).
   - Snow over 60 s.
3. **"Lisów"** (capture P2).
   - 30 s: banner "King Tigers!" (boss); the squad comes out of the woods at x 18,000.
   - Hints: "In the fog they see no further than you. Close in and hit the sides."
4. **"The road to Kielce"** (capture P3).

### Side objectives

- **The King Tiger** (+15%).
- **Through by dusk**: under 24 minutes (+10%).

### Medals

Timed: target 24 minutes, target casualties 60.

### Music, weather, time

- **Music**: `vistula` (new). F minor, 138 BPM. Icy speed: tinkling bell ostinato, a pad of frozen open fifths, and a
  racing snare. Anvil and low brass take over for the King Tiger (the "boss" section). The theme sounds over the
  sleigh-fast pulse.
- **Weather and time**: fog, low cloud, snow, about -10 °C; day to dusk.

### How a sensible player wins on Normal

1. Don't stop at the trenches; keep the column moving.
2. In Lisów, pin the King Tiger with an IS-2 and smoke, and flank it with T-34-85s at short range in the fog.
3. ISU-152s for the Panthers in the village.

Expected 22 to 26 minutes.

---

## Mission 6: The Oder bridgehead, Kienitz

- **Id** 3006, key `oder`. **Date** 31 January to February 1945 (`1945-02-02`). **Place** Kienitz, 52.6742 N,
  14.4411 E. **Mode** hold, with a prep phase. **Length** about 22 minutes. **Map** 14,000 wu. **Theatre**
  `oderbruch` (winter).
- **History**:
  - In the early morning of 31 January 1945, advance units of the 5th Shock Army (Berzarin) and the 2nd Guards Tank
    Army crossed the frozen Oder near Kienitz. The village had no German garrison and was taken by surprise.
  - The bridgehead was about 4 km wide and 2 km deep, and was fought over for some 76 days. The village was left about
    80% destroyed.
  - A late-January blizzard was followed by a thaw that softened the ice; heavy rain followed in early March.
  - The story of German officers or a leave train surprised in the village is not verified.

### Briefing (a rifle battalion commander, 5th Shock Army)

1. We are across the Oder. This morning our forward detachment crossed on the ice and walked into Kienitz before the
   Germans knew we were within fifty kilometres. Berlin is seventy kilometres west. You can see the lights of their
   trains at night.
2. The ice will not take tanks, and the thaw is coming, so until the engineers bridge the river we hold this bank with
   what came over on foot: rifles, machine guns, mortars, anti-tank rifles and whatever we take from them. Dig in now,
   in the village and the dykes; they will be here by midday.
3. They will throw everything they have at the bridgehead: tanks, aircraft, old men and boys with Panzerfausts. Do not
   give them a metre. This is the door to Berlin, and we are holding it open.

**Objective**: Hold the Kienitz bridgehead until the engineers bridge the Oder.

### Map and sectors

| x (wu) | Sector | Ground | Structures |
| --- | --- | --- | --- |
| 0 to 2,500 | East bank | snow | HQ (`logDugout`) |
| 2,500 to 4,500 | The frozen Oder | ice (infantry only; vehicles barred) | a pontoon bridge appears in phase 3 (`spawnPointState` and a bridge `setOwner`) |
| 4,500 to 7,500 | Kienitz | cobble | buildings B1 to B6 (village houses, church cellar as HQ annex); capture point P1 "Kienitz" (spawn) |
| 7,500 to 10,000 | Dykes and fields | snow, mud | trenches T1 and T2 (dyke lines, owner 0 after prep) |
| 10,000 to 14,000 | The Oderbruch to the west | field | enemy entry edge |

### Forces

- **Player**: 3 sappers; 16 riflemen; 6 PPSh; 3 DP; 2 PTRS; 2 mortars; 1 sniper; 500 Money. Supports: artillery from
  the east bank, Katyusha. No tanks until phase 3.
- **Loans**: 4 PTRS teams; 4 trophy Panzerfausts; 2 45 mm guns (dragged across the ice).
- **Enemy (no HQ, waves from the right)**:
  - Panzer IV, Panther, Hetzer, StuG; grenadiers, Volkssturm (older men), Fw 190s and Ju 87Gs (scripted raids;
    the Luftwaffe attacked the Oder bridgeheads hard).

### Phases and events

0. **Prep (60 s)**: foxholes, trenches, wire, mines, sandbags; zone 4,500 to 9,500.
1. **"Midday"** (survive 360 s; lose if P1 is lost).
   - Waves of grenadiers plus 2 Hetzer at 40 s and 220 s.
   - Fw 190 raid at 150 s.
2. **"The thaw"** (survive 360 s). Weather to `rain` over 120 s (the thaw); the ice becomes water: rafts only, units
   cross at 0.35.
   - 2 Panthers plus 2 Panzer IV plus 10 grenadiers.
   - Ju 87G raids on the river.
3. **"The bridge"** (survive 300 s).
   - 60 s: the pontoon bridge is complete (bridge 1 to owner 0); wave side 0: 4 T-34-85 plus 1 IS-2, announce "The
     engineers have the bridge across. Tanks are crossing!"
   - 120 s: the last German counter-attack.

### Side objectives

- **The church holds**: B4 never lost (+10%).
- **No German tank reaches the river** (+15%).

### Medals

Fixed scoring. Target casualties 45.

### Music, weather, time

- **Music**: `oder` (new). A minor, 120 BPM. Ice and endurance: glassy tremolo, a low drone, the theme in the
  low brass, insistent; the prep layer a quiet ticking with a cracking-ice bell figure. The thaw section warms
  slightly (pad), then grows grim.
- **Weather and time**: snow and cold, then a thaw with rain; day.

### How a sensible player wins on Normal

1. Fortify the dyke line and the houses during prep; mines on the road in.
2. PTRS teams and Panzerfausts in the houses on the flanks of the road.
3. Katyusha on the infantry waves.
4. Hold on until the bridge, then counter-attack with the tanks.

Fixed 22 minutes.

---

## Mission 7: The Seelow Heights

- **Id** 3007, key `seelow`. **Date** 16 to 18 April 1945 (`1945-04-16`). **Place** Seelow, 52.5298 N, 14.4261 E.
  **Mode** assault (at night, under searchlights). **Length** about 28 minutes. **Map** 24,000 wu. **Theatre**
  `oderbruch`.
- **History**:
  - Zhukov's 1st Belorussian Front opened at 05:00 Moscow time (03:00 Berlin time) on 16 April: a 25-minute barrage,
    then about 140 searchlights (the popular figure is 143) switched on at 05:25, and the attack went in at 05:30.
  - Dust and smoke diffused the beams, which silhouetted and dazzled the attackers.
  - Heinrici had pulled his front-line troops back just before the barrage, so much of it fell on empty trenches.
  - The flooded Oderbruch, crossed by drainage ditches, lies below a 30 to 50 m escarpment.
  - The 8th Guards Army (Chuikov) attacked along Reichsstraße 1, and the 1st Guards Tank Army (Katukov) was thrown in
    early.
  - German counter-attacks on 18 April included King Tigers of heavy battalion 503.
  - The heights broke on 19 April. Soviet losses are disputed: from about 5,000 to more than 30,000 killed.

### Briefing (a regimental commander, 8th Guards Army)

1. Behind those heights is Berlin. At three in the morning, their time, every gun on the front opens fire: thousands
   of them, wheel to wheel. Then the searchlights come on, more than a hundred of them, to blind the defenders and
   light our way across the flood plain.
2. The Oderbruch is wet ground cut by ditches; the tanks will keep to the roads and the dykes, and the road to Seelow
   will be crowded. Get the infantry forward fast while the barrage still has them under cover. Then up the
   escarpment: it is steep, and they have dug in on top.
3. This is the last line in front of their capital. Take the heights, take the town, and do not let the light dazzle
   you. If the beams turn the smoke to a wall, go through it.

**Objective**: Cross the Oderbruch at night, storm the Seelow Heights and take the town.

### Map and sectors

| x (wu) | Sector | Ground | Structures |
| --- | --- | --- | --- |
| 0 to 3,000 | The bridgehead | mud | HQ (`logDugout`); searchlight battery props (14) along x 1,000 to 2,800 |
| 3,000 to 11,000 | The Oderbruch | marsh, with road and dyke strips (vehicles on the strips only) | drainage ditches as small water strips; first German trench T1 (empty after Heinrici's pull-back: scripted); minefield M1 |
| 11,000 to 14,000 | Foot of the heights | mud | trench T2 (German, full); wire; Flak 88 pair (guard) |
| 14,000 to 18,000 | The escarpment | slope up | trench T3; Tobruks |
| 18,000 to 24,000 | Seelow town | cobble | buildings B1 to B7; capture point P2 "Seelow" (spawn); enemy HQ at 23,850 |

### Forces

- **Player**: 6 sappers; 10 T-34-85; 3 IS-2; 2 ISU-152; 20 riflemen; 8 PPSh; 4 DP; 4 mortars; 2 flamethrowers;
  1,200 Money. Supports: artillery (heavy), Katyusha, smoke, Il-2 (from dawn), Pe-2, recon.
- **Loans**: 4 trophy Panzerfaust teams; 2 flamethrowers.
- **Enemy**:
  - HQ (9th Army's front), `incomeMul` 0.8.
  - Start: T1 (empty), T2 (10 grenadiers, 3 MG42, 2 Pak 40), Flak 88s, T3 (8 grenadiers, 2 MG), Panzerfaust teams,
    Hetzers (2), Panthers (2) in Seelow.
  - Phase 4: the **King Tiger squad** counter-attack plus 2 Panthers.
  - Supports: artillery, Nebelwerfer.

### Phases and events

1. **"The barrage and the lights"** (reach x 11,000 with 15 units). Time night (0.65).
   - 0 s: free barrages (6 strikes).
   - 25 s: searchlights on: visibility 0.95 in the band x 3,000 to 12,000, then the `smoke` weather builds over 90 s
     (dust), visibility down to 0.7 and own units dazzled (data: side 0 `accuracyFar` x0.9 while the lights are on).
   - Hint: "The empty trench: they have pulled back. The real line is at the foot of the heights."
2. **"The foot of the heights"** (capture T2). Time dawn.
3. **"The escarpment"** (capture T3).
   - Slope; Il-2 available at dawn.
4. **"Seelow"** (capture P2, then destroy the enemy HQ).
   - 60 s after P2 is captured: banner "King Tigers counter-attacking!"; the King Tiger squad plus 2 Panthers.

### Side objectives

- **The Flak guns at the foot**, destroyed without losing a tank (+10%).
- **The King Tiger** (+15%).

### Medals

Timed: target 28 minutes, target casualties 75.

### Music, weather, time

- **Music**: `seelow` (new). B-flat minor, 132 BPM. Opens with a colossal barrage texture (timpani rolls, low brass
  clusters), then a blinding high string cluster for the lights. The combat layer is grinding and uphill (rising
  sequences), and the theme climbs in the brass toward the heights.
- **Weather and time**: clear night, then dust and smoke; night to dawn to day.

### How a sensible player wins on Normal

1. Push the infantry on the roads under the barrage; don't stop at the empty trench.
2. IS-2s and ISU-152s on T2 and the 88s, with smoke.
3. Flamethrowers up the escarpment.
4. In Seelow, keep the IS-2s together for the King Tiger and hit its sides.

Expected 26 to 30 minutes.

---

## Mission 8: Into Berlin

- **Id** 3008, key `berlinOuter`. **Date** 23 to 26 April 1945 (`1945-04-24`). **Place** Berlin's south-eastern
  districts, the Spree and the Teltow Canal, toward Tempelhof, 52.473 N, 13.402 E. **Mode** assault. **Length** about
  28 minutes. **Map** 24,000 wu. **Theatre** `berlin`.
- **History**:
  - Soviet artillery began shelling Berlin on 20 to 21 April. On 23 April Weidling's LVI Panzer Corps took over the
    city's defence.
  - The 5th Shock and 8th Guards Armies crossed the Spree and the Dahme from the south-east around 23 to 24 April.
    Rybalko's 3rd Guards Tank Army forced the Teltow Canal on 24 April, and the ring around the city closed on 25 April.
  - On 26 April the 8th Guards Army and the 1st Guards Tank Army attacked Tempelhof airport against the Müncheberg
    Panzer Division.
  - The defenders, about 45,000 troops plus some 40,000 Volkssturm, police and Hitler Youth, fought with Panzerfausts
    from every building. The game shows the Volkssturm as older men only.

### Briefing (a rifle regiment commander, 8th Guards Army)

1. We are in Berlin. This morning the regiment crosses the Spree into the city, and from here every house is a
   fortress. They have more anti-tank rockets than rifles, and an old man with one in a cellar window can kill a heavy
   tank.
2. Fight in assault groups: infantry first, sappers with them, a gun or a tank behind to blast each building, and
   flamethrowers for the cellars. Tanks never go first down a street. Take a block, deploy there, and take the next.
3. Ahead is the canal and beyond it the airport at Tempelhof. Take the bridgehead over the water, clear the blocks
   along the railway, and seize the airfield's buildings. The war is nearly over. Nobody wants to be the last man
   killed in it, so fight carefully.

**Objective**: Cross the Spree, clear the blocks and take Tempelhof.

### Map and sectors

| x (wu) | Sector | Ground | Structures |
| --- | --- | --- | --- |
| 0 to 2,500 | Treptow, east bank | rubble | HQ (`logDugout`) |
| 2,500 to 3,500 | The Spree | water | a damaged bridge 1 (infantry only until phase 2's repair) |
| 3,500 to 10,000 | Apartment blocks | rubble, cobble | buildings B1 to B8 (4 floors); capture point P1 (spawn) |
| 10,000 to 12,000 | S-Bahn embankment | slope | trench T1 (the embankment line) |
| 12,000 to 16,000 | More blocks | rubble | B9 to B13; capture point P2 (spawn) |
| 16,000 to 24,000 | Tempelhof | cobble, field | the airport buildings B14 to B16 (`terminal`); capture point P3 "Tempelhof"; enemy HQ at 23,850 |

### Forces

- **Player**: 6 sappers; 6 T-34-85; 2 IS-2; 2 ISU-152; 20 riflemen; 10 PPSh; 4 DP; 4 mortars; 3 flamethrowers;
  2 snipers; 4 ZiS-3 crews (`at` look `zis3`, assault guns firing over open sights); 1,200 Money. Supports: artillery,
  Katyusha, smoke, Il-2, Pe-2.
- **Loans**: 4 flamethrowers; 4 trophy Panzerfaust teams; 4 assault sappers (the Demolish job on buildings).
- **Enemy**:
  - HQ, `incomeMul` 0.8.
  - Start: every building garrisoned (2 to 6 men: grenadiers, Volkssturm, Panzerfaust teams); T1 (8 grenadiers, 2 MG42,
    Flak 88); Tempelhof (Müncheberg Division: 2 Panthers, 1 StuG, 12 grenadiers).
  - Waves: small counter-attacks.
  - Supports: artillery; the flak towers' fire as `barrage` events (scripted).

### Phases and events

1. **"The Spree"** (capture P1).
   - Hint: "Tanks behind, infantry ahead: a Panzerfaust in a window kills a tank."
2. **"Block by block"** (capture T1 and P2).
   - The bridge is repaired at 120 s (vehicles can cross).
3. **"Tempelhof"** (capture P3, then destroy the enemy HQ).
   - 100 s: Müncheberg's Panthers counter-attack.

### Side objectives

- **No tank lost to a Panzerfaust** (+15%).
- **Tempelhof by 25 minutes** (+10%).

### Medals

Timed: target 28 minutes, target casualties 70.

### Music, weather, time

- **Music**: `berlinOuter` (new). E minor, 128 BPM. Urban and metallic: anvil, rim, short brass stabs echoing between
  walls (a short, hard reverb), and the theme's march form for the assault groups. The quiet sections are a single
  bell tolling over smoke.
- **Weather and time**: overcast, showers, smoke from fires; day.

### How a sensible player wins on Normal

1. Riflemen and PPSh troopers first over the bridge.
2. Flamethrowers and sappers in each building, with an ISU-152 blasting the next one.
3. Deploy forward block by block. IS-2s on the Panthers at Tempelhof.

Expected 26 to 30 minutes.

---

## Mission 9: The Moltke Bridge

- **Id** 3009, key `moltke`. **Date** 28 to 29 April 1945 (`1945-04-29`). **Place** Moltke Bridge over the Spree,
  52.5216 N, 13.3707 E. **Mode** special (a contested bridge crossing, then a building assault). **Length** about 20
  minutes. **Map** 10,000 wu. **Theatre** `berlin`.
- **History**:
  - The 79th Rifle Corps (Perevertkin) of the 3rd Shock Army, with the 150th (Shatilov) and 171st (Negoda) Rifle
    Divisions, reached the Moltke Bridge on 28 April.
  - German sappers had blown it, but it sagged rather than collapsed. Concrete barricades about a metre thick blocked
    both ends, under fire from the embankments.
  - After a failed first rush, artillery smashed the strongpoints and the battalions crossed at dusk; by the morning of
    29 April the forward battalions (Neustroev, Samsonov) were across.
  - The six-storey Ministry of the Interior ("Himmler's house") was stormed room by room from 07:00 on 29 April and
    secured early on 30 April.

### Briefing (a rifle battalion commander, 150th Rifle Division)

1. Over the river is the government quarter, and over the government quarter is the Reichstag. Between us and it is
   one bridge. They blew it last night, but it did not fall; it hangs in the middle, with concrete barricades at both
   ends and machine guns in every window on the far bank.
2. The first rush will fail if we try it in daylight without the guns. So: every gun we have on the embankment houses
   first, then smoke, then the battalion goes over in one rush, under the barricades and into the first buildings.
3. Beyond the bridge is a huge stone ministry: six floors, a thousand rooms, and every room will have to be taken. Do
   it, and tomorrow we can see the Reichstag from its windows.

**Objective**: Cross the Moltke Bridge and take the Ministry of the Interior.

### Map and sectors

| x (wu) | Sector | Ground | Structures |
| --- | --- | --- | --- |
| 0 to 2,500 | Moabit, north bank | rubble | HQ (`logDugout`); buildings B1 and B2 (our side) |
| 2,500 to 4,000 | The Moltke Bridge | water, with bridge 1 (x 2,600 to 3,900, damaged: infantry speed 0.7, vehicles barred until phase 3) | barricades as `pillbox` structures PB1 (north end, German, MG) and PB2 (south end) |
| 4,000 to 5,000 | Kronprinzenufer embankment | cobble | trench T1 (German, embankment); buildings B3 and B4 (embankment houses, German) |
| 5,000 to 10,000 | The Ministry of the Interior | cobble | building B5 (`ministry`, 4 floors drawn as 6, slots 10 per floor, hp x3, owner 1, garrison); enemy HQ (a command post in the Kroll Opera area) at 9,850 |

### Forces

- **Player**: 4 sappers; 24 riflemen; 10 PPSh; 4 DP; 4 mortars; 3 flamethrowers; 2 snipers; 2 ISU-152 and 2 IS-2
  (north bank, vehicles: direct fire across the river); 4 ZiS-3 crews; 900 Money. Supports: artillery, Katyusha,
  smoke.
- **Loans**: 4 flamethrowers; 4 assault sappers; 4 trophy Panzerfausts.
- **Enemy**:
  - HQ, `incomeMul` 0.8.
  - Start: PB1 and PB2; B3 and B4 (6 men each, MG42s, Panzerfausts); T1 (8 grenadiers, 2 MG); B5 the ministry
    (30 men: grenadiers, Volkssturm, Panzerfausts, snipers, 4 MG).
  - Waves: small groups from the Königsplatz.
  - Supports: artillery and flak fire.

### Phases and events

1. **"The first rush"** (destroy PB1).
   - 60 s: a scripted lesson: if the player sends infantry onto the bridge before PB1 falls, hint "Not like this. Guns
     first." (a hint only, no penalty).
2. **"Across"** (capture T1 and buildings B3 and B4). Time dusk, then night.
   - Smoke is cheaper this phase (data: cooldown halved).
3. **"Himmler's house"** (capture B5). Time night, then dawn.
   - Every floor lost costs the Germans a floor: when B5's hp falls past each threshold, a floor collapses (FOUNDATIONS
     4.3).
   - 200 s: the German counter-attack from the Königsplatz.
   - On capture: announce "From the ministry's windows: the Reichstag." Mission won.

### Side objectives

- **Over in one rush**: capture T1 within 120 s of the phase start (+15%).
- **The embankment houses**: capture B3 and B4 before B5 (+10%).

### Medals

Timed: target 20 minutes, target casualties 55.

### Music, weather, time

- **Music**: `moltke` (new). G minor, 132 BPM. Tense and coiled: a ticking clock rim-shot and a slow string crescendo
  for the bridge, an explosive combat layer, and a claustrophobic section for the ministry (low strings, dry timpani,
  the motif fragmented).
- **Weather and time**: smoke and haze; afternoon, dusk, night, dawn.

### How a sensible player wins on Normal

1. ISU-152s and ZiS-3s on PB1 and the embankment houses.
2. Smoke, then everything over the bridge at once.
3. Clear B3 and B4 with flamethrowers.
4. Assault the ministry floor by floor with sappers and PPSh troopers; snipers on its windows.

Expected 18 to 22 minutes.

---

## Mission 10: The Reichstag

- **Id** 3010, key `reichstag`. **Date** 30 April to 2 May 1945 (`1945-04-30`). **Place** the Reichstag, Berlin,
  52.5186 N, 13.3762 E. **Mode** special (the final assault, ending with the flag raised). **Length** about 26
  minutes. **Map** 12,000 wu. **Theatre** `berlin`.
- **History**:
  - From the ministry, the 150th and 171st Rifle Divisions attacked across the Königsplatz, crossed by a water-filled
    U-Bahn construction trench, under fire from guns in the Tiergarten and the Kroll Opera.
  - The morning attack failed. After 30 minutes of direct fire from 89 guns, the battalions of Neustroev, Davydov and
    Samsonov went in at 13:00, supported by tanks and ISU-152s.
  - The building's windows were bricked up into firing slits. About 1,000 men, among them naval cadets and foreign
    volunteers, held it.
  - About 40 flags went up. An early report of a flag at 14:25 was premature. Sergeants Yegorov and Kantaria with
    Lieutenant Berest fixed Assault Flag No. 5 of the 150th Division late on 30 April; it was moved to the dome on
    2 May. Who was first is still disputed.
  - The garrison surrendered early on 2 May, and Weidling surrendered the city that morning.
  - Khaldei's famous photograph was staged on 2 May.

### Briefing (a regimental commander, 150th Rifle Division)

1. There it is: the Reichstag, across the square, its dome a skeleton of iron. Every regiment in the army has made a
   flag for it, and every one of them wants theirs on top. Ours is Assault Flag Number Five, and it is going to the
   roof.
2. The square is three hundred metres of open ground with a flooded trench across it, under fire from the Tiergarten
   and the opera house. The guns will fire straight into the walls for half an hour first. Then over the trench, up the
   steps and in, through every window they have not bricked up.
3. Inside, it is room by room and floor by floor, and they will fight on the stairs. Get the flag through the building
   and onto the roof. When it is up, the war is over for this city.

**Objective**: Cross the Königsplatz, storm the Reichstag and raise the flag on the roof.

### Map and sectors

| x (wu) | Sector | Ground | Structures |
| --- | --- | --- | --- |
| 0 to 2,500 | The Ministry of the Interior | rubble | HQ (look `ministry`: our captured building) |
| 2,500 to 6,500 | Königsplatz | cobble, with a flooded trench (water strip at 4,000 to 4,400, infantry only, a footbridge of planks scripted in phase 2) | shell craters; capture point P1 "the trench" (x 4,600, spawn) |
| 6,500 to 7,500 | The steps | cobble | barricades PB1 and PB2; trench T1 |
| 7,500 to 11,000 | The Reichstag | concrete | building B1 (`reichstag`, 4 floors, 12 slots each, hp x5; the floors are taken one by one: an objective chain); flag point P2 "the roof" (x 10,500, captureTime 20 s, reachable only once all floors are cleared) |
| 11,000 to 12,000 | The Tiergarten edge (east, flank) | forest | German guns as `gunPit` structures G1 to G3 (105 mm and 88 mm, firing across the square); the King Tiger (game licence, see the roster) dug in at 11,600 (`guard`) |

### Forces

- **Player**: 4 sappers; 30 riflemen; 12 PPSh; 4 DP; 4 mortars; 4 flamethrowers; 3 snipers; 4 T-34-85; 2 IS-2;
  2 ISU-152 (look `isu152`); 1,200 Money. Supports: artillery (the 89-gun direct fire as a scripted barrage),
  Katyusha, smoke.
- **The flag party**: a unit tag `flag` on 3 men (`commanderName` none). The `reach` objective P2 needs any tagged
  unit; if all three die, the next three riflemen to spawn carry it.
- **Loans**: 4 flamethrowers; 4 assault sappers; 4 trophy Panzerfausts.
- **Enemy**:
  - HQ (the garrison command, inside B1: the HQ is the building itself, look `reichstag`), `incomeMul` 0.7.
  - Start: PB1, PB2, T1 (8 grenadiers, 2 MG42); B1 (about 40 men over 4 floors: naval cadets as rifle looks with
    naval caps, grenadiers, foreign volunteers shown as plain German, Panzerfausts, MG42s, snipers); the Tiergarten
    guns G1 to G3; the King Tiger squad's tank only (no escort).
  - Waves: counter-attacks from the cellars (posture `counterattack` when a floor falls).

### Phases and events

1. **"The morning attack"** (reach P1 with 10 units).
   - The first assault is meant to stall: the Tiergarten guns and PB1 and PB2 fire on the square.
   - Hint: "Silence the Tiergarten guns and the barricades first."
2. **"Thirteen hundred hours"** (capture T1).
   - 0 s: banner "Direct fire!"; scripted barrages on PB1, PB2 and B1's facade (6 strikes); the planks over the
     trench appear.
3. **"Inside"** (clear floors 1 to 4 of B1: four `destroy` sub-objectives, one floor at a time, by killing every
   defender on it). Time dusk, then night.
   - Flamethrowers and grenades rank highly.
   - Counter-attacks from the cellar when a floor falls.
4. **"The roof"** (reach P2 with a `flag` unit; hold it for 20 s).
   - On success: announce "Assault Flag No. 5 flies over the Reichstag." The victory screen shows the flag on the
     dome; a closing card: "2 May 1945: the Berlin garrison surrenders."

### Side objectives

- **The King Tiger** destroyed (+10%).
- **The Tiergarten guns** silenced within 300 s (+15%).
- **The flag by midnight**: under 24 minutes (+10%).

### Medals

Timed: target 26 minutes, target casualties 70.

### Music, weather, time

- **Music**: `reichstag` (new). C minor to C major, 136 BPM. The campaign's culmination: the `roadWest` theme in every
  form, a steady march on the snare for the square, a tight claustrophobic layer for the floors, and in the last
  section the theme in full major with brass and bells. The victory sting is the theme's final octave, held.
- **Weather and time**: smoke, overcast; afternoon, dusk, night.

### How a sensible player wins on Normal

1. Snipers and mortars on the Tiergarten gun crews; IS-2s on the King Tiger from an angle (it is dug in, front-on to
   the square, so go wide on the flank).
2. Barrages on PB1 and PB2, then cross the trench.
3. Inside, flamethrowers and PPSh troopers floor by floor with the flag party behind.
4. Up to the roof.

Expected 24 to 28 minutes.

---

## Summary table

| # | Id | Key | Date | Mode | Prep | Map wu | Minutes | Target time / casualties | Track | Weather, time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 3001 | kursk | 5 to 10 Jul 1943 | hold | yes | 20,000 | 24 | fixed / 60 | kursk | hot, thunderstorms |
| 2 | 3002 | prokhorovka | 12 Jul 1943 | assault | no | 22,000 | 22 | 22 / 75 | prokhorovka | low cloud, storms |
| 3 | 3003 | dnieper | 22 to 23 Sep 1943 | special | no | 12,000 | 20 | 20 / 45 | dnieper | night fog, drizzle |
| 4 | 3004 | bagration | 23 to 29 Jun 1944 | assault | no | 28,000 | 26 | 26 / 55 | bagration | summer |
| 5 | 3005 | vistula | 12 to 13 Jan 1945 | assault | no | 26,000 | 24 | 24 / 60 | vistula | fog, snow |
| 6 | 3006 | oder | 31 Jan to Feb 1945 | hold | yes | 14,000 | 22 | fixed / 45 | oder | snow, thaw |
| 7 | 3007 | seelow | 16 to 18 Apr 1945 | assault | no | 24,000 | 28 | 28 / 75 | seelow | night, searchlights, dust |
| 8 | 3008 | berlinOuter | 23 to 26 Apr 1945 | assault | no | 24,000 | 28 | 28 / 70 | berlinOuter | showers, smoke |
| 9 | 3009 | moltke | 28 to 29 Apr 1945 | special | no | 10,000 | 20 | 20 / 55 | moltke | haze, dusk to dawn |
| 10 | 3010 | reichstag | 30 Apr to 2 May 1945 | special (flag) | no | 12,000 | 26 | 26 / 70 | reichstag | smoke, to night |

New tracks: 10, plus the theme `roadWest` and the map track `berlinMap`. The IS-2 is trainable from mission 4.
King Tiger squads appear in missions 5, 7 and 10 (mission 10 is game licence, as noted).
