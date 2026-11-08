# Work queue (from the owner)

Standing rule (owner, 2026-11-07): push to live yourself whenever a job's checks pass, without waiting, then go
straight on to the next job. Keep working until the usage limit; keep `docs/PROGRESS.md` updated so nothing is lost.
Publishing steps: `CLAUDE.md`, "Push to live". Near the usage limit: stop at a clean commit, update PROGRESS.md, and
schedule a resume just after the reset.

## Build order (owner, 2026-11-08; replaces every earlier order)

Done and live: per-unit-type orders; population cap 100; Quartermaster upgrade looks (commit 5931976).

1. **Hide enemy unit HP** (owner: "Do the hidden enemy HP first if it isn't done yet"). Enemy units show no health in
   battle; only the Recon plane (job 7) reveals it, in a radius, for a while. No earlier written spec exists; see
   "Hide enemy unit HP" below.
2. **Admin panel** (spec below), so the rest is easier to test.
3. **Rename the resource to Money**: sappers still carry boxes, but every supply label, icon and text becomes money.
4. **Quartermaster upgrade looks**: done and live. The owner's note for any follow-up: "HQ changes are big; all other
   upgrade visuals are small but noticeable."
5. **Unlockable passives** (spec below).
6. **Prep phase for defensive missions** (spec below).
7. **New units** (spec below): APC, flamethrower, commander, bomber, fighter and recon call-ins, anti-aircraft gun.
8. **Music for every mission and the campaign map** (spec below). Owner's additions: "The combat layer kicks in
   during a big battle, meaning 20 or more soldiers per side fighting close together. Not too grim, not too happy,
   exciting."
9. **Difficulty overhaul** (spec below), with a population cap of 100 on every difficulty.
10. **Medals and the Armoury** (spec below).
11. **Campaigns**, in this order: the Part 1 foundations from the Soviet spec first, then Soviet Stalingrad, British
    D-Day (replaces the current British campaign), Soviet Road to Berlin, African. Specs below.
12. **Trench art pass** (spec below).

Later: a French campaign, and a German campaign as DLC.

Deferred trench items (from the trench rebuild), folded into job 12: climbing in and out, tanks bumping over the pit,
splitting big positions into two or three pits, a coloured band on the sandbags, unit tests for the trench layout,
shots of other theatres.

How these decisions fit together (for the implementers):
- Medals (job 10) replace Quartermaster upgrade points and per-mission unit unlocks. Jobs before it keep today's
  upgrade points and unlocks; job 10 migrates saves (points to medals fairly, unlocked units stay unlocked).
- The resource is called Money from job 3 on, in every later job's text and UI.
- Every new unit and nation follows "nations as data" (Soviet Part 1 foundations). Jobs before job 11 build new units
  for Britain and Germany with per-nation names and looks in data, so the Soviet, Italian and other versions are only
  data later.
- The current British campaign is scrapped in job 11 and replaced by British D-Day; its desert and Italy art goes to
  the African campaign.

The owner's specs follow, verbatim.

## Hide enemy unit HP

The owner's only words on it: "Hide enemy unit HP (already requested)" and, under the Recon plane, "reveals enemy unit
health in a large radius for a while (enemy HP is hidden otherwise)". No earlier written spec was found in the docs.
Working reading: in battle, the player never sees enemy units' health (no health pips or bars on German units, tanks,
the boss tank or wave units), while the player's own units keep theirs. The enemy HQ's health bar in the HUD and on
the minimap stays, since it is the mission objective. Pillboxes and other structures are not units and keep their
damage states. The view reads one data flag per side, so the Recon plane and the admin panel can reveal enemy health
later.

## Per-unit-type orders (done)

"give an option to make certain unit type either Fall back, hold, or advance. EX: only bren units: hodl!"

## Quartermaster upgrade looks (done)

"every Quartermaster upgrade should change how things look in battle, not just the numbers.
- HQ health: it starts as a small tent with a low sandbag wall and one machine gunner. Level 1: a bigger tent with more sandbags. Level 2: a fortified HQ with a timber-and-sandbag dugout. Level 3: a full concrete bunker or pillbox HQ.
- HQ machine gun: the gun position grows from one gunner behind sandbags, to a proper emplacement, to a heavier tripod gun, to a fortified nest with a two-man crew.
- Sapper speed and carry: sappers carry bigger loads, then use a handcart, then drive a small supply truck.
- HQ passive income: the supply dump grows from a few crates to stacked crates and fuel drums, then a parked supply truck.
- Unit health and damage upgrades: small visible gear changes on that unit type, like fuller webbing, ammo pouches, helmet netting or a better weapon. They must stay readable at phone size and cost almost nothing to draw with large armies.
- Each nation gets its own version of these looks (for example, a Soviet HQ as a log dugout), defined in data.
- The Quartermaster screen shows a preview of what the next level will look like.
- Existing saves show the right visuals for upgrades already bought.
Run the checks, push to live, and send me screenshots of the HQ at all four stages."

