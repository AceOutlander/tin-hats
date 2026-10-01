# APP (app glue, screen flow, debug hooks, e2e)

Status: DONE. All checks green (typecheck, sim typecheck, lint, 28 unit files / 433 tests, build, 8 e2e tests).

Built: src/data/app.ts + meta.ts, src/meta (save, campaign), src/app (loop, hudModel, session, app, campaignView, sfx, debug, page, upgrades), src/main.ts, index.html, tests/e2e/smoke.spec.ts, unit tests app-*.test.ts and meta-*.test.ts. Screenshots in docs/screenshots/e2e-*.png.
Also fixed (outside my paths, needed for the integrated game): HUD CSS class names that collided with the menu CSS (DECISIONS 62).

Next (for others): when missions 2 to 10 exist the e2e loop covers them (win asserted only for mission 1; others must reach a result screen and save progress exactly when won). Check that the renderer's sound pass does not also play the victory/defeat stings. When src/data/upgrades.ts exports UPGRADES the Quartermaster fills in. Phase 2 flips SIM_FEATURES.supports and directControl; the app wiring is in src/app/session.ts and is unit tested with the flags on.
