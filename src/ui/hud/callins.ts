/**
 * The call-in column on the HUD's left edge folds into one "Call-ins" button. This is its open/close logic and the
 * sizing of the open column, with no DOM, so the unit tests can run it in Node.
 *
 * The column starts folded. A tap on the toggle opens or folds it. While the player aims a call-in it stays open
 * (the armed button is lit there, and a second tap on it cancels); once the aim ends with a tap on the battlefield,
 * which is when the call goes out, it folds. Aiming that the player cancels (the banner's Cancel, the same button
 * again, Escape) or that a pause breaks off leaves it open, so another call-in can be picked.
 */
import type { SupportKind } from '../../data/schema';

export class CallInFold {
  /** True while the column of call-in buttons is shown. */
  open = false;
  private aimed: SupportKind | null = null;
  private cancelling = false;

  /** Tap on the toggle. Returns the new state. */
  toggle(): boolean {
    this.open = !this.open;
    return this.open;
  }

  /** Fold the column (a new battle, or the HUD hidden). Forgets any aim in progress. */
  reset(): void {
    this.open = false;
    this.aimed = null;
    this.cancelling = false;
  }

  /** The HUD itself is about to cancel the aim: the column must stay open when the aim ends. */
  noteCancel(): void {
    this.cancelling = true;
  }

  /**
   * Feed the support being aimed every frame (allocation-free). Returns true when this folded the column, i.e. the
   * aim ended without being cancelled or interrupted by a pause.
   */
  track(targeting: SupportKind | null, paused: boolean): boolean {
    const was = this.aimed;
    this.aimed = targeting;
    let folded = false;
    if (was !== null && targeting === null && !this.cancelling && !paused && this.open) {
      this.open = false;
      folded = true;
    }
    if (targeting === null) this.cancelling = false;
    return folded;
  }
}

/**
 * How many buttons go in each column of the open call-ins so that `count` buttons of `size` px with `gap` px between
 * them fit in `room` px of height, spread over as few columns as possible and balanced (6 in 2 columns is 3 + 3, not
 * 4 + 2). Always at least 1.
 */
export function callInRows(count: number, size: number, gap: number, room: number): number {
  if (count <= 0) return 1;
  const fit = size > 0 ? Math.max(1, Math.floor((room + gap) / (size + gap))) : count;
  const cols = Math.ceil(count / fit);
  return Math.ceil(count / cols);
}
