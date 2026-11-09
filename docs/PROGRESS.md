# Progress

If you lose track, read this file and carry on from "In progress" and "Next". The live project is this repo (moved out of a cloud-synced folder on 2026-10-01, DECISIONS 216); the old cloud-synced copy is stale. The game is published at https://hunteracedev.com/tin-hats/ (see `CLAUDE.md`, "Push to live").

## Done
- Phase 0: project-local toolchain (Node 24, git, Chromium for Playwright in `.tools`), Vite + TypeScript + Phaser 4.2.1 scaffold, ESLint, Vitest and Playwright configs, shared contracts (`src/data/schema.ts`, `src/data/view.ts`, `src/data/factions.ts`, `src/ui/contracts.ts`, `src/art/types.ts`), docs (`PLAN.md`, `DESIGN.md`, `AGENT_GUIDE.md`, `DECISIONS.md`).
- Phase 1 foundations (merged earlier, per-track notes in `docs/progress/`):
  - sim core (`src/sim`, `src/data`, `tools/sim-cli.ts`): economy, training, three orders, rifle combat, HQ gun, AI and bot commanders, mission 1. Trenches, pillboxes, wire, projectiles, direct control and supports are marked stubs for Phase 2 (`SIM_FEATURES`).
  - art (`src/art`): figure animation for every infantry kind, seven theatre backdrops, structures, vehicles, props, effect sprites.
  - HUD (`src/ui/hud`), menus (`src/ui/screens`, `src/ui/shell`), audio (`src/audio`, 29 synthesised sounds).
  - renderer core and part 2 (`src/render`): Phaser 4 battlefield with one atlas page, parallax backdrop, pooled figure and tank views, HQs, dumps, trenches, pillboxes, wire, tracers, particles, explosions, projectiles, decals, rain and thunder, night tint, screen shake, sound hookup.
  - app glue (`src/app`, `src/meta`, `src/main.ts`, `index.html`): fixed-step game loop, HUD model, screen flow (title, campaign, briefing, battle, result), save data in localStorage, pause on focus loss, `?debug=1` hooks.
- **Phase 1 playable slice, verified.** Mission 1 plays end to end in the built game on a phone-sized landscape touch viewport: title, campaign map, briefing, battle (train, three orders, drag and minimap camera, pause, restart, quit, mute), victory and defeat result screens, progress surviving a reload. Checks, all green on the final tree: typecheck, sim-only typecheck, lint with zero warnings, 30 unit files (462 tests), production build with no warnings, 16 browser tests (`npm run test:e2e`, no console error, page error or failed request in any of them). Ten screenshots of the real build are in `docs/screenshots/phase1-*.png` and were looked at one by one; the other `e2e-*.png` come from the smoke test.

- **Phase 1 visual QA pass.** Mission 1 was captured from the production build at 844x390 and 667x375 with `tools/qa.ts` (fake clock, so film strips are exactly 50 ms apart) and reviewed over three rounds; final pictures in `docs/screenshots/qa1-*.png` (scenes, plus `qa1-844-strip-*` film strips of walking, carrying, loading, the HQ door both ways, running, firing, a death, idle, cheer and a lightning flash). The gait was confirmed to cycle with planted feet, bent knees and arm swing. Fixed (view side only, DECISIONS 81 to 85): packed squads now spread over wider depth rows with a per-row stagger and an eased crowd relaxation; units file out of and into the HQ doorway as a dark silhouette instead of a see-through ghost; bodies lie under the living; the training puff no longer smears across the doorway; each soldier carries his rifle a little differently on the move.

- **Phase 2 full combat, verified** (sim parts 1 and 2, app wiring, track verify2): trenches, pillboxes, wire, projectiles, smoke, the damage matrix, all nine trainable kinds plus the King Tiger for both factions, direct control (joystick, FIRE, ability, release), the three call-ins, AI reactions and supports, matchup and mirror balance tests. Checks on the final tree: typecheck, sim-only typecheck, lint with zero warnings, 38 unit files (563 tests), 2 balance files (20 tests), production build with no warnings, 29 browser tests. The real build was captured on the proving ground with `tools/qa.ts --only=sandbox,sbstrips` at 844x390 and 667x375 over five rounds and every picture was looked at; final pictures `docs/screenshots/phase2-*.png` (garrisoned trench, both armies, direct control in and out of a trench, a Churchill driven through the German wire, barrage, smoke, air strike, grenade assault, mortar on a pillbox, rubble, tank duel, PIAT, medic, sniper, rain; strips of a mortar launch, a grenade throw, a tank driving and firing, men climbing out of and dropping into trenches). Fixed in the view (DECISIONS 126 to 131): the mortar flash pointed level instead of up the tube, the controlled man's ring hid behind the parapet, soldiers on the far rows were painted over pillboxes, the strike aircraft flew behind the HUD top bar, and the control camera now looks ahead so a pushing unit stays clear of the FIRE cluster.

- **Phase 3 ten missions, campaign, upgrades and saving, verified** (tracks missions-core, missions-a, missions-b, campaign, verify3): ten authored missions with briefings, hints, map pins and expected times; the Quartermaster on the real `UPGRADES`; three difficulties; save v2 with migration and clamping. Verify3 (DECISIONS 167 to 175) added to the sim a wave reserve (scripted waves never exceed the population cap; the strict invariant is restored), the `garrison` behaviour (rear lines of missions 6, 8 and 10 stay manned) and `aiPopCapMul` per difficulty, with `tests/unit/sim-reserve.test.ts`; redrew trenches as pits dug into each theatre's ground; dropped the unused dump in mission 9; balanced the HUD objective plate; shortened Quartermaster lines; fixed a timing race in the mission 5 clock check of `missions.spec`. The real build was captured for every mission at 844x390 with `tools/qa.ts --only=missions,campaign` (the debug `autopilot` hook lets the test bot play) over three rounds and every picture was looked at; final pictures `docs/screenshots/phase3-*.png` (opening view, first German line, a mid-battle moment, mission 5 near nightfall, the King Tiger, campaign map, Quartermaster with upgrades bought, briefing with a NEW card, result). Checks on the final tree are listed in `docs/progress/verify3.md`.

