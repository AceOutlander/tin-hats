import { describe, expect, it } from 'vitest';
import { WEATHER } from '../../src/data/weather';
import { createRng } from '../../src/fx/rng';
import { createWeather, lightningFlash, lightningFlashDuration, thunderDelay } from '../../src/fx/weather';

/** A random source that always returns the same number and counts how often it is asked. */
function stub(value: number): { rng: () => number; calls: () => number } {
  let calls = 0;
  return {
    rng: () => {
      calls++;
      return value;
    },
    calls: () => calls,
  };
}

describe('weather data', () => {
  it("holds the owner's three numbers", () => {
    expect(WEATHER.rainChance).toBe(0.4);
    expect(WEATHER.thunderCheckInterval).toBe(2);
    expect(WEATHER.thunderChance).toBe(0.005);
  });

  it('has rain streaks at two depths and a thunder delay range', () => {
    expect(WEATHER.rain.layers.length).toBe(2);
    for (const layer of WEATHER.rain.layers) {
      expect(layer.streaks).toBeGreaterThan(0);
      expect(layer.speed).toBeGreaterThan(0);
    }
    expect(WEATHER.rain.layers[1].speed).toBeGreaterThan(WEATHER.rain.layers[0].speed);
    expect(WEATHER.rain.splashRate).toBeGreaterThan(0);
    expect(WEATHER.rain.skyDarken).toBeGreaterThan(0);
    expect(WEATHER.rain.skyDarken).toBeLessThan(1);
    expect(WEATHER.lightning.thunderDelay[1]).toBeGreaterThan(WEATHER.lightning.thunderDelay[0]);
  });
});

describe('rain roll', () => {
  it('rains on close to 40% of 10,000 seeded maps', () => {
    let rainy = 0;
    for (let seed = 1; seed <= 10_000; seed++) {
      if (createWeather(createRng(seed), WEATHER).raining) rainy++;
    }
    // 40% of 10,000 = 4000; three standard deviations is about 147.
    expect(rainy).toBeGreaterThan(3850);
    expect(rainy).toBeLessThan(4150);
  });

  it('is decided by one draw against rainChance', () => {
    expect(createWeather(() => 0.3999, WEATHER).raining).toBe(true);
    expect(createWeather(() => 0.4, WEATHER).raining).toBe(false);
    expect(createWeather(() => 0.9, WEATHER).raining).toBe(false);
    const s = stub(0.1);
    createWeather(s.rng, WEATHER);
    expect(s.calls()).toBe(1);
  });

  it('never changes after creation', () => {
    const wet = createWeather(() => 0.1, WEATHER);
    const dry = createWeather(() => 0.9, WEATHER);
    for (let i = 0; i < 1000; i++) {
      wet.update(0.5);
      dry.update(0.5);
    }
    expect(wet.raining).toBe(true);
    expect(dry.raining).toBe(false);
  });

  it('honours the debug override either way', () => {
    expect(createWeather(() => 0.99, WEATHER, 'rain').raining).toBe(true);
    expect(createWeather(() => 0.01, WEATHER, 'clear').raining).toBe(false);
    expect(createWeather(() => 0.01, WEATHER, null).raining).toBe(true);
    expect(createWeather(() => 0.01, WEATHER, undefined).raining).toBe(true);
  });

  it('uses the data file by default', () => {
    expect(createWeather(() => 0.39).raining).toBe(true);
    expect(createWeather(() => 0.41).raining).toBe(false);
  });
});

