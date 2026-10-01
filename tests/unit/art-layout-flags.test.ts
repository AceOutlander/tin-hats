import { describe, expect, it } from 'vitest';
import { FLAG_LAYOUT } from '../../src/data/artLayout';
import { createTileSpan, flagStripTint, flagWave, tileSpan, type FlagWave } from '../../src/art/structures';
import { TRENCH_LAYOUT } from '../../src/data/artLayout';

const W = FLAG_LAYOUT.wave;

describe('flagWave', () => {
  it('is pinned at the hoist: no offset, whatever the time', () => {
    for (let t = 0; t < 12; t += 0.37) expect(flagWave(t, 0).dy).toBeCloseTo(0, 12);
  });

  it('is periodic in time with the period in the layout data', () => {
    for (let t = 0; t < 4; t += 0.31) {
      for (let u = 0; u <= 1; u += 0.1) {
        const a = flagWave(t, u, { dy: 0, shade: 0 });
        const b = flagWave(t + W.period, u, { dy: 0, shade: 0 });
        const c = flagWave(t + 3 * W.period, u, { dy: 0, shade: 0 });
        expect(b.dy).toBeCloseTo(a.dy, 9);
        expect(b.shade).toBeCloseTo(a.shade, 9);
        expect(c.dy).toBeCloseTo(a.dy, 9);
      }
    }
  });

  it('is continuous in time and along the flag (small steps give small changes, including across the wrap)', () => {
    const a: FlagWave = { dy: 0, shade: 0 };
    const b: FlagWave = { dy: 0, shade: 0 };
    const dt = 1e-3;
    const du = 1e-3;
    const startsToCheck = [0, 0.5, W.period - dt, 2 * W.period - dt];
    for (const t of startsToCheck) {
      for (let u = 0; u <= 1; u += 0.05) {
        flagWave(t, u, a);
        flagWave(t + dt, u, b);
        expect(Math.abs(b.dy - a.dy)).toBeLessThan(0.05);
        expect(Math.abs(b.shade - a.shade)).toBeLessThan(0.05);
      }
    }
    for (let t = 0; t < W.period; t += 0.25) {
      for (let u = 0; u < 1; u += 0.05) {
        flagWave(t, u, a);
        flagWave(t, u + du, b);
        expect(Math.abs(b.dy - a.dy)).toBeLessThan(0.1);
        expect(Math.abs(b.shade - a.shade)).toBeLessThan(0.1);
      }
    }
  });

  it('actually waves, but stays within a few wu, and shades within -1..1', () => {
    let lo = Infinity;
    let hi = -Infinity;
    let shadeLo = Infinity;
    let shadeHi = -Infinity;
    const out: FlagWave = { dy: 0, shade: 0 };
    for (let t = 0; t < W.period; t += 0.05) {
      flagWave(t, 1, out);
      lo = Math.min(lo, out.dy);
      hi = Math.max(hi, out.dy);
      for (let u = 0; u <= 1; u += 0.05) {
        flagWave(t, u, out);
        shadeLo = Math.min(shadeLo, out.shade);
        shadeHi = Math.max(shadeHi, out.shade);
      }
    }
    expect(hi - lo).toBeGreaterThan(3);
    expect(Math.max(Math.abs(lo), Math.abs(hi))).toBeLessThan(FLAG_LAYOUT.h * 0.5);
    expect(shadeLo).toBeGreaterThanOrEqual(-1);
    expect(shadeHi).toBeLessThanOrEqual(1);
    expect(shadeHi - shadeLo).toBeGreaterThan(0.5);
  });

  it('writes into the object it is given, and returns it', () => {
    const out: FlagWave = { dy: 99, shade: 99 };
    expect(flagWave(1.2, 0.6, out)).toBe(out);
    expect(out.dy).not.toBe(99);
    expect(out.shade).not.toBe(99);
    // The shared scratch result is stable between calls with the same inputs.
    const x = { ...flagWave(0.7, 0.4) };
    const y = { ...flagWave(0.7, 0.4) };
    expect(y).toEqual(x);
  });

  it('gives a grey multiply tint within range that brightens with the shade', () => {
    for (let s = -1; s <= 1; s += 0.25) {
      const tint = flagStripTint(s);
      expect(tint).toBeGreaterThanOrEqual(0);
      expect(tint).toBeLessThanOrEqual(0xffffff);
      expect((tint >> 16) & 0xff).toBe(tint & 0xff);
      expect((tint >> 8) & 0xff).toBe(tint & 0xff);
    }
    expect(flagStripTint(1) & 0xff).toBeGreaterThan(flagStripTint(-1) & 0xff);
    expect(flagStripTint(100) & 0xff).toBeLessThanOrEqual(255);
  });

  it('keeps the flat flag at a 5:3 ratio cut into a sensible number of strips', () => {
    expect(FLAG_LAYOUT.w / FLAG_LAYOUT.h).toBeCloseTo(5 / 3, 6);
    expect(FLAG_LAYOUT.strips).toBeGreaterThanOrEqual(8);
    expect(FLAG_LAYOUT.strips).toBeLessThanOrEqual(16);
  });
});

describe('tileSpan (trench and wire runs of any width)', () => {
  const span = createTileSpan();

  it('fits the caps and a whole number of stretched tiles exactly into the width', () => {
    // Below two caps plus half a tile the span is widened to that minimum, so start above it.
    for (let width = 2 * TRENCH_LAYOUT.capW + TRENCH_LAYOUT.tileW * 0.5; width <= 900; width += 7) {
      tileSpan(width, TRENCH_LAYOUT.capW, TRENCH_LAYOUT.tileW, span);
      const inner = span.count * span.step;
      expect(span.count).toBeGreaterThanOrEqual(1);
      expect(inner + 2 * TRENCH_LAYOUT.capW).toBeCloseTo(Math.max(width, 2 * TRENCH_LAYOUT.capW + TRENCH_LAYOUT.tileW * 0.5), 9);
      expect(span.capLeftX).toBeCloseTo(-width / 2, 9);
      expect(span.capRightX + TRENCH_LAYOUT.capW).toBeCloseTo(width / 2, 9);
      expect(span.firstX).toBeCloseTo(span.capLeftX + TRENCH_LAYOUT.capW, 9);
      expect(span.firstX + inner).toBeCloseTo(span.capRightX, 9);
      expect(span.scaleX * TRENCH_LAYOUT.tileW).toBeCloseTo(span.step, 9);
      // Tiles are never stretched or squashed far: within half to one and a half for a single
      // tile, within a quarter either way from two tiles up.
      expect(span.scaleX).toBeGreaterThanOrEqual(0.5 - 1e-9);
      expect(span.scaleX).toBeLessThanOrEqual(1.5 + 1e-9);
      if (span.count >= 2) {
        expect(span.scaleX).toBeGreaterThanOrEqual(0.75 - 1e-9);
        expect(span.scaleX).toBeLessThanOrEqual(1.25 + 1e-9);
      }
    }
  });

  it('returns the object it is given and never produces a negative or empty span', () => {
    expect(tileSpan(10, TRENCH_LAYOUT.capW, TRENCH_LAYOUT.tileW, span)).toBe(span);
    expect(span.count).toBe(1);
    expect(span.step).toBeGreaterThan(0);
    tileSpan(300, 0, 64, span);
    expect(span.count * span.step).toBeCloseTo(300, 9);
    expect(span.capLeftX).toBeCloseTo(-150, 9);
  });
});
