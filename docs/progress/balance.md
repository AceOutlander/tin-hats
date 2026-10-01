# balance track (Phase 4: balance tests and tuning)
Done (milestone 1): matrix/weapons (mortar and grenade hit vehicles, AT 0.17 vs infantry, tank guns no longer prefer AT), matchup harness fix (no-trench defenders hold the line), AI fixes (no Fall Back from a far forward line, attack judged on plain value, smoke not against armour, deadline rush, reserve arrives at its scripted post), mission tuning (m3, m5, m6, m7, m10, expected minutes), harsher Insane. New: src/sim/balanceRuns.ts, tests/balance/missions.test.ts, difficulty.test.ts, helpers.ts, tests/unit/sim-difficulty.test.ts; matchups and mirror tests extended. All green: balance 191 tests in 125 s, unit 737.
In progress: regenerate docs/BALANCE.md with mission and mirror tables (tools/balance-table.ts), DECISIONS, PROGRESS known issues.
Next: final checks and commit.
Scratch tools (not committed, .tools/): balmis.ts, par.ps1, variant.ts, vpar.ps1, mt.ts, mtrace.ts, ktrace.ts, duelt.ts.