- **Phase 4 balance, performance, PWA, sound and tutorial, verified** (tracks balance, perf-pwa, polish, verify4; notes in `docs/progress/`; DECISIONS 176 to 215):
  - balance: damage matrix (anti-tank vs infantry, mortars and grenades hit vehicles), AI recovery fixes, per-mission tuning, harsher Insane; `src/sim/balanceRuns.ts`, mission and difficulty-gradient balance tests, `tools/balance-table.ts` writes `docs/BALANCE.md`. On Normal the bot wins all 16 seeds of every mission inside its expected minutes and the idle commander loses all.
  - performance and PWA: Phaser in its own chunk (app 566 kB, 187 kB gzipped; Phaser 1375 kB, 357 kB gzipped), service worker with precache and offline play, icons drawn by code, frame probe and `tools/perf.ts`, a three-level quality governor, hard particle cap of 1000, `docs/CAPACITOR.md`.
  - sound, tutorial and UI: eight-step guided tutorial in mission 1 and pointer tips for each new unit and support (remembered under `tinhats.tips`, replayable from Settings), eight new synthesised sounds with a measured mix and ducking, audio frozen while hidden or paused, mute everywhere and saved, scroll cues, double-tap guards, all screens checked at six phone sizes.
  - verify4: health pips moved to a layer per unit row, so a nearer tank covers them (DECISIONS 211). Checks on the final tree: typecheck, sim-only typecheck, lint with zero warnings, 49 unit files (746 tests), 7 balance files (191 tests, 107 s on an idle machine), production build with no warnings (18 precache entries), the whole browser suite 95 of 95 (about 37 minutes; mission spec reaches a result in all ten missions; PWA spec installs, precaches and plays offline; audio spec keeps mute across a reload; tutorial spec shows each tip once). `tools/perf.ts` on the built game: mission 10, about 85 units, 0.56 ms of game JS a frame (p95 0.9) against the 6 ms budget, Phaser draw 1.46 ms, 54.7 fps in software WebGL; proving ground at 4x CPU throttle 3.55 ms (p95 11.5), still inside the budget. Pictures at 844x390 from the built game, looked at one by one: `docs/screenshots/phase4-*.png` (title, first tutorial hint, pause menu, mission 10 mid-battle, result, mission 2 opening with hint, banner and tip together, pips behind a tank).

- **Title screen storm, verified** (owner request, DECISIONS 217 to 224): the French fields behind the title under a storm light, rain in three depths scaled to the screen, splashes, drops running down the plate, a flash every 5 s of storm time (a fork behind the church spire on 40% of them), a synthesised thunder after each with a random delay, loudness and length, and a drifting rain bed that starts with the first touch and fades in. Three volume sliders (Music, Ambience, Sound effects) on three engine buses, and Reduce flashing (a soft glow, title and battle), saved in save version 3. The storm runs on the title and behind Settings opened from it, stops with a fade elsewhere, freezes while the page is hidden or blurred. Data `src/data/menuStorm.ts`; logic `src/fx/menuStorm.ts`; picture `src/render/weather/menuStorm.ts`; sound `src/audio/storm.ts`; lifecycle `src/app/menuStorm.ts`; debug `window.__TH.menuStorm`. Pictures `docs/screenshots/menu-storm-{flash,rain,reduced}.png`. Cost on the built game (`tools/perf-title.ts --dist`): the storm's JS is 0.06 ms a frame at 844x390, 0.38 ms under a 4x CPU throttle; after the lag fix a 1920x1080 window runs at 40.8 fps in software WebGL (was 13).
- **Menu music, verified** (owner request, DECISIONS 225 to 228): an original requiem theme, "Requiem for the Fields" (D minor, 58 BPM, 132.4 s loop, four sections), on a reusable music system in `src/audio/music/` (pad, muted horn, soft piano and far-off drum instruments on any BaseAudioContext, a generated dark reverb, `renderTrack` with the tail folded onto the loop start, `MusicPlayer` on the Music bus, a track registry `MUSIC_TRACKS` in `src/data/music.ts` for campaign and battle music later). Rendered once after the first frames (mono 24 kHz, 12.9 MB, 5 to 11 s in headless Chromium), it starts with the first touch, fades in over 3 s, plays behind Settings from the title and fades out elsewhere. Mix measured against the rain and the thunder (targets in data, enforced by `tests/e2e/menu-music.spec.ts`). Listening page `dev/music-preview.html` (play, stop, loop-seam audition, waveform and spectrogram per section; picture `docs/screenshots/music-preview.png`).
- **Menu mix: the music leads, verified** (owner change, DECISIONS 229 to 232): at the default sliders (now 80 / 80 / 80) the music is 2.9 LU above the rain full range and 1.9 LU through a phone speaker model, the thunder 3.3 to 6.4 above both, no soft clipping and no compressor pumping; save version 4 moves untouched sliders to the new defaults. All levels in data; `tools/mix-report.ts` prints the measurements, the preview page plays the mix (with a phone speaker toggle) and shows them.
- **Battle sound at its old loudness again, verified** (owner request, DECISIONS 234, 235): the sound catalogue is lifted per bus (`CATALOGUE_LEVEL` in src/data/sounds.ts, derived from the default sliders) so that at the default sliders every battle, UI and sting sound plays exactly as it did with the old 100 defaults; measured through the real engine against the old commit (`tools/battle-loudness.ts`): 0.00 dB difference in peak and loudness for every sound tried and for an army of 80 firing. The title's music, rain and thunder are untouched (same numbers to three decimals).

- **Start-up hardened against saved data** (DECISIONS 233): a save whose upgrade or check throws is repaired (progress kept, settings to defaults) instead of stopping the game; unusable saves are copied aside; the app is rebuilt on an empty store as a last resort. Checked in a browser with 16 kinds of old, odd and damaged stored data and with nothing stored.

- **Trenches redrawn as narrow end-on pits** (owner request, DECISIONS 237, view only): one pit per trench with revetment boards, firing step, sandbags on the enemy-facing lip over the occupants' legs, occupants packed in, owner's pennant fading in on capture. Typecheck, lint, 829 unit tests and the build pass; browser suites not run. Pictures `docs/screenshots/trench-after-*.png` (before: `trench-current-*.png`).

