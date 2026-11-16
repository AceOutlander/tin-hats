/**
 * The page's entry: a small loader. It starts the loading bar, then brings in the two big scripts one after the
 * other, the engine (Phaser) and the game (src/boot.ts), so each starts in a piece of work of its own instead of both
 * in one long one, and then boots the game. Both are fetched from the moment the page is read: the build puts a
 * modulepreload link for each in index.html (vite.config.ts, preloadBigScripts); only their starting is in turn.
 */
import './ui/theme.css';
// The platform first (through its extra unit, src/platform/extraUnit.ts): a platform may add a unit to the game's
// data, and that has to be in place before any of the game's own modules is read (they are loaded below, in boot).
import { standInExtraUnit } from './platform/extraUnit';
import { STARTUP_PROGRESS, bootBar, markStartup } from './app/startup';
import { registerServiceWorker } from './pwa';
import { nextTask } from './render/task';

// Tests only (?debug=1): a made-up extra unit the page carries stands in for a platform's.
standInExtraUnit(window.location.search, window);

async function load(): Promise<void> {
  const progress = bootBar();
  markStartup('th:script');
  progress(STARTUP_PROGRESS.script);
  await import('phaser');
  markStartup('th:engine');
  progress(STARTUP_PROGRESS.engine);
  // The game's script is asked for only now, a turn later, so it never starts in the same piece of work as the engine
  // (it is already fetched: see the modulepreload links).
  await nextTask();
  const { boot } = await import('./boot');
  await boot(progress);
}

load().catch((err: unknown) => {
  console.error(err);
  const notice = document.getElementById('boot');
  if (notice) notice.textContent = 'Tin Hats could not start. Reload the page to try again.';
});

registerServiceWorker();
