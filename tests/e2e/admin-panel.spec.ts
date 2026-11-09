/**
 * The hidden admin panel in the built game. The real code is never used here: with ?debug=1 the test hands the lock
 * the salted hash of a code of its own (computed the way the game computes it) and types that.
 *
 * - Seven quick taps on the title helmet open the prompt; the test code unlocks the panel and its small button; the
 *   panel grants medals (saved), spawns an enemy King Tiger at a tapped spot in a battle and reveals enemy health.
 * - Without the code it stays out of reach: nothing of it is in the page, too few or too slow taps open nothing, the
 *   key combination and the taps open only the prompt, and a wrong code just closes it.
 *
 * Pictures (844x390 at 2x): docs/screenshots/admin-panel-prompt.png, -campaign.png, -units.png, -spawn.png, -debug.png.
 */
import type { Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import type { DebugApi } from '../../src/app/debug';
import { ADMIN } from '../../src/data/admin';
import { MISSIONS } from '../../src/data/missions';
import { expect, open, SAVE_KEY, SHOT_DIR, startMission, state, tap, test, units, type Hooked } from './helpers';

const TEST_CODE = 'e2e test code';
const TEST_HASH = createHash('sha256').update(ADMIN.passcode.salt + TEST_CODE).digest('hex');

const adminShot = (page: Page, name: string) => page.screenshot({ path: join(SHOT_DIR, `admin-panel-${name}.png`) });

/** `n` taps on the title helmet, `gapMs` apart. */
async function tapHelmet(page: Page, n: number, gapMs = 120): Promise<void> {
  const helmet = page.getByTestId('title-helmet');
  for (let i = 0; i < n; i++) {
    await helmet.tap();
    if (i < n - 1) await page.waitForTimeout(gapMs);
  }
}

/**
 * Seven quick taps until the prompt is up. On a loaded machine (the menu music renders on the main thread after
 * loading, other jobs run) a run can come out slower than ADMIN.tapGapMs between taps; it is then simply tapped again,
 * as a player would.
 */
async function openPrompt(page: Page): Promise<void> {
  const prompt = page.getByTestId('admin-prompt');
  for (let attempt = 0; attempt < 4 && (await prompt.count()) === 0; attempt++) {
    if (attempt > 0) await page.waitForTimeout(ADMIN.tapGapMs + 300);
    await tapHelmet(page, ADMIN.taps);
  }
  await expect(prompt).toBeVisible();
}

/** Nothing of the panel is in the page: no prompt, no panel, no admin button. */
async function expectNoPanel(page: Page): Promise<void> {
  await expect(page.getByTestId('admin-panel')).toHaveCount(0);
  await expect(page.getByTestId('admin-button')).toHaveCount(0);
  await expect(page.locator('.th-admin-panel, .th-admin-fab, .th-admin-bar')).toHaveCount(0);
}

test.describe('admin panel', () => {
  test('opens through seven taps with the code, spawns an enemy King Tiger and grants medals', async ({ page }) => {
    test.setTimeout(180_000);
    await open(page);
    await page.evaluate((hash) => ((window as unknown as Hooked).__TH as DebugApi).admin?.useHash(hash), TEST_HASH);
    await expect(page.getByTestId('play')).toBeVisible();
    await expectNoPanel(page);

    await openPrompt(page);
    const prompt = page.getByTestId('admin-prompt');
    await expect(page.getByTestId('admin-code')).toBeFocused();
    await page.getByTestId('admin-code').fill(TEST_CODE);
    await adminShot(page, 'prompt');
    await tap(page, 'admin-code-ok');
    await expect(prompt).toHaveCount(0);
    expect(await page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).admin?.unlocked())).toBe(true);
    await expect(page.getByTestId('admin-panel')).toBeVisible();
    await expect(page.getByTestId('admin-button')).toBeAttached();

    // Campaign: medals, saved at once and valid.
    await tap(page, 'admin-tab-campaign');
    await tap(page, 'admin-medals-100');
    await tap(page, 'admin-medals-10');
    expect(await page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).medals())).toBe(110);
    const stored = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? 'null') as { medals: number } | null, SAVE_KEY);
    expect(stored?.medals).toBe(110);
    await adminShot(page, 'campaign');

    // A battle: the panel stays unlocked, its button on screen.
    await startMission(page, MISSIONS[0].id, 11);
    await expect.poll(async () => (await state(page)).screen).toBe('battle');
    if ((await page.getByTestId('admin-panel').count()) === 0) await tap(page, 'admin-button');
    await tap(page, 'admin-tab-units');
    await tap(page, 'admin-spawn-enemy');
    await tap(page, 'admin-kind-heavyTank');
    await tap(page, 'admin-batch-1');
    await expect(page.getByTestId('admin-kind-heavyTank')).toHaveAttribute('aria-pressed', 'true');
    await adminShot(page, 'units');
    await tap(page, 'admin-place');
    await expect(page.getByTestId('admin-panel')).toHaveCount(0);
    await expect(page.getByTestId('admin-bar')).toBeVisible();

    // A tap on open ground places it there.
    const before = (await units(page)).filter((u) => u.kind === 'heavyTank').length;
    await page.touchscreen.tap(430, 215);
    await expect.poll(async () => (await units(page)).filter((u) => u.kind === 'heavyTank' && u.side === 1).length).toBe(before + 1);
    expect((await state(page)).units[1].heavyTank).toBe(1);
    await page.waitForTimeout(600);
    await adminShot(page, 'spawn');
    await tap(page, 'admin-bar-done');
    await expect(page.getByTestId('admin-panel')).toBeVisible();

    // Debug: enemy health revealed through the view's HpReveal, the readout and the outlines drawn.
    await tap(page, 'admin-tab-debug');
    await tap(page, 'admin-reveal');
    expect(await page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).hpPips().enemyRevealed)).toBe(true);
    await tap(page, 'admin-readout');
    await tap(page, 'admin-layer-hitboxes');
    await tap(page, 'admin-layer-points');
    await expect(page.getByTestId('admin-readout-text')).toContainText('Enemy:');
    await tap(page, 'admin-close');
    await page.waitForTimeout(400);
    await adminShot(page, 'debug');

    // Locking takes everything away again.
    await tap(page, 'admin-button');
    await tap(page, 'admin-lock');
    await expectNoPanel(page);
    await expect(page.getByTestId('admin-debug')).toHaveCount(0);
  });

  test('stays out of reach without the code', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/');
    await expect(page.getByTestId('play')).toBeVisible({ timeout: 60_000 });
    expect(await page.evaluate(() => (window as unknown as Hooked).__TH)).toBeUndefined();
    await expectNoPanel(page);
    await expect(page.getByTestId('admin-prompt')).toHaveCount(0);

    // Too few quick taps, or seven slow ones: nothing.
    await tapHelmet(page, ADMIN.taps - 1);
    await page.waitForTimeout(ADMIN.tapGapMs + 200);
    await tapHelmet(page, 1);
    await expect(page.getByTestId('admin-prompt')).toHaveCount(0);
    await page.waitForTimeout(ADMIN.tapGapMs + 200);
    await tapHelmet(page, ADMIN.taps, ADMIN.tapGapMs + 150);
    await expect(page.getByTestId('admin-prompt')).toHaveCount(0);
    await page.waitForTimeout(ADMIN.tapGapMs + 200);

    // The key combination opens the prompt; Escape closes it and leaves the title as it was.
    const combo = `${ADMIN.keys.ctrl ? 'Control+' : ''}${ADMIN.keys.alt ? 'Alt+' : ''}${ADMIN.keys.shift ? 'Shift+' : ''}${ADMIN.keys.code.replace(/^Key/, '')}`;
    await page.keyboard.press(combo);
    await expect(page.getByTestId('admin-prompt')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('admin-prompt')).toHaveCount(0);
    await expect(page.locator('.th-screen.is-in[data-screen="title"]')).toHaveCount(1);

    // Seven quick taps open the prompt; wrong codes just close it, with no hint and no panel.
    for (const wrong of ['letmein', TEST_CODE, '']) {
      await openPrompt(page);
      await page.getByTestId('admin-code').fill(wrong);
      await page.getByTestId('admin-code').press('Enter');
      await expect(page.getByTestId('admin-prompt')).toHaveCount(0);
      await expectNoPanel(page);
      await expect(page.locator('.th-admin-note')).toHaveCount(0);
      await page.waitForTimeout(ADMIN.tapGapMs + 200);
    }
    // Enter in the prompt never reached the title's Play button.
    await expect(page.locator('.th-screen.is-in[data-screen="title"]')).toHaveCount(1);
  });
});
