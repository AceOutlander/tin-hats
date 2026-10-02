import { describe, expect, it } from 'vitest';
import { MENU_STORM, type MenuStormDef } from '../../src/data/menuStorm';
import { SOFT_LIGHTNING, WEATHER } from '../../src/data/weather';
import { createLightning, createRng, lightningFlash, MenuRain, MenuStorm, PanelDrops, StormGuard } from '../../src/fx';

const INTERVAL = MENU_STORM.thunderInterval;

/** Largest change of an envelope between two frames 1/60 s apart. */
function steepest(keys: readonly (readonly [number, number])[], seconds: number): number {
  let worst = 0;
  let prev = lightningFlash(0, keys);
  for (let t = 1 / 60; t <= seconds; t += 1 / 60) {
    const v = lightningFlash(t, keys);
    worst = Math.max(worst, Math.abs(v - prev));
    prev = v;
  }
  return worst;
}

describe('title storm timing', () => {
  it('flashes exactly once per interval over a long run of odd frame times', () => {
    const frames: [string, () => number][] = [
      ['60 fps', () => 1 / 60],
      ['30 fps', () => 1 / 30],
      ['odd 37.1 ms', () => 0.0371],
    ];
    for (const [name, next] of frames) {
      const storm = new MenuStorm(7);
      let t = 0;
      while (t < 600) {
        const dt = next();
        storm.update(dt);
        t += dt;
      }
      expect(storm.flashes, name).toBe(Math.floor(t / INTERVAL + 1e-9));
      expect(storm.time, name).toBeCloseTo(t, 6);
    }
    // Ragged frame times, as a phone really produces them.
    const rng = createRng(99);
    const storm = new MenuStorm(3);
    let t = 0;
    for (let i = 0; i < 40000; i++) {
      const dt = 0.004 + rng() * 0.06;
      storm.update(dt);
      t += dt;
      expect(storm.flashes).toBe(Math.floor(t / INTERVAL + 1e-9));
    }
  });

  it('carries the remainder: one long step makes every flash it covers, and the last flash is as old as it should be', () => {
    const storm = new MenuStorm(1);
    storm.update(INTERVAL * 2 + 0.3);
    expect(storm.flashes).toBe(2);
    expect(storm.sinceFlash).toBeCloseTo(0.3, 9);
    storm.update(INTERVAL - 0.3 - 0.01);
    expect(storm.flashes).toBe(2);
    storm.update(0.02);
    expect(storm.flashes).toBe(3);
    expect(storm.sinceFlash).toBeCloseTo(0.01, 9);
  });

  it('moves nothing while paused: zero, negative, NaN and infinite steps change nothing', () => {
    const storm = new MenuStorm(5);
    storm.update(INTERVAL + 0.05);
    const before = { time: storm.time, flashes: storm.flashes, since: storm.sinceFlash, flash: storm.flash, scheduled: storm.thundersScheduled, played: storm.thundersPlayed, pending: storm.pending };
    for (const dt of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(storm.update(dt)).toBe(0);
      expect({ time: storm.time, flashes: storm.flashes, since: storm.sinceFlash, flash: storm.flash, scheduled: storm.thundersScheduled, played: storm.thundersPlayed, pending: storm.pending }).toEqual(before);
    }
  });

  it('schedules a thunder for every flash and plays it after that flash\'s own delay', () => {
    const storm = new MenuStorm(11);
    const dt = 1 / 60;
    let t = 0;
    let lastFlashAt = -1;
    let lastDelay = 0;
    let checked = 0;
    for (let i = 0; i < 60 * 300; i++) {
      const flashesBefore = storm.flashes;
      const due = storm.update(dt);
      t += dt;
      if (storm.flashes > flashesBefore) {
        lastFlashAt = t - storm.sinceFlash;
        lastDelay = storm.lastCue.delay;
      }
      for (let k = 0; k < due; k++) {
        const cue = storm.due[k];
        expect(cue.delay).toBeCloseTo(lastDelay, 6);
        // Due on the first frame at or after flash time + delay.
        const late = t - (lastFlashAt + cue.delay);
        expect(late).toBeGreaterThanOrEqual(-1e-6);
        expect(late).toBeLessThan(dt + 1e-6);
        checked++;
      }
    }
    // Every flash has its thunder: played, or (the last one or two) still on the way.
    expect(storm.thundersScheduled).toBe(storm.flashes);
    expect(storm.thundersPlayed + storm.pending).toBe(storm.flashes);
    expect(storm.pending).toBeLessThanOrEqual(1);
    expect(checked).toBe(storm.thundersPlayed);
    expect(checked).toBeGreaterThan(55);
  });

  it('keeps every delay, loudness and length inside the data ranges, and they really vary', () => {
    const T = MENU_STORM.thunder;
    const storm = new MenuStorm(23);
    const delays: number[] = [];
    const louds: number[] = [];
    const lengths: number[] = [];
    for (let i = 0; i < 300; i++) {
      storm.update(INTERVAL);
      delays.push(storm.lastCue.delay);
      louds.push(storm.lastCue.loudness);
      lengths.push(storm.lastCue.length);
    }
    const within = (xs: number[], r: readonly [number, number]): void => {
      for (const x of xs) {
        expect(x).toBeGreaterThanOrEqual(r[0]);
        expect(x).toBeLessThanOrEqual(r[1]);
      }
      const spread = Math.max(...xs) - Math.min(...xs);
      expect(spread, 'uses most of the range').toBeGreaterThan((r[1] - r[0]) * 0.8);
      expect(new Set(xs.map((x) => x.toFixed(4))).size, 'no two alike').toBeGreaterThan(xs.length * 0.95);
    };
    within(delays, T.delay);
    within(louds, T.loudness);
    within(lengths, T.length);
    // A delay is "a random fraction of a second".
    expect(T.delay[1]).toBeLessThan(1);
    expect(T.delay[0]).toBeGreaterThan(0);
  });

  it('shows a fork about as often as the data says', () => {
    const storm = new MenuStorm(31);
    const n = 4000;
    for (let i = 0; i < n; i++) storm.update(INTERVAL);
    expect(storm.forks / n).toBeGreaterThan(MENU_STORM.forkChance - 0.03);
    expect(storm.forks / n).toBeLessThan(MENU_STORM.forkChance + 0.03);
  });

  it('lights the sky right after a flash and darkens again; a fork only while it is shown', () => {
    const storm = new MenuStorm(2);
    storm.forceFlash(true);
    storm.update(0.03);
    expect(storm.flash).toBeGreaterThan(0.8);
    expect(storm.fork).toBeGreaterThan(0.8);
    storm.update(MENU_STORM.fork.time);
    expect(storm.fork).toBe(0);
    storm.update(1);
    expect(storm.flash).toBe(0);
    storm.forceFlash(false);
    storm.update(0.03);
    expect(storm.flash).toBeGreaterThan(0.8);
    expect(storm.fork).toBe(0);
  });

  it('turns lightning into a slow soft glow with no fork when flashing is reduced, and keeps the timing', () => {
    // The data: a sharp flash jumps, the soft glow never steps by more than a sliver between two frames.
    expect(steepest(MENU_STORM.flash.keys, 1)).toBeGreaterThan(0.25);
    expect(steepest(MENU_STORM.glow.keys, 3)).toBeLessThan(0.02);
    expect(steepest(SOFT_LIGHTNING.glow, 3)).toBeLessThan(0.02);
    expect(MENU_STORM.glow.skyAlpha).toBeLessThanOrEqual(MENU_STORM.flash.skyAlpha);
    const soft = new MenuStorm(41);
    const sharp = new MenuStorm(41);
    soft.setReduced(true);
    let worst = 0;
    let prev = 0;
    for (let i = 0; i < 60 * 120; i++) {
      soft.update(1 / 60);
      sharp.update(1 / 60);
      expect(soft.fork).toBe(0);
      worst = Math.max(worst, Math.abs(soft.flash - prev));
      prev = soft.flash;
    }
    expect(worst).toBeLessThan(0.02);
    expect(soft.forks).toBe(0);
    expect(sharp.forks).toBeGreaterThan(0);
    // Same flashes, same thunder: the setting changes the picture only.
    expect(soft.flashes).toBe(sharp.flashes);
    expect(soft.thundersPlayed).toBe(sharp.thundersPlayed);
    expect(soft.lastCue).toEqual(sharp.lastCue);
  });

  it('never cuts the light of a flash still fading when the next one comes (no sudden darkening either)', () => {
    for (const reduced of [true, false]) {
      const storm = new MenuStorm(8);
      storm.setReduced(reduced);
      storm.update(INTERVAL - 2.1);
      storm.forceFlash(false);
      let prev = storm.flash;
      let worstDrop = 0;
      for (let i = 0; i < 60 * 4; i++) {
        storm.update(1 / 60);
        worstDrop = Math.max(worstDrop, prev - storm.flash);
        prev = storm.flash;
      }
      expect(storm.flashes).toBe(2);
      // The envelopes' own fall per frame, at most; never a cut.
      expect(worstDrop).toBeLessThan(reduced ? 0.02 : steepest(MENU_STORM.flash.keys, 1) + 0.01);
    }
  });

  it('lets the battle lightning play a soft glow from the time of its strike', () => {
    const lightning = createLightning(createRng(4), WEATHER.lightning);
    expect(lightning.sinceStrike).toBe(Number.POSITIVE_INFINITY);
    lightning.strike(0, 1000);
    expect(lightning.sinceStrike).toBe(0);
    lightning.update(0.7);
    expect(lightning.sinceStrike).toBeCloseTo(0.7, 9);
    expect(lightningFlash(lightning.sinceStrike, SOFT_LIGHTNING.glow)).toBeGreaterThan(0.3);
    lightning.update(0);
    expect(lightning.sinceStrike).toBeCloseTo(0.7, 9);
  });
});

