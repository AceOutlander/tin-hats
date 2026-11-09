/**
 * UI polish in the built game: every menu screen and the HUD at six phone sizes (nothing under 48 px to touch, nothing
 * cut off or off the screen, no two buttons on top of each other), the briefing that scrolls and says so, and rapid taps
 * that must never fire a navigation or a purchase twice. Pictures: docs/screenshots/e2e-polish-*.png
 */
import type { Page } from '@playwright/test';
import { arrived, expect, open, playThroughMenus, shot, startMission, state, tap, tapIn, test, touchDrag } from './helpers';

const SIZES: Array<[number, number]> = [
  [568, 320],
  [640, 360],
  [667, 375],
  [844, 390],
  [932, 430],
  [1000, 412],
];

/**
 * A save far enough on that the Quartermaster has medals to spend and upgrades to show: Stalingrad's missions 1001 to
 * 1005 cleared, so 1006 (Mamayev Kurgan, with call-ins and new units) is the next to play.
 */
async function farSave(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (window.localStorage.getItem('tinhats.save') !== null) return;
    const cleared: Record<string, string[]> = {};
    for (let i = 1001; i <= 1005; i++) cleared[String(i)] = ['normal'];
    window.localStorage.setItem(
      'tinhats.save',
      JSON.stringify({
        version: 10,
        cleared,
        upgrades: { sapperDrill: 1, hqIncome: 2, rifleHealth: 3 },
        medals: 160,
        armoury: [],
        wins: {},
        lastMission: 1003,
        training: { done: true, skipped: false },
        settings: { muted: false, difficulty: 'normal', hints: true },
      }),
    );
  });
}

/** Runs in the page: what is wrong with the screen that is showing. */
function problemsOnScreen(): string[] {
  const out: string[] = [];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const name = (el: Element): string => {
    const id = (el as HTMLElement).dataset.testid;
    return `${el.tagName.toLowerCase()}${id ? `[${id}]` : ''} "${(el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 20)}"`;
  };
  const visible = (el: Element): boolean => {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    let node: Element | null = el;
    while (node) {
      const cs = getComputedStyle(node);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
      if (node.hasAttribute('inert') || node.classList.contains('is-out')) return false;
      node = node.parentElement;
    }
    return true;
  };
  const buttons = [...document.querySelectorAll('button')].filter((b) => visible(b) && !b.closest('.th-tip'));
  for (const b of buttons) {
    const r = b.getBoundingClientRect();
    if (r.width < 47.5 || r.height < 47.5) out.push(`small: ${name(b)} ${r.width.toFixed(0)}x${r.height.toFixed(0)}`);
    const pannable = b.classList.contains('th-pin') || b.closest('[data-scroll]') !== null || b.closest('.th-train') !== null;
    if (!pannable && (r.left < -0.5 || r.top < -0.5 || r.right > vw + 0.5 || r.bottom > vh + 0.5)) out.push(`off screen: ${name(b)}`);
  }
  for (let i = 0; i < buttons.length; i++) {
    for (let j = i + 1; j < buttons.length; j++) {
      const a = buttons[i];
      const b = buttons[j];
      // Pins are round and kept 50 px apart; their square boxes may touch at the corners.
      if (a.contains(b) || b.contains(a) || (a.classList.contains('th-pin') && b.classList.contains('th-pin'))) continue;
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      // A pin the map has panned mostly off the screen (its centre is outside it) is not there to touch.
      const rim = 15; // the pin's disc is 30 px across: with its centre this close to the edge, half of it is out of sight
      const centreOff = (r: DOMRect): boolean => (r.left + r.right) / 2 < rim || (r.top + r.bottom) / 2 < rim || (r.left + r.right) / 2 > vw - rim || (r.top + r.bottom) / 2 > vh - rim;
      if ((a.classList.contains('th-pin') && centreOff(ra)) || (b.classList.contains('th-pin') && centreOff(rb))) continue;
      if (w > 3 && h > 3) out.push(`overlap: ${name(a)} x ${name(b)}`);
    }
  }
  for (const el of document.querySelectorAll('*')) {
    const he = el as HTMLElement;
    if (el.tagName === 'CANVAS' || el.closest('svg') || el.classList.contains('th-map-title') || 'scroll' in (he.dataset ?? {}) || !visible(el)) continue;
    if (['th-card-obj', 'th-screen', 'th-map', 'th-hud', 'th-tbtn', 'th-tbtn-win', 'th-sbtn', 'th-fbtn'].some((c) => el.classList.contains(c))) continue;
    const cs = getComputedStyle(el);
    const hidesX = cs.overflowX === 'hidden' || cs.overflowX === 'clip';
    const hidesY = cs.overflowY === 'hidden' || cs.overflowY === 'clip';
    if ((hidesX && he.scrollWidth > he.clientWidth + 1) || (hidesY && he.scrollHeight > he.clientHeight + 1)) out.push(`text cut off: ${name(el)}`);
  }
  return out;
}

