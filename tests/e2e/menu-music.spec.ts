/**
 * The menu theme in the built game: rendered once at load, two minutes or more, not silent, not clipping, looping with
 * no seam; leading the mix a little above the rain with the thunder on top, full range and through a phone speaker
 * model (measured, nobody listens); starting
 * with the first touch and fading in, following the Music slider and mute but not Ambience, carrying on behind
 * Settings and fading out when the menu is left.
 */
import type { Page } from '@playwright/test';
import type { MusicAnalysis } from '../../src/app/debug';
import type { MusicStats } from '../../src/audio';
import type { MixReport } from '../../src/audio/music';
import { MUSIC } from '../../src/data/music';
import { AUDIO, VOLUME, volumeGain } from '../../src/data/sounds';
import { arrived, audioStats, expect, open, tap, tapIn, test, type Hooked } from './helpers';

const stats = (page: Page): Promise<MusicStats> => page.evaluate(() => (window as unknown as Hooked).__TH?.music.stats() as MusicStats);
const analyse = (page: Page): Promise<MusicAnalysis | null> => page.evaluate(() => (window as unknown as Hooked).__TH?.music.analyse() ?? null);
const mix = (page: Page): Promise<MixReport | null> => page.evaluate(() => (window as unknown as Hooked).__TH?.music.mix() ?? null);
const output = async (page: Page): Promise<number> => page.evaluate(() => (window as unknown as Hooked).__TH?.menuStorm.stats().audio.output ?? 0);
const db = (x: number): number => 20 * Math.log10(Math.max(x, 1e-9));

async function rendered(page: Page): Promise<void> {
  await expect.poll(async () => (await stats(page)).render, { timeout: 120_000 }).toBe('ready');
}

async function touchTheField(page: Page): Promise<void> {
  const size = page.viewportSize();
  if (!size) throw new Error('no viewport');
  await page.touchscreen.tap(24, size.height - 24);
}

async function setSlider(page: Page, testId: string, frac: number): Promise<void> {
  const box = await arrived(page, 'settings').getByTestId(testId).locator('.th-slider-track').boundingBox();
  if (!box) throw new Error(`${testId} has no track on screen`);
  await page.touchscreen.tap(box.x + box.width * frac, box.y + box.height / 2);
}

