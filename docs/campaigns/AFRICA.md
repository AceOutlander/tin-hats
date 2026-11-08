# African campaign (August 1940 to October 1942)

Campaign id `africa`, missions 4001 to 4010. The player commands African soldiers of the time:
- the King's African Rifles and the Northern Rhodesia Regiment;
- the Royal West African Frontier Force (Nigeria and Gold Coast Regiments);
- South African forces;
- Ethiopian patriot fighters (the Arbegnoch) and Gideon Force's Ethiopian and Sudanese battalions;
- the Belgian Congo's Force Publique;
- the Free French Chadian tirailleurs at Keren.

The main enemy is the Royal Italian Army, a new faction flying the Kingdom of Italy's flag with no fascist symbols. Vichy
French appear in Madagascar, and Germans only in North Africa. Nation data are in `NATIONS.md` (sections 6, 7 and 9),
sources in `HISTORY.md`.

## Choosing the ten battles

Criteria:
1. African units were central to the fighting, not a footnote.
2. Every contingent the owner named gets at least one mission as the main force.
3. Include the owner's named battles: Keren, Saïo, Gondar, the liberation of Ethiopia, Madagascar, El Alamein.
4. A mix of modes (delay, river crossing, mountain assault, raid and bluff, siege, survival, a tank finale).
5. The enemy on each date is historically right (Italians in East Africa, Vichy in Madagascar, Germans with Italians
   only in North Africa).
6. Varied terrain: scrub, river forest, mountains, highlands, rainy-season mud, tropical highlands, desert.
7. The owner's music rule: the two desert tracks reused in the two North African missions.

| # | Battle | Date | Played as | Why |
| --- | --- | --- | --- | --- |
| 1 | Tug Argan | 11 to 15 Aug 1940 | KAR, Northern Rhodesia Regiment, Somaliland Camel Corps | The Italians at their mightiest (the invasion of British Somaliland); a delaying fight on rocky hills; a short, clear tutorial |
| 2 | The Juba River | 17 to 22 Feb 1941 | Gold Coast and Nigeria Regiments, 1st SA Brigade, KAR | The 11th and 12th African Divisions' river crossing; mixed contingents in one army |
| 3 | Keren: the northern approach | 21 Feb to 27 Mar 1941 | Chadian tirailleurs (BM3), Sudan Defence Force | Owner-named. Keren's main assaults were Indian and British, so the honest African mission is the Free French Chadian battalion's Fort Kub-Kub (the first Free French victory) and Mount Engiahat |
| 4 | Gojjam: Gideon Force and the patriots | Feb to Apr 1941 | Arbegnoch, 2nd Ethiopian Battalion, Sudanese Frontier Battalion | Owner-named "liberation of Ethiopia"; night raids and bluff; it ends with the Emperor's return |
| 5 | The Lakes: Wadara and Colito | 3 to 19 May 1941 | Gold Coast Brigade, then the KAR | Rainy-season mud, a river under fire, Italian tanks against askari |
| 6 | Saïo | Mar to 6 Jul 1941 | Force Publique (with two KAR companies) | Owner-named; a siege on a plateau in the rains, ending with nine generals surrendering |
| 7 | Gondar and Kulkaber | 13 to 27 Nov 1941 | KAR, East African Pioneers, Ethiopian patriots | Owner-named; the last Italian bastion in East Africa |
| 8 | Sidi Rezegh | 23 Nov 1941 | 5th South African Infantry Brigade | North Africa; panzers and Ariete against South Africans on bare rock; the `crusader` track |
| 9 | Madagascar: Andriamanalina | Sep to Oct 1942 | 22nd East African Brigade (KAR), SA armoured cars | Owner-named; KAR against Vichy French and their Malagasy and Senegalese tirailleurs |
| 10 | El Alamein: Miteiriya Ridge | 23 to 24 Oct 1942 | 1st South African Division, with British armour attached | Owner-named finale with tanks; the `alamein` track |

Alternates, researched and kept for later: El Wak (16 December 1940, Gold Coast and South Africans: a fine tutorial
raid), Marda Pass and Harar (March 1941, the Nigerian brigade), Mega (February 1941, South Africans in cold rain).
Rejected: Amba Alagi (African units were secondary) and Operation Ironclad (Diego Suarez, a British operation).

Epilogue card (no mission): Lance-Corporal Job Maseko of the Native Military Corps, captured at Tobruk in June 1942,
sank a German vessel in the harbour with a home-made bomb in July 1942 and received the Military Medal. It is the most
fitting place in the campaign to honour the Native Military Corps.

Order note: Gondar's final assault (27 November) comes four days after Sidi Rezegh (23 November). The campaign keeps
East Africa together and turns north afterwards.

## Campaign

- **Card**: "Africa: 1940 to 1942. The African soldiers who fought from Somaliland to El Alamein."
- **Flags**: the card shows the Union Flag, the Ethiopian imperial flag, the Belgian Congo flag and the Free French
  flag. Each mission's HQ flies its main contingent's flag (`NATIONS.md` section 9).
- **Map region**: lon 18 to 52 E, lat -26 to 33 N (Mercator; an optional inset for the two North African pins). Land
  shapes: Libya, Egypt, Sudan, Eritrea, Ethiopia, the Somalilands, Kenya, Uganda, the Belgian Congo's eastern edge,
  Madagascar. Rivers: Nile, Blue Nile, Juba, Baro. Lakes: Tana, the Rift Valley lakes. Labels: Tobruk, El Alamein,
  Khartoum, Keren, Asmara, Gondar, Addis Ababa, Harar, Berbera, Mogadishu, Kismayu, Nairobi, Tananarive.
- **Theme**: "Africa Rising" (`africaRising`), original. A call and answer between a horn and the strings over
  hand-drum patterns: call `0 (.5) 2 (.5) 4 (1) 4 (.5) 2 (.5) 0 (1)`, answer `-1 (.5) 0 (.5) 2 (2) | 4 (1) 5 (1) 4 (2)`,
  in a minor pentatonic colour that ends open. It is driving and hopeful. The composer must avoid anthems and folk
  songs of the countries involved (for example "Ityopya Hoy", "Nkosi Sikelel' iAfrika", "Jambo Bwana", "Sarie Marais")
  and any film score.
- **Sound**: dry reverb in the desert and the scrub; mountain echo (long, thin reverb) for Keren and the highlands;
  the `hand` drums (dum, tek) in every track; bell for the highland missions.
- **Map track**: `africaMap`.
- **Theatres**:
  - `desert` (exists; from the old British campaign, with its art);
  - new `somaliScrub` (red earth, thornbush, acacia, termite mounds);
  - new `riverForest` (Juba: riverine forest, banana plantations, a wide brown river);
  - new `eritreaMountains` (granite peaks, gorges, cactus);
  - new `ethiopianHighlands` (flat-topped ambas, round thatched tukuls, stone churches, juniper);
  - new `madagascarHighlands` (red laterite, rice terraces, highland houses with steep roofs).

### Enemy roster by date

| Missions | Date | Infantry | Anti-tank and guns | Armour | Air |
| --- | --- | --- | --- | --- | --- |
| 1 Tug Argan | Aug 1940 | Italian infantry; colonial ascari brigades (most of the force) | 65/17 and 75/27 guns (21 batteries in the invasion) | M11/39 (half a company), L3/35 tankettes, armoured cars | SM.81, SM.79, Ca.133, CR.42, CR.32, Ro.37 |
| 2 to 7 East Africa | 1941 | ascari battalions, dubats (Somalia), banda irregulars, Italian infantry, Granatieri di Savoia, Alpini and Bersaglieri (Keren), Carabinieri (Kulkaber) | 47/32, 65/17, 75/27, 105 mm (Harar, Keren) | L3/35; a few medium tanks (type uncertain by May 1941) | CR.42, SM.79, Ca.133; by late 1941 almost none |
| 8 Sidi Rezegh | Nov 1941 | German Afrika Korps grenadiers; Italian Ariete with Bersaglieri | Pak 38, 8.8 cm Flak, 47/32 | Panzer III (5 cm), Panzer IV (short), M13/40 | Ju 87, Bf 109 |
| 9 Madagascar | Sep to Oct 1942 | Vichy: Malagasy and Senegalese tirailleurs, French colonial infantry | 65 mm mountain guns (confirmed), 75 mm mle 1897; road blocks of felled trees | none shown (sources mention "6 tanks" of unknown type, not seen in action) | MS.406, Potez 63.11 (a handful left) |
| 10 El Alamein | Oct 1942 | German 164th Light Division; Italian Trento and Bologna, 7th Bersaglieri | Pak 38 and Pak 40, 8.8 cm, 47/32 | counter-attacks: Panzer III J (5 cm long), Panzer IV F2/G, M14/41, Semovente 75/18 | Ju 87, Bf 109 |

