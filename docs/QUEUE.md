# Work queue (from the owner)

Standing rule (owner, 2026-11-07): push to live yourself whenever a job's checks pass, without waiting, then go
straight on to the next job. Keep working until the usage limit; keep `docs/PROGRESS.md` updated so nothing is lost.
Publishing steps: `CLAUDE.md`, "Push to live". Near the usage limit: stop at a clean commit, update PROGRESS.md, and
schedule a resume just after the reset.

## Current order (owner, 2026-11-08, latest; overrides the build order below where they differ)

"1. Finish the lag fixes and the playtest fixes, and push them live.
2. Then the admin panel.
3. Then Stalingrad fully, including what its missions depend on: the switch to Money and the prep phase for its
   defensive missions. Build those as part of Stalingrad. It still stays off the live site until it's 100% done and I
   say push.
The campaign map theme is nearly done, so let it finish alongside. Passives, the difficulty overhaul and everything
else come after Stalingrad."

Done and live since the build order below was written: barbed wire end-on, job 7 new units, job 10 medals and the
Armoury (Armoury prices raised: old types x2, new types x3). Notes: the Money rename (job 3) and the prep phase (job 6)
are now built on the `stalingrad` branch and go live with Stalingrad. Queued for later (specs below): smarter medics;
the later Panzer III and the Maus; deeper performance work (low priority, the lag was mostly the owner's computer).

## DONE (v0.12.0): units unlocked by missions again (owner, 2026-11-09; DECISIONS 280)

"Change of design: soldiers are unlocked by mission progress again, not bought with medals. The medal prices for units are too high and unbalanced.
- Each mission unlocks its unit types as before (the mission data says which). Once a unit type is unlocked, I can use it in every mission, including replays of earlier missions and other campaigns, each mission using my nation's version for that era.
- Remove unit buying from the Armoury. Medals now buy only upgrades and the Poland unlock. Re-check that upgrade prices are reasonable for what a player earns per mission, and tell me what you set.
- Saves keep every unit already bought or unlocked, and refund medals spent on units.
- Keep the "NEW UNIT" briefing cards and the in-battle "New:" hints, since they're correct again, but only for units actually unlocked by that mission. Ignore my earlier request to remove them.
- If mission 1 of a campaign would leave players with too few unit types, let each campaign start with sappers, riflemen and one or two basics.
- Do this now if it fits before my usage limit; otherwise do it first after the reset, before Stalingrad, since Stalingrad's unlock order depends on it. Update the balance tests."

Notes: this supersedes the "Next bug fix" below (the Intel panel and removing the NEW cards / "New:" hints are dropped;
keep the cards and hints for units that mission actually unlocks). Open questions to settle and report: what plane
call-ins are (mission unlocks like units, or still bought with medals; they are not soldiers, so keeping them in the
Armoury is the conservative reading, say so); medals spent on units are refunded at the price paid (save migration
with a version bump); the automatic loans (MEDALS.autoLoanCount) and loans in general become unnecessary for unlocked
types: keep loans only where a mission needs a type the player cannot have unlocked yet. Upgrade prices: the earn rate
is 3 to 30 medals a win (x1.5 Hard, x2.25 Insane, halved per replay); today an upgrade level costs
UPGRADE_MEDALS_PER_LEVEL = 20; check with the balance bot what a first campaign run earns and price levels so a
sensible set of upgrades is affordable. The admin panel (branch admin-panel) has an "unlock all" action: keep it working.

## Next bug fix: briefing Intel panel and first-use tips (owner, 2026-11-08; next free job slot, before Stalingrad; push with the next update)

"Bug: mission briefings still show "NEW UNIT" and "NEW SUPPORT" cards (for example Medic and Smoke Screen at Monte Cassino), left over from the old per-mission unlocks. Units now come only from the Armoury.
- Remove those cards. Replace them with a useful "Intel" panel: what the enemy is expected to field (for example pillboxes, machine-gun nests, tanks), plus recommended unit types to bring. Mark recommended types I haven't bought yet, and any I'll get on loan for this mission.
- Make sure no briefing text talks about units being newly unlocked or arriving because of the mission. That applies to the Stalingrad and Basic Training briefings being written now, and all future campaigns.
- Push the fix with the next update."

"Also: in-battle hints still announce things as "New:" (for example "New: Smoke Screen..." at Monte Cassino). Remove the per-mission "New:" hints. How-to tips now belong in Basic Training. Outside the tutorial, show a short tip only the first time I use a unit or call-in I've bought, in whatever mission that happens, then never again. Add a "Reset tips" option in Settings."

Notes: MissionDef.newUnit/newSupport (schema, m01-m10, campaignView, briefing.ts, tutorial.ts, TUTORIAL.newUnit/newSupport,
debug, matchup) go; mission hint events whose text starts "New:" (m04, m05, m06, others) go, and briefing prose like m10's
"The Typhoon Air Strike is now available" is rewritten. Intel comes from mission data (pillboxes, trenches, wire, the
enemy roster and waves) and MEDALS.missions[id].expects, marked against the save (not bought, on loan via missionRoster).
First-use tips are keyed by type in TipMemory (tinhats.tips) and fire when a bought type is first trained or called in;
Settings already clears tips somewhere (app.ts tips.clear): make it a clearly labelled "Reset tips" button. Add a rule to
docs/AGENT_GUIDE.md and the campaign docs: briefings never say a unit is newly unlocked or arrives because of the
mission. Tests: no mission text or hint contains "New:" or "now available"; the Intel panel marks not-bought and
on-loan types; a first-use tip shows once per type across missions; Reset tips brings them back.

## Build order (owner, 2026-11-08; superseded in part by the current order above)

Done and live: per-unit-type orders; population cap 100; Quartermaster upgrade looks (commit 5931976).

Done and live: music for every mission and the campaign map (job 8, moved to the front by the owner on 2026-11-08;
commit 771aaf2, live 2026-11-08 10:14). Its skipped checks were run with the blood job: test:balance 191/191 and the menu,
audio and smoke browser specs 18/18 (after adding the battleMusic hook to the smoke test's list of debug hooks).

Done and live: **minor blood** with a Show blood setting (commit c737d59, live 2026-11-08 10:58).
Done and live: job 1, **hide enemy unit HP** (commit eac9581, live 2026-11-08).
Next: the small **barbed wire end-on** job (spec below), then (owner, 2026-11-08) **job 7, new units** (APC,
flamethrower, commander with text speech bubbles, bomber, fighter and recon planes, anti-aircraft gun, Panzer III
Ausf. E, King Tiger elite squad), then **job 10, medals and the Armoury** (with the 50%-per-replay rule and Quartermaster
points folded into medals; the Armoury sells the new units). Then the rest in order: 2 admin panel, 3 Money, 5 passives,
6 prep phase, 9 difficulty overhaul (4 is done). Each goes live as it finishes. Then **Stalingrad** (owner, 2026-11-08): the Part 1 foundations plus the Soviet Stalingrad
campaign, built on the git branch `stalingrad` (or kept fully hidden) so other updates can still be published. It stays
off the live site until it is 100% done: all 10 missions, briefings, music, balance tests and checks passing. The Stalingrad release also removes the 10 placeholder British missions and
adds the standalone "Basic Training" tutorial (both specs below), all on the `stalingrad` branch. Then tell
the owner it is ready and **wait for the owner to say when to push it live**. (The iPhone rendering bug moved to after all the campaigns, owner
2026-11-08.)

1. **Hide enemy unit HP** (done and live, commit eac9581) (owner: "Do the hidden enemy HP first if it isn't done yet"). Enemy units show no health in
   battle; only the Recon plane (job 7) reveals it, in a radius, for a while. No earlier written spec exists; see
   "Hide enemy unit HP" below.
2. **Admin panel** (spec below), so the rest is easier to test.
3. **Rename the resource to Money**: sappers still carry boxes, but every supply label, icon and text becomes money.
4. **Quartermaster upgrade looks**: done and live. The owner's note for any follow-up: "HQ changes are big; all other
   upgrade visuals are small but noticeable."
5. **Unlockable passives** (spec below).
6. **Prep phase for defensive missions** (spec below).
7. **New units** (spec below): APC, flamethrower, commander, bomber, fighter and recon call-ins, anti-aircraft gun,
   and two new German tanks (Panzer III Ausf. E for 1939–41, the elite King Tiger squad from mid-1944).
8. **Music for every mission and the campaign map** (spec below). Owner's additions: "The combat layer kicks in
   during a big battle, meaning 20 or more soldiers per side fighting close together. Not too grim, not too happy,
   exciting."
9. **Difficulty overhaul** (spec below): three levels named Normal, Specialized and Elite (owner, 2026-11-08), with a
   population cap of 100 on every difficulty. Insane: same income and cap as
   the player, made hard by a much smarter, human-like AI (owner, 2026-11-08).
10. **Medals and the Armoury** (spec below).
11. **Campaigns** (music: reuse fitting tracks, compose new ones for the rest; Soviet tracks sound cold), in this order: the Part 1 foundations from the Soviet spec first, then Soviet Stalingrad, British
    D-Day (replaces the current British campaign), Soviet Road to Berlin, African. Specs below.
12. **Trench art pass** (spec below).

Later: a French campaign, and a German campaign as DLC. After all the campaigns: the iPhone rendering bug (spec below). Then publishing on Google Play (spec below). Very last: the paid add-ons, the Battle for Poland ($5.99) and the Cavalier unit ($2.99), Google Play app only (specs at
the end; the store plan comes first, and no payment code or paid content goes into the public repo until the owner
picks a store).

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

## The current missions are placeholders (owner, 2026-11-08; part of the Stalingrad release)

"## The current missions are placeholders
- The 10 current British missions are placeholders. When Stalingrad goes live, delete them completely: missions, briefings, campaign map entries and their tests. Campaigns are the main game.
- Keep anything reusable from them (backdrops, music tracks, mechanics) for the new campaigns, as planned.
- Players keep earned medals, bought units, upgrades and passives when the placeholders are removed.
- When Stalingrad goes live, update the Tin Hats card text on hunteracedev.com so it describes the game as a whole instead of the old British campaign."

Notes: do the removal on the `stalingrad` branch so it ships with Stalingrad. The save migration keeps medals, Armoury
purchases, upgrades and passives and drops (or archives in a `legacy` block) the old missions' progress; the balance
tests and browser specs that loop over the old missions move to the new campaigns. This replaces the earlier plan to keep
the old British campaign until D-Day replaces it.

Status: done on `stalingrad-core` (DECISIONS 303 to 308, docs/campaigns/STALINGRAD_BUILD.md). The hunteracedev.com card
text waits for the push to live.

## Separate tutorial: "Basic Training" (owner, 2026-11-08; ships with Stalingrad)

"## Separate tutorial ("Basic Training")
- A standalone tutorial on the main menu, separate from all campaigns. It's offered on first launch, skippable, and replayable anytime.
- Set on a training ground with practice targets and a weak mock enemy, taking about 5–10 minutes, step by step, with short on-screen prompts.
- It teaches: money and sappers, training units, the three army orders and per-unit-type orders, direct control, trenches and cover, call-ins, building in a prep phase, and the medals, Armoury and Quartermaster screens.
- Finishing it once pays a small one-time medal reward, so new players can buy their first unit.
- Build it on the Stalingrad branch so it goes live together with Stalingrad. Pegasus Bridge in the D-Day campaign becomes a normal mission, no longer a tutorial."

Notes: it replaces today's mission 1 tutorial steps (src/data/tutorial.ts) and reuses that step engine; it needs the
prep phase, per-unit orders, medals and Armoury to exist first, which the queue order already gives.


## Barbed wire drawn end-on (done and live, commit 5e85113)

Built as DECISIONS 253: end-on pieces (`WIRE_LAYOUT`, `src/art/structures/wire.ts`), the struggle gait (`FIGURE_WIRE`), the tank crush (`src/render/wireRules.ts`); the Germany dragon's teeth are end-on clusters now. Trench note for job 12 in DECISIONS 253.

"Small job, right after the current one: the barbed wire is drawn wrong, same problem as the trenches. It shows as long horizontal strips lying along the ground, as if seen from above.

Fix:
- A barbed wire obstacle runs across the battlefield, into the screen, so draw it end-on: a short, tall cross-section of coiled concertina wire on two or three crossed wooden posts. It's narrow left to right and about waist to chest high on a soldier, standing up from the ground line.
- Infantry visibly slow down and struggle through it, as the slow effect already works. Tanks crush it flat. Gameplay values stay the same.

General art rule (add to docs/AGENT_GUIDE.md and apply it now): the game is a side view, and every obstacle or fortification that forms a line across the battlefield (wire, trenches, tank traps, sandbag walls, anything built in the prep phase) must be drawn end-on, as a narrow cross-section standing on or cut into the ground line, never as a long strip lying along the ground. Check every existing obstacle against this rule and fix any that break it.

Run the related checks, push to live, and send me a screenshot of the new wire next to a soldier."

Note: the art rule is already in docs/AGENT_GUIDE.md (added 2026-11-08). The trench art pass (job 12) follows the same
rule.

## Minor blood (done and live, commit c737d59)

"Small job, do it right after the music is live: add minor, non-graphic blood.
- When a soldier dies from gunfire, a small dark-red pool slowly spreads under the body over about a second. It stays small and simple, with no splatter, gore or dismemberment.
- The pool fades out together with the body when the body disappears.
- No blood for vehicles or buildings.
- Pool the blood decals and cap how many exist at once, so big battles stay smooth.
- Add a "Show blood" toggle in Settings, on by default. When it's off, no blood appears at all.
- Run the related checks and push to live."

## iPhone rendering bug (after all the campaigns, before the Google Play publishing work)

"## iPhone rendering bug
On iPhone, soldiers, buildings and other details don't render. Reproduce it with the Safari engine (Playwright WebKit with iPhone emulation), find the cause (for example a graphics feature or shader iOS Safari doesn't support), fix it with a fallback that works on every browser, and add a WebKit browser test so it can't break again. Add a renderer info readout to the admin panel's debug tab so I can check it on my own iPhone.
Do this right after the current job. (If I tell you otherwise, move it to just before publishing.)"

Notes for the implementer: the admin panel (job 2) comes after this, so put the renderer info (renderer type, WebGL
version, GPU and driver strings where exposed, max texture size and units, the texture atlas sizes in use, device pixel
ratio, quality level) behind the existing `?debug=1` hooks now, and the admin panel's debug tab shows the same readout
when it is built. Playwright's WebKit build must be installed into `.tools` (it is not yet); headless WebKit on Windows
is not iOS Safari, so if the bug does not reproduce there, also check the likely iOS limits directly (texture size over
4096, texture units, float or depth textures, MSAA, non-power-of-two textures, the atlas page sizes) and pick the
fallback from that.

## Hide enemy unit HP (done and live, commit eac9581)

Built as the working reading below (DECISIONS 252): `src/render/hpReveal.ts`, data `RENDER.hpReveal`
(`revealOwnHp: true`, `revealEnemyHp: false`). For the Recon plane (job 7) and the admin panel (job 2):
`view.hpReveal.revealEnemy(x, radius, seconds)` reveals an area for a while (battle time), `setEnemyShown(on)` the
whole side. Debug: `__TH.hpPips()`, `__TH.revealEnemyHp(on)`. For job 9: the smarter AI must not use the player's
hidden HP display, and should not gain "sees enemy health" behaviour unless it flies a recon plane of its own.

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

Note (job 1, hidden enemy HP): the AI must not use hidden enemy HP unless it uses a recon plane (DECISIONS 252).

"## New difficulty levels
- Recruit (new, easiest): plays like the current Normal, for new players.
- Normal: as hard as the current Insane.
- Hard: close to realistic. Weapons are much deadlier for both sides, accuracy and cover matter more, and attacking in the open is costly.
- Insane: near one-shot lethality. Almost any hit kills infantry for both sides~~, and the enemy fields armies the size of a real invasion~~. (The invasion-sized armies are superseded 2026-11-08; the lethality stays. See "Insane: same income" below.)
- Lethality changes apply equally to both sides, so the harder modes stay fair. ~~Hard and Insane add more enemy troops and better setups on top of that.~~ (For Insane, superseded 2026-11-08: same income and cap as the player, smarter AI instead.)
## Army size
- ~~The population cap becomes 150 on Recruit, Normal and Hard, and 175 on Insane, for both sides.~~ **Superseded by the owner (2026-11-08): the population cap is 100 for both sides on every difficulty, permanently.** Insane gets its difficulty from a smarter AI (see "Insane: same income" below).
- Rebalance the economy (income, costs, training times) so reaching a large army is possible, and update the balance tests and the "reasonable player" bot for each difficulty.
- ~~To make Insane feel like a real invasion, add distant background armies (cheap, non-simulated crowds, vehicles and artillery flashes) and reinforcement waves, rather than only simulating more units.~~ (superseded 2026-11-08, see "Insane: same income" below)
## Performance
- The game must stay smooth on a mid-range phone with ~~350~~ **200** units on the field plus effects (owner, 2026-11-08: scaled to the cap of 100 per side). Profile it and optimize: pooling, culling off-screen units, simpler drawing for distant units, and lighter simulation where possible. Add a soak test at full army size on Insane (100 per side, 200 in total).
- If a phone still can't keep up, add a graphics setting that lowers effects and background detail, not the unit cap."

Decisions already announced to the owner: lethality is a per-difficulty multiplier applied identically to both sides
(unit stats unchanged; this replaces the old "difficulty never changes unit stats" rule); a mission cleared on the old
Normal counts as cleared on Recruit.

### Difficulty names and levels: Normal, Specialized, Elite (owner, 2026-11-08; replaces the earlier spec where they differ)

"## Difficulty names and levels: Normal, Specialized, Elite
- Normal: as hard as the current Insane. The AI is decent.
- Specialized: close to realistic. Weapons are much deadlier for both sides, cover and accuracy matter more, and the AI is good.
- Elite: one shot, one kill. Any hit kills a soldier, for both sides. Vehicles, pillboxes and HQs keep their normal toughness against the right weapons. The enemy has the same income and population cap as me, and difficulty comes from the expert AI using real tactics, as specced earlier.
- Drop Recruit, so there are three levels. The cap is 100 for all of them.
- On Elite, every enemy unit looks visibly elite: extra gear and ammo, camouflage, a veteran or elite marker and a tougher-looking build, readable at phone size and cheap to draw. No SS or Nazi symbols.
- Rename everywhere: menus, settings, saves, the mission screen, medal multipliers and tests. Existing saves map old levels to the new ones fairly."

How this reads against the earlier difficulty spec above: Recruit is dropped; "Hard" becomes Specialized; "Insane" becomes
Elite, where infantry die to any hit (one shot, one kill) instead of near one-shot lethality, while vehicles, pillboxes
and HQs keep their normal toughness against the right weapons. Elite keeps the "same income and cap as the player,
smarter AI" rules and the expert human-like AI from "Insane: same income, much smarter enemy" (read "Insane" there as
Elite, "Hard" as Specialized). The tests in that section map the same way: the Elite AI must beat the Normal AI in most
equal-income AI battles; an expert-player bot must win every mission on Elite at least some of the time; Specialized and
Normal must stay comfortably beatable by the reasonable-player bot. Internal ids: rename 'normal' / 'hard' / 'insane' to
'normal' / 'specialized' / 'elite' in data, saves (with a migration), medal multipliers (job 10 ships first with the old
ids; this job renames them) and tests. Fair save mapping, to be finalised in the job: today's normal clears map to the
new Normal (the new Normal is harder, so nothing is lost), hard to Specialized and insane to Elite, with medal history
kept per mission.

