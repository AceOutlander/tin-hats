# Decisions made while you were asleep

Each entry: what was chosen and why. Newest at the bottom.

1. **The game lives in `tin-hats/` with its own git repo.** The folder you opened already held another game (`index.html`) and `magic-academy/`. A subfolder keeps those untouched and out of the new repo.
2. **Node, npm and git are project-local.** None of them were installed on this PC and global installs were ruled out, so portable Node 24 LTS (nodejs.org, checksum verified) and MinGit 2.56 (git-for-windows release, checksum verified) sit in `tin-hats/.tools`. The npm cache and the Playwright browser are kept there too. `x.cmd` runs any command with them on PATH. Nothing outside the project folder was changed.
3. **TypeScript 6.0 instead of 7.0.** typescript-eslint 8 only supports TypeScript below 6.1, and lint with zero warnings was required.
4. **HUD and menus are DOM elements; Phaser draws the battlefield.** DOM gives crisp text at any pixel ratio, native safe-area handling and reliable 48 px touch targets, and it keeps the Phaser 4 API surface small. The simulation stays free of both.
5. **The simulation ticks at 30 Hz and the renderer interpolates.** Animation runs at display rate, so motion is smooth while headless tests run twice as fast as a 60 Hz sim would.
6. **The damage matrix has a fifth column, `hq`.** With pillboxes nearly immune to bullets, a shared fortification column would make the rifles-only tutorial unwinnable. The HQ gets its own multipliers.
7. **Barbed wire slows only the other side's infantry.** The side that laid it knows the gaps. This stops the AI crippling its own counter-attacks.
8. **Each unit type has its own training queue, and types train in parallel.** That is what "queue count and training progress" on every button implies. Cost and population are paid when queued so the cap of 40 can never be exceeded.
9. **Sappers cannot be directly controlled.** They do not fight, and a tap on a sapper would otherwise interrupt income.
10. **Rain can happen in every theatre, including the desert.** The request was a flat 40% per map. Thunder is checked every 2 seconds at 0.5% while it rains. Weather uses its own random source and never touches gameplay.
12. **Build agents run on Sonnet, with Opus for figure animation, the renderer and visual QA.** The first parallel run on the top model used a whole 5-hour usage window in 29 minutes and every agent was cut off. Cheaper models stretch the plan's limits so more gets finished per window; work is committed at each stage so nothing is lost when a limit hits.
11. **Git commits are authored as "Tin Hats build" with your email**, set in the repo's local config only.

## Phase 1 foundations (sim, art, UI, audio)

Sim core
13. **The dump spread now mirrors for side 1.** It was a small side asymmetry in the first draft.
14. **Sim hot paths pass numbers in object fields, not as arguments.** V8 allocates for non-inlined double arguments; a fight allocated about 1.7 KB per step before this and about 25 bytes after.
15. **`SideState.trainLeft` was removed from `types.ts`.** It was internal and nothing else used it; it lives in an internal array.
16. **Mission 1 bot `firstAttackAfter` went from 85 to 105 s**, so the bot wins in about 3.1 minutes.
17. **Training keeps the leftover fraction of a tick between queued units.**
18. **Only training respects the population cap.** Mission-placed and scripted units may exceed it.
19. **The mirrored symmetry test counts decided battles over 3600 s.** About 28% of mirrored AI-vs-AI battles are still undecided after an hour; that is a Phase 4 tuning item.

Figures
20. **The figure anim stores its faction** (weapon geometry), so `layoutFigure` and `drawFigure2d` take no `look` argument.
21. **`FigureInput` gained a `victory` flag and an optional `death.dir`.**
22. **Taller figure:** legs 13.4 + 13.4 wu, head radius 5.
23. **The light rim is a separate silhouette pass** of 14 parts behind the figure.
24. **The renderer lowers figures in trenches by `VIEW.trenchDepth`;** the figure's ground is the trench floor.
25. **The pose continuity test allows 10 wu of joint movement per frame,** because the throwing hand and the blast toss are fast on purpose.
26. **Deaths are a function of time since death,** so a body stops moving at the end. A prone gunner who dies keeps most of his pose and goes limp.

Backdrops, structures, vehicles, props
27. **Italy's far layer is a steep rock massif** with a terraced abbey base (`SCENES.italy.massifHalf`). Normandy's `seaY` is 272 with larger ships. Germany's dragon's teeth are darker concrete. Holland's bridge sits on embankments over a river gap.
28. **Rain grade, night tint and ground colours stay in `THEATRES`** and are read through `getTheatreColours`; the night-tint alpha comes from `TIME_GRADES[time].tintAlpha`.
29. **The celestial backdrop layer is the one layer allowed to start above the screen** (`y` can be negative).
30. **The backdrop dev page starts `main()` after the load event,** because the sheet and seam-test modes took over 30 s and blocked page load.
31. **The flag shear and scratch screenshots stay in the dev page only.** The wrecked tank husk has a ragged turret-ring hole with embers.
32. **A single `tileSpan` tile can scale 0.5 to 1.5; from two tiles up it stays within 0.75 to 1.25.**

