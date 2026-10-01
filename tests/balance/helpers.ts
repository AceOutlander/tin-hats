/**
 * Shared helpers of the balance tests (not a test file itself).
 */
import type { Battle } from '../../src/sim';
import { checkInvariants } from '../unit/sim-helpers';

/** A unit in 'move' that has not moved FROZEN_DISTANCE in FROZEN_SECONDS is frozen. */
export const FROZEN_SECONDS = 30;
const FROZEN_DISTANCE = 1;
/** Ticks between frozen checks. */
const FROZEN_EVERY = 15;

/** Watches every living unit for a long stretch in 'move' without getting anywhere. */
export class FrozenWatch {
  private readonly x = new Map<number, number>();
  private readonly since = new Map<number, number>();

  check(b: Battle): void {
    const s = b.state;
    for (let i = 0; i < s.unitCount; i++) {
      const u = s.units[i];
      if (!u.alive) continue;
      const lastX = this.x.get(u.id);
      if (u.action !== 'move' || lastX === undefined || Math.abs(u.x - lastX) > FROZEN_DISTANCE) {
        this.x.set(u.id, u.x);
        this.since.set(u.id, s.time);
        continue;
      }
      const since = this.since.get(u.id) ?? s.time;
      if (s.time - since > FROZEN_SECONDS) {
        throw new Error(`tick ${s.tick}: ${u.kind} ${u.id} of side ${u.side} frozen in 'move' at x=${u.x.toFixed(1)} since ${since.toFixed(1)}s`);
      }
    }
  }
}

/**
 * A fresh per-step check for one battle: every invariant of checkInvariants (nothing NaN, no
 * negative supplies, population within the cap, every unit on the map, the lines never crossing,
 * consistent counts) on every tick, and no unit frozen in 'move'.
 */
export function strictWatch(): (b: Battle) => void {
  const frozen = new FrozenWatch();
  return (b: Battle) => {
    checkInvariants(b);
    if (b.state.tick % FROZEN_EVERY === 0) frozen.check(b);
  };
}