### Insane: same income, much smarter enemy (owner, 2026-11-08; replaces the earlier Insane notes above)

"## Insane: same income, much smarter enemy
- On Insane, the enemy gets exactly the same income and population cap as me. No extra money and no bigger army. The near one-shot lethality for both sides stays. Drop the invasion-sized armies idea for Insane.
- Difficulty comes from intelligence. The Insane AI uses real military tactics:
  - Combined arms: infantry screen tanks, anti-tank teams follow behind the armour, and machine guns cover advances.
  - Fire and movement: one group suppresses while another advances, so it never charges everything at once.
  - Preparation before an assault: artillery, mortars or smoke first, then the attack.
  - Defence in depth: it holds reserves back for counter-attacks and pulls back to regroup when a push fails, instead of fighting to the last man.
  - Priority targets: it focuses machine gunners, mortars, commanders and anti-tank teams.
  - Timing: it attacks when I overextend, retreat or spend heavily, and it scouts and reacts to what I build.
  - The right tools: flamethrowers and grenades for trenches and pillboxes, anti-tank weapons against tanks, anti-aircraft guns when I use planes.
  - Smart economy: it balances sappers, units and upgrades sensibly over the mission.
- It plays like a human:
  - It uses the same controls I have: army orders, per-unit-type orders and direct control of one unit.
  - It has human-like reaction times and limits on how many actions it takes, with no instant, perfect reactions.
  - It only knows what I could know: no reading my units' hidden HP unless it uses a recon plane.
  - It makes occasional small mistakes, so it doesn't feel robotic.
