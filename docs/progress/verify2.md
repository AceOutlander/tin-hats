# Track verify2 (Phase 2 verification and visual QA)

Done
- Baseline checks on the starting tree: typecheck, sim typecheck, lint, unit (38 files, 561), balance (2 files, 20), build (no warnings) all green.
- tools/qa.ts: new `--only=sandbox[,sbstrips]` run on the proving ground (scenes `<w>-sb-*.png`, strips). debug units() now has actionTime and trench.

In progress
- Baseline e2e run, then first capture round at 844x390 and 667x375.

Next
- Review captures, fix view issues, second round, final copies to docs/screenshots/phase2-*.png, docs, commit.
