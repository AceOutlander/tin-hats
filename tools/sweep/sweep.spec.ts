/**
 * The Stalingrad screenshot sweep (owner, 2026-11-09: "take screenshots of every mission, the campaign map, the
 * Armoury, the Shop and every briefing, look at each one carefully"). Run with tools/sweep/playwright.config.ts after a
 * build. It shoots the title, the campaign select, the map and every mission's card, all ten briefings scrolled through,
 * the Shop, the Quartermaster, Basic Training, three moments of every battle (the start or its prep phase, the fighting,
 * a late phase), a victory and a defeat, and the HUD with the call-ins open; the riskiest screens again at 667x375.
 * SWEEP_ONLY=menus|battles|small limits it; SWEEP_IDS=1001,1006 limits the battles.
 */
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Page } from '@playwright/test';
import { arrived, BATTLE_LOAD_MS, expect, field, lookAt, open, setTimeScale, state, tap, tapIn, test } from '../../tests/e2e/helpers';
import type { DebugApi } from '../../src/app/debug';

const TAG = process.env.SWEEP_TAG ? `sweep-${process.env.SWEEP_TAG}` : 'sweep';
const DIR = resolve('docs', 'screenshots', TAG);
mkdirSync(DIR, { recursive: true });
const ONLY = process.env.SWEEP_ONLY ?? '';
const IDS = (process.env.SWEEP_IDS ?? '1001,1002,1003,1004,1005,1006,1007,1008,1009,1010').split(',').map(Number);

type Hooked = { __TH?: DebugApi };

async function snap(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: join(DIR, `${name}.png`) });
}

/** Every Stalingrad mission cleared on Normal, some upgrades bought, medals to spend, Basic Training done. */
async function fullSave(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (window.localStorage.getItem('tinhats.save') !== null) return;
    const cleared: Record<string, string[]> = {};
    for (let i = 1001; i <= 1010; i++) cleared[String(i)] = ['normal'];
    window.localStorage.setItem(
      'tinhats.save',
      JSON.stringify({
        version: 10,
        cleared,
        upgrades: { sapperDrill: 1, hqIncome: 2, rifleHealth: 3, atHealth: 1 },
        medals: 400,
        armoury: [],
        wins: {},
        lastMission: 1009,
        training: { done: true, skipped: false },
        settings: { muted: true, difficulty: 'normal', hints: true },
      }),
    );
  });
}

const settled = (page: Page) => expect(page.locator('.th-screen.is-out')).toHaveCount(0);

/** Scroll the briefing paper (or any scroller) to a fraction of its length. */
async function scrollTo(page: Page, selector: string, frac: number): Promise<void> {
  await page.locator(selector).first().evaluate((el, f) => {
    el.scrollTop = (el.scrollHeight - el.clientHeight) * f;
  }, frac);
  await page.waitForTimeout(250);
}

async function menus(page: Page, prefix: string, all: boolean): Promise<void> {
  await fullSave(page);
  await open(page);
  await page.waitForTimeout(1200);
  await snap(page, `${prefix}01-title`);
  await tap(page, 'play');
  await settled(page);
  await page.waitForTimeout(600);
  await snap(page, `${prefix}02-campaign-select`);
  await tapIn(page, 'campaigns', 'campaign-stalingrad');
  await expect(arrived(page, 'campaign')).toBeVisible();
  await settled(page);
  await page.waitForTimeout(900);
  await snap(page, `${prefix}03-campaign-map`);
  const ids = all ? IDS : [1001, 1006];
  for (const id of ids) {
    await page.getByTestId(`mission-pin-${id}`).evaluate((el) => (el as HTMLElement).click());
    await page.waitForTimeout(700);
    await snap(page, `${prefix}04-card-${id}`);
    await tapIn(page, 'campaign', 'mission-start');
    await settled(page);
    await page.waitForTimeout(2800);
    const sheet = '.th-screen.is-in[data-screen="briefing"] .th-sheet';
    await snap(page, `${prefix}05-briefing-${id}-a`);
    await scrollTo(page, sheet, 0.5);
    await snap(page, `${prefix}05-briefing-${id}-b`);
    await scrollTo(page, sheet, 1);
    await snap(page, `${prefix}05-briefing-${id}-c`);
    await tapIn(page, 'briefing', 'back');
    await settled(page);
  }
  await tapIn(page, 'campaign', 'armoury');
  await settled(page);
  await page.waitForTimeout(600);
  await snap(page, `${prefix}06-shop-a`);
  const shopList = '.th-screen.is-in[data-screen="armoury"] [data-scroll]';
  if ((await page.locator(shopList).count()) > 0) {
    await scrollTo(page, shopList, 1);
    await snap(page, `${prefix}06-shop-b`);
  }
  await tapIn(page, 'armoury', 'back');
  await settled(page);
  await tapIn(page, 'campaign', 'quartermaster');
  await settled(page);
  await page.waitForTimeout(600);
  const qmList = '.th-screen.is-in[data-screen="quartermaster"] [data-scroll]';
  const steps = all ? [0, 0.2, 0.4, 0.6, 0.8, 1] : [0, 0.5];
  for (let i = 0; i < steps.length; i++) {
    if ((await page.locator(qmList).count()) > 0) await scrollTo(page, qmList, steps[i]);
    await snap(page, `${prefix}07-quartermaster-${i}`);
  }
}

