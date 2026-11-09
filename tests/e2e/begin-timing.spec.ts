/**
 * How long Begin takes to reach the battle (owner, 2026-11-09: "Start the battle within about 2 seconds"). The built
 * game, real taps from the campaign map through the briefing: Begin tapped as soon as the briefing shows (the worst
 * case: the music had no head start), and Begin tapped after a few seconds on the briefing. The battle music's calm
 * layer is all a start waits for; the rest renders during the battle, a little at a time.
 */
import type { Page } from '@playwright/test';
import type { BattleMusicStats } from '../../src/audio';
import { arrived, expect, open, state, tap, test, unlockAll, type Hooked } from './helpers';

/** Begin to the battle screen (ms), owner's target "within about 2 seconds" (DECISIONS 406). */
const BEGIN_TARGET_MS = 2000;

const battleMusic = (page: Page): Promise<BattleMusicStats> => page.evaluate(() => (window as unknown as Hooked).__TH?.battleMusic.stats() as BattleMusicStats);

/** From the map to the briefing of `id`, then Begin after `waitMs`; returns the ms from the tap to the battle screen. */
async function beginToBattle(page: Page, id: number, waitMs: number): Promise<number> {
  await open(page);
  await unlockAll(page);
  await tap(page, 'play');
  await expect(arrived(page, 'campaign').getByTestId(`mission-pin-${id}`)).toBeVisible();
  await tap(page, `mission-pin-${id}`);
  await tap(page, 'mission-start');
  await expect(arrived(page, 'briefing').getByTestId('begin')).toBeVisible();
  if (waitMs > 0) await page.waitForTimeout(waitMs);
  const t0 = Date.now();
  await arrived(page, 'briefing').getByTestId('begin').tap();
  await page.waitForFunction(() => (window as unknown as Hooked).__TH?.state().screen === 'battle', null, { timeout: 90_000, polling: 16 });
  return Date.now() - t0;
}

test.describe('Begin starts the battle quickly', () => {
  test('within about 2 seconds of Begin, the music finishing in the battle', async ({ page, problems }) => {
    test.setTimeout(600_000);
    const rows: string[] = [];
    for (const id of [1001, 1006, 1010]) {
      const at = await beginToBattle(page, id, 0);
      const s = await battleMusic(page);
      rows.push(`${id} Begin at once: ${at} ms to the battle (music ${s.piecesReady}/${s.piecesTotal} pieces, ${s.state})`);
      expect(at, `${id}: Begin tapped as the briefing opens`).toBeLessThanOrEqual(BEGIN_TARGET_MS);
      // The battle runs and the rest of the music arrives during it.
      await expect.poll(async () => (await state(page)).time, { timeout: 30_000 }).toBeGreaterThan(1);
      await expect.poll(async () => (await battleMusic(page)).player?.started ?? false, { timeout: 30_000 }).toBe(true);
      await expect.poll(async () => { const b = await battleMusic(page); return b.piecesReady === b.piecesTotal; }, { timeout: 180_000, intervals: [1000] }).toBe(true);
      expect((await battleMusic(page)).state).toBe('ready');
    }
    const later = await beginToBattle(page, 1003, 3000);
    rows.push(`1003 Begin after 3 s on the briefing: ${later} ms to the battle`);
    expect(later).toBeLessThanOrEqual(BEGIN_TARGET_MS);
    console.log(rows.join('\n'));
    expect(problems).toEqual([]);
  });
});
