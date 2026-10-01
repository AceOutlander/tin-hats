# SIM track progress (Phase 2, part 2: direct control, supports, AI, matchup harness)
Part 1 (trenches, pillboxes, wire, projectiles, roster, sandbox) is done and committed (614aea6, c077249, 3aecfdc).
Done (part 2, milestone 1): direct control (src/sim/control.ts), supports (src/sim/supports.ts), SIM_FEATURES directControl/supports = true, matchup harness (src/sim/matchup.ts, src/data/balance.ts, tools/balance-table.ts), tests/balance/matchups.test.ts green (19), combat tuning (fire spread config.targetSpread, switchAimFrac, burst carries over, engageSpread 100, grenades only at trenches/pillboxes/HQ, unit and weapon numbers).
In progress: AI (reactions, supports, trench-aware holding, stalemates), mirror test, mission-1 check (sim-battles mission-1 mirror share was 0.34 < 0.35 after tuning).
Next: unit tests for control and supports (tests/unit/sim-control.test.ts, sim-supports.test.ts), sim-cli --mission mirror, docs/BALANCE.md, DECISIONS.
