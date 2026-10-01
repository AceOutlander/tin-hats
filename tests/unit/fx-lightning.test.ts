import { describe, expect, it } from 'vitest';
import { VIEW } from '../../src/data/view';
import { WEATHER } from '../../src/data/weather';
import { createBoltBuffer, createLightning, generateBolt, type LightningBolt } from '../../src/fx/lightning';
import { createRainField } from '../../src/fx/rain';
import { createRng } from '../../src/fx/rng';

const SHAPE = WEATHER.lightning.bolt;

function pointOf(bolt: LightningBolt, line: number, index: number): [number, number] {
  const p = (bolt.start[line] + index) * 2;
  return [bolt.points[p], bolt.points[p + 1]];
}

function snapshot(bolt: LightningBolt): string {
  let used = 0;
  for (let i = 0; i < bolt.count; i++) used = Math.max(used, bolt.start[i] + bolt.length[i]);
  return JSON.stringify({
    count: bolt.count,
    points: Array.from(bolt.points.subarray(0, used * 2)),
    start: Array.from(bolt.start.subarray(0, bolt.count)),
    length: Array.from(bolt.length.subarray(0, bolt.count)),
  });
}

describe('lightning bolt generator', () => {
  it('runs from the sky point to the horizon point', () => {
    const bolt = generateBolt(42, 300, -20, 420, VIEW.horizonY);
    expect(bolt.count).toBeGreaterThanOrEqual(1);
    const [sx, sy] = pointOf(bolt, 0, 0);
    const [ex, ey] = pointOf(bolt, 0, bolt.length[0] - 1);
    expect(sx).toBeCloseTo(300, 3);
    expect(sy).toBeCloseTo(-20, 3);
    expect(ex).toBeCloseTo(420, 3);
    expect(ey).toBeCloseTo(VIEW.horizonY, 3);
    expect(bolt.length[0]).toBe((1 << SHAPE.generations) + 1);
    expect(bolt.depth[0]).toBe(0);
  });

  it('is pure: the same seed gives the same bolt, another seed a different one', () => {
    const a = snapshot(generateBolt(1234, 100, 0, 150, 350));
    const b = snapshot(generateBolt(1234, 100, 0, 150, 350));
    const c = snapshot(generateBolt(1235, 100, 0, 150, 350));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('is jagged: the trunk is clearly longer than the straight line and changes direction', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const bolt = generateBolt(seed, 500, 0, 520, 350);
      let length = 0;
      let turns = 0;
      let lastSide = 0;
      for (let i = 1; i < bolt.length[0]; i++) {
        const [ax, ay] = pointOf(bolt, 0, i - 1);
        const [bx, by] = pointOf(bolt, 0, i);
        length += Math.hypot(bx - ax, by - ay);
        const side = Math.sign(bx - ax);
        if (side !== 0 && lastSide !== 0 && side !== lastSide) turns++;
        if (side !== 0) lastSide = side;
      }
      const straight = Math.hypot(20, 350);
      expect(length).toBeGreaterThan(straight * 1.04);
      expect(length).toBeLessThan(straight * 2.5);
      expect(turns).toBeGreaterThan(6);
    }
  });

  it('heads downward overall and stays near its line', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const bolt = generateBolt(seed, 500, 0, 500, 350);
      const quarter = pointOf(bolt, 0, Math.floor(bolt.length[0] / 4));
      const threeQuarter = pointOf(bolt, 0, Math.floor((bolt.length[0] * 3) / 4));
      expect(threeQuarter[1]).toBeGreaterThan(quarter[1]);
      for (let i = 0; i < bolt.length[0]; i++) {
        const [x] = pointOf(bolt, 0, i);
        expect(Math.abs(x - 500)).toBeLessThan(350 * 0.5);
      }
    }
  });

  it('branches: most bolts have branches, attached to their parent, thinner and dimmer, within limits', () => {
    let withBranches = 0;
    let deepest = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const bolt = generateBolt(seed, 400, -20, 460, 352);
      expect(bolt.count).toBeLessThanOrEqual(1 + SHAPE.maxBranches);
      if (bolt.count > 1) withBranches++;
      for (let b = 1; b < bolt.count; b++) {
        expect(bolt.depth[b]).toBeGreaterThanOrEqual(1);
        expect(bolt.depth[b]).toBeLessThanOrEqual(SHAPE.maxDepth);
        deepest = Math.max(deepest, bolt.depth[b]);
        expect(bolt.width[b]).toBeLessThan(bolt.width[0]);
        expect(bolt.alpha[b]).toBeLessThan(1);
        expect(bolt.length[b]).toBe((1 << SHAPE.branchGenerations) + 1);
        // The branch starts exactly on a vertex of some earlier polyline.
        const [bx, by] = pointOf(bolt, b, 0);
        let attached = false;
        for (let p = 0; p < b && !attached; p++) {
          for (let i = 0; i < bolt.length[p]; i++) {
            const [px, py] = pointOf(bolt, p, i);
            if (px === bx && py === by) {
              attached = true;
              break;
            }
          }
        }
        expect(attached).toBe(true);
      }
      // Polylines never overlap in the point buffer.
      for (let b = 1; b < bolt.count; b++) {
        expect(bolt.start[b]).toBe(bolt.start[b - 1] + bolt.length[b - 1]);
      }
    }
    expect(withBranches).toBeGreaterThan(160);
    expect(deepest).toBe(SHAPE.maxDepth);
  });

  it('produces only finite numbers and fits the reusable buffer', () => {
    const buffer = createBoltBuffer();
    for (let seed = 1; seed <= 100; seed++) {
      const bolt = generateBolt(seed, seed * 13, -20, seed * 13 + 40, 352, SHAPE, buffer);
      expect(bolt).toBe(buffer);
      let used = 0;
      for (let i = 0; i < bolt.count; i++) used = Math.max(used, bolt.start[i] + bolt.length[i]);
      expect(used * 2).toBeLessThanOrEqual(buffer.points.length);
      for (let i = 0; i < used * 2; i++) expect(Number.isFinite(bolt.points[i])).toBe(true);
    }
  });
});

