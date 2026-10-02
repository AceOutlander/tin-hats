/**
 * The DOM user interface: menu screens, the rotate overlay, page lockdown and
 * the slot the battle HUD lives in. Written against src/ui/contracts.ts; it
 * never imports the simulation or Phaser.
 *
 *   const ui = createUi(document.getElementById('ui')!, app, { paintUnitIcon });
 *   ui.show('title');
 */
import { version as packageVersion } from '../../package.json';
import type { AppApi, CampaignView, HudState, PanelDropsState, ScreenId, UiApi } from './contracts';
import { briefingScreen } from './screens/briefing';
import { campaignScreen } from './screens/campaign';
import { quartermasterScreen } from './screens/quartermaster';
import { resultScreen } from './screens/result';
import { settingsScreen } from './screens/settings';
import { titleScreen } from './screens/title';
import { createConfirmLayer } from './shell/confirm';
import { el } from './shell/dom';
import { installLockdown } from './shell/lockdown';
import './shell/menus.css';
import { createRotateOverlay } from './shell/rotate';
import type { CreateHud, HudHandle, ScreenCtx, ScreenFactory, ScreenView, ShowPayload, UiOptions, UiSession } from './shell/types';
import './theme.css';

export type { CreateHud, HudHandle, HudOptions, UiOptions } from './shell/types';
export type { PaintUnitIcon } from './shell/icons';
export { installLockdown } from './shell/lockdown';

/** Must match --th-fade in menus.css. */
const FADE_MS = 150;

/**
 * A screen takes no touch for this many milliseconds after it appears, so the second tap of a double-tap (or a thumb
 * still mashing buttons as a battle ends) does not land on whatever sits where the old button was. The result
 * screen waits longest: the player is most likely to be tapping hard when it comes up.
 */
const ARRIVE_MS_DEFAULT = 260;
const ARRIVE_MS: Partial<Record<ScreenId, number>> = { result: 800 };

export interface UiHandle extends UiApi {
  /** Whatever the HUD's getButtonRects() returns, or null while there is no HUD. */
  getHudButtonRects(): unknown;
  /** True while the "rotate your phone" overlay covers the game. */
  isPortrait(): boolean;
  /** Remove every element and listener this UI added. */
  destroy(): void;
}

const SCREENS: Record<Exclude<ScreenId, 'battle'>, ScreenFactory> = {
  title: titleScreen,
  campaign: campaignScreen,
  briefing: briefingScreen,
  quartermaster: quartermasterScreen,
  result: resultScreen,
  settings: settingsScreen,
};

