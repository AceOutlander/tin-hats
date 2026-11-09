import { describe, expect, it } from 'vitest';
import { RENDER_PERF } from '../../src/data/renderPerf';
import { createRng, ParticleSystem } from '../../src/fx';
import { FramePerf } from '../../src/render/perf';
import { burstDensity, QualityGovernor, startQuality } from '../../src/render/quality';
import { PRESET_DEFS, type PresetId } from '../../src/render/effects/presets';

const Q = RENDER_PERF.quality;

/** Feed the governor `seconds` of frames of a constant length. */
function run(gov: QualityGovernor, frameMs: number, seconds: number): void {
  const frames = Math.round((seconds * 1000) / frameMs);
  for (let i = 0; i < frames; i++) gov.update(frameMs);
}

describe('quality governor', () => {
  it('starts at the best level and stays there at 60 fps', () => {
    const gov = new QualityGovernor();
    run(gov, 16.7, 120);
    expect(gov.level).toBe(0);
    expect(gov.drops).toBe(0);
  });

  it('ignores a single long hitch and frames from a hidden tab', () => {
    const gov = new QualityGovernor();
    run(gov, 16.7, 5);
    gov.update(180);
    gov.update(Q.ignoreAboveMs + 1);
    gov.update(5000);
    run(gov, 16.7, 5);
    expect(gov.level).toBe(0);
  });

  it('drops one level at a time when frames stay slow, down to the lowest', () => {
    const gov = new QualityGovernor();
    // 40 ms frames: the average crosses the limit within a second, then dropAfter seconds of it lowers a level.
    run(gov, 40, Q.dropAfter - 0.5);
    expect(gov.level).toBe(0);
    run(gov, 40, 1.5);
    expect(gov.level).toBe(1);
    run(gov, 40, 6);
    expect(gov.level).toBe(Q.levels.length - 1);
    run(gov, 40, 60);
    expect(gov.level).toBe(Q.levels.length - 1);
    expect(gov.drops).toBe(Q.levels.length - 1);
  });

  it('does not drop for frames that are only a little slow', () => {
    const gov = new QualityGovernor();
    run(gov, 21, 60);
    expect(gov.level).toBe(0);
  });

  it('comes back up after a long calm, and waits longer after flapping', () => {
    const gov = new QualityGovernor();
    run(gov, 40, 3.5);
    expect(gov.level).toBe(1);
    run(gov, 16.7, Q.raiseAfter - 2);
    expect(gov.level).toBe(1);
    run(gov, 16.7, 6);
    expect(gov.level).toBe(0);
    expect(gov.raises).toBe(1);
    // Slow again soon after the raise: down again, and the next raise takes about twice as long.
    run(gov, 40, 3.5);
    expect(gov.level).toBe(1);
    run(gov, 16.7, Q.raiseAfter + 4);
    expect(gov.level).toBe(1);
    run(gov, 16.7, Q.raiseAfter + 4);
    expect(gov.level).toBe(0);
  });
  it('can be pinned to a level and released', () => {
    const gov = new QualityGovernor();
    gov.force(2);
    run(gov, 16.7, 120);
    expect(gov.level).toBe(2);
    gov.force(null);
    run(gov, 16.7, Q.raiseAfter + 2);
    expect(gov.level).toBe(1);
    gov.force(99);
    expect(gov.level).toBe(Q.levels.length - 1);
  });

  it('has levels that only ever get thinner', () => {
    for (let i = 1; i < Q.levels.length; i++) {
      const a = Q.levels[i - 1];
      const b = Q.levels[i];
      expect(b.density).toBeLessThan(a.density);
      expect(b.lowShare).toBeLessThan(a.lowShare);
      expect(b.softCap).toBeLessThan(a.softCap);
      expect(b.hardCap).toBeLessThan(a.hardCap);
      expect(b.softCap).toBeLessThan(b.hardCap);
      expect(b.tracerEvery).toBeGreaterThanOrEqual(a.tracerEvery);
      expect(b.weatherShare).toBeLessThan(a.weatherShare);
      expect(b.renderScale).toBeLessThanOrEqual(a.renderScale);
    }
  });
});

