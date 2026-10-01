# perf-pwa (performance, PWA, offline): DONE

Done: PWA (vite-plugin-pwa, `src/pwa`, icons by code in `tools/gen-icons.ts`, `tests/e2e/pwa.spec.ts`), Phaser chunk, frame probe
(`src/render/perf.ts`, `window.__THPERF` with ?debug=1), perf harness (`tools/perf.ts`, `npm run perf`), quality governor and hard
particle cap (`src/render/quality.ts`, `src/data/renderPerf.ts`), off-screen particle culling, `tests/e2e/perf.spec.ts`,
unit tests `tests/unit/perf-quality.test.ts` and `perf-pwa.test.ts`, `docs/CAPACITOR.md`. DECISIONS 202 to 209.
In progress: nothing. Next: a run on a real phone (nothing here was measured on one).

Numbers (desktop, software WebGL, 844x390, ~75 units, proving ground seed 1; `npm run perf -- --scene=sandbox --quality=0`):
- Before (probe added, nothing else changed): JS sim+afterStep+render+HUD avg 0.56 to 0.69 ms/frame (p95 1.0 to 1.2, worst 3 to 5);
  Phaser draw 1.6 to 1.9 ms; main-thread CPU 2.6 to 3.0 ms/frame; 6 to 14 MB/s allocated (85 to 90 percent inside Phaser);
  particle peak 640 to 670 here, 1219 in the heaviest battle seen earlier; one 1932 kB chunk (541 kB gzipped).
- After: JS avg 0.69 to 0.75 ms (p95 1.0 to 1.5): the same within noise (the scenes differ run to run); main-thread CPU 2.9 to 3.2 ms with
  more units on screen in those runs; particle pool hard-capped at 1000; app chunk 566 kB (187 gzipped) + Phaser 1375 kB (357 gzipped).
- Quality level 2 vs 0 at 4x CPU throttle with rain: visible images -18 to -30 percent, Phaser draw -11 to -28 percent, view render -8 to -12 percent.
- Budget: PASS (about 0.7 ms against 6 ms). Retained heap growth after GC: -1.5 to +3 MB/min (the battle itself grows; no leak signal).
Timings are noisy while other tracks run tests: compare runs made back to back, or the main-thread CPU line.

Run: `npm run build`, then `npm run perf -- --scene=sandbox` (see the header of tools/perf.ts; `--profile`/`--allocs` want an unminified
build: `npx vite build --outDir .tools/perf-dev --minify false --emptyOutDir`). PWA spec on a private build and port:
`TH_DIST=.tools/pwa-dist npx playwright test -c <config with webServer on that build> pwa.spec` (the shared dist/ may be in use).
