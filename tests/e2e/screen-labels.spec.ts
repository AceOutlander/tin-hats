/**
 * Every label fits, beyond the unit buttons (the sweep, 2026-11-09: "cut-off labels"; it found the Shop's "UNLOCKED"
 * running out of its button and the campaign card's stamp lying over "Stalingrad"). At 667x375, 844x390 and 932x430,
 * in the built game with every Stalingrad mission cleared (so the Shop, the Quartermaster and the HUD are full):
 * the text of every order button, call-in button, unit button, Shop and Quartermaster card and button, the briefing
 * sheet's headings, objective and loadout, the map's mission card and the campaign cards lies wholly inside its box;
 * no two controls of a card overlap; and in the battle the unit tray never runs under the order buttons (mission 1006,
 * the most units). The unit-name labels themselves are tests/e2e/hud-labels.spec.ts.
 */
import type { Page } from '@playwright/test';
import { arrived, BATTLE_LOAD_MS, expect, open, tap, tapIn, test, type Hooked } from './helpers';

const SIZES = [
  { width: 667, height: 375 },
  { width: 844, height: 390 },
  { width: 932, height: 430 },
] as const;

async function fullSave(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (window.localStorage.getItem('tinhats.save') !== null) return;
    const cleared: Record<string, string[]> = {};
    for (let i = 1001; i <= 1010; i++) cleared[String(i)] = ['normal'];
    window.localStorage.setItem(
      'tinhats.save',
      JSON.stringify({
        version: 10,
        cleared,
        upgrades: { sapperDrill: 1, hqIncome: 2 },
        medals: 400,
        armoury: [],
        wins: {},
        lastMission: 1009,
        training: { done: true, skipped: false },
        settings: { muted: true, difficulty: 'normal', hints: false },
      }),
    );
  });
}

/**
 * Runs in the page: every element matching the selectors (and on screen) whose text runs outside its own box, with
 * the overshoot in px. The text's extent is measured with a Range over its text, so a label that spills out of a
 * button whose overflow is visible is caught as well as one that is clipped.
 */
function spills(selectors: string[]): string[] {
  const out: string[] = [];
  const shown = (el: Element): boolean => {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    for (let n: Element | null = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0 || n.classList.contains('is-out')) return false;
    }
    return true;
  };
  for (const sel of selectors) {
    for (const el of document.querySelectorAll(sel)) {
      if (!shown(el) || (el.textContent ?? '').trim() === '') continue;
      const box = el.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(el);
      let left = Infinity;
      let right = -Infinity;
      let top = Infinity;
      let bottom = -Infinity;
      for (const r of range.getClientRects()) {
        if (r.width === 0 || r.height === 0) continue;
        left = Math.min(left, r.left);
        right = Math.max(right, r.right);
        top = Math.min(top, r.top);
        bottom = Math.max(bottom, r.bottom);
      }
      if (left === Infinity) continue;
      const over = Math.max(box.left - left, right - box.right, box.top - top, bottom - box.bottom);
      // Clipped text (overflow hidden) shows as text wider than the element's own scroll box.
      const he = el as HTMLElement;
      const clipped = Math.max(he.scrollWidth - he.clientWidth, 0);
      if (over > 1.5 || (clipped > 1 && getComputedStyle(el).overflowX !== 'visible')) {
        out.push(`${sel} "${(el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 30)}": ${Math.max(over, clipped).toFixed(1)} px outside`);
      }
    }
  }
  return out;
}

/** Runs in the page: pairs of elements (by selector) that overlap by more than 2 px each way. */
function overlaps(pairs: Array<[string, string]>): string[] {
  const out: string[] = [];
  for (const [a, b] of pairs) {
    for (const ea of document.querySelectorAll(a)) {
      for (const eb of document.querySelectorAll(b)) {
        if (ea === eb || ea.contains(eb) || eb.contains(ea)) continue;
        const ra = ea.getBoundingClientRect();
        const rb = eb.getBoundingClientRect();
        if (ra.width === 0 || rb.width === 0) continue;
        const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
        const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
        if (w > 2 && h > 2) out.push(`${a} "${(ea.textContent ?? '').trim().slice(0, 20)}" x ${b} "${(eb.textContent ?? '').trim().slice(0, 20)}"`);
      }
    }
  }
  return out;
}

/**
 * Runs in the page: unit buttons that show over the order buttons. A button the tray has scrolled out of sight is
 * clipped by the tray, so only the part inside the tray's own box counts.
 */