describe('particle caps', () => {
  it('bursts shrink between the soft and the hard cap and stop at the hard cap', () => {
    for (const level of Q.levels) {
      expect(burstDensity(level, 0)).toBe(level.density);
      expect(burstDensity(level, level.softCap)).toBe(level.density);
      const mid = burstDensity(level, (level.softCap + level.hardCap) / 2);
      expect(mid).toBeLessThan(level.density);
      expect(mid).toBeGreaterThan(0);
      expect(burstDensity(level, level.hardCap - 1)).toBeCloseTo(level.density * RENDER_PERF.minDensity, 5);
      expect(burstDensity(level, level.hardCap)).toBe(0);
      expect(burstDensity(level, level.hardCap + 500)).toBe(0);
    }
  });

  it('a density below 1 spawns fewer particles, but at least one per emitter', () => {
    const full = new ParticleSystem<PresetId>(createRng(3), 4000, PRESET_DEFS);
    full.spawn('bigExplosion', 100, 200);
    const thin = new ParticleSystem<PresetId>(createRng(3), 4000, PRESET_DEFS);
    thin.density = 0.3;
    thin.spawn('bigExplosion', 100, 200);
    expect(thin.count).toBeGreaterThan(0);
    expect(thin.count).toBeLessThan(full.count);
    const none = new ParticleSystem<PresetId>(createRng(3), 4000, PRESET_DEFS);
    none.density = 0;
    none.spawn('bigExplosion', 100, 200);
    expect(none.count).toBe(0);
  });

  it('a long barrage never takes the pool past the best level hard cap, and throttling wastes less than refusing', () => {
    const level = Q.levels[0];
    const barrage = (throttle: boolean): { peak: number; dropped: number } => {
      const ps = new ParticleSystem<PresetId>(createRng(9), level.hardCap, PRESET_DEFS);
      let peak = 0;
      for (let step = 0; step < 900; step++) {
        // Every step: four blasts, as a heavy battle produces, played the way EffectContext.play does.
        for (const id of ['bigExplosion', 'shellExplosion', 'smokeBurst', 'bigExplosion'] as const) {
          const density = throttle ? burstDensity(level, ps.count) : 1;
          if (density > 0) {
            ps.density = density;
            ps.spawn(id, 100 + step, 300);
          }
        }
        ps.update(1 / 30);
        peak = Math.max(peak, ps.count);
      }
      return { peak, dropped: ps.dropped };
    };
    const throttled = barrage(true);
    const refused = barrage(false);
    expect(throttled.peak).toBeLessThanOrEqual(level.hardCap);
    expect(refused.peak).toBeLessThanOrEqual(level.hardCap);
    expect(throttled.peak).toBeGreaterThan(level.softCap);
    expect(throttled.dropped).toBeLessThan(refused.dropped);
  });
});
describe('frame probe', () => {
  it('splits a frame into sim, afterStep, render and HUD and skips fast-forward frames', () => {
    const p = new FramePerf();
    // Frame 1 (recorded): handler 0..10, render 6..9, afterStep took 1; drawing 11..14.
    p.beginFrame(0, true);
    p.addAfterStep(1);
    p.beginRender(6);
    p.endRender(9);
    p.endFrame(10);
    p.beginDraw(11);
    p.endDraw(14);
    // Frame 2 (fast-forward): not recorded.
    p.beginFrame(20, false);
    p.beginRender(21);
    p.endRender(40);
    p.endFrame(41);
    p.beginDraw(42);
    p.endDraw(60);
    const r = p.report();
    expect(r.frames).toBe(1);
    expect(r.sim.avg).toBeCloseTo(5, 5);
    expect(r.after.avg).toBeCloseTo(1, 5);
    expect(r.render.avg).toBeCloseTo(3, 5);
    expect(r.hud.avg).toBeCloseTo(1, 5);
    expect(r.js.avg).toBeCloseTo(10, 5);
    expect(r.draw.avg).toBeCloseTo(3, 5);
    expect(r.work.avg).toBeCloseTo(13, 5);
    expect(r.hitches).toBe(0);
    expect(r.slowWork).toBe(0);
    expect(r.stepsPerFrame).toBe(1);
    p.reset();
    expect(p.report().frames).toBe(0);
  });

  it('reports average, p95 and worst over many frames', () => {
    const p = new FramePerf();
    let t = 0;
    for (let i = 0; i < 100; i++) {
      p.beginFrame(t, true);
      p.beginRender(t + 1);
      p.endRender(t + 1 + (i === 99 ? 20 : 1));
      p.endFrame(t + 3 + (i === 99 ? 20 : 0));
      p.beginDraw(t + 30);
      p.endDraw(t + 31);
      t += 100;
    }
    const r = p.report();
    expect(r.frames).toBe(100);
    expect(r.render.max).toBeCloseTo(20, 5);
    expect(r.render.p95).toBeCloseTo(1, 5);
    expect(r.render.avg).toBeCloseTo(1.19, 5);
    expect(r.interval.avg).toBeGreaterThan(90);
    // Frames 3..100 came 100 ms after the one before (the probe has no interval for the first two, as the clock starts
    // at 0 here): a hitch each, though none cost over 33 ms of work.
    expect(r.hitches).toBe(98);
    expect(r.slowWork).toBe(0);
    expect(r.work.max).toBeCloseTo(24, 5);
  });

  it('counts the frames whose own work runs over a missed 30 fps frame', () => {
    const p = new FramePerf();
    let t = 0;
    for (let i = 0; i < 10; i++) {
      const cost = i % 2 === 0 ? 40 : 5;
      p.beginFrame(t, true);
      p.beginRender(t);
      p.endRender(t + cost);
      p.endFrame(t + cost);
      p.beginDraw(t + cost);
      p.endDraw(t + cost);
      t += 16;
    }
    const r = p.report();
    expect(r.slowWork).toBe(5);
    expect(r.hitches).toBe(0);
  });
});

describe('start-up quality', () => {
  it('lets the frame times decide for people and pins full quality under automation', () => {
    expect(startQuality('', false)).toBeNull();
    expect(startQuality('?debug=1', false)).toBeNull();
    expect(startQuality('', true)).toBe(0);
    expect(startQuality('?debug=1', true)).toBe(0);
  });

  it('obeys ?quality= either way', () => {
    expect(startQuality('?quality=auto', true)).toBeNull();
    expect(startQuality('?quality=2', true)).toBe(2);
    expect(startQuality('?quality=1', false)).toBe(1);
    expect(startQuality('?quality=banana', false)).toBeNull();
  });
});