- Lower difficulties use the same AI with weaker settings: Recruit is clumsy, Normal is decent, Hard is good, Insane is expert.
- Tests: the Insane AI must beat the Normal AI in most AI-versus-AI battles with equal income. An "expert player" bot must still win every mission on Insane at least some of the time, so it's never impossible. Hard and Normal must stay comfortably beatable by the "reasonable player" bot."

Superseded by this: the invasion-sized enemy armies, extra enemy troops and the non-simulated background armies for
Insane (lines struck through above), and extra AI income or population on Insane. The owner's earlier lines on Recruit,
Normal, Hard, symmetric lethality and performance still stand.

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

## Smarter medics (owner, 2026-11-08; not urgent)

"- Medics automatically look for wounded friendly soldiers nearby, go to the one in most need (lowest health first), and heal them, then move on to the next.
- They don't run past the front line or into the open toward the enemy just to reach someone. They stay with their army's current order: on Hold they move along their own line, on Advance they follow behind the push, and on Fall Back they retreat with everyone.
- Several medics don't all go for the same soldier.
- When I take direct control of a medic, the automatic behaviour pauses.
- Add a test that a medic picks the most wounded nearby soldier and heals them."

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

### Two new German tanks (part of job 7, owner 2026-11-08)

"## Two new German tanks
- Panzer III Ausf. E: the standard early-war German tank. Fast and light, with a small gun that's weak against heavy armour. Clearly weaker than the Panzer IV, and vulnerable to anti-tank rifles and guns. It appears only in 1939–41 missions, like the early Soviet missions (Brest, Dubno).