- **Quartermaster upgrade looks** (owner request, queue job 2, DECISIONS 240 to 243): every upgrade changes the battle picture. HQ building by Sandbagged HQ level (tent, big tent, timber dugout, concrete bunker, three damage states each), HQ gun position by HQ Vickers Gun level (prone gunner, emplacement, tripod gun, two-man nest), dump by Requisition Orders level (crates, stacked, drums, parked truck), sapper haul by Sapper Drill level (crate, bigger load, handcart, a supply truck he drives), unit gear by each unit's health and damage levels (fuller pack, helmet net, scrim; fuller pouches, bandolier, grenades; medic kit; tank track links, plates, sandbags, stowage, cupola MG, long gun). Per-nation data in `src/data/upgradeLooks.ts`; British and German filled in. Quartermaster cards preview the next level. Checks: typecheck, lint, build, unit 871/871, browser specs campaign and upgrade-looks 15/15. Pictures `docs/screenshots/upgrade-looks-*.png`, `e2e-upgrade-looks-*.png`, dev pages `dev/looks-{hq,gun,supply,gear}.html`.
- **Population cap 100** (owner request, DECISIONS 239): `CONFIG.popCap` 100 for both sides; the AI counts a fixed 40-man army as full and trains past it only with 2000 supplies banked, so it keeps a reinforcement reserve as it did under the old cap. Unit 840/840, balance 191/191 (the proving-ground test back at its original 240 s). Not measured: frame rate with 200 men on the field.
- **Orders per unit kind** (owner request "only bren units: hold!", DECISIONS 238): each side keeps its army order plus an optional override per unit kind (`SideState.kindOrders`); commands `{ type: 'order', order, kind }` and `{ type: 'followArmy', kind? }`; the army order never clears overrides; Fall Back per kind sends only that kind inside (sappers included); controlled units ignore orders; the AI and test bot use army orders only. HUD: an "Orders for" chip left of the order buttons opens a picker (All units plus every kind of the mission); in a kind scope the buttons light that kind's order, a Follow army button clears it, and train buttons of kinds on their own orders carry a small order badge; S cycles the scope, Escape or a press outside closes the picker. Browser spec `tests/e2e/unit-orders.spec.ts`; pictures `docs/screenshots/unit-orders-*.png`.
- **Minor blood, with a Show blood setting** (owner request, DECISIONS 251, view side only), live (commit c737d59): a soldier killed by gunfire gets one small, flat, dark-red pool under his torso that starts after his fall, spreads over 1 s and fades with the body on the corpse timing; nothing for explosive or anti-tank deaths, vehicles or buildings. 24 pooled images (`RENDER.blood.maxPools`, all numbers in `RENDER.blood`), the oldest taken over past the cap; a blood layer per depth row just under the row. "Show blood" in Settings (`setting-blood`, on by default, save version 5 with a 4 -> 5 step that turns it on), applied live (off clears every pool at once). Code `src/render/blood.ts`; tests `tests/unit/render-blood.test.ts`, the version 5 block in `tests/unit/meta-save.test.ts`, `tests/e2e/blood.spec.ts`; debug `__TH.blood()`, `__THPERF.newestBlood()`, `__THPERF.zoom()`. Picture `docs/screenshots/blood.png`. Checks: `npm run check` (unit 991/991), the sim-only typecheck, browser specs blood 2/2, campaign and menu-storm 20/20.
- **Music checks that were skipped when the music went live** (2026-11-08, with the minor blood job): `npm run test:balance` 191/191; the browser specs `menu-music`, `battle-music`, `audio` and `smoke` with `-g "menus|first battle|mission 1|debug hooks|wiring"` 17/18 at first: the smoke test that lists the `?debug=1` hooks had not been given the battle music's `battleMusic` hook, so it was added there (with the new `blood` hook) and the test passes; 18/18.
- **Hidden enemy unit HP** (owner request, queue job 1, DECISIONS 252, view only), live (commit eac9581): enemy soldiers, tanks, the King Tiger and wave units show no health pips; the player's own keep them; the direct-control card hides the bar for a unit that is not the player's own unless revealed; structures (HQ and pillbox damage states, the enemy HQ bar and minimap dot) unchanged. Data-driven per-side reveal `src/render/hpReveal.ts` (`RENDER.hpReveal`), exposed as `BattleView.hpReveal` with a whole-side switch and timed areas for the Recon plane and admin panel, allocation-free. Debug `__TH.hpPips()`, `__TH.revealEnemyHp(on)`. Tests `tests/unit/render-hp-reveal.test.ts`, `tests/e2e/enemy-hp.spec.ts`. Picture `docs/screenshots/enemy-hp-hidden.png`. Checks: `npm run check` (unit 1001/1001), sim-only typecheck, balance 191/191, browser enemy-hp 1/1 and smoke `-g "debug hooks|first battle|wiring"` 10/10.

- **Barbed wire drawn end-on** (owner request, DECISIONS 253, view side only), live (commit 5e85113): each belt is one to three short, tall end-on pieces (concertina coil seen down its axis on crossed timber pickets, waist to chest high, `WIRE_LAYOUT`, `wirePieceLayout`) centred in its data width; the far half draws behind the unit rows and the near half over them, and infantry inside a standing belt step onto its feet line so the coil wraps their legs. Men inside enemy wire struggle (`FigureInput.struggling`, `FIGURE_WIRE`: short high-kneed steps, weapon held overhead or arms up, springed blend). A tank crush folds each piece flat in turn into a tangle; a shell leaves blown debris (`src/render/wireRules.ts`). The Germany backdrop's dragon's teeth are now end-on clusters instead of a band. Puppet scene `dev/render-preview.html?scene=wire`; screenshots `docs/screenshots/wire-*.png`. Checks: `npm run check` (1011 unit tests) and the sim typecheck passed after the final change; `test:balance` 191/191 passed mid-job (before the last view-only data tweak); the browser specs were skipped under the owner's deadline.

