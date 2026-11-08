/**
 * The campaign in the production build, on a phone in landscape with real touches: the map, clearing mission 1 for
 * real, the medals each first win on a difficulty pays, buying and refunding in the Quartermaster with medals, a reload,
 * and boots from damaged, old and impossible saves. Any console error, page error or failed request fails the test (helpers.ts).
 * Pictures go to docs/screenshots/e2e-campaign-*.png.
 */
import type { Page } from '@playwright/test';
import { CONFIG } from '../../src/data/config';
import { META } from '../../src/data/meta';
import { MISSIONS } from '../../src/data/missions';
import { MEDALS } from '../../src/data/medals';
import { UPGRADES, UPGRADE_MEDALS_PER_LEVEL } from '../../src/data/upgrades';
import {
  arrived,
  expect,
  lastResult,
  memorySave,
  missionList,
  open,
  pinState,
  playThroughMenus,
  playToEnd,
  pointsLeft,
  savedGame,
  shot,
  state,
  storeRaw,
  tap,
  tapIn,
  test,
  upgradeLevel,
  type Hooked,
} from './helpers';
import type { DebugApi } from '../../src/app/debug';

const FIRST = MISSIONS[0].id;
const SECOND = MISSIONS[1].id;

async function reload(page: Page): Promise<void> {
  await page.reload();
  await page.waitForFunction(() => (window as unknown as Hooked).__TH?.ready === true, null, { timeout: 60_000 });
}

/** Every mission pin's state, in campaign order. */
async function pinStates(page: Page): Promise<(string | null)[]> {
  const out: (string | null)[] = [];
  for (const m of MISSIONS) out.push(await pinState(page, m.id));
  return out;
}

