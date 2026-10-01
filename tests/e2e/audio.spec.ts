/**
 * Sound in the built game: the mute switch in the battle, in the pause menu and in the settings, kept across a
 * reload; the audio frozen while the battle is paused and while the page is hidden (menus included).
 */
import type { Page } from '@playwright/test';
import { audioStats, expect, open, playThroughMenus, savedGame, state, tap, tapIn, test } from './helpers';

/** Make the page believe it was sent to the background (or brought back), the way a phone does when you switch app. */
async function setVisibility(page: Page, state: 'hidden' | 'visible'): Promise<void> {
  await page.evaluate((s) => {
    Object.defineProperty(document, 'visibilityState', { value: s, configurable: true });
    Object.defineProperty(document, 'hidden', { value: s === 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }, state);
}

const muted = async (page: Page): Promise<boolean> => (await audioStats(page)).muted;

test.describe('sound', () => {
  test('the mute switch works in the battle, the pause menu and the settings, and is remembered', async ({ page }) => {
    await open(page);
    await tap(page, 'play');
    await expect.poll(async () => (await audioStats(page)).state, { timeout: 10_000 }).toBe('running');
    await tapIn(page, 'campaign', 'back');
    await expect(page.locator('.th-screen.is-out')).toHaveCount(0);

    // Settings: Sound is on; switch it off and on again.
    await tap(page, 'settings');
    expect(await muted(page)).toBe(false);
    await tap(page, 'setting-mute');
    await expect.poll(() => muted(page)).toBe(true);
    await expect.poll(async () => (await savedGame(page))?.settings.muted).toBe(true);
    await tap(page, 'setting-mute');
    await expect.poll(() => muted(page)).toBe(false);
    await tapIn(page, 'settings', 'back');
    await expect(page.locator('.th-screen.is-out')).toHaveCount(0);

    // Battle: the button in the top bar.
    await playThroughMenus(page, 1, false);
    await tap(page, 'mute');
    await expect.poll(() => muted(page)).toBe(true);
    await expect(page.getByTestId('mute')).toBeVisible();
    await expect.poll(async () => (await savedGame(page))?.settings.muted).toBe(true);

    // Pause menu: the mute button there flips it back, and the audio is frozen while paused.
    await tap(page, 'pause');
    await expect.poll(async () => (await state(page)).paused).toBe(true);
    await expect.poll(async () => (await audioStats(page)).state).toBe('suspended');
    await tap(page, 'pause-mute');
    await expect.poll(() => muted(page)).toBe(false);
    await tap(page, 'pause-mute');
    await expect.poll(() => muted(page)).toBe(true);
    await tap(page, 'resume');
    await expect.poll(async () => (await audioStats(page)).state).toBe('running');

    // Remembered across a reload.
    await page.reload();
    await page.waitForFunction(() => (window as unknown as { __TH?: { ready: boolean } }).__TH?.ready === true, null, { timeout: 60_000 });
    expect(await muted(page)).toBe(true);
    await tap(page, 'settings');
    await expect(page.getByTestId('setting-mute')).toHaveAttribute('data-state', 'off');
  });

  test('freezes while the page is hidden, in the menus and in a battle, and only the player resumes a paused battle', async ({ page }) => {
    await open(page);
    await tap(page, 'play');
    await expect.poll(async () => (await audioStats(page)).state, { timeout: 10_000 }).toBe('running');

    // Menus: hidden means silent; back in front means sound again.
    await setVisibility(page, 'hidden');
    await expect.poll(async () => (await audioStats(page)).state).toBe('suspended');
    await setVisibility(page, 'visible');
    await expect.poll(async () => (await audioStats(page)).state).toBe('running');

    // A battle: hidden pauses it and freezes the sound; coming back changes neither until the player taps Resume.
    await tapIn(page, 'campaign', 'back');
    await expect(page.locator('.th-screen.is-out')).toHaveCount(0);
    await playThroughMenus(page, 1, false);
    await expect.poll(async () => (await state(page)).paused).toBe(false);
    await setVisibility(page, 'hidden');
    await expect.poll(async () => (await state(page)).paused).toBe(true);
    await expect.poll(async () => (await audioStats(page)).state).toBe('suspended');
    await setVisibility(page, 'visible');
    await page.waitForTimeout(300);
    expect((await state(page)).paused).toBe(true);
    expect((await audioStats(page)).state).toBe('suspended');
    await tap(page, 'resume');
    await expect.poll(async () => (await state(page)).paused).toBe(false);
    await expect.poll(async () => (await audioStats(page)).state).toBe('running');
  });
});
