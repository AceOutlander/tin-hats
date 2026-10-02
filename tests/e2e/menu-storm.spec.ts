/**
 * The title screen's storm in the built game, on a phone in landscape with touch: rain in three layers scaled to the
 * screen, a flash every few seconds with a thunder after each, the rain bed that starts with the first touch and fades
 * in, mute, the three volume sliders and Reduce flashing (saved across a reload and taking effect), the storm stopping
 * when the title is left and freezing while the page is away, and its cost per frame.
 *
 * Pictures: docs/screenshots/menu-storm-rain.png, menu-storm-flash.png, menu-storm-reduced.png (844x390 at 2x).
 */
import type { Page } from '@playwright/test';
import { join } from 'node:path';
import type { MenuStormStats } from '../../src/app/menuStorm';
import { MENU_STORM } from '../../src/data/menuStorm';
import { volumeGain } from '../../src/data/sounds';
import type { PerfHook } from '../../src/render/view';
import { arrived, expect, open, savedGame, SHOT_DIR, tap, tapIn, test, type Hooked } from './helpers';

const stats = (page: Page): Promise<MenuStormStats> => page.evaluate(() => (window as unknown as Hooked).__TH?.menuStorm.stats() as MenuStormStats);
const freeze = (page: Page, on: boolean) => page.evaluate((v) => (window as unknown as Hooked).__TH?.menuStorm.freeze(v), on);
const advance = (page: Page, s: number) => page.evaluate((v) => (window as unknown as Hooked).__TH?.menuStorm.advance(v), s);
const forceFlash = (page: Page, fork?: boolean) => page.evaluate((v) => (window as unknown as Hooked).__TH?.menuStorm.forceFlash(v ?? undefined), fork ?? null);
const total = (s: MenuStormStats): number => s.drops.reduce((a, b) => a + b, 0);

