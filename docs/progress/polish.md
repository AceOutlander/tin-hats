# Track polish: tutorial, sound, UI polish

Done (A, tutorial): src/data/tutorial.ts (steps as data), src/app/tutorial.ts (driver, TipMemory), HUD bubble + pulsing highlight (src/ui/hud), tips stored under their own key `tinhats.tips` (save format untouched), settings "Replay tutorial", unit tests tests/unit/app-tutorial.test.ts (27), tests/e2e/tutorial.spec.ts (4, green), missions.spec skips mission 1 scripted hints.
Done (B, sound): 8 new synthesised sounds (grenadeThrow, smokePop, wireSnap, pillboxCollapse, supportCall, trenchCaptured, waveHorn, timerTick) played from src/app/sfx.ts; levels measured in dev/audio-preview (phone-filtered punch next to a rifle shot, plus blasts over 80 units firing) and retuned; gunfire bed ducks under blasts in the engine; page hidden suspends audio; tests app-sfx, audio-engine, audio-sounds, e2e audio.spec (2, green).
In progress: C UI polish and viewport audit.
Next: B, C, final checks, DECISIONS, report.

Notes for resuming: private e2e setup is `.tools/pw-polish.config.ts` (port 4390, build in `.tools/dist-polish`):
`x.cmd npx vite build --outDir .tools/dist-polish --emptyOutDir` then `x.cmd npx playwright test -c .tools/pw-polish.config.ts tests/e2e/<spec>`.
Two sim-sandbox unit tests fail from the balance engineer's tuning in progress (not mine).

