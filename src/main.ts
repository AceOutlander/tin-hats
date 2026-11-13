/**
 * The page's entry: a small loader. It starts the loading bar, then brings in the two big scripts one after the
 * other, the engine (Phaser) and the game (src/boot.ts), so each starts in a piece of work of its own instead of both
 * in one long one, and then boots the game. Both are fetched from the moment the page is read: the build puts a
 * modulepreload link for each in index.html (vite.config.ts, preloadBigScripts); only their starting is in turn.
 */
import './ui/theme.css';
import { STARTUP_PROGRESS, bootBar, markStartup } from './app/startup';
import { registerServiceWorker } from './pwa';
import { nextTask } from './render/task';

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
