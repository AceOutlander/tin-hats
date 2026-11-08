# Work queue (from the owner)

Standing rule (owner, 2026-11-07): push to live yourself whenever a job's checks pass, without waiting, then go
straight on to the next job. Keep working until the usage limit; keep `docs/PROGRESS.md` updated so nothing is lost.
Publishing steps: `CLAUDE.md`, "Push to live".

Order:
1. Per-unit-type orders (in progress 2026-11-07).
2. Quartermaster upgrade looks.
3. Admin panel (spec below).
4. Prep phase for defensive missions.
5. Difficulty overhaul (difficulty levels, army size, performance).
6. Soviet campaign, Part 1 then Part 2.
7. Trench art pass (later job; spec below).

Deferred trench items (from the trench rebuild): climbing in and out, tanks bumping over the pit, splitting big
positions into two or three pits, a coloured band on the sandbags, unit tests for the trench layout, shots of other
theatres.

The owner's specs follow, verbatim.

## 1. Per-unit-type orders

"give an option to make certain unit type either Fall back, hold, or advance. EX: only bren units: hodl!"

## 2. Quartermaster upgrade looks

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

## 3. Admin panel

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

## 4. Prep phase for defensive missions

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

## 5. Difficulty overhaul

"## New difficulty levels
- Recruit (new, easiest): plays like the current Normal, for new players.
- Normal: as hard as the current Insane.
- Hard: close to realistic. Weapons are much deadlier for both sides, accuracy and cover matter more, and attacking in the open is costly.
- Insane: near one-shot lethality. Almost any hit kills infantry for both sides, and the enemy fields armies the size of a real invasion.
- Lethality changes apply equally to both sides, so the harder modes stay fair. Hard and Insane add more enemy troops and better setups on top of that.
## Army size
- The population cap becomes 150 on Recruit, Normal and Hard, and 175 on Insane, for both sides.
- Rebalance the economy (income, costs, training times) so reaching a large army is possible, and update the balance tests and the "reasonable player" bot for each difficulty.
- To make Insane feel like a real invasion, add distant background armies (cheap, non-simulated crowds, vehicles and artillery flashes) and reinforcement waves, rather than only simulating more units.
## Performance
- The game must stay smooth on a mid-range phone with 350 units on the field plus effects. Profile it and optimize: pooling, culling off-screen units, simpler drawing for distant units, and lighter simulation where possible. Add a soak test at full army size on Insane.
- If a phone still can't keep up, add a graphics setting that lowers effects and background detail, not the unit cap."

Decisions already announced to the owner: lethality is a per-difficulty multiplier applied identically to both sides
(unit stats unchanged; this replaces the old "difficulty never changes unit stats" rule); a mission cleared on the old
Normal counts as cleared on Recruit.

## 6. Soviet campaign

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

## 7. Trench art pass (later job)

"the new trenches look crude and need a proper art pass. Problems I see in mission 4:
- The trench looks like an open box floating on the ground instead of a pit cut down into it. The top edge doesn't connect to the ground line.
- There's a blurry slab or shadow under the trench that looks like a glitch.
- The sandbags sit beside the trench instead of along its front lip.
- The flag floats off to the left on its own.
- It still needs the skipped extras: climbing in and out, tanks bumping over, and big positions split into several pits."