describe('title rain', () => {
  const L = MENU_STORM.rain.layers;

  it('scales the streaks with the screen area and holds them between each layer\'s caps', () => {
    for (const layer of L) {
      const small = MenuRain.countFor(layer, 568, 320);
      const phone = MenuRain.countFor(layer, 844, 390);
      const big = MenuRain.countFor(layer, 1000, 412);
      expect(small).toBeLessThanOrEqual(phone);
      expect(phone).toBeLessThanOrEqual(big);
      expect(small).toBeLessThan(big);
      expect(MenuRain.countFor(layer, 10, 10)).toBe(layer.min);
      expect(MenuRain.countFor(layer, 7680, 4320)).toBe(layer.max);
    }
    // Back to front the layers get sparser, faster, longer and sharper.
    for (let l = 1; l < L.length; l++) {
      expect(L[l].speed).toBeGreaterThan(L[l - 1].speed);
      expect(L[l].length).toBeGreaterThan(L[l - 1].length);
      expect(L[l].alpha).toBeGreaterThanOrEqual(L[l - 1].alpha);
      expect(L[l].perMegapixel).toBeLessThan(L[l - 1].perMegapixel);
    }
  });

  it('keeps every streak on the field while it falls, and lands splashes at the data rate', () => {
    const rain = new MenuRain(5, 60, 560);
    rain.layout(844, 390, 1000);
    expect(rain.total()).toBe(L.reduce((n, layer) => n + MenuRain.countFor(layer, 844, 390), 0));
    let landed = 0;
    for (let i = 0; i < 600; i++) {
      const before = rain.splashesLive();
      rain.update(1 / 60);
      landed += Math.max(0, rain.splashesLive() - before);
      for (let l = 0; l < rain.layers; l++) {
        for (let k = 0; k < rain.count[l]; k++) {
          const j = rain.start[l] + k;
          expect(rain.x[j]).toBeGreaterThanOrEqual(0);
          expect(rain.x[j]).toBeLessThan(1000);
          expect(rain.y[j]).toBeGreaterThanOrEqual(60);
          expect(rain.y[j]).toBeLessThanOrEqual(560);
        }
      }
    }
    expect(rain.splashesLive()).toBeLessThanOrEqual(MENU_STORM.rain.maxSplashes);
    expect(landed).toBeGreaterThan(0);
    for (let i = 0; i < rain.splashY.length; i++) {
      if (rain.splashAge[i] === Number.POSITIVE_INFINITY) continue;
      expect(rain.splashY[i]).toBeGreaterThanOrEqual(MENU_STORM.rain.splashBand[0]);
      expect(rain.splashY[i]).toBeLessThanOrEqual(MENU_STORM.rain.splashBand[1]);
    }
  });

  it('thins every layer with the quality share and freezes when time stands still', () => {
    const rain = new MenuRain(5, 60, 560);
    rain.layout(844, 390, 1000, 1);
    const full = rain.total();
    rain.layout(844, 390, 1000, 0.5);
    expect(rain.total()).toBeLessThan(full * 0.6);
    const x = Array.from(rain.x);
    rain.update(0);
    expect(Array.from(rain.x)).toEqual(x);
  });
});

