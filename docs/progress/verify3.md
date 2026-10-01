# Track verify3 (Phase 3 verification and visual QA): DONE
Done: sim wave reserve (pop cap kept, strict invariant restored), 'garrison' behaviour (m06, m08, m10 rear lines), aiPopCapMul, tests/unit/sim-reserve.test.ts; debug autopilot; tools/qa.ts --only=missions,campaign; trenches redrawn as pits in the theatre's earth; no dump without sappers (m09); balanced objective plate; shorter Quartermaster lines; missions.spec m5 clock race and smoke.spec hook list. DECISIONS 167 to 175.
Captures: three rounds (.tools/shots/v3a, v3b, v3c, v3final), final docs/screenshots/phase3-*.png, all looked at.
Final checks: typecheck 0, sim typecheck 0, lint 0 warnings, unit 43 files / 640 tests, balance 5 files / 129 tests, build ok, e2e 69 of 70 in the full run; the one failure (smoke "debug hooks are present", exact key list lacked the new `autopilot`) fixed in the spec and re-run green (4 of 4 in that group).
In progress: nothing. Next: Phase 4 balance (see PROGRESS known issues).
