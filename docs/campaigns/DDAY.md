# British campaign: D-Day (Normandy, June to August 1944)

Campaign id `dday`, missions 2001 to 2010. It **replaces** the current British campaign (missions 1 to 10, scrapped).
The save migration that keeps medals, the Armoury and passives is in `FOUNDATIONS.md` section 8.2, the
hunteracedev.com card text in 8.3. Nation data in `NATIONS.md` (British 1944, German 1944); sources in `HISTORY.md`.

## Campaign

- **Card**: "D-Day: June to August 1944. From the bridges at midnight to the Falaise Pocket."
- **Flag**: Union Jack. Vehicles carry the 1944 Allied white star.
- **Map region**: the Calvados close-up, lon -1.25 to 0.45, lat 48.65 to 49.45. Land shapes: the coast from Port-en-Bessin
  to the Dives estuary, the Orne and its canal, the Odon, the Seulles, the bocage south of Bayeux. Labels: Bayeux,
  Arromanches, Ouistreham, Caen, Villers-Bocage, Falaise, Flers. Beaches shaded: Gold, Juno, Sword.
- **Theme**: "The Line" (`BRITISH_MOTIF`, unchanged; `docs/MUSIC.md`). New tracks use it in their own forms, so the
  reused `sword` and `hill112` already belong. The map track stays "Between the Lines".
- **Theatres**: `normandy` (beach, dunes, seafront villas) and `france` (bocage, orchards, Norman farms) exist. New:
  - `normandyCity` (Caen: stone houses, the Abbaye aux Hommes spires, rubble; reuse `stalingrad` building art with a
    Norman palette);
  - `cornfields` (Goodwood: open wheat, railway embankments, villages);
  - a `night` dressing for Pegasus and Merville (moonlit; the existing night time-grade).
- **The old British campaign's art** (desert, Sicily, Italy, Holland, Germany backdrops) goes to the African campaign
  (desert) or waits for the French and German campaigns. Its tracks other than `sword`, `hill112`, `crusader` and
  `alamein` (`arras`, `dunkirk`, `primosole`, `cassino`, `arnhem`, `reichswald`) stay in the code for a later French
  campaign and the admin panel's music list. No two current missions share a track.

### Enemy roster by date

