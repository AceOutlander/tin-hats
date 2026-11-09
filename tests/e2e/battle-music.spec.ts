/**
 * The battle and campaign map music in the built game: nothing of the battle music is rendered at startup; the first
 * campaign mission without a prep phase has its track rendered in full before its battle starts (as its briefing does
 * it), piece by piece within the memory and time budgets, and nothing more is rendered once the battle runs; the build
 * layer fades in with the battle, a switch to combat through the debug hook crossfades on the bar grid without errors,
 * the music sits under the army of 80 at default sliders (full range and phone speaker), leaving the battle frees it,
 * and the map track renders when the campaign screen opens and plays there.
 */
import type { Page } from '@playwright/test';
import type { MusicAnalysis } from '../../src/app/debug';
import type { BattleMusicStats, MusicStats } from '../../src/audio';
import type { BattleMixReport } from '../../src/audio/music/battleMix';
import { MUSIC_BATTLE } from '../../src/data/musicBattle';
import { BATTLE_TRACKS } from '../../src/data/musicTracks';
import { CAMPAIGNS } from '../../src/data/campaigns';
import { MISSIONS } from '../../src/data/missions';
import type { MissionDef } from '../../src/data/schema';
import { arrived, expect, open, state, tap, test, type Hooked } from './helpers';

const battle = (page: Page): Promise<BattleMusicStats> => page.evaluate(() => (window as unknown as Hooked).__TH?.battleMusic.stats() as BattleMusicStats);
const loop = (page: Page): Promise<MusicStats> => page.evaluate(() => (window as unknown as Hooked).__TH?.music.stats() as MusicStats);
const db = (x: number): number => 20 * Math.log10(Math.max(x, 1e-9));

/** The first campaign mission with no prep phase (Dubno, 1002), so its battle music starts on the build layer. */
const FIRST = MISSIONS.find((m) => !m.prep) as MissionDef;
const FIRST_ID = FIRST.id;
/** The track the campaign map plays (Stalingrad's, the only campaign). */
const MAP_TRACK = CAMPAIGNS.stalingrad.mapMusic;

async function touchTheField(page: Page): Promise<void> {
  const size = page.viewportSize();
  if (!size) throw new Error('no viewport');
  await page.touchscreen.tap(24, size.height - 24);
}

/** Render the first mission's music as its briefing does, then start the battle. Returns the stats as the battle starts. */
async function startFirstMission(page: Page): Promise<BattleMusicStats> {
  await open(page);
  await touchTheField(page);
  // Nothing of the battle music exists before a briefing asks for it.
  const before = await battle(page);
  expect(before.state).toBe('idle');
  expect(before.prepared).toBe(0);
  expect(before.bytes).toBe(0);
  const loaded = await page.evaluate((id) => (window as unknown as Hooked).__TH?.battleMusic.load(id) ?? false, FIRST_ID);
  expect(loaded, 'the whole track renders before the battle').toBe(true);
  const ready = await battle(page);
  expect(ready.state).toBe('ready');
  // Nothing plays before the battle.
  expect(ready.player?.started).toBe(false);
  await page.evaluate((id) => (window as unknown as Hooked).__TH?.startMission(id), FIRST_ID);
  await expect.poll(async () => (await state(page)).screen).toBe('battle');
  return ready;
}