Note: nations as data arrive with the Soviet campaign, so build per-nation looks as data now, filled in for Britain
and Germany; add the Soviet looks (log dugout and so on) in Soviet Part 1.

## Music for every mission and the campaign map (job 8)

"## Mood
- Exciting and driving, cool-sounding, with a grim edge. Not as dark or slow as the menu theme. Think marching snare, low brass, driving strings and timpani, minor keys, a strong rhythm.
- Every mission gets its own track, matched to its setting, and all of them stay original. For example: France 1940 urgent and uncertain; Dunkirk desperate and rushing; the desert dry and sparse with hand percussion; Italy heavier with mountain echo and bells; Normandy big brass and driving snare; Hill 112 heavy and mechanical, like tanks; Arnhem tense like a ticking clock; the Siegfried Line a big final push.
- Give each campaign a short theme that comes back in different forms across its missions, so the British missions sound related. The Soviet campaign will get its own theme later.

## Music that reacts to the battle
- Each track has layers that fade in and out with what's happening: a quieter build-up layer while things are calm, a full combat layer during heavy fighting, a tense layer when my HQ is under threat or a survival timer is close, and a short ending sting for victory or defeat. The prep phase in defensive missions gets its own building-tension layer.
- Change smoothly, never cutting abruptly, and don't flip back and forth every few seconds.
- With 15–30 minute missions, the music must not feel like one loop on repeat: at least 3 minutes of material per track, varied sections, and occasional quiet stretches.

## Campaign map
- A calmer, reflective track between missions: grim but hopeful, somewhere between the menu theme and the battle music.

## Technical
- Synthesize everything in code with the existing music system and no audio files. Each mission's music is chosen in mission data, so new missions just name their track.
- Render a mission's music when that mission loads, not all at once at startup, so phones don't run out of memory. Keep only the current mission's music in memory.
- Music stays on the Music slider and sits under the gunfire and explosions, so the battle stays easy to hear.
- Run the checks, push to live, and tell me which mission to try first."

Notes: the prep-phase layer can only be wired once the prep phase exists (job 4); build the layer and its trigger
hook now and connect it then. Music is measured, never heard: report mix levels against gunfire and explosions.

## Admin panel (job 2)

"## Access
- Hidden entry: tapping the helmet on the title screen 7 times quickly opens a passcode prompt. On a computer, a secret key combination does the same.
- The passcode is "hunterace". Don't store it in plain text in the code or the repo; compare a hash instead. A wrong code just closes the prompt with no hint.
- Once unlocked, a small admin button stays on screen until I lock it again or close the game. Nothing about the panel is visible to normal players.

## What it can do (thumb-friendly, organised in tabs)
- Campaign: unlock all campaigns, nations and missions; jump to any mission and any phase within it; give upgrade points; set any Quartermaster upgrade to any level; reset, export and import the save.
- Battle: set or freeze supplies; infinite supplies; instant training and building; skip or restart the prep phase; win or lose instantly; trigger any scripted event; change difficulty, weather and time of day.
- Units: spawn any unit for either side at a tapped spot, in batches (1, 10, 50); fill the army to the cap; kill, heal or make invincible a selected unit, all units or a whole side; make my HQ or the enemy's invincible; take control of enemy units.
- Speed: pause, plus 0.25x to 8x speed.
- Debug view: FPS and unit counts, weapon ranges, hitboxes, the AI's current plan and orders, and spawn and capture points.

## Rules
- Reuse the existing debug systems, like the debug time-scale, where they already exist.
- The panel must never be visible or reachable for normal players, and it must not break saves.
- Add tests that the passcode works, a wrong code doesn't, and the panel is unreachable without it.
- When it's live, tell me exactly how to open it on my phone."

Notes for the implementer: the repo is public and everything runs in the player's browser, so the hash only hides the
passcode from casual reading; it is not real security (anyone can read the shipped code). That is fine here because the
panel only changes the player's own game in their own browser. Features that depend on later jobs (prep phase,
campaigns and nations, mission phases, scripted events by phase) get wired as those jobs land; build the panel so a tab
can add entries from data. Unlocking must be per session (not saved), and no admin action may write an invalid save.

