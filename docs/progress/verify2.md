# Track verify2 (Phase 2 verification and visual QA)

Done
- Baseline checks green (typecheck, sim typecheck, lint, unit 38/561, balance 2/20, build, e2e 29/29).
- tools/qa.ts `--only=sandbox[,sbstrips]` proving-ground capture; debug units() actionTime + trench, projectiles() hook.
- Five capture/review rounds at 844x390 and 667x375. Fixes (DECISIONS 126-131): mortar flash along the tube, ring over
  the parapet, pillbox draw slot between rows 1 and 2, aircraft altitude 200, control camera looks ahead (APP.follow.lead).
- Final pictures docs/screenshots/phase2-*.png (42). PROGRESS.md and DECISIONS.md updated.
- Final checks: typecheck, sim typecheck, lint, unit 38/563, balance 2/20, build all green.

In progress
- Nothing. Final e2e: 29 passed. Committed as "Phase 2 verified: fortifications, full roster, control, supports".

Next
- Nothing in this track.
