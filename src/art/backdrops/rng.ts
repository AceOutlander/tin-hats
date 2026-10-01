/**
 * Small seeded PRNG for the backdrop painters. Every layer derives its own
 * stream from (seed, layer key), so a layer draws the same picture however
 * often and in whatever order it is rasterised.
 */

export type Rng = () => number;

/** mulberry32: returns floats in [0, 1). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a hash of a string to an unsigned 32-bit integer. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Seed of an independent stream for `key`. */
export function subSeed(seed: number, key: string): number {
  return (hashString(key) ^ Math.imul((seed | 0) + 0x7f4a7c15, 0x9e3779b1)) >>> 0;
}

/** Float in [a, b). */
export function range(rng: Rng, a: number, b: number): number {
  return a + (b - a) * rng();
}

/** Integer in [a, b]. */
export function rangeInt(rng: Rng, a: number, b: number): number {
  return a + Math.floor(rng() * (b - a + 1));
}

export function chance(rng: Rng, p: number): boolean {
  return rng() < p;
}

/** -1 or 1. */
export function sign(rng: Rng): -1 | 1 {
  return rng() < 0.5 ? -1 : 1;
}