function trayOverOrders(): string[] {
  const tray = document.querySelector('.th-train');
  const orders = [...document.querySelectorAll('[data-testid^="order-"]')];
  if (!tray) return ['no unit tray'];
  const clip = tray.getBoundingClientRect();
  const out: string[] = [];
  for (const b of tray.querySelectorAll('button')) {
    const r = b.getBoundingClientRect();
    const left = Math.max(r.left, clip.left);
    const right = Math.min(r.right, clip.right);
    if (right - left <= 0) continue;
    for (const o of orders) {
      const q = o.getBoundingClientRect();
      if (q.width === 0) continue;
      const w = Math.min(right, q.right) - Math.max(left, q.left);
      const h = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top);
      if (w > 1 && h > 1) out.push(`${(b as HTMLElement).dataset.testid ?? 'unit button'} over ${(o as HTMLElement).dataset.testid}`);
    }
  }
  // The tray's own box must end before the orders begin.
  for (const o of orders) {
    const q = o.getBoundingClientRect();
    if (q.width === 0) continue;
    const w = Math.min(clip.right, q.right) - Math.max(clip.left, q.left);
    const h = Math.min(clip.bottom, q.bottom) - Math.max(clip.top, q.top);
    if (w > 1 && h > 1) out.push(`the tray runs under ${(o as HTMLElement).dataset.testid}`);
  }
  return out;
}

const settled = (page: Page) => expect(page.locator('.th-screen.is-out')).toHaveCount(0);

for (const size of SIZES) {
  test.describe(`labels at ${size.width}x${size.height}`, () => {
    test.use({ viewport: size });

    test('menus: campaign cards, map card, briefing, Shop and Quartermaster', async ({ page, problems }) => {
      await fullSave(page);
      await open(page);
      await tap(page, 'play');
      await settled(page);
      expect(await page.evaluate(spills, ['.th-camp-name', '.th-camp-dates', '.th-camp-stamp', '.th-camp-count']), 'campaign cards').toEqual([]);
      expect(await page.evaluate(overlaps, [['.th-camp-name', '.th-camp-stamp']] as Array<[string, string]>), 'campaign card name and stamp').toEqual([]);
      await tapIn(page, 'campaigns', 'campaign-stalingrad');
      await expect(arrived(page, 'campaign')).toBeVisible();
      await settled(page);
      for (const id of [1001, 1003, 1009]) {
        await page.getByTestId(`mission-pin-${id}`).evaluate((el) => (el as HTMLElement).click());
        await page.waitForTimeout(400);
        expect(await page.evaluate(spills, ['.th-screen.is-in[data-screen="campaign"] button']), `map card ${id}`).toEqual([]);
        await tapIn(page, 'campaign', 'mission-start');
        await settled(page);
        await page.waitForTimeout(2800);
        const brief = '.th-screen.is-in[data-screen="briefing"]';
        expect(
          await page.evaluate(spills, [`${brief} .th-sheet-no`, `${brief} .th-stamp`, `${brief} .th-sheet-meta`, `${brief} .th-objective`, `${brief} .th-intel-label`, `${brief} button`]),
          `briefing ${id}`,
        ).toEqual([]);
        expect(await page.evaluate(overlaps, [[`${brief} .th-sheet-no`, `${brief} .th-stamp`], [`${brief} .th-load-chip`, `${brief} .th-load-chip`]] as Array<[string, string]>), `briefing ${id}`).toEqual([]);
        await tapIn(page, 'briefing', 'back');
        await settled(page);
      }
      await tapIn(page, 'campaign', 'armoury');
      await settled(page);
      const shop = '.th-screen.is-in[data-screen="armoury"]';
      expect(await page.evaluate(spills, [`${shop} .th-up-name`, `${shop} button`, `${shop} .th-btn-label`, `${shop} .th-btn-sub`]), 'Shop').toEqual([]);
      expect(await page.evaluate(overlaps, [[`${shop} .th-up-text`, `${shop} .th-up-side`]] as Array<[string, string]>), 'Shop cards').toEqual([]);
      await tapIn(page, 'armoury', 'back');
      await settled(page);
      await tapIn(page, 'campaign', 'quartermaster');
      await settled(page);
      const qm = '.th-screen.is-in[data-screen="quartermaster"]';
      expect(await page.evaluate(spills, [`${qm} .th-up-name`, `${qm} .th-group`, `${qm} button`, `${qm} .th-btn-label`]), 'Quartermaster').toEqual([]);
      expect(await page.evaluate(overlaps, [[`${qm} .th-up-text`, `${qm} .th-up-side`]] as Array<[string, string]>), 'Quartermaster cards').toEqual([]);
      expect(problems).toEqual([]);
    });

    test('battle: order, call-in and unit buttons fit, and the tray stays clear of the orders', async ({ page, problems }) => {
      await fullSave(page);
      await open(page);
      await page.evaluate(() => (window as unknown as Hooked).__TH?.startStalingrad(1006, 'normal', 1));
      await expect(page.getByTestId('order-advance')).toBeVisible({ timeout: BATTLE_LOAD_MS });
      await page.waitForTimeout(800);
      await tap(page, 'callins');
      await expect(page.getByTestId('callins-column')).toBeVisible();
      await page.waitForTimeout(400);
      expect(
        await page.evaluate(spills, ['[data-testid^="order-"]', '[data-testid^="support-"]', '.th-sbtn-name', '.th-tbtn-name', '.th-tbtn-price', '[data-testid="deploy-at"]']),
        'HUD buttons',
      ).toEqual([]);
      expect(await page.evaluate(trayOverOrders), 'the unit tray and the orders').toEqual([]);
      expect(problems).toEqual([]);
    });
  });
}
