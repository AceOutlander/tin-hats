/**
 * Every label fits, beyond the unit buttons (the sweep, 2026-11-09: "cut-off labels"; it found the Shop's "UNLOCKED"
 * running out of its button and the campaign card's stamp lying over "Stalingrad"). At 667x375, 844x390 and 932x430,
 * in the built game with every Stalingrad mission cleared (so the Shop, the Quartermaster and the HUD are full):
 * the text of every order button, call-in button, unit button, Shop and Quartermaster card and button, the briefing
 * sheet's headings, objective and loadout, the map's mission card and the campaign cards lies wholly inside its box;
 * no two controls of a card overlap; and in the battle the unit tray never runs under the order buttons (mission 1006,
 * the most units). The unit-name labels themselves are tests/e2e/hud-labels.spec.ts.
 * The Shop's store section (a platform's; the website has none) is checked the same way with a stand-in store
 * (tests/e2e/fake-store.ts): every word of it inside its box, no button over its card's text, nothing wider than the
 * list, in every state an offer can show.
 * The battle is checked a second time with one more unit in the tray: a made-up extra unit standing in for a
 * platform's (tests/e2e/fake-extra-unit.ts; the website has none), its button scrolled into view.
 */
import type { Page } from '@playwright/test';
import { FAKE_EXTRA, installFakeExtraUnit } from './fake-extra-unit';
import { FAKE_STORE, installFakeStore } from './fake-store';
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
      // Sideways the text must stay inside; up and down a line box may stand a few px proud of a tight label (its
      // leading), so only more than that counts.
      const overX = Math.max(box.left - left, right - box.right);
      const overY = Math.max(box.top - top, bottom - box.bottom) - 3;
      const over = Math.max(overX, overY);
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
        expect(await page.evaluate(spills, ['.th-screen.is-in[data-screen="campaign"] button:not(.th-pin)']), `map card ${id}`).toEqual([]);
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

    test('the Shop with a store section: every offer, its states and the small print fit', async ({ page, problems }) => {
      await fullSave(page);
      await open(page);
      await installFakeStore(page);
      await tap(page, 'play');
      await settled(page);
      await tapIn(page, 'campaigns', 'campaign-stalingrad');
      await expect(arrived(page, 'campaign')).toBeVisible();
      await settled(page);
      await tapIn(page, 'campaign', 'armoury');
      await settled(page);
      const shop = '.th-screen.is-in[data-screen="armoury"]';
      const section = page.getByTestId('store-section');
      await expect(section.getByTestId('store-buy-five')).toBeVisible();
      const check = async (when: string): Promise<void> => {
        const words = ['.th-up-name', '.th-up-desc', 'button', '.th-btn-label', '.th-btn-sub', '.th-group', '.th-store-msg', '.th-store-status', '.th-store-note'];
        expect(await page.evaluate(spills, words.map((w) => `${shop} ${w}`)), `Shop with a store, ${when}`).toEqual([]);
        const pairs: Array<[string, string]> = [
          [`${shop} .th-up-text`, `${shop} .th-up-side`],
          [`${shop} .th-store-offer`, `${shop} .th-store-offer`],
          [`${shop} .th-store-offer`, `${shop} .th-store-note`],
          [`${shop} .th-store-offer`, `${shop} .th-store-msg`],
        ];
        expect(await page.evaluate(overlaps, pairs), `Shop cards, ${when}`).toEqual([]);
        // Nothing of the section is wider than the list it sits in, and the list does not scroll sideways.
        const width = await page.evaluate(() => {
          const list = document.querySelector('.th-screen.is-in[data-screen="armoury"] .th-qm-list') as HTMLElement;
          const box = list.getBoundingClientRect();
          const wide = [...list.querySelectorAll('.th-store, .th-store *')].filter((n) => {
            const r = n.getBoundingClientRect();
            return r.width > 0 && (r.left < box.left - 1 || r.right > box.right + 1);
          }).length;
          return { wide, sideways: list.scrollWidth - list.clientWidth };
        });
        expect(width, `store section width, ${when}`).toEqual({ wide: 0, sideways: 0 });
      };
      await check('idle');
      // Every state at once: one done, four failed, five owned, three pending.
      await tapIn(page, 'armoury', 'store-buy-one');
      await expect(section.getByTestId('store-status-one')).toHaveText(FAKE_STORE.done);
      await tapIn(page, 'armoury', 'store-buy-four');
      await expect(section.getByTestId('store-status-four')).toHaveText(FAKE_STORE.failed);
      await tapIn(page, 'armoury', 'store-buy-five');
      await expect(section.getByTestId('store-buy-five')).toHaveText('Owned');
      await tapIn(page, 'armoury', 'store-buy-three');
      await expect(section.getByTestId('store-status-three')).toHaveText(FAKE_STORE.pending);
      await check('with every state showing');
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
        await page.evaluate(spills, ['[data-testid^="order-"]', '[data-testid^="support-"]', '.th-sbtn-name', '.th-obj-text', '.th-obj-phase', '.th-tbtn-name', '.th-tbtn-price', '[data-testid="deploy-at"]']),
        'HUD buttons',
      ).toEqual([]);
      expect(await page.evaluate(trayOverOrders), 'the unit tray and the orders').toEqual([]);
      expect(problems).toEqual([]);
    });

    test('battle with an extra unit: one more unit button fits, and the tray still stays clear of the orders', async ({ page, problems }) => {
      await installFakeExtraUnit(page);
      await fullSave(page);
      await open(page);
      await page.evaluate(() => (window as unknown as Hooked).__TH?.startStalingrad(1006, 'normal', 1));
      await expect(page.getByTestId('order-advance')).toBeVisible({ timeout: BATTLE_LOAD_MS });
      await page.waitForTimeout(800);
      const extra = page.getByTestId('train-extra');
      await expect(extra).toHaveCount(1);
      await expect(extra.locator('.th-tbtn-name')).toHaveText(FAKE_EXTRA.label);
      const selectors = ['[data-testid^="order-"]', '[data-testid^="support-"]', '.th-sbtn-name', '.th-obj-text', '.th-obj-phase', '.th-tbtn-name', '.th-tbtn-price', '[data-testid="deploy-at"]'];
      // As the battle opens (the tray at its start), then with the tray scrolled to its last button.
      expect(await page.evaluate(spills, selectors), 'HUD buttons, the tray at its start').toEqual([]);
      expect(await page.evaluate(trayOverOrders), 'the unit tray and the orders, the tray at its start').toEqual([]);
      await extra.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      const box = await extra.boundingBox();
      const tray = await page.locator('.th-train').boundingBox();
      expect(box !== null && tray !== null && box.x >= tray.x - 1 && box.x + box.width <= tray.x + tray.width + 1, 'the extra unit button is wholly inside the tray').toBe(true);
      await tap(page, 'callins');
      await expect(page.getByTestId('callins-column')).toBeVisible();
      await page.waitForTimeout(400);
      expect(await page.evaluate(spills, selectors), 'HUD buttons, the tray at its end').toEqual([]);
      expect(await page.evaluate(trayOverOrders), 'the unit tray and the orders, the tray at its end').toEqual([]);
      expect(problems).toEqual([]);
    });
  });
}
