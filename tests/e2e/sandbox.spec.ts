/**
 * Phase 2 in the real game: the proving ground (every unit and call-in for both sides, trenches, pillboxes, wire)
 * on the production build, in a phone-sized landscape viewport with touch. Everything the player does here is a
 * real tap, drag or key press; the debug hooks only grant supplies and population, set the time scale and read
 * the sim back. Pictures go to docs/screenshots/e2e-sandbox-*.png.
 */
import type { Page } from '@playwright/test';
import type { SupportKind, UnitKind } from '../../src/data/schema';
import {
  Fingers,
  buttonRects,
  camera,
  centreOf,
  expect,
  firstUnit,
  grantPopulation,
  grantSupplies,
  lookAt,
  open,
  setTimeScale,
  shot,
  startMission,
  startSandbox,
  state,
  tap,
  tapIfThere,
  tapWorld,
  test,
  units,
  waitForState,
} from './helpers';

/** The nine unit buttons of the proving ground, in HUD order (the King Tiger is not trainable). */
const TRAIN_KINDS: readonly UnitKind[] = ['sapper', 'rifle', 'lmg', 'assault', 'mortar', 'sniper', 'medic', 'at', 'tank'];
const SUPPORTS: readonly SupportKind[] = ['artillery', 'smoke', 'airStrike'];
/** Where a lone rifleman stands to meet the enemy's first push (world x), well ahead of the British trench at 1700. */
const FRONT_X = 2700;
/** The phone screens the HUD is built for, smallest first (CSS px). */
const VIEWPORTS = [
  { w: 568, h: 320 },
  { w: 667, h: 375 },
  { w: 844, h: 390 },
] as const;

async function begin(page: Page, seed: number): Promise<void> {
  await open(page);
  expect(await startSandbox(page, seed)).toBe(true);
  await expect.poll(async () => (await state(page)).screen, { timeout: 20_000 }).toBe('battle');
  await expect(page.getByTestId('order-hold')).toBeVisible({ timeout: 20_000 });
}

const unitPos = (page: Page, id: number) =>
  page.evaluate((k) => (window as unknown as { __TH: { unitScreenPos(id: number): { x: number; y: number } | null } }).__TH.unitScreenPos(k), id);

