# Track app (Phase 2 wiring and browser test): DONE

Done
- Session and HUD model no longer guard on SIM_FEATURES (all true); app tests no longer force the flags.
- Event tally in the session (support calls, smoke, blasts, captures, ruins, control lost, controlled man's shots).
- Camera follows a controlled man with a dead zone (APP.follow), leaves a dragged view alone.
- Debug hooks: startSandbox(seed, mirror), grantPopulation, state() with controlled, supports, targeting, smokes, trenches, pillboxes, wires, tally; camera().cssPerWu.
- App.beginUnlisted(mission) for grounds outside the campaign (never saved, restart keeps the mission). Tank ability label is now "Hull MG".
- Unit tests: app-session on the real sim (supports, control, ability, death, camera, pause), app-hud (proving ground), app-debug, app-flow.
- tests/e2e/sandbox.spec.ts: 14 tests on the production build, real touches; pictures docs/screenshots/e2e-sandbox-*.png.
- Checks: typecheck, sim typecheck, lint, 38 unit files (561 tests), build, 29 browser tests, all green.

Open (see PROGRESS known issues)
- Selection ring hides behind the front parapet for a man in a trench (src/render/effects/markers.ts, not mine).