Effects and weather
33. **Explosion dirt-plume streaks were softened** (smaller scale, lower alpha) because the first renders looked spiky.
34. **The rain roll is always drawn,** so a debug override never shifts the weather random sequence.
35. **`forceThunder()` is reported by the next `update()` even when it is not raining.**

HUD and menus
36. **While a stick or key is held, the HUD re-sends `{type:'stick', x}` every frame** reusing one object. The app must read it at once and not store it.
37. **HUD buttons call `preventDefault` on mousedown,** so a clicked button never keeps focus and a later Space (fire) cannot re-click it.
38. **`getButtonRects()` returns true client rects,** so training buttons scrolled out of view report positions off the visible bar.
39. **The campaign map shrinks to as small as 430 px wide** so all ten pins fit on larger phones; small phones pan. The "CAMPAIGN" heading is visually hidden but kept for screen readers.
40. **The briefing objective sits above the typed orders** so it shows on 568x320.

Audio
41. **One-shot sounds are pre-rendered through `OfflineAudioContext` after `unlock()`;** until a buffer is ready the sound is built live from oscillators.
42. **The mix runs through a compressor and a soft clipper,** so output cannot pass 0.97.
43. **The audio engine never touches storage.** The app passes the saved mute setting to `createAudio({ muted })` and saves changes itself.

Integration gate
44. **`WeaponDef.sound` now names a real audio one-shot** (`rifleShot`, `mgShot`, `smgShot`, `sniperShot`, `bunkerMg`, `mortarLaunch`, `rocketLaunch`, `tankGun`, `shellWhistle`) or `'none'`. The first draft used ids like `'rifle'` that the audio engine does not have. The thrown grenade is silent at launch (`'none'`); explosions are sounded from the `explosion` event.
45. **`src/art/icons.ts` adds `paintUnitPortrait(canvas, kind, faction)`** for every unit kind. The figure module's own `paintUnitIcon` only draws stick figures, returns `false` for tanks and takes a faction, not the `(canvas, kind, side)` the HUD and menus call.
46. **Two new seam tests guard the tracks against drifting apart:** `tests/unit/art-keys.test.ts` (unique sprite keys, positive sizes, anchors in 0..1) and `tests/unit/seams.test.ts` (kinds and actions, weapon sounds and effect sprites, every key table has its sprites, the HUD factory fits the UI shell).

Renderer core (RENDER part 1)
47. **Device pixels: Scale mode NONE with game size = CSS size x dpr (dpr capped at `VIEW.maxDevicePixelRatio`) and Scale zoom 1/dpr.** Phaser 4 has no `resolution` setting; this draws at full resolution while the canvas is styled at CSS size. Camera zoom = canvas height / 540.
48. **Battlefield input uses DOM pointer events on the canvas, not Phaser input** (Phaser input is disabled). Taps, drags, flings and the wheel stay in CSS px and never see the DOM HUD above the canvas.
49. **One Phaser Layer per DEPTH slot plus one per unit row, and unit views are pooled per row.** Objects never change depth, so neither the scene nor a layer ever re-sorts; each view's images stay contiguous in its row layer. Additive glow effects get their own layer just above `DEPTH.effects`.
50. **The HQ sprite is placed so its art doorway sits on the sim's `doorX`** (the art bunker is wider than `config.hqWidth`); HQ tracers start at the art gun slit, not the sim's `gunX`.
51. **Waving flags are sheared strips: each strip Image sits in a Container and the shear is split into rotation x scale x rotation (2x2 SVD)**, because Phaser Images cannot skew. Strips are tinted by `flagStripTint`.
52. **Units get a small fixed visual x offset (`RENDER.unit.xJitter`, 7 wu) from their id,** so the four rows of one formation column do not stand in a single vertical stack. View only; tracers aim at the body as drawn.
53. **The figure rig is fed figure-space distances (moved / row scale)** so planted feet stay put at every row scale (checked: a planted ankle drifts under 0.3 wu while the body moves 10 wu).
54. **Spawn and Fall Back use a door fade**: a unit's alpha ramps over `RENDER.unit.doorFade` (26 wu) from its own HQ door, so units emerge from and vanish into the doorway.
55. **Renderer tunables live in the new `src/data/render.ts` (`RENDER`).** Shot events do not name the firing pillbox, so the renderer takes that side's pillbox nearest to the shot's x.