## Prep phase for defensive missions (job 6)

"- Missions where you have to hold out (survival and hold missions, such as Dunkirk, Arnhem, Brest Fortress, Volokolamsk, the house on the square and the factory district) start with a 1-minute prep phase before the enemy attacks, with a visible countdown. A "Ready" button skips the rest of it.
- During prep, players can place fortifications in their own half of the field, behind the front line:
  - Barbed wire: about 10 seconds.
  - Sandbag wall or foxhole: about 20 seconds.
  - Trench: about 30 seconds, using the new trench design.
  - Tank traps: about 30 seconds.
  - Pillbox: the full 60 seconds.
- Build times depend on how big the job is, and all times and costs live in data. Each build costs supplies.
- Sappers do the building. Each sapper works on one job at a time, so more sappers means more gets built in parallel. Show a progress bar on each build site.
- Builds still unfinished when the attack starts keep going, but the sappers are exposed, and a half-built fortification gives no protection until it's done.
- Placing should work well with thumbs: pick the item, drag a ghost preview onto the ground, see whether the spot is valid, and confirm. It must also be easy to cancel.
- The enemy attacks in waves that test the defences, and the "reasonable player" bot must be able to use the prep phase in balance tests."

## Difficulty overhaul (job 9)

"## New difficulty levels
- Recruit (new, easiest): plays like the current Normal, for new players.
- Normal: as hard as the current Insane.
- Hard: close to realistic. Weapons are much deadlier for both sides, accuracy and cover matter more, and attacking in the open is costly.
- Insane: near one-shot lethality. Almost any hit kills infantry for both sides, and the enemy fields armies the size of a real invasion.
- Lethality changes apply equally to both sides, so the harder modes stay fair. Hard and Insane add more enemy troops and better setups on top of that.
## Army size
- ~~The population cap becomes 150 on Recruit, Normal and Hard, and 175 on Insane, for both sides.~~ **Superseded by the owner (2026-11-08): the population cap is 100 for both sides on every difficulty, permanently.** Insane gets its "real invasion" feel from setups, waves and the non-simulated background armies, not a higher cap.
- Rebalance the economy (income, costs, training times) so reaching a large army is possible, and update the balance tests and the "reasonable player" bot for each difficulty.
- To make Insane feel like a real invasion, add distant background armies (cheap, non-simulated crowds, vehicles and artillery flashes) and reinforcement waves, rather than only simulating more units.
## Performance
- The game must stay smooth on a mid-range phone with ~~350~~ **200** units on the field plus effects (owner, 2026-11-08: scaled to the cap of 100 per side). Profile it and optimize: pooling, culling off-screen units, simpler drawing for distant units, and lighter simulation where possible. Add a soak test at full army size on Insane (100 per side, 200 in total).
- If a phone still can't keep up, add a graphics setting that lowers effects and background detail, not the unit cap."

Decisions already announced to the owner: lethality is a per-difficulty multiplier applied identically to both sides
(unit stats unchanged; this replaces the old "difficulty never changes unit stats" rule); a mission cleared on the old
Normal counts as cleared on Recruit.

## Soviet campaign (job 11: Part 1 foundations, then Stalingrad)

"Next big job: the second campaign, the Soviet campaign from Operation Barbarossa to Stalingrad. Build it in two parts, and run the full checks after each part.

## Part 1: foundations every campaign will use
- Campaign select: a screen to pick a nation's campaign (Britain and the Soviet Union now; France and a later German campaign will be added), each with its own flag, colours, campaign map and progress.
- Nations as data: all nations share the core roles (worker, rifle, machine gun, assault, mortar, sniper, medic, anti-tank, tank) with their own names, looks and period weapons, plus one or two signature units or call-ins each. Keep the core roles balanced against each other, and test that every signature unit has a clear counter.
- Era-correct enemies: each mission's German roster matches its date. For example, Panzer III and IV, and StuG in 1941–42, with no Tigers or Panthers before they appeared.
- The Germans should feel mighty in the Allied campaigns, especially early: more troops, better positions and stronger units through each mission's setup, not by changing core unit stats.
- Long missions: most missions last 15–30 minutes on vast maps (tutorial-style and special missions can be shorter). To keep them from dragging:
  - Maps are split into sectors with different ground (fields, villages, forests, rivers, ruins, factories).
  - Capturable forward positions become new spawn points, so reinforcements don't walk the whole map.
  - Missions come in phases (take a line, hold it against a counter-attack, push on), with scripted events like barrages, tank pushes, air raids and reinforcements, and optional side objectives.
  - Weather and time of day can change mid-mission.
  - A 1x/2x speed button.
  - Mid-mission autosave and resume, so closing the tab doesn't lose progress.
  - A casualty count on the end screen.