- King Tiger: an elite, rare heavy tank that only appears from mid-1944 (D-Day from Goodwood onward, and the Road to Berlin from 1944 onward), and only where the mission data places it.
  - It arrives as an elite squad: one King Tiger plus an escort of veteran infantry who are tougher and more accurate than normal troops.
  - It looks clearly elite: its own camouflage scheme and an elite marker, with no SS or Nazi symbols.
  - Strengths: a deadly long-range gun and very thick front armour, so most anti-tank weapons barely scratch it from the front.
  - Weaknesses: slow, slow turret, and weak rear armour. Hits from behind, bombers and heavy tanks like the IS-2 can kill it. It's beatable with flanking, air strikes or concentrated fire, never invincible.
  - Its arrival gets a warning (a text banner and a sound cue), like a boss.
- Both are added to the balance tests with clear counters. The admin panel can spawn them."

Notes for the implementer: the game already has a King Tiger as the `heavyTank` boss guarding the German HQ in today's
mission 10 (Siegfried Line, early 1945, historically plausible). Turn that into this elite-squad King Tiger rather than
adding a second one, and keep it out of anything set before mid-1944. Front versus rear armour needs a new hit-facing
rule in the sim (damage depends on which side of the tank the shot comes from); build it as data so other tanks can
use it later.


