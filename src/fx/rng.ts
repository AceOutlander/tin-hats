/**
 * The view's own random numbers. Effects, weather and art never draw from the
 * simulation's RNG, so visuals can never change the outcome of a battle.
 */

/** A function returning a float in [0, 1). */
export type Rng01 = () => number;

/** mulberry32: small, fast, good enough for visuals. Same seed, same sequence. */
export function createRng(seed: number): Rng01 {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mixes two integers into one seed, e.g. a battle seed and a purpose tag. */
export function mixSeed(a: number, b: number): number {
  let h = (a ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (b >>> 0), 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}