async function expectClean(page: Page, label: string): Promise<void> {
  await page.waitForTimeout(450);
  expect(await page.evaluate(problemsOnScreen), label).toEqual([]);
}

/** Wait until the screens that were leaving have left the page. */
async function settled(page: Page): Promise<void> {
  await expect(page.locator('.th-screen.is-out')).toHaveCount(0);
}

test.describe('menus and HUD at every phone size', () => {
  for (const [w, h] of SIZES) {
    test.describe(`${w}x${h}`, () => {
      test.use({ viewport: { width: w, height: h } });

      test('every screen is touchable, whole and uncluttered', async ({ page }) => {
        await farSave(page);
        await open(page);
        await expectClean(page, 'title');
        await tap(page, 'settings');
        await settled(page);
        await expectClean(page, 'settings');
        await tapIn(page, 'settings', 'back');
        await settled(page);
        await tap(page, 'play');
        await settled(page);
        await expectClean(page, 'campaign');
        await tapIn(page, 'campaign', 'quartermaster');
        await settled(page);
        await expectClean(page, 'quartermaster');
        if (w === 844) await shot(page, `polish-qm-${w}`);
        await tapIn(page, 'quartermaster', 'back');
        await settled(page);
        for (const id of [1001, 1004]) {
          await page.getByTestId(`mission-pin-${id}`).evaluate((el) => (el as HTMLElement).click());
          await tapIn(page, 'campaign', 'mission-start');
          await settled(page);
          await page.waitForTimeout(2800);
          await expectClean(page, `briefing ${id}`);
          if (w === 844 && id === 1004) await shot(page, 'polish-briefing-844');
          await tapIn(page, 'briefing', 'back');
          await settled(page);
        }
        // The battle HUD, the pause menu and the tutorial tip, on a mission with a support (so the left column is used).
        await page.getByTestId('mission-pin-1006').evaluate((el) => (el as HTMLElement).click());
        await tapIn(page, 'campaign', 'mission-start');
        await settled(page);
        await tapIn(page, 'briefing', 'begin');
        await expect(page.getByTestId('order-advance')).toBeVisible({ timeout: 20_000 });
        await expect(page.getByTestId('tip')).toBeVisible({ timeout: 20_000 });
        await expectClean(page, 'battle with a tip');
        await tap(page, 'pause');
        await expect.poll(async () => (await state(page)).paused).toBe(true);
        await expectClean(page, 'pause menu');
        if (w === 568) await shot(page, 'polish-pause-568');
      });
    });
  }
});

