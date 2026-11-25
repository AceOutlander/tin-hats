/**
 * Cosmetic supply crates in the production build, on a phone in landscape with real touches (docs/QUEUE.md, "cosmetic
 * supply crates"). The whole feature is hidden behind one switch in data, which is off: the first test holds the live
 * game to showing nothing of it. The others switch it on for their own session through the debug hooks
 * (window.__TH.cosmetics.enable), as the admin panel can.
 *
 * Any console error, page error or failed request fails the test (helpers.ts).
 * Pictures: docs/screenshots/crates-shop.png, crates-confirm.png, crates-opening.png, crates-reveal.png,
 * crates-appearance.png, crates-battle.png and crates-admin.png (each with the prefix e2e-).
 */
import type { Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import type { DebugApi } from '../../src/app/debug';
import { ADMIN } from '../../src/data/admin';
import { COSMETICS } from '../../src/data/cosmetics';
import { CRATES } from '../../src/data/crates';
import { arrived, expect, type Hooked, memorySave, open, savedGame, shot, startSandbox, tap, tapIn, test, toMap, waitForState } from './helpers';

const TH = (page: Page): Promise<void> => page.waitForFunction(() => (window as unknown as Hooked).__TH?.ready === true).then(() => undefined);
const enable = (page: Page): Promise<void> => page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).cosmetics.enable(true));
const giveMedals = (page: Page, n: number): Promise<number> => page.evaluate((k) => ((window as unknown as Hooked).__TH as DebugApi).giveMedals(k), n);

async function toShop(page: Page): Promise<void> {
  await toMap(page);
  await tapIn(page, 'campaign', 'armoury');
  await expect(arrived(page, 'armoury')).toBeVisible();
}