## More German tanks: later Panzer III and the Maus (owner, 2026-11-08; later, part of the new units)

"## Panzer III, later versions
- Besides the early Ausf. E (1939–41), add the later Panzer III with the longer, stronger gun for 1942–43. It's the most common German tank in the Stalingrad campaign. Weaker than the Panzer IV and T-34, and vulnerable to anti-tank weapons. Era-correct per mission.

## Maus (super-heavy tank)
- The Maus is a real fighting unit for the Germans, not just a one-off scripted boss. It appears in late-war missions (1945) when the mission data or the AI calls for it, as a rare, very expensive heavy hitter. No briefing disclaimer needed.
- It's enormous: a huge gun, near-immune front armour, very slow, and a big population cost. It gets a warning banner when it enters the battle.
- It's beatable through tactics: hits from behind, bombers, heavy tanks like the IS-2 and concentrated artillery. It's never invincible.
- The AI fields at most one at a time. The admin panel can spawn it.
- Add both tanks to the balance tests."

Notes: the later Panzer III matters for Stalingrad's era-correct rosters (the stalingrad branch may use the early one as a stand-in until this lands); the Maus belongs with the 1945 missions (Road to Berlin) and needs the admin panel (job 2) for spawning.

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

Confirmed by the owner on 2026-11-08: medals are part of the campaign foundations and are built before any campaign.
The Armoury covers the new units too (job 7): the APC, flamethrower, commander and anti-aircraft gun are bought with
medals like the core roles, and the bomber, fighter and recon plane call-ins are bought with medals in the same screen
(each call-in still costs money and has a cooldown in battle). Enemy-only units (Panzer III Ausf. E, the King Tiger
squad) are not for sale. Riflemen and sappers stay free.

