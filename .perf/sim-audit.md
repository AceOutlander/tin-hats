## Sim and AI audit (finished, measured)

The simulation and AI are not what makes the game lag. I replayed each deterministic battle 5 times and kept the per-tick minimum, which strips out noise from other processes (CPU was at 100% load from other processes during the session). With 100 units per side in heavy contact, the sim costs 0.195 ms per tick mean (p95 0.24, max 0.45) on the Ryzen 7800X3D desktop. In headless Chromium with the CPU throttled 4x (mid-range phone) it is 0.32 ms mean and 1.0 ms p95. At 140 per side it is 0.36 ms on desktop and 0.76 ms mean / 2.4 ms p95 throttled. At 30 Hz that is at most about 1 tick per 60 fps frame, so the sim uses 2–6% of the 16.7 ms frame budget on a phone. Look for the lag in render, effects and audio.

Inside the sim, one function dominates. countClusters (src/sim/structures.ts:43-61), called from computeFronts every tick, is an all-pairs O(n²) loop and takes about 60% of the tick at 100/side (cpu-prof: computeFronts 62% inclusive). In a side-by-side test a sorted sweep gave identical results and was 13x faster (124 µs down to 9 µs at 100/side). Everything else in the tick is small and scales linearly:
- Target acquisition: search() is O(n) per mount, but retargets are staggered every 15 ticks and there is an early exit on the enemy front.
- Medic patient search: 3–4%.
- AI: thinks once per second (0.5 s on Insane), so it is not a per-tick cost. A think tick adds 0.013 ms mean.
- Allocation: about 50–500 bytes per tick once warm, no per-tick .filter/.map/.sort or closures, no GC pressure.

There is no catch-up spiral. A frame's real time is capped at 250 ms (at most 7 ticks per frame at 1x), and a tick costs far less than its 33 ms period.

Two side findings:
1. CONFIG.maxUnits = 160 is the unit pool for both sides together, so 100 pop per side (about 80–100 units each, plus sappers) cannot fit. Training then stalls silently.
2. The first battle in a fresh page runs before the JIT has optimised the sim. The first second ran at 2.5–12.6 ms per tick (throttled 4x), with single ticks up to 25–55 ms. That is a possible hitch at the start of a battle.

For the planned regression test: wall-clock tick timings on this machine spike up to 550 ms from outside load. Use min-of-replays or an idle CI runner, otherwise the test will flake. No game source files were changed. All scripts are in C:\dev\tin-hats-perf\.perf\ (untracked).

### Overall verdict: sim + AI cost per frame (low)
- Cost: 100/side heavy contact: 0.195 ms/tick mean, p95 0.236, max 0.445 (desktop 7800X3D, per-tick min of 5 replays). Headless Chromium CPU x4: 0.317 mean, p95 1.0, max 1.8 ms. x1 Chromium matches node: 0.195. 140/side: 0.363 ms desktop; 0.761 mean / 2.4 p95 at x4. At 30 Hz and 60 fps that is about 0.5 ticks per frame, so the sim is roughly 0.2–1 ms of a 16.7 ms frame on a phone-class CPU.
- Evidence: .perf/sim-min.ts (assault and army behaviour, N = 25/50/80/100/140 per side, mixed army: 45% rifle plus lmg, assault, mortar, sniper, medic, at, flame, aa, tanks, apc, commander) and .perf/sim-browser.ts (Playwright Chromium with Emulation.setCPUThrottlingRate). Cost grows about quadratically: 0.054 → 0.195 → 0.363 ms for 50 → 100 → 140 per side.
- Files: src/sim/battle.ts:312-340 (step)
- Fix: No sim change is needed to fix the lag; spend the effort on render, effects and audio. The fixes below are cheap insurance for raising the cap.

