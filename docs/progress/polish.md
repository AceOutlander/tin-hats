# Track polish: tutorial, sound, UI polish

Done (A, tutorial): src/data/tutorial.ts (steps as data), src/app/tutorial.ts (driver, TipMemory), HUD bubble + pulsing highlight (src/ui/hud), tips stored under their own key `tinhats.tips` (save format untouched), settings "Replay tutorial", unit tests tests/unit/app-tutorial.test.ts (27), tests/e2e/tutorial.spec.ts (4, green), missions.spec skips mission 1 scripted hints.
In progress: B sound audit and mix (dev/audio-preview), then C UI polish and viewport audit.
Next: B, C, final checks, DECISIONS, report.

Notes for resuming: private e2e setup is `.tools/pw-polish.config.ts` (port 4390, build in `.tools/dist-polish`):
`x.cmd npx vite build --outDir .tools/dist-polish --emptyOutDir` then `x.cmd npx playwright test -c .tools/pw-polish.config.ts tests/e2e/<spec>`.
Two sim-sandbox unit tests fail from the balance engineer's tuning in progress (not mine).
