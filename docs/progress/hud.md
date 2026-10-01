HUD track: COMPLETE.
Done: src/ui/hud/{index,format,icons,input,minimap}.ts + hud.css, dev/ui-hud.{html,ts}, tests/unit/hud-format.test.ts.
Verified: 20 screenshots docs/screenshots/ui-hud-*.png (5 sizes x normal/control/targeting/paused); touch targets >= 48; no overlaps;
multi-touch stick+fire+order; 0 idle DOM mutations; mouse/keyboard flows; eslint, tsc (own paths) and unit test clean.
Next: nothing; integrator wires createHud into src/ui/index.ts and the app glue.
