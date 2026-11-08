/**
 * A man climbing out of an APC (view only): he waits aboard at deck height, hops up and over the side and lands on
 * the ground. Pure maths so it can be tested without Phaser.
 */
import { RENDER } from '../data/render';

/**
 * Height (wu, figure space) above his ground line `age` s into the hop out of a carrier whose deck is `deck` wu up.
 * Negative age = still aboard (at the deck); past RENDER.apc.hopTime = on the ground (0).
 */
export function apcHopLift(age: number, deck: number): number {
  const A = RENDER.apc;
  if (age < 0) return deck;
  if (age >= A.hopTime) return 0;
  const t = age / A.hopTime;
  // Up by `jump` over the side, then down to the ground: a parabola from deck to 0 with its top above the deck.
  return deck * (1 - t) + 4 * A.jump * t * (1 - t);
}
