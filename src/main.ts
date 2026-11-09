/**
 * Bootstrap: the battle view in #game, the DOM UI in #ui, the audio engine,
 * the app controller that joins them, then the title screen.
 */
import './ui/theme.css';
import { createAudio } from './audio';
import { AdminController } from './app/admin';
import { App } from './app/app';
import { debugEnabled, installDebug } from './app/debug';
import { MENU_MUSIC } from './app/menuStorm';
import { browserStorage, createFlagPainter, createIconPainter, createUpgradePainter, installPageGuards, showUnreleased } from './app/page';
import { withStorageFallback } from './meta';
import { registerServiceWorker } from './pwa';
import { createBattleView } from './render';
import { createUi } from './ui';
import { installAdminUi } from './ui/admin';

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function boot(): Promise<void> {
  const gameEl = document.getElementById('game');
  const uiEl = document.getElementById('ui');
  if (!gameEl || !uiEl) throw new Error('Tin Hats: the page has no #game or #ui element');

  const audio = createAudio();
  // The HUD is loaded here, before the UI exists, so it is never missing at the first frame of a battle.
  const [view, { createHud }] = await Promise.all([createBattleView(gameEl), import('./ui/hud')]);
  // Whatever is stored in this browser (an old save, damaged data, settings from a newer version), the game starts:
  // loading falls back to defaults by itself, and if building the app on the stored data still throws, it is built
  // again on an empty store.
  const app = withStorageFallback(
    browserStorage(),
    (storage) => new App({ view, audio, storage, showUnreleased: showUnreleased(window.location.search, import.meta.env.DEV) }),
    (err) => console.error('Tin Hats: the saved data could not be used; starting with defaults.', err),
  );
  // The hidden admin panel: nothing of it shows until the secret entry and the code (src/ui/admin).
  const admin = new AdminController({ app, view, ui: () => app.currentUi });
  const ui = createUi(uiEl, app, {
    paintUnitIcon: createIconPainter(app),
    paintUpgradePreview: createUpgradePainter(app),
    paintFlag: createFlagPainter(),
    createHud,
    onScreen: (screen) => {
      app.onScreen(screen);
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

  ui.show('title');
  document.getElementById('boot')?.remove();
  await nextFrame();
  await nextFrame();
  // The menu theme is rendered once in the background (OfflineAudioContext needs no gesture), after the first picture.
  audio.prepareMusic(MENU_MUSIC);
  if (debug) debug.ready = true;
}

boot().catch((err: unknown) => {
  console.error(err);
  const notice = document.getElementById('boot');
  if (notice) notice.textContent = 'Tin Hats could not start. Reload the page to try again.';
});

registerServiceWorker();
