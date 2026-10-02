/**
 * Bootstrap: the battle view in #game, the DOM UI in #ui, the audio engine,
 * the app controller that joins them, then the title screen.
 */
import './ui/theme.css';
import { createAudio } from './audio';
import { App } from './app/app';
import { debugEnabled, installDebug } from './app/debug';
import { MENU_MUSIC } from './app/menuStorm';
import { browserStorage, createIconPainter, installPageGuards } from './app/page';
import { registerServiceWorker } from './pwa';
import { createBattleView } from './render';
import { createUi } from './ui';

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
  const app = new App({ view, audio, storage: browserStorage() });
  const ui = createUi(uiEl, app, {
    paintUnitIcon: createIconPainter(app),
    createHud,
    onScreen: (screen) => app.onScreen(screen),
    onPortrait: (portrait) => {
      if (portrait) app.autoPause();
    },
  });
  app.attachUi(ui);
  installPageGuards(app, audio);
  const debug = debugEnabled(window.location.search) ? installDebug(app, view, ui, audio) : null;

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