export function createUi(root: HTMLElement, app: AppApi, opts: UiOptions = {}): UiHandle {
  const options: UiOptions = { ...opts, version: opts.version ?? `v${packageVersion}` };
  const doc = root.ownerDocument;
  const win = doc.defaultView ?? window;

  root.classList.add('th-ui');
  const hudRoot = el('div', 'th-hud-root');
  const screens = el('div', 'th-screens');
  root.append(hudRoot, screens);

  const confirmLayer = createConfirmLayer(root, (open) => {
    screens.toggleAttribute('inert', open);
  });
  const rotate = createRotateOverlay(root, (portrait) => {
    if (options.onPortrait) options.onPortrait(portrait);
  });

  const session: UiSession = { missionId: 0, difficulty: null, result: null, settingsFrom: 'title' };
  let currentId: ScreenId = 'title';
  let active: ScreenView | null = null;
  let cache: CampaignView | null = null;
  let keyboardMode = false;
  let destroyed = false;
  const timers = new Set<number>();

  // --- HUD ---------------------------------------------------------------
  let hud: HudHandle | null = null;
  let hudVisible = false;

  function mountHud(factory: CreateHud): void {
    if (destroyed || hud) return;
    try {
      hud = factory(hudRoot, app, { paintUnitIcon: options.paintUnitIcon });
      hud.setVisible(hudVisible);
    } catch (err) {
      hud = null;
      console.warn('Tin Hats UI: the HUD failed to start', err);
    }
  }

  if (options.createHud) {
    mountHud(options.createHud);
  } else if (options.createHud === undefined) {
    // The HUD is another track's module; a glob import resolves to nothing if it is not there yet.
    const loaders = import.meta.glob<{ createHud?: CreateHud }>('./hud/index.ts');
    const load = loaders['./hud/index.ts'];
    if (load) {
      load().then(
        (mod) => {
          if (mod.createHud) mountHud(mod.createHud);
        },
        (err: unknown) => console.warn('Tin Hats UI: the HUD module failed to load', err),
      );
    }
  }

  function setHudVisible(visible: boolean): void {
    hudVisible = visible;
    hudRoot.classList.toggle('is-visible', visible);
    if (hud) hud.setVisible(visible);
  }

  // --- Screens -----------------------------------------------------------
  function view(): CampaignView {
    if (!cache) cache = app.campaign();
    return cache;
  }

  function focusPrimary(scope: HTMLElement): void {
    const primary = scope.querySelector<HTMLButtonElement>('[data-primary]:not(:disabled)') ?? scope.querySelector<HTMLButtonElement>('button:not(:disabled)');
    if (primary) primary.focus({ preventScroll: true });
  }

  function retire(old: ScreenView, fade: boolean): void {
    if (old.destroy) old.destroy();
    if (!fade) {
      old.el.remove();
      return;
    }
    old.el.classList.remove('is-in');
    old.el.classList.add('is-out');
    old.el.setAttribute('inert', '');
    const timer = win.setTimeout(() => {
      timers.delete(timer);
      old.el.remove();
    }, FADE_MS + 40);
    timers.add(timer);
  }

  function mount(screen: Exclude<ScreenId, 'battle'>, fade: boolean): void {
    const next = SCREENS[screen](ctx);
    if (fade) {
      next.el.classList.add('is-arriving');
      const timer = win.setTimeout(() => {
        timers.delete(timer);
        next.el.classList.remove('is-arriving');
      }, ARRIVE_MS[screen] ?? ARRIVE_MS_DEFAULT);
      timers.add(timer);
    }
    screens.append(next.el);
    if (next.mounted) next.mounted();
    if (fade) void next.el.offsetWidth;
    else next.el.classList.add('is-instant');
    next.el.classList.add('is-in');
    active = next;
    if (keyboardMode) focusPrimary(next.el);
  }

  function show(screen: ScreenId, payload?: ShowPayload): void {
    if (destroyed) return;
    if (payload && payload.missionId !== undefined) session.missionId = payload.missionId;
    if (payload && payload.result) session.result = payload.result;
    confirmLayer.cancel();
    cache = null;
    const old = active;
    active = null;
    currentId = screen;
    if (old) retire(old, true);
    if (screen !== 'battle') mount(screen, true);
    setHudVisible(screen === 'battle');
    root.dataset.screen = screen;
    if (options.onScreen) options.onScreen(screen);
  }

  function reload(): void {
    if (destroyed) return;
    cache = null;
    if (!active || currentId === 'battle') return;
    if (active.refresh) {
      active.refresh();
      return;
    }
    // Screens without an in-place refresh are simply rebuilt, with no fade.
    const old = active;
    active = null;
    retire(old, false);
    mount(currentId, false);
  }

  const ctx: ScreenCtx = {
    app,
    opts: options,
    session,
    view,
    reload,
    go: show,
    confirm(request) {
      confirmLayer.open(request, (name) => app.uiSound(name), keyboardMode);
    },
    keyboard: () => keyboardMode,
  };

  // --- Global input ------------------------------------------------------
  function onKeyDown(ev: KeyboardEvent): void {
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    keyboardMode = true;
    if (rotate.isPortrait()) return;
    if (ev.key === 'Escape') {
      if (confirmLayer.isOpen()) {
        app.uiSound('click');
        confirmLayer.cancel();
        ev.preventDefault();
      } else if (active && active.back) {
        app.uiSound('click');
        active.back();
        ev.preventDefault();
      }
      return;
    }
    const scope = confirmLayer.isOpen() ? confirmLayer.el : active ? active.el : null;
    if (!scope) return;
    const focused = doc.activeElement;
    const focusInside = focused instanceof HTMLElement && scope.contains(focused);
    if (ev.key === 'Enter' || ev.key === ' ') {
      // With nothing focused, Enter and Space press the screen's main button.
      if (!focusInside) {
        const primary = scope.querySelector<HTMLButtonElement>('[data-primary]:not(:disabled)');
        if (primary) {
          primary.focus({ preventScroll: true });
          primary.click();
          ev.preventDefault();
        }
      }
      return;
    }
    if (!confirmLayer.isOpen() && active && active.key && active.key(ev)) ev.preventDefault();
  }

  function onPointerDown(): void {
    keyboardMode = false;
  }

  let resizeQueued = false;
  function onResize(): void {
    if (resizeQueued) return;
    resizeQueued = true;
    win.requestAnimationFrame(() => {
      resizeQueued = false;
      if (destroyed) return;
      rotate.check();
      if (active && active.resize) active.resize();
    });
  }

  doc.addEventListener('keydown', onKeyDown);
  doc.addEventListener('pointerdown', onPointerDown, true);
  win.addEventListener('resize', onResize);
  win.addEventListener('orientationchange', onResize);
  const unlock = options.lockdown === false ? null : installLockdown(doc);
  rotate.check();

  return {
    show,
    current: () => currentId,
    updateHud(state: HudState) {
      if (hud) hud.update(state);
    },
    updateTitleDrops(drops: PanelDropsState) {
      if (active && active.drops) active.drops(drops);
    },
    refresh: reload,
    getHudButtonRects: () => (hud ? hud.getButtonRects() : null),
    isPortrait: () => rotate.isPortrait(),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      doc.removeEventListener('keydown', onKeyDown);
      doc.removeEventListener('pointerdown', onPointerDown, true);
      win.removeEventListener('resize', onResize);
      win.removeEventListener('orientationchange', onResize);
      if (unlock) unlock();
      for (const timer of timers) win.clearTimeout(timer);
      timers.clear();
      confirmLayer.cancel();
      if (active && active.destroy) active.destroy();
      active = null;
      if (hud) hud.destroy();
      hud = null;
      hudRoot.remove();
      screens.remove();
      confirmLayer.el.remove();
      rotate.el.remove();
      root.classList.remove('th-ui', 'is-portrait');
    },
  };
}