describe('thunder checks', () => {
  it('makes exactly 300 checks in 601 s of updates at 60 fps', () => {
    const weather = createWeather(createRng(7), WEATHER, 'rain');
    const frames = 601 * 60;
    for (let i = 0; i < frames; i++) weather.update(1 / 60);
    expect(weather.checksMade).toBe(300);
  });

  it('makes none when it is not raining', () => {
    const s = stub(0.001);
    const weather = createWeather(s.rng, WEATHER, 'clear');
    const frames = 601 * 60;
    let reported = 0;
    for (let i = 0; i < frames; i++) reported += weather.update(1 / 60);
    expect(weather.checksMade).toBe(0);
    expect(weather.strikes).toBe(0);
    expect(reported).toBe(0);
    // Only the rain roll ever drew a number.
    expect(s.calls()).toBe(1);
  });

  it('checks once per full 2 s, not before', () => {
    const weather = createWeather(createRng(3), WEATHER, 'rain');
    weather.update(1.99);
    expect(weather.checksMade).toBe(0);
    weather.update(0.02);
    expect(weather.checksMade).toBe(1);
    weather.update(1.98);
    expect(weather.checksMade).toBe(1);
    weather.update(0.02);
    expect(weather.checksMade).toBe(2);
  });

  it('lands the check on the 2 s frame at 60 fps', () => {
    const weather = createWeather(createRng(3), WEATHER, 'rain');
    for (let i = 0; i < 119; i++) weather.update(1 / 60);
    expect(weather.checksMade).toBe(0);
    weather.update(1 / 60);
    expect(weather.checksMade).toBe(1);
  });

  it('carries the remainder and performs several checks for a large dt', () => {
    const weather = createWeather(createRng(3), WEATHER, 'rain');
    weather.update(7);
    expect(weather.checksMade).toBe(3);
    weather.update(1);
    expect(weather.checksMade).toBe(4);
    weather.update(100);
    expect(weather.checksMade).toBe(54);
  });

  it('draws exactly one random number per check', () => {
    const s = stub(0.5);
    const weather = createWeather(s.rng, WEATHER, 'rain');
    const afterRoll = s.calls();
    for (let i = 0; i < 100 * 60; i++) weather.update(1 / 60);
    expect(weather.checksMade).toBe(50);
    expect(s.calls() - afterRoll).toBe(50);
  });

  it('makes no checks without update calls, or with zero, negative or invalid dt', () => {
    const weather = createWeather(createRng(11), WEATHER, 'rain');
    expect(weather.checksMade).toBe(0);
    expect(weather.strikes).toBe(0);
    weather.update(0);
    weather.update(-5);
    weather.update(Number.NaN);
    weather.update(Number.POSITIVE_INFINITY);
    expect(weather.checksMade).toBe(0);
  });

  it('strikes on every check when the draw is 0.004', () => {
    const weather = createWeather(() => 0.004, WEATHER, 'rain');
    let reported = 0;
    for (let i = 0; i < 100; i++) reported += weather.update(2);
    expect(weather.checksMade).toBe(100);
    expect(weather.strikes).toBe(100);
    expect(reported).toBe(100);
  });

  it('never strikes when the draw is 0.006', () => {
    const weather = createWeather(() => 0.006, WEATHER, 'rain');
    let reported = 0;
    for (let i = 0; i < 100; i++) reported += weather.update(2);
    expect(weather.checksMade).toBe(100);
    expect(weather.strikes).toBe(0);
    expect(reported).toBe(0);
  });

  it('treats the chance as a strict threshold', () => {
    const weather = createWeather(() => 0.005, WEATHER, 'rain');
    weather.update(20);
    expect(weather.checksMade).toBe(10);
    expect(weather.strikes).toBe(0);
  });

  it('strikes on about 0.5% of a million checks', () => {
    const weather = createWeather(createRng(20240607), WEATHER, 'rain');
    let reported = 0;
    // 2,000,000 s of battle time in 1000 s lumps: 500 checks per call.
    for (let i = 0; i < 2000; i++) reported += weather.update(1000);
    expect(weather.checksMade).toBe(1_000_000);
    expect(reported).toBe(weather.strikes);
    // Expect 5000; three standard deviations is about 212.
    expect(weather.strikes).toBeGreaterThan(4750);
    expect(weather.strikes).toBeLessThan(5250);
  });

  it('reports each strike once, in the update where it happened', () => {
    // Strike on the 3rd check only.
    let check = 0;
    let rolled = false;
    const rng = (): number => {
      if (!rolled) {
        rolled = true;
        return 0;
      }
      check++;
      return check === 3 ? 0.001 : 0.9;
    };
    const weather = createWeather(rng, WEATHER, 'rain');
    expect(weather.update(2)).toBe(0);
    expect(weather.update(2)).toBe(0);
    expect(weather.update(2)).toBe(1);
    expect(weather.update(2)).toBe(0);
    expect(weather.strikes).toBe(1);
  });
});

describe('forced thunder', () => {
  it('is reported by the next update and counted', () => {
    const weather = createWeather(() => 0.9, WEATHER, 'rain');
    weather.forceThunder();
    expect(weather.strikes).toBe(1);
    expect(weather.update(1 / 60)).toBe(1);
    expect(weather.update(1 / 60)).toBe(0);
    expect(weather.checksMade).toBe(0);
  });

  it('works when it is not raining and does not count as a check', () => {
    const weather = createWeather(() => 0.9, WEATHER, 'clear');
    weather.forceThunder();
    weather.forceThunder();
    expect(weather.update(1 / 60)).toBe(2);
    expect(weather.strikes).toBe(2);
    expect(weather.checksMade).toBe(0);
  });

  it('adds to a natural strike in the same update', () => {
    const weather = createWeather(() => 0.001, WEATHER, 'rain');
    weather.forceThunder();
    expect(weather.update(2)).toBe(2);
    expect(weather.strikes).toBe(2);
    expect(weather.checksMade).toBe(1);
  });
});

describe('lightning flash envelope', () => {
  const duration = lightningFlashDuration();

  it('lasts about 0.6 s and is dark outside it', () => {
    expect(duration).toBeGreaterThan(0.5);
    expect(duration).toBeLessThan(0.7);
    expect(lightningFlash(-0.1)).toBe(0);
    expect(lightningFlash(0)).toBe(0);
    expect(lightningFlash(duration)).toBe(0);
    expect(lightningFlash(5)).toBe(0);
    expect(lightningFlash(Number.NaN)).toBe(0);
  });

  it('stays within 0..1', () => {
    for (let t = 0; t <= duration; t += 0.001) {
      const v = lightningFlash(t);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('is a sharp double flash: two peaks with a dip between, then a decay', () => {
    const samples: number[] = [];
    for (let t = 0; t <= duration; t += 0.002) samples.push(lightningFlash(t));
    const peaks: number[] = [];
    for (let i = 1; i < samples.length - 1; i++) {
      if (samples[i] > samples[i - 1] && samples[i] >= samples[i + 1] && samples[i] > 0.6) peaks.push(i);
    }
    expect(peaks.length).toBe(2);
    const dip = Math.min(...samples.slice(peaks[0], peaks[1]));
    expect(dip).toBeLessThan(0.3);
    // Sharp: the first peak arrives within 40 ms.
    expect(peaks[0] * 0.002).toBeLessThan(0.04);
    // Decay: after the second peak it only goes down.
    for (let i = peaks[1] + 1; i < samples.length; i++) expect(samples[i]).toBeLessThanOrEqual(samples[i - 1] + 1e-9);
  });

  it('gives thunder delays inside the configured range', () => {
    const rng = createRng(5);
    const [lo, hi] = WEATHER.lightning.thunderDelay;
    for (let i = 0; i < 1000; i++) {
      const d = thunderDelay(rng);
      expect(d).toBeGreaterThanOrEqual(lo);
      expect(d).toBeLessThan(hi);
    }
  });
});
