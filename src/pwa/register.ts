/**
 * Service worker registration (PWA, offline play) and automatic updates.
 *
 * vite-plugin-pwa builds `sw.js` next to index.html: it precaches the whole build, so the game starts and plays with
 * no network. This module registers it and moves the player onto a new version by itself.
 *
 * - The worker URL and scope are resolved against the page (`document.baseURI`), so the relative base './' works from
 *   any sub-path.
 * - First visit: the worker installs and claims the open page (offline play is ready after a few seconds).
 * - Update (owner, 2026-11-11: nobody should be stuck on an old copy): the game asks for a new version at every launch
 *   and each time the tab comes back into view. A new build installs in the background; as soon as the player is not in
 *   a battle (UPDATE_BUSY_SCREENS) the page shows a short "Updating…" note, lets the new worker take over and reloads
 *   onto it. It never interrupts a battle: a version that arrives during one waits until the battle is left.
 * - Not registered in development, inside a Capacitor wrapper (the app files are already on the device) or on any
 *   origin that is not http(s).
 */

import type { ScreenId } from '../ui/contracts';

/** Screens an update must not interrupt: the briefing (a loadout is being picked), the battle and its result. */
export const UPDATE_BUSY_SCREENS: readonly ScreenId[] = ['briefing', 'battle', 'result'];
/** How often (ms) a waiting update looks again for a moment when the player is not busy. */
export const UPDATE_RETRY_MS = 2_000;
/** A tab coming back into view asks for a new version at most this often (ms). */
export const UPDATE_CHECK_EVERY_MS = 10 * 60_000;
/** Two update reloads closer together than this (ms) would be a loop: the second waits. */
export const UPDATE_RELOAD_GAP_MS = 20_000;
/** The note stays up at least this long (ms) before the reload, so it can be read. */
export const UPDATE_NOTE_MS = 700;
/** If the new worker has not taken over this long (ms) after it was asked to, the note is taken down again. */
export const UPDATE_GIVE_UP_MS = 15_000;
export const UPDATE_NOTE_TEXT = 'Updating…';
const RELOAD_AT_KEY = 'tinhats.swReloadedAt';

export interface SwEnvironment {
  /** `location.protocol`, for example "https:". */
  protocol: string;
  /** `'serviceWorker' in navigator`. */
  hasServiceWorker: boolean;
  /** True inside a Capacitor native shell. */
  native: boolean;
  /** True in a development build. */
  dev: boolean;
}

/** Whether the worker should be registered at all. */
export function shouldRegister(env: SwEnvironment): boolean {
  return !env.dev && !env.native && env.hasServiceWorker && (env.protocol === 'https:' || env.protocol === 'http:');
}

/** Whether a screen lets an update take over (anything but a briefing, a battle or its result). */
export function updateAllowedOn(screen: ScreenId | null): boolean {
  return screen === null || !UPDATE_BUSY_SCREENS.includes(screen);
}

/**
 * Whether the page may reload onto a new version now: never twice within UPDATE_RELOAD_GAP_MS (wall-clock ms; `lastAt`
 * is the previous update reload of this tab, or null). A clock that went backwards does not block it.
 */
export function reloadAllowed(lastAt: number | null, now: number): boolean {
  return lastAt === null || !Number.isFinite(lastAt) || now - lastAt >= UPDATE_RELOAD_GAP_MS || now < lastAt;
}

/** Whether a tab that came back into view should ask for a new version (`lastAt`: the previous check, wall-clock ms). */
export function checkDue(lastAt: number, now: number): boolean {
  return now - lastAt >= UPDATE_CHECK_EVERY_MS || now < lastAt;
}

function currentEnvironment(): SwEnvironment {
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return {
    protocol: window.location.protocol,
    hasServiceWorker: 'serviceWorker' in navigator,
    native: cap?.isNativePlatform?.() === true,
    dev: import.meta.env.DEV,
  };
}

// --- the screen the player is on (main.ts reports it) -----------------------------------------------------------------

let screenNow: ScreenId | null = null;

/** The UI changed screen: an update that was waiting for the battle to end may take over once it is left. */
export function reportScreen(screen: ScreenId): void {
  screenNow = screen;
}

// --- the reload guard and the note ------------------------------------------------------------------------------------

function lastReloadAt(): number | null {
  try {
    const raw = window.sessionStorage.getItem(RELOAD_AT_KEY);
    return raw === null ? null : Number(raw);
  } catch {
    return null;
  }
}

function markReload(now: number): void {
  try {
    window.sessionStorage.setItem(RELOAD_AT_KEY, String(now));
  } catch {
    // Storage blocked: a reload is still safe, the new worker is in charge by then.
  }
}

