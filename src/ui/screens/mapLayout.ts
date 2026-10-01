/**
 * Pure layout maths for the campaign map (no DOM, unit-tested in Node):
 * how big to draw the map, and how to push clustered mission pins apart so
 * every pin keeps a full-size touch target.
 */
import { CAMPAIGN_MAP_VIEW, MAP_ASPECT } from '../../data/campaignMap';

export interface MapSize {
  w: number;
  h: number;
}

/** The map always covers its viewport and never shrinks below the minimum width, so small phones pan. */
export function mapSizeFor(viewW: number, viewH: number): MapSize {
  const w = Math.max(viewW, viewH * MAP_ASPECT, CAMPAIGN_MAP_VIEW.minWidthPx);
  return { w: Math.round(w), h: Math.round(w / MAP_ASPECT) };
}

/**
 * Push points apart until every pair is at least `minDist` apart, keeping each
 * as close to where it started as the crowd allows. Works in place on parallel
 * arrays; deterministic.
 */
export function relaxPins(xs: number[], ys: number[], minDist: number, width: number, height: number): void {
  const n = xs.length;
  const homeX = xs.slice();
  const homeY = ys.slice();
  const margin = CAMPAIGN_MAP_VIEW.pinMarginPx;
  const iterations = CAMPAIGN_MAP_VIEW.pinRelaxIterations;
  // The last stretch runs without the homeward pull so the separation settles exactly.
  const springUntil = Math.floor(iterations * 0.75);
  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = xs[j] - xs[i];
        let dy = ys[j] - ys[i];
        let d = Math.hypot(dx, dy);
        if (d >= minDist) continue;
        if (d < 0.001) {
          // Coincident points: split them along a direction that depends only on their indices.
          const angle = (i * 7 + j * 13) * 0.61803;
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          d = 1;
        }
        const push = (minDist - d) / 2 + 0.01;
        const ux = dx / d;
        const uy = dy / d;
        xs[i] -= ux * push;
        ys[i] -= uy * push;
        xs[j] += ux * push;
        ys[j] += uy * push;
      }
    }
    for (let i = 0; i < n; i++) {
      if (it < springUntil) {
        xs[i] += (homeX[i] - xs[i]) * CAMPAIGN_MAP_VIEW.pinSpring;
        ys[i] += (homeY[i] - ys[i]) * CAMPAIGN_MAP_VIEW.pinSpring;
      }
      xs[i] = Math.min(width - margin, Math.max(margin, xs[i]));
      ys[i] = Math.min(height - margin, Math.max(margin, ys[i]));
    }
  }
}

/** Clamp a pan offset so the map never shows a gap; a map smaller than the view is centred. */
export function clampPan(offset: number, mapExtent: number, viewExtent: number): number {
  if (mapExtent <= viewExtent) return (viewExtent - mapExtent) / 2;
  return Math.min(0, Math.max(viewExtent - mapExtent, offset));
}
