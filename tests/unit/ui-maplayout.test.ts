import { describe, expect, it } from 'vitest';
import { CAMPAIGN_MAP_VIEW } from '../../src/data/campaignMap';
import { boxPan, clampPan, layoutPins, mapSizeFor, relaxPins } from '../../src/ui/screens/mapLayout';

// Approximate positions of the ten missions: Arras, Dunkirk, Crusader, Alamein, Primosole,
// Cassino, Sword Beach, Hill 112, Arnhem, Reichswald.
const LONS = [2.78, 2.38, 24.0, 28.95, 15.07, 13.81, -0.29, -0.46, 5.9, 6.05];
const LATS = [50.29, 51.03, 31.6, 30.83, 37.27, 41.49, 49.3, 49.11, 51.98, 51.7];

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