let note: HTMLElement | null = null;
let noteShownAt = 0;

/** The short "Updating…" note over the whole page (it looks like the loading notice the page starts with). */
function showNote(): void {
  if (note) return;
  note = document.createElement('div');
  note.dataset.testid = 'update-note';
  note.setAttribute('role', 'status');
  note.textContent = UPDATE_NOTE_TEXT;
  note.style.cssText =
    'position:fixed;inset:0;z-index:2000;display:flex;align-items:center;justify-content:center;background:#14150f;color:#c9bd9b;' +
    "font:700 18px/1 'Arial Narrow','Helvetica Neue',sans-serif;letter-spacing:0.3em;text-transform:uppercase";
  document.body.appendChild(note);
  noteShownAt = performance.now();
}

function hideNote(): void {
  note?.remove();
  note = null;
}

// --- the update itself ------------------------------------------------------------------------------------------------

/** True from the moment this page asked a waiting worker to take over. */
let switching = false;

/** Whether the player is free and no update reload has just happened. */
function freeNow(): boolean {
  return updateAllowedOn(screenNow) && reloadAllowed(lastReloadAt(), Date.now());
}

/**
 * A newer worker is installed and waiting. When the player is not in a battle, show the note and let it take over
 * (the page reloads when it has: see `watchController`). Until then, look again every UPDATE_RETRY_MS.
 */
function switchWhenFree(reg: ServiceWorkerRegistration): void {
  if (switching) return;
  const waiting = reg.waiting;
  // Nothing waiting any more (another tab let it in), or no worker runs this page yet (a first install claims it).
  if (!waiting || !navigator.serviceWorker.controller) return;
  if (!freeNow()) {
    window.setTimeout(() => switchWhenFree(reg), UPDATE_RETRY_MS);
    return;
  }
  switching = true;
  showNote();
  waiting.postMessage({ type: 'SKIP_WAITING' });
  // The worker never took over (it was replaced or broke): take the note down and try again later.
  window.setTimeout(() => {
    switching = false;
    hideNote();
    window.setTimeout(() => switchWhenFree(reg), UPDATE_RETRY_MS);
  }, UPDATE_GIVE_UP_MS);
}

/** Follow a worker that is installing until it is installed, then let it in when the player is free. */
function follow(reg: ServiceWorkerRegistration, worker: ServiceWorker | null): void {
  if (!worker) return;
  const installed = (): void => {
    if (worker.state === 'installed') switchWhenFree(reg);
  };
  worker.addEventListener('statechange', installed);
  installed();
}

/**
 * A different worker took over this page. The first time on a page no worker ran is the first install claiming it;
 * any other time a new version is in charge (this tab let it in, or another tab did): reload onto it, when free.
 */
function watchController(): void {
  let controlled = navigator.serviceWorker.controller !== null;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!controlled) {
      controlled = true;
      return;
    }
    const go = (): void => {
      // This page asked for the switch while the player was free; another tab's switch waits for a free moment here.
      if (!switching && !freeNow()) {
        window.setTimeout(go, UPDATE_RETRY_MS);
        return;
      }
      showNote();
      // Reload onto the new files, once the note has been up long enough to read.
      window.setTimeout(
        () => {
          markReload(Date.now());
          window.location.reload();
        },
        Math.max(0, UPDATE_NOTE_MS - (performance.now() - noteShownAt)),
      );
    };
    go();
  });
}

async function register(): Promise<void> {
  const base = document.baseURI;
  watchController();
  const reg = await navigator.serviceWorker.register(new URL('sw.js', base).href, { scope: new URL('./', base).href });
  // A version fetched during an earlier visit is waiting, or one is being fetched right now.
  switchWhenFree(reg);
  follow(reg, reg.installing);
  reg.addEventListener('updatefound', () => follow(reg, reg.installing));

  // Ask for a new version at launch, and again whenever the tab comes back into view (phone tabs stay open for days).
  let checkedAt = Date.now();
  const check = (): void => {
    checkedAt = Date.now();
    reg.update().catch(() => {
      // Offline, or the server is away: the game plays on from its cache.
    });
  };
  check();
  const back = (): void => {
    if (document.visibilityState === 'visible' && checkDue(checkedAt, Date.now())) check();
  };
  document.addEventListener('visibilitychange', back);
  window.addEventListener('pageshow', back);
}

/** Register the service worker once the page has loaded. Safe to call anywhere; failures are ignored (the game works without it). */
export function registerServiceWorker(): void {
  if (!shouldRegister(currentEnvironment())) return;
  const start = (): void => {
    register().catch((err: unknown) => {
      console.warn('Tin Hats: the service worker could not be registered', err);
    });
  };
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}
