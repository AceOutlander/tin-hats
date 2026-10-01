# Track app (Phase 2 wiring and browser test)

Done
- Session/HUD model no longer guard on SIM_FEATURES (all true). Event tally in the session (support calls, smoke, explosions, captures, control lost, shots of the controlled man).
- Camera follows the controlled man with a dead zone (APP.follow), leaves a dragged view alone.
- Debug hooks: startSandbox(seed, mirror), grantPopulation, state() with controlled, supports, targeting, smokes, trenches, pillboxes, wires, tally; camera().cssPerWu.
- App: beginUnlisted(mission) for grounds outside the campaign (never saved, restart keeps the mission). Ability label "Hull MG" (the tank's label was cut off).
- Unit tests: app-session (real sim), app-hud (proving ground), app-debug, app-flow extended.
- tests/e2e/sandbox.spec.ts (14 tests) written and passing one by one.

In progress
- Full suite run, screenshots review, commit.

Next
- Nothing else planned in this track.
