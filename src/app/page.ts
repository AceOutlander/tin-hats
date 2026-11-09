/**
 * Browser plumbing for the app: persistent storage, the audio unlock on the
 * first gesture, auto-pause when the page loses focus, and the unit icon painter.
 */
import { paintUnitPortrait } from '../art/icons';
import { paintUpgradePreview } from '../art/upgradePreview';
import type { GameAudio } from '../audio';
import { isVehicleKind, missionEra } from '../data/eras';
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
    const session = app.session;
    const faction = session ? session.battle.state.sides[side].faction : DEFAULT_FACTIONS[side];
    // A vehicle's portrait shows the mission's era look (the BT-7 in June 1941; src/data/eras.ts).
    const look = session && isVehicleKind(kind) ? missionEra(session.mission, faction).vehicle[kind] : undefined;
    paintUnitPortrait(canvas, kind, faction, undefined, look);
  };
}

/** The Quartermaster's battle previews: the player's nation, its other upgrades at their bought levels. */
export function createUpgradePainter(app: App): (canvas: HTMLCanvasElement, upgradeId: string, level: number) => boolean {
  return (canvas, upgradeId, level) => paintUpgradePreview(canvas, upgradeId, level, DEFAULT_FACTIONS[0], app.save.upgrades);
}

/**
 * Unlock audio on the first user gesture and pause a running battle when the
 * tab is hidden, the window loses focus or the page is put away. A hidden page is
 * also silent (menus too); sound returns when the page does, but a paused battle
 * stays paused. The title storm freezes in all three cases and carries on when the
 * page is back in front. Returns a function that removes the listeners.
 */
export function installPageGuards(app: App, audio: GameAudio, doc: Document = document, win: Window = window): () => void {
  const gestures = ['pointerdown', 'touchend', 'keydown'] as const;

  const unlock = (): void => {
    audio.unlock();
    if (audio.getStats().state === 'running') for (const g of gestures) doc.removeEventListener(g, unlock, true);
  };
  const arm = (): void => {
    // Adding the same listener twice is a no-op, so this is safe whether or not the first unlock already happened.
    for (const g of gestures) doc.addEventListener(g, unlock, true);
  };
  const onVisibility = (): void => {
    if (doc.visibilityState === 'hidden') {
      app.pageHidden();
    } else {
      // A suspended context may refuse to restart without a gesture (iOS): the next touch will do it.
      app.pageShown();
      arm();
    }
  };
  // Losing focus (another window in front) pauses a battle and freezes the title storm; other menus keep their sound.
  const onAway = (): void => app.pageBlurred();
  const onFocus = (): void => {
    if (doc.visibilityState === 'hidden') return;
    app.pageFocused();
    arm();
  };
  const onHide = (): void => app.pageHidden();

  arm();
  doc.addEventListener('visibilitychange', onVisibility);
  win.addEventListener('blur', onAway);
  win.addEventListener('focus', onFocus);
  win.addEventListener('pagehide', onHide);

  return () => {
    for (const g of gestures) doc.removeEventListener(g, unlock, true);
    doc.removeEventListener('visibilitychange', onVisibility);
    win.removeEventListener('blur', onAway);
    win.removeEventListener('focus', onFocus);
    win.removeEventListener('pagehide', onHide);
  };
}