test.describe('proving ground (Phase 2)', () => {
  test('the sandbox is never part of the campaign and never touches the save', async ({ page }) => {
    await open(page);
    await expect(page.getByTestId('play')).toBeVisible();
    await tap(page, 'play');
    await expect(page.getByTestId('mission-pin-1')).toBeVisible();
    await expect(page.getByTestId('mission-pin-901')).toHaveCount(0);
    expect(await startSandbox(page, 1, true)).toBe(true);
    await expect.poll(async () => (await state(page)).missionId).toBe(902);
    expect(await page.evaluate(() => window.localStorage.getItem('tinhats.save'))).toBeNull();
  });

  test('trains one of every unit kind with real taps', async ({ page }) => {
    await begin(page, 21);
    await setTimeScale(page, 1);
    await grantSupplies(page, 5000);
    await grantPopulation(page, 40);
    for (const kind of TRAIN_KINDS) await expect(page.getByTestId(`train-${kind}`)).toBeAttached();
    await expect(page.getByTestId('train-heavyTank')).toHaveCount(0);
    const before = (await state(page)).units[0];

    for (const kind of TRAIN_KINDS) {
      await tap(page, `train-${kind}`);
      await expect.poll(async () => (await state(page)).queue[kind], { message: `${kind} queued` }).toBeGreaterThan(0);
    }
    await shot(page, 'sandbox-training');

    await setTimeScale(page, 30);
    await waitForState(page, 'one of every kind trained', (s) => TRAIN_KINDS.every((k) => s.units[0][k] > before[k]), 60_000);
    await setTimeScale(page, 1);
    const after = await state(page);
    for (const kind of TRAIN_KINDS) expect(after.queue[kind], `${kind} queue drained`).toBe(0);
  });

  for (const size of VIEWPORTS) {
    test(`the training bar holds all nine unit buttons at ${size.w}x${size.h}`, async ({ page }) => {
      await page.setViewportSize({ width: size.w, height: size.h });
      await begin(page, 22);
      await setTimeScale(page, 0);
      await grantSupplies(page, 5000);
      await grantPopulation(page, 40);
      await page.waitForTimeout(400);
      await shot(page, `sandbox-hud-${size.w}x${size.h}`);

      for (const kind of TRAIN_KINDS) {
        const button = page.getByTestId(`train-${kind}`);
        // Playwright scrolls the bar and refuses the tap if anything covers the button.
        await button.tap({ timeout: 10_000 });
        const rects = await buttonRects(page);
        const me = rects[`train-${kind}`];
        expect(me.w, `${kind} button width`).toBeGreaterThanOrEqual(48);
        expect(me.h, `${kind} button height`).toBeGreaterThanOrEqual(48);
        const orders = rects['order-fallBack'];
        const bar = rects['order-hold'];
        expect(me.x + me.w, `${kind} stays left of the orders`).toBeLessThanOrEqual(orders.x + 1);
        expect(bar.y, 'orders and units share the bottom bar').toBeGreaterThan(size.h / 2);
        expect(me.y + me.h, `${kind} on screen`).toBeLessThanOrEqual(size.h);
      }
      await setTimeScale(page, 1);
      await expect.poll(async () => {
        const s = await state(page);
        return TRAIN_KINDS.every((k) => s.queue[k] > 0);
      }).toBe(true);
      // The supports sit on the left edge and must not run into the training bar.
      const rects = await buttonRects(page);
      for (const kind of SUPPORTS) {
        const support = rects[`support-${kind}`];
        expect(support, `${kind} button shown`).toBeTruthy();
        expect(support.y + support.h).toBeLessThanOrEqual(rects['train-sapper'].y + 1);
      }
      await tap(page, 'train-sapper');
      await shot(page, `sandbox-hud-${size.w}x${size.h}-queued`);
    });
  }

  for (const size of VIEWPORTS) {
    test(`the direct-control controls fit at ${size.w}x${size.h}`, async ({ page }) => {
      await page.setViewportSize({ width: size.w, height: size.h });
      await begin(page, 43);
      await setTimeScale(page, 1);
      const grenadier = (await units(page)).find((u) => u.side === 0 && u.kind === 'assault' && !u.inside);
      if (!grenadier) throw new Error('the proving ground starts with assault troops');
      await lookAt(page, grenadier.x);
      await expect.poll(async () => (await firstUnit(page, 0, 'assault')) !== null).toBe(true);
      const where = await firstUnit(page, 0, 'assault');
      if (!where) throw new Error('no assault trooper on screen');
      await page.touchscreen.tap(where.x, where.y);
      await expect.poll(async () => (await state(page)).controlled?.kind, { message: 'control taken' }).toBe('assault');
      await expect(page.getByTestId('ability')).toBeVisible();
      await page.waitForTimeout(500);
      await shot(page, `sandbox-control-hud-${size.w}x${size.h}`);

      const rects = await buttonRects(page);
      const names = ['stick', 'release', 'ability', 'fire', 'order-fallBack', 'order-hold', 'order-advance', ...SUPPORTS.map((k) => `support-${k}`)];
      for (const name of names) expect(rects[name], `${name} is shown`).toBeTruthy();
      for (const name of ['release', 'ability', 'fire']) {
        expect(Math.min(rects[name].w, rects[name].h), `${name} is a big enough target`).toBeGreaterThanOrEqual(44);
      }
      for (let i = 0; i < names.length; i++) {
        for (let j = i + 1; j < names.length; j++) {
          const a = rects[names[i]];
          const b = rects[names[j]];
          const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
          expect(apart, `${names[i]} and ${names[j]} do not overlap`).toBe(true);
        }
      }
      expect(rects['train-sapper'].x, 'the training bar starts right of the joystick').toBeGreaterThanOrEqual(rects.stick.x + rects.stick.w);
      for (const name of ['ability', 'release', 'fire']) {
        const fits = await page.getByTestId(name).locator('.th-fbtn-label').evaluate((n) => n.scrollWidth <= n.clientWidth + 1);
        expect(fits, `${name} label is not cut off`).toBe(true);
      }
      await tap(page, 'release');
      await expect.poll(async () => (await state(page)).controlled).toBeNull();
    });
  }

  test('a mission shows only the units and call-ins it allows', async ({ page }) => {
    await open(page);
    expect(await startMission(page, 1)).toBe(true);
    await expect(page.getByTestId('order-hold')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('train-rifle')).toBeVisible();
    await expect(page.getByTestId('train-sapper')).toBeVisible();
    for (const kind of TRAIN_KINDS.filter((k) => k !== 'rifle' && k !== 'sapper')) {
      await expect(page.getByTestId(`train-${kind}`), `${kind} is not in mission 1`).toHaveCount(0);
    }
    for (const kind of SUPPORTS) await expect(page.getByTestId(`support-${kind}`)).toHaveCount(0);
    expect((await state(page)).supports.artillery.available).toBe(false);
  });

  test('calls each support with real taps, cancels one, and the sim receives them', async ({ page }) => {
    await begin(page, 31);
    await setTimeScale(page, 1);
    await lookAt(page, 1500);
    await expect(page.getByTestId('support-artillery')).toBeVisible();

    // Aim, then cancel with the banner button: nothing is called.
    await tap(page, 'support-artillery');
    await expect.poll(async () => (await state(page)).targeting).toBe('artillery');
    await expect(page.getByTestId('cancel-targeting')).toBeVisible();
    await expect(page.getByText('Tap the battlefield')).toBeVisible();
    await page.waitForTimeout(300);
    await shot(page, 'sandbox-targeting');
    await tap(page, 'cancel-targeting');
    await expect.poll(async () => (await state(page)).targeting).toBeNull();
    // Aim again and tap the same support button: that cancels too. Escape does as well.
    await tap(page, 'support-smoke');
    await expect.poll(async () => (await state(page)).targeting).toBe('smoke');
    await tap(page, 'support-smoke');
    await expect.poll(async () => (await state(page)).targeting).toBeNull();
    await tap(page, 'support-airStrike');
    await expect.poll(async () => (await state(page)).targeting).toBe('airStrike');
    await expect(page.getByTestId('cancel-targeting')).toBeVisible(); // the HUD has caught up with the sim
    await page.keyboard.press('Escape');
    await expect.poll(async () => (await state(page)).targeting).toBeNull();
    // A tap on the battlefield with nothing aimed calls nothing.
    await tapWorld(page, 1600);
    await page.waitForTimeout(300);
    const idle = await state(page);
    for (const kind of SUPPORTS) {
      expect(idle.tally.supportCalled[kind]).toBe(0);
      expect(idle.supports[kind].cooldown).toBe(0);
    }

    // Now call each one for real.
    const at: Record<SupportKind, number> = { smoke: 1450, artillery: 1900, airStrike: 1650 };
    for (const kind of SUPPORTS) {
      const blasts = (await state(page)).tally.explosion;
      await tap(page, `support-${kind}`);
      await expect.poll(async () => (await state(page)).targeting, { message: `${kind} aimed` }).toBe(kind);
      await tapWorld(page, at[kind]);
      await expect.poll(async () => (await state(page)).tally.supportCalled[kind], { message: `${kind} reached the sim` }).toBe(1);
      const called = await state(page);
      expect(called.targeting, 'aiming ends with the call').toBeNull();
      expect(called.supports[kind].cooldown, `${kind} cooldown started`).toBeGreaterThan(0);
      const button = page.getByTestId(`support-${kind}`);
      await expect(button).not.toHaveClass(/is-ready/);
      await expect(button.locator('.th-sbtn-sec')).toHaveText(/^\d+/);
      expect(await button.locator('.th-sweep').evaluate((n) => getComputedStyle(n).getPropertyValue('--p').trim())).not.toBe('');
      // A second tap on the field does not call it again, and the button refuses while it cools down.
      await tap(page, `support-${kind}`);
      await tapWorld(page, at[kind] + 40);
      await page.waitForTimeout(200);
      expect((await state(page)).tally.supportCalled[kind]).toBe(1);
      expect((await state(page)).targeting).toBeNull();

      await setTimeScale(page, 4);
      await waitForState(page, `${kind} rounds on the way`, (s) => s.tally.supportIncoming[kind] >= 1, 30_000);
      if (kind === 'smoke') {
        await waitForState(page, 'a smoke cloud', (s) => s.smokes >= 1 && s.tally.smokeSpawned >= 1, 30_000);
        await shot(page, 'sandbox-smoke');
      } else {
        await waitForState(page, `${kind} blasts`, (s) => s.tally.explosion > blasts, 30_000);
      }
      await setTimeScale(page, 1);
    }
    const end = await state(page);
    for (const kind of SUPPORTS) expect(end.tally.supportCalled[kind]).toBe(1);
    await shot(page, 'sandbox-supports-cooling');
  });

  test('takes direct control of a rifleman with a tap, drives it, fires and lets go', async ({ page }) => {
    await begin(page, 41);
    await setTimeScale(page, 1);
    await grantSupplies(page, 4000);
    await grantPopulation(page, 40);
    await lookAt(page, 1700);
    await expect.poll(async () => (await firstUnit(page, 0, 'rifle')) !== null, { message: 'a rifleman on screen' }).toBe(true);
    const where = await firstUnit(page, 0, 'rifle');
    if (!where) throw new Error('no rifleman on screen');

    // Tap the man himself.
    await page.touchscreen.tap(where.x, where.y);
    await expect.poll(async () => (await state(page)).controlled?.kind, { message: 'control taken' }).toBe('rifle');
    const taken = await state(page);
    expect(taken.controlled?.inTrench, 'he starts in the trench').toBe(true);
    await expect(page.getByTestId('release')).toBeVisible();
    await expect(page.getByTestId('fire')).toBeVisible();
    await expect(page.getByTestId('stick')).toBeVisible();
    await expect(page.getByTestId('ability')).toBeHidden();
    await page.waitForTimeout(400);
    await shot(page, 'sandbox-control');

    // The joystick: put a thumb on it and push right. The man walks and the view follows him.
    const fingers = await Fingers.attach(page);
    try {
      const stick = await page.getByTestId('stick').boundingBox();
      if (!stick) throw new Error('no joystick');
      const cx = stick.x + stick.width / 2;
      const cy = stick.y + stick.height / 2;
      const startX = taken.controlled?.x ?? 0;
      const camStart = (await camera(page)).centerX;
      await setTimeScale(page, 4);
      await fingers.press(0, cx, cy);
      await fingers.move(0, cx + stick.width / 2 - 8, cy);
      await waitForState(page, 'walking right', (s) => (s.controlled?.x ?? 0) > startX + 250, 30_000);
      expect((await state(page)).controlled?.inTrench, 'he left the trench').toBe(false);
      expect((await camera(page)).centerX, 'the camera followed him').toBeGreaterThan(camStart + 40);
      await shot(page, 'sandbox-control-walking');
      // Push left, back toward the trench, then let the stick go: he stops.
      await setTimeScale(page, 2);
      await fingers.move(0, cx - stick.width / 2 + 8, cy);
      await waitForState(page, 'walking left', (s) => (s.controlled?.x ?? 9999) < startX + 100, 40_000);
      await fingers.liftAll();
      await setTimeScale(page, 1);
      await page.waitForTimeout(300);
      const parked = (await state(page)).controlled?.x ?? 0;
      await page.waitForTimeout(500);
      expect(Math.abs(((await state(page)).controlled?.x ?? parked) - parked), 'he stops with the stick released').toBeLessThan(5);

      // Out to the front, where the enemy's push will meet him before its artillery finds the trench.
      await setTimeScale(page, 6);
      await fingers.press(0, cx, cy);
      await fingers.move(0, cx + stick.width / 2 - 8, cy);
      await waitForState(page, 'out at the front', (s) => (s.controlled?.x ?? 0) > FRONT_X, 60_000);
      await fingers.liftAll();

      // FIRE, held with a second thumb while the first rests on the stick. Wait for the enemy to come into range.
      const fire = await centreOf(page, 'fire');
      await setTimeScale(page, 12);
      await fingers.press(0, cx, cy);
      await fingers.press(1, fire.x, fire.y);
      await expect(page.getByTestId('fire')).toHaveClass(/is-down/);
      await waitForState(page, 'shots from the controlled man', (s) => s.tally.controlledShots > 0 || s.controlled === null, 150_000);
      await shot(page, 'sandbox-control-firing');
    } finally {
      await fingers.detach();
    }
    await setTimeScale(page, 1);

    const fired = await state(page);
    expect(fired.tally.controlledShots, 'the controlled rifleman fired').toBeGreaterThan(0);
    if (fired.controlled !== null) {
      await tap(page, 'release');
      await expect.poll(async () => (await state(page)).controlled).toBeNull();
    } else {
      // He was killed after firing: the sim said so and the HUD cleared at once.
      expect(fired.tally.controlLost).toBeGreaterThan(0);
    }
    await expect(page.getByTestId('release')).toBeHidden();
    await expect(page.getByTestId('stick')).toBeHidden();
    await expect(page.getByTestId('fire')).toBeHidden();
    await shot(page, 'sandbox-control-released');
  });

  test('the keyboard drives a controlled man, and a second tap on him lets go', async ({ page }) => {
    await begin(page, 42);
    await setTimeScale(page, 1);
    await lookAt(page, 1700);
    await expect.poll(async () => (await firstUnit(page, 0, 'rifle')) !== null).toBe(true);
    const where = await firstUnit(page, 0, 'rifle');
    if (!where) throw new Error('no rifleman on screen');
    await page.touchscreen.tap(where.x, where.y);
    await expect.poll(async () => (await state(page)).controlled?.kind).toBe('rifle');
    const id = (await state(page)).controlled?.id ?? -1;
    const startX = (await state(page)).controlled?.x ?? 0;

    await setTimeScale(page, 3);
    await page.keyboard.down('KeyD');
    await waitForState(page, 'D walks him right', (s) => (s.controlled?.x ?? 0) > startX + 150, 30_000);
    await page.keyboard.up('KeyD');
    await page.keyboard.down('Space');
    await page.keyboard.up('Space');
    await setTimeScale(page, 1);

    // Tap him again, right where he stands now.
    await page.waitForTimeout(300);
    const pos = await unitPos(page, id);
    if (!pos) throw new Error('the controlled man left the screen');
    await page.touchscreen.tap(pos.x, pos.y);
    await expect.poll(async () => (await state(page)).controlled, { message: 'second tap releases' }).toBeNull();
    await expect(page.getByTestId('release')).toBeHidden();

    // Take him again and let go with R.
    const again = await unitPos(page, id);
    if (!again) throw new Error('the man left the screen');
    await page.touchscreen.tap(again.x, again.y);
    await expect.poll(async () => (await state(page)).controlled?.id).toBe(id);
    await page.keyboard.press('KeyR');
    await expect.poll(async () => (await state(page)).controlled).toBeNull();
  });

  test('wins ground: a trench changes hands and a pillbox is destroyed', async ({ page }) => {
    await begin(page, 11);
    await grantPopulation(page, 80);
    await setTimeScale(page, 40);
    const start = await state(page);
    const enemyTrench = start.trenches.find((t) => t.owner === 1);
    expect(enemyTrench, 'the proving ground has a German trench').toBeTruthy();
    expect(start.pillboxes.every((p) => p.alive && p.hp === p.maxHp)).toBe(true);

    // A keen player with plenty of supplies: tanks and riflemen with their mortars, anti-tank teams and medics,
    // held at the line until the army is big, then sent forward.
    let advanced = false;
    const army = ['rifle', 'tank', 'rifle', 'mortar', 'at', 'assault', 'rifle', 'medic'] as const;
    const deadline = Date.now() + 150_000;
    let s = start;
    const summary = (): string =>
      JSON.stringify({ time: Math.round(s.time), over: s.over, winner: s.winner, mine: s.units[0], theirs: s.units[1], trenches: s.trenches, pillboxes: s.pillboxes.map((p) => (p.alive ? Math.round(p.hp) : 0)) });
    while (Date.now() < deadline && !s.over) {
      await grantSupplies(page, 1500);
      for (const kind of army) await tapIfThere(page, `train-${kind}`);
      if (!advanced && s.units[0].rifle >= 10 && s.units[0].tank >= 2) {
        await tapIfThere(page, 'order-advance');
        advanced = true;
      }
      await page.waitForTimeout(250);
      s = await state(page);
      if (s.trenches.some((t) => t.owner === 0 && t.id !== 1) && s.pillboxes.some((p) => !p.alive)) break;
    }
    expect(advanced, `the army was sent forward ${summary()}`).toBe(true);
    expect(s.tally.trenchCaptured, `a trench changed owner ${summary()}`).toBeGreaterThan(0);
    expect(s.trenches.filter((t) => t.owner === 0).length, `the player holds a captured trench ${summary()}`).toBeGreaterThan(1);
    expect(s.pillboxes.some((p) => !p.alive), `a pillbox is rubble ${summary()}`).toBe(true);
    expect(s.tally.structureDestroyed).toBeGreaterThan(0);
    expect(s.hq[0]?.hp ?? 0).toBeGreaterThan(0);

    await setTimeScale(page, 1);
    const trench = s.trenches.find((t) => t.owner === 0 && t.id !== 1);
    await lookAt(page, (trench?.x ?? 4700) + 150);
    await page.waitForTimeout(800);
    await shot(page, 'sandbox-captured');
  });
});