test.describe('sweep', () => {
  test('menus at 844x390', async ({ page }) => {
    test.skip(ONLY !== '' && ONLY !== 'menus');
    await menus(page, '', true);
  });

  test.describe('667x375', () => {
    test.use({ viewport: { width: 667, height: 375 } });
    test('the riskiest screens at 667x375', async ({ page }) => {
      test.skip(ONLY !== '' && ONLY !== 'small');
      await menus(page, 'small-', false);
      await page.evaluate(() => (window as unknown as Hooked).__TH?.startStalingrad(1006, 'normal', 1));
      await expect(page.getByTestId('order-advance')).toBeVisible({ timeout: BATTLE_LOAD_MS });
      await page.waitForTimeout(1500);
      await snap(page, 'small-08-hud-1006');
      await tap(page, 'callins');
      await page.waitForTimeout(500);
      await snap(page, 'small-08-hud-1006-callins');
    });
  });

  test('Basic Training and the battles', async ({ page }) => {
    test.skip(ONLY !== '' && ONLY !== 'battles');
    await fullSave(page);
    await open(page);
    await page.evaluate(() => (window as unknown as Hooked).__TH?.startTraining());
    await expect.poll(async () => (await state(page)).screen, { timeout: BATTLE_LOAD_MS }).toBe('battle');
    await page.waitForTimeout(2500);
    await snap(page, '09-training-start');
    let wonShot = false;
    let lostShot = false;
    for (const id of IDS) {
      await open(page);
      // The bot plays the player's side (it must be on before the battle starts: the commanders are fixed then).
      await page.evaluate(() => (window as unknown as Hooked).__TH?.autopilot(true));
      await page.evaluate((k) => (window as unknown as Hooked).__TH?.startStalingrad(k, 'normal', 1), id);
      await expect.poll(async () => (await state(page)).screen, { timeout: BATTLE_LOAD_MS }).toBe('battle');
      await expect(page.getByTestId('order-advance')).toBeVisible({ timeout: 20_000 });
      await page.waitForTimeout(1500);
      await snap(page, `10-battle-${id}-1-start`);
      let s = await state(page);
      if (s.prep?.active) {
        await page.waitForTimeout(500);
        await snap(page, `10-battle-${id}-1-prep`);
        await page.getByTestId('prep-ready').tap({ timeout: 3000 }).catch(() => undefined);
      }
      if (id === 1006) {
        await tap(page, 'callins').catch(() => undefined);
        await page.waitForTimeout(500);
        await snap(page, `10-battle-${id}-hud-callins`);
        await tap(page, 'callins').catch(() => undefined);
      }
      await setTimeScale(page, 12);
      const marks: Array<[string, number]> = [
        ['2-mid', 200],
        ['3-late', 560],
      ];
      let atShot = false;
      for (const [name, when] of marks) {
        const deadline = Date.now() + 120_000;
        while (Date.now() < deadline) {
          s = await state(page);
          if (s.over || s.time >= when) break;
          await page.waitForTimeout(400);
        }
        if (s.over) break;
        await setTimeScale(page, 0);
        await lookAt(page, await fightX(page));
        await page.waitForTimeout(700);
        await snap(page, `10-battle-${id}-${name}`);
        // A close look at the Red Army's anti-tank unit once a mission (its weapon and its crew).
        const at = atShot ? null : await page.evaluate(() => (window as unknown as Hooked).__TH?.units().find((u) => u.side === 0 && u.kind === 'at' && !u.inside) ?? null);
        if (at) {
          atShot = true;
          await lookAt(page, at.x + 120);
          await page.waitForTimeout(500);
          await snap(page, `10-battle-${id}-at`);
        }
        await setTimeScale(page, 12);
      }
      // The ending: on to the result for a victory and a defeat (the first of each the sweep meets).
      if (!wonShot || !lostShot) {
        await setTimeScale(page, 60);
        const deadline = Date.now() + 150_000;
        while (!s.over && Date.now() < deadline) {
          await page.waitForTimeout(500);
          s = await state(page);
        }
        if (s.over) {
          const won = s.winner === 0;
          if ((won && !wonShot) || (!won && !lostShot)) {
            await expect(arrived(page, 'result')).toBeVisible({ timeout: 30_000 });
            await page.waitForTimeout(1200);
            await snap(page, `11-result-${won ? 'victory' : 'defeat'}-${id}`);
            if (won) wonShot = true;
            else lostShot = true;
          }
        }
      }
    }
  });
});

test('a defeat: Dubno with nobody at the controls', async ({ page }) => {
  test.skip(ONLY !== '' && ONLY !== 'battles' && ONLY !== 'defeat');
  await fullSave(page);
  await open(page);
  await page.evaluate(() => (window as unknown as Hooked).__TH?.startStalingrad(1002, 'normal', 1));
  await expect(page.getByTestId('order-advance')).toBeVisible({ timeout: BATTLE_LOAD_MS });
  await setTimeScale(page, 240);
  await expect.poll(async () => (await state(page)).over, { timeout: 240_000, intervals: [1000] }).toBe(true);
  await expect(arrived(page, 'result')).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1200);
  await snap(page, `11-result-${(await state(page)).winner === 0 ? 'victory' : 'defeat'}-1002-idle`);
});

/** Where the fighting is: between the player's leading man and the nearest enemy, or ahead of the line when none is near. */
async function fightX(page: Page): Promise<number> {
  const list = await page.evaluate(() => (window as unknown as Hooked).__TH?.units() ?? []);
  const mine = list.filter((u) => u.side === 0 && !u.inside && u.kind !== 'sapper').map((u) => u.x);
  const theirs = list.filter((u) => u.side === 1 && !u.inside).map((u) => u.x);
  if (mine.length === 0) {
    const f = await field(page);
    return f ? f.playerHqX + 400 : 1000;
  }
  const front = Math.max(...mine);
  const near = theirs.filter((x) => x >= front - 200).sort((a, b) => a - b)[0];
  return near !== undefined && near - front < 900 ? (front + near) / 2 : front + 150;
}
