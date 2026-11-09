/**
 * The prep phase in the built game, on a phone in landscape with real touches: Brest Fortress (1001) opens with the
 * countdown, Ready and the build buttons; the player picks a foxhole, taps the ground to move its ghost, places it,
 * a sapper builds it into a trench, and Ready starts the attack (the panel goes and the mission clock runs).
 * Any console error, page error or failed request fails the test (helpers.ts).
 * Pictures: docs/screenshots/e2e-prep-*.png.
 */
import type { DebugApi } from '../../src/app/debug';
import { expect, lookAt, open, setTimeScale, shot, state, tap, tapWorld, test, waitForState, type Hooked } from './helpers';

test.describe('prep phase', () => {
  test('place a foxhole by touch, see it built, then Ready', async ({ page }) => {
    test.setTimeout(300_000);
    await open(page);
    await page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).startStalingrad(1001, 'normal', 1));
    await waitForState(page, 'the battle', (s) => s.inBattle && s.screen === 'battle');
    const panel = page.getByTestId('prep-panel');
    await expect(panel).toBeVisible();
    await expect(page.getByTestId('prep-time')).toHaveText(/^[01]:\d\d$/);
    const start = await state(page);
    expect(start.prep?.active).toBe(true);
    const trenches = start.prep?.trenches ?? 0;
    // The mission clock waits for the prep phase.
    expect(start.timer).toBe(720);
    await page.waitForTimeout(500);
    await shot(page, 'prep-panel');

    await tap(page, 'build-foxhole');
    await expect(page.getByTestId('build-confirm')).toBeVisible();
    await lookAt(page, 2700);
    await tapWorld(page, 2700, 0.62);
    await expect(page.getByTestId('build-confirm')).toBeEnabled();
    await page.waitForTimeout(300);
    await shot(page, 'prep-ghost');
    await tap(page, 'build-confirm');
    await expect.poll(async () => (await state(page)).prep?.sites ?? 0).toBe(1);
    await expect(page.getByTestId('build-undo')).toBeVisible();
    await setTimeScale(page, 3);
    await page.waitForTimeout(4000);
    await shot(page, 'prep-site');
    await expect.poll(async () => (await state(page)).prep?.trenches ?? 0, { timeout: 120_000 }).toBe(trenches + 1);
    await setTimeScale(page, 1);
    await page.waitForTimeout(500);
    await shot(page, 'prep-built');

    const now = await state(page);
    if (now.prep?.active === true) {
      await tap(page, 'prep-ready');
      await expect.poll(async () => (await state(page)).prep?.active).toBe(false);
    }
    await expect(panel).toBeHidden();
    await expect.poll(async () => (await state(page)).timer ?? 720, { timeout: 20_000 }).toBeLessThan(720);
  });
});
