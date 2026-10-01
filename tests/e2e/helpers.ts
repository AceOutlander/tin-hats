/**
 * Shared pieces of the browser tests: the fixture that fails a test on any
 * console error, page error or failed request, thin wrappers around the
 * window.__TH debug hooks, and the common flows (menus, a touch drag, playing
 * a battle to its end at high speed).
 */
import { expect, test as base, type Page } from '@playwright/test';
import { join, resolve } from 'node:path';
import type { DebugApi, DebugState, FieldInfo } from '../../src/app/debug';
import { APP } from '../../src/data/app';
import type { Difficulty, UnitKind } from '../../src/data/schema';

/** window.__TH as the page sees it (it is not declared globally, because a dev page declares another type). */
export type Hooked = { __TH?: DebugApi };

export const SHOT_DIR = resolve('docs', 'screenshots');
export const SAVE_KEY = 'tinhats.save';

/** A test whose page must stay clean: any console error, uncaught exception, failed request or HTTP error fails it. */
export const test = base.extend<{ problems: string[] }>({
  problems: async ({ page }, use) => {
    const problems: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') problems.push(`console error: ${m.text()}`);
    });
    page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
    page.on('requestfailed', (r) => problems.push(`request failed: ${r.url()} (${r.failure()?.errorText ?? 'unknown'})`));
    page.on('response', (r) => {
      if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`);
    });
    await use(problems);
    expect(problems, 'problems reported by the page').toEqual([]);
  },
});

export { expect };

// --- debug hook wrappers ----------------------------------------------------

export const state = (page: Page): Promise<DebugState> => page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).state());
export const camera = (page: Page) => page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).camera());
export const field = (page: Page): Promise<FieldInfo | null> => page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).field());
export const audioStats = (page: Page) => page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).audio());
export const weatherStats = (page: Page) => page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).weatherStats());
export const setTimeScale = (page: Page, n: number) => page.evaluate((k) => ((window as unknown as Hooked).__TH as DebugApi).setTimeScale(k), n);
export const grantSupplies = (page: Page, n: number) => page.evaluate((k) => ((window as unknown as Hooked).__TH as DebugApi).grantSupplies(k), n);
export const lookAt = (page: Page, x: number) => page.evaluate((k) => ((window as unknown as Hooked).__TH as DebugApi).lookAt(k), x);
export const startMission = (page: Page, id: number, seed?: number, difficulty?: Difficulty) =>
  page.evaluate(([k, s, d]) => ((window as unknown as Hooked).__TH as DebugApi).startMission(k, d, s), [id, seed, difficulty] as [
    number,
    number | undefined,
    Difficulty | undefined,
  ]);
export const firstUnit = (page: Page, side: 0 | 1, kind: UnitKind) =>
  page.evaluate(([s, k]) => ((window as unknown as Hooked).__TH as DebugApi).firstUnitScreenPos(s, k), [side, kind] as [0 | 1, UnitKind]);
export const savedGame = (page: Page) =>
  page.evaluate((key) => {
    const text = window.localStorage.getItem(key);
    return text === null
      ? null
      : (JSON.parse(text) as { cleared: Record<string, string[]>; settings: { muted: boolean; hints: boolean; difficulty: string } });
  }, SAVE_KEY);

/** The result text the app shows for how a battle ended. */
export function reasonText(end: DebugState): string {
  const reason = APP.reasons[end.endReason === 'none' ? 'draw' : end.endReason];
  return end.winner === 0 ? reason.win : reason.lose;
}

export async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: join(SHOT_DIR, `e2e-${name}.png`) });
}

// --- flows ------------------------------------------------------------------

export async function open(page: Page, query = '?debug=1'): Promise<void> {
  await page.goto(`/${query}`);
  await page.waitForFunction(() => (window as unknown as Hooked).__TH?.ready === true, null, { timeout: 60_000 });
}

export async function tap(page: Page, testId: string): Promise<void> {
  await page.getByTestId(testId).tap({ timeout: 10_000 });
}

/** Tap a control that may not be there any more (the battle can end between two taps). */
export async function tapIfThere(page: Page, testId: string): Promise<void> {
  try {
    await page.getByTestId(testId).tap({ timeout: 1500 });
  } catch {
    // The control is gone or covered: the battle has probably ended.
  }
}

/** Wait for a condition on the debug state, polling in real time. */
export async function waitForState(page: Page, what: string, ok: (s: DebugState) => boolean, timeoutMs = 120_000): Promise<DebugState> {
  const deadline = Date.now() + timeoutMs;
  let s = await state(page);
  while (!ok(s) && !s.over && Date.now() < deadline) {
    await page.waitForTimeout(150);
    s = await state(page);
  }
  expect(ok(s), `waiting for ${what} (tick ${s.tick}, time ${s.time.toFixed(0)} s)`).toBe(true);
  return s;
}

/**
 * Drag one finger across the screen with real touch events (a mouse drag would not prove the touch path).
 * Coordinates are CSS pixels of the viewport.
 */
export async function touchDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 10): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] });
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }],
      });
      await page.waitForTimeout(16);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await cdp.detach();
  }
}

/** Title, campaign map, briefing and into the first battle, with real taps. */
export async function playThroughMenus(page: Page, missionId: number, shots: boolean): Promise<void> {
  await expect(page.getByTestId('play')).toBeVisible();
  if (shots) await shot(page, 'title');
  await tap(page, 'play');
  await expect(page.getByTestId(`mission-pin-${missionId}`)).toBeVisible();
  await tap(page, `mission-pin-${missionId}`);
  if (shots) {
    await page.waitForTimeout(500); // let the screens finish fading
    await shot(page, 'campaign');
  }
  await tap(page, 'mission-start');
  await expect(page.getByTestId('begin')).toBeVisible();
  if (shots) {
    await page.waitForTimeout(500);
    await shot(page, 'briefing');
  }
  await tap(page, 'begin');
  await expect.poll(async () => (await state(page)).screen, { timeout: 20_000 }).toBe('battle');
  await expect(page.getByTestId('order-advance')).toBeVisible({ timeout: 20_000 });
}

/**
 * Play at a high time scale until the battle ends. `win` = a keen player: keeps buying riflemen with granted
 * supplies and sends the army forward. Otherwise the player does nothing.
 */
export async function playToEnd(page: Page, win: boolean): Promise<DebugState> {
  await setTimeScale(page, win ? 40 : APP.maxTimeScale);
  const deadline = Date.now() + 170_000;
  let s = await state(page);
  while (!s.over && Date.now() < deadline) {
    if (win) {
      await grantSupplies(page, 800);
      for (let i = 0; i < 3; i++) await tapIfThere(page, 'train-rifle');
      if (s.units[0].rifle >= 14 && s.order !== 'advance') await tapIfThere(page, 'order-advance');
    }
    await page.waitForTimeout(250);
    s = await state(page);
  }
  expect(s.over, `the battle should end (tick ${s.tick}, time ${s.time.toFixed(0)} s)`).toBe(true);
  return s;
}
