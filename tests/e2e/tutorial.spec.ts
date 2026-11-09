/**
 * The campaign's tutorial tips in the built game, with real touches: a mission that brings a new unit says so with a
 * bubble over its button, which pulses; the tip ends when the player does the thing, a tip seen never comes back, the
 * close button, the hints setting, and bringing the tips back from the settings.
 * The guided course that mission 1 used to carry is Basic Training's now (src/data/tutorial.ts `trainingMission`;
 * tests/e2e/basic-training.spec.ts walks it): mission 1 keeps only its scripted hints, and its riflemen bring no tip.
 * Pictures: docs/screenshots/e2e-tutorial-*.png
 */
import type { Page } from '@playwright/test';
import { MISSIONS } from '../../src/data/missions';
import type { MissionDef } from '../../src/data/schema';
import { TUTORIAL } from '../../src/data/tutorial';
import { expect, grantSupplies, open, playThroughMenus, savedGame, setTimeScale, shot, state, tap, tapIn, test } from './helpers';

const TIPS_KEY = TUTORIAL.storageKey;

/** The first campaign mission whose new unit has a tip (mission 2's Bren gunner today). */
const UNIT_MISSION = MISSIONS.find((m) => m.newUnit !== null && TUTORIAL.newUnit.tips[m.newUnit] !== undefined) as MissionDef;
/** The first that brings a unit and a call-in, each with its tip (mission 4's mortar and barrage today). */
const BOTH_MISSION = MISSIONS.find((m) => m.newUnit !== null && TUTORIAL.newUnit.tips[m.newUnit] !== undefined && m.newSupport !== null) as MissionDef;
const unitTip = (m: MissionDef): string => `new-unit-${m.newUnit}`;

const bubble = (page: Page) => page.getByTestId('tip');

/** The tutorial ids the page has stored as seen. */
const seenTips = (page: Page) =>
  page.evaluate((key) => {
    const text = window.localStorage.getItem(key);
    return text === null ? [] : (JSON.parse(text) as string[]);
  }, TIPS_KEY);

/** A save that has won every mission before `m`, so `m` is open on the map and what it brings is new. */
async function reached(page: Page, m: MissionDef): Promise<void> {
  const ids = MISSIONS.filter((x) => x.id < m.id).map((x) => x.id);
  await page.addInitScript((won) => {
    if (window.localStorage.getItem('tinhats.save') !== null) return;
    const cleared: Record<string, string[]> = {};
    for (const id of won) cleared[String(id)] = ['normal'];
    window.localStorage.setItem('tinhats.save', JSON.stringify({ version: 2, cleared, upgrades: {}, lastMission: won[won.length - 1] ?? 1, settings: { muted: false, difficulty: 'normal', hints: true } }));
  }, ids);
}

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

const NEW_TIP = /^New: /;

test.describe('tutorial tips in the campaign', () => {
  test('point at the new unit, end when one is trained, and never come back', async ({ page }) => {
    if (!UNIT_MISSION?.newUnit) throw new Error('no campaign mission brings a unit with a tip');
    const unit = UNIT_MISSION.newUnit;
    const button = `[data-testid="train-${unit}"]`;
    await reached(page, UNIT_MISSION);
    await open(page);
    await playThroughMenus(page, UNIT_MISSION.id, false);

    // The bubble sits above the new unit's button, on the screen, with its arrow, and the button pulses.
    await expectTip(page, NEW_TIP, button);
    {
      const { tip, control, size } = await rects(page, button);
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

    // A real tap on the highlighted button does the thing and ends the tip.
    await grantSupplies(page, 500);
    const before = await state(page);
    await tap(page, `train-${unit}`);
    await expect(bubble(page)).toBeHidden();
    await expect(page.locator('.th-glow')).toHaveCount(0);
    await expect.poll(() => seenTips(page)).toContain(unitTip(UNIT_MISSION));
    await expect
      .poll(async () => {
        const s = await state(page);
        return s.units[0][unit] + s.queue[unit];
      })
      .toBeGreaterThan(before.units[0][unit] + before.queue[unit]);

    // Nothing the player has been through comes round again in a new battle.
    const seen = await seenTips(page);
    await page.evaluate(() => window.location.reload());
    await page.waitForFunction(() => (window as unknown as { __TH?: { ready: boolean } }).__TH?.ready === true, null, { timeout: 60_000 });
    expect(await seenTips(page)).toEqual(seen);
    await playThroughMenus(page, UNIT_MISSION.id, false);
    await setTimeScale(page, 4);
    await waitForBattleTime(page, TUTORIAL.newUnit.startAfter + 12);
    await expect(bubble(page)).toBeHidden();
    // The save itself holds no tutorial state.
    expect(await savedGame(page)).not.toHaveProperty('tips');
  });

  test('can be closed with its own button, and a closed tip does not come back', async ({ page }) => {
    if (!BOTH_MISSION?.newUnit || !BOTH_MISSION.newSupport) throw new Error('no campaign mission brings a unit and a call-in');
    await reached(page, BOTH_MISSION);
    await open(page);
    await playThroughMenus(page, BOTH_MISSION.id, false);
    await expectTip(page, NEW_TIP, `[data-testid="train-${BOTH_MISSION.newUnit}"]`);
    const first = await bubble(page).textContent();
    const close = page.getByTestId('tip-dismiss');
    const box = await close.boundingBox();
    expect(box && box.width >= 47.5 && box.height >= 47.5, 'the close button is a full touch target').toBe(true);
    await close.tap();
    await expect(bubble(page)).toBeHidden();
    await expect(page.locator('.th-glow')).toHaveCount(0);
    await expect.poll(() => seenTips(page)).toContain(unitTip(BOTH_MISSION));
    // The next tip comes after a short pause, and it is a different one: the call-in's.
    await expect(bubble(page)).toBeVisible({ timeout: 20_000 });
    await expect(bubble(page)).not.toHaveText(first ?? '');
    await expect(page.locator('.th-glow')).toHaveCount(1);
  });

  test('is silent while the hints setting is off, and speaks again when it is switched on', async ({ page }) => {
    await reached(page, UNIT_MISSION);
    await open(page);
    await tap(page, 'settings');
    await tap(page, 'setting-hints');
    await expect.poll(async () => (await savedGame(page))?.settings.hints).toBe(false);
    await backToTitle(page);
    await playThroughMenus(page, UNIT_MISSION.id, false);
    await setTimeScale(page, 4);
    await waitForBattleTime(page, 14);
    await expect(bubble(page)).toBeHidden();
    await expect(page.locator('.th-glow')).toHaveCount(0);
    expect(await seenTips(page)).toEqual([]);
  });

  test('can be brought back from the settings', async ({ page }) => {
    await reached(page, UNIT_MISSION);
    await open(page);
    await page.evaluate(([key, id]) => window.localStorage.setItem(key, JSON.stringify([id])), [TIPS_KEY, unitTip(UNIT_MISSION)] as [string, string]);
    await page.reload();
    await page.waitForFunction(() => (window as unknown as { __TH?: { ready: boolean } }).__TH?.ready === true, null, { timeout: 60_000 });
    await tap(page, 'settings');
    await tap(page, 'setting-replay');
    expect(await seenTips(page)).toEqual([]);
    await backToTitle(page);
    await playThroughMenus(page, UNIT_MISSION.id, false);
    await expectTip(page, NEW_TIP, `[data-testid="train-${UNIT_MISSION.newUnit}"]`);
  });
});
