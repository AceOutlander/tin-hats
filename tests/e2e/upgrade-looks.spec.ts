/**
 * Quartermaster upgrade looks in the production build: every card shows a picture of its next level (or its top level
 * once full) and is painted, and battles start with the HQ, gun, dump, sappers and gear of the save's
 * upgrades without a console error. Pictures go to docs/screenshots/e2e-upgrade-looks-*.png.
 */
import type { Page } from '@playwright/test';
import { UPGRADES } from '../../src/data/upgrades';
import { arrived, expect, open, shot, startMission, state, tap, tapIn, test, type Hooked } from './helpers';
import type { DebugApi } from '../../src/app/debug';

const setUpgrades = (page: Page, levels: Record<string, number>) =>
  page.evaluate((l) => ((window as unknown as Hooked).__TH as DebugApi).setUpgrades(l), levels);

test.describe('upgrade looks', () => {
  test('every Quartermaster card previews its next level, and the top level once it is full', async ({ page }) => {
    await open(page);
    const levels: Record<string, number> = {};
    UPGRADES.forEach((u, i) => (levels[u.id] = i % 4));
    await setUpgrades(page, levels);
    await tap(page, 'play');
    await tapIn(page, 'campaign', 'quartermaster');
    const qm = arrived(page, 'quartermaster');
    for (const u of UPGRADES) {
      const pic = qm.getByTestId(`upgrade-preview-${u.id}`);
      await expect(pic).toHaveCount(1);
      const max = u.levels.length;
      const want = Math.min(max, (levels[u.id] ?? 0) + 1);
      await expect(pic).toHaveAttribute('data-level', String(want));
      await expect(pic.locator('figcaption')).toHaveText(levels[u.id] >= max ? 'In battle' : `Level ${want}`);
      // The picture was painted: some of its pixels are not transparent.
      const painted = await pic.locator('canvas').evaluate((c: HTMLCanvasElement) => {
        const d = c.getContext('2d')?.getImageData(0, 0, c.width, c.height).data;
        if (!d) return 0;
        let n = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
        return n / (c.width * c.height);
      });
      expect(painted, `${u.id} preview`).toBeGreaterThan(0.03);
    }
    await shot(page, 'upgrade-looks-qm');
  });

  test('battles start with the looks of the saved upgrades at every stage', async ({ page }) => {
    await open(page);
    for (let level = 0; level <= 3; level++) {
      const levels: Record<string, number> = {};
      for (const u of UPGRADES) levels[u.id] = level;
      await setUpgrades(page, levels);
      await startMission(page, 1, 3);
      await expect.poll(async () => (await state(page)).inBattle).toBe(true);
      await page.waitForTimeout(1500);
      await shot(page, `upgrade-looks-stage${level}`);
    }
  });
});
