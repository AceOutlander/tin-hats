/**
 * Bootstrap: the battle view in #game, the DOM UI in #ui, the audio engine,
 * the app controller that joins them, then the title screen.
 * src/main.ts loads this module (after the engine) and calls boot().
 */
import { createAudio } from './audio';
import { App } from './app/app';
import { debugEnabled, installDebug } from './app/debug';
import { MENU_MUSIC } from './app/menuStorm';
import { browserStorage, createCosmeticPainter, createFlagPainter, createIconPainter, createUpgradePainter, installPageGuards, showUnreleased } from './app/page';
import { STARTUP_PROGRESS, markStartup, viewProgress } from './app/startup';
import { withStorageFallback } from './meta';
import { platform } from './platform';
import { ownsExtraUnit } from './platform/extraUnit';
import type { SettingsSection, StoreSection } from './platform/types';
import { installShell, screenReporter } from './platform/shell';
import { reportScreen } from './pwa';
import { createBattleView, nextTask } from './render';
import { createUi } from './ui';
// After the UI: the panel's styles follow the game's in the built stylesheet, as they always have.
import { createAdminPanel } from './adminPanel';

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
  // Whether supply crates may be bought here is the platform's to say (the website's says nothing: they may); a test
  // may stand an answer in.
  let standInCrateBuying: boolean | null = null;
  const crateBuying = (): boolean => standInCrateBuying ?? platform.crateBuying?.() ?? true;
  // Whatever is stored in this browser (an old save, damaged data, settings from a newer version), the game starts:
  // loading falls back to defaults by itself, and if building the app on the stored data still throws, it is built
  // again on an empty store.
  const app = withStorageFallback(
    browserStorage(),
    (storage) => new App({ view, audio, storage, showUnreleased: showUnreleased(window.location.search, import.meta.env.DEV), extraUnit: ownsExtraUnit, crateBuying, cosmetics: platform.cosmetics }),
    (err) => console.error('Tin Hats: the saved data could not be used; starting with defaults.', err),
  );
  markStartup('th:app');
  progress(STARTUP_PROGRESS.app);
  await nextTask();
  // The hidden admin panel: nothing of it shows until the secret entry and the code (src/ui/admin). Null in a build
  // made without the panel (src/adminPanel): there is then no entry, no listener and no code of it at all.
  const admin = createAdminPanel({ app, view, ui: () => app.currentUi });
  // An installed app's lifecycle and back action; on the website there is none and this does nothing (src/platform).
  const shell = installShell(platform, app, document);
  // The Shop's store section is the platform's (the website has none); the debug hooks may stand one in for a test.
  let standInStore: StoreSection | null | undefined;
  let standInReward: StoreSection | null | undefined;
  let standInMembership: StoreSection | null | undefined;
  let standInBadge: string | null | undefined;
  // A platform may be told of each change of screen (the website's is not: it has no such hook).
  const reportScreenToPlatform = screenReporter(platform);
  let standInSettings: SettingsSection | null | undefined;
  const ui = createUi(uiEl, app, {
    store: () => (standInStore !== undefined ? standInStore : platform.store),
    reward: () => (standInReward !== undefined ? standInReward : platform.reward),
    membership: () => (standInMembership !== undefined ? standInMembership : (platform.membership ?? null)),
    badge: () => (standInBadge !== undefined ? standInBadge : (platform.badge?.() ?? null)),
    settings: () => (standInSettings !== undefined ? standInSettings : platform.settings),
    // The word before the version number is the game's own unless the platform names another, or none.
    releaseStage: platform.releaseStage,
    paintUnitIcon: createIconPainter(app),
    paintUpgradePreview: createUpgradePainter(app),
    paintFlag: createFlagPainter(),
    paintCosmetic: createCosmeticPainter(app),
    createHud,
    titleEmblem: admin?.markEntry,
    onScreen: (screen) => {
      app.onScreen(screen);
      // A new version of the game waits for the battle screens to be left (src/pwa).
      reportScreen(screen);
      admin?.screenChanged();
      shell.screenChanged(screen);
      reportScreenToPlatform(screen);
    },
    onPortrait: (portrait) => {
      if (portrait) app.autoPause();
    },
  });
  app.attachUi(ui);
  admin?.install(uiEl);
  installPageGuards(app, audio);
  const debug = debugEnabled(window.location.search) ? installDebug(app, view, ui, audio, admin ? admin.debugHooks() : null, (store) => (standInStore = store), (section) => (standInSettings = section), (section) => (standInReward = section), (section) => (standInMembership = section), (label) => (standInBadge = label), (on) => (standInCrateBuying = on)) : null;
  // What the game lends its platform (an installed app's; the website's takes nothing).
  platform.attach?.({
    grantMedals: (medals, grantId) => app.grantMedals(medals, grantId),
    grantCrate: (crate, grantId) => app.grantCrate(crate, grantId),
    grantItem: (item, grantId) => app.grantItem(item, grantId),
    saveText: () => app.saveText(),
    readSave: (text) => app.readSave(text),
    replaceSave: (text) => app.takeSave(text),
    onSaveChanged: (listener) => app.onSaveChanged(listener),
  });
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
