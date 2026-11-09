/**
 * Basic Training in the built game: offered on the title screen on first launch and skippable, started from its own
 * button, walked through lesson by lesson with real taps (the debug hooks say which lesson is up), its one-time medal
 * reward, the Armoury after it, and quitting back to the title.
 * Pictures: docs/screenshots/basic-training-*.png
 */
import type { Page } from '@playwright/test';
import { join } from 'node:path';
import type { DebugApi } from '../../src/app/debug';
import { MEDALS } from '../../src/data/medals';
import { BASIC_TRAINING, BASIC_TRAINING_ID } from '../../src/data/missions/training';
import {
  SHOT_DIR,
  arrived,
  expect,
  grantSupplies,
  lookAt,
  memorySave,
  open,
  savedGame,
  setTimeScale,
  state,
  tap,
  tapIfThere,
  tapIn,
  tapWorld,
  test,
  touchDrag,
  units,
  type Hooked,
} from './helpers';

type TutorialInfo = ReturnType<DebugApi['tutorial']>;

const tutorial = (page: Page): Promise<TutorialInfo> => page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).tutorial());
const bubble = (page: Page) => page.getByTestId('tip');

async function picture(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: join(SHOT_DIR, `basic-training-${name}.png`) });
}

/** The lesson on screen, polled until it is `id` (the clock may run fast meanwhile). */
async function waitForLesson(page: Page, id: string, timeout = 90_000): Promise<void> {
  await expect.poll(async () => (await tutorial(page))?.tip?.id ?? null, { timeout, message: `lesson ${id}` }).toBe(id);
  await expect(bubble(page)).toBeVisible();
}

/** The control the lesson points at pulses, and nothing else does. */
async function expectGlow(page: Page, selector: string): Promise<void> {
  await expect(page.locator(selector)).toHaveClass(/th-glow/);
  await expect(page.locator('.th-glow')).toHaveCount(1);
}

/** The lesson ends (the bubble goes) once the player has done the thing. */
async function lessonEnds(page: Page, id: string): Promise<void> {
  await expect.poll(async () => (await tutorial(page))?.tip?.id ?? null, { message: `lesson ${id} ends` }).not.toBe(id);
}

