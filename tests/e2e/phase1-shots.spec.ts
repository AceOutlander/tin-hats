/**
 * Phase 1 walkthrough with screenshots: one phone-sized, touch-driven run of
 * mission 1 from the title to the victory screen, and a second one that loses.
 * Each key moment is waited for in the simulation (the ?debug=1 hooks), not by
 * a fixed delay, then written to docs/screenshots/phase1-*.png.
 */
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { MISSIONS } from '../../src/data/missions';
import {
  BATTLE_LOAD_MS,
  expect,
  field,
  grantSupplies,
  lookAt,
  open,
  playToEnd,
  setTimeScale,
  SHOT_DIR,
  startMission,
  state,
  tap,
  tapIfThere,
  test,
  waitForState,
} from './helpers';

// One CSS pixel per device pixel: the smallest, plainest picture of what a player sees.
test.use({ deviceScaleFactor: 1 });

const MISSION = MISSIONS[0];
/** Battle seed and army size that give a fight in the open field. */
const FIGHT_SEED = 5;
const ARMY = 9;

async function p1(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: join(SHOT_DIR, `phase1-${name}.png`) });
}

/** Keep the player's army growing: spend supplies on riflemen with real taps. */
async function reinforce(page: Page, taps = 3): Promise<void> {
  await grantSupplies(page, 800);
  for (let i = 0; i < taps; i++) await tapIfThere(page, 'train-rifle');
}

test.describe('phase 1 screenshots', () => {
  test('mission 1 from the title to victory', async ({ page }) => {
    await open(page);
    await expect(page.getByTestId('play')).toBeVisible();
    await page.waitForTimeout(600);
    await p1(page, 'title');

    await tap(page, 'play');
    await tap(page, `mission-pin-${MISSION.id}`);
    await page.waitForTimeout(700);
    await p1(page, 'campaign');

    await tap(page, 'mission-start');
    await expect(page.getByTestId('begin')).toBeVisible();
    await page.waitForTimeout(5000); // the orders type themselves out; show the finished sheet
    await p1(page, 'briefing');

    await tap(page, 'begin');
    await expect.poll(async () => (await state(page)).screen, { timeout: BATTLE_LOAD_MS }).toBe('battle');
    await expect(page.getByTestId('order-advance')).toBeVisible({ timeout: 20_000 });
    await waitForState(page, 'the battle to run for a second', (s) => s.tick > 45);
    await p1(page, 'battle-start');

    // Sappers hauling: wait until one carries a crate, then catch it in the picture.
    let carrying = 0;
    for (let i = 0; i < 400 && carrying === 0; i++) {
      carrying = (await field(page))?.sappersCarrying ?? 0;
      if (carrying === 0) await page.waitForTimeout(100);
    }
    expect(carrying, 'a sapper should be carrying supplies early in the battle').toBeGreaterThan(0);
    await p1(page, 'sappers-hauling');

    // Start over on a fixed seed so the rest of the walkthrough is repeatable, then build a modest army at speed.
    // (A big army makes the AI shelter in its HQ, so there would be no fight in the open.)
    expect(await startMission(page, MISSION.id, FIGHT_SEED)).toBe(true);
    await expect.poll(async () => (await state(page)).tick).toBeLessThan(30);
    await setTimeScale(page, 20);
    await grantSupplies(page, 400);
    for (let i = 0; i < 200; i++) {
      const s = await state(page);
      if (s.units[0].rifle >= ARMY) break;
      if (s.queue.rifle < 3) await tapIfThere(page, 'train-rifle');
      await page.waitForTimeout(250);
    }
    expect((await state(page)).units[0].rifle).toBeGreaterThanOrEqual(ARMY);
    await tap(page, 'order-advance');
    await expect.poll(async () => (await state(page)).order).toBe('advance');

    // March until the lines are about to meet, then slow down for the fight.
    await setTimeScale(page, 6);
    for (let i = 0; i < 400; i++) {
      const f = await field(page);
      if (f !== null && f.gap !== null && f.gap < 700) break;
      await page.waitForTimeout(150);
    }
    await setTimeScale(page, 2);
    for (let i = 0; i < 300; i++) {
      const f = await field(page);
      if (f !== null && f.gap !== null && f.gap < 280) break;
      await page.waitForTimeout(100);
    }
    await setTimeScale(page, 1);
    for (let i = 0; i < 3; i++) {
      const f = await field(page);
      expect(f?.gap, 'the armies are in contact').not.toBeNull();
      if (f && f.playerFrontX !== null && f.enemyFrontX !== null) await lookAt(page, (f.playerFrontX + f.enemyFrontX) / 2);
      await page.waitForTimeout(700);
    }
    await p1(page, 'firefight');

    // Fall back: everyone runs home. The camera follows the retreat.
    await tap(page, 'order-fallBack');
    await expect.poll(async () => (await state(page)).order).toBe('fallBack');
    await page.waitForTimeout(1800);
    const f3 = await field(page);
    if (f3 && f3.playerFrontX !== null) await lookAt(page, f3.playerFrontX - 120);
    await page.waitForTimeout(300);
    await p1(page, 'fall-back');

    // Advance again with reinforcements until the enemy HQ takes damage.
    await tap(page, 'order-advance');
    await setTimeScale(page, 8);
    const hqHit = (hp: number | undefined, max: number | undefined): boolean => hp !== undefined && max !== undefined && hp < max * 0.8;
    for (let i = 0; i < 600; i++) {
      await reinforce(page, 2);
      const s = await state(page);
      if (s.over || hqHit(s.hq[1]?.hp, s.hq[1]?.max)) break;
      await page.waitForTimeout(150);
    }
    await setTimeScale(page, 1);
    const f4 = await field(page);
    if (f4) await lookAt(page, f4.enemyHqX - 260);
    // Catch a moment when a shot has just landed on the HQ: freeze the loop there (effects stop mid-life) and take the picture.
    let lastHp = (await state(page)).hq[1]?.hp ?? 0;
    for (let i = 0; i < 400; i++) {
      await page.waitForTimeout(40);
      const hp = (await state(page)).hq[1]?.hp ?? 0;
      if (hp < lastHp) break;
      lastHp = hp;
    }
    await setTimeScale(page, 0);
    await p1(page, 'hq-attack');
    await setTimeScale(page, 1);

    // Victory.
    const end = await playToEnd(page, true);
    expect(end.winner).toBe(0);
    await expect(page.getByTestId('result-reason')).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(900);
    await p1(page, 'victory');
  });

  test('mission 1 lost', async ({ page }) => {
    await open(page);
    expect(await startMission(page, MISSION.id, 3)).toBe(true);
    await expect.poll(async () => (await state(page)).screen).toBe('battle');
    const end = await playToEnd(page, false);
    expect(end.winner).toBe(1);
    await expect(page.getByTestId('result-reason')).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(900);
    await p1(page, 'defeat');
  });
});
