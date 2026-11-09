import { describe, expect, it } from 'vitest';
import { CAMPAIGN_MAP_VIEW, projection } from '../../src/data/campaignMap';
import { STALINGRAD_MAP } from '../../src/data/campaignMapStalingrad';
import { STALINGRAD_MISSIONS } from '../../src/data/missions/stalingrad';
import { boxPan, clampPan, clearLabels, labelBounds, labelHitsRect, layoutPins, mapSizeFor, relaxPins, type LabelBox, type Obstacle } from '../../src/ui/screens/mapLayout';

// The ten Stalingrad missions' markers (the campaign the map shows): Brest, Dubno, Volokolamsk, Klin, the four in the
// city, the Serafimovich bridgehead and Pitomnik.
const LONS = STALINGRAD_MISSIONS.map((m) => m.mapPos.lon);
const LATS = STALINGRAD_MISSIONS.map((m) => m.mapPos.lat);

function minPairDistance(xs: readonly number[], ys: readonly number[]): number {
  let min = Infinity;
  for (let i = 0; i < xs.length; i++) {
    for (let j = i + 1; j < xs.length; j++) min = Math.min(min, Math.hypot(xs[i] - xs[j], ys[i] - ys[j]));
  }
  return min;
}

describe('campaign map layout', () => {
  it('never draws the map smaller than its viewport or minimum width', () => {
    const small = mapSizeFor(300, 200);
    expect(small.w).toBeGreaterThanOrEqual(CAMPAIGN_MAP_VIEW.minWidthPx);
    const wide = mapSizeFor(1400, 500);
    expect(wide.w).toBeGreaterThanOrEqual(1400);
  });

  it('pushes clustered pins apart to the touch-target separation', () => {
    const xs = [100, 102, 104, 300];
    const ys = [100, 101, 99, 100];
    relaxPins(xs, ys, CAMPAIGN_MAP_VIEW.pinSeparationPx, 600, 600);
    expect(minPairDistance(xs, ys)).toBeGreaterThanOrEqual(CAMPAIGN_MAP_VIEW.pinSeparationPx - 0.5);
  });

  it('is deterministic', () => {
    const a = layoutPins(LONS, LATS, 632, 430);
    const b = layoutPins(LONS, LATS, 632, 430);
    expect(a).toEqual(b);
  });

  it('fits all ten pins on one screen on a 932x430 phone, with full-size touch separation', () => {
    const lay = layoutPins(LONS, LATS, 632, 430);
    expect(lay.fits).toBe(true);
    expect(minPairDistance(lay.xs, lay.ys)).toBeGreaterThanOrEqual(CAMPAIGN_MAP_VIEW.pinSeparationPx - 0.5);
    const pan = boxPan(lay.box, 632, 430);
    const x0 = clampPan(pan.x, lay.size.w, 632);
    const y0 = clampPan(pan.y, lay.size.h, 430);
    for (let i = 0; i < LONS.length; i++) {
      expect(lay.xs[i] + x0).toBeGreaterThan(0);
      expect(lay.xs[i] + x0).toBeLessThan(632);
      expect(lay.ys[i] + y0).toBeGreaterThan(0);
      expect(lay.ys[i] + y0).toBeLessThan(430);
    }
  });

  it('keeps the full-size map and pans on a small phone', () => {
    const lay = layoutPins(LONS, LATS, 370, 320);
    expect(lay.fits).toBe(false);
    expect(lay.size.w).toBeGreaterThanOrEqual(CAMPAIGN_MAP_VIEW.minWidthPx);
  });

  it('clamps pans so the map never shows a gap, and centres a map smaller than the view', () => {
    expect(clampPan(50, 800, 400)).toBe(0);
    expect(clampPan(-1000, 800, 400)).toBe(-400);
    expect(clampPan(-120, 800, 400)).toBe(-120);
    expect(clampPan(0, 300, 400)).toBe(50);
  });
});

