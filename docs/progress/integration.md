# Integration gate progress

Done
- Whole-project checks passed on the merged tree before my changes: typecheck, tsc sim config, lint (0 warnings), test:unit (20 files, 331 tests), build.
- Seam checks: CSS variables (none undefined), createHud fits CreateHud, HUD mounts in the battle screen (checked in a browser), headless ESLint rules probed with deliberate violations in src/sim, src/data, src/meta (all caught).
- Found and fixed: WeaponDef.sound used names the audio engine does not have (rifle, mg, ...). Now rifleShot, mgShot, ... or 'none'.
- Added tests/unit/art-keys.test.ts and tests/unit/seams.test.ts.
- Added src/art/icons.ts (paintUnitPortrait) because the figure icon painter returns false for tanks and has a different signature from PaintUnitIcon.
- All 7 dev pages load with --ready --strict and no problems; PNGs viewed in .tools/shots/int-*.png.

In progress
- Re-run of all checks after my edits.

Next
- Fold DECISIONS into docs/DECISIONS.md, update docs/PROGRESS.md, commit.
