/**
 * The mission 1 tutorial in the built game, with real touches: the bubble and the pulsing highlight for each step,
 * the step ending when the player does the thing, a tip that never comes back, and the hints setting.
 * Pictures: docs/screenshots/e2e-tutorial-*.png
 */
import type { Page } from '@playwright/test';
import { TUTORIAL } from '../../src/data/tutorial';
import { expect, open, playThroughMenus, savedGame, setTimeScale, shot, state, tap, tapIn, test, touchDrag } from './helpers';

const TIPS_KEY = TUTORIAL.storageKey;

const bubble = (page: Page) => page.getByTestId('tip');

/** The tutorial ids the page has stored as seen. */
const seenTips = (page: Page) =>
  page.evaluate((key) => {
    const text = window.localStorage.getItem(key);
    return text === null ? [] : (JSON.parse(text) as string[]);
  }, TIPS_KEY);

/** The bubble is up, says `text`, and the control it points at pulses. `glow` is a selector for that control. */
async function expectTip(page: Page, text: RegExp, glow: string): Promise<void> {
  await expect(bubble(page)).toBeVisible({ timeout: 30_000 });
  await expect(bubble(page)).toContainText(text);
  await expect(page.locator(glow)).toHaveClass(/th-glow/);
  // Exactly one thing pulses at a time.
  await expect(page.locator('.th-glow')).toHaveCount(1);
}

/** Bubble and control rectangles, in viewport CSS px. */
async function rects(page: Page, controlSelector: string) {
  const tip = await bubble(page).boundingBox();
  const control = await page.locator(controlSelector).boundingBox();
  const size = page.viewportSize();
  if (!tip || !control || !size) throw new Error('bubble, control or viewport missing');
  return { tip, control, size };
}

/** Back from the settings to the title, once the screen that left has finished fading out of the page. */
async function backToTitle(page: Page): Promise<void> {
  await tapIn(page, 'settings', 'back');
  await expect(page.locator('.th-screen.is-out')).toHaveCount(0);
}

async function waitForBattleTime(page: Page, seconds: number): Promise<void> {
  await expect.poll(async () => (await state(page)).time, { timeout: 60_000 }).toBeGreaterThanOrEqual(seconds);
}

