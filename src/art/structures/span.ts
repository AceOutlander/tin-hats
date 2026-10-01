/**
 * Pure helper for laying tileable pieces (trench sections, wire) across any width.
 */
export interface TileSpan {
  /** Number of middle tiles. */
  count: number;
  /** x of the first middle tile's left edge, relative to the CENTRE of the span. */
  firstX: number;
  /** Distance between tile left edges. */
  step: number;
  /** Horizontal scale to give each tile so they exactly fill the gap (close to 1). */
  scaleX: number;
  /** x of the left and right cap's left edge, relative to the centre of the span. */
  capLeftX: number;
  capRightX: number;
}

export function createTileSpan(): TileSpan {
  return { count: 0, firstX: 0, step: 0, scaleX: 1, capLeftX: 0, capRightX: 0 };
}

/**
 * Fit caps of width capW (0 for none) and a whole number of tiles of width
 * tileW into `width`. Writes into `out` and returns it; allocates nothing.
 */
export function tileSpan(width: number, capW: number, tileW: number, out: TileSpan): TileSpan {
  const inner = Math.max(tileW * 0.5, width - 2 * capW);
  const count = Math.max(1, Math.round(inner / tileW));
  out.count = count;
  out.step = inner / count;
  out.scaleX = out.step / tileW;
  out.firstX = -inner / 2;
  out.capLeftX = -inner / 2 - capW;
  out.capRightX = inner / 2;
  return out;
}
