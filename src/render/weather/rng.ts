/**
 * The weather's random sources, seeded from the battle's visual seed (never from the simulation's seed or RNG).
 * Pure functions with no Phaser, so the rain roll can be tested on its own.
 */
import { RENDER } from '../../data/render';
import { createRng, mixSeed, type Rng01 } from '../../fx';

/** Random source for the weather controller: its first draw decides whether it rains on this map. */
export function weatherRng(visualSeed: number): Rng01 {
  return createRng(mixSeed(visualSeed, RENDER.weather.seedSalt));
}

/** Random source for lightning: where the bolts strike and how long the thunder takes. */
export function lightningRng(visualSeed: number): Rng01 {
  return createRng(mixSeed(visualSeed, RENDER.weather.seedSalt + 1));
}
