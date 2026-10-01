# Track polish: tutorial, sound, UI polish: DONE

Done
- A, tutorial: `src/data/tutorial.ts` (steps as data), `src/app/tutorial.ts` (driver, `TipMemory` under key `tinhats.tips`), HUD bubble and pulsing ring (`src/ui/hud`), pointer tips for the unit and support a mission introduces, Settings "Replay tutorial". Tests: `tests/unit/app-tutorial.test.ts` (27), `tests/e2e/tutorial.spec.ts` (4).
- B, sound: eight new synthesised sounds played from `src/app/sfx.ts`; mix measured in `dev/audio-preview` (phone-filtered punch next to a rifle shot, blasts over 80 units firing) and retuned; gunfire bed ducks under blasts (`src/audio/engine.ts`); a hidden page suspends the audio; mute works in battle, pause menu and settings and is saved. Tests: `app-sfx`, `audio-engine`, `audio-sounds`, `tests/e2e/audio.spec.ts` (2).
- C, UI polish: scroll cue on the briefing and the Quartermaster, Quartermaster cards wide enough for their level lines, map lettering moved off the pins, double-tap guards (screen arrival, HUD same-spot), all screens checked at 568x320, 640x360, 667x375, 844x390, 932x430, 1000x412 by `tests/e2e/polish.spec.ts` (touch targets, overflow, overlaps, cut-off text) and by eye. Health pips over a tank is a renderer layering problem (DECISIONS 200), handed over.

Checks on the final tree: typecheck, sim typecheck, lint (0 warnings), 49 unit files (746 tests), production build, browser specs tutorial 4/4, audio 2/2, polish 14/14, campaign 15/15, missions 10/10, smoke and sandbox all but two that depend on real time under load or on balance (see the final report).

Resuming: private e2e setup is `.tools/pw-polish.config.ts` (port 4390, build in `.tools/dist-polish`):
`x.cmd npx vite build --outDir .tools/dist-polish --emptyOutDir` then `x.cmd npx playwright test -c .tools/pw-polish.config.ts tests/e2e/<spec>` (do not use `|` inside `-g` under x.cmd).
Scratch tools (not committed): `.tools/shots/polish/audit.ts` (every screen at six sizes), `.tools/shots/polish/audio-report.ts` (prints the audio preview's table).