describe('the load guard', () => {
  const G = MENU_STORM.guard;

  it('sheds rain step by step under slow frames, never below the floor, and takes it back after a calm', () => {
    const guard = new StormGuard();
    for (let i = 0; i < 40 * 30; i++) guard.update(40);
    expect(guard.share).toBe(G.floor);
    expect(guard.sheds).toBeGreaterThan(1);
    for (let i = 0; i < 60 * 200; i++) guard.update(1000 / 60);
    expect(guard.share).toBe(1);
    expect(guard.restores).toBeGreaterThan(0);
  });

  it('ignores a single stall and frames it should not count', () => {
    const guard = new StormGuard();
    for (let i = 0; i < 600; i++) guard.update(i === 300 ? 180 : 1000 / 60);
    guard.update(5000);
    guard.update(Number.NaN);
    expect(guard.share).toBe(1);
  });
});

describe('drops on the title panel', () => {
  it('stay on the panel, slide down in steps and form again at the top', () => {
    const drops = new PanelDrops(9);
    const D = MENU_STORM.panelDrops;
    expect(drops.count).toBe(D.count);
    let moves = 0;
    let lastY = Array.from(drops.y);
    let respawns = 0;
    for (let i = 0; i < 60 * 120; i++) {
      drops.update(1 / 60);
      for (let k = 0; k < drops.count; k++) {
        expect(drops.x[k]).toBeGreaterThanOrEqual(0);
        expect(drops.x[k]).toBeLessThanOrEqual(1);
        expect(drops.alpha[k]).toBeGreaterThanOrEqual(0);
        expect(drops.alpha[k]).toBeLessThanOrEqual(D.alpha + 1e-6);
        expect(drops.trail[k]).toBeLessThanOrEqual(D.trailMax + 1e-6);
        expect(drops.size[k]).toBeGreaterThanOrEqual(D.size[0]);
        expect(drops.size[k]).toBeLessThanOrEqual(D.size[1]);
        if (drops.y[k] > lastY[k]) moves++;
        if (drops.y[k] < lastY[k] - 0.3) respawns++;
      }
      lastY = Array.from(drops.y);
    }
    expect(moves).toBeGreaterThan(100);
    expect(respawns).toBeGreaterThan(0);
  });

  it('only bumps its version when something on the panel changed, and never while paused', () => {
    const still: MenuStormDef = { ...MENU_STORM, panelDrops: { ...MENU_STORM.panelDrops, hold: [1000, 1000], respawn: [1000, 1000], appear: 0.01 } };
    const drops = new PanelDrops(9, still);
    drops.update(0.1);
    const v = drops.version;
    for (let i = 0; i < 60; i++) drops.update(1 / 60);
    expect(drops.version).toBe(v);
    drops.update(0);
    expect(drops.version).toBe(v);
  });
});
