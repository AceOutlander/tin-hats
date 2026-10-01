# FX track progress

DONE. All five items built and verified: 86 unit tests pass (fx-weather, fx-lightning, fx-particles, fx-sprites), eslint clean on FX paths,
tsc (full and sim config) has no errors in FX paths. Four visual review rounds done; screenshots in docs/screenshots/art-fx-*.png.
Only change on resume: softened the dirt-plume streaks in src/data/fx.ts (smaller, lower alpha) so explosions no longer look spiky.
Next: nothing; integrator wires src/fx + src/art/fx into the renderer.