- The core loop stays the same. The repetition of trench after trench is part of the realistic feel, and variety comes from setting and events.
- City fighting: ruined buildings that infantry can occupy like trenches and that work like pillboxes against bullets, plus rubble that slows movement. Winter: snow maps where infantry move slower.

## Part 2: the Soviet campaign, June 1941 to February 1943
Soviet signature units: cheap massed conscript infantry and the Katyusha rocket barrage as a call-in, with the T-34 as their tank. Use the Soviet red flag with hammer and sickle.
1. Brest Fortress, June 1941: the invasion begins. Survive inside the fortress as the Germans surround it. Shorter, teaches the basics.
2. Dubno, June 1941: a huge tank counter-attack against a stronger enemy. The goal is to delay them and destroy a set number of tanks, not to win outright.
3. Volokolamsk Highway, November 1941: hold the road to Moscow in the first snow.
4. The Moscow counter-offensive, December 1941: attack through deep snow against an enemy unready for winter.
5. Crossing the Volga, September 1942: land under fire on the Stalingrad riverbank with low supplies and push into the city.
6. Mamayev Kurgan, September 1942: take and hold the hill that overlooks the city, fighting up its slopes.
7. The house on the square, September to November 1942: a small group holds one fortified building against everything the Germans send (inspired by Pavlov's House). Survival mission.
8. The factory district, October 1942: defend the tractor factory and steelworks floor by floor in the ruins.
9. Operation Uranus, November 1942: break out across the open snowy steppe with tanks and encircle the Germans.
10. Operation Ring, January 1943: crush the encircled German army in the frozen ruins. It ends when they surrender in February.
Each mission gets a short briefing and a campaign map location. Check the historical details (dates, places, which units and weapons were there) before writing briefings and setups.

## Rules
- Work through both parts without stopping to check with me, and log your decisions in docs/DECISIONS.md.
- Update the balance tests for the new nations and missions. Every Soviet mission must be winnable by the "reasonable player" bot on Normal.
- Run the full checks after each part, then push to live and send me screenshots of the campaign select screen and one Stalingrad mission."

## Trench art pass (job 12)

"the new trenches look crude and need a proper art pass. Problems I see in mission 4:
- The trench looks like an open box floating on the ground instead of a pit cut down into it. The top edge doesn't connect to the ground line.
- There's a blurry slab or shadow under the trench that looks like a glitch.
- The sandbags sit beside the trench instead of along its front lip.
- The flag floats off to the left on its own.
- It still needs the skipped extras: climbing in and out, tanks bumping over, and big positions split into several pits."

## Rename the resource to Money

"Rename the resource to Money: sappers still carry boxes, but every supply label, icon and text becomes money."

## Unlockable passives

"- Unlockable badges that give a small, always-on bonus and have no visuals in battle. They show as badges in the Quartermaster screen.
- Unlocked through milestones: finishing missions or campaigns, or challenges like winning without losing your HQ's health.
- Only a few can be equipped at once (start with 3 slots), so they don't break balance. All values live in data.
- Examples: Motorized (faster training), Supply Lines (more money income), Entrenching Tools (faster building in the prep phase), Field Kitchens (faster healing near HQ), Radio Net (shorter call-in cooldowns)."

## New units

"(all nations, with their own names and looks; every one needs a clear counter in the balance tests)
- APC: machine gun only, faster than tanks, armoured against bullets, and carries one squad of infantry to the front.
- Flamethrower: short range, deadly against trenches and pillboxes and flushes out the troops inside. If hit from behind, the fuel tank ignites and he dies instantly. Countered by machine guns and snipers at range.
- Commander: pistol or revolver, fragile. Nearby friendly soldiers deal 5% more damage. One per army at a time, and the bonus doesn't stack. When I give Attack, Hold or Fall Back, he shows a short text speech bubble with a fitting line (several lines per order, per nation) with a short sound cue, no voice audio.
- Planes, as paid call-ins with cooldowns that fly across the battle:
  - Bomber: a bombing run over a large area.
  - Fighter: strafes a chosen area.
  - Recon plane: reveals enemy unit health in a large radius for a while (enemy HP is hidden otherwise).
- Anti-aircraft gun: both sides, so planes can be shot down or driven off."

## Medals and the Armoury

"## Medals: buy troops instead of unlocking them per mission
- Units are no longer unlocked by reaching a mission. Players buy them with medals in a new Armoury screen. Riflemen and sappers are free from the start.
- Medals are earned by beating missions, based on score: completion time and my own casualties, compared against each mission's own target time and casualty count (in data). A rough clear earns about 10 medals, a perfect one about 100.
- Survival missions have a fixed length, so they score on casualties and HQ health instead of time.
- Harder difficulties pay more medals (multipliers in data).
- Each time I beat the same mission again, it pays 50% fewer medals than the previous win: the score-based amount × 100% on the first win, 50% on the second, 25% on the third, and so on, rounded down. Track wins per mission and difficulty, so beating it on a harder difficulty for the first time pays in full. Show "Replay: 50% medals" or similar on the mission screen before I start.
- Buying a unit type unlocks it for every nation, each with its own version.
- No mission can become impossible: if a mission needs a unit type I haven't bought (for example anti-tank against tanks), I get a few of them on loan for that mission only, and the briefing says so.
- Quartermaster upgrade points are replaced by medals, so medals buy both troops and upgrades. Existing saves convert their upgrade points to medals fairly, and units already unlocked stay unlocked.
- Show medals earned and the score breakdown on the victory screen.
- The admin panel can give and remove medals.
- Balance tests: the "reasonable player" bot must be able to afford a sensible army progression across a campaign on Normal without replaying."

## Campaigns (2026-11-08 list)

"## Campaigns (10 missions each; the last few generally feature tanks; era-correct units and equipment; check the history before writing briefings)
- Every side gets its own period-accurate uniforms, helmets and headgear, defined in data.
- Soviet, Stalingrad: as already specced.
- British, D-Day: replaces the current British campaign, whose 10 missions are scrapped. Reuse their backdrops and features where useful (the desert and Italy art can go to the African campaign). Migrate saves cleanly: earned medals and passives stay. Update the Tin Hats card text on hunteracedev.com to match.
  1. Pegasus Bridge, night of 5–6 June 1944: a glider assault to seize the bridges. Shorter, and teaches the basics as the new tutorial.
  2. Merville Battery: paratroopers knock out the coastal guns before the landings.
  3. Gold Beach: land under fire and break through the beach defences.
  4. Sword Beach: push inland from the beach.
  5. The Hillman strongpoint: a heavily fortified bunker complex.
  6. Villers-Bocage, 13 June: a fight against Tiger tanks in a Norman town.
  7. Operation Epsom and Hill 112, late June.
  8. Operation Charnwood: the assault on Caen, July.
  9. Operation Goodwood: a huge armoured attack, July.
  10. Closing the Falaise Pocket, August: the final push.
- Soviet, Road to Berlin, 1943–45 (Soviet heavy tanks like the IS-2 appear late; the Germans field Tigers, Panthers and King Tigers where historically accurate):
  1. Kursk, the northern shoulder, July 1943: hold deep defensive lines against a massive tank attack. A defensive mission with prep phase.
  2. Prokhorovka, 12 July 1943: a huge tank battle.
  3. Crossing the Dnieper, autumn 1943: a river assault under fire.
  4. Operation Bagration, June 1944: break through and race forward.
  5. The Vistula–Oder offensive, January 1945: a fast winter advance.
  6. The Oder bridgehead, early 1945: hold a bridgehead across the river.
  7. The Seelow Heights, April 1945: storm fortified heights at night under searchlights.
  8. Into Berlin: the outer districts and the Spree.
  9. The Moltke Bridge, late April: cross into the government quarter.
  10. The Reichstag, 30 April to 2 May 1945: the final assault, ending with the red flag raised.
- African: you play African units of the time, including the King's African Rifles, the Royal West African Frontier Force (Nigeria, Gold Coast), South African forces, Ethiopian patriot fighters and the Belgian Congo's Force Publique. The main enemy is the Italian army, a new enemy faction with the Kingdom of Italy's flag and no fascist symbols. Add Vichy French for Madagascar and Germans only where historically accurate (North Africa). Pick 10 battles from the East African campaign (such as Keren, Saïo, Gondar and the liberation of Ethiopia), Madagascar and North Africa (such as El Alamein), and check the history first."