The player by date: SMLE rifles, Bren and Lewis guns, Vickers MGs, Boys anti-tank rifles, 3-inch mortars; South
African 18-pdr, 4.5-inch and 25-pdr batteries and Marmon-Herrington armoured cars; the 1st East African Light
Battery's 3.7-inch mountain howitzers; SAAF Hartbees, Ju 86, Fairey Battle, Maryland, Hurricane and Gladiator. At
Alamein: British Shermans (first in action at Second Alamein), Grants and Crusaders, attached to the South Africans as
loans.

### How "mighty" the Italians are

1940: overwhelming numbers, artillery and air (the invasion of British Somaliland). The player holds hills and buys
time. In 1941 the tide turns: the Italians hold strong natural fortresses (Keren, Saïo, Kulkaber) with plenty of
guns, but are cut off, short of fuel and air. North Africa: the Germans and the Ariete bring armour the South Africans
lack. Enemy income never exceeds the player's.

---

## Mission 1: Tug Argan (tutorial)

- **Id** 4001, key `tugArgan`. **Date** 11 to 15 August 1940 (`1940-08-11`). **Place** the Tug Argan gap in the Assa
  hills on the Hargeisa to Berbera road, British Somaliland, about 9.95 N, 44.6 E (approximate). **Mode** delay
  (hold, then withdraw). **Length** about 14 minutes. **Map** 9,000 wu. **Theatre** `somaliScrub`.
- **History**:
  - The Italian conquest of British Somaliland (Duke of Aosta; operation led by General Guglielmo Nasi). Lieutenant
    General Carlo De Simone's central column had 11 colonial battalions and 3 Blackshirt battalions, with tanks,
    armoured cars and 21 howitzer batteries.
  - The British force under Major General Reade Godwin-Austen held a string of rocky hills across the gap:
    - the 1st Northern Rhodesia Regiment;
    - the 2nd (Nyasaland) King's African Rifles;
    - Punjabi battalions;
    - the Somaliland Camel Corps;
    - the 1st East African Light Battery's 3.7-inch howitzers.
  - Mill Hill (held by the Northern Rhodesians) fell on 12 August and Observation Hill on 15 August.
  - Captain Eric Wilson commanded Somali machine-gun posts on Observation Hill. He was awarded the Victoria Cross as
    killed, but had been captured alive.
  - The force withdrew to Berbera and was evacuated by 19 August. British losses were light (38 killed); Italian
    losses were much heavier (figures conflict).

### Briefing (a company commander, 1st Northern Rhodesia Regiment)

1. The Italians have come over the border with a whole army: brigades of colonial troops, guns by the dozen, tanks and
   aircraft. We have four battalions, a battery of little mountain guns and the Camel Corps, holding a line of hills
   across the road to Berbera.
2. We are not here to win. We are here so the ships at Berbera have time to take the force off. The hills are rock:
   no digging, but plenty of cover behind the boulders. Put the machine guns where they look down the road, and keep
   the mountain guns firing at anything that bunches up.
3. Hold for as long as the brigadier needs, then fall back through the next hill, and the next, and come down to the
   coast in one piece. A battalion that walks out alive can fight again.

**Objective**: Hold the hills, then withdraw to the coast.

### Map and sectors

| x (wu) | Sector | Ground | Structures |
| --- | --- | --- | --- |
| 0 to 2,000 | Road to Laferug and Berbera | scrub | HQ (look `tent`) |
| 2,000 to 4,000 | Castle and Knobbly Hills | rock (heightBonus 1.1) | sangars (stone breastworks: trenches T1 and T2, owner 0, 6 slots) |
| 4,000 to 6,000 | Mill and Observation Hills | rock (heightBonus 1.1) | T3 (Mill Hill, owner 0), T4 (Observation Hill, owner 0) |
| 6,000 to 9,000 | The gap and the dry river bed | scrub, sand | enemy entry edge |

### Forces

- **Player**: 2 sappers (`eastAfrican` porters); 8 askari in T3; 8 in T4 (with 2 Vickers teams, Somaliland Camel
  Corps look); 4 in T2; 1 Boys rifleman; 150 Money. Supports: mountain battery (artillery, look `mountainGun`,
  cooldown 50 s).
- **Loans**: 2 Vickers teams (start); 2 Boys riflemen (phase 2); 1 3-inch mortar (phase 1).
- **Enemy (no HQ, waves)**: ascari, Italian infantry, Breda 30 teams, mortars, L3/35 tankettes (2), M11/39 (2),
  artillery (scripted barrages), SM.81 and SM.79 raids.

### Phases and events

1. **"Observation Hill"**: survive 240 s; lose if T4 is lost before 180 s.
   - Hints:
     - "Your men are in stone sangars on the hills: they take less fire."
     - "Sappers carry Money; train more askari."
     - "Hold keeps the line."
   - 20 s: 8 ascari; every 30 s: 6 ascari; 120 s: 2 L3/35 tankettes (the Boys hint).
2. **"Mill Hill"**: survive 240 s.
   - 0 s: barrage on T3.
   - 60 s: SM.81 raid.
   - 140 s: 2 M11/39 plus 10 ascari.
3. **"The withdrawal"** (exit: 12 units off the left edge within 240 s).
   - Hint: "Fall Back by kinds: send the guns and the wounded first, keep the machine guns on Hold to cover them."
   - The Italians advance (posture `advance`).

### Side objectives

- **Observation Hill holds to the end of phase 1** (+15%).
- **No Vickers team lost** (+10%).

### Medals

Fixed scoring (delay), plus an exit bonus. Target casualties 18.

### Music, weather, time

- **Music**: `tugArgan` (new). E minor, 116 BPM. Dry and sparse: `hand` drums, a lonely horn statement of the theme
  (`take: 4`), dry reverb, string stabs. The tense layer is a shimmering high tremolo in the heat.
- **Weather and time**: hot and dry, dust; day to dusk.

### How a sensible player wins on Normal

1. Fill T3 and T4. Vickers teams on the forward edge.
2. Mountain guns on the massed ascari.
3. Boys riflemen for the tankettes; the mortar for the M11s' supporting infantry.
4. Withdraw in bounds, with the machine guns last.

Fixed 14 minutes.

---

## Mission 2: The Juba River

- **Id** 4002, key `juba`. **Date** 17 to 22 February 1941 (`1941-02-19`). **Place** Jelib, Italian Somaliland,
  about 0.49 N, 42.78 E. **Mode** special (river crossing, then assault). **Length** about 22 minutes. **Map**
  16,000 wu. **Theatre** `riverForest`.
- **History**:
  - Lieutenant General Alan Cunningham's 11th and 12th African Divisions crossed the Juba:
    - the 1st South African Brigade (Brigadier Dan Pienaar) at Yonte on 17 February, where South African engineers
      built a pontoon bridge, the "Union Bridge", by 19 February;
    - the Gold Coast Brigade unopposed at Mabungo, with the 2nd Nigeria Regiment holding the bridgehead there;
    - the 22nd East African Brigade, which cut the road from Jelib to Mogadishu.
  - The Italian 101st and 102nd Colonial Divisions broke up.
  - The Nigerian brigade entered Mogadishu unopposed on 25 February; some 31,000 Italian and colonial troops had been
    put out of action by then.
  - The river is about 580 feet (177 m) wide near Gobwen and wadeable in places near Jelib. The bush round Jelib caught
    fire in the bombardment.

### Briefing (a battalion commander, Gold Coast Regiment)

1. The Juba is the Italians' moat: a wide brown river with forest on both banks, and their whole southern army behind
   it. Our brigade crosses at Mabungo while the South Africans force a crossing downstream and the Nigerians push up the
   road. Somewhere in between, Jelib is the knot that ties their line together.
2. There are no bridges, so we cross in boats and on rafts, then hold a foothold while the South African engineers
   build one. Once the bridge is in, the armoured cars and the guns can come over, and we go for Jelib.
