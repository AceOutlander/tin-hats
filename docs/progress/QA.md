# QA (Phase 1 visual QA pass)

Done: three capture/critique rounds at 844x390 and 667x375 with tools/qa.ts (`x.cmd npx tsx tools/qa.ts [--w=667 --h=375] [--only=main,strips,defeat,rain,hud]`, output .tools/shots/qa).
Fixes (view only, DECISIONS 81-85): __TH.units(); wider depth rows, row stagger, crowd spread; door funnel + doorway shade + rim fade; bodies under the living; training puff at the feet; per-soldier carry style.
Final pictures: docs/screenshots/qa1-*.png. Docs: PROGRESS.md, DECISIONS 81-85.
Checks: typecheck, sim tsc, lint, unit tests green; build + e2e run at the end, then commit "Phase 1 visual QA pass".