### countClusters all-pairs O(n^2) every tick (medium)
- Cost: About 60% of the whole sim tick at 100/side. cpu-prof: computeFronts 62% inclusive (countClusters inlined); 87% of its line ticks are the inner loop at structures.ts:55-58. Isolated: 27 µs at 50/side, 124 µs at 100/side, 268 µs at 140/side (desktop); about 4-6x that on a phone.
- Evidence: src/sim/structures.ts:43-61 loops j over every unit for each i (about 40k iterations at 200 units, 78k at 280), called from computeFronts at :130 each tick. Its only consumer is unitRank in src/sim/combat.ts:105 (area weapons with dugIn 'prefer' or 'only', i.e. mortars). .perf/sim-cluster.ts gets bit-identical results over 200 ticks at N = 50/100/140 (0 mismatches) with a sorted sweep: 3.1 / 9.1 / 21.2 µs.
- Files: src/sim/structures.ts:43-61, src/sim/combat.ts:105
- Fix: Keep a persistent Int32Array of live, not-inside unit indices per side. Insertion-sort it by x each tick (the order is nearly sorted already, so this is O(n)), then count with two pointers within clusterRadius. The result is exact and keeps determinism, so balance tests are unaffected. Expose the sorted per-side arrays on World so search(), findPatient, explode() splash and AI bestCluster can binary-search an x window instead of scanning the whole pool.

### Unit pool CONFIG.maxUnits = 160 for both sides together vs the 100-pop-per-side target (medium)
- Cost: No CPU cost today, but gameplay is wrong. A realistic 100-pop army is about 80-100 units plus 4+ sappers per side, so 2 sides exceed 160. spawnUnit returns null and training waits silently. Raising the pool to 200-280 roughly doubles the quadratic parts (see countClusters numbers).
- Evidence: src/data/config.ts:66 maxUnits: 160; src/sim/units.ts:191-197 (scan for a free slot, return null when full); src/sim/economy.ts:96-97 (queue only advances if (u)). My mixed 100-pop mix is 80 units per side.
- Files: src/data/config.ts:66, src/sim/units.ts:179-198, src/sim/economy.ts:93-104
- Fix: Set maxUnits to at least 2 x popCap + sappers (for example 216). Do the countClusters fix at the same time so the bigger pool costs nothing. spawnUnit's linear free-slot scan (units.ts:191) could use a free list but is cheap: it only runs on spawn.

### Target acquisition search() (low)
- Cost: About 5.6% of tick (self) and about 8.5% including senseMount at 100/side. Hot lines: the alive/side/inside filter and the distance check (combat.ts:134-136).
- Evidence: src/sim/combat.ts:113-215. O(n) scan of the whole pool, but only on retarget (staggered (tick+i)%15, orders.ts:177) or when the unit has no valid target. There is an early exit when the enemy front is out of range (combat.ts:127). targetValid is O(1) per tick. Line-of-fire is a scan over 8 smoke slots only when smokeCount>0.
- Files: src/sim/combat.ts:113-215, src/sim/orders.ts:164-187
- Fix: Use the per-side sorted x array from the countClusters fix: binary-search [x-range, x+range] on the enemy side, so the cost becomes O(log n + k). Optional.

### Medic findPatient every tick (low)
- Cost: About 3.6% of tick at 100/side (5 medics per side, each scanning about 200 units every tick). It is about 33% of senseUnits' own time.
- Evidence: src/sim/orders.ts:38-60, called unconditionally at orders.ts:193 for every healer every tick.
- Fix: Run it on the retarget stagger (when retarget is true, or when the current patient is invalid), or use the sorted index with healRange.

### AI commander think rate (low)
- Cost: Think ticks: 0.084 ms mean vs 0.071 on other ticks (bot, 100/side), max 0.40 ms. Insane AI: 0.068 vs 0.059 ms. Negligible.
- Evidence: src/sim/commander.ts:433-439. Think every thinkTicks = 30 ticks (1 s; 0.7 s on Hard, 0.5 s on Insane, from src/data/difficulty.ts). Survey is O(n). bestCluster (commander.ts:315-345) is O(n²) but only runs at think time and only when artillery or planes are available. Both sides think on the same tick.
- Files: src/sim/commander.ts:315-345, 433-439
- Fix: Nothing needed. Optionally offset side 1's think by thinkTicks/2 so the two thinks never share a tick, and let bestCluster use the sorted index.

