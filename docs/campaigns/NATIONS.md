# Nations as data

Every nation and faction the four campaigns need, in the `NationDef` / `NationEraDef` shape of `FOUNDATIONS.md`
section 5. Stats are mirrored by role: names, looks, sounds and availability differ, and the signature kinds carry
their own stats with a tested counter. Dates are `YYYY-MM`. Sources are in `HISTORY.md`.

Notes:
- Look ids (headgear, kit, guns, vehicles, aircraft, flags) are art registry keys, to be drawn in code like today's
  `brodie` and `stahlhelm`. Each one costs one small sprite per pose set, and only the looks of the nations in a battle
  are rasterised.
- Speech lines are original. Lines in a language other than English must be checked by a fluent speaker before they
  ship; each is marked [check].

## 1. Symbols: allowed and forbidden

**Allowed** (drawn in code, simple shapes):

| Id | Used by | Design |
| --- | --- | --- |
| `sovietRed` | Soviet | red field, gold hammer and sickle and gold-edged star in the canton |
| `sovietBanner` | Soviet HQ pennant | plain red |
| `sovietColour1942` | Soviet victory flourish | the 1942-pattern regimental colour: red, gold fringe, star, unit number (no portrait) |
| `victoryBanner` | Berlin 10 | red, star above hammer and sickle, white text lines of the 150th Rifle Division |
| `unionJack` | British, the British-led African contingents, Sudan | the Union Flag |
| `balkenkreuz` | German | the plain straight-armed black cross with white edging (as today) |
| `italyKingdom` | Italian | green-white-red vertical tricolour with the red Savoy shield with its white cross on the white band, crown above it |
| `franceTricolour` | Vichy | plain blue-white-red tricolour |
| `freeFrench` | Chadian (Free French) | tricolour with a red Cross of Lorraine on the white band |
| `romania` | Romanian | blue-yellow-red vertical tricolour (plain) |
| `ethiopiaEmpire` | Ethiopian | green-yellow-red horizontal bands with the crowned Lion of Judah holding a cross-staff, in the centre |
| `belgianCongo` | Congolese | blue with a single yellow five-pointed star in the centre |
| `rwaffPalm` | West African pennant | khaki pennant with a green palm tree (the RWAFF's palm badge) |
| `karPennant` | East African pennant | dark green pennant with a plain bugle |
| Vehicle and aircraft marks | all | Soviet red star; British roundels and the 1944 Allied white star; the German plain Balkenkreuz; Italian white recognition crosses and the Savoy cross on the rudder; French and Romanian roundels; SAAF roundels |

**Forbidden** (the equipment test fails on any of these ids, and none may be drawn):

- the swastika in any form, including the Nazi war flag and armbands;
- SS runes and the SS death's head;
- the Nazi party eagle, and any eagle-over-wreath emblem;
- the Italian fasces, Blackshirt (MVSN) badges and the "M" flash;
- the Italian Social Republic's eagle;
- the Vichy francisque;
- Romanian Iron Guard symbols.

The South African national flag of the time (orange-white-blue) was official alongside the Union Flag, but is
strongly tied to the apartheid era. Default: South African units fly the Union Flag. Using the period national flag is
an owner decision.

Units depicted: Blackshirt battalions, SS divisions and Hitler Youth are named only in `HISTORY.md` and, where
unavoidable, in a briefing line as historical fact. In battle, SS formations appear as ordinary German troops with no
SS insignia. **No child soldiers are shown**: Berlin's Volkssturm appear as older men in greatcoats with a plain
armband.

## 2. Roles by nation

`x` = the nation has the role; `-` = it does not; `S` = a signature kind (its own stats and counter).

| Role | Soviet | British | German | Italian | Vichy | Romanian | African contingents |
| --- | --- | --- | --- | --- | --- | --- | --- |
| sapper, rifle, lmg, assault, mortar, sniper, medic, at, commander | x | x | x | x | x | x | x |
| tank | x | x | x | x (M11/39, M13/40) | - | x (R-2) | via British loan |
| lightTank | x | x | x (Pz III E, 38(t)) | x (L3/35) | - | - | x (SA armoured car) |
| heavyTank | x (KV-1, KV-1S, IS-2) | S Firefly (17-pdr) | x (Tiger I, Panther: mission-placed only) | - | - | - | - |
| kingTiger (elite squad) | - | - | S (mid-1944 on, mission-placed) | - | - | - | - |
| apc | x (Universal Carrier from 1942, M3 halftrack from 1943) | x (Universal Carrier, Kangaroo from Aug 1944) | x (Sd.Kfz. 251) | - | - | - | x (Bren carrier, SA) |
| flame | x | x | x | x | - | - | - |
| aaGun | x | x | S (8.8 cm Flak also engages vehicles) | x | x | x | x |
| signature infantry | S conscripts | - | - | S Ascari (E. Africa), S Bersaglieri | S Tirailleurs | - | S Arbegnoch irregulars (Ethiopian) |
| signature call-in | S Katyusha | S Naval Bombardment (coastal missions) | S Nebelwerfer (1941 on), the Stuka | S SM.79 bombing run | S coastal battery (structure) | - | S Patriot Rising (Ethiopian) |

The `heavyTank` kind is trainable only where a nation's era allows it (Soviet KV in 1941 to 1943, IS-2 from April
1944). The German Tiger I and Panther are placed by mission data and may be AI-trainable only in missions that say so.

