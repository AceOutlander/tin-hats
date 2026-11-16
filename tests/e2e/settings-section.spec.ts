/**
 * The platform's section in Settings (src/ui/screens/settings.ts, SettingsSection in src/platform/types.ts) in the
 * production build, on a phone in landscape. The website's platform has none, so its Settings shows nothing for it;
 * with a stand-in (handed over through the debug hooks) the section shows the platform's title, its lines and its
 * buttons, every button waits while one runs, and the section is read again when the platform says it changed.
 * Picture: docs/screenshots/settings-section.png.
 */
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import type { DebugApi } from '../../src/app/debug';
import type { SettingsSection } from '../../src/platform/types';
import { arrived, expect, open, SHOT_DIR, tap, tapIn, test } from './helpers';

const WORDS = {
  title: 'Field records',
  first: 'A first line from the platform, as it words it.',
  second: 'A second line: how things stand now.',
  after: 'Done a moment ago.',
  later: 'Changed by itself.',
} as const;

async function installFakeSection(page: Page): Promise<void> {
  await page.evaluate((words) => {
    const th = (window as unknown as { __TH: DebugApi }).__TH;
    const listeners = new Set<() => void>();
    let second: string = words.second;
    const section: SettingsSection = {
      title: words.title,
      panel: () => ({
        lines: [words.first, second],
        actions: [
          {
            id: 'one',
            label: 'Do the first thing',
            async run() {
              await new Promise((resolve) => setTimeout(resolve, 500));
              second = words.after;
            },
          },
          { id: 'two', label: 'A second thing', run: async () => undefined },
          { id: 'three', label: 'Not now', disabled: true, run: async () => undefined },
          {
            id: 'four',
            label: 'Later',
            async run() {
              setTimeout(() => {
                second = words.later;
                for (const l of listeners) l();
              }, 600);
            },
          },
        ],
      }),
      onChange(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
    th.setSettingsSection(section);
  }, WORDS);
}

test.describe("the platform's section in Settings", () => {
  test('is not there on the website: no section, no heading, no button', async ({ page }) => {
    await open(page);
    await tap(page, 'settings');
    const settings = arrived(page, 'settings');
    await expect(settings.getByTestId('setting-reset')).toBeAttached();
    await expect(page.locator('[data-testid="settings-platform"]')).toHaveCount(0);
    await expect(page.locator('.th-set-platform, .th-set-platform-line, .th-set-platform-actions')).toHaveCount(0);
    const order = await page.evaluate(() => [...document.querySelectorAll('.th-screen[data-screen="settings"] .th-set-grid > *')].map((n) => (n as HTMLElement).dataset.testid ?? n.className));
    expect(order.slice(-3)).toEqual(['setting-replay', 'setting-reset', 'settings-about']);
  });

  test('shows what the platform says, runs its buttons one at a time and reads it again when it changes', async ({ page }) => {
    await open(page);
    await installFakeSection(page);
    await tap(page, 'settings');
    const settings = arrived(page, 'settings');
    const section = settings.getByTestId('settings-platform');
    await section.scrollIntoViewIfNeeded();
    await expect(section).toBeVisible();
    await expect(section).toContainText(WORDS.title);
    await expect(section).toContainText(WORDS.first);
    await expect(section).toContainText(WORDS.second);
    await expect(section.getByTestId('settings-platform-one')).toHaveText('Do the first thing');
    await expect(section.getByTestId('settings-platform-three')).toBeDisabled();
    // Above "Replay tutorial" and "Reset progress", and inside the plate.
    const order = await page.evaluate(() => [...document.querySelectorAll('.th-screen[data-screen="settings"] .th-set-grid > *')].map((n) => (n as HTMLElement).dataset.testid ?? ''));
    expect(order.indexOf('settings-platform')).toBeGreaterThan(-1);
    expect(order.indexOf('settings-platform')).toBeLessThan(order.indexOf('setting-reset'));
    const fits = await page.evaluate(() => {
      const grid = document.querySelector('.th-screen[data-screen="settings"] .th-set-grid') as HTMLElement;
      const g = grid.getBoundingClientRect();
      return [...grid.querySelectorAll('.th-set-platform button, .th-set-platform p')].every((n) => {
        const r = n.getBoundingClientRect();
        return r.left >= g.left - 1 && r.right <= g.right + 1 && r.width > 0;
      });
    });
    expect(fits).toBe(true);
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(SHOT_DIR, 'settings-section.png') });

    // One runs: every button waits, then the section is read again.
    await tapIn(page, 'settings', 'settings-platform-one');
    await expect(section.getByTestId('settings-platform-one')).toBeDisabled();
    await expect(section.getByTestId('settings-platform-two')).toBeDisabled();
    await expect(section).toContainText(WORDS.after);
    await expect(section.getByTestId('settings-platform-one')).toBeEnabled();
    await expect(section.getByTestId('settings-platform-three')).toBeDisabled();

    // The platform changes by itself a moment after a button returned.
    await tapIn(page, 'settings', 'settings-platform-four');
    await expect(section).toContainText(WORDS.later);

    // Leaving and coming back reads it afresh; nothing of it is in the save.
    await tapIn(page, 'settings', 'back');
    await tap(page, 'settings');
    await expect(arrived(page, 'settings').getByTestId('settings-platform')).toContainText(WORDS.later);
    const save = await page.evaluate(() => window.localStorage.getItem('tinhats.save') ?? '');
    expect(save).not.toContain('Field records');
  });
});