test.describe('menu music', () => {
  test('is rendered once at load: two minutes or more, not silent, not clipping, a seamless loop', async ({ page }) => {
    await open(page);
    await rendered(page);
    const a = await analyse(page);
    expect(a).not.toBeNull();
    if (!a) return;
    console.log(
      `menu theme: ${a.seconds.toFixed(1)} s at ${a.sampleRate} Hz x ${a.channels}, ${(a.bytes / 1048576).toFixed(1)} MB, rendered in ${a.renderMs.toFixed(0)} ms ` +
        `(graph built in ${a.buildMs.toFixed(0)} ms on the main thread); peak ${a.peak.toFixed(3)}, rms ${db(a.rms).toFixed(1)} dB; seam step ${a.seam.step.toExponential(2)} ` +
        `(largest nearby ${a.seam.localStep.toExponential(2)}), rms ${db(a.seam.rmsBefore).toFixed(1)} / ${db(a.seam.rmsAfter).toFixed(1)} dB; sections ` +
        a.sections.map((s) => `${s.name} ${s.rmsDb.toFixed(1)} dB`).join(', '),
    );
    expect(a.seconds).toBeGreaterThanOrEqual(120);
    expect(a.peak, 'never clips').toBeLessThanOrEqual(0.96);
    expect(a.peak).toBeGreaterThan(0.5);
    expect(db(a.rms), 'not silent').toBeGreaterThan(-30);
    for (const s of a.sections) expect(s.rmsDb, s.name).toBeGreaterThan(-40);
    // The sections are not all alike.
    const levels = a.sections.map((s) => s.rmsDb);
    expect(Math.max(...levels) - Math.min(...levels)).toBeGreaterThan(2);
    // Across the loop point: no step bigger than the music makes anyway, and no jump in level.
    expect(a.seam.step).toBeLessThanOrEqual(a.seam.localStep * 1.5 + 1e-4);
    expect(Math.abs(db(a.seam.rmsBefore) - db(a.seam.rmsAfter))).toBeLessThan(3);
    // Memory and main-thread time on a phone.
    expect(a.bytes).toBeLessThan(16e6);
    expect(a.buildMs).toBeLessThan(250);
    // Nothing plays before the first touch.
    expect((await stats(page)).playing).toBe(false);
  });

  // The owner changed this requirement on 2026-10-01: the music now leads (a little louder than the rain, in perceived
  // loudness), full range and on a phone-sized speaker, with the thunder still on top (DECISIONS 229).
  test('leads the mix at default slider levels, full range and on a phone speaker, with the thunder on top', async ({ page }) => {
    await open(page);
    await rendered(page);
    const r = await mix(page);
    expect(r).not.toBeNull();
    if (!r) return;
    const T = MUSIC.mix;
    expect(r.sliders).toEqual({ music: VOLUME.defaults.music, ambience: VOLUME.defaults.ambience, sfx: VOLUME.defaults.sfx });
    for (const [name, l] of [
      ['full range', r.full],
      ['phone speaker', r.phone],
    ] as const) {
      console.log(
        `${name}: music ${l.musicLufs.toFixed(1)} LUFS, rain ${l.rainLufs.toFixed(1)} LUFS (music ${l.musicOverRain.toFixed(1)} LU over); thunder over music and rain: ` +
          `momentary ${l.thunderMomentaryOverBed.toFixed(1)} LU, short-term ${l.thunderShortTermOverBed.toFixed(1)} LU, peak ${l.thunderPeakOverBed.toFixed(1)} dB`,
      );
      expect(l.musicOverRain, `${name}: music over rain`).toBeGreaterThanOrEqual(T.musicOverRain[0]);
      expect(l.musicOverRain, `${name}: music over rain`).toBeLessThanOrEqual(T.musicOverRain[1]);
      expect(l.thunderMomentaryOverBed, `${name}: thunder momentary`).toBeGreaterThanOrEqual(T.thunderMomentaryOverBed);
      expect(l.thunderShortTermOverBed, `${name}: thunder short-term`).toBeGreaterThanOrEqual(T.thunderShortTermOverBed);
      expect(l.thunderPeakOverBed, `${name}: thunder peak`).toBeGreaterThanOrEqual(T.thunderPeakOverBed);
    }
    // Through the engine's own master chain: no soft clipping at default levels, the compressor leaves the music alone
    // and lets go of the thunder at once, and with every slider full there is still headroom.
    const c = r.chain;
    console.log(
      `chain: output peak ${c.outputPeak.toFixed(2)}, compressor ${c.bedReductionDb.toFixed(1)} dB on music and rain, ${c.maxReductionDb.toFixed(1)} dB at most, ` +
        `${c.pumpSeconds.toFixed(2)} s over ${T.pumpDb} dB; every slider full: output peak ${r.chainAtFull.outputPeak.toFixed(2)}, compressor ${r.chainAtFull.maxReductionDb.toFixed(1)} dB`,
    );
    expect(c.outputPeak).toBeLessThanOrEqual(AUDIO.clipKnee);
    expect(c.bedReductionDb).toBeLessThanOrEqual(T.bedReductionDb);
    expect(c.maxReductionDb).toBeLessThanOrEqual(T.maxReductionDb);
    expect(c.pumpSeconds).toBeLessThanOrEqual(T.pumpSeconds);
    expect(r.chainAtFull.outputPeak).toBeLessThanOrEqual(T.maxOutputPeakAtFull);
    expect(r.failures).toEqual([]);
  });

  test('starts on the first touch and fades in, follows the Music slider and mute but not Ambience, and leaves with the menu', async ({ page }) => {
    await open(page);
    await rendered(page);
    expect((await stats(page)).playing).toBe(false);
    await touchTheField(page);
    await expect.poll(async () => (await stats(page)).playing, { timeout: 10_000 }).toBe(true);
    const fades: number[] = [];
    const start = Date.now();
    while (Date.now() - start < (MUSIC.player.fadeIn + 3) * 1000) {
      fades.push((await stats(page)).fade);
      if (fades[fades.length - 1] > 0.98) break;
      await page.waitForTimeout(100);
    }
    expect(Math.min(...fades), 'heard rising').toBeLessThan(0.6);
    expect(Math.max(...fades)).toBeGreaterThan(0.98);
    for (let i = 1; i < fades.length; i++) expect(fades[i]).toBeGreaterThanOrEqual(fades[i - 1] - 1e-6);
    await expect.poll(async () => (await stats(page)).level).toBeCloseTo(MUSIC.player.level * volumeGain(VOLUME.defaults.music), 2);

    // Settings from the title: the music carries on.
    await tap(page, 'settings');
    const settings = arrived(page, 'settings');
    await expect(settings).toBeVisible();
    expect((await stats(page)).playing).toBe(true);
    // Ambience does not touch it; Music does.
    const before = (await stats(page)).level;
    await setSlider(page, 'setting-ambience', 0.4);
    await expect.poll(async () => Number(await settings.getByTestId('setting-ambience').getAttribute('aria-valuenow'))).toBeLessThan(50);
    await page.waitForTimeout(300);
    expect((await stats(page)).level).toBeCloseTo(before, 3);
    await setSlider(page, 'setting-music', 0.5);
    await expect.poll(async () => Number(await settings.getByTestId('setting-music').getAttribute('aria-valuenow'))).toBeLessThan(60);
    const music = Number(await settings.getByTestId('setting-music').getAttribute('aria-valuenow'));
    await expect.poll(async () => (await stats(page)).level).toBeCloseTo(MUSIC.player.level * volumeGain(music), 2);
    // Mute silences it with everything else; un-muting brings it back.
    await expect.poll(() => output(page), { timeout: 5000 }).toBeGreaterThan(1e-4);
    await tapIn(page, 'settings', 'setting-mute');
    await expect.poll(async () => (await audioStats(page)).muted).toBe(true);
    await expect.poll(() => output(page), { timeout: 5000 }).toBeLessThan(1e-5);
    expect((await stats(page)).playing).toBe(true);
    await tapIn(page, 'settings', 'setting-mute');
    await expect.poll(() => output(page), { timeout: 5000 }).toBeGreaterThan(1e-4);

    // Leaving the menu fades it out; coming back starts it again.
    await tapIn(page, 'settings', 'back');
    await expect(arrived(page, 'title')).toBeVisible();
    await tap(page, 'play');
    await expect(arrived(page, 'campaign')).toBeVisible();
    // The campaign map has its own track now (the owner's request, 2026-11): the menu theme gives way to it.
    expect((await stats(page)).wanted).toBe('map');
    await expect.poll(async () => (await stats(page)).current, { timeout: 5000 }).not.toBe('menu');
    await tapIn(page, 'campaign', 'back');
    await expect(arrived(page, 'title')).toBeVisible();
    await expect.poll(async () => (await stats(page)).current, { timeout: 5000 }).toBe('menu');
    await expect.poll(async () => (await stats(page)).fade, { timeout: (MUSIC.player.fadeIn + 3) * 1000 }).toBeGreaterThan(0.98);
  });
});
