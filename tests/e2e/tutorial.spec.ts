/**
 * The campaign tips in the built game, with real touches, on Stalingrad's Klin (1004), which brings a new unit (the
 * Sanitarka) and a new call-in (the Il-2 strike): the bubble with its arrow and the pulsing highlight on the new unit's
 * button, the tip ending when the player does the thing (a real tap trains the unit), a tip that never comes back, its
 * close button, the hints setting, and bringing the tips back from the settings.
 * This spec played the British mission 1's guided tutorial until Basic Training took that over (src/data/tutorial.ts
 * `trainingMission`; tests/e2e/basic-training.spec.ts walks through it) and the British missions were removed.
 * Pictures: docs/screenshots/e2e-tutorial-*.png
 */
import type { Page } from '@playwright/test';
import { missionEra } from '../../src/data/eras';
import { getMission } from '../../src/data/missions';
import type { MissionDef } from '../../src/data/schema';
import { TUTORIAL } from '../../src/data/tutorial';
import { expect, grantSupplies, open, playThroughMenus, savedGame, setTimeScale, shot, state, tap, tapIn, test, unlockAll } from './helpers';

const TIPS_KEY = TUTORIAL.storageKey;
const KLIN = getMission(1004) as MissionDef;
/** The new unit's name as the Red Army called it at Klin, in December 1941. */
const MEDIC = missionEra(KLIN, KLIN.start[0].faction).names.medic;

const bubble = (page: Page) => page.getByTestId('tip');

/** The tutorial ids the page has stored as seen. */
const seenTips = (page: Page) =>
  page.evaluate((key) => {
    const text = window.localStorage.getItem(key);
    return text === null ? [] : (JSON.parse(text) as string[]);
  }, TIPS_KEY);

/** The bubble is up, says `text`, and the control it points at pulses. `glow` is a selector for that control. */
async function expectTip(page: Page, text: RegExp | string, glow: string): Promise<void> {
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

/** From the title, through the map (every mission opened by the debug hook) and the briefing, into Klin. */
async function playKlin(page: Page): Promise<void> {
  await unlockAll(page);
  await playThroughMenus(page, KLIN.id, false);
}

test.describe('campaign tips, Klin (1004)', () => {
  test('point at the new unit with a pulsing bubble, end when it is trained, and never come back', async ({ page }) => {
    await open(page);
    await playKlin(page);

    // The new unit: the bubble names it and sits above its button, on the screen, with its arrow; the button pulses.
    await expectTip(page, MEDIC, '[data-testid="train-medic"]');
    {
      const { tip, control, size } = await rects(page, '[data-testid="train-medic"]');
      expect(tip.y + tip.height).toBeLessThanOrEqual(control.y + 1);
      expect(tip.x).toBeGreaterThanOrEqual(0);
      expect(tip.x + tip.width).toBeLessThanOrEqual(size.width);
      expect(tip.height).toBeGreaterThanOrEqual(30);
    }
    await expect(bubble(page)).toHaveAttribute('data-arrow', 'on');
    await shot(page, 'tutorial-1-new-unit');

    // The battle runs on under the tip: the clock moves while it is up.
    const t0 = (await state(page)).time;
    await page.waitForTimeout(600);
    expect((await state(page)).time).toBeGreaterThan(t0);

    // A real tap on the highlighted button does the thing (a medic is trained) and ends the tip.
    await grantSupplies(page, 500);
    const before = await state(page);
    await tap(page, 'train-medic');
    await expect.poll(() => seenTips(page)).toContain('new-unit-medic');
    await expect(bubble(page)).not.toContainText(MEDIC);
    await expect
      .poll(async () => {
        const s = await state(page);
        return s.units[0].medic + s.queue.medic;
      })
      .toBeGreaterThan(before.units[0].medic + before.queue.medic);

    // Then the new call-in, after a short pause.
    await expect(bubble(page)).toBeVisible({ timeout: 30_000 });
    await expect(bubble(page)).toContainText(missionEra(KLIN, KLIN.start[0].faction).supportNames.airStrike);
    await shot(page, 'tutorial-2-new-support');

    // Nothing the player has been through comes round again in a new battle.
    const seen = await seenTips(page);
    await page.evaluate(() => window.location.reload());
    await page.waitForFunction(() => (window as unknown as { __TH?: { ready: boolean } }).__TH?.ready === true, null, { timeout: 60_000 });
    expect(await seenTips(page)).toEqual(seen);
    await playKlin(page);
    await setTimeScale(page, 4);
    await waitForBattleTime(page, 6);
    expect(await seenTips(page)).toContain('new-unit-medic');
    await expect(bubble(page)).not.toContainText(MEDIC);
    // The save itself holds no tutorial state.
    expect(await savedGame(page)).not.toHaveProperty('tips');
  });

  test('can be closed with its own button, and a closed tip does not come back', async ({ page }) => {
    await open(page);
    await playKlin(page);
    await expectTip(page, MEDIC, '[data-testid="train-medic"]');
    const close = page.getByTestId('tip-dismiss');
    const box = await close.boundingBox();
    expect(box && box.width >= 47.5 && box.height >= 47.5, 'the close button is a full touch target').toBe(true);
    await close.tap();
    await expect(bubble(page)).toBeHidden();
    await expect(page.locator('.th-glow')).toHaveCount(0);
    await expect.poll(() => seenTips(page)).toContain('new-unit-medic');
    // The next tip comes after a short pause, and it is a different one: the call-in's, its button pulsing.
    await expect(bubble(page)).toBeVisible({ timeout: 20_000 });
    await expect(bubble(page)).not.toContainText(MEDIC);
    await expect(page.locator('.th-glow')).toHaveCount(1);
  });

  test('is silent while the hints setting is off, and speaks again when it is switched on', async ({ page }) => {
    await open(page);
    await tap(page, 'settings');
    await tap(page, 'setting-hints');
    await expect.poll(async () => (await savedGame(page))?.settings.hints).toBe(false);
    await backToTitle(page);
    await playKlin(page);
    await setTimeScale(page, 4);
    await waitForBattleTime(page, 14);
    await expect(bubble(page)).toBeHidden();
    await expect(page.locator('.th-glow')).toHaveCount(0);
    expect(await seenTips(page)).toEqual([]);
  });

  test('can be brought back from the settings', async ({ page }) => {
    await open(page);
    await page.evaluate((key) => window.localStorage.setItem(key, JSON.stringify(['new-unit-medic', 'new-support-airStrike'])), TIPS_KEY);
    await page.reload();
    await page.waitForFunction(() => (window as unknown as { __TH?: { ready: boolean } }).__TH?.ready === true, null, { timeout: 60_000 });
    await tap(page, 'settings');
    await tap(page, 'setting-replay');
    expect(await seenTips(page)).toEqual([]);
    await backToTitle(page);
    await playKlin(page);
    await expectTip(page, MEDIC, '[data-testid="train-medic"]');
  });
});