test.describe('campaign', () => {
  test('clears mission 1, earns medals for each first win, buys and refunds upgrades, and keeps it all across a reload', async ({ page }) => {
    test.setTimeout(900_000);
    await open(page);
    expect(await savedGame(page), 'nothing is stored before the first change').toBeNull();

    // --- The map: ten missions, only the first open -------------------------------------------------------------
    const list = await missionList(page);
    expect(list.map((m) => m.id)).toEqual(MISSIONS.map((m) => m.id));
    expect(list).toHaveLength(10);
    await tap(page, 'play');
    await expect(arrived(page, 'campaign').getByTestId(`mission-pin-${FIRST}`)).toBeVisible();
    expect(await pinStates(page)).toEqual(['open', ...Array<string>(9).fill('locked')]);
    for (const m of MISSIONS) await expect(arrived(page, 'campaign').getByTestId(`mission-pin-${m.id}`)).toBeAttached();
    expect(await pointsLeft(page, 'campaign')).toBe(0);
    await page.waitForTimeout(600);
    await shot(page, 'campaign-map');

    // A locked mission cannot be started.
    await tap(page, `mission-pin-${SECOND}`);
    await expect(page.getByTestId('mission-start')).toBeDisabled();
    await tap(page, `mission-pin-${FIRST}`);
    await expect(page.getByTestId('mission-start')).toBeEnabled();

    // --- Clear mission 1 for real (Normal) -----------------------------------------------------------------------
    await tap(page, `mission-pin-${FIRST}`);
    await tap(page, 'mission-start');
    await expect(page.getByTestId('begin')).toBeVisible();
    await tap(page, 'begin');
    await expect.poll(async () => (await state(page)).screen, { timeout: 20_000 }).toBe('battle');
    const first = await playToEnd(page, true);
    expect(first.winner, 'a keen player wins mission 1').toBe(0);
    await expect(page.getByTestId('result-points')).toBeVisible({ timeout: 30_000 });
    const award = (await lastResult(page))?.pointsAwarded ?? 0;
    expect(award, 'a first win pays at least a rough clear').toBeGreaterThanOrEqual(MEDALS.rough);
    await expect(page.getByTestId('result-points')).toContainText(`+${award}`);
    await page.waitForTimeout(500);
    await shot(page, 'campaign-result-first-clear');
    expect((await savedGame(page))?.cleared[String(FIRST)]).toEqual(['normal']);

    await tap(page, 'result-map');
    await expect.poll(() => pinState(page, FIRST)).toBe('cleared');
    expect(await pinState(page, SECOND), 'clearing mission 1 opens mission 2').toBe('open');
    expect(await pinState(page, MISSIONS[2].id)).toBe('locked');
    expect(await pointsLeft(page, 'campaign')).toBe(award);

    // --- Clear it again on Hard: the pips grow, and a first win on Hard pays in full ---------------------------------
    await tap(page, `mission-pin-${FIRST}`);
    await tap(page, 'mission-start');
    await expect(page.getByTestId('begin')).toBeVisible();
    await tap(page, 'difficulty-hard');
    await tap(page, 'begin');
    await expect.poll(async () => (await state(page)).screen, { timeout: 20_000 }).toBe('battle');
    expect((await state(page)).difficulty).toBe('hard');
    const again = await playToEnd(page, true);
    expect(again.winner, 'a keen player also wins mission 1 on Hard').toBe(0);
    await expect(page.getByTestId('result-reason')).toBeVisible({ timeout: 30_000 });
    const hardAward = (await lastResult(page))?.pointsAwarded ?? 0;
    expect(hardAward, 'the first win on Hard is not a replay').toBeGreaterThanOrEqual(MEDALS.rough);
    await expect(page.getByTestId('result-points')).toContainText(`+${hardAward}`);
    expect((await savedGame(page))?.cleared[String(FIRST)]).toEqual(['normal', 'hard']);
    expect((await savedGame(page))?.settings.difficulty, 'the briefing choice is remembered').toBe('hard');
    await tap(page, 'result-map');
    await expect.poll(() => pinState(page, FIRST)).toBe('cleared');
    expect(await pointsLeft(page, 'campaign'), 'the medals of both first wins').toBe(award + hardAward);
    await expect(arrived(page, 'campaign').getByTestId(`mission-pin-${FIRST}`).locator('.th-pip.is-on')).toHaveCount(2);
    await page.waitForTimeout(500);
    await shot(page, 'campaign-map-after-clear');

    // --- Quartermaster: buy, run out of medals, refund a level, refund everything --------------------------------
    // Keep exactly two levels' worth of medals (the debug hook takes the rest), so running out is quick to reach.
    const LEVEL = UPGRADE_MEDALS_PER_LEVEL;
    await page.evaluate((n) => ((window as unknown as Hooked).__TH as DebugApi).takeMedals(n), award + hardAward - 2 * LEVEL);
    await tap(page, 'quartermaster');
    await expect(arrived(page, 'quartermaster').getByTestId('upgrade-buy-hqHealth')).toBeVisible();
    expect(await pointsLeft(page, 'quartermaster')).toBe(2 * LEVEL);
    const cards = await arrived(page, 'quartermaster').locator('.th-up').count();
    expect(cards, 'every upgrade of the table has a card').toBe(UPGRADES.length);
    const qm = arrived(page, 'quartermaster');

    await tap(page, 'upgrade-buy-hqHealth');
    await expect.poll(() => upgradeLevel(page, 'hqHealth')).toBe(1);
    await tap(page, 'upgrade-buy-hqHealth');
    await expect.poll(() => upgradeLevel(page, 'hqHealth')).toBe(2);
    expect(await pointsLeft(page, 'quartermaster')).toBe(0);
    await expect(qm.getByTestId('upgrade-buy-hqHealth'), 'no medals left to buy the third level').toBeDisabled();
    await expect(qm.getByTestId('upgrade-buy-rifleDamage')).toBeDisabled();
    await page.waitForTimeout(400);
    await shot(page, 'campaign-quartermaster-spent');

    await tap(page, 'upgrade-refund-hqHealth');
    await expect.poll(() => upgradeLevel(page, 'hqHealth')).toBe(1);
    expect(await pointsLeft(page, 'quartermaster'), 'a refund gives the medals back').toBe(LEVEL);
    await tap(page, 'upgrade-buy-rifleDamage');
    await expect.poll(() => upgradeLevel(page, 'rifleDamage')).toBe(1);
    expect(await pointsLeft(page, 'quartermaster')).toBe(0);

    await tap(page, 'refund-all');
    await expect.poll(() => pointsLeft(page, 'quartermaster')).toBe(2 * LEVEL);
    expect(await upgradeLevel(page, 'hqHealth')).toBe(0);
    expect(await upgradeLevel(page, 'rifleDamage')).toBe(0);
    await expect(qm.getByTestId('refund-all')).toBeDisabled();
    expect((await savedGame(page))?.upgrades, 'a refund is saved at once').toEqual({});

    // Settle on one level each of two upgrades.
    await tap(page, 'upgrade-buy-hqHealth');
    await tap(page, 'upgrade-buy-rifleDamage');
    await expect.poll(() => pointsLeft(page, 'quartermaster')).toBe(0);
    expect(await upgradeLevel(page, 'hqHealth')).toBe(1);
    expect(await upgradeLevel(page, 'rifleDamage')).toBe(1);
    expect((await savedGame(page))?.upgrades).toEqual({ hqHealth: 1, rifleDamage: 1 });
    await page.waitForTimeout(300);
    await shot(page, 'campaign-quartermaster');

    // --- Reload: everything is still there -----------------------------------------------------------------------
    await reload(page);
    const saved = await savedGame(page);
    expect(saved?.version).toBe(META.saveVersion);
    expect(saved?.cleared[String(FIRST)]).toEqual(['normal', 'hard']);
    expect(saved?.upgrades).toEqual({ hqHealth: 1, rifleDamage: 1 });
    expect(saved?.settings.difficulty).toBe('hard');
    expect(saved?.lastMission).toBe(FIRST);
    await tap(page, 'play');
    await expect(arrived(page, 'campaign').getByTestId(`mission-pin-${FIRST}`)).toBeVisible();
    expect(await pinState(page, FIRST)).toBe('cleared');
    expect(await pinState(page, SECOND)).toBe('open');
    expect(await pointsLeft(page, 'campaign')).toBe(0);
    await expect(arrived(page, 'campaign').getByTestId(`mission-pin-${FIRST}`)).toHaveClass(/is-selected/);
    await tap(page, 'quartermaster');
    await expect(qm.getByTestId('upgrade-buy-hqHealth')).toBeVisible();
    expect(await upgradeLevel(page, 'hqHealth')).toBe(1);
    expect(await upgradeLevel(page, 'rifleDamage')).toBe(1);
    expect(await upgradeLevel(page, 'hqIncome')).toBe(0);
    await arrived(page, 'quartermaster').getByTestId('back').tap();

    // --- The upgrades and the remembered difficulty reach the next battle -----------------------------------------
    await tapIn(page, 'campaign', `mission-pin-${SECOND}`);
    await tapIn(page, 'campaign', 'mission-start');
    await expect(page.getByTestId('begin')).toBeVisible();
    await expect(arrived(page, 'briefing').getByTestId('difficulty-hard')).toHaveAttribute('aria-pressed', 'true');
    await page.waitForTimeout(600);
    await shot(page, 'campaign-briefing');
    await tapIn(page, 'briefing', 'begin');
    await expect.poll(async () => (await state(page)).screen, { timeout: 20_000 }).toBe('battle');
    const battle = await state(page);
    expect(battle.missionId).toBe(SECOND);
    expect(battle.difficulty).toBe('hard');
    expect(battle.upgrades).toEqual({ hqHealth: 1, rifleDamage: 1 });
    const plainHp = CONFIG.hqHp * MISSIONS[1].start[0].hqHpMul;
    const hqMax = battle.hq[0]?.max ?? 0;
    expect(hqMax / plainHp, 'Sandbagged HQ level 1 is +12% HQ health').toBeCloseTo(1.12, 2);
    expect((await memorySave(page)).upgrades).toEqual({ hqHealth: 1, rifleDamage: 1 });
  });

  test('does not award the points of a lost battle, and a loss clears nothing', async ({ page }) => {
    test.setTimeout(300_000);
    await open(page);
    await playThroughMenus(page, FIRST, false);
    const end = await playToEnd(page, false);
    expect(end.winner).toBe(1);
    await expect(page.getByTestId('result-reason')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('result-points')).toHaveCount(0);
    await shot(page, 'campaign-result-defeat');
    const afterLoss = await savedGame(page);
    expect(afterLoss?.cleared ?? {}, 'a loss clears nothing').toEqual({});
    expect(afterLoss?.upgrades ?? {}).toEqual({});
    await tap(page, 'result-map');
    await expect.poll(() => pinState(page, FIRST)).toBe('open');
    expect(await pinStates(page)).toEqual(['open', ...Array<string>(9).fill('locked')]);
    expect(await pointsLeft(page, 'campaign')).toBe(0);
  });

  test.describe('saves that are damaged, old or impossible', () => {
    const damaged: [string, string][] = [
      ['text that is not JSON', '{{{ this is not json'],
      ['null', 'null'],
      ['an array', '[1,2,3]'],
      ['a number', '42'],
      ['a save from the future', JSON.stringify({ version: 999, cleared: { '1': ['normal'] } })],
      ['a wrong version type', '{"version":"2","cleared":{"1":["normal"]}}'],
      ['binary rubbish', '\u0000\u0001￿\ud800'],
      ['an empty string', ''],
      ['nonsense in every field', '{"version":2,"cleared":{"4":["normal"],"abc":7,"1":"x"},"upgrades":{"hqHealth":99,"ghost":1},"settings":7,"lastMission":"nine"}'],
    ];

    for (const [name, text] of damaged) {
      test(`boots to a fresh game from ${name}`, async ({ page }) => {
        await open(page);
        await storeRaw(page, text);
        await reload(page);
        await expect(page.getByTestId('play')).toBeVisible();
        const fresh = await memorySave(page);
        expect(fresh.cleared).toEqual({});
        expect(fresh.upgrades).toEqual({});
        expect(fresh.settings).toEqual({
          muted: META.defaultMuted,
          difficulty: META.defaultDifficulty,
          hints: META.defaultHints,
          musicVolume: META.defaultMusicVolume,
          ambienceVolume: META.defaultAmbienceVolume,
          sfxVolume: META.defaultSfxVolume,
          reduceFlash: META.defaultReduceFlash,
          showBlood: META.defaultShowBlood,
        });
        await tap(page, 'play');
        await expect(arrived(page, 'campaign').getByTestId(`mission-pin-${FIRST}`)).toBeVisible();
        expect(await pinStates(page)).toEqual(['open', ...Array<string>(9).fill('locked')]);
        expect(await pointsLeft(page, 'campaign')).toBe(0);
        // The game still plays and writes a good save over the bad one.
        await tap(page, 'mission-start');
        await tap(page, 'difficulty-insane');
        const stored = await savedGame(page);
        expect(stored?.version).toBe(META.saveVersion);
        expect(stored?.settings.difficulty).toBe('insane');
      });
    }

    test('keeps what is good in a save from version 1 and brings it up to date', async ({ page }) => {
      await open(page);
      await storeRaw(
        page,
        JSON.stringify({
          version: 1,
          cleared: { '1': ['normal'], '2': ['hard'] },
          upgrades: { rifleHealth: 1 },
          settings: { muted: true, difficulty: 'hard', hints: false },
        }),
      );
      await reload(page);
      const migrated = await memorySave(page);
      expect(migrated.version).toBe(META.saveVersion);
      expect(migrated.cleared).toEqual({ '1': ['normal'], '2': ['hard'] });
      expect(migrated.upgrades).toEqual({ rifleHealth: 1 });
      // The volumes, reduce flashing and show blood did not exist in version 1: they come in at their defaults.
      expect(migrated.settings).toEqual({
        muted: true,
        difficulty: 'hard',
        hints: false,
        musicVolume: META.defaultMusicVolume,
        ambienceVolume: META.defaultAmbienceVolume,
        sfxVolume: META.defaultSfxVolume,
        reduceFlash: META.defaultReduceFlash,
        showBlood: META.defaultShowBlood,
      });
      await tap(page, 'play');
      expect(await pinStates(page)).toEqual(['cleared', 'cleared', 'open', ...Array<string>(7).fill('locked')]);
      // Two missions cleared were four old points, one spent on the level kept: the three left become medals.
      expect(await pointsLeft(page, 'campaign'), 'four points earned, one spent').toBe(3 * META.legacyPointMedals);
    });

    test('takes back the points a save from before medals has spent but never earned', async ({ page }) => {
      await open(page);
      const everything = Object.fromEntries(UPGRADES.map((u) => [u.id, 3]));
      // Version 5 is the last save with upgrade points; version 6 levels were paid for in medals and are kept.
      expect(META.saveVersion).toBe(6);
      await storeRaw(page, JSON.stringify({ version: 5, cleared: { '1': ['normal'] }, upgrades: everything }));
      await reload(page);
      const clamped = await memorySave(page);
      const levels = Object.values(clamped.upgrades).reduce((sum, n) => sum + n, 0);
      expect(levels, 'one mission cleared is two points, so two levels at most').toBe(2);
      await tap(page, 'play');
      expect(await pointsLeft(page, 'campaign')).toBe(0);
      await tap(page, 'quartermaster');
      await expect(arrived(page, 'quartermaster').getByTestId('upgrade-buy-hqHealth')).toBeVisible();
      expect(await pointsLeft(page, 'quartermaster')).toBe(0);
      // And the debug hook can still set a full set for a test, which the next load clamps again.
      await page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).setUpgrades({ rifleHealth: 3, hqHealth: 3 }));
      expect((await memorySave(page)).upgrades).toEqual({ rifleHealth: 3, hqHealth: 3 });
    });
  });
});
