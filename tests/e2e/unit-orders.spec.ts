/**
 * Orders per unit kind, on the production build in a phone-sized landscape viewport with touch: the "Orders for"
 * chip, its picker and the order buttons are real taps; the debug hooks only start the proving ground, grant
 * supplies and population, set the time scale and read the sim back. Pictures go to docs/screenshots/unit-orders-*.png.
 */
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { SHOT_DIR, buttonRects, expect, grantPopulation, grantSupplies, open, openCallIns, setTimeScale, startSandbox, state, tap, test, units } from './helpers';

const SIZES = [
  { w: 568, h: 320 },
  { w: 667, h: 375 },
  { w: 844, h: 390 },
  { w: 932, h: 430 },
] as const;

/** World x of the foremost living player unit of this kind on the field (not inside the HQ). */
async function foremost(page: Page, kind: 'rifle' | 'lmg'): Promise<number> {
  let best = -Infinity;
  for (const u of await units(page)) if (u.side === 0 && u.kind === kind && !u.inside) best = Math.max(best, u.x);
  return best;
}

async function snap(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(250);
  await page.screenshot({ path: join(SHOT_DIR, `unit-orders-${name}.png`) });
}

type Rect = { x: number; y: number; w: number; h: number };
const apart = (a: Rect, b: Rect): boolean => a.x + a.w <= b.x + 0.5 || b.x + b.w <= a.x + 0.5 || a.y + a.h <= b.y + 0.5 || b.y + b.h <= a.y + 0.5;
const rectOf = (page: Page, selector: string) =>
  page.evaluate((sel) => {
    const r = document.querySelector(sel)?.getBoundingClientRect();
    return r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
  }, selector);

/** The order plate's controls are big enough, never overlap each other or the training bar, and the picker (if open) fits. */
async function checkLayout(page: Page, size: { w: number; h: number }, pickerOpen: boolean): Promise<void> {
  const rects = await buttonRects(page);
  const names = ['order-scope', 'order-fallBack', 'order-hold', 'order-advance', 'order-follow'];
  for (const n of names) {
    const r = rects[n];
    expect(r, `${n} shown at ${size.w}x${size.h}`).toBeTruthy();
    expect(Math.min(r.w, r.h), `${n} is a big enough target`).toBeGreaterThanOrEqual(48);
    expect(r.x + r.w, `${n} on screen`).toBeLessThanOrEqual(size.w);
    expect(r.y + r.h).toBeLessThanOrEqual(size.h);
  }
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) expect(apart(rects[names[i]], rects[names[j]]), `${names[i]} / ${names[j]}`).toBe(true);
  }
  const bar = await rectOf(page, '.th-trainwrap');
  if (!bar) throw new Error('no training bar');
  expect(bar.w, 'the training bar keeps room for a unit button').toBeGreaterThanOrEqual(54);
  expect(bar.x + bar.w, 'the training bar stays left of the orders').toBeLessThanOrEqual(rects['order-scope'].x);
  if (!pickerOpen) return;
  const picker = rects['scope-picker'];
  expect(picker, 'picker shown').toBeTruthy();
  expect(picker.y + picker.h, 'the picker sits above the bottom bar').toBeLessThanOrEqual(rects['order-hold'].y);
  expect(picker.y).toBeGreaterThanOrEqual(0);
  expect(picker.x).toBeGreaterThanOrEqual(0);
  // The call-ins (opened before the picker) stay clear of it: the toggle and every button of the open column.
  for (const k of ['callins', 'support-artillery', 'support-smoke', 'support-airStrike']) {
    expect(rects[k], `${k} shown`).toBeTruthy();
    expect(apart(picker, rects[k]), `the picker leaves ${k} clear`).toBe(true);
  }
  const picks = Object.keys(rects).filter((k) => k.startsWith('scope-') && k !== 'scope-picker');
  expect(picks.length, 'All units plus the nine trainable kinds').toBe(10);
  for (const k of picks) {
    const r = rects[k];
    expect(Math.min(r.w, r.h), `${k} is a big enough target`).toBeGreaterThanOrEqual(48);
    expect(r.y >= picker.y - 0.5 && r.y + r.h <= picker.y + picker.h + 0.5, `${k} fully inside the picker`).toBe(true);
  }
}

