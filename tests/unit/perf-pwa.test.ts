import { describe, expect, it } from 'vitest';
import { UPDATE_BUSY_SCREENS, UPDATE_CHECK_EVERY_MS, UPDATE_NOTE_TEXT, UPDATE_RELOAD_GAP_MS, checkDue, reloadAllowed, shouldRegister, updateAllowedOn, type SwEnvironment } from '../../src/pwa';

const WEB: SwEnvironment = { protocol: 'https:', hasServiceWorker: true, native: false, dev: false };

describe('service worker registration', () => {
  it('registers on a production web page', () => {
    expect(shouldRegister(WEB)).toBe(true);
    expect(shouldRegister({ ...WEB, protocol: 'http:' })).toBe(true);
  });

  it('stays out of development builds', () => {
    expect(shouldRegister({ ...WEB, dev: true })).toBe(false);
  });

  it('stays out of a Capacitor wrapper, where the files are already on the device', () => {
    expect(shouldRegister({ ...WEB, native: true })).toBe(false);
  });

  it('needs a browser with service workers and an http(s) origin', () => {
    expect(shouldRegister({ ...WEB, hasServiceWorker: false })).toBe(false);
    for (const protocol of ['file:', 'capacitor:', 'ionic:', 'app:']) expect(shouldRegister({ ...WEB, protocol })).toBe(false);
  });

  it('lets a new version take over on every screen but the briefing, the battle and its result', () => {
    expect([...UPDATE_BUSY_SCREENS].sort()).toEqual(['battle', 'briefing', 'result']);
    for (const screen of ['title', 'campaigns', 'campaign', 'quartermaster', 'armoury', 'settings'] as const) expect(updateAllowedOn(screen), screen).toBe(true);
    for (const screen of ['briefing', 'battle', 'result'] as const) expect(updateAllowedOn(screen), screen).toBe(false);
    // Before the first screen is up (the page is still loading) nothing can be interrupted.
    expect(updateAllowedOn(null)).toBe(true);
  });

  it('updates as often as versions arrive, not once per tab, but never reloads in a loop', () => {
    const t0 = 1_700_000_000_000;
    expect(reloadAllowed(null, t0)).toBe(true);
    expect(reloadAllowed(t0, t0 + 1_000)).toBe(false);
    expect(reloadAllowed(t0, t0 + UPDATE_RELOAD_GAP_MS - 1)).toBe(false);
    // A later version in the same tab is taken as well (the old rule allowed one update per tab, which left players stuck).
    expect(reloadAllowed(t0, t0 + UPDATE_RELOAD_GAP_MS)).toBe(true);
    expect(reloadAllowed(t0, t0 + 3_600_000)).toBe(true);
    // A damaged stored time or a clock set back never blocks an update for good.
    expect(reloadAllowed(Number.NaN, t0)).toBe(true);
    expect(reloadAllowed(t0, t0 - 5_000)).toBe(true);
    expect(UPDATE_RELOAD_GAP_MS).toBeGreaterThanOrEqual(5_000);
    expect(UPDATE_RELOAD_GAP_MS).toBeLessThanOrEqual(60_000);
  });

  it('asks for a new version when a tab comes back into view, at most every few minutes', () => {
    const t0 = 1_700_000_000_000;
    expect(checkDue(t0, t0 + 1_000)).toBe(false);
    expect(checkDue(t0, t0 + UPDATE_CHECK_EVERY_MS)).toBe(true);
    expect(checkDue(t0, t0 - 1)).toBe(true);
    expect(UPDATE_CHECK_EVERY_MS).toBeLessThanOrEqual(30 * 60_000);
  });

  it('tells the player it is updating', () => {
    expect(UPDATE_NOTE_TEXT).toBe('Updating…');
  });
});
