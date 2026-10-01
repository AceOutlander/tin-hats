/**
 * Service worker registration (PWA, offline play).
 *
 * vite-plugin-pwa builds `sw.js` next to index.html: it precaches the whole build, so the game starts and plays with
 * no network. This module only registers it.
 *
 * - The worker URL and scope are resolved against the page (`document.baseURI`), so the relative base './' works from
 *   any sub-path.
 * - First visit: the worker installs and claims the open page (offline play is ready after a few seconds).
 * - Update: a new build installs in the background and WAITS. It never takes over a battle. At the next launch (a page
 *   load that finds a worker waiting from an earlier visit) it is activated at once, within the first seconds, before
 *   the player has started anything, and the page reloads once onto the new version.
 * - Not registered in development, inside a Capacitor wrapper (the app files are already on the device) or on any
 *   origin that is not http(s).
 */

/** A page load older than this (ms) is already in play: a waiting worker is left for the next launch. */
export const LAUNCH_WINDOW_MS = 10_000;
const RELOAD_FLAG = 'tinhats.swReloaded';

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

function currentEnvironment(): SwEnvironment {
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return {
    protocol: window.location.protocol,
    hasServiceWorker: 'serviceWorker' in navigator,
    native: cap?.isNativePlatform?.() === true,
    dev: import.meta.env.DEV,
  };
}

/** True the first time it is asked in this tab's session (a worker reloads the page at most once). */
function firstReloadThisSession(): boolean {
  try {
    if (window.sessionStorage.getItem(RELOAD_FLAG) === '1') return false;
    window.sessionStorage.setItem(RELOAD_FLAG, '1');
  } catch {
    // Storage blocked: reloading once is still safe, the page is at launch.
  }
  return true;
}

async function register(): Promise<void> {
  const base = document.baseURI;
  const reg = await navigator.serviceWorker.register(new URL('sw.js', base).href, { scope: new URL('./', base).href });
  // A version fetched during an earlier visit is waiting and this page is just starting: switch to it now.
  const waiting = reg.waiting;
  if (waiting && navigator.serviceWorker.controller && performance.now() < LAUNCH_WINDOW_MS && firstReloadThisSession()) {
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
    waiting.postMessage({ type: 'SKIP_WAITING' });
  }
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
