/**
 * The admin panel as the rest of the game sees it: one part the game is handed at start, or nothing.
 *
 * Types only, so that both modules a build may put here can be typed against it: `./index.ts` (the panel) and
 * `./none.ts` (no panel). See docs/PLATFORM.md, "A build without the admin panel".
 */
import type { App } from '../app/app';
import type { AdminHooks } from '../app/debug';
import type { BattleView } from '../render/contracts';
import type { UiApi } from '../ui/contracts';

export interface AdminPanelDeps {
  app: App;
  view: BattleView;
  /** The app's own UI (shows a screen, refreshes the current one); null until it is attached. */
  ui: () => UiApi | null;
}

export interface AdminPanelPart {
  /** Make the title's emblem the place of the secret entry. Called each time the title screen is built. */
  markEntry(emblem: HTMLElement): void;
  /** Put the panel's two listeners on the UI's root. Nothing shows until the secret entry and the code. */
  install(root: HTMLElement): void;
  /** The UI changed screen. */
  screenChanged(): void;
  /** What ?debug=1 puts on window.__TH.admin. */
  debugHooks(): AdminHooks;
}

/** The one thing either module exports, as `createAdminPanel`. Null = this build has no admin panel. */
export type CreateAdminPanel = (deps: AdminPanelDeps) => AdminPanelPart | null;