test.describe('supply crates', () => {
  test('switched off, as the live game is: no crate section, no Appearance tab, no word of either', async ({ page }) => {
    await open(page);
    await TH(page);
    expect(COSMETICS.enabled).toBe(false);
    expect(await page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).cosmetics.enabled())).toBe(false);
    await giveMedals(page, 9000);
    await toShop(page);
    const shop = arrived(page, 'armoury');
    await expect(shop.locator('[data-testid="crate-section"], [data-testid^="crate-"], [data-testid^="shop-tab-"], .th-tabs, .th-crates')).toHaveCount(0);
    for (const word of ['crate', 'Crate', 'Appearance', 'Legendary', 'Mythic', 'Placeholder']) await expect(shop).not.toContainText(word);
    expect(await shop.evaluate((el) => el.hasAttribute('data-tab'))).toBe(false);
    // The headings are the ones the Shop has always had.
    await expect(shop.locator('.th-qm-group h2')).toHaveText(['Call-in charges', 'Core roles', 'New units']);
    // Nothing of it was fetched or made either.
    const requests = await page.evaluate(() => performance.getEntriesByType('resource').map((r) => r.name));
    expect(requests.filter((r) => /placeholder-|cosmetics/.test(r))).toEqual([]);
    expect((await savedGame(page)) && 'cosmetics' in ((await memorySave(page)) as object)).toBe(false);
  });

  test('switched on: the Shop shows every crate with its exact chances and counters, a purchase is confirmed first, and the opening can be skipped', async ({ page }) => {
    test.setTimeout(300_000);
    await open(page);
    await TH(page);
    await enable(page);
    await giveMedals(page, 2000);
    await toShop(page);
    const shop = arrived(page, 'armoury');
    await expect(shop.getByTestId('crate-section')).toBeVisible();
    await expect(shop.locator('.th-qm-group h2')).toHaveText(['Call-in charges', 'Supply crates', 'Core roles', 'New units']);

    // --- every crate, its price and its whole table -----------------------------------------------------------------
    for (const def of CRATES.defs) await expect(shop.getByTestId(`crate-card-${def.id}`)).toBeAttached();
    await expect(shop.getByTestId('crate-odds-standard').locator('li')).toHaveText(['Common45.9%', 'Uncommon30%', 'Rare18%', 'Epic5%', 'Legendary1%', 'Mythic0.1%']);
    await expect(shop.getByTestId('crate-odds-premium').locator('li')).toHaveText(['Common30%', 'Uncommon25%', 'Rare20%', 'Epic15%', 'Legendary8%', 'Mythic2%']);
    await expect(shop.getByTestId('crate-odds-elite').locator('li')).toHaveText(['Epic35%', 'Legendary45%', 'Mythic20%']);
    await expect(shop.getByTestId('crate-odds-titan').locator('li')).toHaveText(['Legendary60%', 'Mythic40%']);
    await expect(shop.getByTestId('crate-odds-god').locator('li')).toHaveText(['Common0.01%', '???99.99%']);
    await expect(shop.getByTestId('crate-buy-standard')).toContainText('350');
    await expect(shop.getByTestId('crate-buy-premium')).toContainText('1,000');
    await expect(shop.getByTestId('crate-buy-elite')).toContainText('3,000');
    await expect(shop.getByTestId('crate-buy-titan')).toContainText('5,000');
    // The guarantees, with how far away each is, before anything is bought.
    await expect(shop.getByTestId('crate-guarantee-standard-0')).toHaveText('Rare or better at least every 5 crates. Rare or better within the next 5.');
    await expect(shop.getByTestId('crate-guarantee-standard-1')).toHaveText('Legendary or better at least every 30 crates. Legendary or better within the next 30.');
    await expect(shop.getByTestId('crate-guarantee-premium-0')).toContainText('Epic or better at least every 5 crates');
    await expect(shop.getByTestId('crate-guarantee-elite-0')).toHaveText(CRATES.text.noGuarantee);
    // The God Crate is on show only.
    await expect(shop.getByTestId('crate-buy-god')).toBeDisabled();
    await expect(shop.getByTestId('crate-buy-god')).toContainText('Coming soon');
    await expect(shop.getByTestId('crate-buy-god')).toContainText('199,999');
    // 2,000 medals: the Standard and the Premium can be bought, the others not.
    await expect(shop.getByTestId('crate-buy-standard')).toBeEnabled();
    await expect(shop.getByTestId('crate-buy-premium')).toBeEnabled();
    await expect(shop.getByTestId('crate-buy-elite')).toBeDisabled();
    await shop.getByTestId('crate-section').scrollIntoViewIfNeeded();
    await shot(page, 'crates-shop');
    // No timer, countdown or "limited" pressure anywhere in the section.
    for (const word of [/\d+:\d\d/, /limited/i, /hurry/i, /only .* left/i, /offer ends/i]) await expect(shop.getByTestId('crate-section')).not.toContainText(word);

    // --- a purchase is confirmed, with the price and the chances; "Not now" spends nothing --------------------------
    await tapIn(page, 'armoury', 'crate-buy-standard');
    await expect(page.getByTestId('confirm-body')).toHaveText('Standard Crate: 350 medals. You have 2,000.');
    await expect(page.getByTestId('confirm-details')).toContainText('Chances: Common 45.9%, Uncommon 30%, Rare 18%, Epic 5%, Legendary 1%, Mythic 0.1%.');
    await expect(page.getByTestId('confirm-details')).toContainText('Legendary or better within the next 30.');
    await expect(page.getByTestId('confirm-yes')).toHaveText('Buy for 350');
    await page.waitForTimeout(350);
    await shot(page, 'crates-confirm');
    await tap(page, 'confirm-no');
    await expect(shop.getByTestId('medals-available')).toHaveText('2000');
    expect((await memorySave(page)).cosmetics).toBeUndefined();

    // --- bought: saved before the opening shows anything; the opening plays and ends on the item by name -------------
    await tapIn(page, 'armoury', 'crate-buy-standard');
    await tap(page, 'confirm-yes');
    const opening = page.getByTestId('crate-opening');
    await expect(opening).toHaveAttribute('data-phase', 'opening');
    const during = (await savedGame(page)) as unknown as { medals: number; cosmetics?: { opened: Record<string, number>; owned: string[] } };
    expect(during.cosmetics?.opened.standard).toBe(1);
    const got = await page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).cosmetics.lastCrate());
    expect(got?.crate).toBe('standard');
    expect(during.medals).toBe(2000 - 350 + (got?.medals ?? 0));
    if (got?.item) expect(during.cosmetics?.owned).toEqual([got.item]);
    await expect(page.getByTestId('crate-skip')).toHaveText('Tap to skip');
    await page.waitForTimeout(900);
    await shot(page, 'crates-opening');
    // Left alone, it reaches the result by itself.
    await expect(opening).toHaveAttribute('data-phase', 'revealed', { timeout: 15_000 });
    const rarity = CRATES.defs[0].odds.map((o) => o.rarity).find((r) => r === got?.rarity);
    await expect(page.getByTestId('crate-rarity')).toHaveAttribute('data-rarity', String(rarity));
    // The rarity is written out, not only coloured.
    await expect(page.getByTestId('crate-rarity')).toHaveText(/^(Common|Uncommon|Rare|Epic|Legendary|Mythic)$/);
    if (got?.item) await expect(page.getByTestId('crate-item')).not.toHaveText(/placeholder/i);
    else await expect(page.getByTestId('crate-duplicate')).toContainText('medals instead');
    await page.waitForTimeout(600);
    await shot(page, 'crates-reveal');
    await tap(page, 'crate-done');
    await expect(opening).toHaveCount(0);
    // The counters moved on, and the medals are what the save said.
    await expect(shop.getByTestId('medals-available')).toHaveText(String(during.medals));
    await expect(shop.getByTestId('crate-guarantee-standard-1')).toContainText('within the next 29.');

    // --- a second one, skipped with a tap: the same result as was saved, at once -------------------------------------
    await tapIn(page, 'armoury', 'crate-buy-standard');
    await tap(page, 'confirm-yes');
    await expect(opening).toHaveAttribute('data-phase', 'opening');
    const second = await page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).cosmetics.lastCrate());
    await page.touchscreen.tap(120, 120);
    await expect(opening).toHaveAttribute('data-phase', 'revealed');
    await expect(page.getByTestId('crate-rarity')).toHaveAttribute('data-rarity', String(second?.rarity));
    // The tap that skipped did not also press Done.
    await expect(opening).toBeVisible();
    await tap(page, 'crate-done');
    await expect(opening).toHaveCount(0);
    const after = await memorySave(page);
    expect(after.cosmetics?.opened.standard).toBe(2);
  });

  test('a free crate is opened without medals or a confirmation; where crates are not sold only the free ones show', async ({ page }) => {
    test.setTimeout(240_000);
    await open(page);
    await TH(page);
    await enable(page);
    await giveMedals(page, 9000);
    await page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).cosmetics.giveCrates('standard', 2));
    await toShop(page);
    const shop = arrived(page, 'armoury');
    await expect(shop.getByTestId('crate-held-standard')).toHaveText(' ×2');
    await tapIn(page, 'armoury', 'crate-open-standard');
    // Straight to the opening: nothing was spent, so nothing is asked.
    await expect(page.getByTestId('confirm-yes')).toHaveCount(0);
    await expect(page.getByTestId('crate-opening')).toBeVisible();
    await page.touchscreen.tap(120, 120);
    await tap(page, 'crate-done');
    await expect(shop.getByTestId('crate-held-standard')).toHaveText(' ×1');
    const opened = await page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).cosmetics.lastCrate());
    expect((await memorySave(page)).medals).toBe(9000 + (opened?.medals ?? 0));

    // A platform that says crates are not sold here: no price, no Buy, no other crate; the free one stays.
    await page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).cosmetics.setCrateBuying(false));
    await expect(shop.locator('[data-testid^="crate-card-"]')).toHaveCount(1);
    await expect(shop.getByTestId('crate-card-standard')).toBeVisible();
    await expect(shop.locator('[data-testid^="crate-buy-"]')).toHaveCount(0);
    await expect(shop.getByTestId('crate-section')).not.toContainText('350');
    await expect(shop.getByTestId('crate-section')).not.toContainText('Buy');
    await expect(shop.getByTestId('crate-open-standard')).toBeEnabled();
    await page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).cosmetics.setCrateBuying(null));
    await expect(shop.locator('[data-testid^="crate-card-"]')).toHaveCount(CRATES.defs.length);
  });

  test('Appearance: what is owned can be worn and taken off, and a battle draws it without changing the battle', async ({ page }) => {
    test.setTimeout(300_000);
    await open(page);
    await TH(page);
    await enable(page);
    await page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).cosmetics.giveItems());
    await toShop(page);
    const shop = arrived(page, 'armoury');
    await expect(shop.getByTestId('shop-tab-shop')).toHaveText('Shop');
    await expect(shop.getByTestId('shop-tab-appearance')).toHaveText('Appearance');
    await tapIn(page, 'armoury', 'shop-tab-appearance');
    await expect(shop).toHaveAttribute('data-tab', 'appearance');
    await expect(shop.locator('.th-qm-group h2')).toHaveText(['Your forces', 'How the enemy looks to you', 'Your headquarters']);
    await expect(shop.locator('[data-testid^="cosmetic-wear-"]')).toHaveCount(COSMETICS.items.length);
    // Every item says its rarity in words.
    await expect(shop.getByTestId('cosmetic-placeholder-rare-1').locator('.th-rarity-name')).toHaveText('Rare');
    await expect(shop.getByTestId('cosmetic-placeholder-special-1').locator('.th-rarity-name')).toHaveText('Special');
    for (const id of ['placeholder-legendary-1', 'placeholder-rare-1', 'placeholder-uncommon-2', 'placeholder-rare-2', 'placeholder-mythic-1']) {
      await tapIn(page, 'armoury', `cosmetic-wear-${id}`);
      await expect(shop.getByTestId(`cosmetic-${id}`)).toHaveAttribute('data-worn', 'true');
      await expect(shop.getByTestId(`cosmetic-wear-${id}`)).toHaveText('Take off');
    }
    // One item per unit: the cap took the riflemen from the army-wide item, which is still worn elsewhere.
    await expect(shop.getByTestId('cosmetic-placeholder-legendary-1')).toHaveAttribute('data-worn', 'true');
    await tapIn(page, 'armoury', 'cosmetic-wear-placeholder-uncommon-2');
    await expect(shop.getByTestId('cosmetic-placeholder-uncommon-2')).toHaveAttribute('data-worn', 'false');
    await tapIn(page, 'armoury', 'cosmetic-wear-placeholder-uncommon-2');
    const worn = (await memorySave(page)).cosmetics?.worn ?? {};
    expect(Object.values(worn)).toContain('placeholder-rare-1');
    expect(Object.values(worn)).toContain('placeholder-uncommon-2');
    // The portraits were painted (the cap's picture has loaded by now).
    await expect
      .poll(() => page.evaluate(() => performance.getEntriesByType('resource').some((r) => /placeholder-cap/.test(r.name)) || document.querySelectorAll('.th-cos-icon').length > 0))
      .toBe(true);
    await shot(page, 'crates-appearance');

    // --- in a battle: units and the HQ are drawn with what is worn, from textures made on first use ------------------
    expect((await page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).cosmetics.stats())).sprites).toBe(0);
    await startSandbox(page, 7);
    await waitForState(page, 'units on the field', (s) => Object.values(s.units[0]).reduce((a, b) => a + b, 0) >= 3);
    await expect
      .poll(async () => (await page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).cosmetics.stats())).units, { timeout: 30_000 })
      .toBeGreaterThan(0);
    const stats = await page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).cosmetics.stats());
    expect(stats.hqs).toBe(1);
    await expect
      .poll(async () => (await page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).cosmetics.stats())).sprites, { timeout: 30_000 })
      .toBeGreaterThan(10);
    await expect
      .poll(async () => (await page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).cosmetics.stats())).images, { timeout: 30_000 })
      .toBeGreaterThanOrEqual(1);
    await page.waitForTimeout(1500);
    await shot(page, 'crates-battle');
  });

  test('the admin panel shows crates for the session, grants them and tests the odds with a large run', async ({ page }) => {
    test.setTimeout(240_000);
    await open(page);
    await TH(page);
    // The real code is never used: the lock is handed the hash of a code of the test's own (as admin-panel.spec.ts does).
    const code = 'e2e crates code';
    await page.evaluate((hash) => ((window as unknown as Hooked).__TH as DebugApi).admin?.useHash(hash), createHash('sha256').update(ADMIN.passcode.salt + code).digest('hex'));
    const prompt = page.getByTestId('admin-prompt');
    for (let attempt = 0; attempt < 4 && (await prompt.count()) === 0; attempt++) {
      if (attempt > 0) await page.waitForTimeout(ADMIN.tapGapMs + 300);
      for (let i = 0; i < ADMIN.taps; i++) {
        await page.getByTestId('title-helmet').tap();
        await page.waitForTimeout(120);
      }
    }
    await page.getByTestId('admin-code').fill(code);
    await tap(page, 'admin-code-ok');
    await expect(page.getByTestId('admin-panel')).toBeVisible();
    await tap(page, 'admin-tab-crates');

    // Hidden until switched on, for this session only.
    await expect(page.getByTestId('admin-cosmetics-switch')).toHaveAttribute('aria-pressed', 'false');
    await tap(page, 'admin-cosmetics-switch');
    await expect(page.getByTestId('admin-cosmetics-switch')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).cosmetics.enabled())).toBe(true);

    // Grant crates: two Standard and one Titan, held and saved; the God Crate cannot be granted.
    await tap(page, 'admin-crate-standard-1');
    await tap(page, 'admin-crate-standard-1');
    await tap(page, 'admin-crate-titan-1');
    await expect(page.getByTestId('admin-crate-standard-value')).toHaveText('2');
    await expect(page.locator('[data-testid^="admin-crate-god"]')).toHaveCount(0);
    expect((await memorySave(page)).cosmetics?.crates).toEqual({ standard: 2, titan: 1 });
    await tap(page, 'admin-items-all');
    await expect(page.getByTestId('admin-items-value')).toHaveText(`${COSMETICS.items.length}/${COSMETICS.items.length}`);

    // Test the odds: a large run, every rarity's count, share and table chance, and what the guarantees raised.
    await tap(page, 'admin-odds-standard');
    const table = page.getByTestId('admin-odds-table');
    await expect(table.locator('th')).toHaveText(['Standard Crate', 'Count', 'Share', 'Table', 'By guarantee']);
    await expect(table.locator('tr')).toHaveCount(7);
    const rows = await table.locator('tr').evaluateAll((trs) => trs.slice(1).map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent ?? '')));
    expect(rows.map((r) => r[0])).toEqual(['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic']);
    expect(rows.map((r) => r[3])).toEqual(['45.9%', '30%', '18%', '5%', '1%', '0.1%']);
    expect(rows.reduce((n, r) => n + Number(r[1].replace(/,/g, '')), 0)).toBe(CRATES.oddsTestRuns);
    // The Rare guarantee shows in the run: more than the table's 18%.
    expect(parseFloat(rows[2][2])).toBeGreaterThan(18);
    expect(Number(rows[2][4].replace(/,/g, ''))).toBeGreaterThan(0);
    await table.scrollIntoViewIfNeeded();
    await shot(page, 'crates-admin');
    // The run owned and changed nothing.
    expect((await memorySave(page)).cosmetics?.crates).toEqual({ standard: 2, titan: 1 });

    // And the granted crates are there to open in the Shop.
    await tap(page, 'admin-close');
    await toShop(page);
    await expect(arrived(page, 'armoury').getByTestId('crate-held-standard')).toHaveText(' ×2');
    await expect(arrived(page, 'armoury').getByTestId('crate-open-titan')).toBeVisible();
  });
});
