/**
 * The campaign select screen and the Stalingrad map in the production build, on a phone in landscape with real touches
 * and with the keyboard (FOUNDATIONS.md section 6). Stalingrad is not released, so the page asks for the unreleased
 * campaigns with ?unreleased=1 (the dev server always shows them; the live site never does, and then Play goes straight
 * to the one campaign's map, as every other spec relies on).
 *
 * Pictures (844x390 at 2x): docs/screenshots/e2e-campaign-select.png, -stalingrad-map.png, -stalingrad-briefing.png.
 */
import { arrived, expect, open, shot, tap, tapIn, test, unlockAll } from './helpers';

const QUERY = '?debug=1&unreleased=1';

test.describe('campaign select', () => {
  test('offers Stalingrad then the British campaign, opens the Stalingrad map with its front line, and the briefing', async ({ page }) => {
    await open(page, QUERY);
    await tap(page, 'play');
    const select = arrived(page, 'campaigns');
    await expect(select.getByTestId('campaign-stalingrad')).toBeVisible();
    await expect(select.getByTestId('campaign-british')).toBeVisible();
    const ids = await select.locator('.th-camp').evaluateAll((nodes) => nodes.map((n) => (n as HTMLElement).dataset.testid));
    expect(ids).toEqual(['campaign-stalingrad', 'campaign-british']);
    await expect(select.getByTestId('campaign-progress-stalingrad')).toHaveText('0 / 10');
    // Both cards fit the phone's width side by side.
    const a = await select.getByTestId('campaign-stalingrad').boundingBox();
    const b = await select.getByTestId('campaign-british').boundingBox();
    expect(a && b && Math.abs(a.y - b.y) < 2 && a.x + a.width <= b.x).toBe(true);
    await shot(page, 'campaign-select');

    await tapIn(page, 'campaigns', 'campaign-stalingrad');
    const map = arrived(page, 'campaign');
    for (let id = 1001; id <= 1010; id++) await expect(map.getByTestId(`mission-pin-${id}`)).toBeAttached();
    await expect(map.locator('.th-map')).toHaveAttribute('data-campaign', 'stalingrad');
    await expect(map.locator('.th-map')).toHaveAttribute('data-front', '1941-06-22');
    await expect(map.getByTestId('mission-pin-1002')).toHaveAttribute('data-state', 'locked');
    await shot(page, 'campaign-stalingrad-map');

    // The front moves with the selected mission's date.
    await unlockAll(page);
    await tapIn(page, 'campaign', 'mission-pin-1004');
    await expect(map.locator('.th-map')).toHaveAttribute('data-front', '1941-12-05');
    await tapIn(page, 'campaign', 'mission-pin-1010');
    await expect(map.locator('.th-map')).toHaveAttribute('data-front', '1943-01-10');

    await tapIn(page, 'campaign', 'mission-pin-1001');
    await tapIn(page, 'campaign', 'mission-start');
    const briefing = arrived(page, 'briefing');
    await expect(briefing.getByTestId('briefing-intel')).toContainText('StuG III Ausf. B');
    await expect(briefing.locator('.th-new-name')).toHaveText(['DP Gunner', 'Tank Hunters']);
    await shot(page, 'campaign-stalingrad-briefing');

    // Back to the map, back to the select screen, and on to the British map.
    await tapIn(page, 'briefing', 'back');
    await tapIn(page, 'campaign', 'back');
    await tapIn(page, 'campaigns', 'campaign-british');
    await expect(arrived(page, 'campaign').locator('.th-map')).toHaveAttribute('data-campaign', 'british');
    await expect(arrived(page, 'campaign').getByTestId('mission-pin-1')).toBeVisible();
  });

  test('works with the keyboard: arrows move between the cards, Enter opens one, Escape goes back', async ({ page }) => {
    await open(page, QUERY);
    await tap(page, 'play');
    await expect(arrived(page, 'campaigns').getByTestId('campaign-stalingrad')).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(arrived(page, 'campaigns').getByTestId('campaign-british')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(arrived(page, 'campaign').locator('.th-map')).toHaveAttribute('data-campaign', 'british');
    await page.keyboard.press('Escape');
    await expect(arrived(page, 'campaigns').getByTestId('campaign-stalingrad')).toBeVisible();
  });

  test('stacks the cards when the phone is held upright, under the rotate notice, and sets them side by side again', async ({ page }) => {
    await open(page, QUERY);
    await tap(page, 'play');
    const select = arrived(page, 'campaigns');
    await expect(select.getByTestId('campaign-british')).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('rotate-overlay')).toBeVisible();
    const a = await select.getByTestId('campaign-stalingrad').boundingBox();
    const b = await select.getByTestId('campaign-british').boundingBox();
    expect(a && b && b.y >= a.y + a.height - 1 && a.x + a.width <= 390 && b.x + b.width <= 390).toBe(true);
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.getByTestId('rotate-overlay')).toBeHidden();
    const c = await select.getByTestId('campaign-stalingrad').boundingBox();
    const d = await select.getByTestId('campaign-british').boundingBox();
    expect(c && d && Math.abs(c.y - d.y) < 2).toBe(true);
    await tapIn(page, 'campaigns', 'campaign-stalingrad');
    await expect(arrived(page, 'campaign').locator('.th-map')).toHaveAttribute('data-campaign', 'stalingrad');
  });
});
