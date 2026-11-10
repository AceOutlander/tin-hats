/**
 * Play, the campaign select and the Stalingrad map in the production build, on phones in landscape with real touches
 * (owner, 2026-11-09). Play always opens the campaign select: four large cards (Stalingrad, then D-Day, Road to Berlin
 * and North Africa greyed as "Coming soon", which cannot be started), scrolling sideways when they do not fit. Tapping
 * Stalingrad opens its map, where the Shop and the Quartermaster speak the Red Army's names. Basic Training stays on
 * the title. The player never sees an internal mission id (1001…): the map markers, the mission card, the briefing and
 * the result screen show the mission number 1 to 10. No map name is covered by a marker or cut off, at a small, a
 * middle and a large phone.
 *
 * Pictures (844x390 at 2x): docs/screenshots/e2e-campaign-select.png, e2e-campaign-stalingrad-map.png,
 * e2e-campaign-stalingrad-briefing.png, e2e-campaign-armoury-soviet.png.
 */
import type { Page } from '@playwright/test';
import { arrived, BATTLE_LOAD_MS, expect, mapToTitle, open, playToEnd, shot, state, tap, tapIn, test, toMap, unlockAll } from './helpers';

/** An internal mission id as the player must never see it: 1001 to 1010 (years such as 1941 are fine). */
const INTERNAL_ID = /\b10(0[1-9]|10)\b/;

const PHONES = [
  { name: 'small phone', width: 667, height: 375 },
  { name: 'phone', width: 844, height: 390 },
  { name: 'large phone', width: 932, height: 430 },
] as const;

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const overlaps = (a: Rect, b: Rect): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** Every map name (page px) and every marker's disc and pips (page px), and the canvas the names are drawn on. */
async function mapGeometry(page: Page): Promise<{ labels: (Rect & { t: string })[]; pins: (Rect & { id: string })[]; sheet: Rect }> {
  return arrived(page, 'campaign').evaluate((screen) => {
    const canvas = screen.querySelector<HTMLCanvasElement>('.th-map-canvas');
    if (!canvas) throw new Error('no map canvas');
    const c = canvas.getBoundingClientRect();
    const placed = JSON.parse(canvas.dataset.labels ?? '[]') as { t: string; x0: number; y0: number; x1: number; y1: number }[];
    const labels = placed.map((l) => ({ t: l.t, x0: c.left + l.x0, y0: c.top + l.y0, x1: c.left + l.x1, y1: c.top + l.y1 }));
    const pins: { id: string; x0: number; y0: number; x1: number; y1: number }[] = [];
    for (const pin of screen.querySelectorAll<HTMLElement>('.th-pin')) {
      for (const part of pin.querySelectorAll<HTMLElement>('.th-pin-disc, .th-pin-pips .th-pip')) {
        const r = part.getBoundingClientRect();
        if (r.width > 0) pins.push({ id: pin.dataset.testid ?? '', x0: r.left, y0: r.top, x1: r.right, y1: r.bottom });
      }
    }
    return { labels, pins, sheet: { x0: c.left, y0: c.top, x1: c.right, y1: c.bottom } };
  });
}

