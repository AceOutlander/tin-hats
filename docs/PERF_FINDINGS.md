# Performance findings so far (lag job, 2026-11-08, interrupted by a restart)

The owner reports stutters/hitches in Chrome on a PC (not a slow average). Owner's brief: measure first, fix the biggest
one or two wins within about 30 minutes, push, and leave deeper work for later in the queue; add an FPS counter in
Settings and a perf test. The measurement workflow was stopped before it finished; only the sim audit completed.

Raw scripts and outputs are in `.perf/` in this worktree (untracked except the small scripts and text reports committed
with this file). The full sim audit is `.perf/sim-audit.md`.

## Measured so far

1. Sim and AI: not the cause. 100 per side in heavy contact: 0.2 ms per tick on desktop, 0.32 ms mean and 1 ms p95 at
   CPU x4. Hot spot: `countClusters` (src/sim/structures.ts:43-61) is all-pairs O(n^2) and about 60% of the tick; a
   sorted sweep gives identical results 13x faster. Side finding: `CONFIG.maxUnits = 160` is the pool for both sides
   together, so 100 pop per side cannot fit (training stalls silently); raise to about 216 together with the
   countClusters fix. First battle in a fresh page runs un-JITted: single ticks up to 25-55 ms at x4 (a start hitch).
2. Render (tools/perf.ts, proving ground, CPU x4, `.perf/render3.txt`): 35.7 fps; view render (layout) p95 24.9 ms,
   max 76 ms; Phaser draw p95 43 ms; 73 long tasks in 15.6 s. 63 units -> 87 unit views -> 5634 images (1587 visible):
   about 90 images per unit. Heap allocates about 5.2 MB/s (136 collections in 15.6 s), +1.28 MB/min retained.
   CPU profile top self time: LayerWebGLRenderer 10%, Phaser run loops 4-5% each, our `draw` 4.3%, advanceGait,
   updateLive, updateFigure, poseToJoints.
3. Battle music (`.perf/music-arras.txt`): a battle track is 26 pieces, 25 MB, about 38 s of rendering, done piece by
   piece DURING the battle (src/audio/engine.ts renderBattle, src/audio/music/battle.ts renderBattlePiece); the longest
   single main-thread graph build is about 65 ms (x4), which is a visible hitch each time.

## Candidate quick wins (the 30-minute timebox)

- Music: start rendering the battle track at mission load (briefing/loading) and make sure each main-thread build task
  is small (smaller chunkSeconds for the first chunk, build the reverb room once per track and reuse it).
- Allocation churn: find the per-frame allocations behind 5 MB/s (render/figure update, HUD) and pool them.
- Figure cost: skip pose/layout updates for unit views that are off screen; consider fewer parts per figure at a
  distance.
- Sim: countClusters sorted sweep + maxUnits 216 (cheap, safe, deterministic).

Not yet measured: the render audit (corpses, blood, decals, effects pooling, planes), and the audio/HUD audit (sfx node
counts, DOM writes and forced layout). Re-run the stopped workflow script to finish them:
the workflow script `tin-hats-perf-measure` (session scripts folder), or redo with tools/perf.ts.
