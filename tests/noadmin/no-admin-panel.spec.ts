/**
 * The game built without the admin panel (docs/PLATFORM.md, "A build without the admin panel"), on a phone in
 * landscape with real touches: it starts and plays as the website's does, and the panel is not there to be found.
 * No mark on the title's helmet, no listener behind the seven taps or the key combination, no style of the panel in
 * the page, no debug hook. The build is made by this config's server (playwright.noadmin.config.ts).
 * Any console error, page error or failed request fails the test (helpers.ts).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DebugApi } from '../../src/app/debug';
import { ADMIN } from '../../src/data/admin';
import { arrived, expect, open, startSandbox, state, tapIn, test, toMap, waitForState, type Hooked } from '../e2e/helpers';

/** The number in package.json (read as a file: the test runner does not import JSON). */
const { version } = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as { version: string };

test.describe('a build without the admin panel', () => {
  test('starts, shows no way into the panel, and plays', async ({ page, problems }) => {
    test.setTimeout(300_000);
    await open(page);
    const title = arrived(page, 'title');
    await expect(title.getByTestId('version')).toHaveText(`Beta v${version}`);

    // The debug hooks are the website's, but the panel's is empty.
    expect(await page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).admin)).toBeNull();

    // The helmet is a plain picture: not marked as the place of anything.
    const helmet = title.getByTestId('title-helmet');
    await expect(helmet).toBeVisible();
    expect(await helmet.evaluate((el) => [el.hasAttribute('data-admin-tap'), el.hasAttribute('data-interactive')])).toEqual([false, false]);

    // Seven quick taps where the helmet is, twice over, and the key combination: nothing opens.
    const box = await helmet.boundingBox();
    if (!box) throw new Error('the helmet has no box');
    for (let run = 0; run < 2; run++) {
      for (let i = 0; i < ADMIN.taps; i++) {
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(100);
      }
      await page.waitForTimeout(300);
    }
    const combo = [ADMIN.keys.ctrl ? 'Control' : '', ADMIN.keys.alt ? 'Alt' : '', ADMIN.keys.shift ? 'Shift' : '', ADMIN.keys.code].filter((k) => k !== '').join('+');
    await page.keyboard.press(combo);
    await page.waitForTimeout(300);
    await expect(page.locator('[data-testid^="admin-"], [class*="th-admin"]')).toHaveCount(0);
    expect((await state(page)).screen).toBe('title');

    // No rule of the panel's stylesheet is in the page.
    const rules = await page.evaluate(() => [...document.styleSheets].flatMap((sheet) => [...sheet.cssRules].map((rule) => rule.cssText)));
    expect(rules.length).toBeGreaterThan(100);
    expect(rules.filter((text) => text.includes('th-admin'))).toEqual([]);

    // The menus work: the map, the Shop, back.
    await toMap(page);
    await tapIn(page, 'campaign', 'armoury');
    await expect(arrived(page, 'armoury').getByTestId('armoury-item-smoke')).toBeVisible();
    await expect(page.locator('[data-testid^="admin-"], [class*="th-admin"]')).toHaveCount(0);

    // And a battle runs: troops are trained and the clock moves.
    await startSandbox(page, 7);
    const s = await waitForState(page, 'the battle to run for a few seconds', (st) => st.inBattle && st.time > 3);
    expect(s.inBattle).toBe(true);
    expect(s.over).toBe(false);
    await expect(page.locator('[data-testid^="admin-"], [class*="th-admin"]')).toHaveCount(0);
    expect(problems).toEqual([]);
  });
});