- **New units on screen and medals (queue jobs 7 and 10, DECISIONS 254, 255, 257; not pushed)**: medals and the Armoury (save version 6; sells the APC, flamethrower, commander, AA crew and the bomber, fighter and recon call-ins; riflemen and sappers free; loans; replay decay; victory breakdown), and the new units in the sim (hit-facing armour, commander aura and speech, flamethrower flush and fuel tank, APC carry, planes and AA, the King Tiger squad, the Panzer III). On screen: the flamethrower's wand, fuel tanks and fire jet, the commander's revolver, pointing arm and speech bubbles, the Universal Carrier and SdKfz 251 with their squad aboard and the hop out, the Panzer III and the camouflaged King Tiger with its turret number and barrel band, plane passes with bombs, strafing, flak, AA tracers and crashes, recon revealing enemy health, the King Tiger's HUD warning banner and horn, plane call-in glyphs in the HUD and Armoury, a two-column call-in rail. Screenshots: `docs/screenshots/release-units-*.png`, `release-medals-*.png`.

## STOPPED for the owner's restart at 2026-11-09 16:55Z (read this first)

Nothing running: all workflows stopped, no test browsers, dev servers or node processes. Nothing pushed; live is Beta v0.12.0.

Owner's budget rule (2026-11-09): about 10% of the weekly limit per day (weekly was 40% at 16:50Z, resets Sunday
2026-11-15 20:00Z); one job at a time, no parallel agents unless a job truly needs them; run only the tests related to
the change (full browser suite only when Stalingrad is ready to go live); screenshots and long reports only when asked;
check usage before each job; when the day's budget is used, stop at a clean point, update this file, schedule a resume
for the next morning. Priority this week: finish Stalingrad incl. the three new changes and the fixes. Everything else waits.

Where each job stands:
- `stalingrad` (C:dev	in-hats-stalingrad) at 8b4bddf: everything merged (c584b01; unit 1772/1772, lint, typecheck, build
  passed there). 8b4bddf is a WIP checkpoint of the owner's fixes job, part 1 (Begin under 2 s: backdrop/view work and a
  begin-timing spec), unverified. Not started yet: label fit + test, compact Deploy at, the medal economy (Stick War:
  Legacy benchmark in the session scratchpad stickwar-economy.json; summary below), realistic artillery, tank cannons.
- `stalingrad-core` (C:dev	in-hats-stal-core) at 4bd4360: the review job was stopped mid-way (owner: one job at a time;
  it was running the full browser suite). Its finished commit 7f92b0b is already in stalingrad; 4bd4360 is an
  unverified audio.spec edit: check it and merge into stalingrad or drop it. Worktrees stal-e2..e5 are merged and can go.
Next, one job at a time, in this order: finish the fixes (Begin, labels, Deploy at) -> economy -> artillery -> tank
cannons -> related tests -> mission tuning one mission at a time -> Basic Training -> campaign check -> full checks and
the browser suite -> final MORNING_REPORT -> tell the owner it is ready to check.
Benchmark summary: first clear 20/30/40 gems (Normal/Hard/Insane), 2nd win 10, later 5; campaign bonus 500/1000/1500;
12 stages; cheap spells 20-50 gems (about 1 level), big summons 500-1000 (about a campaign); upgrade points 2 per stage,
1 point per level.

## Stalingrad state at 16:25Z (owner back; read this first)

- `stalingrad` (C:dev	in-hats-stalingrad) at c584b01 + 54b4b52: everything merged (art, music, systems, era, campaign
  map, placeholders removed, the five engine clusters). Unit 1772/1772, lint, typecheck, build pass. Interim
  docs/MORNING_REPORT.md there.
- Running: (a) review of stalingrad-core (engine workflow wpl7t6j6q, run wf_ae472a8e-d30); its later commits must be
  merged into stalingrad when it ends; (b) workflow wkts2xarg (run wf_0d1c849d-882, script
  stalingrad-prelaunch-changes) on stalingrad, one agent at a time: the owner's fixes (Begin under 2 s, labels that
  fit, compact Deploy at), the medal economy on the Stick War: Legacy benchmark with call-in charges and a Shop
  (research: scratchpad stickwar-economy.json), realistic artillery, tank cannons, a verifier. QUEUE.md has the
  owner's words.
- Then: the missions/playtest workflow (scratchpad stalingrad-missions.js: ten missions two at a time, Basic Training,
  campaign critic, final checks, MORNING_REPORT). Stalingrad stays off the live site until the owner says "push to live".

## RESUMED after the usage limit (main session c19d9338, 13:12Z); was paused at 12:25Z

Paused cleanly at 87%. Nothing pushed; live is still Beta v0.12.0. No test browsers, servers or node processes running.
- `stalingrad-core` (C:dev	in-hats-stal-core) at 1e2e6b9, clean: era table, campaign select + map + briefings +
  unlocks, British placeholders removed (save version 10), and the mission director (phases, objectives, side
  objectives, triggers, events, medal scoring; all 10 missions rewritten on it and passing the balance checks).
- `stalingrad-e2` (C:dev	in-hats-stal-e2) at 38699c2: ground sectors, capture points, forward deploy, rally Fall Back
  (sim, render, HUD); WIP checkpoint, not finished.
- `stalingrad-e3` (C:dev	in-hats-stal-e3) at ec57957: buildings and rubble (sim, tests, art and renderer in
  progress); WIP checkpoint, not finished.
- `stalingrad` (C:dev	in-hats-stalingrad) at 18a2b28: art + music + systems; WIP checkpoint of the browser-spec job.
Resume steps (max two jobs):
1. Resume the engine workflow: Workflow({scriptPath: 'C:UsersmarcmAppDataLocalTempclaudefb17822dcadfc66c19d9338-3067-4e3f-9234-d869d35b29c3scratchpadstalingrad-engine.js',
   resumeFromRunId: 'wf_ae472a8e-d30', args: the same {clusters: [...]} as the first launch (the audit clusters,
   journal of run wf_b14b3c19-35c, first result)}). The director replays from cache; e2 and e3 rerun and continue in
   their worktrees; then merge 1, pair 2 (weather, obstacles), merge 2, review.
2. The browser-spec workflow (stalingrad-browser-specs-wf_96d5ba93-8c8.js, 'wf_96d5ba93-8c8') resumes only when a job
   slot is free (after the engine pairs).
3. Then merge stalingrad-core into stalingrad, the missions/playtest phase, a campaign critic, final checks and
   docs/MORNING_REPORT.md.

## RESUMED after the usage limit (main session c19d9338, 08:12Z); was paused at 07:30Z

