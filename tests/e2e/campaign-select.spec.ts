/**
 * Play and the Stalingrad map in the production build, on a phone in landscape with real touches (FOUNDATIONS.md
 * section 6). Since the British placeholder missions were removed, Stalingrad is the only campaign: Play goes straight
 * to its map, on the live site and with ?unreleased=1 alike, and the map's Back goes to the title. The select screen
 * (src/ui/screens/campaigns.ts) shows again once a second campaign joins src/data/campaigns.ts; its cards are covered
 * by tests/unit/campaign-select.test.ts (DECISIONS 303).
 *
 * Pictures (844x390 at 2x): docs/screenshots/e2e-campaign-stalingrad-map.png, -stalingrad-briefing.png.
 */
import { arrived, expect, open, shot, tap, tapIn, test, unlockAll } from './helpers';

test.describe('the one campaign', () => {
  for (const query of ['?debug=1', '?debug=1&unreleased=1']) {
    test(`Play goes straight to the Stalingrad map (${query}), and Back goes to the title`, async ({ page }) => {
      await open(page, query);
      await tap(page, 'play');
      const map = arrived(page, 'campaign');
      await expect(map.locator('.th-map')).toHaveAttribute('data-campaign', 'stalingrad');
      await expect(page.locator('.th-screen[data-screen="campaigns"]')).toHaveCount(0);
      for (let id = 1001; id <= 1010; id++) await expect(map.getByTestId(`mission-pin-${id}`)).toBeAttached();
      await expect(map.getByTestId('mission-pin-1')).toHaveCount(0);
      await tapIn(page, 'campaign', 'back');
      await expect(arrived(page, 'title')).toBeVisible();
    });
  }

  test('opens the Stalingrad map with its front line, and the briefing', async ({ page }) => {
    await open(page);
    await tap(page, 'play');
    const map = arrived(page, 'campaign');
    await expect(map.locator('.th-map')).toHaveAttribute('data-campaign', 'stalingrad');
    await expect(map.locator('.th-map')).toHaveAttribute('data-front', '1941-06-22');
    await expect(map.getByTestId('mission-pin-1001')).toHaveAttribute('data-state', 'open');
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

    // Back to the map, and back to the title.
    await tapIn(page, 'briefing', 'back');
    await tapIn(page, 'campaign', 'back');
    await expect(arrived(page, 'title')).toBeVisible();
  });
});