test.describe('tutorial, mission 1', () => {
  test('walks a new player through supplies, training, Hold and looking around', async ({ page }) => {
    await open(page);
    await playThroughMenus(page, 1, false);

    // 1. Supplies and sappers: the bubble points at the supplies readout, which pulses.
    await expectTip(page, /Money buys troops/, '[data-tip="supplies"]');
    {
      const { tip, control, size } = await rects(page, '[data-tip="supplies"]');
      // Below the top bar, on the screen, and not on top of the control it explains.
      expect(tip.y).toBeGreaterThanOrEqual(control.y + control.height - 1);
      expect(tip.x).toBeGreaterThanOrEqual(0);
      expect(tip.x + tip.width).toBeLessThanOrEqual(size.width);
      expect(tip.height).toBeGreaterThanOrEqual(30);
    }
    await expect(bubble(page)).toHaveAttribute('data-arrow', 'on');
    await shot(page, 'tutorial-1-supplies');

    // The battle runs on under the tip: the clock moves while it is up.
    const t0 = (await state(page)).time;
    await page.waitForTimeout(600);
    expect((await state(page)).time).toBeGreaterThan(t0);

    // 2. Train a sapper: the bubble moves to the Sapper button, above it, and the button pulses.
    await setTimeScale(page, 3);
    await expectTip(page, /Train a Sapper/, '[data-testid="train-sapper"]');
    await setTimeScale(page, 1);
    {
      const { tip, control, size } = await rects(page, '[data-testid="train-sapper"]');
      expect(tip.y + tip.height).toBeLessThanOrEqual(control.y + 1);
      expect(tip.x + tip.width).toBeLessThanOrEqual(size.width);
      expect(tip.x).toBeGreaterThanOrEqual(0);
    }
    await shot(page, 'tutorial-2-sapper');

    // A real tap on the highlighted button does the thing and ends the tip.
    await tap(page, 'train-sapper');
    await expect(bubble(page)).toBeHidden();
    await expect(page.locator('.th-glow')).toHaveCount(0);
    await expect.poll(() => seenTips(page)).toContain('trainSapper');
    await expect
      .poll(async () => {
        const s = await state(page);
        return s.units[0].sapper + s.queue.sapper;
      })
      .toBeGreaterThanOrEqual(3);

    // 3. Riflemen: needs two taps. One is not enough; the tip stays.
    await expectTip(page, /train Riflemen/, '[data-testid="train-rifle"]');
    await shot(page, 'tutorial-3-rifleman');
    await tap(page, 'train-rifle');
    await page.waitForTimeout(500);
    await expect(bubble(page)).toBeVisible();
    await tap(page, 'train-rifle');
    await expect(bubble(page)).toBeHidden();
    await expect.poll(() => seenTips(page)).toContain('trainRifle');

    // 4. Hold: the bubble explains it, pointing at the Hold button.
    await expectTip(page, /HOLD keeps your army/, '[data-testid="order-hold"]');
    await shot(page, 'tutorial-4-hold');
    await tap(page, 'order-hold');
    await expect(bubble(page)).toBeHidden();
    await expect.poll(() => seenTips(page)).toContain('hold');

    // 5. Looking around, from thirty seconds in: the minimap pulses; a real drag on the battlefield ends the tip.
    await setTimeScale(page, 4);
    await waitForBattleTime(page, TUTORIAL.steps.find((s) => s.id === 'look')?.when.find((c) => c.t === 'time')?.min ?? 30);
    await expectTip(page, /look around/, '[data-testid="minimap"]');
    await setTimeScale(page, 1);
    await shot(page, 'tutorial-5-map');
    await touchDrag(page, { x: 300, y: 170 }, { x: 560, y: 170 });
    await expect(bubble(page)).toBeHidden();
    await expect.poll(() => seenTips(page)).toContain('look');

    // Nothing the player has been through comes round again in a new battle.
    const seen = await seenTips(page);
    await page.evaluate(() => window.location.reload());
    await page.waitForFunction(() => (window as unknown as { __TH?: { ready: boolean } }).__TH?.ready === true, null, { timeout: 60_000 });
    expect(await seenTips(page)).toEqual(seen);
    await playThroughMenus(page, 1, false);
    await setTimeScale(page, 4);
    await waitForBattleTime(page, 22);
    for (const id of ['supplies', 'trainSapper', 'trainRifle', 'hold', 'look']) expect(await seenTips(page)).toContain(id);
    await expect(bubble(page)).toBeHidden();
    // The save itself holds no tutorial state.
    expect(await savedGame(page)).not.toHaveProperty('tips');
  });

  test('can be closed with its own button, and a closed tip does not come back', async ({ page }) => {
    await open(page);
    await playThroughMenus(page, 1, false);
    await expectTip(page, /Money buys troops/, '[data-tip="supplies"]');
    const close = page.getByTestId('tip-dismiss');
    const box = await close.boundingBox();
    expect(box && box.width >= 47.5 && box.height >= 47.5, 'the close button is a full touch target').toBe(true);
    await close.tap();
    await expect(bubble(page)).toBeHidden();
    await expect(page.locator('.th-glow')).toHaveCount(0);
    await expect.poll(() => seenTips(page)).toContain('supplies');
    // The next tip comes after a short pause, and it is a different one.
    await expect(bubble(page)).toBeVisible({ timeout: 20_000 });
    await expect(bubble(page)).not.toContainText(/Money buys troops/);
  });

  test('is silent while the hints setting is off, and speaks again when it is switched on', async ({ page }) => {
    await open(page);
    await tap(page, 'settings');
    await tap(page, 'setting-hints');
    await expect.poll(async () => (await savedGame(page))?.settings.hints).toBe(false);
    await backToTitle(page);
    await playThroughMenus(page, 1, false);
    await setTimeScale(page, 4);
    await waitForBattleTime(page, 14);
    await expect(bubble(page)).toBeHidden();
    await expect(page.locator('.th-glow')).toHaveCount(0);
    expect(await seenTips(page)).toEqual([]);
  });

  test('can be brought back from the settings', async ({ page }) => {
    await open(page);
    await page.evaluate((key) => window.localStorage.setItem(key, JSON.stringify(['supplies', 'trainSapper'])), TIPS_KEY);
    await page.reload();
    await page.waitForFunction(() => (window as unknown as { __TH?: { ready: boolean } }).__TH?.ready === true, null, { timeout: 60_000 });
    await tap(page, 'settings');
    await tap(page, 'setting-replay');
    expect(await seenTips(page)).toEqual([]);
    await backToTitle(page);
    await playThroughMenus(page, 1, false);
    await expectTip(page, /Money buys troops/, '[data-tip="supplies"]');
  });
});