Paused cleanly at 85% of the 5-hour window. Nothing pushed; live is still Beta v0.12.0. No processes running.
State of each branch:
- `stalingrad` (C:dev	in-hats-stalingrad) at 6333431: Soviet art + all 10 battle tracks + music rendered at mission
  load + merge of stalingrad-systems (e953490; unit tests 1414/1414). 6333431 is a WIP checkpoint of the browser-spec
  job (Basic Training pillbox hpMul 0.08, a missions.spec wait; DECISIONS 321 still to write; untracked scratch files
  tests/e2e/zz-begin-load.tmp.spec.ts and tools/bt-walk.tmp.ts).
- `stalingrad-core` (C:dev	in-hats-stal-core) at ef02c02, clean: audit, era table + later Panzer III (18f6b79..46d0adb),
  campaign select + Stalingrad map + briefings + per-mission unlocks (1162c01..ef02c02). Not yet done: removing the
  British placeholder missions, the engine gaps from the audit, the review.
Resume steps:
1. Resume workflow wjsiti813: Workflow({scriptPath: <session>/workflows/scripts/stalingrad-core-wf_b14b3c19-35c.js,
   resumeFromRunId: 'wf_b14b3c19-35c'}) (audit, era and campaign agents replay from cache; placeholders runs next).
2. Resume workflow wpqyagmv9 the same way (stalingrad-browser-specs-wf_96d5ba93-8c8.js, 'wf_96d5ba93-8c8'); it reruns
   from its WIP checkpoint.
3. When core finishes: merge stalingrad-core into stalingrad (renumber DECISIONS: core took 287-302+, stalingrad
   287-320), then the missions/playtest phase, then docs/MORNING_REPORT.md.

## Overnight Stalingrad run (main session, 2026-11-09 05:20Z; read this first)

The main session owns Stalingrad tonight; the resume-queue session stopped after v0.12.0 and its stalingrad-systems work.
Three Stalingrad branches, merged together by the main session only (never into main, never live):
- `stalingrad` (C:dev	in-hats-stalingrad): Soviet art done (to f0b26f6); music workflow w9dzzvxxd composing the
  8 missing battle tracks (brest, dubno, klin, volga done in ea39e4b; kurgan, pavlov, uranus, ring next), then battle
  music rendered at mission load, then a music critic.
- `stalingrad-systems` (C:dev	in-hats-stal-systems): finished (Money, prep phase, waves fix, Basic Training prep lesson).
- `stalingrad-core` (C:dev	in-hats-stal-core, from stalingrad-systems b5d2b34): workflow wjsiti813: audit of mission
  gaps, era table + later Panzer III, campaign select + Stalingrad map + map music + briefings + per-mission unlocks,
  removal of the British placeholder missions with a save migration, engine gaps from the audit, review.
Next: merge all three into `stalingrad` (DECISIONS numbers will collide again: renumber), then finish the missions,
fix Basic Training's 2 browser specs, headless playtests tuned to 15-30 min, then docs/MORNING_REPORT.md.
A guarded resume (tin-hats-resume-queue, 08:15Z) only acts if this file says the run paused for the usage limit.

## Latest state (2026-11-09 evening run; read this first)

**Live as Beta v0.12.0** (commit 880853c, deployed and checked on hunteracedev.com): units unlocked by missions again
(DECISIONS 280). Medals buy upgrades (re-priced 10/20/30 a level) and the plane call-ins; save version 8 refunds medals
spent on units and keeps them unlocked; NEW cards and "New:" hints only for what a mission really unlocks; Lieutenant
m5, Flamethrower m6, Carrier m8, Bofors m10. Balance bot: a first Normal run earns 250 medals, nothing on loan, buys 25
of 93 upgrade levels.

Stalingrad is now worked on in TWO places (keep them apart, merge `stalingrad` into `stalingrad-systems` often):
- `stalingrad` (worktree C:\dev\tin-hats-stalingrad): another session ("Tin Hats RTS game") was drawing the Soviet art
  there during this run (vehicles, aircraft, winter figures; commits 61f9adf..f0b26f6). Do not edit that worktree while
  it is active. The uncommitted WIP found there was committed as 0857b26 and main v0.11.0 merged in as 5af2847.
- `stalingrad-systems` (worktree C:\dev\tin-hats-stal-systems, from `stalingrad`): this run's non-art work, all checks
  green (unit 1323/1323, lint, typecheck, build; browser spec prep.spec 1/1):
  - main v0.12.0 merged in (98a0bd7): Basic Training's save step became 8 -> 9 (saveVersion 9); its reward test now asks
    for a few first upgrade levels.
  - Money rename (3dfe443, DECISIONS 281): texts and a banknote HUD icon; code names unchanged.
  - Prep phase, job 6 (05805ea, 4f385a9, DECISIONS 282): sim (countdown, Ready, enemy and mission clock wait, sappers
    build wire/foxhole/trench/pillbox, Undo/cancel), HUD panel, ghost placement, build sites drawn, music prep layer,
    test bot plan; missions 1001, 1003, 1007, 1008 use it. Tank traps not yet (need a vehicle blocker).
  - Waves at a fixed x never spawn behind the enemy line (8d2fa7e, DECISIONS 283): Stalingrad balance 11 failures -> 4.
  - Latest `stalingrad` (Soviet art) merged in (bd9e8aa); their DECISIONS 280-282 renumbered 284-286.
  - Basic Training opens with a 45 s prep phase and teaches building first (3689a98): lesson `prepPhase` points at
    the Barbed Wire button; tutorial conditions `placed` and `prepOver`. The walkthrough spec now places wire and opens
    the folded call-ins. basic-training.spec still has 2 failures to look at: the walkthrough's end is flaky (11.6 and
    33 battle minutes in two runs, limit 10) and "quits back to the title ... paying nothing" finds no training-offer
    element after quitting. Neither comes from the prep work.
