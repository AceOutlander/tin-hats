# Progress

If you lose track, read this file and carry on from "In progress" and "Next".

## Done
- Phase 0: project-local toolchain (Node 24, git, Chromium for Playwright in `.tools`), Vite + TypeScript + Phaser 4.2.1 scaffold, ESLint, Vitest and Playwright configs, shared contracts (`src/data/schema.ts`, `src/data/view.ts`, `src/data/factions.ts`, `src/ui/contracts.ts`, `src/art/types.ts`), docs (`PLAN.md`, `DESIGN.md`, `AGENT_GUIDE.md`, `DECISIONS.md`).
- Phase 1 foundations, merged and checked by the integration gate (typecheck, sim typecheck, lint with zero warnings, 22 unit test files, build):
  - sim core (`src/sim`, `src/data`, `tools/sim-cli.ts`): economy, training, three orders, rifle combat, HQ gun, AI and bot commanders, mission 1. Trenches, pillboxes, wire, projectiles, direct control and supports are marked stubs for Phase 2 (`SIM_FEATURES`).
  - figure animation (`src/art/figure`): skeletal pose and animation for every infantry kind, deaths, 2D canvas fallback and icon painter.
  - backdrops (`src/art/backdrops`): seven theatres, five times of day.
  - structures, vehicles, props (`src/art/structures`, `vehicles`, `props`): HQs, flags, trenches, pillbox, wire, tanks, aircraft, supplies, decals.
  - effects and weather (`src/art/fx`, `src/fx`): particle presets and sprites, weather controller, lightning, rain, screen shake.
  - HUD (`src/ui/hud`) and menus (`src/ui/screens`, `src/ui/shell`): all screens and the battle HUD, checked at five phone sizes.
  - audio (`src/audio`): WebAudio synthesiser with 29 sounds.
  - integration: `tests/unit/art-keys.test.ts`, `tests/unit/seams.test.ts`, `src/art/icons.ts` (`paintUnitPortrait`), weapon sound ids fixed. All seven `dev/*.html` pages load with no console problems. Per-track notes are in `docs/progress/`.

## In progress
- Nothing is mid-flight. The next engineers start on the renderer and the app glue.

## Next
- Phaser battlefield renderer core (`src/render`): rasterise all `SpriteSpec`s and backdrop layers into textures, unit views driven by `src/art/figure`, structures, tanks, camera drag, minimap feed, interpolation.
- Effects and weather view on top of `src/fx` and `src/art/fx`.
- App glue (`src/app`): fixed-step game loop, `HudState` builder from `battle.state`, `AppApi`, screen flow, `src/meta` save data, audio hookup (`unlock()` on first pointer event, `setListener`, `suspend`/`resume`), `?debug=1` hooks, browser smoke tests.
- Phase 2: trenches, pillboxes, wire, damage matrix, full roster, direct control, supports, matchup tests.
- Phase 3: ten missions, briefings, campaign map data, Quartermaster, difficulties, saving.
- Phase 4: balance tests and tuning, performance, PWA and offline, sound, tutorial hints.
- Final verification passes, then `docs/MORNING_REPORT.md`.

## Known issues
- The build is limited by the Claude plan's usage caps, not by the work: one 5-hour window was used up in 29 minutes. Subagents now run on cheaper models and checkpoint as they go.
- `npm run build` currently builds only the scaffold entry (`src/main.ts`); the game itself is not wired in yet.
- Sim: about 28% of mirrored AI-vs-AI battles are undecided after an hour (Phase 4 tuning). The `sim-orders` contact-gap test uses a sniper walking up to a pillbox, which holds only while pillbox guns are not simulated; Phase 2 must adjust it. Whoever adds smoke must keep `World.smokeCount` in step.
- Figures: dead bodies can rest up to about 2 wu above the ground; the anti-tank reload hand motion and the medic's idle arms are subtle. Both British tank slots use the Churchill look.
- Backdrops: foreground items sit mostly under the HUD. `tools/shot.ts` needs `'"path?a=1&b=2"'` quoting for URLs with `&` under `x.cmd`; the backdrop `?sheet=` modes need `--wait=3000`.
- Structures: trenches narrower than 104 wu are drawn at 104 wu.
- HUD: at 568x320 only five or six training buttons are visible and the rest scroll. Labels were not checked with a very wide font.
- Menus: on the 568x320 campaign view the map pans; mission pins sit over some map labels.
- Audio: nothing was listened to, only measured. Low sounds such as `uiDeny` may be quiet on phone speakers.
