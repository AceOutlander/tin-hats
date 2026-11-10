/**
 * Browser smoke tests on the production build: a phone in landscape with touch.
 * They drive the real UI with taps and drags, and use the ?debug=1 hooks
 * (window.__TH) to read the simulation, grant supplies and fast-forward.
 *
 * Any console error, page error, failed request or HTTP error fails the test
 * (see the `problems` fixture in helpers.ts).
 * Screenshots of the key moments go to docs/screenshots/e2e-*.png.
 */
import { MISSIONS } from '../../src/data/missions';
import type { DebugApi } from '../../src/app/debug';
import { audioStats, BATTLE_LOAD_MS, camera, expect, fastForward, firstUnit, grantSupplies, type Hooked, open, playThroughMenus, playToEnd, reasonText, savedGame, setTimeScale, shot, startMission, state, tap, test, toMap, touchDrag, weatherStats } from './helpers';

test.describe('debug hooks', () => {
  test('are absent without ?debug=1', async ({ page, problems }) => {
    await page.goto('/');
    await expect(page.getByTestId('play')).toBeVisible({ timeout: 60_000 });
    expect(await page.evaluate(() => Reflect.has(window, '__TH'))).toBe(false);
    expect(problems).toEqual([]);
  });

  test('are present with ?debug=1', async ({ page }) => {
    await open(page);
    const s = await state(page);
    expect(s.screen).toBe('title');
    expect(s.inBattle).toBe(false);
    expect(await page.evaluate(() => Object.keys((window as unknown as Hooked).__TH as object).sort())).toEqual(
      [
        'admin',
        'audio',
        'autopilot',
        'battleMusic',
        'blood',
        'buttonRects',
        'camera',
        'campaigns',
        'field',
        'firstUnitScreenPos',
        'forceThunder',
        'forceWeather',
        'getTimeScale',
        'grantPopulation',
        'giveCharges',
        'giveMedals',
        'givePoints',
        'grantSupplies',
        'hpPips',
        'lookAt',
        'medals',
        'menuStorm',
        'missions',
        'music',
        'offerSupport',
        'perf',
        'points',
        'projectiles',
        'ready',
        'result',
        'revealEnemyHp',
        'save',
        'selectCampaign',
        'setTimeScale',
        'setUpgrades',
        'startMission',
        'startSandbox',
        'startStalingrad',
        'startTraining',
        'takeMedals',
        'takePoints',
        'state',
        'tutorial',
        'unitScreenPos',
        'units',
        'unlockAll',
        'weatherStats',
      ].sort(),
    );
  });

  test('can force weather and thunder in a battle', async ({ page }) => {
    await open(page);
    await startMission(page, MISSIONS[0].id);
    await expect.poll(async () => (await state(page)).screen).toBe('battle');
    const stats = () => weatherStats(page);
    await page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).forceWeather('rain'));
    await expect.poll(async () => (await stats()).raining).toBe(true);
    const strikes = (await stats()).strikes;
    await page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).forceThunder());
    await expect.poll(async () => (await stats()).strikes, { timeout: 10_000 }).toBeGreaterThan(strikes);
    await page.waitForTimeout(400);
    await shot(page, 'rain');
    await page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).forceWeather('clear'));
    await expect.poll(async () => (await stats()).raining).toBe(false);
  });
});

