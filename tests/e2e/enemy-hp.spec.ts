/**
 * Hidden enemy health in the built game: in the proving ground, after some fighting, damaged soldiers of the player's
 * own side show their health pips and damaged enemy soldiers on the same screen show none. The ?debug=1 reveal
 * (__TH.revealEnemyHp, the switch the admin panel and the Recon plane build on) shows them, and switching it off
 * hides them again.
 *
 * Picture: docs/screenshots/enemy-hp-hidden.png (844x390 at 2x), damaged soldiers on both sides, pips only on the own.
 */
import type { Page } from '@playwright/test';
import { join } from 'node:path';
import type { DebugApi, UnitInfo } from '../../src/app/debug';
import { camera, expect, grantSupplies, lookAt, open, setTimeScale, SHOT_DIR, startSandbox, state, test, units, type Hooked } from './helpers';

const hpPips = (page: Page) => page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).hpPips());
const revealEnemyHp = (page: Page, on: boolean) => page.evaluate((k) => ((window as unknown as Hooked).__TH as DebugApi).revealEnemyHp(k), on);

const damaged = (u: UnitInfo) => !u.inside && u.hp > 0 && u.hp < u.maxHp;

/** World x where damaged soldiers of both sides stand closest together, or null while one side has none. */
function bestView(list: UnitInfo[], viewW: number): number | null {
  const own = list.filter((u) => u.side === 0 && damaged(u));
  const foe = list.filter((u) => u.side === 1 && damaged(u));
  let best: number | null = null;
  let bestScore = -1;
  for (const o of own) {
    const left = o.x - viewW * 0.45;
    const right = o.x + viewW * 0.45;
    const enemies = foe.filter((f) => f.x > left && f.x < right).length;
    const friends = own.filter((f) => f.x > left && f.x < right).length;
    if (enemies === 0) continue;
    const score = Math.min(enemies, friends) * 10 + enemies + friends;
    if (score > bestScore) {
      bestScore = score;
      best = (o.x + foe.filter((f) => f.x > left && f.x < right).reduce((m, f) => m + f.x, 0) / enemies) / 2;
    }
  }
  return best;
}

test.describe('hidden enemy health', () => {
  test('enemy soldiers show no health pips while the player\'s own damaged soldiers do, until revealed', async ({ page }) => {
    await open(page);
    const before = await hpPips(page);
    expect(before.enemyRevealed).toBe(false);
    await page.evaluate(() => (window as unknown as Hooked).__TH?.autopilot(true));
    expect(await startSandbox(page, 7)).toBe(true);
    await expect.poll(async () => (await state(page)).inBattle, { timeout: 20_000 }).toBe(true);
    await grantSupplies(page, 3000);
    await setTimeScale(page, 4);

    // Fight until a screenful holds damaged soldiers of both sides, then stop the clock there.
    const deadline = Date.now() + 150_000;
    let found = false;
    let enemyPipsSeen = 0;
    while (Date.now() < deadline) {
      await page.waitForTimeout(400);
      enemyPipsSeen = Math.max(enemyPipsSeen, (await hpPips(page)).enemy);
      const viewW = (await camera(page)).viewWidthWu;
      const x = bestView(await units(page), viewW);
      if (x === null) continue;
      await setTimeScale(page, 0);
      await lookAt(page, x);
      await page.waitForTimeout(400);
      const cam = await camera(page);
      const onScreen = (await units(page)).filter((u) => damaged(u) && u.x > cam.left + 10 && u.x < cam.left + cam.viewWidthWu - 10);
      const pips = await hpPips(page);
      enemyPipsSeen = Math.max(enemyPipsSeen, pips.enemy);
      if (pips.own > 0 && onScreen.some((u) => u.side === 1)) {
        found = true;
        break;
      }
      await setTimeScale(page, 4);
    }
    expect(found, 'damaged soldiers of both sides on one screen').toBe(true);
    expect(enemyPipsSeen, 'no enemy health pip at any time during the fight').toBe(0);

    const hidden = await hpPips(page);
    expect(hidden.own, 'own damaged soldiers show their pips').toBeGreaterThan(0);
    expect(hidden.enemy, 'damaged enemy soldiers show none').toBe(0);
    expect(hidden.enemyRevealed).toBe(false);
    await page.screenshot({ path: join(SHOT_DIR, 'enemy-hp-hidden.png') });

    await revealEnemyHp(page, true);
    await expect.poll(async () => (await hpPips(page)).enemy, { timeout: 5_000, message: 'revealed enemy pips' }).toBeGreaterThan(0);
    const revealed = await hpPips(page);
    expect(revealed.enemyRevealed).toBe(true);
    expect(revealed.own).toBe(hidden.own);
    await page.screenshot({ path: join(SHOT_DIR, 'e2e-enemy-hp-revealed.png') });

    await revealEnemyHp(page, false);
    await expect.poll(async () => (await hpPips(page)).enemy, { timeout: 5_000 }).toBe(0);
    expect((await hpPips(page)).own).toBeGreaterThan(0);
    expect((await state(page)).inBattle).toBe(true);
  });
});
