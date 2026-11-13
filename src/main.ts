/**
 * The page's entry: a small loader. It starts the loading bar, then brings in the two big scripts one after the
 * other, the engine (Phaser) and the game (src/boot.ts), so each starts in a piece of work of its own instead of both
 * in one long one, and then boots the game. Both are fetched at once; only their starting is in turn.
 */
import './ui/theme.css';
import { STARTUP_PROGRESS, bootBar, markStartup } from './app/startup';
import { registerServiceWorker } from './pwa';

async function load(): Promise<void> {
  const progress = bootBar();
  markStartup('th:script');
  progress(STARTUP_PROGRESS.script);
  const engine = import('phaser');
  // The game's script is fetched now too; it starts after the engine it is built on.
  const game = import('./boot');
  await engine;
  markStartup('th:engine');
  progress(STARTUP_PROGRESS.engine);
  const { boot } = await game;
  await boot(progress);
}

load().catch((err: unknown) => {
  console.error(err);
  const notice = document.getElementById('boot');
  if (notice) notice.textContent = 'Tin Hats could not start. Reload the page to try again.';
});

registerServiceWorker();
