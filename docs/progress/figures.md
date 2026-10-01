# Track FIG (stick-figure animation and figure art)

Done (task complete)
- src/data/figure.ts tunables (retuned proportions: legs 13.4+13.4, head r 5; gaits; death, flinch, arm extras).
- src/art/figure: math, pose (FigureAnim, FK), animate (updateFigure, gait, actions), death, parts (SpriteSpecs),
  layout (layoutFigure, 37 fixed parts), canvas (drawFigure2d, paintUnitIcon), index.
- dev/art-figures.html + .ts: live grid, ?mode=strip, deaths, sheet, actions (set=a|b|c), icons.
- tests/unit/figure-pose.test.ts + figure-layout.test.ts: 11 pass. tsc (main + sim) and eslint clean on own paths.
- Four review rounds; sheets saved as docs/screenshots/art-figures-*.png.

Next (follow-ups, not blocking)
- Renderer integration (Phaser track): copy layoutFigure parts onto pooled images; lower figures in trenches by VIEW.trenchDepth.