### Per-tick allocation (low)
- Cost: About 50-500 bytes per tick once warm (heapUsed delta with no GC, 100/side bot vs bot). About 10-16 KB per tick during the first battle's JIT warm-up (interpreter boxing doubles). No GC pauses attributable to the sim.
- Evidence: .perf/sim-alloc.ts. src/sim hot loops use typed arrays and module scratch values (FOUND_X, SMOKE_LINE, LAUNCH, BEST, SV). There is no .filter/.map/.sort or closure in any per-tick path; .map only appears in createState at battle creation (battle.ts:208-230).
- Files: src/sim/*
- Fix: None needed.

### Cold JIT at battle start (first battle in a fresh page) (low)
- Cost: Chromium CPU x4, 100/side: the first 1 s of battle averaged 2.5-12.6 ms per tick (3 fresh pages), worst single tick 25-55 ms, then it settles to about 1 ms. Warm re-runs on the same page start at about 0.8-1.7 ms per tick. Wall-clock numbers are inflated by outside load.
- Evidence: .perf/sim-browser-cold.ts (fresh page per run, throttle set before the script loads).
- Files: src/sim (all), src/app/session.ts (battle start)
- Fix: Optionally pre-warm at mission load: run a hidden throwaway battle (for example the sandbox with about 50 per side) for about 150 ticks behind the loading or briefing screen, so the sim is already optimised when play starts. This fits with rendering music at mission load.

### Fixed-step loop / catch-up spiral (low)
- Cost: No spiral is possible: real dt is clamped to APP.maxFrameMs = 250 ms, so at most 7 catch-up ticks per frame at 1x (about 2-7 ms on a phone), while a tick costs ≤2 ms against a 33 ms period. maxStepsPerFrame = 240 only matters under debug fast-forward. At 60 fps the 30 Hz sim runs 0 or 1 steps on alternate frames, so sim cost lands on every other frame. That is fine at this cost.
- Evidence: src/app/loop.ts:61-91; src/data/app.ts:70-71. Each step also runs view.afterStep() and session.handleEvents() (playEventSound per event, session.ts:119-140). Those are not sim and I did not time them; the render/audio audit should, especially with about 1 shot event per tick at 100/side.
- Files: src/app/loop.ts:61-91, src/data/app.ts:70-71, src/app/session.ts:119-140
- Fix: Optional: lower maxFrameMs to about 100 ms so a long hitch produces at most 3 catch-up ticks. Have the render audit time afterStep and handleEvents per step.

### Measurement method for the perf regression test (low)
- Cost: Wall-clock per-tick timings on this machine showed spikes of 90-550 ms on ticks with no events (machine at 100% CPU from other processes). Min-of-5-replays of the same deterministic battle gives a max of 0.45 ms.
- Evidence: .perf/sim-bench.ts and .perf/sim-spikes.ts (noisy wall clock) vs .perf/sim-min.ts (stable). Win32_Processor LoadPercentage was 100 during the runs.
- Files: .perf/sim-min.ts
- Fix: For the sim part of the 'heavy battle must hold target' test, replay the deterministic battle several times and assert on the per-tick minimum (or the median of batches), with a budget such as ≤1 ms mean and ≤3 ms p95 at 100/side under 4x CDP throttle. A single wall-clock run will flake.

Harness: All scripts are in C:\dev\tin-hats-perf\.perf\ (untracked). Run from C:\dev\tin-hats-perf with node C:\dev\tin-hats\.tools\node\node.exe (Git Bash: /c/dev/tin-hats/.tools/node/node.exe):
- Stable per-tick timing, N = 25..140 per side, min of R replays: node --import tsx .perf/sim-min.ts 5 900 army (or assault)
- Wall-clock bench (sweep, contact and a 240 s bot-vs-bot sustain): node --import tsx .perf/sim-bench.ts all
- AI think-tick cost: node --import tsx .perf/sim-ai.ts 100 5 normal bot | node --import tsx .perf/sim-ai.ts 100 5 insane ai
- Allocation per tick: node --expose-gc --import tsx .perf/sim-alloc.ts
- countClusters vs sorted sweep, with an equality check: node --import tsx .perf/sim-cluster.ts
- CPU profile with line info: node node_modules/esbuild/bin/esbuild .perf/sim-prof.ts --bundle --platform=node --format=esm --outfile=.perf/build/sim-prof.mjs ; node --cpu-prof --cpu-prof-dir=.perf/prof --cpu-prof-interval 50 .perf/build/sim-prof.mjs 100 80 assault ; node .perf/prof-top.mjs .perf/prof/<file>.cpuprofile ; node .perf/prof-lines.mjs .perf/prof/<file>.cpuprofile computeFronts .perf/build/sim-prof.mjs
- Throttled Chromium (set PLAYWRIGHT_BROWSERS_PATH=C:\dev\tin-hats\.tools\ms-playwright first): node --import tsx .perf/sim-browser.ts 1,4,6 | node --import tsx .perf/sim-browser-cold.ts 4

The scripts raise CONFIG.maxUnits to 400 inside the script so 100 and 140 per side fit; the sustain scenario uses the real 160.
