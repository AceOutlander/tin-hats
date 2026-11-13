/**
 * Bootstrap: the battle view in #game, the DOM UI in #ui, the audio engine,
 * the app controller that joins them, then the title screen.
 * src/main.ts loads this module (after the engine) and calls boot().
 */
import { createAudio } from './audio';
import { AdminController } from './app/admin';
import { App } from './app/app';
import { debugEnabled, installDebug } from './app/debug';
import { MENU_MUSIC } from './app/menuStorm';
import { browserStorage, createFlagPainter, createIconPainter, createUpgradePainter, installPageGuards, showUnreleased } from './app/page';
import { STARTUP_PROGRESS, markStartup, viewProgress } from './app/startup';
import { withStorageFallback } from './meta';
import { reportScreen } from './pwa';
import { createBattleView, nextTask } from './render';
import { createUi } from './ui';
import { installAdminUi } from './ui/admin';

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/**
 * Build the game and show the title. `progress` moves the loading screen's bar (0 to 1).
 *
 * Startup is a chain of pieces with the browser given a turn between them (nextTask), so the page never stops
 * responding and the loading bar moves (src/app/startup.ts; the owner's "Page Unresponsive" freeze, 2026-11-12).
 */
export async function boot(progress: (fraction: number) => void): Promise<void> {
  const gameEl = document.getElementById('game');
  const uiEl = document.getElementById('ui');
  if (!gameEl || !uiEl) throw new Error('Tin Hats: the page has no #game or #ui element');

  markStartup('th:game');
  progress(STARTUP_PROGRESS.game);
  const audio = createAudio();
  // The HUD is loaded here, before the UI exists, so it is never missing at the first frame of a battle.
  const [view, { createHud }] = await Promise.all([createBattleView(gameEl, (f) => progress(viewProgress(f))), import('./ui/hud')]);
  markStartup('th:view');
  progress(STARTUP_PROGRESS.view);
  await nextTask();
  // Whatever is stored in this browser (an old save, damaged data, settings from a newer version), the game starts:
  // loading falls back to defaults by itself, and if building the app on the stored data still throws, it is built
  // again on an empty store.
  const app = withStorageFallback(
    browserStorage(),
    (storage) => new App({ view, audio, storage, showUnreleased: showUnreleased(window.location.search, import.meta.env.DEV) }),
    (err) => console.error('Tin Hats: the saved data could not be used; starting with defaults.', err),
  );
  markStartup('th:app');
  progress(STARTUP_PROGRESS.app);
  await nextTask();
  // The hidden admin panel: nothing of it shows until the secret entry and the code (src/ui/admin).
  const admin = new AdminController({ app, view, ui: () => app.currentUi });
  const ui = createUi(uiEl, app, {
    paintUnitIcon: createIconPainter(app),
    paintUpgradePreview: createUpgradePainter(app),
    paintFlag: createFlagPainter(),
    createHud,
    onScreen: (screen) => {
      app.onScreen(screen);
      // A new version of the game waits for the battle screens to be left (src/pwa).
      reportScreen(screen);
      admin.screenChanged();
    },
    onPortrait: (portrait) => {
      if (portrait) app.autoPause();
    },
  });
  app.attachUi(ui);
  installAdminUi(uiEl, admin);
  installPageGuards(app, audio);
  const debug = debugEnabled(window.location.search) ? installDebug(app, view, ui, audio, admin) : null;
  markStartup('th:ui');
  progress(STARTUP_PROGRESS.ui);
  await nextTask();
  // The title's storm scene, in a piece of its own ahead of the title screen: its backdrop is drawn and handed to the
  // GPU here, so showing the title is only the screen itself. The storm asks for the same scene again when it starts.
  if (app.storm.enabled) view.setMenuScene(true);
  markStartup('th:scene');
  progress(STARTUP_PROGRESS.scene);
  await nextTask();

  ui.show('title');
  markStartup('th:title');
  document.getElementById('boot')?.remove();
  await nextFrame();
  await nextFrame();
  // The menu theme is rendered once in the background (OfflineAudioContext needs no gesture), after the first picture.
  audio.prepareMusic(MENU_MUSIC);
  if (debug) debug.ready = true;
}
