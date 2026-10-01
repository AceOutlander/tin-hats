# perf-pwa (performance, PWA, offline)

Done: tools/perf.ts (+ src/render/perf.ts frame probe, window.__THPERF with ?debug=1), quality governor and hard particle cap
(src/render/quality.ts, src/data/renderPerf.ts), PWA (vite-plugin-pwa, src/pwa, icons by code in tools/gen-icons.ts,
tests/e2e/pwa.spec.ts), Phaser chunk, docs/CAPACITOR.md.
In progress: final full checks, before/after numbers, commit.
Next: nothing planned after the commit.
Run the PWA spec privately (own build and port, does not touch dist/): see the header of tests/e2e/pwa.spec.ts (TH_DIST).