test.describe('battle music', () => {
  test('the first mission without a prep phase renders its track before the battle, within budget, nothing during it, and the build layer fades in', async ({ page, problems }) => {
    const loaded = await startFirstMission(page);
    const def = BATTLE_TRACKS[FIRST.music];
    const first = await battle(page);
    expect(first.track).toBe(FIRST.music);
    expect(first.state).toBe('ready');
    // The build layer starts with the battle.
    await expect.poll(async () => (await battle(page)).player?.started ?? false, { timeout: 10_000 }).toBe(true);
    const early = await battle(page);
    expect(early.player?.active).toBe('build');
    // A few seconds of battle: not one piece more was rendered.
    await expect.poll(async () => (await state(page)).time, { timeout: 30_000 }).toBeGreaterThan(3);
    const s = await battle(page);
    expect(s.state).toBe('ready');
    expect(s.renderMs, 'nothing renders once the battle runs').toBe(loaded.renderMs);
    expect(s.buildMsTotal).toBe(loaded.buildMsTotal);
    console.log(
      `${def.title}: ${s.piecesReady} pieces at ${s.sampleRate} Hz, ${(s.bytes / 1e6).toFixed(1)} MB (budget ${(MUSIC_BATTLE.budget.maxBytes / 1e6).toFixed(0)} MB); ` +
        `rendered in ${(s.renderMs / 1000).toFixed(1)} s, the first piece after ${s.firstMs.toFixed(0)} ms; graph builds ${s.buildMs.toFixed(1)} ms at most, ${s.buildMsTotal.toFixed(0)} ms in all; ` +
        `loudest piece ${db(s.peak).toFixed(1)} dBFS`,
    );
    expect(s.piecesReady).toBe(s.piecesTotal);
    expect(s.bytes).toBe(s.budgetBytes);
    expect(s.bytes).toBeLessThanOrEqual(MUSIC_BATTLE.budget.maxBytes);
    expect(s.renderMs).toBeLessThanOrEqual(MUSIC_BATTLE.budget.maxRenderMs);
    expect(s.buildMs, 'no long main-thread stall').toBeLessThanOrEqual(MUSIC_BATTLE.budget.maxBuildMs);
    expect(db(s.peak), 'never clips').toBeLessThanOrEqual(MUSIC_BATTLE.mix.maxPeakDb);
    // Not silent: every piece has music in it.
    const pieces = await page.evaluate(() => (window as unknown as Hooked).__TH?.battleMusic.analyse() ?? null);
    expect(pieces?.length).toBe(s.piecesTotal);
    for (const p of pieces ?? []) expect(p.rmsDb, `${p.section} ${p.layer}`).toBeGreaterThan(-45);
    // Fading in on the Music bus.
    await expect.poll(async () => (await battle(page)).player?.fade ?? 0, { timeout: 15_000 }).toBeGreaterThan(0.95);
    const p = (await battle(page)).player;
    expect(p?.gains.build).toBeGreaterThan(0);
    // Build is the layer up; combat is at most the soft blend a calm section sometimes carries (MUSIC_BATTLE.player.blend).
    expect(p?.active).toBe('build');
    expect(p?.gains.combat ?? 0).toBeLessThanOrEqual(def.layerLevel.combat * MUSIC_BATTLE.player.blend.level + 1e-6);
    expect(problems).toEqual([]);
  });

  test('switching to combat crossfades on the bar grid without errors, and leaving the battle frees the music', async ({ page, problems }) => {
    await startFirstMission(page);
    await expect.poll(async () => (await battle(page)).state, { timeout: 180_000 }).toBe('ready');
    await expect.poll(async () => (await battle(page)).player?.fade ?? 0, { timeout: 15_000 }).toBeGreaterThan(0.95);
    const def = BATTLE_TRACKS[FIRST.music];
    await page.evaluate(() => (window as unknown as Hooked).__TH?.battleMusic.force('combat'));
    expect((await battle(page)).player?.target).toBe('combat');
    // The crossfade: both layers are heard part of the way, then combat is up and build is down.
    const seen: { build: number; combat: number }[] = [];
    const start = Date.now();
    while (Date.now() - start < 12_000) {
      const g = (await battle(page)).player?.gains;
      if (g) seen.push({ build: g.build, combat: g.combat });
      if (g && g.combat >= def.layerLevel.combat - 1e-3 && g.build <= 1e-3) break;
      await page.waitForTimeout(100);
    }
    const last = seen[seen.length - 1];
    expect(last.combat).toBeCloseTo(def.layerLevel.combat, 2);
    expect(last.build).toBeLessThan(1e-3);
    expect(seen.some((g) => g.combat > 0.05 && g.combat < def.layerLevel.combat - 0.05), 'heard rising, not switched').toBe(true);
    for (let i = 1; i < seen.length; i++) expect(seen[i].combat).toBeGreaterThanOrEqual(seen[i - 1].combat - 1e-6);
    // Tense, then back to the battle's own choice.
    await page.evaluate(() => (window as unknown as Hooked).__TH?.battleMusic.force('tense'));
    await expect.poll(async () => (await battle(page)).player?.gains.tense ?? 0, { timeout: 12_000 }).toBeGreaterThan(def.layerLevel.tense * 0.99);
    await page.evaluate(() => (window as unknown as Hooked).__TH?.battleMusic.force(null));
    const intensity = await page.evaluate(() => (window as unknown as Hooked).__TH?.battleMusic.intensity() ?? null);
    expect(intensity).not.toBeNull();

    // Leave through the pause menu: the music fades and its buffers go.
    await tap(page, 'pause');
    await expect.poll(async () => (await state(page)).paused).toBe(true);
    await tap(page, 'quit');
    await expect.poll(async () => (await state(page)).screen).toBe('campaign');
    const after = await battle(page);
    expect(after.track).toBe(null);
    expect(after.bytes).toBe(0);
    expect(after.released).toBeGreaterThanOrEqual(1);
    expect(await page.evaluate(() => (window as unknown as Hooked).__TH?.battleMusic.analyse() ?? null)).toBeNull();
    expect(problems).toEqual([]);
  });

  test('sits under the army of 80 at default sliders, full range and on a phone speaker', async ({ page }) => {
    await startFirstMission(page);
    await expect.poll(async () => (await battle(page)).state, { timeout: 180_000 }).toBe('ready');
    const r = await page.evaluate(() => (window as unknown as Hooked).__TH?.battleMusic.mix() ?? null) as BattleMixReport | null;
    expect(r).not.toBeNull();
    if (!r) return;
    console.log(
      `army of 80: ${r.army.fullLufs.toFixed(1)} LUFS full range, ${r.army.phoneLufs.toFixed(1)} on a phone; over the layers (full / phone): ` +
        r.layers.map((l) => `${l.layer} ${l.armyOverFull.toFixed(1)} / ${l.armyOverPhone.toFixed(1)} LU`).join(', ') +
        `; stings peak ${r.stingPeakDb.toFixed(1)} dBFS`,
    );
    for (const l of r.layers) {
      const [lo, hi] = MUSIC_BATTLE.mix.armyOverLayer[l.layer];
      for (const v of [l.armyOverFull, l.armyOverPhone]) {
        expect(v, `${l.layer}: the battle stays on top`).toBeGreaterThanOrEqual(lo);
        expect(v, `${l.layer}: the music is still there`).toBeLessThanOrEqual(hi);
      }
    }
    expect(r.failures).toEqual([]);
  });
});