### Music for the new campaigns (owner, 2026-11-08)

"the new music is tied to the old British missions that are being scrapped. When building the new campaigns, reuse tracks where they fit (Sword Beach and Hill 112 for D-Day, the desert tracks for the African campaign) and compose new ones for every other new mission, so each mission still has its own. Russian battles should sound cold"

Notes for the implementer: every mission names its track in mission data (`music` field; see `docs/MUSIC.md`). Reuse the `sword` and `hill112` tracks for the matching D-Day missions (Sword Beach; Operation Epsom and Hill 112) and the desert tracks (`crusader`, `alamein`) for the African campaign, and compose a new track for every other new mission so no two missions share one. The British campaign theme ("The Line") carries over to D-Day; the Soviet campaigns get their own theme, and their tracks should sound cold (wintry colours, glassy or bleak textures, sparse open voicings, icy percussion), alongside the driving battle feel. The African campaign gets its own theme too.

### What medals buy, and the Poland unlock (owner, 2026-11-08)

"## What medals buy
1. Unlocking unit types in the Armoury (as specced).
2. Upgrading troops and the HQ, replacing Quartermaster points (as specced).
3. Unlocking the Battle for Poland campaign for 2,999 medals, as an alternative to buying it for $4.99.

## Poland unlock
- It's available only in the Google Play app, never in the free website version or the public repo.
- In the app it can be unlocked either by spending 2,999 medals or by buying it for $4.99 through Google Play Billing. Either way unlocks it permanently, and a purchase is restored if the app is reinstalled.
- The Armoury shows it as a locked campaign with both options, and how many medals I have toward it.
- Use the balance bot to estimate how many campaigns and difficulties a typical player must finish to earn 2,999 medals while also buying a sensible set of units and upgrades. Report it, and suggest a different medal price if it's unreasonable. Keep all prices in data."
"- The admin panel can unlock and re-lock it for testing."

