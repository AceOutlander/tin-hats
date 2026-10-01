# SIM track progress (Phase 2, part 2: direct control, supports, AI, matchup harness)
Part 1 (trenches, pillboxes, wire, projectiles, roster, sandbox) committed earlier (614aea6, c077249, 3aecfdc).
Done (part 2): direct control (src/sim/control.ts), supports (src/sim/supports.ts), SIM_FEATURES all true; AI reactions, supports, trench-aware orders with hysteresis, Fall Back only under HQ threat, commit when ahead (src/sim/commander.ts); mirror symmetry fix (trench slot ties); no per-tick allocation (class records); matchup harness (src/sim/matchup.ts, src/data/balance.ts, tools/balance-table.ts -> docs/BALANCE.md); balance pass; sim-cli --mission sandbox|mirror; tests sim-control, sim-supports, tests/balance/matchups + mirror. DECISIONS 107-118.
Results: mirrored proving ground 96/104/0 undecided over 200 seeds; mirrored mission 1 25/23/0 over 48; mission 1 bot beats AI 10/10 in about 3.1 min, idle loses.
In progress: final checks and commit. Next: nothing in this track.
