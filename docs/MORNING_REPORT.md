# Morning report: Stalingrad (final, 2026-11-09)

**Stalingrad is NOT live and has not been pushed anywhere.** It waits on the `stalingrad` branch until you say
"push to live". Pushing it also means updating the Tin Hats card text on hunteracedev.com (your spec).

## What's built

A whole new Soviet campaign, from Brest in June 1941 to the end of the Stalingrad pocket in January 1943, replacing the
old British placeholder missions. Ten long missions with phases, objectives and scripted events, each tuned so a bot on
Normal wins in about 15 to 26 minutes.

- **Campaign map:** the ten missions at their real places, a front line that moves with the date.
- **The ten missions:**
  - 1001 Brest Fortress: hold the citadel until nightfall.
  - 1002 Dubno: take the crossroads, hold them until dusk, destroy twelve panzers.
  - 1003 The Volokolamsk Highway: Panfilov's men hold the halt, then Katukov's tanks strike back.
  - 1004 The Road to Klin: a winter attack through the forest, across the highway, into Klin.
  - 1005 Crossing the Volga: land, clear the bank, take and keep the central station.
  - 1006 Mamayev Kurgan: take the summit and hold it.
  - 1007 The House on the Square: take Pavlov's House, hold it until the counter-offensive.
  - 1008 The Tractor Factory: hold the factory until dark; keep the Germans off the river.
  - 1009 Operation Uranus: break through, take the Kalach bridge, link up at Sovetsky.
  - 1010 Operation Ring: clear the pocket and take the German HQ in the Univermag.
- **Basic Training:** a guided lesson on its own, now played as the Red Army, with a Deploy lesson and lent call-ins.
- **Money** instead of Supplies everywhere, with a banknote icon.
- **Prep phase** in defensive missions: build wire, foxholes, trenches and pillboxes before the enemy moves.
- **Soviet units and uniforms:** helmets, pilotkas, ushankas, quilted jackets, snow smocks; Mosin, PPSh, DP, PTRD,
  Maxim; T-34, KV-1, KV-2, T-60, the Katyusha truck; Il-2, Pe-2, Po-2 and more.
- **Era-correct Germans:** names and looks follow the date; from mid-1942 the later Panzer III (long gun, spaced armour),
  the long Panzer IV and the StuG; Romanians at Uranus.
- **Briefings with intel:** enemy and friendly forces for every mission.
- **Unlocks per mission:** each mission brings a new unit (DP gunner, T-34, PPD trooper, Sanitarka and militia,
  flamethrower, sniper, lieutenant, carrier) and some a new call-in.
- **Music for every mission:** ten battle tracks plus the map track.
- **Medal economy:** call-ins cost charges bought with medals in the **Shop**; upgrades use their own points.
- **Realistic artillery:** the guns are off the map; shells arrive one by one with a whistle; a faint marker for yours.
- **Tank cannons:** long reload, hard hit; the blast throws men and wrecks fortifications.
- **Begin under 2 seconds:** the battle starts on the calm music while the rest loads.
- **Labels that fit** every unit button, and **Deploy** sits in the bottom bar, not over the battlefield.

## Screenshots

These live on this computer only (the screenshots folder is not in git), so the pictures show when you open this file
in the `C:\dev\tin-hats-stalingrad` folder.

- ![1001](screenshots/stalingrad-mission-1001.png) 1001 Brest: Germans storming in by the citadel, phase 2 of 3.
- ![1002](screenshots/stalingrad-mission-1002.png) 1002 Dubno: T-34s hold the crossroads while a panzer burns.
- ![1003](screenshots/stalingrad-mission-1003.png) 1003 Volokolamsk: a Panzer III in the snow at the halt.
- ![1004](screenshots/stalingrad-mission-1004.png) 1004 Klin: the forest edge as the weather clears and the Il-2s can fly (a quiet moment).
- ![1005](screenshots/stalingrad-mission-1005.png) 1005 Volga: riflemen and mortars storm the central station.
- ![1006](screenshots/stalingrad-mission-1006.png) 1006 Mamayev Kurgan: the fight at the water tanks.
- ![1007](screenshots/stalingrad-mission-1007.png) 1007 Pavlov's House: day two, a lone rifleman in the ruins (a quiet moment).
- ![1008](screenshots/stalingrad-mission-1008.png) 1008 Tractor Factory: T-34s and panzers duel in the yard.
- ![1009](screenshots/stalingrad-mission-1009.png) 1009 Uranus: PTRD teams cross the snowy steppe to a Romanian trench.
- ![1010](screenshots/stalingrad-mission-1010.png) 1010 the Ring: T-34s against a Panzer IV in the western ruins.
- ![Basic Training](screenshots/stalingrad-basic-training.png) Basic Training: the new Deploy lesson.
- The campaign map: `screenshots/e2e-campaign-stalingrad-map.png` (taken by the browser tests).