test.describe('wiring in the built game', () => {
  test('sound is unlocked by the first tap and the battle view plays through it', async ({ page }) => {
    await open(page);
    const before = await audioStats(page);
    expect(before.state, 'no sound context before a gesture').not.toBe('running');
    await toMap(page);
    await expect.poll(async () => (await audioStats(page)).state, { timeout: 10_000 }).toBe('running');
    const afterMenu = (await audioStats(page)).played;
    expect(afterMenu, 'the menu tap makes a click').toBeGreaterThan(0);

    // A battle sound that only the renderer plays (thunder) proves view.setAudio reached the view.
    await startMission(page, MISSIONS[0].id);
    await expect.poll(async () => (await state(page)).screen).toBe('battle');
    await page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).forceWeather('rain'));
    const played = (await audioStats(page)).played;
    await page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).forceThunder());
    await expect.poll(async () => (await audioStats(page)).played, { timeout: 15_000 }).toBeGreaterThan(played);
  });

  test('the weather rolls as the battle runs and the debug hooks reach it', async ({ page }) => {
    await open(page);
    await startMission(page, MISSIONS[0].id, 11);
    await expect.poll(async () => (await state(page)).screen).toBe('battle');
    // No Stalingrad mission has rain of its own (their weather is set per mission): the hook brings it, and its thunder
    // checks then roll with battle time.
    await page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).forceWeather('rain'));
    await expect.poll(async () => (await weatherStats(page)).raining).toBe(true);
    const first = await weatherStats(page);
    await setTimeScale(page, 10);
    await expect.poll(async () => (await weatherStats(page)).checksMade, { timeout: 30_000 }).toBeGreaterThan(first.checksMade + 3);
    await setTimeScale(page, 1);
  });

  test('every difficulty starts and runs the first mission at speed', async ({ page }) => {
    await open(page);
    for (const difficulty of ['normal', 'hard', 'insane'] as const) {
      expect(await startMission(page, MISSIONS[0].id, 4, difficulty)).toBe(true);
      await expect.poll(async () => (await state(page)).screen).toBe('battle');
      await expect(page.getByTestId('order-advance')).toBeVisible({ timeout: 20_000 });
      expect((await state(page)).difficulty).toBe(difficulty);
      await setTimeScale(page, 100);
      await expect.poll(async () => (await state(page)).tick, { timeout: 30_000 }).toBeGreaterThan(1500);
    }
  });

  test('the HUD shows live values and the minimap is drawn', async ({ page }) => {
    await open(page);
    await playThroughMenus(page, MISSIONS[0].id, false);
    await expect(page.locator('.th-supplies-num')).toBeVisible();

    // Supplies: a grant shows up in the HUD within a moment.
    await grantSupplies(page, 500);
    await expect.poll(async () => Number(await page.locator('.th-supplies-num').first().textContent()), { timeout: 10_000 }).toBeGreaterThanOrEqual(500);
    // Training a unit raises the headcount shown.
    const popBefore = Number(await page.locator('.th-pop-num').first().textContent());
    await tap(page, 'train-rifle');
    await expect.poll(async () => Number(await page.locator('.th-pop-num').first().textContent()), { timeout: 10_000 }).toBeGreaterThan(popBefore);

    // Frozen, the HUD equals the simulation to the digit.
    await tap(page, 'pause');
    await expect.poll(async () => (await state(page)).paused).toBe(true);
    await page.waitForTimeout(300);
    const s = await state(page);
    await expect(page.locator('.th-supplies-num').first()).toHaveText(String(s.supplies));
    await expect(page.locator('.th-pop-num').first()).toHaveText(String(s.pop));
    await expect(page.locator('.th-pop-cap').first()).toHaveText(`/${s.popCap}`);
    await tap(page, 'resume');

    // The minimap canvas is not blank: it draws terrain, units and the view frame.
    const colours = await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('.th-minimap');
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return 0;
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const seen = new Set<number>();
      for (let i = 0; i < data.length; i += 4) seen.add(((data[i] << 24) | (data[i + 1] << 16) | (data[i + 2] << 8) | data[i + 3]) >>> 0);
      return seen.size;
    });
    expect(colours, 'distinct colours on the minimap').toBeGreaterThan(2);
  });
});

test.describe('menus', () => {
  test('settings, the reset question and the Quartermaster work in the built game', async ({ page }) => {
    await open(page);
    // A screen that is leaving stays in the page for its fade; only the arriving one carries `is-in`.
    const backFrom = (screen: string) => page.locator(`.th-screen.is-in[data-screen="${screen}"] [data-testid="back"]`);

    // Settings from the title: every switch is saved.
    await tap(page, 'settings');
    await expect(page.getByTestId('setting-mute')).toBeVisible();
    await tap(page, 'setting-hints');
    await expect.poll(async () => (await savedGame(page))?.settings.hints).toBe(false);
    await tap(page, 'setting-hints');
    await expect.poll(async () => (await savedGame(page))?.settings.hints).toBe(true);
    await tap(page, 'setting-difficulty-hard');
    await expect.poll(async () => (await savedGame(page))?.settings.difficulty).toBe('hard');
    await tap(page, 'setting-difficulty-normal');
    await expect.poll(async () => (await savedGame(page))?.settings.difficulty).toBe('normal');
    await tap(page, 'setting-mute');
    await expect.poll(async () => (await savedGame(page))?.settings.muted).toBe(true);
    await tap(page, 'setting-mute');
    await expect.poll(async () => (await savedGame(page))?.settings.muted).toBe(false);
    await page.waitForTimeout(400);
    await shot(page, 'settings');

    // The reset question can be declined, and nothing is wiped.
    await tap(page, 'setting-reset');
    await expect(page.getByTestId('confirm-yes')).toBeVisible();
    await page.waitForTimeout(400);
    await shot(page, 'confirm');
    await tap(page, 'confirm-no');
    await expect(page.getByTestId('confirm-yes')).toBeHidden();
    await backFrom('settings').tap();
    await expect(page.getByTestId('play')).toBeVisible();

    // Campaign map and Quartermaster.
    await toMap(page);
    await tap(page, 'quartermaster');
    await expect(page.getByTestId('points-available').last()).toBeVisible();
    await page.waitForTimeout(500);
    await shot(page, 'quartermaster');
    await backFrom('quartermaster').tap();
    const arrived = page.locator('.th-screen.is-in');
    await expect(arrived.getByTestId(`mission-pin-${MISSIONS[0].id}`)).toBeVisible();
    await arrived.getByTestId('settings').tap();
    await backFrom('settings').tap();
    await expect(arrived.getByTestId(`mission-pin-${MISSIONS[0].id}`)).toBeVisible();
  });
});

