/**
 * Minor blood in the built game: with "Show blood" on (the default) a soldier shot dead gets a small dark pool under
 * his body; with it switched off in Settings (saved, 48 px switch) a battle full of gunfire deaths shows none.
 *
 * Picture: docs/screenshots/blood.png, a close-up of a body and its pool (844x390 at 2x).
 */
import type { Page } from '@playwright/test';
import { join } from 'node:path';
import { RENDER } from '../../src/data/render';
import type { PerfHook } from '../../src/render/view';
import { arrived, expect, grantSupplies, lookAt, open, savedGame, setTimeScale, SHOT_DIR, startSandbox, state, tap, tapIn, test, type Hooked } from './helpers';

type Probed = Hooked & { __THPERF?: PerfHook };

const blood = (page: Page) => page.evaluate(() => (window as unknown as Hooked).__TH?.blood() ?? null);
const newest = (page: Page) => page.evaluate(() => (window as unknown as Probed).__THPERF?.newestBlood() ?? null);

/** The proving ground played by the autopilot at speed (both armies fight at once), until `deaths` soldiers have been shot dead. */
async function fightUntil(page: Page, deaths: number): Promise<void> {
  await page.evaluate(() => (window as unknown as Hooked).__TH?.autopilot(true));
  expect(await startSandbox(page, 5)).toBe(true);
  await expect.poll(async () => (await state(page)).inBattle, { timeout: 20_000 }).toBe(true);
  await grantSupplies(page, 3000);
  await setTimeScale(page, 6);
  await expect
    .poll(async () => (await blood(page))?.deaths ?? 0, { timeout: 150_000, intervals: [100], message: 'soldiers shot dead' })
    .toBeGreaterThanOrEqual(deaths);
  await setTimeScale(page, 1);
}

test.describe('blood', () => {
  test('with Show blood on (the default), a gunfire death leaves a small pool under the body', async ({ page }) => {
    await open(page);
    const before = await blood(page);
    expect(before).toMatchObject({ pools: 0, cap: RENDER.blood.maxPools, shown: true });
    await fightUntil(page, 1);
    await expect.poll(async () => (await blood(page))?.pools ?? 0, { timeout: 10_000 }).toBeGreaterThan(0);

    // Look at the pool that started last, close up, once it has spread.
    const first = await newest(page);
    expect(first).not.toBeNull();
    if (!first) return;
    await lookAt(page, first.x);
    await page.evaluate((y) => (window as unknown as Probed).__THPERF?.zoom(3, y - 14), first.y);
    await page.waitForTimeout(1800);
    await setTimeScale(page, 0);
    await page.waitForTimeout(300);
    const pools = await blood(page);
    expect(pools?.pools ?? 0).toBeGreaterThan(0);
    expect(pools?.pools ?? 0).toBeLessThanOrEqual(RENDER.blood.maxPools);
    expect(pools?.drawn ?? 0, 'a pool on screen').toBeGreaterThan(0);
    await page.screenshot({ path: join(SHOT_DIR, 'blood.png') });
    await page.evaluate(() => (window as unknown as Probed).__THPERF?.zoom(1));
    expect((await state(page)).inBattle).toBe(true);
  });

  test('with Show blood off, gunfire deaths leave no pool at all, and the choice is saved', async ({ page }) => {
    await open(page);
    await tap(page, 'settings');
    const settings = arrived(page, 'settings');
    const toggle = settings.getByTestId('setting-blood');
    await expect(toggle).toHaveAttribute('data-state', 'on');
    const box = await toggle.boundingBox();
    expect(box?.height ?? 0, 'the switch is tall enough to touch').toBeGreaterThanOrEqual(47.5);
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(47.5);
    await tapIn(page, 'settings', 'setting-blood');
    await expect(toggle).toHaveAttribute('data-state', 'off');
    await expect.poll(async () => (await savedGame(page))?.settings.showBlood).toBe(false);
    expect((await blood(page))?.shown).toBe(false);

    await fightUntil(page, 3);
    // Let the last of them finish falling (a pool would have started by now).
    await page.waitForTimeout(1500);
    const seen = await blood(page);
    expect(seen?.deaths ?? 0).toBeGreaterThanOrEqual(3);
    expect(seen?.pools).toBe(0);
    expect(seen?.drawn).toBe(0);
    expect(await newest(page)).toBeNull();
  });
});