test.describe('the briefing', () => {
  test('runs past the screen, says so, and scrolls with a finger and with the wheel', async ({ page }) => {
    await farSave(page);
    await open(page);
    await tap(page, 'play');
    await settled(page);
    await page.getByTestId('mission-pin-1004').evaluate((el) => (el as HTMLElement).click());
    await tapIn(page, 'campaign', 'mission-start');
    await settled(page);
    await page.waitForTimeout(2800);

    const sheet = page.locator('.th-screen.is-in[data-screen="briefing"] .th-sheet');
    const wrap = page.locator('.th-screen.is-in[data-screen="briefing"] .th-scrollwrap.is-paper');
    const scrollTop = (): Promise<number> => sheet.evaluate((el) => el.scrollTop);
    const room = (): Promise<number> => sheet.evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop);

    expect(await room(), 'the third paragraph is below the fold at 844x390').toBeGreaterThan(40);
    await expect(wrap).toHaveAttribute('data-more', 'true');
    await expect(wrap.locator('.th-scrollcue')).toBeVisible();
    await shot(page, 'polish-briefing-cue');

    // A finger drags the paper up.
    const box = await sheet.boundingBox();
    if (!box) throw new Error('no sheet');
    const x = box.x + box.width / 2;
    await touchDrag(page, { x, y: box.y + box.height - 40 }, { x, y: box.y + 40 }, 12);
    await expect.poll(scrollTop).toBeGreaterThan(60);

    // The wheel scrolls it too, to the end, and the cue goes away.
    await page.mouse.move(x, box.y + box.height / 2);
    for (let i = 0; i < 6; i++) await page.mouse.wheel(0, 400);
    await expect.poll(room).toBeLessThanOrEqual(4);
    await expect(wrap).toHaveAttribute('data-more', 'false');
    await shot(page, 'polish-briefing-end');

    // The Begin button stays put the whole time.
    await expect(page.getByTestId('begin')).toBeVisible();
  });

  test('shows no cue when everything fits', async ({ page }) => {
    await farSave(page);
    await open(page);
    await tap(page, 'play');
    await settled(page);
    await page.getByTestId('mission-pin-1001').evaluate((el) => (el as HTMLElement).click());
    await tapIn(page, 'campaign', 'mission-start');
    await settled(page);
    await page.waitForTimeout(2800);
    await expect(page.locator('.th-screen.is-in[data-screen="briefing"] .th-scrollwrap.is-paper')).toHaveAttribute('data-more', 'false');
  });
});

/** Count every time the UI is told to show a screen (the root's data-screen is set each time), from now on. */
async function watchScreens(page: Page): Promise<void> {
  await page.evaluate(() => {
    const seen: string[] = [];
    Reflect.set(window, '__screens', seen);
    const root = document.getElementById('ui');
    if (!root) throw new Error('no #ui');
    new MutationObserver((records) => {
      for (const r of records) if (r.attributeName === 'data-screen') seen.push(root.dataset.screen ?? '');
    }).observe(root, { attributes: true, attributeFilter: ['data-screen'] });
  });
}

const shown = (page: Page): Promise<string[]> => page.evaluate(() => [...(Reflect.get(window, '__screens') as string[])]);

/** Two real taps on the same spot, as fast as the browser will deliver them. */
async function doubleTap(page: Page, testId: string, screen?: string): Promise<void> {
  const target = screen ? arrived(page, screen).getByTestId(testId) : page.getByTestId(testId);
  const box = await target.boundingBox();
  if (!box) throw new Error(`${testId} is not on screen`);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.touchscreen.tap(x, y);
  await page.touchscreen.tap(x, y);
}