| Missions | Date | Infantry | Anti-tank | Armour | Air and guns |
| --- | --- | --- | --- | --- | --- |
| 1 to 5 | 6 to 7 Jun | 716th Infantry Division (static, with Ost battalions), 352nd near Gold; Kar98k, MG42, MP40 | Pak 40, 5 cm guns in Tobruk pits, Panzerfaust and Panzerschreck, 7.5 cm and 8.8 cm casemate guns | 21st Panzer: Panzer IV H, converted French-chassis assault guns, Sd.Kfz. 251; StuG III (352nd's anti-tank battalion) | coastal batteries (Czech 100 mm howitzers at Merville and Morris), Nebelwerfer, 8.1 cm mortars; almost no Luftwaffe by day |
| 6 | 13 Jun | Panzer Lehr grenadiers | Pak 40, Panzerfaust | **Tiger I** (heavy battalion 101; shown as plain German), Panzer IV H | artillery |
| 7 | 26 to 29 Jun | 12th SS, 9th and 10th SS Panzer Divisions (shown with no SS insignia) | Pak 40, 8.8 cm, Panzerschreck | Panther, Panzer IV H, Tiger I, StuG | Nebelwerfer brigades |
| 8 | 8 to 9 Jul | 12th SS, 16th Luftwaffe Field Division | Pak 40, Panzerfaust | Panther, Panzer IV | artillery |
| 9 | 18 Jul | 21st Panzer, 16th Luftwaffe Field Division, 1st SS | 8.8 cm guns at Cagny, Pak 40 | **King Tiger squad** (heavy battalion 503's Tiger II company) and Tiger I, Panther, Panzer IV, converted assault guns | Nebelwerfer |
| 10 | 16 to 20 Aug | rearguards of many divisions | Pak 40, Panzerfaust | Panther, Panzer IV, StuG, Tiger I | almost no air |

**No Tiger or Panther faces the British beaches on D-Day.** The first Tigers met by the British appear at
Villers-Bocage. The King Tiger squad appears only at Goodwood. The Tiger II's Normandy debut is usually given as
18 July 1944 near Troarn and Démouville; some sources say 11 July.

### The British player by date

- **6 June**:
  - airborne (Para, Sten, Bren, PIAT, 2-inch mortar, Vickers);
  - 3rd and 50th Divisions (No. 4 rifle, Bren, Sten, PIAT, 3-inch mortar);
  - commandos;
  - Sherman DD and Sherman tanks; the Firefly from Sword on;
  - the mission-only Churchill AVRE and Sherman Crab;
  - naval bombardment.
- **From 13 June**: the Cromwell (7th Armoured); Stuart.
- **Epsom**: the Churchill (31st Tank Brigade).
- **August**: the Kangaroo APC.
- **Call-ins**: Typhoon rockets throughout; the Mitchell bomber from mission 3; the Auster recon from mission 4.

### How "mighty" the Germans are

D-Day missions 1 to 5: the Germans hold concrete, wire, mines and interlocking guns, but are thin and second-rate.
The player has the call-ins and the numbers. Missions 6 to 10: the panzer divisions arrive, and the Germans are strong
in armour quality (Tigers, Panthers, 88s, the King Tiger) and in defensive positions. The player has artillery, air
and numbers. Enemy income never exceeds the player's.

---

## Mission 1: Pegasus Bridge (tutorial)

- **Id** 2001, key `pegasus`. **Date** night of 5 to 6 June 1944 (`1944-06-06`). **Place** Bénouville canal bridge,
  49.2422 N, 0.2744 W (`lon -0.2744`). **Mode** special (capture, then hold). **Length** about 12 minutes.
  **Map** 7,500 wu. **Theatre** `normandy` (night).
- **History**:
  - D Company, 2nd Oxfordshire and Buckinghamshire Light Infantry (Major John Howard), with Royal Engineers sappers:
    181 men in six Horsa gliders.
  - The first glider hit the wire at the canal bridge at 00:16; the river bridge gliders landed at about 00:20.
  - Lieutenant Den Brotheridge, leading the first platoon across, is generally called the first Allied soldier killed
    by enemy action on D-Day.
  - About 50 men of Grenadier Regiment 736 defended the bridges. The demolition charges had not been placed in their
    chambers.
  - 7th Parachute Battalion relieved them in the small hours: sources range from about 01:40 to 02:40.
  - Lord Lovat's commandos arrived around 13:00 behind piper Bill Millin; sources give 13:00 to 13:30.
  - A PIAT team hit an approaching armoured vehicle in the night.

### Briefing (a company commander, 2nd Ox and Bucks)

1. Two bridges, one over the canal and one over the river, a quarter of a mile apart. Whoever holds them holds the
   only road between the beaches and the airborne division east of the Orne. We land beside them in gliders at a
   quarter past midnight, which the pilots assure me is precisely where they intend to put us.
2. The garrison is small and asleep, and their sappers have prepared the bridges for blowing. Get across fast, clear
   the pillbox and the gun pits, and send the codewords. Our own sappers come with us; they will find the charges
   and make the stores and containers do for an ammunition dump.
3. Then hold until the paratroops come in from the drop zone, and hold again in the morning until the commandos
   march up from the beach. They will be late. Commandos generally are.

**Objective**: Seize both bridges intact, then hold until relieved.

### Map and sectors

| x (wu) | Sector | Ground | Structures |
| --- | --- | --- | --- |
| 0 to 1,800 | Landing zone | grass | HQ (look `tent`, the company aid post); dump look `gliderWreck` (supply containers) |
| 1,800 to 3,200 | Canal bridge | road | wire at 2,200; pillbox PB1 (x 2,600, MG); trench T1 (x 2,900, German, 6 slots); bridge 1 over the canal (x 3,000 to 3,300) |
| 3,200 to 4,600 | Between the bridges, the café | grass | building B1 the café (x 3,500, 2 floors, 5 slots); capture point P1 "Ham" (canal bridge, structure T1) |
| 4,600 to 5,600 | River bridge | road | bridge 2 over the Orne (x 4,800 to 5,200); capture point P2 "Jam" (x 5,400) |
| 5,600 to 7,500 | Ranville road | grass, orchard | enemy entry edge |

### Forces

- **Player**: 2 sappers (RE), 12 Paras (`assault`, Sten), 6 riflemen, 2 Bren gunners, 1 PIAT team, 1 2-inch mortar
  (`mortar`), placed at x 2,000 as the glider landing; 150 Money. Trainable: sapper, rifle and the Armoury. Supports:
  none until phase 3 (naval guns from the beaches).
- **Loans**: 1 PIAT team (start); 2 Bren gunners (start).
- **Enemy**: PB1 and T1 (6 riflemen, 1 MG42); 4 riflemen at the river bridge. Later waves from the right (no HQ):
  riflemen, MG teams, an Sd.Kfz. 251 (`apc`), a Panzer IV (21st Panzer), snipers, mortars.

### Phases and events

1. **"Ham and Jam"** (capture P1 and P2). Time night.
   - 0 s: banner "The first glider is down!".
   - Hints:
     - "Take the canal bridge: grenades clear pillboxes."
     - "Sappers carry Money from the containers to your HQ. More sappers, more Money."
     - "Advance takes the whole company forward; Hold stops on the line."
   - On P1 captured: announce "The sappers report the demolition chambers empty." On P2 captured: announce "Ham and
     Jam. Both bridges are ours."
2. **"Hold until relieved"** (survive 240 s).
   - 30 s: Sd.Kfz. 251 plus 6 riflemen from Ranville.
   - 120 s: the Panzer IV on the road, banner "Armour on the bridge road!" (the PIAT hint).
   - 200 s: wave side 0 at x 2,000: 10 Paras of 7th Battalion, announce "The 7th Parachute Battalion is up from the
     drop zone."
   - Hint: "Fall Back shelters men in the HQ; Hold keeps the line."
3. **"Morning"** (survive 240 s). Time to dawn over 60 s, then day.
   - Snipers in the trees (2).
   - Mortar fire.
   - 21st Panzer infantry every 40 s.
   - A German fighter-bomber's bomb that fails to explode (scripted: a dud lands on the bridge, hint "Not every bomb
     goes off. Don't count on it twice.").
   - Naval bombardment unlocked (hint).
   - At 240 s: announce "Bagpipes on the bridge road. The commandos are through."

### Side objectives

- **Both bridges in five minutes** (+15%).
- **The café holds**: B1 never captured (+10%).

### Medals

Fixed scoring (special). Target casualties 15.

### Music, weather, time

- **Music**: `pegasus` (new). D minor, 120 BPM. Stealthy and quick: a pizzicato-like string ostinato, a muffled snare
  and brushed timpani, the motif on muted horn (`take: 3`) as gliders descend. Then the combat layer opens with full
  brass. The tense layer has a ticking rim-shot.
- **Weather and time**: broken cloud, windy; night to dawn to day.

### How a sensible player wins on Normal

1. Rush PB1 with the Paras' grenades while the Brens cover.
2. Riflemen take T1, then everyone crosses to P2.
3. Put the PIAT in the café and the Brens on the river bridge. Train sappers and riflemen.
4. Hold at the river bridge until the 7th Battalion arrives, then sit tight through the morning.

Fixed 12 minutes.

---

## Mission 2: The Merville Battery

- **Id** 2002, key `merville`. **Date** 6 June 1944, about 02:50 to 05:00 (`1944-06-06`). **Place** Merville-Franceville,
  49.2694 N, 0.1978 W. **Mode** special (a raid against a deadline). **Length** about 14 minutes. **Map** 8,000 wu.
  **Theatre** `normandy` (night, marsh and orchard).
- **History**:
  - The 9th Parachute Battalion (Lieutenant Colonel Terence Otway) dropped from about 00:50, badly scattered; many men
    were lost in the flooded Dives marshes.
  - By 02:50 only about 150 of roughly 600 to 650 men had reached the rendezvous, with one Vickers gun, Bangalore
    torpedoes and no mortars, anti-tank guns, mine detectors or engineers.
  - The bombers had missed the battery. One of the three gliders meant to land on it came down outside, after being
    hit by flak.
  - The four casemates held Czech-built 100 mm howitzers, not the expected 150 mm guns. The garrison was about 130 men
    of 1st Battery, Artillery Regiment 1716 (Oberleutnant Raimund Steiner).
  - The assault was over by about 05:00. HMS Arethusa had orders to shell the battery at 05:30 if no success signal
    came.
  - British losses were 65 to 75 of the 150.

### Briefing (a parachute battalion commander)

1. The battalion was to be six hundred strong at the rendezvous. It is not. The drop was scattered all over the marsh,
   and there is no sign of the mortars, the jeeps or the sappers. We go at the battery with whoever is here, and
   whoever turns up on the way.
2. The battery sits behind two belts of wire and a minefield. The bombing has missed it, which saves the enemy the
   trouble of repairing anything. Blow the wire with the Bangalores, follow the marked path through the mines, and
   get men with Gammon bombs into each of the four casemates.
3. If the guns are not out of action and the signal flare is not up by half past five, a cruiser offshore will shell
   the battery flat, with or without us in it. I should prefer without.

**Objective**: Knock out the four casemates before the navy opens fire.

### Map and sectors

| x (wu) | Sector | Ground | Structures |
| --- | --- | --- | --- |
| 0 to 2,000 | Rendezvous in the orchards | grass | HQ (look `tent`, the battalion aid post); dump: supply containers |
| 2,000 to 3,600 | Approach | marsh | |
| 3,600 to 4,600 | Outer wire and minefield | grass | wire 1 (x 3,700); minefield M1 (x 4,000 to 4,500, AP, German, unmarked to the player except a path) |
| 4,600 to 7,200 | The battery | grass, concrete | wire 2 (x 4,700); casemates C1 to C4 (pillbox look `casemate`, no gun facing the player, hp x2.5) at x 5,100, 5,700, 6,300 and 6,900; Tobruk MG pits PB1 to PB3; trench T1 (x 5,400) |
| 7,200 to 8,000 | Beyond | grass | enemy HQ (the battery command post, hasHq true for the AI economy) |

### Forces

- **Player**: 1 sapper (the battalion has none, so a volunteer) and 30 Paras, riflemen and Bren gunners. Units
  arrive in dribbles (phase 1). 1 Vickers team (`lmg`, look `vickers`). 0 Money: no training until the containers
  are found. `airdrop` money events every 60 s (the containers). Supports: none.
- **Loans**: 4 Bangalore sappers (the sapper's Breach job: instant wire removal at 6 s, and a 1 m path through mines
  per charge), 6 Paras (phase 1).
- **Enemy**: the battery: 4 casemates, 3 Tobruk MG pits, T1 (6 riflemen, 1 MG42), 2 mortars, 1 sniper. Garrison
  population about 30. HQ income low. Supports: flares, artillery from a neighbouring battery (scripted).

### Phases and events

1. **"The rendezvous"** (gather: `reach` objective, 30 units at x 1,800, or 240 s).
   - Waves side 0 at the left edge every 20 s: 2 to 4 Paras ("More men in from the marsh").
   - Timer: the deadline clock starts at 05:30 game time; HUD label "Navy opens fire". Total 600 s from mission start.
   - Hint: "The longer you wait, the more men you have and the less time."
2. **"Through the wire"** (destroy wire 1 and wire 2; clear the path in M1).
   - Hint: "Sappers breach wire with Bangalore torpedoes and clear a path through mines."
   - The German posture turns to `hold`; flares light the field.
3. **"The guns"** (destroy C1 to C4).
   - 30 s: wave side 0 near x 4,400: 8 Paras from the crashed glider, announce "A glider has crashed near the battery.
     Its men are coming in."
   - 90 s: German counter-attack from the HQ (8 riflemen).
   - On all four destroyed: announce "Light the success signal!" Mission won.
- **Lose**: the deadline timer expires ("HMS Arethusa opens fire").

### Side objectives

- **The battery command post** (destroy the enemy HQ) (+15%).
- **Twenty prisoners' worth**: kill or drive off every man in T1 (+10%).

### Medals

Timed: target 12 minutes, target casualties 25.

### Music, weather, time

- **Music**: `merville` (new). B-flat minor, 108 BPM. A ticking clock-like texture throughout (rim and bell), the
  motif in a slow, dark form. The combat layer explodes with full snare and brass. The tense layer under 60 s is a
  heartbeat timpani with rising strings.
- **Weather and time**: night, broken cloud, wind; the deadline before dawn.

### How a sensible player wins on Normal

1. Wait until about 25 men are in, no longer.
2. Bangalores on both wire belts while the Vickers suppresses the Tobruks; stay on the cleared path.
3. Clear T1 with grenades, then send assault groups to each casemate in turn.
4. The glider party helps on the last two.

Expected 11 to 14 minutes.

---

## Mission 3: Gold Beach

- **Id** 2003, key `gold`. **Date** 6 June 1944, H-Hour 07:25 (`1944-06-06`). **Place** King sector, La Rivière and
  Mont Fleury, 49.338 N, 0.515 W. **Mode** assault. **Length** about 24 minutes. **Map** 20,000 wu. **Theatres**
  `normandy`, then `france`.
- **History**:
  - 50th (Northumbrian) Division (Major General Douglas Graham), XXX Corps. 69th Brigade (6th Green Howards, 5th East
    Yorkshires) landed at King by La Rivière; 231st Brigade at Jig by Le Hamel.
  - The sea was rough, so DD tanks were landed directly on the beach.
  - Hobart's specialised armour cleared the way: Sherman Crab flails, Churchill AVREs with the Petard demolition gun.
    A flail of the Westminster Dragoons knocked out the 88 mm casemate at La Rivière.
  - Defenders: the 716th Division and part of the 352nd.
  - CSM Stanley Hollis of the 6th Green Howards won the only Victoria Cross of D-Day: he charged a bypassed pillbox
    near the Mont Fleury battery, and later, at Crépon, went for a field gun to rescue two men.
  - About 1,000 to 1,100 British casualties on Gold.

### Briefing (a battalion commander, 6th Green Howards)

1. The sea is rougher than anyone hoped, so the swimming tanks will come in on the landing craft with us instead of
   ahead of us, which is better for the tanks and no worse for us. The navy and the air force have been at the beach
   since before dawn. Somebody will still be alive in the concrete when we land.
2. La Rivière has a big gun in a casemate that looks along the sand. The flail tanks and the assault engineers will
   deal with it and with the mines; let them work, and keep your men off the sand once you are across it. Above the
   beach is the battery at Mont Fleury, then the road and Crépon.
3. Get off the beach, clear the strongpoints, and do not leave anything behind you that can still shoot. A pillbox you
   walk past is a pillbox behind you. Then on to Crépon and the battalion headquarters there.

**Objective**: Break through the beach defences and take Crépon.

### Map and sectors

| x (wu) | Sector | Ground | Structures |
| --- | --- | --- | --- |
| 0 to 1,500 | The sea | shallows | HQ (look `lct`, the beachmaster's landing craft); landing point L1 (ferry spawn, `batchEvery` 30 s) at 1,400 |
| 1,500 to 3,500 | King beach | beach | beach obstacles as wire W1 and W2; minefield M1 (AT and AP, x 2,600 to 3,000); casemate PB1 (x 3,200, weapon `casemate88`, anti-vehicle); Tobruk PB2 |
| 3,500 to 5,000 | Sea wall and La Rivière | cobble | trench T1 (x 3,700, German); buildings B1 and B2 (seafront villas); capture point P1 (structure T1, spawn) |
| 5,000 to 9,000 | Mont Fleury | field | casemates C1 and C2 (the battery, unfinished, weak guns); minefield M2; hidden pillbox PB3 at x 5,600 (dormant until the player passes x 6,500, see phase 2) |
| 9,000 to 14,000 | The coast road and the fields | field, hedges | trench T2 (x 11,000); capture point P2 "the coast road" (x 12,000, spawn) |
| 14,000 to 20,000 | Crépon | cobble | buildings B3 to B6; field gun G1 (`gunPit`, 7.5 cm); enemy HQ (battalion command post) at 19,850 |

### Forces

- **Player**: 4 sappers; first wave at L1: 12 riflemen, 4 Sten sections, 2 Bren gunners, 1 PIAT team; 2 Sherman DD
  (`tank`, look `shermanDD`); 1 Sherman Crab (`avreFlail`, mission-only); 1 Churchill AVRE (`avrePetard`,
  mission-only); 500 Money. Supports: naval bombardment (signature, coastal sector x < 12,000), artillery (from
  phase 2: field regiments ashore), smoke, Typhoon, Mitchell.
- **Loans**: 2 3-inch mortar teams (phase 2); 3 PIAT teams (phase 3); 2 assault sections (start).
- **Enemy**:
  - HQ, `incomeMul` 0.6.
  - Start: PB1 and PB2 crews; T1 (6 riflemen, 2 MG42); the battery (6 riflemen, 1 MG); T2 (6 riflemen, 1 MG,
    1 Pak 40); Crépon (8 riflemen in houses, 2 MG, field gun G1, 1 mortar).
  - Waves: 352nd Division's StuG III (2) in phase 3; riflemen from Ost battalions (look: German uniform, field cap).
  - Supports: artillery, Nebelwerfer (from 300 s).

### Phases and events

1. **"The beach"** (destroy PB1; capture P1). Weather overcast, wind; time morning.
   - 0 s: the landing.
   - Hints:
     - "Get off the sand: units on the beach are in the open."
     - "The flail tank clears mines as it drives; the AVRE's Petard smashes concrete."
     - "Naval Bombardment: heavy shells, but only near the coast."
   - 60 s and 180 s: mortar and MG fire on the beach.
   - Landing waves of player reinforcements every 30 s as the ferry.
2. **"Mont Fleury"** (capture P2).
   - When the player passes x 6,500: PB3 activates behind them (`setOwner` to side 1, with the announcement "A
     pillbox you passed is firing into your rear!").
   - 200 s: German counter-attack from T2.
3. **"Crépon"** (destroy the enemy HQ).
   - Phase start: 2 StuG plus 6 riflemen.
   - 120 s: field gun G1 opens on the road (banner).
   - At enemy HQ below 50%: the last counter-attack.

### Side objectives

- **The bypassed pillbox**: destroy PB3 within 60 s of it opening fire (+15%).
- **The field gun at Crépon**: destroy G1 with infantry, not artillery (+10%).

### Medals

Timed: target 24 minutes, target casualties 50.

### Music, weather, time

- **Music**: `gold` (new). G minor, 132 BPM. Waves and engines: a surging string ostinato (6/8-like accents in 4/4),
  big brass on the motif (`augment: 2`), the snare driving. The quiet section has gulls-like high string glissandi
  (short). Distinct from `sword`: darker key, heavier low brass.
- **Weather and time**: broken cloud, windy, rough sea; morning to afternoon.

### How a sensible player wins on Normal

1. Naval bombardment on PB1 and T1 at once.
2. The Crab drives the minefield and the AVRE goes for PB1. Infantry follow the flail's lane to the sea wall.
3. Mortars on the battery. When PB3 opens, turn a Sten section with grenades on it.
4. Tanks and PIATs together at T2 and Crépon. Typhoons on the StuGs.

Expected 22 to 26 minutes.

---

## Mission 4: Sword Beach

- **Id** 2004, key `sword`. **Date** 6 June 1944 (`1944-06-06`). **Place** Queen sector, Hermanville and Lion-sur-Mer,
  49.296 N, 0.302 W. **Mode** assault, then hold. **Length** about 26 minutes. **Map** 20,000 wu. **Theatres**
  `normandy`, then `france`.
- **History**:
  - 3rd Infantry Division (Major General Tom Rennie), 8th Brigade (1st South Lancashires, 2nd East Yorkshires,
    1st Suffolks), with DD Shermans of the 13th/18th Hussars, landed at 07:25. Some sources give 07:30.
  - Lord Lovat's 1st Special Service Brigade followed. No. 4 Commando, with 177 French commandos of No. 10 Commando
    under Commandant Philippe Kieffer, cleared Ouistreham.
  - 21st Panzer Division counter-attacked in the late afternoon: the Staffordshire Yeomanry's Shermans and Fireflies
    and anti-tank guns stopped Panzer Regiment 22 around Biéville and Périers. A battle group with Panzer IVs slipped
    through the gap between Sword and Juno and reached the coast at Lion-sur-Mer by about 20:00 before pulling back.
  - The evening glider lift (Operation Mallard, about 21:00) is commonly cited as one reason; that link is not proven.

### Briefing (a brigade major, 8th Infantry Brigade)

1. Queen beach, a strip of sand, a row of seaside villas and a strongpoint at each end. The commandos land behind us
   and turn left for Ouistreham and the bridges; we go straight inland. The navy has two battleships on call, so if
   anything in concrete troubles you, ask.
2. Past Hermanville the ground rises to the Périers ridge. Get onto it before the Germans do, and get the guns and
   the Staffordshire Yeomanry's tanks up there with you. Some of their Shermans carry the new seventeen-pounder:
   treat them kindly, because they are the only thing we have that can stop a panzer at a mile.
3. The 21st Panzer Division is somewhere south of Caen, and it will come for the beach this afternoon. When it does,
   be on the ridge, dug in, with the gap to the right covered. Then let them come.

**Objective**: Push inland to the Périers ridge and hold it against the panzers.

### Map and sectors

| x (wu) | Sector | Ground | Structures |
| --- | --- | --- | --- |
| 0 to 1,500 | The sea | shallows | HQ (`lct`); landing point L1 (ferry 30 s) |
| 1,500 to 3,500 | Queen beach | beach | obstacles; minefield M1; strongpoint PB1 and PB2 (Tobruks, 5 cm gun); trench T1 (x 3,300) |
| 3,500 to 6,000 | Seafront villas, La Brèche | cobble | buildings B1 to B3; capture point P1 (structure B2, spawn) |
| 6,000 to 10,000 | Hermanville | cobble, field | buildings B4 and B5 (church, farm); capture point P2 "Hermanville" (spawn) |
| 10,000 to 15,000 | The slope to the ridge | field (slope up) | trench T2 (x 12,000, German) |
| 15,000 to 20,000 | Périers ridge and beyond | field (heightBonus 1.1 from 15,000 to 16,500) | capture point P3 "the ridge" (x 15,800, spawn); enemy HQ (21st Panzer assembly) at 19,850 |

### Forces

- **Player**: 4 sappers; 12 riflemen; 4 Sten sections; 4 Commandos (`assault`, look `greenBeret`); 2 Bren gunners;
  1 PIAT team; 2 Sherman DD; 500 Money. Supports: naval bombardment, artillery, smoke, Typhoon, Auster recon (from
  phase 3).
- **Loans**: 2 Sherman Fireflies (phase 4, the Staffordshire Yeomanry: `heavyTank` signature); 4 PIAT teams (phase 4);
  2 6-pdr gun crews (`at`, look `sixPdr`, phase 4).
- **Enemy**:
  - HQ (21st Panzer), `incomeMul` 0.7.
  - Start: beach strongpoints (4 riflemen, 2 MG); villas (6 riflemen in B1 to B3); T2 (6 riflemen, 1 MG, 1 Pak 40).
  - Phase 4 waves: Panzer IV H, Sd.Kfz. 251 with Panzergrenadiers, converted French-chassis assault guns (`tank` look
    `stugFrench`).

### Phases and events

1. **"Queen beach"** (capture P1).
2. **"Hermanville"** (capture P2).
   - 150 s: mortar fire on the village; hint "Deploy at Hermanville."
3. **"The ridge"** (capture P3). Recon unlocked; hint "The recon plane shows how hurt the enemy is."
4. **"The panzers"**: prep 45 s (sandbags, foxholes, trench, tank traps; zone 14,000 to 16,400); hold P3 for 480 s.
   - 20 s: banner "Panzers from the south!"; 4 Panzer IV, 2 Sd.Kfz. 251 with grenadiers.
   - 150 s: assault guns plus 8 grenadiers.
   - 300 s: the last push, 5 Panzer IV.
   - Side: a battle group tries to run through the gap: 3 Panzer IV and 6 grenadiers aiming for x 6,000 (the coast).
   - 460 s: announce "Gliders overhead: the evening lift is coming in."

### Side objectives

- **Close the gap**: none of the gap battle group passes x 9,000 (+15%).
- **The ridge by noon**: P3 within 900 s (+10%).

### Medals

Timed: target 26 minutes, target casualties 55.

### Music, weather, time

- **Music**: `sword` (**reused**: the existing Sword Beach track; Normandy big brass and driving snare). Its prep layer
  is written for phase 4 (job 8 left it optional; add it here).
- **Weather and time**: broken cloud, windy; morning to evening.

### How a sensible player wins on Normal

1. Naval guns on the strongpoints; commandos into the villas.
2. Take Hermanville and deploy there.
3. Push the slope with tanks and smoke. Recon the ridge, then dig in hull-down.
4. Fireflies at range on the Panzer IVs, PIATs in the trenches, 6-pdrs on the flank of the gap.

Expected 24 to 28 minutes.

---

## Mission 5: The Hillman strongpoint

- **Id** 2005, key `hillman`. **Date** 6 to 7 June 1944 (`1944-06-06`). **Place** Colleville-Montgomery,
  49.2653 N, 0.3103 W. **Mode** special (strongpoint assault, night, surrender). **Length** about 18 minutes.
  **Map** 10,000 wu. **Theatre** `france`.
- **History**:
  - Hillman (Widerstandsnest 17) was the headquarters of Grenadier Regiment 736 (Oberst Ludwig Krug): about
    24 hectares, about 3 km inland, on a rise overlooking the beaches.
  - It had some 18 to 20 bunkers, including two command bunkers with armoured observation cupolas, about eight Tobruk
    machine-gun pits, two belts of wire and minefields. It had no big guns.
  - The 1st Suffolks attacked from about 13:05, with Shermans of the 13th/18th Hussars and the Staffordshire
    Yeomanry. The tanks' guns could not penetrate the cupolas.
  - Most of the position was taken by about 20:15. Krug surrendered with about 70 men at about 06:45 on 7 June.
  - The battery at Morris (WN16) next door surrendered to the Suffolks after the bombardment, without much of a fight.
  - The delay at Hillman is widely blamed for 3rd Division not reaching Caen on D-Day.

### Briefing (a company commander, 1st Suffolk Regiment)

1. Morris battery first. The navy has been knocking on its door all morning, and I have a feeling its gunners are
   ready to open up. Then Hillman, which is something else: a regimental headquarters dug into the hill, concrete,
   steel cupolas, machine guns in pits all round, wire and mines.
2. We have the plans, after a fashion. The tanks will come up, but their guns will not go through the steel domes,
   so it comes down to the sappers, the wire, the mortars and men with grenades at the embrasures. Take it pit by pit.
3. If it is not finished by dark, it will be finished at first light. Close in, keep them inside, and let them think
   about the morning. The division needs this hill to get to Caen.

**Objective**: Take Morris, break into Hillman and force its surrender.

### Map and sectors

| x (wu) | Sector | Ground | Structures |
| --- | --- | --- | --- |
| 0 to 2,000 | Colleville | cobble | HQ (`tent`) |
| 2,000 to 3,500 | Morris battery | field | casemates C1 and C2 (no guns firing inland); the small Morris garrison |
| 3,500 to 5,000 | The approach | field | wire W1; minefield M1 (AP) |
| 5,000 to 9,000 | Hillman | rock, concrete | wire W2; minefield M2; Tobruks PB1 to PB6 (MG); cupola bunkers CB1 and CB2 (pillbox look `cupola`, hp x4, bullet x0.02, antiTank x0.3, explosive x0.6; only satchel charges, the sapper's Demolish job and close assault hurt them properly); trenches T1 and T2 (communication trenches, German); enemy HQ (Krug's command bunker) at 8,900, hasHq true |
| 9,000 to 10,000 | Rear | field | |

### Forces

- **Player**: 4 sappers, 14 riflemen, 4 Sten sections, 2 Bren, 2 3-inch mortars, 2 Shermans; 450 Money. Supports:
  naval bombardment (until phase 3), artillery, smoke.
- **Loans**: 2 Lifebuoy flamethrowers (phase 3); 2 assault sections (phase 3); 2 3-inch mortars (start).
- **Enemy**:
  - HQ (the command bunker), `incomeMul` 0.5; hasHq true.
  - Garrison population about 45: Tobruks, cupolas, T1 and T2 (6 riflemen and 1 MG each), 2 mortars, 1 sniper.
  - Waves: survivors from the beach (riflemen) every 90 s from the right.

### Phases and events

1. **"Morris"** (reach x 3,000 with 6 units).
   - The Morris garrison gives up (scripted `surrender` of the units within the battery when the player arrives:
     announce "The Morris garrison is coming out with its hands up.").
2. **"The wire and the mines"** (destroy W1 and W2; clear paths in M1 and M2).
   - Hint: "Sappers clear mines and blow wire. Mortars keep the gunners' heads down."
3. **"The cupolas"** (destroy CB1, CB2 and at least 4 Tobruks).
   - Hint: "Tank shells bounce off the steel domes. Get a flamethrower or satchel charges to the embrasures."
   - 120 s: German counter-attack from T2.
4. **"Night"** (survive 180 s; keep at least 10 units inside x 5,000 to 9,000). Time dusk, then night.
   - The Germans probe from the bunker.
5. **"First light"** (bring the enemy HQ below 30%, `surrender`). Time dawn.
   - On surrender: announce "The colonel's white flag is out." Mission won.

### Side objectives

- **Hillman by dark**: phase 3 done within 900 s (+15%).
- **No tank lost** (+10%).

### Medals

Timed: target 18 minutes, target casualties 40.

### Music, weather, time

- **Music**: `hillman` (new). C minor, 116 BPM. Concrete and steel: anvil and rim-shot hits, dry timpani, the motif in
  inversion (`invert`) in the low strings, a cold night section with only pad and distant snare.
- **Weather and time**: overcast afternoon, dusk, night, dawn.

### How a sensible player wins on Normal

1. Walk into Morris.
2. Mortars and smoke on the Tobruks while sappers clear W1, M1, then W2, M2.
3. Flamethrowers and Sten sections on the cupolas, with the Brens covering. Tanks shoot the Tobruks and trenches,
   not the domes.
4. Hold the inner trench overnight, then push the command bunker at dawn.

Expected 16 to 19 minutes.

---

## Mission 6: Villers-Bocage

- **Id** 2006, key `villersBocage`. **Date** 13 June 1944 (`1944-06-13`). **Place** Villers-Bocage, 49.0806 N,
  0.6561 W. **Mode** special (town fight, then withdrawal). **Length** about 22 minutes. **Map** 16,000 wu.
  **Theatre** `france` (bocage) and `normandyCity`.
- **History**:
  - 7th Armoured Division's 22nd Armoured Brigade (Brigadier Robert Hinde) pushed through the gap in the German line.
  - 4th County of London Yeomanry (Viscount Cranley) entered the town at about 08:30. A Squadron went on to Point 213
    with 1st Rifle Brigade's A Company halted nose to tail behind.
  - At about 09:00 a handful of Tigers of heavy battalion 101, led by Michael Wittmann, struck. Within about
    15 minutes the column was destroyed, and Wittmann drove alone into the town, knocking out tanks in the main street.
  - Sergeant Lockwood's Firefly hit his Tiger near the town square. The Tiger was disabled in the town; accounts differ
    whether by a 6-pdr or a tank.
  - In the afternoon Panzer Lehr and more Tigers attacked the town. The 1/7th Queen's, 6-pdrs and Fireflies destroyed
    several Tigers in the streets.
  - Hinde withdrew that evening. On 14 June the brigade's "Island" box held off further attacks, then pulled back that
    night.
  - The mission shows the German unit as plain German, with no SS insignia (`NATIONS.md`).

### Briefing (a squadron leader, 4th County of London Yeomanry)

1. The Germans have left a gap in their line west of Caen, and we are going through it. Villers-Bocage is a
   market town on the main road, and beyond it a hill called Point 213 commands the road to Caen. The townspeople are
   out in the street with flowers, which is pleasant, if a little premature.
2. Intelligence says heavy tanks may be about. Our Cromwells are quick, and the Fireflies have the only guns that will
   go through a Tiger's front; nothing we have will do it at long range. In a town, a Tiger is a big target in a
   narrow street. Let it come past and hit it from the side and behind.
3. Hold the town until the infantry are up and dug in. If the position becomes untenable, the brigade will pull back
   to a box west of the town and hold there. Nobody is to try to win the war single-handed today.

**Objective**: Hold Villers-Bocage, destroy the Tigers, then withdraw in good order.

### Map and sectors

| x (wu) | Sector | Ground | Structures |
| --- | --- | --- | --- |
| 0 to 2,500 | Amayé road (the "Island" area) | field, hedges | HQ (`tent`) |
| 2,500 to 5,000 | West of the town | field | trench T1 (x 4,200, owner 0) |
| 5,000 to 10,000 | Villers-Bocage | cobble | buildings B1 to B8 (stone houses, 2 to 3 floors); capture point P1 "Place Jeanne d'Arc" (x 7,000, spawn); P2 "the main street" (x 8,800) |
| 10,000 to 13,000 | The Caen road | road, hedges | |
| 13,000 to 16,000 | Point 213 | field (heightBonus 1.1) | enemy HQ at 15,850 |

### Forces

- **Player**: 3 sappers; 6 Cromwells (`tank`, `lookOverrides` cromwell); 1 Firefly; 1 Stuart (`lightTank`); 8 riflemen
  of the Rifle Brigade in 2 Universal Carriers (`apc`); 2 Bren; 1 PIAT; 400 Money. Supports: artillery, smoke, Typhoon
  (weather permitting).
- **Loans**: 2 Fireflies (phase 2); 4 6-pdr crews (phase 3, the 1/7th Queen's); 4 PIAT teams (phase 3); 8 riflemen
  (phase 3).
- **Enemy**:
  - HQ, `incomeMul` 0.7.
  - Phase 2: one Tiger I (`heavyTank`, `commanderName` none), plus a second Tiger and a Panzer IV holding Point 213.
  - Phase 3: 3 Tiger I, 4 Panzer IV H, 12 Panzer Lehr grenadiers.
  - Supports: artillery, mortars.

### Phases and events

1. **"Into the town"** (capture P1). Townspeople cheering (scenery).
2. **"The Tiger"** (kill the lead Tiger).
   - 0 s: banner "Tiger! Tiger in the main street!" (boss sound); the Tiger enters from the east road
     (`posture: 'counterattack'` at P1).
   - Hint: "Its front armour is thick. Shoot it from the side or behind from the houses."
3. **"The afternoon"**: prep 45 s (sandbags, 6-pdr positions); hold P1 for 420 s.
   - 30 s: 2 Tigers plus 2 Panzer IV plus 6 grenadiers from the east.
   - 200 s: 1 Tiger plus 2 Panzer IV plus 6 grenadiers.
   - 300 s: mortar barrage.
4. **"To the Island"** (exit: get 15 units off the left edge within 240 s). Time to dusk; artillery support doubles.
   - The Germans follow up (posture `advance`).

### Side objectives

- **Four Tigers** (+15%).
- **The rearguard comes home**: the last unit off the map within 240 s (+10%).

### Medals

Timed: target 22 minutes, target casualties 45.

### Music, weather, time

- **Music**: `villersBocage` (new). F minor, 128 BPM. A cat-and-mouse town fight: stealthy string ostinato, sudden
  brass hits and anvil (the Tiger), the motif cut short (`take: 2`) and displaced. The combat layer is relentless snare.
  The ending sting is restrained.
- **Weather and time**: fine summer day; morning to dusk.

### How a sensible player wins on Normal

1. Take the square and put PIATs and riflemen in the houses on the main street.
2. When the Tiger comes in, block it with a Cromwell and hit its rear with the Firefly and the PIAT.
3. 6-pdrs in side streets for the afternoon; the Fireflies cover from depth.
4. Withdraw by bounds behind smoke.

Expected 20 to 24 minutes.

---

## Mission 7: Operation Epsom and Hill 112

- **Id** 2007, key `epsom`. **Date** 26 to 29 June 1944 (`1944-06-27`). **Place** the Odon valley and Hill 112;
  pin at Hill 112, 49.1186 N, 0.4594 W. **Mode** assault, then hold. **Length** about 28 minutes. **Map** 26,000 wu.
  **Theatre** `france` (bocage, rain).
- **History**:
  - VIII Corps (Lieutenant General Richard O'Connor), about 60,000 men, attacked on 26 June at 07:30 behind a creeping
    barrage, in rain, after the Great Storm of 19 to 22 June had delayed it. Mist over England cancelled the bombers.
  - 15th (Scottish) Division led with Churchills of 31st Tank Brigade through Cheux: the "Scottish Corridor".
  - 2nd Argyll and Sutherland Highlanders took the Tourmauville bridge over the Odon intact on 27 June.
  - 11th Armoured Division (Shermans and Fireflies of 23rd Hussars, 3rd RTR, 2nd Fife and Forfar) reached the northern
    slopes of Hill 112 on 27 to 28 June and held them through 29 June.
  - The SS panzer divisions just arrived from the East counter-attacked; the British withdrew on the night of 29 June.
  - Hill 112 was fought over again in Operation Jupiter on 10 July (43rd Wessex).

### Briefing (a company commander, 15th (Scottish) Division)

1. It has rained for a week, the storm wrecked the harbour, and the bombers cannot see England, let alone us. The
   attack goes in anyway, behind the biggest barrage most of you have heard. The Churchills come with us through Cheux
   and down to the Odon.
2. The Odon is a small river in a steep, wooded valley. Whoever takes a bridge intact lets the armour across; whoever
   loses one makes the armour swim, and it cannot. Once over, the ground climbs to Hill 112, from which the Germans can
   see half of Normandy. Take the top.
3. They will throw their new panzer divisions at the hill: Panthers, Tigers, the lot. When you are on top, dig in
   where you stand and let the tanks and guns work. We do not need to go further. We need them to come to us.

**Objective**: Break through to the Odon, cross it, and hold Hill 112.

### Map and sectors

| x (wu) | Sector | Ground | Structures |
| --- | --- | --- | --- |
| 0 to 3,000 | Start line | mud | HQ (`tent`) |
| 3,000 to 9,000 | Cheux | mud, rubble | wire; minefield M1; trench T1 (x 5,200, German); buildings B1 to B4 (Cheux, rubbled by the barrage); capture point P1 "Cheux" (spawn) |
| 9,000 to 14,000 | The corridor, hedges and orchards | mud, forest | trench T2 (x 11,500); capture point P2 (x 13,000, spawn) |
| 14,000 to 16,000 | The Odon | forest (slope down), then water (14,800 to 15,200) | bridge 1 Tourmauville (x 14,800 to 15,200, German, wired); capture point P3 "Tourmauville bridge" (x 15,400) |
| 16,000 to 22,000 | The slopes of Hill 112 | slope up | trench T3 (x 19,000) |
| 22,000 to 26,000 | Hill 112 | field (heightBonus 1.12) | capture point P4 "the summit" (x 23,000, spawn); small wood (cover); enemy HQ at 25,850 |

### Forces

- **Player**: 4 sappers; 14 riflemen; 4 Sten sections; 2 Bren; 2 3-inch mortars; 3 Churchills (`tank`, look
  `churchill`); 1 PIAT; 600 Money. Supports: artillery (creeping barrage), smoke, Typhoon (from phase 3, when the
  weather clears), Mitchell.
- **Loans**: 4 Shermans and 2 Fireflies of 11th Armoured (phase 3, look `sherman`); 4 PIAT teams (phase 4); 2 Lifebuoy
  flamethrowers (phase 1).
- **Enemy**:
  - HQ, `incomeMul` 0.8.
  - Start: T1 garrison and Cheux (12 riflemen, 3 MG42, 2 Pak 40, 1 mortar); T2 (6 riflemen, 1 MG, 1 Panzer IV); bridge
    guards (4 riflemen, 1 MG).
  - Phase 4 waves: Panther, Panzer IV H, Tiger I, Panzergrenadiers.
  - Supports: Nebelwerfer (signature) from 120 s, artillery, mortars.

### Phases and events

1. **"Cheux"** (capture P1). Weather rain; ground mud.
   - 0 s: a free creeping barrage (side 0) walking from x 4,000 to 7,000 over 60 s.
   - 200 s: Nebelwerfer salvo.
2. **"The corridor"** (capture P2).
   - 120 s: a Panther and grenadiers counter-attack (banner "Panther!").
3. **"The Odon"** (capture P3 before the bridge is blown).
   - At 300 s, if P3 is not owned: `demolish` bridge 1; then the 11th Armoured loans must wait for a scripted
     scissors bridge at 420 s.
   - Weather to overcast over 60 s; Typhoons unlocked.
4. **"Hill 112"**: capture P4; prep 45 s; hold P4 for 420 s.
   - Waves at 40 s, 180 s and 320 s: 2 Panthers plus 2 Panzer IV plus 8 grenadiers; 1 Tiger plus 2 Panthers; the
     last, 3 Panthers, 1 Tiger and 12 grenadiers.
   - Mortar and Nebelwerfer fire throughout.

### Side objectives

- **Tourmauville intact** (+15%).
- **The hill's wood**: no enemy in x 22,500 to 23,500 at the end (+10%).

### Medals

Timed: target 28 minutes, target casualties 65.

### Music, weather, time

- **Music**: `hill112` (**reused**: the existing Hill 112 track; heavy and mechanical, like tanks).
- **Weather and time**: rain, then overcast; morning to evening.

### How a sensible player wins on Normal

1. Follow the creeping barrage into Cheux with the Churchills; flamethrowers on the Cheux houses.
2. Deploy at Cheux and push the corridor with smoke and mortars.
3. Rush the bridge with Sten sections and a Churchill.
4. On the hill, put the Fireflies at the back edge and the PIATs in the wood. Typhoons on Panthers in the open.

Expected 26 to 30 minutes.

---

## Mission 8: Operation Charnwood

- **Id** 2008, key `charnwood`. **Date** 7 to 9 July 1944 (`1944-07-08`). **Place** northern Caen, 49.182 N,
  0.370 W. **Mode** assault. **Length** about 26 minutes. **Map** 22,000 wu. **Theatres** `france` and `normandyCity`.
- **History**:
  - On the evening of 7 July, 467 Lancasters and Halifaxes bombed the north of Caen. The aiming point had been moved
    toward the city, and the raid largely missed the German defences. Civilian deaths were about 300 to 400 by later
    findings.
  - I Corps (Lieutenant General John Crocker) attacked at 04:20 on 8 July: 3rd Division with 185th Brigade at Lébisey;
    59th (Staffordshire) Division at La Bijude and Galmanche; 3rd Canadian Division on the right.
  - Defenders: 12th SS Panzer Division and the inexperienced 16th Luftwaffe Field Division.
  - By about 18:00 on 9 July north Caen to the Orne was taken. The bridges were wrecked or covered from the south bank,
    and the rubble from the bombing blocked the streets for the British themselves.

### Briefing (a battalion commander, 59th (Staffordshire) Division)

1. Tonight the heavy bombers come over Caen. You will see them from here, and you will hear them for a long while
   after. At twenty past four in the morning we go in behind the barrage: Lébisey wood, La Bijude, Galmanche, then the
   city.
2. Most of the division has never been in action. The Germans facing us are partly the panzer division that has held
   Caen for a month and partly air force men turned infantry, who are new to it too. Take the villages first; use them
   as your new start lines.
3. The bombs will have turned the north of the city into rubble, and rubble suits a defender. Go street by street to
   the river. The bridges will be gone; when you reach the water, the job is done.

**Objective**: Take the villages and clear northern Caen to the Orne.

### Map and sectors

| x (wu) | Sector | Ground | Structures |
| --- | --- | --- | --- |
| 0 to 3,000 | Start line | field | HQ (`tent`) |
| 3,000 to 8,000 | Lébisey wood and La Bijude | forest, field | trenches T1 and T2 (German); buildings B1 and B2 (La Bijude farms); capture point P1 (spawn) |
| 8,000 to 12,000 | Galmanche | field | buildings B3 and B4; minefield M1; capture point P2 (spawn) |
| 12,000 to 19,500 | Northern Caen | rubble | buildings B5 to B12 (stone houses, many already ruined); craters (bomb rubble ground); capture point P3 (x 16,000, spawn) |
| 19,500 to 22,000 | The Orne quays | cobble | river at 21,500 to 22,000 (water); enemy HQ south of the river is unreachable; the objective is `reach` |

### Forces

- **Player**: 5 sappers; 16 riflemen; 4 Sten; 2 Bren; 2 3-inch mortars; 1 sniper; 4 Shermans (look `sherman`);
  1 Firefly; 700 Money. Supports: artillery, smoke, Typhoon, Mitchell, naval bombardment (the 16-inch guns of HMS
  Rodney fired on Caen; coastal range is relaxed for this mission, data `navalRange` 30 km).
- **Loans**: 3 PIAT teams; 2 Lifebuoy (phase 3); 2 AVRE (phase 3, mission-only, for the rubble).
- **Enemy**:
  - HQ (unreachable), `incomeMul` 0.7.
  - Start: T1 and T2 (6 riflemen and 2 MG each, Luftwaffe field infantry: German look with the Luftwaffe-pattern
    helmet colour); La Bijude and Galmanche (8 riflemen, 2 MG, 1 Pak 40, 1 Panzer IV each); Caen (12 riflemen in
    buildings, 3 MG, 2 Panthers, 1 Pak 40, snipers).
  - Waves: Panther counter-attacks (3 per wave).
  - Supports: mortars and artillery.

### Phases and events

0. **"The bombers"** (a 40 s scripted intro). Time dusk: `airRaid` events, 8 sticks of heavy bombs over x 12,000 to
   19,000 (they hit the city, not the trenches; the rubble ground spreads). The player watches and preps nothing.
   Hint: "Heavy bombers have hit the city. Note where they did not hit."
1. **"Lébisey and La Bijude"** (capture P1). Time night to dawn (04:20).
2. **"Galmanche"** (capture P2).
   - 120 s: Panther counter-attack on La Bijude (`posture: 'counterattack'` at P1).
3. **"Into the city"** (capture P3).
   - Rubble slows tanks; the AVRE clears rubble (as a mine-clearing job on rubble ground).
4. **"To the river"** (reach x 21,400 with 12 units).
   - 100 s and 220 s: Panther and grenadier counter-attacks.

### Side objectives

- **Galmanche without a tank lost** (+10%).
- **Ten Panthers** (+15%).

### Medals

Timed: target 26 minutes, target casualties 60.

### Music, weather, time

- **Music**: `charnwood` (new). E-flat minor, 124 BPM. Opens with the bombers (low brass drones, timpani rolls like
  distant thunder), then a grinding urban combat layer: anvil, string clusters, the motif in a minor-key
  augmentation, building to a grim march. The quiet sections are desolate (a solo horn over the pad).
- **Weather and time**: dusk (the raid), night, dawn, overcast day.

### How a sensible player wins on Normal

1. At 04:20 artillery on T1 and T2; riflemen and tanks together into La Bijude.
2. Deploy forward each time. Typhoons on Panthers in the open fields.
3. In the city, infantry first with flamethrowers and mortars; tanks follow the cleared streets.

Expected 24 to 28 minutes.

---

## Mission 9: Operation Goodwood

- **Id** 2009, key `goodwood`. **Date** 18 July 1944 (`1944-07-18`). **Place** east of Caen, Cagny, 49.148 N,
  0.258 W. **Mode** assault with tanks. **Length** about 28 minutes. **Map** 28,000 wu. **Theatre** `cornfields`.
- **History**:
  - From 05:45 on 18 July, 2,077 RAF and USAAF bombers attacked in three waves (about 4,800 tons from the heavies; US
    Marauders dropped fragmentation bombs on the 16th Luftwaffe Field Division). Artillery opened at 06:40; H-Hour was
    07:45.
  - VIII Corps (O'Connor) sent three armoured divisions down a narrow corridor east of Caen: 11th Armoured (Roberts)
    first, then Guards Armoured and 7th Armoured. The leading tanks reached the Bourguébus ridge at about 11:15.
  - Kampfgruppe von Luck of 21st Panzer held Cagny. The story of Luftwaffe 88 mm guns there being forced into the
    anti-tank role rests on von Luck's own account.
  - Heavy battalion 503's Tiger Is in an orchard at Manneville were devastated by the bombing: one was flipped over.
    Its Tiger II company fought east of the corridor; this is usually given as the Tiger II's first major action in
    Normandy.
  - 1st SS and 12th SS counter-attacked on the ridge.
  - British tank losses were heavy: often given as about 400, with sources ranging from about 250 to 500.
  - Torrential rain on 20 July ended the operation.

### Briefing (a squadron leader, 2nd Fife and Forfar Yeomanry)

1. At a quarter to six this morning you will see more aeroplanes than you knew existed. When they have gone, and the
   guns have had their turn, three armoured divisions go down the corridor in line ahead, and we are at the front of
   the first.
2. The fields are open wheat with two railway embankments across them, and villages the Germans have turned into
   strongpoints: Cagny, with its orchards, and the farms along the ridge. The bombing will have stunned whatever was in
   the first mile. It will not have reached everything, and the anti-tank guns in the villages are the ones that count.
3. Our objective is the Bourguébus ridge. Up there are the best of their panzer divisions and, according to
   intelligence, something very large and new. Keep moving, keep your spacing, call the Typhoons onto anything that
   won't burn, and get onto the ridge before they do.

**Objective**: Drive down the corridor, take Cagny and seize the Bourguébus ridge.

### Map and sectors

| x (wu) | Sector | Ground | Structures |
| --- | --- | --- | --- |
| 0 to 2,500 | Orne bridgehead start line | field | HQ (`tent`) |
| 2,500 to 8,000 | The bombed zone | field (craters as rubble patches) | trench T1 (German, garrison stunned); minefield M1 (British-laid, partly lifted: a lane) |
| 8,000 to 9,000 | First railway embankment | slope | |
| 9,000 to 15,000 | Cagny and the orchards | field, forest (orchard) | buildings B1 to B3 (Cagny); 8.8 cm Flak F1 to F4 (`aaGun`, German signature, `guard`); capture point P1 "Cagny" (x 13,500, spawn) |
| 15,000 to 16,000 | Second railway embankment | slope | |
| 16,000 to 23,000 | Wheat fields to the ridge | field | farms B4 and B5; trench T2 |
| 23,000 to 28,000 | Bourguébus ridge | field (heightBonus 1.12) | capture point P2 "the ridge" (x 24,500, spawn); villages B6 and B7; enemy HQ at 27,850 |

### Forces

- **Player**: 4 sappers; 10 Shermans and 3 Fireflies (11th Armoured); 2 Cromwells (recce); 4 Universal Carriers with
  8 motor riflemen; 2 Bren; 1 PIAT; 2 3-inch mortars; 900 Money (the richest start in the campaign). Supports:
  artillery, smoke, Typhoon (signature, with a short cooldown: the "cab rank"), Mitchell, Auster recon.
- **Loans**: 4 PIAT teams; 8 riflemen (phase 3, the infantry catching up); 2 Fireflies (phase 4).
- **Enemy**:
  - HQ, `incomeMul` 0.8.
  - Start: T1 (stunned: 50% of its garrison removed by the opening bombing, then the survivors fight; the rest of the
    garrison is placed at 50% hp); Cagny (4 Flak 88s, 8 grenadiers, 2 converted assault guns, 1 Pak 40); the
    Manneville orchard: 2 Tiger I (one destroyed by the bombing as scenery); T2 (6 grenadiers, 2 Pak 40, 2 Panzer IV);
    the ridge (8 grenadiers, 2 MG).
  - Phase 4: **the King Tiger squad** (1 `kingTiger` plus 6 veteran infantry), 4 Panthers, 2 Panzer IV, 10 grenadiers.
  - Supports: Nebelwerfer, artillery.

### Phases and events

1. **"The carpet"** (reach x 9,000 with 8 units).
   - 0 s: banner "Bombers!"; `airRaid` events: 12 sticks of bombs from x 3,000 to 16,000 over 40 s (side 0, free).
     The enemy units in T1 take the bombing.
   - 60 s: a free barrage. Hint: "Advance with the tanks. Infantry ride in the carriers."
2. **"Cagny"** (capture P1).
   - 0 s: the Cagny 88s open (banner "Eighty-eights in the orchards!"); hint "Mortars and infantry kill gun crews.
     Tanks in the open die."
   - 150 s: the 2 Tiger Is from Manneville.
3. **"The wheat"** (capture T2; reach x 22,000).
   - 200 s: Panther counter-attack (3).
4. **"Bourguébus ridge"** (capture P2, then hold 300 s).
   - 30 s after capture: `banner` "King Tiger!" (boss sound); the King Tiger squad plus 2 Panthers come over the ridge.
   - Hints: "The King Tiger's front shrugs off almost everything. Hit its sides and rear, call the Typhoons, mass
     your Fireflies."
   - 180 s: the last counter-attack.
   - 260 s: weather to `rain` over 40 s.

### Side objectives

- **Kill the King Tiger** (+15%).
- **Cagny with under 6 tanks lost** (+10%).

### Medals

Timed: target 28 minutes, target casualties 70 (tanks count 5).

### Music, weather, time

- **Music**: `goodwood` (new). D minor, 144 BPM. The biggest tank track: a thunderous bomber intro (timpani rolls, low
  brass drone), then a galloping armoured ostinato (strings and snare), the motif in fanfare form (`colour: major` on
  the ridge, then back to minor when the King Tiger appears: the prep and tense layers carry an anvil "boss" figure).
- **Weather and time**: fine and hot (morning dust, data `dust` while tanks move), rain at the end; morning to
  afternoon.

### How a sensible player wins on Normal

1. Roll with the carpet. Don't stop at the embankment.
2. At Cagny, halt behind the embankment; mortars and Auster recon on the 88s, then infantry on the guns while the
   tanks give covering fire from hull-down.
3. In the wheat, Fireflies overwatch every bound.
4. On the ridge, spread out. Typhoons and two Fireflies on the King Tiger's flanks; PIATs in the farms.

Expected 26 to 30 minutes.

---

## Mission 10: Closing the Falaise Pocket

- **Id** 2010, key `falaise`. **Date** 16 to 21 August 1944 (`1944-08-17`). **Place** from Pont de Vère to Flers and
  east toward the pocket; pin at Flers, 48.749 N, 0.571 W. **Mode** assault with tanks (the final push). **Length**
  about 28 minutes. **Map** 26,000 wu. **Theatre** `france` (bocage, high summer).
- **History**:
  - In mid-August the German armies in Normandy were nearly surrounded. Canadians and Poles drove south from Caen
    (Falaise fell on 17 August; the Polish 1st Armoured Division held Hill 262 near Mont-Ormel from 19 August), and the
    Americans and French reached Chambois; the gap closed on 21 August.
  - The British Second Army pressed in from the north and west. 11th Armoured Division (Roberts) fought a rearguard at
    Pont de Vère on 16 August and took Flers on 17 August; 53rd (Welsh) Division pushed in from the north-west.
  - Typhoons of 2nd Tactical Air Force rocketed the fleeing columns. The post-battle survey could prove only a few
    armoured vehicles destroyed by aircraft, though the roads were choked with wrecks.
  - About 10,000 to 15,000 Germans were killed and 40,000 to 50,000 captured, with some 500 tanks and assault guns lost.
  - The mission is the British part. The briefing honours the Canadians and Poles who sealed the gap.

### Briefing (a regimental commander, 11th Armoured Division)

1. The German armies in Normandy are in a sack, and the neck of it is closing. The Canadians and the Poles are driving
   on it from the north, the Americans from the south. Our task is to push in from the west and give them no rest, no
   road and no rearguard that holds for more than an hour.
2. Their rearguards are good: a Panther in a hedge, an anti-tank gun at a bridge, a few men with Panzerfausts in a
   farm. Clear Pont de Vère, take Flers, then push east into open country where their columns are on the roads. The
   Typhoons will be overhead all day; give them targets.
3. Somewhere in front of us is a crossroads their last columns need. Take it and the pocket has one door fewer. After
   that, the rest is up to the Poles on their hill, and I should not like to be the man who tries to get past them.

**Objective**: Break the rearguards, take Flers, smash the columns and seize the crossroads.

### Map and sectors

| x (wu) | Sector | Ground | Structures |
| --- | --- | --- | --- |
| 0 to 3,000 | Start | field | HQ (`tent`) |
| 3,000 to 7,000 | Pont de Vère | forest, water | river 5,200 to 5,600 with bridge 1 (German, wired); trench T1 |
| 7,000 to 13,000 | Flers | cobble | buildings B1 to B6; capture point P1 "Flers" (x 11,000, spawn) |
| 13,000 to 21,000 | Open country and the columns' roads | field, road | farms B7 to B9; trench T2; capture point P2 (x 18,000, spawn) |
| 21,000 to 26,000 | The crossroads | road, hedges | capture point P3 "the crossroads" (x 23,500); enemy HQ (rearguard command) at 25,850 |

### Forces

- **Player**: 5 sappers; 8 Shermans; 3 Fireflies; 2 Cromwells; 4 Kangaroos (`apc`, look `kangaroo`, from 1944-08) with
  16 riflemen; 4 Sten; 2 Bren; 2 PIAT; 2 3-inch mortars; 1,000 Money. Supports: artillery, smoke, Typhoon (cab rank,
  short cooldown), Mitchell, Auster, fighter.
- **Loans**: 3 PIAT teams; 2 Lifebuoy (phase 2).
- **Enemy**:
  - HQ, `incomeMul` 0.6.
  - Start rearguards: Pont de Vère (6 grenadiers, 1 Pak 40, 1 Panther); Flers (10 grenadiers in houses, 2 MG, 1 StuG,
    Panzerfaust teams); open country (2 Panthers, 1 Tiger I, 8 grenadiers).
  - "Columns": every 45 s in phase 3, a column (2 trucks as `apc` with the `opelBlitz` look, 1 Panzer IV, 4 infantry)
    crosses from x 26,000 toward x 21,000 and then turns off. Data: `posture` 'free'; they fight if engaged.
  - Supports: mortars, rarely artillery.

### Phases and events

1. **"Pont de Vère"** (capture the bridge's point before it is blown: 240 s, or use a ford for infantry).
2. **"Flers"** (capture P1). The townspeople are in the streets (scenery).
3. **"The columns"** (destroy 15 vehicles, then capture P2).
   - Hint: "Typhoons over the roads: call them on the columns."
4. **"The crossroads"** (capture P3, then destroy the enemy HQ).
   - 120 s: the last rearguard (1 Tiger I plus 2 Panthers plus 8 grenadiers).
   - On victory: announce "21 August: the gap is closed at Chambois. The Battle of Normandy is over."

### Side objectives

- **Pont de Vère intact** (+10%).
- **Twenty-five vehicles** (+10%).
- **Under 26 minutes** (+10%).

### Medals

Timed: target 28 minutes, target casualties 60.

### Music, weather, time

- **Music**: `falaise` (new). A minor to A major, 138 BPM. The British campaign's big final push: the motif in full in
  the brass, rising sequences, a ringing major-colour climax in the last section, and the victory sting the grandest of
  the campaign.
- **Weather and time**: hot, dusty August; morning to evening.

### How a sensible player wins on Normal

1. Smoke and a rush on the bridge.
2. Kangaroos carry infantry to Flers; clear house by house with Sten sections.
3. In the open, Fireflies overwatch and Typhoons on every column.
4. At the crossroads, everything at once with artillery.

Expected 26 to 30 minutes.

---

## Summary table

| # | Id | Key | Date | Mode | Prep | Map wu | Minutes | Target time / casualties | Track | Weather, time |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 2001 | pegasus | 5 to 6 Jun 1944 | special (tutorial) | no | 7,500 | 12 | fixed / 15 | pegasus | windy, night to day |
| 2 | 2002 | merville | 6 Jun 1944 | special (deadline) | no | 8,000 | 14 | 12 / 25 | merville | night |
| 3 | 2003 | gold | 6 Jun 1944 | assault | no | 20,000 | 24 | 24 / 50 | gold | rough sea, broken cloud |
| 4 | 2004 | sword | 6 Jun 1944 | assault, hold | mid (45 s) | 20,000 | 26 | 26 / 55 | sword (reused) | broken cloud, morning to evening |
| 5 | 2005 | hillman | 6 to 7 Jun 1944 | special | no | 10,000 | 18 | 18 / 40 | hillman | overcast, night, dawn |
| 6 | 2006 | villersBocage | 13 Jun 1944 | special | mid (45 s) | 16,000 | 22 | 22 / 45 | villersBocage | fine, to dusk |
| 7 | 2007 | epsom | 26 to 29 Jun 1944 | assault, hold | mid (45 s) | 26,000 | 28 | 28 / 65 | hill112 (reused) | rain, mud |
| 8 | 2008 | charnwood | 7 to 9 Jul 1944 | assault | no | 22,000 | 26 | 26 / 60 | charnwood | night raid, dawn, overcast |
| 9 | 2009 | goodwood | 18 Jul 1944 | assault | no | 28,000 | 28 | 28 / 70 | goodwood | hot, dust, rain at the end |
| 10 | 2010 | falaise | 16 to 21 Aug 1944 | assault | no | 26,000 | 28 | 28 / 60 | falaise | hot August |

Prep phases: Sword, Villers-Bocage and Hill 112 hold their ground after taking it. The pure defensive D-Day mission
is Pegasus's hold (survive phases; a prep is not historical there, since the gliders landed straight into the fight).
New tracks: 8. Reused: `sword`, `hill112`. The King Tiger appears in mission 9 only.