describe('lightning player', () => {
  it('is dark until struck, flashes for about 0.6 s, then goes dark again', () => {
    const fx = createLightning(createRng(9));
    expect(fx.active).toBe(false);
    expect(fx.flash).toBe(0);
    fx.update(1 / 60);
    expect(fx.flash).toBe(0);

    fx.strike(1000, 1000);
    expect(fx.active).toBe(true);
    let peak = 0;
    let boltSeen = false;
    let time = 0;
    while (fx.active && time < 5) {
      fx.update(1 / 120);
      time += 1 / 120;
      peak = Math.max(peak, fx.flash);
      if (fx.boltAlpha > 0) boltSeen = true;
    }
    expect(peak).toBeGreaterThan(0.9);
    expect(boltSeen).toBe(true);
    expect(time).toBeGreaterThan(0.5);
    expect(time).toBeLessThan(0.7);
    expect(fx.flash).toBe(0);
    expect(fx.boltAlpha).toBe(0);
  });

  it('strikes inside the visible strip, from above the screen down to the horizon', () => {
    const fx = createLightning(createRng(10));
    for (let i = 0; i < 100; i++) {
      fx.strike(2000, 900);
      const bolt = fx.bolt;
      const top = (bolt.start[0] + 0) * 2;
      const end = (bolt.start[0] + bolt.length[0] - 1) * 2;
      expect(bolt.points[top + 1]).toBeLessThan(0);
      expect(bolt.points[end]).toBeGreaterThan(2000);
      expect(bolt.points[end]).toBeLessThan(2900);
      expect(bolt.points[end + 1]).toBeCloseTo(VIEW.horizonY, 3);
    }
  });

  it('signals the thunder exactly once, after the configured delay', () => {
    const fx = createLightning(createRng(11));
    const [lo, hi] = WEATHER.lightning.thunderDelay;
    fx.strike(0, 1000);
    let rumbles = 0;
    let at = -1;
    let time = 0;
    for (let i = 0; i < 10 * 120; i++) {
      time += 1 / 120;
      if (fx.update(1 / 120)) {
        rumbles++;
        at = time;
      }
    }
    expect(rumbles).toBe(1);
    expect(at).toBeGreaterThanOrEqual(lo);
    expect(at).toBeLessThanOrEqual(hi + 0.02);
  });
});

describe('rain field', () => {
  const look = WEATHER.rain;

  it('has streaks at two depths, scaled to the screen width', () => {
    const one = createRainField(createRng(1), VIEW.screenWu);
    expect(one.farCount).toBe(look.layers[0].streaks);
    expect(one.count).toBe(look.layers[0].streaks + look.layers[1].streaks);
    const two = createRainField(createRng(1), VIEW.screenWu * 2);
    expect(two.count).toBe(one.count * 2);
    let far = 0;
    for (let i = 0; i < one.count; i++) if (one.layer[i] === 0) far++;
    expect(far).toBe(one.farCount);
    expect(one.rotation).toBeCloseTo(-look.angle, 6);
  });

  it('keeps every streak inside the field while it falls, and moves it down and along the lean', () => {
    const width = 1700;
    const rain = createRainField(createRng(2), width);
    const x0 = rain.x[0];
    const y0 = rain.y[0];
    rain.update(0.001);
    expect(rain.y[0]).toBeGreaterThan(y0);
    expect(rain.x[0]).toBeGreaterThan(x0);
    for (let frame = 0; frame < 600; frame++) {
      rain.update(1 / 60);
      for (let i = 0; i < rain.count; i++) {
        expect(rain.x[i]).toBeGreaterThanOrEqual(0);
        expect(rain.x[i]).toBeLessThanOrEqual(width);
        expect(rain.y[i]).toBeGreaterThanOrEqual(-look.overscan - 1);
        expect(rain.y[i]).toBeLessThanOrEqual(VIEW.heightWu + look.overscan + 1);
      }
    }
  });

  it('fades in and then asks for splashes at the configured rate on the walkable band', () => {
    const rain = createRainField(createRng(3), VIEW.screenWu);
    expect(rain.intensity).toBe(0);
    for (let i = 0; i < Math.ceil(look.fadeIn * 60) + 1; i++) rain.update(1 / 60);
    expect(rain.intensity).toBe(1);
    let splashes = 0;
    for (let i = 0; i < 600; i++) splashes += rain.update(1 / 60);
    expect(splashes).toBeGreaterThanOrEqual(look.splashRate * 10 - 2);
    expect(splashes).toBeLessThanOrEqual(look.splashRate * 10 + 2);
    for (let i = 0; i < 200; i++) {
      expect(rain.splashX()).toBeGreaterThanOrEqual(0);
      expect(rain.splashX()).toBeLessThan(VIEW.screenWu);
      const y = rain.splashY();
      expect(y).toBeGreaterThanOrEqual(VIEW.groundY - look.splashBand);
      expect(y).toBeLessThanOrEqual(VIEW.groundY + look.splashBand);
    }
  });

  it('does nothing without time passing', () => {
    const rain = createRainField(createRng(4), VIEW.screenWu);
    const y0 = rain.y[5];
    expect(rain.update(0)).toBe(0);
    expect(rain.y[5]).toBe(y0);
  });
});
