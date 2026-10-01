# SIM track progress (Phase 2, part 1: fortifications, projectiles, full roster)
Done: trenches (src/sim/trenches.ts: slots, drop-in, capture, hold trench, overflow), pillbox guns + rubble (structures.ts shares the structure-gun code with the HQ), wire slow/splash/crush, projectiles + splash + smoke (src/sim/projectiles.ts), roster (lmg/mortar set-up 'deploy', assault grenades 'throw', mortar dug-in preference + followsLine, sniper priorities, medic heal, AT preferStructures, tank coax, guard leash), sandbox missions (src/data/missions/sandbox.ts), contact-gap test fixed (toughened sniper). SIM_FEATURES trenches/pillboxes/wire/projectiles = true. Existing sim tests green (89).
In progress: new tests (sim-trenches, sim-structures, sim-projectiles, sim-roster, sim-matrix, sim-sandbox).
Next: sim-cli --mission sandbox, full unit suite, lint, DECISIONS lines, report.
Scratch probes live in .tools/*.ts (not committed).
