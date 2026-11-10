/**
 * The HQ flag at Brest (owner, 2026-11-09: the Soviet flag floated above the casemate with no pole). In the production
 * build the player's HQ in mission 1 shows its flag on a pole fixed to the roof; the picture is taken from the opening
 * view, as the owner's (docs/screenshots/flag-hq-before.png): docs/screenshots/flag-hq-after.png. That every flag hangs
 * on a pole is checked by tests/unit/flag-mounts.test.ts.
 */
import { join } from 'node:path';
import { expect, open, SHOT_DIR, startMission, state, test } from './helpers';

test('the Brest HQ flag hangs from a pole on the roof', async ({ page }) => {
  await open(page);
  expect(await startMission(page, 1001, 1)).toBe(true);
  await expect(page.getByTestId('order-advance')).toBeVisible({ timeout: 30_000 });
  // Let the battle run a moment (the first frames build the scene); the camera opens on the player's HQ.
  await expect.poll(async () => (await state(page)).tick, { timeout: 30_000 }).toBeGreaterThan(30);
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(SHOT_DIR, 'flag-hq-after.png') });
});