**Signature counters** (each must hold in the balance tests' matchup table):

| Signature | Counter |
| --- | --- |
| Conscripts (cheap, 5 per order, weaker aim) | LMG and mortar |
| Katyusha (huge area salvo, long cooldown) | spreading out; buildings (explosive x0.7) |
| Firefly (anti-tank gun, Sherman armour) | infantry anti-tank weapons at close range; it is weak against infantry |
| Naval Bombardment (heavy shells, only within the coastal sector) | getting inland |
| King Tiger squad | flanking shots on its rear armour, bombers, the IS-2, massed anti-tank weapons |
| 8.8 cm Flak (engages tanks) | mortars, artillery, infantry assault (it is a static gun crew) |
| Nebelwerfer (salvo, then reveals its position) | counter-battery artillery |
| Ascari (fast, cheap, bayonet charge bonus at close range) | LMG |
| Bersaglieri (fast assault) | LMG, rifles in trenches |
| SM.79 bombing run | AA guns, fighters |
| Tirailleurs | as Ascari |
| Coastal battery | assault infantry, AVRE-style demolition, flamethrowers (it cannot depress onto men nearby) |
| Arbegnoch irregulars (fast, rough-ground experts, no heavy weapons) | LMG, armour |
| Patriot Rising (8 irregulars appear at the forward-most owned point) | as above; long cooldown |

## 3. Soviet Union (`soviet`)

- **Name** "Red Army", adjective "Soviet". **Colours**: tint `#7b7650`, dark `#4f4b31`, UI accent red `#b3261e`.
  **Flag** `sovietRed`; HQ pennant `sovietBanner`.
- **HQ looks** (upgrade stages): rain-cape tent, small zemlyanka (earth-covered dugout), log dugout with three-log roof,
  concrete DOT pillbox.
- **Grenades** `rgd` (RGD-33) in 1941 to 1942, `f1` from 1942.

### Eras

| Era | Headgear | Uniform and kit |
| --- | --- | --- |
| 1941-06 to 1942-12, temperate | SSh-40 and SSh-39 helmets (some SSh-36 in 1941), many in the pilotka side cap | M35 gymnastyorka with turn-down collar, collar tabs (no shoulder boards), greatcoat roll (skatka) over one shoulder, puttees or boots; tankers in the padded tank helmet |
| Winters 1941-42 and 1942-43 | ushanka fur cap, often under the helmet | greatcoat or padded telogreika, valenki felt boots; white snow smocks for ski troops, scouts and snipers |
| 1943-02 to 1945-05 | SSh-40 standard; pilotka in summer, ushanka in winter | M43 gymnastyorka with stand collar and khaki shoulder boards (pogony, mandatory from 1 February 1943); green or brown "amoeba" camouflage suits for scouts, snipers and sappers; the Guards badge on the chest of Guards units; assault engineers in 1944 to 1945 with steel breastplates (SN-42; unverified, use sparingly) |

### Unit names by era

| Role | 1941 | 1942 to 1943 | 1944 to 1945 |
| --- | --- | --- | --- |
| sapper | Sapper | Sapper | Sapper |
| rifle | Rifleman (Mosin) | Rifleman (Mosin) | Rifleman (Mosin) |
| conscript (signature) | Militia (opolchenie) squad | Rifle squad (conscripts) | Rifle squad (conscripts) |
| lmg | DP Gunner | DP Gunner (Maxim teams in defence) | DP Gunner (SG-43 teams from mid-1943) |
| assault | PPD Trooper | PPSh Trooper | PPSh Trooper (PPS-43 in some units) |
| mortar | Mortar Crew (50 mm or 82 mm) | Mortar Crew (82 mm) | Mortar Crew (82 mm; 120 mm in scripted barrages) |
| sniper | Sniper (Mosin with PE scope; SVT-40) | Sniper (Mosin with PU scope) | Sniper (Mosin with PU scope) |
| medic | Sanitarka (many Red Army medics were women) | Sanitarka | Sanitarka |
| at | Tank Hunters (grenade bundles and bottles) until 1941-10; PTRD Team from 1941-11 | PTRD / PTRS Team | PTRS Team; "Trophy Panzerfaust" teams in 1945 (captured Panzerfausts were widely used; verify per mission) |
| flame | ROKS-2 Flamethrower | ROKS-3 Flamethrower | ROKS-3 Flamethrower |
| commander | Lieutenant (TT-33 pistol) | Lieutenant | Captain |
| lightTank | T-26, BT-7 (1941); T-60 from 1941-10 | T-60, T-70 (from mid-1942) | SU-76M (light self-propelled gun) |
| tank | T-34/76 | T-34/76 | T-34/76 until 1944-02; T-34-85 from 1944-03 |
| heavyTank | KV-1, KV-2 (1941 only) | KV-1, KV-1S (from 1942-08) | IS-2 (from 1944-04); ISU-152 as a variant look |
| apc | T-20 Komsomolets armoured tractor (1941; weak, rare) | Universal Carrier (Lend-Lease, 1942) | M3 halftrack (Lend-Lease, 1943) |
| aaGun | 37 mm 61-K | 37 mm 61-K | 37 mm 61-K; DShK on vehicles |

### Supports

| Support | 1941 | 1942 to 1943 | 1944 to 1945 |
| --- | --- | --- | --- |
| artillery | 76 mm and 122 mm guns | ZiS-3 and 122 mm M-30 | heavy 152 mm and 203 mm in scripted barrages |
| smoke | smoke | smoke | smoke |
| katyusha (signature) | BM-13 on ZiS-6 trucks, from 1941-07 | BM-13 | BM-13N on Studebaker trucks (1943 on) |
| airStrike | Il-2 Shturmovik (single-seat) | Il-2 (two-seat from late 1942) | Il-2 |
| bomber | none in June 1941 (air force shattered); Pe-2 from mid-1941 | Pe-2 | Pe-2 |
| fighter | I-16 (June 1941), Yak-1 | Yak-1, La-5 (from Aug 1942) | Yak-9, La-5FN |
| recon | R-5 or Po-2 | Po-2 | Pe-2R |

### Speech (commander)

- Advance: "Forward, comrades!" / "Urra! After me!" / "Up and at them, keep moving!" / "Into them, for the
  Motherland!"
- Hold: "Dig in and hold!" / "This line is ours. Keep it." / "Let them come close. Fire on my word." / "Nobody moves
  back from here."
- Fall Back: "Back to the dugouts, move!" / "Pull back, carry the wounded!" / "Fall back and regroup!" / "Back! We hit
  them again tonight."

## 4. Britain (`british`)

- **Name** "British Army", adjective "British". **Colours**: tint `#8c7b4a`, dark `#5f5331` (as today), UI accent
  `#2f4f7f`. **Flag** `unionJack`. **HQ looks**: today's tent, big tent, timber dugout and concrete bunker. **Grenades**
  `mills`.

### Eras

| Era | Headgear | Uniform and kit |
| --- | --- | --- |
| 1940 to 1942, temperate (legacy) | Mk II Brodie | battledress, 37 pattern webbing |
| 1940 to 1942, desert | Brodie or Wolseley pith helmet early; slouch hat for some | khaki drill shorts and shirts |
| 1944, NW Europe: line infantry | Mk II Brodie with net and scrim; Mk III "turtle" helmet mainly for first-wave assault troops (3rd Division on Sword, the Canadians) | battledress, 37 webbing, leather jerkins |
| 1944: airborne (Pegasus, Merville) | rimless airborne helmet with chin cup | Denison smock; maroon beret off duty |
| 1944: commandos (Sword) | green beret (most commandos landed in berets) | battledress, Bergen packs |
| 1944: tank crews | black beret (Royal Tank Regiment) or regimental berets | coveralls |

### Unit names (1944)

| Role | Name |
| --- | --- |
| sapper | Sapper (RE) |
| rifle | Rifleman (No. 4) |
| lmg | Bren Gunner |
| assault | Sten Section; Para (airborne missions); Commando (Sword) |
| mortar | 3-inch Mortar Team |
| sniper | Sniper (No. 4 (T)) |
| medic | RAMC Orderly |
| at | PIAT Team |
| flame | Lifebuoy Flamethrower |
| commander | Lieutenant (Webley revolver) |
| lightTank | Stuart ("Honey") |
| tank | Sherman (DD on the beaches); Cromwell (7th Armoured: Villers-Bocage); Churchill (31st Tank Brigade: Epsom, Hill 112, Charnwood) |
| heavyTank (signature) | Sherman Firefly (17-pdr) |
| apc | Universal Carrier; Kangaroo (from 1944-08: Falaise) |
| aaGun | Bofors 40 mm |
| mission-only kinds | Churchill AVRE (Petard demolition gun) and Sherman Crab (mine flail), placed by Gold, Sword and Hillman data only |

### Supports

- artillery: 25-pdr field regiment; smoke.
- airStrike: Typhoon rockets (RP-3; Typhoons flew rocket sorties from late 1943).
- bomber: Mitchell (2nd Tactical Air Force medium bombers); the heavy Lancaster and Halifax raids of Charnwood and
  Goodwood are scripted `airRaid` events, not call-ins.
- fighter: Spitfire IX.
- recon: Auster Air Observation Post.
- navalBombardment (signature): HMS Warspite, Ramillies or Arethusa, depending on the mission. Coastal sectors only,
  until about 15 km inland.

### Speech

- Advance: "Right, lads, up and at 'em!" / "Advance! Keep your spacing!" / "Come on, follow me!" / "On your feet, we're
  going in!"
- Hold: "Stand fast. Hold your fire till they're close." / "Dig in, nobody moves." / "Hold this line." / "Steady...
  steady..."
- Fall Back: "Back to the start line, sharpish!" / "Fall back, covering fire!" / "Withdraw by sections, move!" / "Back
  to HQ, we'll have another go."

## 5. Germany (`german`)

- **Name** "German Army", adjective "German". **Colours**: tint `#5d6964`, dark `#3d4643` (as today), UI accent
  `#4a4a4a`. **Flag** `balkenkreuz`. **HQ looks**: tent, big tent, dugout, concrete bunker (as today). **Grenades**
  `stick`.

### Eras

| Era | Headgear | Uniform and kit |
| --- | --- | --- |
| 1939-09 to 1942-05, temperate | M35 or M40 Stahlhelm | field-grey M36 or M40 tunic, rolled sleeves in summer, Y-straps, mess tin and gas-mask canister |
| Winter 1941-42 | helmet over a toque or scarf | greatcoat, improvised blankets and civilian furs (no proper winter clothing) |
| Winter 1942-43 | helmet, toque | greatcoat; reversible padded winter suits (white and grey) for some units |
| 1941 to 1942, desert (Afrika Korps) | Stahlhelm painted sand, peaked tropical field cap, some pith helmets | olive tropical tunic and shorts |
| 1943-07 to 1945 | helmet with chicken wire and foliage (Normandy), M43 field cap | field grey; splinter-pattern camouflage smocks for some units |
| 1945, Berlin | helmet or field cap | Volkssturm: older men in civilian coats or greatcoats with a plain armband |
| King Tiger escort (veteran tag) | helmet with foliage | splinter-camouflage smock, StG 44, Panzerfaust, no SS insignia |

### Unit names by era

| Role | 1939 to 1941 | 1942 to 1943 | 1944 to 1945 |
| --- | --- | --- | --- |
| sapper | Pionier | Pionier | Pionier |
| rifle | Schütze (Kar98k) | Schütze | Grenadier (Kar98k) |
| lmg | MG34 Gunner | MG34 or MG42 Gunner (MG42 from 1942) | MG42 Gunner |
| assault | MP40 Trooper | MP40 Trooper | MP40 Trooper; StG 44 Trooper (veteran tag, from 1943-10) |
| mortar | Granatwerfer Team | Granatwerfer Team | Granatwerfer Team (8 cm, 12 cm) |
| sniper | Scharfschütze | Scharfschütze | Scharfschütze (G43 from late 1943) |
| medic | Sanitäter | Sanitäter | Sanitäter |
| at | Pak 36 Crew (look `pak36`), PzB 39 rifle | Pak 38 or Pak 40 Crew; Panzerknacker (magnetic charge) | Panzerschreck Team (from 1943-11); Panzerfaust (from 1943-10) |
| flame | Flammenwerfer Pionier | Flammenwerfer Pionier | Flammenwerfer Pionier |
| commander | Leutnant (Luger or P38) | Leutnant | Leutnant |
| lightTank | Panzer III Ausf. E (3.7 cm; owner window 1939 to 1941); Panzer II | Pz 38(t) (to late 1942) | none (Hetzer as a `tank` variant look from 1944-07) |
| tank | Panzer III (5 cm from late 1940), Panzer IV (short 7.5 cm), StuG III B (variant look) | Panzer III J/L, Panzer IV F2/G (long 7.5 cm from summer 1942), StuG III F/G | Panzer IV H/J, StuG III G, Hetzer (from 1944-07) |
| heavyTank | none | Tiger I (from 1942-09, mission-placed) | Tiger I; Panther (from 1943-07, Kursk) |
| kingTiger (signature) | none | none | Tiger II, from 1944-07, mission-placed only |
| apc | Sd.Kfz. 251 | Sd.Kfz. 251 | Sd.Kfz. 251 |
| aaGun (signature 8.8 cm) | 2 cm Flak 30/38; 8.8 cm Flak 18/36 | same | 2 cm Flakvierling; 8.8 cm |

**King Tiger look**: ambush camouflage (dark yellow with olive and red-brown patches and light dots); a gold chevron
on the turret side and a pennant on the antenna as the elite marker; plain Balkenkreuz; no SS or party symbol. Its
arrival plays the boss banner and sound (job 7).

### Supports

- artillery: 10.5 cm leFH 18; smoke.
- airStrike: Stuka (Ju 87), 1939 to 1943; Fw 190 fighter-bombers in 1944 to 1945.
- bomber: He 111 (1941 to 1942), Ju 88.
- fighter: Bf 109.
- recon: Fw 189 (Eastern Front: the Soviets called it "the frame"); Fi 156 Storch.
- nebelwerfer (signature): 15 cm Nebelwerfer 41, from 1941-06.

### Speech (short neutral commands, shown with an English gloss in small type) [check]

- Advance: "Vorwärts!" (Forward!) / "Angriff, los!" (Attack, go!) / "Mir nach!" (Follow me!) / "Weiter, weiter!" (Keep
  going!)
- Hold: "Stellung halten!" (Hold the position!) / "Feuer frei auf Kommando!" (Fire on command!) / "Keiner geht
  zurück!" (Nobody falls back!) / "Eingraben!" (Dig in!)
- Fall Back: "Zurück, sammeln!" (Back, regroup!) / "Absetzen!" (Disengage!) / "Zur Stellung zurück!" (Back to the
  position!) / "Rückzug, schnell!" (Retreat, quickly!)

## 6. Italy (`italian`), the Kingdom of Italy's Royal Army

- **Name** "Royal Italian Army", adjective "Italian". **Colours**: tint `#a08e5c` (colonial khaki), dark `#6b5f3b`;
  metropolitan grey-green `#6e6e4e` for missions in Italy (none yet). UI accent `#1f6b3a`. **Flag** `italyKingdom`,
  with no fasces anywhere (vehicles carry white recognition marks; aircraft the Savoy cross on the rudder).
- **HQ looks**: tent, sandbagged ridotto, stone colonial fort, concrete bunker. **Grenades** `srcm` (red SRCM M35).

### Eras and looks

| Era | Who | Headgear | Uniform |
| --- | --- | --- | --- |
| 1940-06 to 1941-11, East Africa | Italian infantry and Granatieri di Savoia | M33 helmet or the khaki colonial pith helmet | khaki drill or sahariana |
| East Africa | Alpini (Uork Amba battalion at Keren) | cappello alpino with a black feather | khaki or grey-green |
| East Africa, North Africa | Bersaglieri | helmet with a plume of black feathers | khaki |
| East Africa | Carabinieri (Kulkaber) | M33 helmet with the flaming-grenade badge | khaki |
| East Africa | Colonial ascari (Eritrean, Somali, Ethiopian) | tall red tarbush with a tassel, and a wide woollen sash, coloured by battalion | khaki |
| East Africa | Somali dubat | white turban | white or khaki wrap |
| 1941-11 to 1942-11, North Africa | Italian infantry; Folgore paratroops at Alamein | M33 helmet painted sand; Folgore with the paratrooper helmet | khaki-tan |

### Unit names

| Role | East Africa 1940 to 1941 | North Africa 1941 to 1942 |
| --- | --- | --- |
| sapper | Genio (sapper) | Genio |
| rifle | Fante (Carcano M91) | Fante |
| ascari (signature, East Africa) | Ascari | none |
| lmg | Breda 30 Gunner (Fiat-Revelli 35 / Breda 37 teams in defence) | Breda 30 Gunner |
| assault | Bersaglieri (signature, fast) or Granatieri assault squad (grenades) | Bersaglieri; Beretta MAB 38 troopers (paratroops) |
| mortar | Brixia 45 mm or 81 mm Mortar Team | 81 mm Mortar Team |
| sniper | Tiratore scelto | Tiratore scelto |
| medic | Portaferiti (stretcher-bearer) | Portaferiti |
| at | 47/32 Gun Crew | 47/32 Gun Crew; Solothurn AT Rifle |
| flame | Lanciafiamme Team | Lanciafiamme Team |
| commander | Tenente (Beretta M1934) | Tenente |
| lightTank | L3/35 Tankette | L3/35, L6/40 |
| tank | M11/39 (East Africa, a few until early 1941) | M13/40, M14/41; Semovente 75/18 (from mid-1942, variant look) |
| aaGun | Breda 20 mm | Breda 20 mm |
| apc | none | none |

### Supports

- artillery: 65/17 and 75/27 guns; 105 mm at Harar and Keren; smoke.
- bomber (signature): SM.79 bombing run (SM.81 and Ca.133 variant looks in East Africa).
- fighter: Fiat CR.42 (CR.32 in East Africa).
- recon: Ro.37.
- airStrike: none in East Africa; in North Africa the German Stuka supports Italian missions where both nations are
  on one side.

### Speech [check]

- Advance: "Avanti!" / "Savoia!" (the Royal Army's traditional battle cry) / "Avanti, ragazzi, con me!" / "All'assalto!"
- Hold: "Tenere la posizione!" / "Nessuno arretra!" / "Fuoco al mio comando!" / "Restate giù e tenete!"
- Fall Back: "Ripiegare!" / "Indietro, raggrupparsi!" / "Ritirata, coprite!" / "Alla ridotta!"

## 7. Vichy France (`vichy`), Madagascar 1942

- **Name** "French Colonial Forces (Vichy)", adjective "Vichy French". **Colours**: tint `#9a8a62`, dark `#62573c`,
  UI accent `#2b3f8c`. **Flag** `franceTricolour` (plain; no francisque). **HQ looks**: tent, sandbags, colonial post
  (whitewashed walls), a coastal casemate.
- **Eras**: one, 1942-05 to 1942-11, tropical.
  - Malagasy and Senegalese tirailleurs: Adrian M26 helmet or the red chéchia; khaki.
  - French colonial infantry: Adrian helmet or the colonial pith helmet.
- **Unit names**: Tirailleur (Lebel or Berthier; signature: tirailleurs come 5 per order, like conscripts) /
  Fusilier-mitrailleur (FM 24/29) / Mitrailleuse Hotchkiss team (defence) / Grenadier (assault) / Mortier Brandt 60 mm
  or 81 mm / Tireur d'élite / Infirmier / anti-tank: 25 mm Hotchkiss Crew (presence in Madagascar unconfirmed: use
  sparingly) / Lieutenant / aaGun: 13.2 mm Hotchkiss (assumed; unverified) / no tanks (sources mention "6 tanks" of
  unknown type and none is described in action, so none are shown).
- **Fixed guns**: the 65 mm mountain gun (confirmed in Madagascar) and the 75 mm mle 1897 as `gunPit` structures
  (pillbox with weapon `fieldGun`); the coastal battery (signature) as a casemate structure.
- **Supports**: artillery (75 mm); fighter MS.406 (a handful left by September 1942); recon and bomber Potez 63.11.
  By the second campaign the Vichy air arm is nearly gone, so its call-ins have long cooldowns.
- **Speech** [check]:
  - Advance: "En avant!" / "À l'attaque!" / "Suivez-moi!" / "Allez, allez!"
  - Hold: "Tenez bon!" / "Personne ne recule!" / "Feu à mon commandement!" / "Restez à couvert!"
  - Fall Back: "Repliez-vous!" / "Décrochez!" / "En arrière, regroupez-vous!" / "Retraite, couvrez-nous!"

## 8. Romania (`romanian`), Stalingrad mission 9 only

- **Name** "Romanian Army". **Colours**: tint `#7a6a47`, dark `#4f442c`. **Flag** `romania`. **HQ look**: dugout.
- **Era** 1942-11, winter: the M1939 Dutch-pattern helmet, khaki-brown uniform, greatcoat, fur caps for some.
- **Units**: Infanterist (ZB vz. 24 or Mannlicher rifle) / ZB vz. 30 Gunner / assault (Orita SMG appeared only later;
  use riflemen with grenades) / 60 mm or 81 mm Mortar / Lunetist (sniper) / Sanitar / anti-tank: 37 mm gun crew
  (Pak 36 or Bofors) / tank: R-2 (Czech-built LT vz. 35; 37 mm) / aaGun: 37 mm.
- **Speech** [check]: "Înainte!" / "Țineți poziția!" / "Înapoi, regrupare!"

## 9. The African contingents (the African campaign's player side)

All use British-pattern small arms and equipment, except the Force Publique, the Free French Chadians and the
Ethiopian patriots. They are separate nations so that one mission can mix them (`rosterNation`) and each looks
right. The African campaign card shows the flags of the contingents (Union Flag, Ethiopian, Belgian Congo, Free French).

Common British-pattern names (1940 to 1942):

| Role | Name |
| --- | --- |
| rifle | Askari / Rifleman (SMLE No. 1 Mk III) |
| lmg | Bren Gunner (Lewis guns in some 1940 units) |
| lmg (defence) | Vickers Team |
| assault | Bayonet Section (grenades) |
| mortar | 3-inch Mortar Team |
| sniper | Marksman |
| medic | Stretcher-bearer |
| at | Boys Anti-tank Rifleman |
| flame | none in East Africa |
| commander | Lieutenant |
| aaGun | Bofors 40 mm (rare; Bren on an AA mount early) |

Artillery: 18-pdr, 4.5-inch howitzer and 25-pdr (South African batteries); 3.7-inch mountain howitzer
(1st East African Light Battery).

| Nation | Who | Headgear and uniform | Notes and signature | Flag |
| --- | --- | --- | --- | --- |
| `eastAfrican` | King's African Rifles (Kenya, Uganda, Tanganyika, Nyasaland), Northern Rhodesia Regiment, Somaliland Camel Corps | KAR: khaki shirt and shorts, a brimmed slouch hat often pinned up on one side in the field, with the red tarbush in some units; NRR: similar; Camel Corps: khaki with a turban | lightTank from `southAfrican` | `unionJack`, pennant `karPennant` |
| `westAfrican` | Royal West African Frontier Force: Nigeria Regiment, Gold Coast Regiment | bush (slouch) hat with the palm-tree badge, khaki drill; the red fez and zouave jacket were parade dress only | 51st Gold Coast Light Battery (artillery look) | `unionJack`, pennant `rwaffPalm` |
| `southAfrican` | Union Defence Force (1st and 2nd SA Divisions, brigades, armoured car companies, SAAF) | 1940 to 1941: Wolseley pith helmet with unit flashes; Brodie steel helmet from 1941; khaki drill; the orange "red tab" on the shoulder straps of volunteers for service outside the Union | signature: Marmon-Herrington armoured car (`lightTank`, with a Boys rifle or 2-pdr and MGs); SAAF call-ins: Hartbees (airStrike), Ju 86 and later Maryland or Boston (bomber), Hurricane and Gladiator (fighter); 1940 light tanks at El Wak | `unionJack` (default; see section 1) |
| `ethiopian` | Arbegnoch (patriot fighters); the 2nd Ethiopian Battalion of Gideon Force | patriots: white shamma (cotton wrap), jodhpur-style trousers, bandoliers, often bare-headed; old and captured rifles of many makes (Gras, Mannlicher, Carcano: unverified mix); 2nd Ethiopian Battalion: khaki, British rifles | signature: Arbegnoch irregulars (fast, 1.0 speed on rock and scrub, an ambush first-volley bonus; no heavy weapons); call-in Patriot Rising | `ethiopiaEmpire` |
| `sudanese` | Sudan Defence Force (Gideon Force's Frontier Battalion) | khaki; headgear unverified (a khaki cap or a turban-style wrap) | Gideon Force had only a few mortars and no artillery | `unionJack` |
| `congolese` | Force Publique of the Belgian Congo | khaki; a red chéchia (fez) is likely but unconfirmed for 1941, so default to a khaki chéchia-shaped cap until checked; Belgian officers in pith helmets | rifles (Mauser types, unverified), Vickers MGs, Stokes mortars (confirmed), later field batteries; no armour | `belgianCongo` |
| `chadian` | Free French Bataillon de marche n° 3 (Chadian tirailleurs), with the Foreign Legion's 13th Demi-Brigade alongside, at Keren | Adrian helmet or chéchia, khaki | French weapons: Lebel or Berthier, FM 24/29, Hotchkiss | `freeFrench` |

African speech (English, with one line in the soldiers' lingua franca) [check]:

- **East African** (Swahili was the KAR's working language):
  - Advance: "Twende! Forward!" / "Advance, keep together!" / "Up, askari, follow me!"
  - Hold: "Hold here, stand firm!" / "Wait for them. Fire on my word."
  - Fall Back: "Back to the boma, move!" / "Fall back, carry the wounded!"
- **West African** (Hausa was widely used in the Nigeria Regiment):
  - Advance: "Forward, Nigeria!" / "Gold Coast, advance!" / "Up and at them!"
  - Hold: "Stand fast!" / "Hold this ridge!"
  - Fall Back: "Fall back by sections!"
- **South African** (English and Afrikaans):
  - Advance: "Vorentoe! Forward!" / "Come on, Springboks!"
  - Hold: "Hou vas! Hold on!" / "Steady, let them come."
  - Fall Back: "Terug! Fall back!" / "Back to the guns!"
- **Ethiopian** (Amharic):
  - Advance: "Wedefit! Forward!" / "For the Emperor, forward!"
  - Hold: "Hold the pass!" / "Wait for my signal!"
  - Fall Back: "Back to the hills!"
- **Congolese** (French; Lingala was the Force Publique's working language):
  - Advance: "En avant, la Force Publique!" / "Forward!"
  - Hold: "Tenez bon!"
  - Fall Back: "Repliez-vous!"
- **Chadian**: as Vichy French, plus "Vive la France libre!" on Advance.

## 10. Data checklist for implementers

For each nation: a `NationDef` in `src/data/nations/<id>.ts`, its flag in `src/art/flags`, the headgear, kit and
vehicle looks it uses in `src/art`, the HQ style stages in `upgradeLooks.ts`, the speech lines, and the
`EQUIPMENT` windows of each look. A nation with no tank (Vichy, the African contingents without a loan) leaves the
kind out of `kinds`. The Armoury still offers the role (buying it unlocks it for every nation that has it).
