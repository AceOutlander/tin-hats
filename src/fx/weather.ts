/**
 * Weather controller. Visual only: it is given its own random source and never
 * touches the simulation or the simulation's RNG.
 *
 * Rules (the owner's exact requirement):
 * - each map has a `rainChance` (40%) chance of rain, rolled once at creation;
 * - while it rains, one thunder check is made for every full
 *   `thunderCheckInterval` (2 s) of battle time;
 * - each check draws one random number and strikes when it is below
 *   `thunderChance` (0.5%).
 *
 * No Phaser, no DOM.
 */
import { WEATHER, type WeatherConfig } from '../data/weather';
import type { Rng01 } from './rng';

/** Debug override for the rain roll. */
export type WeatherOverride = 'rain' | 'clear' | null | undefined;

export interface Weather {
  /** Decided once at creation; never changes. */
  readonly raining: boolean;
  /** Thunder checks performed so far. */
  readonly checksMade: number;
  /** Thunder strikes so far, natural and forced. */
  readonly strikes: number;
  /**
   * Advance battle time. Do not call while the game is paused. Performs one
   * thunder check per full interval elapsed, carrying the remainder, so a large
   * dt performs several checks. Returns the number of strikes that happened in
   * this call (including any forced since the last call). Allocates nothing.
   */
  update(dtSeconds: number): number;
  /** Debug: make a strike happen now. It is reported by the next update(), rain or not. */
  forceThunder(): void;
}

/** Guards the comparison against the rounding error of summing frame times. */
const EPSILON = 1e-9;

class WeatherController implements Weather {
  readonly raining: boolean;
  checksMade = 0;
  strikes = 0;

  private elapsed = 0;
  private forced = 0;
  private readonly rng01: Rng01;
  private readonly interval: number;
  private readonly chance: number;

  constructor(rng01: Rng01, config: WeatherConfig, override: WeatherOverride) {
    this.rng01 = rng01;
    this.interval = config.thunderCheckInterval;
    this.chance = config.thunderChance;
    // The roll is always drawn so an override does not shift the random sequence.
    const roll = rng01();
    this.raining = override === 'rain' ? true : override === 'clear' ? false : roll < config.rainChance;
  }

  update(dtSeconds: number): number {
    let struck = this.forced;
    this.forced = 0;
    if (!this.raining || !(dtSeconds > 0) || !(this.interval > 0) || dtSeconds === Infinity) return struck;
    this.elapsed += dtSeconds;
    while (this.elapsed + EPSILON >= this.interval) {
      this.elapsed -= this.interval;
      this.checksMade++;
      if (this.rng01() < this.chance) {
        this.strikes++;
        struck++;
      }
    }
    return struck;
  }

  forceThunder(): void {
    this.strikes++;
    this.forced++;
  }
}

/**
 * Create the weather for one battle.
 * @param rng01 the view's random source (never the simulation's)
 * @param config rainChance, thunderCheckInterval, thunderChance; defaults to src/data/weather.ts
 * @param override 'rain' or 'clear' to force the rain roll (debug)
 */
export function createWeather(rng01: Rng01, config: WeatherConfig = WEATHER, override?: WeatherOverride): Weather {
  return new WeatherController(rng01, config, override);
}

/**
 * Brightness (0..1) of the lightning flash `t` seconds after a strike, from the
 * envelope keys in the weather data. 0 before the strike and after the last key.
 */
export function lightningFlash(t: number, keys: readonly (readonly [number, number])[] = WEATHER.lightning.flash): number {
  const n = keys.length;
  if (n === 0 || !(t >= keys[0][0]) || t >= keys[n - 1][0]) return 0;
  for (let i = 1; i < n; i++) {
    const b = keys[i];
    if (t < b[0]) {
      const a = keys[i - 1];
      const span = b[0] - a[0];
      return span > 0 ? a[1] + ((b[1] - a[1]) * (t - a[0])) / span : b[1];
    }
  }
  return 0;
}

/** Seconds of the whole flash envelope. */
export function lightningFlashDuration(keys: readonly (readonly [number, number])[] = WEATHER.lightning.flash): number {
  return keys.length > 0 ? keys[keys.length - 1][0] : 0;
}

/** Seconds to wait between a flash and its thunder sound. */
export function thunderDelay(rng01: Rng01, range: readonly [number, number] = WEATHER.lightning.thunderDelay): number {
  return range[0] + (range[1] - range[0]) * rng01();
}