The 1004 and 1007 pictures show quiet moments, not the main fight; I ran out of time to retake them.

## Checks (all on the final code)

- Typecheck, ESLint (whole project) and the build: pass.
- Unit tests: 1,831 of 1,831 pass. Balance tests: 207 of 207 pass.
- Browser tests, full suite on the phone screen (844x390, touch, the Playwright config's own settings): **98 of 135
  passed, 37 failed** on the first run. Almost all failures were old tests still written for the removed British
  missions (wrong mission numbers, a 12-minute clock, prep panels in the way of finger drags, call-ins that now need
  charges). I fixed those tests and three real game problems, but **did not have time to re-run the browser suite**
  after the fixes, so treat it as not green yet. Only the tutorial spec was re-run: 4 of 4 pass.
- Real game fixes: the "New:" tips (the call-in tip now waits until that call-in is on screen, and a closed tip no
  longer leaves its words behind); the briefing's call-in buttons were too small to tap (now full size); the battle
  music could jump back to a layer it had just left after 4 s (now waits the full hold); the map music's loop seam was
  3.2 dB loud (now 0.1 dB).
- Still open from that run: the battle-music memory test fails because a battle holds about 25 MB more than it should
  (Phaser keeps a CPU copy of every backdrop texture; I found the cause but the fix was not finished); "the briefing
  shows no cue when everything fits" fails because Brest's briefing (with intel and call-ins) no longer fits.

## The economy in numbers

- **Medals per mission:** a first win pays 10 (rough) to 20 (perfect) medals on Normal, x1.5 on Hard, x2 on Insane.
  Replays pay half, then a quarter. Finishing the campaign pays a bonus: 400 Normal, 800 Hard, 1,200 Insane. Basic
  Training pays 40 medals once.
- **Call-in charges (Shop, one use each):** smoke 20, artillery 40, recon 60, fighter 150, Il-2 strike 250, Katyusha
  300, bomber 500. New saves start with 3 smoke and 3 artillery. Up to 4 of your own call-ins per battle; some missions
  lend extra charges for free.
- **Upgrade points (Quartermaster):** 5 per mission for a Normal win, 8 Hard, 10 Insane (in all, not on top); 3 for
  Basic Training; every level costs 1. A Normal run buys about half the 93 levels.
- **Poland:** 2,999 medals, about 28 missions of play (Normal, Hard and most of Insane).

## Known issues

- The ten battle tracks have only been measured by the computer, not listened to by a person.
- "Begin under 2 s" was measured on a desktop in headless Chromium only (0.7 to 1.2 s), never on a real phone.
- Difficulty gaps: in some missions Insane is not much harder than Normal (Klin), or Hard sits close to Insane (Tractor
  Factory). These are queued for the difficulty overhaul.
- 1010: the Gumrak phase is short (about 2 minutes), the thinnest part of the mission.
- Bot-only weaknesses: the test bot leaves its HQ (1005) or the mill (1007) unguarded and loses that way; a player
  would see the enemy coming.
- A few long runs: 1005's station hold restarts when the station changes hands, and 1006's summit hold restarts when
  it is lost, so some games run 25 to 35 minutes.
- Basic Training still plays the British "Arras" music track (a Soviet one is a small later change).
- Nothing has been tried on a real phone yet.

## Play these three first

1. **1004 Klin:** changed most (thinner German garrison, the Il-2 lent), and Insane is barely harder than Normal.
2. **1006 Mamayev Kurgan:** if the summit is lost the hold starts again, so some games run 25 to 35 minutes.
3. **1007 Pavlov's House:** the bot's results sit close to a cliff; a little more German fire breaks the house.
