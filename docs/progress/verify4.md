# Track verify4 (Phase 4 verification): IN PROGRESS
Done: merged tree green before any change (typecheck, sim typecheck, lint 0, unit 49/746, balance 7/191 in 107 s, build clean, e2e 95/95 in 36.8 min). Perf: m10 0.56 ms JS/frame, sandbox at 4x CPU 3.55 ms (budget 6). Captures 844x390 in .tools/shots/v4/r1..r4 (scratch script .tools/shots/v4/cap.ts), final docs/screenshots/phase4-*.png, all looked at.
Fixed: health pips per row layer (src/render/layers.ts, units.ts, view.ts, data/render.ts pipRowLift); tools/perf.ts script-time label under throttle.
In progress: full e2e re-run on the final tree. Next: PROGRESS.md, DECISIONS.md, final commit.