test.describe('first battle', () => {
  test('menus, training, orders, camera, minimap, pause and mute', async ({ page, problems }) => {
    await open(page);
    await playThroughMenus(page, MISSIONS[0].id, true);

    // The battle is running and the HUD describes it.
    const start = await state(page);
    expect(start.inBattle).toBe(true);
    expect(start.missionId).toBe(MISSIONS[0].id);
    await expect.poll(async () => (await state(page)).tick, { timeout: 15_000 }).toBeGreaterThan(start.tick + 10);
    const rects = (await page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).buttonRects())) as Record<string, { w: number; h: number }>;
    for (const id of ['train-rifle', 'order-hold', 'order-advance', 'order-fallBack', 'pause', 'minimap']) {
      expect(rects[id], `HUD control ${id}`).toBeTruthy();
    }
    for (const id of ['train-rifle', 'order-hold', 'order-advance', 'order-fallBack', 'pause']) {
      expect(rects[id].w, `${id} width`).toBeGreaterThanOrEqual(44);
      expect(rects[id].h, `${id} height`).toBeGreaterThanOrEqual(44);
    }

    // Training: a tap queues a unit and spends supplies.
    const before = await state(page);
    await tap(page, 'train-rifle');
    await expect.poll(async () => (await state(page)).queue.rifle + (await state(page)).units[0].rifle, { timeout: 10_000 }).toBeGreaterThan(before.queue.rifle + before.units[0].rifle);
    await tap(page, 'train-sapper');
    await expect.poll(async () => (await state(page)).queue.sapper, { timeout: 10_000 }).toBeGreaterThan(0);
    expect((await state(page)).pop).toBeGreaterThan(before.pop);

    // Orders: each button changes the army order.
    for (const [testId, order] of [
      ['order-advance', 'advance'],
      ['order-fallBack', 'fallBack'],
      ['order-hold', 'hold'],
    ] as const) {
      await tap(page, testId);
      await expect.poll(async () => (await state(page)).order, { timeout: 10_000 }).toBe(order);
    }

    // A tap on a friendly soldier is harmless while direct control is not in the sim yet.
    const soldier = await firstUnit(page, 0, 'rifle');
    if (soldier) {
      await page.touchscreen.tap(soldier.x, soldier.y);
      await page.waitForTimeout(200);
      expect((await state(page)).inBattle).toBe(true);
    }

    // Camera: dragging the battlefield pans it, with a finger and with a mouse.
    await tap(page, 'order-hold');
    await page.waitForTimeout(500);
    const cam0 = await camera(page);
    await touchDrag(page, { x: 640, y: 190 }, { x: 380, y: 190 });
    await page.waitForTimeout(700);
    const cam1 = await camera(page);
    expect(cam1.centerX, 'a finger dragging left moves the view right').toBeGreaterThan(cam0.centerX + 60);
    expect(cam1.length).toBeGreaterThan(cam1.viewWidthWu);
    // Lower than the finger's drag: Brest opens on its prep phase, whose panel sits mid-screen from x 330 to 510.
    await page.mouse.move(380, 250);
    await page.mouse.down();
    await page.mouse.move(520, 250, { steps: 6 });
    await page.mouse.move(640, 250, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(700);
    expect((await camera(page)).centerX, 'a mouse dragging right moves the view left').toBeLessThan(cam1.centerX - 40);

    // Minimap: a tap jumps the camera to that part of the map.
    const map = await page.getByTestId('minimap').boundingBox();
    expect(map).not.toBeNull();
    if (map) {
      await page.touchscreen.tap(map.x + map.width * 0.5, map.y + map.height / 2);
      await page.waitForTimeout(400);
      const cam2 = await camera(page);
      expect(Math.abs(cam2.centerX - cam2.length * 0.5)).toBeLessThan(cam2.length * 0.06 + 60);
      await page.touchscreen.tap(map.x + map.width * 0.15, map.y + map.height / 2);
      await page.waitForTimeout(400);
      const cam3 = await camera(page);
      expect(cam3.centerX).toBeLessThan(cam2.centerX - 100);
    }
    await shot(page, 'battle');

    // Pause and resume.
    await tap(page, 'pause');
    await expect.poll(async () => (await state(page)).paused).toBe(true);
    const frozen = (await state(page)).tick;
    await page.waitForTimeout(600);
    expect((await state(page)).tick).toBe(frozen);
    await expect(page.getByTestId('resume')).toBeVisible();
    await shot(page, 'paused');
    await tap(page, 'resume');
    await expect.poll(async () => (await state(page)).paused).toBe(false);
    await expect.poll(async () => (await state(page)).tick, { timeout: 10_000 }).toBeGreaterThan(frozen + 5);

    // Restart begins a new battle; Quit to map goes back to the campaign.
    await tap(page, 'pause');
    await expect.poll(async () => (await state(page)).paused).toBe(true);
    await tap(page, 'restart');
    await expect.poll(async () => (await state(page)).tick, { timeout: 10_000 }).toBeLessThan(frozen);
    expect((await state(page)).paused).toBe(false);

    // Losing focus pauses; coming back never resumes by itself.
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect.poll(async () => (await state(page)).paused).toBe(true);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    const stillFrozen = (await state(page)).tick;
    await page.waitForTimeout(500);
    expect((await state(page)).tick).toBe(stillFrozen);
    expect((await state(page)).paused).toBe(true);
    await tap(page, 'resume');
    await expect.poll(async () => (await state(page)).paused).toBe(false);

    // Quit to map.
    await tap(page, 'pause');
    await tap(page, 'quit');
    await expect(page.getByTestId(`mission-pin-${MISSIONS[0].id}`)).toBeVisible();
    expect((await state(page)).inBattle).toBe(false);

    // Mute is saved (back in a battle, where the HUD button is).
    await startMission(page, MISSIONS[0].id);
    await expect(page.getByTestId('mute')).toBeVisible();
    await tap(page, 'mute');
    await expect.poll(async () => (await savedGame(page))?.settings.muted).toBe(true);
    await tap(page, 'mute');
    await expect.poll(async () => (await savedGame(page))?.settings.muted).toBe(false);

    // The engine keeps up: report timings.
    const perf = await page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).perf());
    expect(perf.fps).toBeGreaterThan(0);
    expect(Number.isFinite(perf.stepMsAvg)).toBe(true);
    expect(Number.isFinite(perf.renderMsAvg)).toBe(true);
    expect(problems).toEqual([]);
  });

  test('a hidden tab pauses the battle', async ({ page }) => {
    await open(page);
    await startMission(page, MISSIONS[0].id);
    await expect.poll(async () => (await state(page)).screen).toBe('battle');
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect.poll(async () => (await state(page)).paused).toBe(true);
  });

  test('a phone held upright pauses the battle and shows the rotate message', async ({ page }) => {
    await open(page);
    await startMission(page, MISSIONS[0].id);
    await expect.poll(async () => (await state(page)).screen).toBe('battle');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('rotate-overlay')).toBeVisible();
    await expect.poll(async () => (await state(page)).paused).toBe(true);
    await shot(page, 'rotate');
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.getByTestId('rotate-overlay')).toBeHidden();
    expect((await state(page)).paused).toBe(true);
  });
});

