/**
 * Medals and the Shop (the screen the Armoury was) in the production build, on a phone in landscape with real touches:
 * the debug hooks that give and take medals, buying a call-in charge in the Shop from the campaign map, the Battle for
 * Poland as a locked entry with its medal price, units locked until their mission, the briefing's loadout (the
 * call-ins brought, lent ones included), the charge count on the battle's call-in buttons, a mission's NEW UNIT card
 * and its own units in battle, the replay line, and the medals breakdown on the victory screen (owner, 2026-11-09:
 * every call-in is medal-bought charges).
 * Any console error, page error or failed request fails the test (helpers.ts).
 * Pictures: docs/screenshots/shop.png, loadout.png, hud-charges.png and e2e-armoury-victory.png.
 */
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import type { DebugApi } from '../../src/app/debug';
import { MEDALS } from '../../src/data/medals';
import { MISSIONS } from '../../src/data/missions';
import { BATTLE_LOAD_MS, SHOT_DIR, arrived, expect, lastResult, memorySave, open, playToEnd, savedGame, shot, state, tap, tapIn, test, type Hooked } from './helpers';

/** The medals in the stored save (the shared StoredSave type predates them). */
async function storedMedals(page: Page): Promise<number | undefined> {
  const saved = (await savedGame(page)) as unknown as { medals?: number } | null;
  return saved?.medals;
}

const SMOKE = MEDALS.charges.find((c) => c.kind === 'smoke');
const RECON = MEDALS.charges.find((c) => c.kind === 'recon');
/** Charges a mission lends of a call-in. */
const lent = (id: number, kind: string): number => MEDALS.chargeLoans[id]?.find((l) => l.kind === kind)?.count ?? 0;

