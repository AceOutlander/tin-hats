# Progress

If you lose track, read this file and carry on from "In progress" and "Next".

## Done
- Phase 0: project-local toolchain (Node 24, git, Chromium for Playwright in `.tools`), Vite + TypeScript + Phaser 4.2.1 scaffold, ESLint, Vitest and Playwright configs, shared contracts (`src/data/schema.ts`, `src/data/view.ts`, `src/data/factions.ts`, `src/ui/contracts.ts`, `src/art/types.ts`), docs (`PLAN.md`, `DESIGN.md`, `AGENT_GUIDE.md`, `DECISIONS.md`).
- Phase 1 foundations (merged earlier, per-track notes in `docs/progress/`):
  - sim core (`src/sim`, `src/data`, `tools/sim-cli.ts`): economy, training, three orders, rifle combat, HQ gun, AI and bot commanders, mission 1. Trenches, pillboxes, wire, projectiles, direct control and supports are marked stubs for Phase 2 (`SIM_FEATURES`).
  - art (`src/art`): figure animation for every infantry kind, seven theatre backdrops, structures, vehicles, props, effect sprites.
  - HUD (`src/ui/hud`), menus (`src/ui/screens`, `src/ui/shell`), audio (`src/audio`, 29 synthesised sounds).
  - renderer core and part 2 (`src/render`): Phaser 4 battlefield with one atlas page, parallax backdrop, pooled figure and tank views, HQs, dumps, trenches, pillboxes, wire, tracers, particles, explosions, projectiles, decals, rain and thunder, night tint, screen shake, sound hookup.
  - app glue (`src/app`, `src/meta`, `src/main.ts`, `index.html`): fixed-step game loop, HUD model, screen flow (title, campaign, briefing, battle, result), save data in localStorage, pause on focus loss, `?debug=1` hooks.
- **Phase 1 playable slice, verified.** Mission 1 plays end to end in the built game on a phone-sized landscape touch viewport: title, campaign map, briefing, battle (train, three orders, drag and minimap camera, pause, restart, quit, mute), victory and defeat result screens, progress surviving a reload. Checks, all green on the final tree: typecheck, sim-only typecheck, lint with zero warnings, 30 unit files (462 tests), production build with no warnings, 16 browser tests (`npm run test:e2e`, no console error, page error or failed request in any of them). Ten screenshots of the real build are in `docs/screenshots/phase1-*.png` and were looked at one by one; the other `e2e-*.png` come from the smoke test.

- **Phase 1 visual QA pass.** Mission 1 was captured from the production build at 844x390 and 667x375 with `tools/qa.ts` (fake clock, so film strips are exactly 50 ms apart) and reviewed over three rounds; final pictures in `docs/screenshots/qa1-*.png` (scenes, plus `qa1-844-strip-*` film strips of walking, carrying, loading, the HQ door both ways, running, firing, a death, idle, cheer and a lightning flash). The gait was confirmed to cycle with planted feet, bent knees and arm swing. Fixed (view side only, DECISIONS 81 to 85): packed squads now spread over wider depth rows with a per-row stagger and an eased crowd relaxation; units file out of and into the HQ doorway as a dark silhouette instead of a see-through ghost; bodies lie under the living; the training puff no longer smears across the doorway; each soldier carries his rifle a little differently on the move.

## In progress
- Nothing is mid-flight.

## Next
- Phase 2, full combat: trenches, pillboxes, wire, damage matrix, full roster, direct control, support call-ins (flip `SIM_FEATURES`), headless matchup tests. The renderer already handles the Phase 2 events and the app already wires supports and direct control (both only unit-tested with the flags on).
- Phase 3: ten missions, briefings, campaign map data, Quartermaster upgrades (`src/data/upgrades.ts` exporting `UPGRADES`), difficulties, saving.
- Phase 4: balance tests and tuning, performance, PWA and offline, sound polish, tutorial hints.
- Final verification passes, then `docs/MORNING_REPORT.md`.