- Stalingrad still to do (none of it may go live until the owner says push): balance of 1002 (idle once undecided),
  1004 (lines cross near the German HQ at the map's end) and 1005 (bot wins 12/16, needs 14); missions 1006-1010 have
  no balance test yet; campaign select screen and the Stalingrad map/music wiring; era-by-date names and looks; eight
  more cold battle tracks (only `volokolamsk` and `factories` exist); buildings/rubble/snow (FOUNDATIONS); removing the
  10 placeholder British missions (with a save migration that keeps medals, units, upgrades); the
  hunteracedev.com card text.

Before this run: live as **Beta v0.11.0** (main; v0.10.0 added upgrades for every buyable unit and call-in plus the upgrade visuals audit, v0.11.0 the hidden admin panel; both done). Earlier, v0.9.0: new units, medals and the Armoury (prices 3x the original, a win pays 3 to 30 medals,
missions lend 2 of every expected type not bought, every bought type usable in every mission), the playtest follow-ups
(fire-like flame, gas mask, cap 100 everywhere with maxUnits 216, short button labels, collapsible call-ins), cheap lag
wins (Show FPS, body cap, countClusters sweep, budget tests), the campaign map theme "Roll of Honour", the version
number and What's new in Settings, a Beta tag on hunteracedev.com. The lag job was scaled down: the owner's PC was the
main cause.

Running when paused for the usage limit (resume scheduled 8:15 pm local, task tin-hats-resume-queue):
- Admin panel: worktree C:\dev\tin-hats-admin, branch admin-panel (agent was told to wrap up the core). Ship as v0.10.0.
- Upgrades for the new units + upgrade visuals audit: worktree C:\dev\tin-hats-upgrades, branch upgrades (2 commits:
  generated tracks, looks and a readability pass; screenshots and final checks pending). Ship with v0.10.0.
Next: FIRST the design change "units unlocked by missions again" (QUEUE), then Stalingrad fully on its branch
(with Money and the prep phase), never live until the owner says push. Owner rule: at most two jobs at once.
Leftover: branch followups has an uncommitted missions.spec update (finish with the next job); the deeper performance
work is queued at low priority.

## In progress (paused 2026-11-08 ~23:50 UTC for a computer restart; every copy committed, nothing running)

Owner's order of work (2026-11-08, latest): 1. lag fix first, timeboxed to about 30 minutes for the biggest one or two
wins, pushed live, deeper performance work later in the queue; 2. publish new units, medals and the Armoury together
with the lag fix, after checking they add no lag; 3. in parallel, Stalingrad and Basic Training on the `stalingrad`
branch (never live until 100% done and the owner says push). The other follow-ups below wait until after the lag fix.

Each job lives in its own git worktree next to this repo (node_modules and .tools are junctions to this repo's):

| Job | Worktree, branch, last commit | State |
| --- | --- | --- |
| New units, medals, Armoury (jobs 7, 10) | `C:\dev\tin-hats`, `main`, db8c4bb | Integrated and committed, NOT pushed. Integration checks passed (typecheck, lint, unit, build, smoke 12/12, campaign spec fixed for medals); the "wins ground" sandbox test failed twice (known issue below). Also on main: 03496a5 the Armoury shows only the player's own nation's names. Next: push together with the lag fix. |
| Lag fix (top priority) | `C:\dev\tin-hats-perf`, `perf`, 3be7628 | Measuring only, no game code changed. Findings so far in `docs/PERF_FINDINGS.md` there (sim not the cause; render about 90 images per soldier, draw p95 25-43 ms at CPU x4, 73 long tasks; 5 MB/s garbage; battle music rendered piece by piece during the battle with build tasks up to 65 ms). Owner plays on a PC in Chrome and sees stutters/hitches, so fix spikes first. Next: pick the one or two biggest hitch fixes, measure, add the FPS counter setting and a perf test, merge into main, push with the units. |
| Follow-ups from the owner's playtest | `C:\dev\tin-hats-flame`, `followups`, 29034cc | WIP, not checked as a whole. Done: fire-like flame jet (bold layered flat fire with licking tongues, looked at; the pale core still looks a little beady), flamethrower gas mask (head sprite `fig/body/headMask`; not yet seen in a close-up, only the lens glow shows at battle zoom: make it bigger and lighter), cap 100 everywhere (aiPopCapMul 1 on every difficulty, debug grantPopulation clamped, tests), short button labels (`FactionDef.buttonNames`: Flamer, Lt., Carrier; test `hud-labels`), collapsible call-ins column (`src/ui/hud/callins.ts`, stopped mid-way while updating the browser specs missions, sandbox, unit-orders). Next: finish, run all checks, merge after the lag fix. |
| Campaign map theme (Band of Brothers mood, original) | `C:\dev\tin-hats-music`, `campaign-theme`, 6632e01 | WIP: score and instruments written, tests being added when paused. Next: finish tests, render a preview for the owner, merge and push. |
| Stalingrad and Basic Training | `C:\dev\tin-hats-stalingrad`, `stalingrad`, dd926df | Just started: STALINGRAD.md being history-checked, Soviet nation data begun in schema.ts and factions.ts (may not type-check). Plan (workflow script `tin-hats-stalingrad-start`): Soviet nation and history check, then missions 1001-1005 and 1006-1010 as data, Soviet art, cold Soviet music, Basic Training, then integrate on the branch. Missing engine features go to `docs/campaigns/STALINGRAD_BUILD.md`. |

Owner notes from 2026-11-08 already handled: the training-button names and the "/280" (fixed on `followups`); the
proving ground is a debug-only test battle (explained to the owner).

## Next
- **Queue (owner, 2026-11-08): follow the Build order in `docs/QUEUE.md` (specs verbatim there).** 1. hide enemy unit HP (done), 2. admin panel, 3. rename the resource to Money, 4. Quartermaster upgrade looks (done), 5. unlockable passives, 6. prep phase, 7. new units (APC, flamethrower, commander, planes, anti-aircraft), 8. music for every mission and the campaign map, 9. difficulty overhaul (cap 100 everywhere), 10. medals and the Armoury, 11. campaigns (Soviet Part 1 foundations, Stalingrad, British D-Day replacing today's British campaign, Road to Berlin, African), 12. trench art pass. Later: French campaign, German campaign as DLC. Standing rule: push to live after each job whose checks pass, then go straight on.
- A run on a real phone: touch feel, real GPU, audio output, frame rate and the quality governor (nothing has been measured on one).
- Final verification pass, then `docs/MORNING_REPORT.md`.

## Known issues
- Sandbox "wins ground" browser test (DECISIONS 213 flake) failed in both runs on 2026-11-08 after job 7 (the player's tapped army was wiped out by t = 316 to 377 s at 40x); not yet known whether load or the job 7 sim balance (hit-facing armour) is the cause. Investigate before relying on it.
- New units (job 7): the AA crew keep the machine-gun pose with the Bren or MG34 (no towed gun yet) and their tracers are thin at phone size; the commander's pointing arm is subtle while he runs; on the proving ground the flamethrowers were seen burning infantry in the open, not yet photographed on a trench; the admin panel (job 2) that should spawn the Panzer III and King Tiger is not built. Medal prices in `src/data/medals.ts` are first guesses.
- Battle music (stage 3 checks): nobody has listened to it (only measured). Only the current mission's music is held in a battle (the menu theme and map track are released and re-rendered on return). Render 13 to 19 s per track headless, 18 to 26 s on a 4x slowed CPU with graph-build tasks up to 172 ms there (60 ms budget is met only at full speed); never run on a real phone. In autopilot battles (proving ground, Arnhem) no side ever had 20 armed men in the fight (most seen 17 / 9), so the combat layer may rarely play in real campaign battles; the 20 a side rule is the owner's. Prep hook still has no caller.
- Upgrade looks: every level of every track now draws a visible change (DECISIONS 262; looked at in dev/looks-audit.html at battle zoom, not on a phone); the level 1 sapper load and level 1 to 2 HQ gun (emplacement to tripod) are the smallest steps; plane gear is seen only on the dev page and the Quartermaster, not yet in a battle pass; the prone HQ gunner (level 0) is small and low; the old HQ sprites (`hqSpecs`) are still built into the boot atlas though battles no longer use them (remove with the art tests that name them). Not seen on a real phone.
- Trenches (DECISIONS 237): no climb pose (men sink with the old ease), tanks keep the old lip bump at the sim width, big positions are not split into several pits, so 7 and 8 men are packed tightly into one pit; the pit interior is mostly hidden behind a full garrison; the depth rows inside the pit are only slightly staggered; the near wall leaves a faint pale halo where its ground colour meets the backdrop. Browser specs not rerun after the change.
- Menu mix: measured through a loudness weighting and a phone speaker model, never heard on a phone. The thunder margins are only 0.3 to 0.6 dB over their targets.
- Battle loudness: measured through the engine offline, not heard. With every slider at full a heavy battle is 3.9 dB hotter than the old maximum going in: an army of 80 firing peaks at -0.28 dBFS against the soft clipper's ceiling, the compressor takes up to 5.2 dB (3.9 dB on average) and 6.9% of samples are in the soft clipper's bend. No hard clipping is possible, but it is driven hard.
- Menu music: composed, rendered and measured (levels, spectrum, seam), never listened to. The render takes 5 to 11 s in headless Chromium on a desktop CPU and may take much longer on a phone; until it is done only the rain plays. No campaign or battle tracks yet.
- Title storm: the rain bed and the thunder were measured (bus gains, fade levels, output RMS through an analyser), never listened to. Frame rates were seen only in headless Chromium with software WebGL, where a 1920x1080 window still runs at about 41 fps with the storm (60 without it); on a real GPU this should be far cheaper, but it is unmeasured. MSAA is now off on big desktop windows in battles too (`VIEW.msaaMaxPixels`); battles have no pixel budget. At 568x320 the Settings screen scrolls its last row (with the cue).
- Phase 2 sim is complete (part 1: trenches, pillboxes, wire, projectiles, smoke, roster; part 2: direct control, supports, AI reactions/supports/orders, matchup harness and balance tests, `SIM_FEATURES` all true; DECISIONS 107 to 118, `docs/BALANCE.md`). Projectiles hit nothing on the way, so a fast-moving target can be missed. The balance tests cover equal-cost duels, the mirrored proving ground, bot/idle runs of all ten missions on Normal and the bot on Hard and Insane (difficulty gradient).
- Nothing has been tried on a real phone: touch feel, real GPU rendering (Phaser texture-unit hazard, DECISIONS 66, seen only on SwiftShader), real audio output and frame rate are all unchecked. Everything was seen in headless Chromium with software WebGL. Audio was measured, never listened to.
- The browser tests loop over `MISSIONS`; a win is asserted only for mission 1 (`missions.spec` asserts why each battle ended, not who won).
- Balance (Phase 4 track balance, `docs/BALANCE.md`, `docs/progress/balance.md`): on Normal the bot wins all 16 seeds of every mission inside its expected minutes and the idle commander loses all; Insane is clearly harder than Normal on 9 of 10 missions (not mission 1, which ends in about 3 minutes on every difficulty); Hard keeps Normal's 100 percent in missions 1, 4, 5, 6 and 10 and differs only by slower wins there (hardly at all in 1 and 5). Bot win rates on Hard and Insane swing by 10 to 20 points between seed ranges (armour fights in missions 7, 8 and 10), so the gradient test compares with a two-seed tolerance. The Typhoon does about 250 damage per pass to the 2600 hp King Tiger (PIAT Teams are the answer; `supports.ts` tuning). The test bot shows no gain from the Sniper or Medic (DECISIONS 147). Garrison men do not count toward the AI's own strength when it judges an attack. Advancing units of one kind still bunch at one x (combat is along x only), so a single shell can hit a whole stack. The balance suite takes about two minutes on an idle machine and much longer while other work loads the CPU (heavy tests carry a 600 s timeout).
- Briefings: at 844x390 the third paragraph runs below the paper's fold and must be scrolled; a scroll cue now says so (polish). The Quartermaster level lines fit on one line.
- Phase 4 (balance, perf-pwa, polish, verify4):
  - Hard wins as often as Normal (100 percent) in missions 1, 4, 5, 6 and 10 and differs only by slower wins (hardly at all in 1 and 5).
  - Under heavy machine load two browser tests have failed for other tracks and passed on rerun: smoke "mission 5, a player who does nothing" (the retry tap timed out) and sandbox "wins ground" (the player lost the proving ground at 40x). Both passed in two full runs on an idle machine (DECISIONS 213). The balance suite's run time also depends heavily on load.
  - The quality governor reads frame time only: the 30 fps cap of iOS Low Power Mode will push it to its lowest level, and in headless software WebGL it reaches the lowest level in the heavy mission 10 window (frame interval p95 about 28 ms). A new service worker in development replaces an open tab only after all its tabs close.
  - Taps in the pause menu are silent (pause suspends the audio context). A Quartermaster double tap buys two levels (refunds are free; `campaign.spec` buys two levels in a row on purpose).
  - In missions 2 to 10 the scripted hint, a wave banner and a new-unit or new-support tip can be up together for a few seconds; they do not overlap at 844x390 (DECISIONS 214).
- Campaign track (DECISIONS 158 to 166): the Quartermaster, difficulties, the ten-pin campaign map and the save run on the real data. Browser specs `tests/e2e/campaign.spec.ts` (a real clear of mission 1 twice, two points once, buying and refunding through taps, reload, damaged/old/overspent saves) and `tests/e2e/missions.spec.ts` (all ten missions from the map by taps) passed with the rest of the suite (70 tests) on a fresh build; pictures `docs/screenshots/e2e-campaign-*.png`, `e2e-mission-NN*.png`. The missions spec reads the mission data at test time, so rebuild after any mission edit before running it. In the mission pictures: mission 5 lost by a keen player with a mass of riflemen (draft tuning). Rain over the desert in mission 4 is kept on purpose (DECISIONS 171).
- A win can show "Kills 0": the AI shelters its whole army in its HQ when outnumbered and units inside cannot be hit (DECISIONS 80). The AI now leaves Fall Back as soon as its HQ is not threatened and commits when ahead (DECISIONS 116): mirrored mission 1 AI-vs-AI is 25/23/0 undecided over 48 seeds (was 28% undecided after an hour) and the mirrored proving ground 96/104/0 over 200 seeds, but mirrored mission-1 battles still last 22 minutes on average (small rifle-only armies trade evenly).
- Phase 2 sim events (`projectile`, `explosion`, `supportIncoming`, `smokeSpawned`, `wireDestroyed`) are now seen from the real sim in the built game (proving-ground spec and `tools/qa.ts --only=sandbox`), but only judged by eye there; their renderer unit checks still use injected events. The `airdrop` and `planeFlyby` sounds start on a fixed lead time. The `sim-orders` contact-gap test uses a sniper walking up to a pillbox, which holds only while pillbox guns are not simulated; Phase 2 must adjust it. Whoever adds smoke must keep `World.smokeCount` in step.
- Particles are hard-capped at 1000 (perf-pwa; a heavy battle used to reach 1219). Phaser has its own chunk (1375 kB, 357 kB gzipped); `chunkSizeWarningLimit` is 1500 to match.
- The browser suite (95 tests) takes about 37 minutes on an idle machine because it plays real battles in software WebGL; run a single spec with `x.cmd npx playwright test tests/e2e/smoke.spec.ts -g "<title>"`.
- View polish 2 (track view-polish, DECISIONS 98 to 106) fixed the small figures (now about 55 CSS px on a 390 px screen), the one-frame turn, the clumped firing line (spread behind the leader, two firing tiers), cut-off HQs, bodies hovering, the small crate, the subtle anti-tank reload and medic idle, and the two renderer layering bugs. Still: a big firing line is spread by the view only (men may be drawn up to 80 wu behind their sim x), and a tank crossing a trench is drawn over men in the nearer rows for that moment. Seen only in headless Chromium at fixed 16 ms frames. Both British tank slots use the Churchill look.
- Backdrops: foreground items sit mostly under the HUD. `tools/shot.ts` needs `'"path?a=1&b=2"'` quoting for URLs with `&` under `x.cmd`; the backdrop `?sheet=` modes need `--wait=3000`.
- Structures: trenches narrower than 104 wu are drawn at 104 wu.
- HUD: at 568x320 only five or six training buttons are visible and the rest scroll. Labels were not checked with a very wide font.
- Menus: on the 568x320 campaign view the map pans; mission pins sit over some map labels. A screen that is leaving stays in the page for its fade (marked `inert`), so tests must pick the arriving one (`.th-screen.is-in`).
- Renderer: fling inertia is strong on fast synthetic drags (`RENDER.camera.inertiaDecay`). Phase 2 visuals were checked with scripted puppet scenes (`dev/render-preview.html?scene=...`) and briefly with the real Phase 2 sim in the preview.
- Audio: low sounds such as `uiDeny` may be quiet on phone speakers.
- Phase 2 in the browser (track app, `tests/e2e/sandbox.spec.ts`, DECISIONS 119 to 125): the proving ground is driven with real taps (training one of every unit, each call-in, tap-to-control, joystick, FIRE, release, a captured trench and a razed pillbox); screenshots `docs/screenshots/e2e-sandbox-*.png`. Still open: the training bar scrolls on smaller phones: all nine buttons fit at 844x390, about seven and a half at 667x375 and five or six at 568x320; in control mode about seven and a half fit beside the joystick at 844, four and a half at 667 and three at 568 (every button was tapped after scrolling; nine 48 px buttons cannot sit beside the orders below 844). Explosive damage is not reduced in a trench (matrix 1.0), so the German AI's first barrage can kill a whole six-man trench at once.
- Phase 2 visual QA (track verify2): a controlled man who walks back into a full trench stands sunk among the occupants without a slot (the view dips anyone inside the trench's width; the sim gives cover only with a slot). Health bars of men on far rows no longer draw over a tank in front of them (verify4, DECISIONS 211). The mortar tube in the art leans slightly back toward the crew (the launch flash follows the tube). In a big push a grenade is small at DSF 1 and hard to pick out in a full-screen shot (clear in the film strip). The held FIRE button only brightens a little. All of it seen in headless Chromium with software WebGL only.

## Paused at the usage limit (2026-11-07)
- Per-unit-type orders: done and pushed (eabd869). Confirm the GitHub Actions deploy went green and the live build matches.
- Owner request "change unit max count to 100": work in progress on branch `wip/popcap-100` (not on main). Done there: `CONFIG.popCap` 100; the AI's "army is full, attack" trigger now uses a fixed `AI.attackArmyPop` (40) so the AI does not wait for 90 men (with it, all 191 balance tests pass); the economy cap test now fills the field with riflemen first. Still failing: `tests/unit/sim-sandbox.test.ts` "keep every invariant" sees no pillbox destroyed in 20 AI-vs-AI proving-ground battles (passes at cap 40; still fails after lengthening the run to 360 s). Investigate why bigger armies never break a pillbox, fix, merge to main, push to live. Then continue `docs/QUEUE.md` from job 2 (Quartermaster upgrade looks).