test.describe('rapid taps', () => {
  test('never navigate or start a battle twice', async ({ page }) => {
    await farSave(page);
    await open(page);
    await watchScreens(page);

    await doubleTap(page, 'play');
    await page.waitForTimeout(500);
    expect(await shown(page)).toEqual(['campaign']);
    await expect(page.locator('.th-screen[data-screen="campaign"]')).toHaveCount(1);

    await page.getByTestId('mission-pin-1002').evaluate((el) => (el as HTMLElement).click());
    await doubleTap(page, 'mission-start', 'campaign');
    await page.waitForTimeout(500);
    expect(await shown(page)).toEqual(['campaign', 'briefing']);
    await expect(page.locator('.th-screen[data-screen="briefing"]')).toHaveCount(1);

    await doubleTap(page, 'begin', 'briefing');
    await expect.poll(async () => (await state(page)).screen).toBe('battle');
    await page.waitForTimeout(500);
    expect(await shown(page)).toEqual(['campaign', 'briefing', 'battle']);
    // The second tap landed where the Advance button now is: it must not have given an order.
    expect((await state(page)).order).toBe('hold');
    expect((await state(page)).queue.rifle).toBe(0);

    // Pause, then Restart twice: one new battle.
    await tap(page, 'pause');
    await expect.poll(async () => (await state(page)).paused).toBe(true);
    await expect(page.getByTestId('restart')).toBeVisible();
    await doubleTap(page, 'restart');
    await expect.poll(async () => (await state(page)).paused).toBe(false);
    await page.waitForTimeout(500);
    expect((await shown(page)).filter((s) => s === 'battle').length).toBe(2);
    expect((await state(page)).time).toBeLessThan(8);

    // Pause, then Quit twice: one return to the map.
    await tap(page, 'pause');
    await expect.poll(async () => (await state(page)).paused).toBe(true);
    await expect(page.getByTestId('quit')).toBeVisible();
    await doubleTap(page, 'quit');
    await expect.poll(async () => (await state(page)).screen).toBe('campaign');
    await page.waitForTimeout(500);
    const tail = (await shown(page)).slice(-3);
    expect(tail.filter((s) => s === 'campaign').length).toBeLessThanOrEqual(1);
    await expect(page.locator('.th-screen[data-screen="campaign"]')).toHaveCount(1);
  });

  test('buy exactly one level for each tap on a Quartermaster button, however fast the taps come', async ({ page }) => {
    await farSave(page);
    await open(page);
    await tap(page, 'play');
    await settled(page);
    await tapIn(page, 'campaign', 'quartermaster');
    await settled(page);

    const level = (id: string): Promise<number> => arrived(page, 'quartermaster').getByTestId(`upgrade-buy-${id}`).locator('xpath=ancestor::article').getAttribute('data-level').then(Number);
    const points = async (): Promise<number> => Number(await arrived(page, 'quartermaster').getByTestId('points-available').textContent());
    const startLevel = await level('hqGun');
    const startPoints = await points();
    expect(startPoints).toBeGreaterThanOrEqual(3);

    // One tap: one level and one point, not two (the list is rebuilt under the finger by the purchase).
    await tapIn(page, 'quartermaster', 'upgrade-buy-hqGun');
    await page.waitForTimeout(600);
    expect(await level('hqGun')).toBe(startLevel + 1);
    expect(await points()).toBe(startPoints - 1);

    // Two quick taps are two deliberate purchases, and refunds are free, so a slip costs nothing.
    await doubleTap(page, 'upgrade-refund-hqGun', 'quartermaster');
    await page.waitForTimeout(600);
    expect(await level('hqGun')).toBe(startLevel);
    expect(await points()).toBe(startPoints);
  });
  test('start a battle once from the result screen', async ({ page }) => {
    await farSave(page);
    await open(page);
    await startMission(page, 1002, 5);
    await expect.poll(async () => (await state(page)).screen).toBe('battle');
    // An idle army loses: fast-forward to the result screen.
    await page.evaluate(() => ((window as unknown as { __TH: { setTimeScale(n: number): void } }).__TH).setTimeScale(240));
    await expect.poll(async () => (await state(page)).screen, { timeout: 150_000 }).toBe('result');
    await page.evaluate(() => ((window as unknown as { __TH: { setTimeScale(n: number): void } }).__TH).setTimeScale(1));
    await page.waitForTimeout(600);
    await watchScreens(page);
    await doubleTap(page, 'result-retry', 'result');
    await expect.poll(async () => (await state(page)).screen).toBe('battle');
    await page.waitForTimeout(500);
    expect(await shown(page)).toEqual(['battle']);
  });
});

// The first mission's start, for the pictures of the finished tutorial tip layout at the smallest size.
test('the first tutorial tip on the smallest phone', async ({ page }) => {
  await page.setViewportSize({ width: 568, height: 320 });
  await open(page);
  await playThroughMenus(page, 1001, false);
  await expect(page.getByTestId('tip')).toBeVisible({ timeout: 20_000 });
  await shot(page, 'polish-tip-568');
});
