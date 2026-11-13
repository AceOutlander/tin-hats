/**
 * Startup: the loading screen's progress bar and the timing marks of the boot sequence (src/main.ts, src/boot.ts).
 *
 * The game's startup is a chain of pieces with the browser given a turn between them, so the page never stops
 * responding: the sprite atlas and the views (src/render, most of the work), the app on the stored save, the UI, the
 * title. The bar shows how far that chain is. tests/perf/startup.perf.spec.ts holds it to a budget on a slowed CPU.
 */

/** Where the bar stands (0 to 1) at each step of the boot sequence. */
export const STARTUP_PROGRESS = {
  /** The page's loader is running. */
  script: 0.03,
  /** The engine (Phaser) has started. */
  engine: 0.1,
  /** The game's own script has started. */
  game: 0.16,
  /** The battle view is built: its own progress (0 to 1) fills the bar from `game` to here. */
  view: 0.84,
  /** The app is built on the stored save. */
  app: 0.9,
  /** The UI is built. */
  ui: 0.97,
} as const;

/** The marks of the boot sequence, in order (performance.mark names; the startup test reads them). */
export const STARTUP_MARKS = ['th:script', 'th:engine', 'th:game', 'th:view', 'th:app', 'th:ui', 'th:title'] as const;
export type StartupMark = (typeof STARTUP_MARKS)[number];

/** Where the bar stands while the view is being built: `fraction` is the view's own progress, 0 to 1. */
export function viewProgress(fraction: number): number {
  const f = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0));
  return STARTUP_PROGRESS.game + (STARTUP_PROGRESS.view - STARTUP_PROGRESS.game) * f;
}

/** The bar's width for a progress of 0 to 1, as a whole percentage; it never goes back (`shown`: what it shows now). */
export function barPercent(fraction: number, shown: number): number {
  const f = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0));
  return Math.max(shown, Math.round(f * 100));
}

/** Note the time a step of the boot sequence was reached. */
export function markStartup(name: StartupMark): void {
  try {
    performance.mark(name);
  } catch {
    // No User Timing here: the marks are for measuring only.
  }
}

/** The loading screen's bar: returns a function that moves it to a progress of 0 to 1 (it never moves back). */
export function bootBar(doc: Document = document): (fraction: number) => void {
  let shown = 0;
  return (fraction) => {
    const next = barPercent(fraction, shown);
    if (next === shown) return;
    shown = next;
    const fill = doc.getElementById('boot-fill');
    if (fill) fill.style.width = `${shown}%`;
    doc.getElementById('boot-bar')?.setAttribute('aria-valuenow', String(shown));
  };
}
