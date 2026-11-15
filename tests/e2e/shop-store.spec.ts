/**
 * The Shop's store section (src/ui/screens/storeSection.ts) in the production build, on a phone in landscape. The
 * website's platform has no store, so its Shop has no such section at all; with a stand-in store (tests/e2e/fake-store.ts)
 * the section sits under the call-in charges and shows the platform's words: its title, a line above the offers, each
 * offer's title, description and price label, and its small print. Each way a request can end is shown: busy, then
 * done (the medals arrive through the game and are saved), cancelled (nothing said), pending (settled later by the
 * platform), failed, and owned.
 * Picture: docs/screenshots/shop-store.png.
 */
import { join } from 'node:path';
import { arrived, expect, type Hooked, memorySave, open, savedGame, SHOT_DIR, tapIn, test, toMap } from './helpers';
import { FAKE_STORE, installFakeStore } from './fake-store';

test.describe('the store section of the Shop', () => {
  test('is not there on the website: no section, no heading, no notice', async ({ page }) => {
    await open(page);
    await toMap(page);
    await tapIn(page, 'campaign', 'armoury');
    const shop = arrived(page, 'armoury');
    await expect(shop.getByTestId('armoury-item-smoke')).toBeVisible();
    await expect(page.locator('[data-testid="store-section"]')).toHaveCount(0);
    await expect(page.locator('.th-store, .th-store-offer, .th-store-note')).toHaveCount(0);
    const headings = await page.evaluate(() => [...document.querySelectorAll('.th-screen[data-screen="armoury"] .th-qm-group h2')].map((h) => h.textContent ?? ''));
    expect(headings).toEqual(['Call-in charges', 'Extras', 'Core roles', 'New units']);
  });

  test('shows what the platform offers, and every way a request can end', async ({ page }) => {
    await open(page);
    await installFakeStore(page);
    await toMap(page);
    await tapIn(page, 'campaign', 'armoury');
    const shop = arrived(page, 'armoury');
    const section = shop.getByTestId('store-section');
    await expect(section).toBeVisible();
    await expect(section.locator('h2')).toContainText(FAKE_STORE.title);
    await expect(section.getByTestId('store-message')).toHaveText(FAKE_STORE.message);
    for (const note of FAKE_STORE.notes) await expect(section).toContainText(note);
    // Under the call-in charges, above the extras.
    const order = await page.evaluate(() => [...document.querySelectorAll('.th-screen[data-screen="armoury"] .th-qm-group')].map((g) => g.querySelector('h2')?.textContent ?? ''));
    expect(order[0]).toContain('Call-in charges');
    expect(order[1]).toContain(FAKE_STORE.title);
    await expect(section.getByTestId('store-buy-one')).toHaveText('LABEL 0.99');
    await expect(section.getByTestId('store-offer-two')).toContainText('Offer two with a rather long name');
    await expect(section.getByTestId('store-buy-two')).toHaveText('A LONG LABEL 1,234.99');
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(SHOT_DIR, 'shop-store.png') });

    // Done: busy while the platform works (every offer waits), then its line, and the medals are in the save.
    await expect(shop.getByTestId('medals-available')).toHaveText('0');
    await tapIn(page, 'armoury', 'store-buy-one');
    await expect(section.getByTestId('store-offer-one')).toHaveAttribute('data-state', 'busy');
    await expect(section.getByTestId('store-buy-one')).toBeDisabled();
    await expect(section.getByTestId('store-buy-four')).toBeDisabled();
    await expect(section.getByTestId('store-offer-one')).toHaveAttribute('data-state', 'done');
    await expect(section.getByTestId('store-status-one')).toHaveText(FAKE_STORE.done);
    await expect(shop.getByTestId('medals-available')).toHaveText('150');
    expect(((await savedGame(page)) as unknown as { medals?: number }).medals).toBe(150);
    expect((await memorySave(page)).grants).toEqual(['fake-1']);
    await expect(section.getByTestId('store-buy-one')).toBeEnabled();

    // Cancelled: nothing changes and nothing is said.
    await tapIn(page, 'armoury', 'store-buy-two');
    await expect(section.getByTestId('store-offer-two')).toHaveAttribute('data-state', 'idle');
    await expect(section.getByTestId('store-status-two')).toHaveCount(0);

    // Failed: the platform's line, nothing given.
    await tapIn(page, 'armoury', 'store-buy-four');
    await expect(section.getByTestId('store-offer-four')).toHaveAttribute('data-state', 'failed');
    await expect(section.getByTestId('store-status-four')).toHaveText(FAKE_STORE.failed);
    await expect(shop.getByTestId('medals-available')).toHaveText('150');

    // Pending: nothing given, it cannot be asked for again, and it settles by itself.
    await tapIn(page, 'armoury', 'store-buy-three');
    await expect(section.getByTestId('store-offer-three')).toHaveAttribute('data-state', 'pending');
    await expect(section.getByTestId('store-status-three')).toHaveText(FAKE_STORE.pending);
    await expect(section.getByTestId('store-buy-three')).toBeDisabled();
    await expect(shop.getByTestId('medals-available')).toHaveText('650', { timeout: 5000 });
    await expect(section.getByTestId('store-offer-three')).toHaveAttribute('data-state', 'idle');
    await expect(section.getByTestId('store-buy-three')).toBeEnabled();

    // Owned: had once, then its button says so and cannot be pressed.
    await tapIn(page, 'armoury', 'store-buy-five');
    await expect(section.getByTestId('store-offer-five')).toHaveAttribute('data-state', 'owned');
    await expect(section.getByTestId('store-buy-five')).toBeDisabled();
    await expect(section.getByTestId('store-buy-five')).toHaveText('Owned');

    // A grant asked for twice is given once, and the Shop's own wares still work beside the section.
    expect(await page.evaluate(() => (window as unknown as Hooked).__TH?.grantMedals(150, 'fake-1'))).toBe('already');
    await expect(shop.getByTestId('medals-available')).toHaveText('650');
    await tapIn(page, 'armoury', 'armoury-buy-smoke');
    await expect(shop.getByTestId('store-section')).toBeVisible();
    await expect(section.getByTestId('store-status-one')).toHaveText(FAKE_STORE.done);
  });
});
