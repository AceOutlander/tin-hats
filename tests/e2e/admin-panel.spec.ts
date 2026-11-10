/**
 * The hidden admin panel in the built game. The real code is never used here: with ?debug=1 the test hands the lock
 * the salted hash of a code of its own (computed the way the game computes it) and types that.
 *
 * - Seven quick taps on the title helmet open the prompt; the test code unlocks the panel and its small button; the
 *   panel grants medals (saved), spawns an enemy King Tiger at a tapped spot in a battle and reveals enemy health.
 * - Without the code it stays out of reach: nothing of it is in the page, too few or too slow taps open nothing, the
 *   key combination and the taps open only the prompt, and a wrong code just closes it.
 *
 * - From the Campaign tab it jumps to a later Stalingrad mission and phase, gives charges and points (the save stays
 *   valid), and the panel fits and scrolls at 844x390 and 667x375 with thumb-sized tabs.
 *
 * Pictures (844x390 at 2x): docs/screenshots/admin-panel-prompt.png, -campaign.png, -units.png, -spawn.png, -debug.png.
 */
import type { Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import type { DebugApi } from '../../src/app/debug';
import { ADMIN } from '../../src/data/admin';
import { MISSIONS } from '../../src/data/missions';
import { UPGRADES } from '../../src/data/upgrades';
import { sanitizeSave } from '../../src/meta';
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

    // A tap on open ground places it there. The first mission opens on its prep phase, whose panel (the build buttons)
    // sits mid-screen: the tap goes to the first point down the middle that is the battlefield itself, not a control.
    const before = (await units(page)).filter((u) => u.kind === 'heavyTank').length;
    const ground = await page.evaluate(() => {
      // Clear of the panel above by a margin: a touch right at its edge can land on its buttons.
      const field = (y: number) => document.elementFromPoint(430, y) instanceof HTMLCanvasElement;
      for (let y = 200; y <= 320; y += 10) if (field(y) && field(y - 20)) return { x: 430, y };
      return null;
    });
    expect(ground, 'open battlefield under the admin bar').not.toBeNull();
    await page.touchscreen.tap((ground as { x: number; y: number }).x, (ground as { x: number; y: number }).y);
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

  test('jumps to a Stalingrad mission and a later phase, gives charges and points, keeps the save valid, and fits small phones', async ({ page }) => {
    test.setTimeout(180_000);
    await open(page);
    await page.evaluate((hash) => ((window as unknown as Hooked).__TH as DebugApi).admin?.useHash(hash), TEST_HASH);
    // The helmet on today's title screen is on screen and takes the touch taps.
    const helmet = page.getByTestId('title-helmet');
    await expect(helmet).toBeVisible();
    const box = await helmet.boundingBox();
    expect(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 844 && box.y + box.height <= 390).toBe(true);
    await openPrompt(page);
    await page.getByTestId('admin-code').fill(TEST_CODE);
    await tap(page, 'admin-code-ok');
    await expect(page.getByTestId('admin-panel')).toBeVisible();

    // Campaign: the Stalingrad missions as the players number them.
    await tap(page, 'admin-tab-campaign');
    await expect(page.getByTestId(`admin-jump-${MISSIONS[0].id}`)).toHaveText(`1 ${MISSIONS[0].title}`);
    const last = MISSIONS[MISSIONS.length - 1];
    await expect(page.getByTestId(`admin-jump-${last.id}`)).toHaveText(`${MISSIONS.length} ${last.title}`);

    // Charges of one call-in, of every one, and upgrade points up and down: saved at once, and a valid save.
    await tap(page, 'admin-charge-bomber-10');
    await tap(page, 'admin-charge-bomber--1');
    await expect(page.getByTestId('admin-charge-bomber-value')).toHaveText('9');
    await tap(page, 'admin-charges-1');
    await tap(page, 'admin-points-50');
    await tap(page, 'admin-points--5');
    await expect(page.getByTestId('admin-points-value')).toHaveText('45');
    await tap(page, 'admin-medals-100');
    await tap(page, 'admin-medals--10');
    await expect(page.getByTestId('admin-medals-value')).toHaveText('90');
    const stored = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? 'null') as unknown, SAVE_KEY);
    const rules = { missionIds: MISSIONS.map((m) => m.id), upgradeDefs: UPGRADES };
    expect(sanitizeSave(stored, rules)).toEqual(stored);
    expect(stored).toMatchObject({ version: 11, points: 45, medals: 90, charges: { bomber: 10 } });

    // Small phones: every tab and the mission list in view or reachable by scrolling the panel; thumb-sized targets.
    for (const size of [
      { width: 844, height: 390 },
      { width: 667, height: 375 },
    ]) {
      await page.setViewportSize(size);
      await page.waitForTimeout(200);
      for (const t of ADMIN.tabs) {
        const b = await page.getByTestId(`admin-tab-${t.id}`).boundingBox();
        expect(b, t.id).not.toBeNull();
        if (!b) continue;
        expect(b.height).toBeGreaterThanOrEqual(44);
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.x + b.width).toBeLessThanOrEqual(size.width);
        // The tab's label is not cut off.
        expect(await page.getByTestId(`admin-tab-${t.id}`).evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      }
      const panel = await page.getByTestId('admin-panel').boundingBox();
      expect(panel && panel.y >= 0 && panel.y + panel.height <= size.height + 1).toBe(true);
      const scroll = await page.getByTestId('admin-body').evaluate((el) => ({ sh: el.scrollHeight, ch: el.clientHeight, style: getComputedStyle(el).overflowY }));
      expect(scroll.sh).toBeGreaterThan(scroll.ch);
      expect(['auto', 'scroll']).toContain(scroll.style);
      const go = page.getByTestId('admin-jump-go');
      await go.scrollIntoViewIfNeeded();
      const g = await go.boundingBox();
      expect(g && g.height >= 44 && g.y + g.height <= size.height).toBe(true);
    }
    await page.setViewportSize({ width: 844, height: 390 });

    // Jump: a later Stalingrad mission, straight to its third phase, on Hard.
    const target = MISSIONS.find((m) => m.id !== MISSIONS[0].id && (m.phases?.length ?? 0) >= 3);
    if (!target?.phases) throw new Error('no mission of three phases');
    const phase = target.phases[2];
    await page.getByTestId(`admin-jump-${target.id}`).scrollIntoViewIfNeeded();
    await tap(page, `admin-jump-${target.id}`);
    await page.getByTestId(`admin-jump-phase-${phase.id}`).scrollIntoViewIfNeeded();
    await tap(page, `admin-jump-phase-${phase.id}`);
    await tap(page, 'admin-jump-diff-hard');
    await tap(page, 'admin-jump-go');
    await expect.poll(async () => (await state(page)).screen).toBe('battle');
    const s = await state(page);
    expect(s.missionId).toBe(target.id);
    expect(s.difficulty).toBe('hard');
    if ((await page.getByTestId('admin-panel').count()) === 0) await tap(page, 'admin-button');
    await tap(page, 'admin-tab-battle');
    await page.getByTestId(`admin-phase-${phase.id}`).scrollIntoViewIfNeeded();
    await expect(page.getByTestId(`admin-phase-${phase.id}`)).toHaveAttribute('aria-pressed', 'true');
    // The battle runs on in that phase.
    await page.waitForTimeout(1500);
    expect((await state(page)).tick).toBeGreaterThan(s.tick);

    // The renderer readout in the debug tab.
    await tap(page, 'admin-tab-debug');
    await page.getByTestId('admin-renderer').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('admin-renderer')).toContainText('Renderer: WebGL');
    await expect(page.getByTestId('admin-renderer')).toContainText('Quality level');

    // Still a valid save after the battle started (a jump records nothing).
    const after = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? 'null') as unknown, SAVE_KEY);
    expect(sanitizeSave(after, rules)).toEqual(after);
    expect(after).toMatchObject({ version: 11, cleared: {} });
  });
});
