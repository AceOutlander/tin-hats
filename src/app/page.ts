/**
 * Browser plumbing for the app: persistent storage, the audio unlock on the
 * first gesture, auto-pause when the page loses focus, and the unit icon painter.
 */
import { paintUnitPortrait } from '../art/icons';
import type { GameAudio } from '../audio';
import type { FactionId, Side, UnitKind } from '../data/schema';
import { createMemoryStorage, type StorageLike } from '../meta';
import type { App } from './app';

/** localStorage if it works (it can throw or be full in private windows), else a store that lives until the page closes. */
export function browserStorage(win: Window = window): StorageLike {
  try {
    const probe = 'tinhats.probe';
    win.localStorage.setItem(probe, '1');
    win.localStorage.removeItem(probe);
    return win.localStorage;
  } catch {
    return createMemoryStorage();
  }
}

const DEFAULT_FACTIONS: readonly [FactionId, FactionId] = ['british', 'german'];

/** The painter the UI calls for unit portraits: side 0 and 1 are mapped to the factions of the battle in progress. */
export function createIconPainter(app: App): (canvas: HTMLCanvasElement, kind: UnitKind, side: Side) => void {
  return (canvas, kind, side) => {
    const faction = app.session ? app.session.battle.state.sides[side].faction : DEFAULT_FACTIONS[side];
    paintUnitPortrait(canvas, kind, faction);
  };
}

/**
 * Unlock audio on the first user gesture and pause a running battle when the
 * tab is hidden, the window loses focus or the page is put away. Nothing here
 * resumes by itself. Returns a function that removes the listeners.
 */
export function installPageGuards(app: App, audio: GameAudio, doc: Document = document, win: Window = window): () => void {
  const gestures = ['pointerdown', 'touchend', 'keydown'] as const;

  const unlock = (): void => {
    audio.unlock();
    if (audio.getStats().state === 'running') for (const g of gestures) doc.removeEventListener(g, unlock, true);
  };
  const onVisibility = (): void => {
    if (doc.visibilityState === 'hidden') app.autoPause();
  };
  const onAway = (): void => app.autoPause();

  for (const g of gestures) doc.addEventListener(g, unlock, true);
  doc.addEventListener('visibilitychange', onVisibility);
  win.addEventListener('blur', onAway);
  win.addEventListener('pagehide', onAway);

  return () => {
    for (const g of gestures) doc.removeEventListener(g, unlock, true);
    doc.removeEventListener('visibilitychange', onVisibility);
    win.removeEventListener('blur', onAway);
    win.removeEventListener('pagehide', onAway);
  };
}
