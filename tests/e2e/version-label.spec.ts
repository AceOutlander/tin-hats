/**
 * The version as the player reads it, in the production build on a phone in landscape: the title's corner and the
 * first line of Settings' "About" both show the release stage and the number from one source (versionLabel in
 * src/data/version.ts), and on the website that is "Beta v0.X.Y", exactly as it always read. A platform may name
 * another stage or none (Platform.releaseStage); the website's names none of its own.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { arrived, expect, open, tapIn, test } from './helpers';

/** The number in package.json (read as a file: the test runner does not import JSON). */
const { version } = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as { version: string };

test.describe('the version label', () => {
  test('reads "Beta v0.X.Y" on the title and in Settings, and nowhere says more', async ({ page }) => {
    await open(page);
    const title = arrived(page, 'title');
    await expect(title.getByTestId('version')).toHaveText(`Beta v${version}`);
    // The page's own title carries no stage.
    expect(await page.title()).toBe('Tin Hats');

    await tapIn(page, 'title', 'settings');
    const settings = arrived(page, 'settings');
    const line = settings.getByTestId('settings-version');
    await line.scrollIntoViewIfNeeded();
    await expect(line).toHaveText(new RegExp(`^Beta v${version.replaceAll('.', '\\.')} · build [0-9a-z]+$`));
    // The heading over the notes names the number alone.
    await expect(settings.getByTestId('settings-about').locator('.th-label')).toHaveText(`What's new in v${version}`);
  });
});