test.describe('campaign map music', () => {
  test('renders when the map first opens, fades in there, and is let go of when a battle starts', async ({ page, problems }) => {
    await open(page);
    await touchTheField(page);
    // On the title: the menu theme, and nothing of the map track rendered yet.
    expect((await loop(page)).wanted).toBe('menu');
    expect(await page.evaluate((name) => (window as unknown as Hooked).__TH?.music.analyse(name) ?? null, MAP_TRACK)).toBeNull();
    await tap(page, 'play');
    await expect(arrived(page, 'campaign')).toBeVisible();
    expect((await loop(page)).wanted).toBe(MAP_TRACK);
    await expect.poll(async () => (await loop(page)).render, { timeout: 120_000 }).toBe('ready');
    await expect.poll(async () => (await loop(page)).playing, { timeout: 10_000 }).toBe(true);
    await expect.poll(async () => (await loop(page)).fade, { timeout: 10_000 }).toBeGreaterThan(0.98);
    const a = (await page.evaluate((name) => (window as unknown as Hooked).__TH?.music.analyse(name) ?? null, MAP_TRACK)) as MusicAnalysis | null;
    expect(a).not.toBeNull();
    if (!a) return;
    console.log(
      `map track: ${a.seconds.toFixed(1)} s at ${a.sampleRate} Hz, ${(a.bytes / 1e6).toFixed(1)} MB, rendered in ${a.renderMs.toFixed(0)} ms (graph ${a.buildMs.toFixed(0)} ms); ` +
        `peak ${a.peak.toFixed(3)}, rms ${db(a.rms).toFixed(1)} dB; sections ` +
        a.sections.map((s) => `${s.name} ${s.rmsDb.toFixed(1)} dB`).join(', '),
    );
    // Two minutes or more, never clipping, not silent anywhere, a seamless loop, within the phone budgets.
    expect(a.seconds).toBeGreaterThanOrEqual(120);
    expect(a.peak, 'never clips').toBeLessThanOrEqual(0.96);
    expect(a.peak).toBeGreaterThan(0.5);
    expect(db(a.rms)).toBeGreaterThan(-30);
    for (const s of a.sections) expect(s.rmsDb, s.name).toBeGreaterThan(-40);
    expect(a.seam.step).toBeLessThanOrEqual(a.seam.localStep * 1.5 + 1e-4);
    expect(Math.abs(db(a.seam.rmsBefore) - db(a.seam.rmsAfter))).toBeLessThan(3);
    expect(a.bytes).toBeLessThan(16e6);
    expect(a.buildMs).toBeLessThan(250);
    // A battle starts: the map track goes, the battle's own music comes.
    await page.evaluate((id) => (window as unknown as Hooked).__TH?.startMission(id), FIRST_ID);
    await expect.poll(async () => (await state(page)).screen).toBe('battle');
    await expect.poll(async () => (await loop(page)).playing, { timeout: 5000 }).toBe(false);
    expect(await page.evaluate((name) => (window as unknown as Hooked).__TH?.music.analyse(name) ?? null, MAP_TRACK)).toBeNull();
    expect((await battle(page)).track).toBe(FIRST.music);
    expect(problems).toEqual([]);
  });
});