describe('map lettering and pins', () => {
  const label = (x: number, y: number, angle = 0): LabelBox => ({ x, y, hw: 30, hh: 6, angle });
  const pin = (x: number, y: number): Obstacle => ({ x0: x - 22, y0: y - 21, x1: x + 22, y1: y + 27 });

  it('tells whether a label touches a rectangle, tilted or not', () => {
    expect(labelHitsRect(label(100, 100), pin(100, 100), 0)).toBe(true);
    expect(labelHitsRect(label(100, 100), pin(100, 160), 0)).toBe(false);
    // Just clear by 2 px, but within a 3 px pad.
    expect(labelHitsRect(label(100, 100), { x0: 131.9, y0: 90, x1: 160, y1: 110 }, 0)).toBe(false);
    expect(labelHitsRect(label(100, 100), { x0: 131.9, y0: 90, x1: 160, y1: 110 }, 3)).toBe(true);
    // A steeply tilted label reaches further up than the same label lying flat.
    const above: Obstacle = { x0: 90, y0: 60, x1: 110, y1: 70 };
    expect(labelHitsRect(label(100, 100), above, 0)).toBe(false);
    expect(labelHitsRect(label(100, 100, Math.PI / 2.2), above, 0)).toBe(true);
  });

  it('holds a tilted label in upright bounds that are wider and taller than the flat one', () => {
    const flat = labelBounds(label(0, 0));
    const tilted = labelBounds(label(0, 0, Math.PI / 4));
    expect(flat.x1 - flat.x0).toBeCloseTo(60, 6);
    expect(flat.y1 - flat.y0).toBeCloseTo(12, 6);
    expect(tilted.y1 - tilted.y0).toBeGreaterThan(flat.y1 - flat.y0);
    expect(tilted.x1 - tilted.x0).toBeLessThan(flat.x1 - flat.x0);
  });

  it('leaves clear lettering where it is and moves covered lettering the shortest way off the pin', () => {
    const shifts = clearLabels([label(300, 300), label(100, 100)], [pin(100, 100)], 70, 4, 3);
    expect(shifts[0]).toEqual({ dx: 0, dy: 0 });
    const moved = { ...label(100, 100), x: 100 + shifts[1].dx, y: 100 + shifts[1].dy };
    expect(labelHitsRect(moved, pin(100, 100), 3)).toBe(false);
    expect(Math.hypot(shifts[1].dx, shifts[1].dy)).toBeLessThanOrEqual(70);
    // The nearest clear spot: one step less would still touch.
    const r = Math.hypot(shifts[1].dx, shifts[1].dy);
    expect(r).toBeGreaterThan(0);
    for (const [ux, uy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const closer = { ...label(100, 100), x: 100 + ux * (r - 4), y: 100 + uy * (r - 4) };
      expect(labelHitsRect(closer, pin(100, 100), 3) || r - 4 <= 0).toBe(true);
    }
  });

  it('keeps moved lettering off other lettering that was placed before it, and gives up rather than fly far away', () => {
    const shifts = clearLabels([label(100, 100), label(100, 100)], [], 70, 4, 3);
    expect(shifts[0]).toEqual({ dx: 0, dy: 0 });
    const second = { ...label(100, 100), x: 100 + shifts[1].dx, y: 100 + shifts[1].dy };
    expect(labelHitsRect(second, labelBounds(label(100, 100)), 3)).toBe(false);
    // A pin the size of the whole neighbourhood cannot be escaped within 20 px: the label stays.
    const wall: Obstacle = { x0: -500, y0: -500, x1: 500, y1: 500 };
    expect(clearLabels([label(0, 0)], [wall], 20, 4, 3)[0]).toEqual({ dx: 0, dy: 0 });
  });

  it('clears every real map label of every pin in the campaign layout', () => {
    const MAP_LABELS = STALINGRAD_MAP.labels;
    const proj = projection(STALINGRAD_MAP.bounds);
    const mapX = (lon: number): number => proj.x(lon);
    const mapY = (lat: number): number => proj.y(lat);
    for (const [viewW, viewH] of [[568, 320], [844, 390], [1000, 412]] as const) {
      const layout = layoutPins(LONS, LATS, viewW - 200, viewH, proj);
      const u = layout.size.w / CAMPAIGN_MAP_VIEW.minWidthPx;
      // Rough label sizes: the real painter (src/ui/screens/mapPaint.ts) measures its font, this uses the average letter
      // width with the painter's sizes and spacing per kind; a town's name sits just right of its dot.
      const SIZE = { country: 11.5, region: 7.6, city: 7.4, river: 7.6, sea: 9.4 } as const;
      const SPACING = { country: 3.4, region: 1.6, city: 0.2, river: 1.8, sea: 2.6 } as const;
      const boxes = MAP_LABELS.map((l): LabelBox => {
        const px = SIZE[l.kind] * u;
        const spacing = SPACING[l.kind] * u;
        const hw = (l.text.length * (px * 0.62 + spacing)) / 2;
        const dx = l.kind === 'city' ? hw + 4 * u : 0;
        return { x: mapX(l.lon) * layout.size.w + dx, y: mapY(l.lat) * layout.size.h, hw, hh: px * 0.6, angle: ((l.angle ?? 0) * Math.PI) / 180 };
      });
      const pins = layout.xs.map((x, i) => pin(x, layout.ys[i]));
      const shifts = clearLabels(boxes, pins, CAMPAIGN_MAP_VIEW.labelMaxShiftPx, 4, 3);
      boxes.forEach((b, i) => {
        const moved = { ...b, x: b.x + shifts[i].dx, y: b.y + shifts[i].dy };
        for (const p of pins) expect(labelHitsRect(moved, p, 0), `${MAP_LABELS[i].text} at ${viewW}x${viewH}`).toBe(false);
      });
    }
  });
});