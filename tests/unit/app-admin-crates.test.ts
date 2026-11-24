/**
 * The admin panel's Crates tab without its DOM: the session switch for crates and the Appearance tab, granting crates,
 * giving and clearing items, and the odds test (a long run of real draws, counted). The lock is a test-only code, as
 * in app-admin.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { AdminController } from '../../src/app/admin';
import { AdminLock, codeHash } from '../../src/app/adminLock';
import { App } from '../../src/app/app';
import { ADMIN } from '../../src/data/admin';
import { COSMETICS } from '../../src/data/cosmetics';
import { CRATES, oddsPercent } from '../../src/data/crates';
import { createMemoryStorage, loadSave } from '../../src/meta';
import { createFakeAudio, createFakeUi, createFakeView } from './app-helpers';

function makeAdmin() {
  const storage = createMemoryStorage();
  const view = createFakeView();
  const ui = createFakeUi();
  let n = 0;
  // A plain counter for "random", so the runs below are the same every time.
  const app = new App({ view, audio: createFakeAudio(), storage, random: () => ((n++ * 7919) % 1000) / 1000 });
  app.attachUi(ui);
  const admin = new AdminController({ app, view, ui: () => ui, lock: new AdminLock(codeHash('test-only code')) });
  return { app, admin, storage };
}

describe('the admin panel\'s Crates tab', () => {
  it('is a tab of the panel, with its four entries', () => {
    const tab = ADMIN.tabs.find((t) => t.id === 'crates');
    expect(tab?.label).toBe('Crates');
    expect(tab?.entries.map((e) => e.id)).toEqual(['cosmeticsSwitch', 'crateGrants', 'cosmeticItems', 'oddsTest']);
  });

  it('shows crates and Appearance for the session and hides them again, saving nothing of the switch', () => {
    const { app, admin, storage } = makeAdmin();
    expect(admin.info().cosmetics.enabled).toBe(false);
    expect('crates' in app.campaign()).toBe(false);
    admin.run({ type: 'cosmetics', on: true });
    expect(admin.info().cosmetics.enabled).toBe(true);
    expect(app.campaign().crates?.cards.length).toBe(CRATES.defs.length);
    expect(app.campaign().appearance).toBeDefined();
    expect(storage.getItem('tinhats.save')).toBeNull();
    admin.run({ type: 'cosmetics', on: false });
    expect('crates' in app.campaign()).toBe(false);
    // A new session starts hidden again.
    expect(new App({ view: createFakeView(), audio: createFakeAudio(), storage }).cosmeticsEnabled).toBe(false);
  });

  it('grants crates of every type that can be opened, and takes them back, never below none', () => {
    const { admin, storage } = makeAdmin();
    expect(admin.info().cosmetics.crates.map((c) => [c.id, c.held, c.available])).toEqual([
      ['standard', 0, true],
      ['premium', 0, true],
      ['elite', 0, true],
      ['titan', 0, true],
      ['god', 0, false],
    ]);
    admin.run({ type: 'crates', id: 'standard', amount: 5 });
    admin.run({ type: 'crates', id: 'titan', amount: 1 });
    admin.run({ type: 'crates', id: 'god', amount: 1 });
    admin.run({ type: 'crates', id: 'nonsense', amount: 1 });
    expect(loadSave(storage).data.cosmetics?.crates).toEqual({ standard: 5, titan: 1 });
    admin.run({ type: 'crates', id: 'standard', amount: -9 });
    expect(admin.info().cosmetics.crates[0].held).toBe(0);
    expect(loadSave(storage).data.cosmetics?.crates).toEqual({ titan: 1 });
  });

  it('gives every item, and clears items, crates and counters', () => {
    const { admin, storage } = makeAdmin();
    expect(admin.info().cosmetics).toMatchObject({ owned: 0, items: COSMETICS.items.length });
    admin.run({ type: 'cosmeticItems', op: 'giveAll' });
    expect(admin.info().cosmetics.owned).toBe(COSMETICS.items.length);
    admin.run({ type: 'crates', id: 'elite', amount: 2 });
    admin.run({ type: 'medals', amount: 100 });
    admin.run({ type: 'cosmeticItems', op: 'clear' });
    expect(admin.info().cosmetics.owned).toBe(0);
    const stored = loadSave(storage).data;
    expect('cosmetics' in stored).toBe(false);
    expect(stored.medals).toBe(100);
  });

  it('tests the odds: a large run with the counts shown, which owns and changes nothing', () => {
    const { app, admin, storage } = makeAdmin();
    expect(admin.info().odds).toBeNull();
    expect(admin.info().cosmetics.oddsRuns).toBe(CRATES.oddsTestRuns);
    expect(CRATES.oddsTestRuns).toBeGreaterThanOrEqual(100_000);
    const before = JSON.stringify(app.save);
    admin.run({ type: 'oddsTest', id: 'standard' });
    const run = admin.info().odds;
    expect(run?.crate).toBe('Standard Crate');
    expect(run?.runs).toBe(CRATES.oddsTestRuns);
    expect(run?.rows.map((r) => r.rarity)).toEqual(['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic']);
    expect(run?.rows.map((r) => r.table)).toEqual(CRATES.defs[0].odds.map((o) => oddsPercent(o.parts)));
    expect(run?.rows.reduce((n, r) => n + r.count, 0)).toBe(CRATES.oddsTestRuns);
    // The guarantees show: more Rares and Legendaries than the table alone gives, and only those two are ever raised.
    const row = (name: string) => run?.rows.find((r) => r.rarity === name);
    expect(row('Rare')?.count).toBeGreaterThan(CRATES.oddsTestRuns * 0.18);
    expect(row('Legendary')?.count).toBeGreaterThan(CRATES.oddsTestRuns * 0.03);
    expect(row('Rare')?.guaranteed).toBeGreaterThan(0);
    expect(row('Legendary')?.guaranteed).toBeGreaterThan(0);
    for (const name of ['Common', 'Uncommon', 'Epic', 'Mythic']) expect(row(name)?.guaranteed).toBe(0);
    expect(row('Epic')?.share).toMatch(/^\d+\.\d\d%$/);
    // A crate with no guarantee comes out at its table.
    admin.run({ type: 'oddsTest', id: 'titan' });
    const titan = admin.info().odds;
    expect(titan?.crate).toBe('Titan Crate');
    expect((titan?.rows[0].count ?? 0) / CRATES.oddsTestRuns).toBeGreaterThan(0.59);
    expect((titan?.rows[0].count ?? 0) / CRATES.oddsTestRuns).toBeLessThan(0.61);
    expect(titan?.rows.every((r) => r.guaranteed === 0)).toBe(true);
    // An unknown crate leaves nothing to show.
    admin.run({ type: 'oddsTest', id: 'nope' });
    expect(admin.info().odds).toBeNull();
    expect(JSON.stringify(app.save)).toBe(before);
    expect(storage.getItem('tinhats.save')).toBeNull();
  });
});