test('Bren gunners hold on their own orders while the riflemen advance, then follow the army again', async ({ page, problems }) => {
  await open(page);
  expect(await startSandbox(page, 11)).toBe(true);
  await expect.poll(async () => (await state(page)).screen, { timeout: 20_000 }).toBe('battle');
  await expect(page.getByTestId('order-scope')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('order-follow')).toBeHidden();
  await grantSupplies(page, 5000);
  await grantPopulation(page, 40);

  // Train riflemen and Bren gunners with real taps.
  for (let i = 0; i < 2; i++) {
    await tap(page, 'train-rifle');
    await tap(page, 'train-lmg');
  }
  await setTimeScale(page, 3);
  await expect.poll(async () => (await state(page)).queue.lmg, { timeout: 60_000 }).toBe(0);

  // Army-wide Advance, then Bren gunners alone: chip, picker, Hold.
  await tap(page, 'order-advance');
  await expect.poll(async () => (await state(page)).order).toBe('advance');
  await tap(page, 'order-scope');
  await expect(page.getByTestId('scope-picker')).toBeVisible();
  await tap(page, 'scope-lmg');
  await expect(page.getByTestId('scope-picker')).toBeHidden();
  await expect(page.getByTestId('order-scope')).toContainText(/bren/i);
  await expect(page.getByTestId('order-follow')).toBeVisible();
  await expect(page.getByTestId('order-follow')).toHaveClass(/is-active/);
  await tap(page, 'order-hold');
  await expect.poll(async () => (await state(page)).kindOrders.lmg).toBe('hold');
  const s = await state(page);
  expect(s.order, 'the army order is untouched').toBe('advance');
  expect(s.kindOrders.rifle).toBeNull();
  await expect(page.getByTestId('order-hold')).toHaveClass(/is-active/);
  await expect(page.getByTestId('order-advance')).not.toHaveClass(/is-active/);
  await expect(page.getByTestId('train-lmg')).toHaveClass(/has-order/);
  await expect(page.getByTestId('train-rifle')).not.toHaveClass(/has-order/);

  const trench = (await state(page)).trenches.find((t) => t.id === 1);
  if (!trench) throw new Error('the proving ground has a British trench 1');
  await expect
    .poll(async () => (await foremost(page, 'rifle')) - trench.x, { timeout: 60_000, message: 'riflemen advance' })
    .toBeGreaterThan(400);
  expect((await foremost(page, 'lmg')) - trench.x, 'Bren gunners hold the line').toBeLessThan(150);

  // Pictures and layout at two phone sizes: scope active with the badge, then the picker open.
  await setTimeScale(page, 0.2);
  for (const size of [SIZES[2], SIZES[0]]) {
    await page.setViewportSize({ width: size.w, height: size.h });
    await snap(page, `bren-${size.w}x${size.h}`);
    await openCallIns(page);
    await tap(page, 'order-scope');
    await expect(page.getByTestId('scope-picker')).toBeVisible();
    await snap(page, `picker-${size.w}x${size.h}`);
    await checkLayout(page, size, true);
    // Escape closes it, and so does a press outside it.
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('scope-picker')).toBeHidden();
    await tap(page, 'order-scope');
    await expect(page.getByTestId('scope-picker')).toBeVisible();
    const supplies = await rectOf(page, '[data-tip="supplies"]');
    if (!supplies) throw new Error('no supplies plate');
    await page.touchscreen.tap(supplies.x + supplies.w / 2, supplies.y + supplies.h / 2);
    await expect(page.getByTestId('scope-picker')).toBeHidden();
  }
  for (const size of [SIZES[1], SIZES[3]]) {
    await page.setViewportSize({ width: size.w, height: size.h });
    await page.waitForTimeout(250);
    await checkLayout(page, size, false);
    await openCallIns(page);
    await tap(page, 'order-scope');
    await checkLayout(page, size, true);
    await page.keyboard.press('Escape');
  }
  await page.setViewportSize({ width: SIZES[2].w, height: SIZES[2].h });

  // Follow army: the Bren gunners take up the army's Advance.
  await setTimeScale(page, 3);
  await tap(page, 'order-follow');
  await expect.poll(async () => (await state(page)).kindOrders.lmg).toBeNull();
  await expect(page.getByTestId('order-advance')).toHaveClass(/is-active/);
  await expect(page.getByTestId('train-lmg')).not.toHaveClass(/has-order/);
  await expect
    .poll(async () => (await foremost(page, 'lmg')) - trench.x, { timeout: 60_000, message: 'Bren gunners advance' })
    .toBeGreaterThan(300);

  // Back to army-wide orders: the chip reads All and Follow army goes away.
  await tap(page, 'order-scope');
  await tap(page, 'scope-all');
  await expect(page.getByTestId('order-scope')).toContainText(/all/i);
  await expect(page.getByTestId('order-follow')).toBeHidden();
  expect((await state(page)).order).toBe('advance');
  expect(problems, 'no console errors').toEqual([]);
});