test.describe('Basic Training', () => {
  test('is offered on the title screen on first launch, and the offer can be turned down for good', async ({ page }) => {
    await open(page);
    const offer = page.getByTestId('training-offer');
    await expect(offer).toBeVisible();
    await expect(offer).toContainText(`${MEDALS.trainingReward} medals`);
    await expect(page.getByTestId('basic-training')).toBeVisible();
    await expect(page.getByTestId('basic-training')).toHaveClass(/is-offered/);
    // Play is still the first button, and nothing covers it.
    await expect(page.getByTestId('play')).toBeVisible();
    const size = page.viewportSize();
    for (const id of ['play', 'basic-training', 'settings', 'training-skip']) {
      const box = await page.getByTestId(id).boundingBox();
      expect(box, id).not.toBeNull();
      if (box && size) {
        expect(box.y + box.height, `${id} on screen`).toBeLessThanOrEqual(size.height);
        expect(box.x + box.width, `${id} on screen`).toBeLessThanOrEqual(size.width);
      }
    }
    await page.waitForTimeout(600);
    await picture(page, 'title');
    expect(await savedGame(page), 'looking at the offer stores nothing').toBeNull();

    await tap(page, 'training-skip');
    await expect(offer).toBeHidden();
    await expect(page.getByTestId('basic-training')).toBeVisible();
    await expect(page.getByTestId('basic-training')).not.toHaveClass(/is-offered/);
    await expect.poll(async () => ((await savedGame(page)) as unknown as { training?: unknown } | null)?.training).toEqual({ done: false, skipped: true });
    await page.reload();
    await page.waitForFunction(() => (window as unknown as Hooked).__TH?.ready === true, null, { timeout: 60_000 });
    await expect(page.getByTestId('basic-training')).toBeVisible();
    await expect(page.getByTestId('training-offer')).toBeHidden();
  });

  test('walks a new player through every lesson with real taps, pays its reward once and opens the Armoury', async ({ page }) => {
    test.setTimeout(900_000);
    await open(page);
    await tap(page, 'basic-training');
    await expect.poll(async () => (await state(page)).screen, { timeout: 20_000 }).toBe('battle');
    expect((await state(page)).missionId).toBe(BASIC_TRAINING_ID);
    expect((await state(page)).difficulty).toBe('normal');
    await expect(page.getByTestId('order-advance')).toBeVisible({ timeout: 20_000 });
    const total = (await tutorial(page))?.total ?? 0;
    expect(total).toBeGreaterThan(10);

    // Welcome: a floating bubble, closed with its own button.
    await waitForLesson(page, 'welcome');
    await expect(page.locator('.th-glow')).toHaveCount(0);
    await picture(page, '1-welcome');
    await tap(page, 'tip-dismiss');

    // Building in the prep phase: the bubble sits under the Barbed Wire button, which pulses; place a belt by touch.
    await waitForLesson(page, 'prepPhase');
    await expectGlow(page, '[data-testid="build-wire"]');
    await picture(page, '1b-prep');
    await tap(page, 'build-wire');
    await lookAt(page, 1250);
    await tapWorld(page, 1250, 0.62);
    await expect(page.getByTestId('build-confirm')).toBeEnabled();
    await tap(page, 'build-confirm');
    await lessonEnds(page, 'prepPhase');
    await tap(page, 'prep-ready');
    await expect(page.getByTestId('prep-panel')).toBeHidden();

    // Money and sappers: the bubble sits under the supplies readout, which pulses.
    await waitForLesson(page, 'supplies');
    await expectGlow(page, '[data-tip="supplies"]');
    {
      const tip = await bubble(page).boundingBox();
      const control = await page.locator('[data-tip="supplies"]').boundingBox();
      expect(tip && control && tip.y >= control.y + control.height - 1, 'below the top bar').toBe(true);
    }
    await picture(page, '2-supplies');
    await tap(page, 'tip-dismiss');

    // Training units.
    await waitForLesson(page, 'trainSapper');
    await expectGlow(page, '[data-testid="train-sapper"]');
    await tap(page, 'train-sapper');
    await lessonEnds(page, 'trainSapper');
    await waitForLesson(page, 'trainRifle');
    await expectGlow(page, '[data-testid="train-rifle"]');
    await picture(page, '3-train');
    for (let i = 0; i < 3; i++) await tap(page, 'train-rifle');
    await lessonEnds(page, 'trainRifle');

    // The army orders, trenches and cover.
    await waitForLesson(page, 'hold');
    await expectGlow(page, '[data-testid="order-hold"]');
    await tap(page, 'order-hold');
    await lessonEnds(page, 'hold');
    await setTimeScale(page, 3);
    await waitForLesson(page, 'cover');
    await setTimeScale(page, 1);
    await page.waitForTimeout(400);
    await picture(page, '4-cover');
    await tap(page, 'tip-dismiss');
    await waitForLesson(page, 'look');
    await expectGlow(page, '[data-testid="minimap"]');
    await touchDrag(page, { x: 300, y: 170 }, { x: 560, y: 170 });
    await lessonEnds(page, 'look');
    await setTimeScale(page, 3);
    await waitForLesson(page, 'advance');
    await setTimeScale(page, 1);
    await expectGlow(page, '[data-testid="order-advance"]');
    await tap(page, 'order-advance');
    await lessonEnds(page, 'advance');
    await setTimeScale(page, 3);
    await waitForLesson(page, 'holdForward');
    await setTimeScale(page, 1);
    expect((await state(page)).trenches.filter((t) => t.owner === 0).length, 'the empty trench was taken').toBeGreaterThanOrEqual(2);
    await tap(page, 'order-hold');
    await lessonEnds(page, 'holdForward');

    // Per-unit-type orders: the "Orders for" chip, then one type, then an order for it alone.
    await waitForLesson(page, 'kindOrder');
    await expectGlow(page, '[data-testid="order-scope"]');
    await picture(page, '5-unit-orders');
    await tap(page, 'order-scope');
    await tap(page, 'scope-lmg');
    await tap(page, 'order-hold');
    await lessonEnds(page, 'kindOrder');
    expect((await state(page)).kindOrders.lmg).toBe('hold');
    await tap(page, 'order-scope');
    await tap(page, 'scope-all');

    // Direct control: tap a rifleman, steer and fire, hand him back.
    await waitForLesson(page, 'control');
    const rifle = (await units(page)).find((u) => u.side === 0 && u.kind === 'rifle' && !u.inside);
    if (!rifle) throw new Error('no rifleman on the field');
    await lookAt(page, rifle.x);
    await page.waitForTimeout(300);
    const where = await page.evaluate((id) => ((window as unknown as Hooked).__TH as DebugApi).unitScreenPos(id), rifle.id);
    if (!where) throw new Error('the rifleman is not on screen');
    await page.touchscreen.tap(where.x, where.y);
    await expect.poll(async () => (await state(page)).controlled?.kind, { message: 'control taken' }).toBe('rifle');
    await waitForLesson(page, 'drive');
    await expectGlow(page, '[data-testid="fire"]');
    await picture(page, '6-control');
    await tap(page, 'fire');
    await tap(page, 'release');
    await lessonEnds(page, 'drive');

    // Call-ins: the artillery on the old pillbox.
    await waitForLesson(page, 'callIn');
    // The call-ins column is folded: the tip points at its toggle, which opens it.
    await expectGlow(page, '[data-testid="callins"]');
    await tap(page, 'callins');
    await tap(page, 'support-artillery');
    const pillbox = (await state(page)).pillboxes[0];
    await lookAt(page, pillbox.x);
    await page.waitForTimeout(300);
    await tapWorld(page, pillbox.x);
    await lessonEnds(page, 'callIn');
    expect((await state(page)).tally.supportCalled.artillery).toBe(1);
    await page.waitForTimeout(2500);
    await picture(page, '7-call-in');

    // Fall Back.
    await waitForLesson(page, 'fallBack');
    await expectGlow(page, '[data-testid="order-fallBack"]');
    await tap(page, 'order-fallBack');
    await lessonEnds(page, 'fallBack');

    // The medals, the Armoury and the Quartermaster (the prep-phase lesson waits for job 6, so it never comes up).
    await waitForLesson(page, 'medals');
    await expect(bubble(page)).toContainText(`${MEDALS.trainingReward} medals`);
    await picture(page, '8-medals');
    await tap(page, 'tip-dismiss');
    await waitForLesson(page, 'armoury');
    await tap(page, 'tip-dismiss');
    await waitForLesson(page, 'quartermaster');
    await tap(page, 'tip-dismiss');

    // The last lesson: the attack on the mock enemy HQ.
    await waitForLesson(page, 'finalAttack');
    await expectGlow(page, '[data-testid="order-advance"]');
    await tap(page, 'order-advance');
    await lessonEnds(page, 'finalAttack');
    await expect.poll(async () => (await tutorial(page))?.finished).toBe(true);

    await setTimeScale(page, 8);
    const deadline = Date.now() + 300_000;
    let s = await state(page);
    while (!s.over && Date.now() < deadline) {
      await grantSupplies(page, 200);
      await tapIfThere(page, 'train-rifle');
      await page.waitForTimeout(400);
      s = await state(page);
    }
    expect(s.over).toBe(true);
    expect(s.winner).toBe(0);
    expect(s.time / 60, 'battle minutes').toBeLessThanOrEqual(BASIC_TRAINING.expectedMinutes[1]);

    // The result: Basic Training passed, the one-time reward, and the Armoury next.
    await expect(arrived(page, 'result')).toBeVisible({ timeout: 30_000 });
    await expect(arrived(page, 'result').getByTestId('result-points')).toContainText(`+${MEDALS.trainingReward}`);
    await expect(arrived(page, 'result')).toContainText('Basic Training');
    await expect(arrived(page, 'result')).not.toContainText(`Mission ${BASIC_TRAINING_ID}`);
    await page.waitForTimeout(600);
    await picture(page, '9-result');
    const save = await memorySave(page);
    expect(save.medals).toBe(MEDALS.trainingReward);
    expect(save.training).toEqual({ done: true, skipped: false });
    expect(save.cleared).toEqual({});
    await tapIn(page, 'result', 'result-armoury');
    await expect(arrived(page, 'armoury')).toBeVisible();
    await expect(arrived(page, 'armoury').getByTestId('armoury-buy-lmg')).toBeEnabled();
    await page.waitForTimeout(600);
    await picture(page, '10-armoury');

    // Back on the title the offer is gone; the button stays for a replay, which pays nothing more.
    await tapIn(page, 'armoury', 'back');
    await tapIn(page, 'campaign', 'back');
    await expect(arrived(page, 'title')).toBeVisible();
    await expect(page.getByTestId('training-offer')).toBeHidden();
    await tap(page, 'basic-training');
    await expect.poll(async () => (await state(page)).missionId).toBe(BASIC_TRAINING_ID);
    // A replay runs the whole course again.
    await waitForLesson(page, 'welcome');
    await setTimeScale(page, 40);
    const again = Date.now() + 240_000;
    s = await state(page);
    while (!s.over && Date.now() < again) {
      await grantSupplies(page, 800);
      for (let i = 0; i < 3; i++) await tapIfThere(page, 'train-rifle');
      if (s.units[0].rifle >= 12 && s.order !== 'advance') await tapIfThere(page, 'order-advance');
      await page.waitForTimeout(250);
      s = await state(page);
    }
    expect(s.winner).toBe(0);
    await expect(arrived(page, 'result')).toBeVisible({ timeout: 30_000 });
    await expect(arrived(page, 'result').getByTestId('result-points')).toHaveCount(0);
    expect((await memorySave(page)).medals).toBe(MEDALS.trainingReward);
  });

  test('quits back to the title screen it was started from, paying nothing', async ({ page }) => {
    await open(page);
    await tap(page, 'basic-training');
    await expect.poll(async () => (await state(page)).screen, { timeout: 20_000 }).toBe('battle');
    await waitForLesson(page, 'welcome');
    await tap(page, 'pause');
    await tap(page, 'quit');
    await expect(arrived(page, 'title')).toBeVisible();
    await expect(page.getByTestId('training-offer')).toBeVisible();
    expect((await memorySave(page)).medals).toBe(0);
  });
});