/** Make the page believe it was sent to the background (or brought back), the way a phone does when you switch app. */
async function setVisibility(page: Page, state: 'hidden' | 'visible'): Promise<void> {
  await page.evaluate((s) => {
    Object.defineProperty(document, 'visibilityState', { value: s, configurable: true });
    Object.defineProperty(document, 'hidden', { value: s === 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }, state);
}

/** A first touch on the title away from the plate and its buttons (the bottom left corner of the field). */
async function touchTheField(page: Page): Promise<void> {
  const size = page.viewportSize();
  if (!size) throw new Error('no viewport');
  await page.touchscreen.tap(24, size.height - 24);
}

/** Tap a volume slider at a fraction of its track. */
async function setSlider(page: Page, testId: string, frac: number): Promise<void> {
  const track = arrived(page, 'settings').getByTestId(testId).locator('.th-slider-track');
  const box = await track.boundingBox();
  if (!box) throw new Error(`${testId} has no track on screen`);
  await page.touchscreen.tap(box.x + box.width * frac, box.y + box.height / 2);
}

/** Bring the storm to a moment between flashes: frozen, the sky dark. */
async function betweenFlashes(page: Page): Promise<void> {
  await freeze(page, true);
  for (let i = 0; i < 40 && (await stats(page)).flash > 0; i++) await advance(page, 0.25);
  expect((await stats(page)).flash).toBe(0);
}

test.describe('title storm', () => {
  test('rains on the title in three layers, with the drop count scaled to the screen', async ({ page }) => {
    await open(page);
    await expect.poll(async () => (await stats(page)).running).toBe(true);
    await expect.poll(async () => (await stats(page)).scene.shown).toBe(true);
    const phone = await stats(page);
    expect(phone.drops.length).toBe(3);
    for (const n of phone.drops) expect(n).toBeGreaterThan(0);
    for (let l = 0; l < 3; l++) {
      expect(phone.drops[l]).toBeGreaterThanOrEqual(MENU_STORM.rain.layers[l].min);
      expect(phone.drops[l]).toBeLessThanOrEqual(MENU_STORM.rain.layers[l].max);
    }
    expect(phone.scene.rainShare).toBe(1);
    await expect.poll(async () => (await stats(page)).splashes, { timeout: 5000 }).toBeGreaterThan(0);
    await expect.poll(async () => (await stats(page)).panelDrops, { timeout: 8000 }).toBeGreaterThan(0);

    // A smaller phone gets fewer streaks, a bigger one more.
    await page.setViewportSize({ width: 568, height: 320 });
    await expect.poll(async () => total(await stats(page)), { timeout: 5000 }).toBeLessThan(total(phone));
    await page.setViewportSize({ width: 1000, height: 412 });
    await expect.poll(async () => total(await stats(page)), { timeout: 5000 }).toBeGreaterThan(total(phone));
    await page.setViewportSize({ width: 844, height: 390 });
    await expect.poll(async () => total(await stats(page)), { timeout: 5000 }).toBe(total(phone));

    // Between flashes: the rain layers, splashes on the grass, drops on the plate.
    await page.waitForTimeout(1500);
    await betweenFlashes(page);
    await page.waitForTimeout(250);
    await page.screenshot({ path: join(SHOT_DIR, 'menu-storm-rain.png') });
  });

  test('flashes every interval of storm time, schedules a thunder after each and shows a fork behind the spire', async ({ page }) => {
    await open(page);
    await expect.poll(async () => (await stats(page)).running).toBe(true);
    await freeze(page, true);
    const before = await stats(page);
    await advance(page, MENU_STORM.thunderInterval * 5);
    const after = await stats(page);
    expect(after.time - before.time).toBeCloseTo(MENU_STORM.thunderInterval * 5, 3);
    expect(after.flashes - before.flashes).toBe(5);
    expect(after.thundersScheduled - before.thundersScheduled).toBe(5);
    expect(after.lastThunder.delay).toBeGreaterThanOrEqual(MENU_STORM.thunder.delay[0]);
    expect(after.lastThunder.delay).toBeLessThanOrEqual(MENU_STORM.thunder.delay[1]);
    await advance(page, MENU_STORM.thunder.delay[1] + 0.1);
    const later = await stats(page);
    expect(later.thundersPlayed).toBe(later.thundersScheduled);

    // In real time too: one flash within an interval, with its thunder on the way.
    await freeze(page, false);
    const flashes = (await stats(page)).flashes;
    await expect.poll(async () => (await stats(page)).flashes, { timeout: MENU_STORM.thunderInterval * 1000 + 3000 }).toBe(flashes + 1);
    expect((await stats(page)).thundersScheduled).toBe((await stats(page)).flashes);

    // Exactly mid-flash, with a fork: the sky is lit and the fork is drawn.
    await freeze(page, true);
    await forceFlash(page, true);
    await advance(page, 0.03);
    await page.waitForTimeout(250);
    const mid = await stats(page);
    expect(mid.flash).toBeGreaterThan(0.8);
    expect(mid.fork).toBeGreaterThan(0.8);
    expect(mid.scene.forkDrawn).toBe(true);
    expect(mid.scene.skyFlash).toBeGreaterThan(0.2);
    await page.screenshot({ path: join(SHOT_DIR, 'menu-storm-flash.png') });
  });

  test('starts its sound on the first touch and fades the rain in; mute silences it', async ({ page }) => {
    await open(page);
    await expect.poll(async () => (await stats(page)).running).toBe(true);
    const silent = await stats(page);
    expect(silent.audio.state).not.toBe('running');
    expect(silent.audio.bedOn).toBe(true);
    expect(silent.audio.bed).toBe(0);
    await touchTheField(page);
    await expect.poll(async () => (await stats(page)).audio.state, { timeout: 10_000 }).toBe('running');
    // It fades in: part-way first, then all the way.
    const levels: number[] = [];
    const start = Date.now();
    while (Date.now() - start < (MENU_STORM.rainAudio.fadeIn + 2) * 1000) {
      levels.push((await stats(page)).audio.bed);
      if (levels[levels.length - 1] > 0.98) break;
      await page.waitForTimeout(100);
    }
    expect(Math.min(...levels), 'heard rising, not at once').toBeLessThan(0.6);
    expect(Math.max(...levels)).toBeGreaterThan(0.98);
    for (let i = 1; i < levels.length; i++) expect(levels[i]).toBeGreaterThanOrEqual(levels[i - 1] - 1e-6);
    // Something really comes out, and mute (in Settings, which the title opens without stopping the storm) silences it.
    await expect.poll(async () => (await stats(page)).audio.output, { timeout: 5000 }).toBeGreaterThan(1e-4);
    await tap(page, 'settings');
    await expect(arrived(page, 'settings')).toBeVisible();
    expect((await stats(page)).running).toBe(true);
    await tapIn(page, 'settings', 'setting-mute');
    await expect.poll(async () => (await stats(page)).audio.muted).toBe(true);
    await expect.poll(async () => (await stats(page)).audio.output, { timeout: 5000 }).toBeLessThan(1e-5);
    // Thunder made while muted is not even synthesised.
    const heard = (await stats(page)).thundersHeard;
    await freeze(page, true);
    await advance(page, MENU_STORM.thunderInterval + MENU_STORM.thunder.delay[1] + 0.1);
    expect((await stats(page)).thundersHeard).toBe(heard);
    await tapIn(page, 'settings', 'setting-mute');
    await expect.poll(async () => (await stats(page)).audio.output, { timeout: 5000 }).toBeGreaterThan(1e-4);
    await freeze(page, false);
    await expect.poll(async () => (await stats(page)).thundersHeard, { timeout: 12_000 }).toBeGreaterThan(heard);
  });

  test('the three volume sliders and Reduce flashing take effect and survive a reload', async ({ page }) => {
    await open(page);
    await touchTheField(page);
    await expect.poll(async () => (await stats(page)).audio.state, { timeout: 10_000 }).toBe('running');
    await expect.poll(async () => (await stats(page)).audio.bed, { timeout: 8000 }).toBeGreaterThan(0.98);
    await tap(page, 'settings');
    const settings = arrived(page, 'settings');
    await expect(settings).toBeVisible();
    for (const id of ['setting-music', 'setting-ambience', 'setting-sfx', 'setting-reduce-flash', 'setting-mute']) {
      const box = await settings.getByTestId(id).boundingBox();
      expect(box, id).not.toBeNull();
      expect(box?.height ?? 0, `${id} is tall enough to touch`).toBeGreaterThanOrEqual(47.5);
      expect(box?.width ?? 0).toBeGreaterThanOrEqual(47.5);
    }
    const value = async (id: string): Promise<number> => Number(await settings.getByTestId(id).getAttribute('aria-valuenow'));

    // Ambience moves the title rain; Sound effects does not.
    const rainBefore = (await stats(page)).audio.rain;
    await setSlider(page, 'setting-sfx', 0.4);
    await expect.poll(() => value('setting-sfx')).toBeGreaterThan(30);
    const sfx = await value('setting-sfx');
    expect(sfx).toBeLessThan(50);
    await expect.poll(async () => (await stats(page)).audio.sfx).toBeCloseTo(volumeGain(sfx), 2);
    expect((await stats(page)).audio.rain).toBeCloseTo(rainBefore, 2);
    await setSlider(page, 'setting-ambience', 0.6);
    await expect.poll(() => value('setting-ambience')).toBeLessThan(70);
    const ambience = await value('setting-ambience');
    expect(ambience).toBeGreaterThan(50);
    await expect.poll(async () => (await stats(page)).audio.ambience).toBeCloseTo(volumeGain(ambience), 2);
    await expect.poll(async () => (await stats(page)).audio.rain).toBeCloseTo(volumeGain(ambience), 2);
    expect((await stats(page)).audio.rain).toBeLessThan(rainBefore - 0.2);
    await setSlider(page, 'setting-music', 0.25);
    await expect.poll(() => value('setting-music')).toBeLessThan(35);
    const music = await value('setting-music');
    expect(music).toBeGreaterThan(15);
    await expect.poll(async () => (await stats(page)).audio.music).toBeCloseTo(volumeGain(music), 2);
    expect((await stats(page)).audio.rain).toBeCloseTo(volumeGain(ambience), 2);
    await tapIn(page, 'settings', 'setting-reduce-flash');
    await expect(settings.getByTestId('setting-reduce-flash')).toHaveAttribute('data-state', 'on');
    await expect.poll(async () => (await stats(page)).reduced).toBe(true);
    await expect.poll(async () => (await savedGame(page))?.settings).toMatchObject({ musicVolume: music, ambienceVolume: ambience, sfxVolume: sfx, reduceFlash: true });

    // After a reload: the same values on the sliders and the switch, and in the sound once it starts.
    await page.reload();
    await page.waitForFunction(() => (window as unknown as Hooked).__TH?.ready === true, null, { timeout: 60_000 });
    expect((await stats(page)).reduced).toBe(true);
    await touchTheField(page);
    await expect.poll(async () => (await stats(page)).audio.state, { timeout: 10_000 }).toBe('running');
    await expect.poll(async () => (await stats(page)).audio.music).toBeCloseTo(volumeGain(music), 2);
    await expect.poll(async () => (await stats(page)).audio.ambience).toBeCloseTo(volumeGain(ambience), 2);
    await expect.poll(async () => (await stats(page)).audio.sfx).toBeCloseTo(volumeGain(sfx), 2);
    await tap(page, 'settings');
    const again = arrived(page, 'settings');
    await expect(again.getByTestId('setting-music')).toHaveAttribute('aria-valuenow', String(music));
    await expect(again.getByTestId('setting-ambience')).toHaveAttribute('aria-valuenow', String(ambience));
    await expect(again.getByTestId('setting-sfx')).toHaveAttribute('aria-valuenow', String(sfx));
    await expect(again.getByTestId('setting-reduce-flash')).toHaveAttribute('data-state', 'on');
  });

  test('Reduce flashing turns the flash into a soft glow with no fork', async ({ page }) => {
    await open(page);
    await expect.poll(async () => (await stats(page)).running).toBe(true);
    /** The largest change in sky brightness between two 1/60 s steps over a whole flash, and whether a fork was drawn. */
    const sample = async (): Promise<{ step: number; peak: number; fork: boolean }> => {
      await betweenFlashes(page);
      await forceFlash(page, true);
      let prev = 0;
      let step = 0;
      let peak = 0;
      let fork = false;
      for (let i = 0; i < 180; i++) {
        await advance(page, 1 / 60);
        const s = await stats(page);
        step = Math.max(step, Math.abs(s.flash - prev));
        peak = Math.max(peak, s.flash);
        if (s.fork > 0) fork = true;
        prev = s.flash;
      }
      return { step, peak, fork };
    };
    const sharp = await sample();
    expect(sharp.step).toBeGreaterThan(0.25);
    expect(sharp.fork).toBe(true);

    await tap(page, 'settings');
    await tapIn(page, 'settings', 'setting-reduce-flash');
    await expect.poll(async () => (await stats(page)).reduced).toBe(true);
    await tapIn(page, 'settings', 'back');
    await expect(arrived(page, 'title')).toBeVisible();
    const soft = await sample();
    expect(soft.step).toBeLessThan(0.03);
    expect(soft.peak).toBeGreaterThan(0.2);
    expect(soft.fork).toBe(false);
    expect((await stats(page)).scene.forkDrawn).toBe(false);

    // The picture at the top of the glow.
    await betweenFlashes(page);
    await forceFlash(page, true);
    await advance(page, 0.7);
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(SHOT_DIR, 'menu-storm-reduced.png') });
  });

  test('stops when the title is left, restarts on return, and freezes while the page is away', async ({ page }) => {
    await open(page);
    await touchTheField(page);
    await expect.poll(async () => (await stats(page)).audio.bed, { timeout: 8000 }).toBeGreaterThan(0.5);

    // Leaving for the campaign: rain and sound fade out and the scene comes down.
    await tap(page, 'play');
    await expect(arrived(page, 'campaign')).toBeVisible();
    await expect.poll(async () => (await stats(page)).running).toBe(false);
    await expect.poll(async () => (await stats(page)).audio.bedOn).toBe(false);
    await expect.poll(async () => (await stats(page)).scene.shown, { timeout: 5000 }).toBe(false);
    const time = (await stats(page)).time;
    await page.waitForTimeout(500);
    expect((await stats(page)).time).toBe(time);

    // Back on the title it starts again.
    await tapIn(page, 'campaign', 'back');
    await expect(arrived(page, 'title')).toBeVisible();
    await expect.poll(async () => (await stats(page)).running).toBe(true);
    await expect.poll(async () => (await stats(page)).scene.shown).toBe(true);
    await expect.poll(async () => (await stats(page)).audio.bedOn).toBe(true);
    await expect.poll(async () => (await stats(page)).time).toBeGreaterThan(time);

    // A hidden tab: frozen and silent; back in front: on it goes.
    await setVisibility(page, 'hidden');
    await expect.poll(async () => (await stats(page)).paused).toBe(true);
    await expect.poll(async () => (await stats(page)).audio.state).toBe('suspended');
    const frozen = (await stats(page)).time;
    await page.waitForTimeout(700);
    expect((await stats(page)).time).toBe(frozen);
    await setVisibility(page, 'visible');
    await expect.poll(async () => (await stats(page)).paused).toBe(false);
    await expect.poll(async () => (await stats(page)).audio.state).toBe('running');
    await expect.poll(async () => (await stats(page)).time).toBeGreaterThan(frozen);

    // The window losing focus does the same, and getting it back undoes it.
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect.poll(async () => (await stats(page)).paused).toBe(true);
    await expect.poll(async () => (await stats(page)).audio.state).toBe('suspended');
    const blurred = (await stats(page)).time;
    await page.waitForTimeout(500);
    expect((await stats(page)).time).toBe(blurred);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect.poll(async () => (await stats(page)).paused).toBe(false);
    await expect.poll(async () => (await stats(page)).audio.state).toBe('running');
    await expect.poll(async () => (await stats(page)).time).toBeGreaterThan(blurred);
  });

  test('costs only a small part of a frame', async ({ page }) => {
    await open(page);
    await expect.poll(async () => (await stats(page)).running).toBe(true);
    await page.waitForTimeout(1500);
    await page.evaluate(() => (window as unknown as { __THPERF: PerfHook }).__THPERF.reset());
    await page.waitForTimeout(4000);
    const report = await page.evaluate(() => (window as unknown as { __THPERF: PerfHook }).__THPERF.report());
    console.log(`title storm: ${report.frames} frames, JS ${report.js.avg.toFixed(3)} ms per frame (p95 ${report.js.p95.toFixed(3)}), Phaser draw ${report.draw.avg.toFixed(3)} ms`);
    expect(report.frames).toBeGreaterThan(60);
    expect(report.js.avg).toBeLessThan(MENU_STORM.perf.jsBudgetMs);
  });
});
