# Track view-polish (animation, readability, layering, Phase 2 visuals)

Done (milestone 1, committed): VIEW.viewHeightWu 450 (zoom anchored at the bottom, VIEW_TOP_WU), camera edgeMargin 64 so
both HQs and flags clear the screen edge, smooth turn (RENDER.unit.turnTime, bone-preserving squash in placePart),
tank suspension (bob, pitch spring, fire kick, squat), tanks ride above trench parapets/wire (DEPTH.vehicleOver) with
a lip bump, muzzle flashes hidden behind nearer tanks (UnitViews.coverEdge), kneel-by-row firing tiers, wider row
spread, bodies lowered onto the ground, bigger hugged crate, AT reload and medic idle overlays, pack/helmet secondary
motion. tools/qa.ts --only=page (dev pages on the Vite dev server, fake clock).
In progress: Phase 2 puppet scenes in dev/render-preview (?scene=...).
Next: capture-critique-fix rounds, final polish2-*.png, DECISIONS, PROGRESS known issues.
