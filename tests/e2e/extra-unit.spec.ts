/**
 * The extra unit slot in the built game (docs/PLATFORM.md, "The extra unit"). The website has no extra unit: nothing
 * of one shows, and nothing is drawn for one. With a made-up unit standing in for a platform's
 * (tests/e2e/fake-extra-unit.ts) it is one more button in the train bar of a Stalingrad mission and of the proving
 * ground but not of Basic Training, its pictures are made only when a battle may field it, it can be trained once per
 * battle, it charges with a shout over its head, and the save never hears of it.
 */
import type { DebugApi } from '../../src/app/debug';
import { FAKE_EXTRA, installFakeExtraUnit } from './fake-extra-unit';
import { BATTLE_LOAD_MS, SAVE_KEY, expect, grantSupplies, open, setTimeScale, tap, test, units, type Hooked } from './helpers';

test.use({ viewport: { width: 844, height: 390 } });

test('the website has no extra unit: no button, no pictures', async ({ page, problems }) => {
  await open(page);
  expect(await page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).extraUnit())).toEqual({ installed: false, owned: false, pictures: false, bubbles: 0 });
  await page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).startStalingrad(1004, 'normal', 1));
  await expect(page.getByTestId('order-advance')).toBeVisible({ timeout: BATTLE_LOAD_MS });
  await expect(page.getByTestId('train-extra')).toHaveCount(0);
  expect((await page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).extraUnit())).pictures).toBe(false);
  expect(problems).toEqual([]);
});

test('a stand-in extra unit: trained once, charges with a shout, and never reaches the save', async ({ page, problems }) => {
  await installFakeExtraUnit(page);
  await open(page);
  // Installed and owned, but nothing of it is drawn before a battle may field it.
  expect(await page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).extraUnit())).toEqual({ installed: true, owned: true, pictures: false, bubbles: 0 });

  await page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).startStalingrad(1004, 'normal', 1));
  await expect(page.getByTestId('order-advance')).toBeVisible({ timeout: BATTLE_LOAD_MS });
  const button = page.getByTestId('train-extra');
  await expect(button).toHaveCount(1);
  await expect(button.locator('.th-tbtn-name')).toHaveText(FAKE_EXTRA.label);
  expect((await page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).extraUnit())).pictures).toBe(true);

  await grantSupplies(page, 2000);
  await button.scrollIntoViewIfNeeded();
  await tap(page, 'train-extra');
  await tap(page, 'train-extra');
  await setTimeScale(page, 4);
  await expect.poll(async () => (await units(page)).filter((u) => u.side === 0 && u.kind === 'extra').length, { timeout: 60_000 }).toBe(1);
  // One per battle: the second tap bought nothing and the button now reads as out of reach.
  await expect(button).toHaveClass(/is-short/);
  await tap(page, 'order-advance');
  // It rides out, meets the enemy and shouts as it charges.
  await expect.poll(async () => (await page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).extraUnit())).bubbles, { timeout: 120_000, intervals: [250] }).toBeGreaterThan(0);
  await setTimeScale(page, 1);
  expect((await units(page)).filter((u) => u.kind === 'extra' && u.side === 1)).toEqual([]);

  // Nothing about the unit is in the save: a build without it loads the same save as it is.
  const saved = await page.evaluate((key) => window.localStorage.getItem(key) ?? '', SAVE_KEY);
  expect(saved).not.toContain('extra');
  expect(saved).not.toContain(FAKE_EXTRA.name);
  expect(problems).toEqual([]);
});

test('the stand-in is fielded on the proving ground and not in Basic Training', async ({ page, problems }) => {
  await installFakeExtraUnit(page);
  await open(page);
  await page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).startSandbox(1));
  await expect(page.getByTestId('order-advance')).toBeVisible({ timeout: BATTLE_LOAD_MS });
  await expect(page.getByTestId('train-extra')).toHaveCount(1);
  await page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).startTraining());
  await expect(page.getByTestId('train-sapper')).toBeVisible({ timeout: BATTLE_LOAD_MS });
  await expect(page.getByTestId('train-extra')).toHaveCount(0);
  expect(problems).toEqual([]);
});