## Known issues
- Phase 2 sim part 1 (trenches, pillboxes, wire, projectiles, smoke, full roster) is in and tested; the contact-gap test now uses a toughened sniper and smoke keeps `World.smokeCount` in step (`spawnSmoke`). Still to do in part 2: supports and direct control (`launch()` and `spawnSmoke()` in `src/sim/projectiles.ts` are ready for them). Projectiles hit nothing on the way, so a fast-moving target can be missed; about 10% of mirrored sandbox AI battles are undecided after 20 minutes.
- Nothing has been tried on a real phone: touch feel, real GPU rendering (Phaser texture-unit hazard, DECISIONS 66, seen only on SwiftShader), real audio output and frame rate are all unchecked. Everything was seen in headless Chromium with software WebGL. Audio was measured, never listened to.
- Only mission 1 exists. The browser tests loop over `MISSIONS`, so new missions are picked up (a win is asserted only for mission 1).
- The Quartermaster says "Nothing in the stores yet" until `src/data/upgrades.ts` exists, although a first win already awards 2 upgrade points.
- A win can show "Kills 0": the AI shelters its whole army in its HQ when outnumbered and units inside cannot be hit (DECISIONS 80). About 28% of mirrored AI-vs-AI battles are undecided after an hour (Phase 4 tuning).
- Phase 2 sim events (`projectile`, `explosion`, `supportIncoming`, `smokeSpawned`, `wireDestroyed`) are only checked with injected events (`window.__TH.emit` on the render preview page). The `airdrop` and `planeFlyby` sounds start on a fixed lead time. The `sim-orders` contact-gap test uses a sniper walking up to a pillbox, which holds only while pillbox guns are not simulated; Phase 2 must adjust it. Whoever adds smoke must keep `World.smokeCount` in step.
- In a very heavy battle the particle count briefly passes the soft cap of 900 (peak 1219 of 1536).
- The whole game is one 1.8 MB script (513 KB gzipped, mostly Phaser); `chunkSizeWarningLimit` is raised to 2500 to match. Splitting Phaser into its own chunk is a Phase 4 job with the PWA work.
- The browser suite takes about five minutes because it plays real battles in software WebGL; run a single spec with `x.cmd npx playwright test tests/e2e/smoke.spec.ts -g "<title>"`.
- Visuals still weak after the QA pass: a big firing line is still a dense cluster, because the sim stops every unit inside a 40 wu engage band (the view can only spread them by up to 14 wu each); figures are about 40 CSS px tall on a 390 px screen, so on a small phone the British khaki and German grey kit is the only quick side cue; a unit turning round flips in one frame; the carried supply crate is small. Seen only in headless Chromium at fixed 16 ms frames.
- Figures: dead bodies can rest up to about 2 wu above the ground; the anti-tank reload hand motion and the medic's idle arms are subtle. Both British tank slots use the Churchill look.
- Backdrops: foreground items sit mostly under the HUD. `tools/shot.ts` needs `'"path?a=1&b=2"'` quoting for URLs with `&` under `x.cmd`; the backdrop `?sheet=` modes need `--wait=3000`.
- Structures: trenches narrower than 104 wu are drawn at 104 wu.
- HUD: at 568x320 only five or six training buttons are visible and the rest scroll. Labels were not checked with a very wide font.
- Menus: on the 568x320 campaign view the map pans; mission pins sit over some map labels. A screen that is leaving stays in the page for its fade (marked `inert`), so tests must pick the arriving one (`.th-screen.is-in`).
- Renderer: muzzle flashes of units hidden behind a tank show on top of it; a tank crossing a trench is drawn behind the front parapet; fling inertia is strong on fast synthetic drags (`RENDER.camera.inertiaDecay`).
- Audio: low sounds such as `uiDeny` may be quiet on phone speakers.