Notes: parts 1 and 2 are the medals job (job 10). Part 3 and the Poland unlock are built with the Google Play and Poland
add-on jobs at the end of the queue, inside the Android build only; the public repo and the website never contain the
Poland content, the unlock code paths that reveal it, or the Billing code (the plan document for keeping paid content
private comes first). The medal-economy estimate for 2,999 medals can run earlier, once the campaigns exist, using the
balance bot; report it to the owner with a suggested price. Prices go in data (src/data/medals.ts for the medal price;
the store price lives in the Play Console, mirrored in the private build's data for display).


## Campaigns (2026-11-08 list)

"## Campaigns (10 missions each; the last few generally feature tanks; era-correct units and equipment; check the history before writing briefings)
- Every side gets its own period-accurate uniforms, helmets and headgear, defined in data.
- Soviet, Stalingrad: as already specced.
- British, D-Day: replaces the current British campaign, whose 10 missions are scrapped. Reuse their backdrops and features where useful (the desert and Italy art can go to the African campaign). Migrate saves cleanly: earned medals and passives stay. Update the Tin Hats card text on hunteracedev.com to match.
  1. Pegasus Bridge, night of 5–6 June 1944: a glider assault to seize the bridges. Shorter, and teaches the basics as the new tutorial. (Superseded 2026-11-08: Pegasus Bridge is a normal mission; the standalone "Basic Training" is the tutorial.)
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

## Publishing on Google Play (at the very end, before the Poland add-on)

"## Publishing on Google Play (at the very end, before the Poland add-on)
- Wrap the game as an Android app with Capacitor: landscape only, offline, saves kept on the device, proper app icon and splash screen.
- Plan the Poland campaign as an in-app purchase through Google Play Billing. The paid content lives in a private repo, goes only into the Android build, and never into the public repo or the free website version.
- Prepare everything Google Play needs: a release build signed for upload, a privacy policy page on hunteracedev.com, store listing text, phone and tablet screenshots, and the answers for the content rating and data safety forms. Make a checklist of the steps I have to do myself, like creating the developer account, paying the fee and running any required testing period.
- Test the Android build on an Android emulator, and check performance with full armies."

Notes for the implementer: `docs/CAPACITOR.md` already describes the wrap. The Android SDK, an emulator and a JDK are
not installed on this PC yet (a JDK is: Eclipse Adoptium 25 is on PATH); installing the SDK and emulator is part of the
job. The upload signing key must be created and kept outside every repo, and its backup is the owner's responsibility
(add it to the owner's checklist).

## Paid add-on: Poland 1939 campaign (very last; after the French and German campaigns)

Price update (owner, 2026-11-08, later): **$5.99** (was $4.99); still unlockable with 2,999 medals instead.

Update (owner, 2026-11-08): it is called "the Battle for Poland" and can be unlocked in the Google Play app either for
2,999 medals or for $4.99 (now $5.99, see above) through Google Play Billing; see "What medals buy, and the Poland unlock" under the medals spec.

"## Paid add-on: Poland 1939 campaign (do not build the payment part yet)
- A 10-mission campaign as Poland, September to October 1939. Tragic but heroic: holding out and delaying is the victory, and the war is lost by the end. The Soviets invade from the east in the later missions.
- Missions to research and choose from: the Polish Post Office in Danzig, Westerplatte, Mokra, Wizna, the Bzura counter-offensive, the defense of Warsaw, Modlin, Grodno, Tomaszów Lubelski and Kock.
- Polish signature units: cavalry used as fast-moving infantry, the 7TP tank, the wz. 35 anti-tank rifle. Period-accurate Polish uniforms and the white-and-red flag. The Germans only field 1939 equipment (Panzer I, II, III Ausf. E and Czech-built tanks).
- This will be paid content, and the main game's code is public. Before building it, write a short plan in docs/ for keeping paid content out of the public repo and unlocking it only after a real purchase check, with options for itch.io, Steam, and the Google Play and App Store versions. Don't add any payment code or put paid content in the public repo until I've picked a store."

## Paid add-ons, current list (owner, 2026-11-08; very last, Google Play app only)

Both are sold only in the Google Play app, never in the free website version and never in the public repo (paid content
lives in the private repo per the Google Play plan). No payment code or paid content goes in before the owner picks the
store setup.

"## Battle for Poland: $5.99
- Price changes from $4.99 to $5.99. It can still be unlocked with 2,999 medals instead.

## The Cavalier: $2.99 (paid only, not buyable with medals)
- A joke unit: a British soldier in full medieval knight's armour on an armoured horse, with a lance or sword.
- Melee only: he charges in and attacks up close. Fast, thanks to the horse.
- Bullets barely hurt him, like a tank, but anti-tank weapons, explosives, artillery and bombs damage him like a tank.
- One per battle, with a fairly high money cost, so it's fun but doesn't break the balance.
- Text speech bubbles when he charges (for example, "For King and Country!") with a short horn or hoofbeat sound cue.
- Once bought, it's usable in every campaign as the same British knight, as a fun cameo.
- In the store and in the game it's sold as a unit; the description can mention that buying it supports the developer.
- Add it to the balance tests so it's strong but beatable."

Notes: the Cavalier is a paid unit, so like Poland its art, data and unlock code live only in the private Android build;
the public build may only carry generic hooks that do nothing without the private content. It needs melee combat (no
unit fights in melee today) and a one-per-battle rule like the commander's (uniquePerSide).
