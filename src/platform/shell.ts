/**
 * Joins an installed app's lifecycle to the game (docs/PLATFORM.md). With no shell (the website) nothing is installed.
 *
 * - The app goes to the background: exactly what a hidden page does (a running battle pauses, all sound stops). It
 *   comes back: sound returns; a paused battle stays paused until the player resumes it.
 * - The system back action is the game's own "back" key: it closes the panel on top, leaves a menu screen for the one
 *   before it, and in a battle opens the pause menu (or closes it). It never leaves a battle by itself. Where the game
 *   has nothing to go back to (the title) it reports "not used" and the platform decides.
 * - The screen is kept lit during a battle only.
 */
import type { ScreenId } from '../ui/contracts';
import type { Platform } from './types';

/** What the shell needs of the app controller. */
export interface ShellApp {
  pageHidden(): void;
  pageShown(): void;
}

const backPresses = new WeakSet<Event>();

/** Whether a key event is the system back action passed on by `pressBack` (not a key the player pressed). */
export function isBackPress(ev: Event): boolean {
  return backPresses.has(ev);
}

/**
 * Hand the system back action to the game as its "back" key (Escape), through the same listeners a keyboard reaches.
 * Returns true when something used it.
 */
export function pressBack(doc: Document): boolean {
  const ev = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true });
  backPresses.add(ev);
  return !doc.dispatchEvent(ev);
}

export interface ShellHandle {
  /** The UI changed screen. */
  screenChanged(screen: ScreenId): void;
  /** Remove every listener. */
  destroy(): void;
}

const NO_SHELL: ShellHandle = { screenChanged: () => undefined, destroy: () => undefined };

export function installShell(platform: Platform, app: ShellApp, doc: Document): ShellHandle {
  const shell = platform.shell;
  if (!shell) return NO_SHELL;
  const off = [shell.onPause(() => app.pageHidden()), shell.onResume(() => app.pageShown()), shell.onBack(() => pressBack(doc))];
  let awake = false;
  return {
    screenChanged(screen) {
      const battle = screen === 'battle';
      if (battle === awake) return;
      awake = battle;
      shell.keepAwake(battle);
    },
    destroy() {
      for (const remove of off) remove();
      if (awake) shell.keepAwake(false);
      awake = false;
    },
  };
}
