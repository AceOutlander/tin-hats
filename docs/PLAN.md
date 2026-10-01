# Tin Hats: plan

A 2D side-view WW2 real-time strategy game for phone browsers. Detailed rules are in `docs/DESIGN.md`.

## Architecture

```
src/data     Every tunable number and all content (units, weapons, damage matrix, factions,
             missions, upgrades, supports, difficulty, AI, weather, view constants). Types in schema.ts.
src/sim      Deterministic simulation. Fixed 30 Hz tick, seeded RNG, no Phaser, no DOM.
             battle (create, step), systems (economy, training, orders, movement, combat,
             projectiles, structures, supports, mission events), commanders (AI, bots).
src/meta     Campaign progress, upgrades and save data. Pure, storage injected.
src/art      Canvas 2D drawing code and the stick-figure pose system. No Phaser.
src/fx       View-only logic with its own RNG: weather controller, particle maths.
src/render   Phaser 4 battlefield scene: layers, unit views, effects, weather, camera, picking.
src/ui       DOM HUD and menu screens, written against src/ui/contracts.ts.
src/audio    WebAudio synthesiser.
src/app      Glue: game loop (fixed-step accumulator, pause, focus), HUD model, screen flow, debug hooks.
tests/unit   Vitest: simulation, meta, pose and weather logic.
tests/balance  Headless balance and mission tests.
tests/e2e    Playwright smoke tests on the production build, phone landscape with touch.
tools        Headless sim CLI, balance table generator, screenshot helper, icon generator.
dev          Preview pages for art and UI (dev server only, not part of the build).
```

Data flows one way: input becomes commands, the sim steps, the view reads state and events.
`tsconfig.sim.json` compiles `src/sim`, `src/data` and `src/meta` without DOM types, and ESLint bans Phaser, DOM globals,
`Math.random` and `Date.now` there, so headless purity is enforced by the tools.

## Data schemas

All in `src/data/schema.ts`: `UnitDef`, `WeaponDef`, `DamageMatrix`, `FactionDef`, `SupportDef`, `UpgradeDef`,
`DifficultyDef`, `MissionDef` (with `TrenchDef`, `PillboxDef`, `WireDef`, `SideStart`, `ForceDef`, `MissionEventDef`,
`MissionAiPlan`). View constants (`VIEW`, `DEPTH`, `PARALLAX`) are in `src/data/view.ts`.
UI view models are in `src/ui/contracts.ts`; art contracts in `src/art/types.ts`.

## Missions

| # | Mission | Mode | Theatre | New |
| --- | --- | --- | --- | --- |
| 1 | Arras, France, 1940 | assault (tutorial, rifles only) | france | supplies, training, orders |
| 2 | Dunkirk perimeter, 1940 | survival 4 min | france, overcast | Bren Gunner |
| 3 | Operation Crusader, Libya, 1941 | assault, first enemy trench | desert | Assault Trooper |
| 4 | El Alamein, Egypt, 1942 | assault, two trench lines, wire, pillboxes | desert | Mortar Team, Artillery Barrage |
| 5 | Primosole Bridge, Sicily, 1943 | assault with deadline (nightfall) | sicily, dusk | Sniper |
| 6 | Monte Cassino, Italy, 1944 | assault, three fortified lines | italy | Medic, Smoke Screen |
| 7 | Sword Beach, Normandy, 1944 | assault from a weak beachhead, late panzer counter-attack | normandy | PIAT Team |
| 8 | Hill 112, Normandy, 1944 | assault, open ground, armour | france | Churchill Tank |
| 9 | Arnhem Bridge, Netherlands, 1944 | survival 6 min, no tanks, no sappers, airdrops | holland | (none) |
| 10 | Siegfried Line, Reichswald, 1945 | assault, four trench lines, King Tiger boss | germany | Typhoon Air Strike |

## Tasks by phase

Phase 0, foundation (done first)
- Project-local toolchain, scaffold, lint, type-check, test and build pipeline, contracts, docs.

Phase 1, playable slice
- Sim core: battle loop, economy and sappers, training, three orders, rifle combat, HQ gun, basic AI, win and lose.
- Art: stick-figure pose and animation system, figure parts for every unit kind, seven theatre backdrops, structures, vehicles, props, effects, weather logic.
- Phaser battlefield renderer with interpolation, layering, camera drag and minimap.
- DOM HUD and screens, app glue, audio engine.
- Mission 1 end to end, unit tests, browser smoke test, screenshots reviewed.

Phase 2, full combat
- Trenches, pillboxes, wire, damage matrix, full roster, direct control, support call-ins.
- Headless simulator CLI and unit matchup tests.

Phase 3, campaign
- All ten missions with scripted events, briefings, campaign map, Quartermaster upgrades, difficulties, saving.

Phase 4, balance and finish
- Mission balance tests with the bots and tuning, `docs/BALANCE.md`.
- Performance pass, PWA and offline support, sound polish, tutorial hints.

After every phase: strict type-check, lint, production build, unit tests, Playwright smoke tests with screenshots reviewed by eye.

Final verification: spec checklist, clean-install rerun, all missions on all difficulties over several seeds, 30-minute soak test, edge cases, code read-through, repeated until two passes in a row find nothing. Then `docs/MORNING_REPORT.md`.