test.describe('whole battles at high speed', () => {
  test('mission 1 is won through the menus and the progress survives a reload', async ({ page }) => {
    await open(page);
    await playThroughMenus(page, MISSIONS[0].id, false);
    const end = await playToEnd(page, true);
    expect(end.winner, 'a player who keeps buying riflemen and advances wins mission 1').toBe(0);

    await expect(page.getByTestId('result-reason')).toBeVisible({ timeout: 30_000 });
    // Brest is a survival mission: the win is holding out to the end (the result screen words it as the app does).
    await expect(page.getByTestId('result-reason')).toHaveText(reasonText(end));
    await expect(page.getByTestId('result-points')).toBeVisible();
    await shot(page, 'result-win');

    const saved = await savedGame(page);
    expect(saved?.cleared[String(MISSIONS[0].id)]).toEqual(['normal']);
    // The medals of the win, which the map shows to spend after a reload.
    const award = (await page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).result()))?.pointsAwarded ?? 0;
    expect(award).toBeGreaterThan(0);

    // Back to the map, then replay from the briefing.
    await tap(page, 'result-map');
    await expect(page.getByTestId(`mission-pin-${MISSIONS[0].id}`)).toBeVisible();
    await tap(page, 'mission-start');
    await tap(page, 'begin');
    await expect.poll(async () => (await state(page)).screen, { timeout: BATTLE_LOAD_MS }).toBe('battle');
    expect((await state(page)).tick).toBeLessThan(600);

    await page.reload();
    await page.waitForFunction(() => (window as unknown as Hooked).__TH?.ready === true, null, { timeout: 60_000 });
    expect((await savedGame(page))?.cleared[String(MISSIONS[0].id)]).toEqual(['normal']);
    await toMap(page);
    await expect(page.getByTestId('points-available')).toHaveText(String(award));
    if (MISSIONS.length > 1) {
      await page.getByTestId(`mission-pin-${MISSIONS[1].id}`).tap();
      await expect(page.getByTestId('mission-start')).toBeEnabled();
    }
  });

  for (const mission of MISSIONS) {
    test(`mission ${mission.id} (${mission.key}): a keen player trains, orders, pans and fast-forwards to a result screen`, async ({ page }) => {
      await open(page);
      expect(await startMission(page, mission.id)).toBe(true);
      await expect.poll(async () => (await state(page)).screen).toBe('battle');
      await expect(page.getByTestId('order-advance')).toBeVisible({ timeout: 20_000 });

      // Train and give every order with real taps.
      const before = await state(page);
      await tap(page, 'train-rifle');
      await expect.poll(async () => (await state(page)).queue.rifle + (await state(page)).units[0].rifle, { timeout: 10_000 }).toBeGreaterThan(before.queue.rifle + before.units[0].rifle);
      for (const [testId, order] of [
        ['order-advance', 'advance'],
        ['order-fallBack', 'fallBack'],
        ['order-hold', 'hold'],
      ] as const) {
        await tap(page, testId);
        await expect.poll(async () => (await state(page)).order, { timeout: 10_000 }).toBe(order);
      }

      // Pan the camera with a finger, on open ground under the prep panel of a defensive mission (mid-screen, up to x 640).
      await page.waitForTimeout(400);
      const cam0 = await camera(page);
      await touchDrag(page, { x: 700, y: 250 }, { x: 440, y: 250 });
      await page.waitForTimeout(600);
      expect((await camera(page)).centerX, 'the camera pans').toBeGreaterThan(cam0.centerX + 60);

      // Fast-forward to the end. A keen player of riflemen alone can stand for an hour and more before the last belt
      // of mission 10 and its King Tiger ("Rifles will not trouble it"), so after a while he stops and the battle
      // runs on at top speed until it ends, whoever wins (DECISIONS 322).
      test.setTimeout(420_000);
      const end = await fastForward(page, 100_000, 280_000);
      if (mission.id === MISSIONS[0].id) expect(end.winner).toBe(0);
      await expect(page.getByTestId('result-reason')).toBeVisible({ timeout: 30_000 });
      const won = end.winner === 0;
      await expect(page.getByTestId('result-reason')).toHaveText(reasonText(end));
      const saved = await savedGame(page);
      expect(Boolean(saved?.cleared[String(mission.id)]), 'progress is saved exactly when the mission was won').toBe(won);
    });

    test(`mission ${mission.id} (${mission.key}): a player who does nothing sees the battle end`, async ({ page }) => {
      await open(page);
      expect(await startMission(page, mission.id)).toBe(true);
      await expect.poll(async () => (await state(page)).screen).toBe('battle');
      const end = await playToEnd(page, false);
      if (mission.mode === 'assault') {
        expect(end.winner, 'a passive player loses an assault mission').toBe(1);
        // Lost with the HQ, or to the mission's clock (1010 the Ring's deadline comes first, DECISIONS 437).
        if (end.endReason === 'hqDestroyed') expect(end.hq[0]?.hp ?? 0).toBeLessThanOrEqual(0);
        else expect(['timerExpired', 'objectiveFailed']).toContain(end.endReason);
      }
      await expect(page.getByTestId('result-reason')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('result-reason')).toHaveText(reasonText(end));
      if (end.winner !== 0) {
        await shot(page, `result-lose-${mission.id}`);
        expect((await savedGame(page))?.cleared ?? {}, 'a loss clears nothing').toEqual({});
        // Retry starts the same mission again.
        await tap(page, 'result-retry');
        await expect.poll(async () => (await state(page)).screen, { timeout: BATTLE_LOAD_MS }).toBe('battle');
        expect((await state(page)).missionId).toBe(mission.id);
      }
    });
  }
});
