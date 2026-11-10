/**
 * Pure layout maths for the campaign map (no DOM, unit-tested in Node):
 * how big to draw the map, and how to push clustered mission pins apart so
 * every pin keeps a full-size touch target.
 */
import { CAMPAIGN_MAP_VIEW, projection, type MapProjection } from '../../data/campaignMap';
import { STALINGRAD_MAP } from '../../data/campaignMapStalingrad';

/** The projection the layout uses when none is given: the Stalingrad map's (the only campaign today). */
const DEFAULT_PROJECTION: MapProjection = projection(STALINGRAD_MAP.bounds);

export interface MapSize {
  w: number;
  h: number;
}

/** The map always covers its viewport and never shrinks below the minimum width, so small phones pan. */
export function mapSizeFor(viewW: number, viewH: number, aspect: number = DEFAULT_PROJECTION.aspect): MapSize {
  const w = Math.max(viewW, viewH * aspect, CAMPAIGN_MAP_VIEW.minWidthPx);
  return { w: Math.round(w), h: Math.round(w / aspect) };
}

export interface PinBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface PinLayout {
  size: MapSize;
  /** De-clustered pin centres in map pixels. */
  xs: number[];
  ys: number[];
  /** True when every pin fits inside the view at this size, so no panning is needed to see them all. */
  fits: boolean;
  box: PinBox;
}

function placePins(lons: readonly number[], lats: readonly number[], size: MapSize, proj: MapProjection): PinLayout {
  const xs = lons.map((lon) => proj.x(lon) * size.w);
  const ys = lats.map((lat) => proj.y(lat) * size.h);
  relaxPins(xs, ys, CAMPAIGN_MAP_VIEW.pinSeparationPx, size.w, size.h);
  const box: PinBox = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  for (let i = 0; i < xs.length; i++) {
    box.minX = Math.min(box.minX, xs[i]);
    box.maxX = Math.max(box.maxX, xs[i]);
    box.minY = Math.min(box.minY, ys[i]);
    box.maxY = Math.max(box.maxY, ys[i]);
  }
  return { size, xs, ys, fits: false, box };
}

/**
 * Pick the map size and pin positions for a view. Small phones get the full-size
 * map (they pan). Bigger screens get the largest map, no smaller than the fit
 * floor, on which every pin is on screen at once. `proj` is the campaign's map projection (default the Stalingrad map).
 */
export function layoutPins(
  lons: readonly number[],
  lats: readonly number[],
  viewW: number,
  viewH: number,
  proj: MapProjection = DEFAULT_PROJECTION,
): PinLayout {
  const base = mapSizeFor(viewW, viewH, proj.aspect);
  const full = placePins(lons, lats, base, proj);
  const m = CAMPAIGN_MAP_VIEW.fitMarginPx;
  const top = CAMPAIGN_MAP_VIEW.fitTopMarginPx;
  const fitsView = (b: PinBox): boolean => b.maxX - b.minX + 2 * m <= viewW && b.maxY - b.minY + top + m <= viewH;
  if (lons.length === 0) return full;
  for (let w = base.w; w >= CAMPAIGN_MAP_VIEW.fitMinWidthPx; w -= CAMPAIGN_MAP_VIEW.fitStepPx) {
    const candidate = w === base.w ? full : placePins(lons, lats, { w, h: Math.round(w / proj.aspect) }, proj);
    if (fitsView(candidate.box)) {
      candidate.fits = true;
      return candidate;
    }
  }
  return full;
}

