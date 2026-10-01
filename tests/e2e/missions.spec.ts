/**
 * Every campaign mission in the production build, started the way a player starts it: from the campaign map by real
 * taps (after the unlockAll debug hook), through the briefing, into the battle. In the battle the test checks what the
 * HUD shows for that mission (clock, enemy HQ bar, the buttons the mission allows, hints and notices), trains a unit,
 * gives each order, calls the new support, pans with a finger, then fast-forwards with the debug time scale until the
 * battle ends and the result screen tells why. Any console error, page error or failed request fails the test.
 * Pictures: docs/screenshots/e2e-mission-NN.png (battle) and e2e-mission-NN-result.png.
 */
import type { Page } from '@playwright/test';
import { FACTIONS } from '../../src/data/factions';
import { MISSIONS } from '../../src/data/missions';
import type { MissionDef, MissionEventDef } from '../../src/data/schema';
import { UNITS } from '../../src/data/units';
import {
  arrived,
  expect,
  fastForward,
  field,
  grantSupplies,
  lastResult,
  lookAt,
  open,
  reasonText,
  savedGame,
  setTimeScale,
  shot,
  state,
  tap,
  tapIfThere,
  tapWorld,
  test,
  touchDrag,
  camera,
  unlockAll,
  type Hooked,
} from './helpers';
import type { DebugApi } from '../../src/app/debug';

const pad = (n: number): string => String(n).padStart(2, '0');

/** Battle seconds of the first firing of an event, or null for one that waits for something to happen. */
function firstFire(event: MissionEventDef): number | null {
  const when = event.when;
  if ('at' in when) return when.at;
  if ('every' in when) return when.from;
  return null;
}

/** What the HUD should show, at some moment, because of the events in the first `window` battle seconds. */
function expectedTexts(m: MissionDef, window: number): { hints: string[]; announcements: string[]; airdrop: boolean; plainWave: boolean } {
  const out = { hints: [] as string[], announcements: [] as string[], airdrop: false, plainWave: false };
  for (const e of m.events) {
    const at = firstFire(e);
    if (at === null || at > window) continue;
    if (e.type === 'hint') out.hints.push(e.text);
    else if (e.type === 'announce') out.announcements.push(e.text);
    else if (e.type === 'wave') {
      if (e.announce !== undefined) out.announcements.push(e.announce);
      else if (e.side === 1 && m.mode === 'survival') out.plainWave = true;
    } else if (e.side === 0) out.airdrop = true;
  }
  return out;
}

/** Record every banner and hint the HUD shows from now on, in window.__seen. */
async function watchHud(page: Page): Promise<void> {
  await page.evaluate(() => {
    const seen: { banners: string[]; hints: string[] } = { banners: [], hints: [] };
    Reflect.set(window, '__seen', seen);
    const look = (): void => {
      const banner = document.querySelector('.th-banner');
      if (banner && /show/.test(banner.className) && banner.textContent && !seen.banners.includes(banner.textContent)) seen.banners.push(banner.textContent);
      const hint = document.querySelector('.th-hint.is-on');
      if (hint && hint.textContent && !seen.hints.includes(hint.textContent)) seen.hints.push(hint.textContent);
    };
    new MutationObserver(look).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class'] });
  });
}

const seenHud = (page: Page) =>
  page.evaluate(() => Reflect.get(window, '__seen') as { banners: string[]; hints: string[] });

