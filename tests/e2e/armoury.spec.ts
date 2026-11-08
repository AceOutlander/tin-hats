/**
 * Medals and the Armoury in the production build, on a phone in landscape with real touches: the debug hooks that
 * give and take medals, buying a unit in the Armoury from the campaign map, the loan and replay lines on the briefing,
 * the bought unit's button in battle, and the medals and score breakdown on the victory screen.
 * Any console error, page error or failed request fails the test (helpers.ts).
 * Pictures go to docs/screenshots/e2e-armoury-*.png.
 */
import type { Page } from '@playwright/test';
import type { DebugApi } from '../../src/app/debug';
import { MEDALS } from '../../src/data/medals';
import { arrived, expect, lastResult, memorySave, open, playToEnd, savedGame, shot, state, tap, tapIn, test, type Hooked } from './helpers';

/** The medals in the stored save (the shared StoredSave type predates them). */
async function storedMedals(page: Page): Promise<number | undefined> {
  const saved = (await savedGame(page)) as unknown as { medals?: number } | null;
  return saved?.medals;
}

const LMG = MEDALS.armoury.find((a) => a.id === 'lmg');

test.describe('armoury', () => {
  test('gives and takes medals through the debug hooks, never below zero', async ({ page }) => {
    await open(page);
    expect(await page.evaluate(() => (window as unknown as Hooked).__TH?.medals())).toBe(0);
    expect(await page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).giveMedals(120))).toBe(120);
    expect(await page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).takeMedals(20))).toBe(100);
    expect(await page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).takeMedals(500))).toBe(0);
    expect((await savedGame(page))?.version).toBeGreaterThanOrEqual(6);
  });

  test('buys a unit with medals from the map, and the briefing and battle follow the Armoury', async ({ page }) => {
    test.setTimeout(600_000);
    if (!LMG) throw new Error('the Armoury sells no Bren gunner');
    await open(page);
    await page.evaluate((n) => ((window as unknown as Hooked).__TH as DebugApi).giveMedals(n), LMG.price + 5);

    // --- The map's Armoury button opens the Armoury ---------------------------------------------------------------
    await tap(page, 'play');
    await expect(arrived(page, 'campaign').getByTestId('armoury')).toBeVisible();
    await tapIn(page, 'campaign', 'armoury');
    await expect(arrived(page, 'armoury').getByTestId('medals-available')).toHaveText(String(LMG.price + 5));
    // Riflemen and sappers are issued free; every core role, new unit and plane call-in is listed.
    await expect(arrived(page, 'armoury').getByTestId('armoury-item-rifle')).toHaveAttribute('data-owned', 'true');
    await expect(arrived(page, 'armoury').getByTestId('armoury-item-sapper')).toHaveAttribute('data-owned', 'true');
    for (const item of MEDALS.armoury) await expect(arrived(page, 'armoury').getByTestId(`armoury-item-${item.id}`)).toBeAttached();
    await expect(arrived(page, 'armoury').getByTestId('armoury-buy-tank')).toBeDisabled();
    await page.waitForTimeout(400);
    await shot(page, 'armoury-before');

    await tapIn(page, 'armoury', 'armoury-buy-lmg');
    await expect(arrived(page, 'armoury').getByTestId('armoury-item-lmg')).toHaveAttribute('data-owned', 'true');
    await expect(arrived(page, 'armoury').getByTestId('medals-available')).toHaveText('5');
    expect((await memorySave(page)).armoury).toEqual(['lmg']);
    expect(await storedMedals(page)).toBe(5);
    await shot(page, 'armoury-after');

    // --- Mission 2's briefing lends nothing now the Bren gun is bought ----------------------------------------------
    await page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).unlockAll());
    await tapIn(page, 'armoury', 'back');
    await tap(page, 'mission-pin-2');
    await tap(page, 'mission-start');
    await expect(page.getByTestId('briefing-replay')).toHaveText('First win: full medals');
    await expect(page.getByTestId('briefing-loans')).toHaveCount(0);
    await tapIn(page, 'briefing', 'back');

    // Mission 3 lends its Assault Troopers (not bought).
    await tap(page, 'mission-pin-3');
    await tap(page, 'mission-start');
    await expect(page.getByTestId('briefing-loans')).toContainText('On loan for this mission');
    await shot(page, 'armoury-briefing-loan');
    await tap(page, 'begin');
    await expect.poll(async () => (await state(page)).screen, { timeout: 20_000 }).toBe('battle');
    await expect(page.getByTestId('train-lmg')).toBeVisible();
    await expect(page.getByTestId('train-assault')).toHaveCount(0);
    expect((await state(page)).units[0].assault).toBeGreaterThan(0);
  });

  test('a win shows its medals and score breakdown, and the replay is announced at half', async ({ page }) => {
    test.setTimeout(900_000);
    await open(page);
    await tap(page, 'play');
    await tap(page, 'mission-pin-1');
    await tap(page, 'mission-start');
    await expect(page.getByTestId('briefing-replay')).toHaveText('First win: full medals');
    await tap(page, 'begin');
    await expect.poll(async () => (await state(page)).screen, { timeout: 20_000 }).toBe('battle');
    const end = await playToEnd(page, true);
    expect(end.winner).toBe(0);
    await expect(arrived(page, 'result')).toBeVisible({ timeout: 20_000 });
    const result = await lastResult(page);
    expect(result?.medals?.replayPercent).toBe(100);
    expect(result?.pointsAwarded).toBeGreaterThanOrEqual(MEDALS.rough);
    await expect(page.getByTestId('result-points')).toContainText(`+${result?.pointsAwarded ?? 0}`);
    await expect(page.getByTestId('result-score')).toContainText('Casualties');
    await expect(page.getByTestId('result-score')).toContainText('Time');
    await page.waitForTimeout(900);
    await shot(page, 'armoury-victory');
    expect(await storedMedals(page)).toBe(result?.pointsAwarded);

    await tap(page, 'result-map');
    await tap(page, 'mission-pin-1');
    await tap(page, 'mission-start');
    await expect(page.getByTestId('briefing-replay')).toHaveText('Replay: 50% medals');
    await tap(page, 'difficulty-hard');
    await expect(page.getByTestId('briefing-replay')).toHaveText('First win: full medals');
  });
});