test.describe('the campaign select', () => {
  for (const phone of PHONES) {
    test(`Play opens four campaign cards; only Stalingrad starts; its map shows numbers and clear names (${phone.name}, ${phone.width}x${phone.height})`, async ({ page }) => {
      await page.setViewportSize({ width: phone.width, height: phone.height });
      await open(page);

      // Basic Training stays on the main menu, not on the campaign select.
      await expect(arrived(page, 'title').getByTestId('basic-training')).toBeVisible();
      await tap(page, 'play');
      const select = arrived(page, 'campaigns');
      await expect(select).toBeVisible();
      await expect(select.getByTestId('basic-training')).toHaveCount(0);

      // Four large cards: Stalingrad, then the three to come.
      const cards = select.locator('.th-camp');
      await expect(cards).toHaveCount(4);
      const ids = await cards.evaluateAll((nodes) => nodes.map((n) => (n as HTMLElement).dataset.testid));
      expect(ids).toEqual(['campaign-stalingrad', 'campaign-dday', 'campaign-berlin', 'campaign-africa']);
      const stalingrad = select.getByTestId('campaign-stalingrad');
      await expect(stalingrad.locator('.th-camp-name')).toHaveAttribute('data-text', 'Stalingrad');
      await expect(stalingrad).toContainText('1941–1943');
      await expect(select.getByTestId('campaign-progress-stalingrad')).toHaveText('0 / 10 missions');
      await expect(stalingrad.locator('.th-camp-flag')).toHaveAttribute('data-flag', 'sovietRed');
      await expect(stalingrad).not.toHaveAttribute('aria-disabled', 'true');
      for (const [id, name, years] of [
        ['dday', 'D-Day', '1944'],
        ['berlin', 'Road to Berlin', '1944–1945'],
        ['africa', 'North Africa', '1940–1943'],
      ] as const) {
        const card = select.getByTestId(`campaign-${id}`);
        await expect(card.locator('.th-camp-name')).toHaveAttribute('data-text', name);
        await expect(card).toContainText(years);
        await expect(card).toContainText('Coming soon');
        await expect(card).toHaveAttribute('aria-disabled', 'true');
        await expect(card).toHaveClass(/is-soon/);
      }

      // Big tap targets, side by side; the row scrolls sideways when they do not fit, and the page never does.
      const boxes = await cards.evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect().toJSON() as DOMRect));
      for (const b of boxes) {
        expect(b.width).toBeGreaterThanOrEqual(220);
        expect(b.height).toBeGreaterThanOrEqual(150);
      }
      for (let i = 1; i < boxes.length; i++) expect(boxes[i].left).toBeGreaterThan(boxes[i - 1].right - 1);
      const list = select.locator('.th-campaigns-list');
      const scroll = await list.evaluate((n) => ({ sw: n.scrollWidth, cw: n.clientWidth }));
      expect(scroll.sw).toBeGreaterThan(scroll.cw);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(phone.width);
      if (phone.width === 844) {
        await page.waitForTimeout(500);
        await shot(page, 'campaign-select');
      }

      // A "Coming soon" card cannot be started: tapping it (scrolled into view) leaves the select screen up.
      await tapIn(page, 'campaigns', 'campaign-africa');
      await page.waitForTimeout(600);
      await expect(arrived(page, 'campaigns')).toBeVisible();
      await expect(page.locator('.th-screen[data-screen="campaign"]')).toHaveCount(0);

      // Stalingrad opens its map.
      await list.evaluate((n) => n.scrollTo({ left: 0 }));
      await tapIn(page, 'campaigns', 'campaign-stalingrad');
      const map = arrived(page, 'campaign');
      await expect(map.locator('.th-map')).toHaveAttribute('data-campaign', 'stalingrad');
      for (let id = 1001; id <= 1010; id++) await expect(map.getByTestId(`mission-pin-${id}`)).toBeAttached();
      await expect(map.getByTestId('mission-pin-1001').locator('.th-pin-disc')).toHaveText('1');

      // Every marker shows its number 1 to 10, never the internal id; the mission card too.
      await unlockAll(page);
      await expect(map.getByTestId('mission-pin-1010').locator('.th-pin-disc')).toHaveText('10');
      for (let n = 1; n <= 10; n++) {
        const pin = map.getByTestId(`mission-pin-${1000 + n}`);
        await expect(pin.locator('.th-pin-disc')).toHaveText(String(n));
        await expect(pin).toHaveAttribute('aria-label', new RegExp(`^Mission ${n}: `));
      }
      await tapIn(page, 'campaign', 'mission-pin-1001');
      await expect(map.locator('.th-card-no')).toHaveText('Mission 1 of 10');
      expect(await map.innerText()).not.toMatch(INTERNAL_ID);

      // No name is covered by a marker, and none is cut off at the edge of the map.
      const geo = await mapGeometry(page);
      expect(geo.labels.length).toBeGreaterThan(10);
      expect(geo.pins.length).toBeGreaterThanOrEqual(10);
      expect(geo.labels.map((l) => l.t)).toContain('Brest');
      for (const l of geo.labels) {
        const where = `${l.t} at ${phone.width}x${phone.height}`;
        expect(l.x0, where).toBeGreaterThanOrEqual(geo.sheet.x0);
        expect(l.x1, where).toBeLessThanOrEqual(geo.sheet.x1);
        expect(l.y0, where).toBeGreaterThanOrEqual(geo.sheet.y0);
        expect(l.y1, where).toBeLessThanOrEqual(geo.sheet.y1);
        for (const p of geo.pins) expect(overlaps(l, p), `${where} under ${p.id}`).toBe(false);
      }
      if (phone.width === 844) {
        await page.waitForTimeout(500);
        await shot(page, 'campaign-stalingrad-map');
      }

      // Back to the select screen, and back to the title.
      await mapToTitle(page);
    });
  }

  test('the briefing and the result screen show the mission number, never the internal id', async ({ page }) => {
    test.setTimeout(600_000);
    await open(page);
    await toMap(page);
    await tapIn(page, 'campaign', 'mission-pin-1001');
    await tapIn(page, 'campaign', 'mission-start');
    const briefing = arrived(page, 'briefing');
    await expect(briefing.locator('.th-sheet-no')).toHaveText('Combat order No. 1');
    await expect(briefing.getByTestId('briefing-intel')).toContainText('StuG III Ausf. B');
    await expect(briefing.locator('.th-new-name')).toHaveText(['DP Gunner', 'Tank Hunters']);
    expect(await briefing.innerText()).not.toMatch(INTERNAL_ID);
    await page.waitForTimeout(500);
    await shot(page, 'campaign-stalingrad-briefing');

    // A battle played to its end (a loss, the quickest): the result names "Mission 1".
    await tapIn(page, 'briefing', 'begin');
    await expect.poll(async () => (await state(page)).screen, { timeout: BATTLE_LOAD_MS }).toBe('battle');
    await playToEnd(page, false);
    const result = arrived(page, 'result');
    await expect(result).toBeVisible({ timeout: 30_000 });
    await expect(result.locator('.th-result-title')).toContainText('Mission 1 · ');
    expect(await result.innerText()).not.toMatch(INTERNAL_ID);
  });

  test('the Shop and the Quartermaster open from the Stalingrad map and speak the Red Army', async ({ page }) => {
    await open(page);
    await toMap(page);
    await tapIn(page, 'campaign', 'armoury');
    const shop = arrived(page, 'armoury');
    await expect(shop.getByTestId('armoury-item-lmg')).toContainText('DP Gunner');
    await expect(shop.getByTestId('armoury-item-katyusha')).toContainText('Katyusha Salvo');
    await expect(shop).not.toContainText('Bren');
    expect(await shop.innerText()).not.toMatch(INTERNAL_ID);
    await page.waitForTimeout(500);
    await shot(page, 'campaign-armoury-soviet');
    await tapIn(page, 'armoury', 'back');
    await tapIn(page, 'campaign', 'quartermaster');
    const qm = arrived(page, 'quartermaster');
    await expect(qm).toContainText('DP Gunner');
    await expect(qm).not.toContainText('Bren');
    await tapIn(page, 'quartermaster', 'back');
    await mapToTitle(page);
    // The title itself has no Shop or Quartermaster: they belong to a campaign.
    await expect(arrived(page, 'title').getByTestId('armoury')).toHaveCount(0);
    await expect(arrived(page, 'title').getByTestId('quartermaster')).toHaveCount(0);
  });
});