3. The forest is thick and the heat is hard. Keep the men together, keep the water bottles full, and keep moving. They
   have more men than we have, but their army is coming apart, and we are going to help it on its way.

**Objective**: Cross the Juba, bridge it and take Jelib.

### Map and sectors

| x (wu) | Sector | Ground | Structures |
| --- | --- | --- | --- |
| 0 to 2,500 | East bank camp | sand | HQ (`tent`) |
| 2,500 to 3,600 | The Juba | water | landing point P1 (x 3,800, spawn, `batchEvery` 40 s); a pontoon bridge (bridge 1) appears in phase 2 |
| 3,600 to 8,000 | Riverine forest and banana plantations | forest | trench T1 (Italian, colonial battalion, 7 slots); wire |
| 8,000 to 12,000 | The bush | scrub | trench T2; capture point P2 (spawn) |
| 12,000 to 16,000 | Jelib | sand, cobble | buildings B1 to B4 (whitewashed houses, the fort); enemy HQ at 15,850 |

### Forces

- **Player**:
  - 3 sappers;
  - at P1: 10 Gold Coast riflemen (`westAfrican`), 2 Bren, 1 Boys;
  - 300 Money; `rosterNation`: rifle `westAfrican`, lightTank `southAfrican` (Marmon-Herrington), artillery
    `southAfrican`.
  - Supports: artillery (from phase 2), smoke, Hartbees (airStrike), Fairey Battle (bomber), Maryland recon.
- **Loans**: 8 Nigeria Regiment riflemen (phase 2); 3 Marmon-Herrington armoured cars (phase 2, when the bridge is in);
  2 3-inch mortars.