test.describe('armoury', () => {
  test('gives and takes medals through the debug hooks, never below zero', async ({ page }) => {
    await open(page);
    expect(await page.evaluate(() => (window as unknown as Hooked).__TH?.medals())).toBe(0);
    expect(await page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).giveMedals(120))).toBe(120);
    expect(await page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).takeMedals(20))).toBe(100);
    expect(await page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).takeMedals(500))).toBe(0);
    expect((await savedGame(page))?.version).toBeGreaterThanOrEqual(11);
  });

  test('buys a call-in charge in the Shop, brings it on the briefing, and the battle shows the charges', async ({ page }) => {
    test.setTimeout(600_000);
    if (!SMOKE || !RECON) throw new Error('the Shop sells no smoke or recon');
    await open(page);
    const medals = SMOKE.price + RECON.price + 5;
    await page.evaluate((n) => ((window as unknown as Hooked).__TH as DebugApi).giveMedals(n), medals);

    // --- The map's Shop button opens the Shop ---------------------------------------------------------------------
    await tap(page, 'play');
    await expect(arrived(page, 'campaign').getByTestId('armoury')).toContainText('Shop');
    await tapIn(page, 'campaign', 'armoury');
    const shop = arrived(page, 'armoury');
    await expect(shop.getByTestId('medals-available')).toHaveText(String(medals));
    // Every call-in is sold as charges; a new save holds the starter smoke and artillery.
    for (const c of MEDALS.charges) await expect(shop.getByTestId(`armoury-item-${c.kind}`)).toBeAttached();
    await expect(shop.getByTestId('armoury-count-smoke')).toHaveText(` ×${SMOKE.starter}`);
    await expect(shop.getByTestId('armoury-buy-bomber')).toBeDisabled();
    // The Battle for Poland: a locked entry with its medal price, and no way to buy it here.
    await expect(shop.getByTestId('armoury-buy-poland')).toBeDisabled();
    await expect(shop.getByTestId('armoury-buy-poland')).toContainText(String(MEDALS.polandPrice));
    // Units are unlocked by missions: riflemen issued free, the assault troops locked until mission 3.
    await expect(shop.getByTestId('armoury-item-rifle')).toHaveAttribute('data-owned', 'true');
    await expect(shop.getByTestId('armoury-buy-assault')).toBeDisabled();
    await expect(shop.getByTestId('armoury-buy-assault')).toContainText('Mission 3');

    await tapIn(page, 'armoury', 'armoury-buy-smoke');
    await expect(shop.getByTestId('armoury-count-smoke')).toHaveText(` ×${SMOKE.starter + 1}`);
    await tapIn(page, 'armoury', 'armoury-buy-recon');
    await expect(shop.getByTestId('armoury-count-recon')).toHaveText(' ×1');
    await expect(shop.getByTestId('medals-available')).toHaveText('5');
    expect((await memorySave(page)).charges).toEqual({ smoke: SMOKE.starter + 1, artillery: 3, recon: 1 });
    // A call-in bought for the first time joins the loadout.
    expect((await memorySave(page)).loadout).toEqual(['smoke', 'artillery', 'recon']);
    expect(await storedMedals(page)).toBe(5);
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(SHOT_DIR, 'shop.png') });

    // --- Mission 3 (Volokolamsk): its PPD Troopers with a NEW UNIT card, its lent call-ins, the loadout ---------------
    await page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).unlockAll());
    await tapIn(page, 'armoury', 'back');
    await tapIn(page, 'campaign', 'mission-pin-1003');
    await tapIn(page, 'campaign', 'mission-start');
    await expect(page.getByTestId('briefing-replay')).toHaveText('First win: full medals');
    await expect(page.getByTestId('briefing-loans')).toHaveCount(0);
    await expect(arrived(page, 'briefing').locator('.th-new-name').first()).toHaveText('PPD Trooper');
    const brief = arrived(page, 'briefing');
    await expect(brief.getByTestId('loadout-smoke')).toHaveAttribute('aria-pressed', 'true');
    await expect(brief.getByTestId('loadout-artillery')).toHaveAttribute('aria-pressed', 'true');
    await expect(brief.getByTestId('loadout-katyusha')).toContainText('lent');
    await expect(brief.getByTestId('loadout-recon')).toHaveAttribute('aria-pressed', 'true');
    // Leave the recon plane behind; a lent call-in always comes.
    await tapIn(page, 'briefing', 'loadout-recon');
    await expect(brief.getByTestId('loadout-recon')).toHaveAttribute('aria-pressed', 'false');
    expect((await memorySave(page)).loadout).toEqual(['smoke', 'artillery']);
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(SHOT_DIR, 'loadout.png') });
    await tap(page, 'begin');
    await expect.poll(async () => (await state(page)).screen, { timeout: BATTLE_LOAD_MS }).toBe('battle');
    await expect(page.getByTestId('train-assault')).toBeVisible();
    await expect(page.getByTestId('support-smoke')).toBeAttached();
    await expect(page.getByTestId('support-recon')).toHaveCount(0);
    const battle = await state(page);
    expect(battle.supports.smoke.charges).toBe(SMOKE.starter + 1 + lent(1003, 'smoke'));
    // The call-ins column shows each button's charges.
    await tap(page, 'callins');
    await expect(page.getByTestId('support-count-smoke')).toHaveText(`×${SMOKE.starter + 1 + lent(1003, 'smoke')}`);
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(SHOT_DIR, 'hud-charges.png') });
  });

  test('a win shows its medals and score breakdown, and the replay is announced at half', async ({ page }) => {
    test.setTimeout(900_000);
    await open(page);
    await tap(page, 'play');
    await tap(page, `mission-pin-${MISSIONS[0].id}`);
    await tap(page, 'mission-start');
    await expect(page.getByTestId('briefing-replay')).toHaveText('First win: full medals');
    await tap(page, 'begin');
    await expect.poll(async () => (await state(page)).screen, { timeout: BATTLE_LOAD_MS }).toBe('battle');
    const end = await playToEnd(page, true);
    expect(end.winner).toBe(0);
    await expect(arrived(page, 'result')).toBeVisible({ timeout: 20_000 });
    const result = await lastResult(page);
    expect(result?.medals?.replayPercent).toBe(100);
    expect(result?.pointsAwarded).toBeGreaterThanOrEqual(MEDALS.rough);
    await expect(page.getByTestId('result-points')).toContainText(`+${result?.pointsAwarded ?? 0}`);
    await expect(page.getByTestId('result-score')).toContainText('Casualties');
    // The first win on Normal pays upgrade points too.
    await expect(page.getByTestId('result-upgrade-points')).toContainText(`+${MEDALS.points.byDifficulty.normal}`);
    // An assault scores on time, a survival (Brest) on HQ health.
    await expect(page.getByTestId('result-score')).toContainText(MISSIONS[0].mode === 'assault' ? 'Time' : 'HQ health');
    await page.waitForTimeout(900);
    await shot(page, 'armoury-victory');
    expect(await storedMedals(page)).toBe(result?.pointsAwarded);

    await tap(page, 'result-map');
    await tapIn(page, 'campaign', `mission-pin-${MISSIONS[0].id}`);
    await tapIn(page, 'campaign', 'mission-start');
    await expect(page.getByTestId('briefing-replay')).toHaveText('Replay: 50% medals');
    await tap(page, 'difficulty-hard');
    await expect(page.getByTestId('briefing-replay')).toHaveText('First win: full medals');
  });
});