/** Pan offset that puts the middle of the pins' box in the middle of the area left below the top margin. */
export function boxPan(box: PinBox, viewW: number, viewH: number): { x: number; y: number } {
  const top = CAMPAIGN_MAP_VIEW.fitTopMarginPx;
  const m = CAMPAIGN_MAP_VIEW.fitMarginPx;
  return {
    x: viewW / 2 - (box.minX + box.maxX) / 2,
    y: top + (viewH - top - m) / 2 - (box.minY + box.maxY) / 2,
  };
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

/** A line of map lettering: its centre, half its width and height, and its tilt (radians). */
export interface LabelBox {
  x: number;
  y: number;
  hw: number;
  hh: number;
  angle: number;
}

/** An upright rectangle that lettering must stay off (a mission pin and the pips under it). */
export interface Obstacle {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** The upright rectangle that just holds a tilted label. */
export function labelBounds(b: LabelBox): Obstacle {
  const c = Math.abs(Math.cos(b.angle));
  const s = Math.abs(Math.sin(b.angle));
  const ex = b.hw * c + b.hh * s;
  const ey = b.hw * s + b.hh * c;
  return { x0: b.x - ex, y0: b.y - ey, x1: b.x + ex, y1: b.y + ey };
}

/** True when a tilted label overlaps (or comes within `pad` of) an upright rectangle: separating-axis test on the four edge directions. */
export function labelHitsRect(b: LabelBox, r: Obstacle, pad: number): boolean {
  const rx = (r.x0 + r.x1) / 2;
  const ry = (r.y0 + r.y1) / 2;
  const rw = (r.x1 - r.x0) / 2 + pad;
  const rh = (r.y1 - r.y0) / 2 + pad;
  const dx = rx - b.x;
  const dy = ry - b.y;
  const cos = Math.cos(b.angle);
  const sin = Math.sin(b.angle);
  const axes: Array<[number, number]> = [
    [1, 0],
    [0, 1],
    [cos, sin],
    [-sin, cos],
  ];
  for (const [ax, ay] of axes) {
    // Half-extent of each shape along this axis, and the gap between their centres along it.
    const labelExtent = b.hw * Math.abs(ax * cos + ay * sin) + b.hh * Math.abs(-ax * sin + ay * cos);
    const rectExtent = rw * Math.abs(ax) + rh * Math.abs(ay);
    if (Math.abs(dx * ax + dy * ay) > labelExtent + rectExtent) return false;
  }
  return true;
}

/** Directions to try when a label has to move, nearest to straight up and down first (map lettering reads best shifted off a pin). */
const SHIFT_DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
  [0.7071, 0.7071],
  [-0.7071, 0.7071],
  [0.7071, -0.7071],
  [-0.7071, -0.7071],
];

/**
 * For each label, how far to move it so it is clear of every obstacle and of the labels placed before it, and (when
 * `bounds` is given) wholly inside `bounds`, so no name is covered by a pin or cut off at the map edge: the smallest
 * move found, trying `step` px more each time up to `maxShift`, then on to twice that before giving up. A label that is
 * already clear, or has no clear spot that close, stays where it is (pulled inside `bounds` if it can be). Deterministic.
 */
export function clearLabels(
  labels: readonly LabelBox[],
  obstacles: readonly Obstacle[],
  maxShift: number,
  step: number,
  pad: number,
  bounds?: Obstacle,
): Array<{ dx: number; dy: number }> {
  const taken: Obstacle[] = [...obstacles];
  const out: Array<{ dx: number; dy: number }> = [];
  const inside = (b: LabelBox): boolean => {
    if (!bounds) return true;
    const r = labelBounds(b);
    return r.x0 >= bounds.x0 && r.x1 <= bounds.x1 && r.y0 >= bounds.y0 && r.y1 <= bounds.y1;
  };
  const clear = (b: LabelBox): boolean => inside(b) && taken.every((r) => !labelHitsRect(b, r, pad));
  for (const label of labels) {
    let best = { dx: 0, dy: 0 };
    if (!clear(label)) {
      let found = false;
      search: for (let r = step; r <= maxShift * 2; r += step) {
        for (const [ux, uy] of SHIFT_DIRECTIONS) {
          if (clear({ ...label, x: label.x + ux * r, y: label.y + uy * r })) {
            best = { dx: ux * r, dy: uy * r };
            found = true;
            break search;
          }
        }
      }
      // Nowhere clear: at least keep the whole name on the map.
      if (!found && bounds) {
        const r = labelBounds(label);
        best = {
          dx: r.x0 < bounds.x0 ? bounds.x0 - r.x0 : r.x1 > bounds.x1 ? bounds.x1 - r.x1 : 0,
          dy: r.y0 < bounds.y0 ? bounds.y0 - r.y0 : r.y1 > bounds.y1 ? bounds.y1 - r.y1 : 0,
        };
      }
    }
    out.push(best);
    taken.push(labelBounds({ ...label, x: label.x + best.dx, y: label.y + best.dy }));
  }
  return out;
}

/** Clamp a pan offset so the map never shows a gap; a map smaller than the view is centred. */
export function clampPan(offset: number, mapExtent: number, viewExtent: number): number {
  if (mapExtent <= viewExtent) return (viewExtent - mapExtent) / 2;
  return Math.min(0, Math.max(viewExtent - mapExtent, offset));
}