- **Enemy**:
  - HQ (the colonial division's command), `incomeMul` 0.7.
  - Start: T1 (8 ascari, 2 Breda 30), T2 (6 ascari, 1 Breda, 1 47/32), Jelib (10 ascari and Italian infantry,
    2 Breda, 1 mortar, Carabinieri).
  - Waves: dubat and banda groups (fast irregulars: the Italian `ascari` signature).
  - Supports: artillery, CR.42 strafing (rare).

### Phases and events

1. **"The crossing"** (hold P1 for 180 s).
   - Ferry every 40 s; hint "New troops cross with each boat."
2. **"The bridge"** (capture T1, then survive 120 s while the bridge is built).
   - 120 s: bridge 1 opens (`setOwner`); announce "The Union Bridge is in. Armoured cars crossing."
3. **"The bush"** (capture P2).
   - Weather `smoke` (the bush fire) over 60 s.
4. **"Jelib"** (destroy the enemy HQ).
   - 200 s: Italian counter-attack from the fort.

### Side objectives

- **The bridge by 8 minutes** (+10%).
- **The fort**: capture B4 (+10%).

### Medals

Timed: target 22 minutes, target casualties 40.

### Music, weather, time

- **Music**: `juba` (new). A minor, 120 BPM. River and forest: rolling `hand` drum patterns, a warm but dry string
  ostinato, the theme's call on horn and its answer on strings. The combat layer has full snare and brass.
- **Weather and time**: hot, humid, smoke from bush fires; day.

### How a sensible player wins on Normal

1. Fill the landing; Brens forward.
2. Take T1 with mortars and a frontal rush, and hold while the bridge goes in.
3. Armoured cars and riflemen through the bush. Hartbees on the Jelib guns.

Expected 20 to 24 minutes.

---

## Mission 3: Keren, the northern approach

- **Id** 4003, key `keren`. **Date** 21 February to 27 March 1941 (`1941-03-15`). **Place** Keren, Eritrea,
  15.777 N, 38.451 E. **Mode** assault (mountain). **Length** about 24 minutes. **Map** 18,000 wu. **Theatre**
  `eritreaMountains`.
- **History**:
  - The Battle of Keren (3 February to 27 March 1941) was fought mainly by the 4th and 5th Indian Divisions under
    Lieutenant General William Platt, against the Italians' best: Granatieri di Savoia, an Alpini battalion,
    Bersaglieri, and many Eritrean colonial battalions under General Nicolangelo Carnimeo. They held the peaks above
    the Dongolaas Gorge.
  - From the north, the Free French Brigade d'Orient (Monclar) advanced. Its Bataillon de marche n° 3, raised in Chad
    in December 1940 from Chadian tirailleurs under Commandant Garbay, took Fort Kub-Kub around 21 to 23 February 1941:
    the first Free French victory of the war. It then fought on Mount Engiahat from 14 to 28 March.
  - The Sudan Defence Force fought in the campaign.
  - Keren fell on 27 March; British and Indian losses were about 536 killed.
  - This mission plays the Chadian battalion's battles and honours the Indian divisions' main assault in the
    briefing.

### Briefing (a company commander, Bataillon de marche n° 3)

1. Our battalion came from Fort-Lamy, two thousand kilometres across the desert, to fight for a France that most of us
   have never seen. Here, on the road to Keren from the north, we are the only Frenchmen still in this war. Let us
   make it count.
2. First the fort at Kub-Kub, on its hill above the track: stone walls, machine guns, mountain guns, an Eritrean
   battalion. Then into the mountains, where the Italians hold the peaks above the Indian divisions' road. The ground
   is rock and cactus, and every slope is steep. Climb at night, and fight by day from the top.
3. The Indians and the British are going at the gorge itself. Our job is to make the enemy look north. Take the fort,
   take the heights of Engiahat, and hold them. Every gun they turn on us is one they cannot turn on the gorge.

**Objective**: Take Fort Kub-Kub, then storm and hold Mount Engiahat.

### Map and sectors

| x (wu) | Sector | Ground | Structures |
| --- | --- | --- | --- |
| 0 to 2,500 | Camp on the northern track | sand | HQ (`tent`) |
| 2,500 to 6,500 | Kub-Kub | rock, slope up | building B1 the fort (`fort`, 2 floors, 8 slots, hp x1.5, Italian); wire; capture point P1 (structure B1, spawn) |
| 6,500 to 11,000 | The valley | sand, scrub | trench T1 (Italian, colonial battalion) |
| 11,000 to 16,000 | Mount Engiahat | slope up, rock (heightBonus 1.12 above 14,000) | sangars T2 and T3 (Italian); capture point P2 "Engiahat" (x 15,000) |
| 16,000 to 18,000 | The reverse slope | rock | enemy HQ at 17,850 |

### Forces

- **Player**: 3 sappers; 12 tirailleurs (`chadian`); 2 FM 24/29 (`lmg`); 1 Hotchkiss team; 2 mortars; 1 sniper;
  350 Money. Supports: artillery (a battery), smoke; RAF bombers (the Wellesley, a variant bomber look) from phase 2.
- **Loans**: 8 Foreign Legion infantry (`chadian` look `legion`, 13th Demi-Brigade, phase 2); 4 Sudan Defence Force
  riflemen (`sudanese`, phase 1); 2 Boys riflemen.
- **Enemy**:
  - HQ, `incomeMul` 0.8.
  - Start: the fort (8 ascari, 2 Breda, 1 65/17 gun pit); T1 (6 ascari, 1 Breda); Engiahat T2 and T3 (8 men each:
    Alpini looks on T3, Bersaglieri on T2; Fiat 35 HMG teams); mortars; 2 snipers.
  - Waves: Granatieri counter-attacks (assault, Italian look); ascari charges (signature).
  - Supports: artillery (frequent: Keren was gun-heavy), CR.42 strafing.

### Phases and events

1. **"Kub-Kub"** (capture P1).
   - Hint: "Grenades and mortars crack a fort; a wall stops rifle fire."
2. **"The valley"** (capture T1).
   - Night falls over 60 s: climb by night (visibility 0.65 for both sides).
3. **"Engiahat"** (capture P2). Dawn at 120 s.
4. **"Hold the heights"**: prep 45 s (stone sangars: build sandbag walls, which are stone in this theatre); hold P2 for
   300 s.
   - Counter-attacks with Granatieri and ascari at 40 s, 160 s and 260 s.
   - On success: announce "27 March: Keren has fallen. The road to Asmara is open."

### Side objectives

- **Kub-Kub in 6 minutes** (+10%).
- **The Alpini position**: T3 taken before T2 (+10%).

### Medals

Timed: target 24 minutes, target casualties 45.

### Music, weather, time

- **Music**: `keren` (new). D minor, 118 BPM. Mountain echo: a long thin reverb, `bell` strokes like stones falling,
  horn calls across peaks (the theme's call), `hand` drums under a climbing string ostinato. Distinct from the old
  `cassino` track (lighter, drier, pentatonic).
- **Weather and time**: hot days, cold nights; day, night, dawn.

### How a sensible player wins on Normal

1. Mortars on the fort's gun pit and walls; tirailleurs assault with grenades.
2. Climb the valley at night with smoke.
3. Take T2 and T3 one by one with the Legion behind the tirailleurs.
4. Wall the summit; artillery on each counter-attack.

Expected 22 to 26 minutes.

---

## Mission 4: Gojjam, Gideon Force and the patriots

- **Id** 4004, key `gojjam`. **Date** February to early April 1941 (`1941-03-14`). **Place** from Burye to Debre
  Markos, Gojjam; pin at Debre Markos, about 10.33 N, 37.72 E. **Mode** special (raids and bluff against a stronger
  garrison). **Length** about 22 minutes. **Map** 16,000 wu. **Theatre** `ethiopianHighlands`.
- **History**:
  - Emperor Haile Selassie re-entered Ethiopia from the Sudan in January 1941 with Gideon Force (Orde Wingate):
    - the Frontier Battalion of the Sudan Defence Force (Hugh Boustead);
    - the 2nd Ethiopian Battalion;
    - Mission 101 and operational centres;
    - about 800 Sudanese and 800 part-trained Ethiopians;
    - a few mortars and no artillery;
    - thousands of camels, nearly all of which died.
  - Thousands of Arbegnoch (patriot fighters) rose with them.
  - Night raids by small parties, megaphones and bluff persuaded much larger Italian garrisons to withdraw:
    - from Burye in early March (the Emperor entered Burye on 14 March);
    - past Dembecha;
    - from Debre Markos in early April (4 or 6 April; sources differ).
  - The Emperor entered Addis Ababa on 5 May 1941. Colonel Maraventano's column surrendered to Gideon Force in late
    May (19 or 23 May; sources differ).
  - The Italian commander in the area was General Nasi; Colonel Natale commanded at Debre Markos.

### Briefing (a commander of the patriot forces of Gojjam)

1. For five years the Italians have held our cities, and for five years we have held the mountains. Now the Emperor
   has come back across the border, and the whole of Gojjam is rising. The Italians in their forts still have more men,
   more guns and more of everything. Let them count those things while we do the fighting.
2. We do not attack their walls by day. We go at night, a few dozen at a time, close enough to throw a grenade, and
   then we are gone. Every night we come back, from a different side, with more fires on the hills and more drums, until
   they believe there is an army in front of them.
3. Burn their outposts one by one. When their nerve breaks and they march out of their forts, fall on the column on
   the road. Then on to Debre Markos, where the Emperor will raise his flag.

**Objective**: Raid the Italian outposts until the garrison withdraws, ambush the column, and take Debre Markos.

### Map and sectors

| x (wu) | Sector | Ground | Structures |
| --- | --- | --- | --- |
| 0 to 2,500 | Patriot camp in the hills | rock | HQ (`tent`; look `tukul` for Ethiopia) |
| 2,500 to 8,000 | Burye outposts | rock, scrub | outposts B1 to B3 (stone and sandbag `fort` looks, small, Italian; each an objective) |
| 8,000 to 12,000 | The Dembecha road | road, field | the retreating column's route; capture point P1 "the road" (spawn) |
| 12,000 to 16,000 | Debre Markos | cobble | buildings B4 to B6 (the fort, a church, the town); enemy HQ at 15,850 |

### Forces

- **Player**:
  - 2 sappers;
  - 16 Arbegnoch irregulars (`ethiopian`, signature);
  - 6 riflemen of the 2nd Ethiopian Battalion;
  - 4 riflemen and 1 Bren of the Frontier Battalion (`sudanese`);
  - 2 mortars;
  - 300 Money.
  - Supports: Patriot Rising (signature), smoke; an occasional RAF bomber (the Wellesley, cooldown 180 s).
- **Loans**: 2 mortar teams; 4 Frontier Battalion riflemen (phase 2).
- **Enemy**:
  - HQ (the garrison), `incomeMul` 0.7.
  - Start: B1 to B3 (6 ascari and Italian infantry each, 1 Breda, 1 65/17 gun pit on B2); the road (patrols); Debre
    Markos (14 men, 2 Breda, 2 guns).
  - The garrison is larger than the player at the start (population about 60 against about 30).
  - Supports: artillery; Ca.133 bombers (2 raids).

### Phases and events

1. **"Night raids"** (destroy outposts B1, B2 and B3). Time night (0.65).
   - Each raid cycle: night lasts 150 s, then day 90 s (time events), so the raids happen in the dark.
   - The bluff: each outpost destroyed sets the Italian AI posture to `hold` for 120 s, and its forward garrison pulls
     back one sector (scripted `posture` events), as the real garrisons did under night pressure.
   - Hint: "Irregulars strike hardest from the dark and from rough ground. Use Patriot Rising to bring more men into
     the fight."
2. **"The column"** (kill 25 of the withdrawing column, or capture P1).
   - Phase start: banner "The garrison is marching out!"; the Italian column (12 ascari, 4 Italian infantry, 2 Breda,
     1 gun, pack mules as scenery) moves from x 13,000 toward 8,000 (posture `advance`, then `free`).
   - Hint: "Ambush them on the road."
3. **"Debre Markos"** (destroy the enemy HQ).
   - On victory: announce "Debre Markos is free. On 5 May the Emperor enters Addis Ababa." The Ethiopian flag rises
     over the victory screen.

### Side objectives

- **Three outposts in three nights**: phase 1 done within 720 s (+15%).
- **No irregulars lost in daylight** (+10%).

### Medals

Timed: target 22 minutes, target casualties 35.

### Music, weather, time

- **Music**: `gojjam` (new). F minor, 112 BPM. Highlands at night: low `hand` drums like distant signal drums, high
  `bell` stars, the theme's call echoed from far off (horn, reverb), then fierce raid bursts (snare and brass). The
  victory sting is the theme's answer in major.
- **Weather and time**: dry season, cold highland nights; a night and day cycle.

### How a sensible player wins on Normal

1. Hit one outpost at a time by night with irregulars and mortars.
2. Pull back before dawn.
3. Ambush the column on the road with everyone and Patriot Rising.
4. Then storm Debre Markos with the battalions.

Expected 20 to 24 minutes.

---

## Mission 5: The Lakes, Wadara and Colito

- **Id** 4005, key `colito`. **Date** 3 to 19 May 1941 (`1941-05-19`). **Place** Colito (Alaba Kulito), southern
  Ethiopia, about 7.31 N, 38.09 E. **Mode** assault (rain, river, tanks). **Length** about 24 minutes. **Map** 18,000 wu.
  **Theatre** `ethiopianHighlands` (wet).
- **History**:
  - In the Battle of the Lakes, the 24th Gold Coast Brigade broke the Italian position at Wadara (assault 3 May; the
    Italians withdrew 9 to 10 May), losing 22 Europeans and 96 Africans killed.
  - The 22nd East African Brigade (1/2, 1/3, 1/4 and 1/6 KAR) forced the crossing of the Billate river at Colito on
    19 May in torrential rains. Italian tanks counter-attacked there.
  - Sergeant Nigel Leakey of 1/6 KAR jumped onto an Italian tank, opened the turret, killed the crew and made the driver
    take it to cover. He was killed attacking a second tank and awarded a posthumous Victoria Cross.
  - At Colito some 489 Italians and 300 colonial troops surrendered with 10 guns. At Soddu on 22 May about 4,800
    surrendered, with 6 medium and 4 light tanks.
  - The type of the Italian "medium" tanks is uncertain: most M11/39s were lost by early 1941.

### Briefing (a company commander, 1/6th King's African Rifles)

1. The rains have come early and hard. Every track is a river and every river is a flood, and the Italians are holding
   the far bank of the Billate with guns, machine guns and, the patrols say, tanks. Behind them are the lakes and the
   last of their southern army.
2. The Gold Coast brigade has already broken them at Wadara, at a price. Now it is our turn. We cross where the river
   bends, under the guns, wade the shallows and get onto the far bank before they can bring the tanks down.
3. Tanks are not invincible. Our Boys rifles can hurt the light ones, and a brave man close enough can deal with the
   rest. Do not let the men run from them. Stay in cover, let them come close, and go for their sides.

**Objective**: Break the Wadara line, force the Billate at Colito and destroy the Italian tank counter-attack.

### Map and sectors

| x (wu) | Sector | Ground | Structures |
| --- | --- | --- | --- |
| 0 to 2,500 | The road from the south | mud | HQ (`tent`) |
| 2,500 to 7,500 | Wadara forest | forest, mud | trenches T1 and T2 (Italian), wire; capture point P1 (spawn) |
| 7,500 to 10,500 | Approach to the Billate | mud | |
| 10,500 to 11,500 | The Billate | water (in flood: 0.3 speed) | the bridge is destroyed; a ford |
| 11,500 to 15,000 | Colito | mud, cobble | trench T3 (Italian); buildings B1 and B2; capture point P2 "Colito" (spawn) |
| 15,000 to 18,000 | Road to the lakes | road | enemy HQ at 17,850 |

### Forces

- **Player**: 3 sappers; 10 Gold Coast riflemen (`westAfrican`, phase 1 force); 2 Bren; 2 3-inch mortars; 1 Boys;
  300 Money. From phase 2, `rosterNation` switches rifle to `eastAfrican` (the KAR take over): wave side 0, 12 KAR
  askari, 2 Bren, 2 Boys. Supports: artillery (SA batteries), smoke; SAAF airStrike (rain permitting).
- **Loans**: 4 Boys riflemen (phase 3); 3 SA armoured cars (phase 3); 2 3-inch mortars.
- **Enemy**:
  - HQ, `incomeMul` 0.7.
  - Start: T1 and T2 (8 men each, Breda, a 47/32, a 65/17 gun pit); T3 (8 men, 2 Breda, 1 47/32); Colito houses.
  - Phase 3: 2 medium tanks (`tank`, look `m11_39`, with the note above) and 3 L3/35 with 10 infantry.
  - Supports: artillery.

### Phases and events

1. **"Wadara"** (capture P1). Weather `rain`.
2. **"The KAR take over"** (reach x 10,500 with 12 units).
   - Phase start: announce "The 22nd East African Brigade is up. The Gold Coast brigade hands over."
3. **"The Billate"** (capture T3).
   - Crossing in flood: units wade at 0.3.
   - 60 s: banner "Tanks across the river!"; the tank counter-attack.
   - Hint: "Close with the tanks from the side. Boys rifles hurt the light ones."
   - A unit of the KAR within 30 wu of an enemy tank's rear may "board" it (job 7 has no such mechanic. Treat it as a
     scripted bonus: an assault-kind askari in contact with a tank's rear deals x3 damage; data `boardingMul`. Keep it
     only if job 7's front and rear armour supports it).
4. **"Colito"** (capture P2, then destroy the enemy HQ).

### Side objectives

- **Every tank**: all the phase 3 armour destroyed (+15%).
- **Wadara in 6 minutes** (+10%).

### Medals

Timed: target 24 minutes, target casualties 45.

### Music, weather, time

- **Music**: `colito` (new). G minor, 128 BPM. Rain and pressure: a wet, rolling `hand` drum pattern, string tremolo
  like rain, the theme's call in low brass, anvil for the tanks. The combat layer is heavy snare.
- **Weather and time**: torrential rain, mud; day.

### How a sensible player wins on Normal

1. Mortars on the Wadara gun pits; riflemen trench by trench.
2. KAR to the river under smoke; mortars on T3 and the far bank.
3. Boys riflemen in cover on the far bank when the tanks come, and armoured cars to finish them.

Expected 22 to 26 minutes.

---

## Mission 6: Saïo

- **Id** 4006, key `saio`. **Date** 25 March to 6 July 1941; the mission shows June to July (`1941-07-03`).
  **Place** the Saïo plateau near Dembidolo, western Ethiopia, 8.53 N, 34.80 E. **Mode** special (siege, flank attack,
  surrender). **Length** about 24 minutes. **Map** 16,000 wu. **Theatre** `ethiopianHighlands` (rainy).
- **History**:
  - The Force Publique of the Belgian Congo advanced into south-western Ethiopia. Gambela was taken on 25 March by a
    Belgian-Congolese battalion with two KAR companies.
  - The Belgian-Congolese force fought on the Bortai brook (15 and 21 April) and attacked at Mogi on 9 June, without
    success.
  - It besieged General Pietro Gazzera's forces on the Saïo plateau, about 1,200 m above the plain. The 64 km road up
    was mined, and the Italians burned the elephant grass for fields of fire.
  - The rains brought mud, airdrops, half rations and disease: about 80% of the force's 462 dead died of illness.
  - Under Major General Auguste Gilliaert the crossing was forced on 2 July, and a flank attack along a goat path came
    on 3 July. Staff cars with white flags came down the mountain.
  - On 6 July (7 July in some sources) Gazzera, eight other generals and some 6,454 men (about 3,500 of them ascari)
    surrendered, with 20 guns, 200 machine guns and 250 trucks.

### Briefing (a battalion commander, Force Publique)

1. We have marched two thousand kilometres from the Congo to this mountain, and for three months it has beaten us: the
   rain, the fever, the mines on the road, and General Gazzera's army on the plateau above. Tonight that changes.
2. Our guns have come up at last. While they shell the Italian line above the brook, two companies go up a goat path
   on the left that their sentries do not watch, and come out on the plateau behind them. When they are there, the
   whole force crosses the brook and climbs.
3. The Italians are as tired, as wet and as sick as we are, and they have no way home. Press them hard on two sides,
   and they will understand. Bring me their general, and the war in this corner of Africa is over.

**Objective**: Cross the Bortai, turn the Italian flank by the goat path, and force the surrender at Saïo.

### Map and sectors

| x (wu) | Sector | Ground | Structures |
| --- | --- | --- | --- |
| 0 to 3,000 | Siege camp | mud | HQ (`tent`, look `tukul`) |
| 3,000 to 5,000 | The Bortai brook | water (narrow, 0.4), mud | trench T1 (own siege line, owner 0) |
| 5,000 to 10,000 | The slope below the plateau | slope up, tall grass (forest-like cover), burned patches | minefield M1 along the road strip; Italian trenches T2 and T3; capture point P1 (structure T3, spawn) |
| 10,000 to 16,000 | The Saïo plateau | field (heightBonus 1.1) | buildings B1 to B3 (headquarters huts); capture point P2 "Saïo"; enemy HQ at 15,850 |

The **goat path**: a hidden spawn point SP1 at x 11,000 (owner -1, closed), opened by the `spawnPointState` event in
phase 2 for 180 s and fed by a scripted flanking wave.

### Forces

- **Player**: 3 sappers; 16 riflemen (`congolese`); 2 Vickers teams; 2 Stokes mortars (`mortar`, look `stokes`);
  1 sniper; 350 Money. Supports: artillery (the field batteries that came up: from phase 1), smoke; 3 SAAF Hawker Harts
  (airStrike, a biplane look, cooldown 150 s).
- **Loans**: 2 KAR rifle companies as 8 askari (`eastAfrican`, phase 1); 2 Stokes mortars; 2 Vickers teams.
- **Enemy**:
  - HQ (Gazzera's command), `incomeMul` 0.6 (sick and cut off).
  - Start: T2 and T3 (8 men each: ascari and Italian infantry, Breda, Fiat 35 HMG); snipers in the trees ("Galla"
    snipers in the sources: here, plain ascari snipers); gun pits (2 75/27); the plateau (12 men, 2 Breda).
  - Waves: small sorties.
  - Supports: artillery.

### Phases and events

1. **"The guns"** (survive 180 s while the barrage falls).
   - Free barrages on T2 (6 strikes over 180 s).
   - An Italian sortie across the brook at 60 s.
   - Weather `rain`.
2. **"The goat path"** (capture P1).
   - Phase start: SP1 opens. Wave side 0 at SP1: 8 riflemen and 1 Vickers, announce "Two companies are on the plateau
     behind them!"
   - Deploy there for 180 s, then it closes.
   - Hint: "Attack from both sides at once."
3. **"Saïo"** (`surrender`: the enemy HQ below 40%).
   - On surrender: announce "Staff cars with white flags are coming down the mountain. General Gazzera surrenders."

### Side objectives

- **Use the goat path**: 10 or more units deployed at SP1 (+15%).
- **No one lost on the mined road** (+10%).

### Medals

Timed: target 24 minutes, target casualties 40.

### Music, weather, time

- **Music**: `saio` (new). B-flat minor, 108 BPM. Siege, rain and fever: a slow, oppressive pad, sparse `hand` drums,
  string harmonics like mist, the theme's answer in a weary form; then a surging section for the flank attack, and a
  triumphant sting.
- **Weather and time**: rain, mist; night then day.

### How a sensible player wins on Normal

1. Let the barrage soften T2. Hold the sortie at the brook.
2. Pour units through the goat path while the main force crosses.
3. Mortars on T3, then everyone onto the plateau.

Expected 22 to 26 minutes.

---

## Mission 7: Gondar and Kulkaber

- **Id** 4007, key `gondar`. **Date** 13 to 27 November 1941 (`1941-11-21`). **Place** the Kulkaber (Culqualber) pass
  on the Debre Tabor road, about 12.2 N, 37.9 E (approximate); Gondar 12.60 N, 37.47 E. **Mode** assault. **Length**
  about 26 minutes. **Map** 22,000 wu. **Theatre** `ethiopianHighlands`.
- **History**:
  - The last Italian stronghold in East Africa. General Guglielmo Nasi held Gondar.
  - Colonel Augusto Ugolini's 1st Mobilised Carabinieri Group (with a zaptié company) held the Kulkaber pass.
  - The 12th African Division (Major General Charles Fowkes), with the 25th and 26th East African Brigades, the 1st
    East African Pioneers, the Kenya Armoured Car Regiment, a South African armoured detachment and Ethiopian patriot
    irregulars, attacked:
    - 1/6 KAR's first attack on Kulkaber on 13 November was repulsed;
    - the pass fell on 21 November after very hard fighting (Italian losses about 1,000 killed);
    - the final assault on Gondar went in at 05:30 on 27 November, and Nasi surrendered that afternoon.
  - The last Italian fighter sortie, by a CR.42, killed the British artillery commander, Lieutenant Colonel Ormsby.
    Sources date this to 20 or 22 November.

### Briefing (a battalion commander, 25th East African Brigade)

1. Gondar is the last place in East Africa where the Italian flag still flies, and the road to it goes through the pass
   at Kulkaber. The pass is held by Carabinieri, the best soldiers they have left, dug into the rock. Our first attack
   was thrown back. This time the whole division comes, and the patriots with us.
2. The patriot bands know every path over the hills; let them go round while we go up the middle. The armoured cars
   cannot climb the slopes but can hold the road. The guns will open on the pass at first light.
3. When the pass is ours, the way to Gondar is open, and the war in Abyssinia ends there. They have one aeroplane left,
   they say. Keep your heads down when you hear it.

**Objective**: Storm the Kulkaber pass, then take Gondar.

### Map and sectors

| x (wu) | Sector | Ground | Structures |
| --- | --- | --- | --- |
| 0 to 3,000 | Start | rock | HQ (`tent`) |
| 3,000 to 9,000 | The pass at Kulkaber | slope up, rock | trenches T1 to T3 (the Carabinieri's positions, `garrison`); wire; minefield M1; capture point P1 "Kulkaber" (x 8,500, spawn) |
| 9,000 to 15,000 | The high road | road, field | buildings B1 and B2 (an Italian fort, Fort Ghirghiz-style: generic `fort`); capture point P2 (spawn) |
| 15,000 to 22,000 | Gondar | cobble | buildings B3 to B7 (Fasil's castle walls as scenery, the town); enemy HQ at 21,850 |

### Forces

- **Player**: 4 sappers; 14 askari (`eastAfrican`); 2 Bren; 2 Vickers; 2 3-inch mortars; 1 sniper; 10 Arbegnoch
  irregulars (`ethiopian`); 2 armoured cars (`southAfrican`, look `marmonHerrington`); 500 Money. Supports: artillery,
  smoke, SAAF airStrike, Patriot Rising (the Ethiopian signature, shared via rosterNation).
- **Loans**: 6 East African Pioneers (as `assault` with grenades, phase 1); 2 3-inch mortars; 2 Boys riflemen.
- **Enemy**:
  - HQ (Nasi's command), `incomeMul` 0.7.
  - Start: T1 to T3 (Carabinieri: `veteran` tag, 6 each, plus Breda, Fiat 35, a 65/17 gun pit at T3); B1 and B2
    (10 ascari, 2 Breda, a 75/27); Gondar (16 men, 3 Breda, 2 guns, 1 L3/35).
  - Supports: artillery, one CR.42 (the `fighter` support, used once: the "last sortie" event).

### Phases and events

1. **"Kulkaber"** (capture P1).
   - 0 s: barrage (free, 4 strikes).
   - 120 s: hint "The patriots can climb round: send irregulars against the flank trench."
   - 300 s: the last CR.42 strafes the player's guns (scripted `airRaid`, side 1, banner "Enemy fighter!").
2. **"The high road"** (capture P2).
3. **"Gondar"** (destroy the enemy HQ).
   - 05:30, a dawn assault: time dawn at phase start.
   - On victory: announce "27 November 1941: General Nasi surrenders Gondar. The East African campaign is over."

### Side objectives

- **The Carabinieri's gun**: destroy T3's gun pit with infantry (+10%).
- **Kulkaber in 10 minutes** (+15%).

### Medals

Timed: target 26 minutes, target casualties 50.

### Music, weather, time

- **Music**: `gondar` (new). C minor, 124 BPM. The East African finale: highland echo, `bell`, the theme's call and
  answer combined, a broad brass statement at the end. Victory in a bright major colour.
- **Weather and time**: dry season, clear, cold at dawn; day, dawn.

### How a sensible player wins on Normal

1. Barrage, then the pioneers' grenades on T1 while the irregulars flank T2.
2. Mortars on T3's gun.
3. Armoured cars hold the road; deploy at P2.
4. Dawn assault on Gondar with everything.

Expected 24 to 28 minutes.

---

## Mission 8: Sidi Rezegh

- **Id** 4008, key `sidiRezegh`. **Date** 23 November 1941 (`1941-11-23`). **Place** Sidi Rezegh, south-east of
  Tobruk, Libya, about 31.98 N, 24.1 E (approximate). **Mode** survival, then withdrawal (delay). **Length** about
  18 minutes. **Map** 12,000 wu. **Theatre** `desert`.
- **History**:
  - During Operation Crusader, on 23 November 1941 (the Germans' Sunday of the Dead, "Totensonntag"), the 5th South
    African Infantry Brigade (Brigadier B. F. Armstrong: 3rd Transvaal Scottish, South African Irish, 2nd Regiment
    Botha) of the 1st South African Division was attacked south of Sidi Rezegh by the 15th Panzer Division and the
    Italian Ariete Division (M13/40), with the 21st Panzer in some accounts, under the Afrika Korps.
  - The ground was solid limestone, so slit trenches were only about 23 cm deep.
  - The 3rd Field Regiment's 25-pdrs fired over open sights; 5 of 24 guns were saved and 7 recovered later.
  - The brigade went in about 5,800 strong and came out with fewer than 2,000. The division reported that night that it
    had ceased to exist as a fighting formation.
  - Armstrong was captured.
  - The German losses in tanks that afternoon were heavy, which helped turn the battle.

### Briefing (a company commander, 3rd Transvaal Scottish)

1. We are on a ridge of bare limestone south of the airfield, and the ground will not take a spade more than a hand's
   depth. Somewhere to the south-west, the panzers that broke our armour yesterday are forming up, and the Italians'
   armoured division with them.
2. The guns of the field regiment are with us. They are field guns, not anti-tank guns, but a 25-pounder firing over
   open sights will stop a tank. Put the guns where they can see, the Boys rifles and the two-pounders with them, and
   scrape what cover you can.
3. We cannot stop two armoured divisions with a brigade. What we can do is make them pay for every metre, and when
   the line breaks, get every man and gun that can move out to the east. Make them pay.

**Objective**: Hold the brigade box as long as you can, destroying panzers, then break out with every man who can
move.

### Map and sectors

| x (wu) | Sector | Ground | Structures |
| --- | --- | --- | --- |
| 0 to 2,500 | Rear, the escape route east | sand | HQ (`tent`, the brigade HQ) |
| 2,500 to 6,000 | The brigade box | rock (prep dig times x2: limestone) | shallow trenches T1 to T3 (owner 0, 6 slots each, with half the cover: data `shallow`); gun pits for the 25-pdrs (`gunPit` owner 0, weapon `fieldGunDirect`) G1 to G4 |
| 6,000 to 12,000 | The open desert to the south-west | sand | enemy entry edge |

### Forces

- **Player**: 3 sappers; 18 riflemen (`southAfrican`, Brodie helmets); 3 Bren; 2 Boys; 2 2-pdr crews (`at`, look
  `twoPdr`); 4 25-pdr gun pits; 2 3-inch mortars; 400 Money. Supports: artillery (the rest of the regiment), smoke.
  RAF fighters (`fighter`) are rare.
- **Loans**: 4 Boys riflemen; 2 2-pdr crews; 2 3-inch mortars.
- **Enemy (no HQ, waves)**:
  - German Panzer III (5 cm), Panzer IV (short), Sd.Kfz. 251 with grenadiers, Pak 38;
  - Italian M13/40s of the Ariete with Bersaglieri;
  - Stukas, artillery.

### Phases and events

0. **Prep (60 s)**: foxholes, sandbag walls, wire (dig times doubled on rock). Hint: "Limestone: digging is slow and
   shallow."
1. **"The morning"** (survive 240 s).
   - 40 s: Ariete M13/40s (5) plus 8 Bersaglieri.
   - 150 s: Stukas on the gun pits.
2. **"The afternoon attack"** (survive 360 s).
   - 20 s: banner "Panzers in line abreast!"; 8 Panzer III and IV plus 2 251s plus 10 grenadiers.
   - 180 s: a second wave from the Ariete side.
   - 280 s: the final overrun attempt.
   - Hint: "The 25-pounders over open sights: keep their crews alive."
3. **"Breakout"** (exit: 15 units off the left edge within 180 s). Time dusk, then night.
   - The enemy posture is `advance`.

### Side objectives

- **Fifteen tanks** (+15%).
- **Save the guns**: at least 2 gun pits still alive at the start of phase 3 (+10%).

### Medals

Fixed scoring, plus an exit bonus and a kill bonus. Target casualties 45.

### Music, weather, time

- **Music**: `crusader` (**reused**: the existing Operation Crusader track; desert, dry and sparse with hand
  percussion). Add a prep layer to its sections.
- **Weather and time**: clear, cold desert morning, dust in the afternoon (visibility 0.8 while tanks move); day,
  dusk.

### How a sensible player wins on Normal

1. Shallow scrapes and wire; Boys and 2-pdrs beside the 25-pdrs.
2. Kill the Ariete's tanks first, then mortars on the grenadiers.
3. Stay in cover against the Stukas.
4. Break out in bounds before the box collapses.

Fixed 18 minutes.

---

## Mission 9: Madagascar, Andriamanalina

- **Id** 4009, key `madagascar`. **Date** September to 18 October 1942 (`1942-10-18`). **Place** the Antsirabe to
  Fianarantsoa road, central Madagascar, about 20.0 S, 47.1 E (approximate). **Mode** assault. **Length** about 24
  minutes. **Map** 20,000 wu. **Theatre** `madagascarHighlands`.
- **History**:
  - After Operation Ironclad took Diego Suarez in May 1942, the Vichy governor, Armand Annet, refused to give up the
    rest of the island.
  - In Operation Stream Line Jane, the 22nd East African Brigade (Brigadier W. A. Dimoline: 1/1 KAR, 5 KAR, 1/6 KAR,
    with the 56th (Uganda) Field Battery) landed at Majunga on 10 September and led the advance inland. Tananarive fell
    on 23 September (29 September in one source).
  - The 7th South African Motorised Brigade's armoured cars came south along the road.
  - At Andriamanalina, on 18 October, the KAR won a clear victory; about 800 Vichy troops surrendered. The exact
    location is not confirmed.
  - The Vichy force was about 8,000 men, roughly 6,000 of them Malagasy tirailleurs and many Senegalese. It blew bridges
    and felled trees across the road, and had only a handful of aircraft left.
  - Heavy rain and malaria hampered both sides.
  - An armistice was signed at Ambalavao on 6 November (5 November in some sources).

### Briefing (a company commander, 1/6th King's African Rifles)

1. The French governor will not give up the island, so we are taking it from him one road at a time. The road south
   from the capital climbs through the hills and rice terraces, and every few kilometres they have blown a bridge or
   felled a hundred trees across it and waited behind them with a machine gun and a mountain gun.
2. Their soldiers are Malagasy and Senegalese tirailleurs under French officers, and they fight when they are told to.
   We go round them through the hills, which they do not expect, while the South African armoured cars and our guns hold
   their attention on the road.
3. Today it is Andriamanalina. Get behind their position and close the road south. If we do it properly, they will see
   no sense in fighting on, and the war on this island will not last much longer.

**Objective**: Clear the road blocks, outflank the Vichy position and force its surrender.

### Map and sectors

| x (wu) | Sector | Ground | Structures |
| --- | --- | --- | --- |
| 0 to 2,500 | Start | road, mud | HQ (`tent`) |
| 2,500 to 7,000 | The road and the felled trees | road, forest | road blocks RB1 and RB2 (felled trees: a wire-like structure that also blocks vehicles; the sapper's Clear job and explosives remove it); Vichy MG post PB1 |
| 7,000 to 9,000 | A blown bridge | water (narrow) | bridge 1 (destroyed; a scripted repair in phase 2) |
| 9,000 to 15,000 | The hills and rice terraces | slope, mud | trenches T1 and T2 (Vichy); a 65 mm mountain gun pit G1; capture point P1 (spawn) |
| 15,000 to 20,000 | Andriamanalina position | field | buildings B1 to B3 (highland houses, a church); enemy HQ at 19,850 |

### Forces

- **Player**: 3 sappers; 16 askari; 2 Bren; 2 Vickers; 2 3-inch mortars; 1 Boys; 3 SA armoured cars (`southAfrican`);
  400 Money. Supports: artillery (the Uganda battery's 25-pdrs), smoke; a SAAF bomber (Maryland, from phase 2).
- **Loans**: 4 askari (phase 2); 2 3-inch mortars.
- **Enemy (`vichy`)**:
  - HQ, `incomeMul` 0.7.
  - Start: PB1 (Hotchkiss team); T1 and T2 (8 tirailleurs, 2 FM 24/29 each); G1; the position (14 tirailleurs, 2 FM,
    1 Hotchkiss, 1 75 mm gun pit).
  - Supports: artillery; 1 MS.406 raid (scripted); the Vichy fighter is the `fighter` support with a 300 s cooldown.

### Phases and events

1. **"Road blocks"** (destroy RB1 and RB2). Weather `rain`.
   - Hint: "Sappers clear felled trees; the armoured cars can't pass until they do."
2. **"The bridge"** (reach x 9,000 with 10 units).
   - 120 s: the bridge is repaired (bridge 1 becomes passable).
3. **"Through the hills"** (capture P1).
   - Hint: "Go round them through the terraces while the cars and guns hold their attention."
4. **"Andriamanalina"** (`surrender` when the enemy HQ falls below 40%).
   - On surrender: announce "The garrison surrenders: about eight hundred men lay down their arms. On 6 November the
     armistice is signed at Ambalavao."

### Side objectives

- **Round the flank**: capture P1 before T1 falls (+15%).
- **No armoured car lost** (+10%).

### Medals

Timed: target 24 minutes, target casualties 35.

### Music, weather, time

- **Music**: `madagascar` (new). E-flat minor, 116 BPM. Tropical highlands in the rain: a rolling `hand` drum pattern
  in 3-against-2 accents, a misty string pad, the theme's call on horn answered by strings, with a lighter, hopeful
  colour as the end nears.
- **Weather and time**: tropical rain, mist; day.

### How a sensible player wins on Normal

1. Mortars and Vickers on PB1 while the sappers clear the trees.
2. Armoured cars hold the road; askari through the terraces to P1.
3. Artillery on G1. Close the position from two sides.

Expected 22 to 26 minutes.

---

## Mission 10: El Alamein, Miteiriya Ridge

- **Id** 4010, key `alamein`. **Date** night of 23 to 24 October 1942 (`1942-10-23`). **Place** Miteiriya Ridge,
  Egypt, about 30.83 N, 28.95 E (approximate). **Mode** assault with tanks (the finale). **Length** about 28 minutes.
  **Map** 24,000 wu. **Theatre** `desert` (night).
- **History**:
  - Operation Lightfoot opened at 21:40 on 23 October 1942 with the Eighth Army's great barrage, timed for the light of
    the full moon.
  - The 1st South African Division (Major General Dan Pienaar) attacked Miteiriya Ridge with its 2nd and 3rd Brigades:
    the Natal Mounted Rifles reached their objective at about 23:50, and the Cape Town Highlanders were on the ridge by
    08:00. Its 1st Brigade formed an anti-tank screen.
  - The Axis "Devil's Gardens" minefields held about half a million mines, mostly anti-tank Tellers, up to 8 km deep.
    Sappers cleared lanes for the armour.
  - Facing the South Africans were the German 164th Light Division and the Italian Trento and Bologna Divisions with
    Bersaglieri.
  - Shermans fought for the first time with the British armoured divisions that passed through.
  - About 600 South African casualties by 26 October.
  - Earlier, at First Alamein in July, the South Africans had held the Alamein box itself.

### Briefing (a battalion commander, 1st South African Division)

1. At twenty to ten tonight every gun in the Eighth Army opens fire at once, and at ten we walk forward behind it under
   a full moon. In front of us is the minefield the Germans call a garden: lanes of Teller mines and trip-wires, and
   behind it the Italian and German infantry on Miteiriya Ridge.
2. The sappers go first, sweeping lanes with their detectors and marking them with tape and lamps. The infantry follow
   in the lanes, take the ridge before dawn, and hold it. Behind us come the British armoured divisions, with the new
   American tanks, to pass through our lanes onto the far side.
3. At first light the panzers will come for the ridge. Have the anti-tank guns dug in and the lanes open by then. Two
   years ago we came north from the Union to fight in Africa; this is where we start to finish it.

**Objective**: Clear lanes through the minefields, take Miteiriya Ridge and pass the armour through.

### Map and sectors

| x (wu) | Sector | Ground | Structures |
| --- | --- | --- | --- |
| 0 to 3,000 | Start line | sand | HQ (`tent`); the barrage line |
| 3,000 to 8,000 | The first minefield ("Devil's Garden") | sand | minefields M1 to M3 (dense, AT and AP, `marked: false`); outposts PB1 and PB2 (Italian) |
| 8,000 to 12,000 | No-man's-land and the second belt | sand | minefield M4; trench T1 (Italian, Trento) |
| 12,000 to 16,000 | Miteiriya Ridge | sand, slope (heightBonus 1.08) | trenches T2 and T3 (German 164th Light, Italian Bologna and Bersaglieri); capture point P1 "the ridge" (x 14,500, spawn) |
| 16,000 to 24,000 | Beyond the ridge | sand | Axis armour assembly; enemy HQ at 23,850 |

### Forces

- **Player**: 6 sappers (`southAfrican`, the minefield task force; the Clear job runs at 1.5 times speed with
  detectors); 20 riflemen; 4 Bren; 2 Vickers; 4 3-inch mortars; 4 6-pdr crews (`at`, look `sixPdr`: the 6-pdr has been
  in action since May 1942); 2 Boys; 600 Money. Supports: artillery (the barrage), smoke, SAAF Boston bomber
  (`bomber`), Hurricane (airStrike), recon. `rosterNation`: tank `british`.
- **Loans**: 4 Shermans and 2 Grants (`british`, phase 3, the armour passing through; lookOverrides tank `shermanDesert`
  and `grant`); 2 Crusaders (`lightTank`, `british`, look `crusader`); 4 6-pdr crews.
- **Enemy**:
  - HQ, `incomeMul` 0.8.
  - Start: PB1 and PB2 (Italian outposts, 4 men and 1 Breda each); T1 (8 Trento infantry, 2 Breda, 1 47/32); T2 and T3
    (8 men each: German grenadiers of the 164th, Italian Bersaglieri, MG34s, Pak 38, Pak 40); 2 Flak 88s on the reverse
    slope.
  - Phase 4 counter-attack: Panzer III J, Panzer IV F2 or G, M14/41, Semovente 75/18, grenadiers.
  - Supports: artillery, Stukas (from dawn).

### Phases and events

1. **"The barrage"** (clear a lane through M1 to M3: at least one gap 60 wu wide, made by the Clear job).
   - 0 s: banner "The barrage!"; 8 free barrages from x 3,000 to 12,000 over 120 s. Time night (full moon:
     visibility 0.8, not 0.65).
   - Hint: "Sappers sweep lanes through the mines; units in a cleared lane are safe."
2. **"Through the gardens"** (capture T1).
3. **"Miteiriya Ridge"** (capture P1 before dawn).
   - Phase start: the British armour loans arrive at x 2,000 and need the lane.
   - Dawn at 300 s.
4. **"The panzers come"**: prep 45 s (6-pdr positions, sandbags); hold P1 for 360 s.
   - 30 s: banner "Panzers!"; 4 Panzer III J, 2 Panzer IV, 3 M14/41, 8 grenadiers.
   - 200 s: Semovente 75/18s and a second wave.
   - Stukas at 120 s and 260 s.
   - On success: announce "Miteiriya Ridge is held. Twelve days later the Axis army is in full retreat." The victory
     screen shows the flags of every contingent of the campaign.

### Side objectives

- **Two lanes**: two separate cleared gaps (+10%).
- **The ridge before dawn**: P1 before the 300 s dawn event of phase 3 (+15%).
- **Ten tanks** (+10%).

### Medals

Timed: target 28 minutes, target casualties 60.

### Music, weather, time

- **Music**: `alamein` (**reused**: the existing El Alamein track; desert, dry and sparse with hand percussion). Add a
  prep layer.
- **Weather and time**: clear, full moon; night to dawn to morning; dust when the armour moves.

### How a sensible player wins on Normal

1. All six sappers on one lane first, then a second; infantry wait at the lane mouth.
2. Mortars and the barrage on PB1, PB2 and T1.
3. Take the ridge with riflemen and Brens; 6-pdrs dug in on the crest before dawn.
4. Shermans hull-down on the reverse slope behind them; the Hurricane on the Semoventes.

Expected 26 to 30 minutes.

---

## Summary table

| # | Id | Key | Date | Played as | Mode | Prep | Map wu | Minutes | Target time / casualties | Track |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 4001 | tugArgan | 11 to 15 Aug 1940 | KAR, NRR, Camel Corps | delay (tutorial) | no | 9,000 | 14 | fixed / 18 | tugArgan |
| 2 | 4002 | juba | 17 to 22 Feb 1941 | Gold Coast, Nigeria, SA | special | no | 16,000 | 22 | 22 / 40 | juba |
| 3 | 4003 | keren | Feb to Mar 1941 | Chadian BM3, SDF, Legion | assault | mid (45 s) | 18,000 | 24 | 24 / 45 | keren |
| 4 | 4004 | gojjam | Feb to Apr 1941 | Arbegnoch, 2nd Ethiopian, Frontier Bn | special | no | 16,000 | 22 | 22 / 35 | gojjam |
| 5 | 4005 | colito | 3 to 19 May 1941 | Gold Coast, then KAR | assault | no | 18,000 | 24 | 24 / 45 | colito |
| 6 | 4006 | saio | Jun to Jul 1941 | Force Publique, KAR | special | no | 16,000 | 24 | 24 / 40 | saio |
| 7 | 4007 | gondar | 13 to 27 Nov 1941 | KAR, Pioneers, patriots | assault | no | 22,000 | 26 | 26 / 50 | gondar |
| 8 | 4008 | sidiRezegh | 23 Nov 1941 | 5th SA Brigade | survival, then exit | yes | 12,000 | 18 | fixed / 45 | crusader (reused) |
| 9 | 4009 | madagascar | Sep to Oct 1942 | 22nd EA Brigade, SA cars | assault | no | 20,000 | 24 | 24 / 35 | madagascar |
| 10 | 4010 | alamein | 23 to 24 Oct 1942 | 1st SA Division, British armour | assault, hold | mid (45 s) | 24,000 | 28 | 28 / 60 | alamein (reused) |

New tracks: 8, plus the theme `africaRising` and the map track `africaMap`. Missions 8 to 10 feature tanks. Mission 5
has the African-campaign tank fight in East Africa.
