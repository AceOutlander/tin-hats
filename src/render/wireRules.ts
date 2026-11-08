/**
 * View-side rules for barbed wire (no Phaser, so the unit tests can drive them): which men are struggling through an
 * enemy belt, which are drawn on the belt's feet line, and how a destroyed belt goes down (a tank folds the coil flat
 * over WIRE_LAYOUT.collapseTime; a shell leaves blown debris at once). The sim's slow and crush rules are untouched:
 * the struggle test mirrors the sim's own `inEnemyWire` (src/sim/projectiles.ts).
 */
import { WIRE_LAYOUT as W } from '../data/artLayout';
import type { DamageType } from '../data/schema';

/** The parts of a sim WireState these rules read. */
export interface WireLike {
  readonly x: number;
  readonly width: number;
  readonly owner: number;
  readonly alive: boolean;
}

/** True if a man of `side` at x is inside a standing belt of the other side's wire (the sim slows him there). */
export function wireStruggle(wires: readonly WireLike[], side: number, x: number): boolean {
  for (let i = 0; i < wires.length; i++) {
    const w = wires[i];
    if (!w.alive || w.owner === side) continue;
    if (Math.abs(x - w.x) <= w.width / 2) return true;
  }
  return false;
}

/** True if x is inside any standing belt: men there are drawn on the belt's feet line, so the coil wraps their legs. */
export function inStandingWire(wires: readonly WireLike[], x: number): boolean {
  for (let i = 0; i < wires.length; i++) {
    const w = wires[i];
    if (w.alive && Math.abs(x - w.x) <= w.width / 2) return true;
  }
  return false;
}

export type WireLook = 'standing' | 'collapsing' | 'crushed' | 'cut';

/** How one belt looks now. One per belt, made when the battle is built; nothing is allocated while it plays. */
export class WireWreck {
  look: WireLook = 'standing';
  /** Seconds since it was destroyed. */
  time = 0;
  /** Way the coil leans as it folds: the crushing tank's direction of travel (+1 = toward +x). */
  dir = 1;
  /** Latest start (s) of any piece's fold: the pieces go down one after another as the tank rolls over them. */
  maxLag = 0;

  reset(): void {
    this.look = 'standing';
    this.time = 0;
    this.dir = 1;
    this.maxLag = 0;
  }

  /**
   * The belt was destroyed (the sim's wireDestroyed event): cause null = crushed by a tank driving `dir`, which folds
   * the coil flat, piece by piece up to `maxLag` s apart (see pieceLag); 'explosive' (or anything else) = blown apart
   * at once. A second call changes nothing.
   */
  destroy(cause: DamageType | null, dir: number, maxLag = 0): void {
    if (this.look !== 'standing') return;
    this.time = 0;
    this.dir = dir < 0 ? -1 : 1;
    this.maxLag = Math.max(0, maxLag);
    this.look = cause === null ? 'collapsing' : 'cut';
  }

  step(dt: number): void {
    if (this.look === 'standing' || !(dt > 0)) return;
    this.time += dt;
    if (this.look === 'collapsing' && this.time >= W.collapseTime + this.maxLag) this.look = 'crushed';
  }

  /** Fold progress 0..1 (eased) of a piece that starts folding `lag` s after the belt: 0 standing, 1 flat or blown. */
  fold(lag = 0): number {
    if (this.look === 'standing') return 0;
    if (this.look !== 'collapsing') return 1;
    const t = Math.min(1, Math.max(0, (this.time - lag) / W.collapseTime));
    return t * t * (3 - 2 * t);
  }

  /** True while a piece's standing coil (both halves) is still drawn. */
  standingShown(lag = 0): boolean {
    return this.look === 'standing' || (this.look === 'collapsing' && this.fold(lag) < 1);
  }

  /** Height of a piece's standing coil as a share of full, folding down to collapseFlat. */
  standingScaleY(lag = 0): number {
    return 1 - (1 - W.collapseFlat) * this.fold(lag);
  }

  /** Lean of a folding coil (rad, screen rotation), the way the tank drives. */
  lean(lag = 0): number {
    return this.dir * W.collapseLean * this.fold(lag);
  }

  /** Opacity of a folding coil: it gives way to the tangle over the last part of the fold. */
  standingAlpha(lag = 0): number {
    const f = this.fold(lag);
    return f <= W.debrisFrom ? 1 : Math.max(0, 1 - (f - W.debrisFrom) / (1 - W.debrisFrom));
  }

  /** Which debris sprite a piece shows ('' = none yet). */
  debris(lag = 0): '' | 'crushed' | 'cut' {
    if (this.look === 'cut') return 'cut';
    if (this.look === 'standing') return '';
    return this.fold(lag) > W.debrisFrom ? 'crushed' : '';
  }

  /** Opacity of a piece's debris. */
  debrisAlpha(lag = 0): number {
    if (this.look === 'cut' || this.look === 'crushed') return 1;
    if (this.look !== 'collapsing') return 0;
    return Math.min(1, Math.max(0, (this.fold(lag) - W.debrisFrom) / (1 - W.debrisFrom)));
  }
}

/**
 * Seconds after the belt's crush that the piece at offset `x` (from the belt's centre) starts to fold: the first piece
 * the tank reaches (driving `dir`) goes at once, each next one W.collapseStagger later.
 */
export function pieceLag(x: number, count: number, dir: number): number {
  const half = ((count - 1) / 2) * W.pitch;
  return (Math.max(0, (dir < 0 ? -x : x) + half) / W.pitch) * W.collapseStagger;
}