for (const m of MISSIONS) {
  test(`mission ${m.id} (${m.key}): from the campaign map, through the briefing, to the result screen`, async ({ page }) => {
    test.setTimeout(540_000);
    await open(page);
    const listed = await page.evaluate(() => ((window as unknown as Hooked).__TH as DebugApi).missions());
    expect(listed.find((x) => x.id === m.id), 'the debug list has this mission').toBeDefined();
    await watchHud(page);

    // --- Campaign map: unlock everything, select the mission, open the briefing ---------------------------------
    await unlockAll(page);
    await tap(page, 'play');
    await expect(arrived(page, 'campaign').getByTestId(`mission-pin-${m.id}`)).toBeVisible();
    await tap(page, `mission-pin-${m.id}`);
    await expect(page.getByTestId('mission-start')).toBeEnabled();
    await tap(page, 'mission-start');
    await expect(page.getByTestId('begin')).toBeVisible();

    // The briefing carries the mission's own text and a NEW card for what it introduces.
    const briefing = arrived(page, 'briefing');
    await expect(briefing).toContainText(m.objective);
    const cards = (m.newUnit ? 1 : 0) + (m.newSupport ? 1 : 0);
    await expect(briefing.locator('.th-new')).toHaveCount(cards);
    if (m.newUnit) await expect(briefing.locator('.th-new-name').first()).toHaveText(FACTIONS.british.unitNames[m.newUnit]);
    if (m.newSupport) await expect(briefing.locator('.th-new-name').last()).toHaveText(FACTIONS.british.supportNames[m.newSupport]);
    await expect(briefing.getByTestId('difficulty-normal')).toHaveAttribute('aria-pressed', 'true');
    if (cards === 2) {
      await page.waitForTimeout(2800); // let the typewriter finish
      await shot(page, `campaign-briefing-${pad(m.id)}`);
    }
    await tap(page, 'begin');
    await expect.poll(async () => (await state(page)).screen, { timeout: 20_000 }).toBe('battle');
    await expect(page.getByTestId('order-advance')).toBeVisible({ timeout: 20_000 });

    // --- The HUD describes this mission ---------------------------------------------------------------------------
    const start = await state(page);
    expect(start.missionId).toBe(m.id);
    expect(start.difficulty).toBe('normal');
    const obj = page.locator('.th-obj');
    if (m.timer) {
      await expect(obj).toHaveClass(/has-timer/);
      await expect(page.locator('.th-obj-text')).toHaveText(m.timer.label);
      await expect(page.locator('.th-obj-time')).toHaveText(/^\d+:\d\d$/);
      await expect(obj).not.toHaveClass(/is-urgent/);
    } else {
      await expect(obj).not.toHaveClass(/has-timer/);
      await expect(page.locator('.th-obj-text')).toHaveText(m.objective);
    }
    await expect(page.locator('.th-hq-enemy.is-hidden'), 'the enemy HQ bar is there exactly when the enemy has an HQ').toHaveCount(m.mode === 'survival' ? 1 : 0);
    expect(start.hq[1] !== null).toBe(m.mode !== 'survival');
    for (const kind of m.units[0]) {
      if (UNITS[kind].trainable) await expect(page.getByTestId(`train-${kind}`), `train button for ${kind}`).toHaveCount(1);
    }
    if (!m.units[0].includes('sapper')) await expect(page.getByTestId('train-sapper')).toHaveCount(0);
    if (!m.units[0].includes('tank')) await expect(page.getByTestId('train-tank')).toHaveCount(0);
    for (const kind of m.supports[0]) await expect(page.getByTestId(`support-${kind}`), `support button for ${kind}`).toHaveCount(1);
    expect(start.darkness, 'the sky starts in its own light').toBeLessThan(0.01);

    // --- Train a unit and give every order, with real taps ----------------------------------------------------------
    await grantSupplies(page, 600);
    const kind = m.newUnit && UNITS[m.newUnit].trainable && m.newUnit !== 'sapper' ? m.newUnit : 'rifle';
    const before = await state(page);
    await tap(page, `train-${kind}`);
    await expect
      .poll(async () => {
        const s = await state(page);
        return s.queue[kind] + s.units[0][kind];
      }, { timeout: 10_000 })
      .toBeGreaterThan(before.queue[kind] + before.units[0][kind]);
    for (const [testId, order] of [
      ['order-advance', 'advance'],
      ['order-fallBack', 'fallBack'],
      ['order-hold', 'hold'],
    ] as const) {
      // Advance and Fall Back are refused when the enemy has no HQ (a survival mission): the order button still works.
      await tap(page, testId);
      await expect.poll(async () => (await state(page)).order, { timeout: 10_000 }).toBe(order);
    }

    // --- Pan with a finger -----------------------------------------------------------------------------------------
    await page.waitForTimeout(300);
    const cam0 = await camera(page);
    await touchDrag(page, { x: 640, y: 190 }, { x: 380, y: 190 });
    await page.waitForTimeout(600);
    expect((await camera(page)).centerX, 'the camera pans').toBeGreaterThan(cam0.centerX + 60);

    // --- Call in the support the mission introduces ------------------------------------------------------------------
    if (m.newSupport) {
      const support = m.newSupport;
      await setTimeScale(page, 8);
      await expect.poll(async () => (await state(page)).supports[support].cooldown, { timeout: 60_000 }).toBeLessThanOrEqual(0);
      await setTimeScale(page, 1);
      await tap(page, `support-${support}`);
      await expect.poll(async () => (await state(page)).targeting, { timeout: 5000 }).toBe(support);
      await tapWorld(page, (await camera(page)).centerX);
      await expect.poll(async () => (await state(page)).tally.supportCalled[support], { timeout: 10_000 }).toBe(1);
    }

    // --- Watch the first minute at a speed the HUD can follow: hints, notices, the dusk ---------------------------------
    const window = 55;
    await setTimeScale(page, 4);
    await expect.poll(async () => (await state(page)).time, { timeout: 90_000 }).toBeGreaterThan(window + 2);
    const wanted = expectedTexts(m, window);
    const seen = await seenHud(page);
    for (const text of wanted.hints) expect(seen.hints, `hint "${text}"`).toContain(text);
    for (const text of wanted.announcements) expect(seen.banners, `announcement "${text}"`).toContain(text);
    if (wanted.airdrop) expect(seen.banners.some((b) => /^Airdrop: \+\d+ supplies$/.test(b)), `an airdrop notice among ${JSON.stringify(seen.banners)}`).toBe(true);
    if (wanted.plainWave) expect(seen.banners.some((b) => b === 'Enemy wave incoming' || wanted.announcements.includes(b)), 'a wave notice').toBe(true);

    const mid = await state(page);
    const timed = m.timer !== null;
    if (m.timer && m.timer.onExpire === 'lose') {
      // The sky follows the clock toward night.
      expect(mid.darkness).toBeCloseTo(1 - (mid.timer ?? 0) / m.timer.seconds, 1);
      expect(mid.darkness).toBeGreaterThan(0);
    } else {
      expect(mid.darkness, 'only a deadline darkens the sky').toBe(0);
    }
    await setTimeScale(page, 1);
    const f = await field(page);
    await lookAt(page, f?.playerFrontX ?? mid.trenches[0]?.x ?? 1200);
    await page.waitForTimeout(700);
    await shot(page, `mission-${pad(m.id)}`);

    // --- A clock turns urgent in its last 30 seconds -------------------------------------------------------------------
    if (timed && m.timer) {
      await setTimeScale(page, 40);
      let s = mid;
      let dusk = false;
      let slowed = false;
      for (let i = 0; i < 600 && !s.over && (s.timer ?? 999) > 52; i++) {
        await grantSupplies(page, 800);
        for (let j = 0; j < 3; j++) await tapIfThere(page, 'train-rifle');
        await page.waitForTimeout(250);
        s = await state(page);
        if (!slowed && (s.timer ?? 999) < 120) {
          // One pass of this loop can take a second of real time: at 40x that would jump straight over the
          // sampling window below, so the last two minutes run at 4x.
          slowed = true;
          await setTimeScale(page, 4);
        }
        if (m.timer.onExpire === 'lose' && !dusk && s.darkness > 0.55) {
          // The sky is well on its way to night, whether or not the battle lasts to the deadline.
          dusk = true;
          await shot(page, `mission-${pad(m.id)}-dusk`);
        }
      }
      if (!s.over && s.timer !== null) {
        // Slowly through the last minute, sampling the clock and the plate together: calm above 30 seconds, urgent below.
        await setTimeScale(page, 2);
        const samples: { t: number; urgent: boolean }[] = [];
        let ended = false;
        for (let i = 0; i < 600; i++) {
          const sample = await page.evaluate(() => ({
            t: ((window as unknown as Hooked).__TH as DebugApi).state().timer,
            urgent: document.querySelector('.th-obj')?.classList.contains('is-urgent') === true,
            over: ((window as unknown as Hooked).__TH as DebugApi).state().over,
          }));
          if (sample.over || sample.t === null) {
            ended = true;
            break;
          }
          samples.push({ t: sample.t, urgent: sample.urgent });
          if (sample.t < 25) break;
          await page.waitForTimeout(60);
        }
        const calm = samples.filter((x) => x.t > 32);
        const late = samples.filter((x) => x.t < 28);
        expect(calm.length, 'samples above 30 seconds').toBeGreaterThan(0);
        if (!ended) expect(late.length, 'samples below 30 seconds').toBeGreaterThan(0);
        expect(calm.filter((x) => x.urgent), 'not urgent above 30 seconds').toEqual([]);
        expect(late.filter((x) => !x.urgent), 'urgent in the last 30 seconds').toEqual([]);
        if (m.timer.onExpire === 'lose' && !ended) {
          expect((await state(page)).darkness).toBeGreaterThan(0.9);
          await page.waitForTimeout(500);
          await shot(page, `mission-${pad(m.id)}-night`);
        }
      }
    }

    // --- Fast-forward to the end --------------------------------------------------------------------------------------
    const end = await fastForward(page, 45_000, 330_000);
    await expect(page.getByTestId('result-reason')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('result-reason')).toHaveText(reasonText(end));
    expect((await lastResult(page))?.reason).toBe(reasonText(end));
    const won = end.winner === 0;
    if (m.timer?.onExpire === 'win') expect(['timerSurvived', 'hqDestroyed']).toContain(end.endReason);
    else if (m.timer) expect(['timerExpired', 'hqDestroyed']).toContain(end.endReason);
    else expect(end.endReason).toBe('hqDestroyed');
    if (end.endReason === 'timerSurvived') expect(won).toBe(true);
    if (end.endReason === 'timerExpired') expect(won).toBe(false);

    const saved = await savedGame(page);
    if (won) {
      expect(saved?.cleared[String(m.id)], 'a win is saved').toEqual(['normal']);
      await expect(page.getByTestId('result-points'), 'the first clear is worth two points').toContainText('+2');
      if (m.id < MISSIONS[MISSIONS.length - 1].id) await expect(page.getByTestId('result-next')).toBeVisible();
    } else {
      expect(saved?.cleared[String(m.id)], 'a loss is not saved').toBeUndefined();
      await expect(page.getByTestId('result-points')).toHaveCount(0);
      await expect(page.getByTestId('result-retry')).toBeVisible();
    }
    await page.waitForTimeout(600);
    await shot(page, `mission-${pad(m.id)}-result`);

    // And back to the map.
    await tap(page, 'result-map');
    await expect(arrived(page, 'campaign').getByTestId(`mission-pin-${m.id}`)).toBeVisible();
  });
}
