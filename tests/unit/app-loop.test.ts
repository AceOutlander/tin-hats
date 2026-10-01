import { describe, expect, it } from 'vitest';
import { GameLoop, type LoopHooks } from '../../src/app/loop';
import { APP } from '../../src/data/app';
import { CONFIG } from '../../src/data/config';

const TICK_MS = 1000 / CONFIG.tickRate;

interface Rig {
  loop: GameLoop;
  steps: number;
  renders: { alpha: number; dt: number }[];
  effects: boolean[];
  begins: number;
  huds: number;
  ended: number;
  over: boolean;
  /** Make the battle over after this many steps. */
  overAfter: number;
}

function rig(): Rig {
  const r: Rig = { loop: null as unknown as GameLoop, steps: 0, renders: [], effects: [], begins: 0, huds: 0, ended: 0, over: false, overAfter: Infinity };
  const hooks: LoopHooks = {
    begin: () => {
      r.begins++;
    },
    step: () => {
      r.steps++;
      if (r.steps >= r.overAfter) r.over = true;
    },
    over: () => r.over,
    render: (alpha, dt) => r.renders.push({ alpha, dt }),
    hud: () => {
      r.huds++;
    },
    setEffects: (e) => r.effects.push(e),
    endDelayElapsed: () => {
      r.ended++;
    },
  };
  r.loop = new GameLoop(hooks, () => 0);
  return r;
}

describe('game loop', () => {
  it('runs one step per tick of real time and interpolates the rest', () => {
    const r = rig();
    r.loop.frame(TICK_MS * 2.5);
    expect(r.steps).toBe(2);
    expect(r.renders).toHaveLength(1);
    expect(r.renders[0].alpha).toBeCloseTo(0.5, 5);
    expect(r.renders[0].dt).toBeCloseTo((TICK_MS * 2.5) / 1000, 6);
    expect(r.huds).toBe(1);
  });

  it('accumulates small frames until a whole tick has passed', () => {
    const r = rig();
    for (let i = 0; i < 10; i++) r.loop.frame(1000 / 60);
    // Ten 60 Hz frames are five 30 Hz ticks.
    expect(r.steps).toBe(5);
  });

  it('cuts a long frame to the frame limit', () => {
    const r = rig();
    r.loop.frame(10_000);
    expect(r.steps).toBe(Math.floor(APP.maxFrameMs / TICK_MS));
  });

  it('clamps the steps per frame and drops the backlog at an extreme time scale', () => {
    const r = rig();
    r.loop.timeScale = APP.maxTimeScale;
    r.loop.frame(APP.maxFrameMs);
    expect(r.steps).toBe(APP.maxStepsPerFrame);
    r.loop.frame(1);
    // The backlog was dropped, so one millisecond at 240x is a few ticks at most.
    expect(r.steps - APP.maxStepsPerFrame).toBeLessThanOrEqual(8);
  });

  it('runs many steps per frame when fast-forwarding', () => {
    const r = rig();
    r.loop.timeScale = 30;
    r.loop.frame(100);
    expect(r.steps).toBe(90);
    expect(r.renders[0].dt).toBeCloseTo(3, 6);
  });

  it('switches cosmetic effects off above the effects time scale and back on below it', () => {
    const r = rig();
    r.loop.frame(16);
    r.loop.timeScale = 30;
    r.loop.frame(16);
    r.loop.frame(16);
    r.loop.timeScale = 1;
    r.loop.frame(16);
    expect(r.effects).toEqual([true, false, true]);
  });

  it('does not step while paused, and renders with a zero time step', () => {
    const r = rig();
    r.loop.frame(TICK_MS);
    r.loop.paused = true;
    r.loop.frame(1000);
    r.loop.frame(1000);
    expect(r.steps).toBe(1);
    expect(r.renders[1].dt).toBe(0);
    expect(r.renders[2].dt).toBe(0);
    expect(r.huds).toBe(3);
    r.loop.paused = false;
    r.loop.frame(TICK_MS);
    expect(r.steps).toBe(2);
  });

  it('stops stepping once the battle is over and reports the end after the delay', () => {
    const r = rig();
    r.overAfter = 3;
    r.loop.frame(TICK_MS * 10);
    expect(r.steps).toBe(3);
    expect(r.ended).toBe(0);
    expect(r.renders[0].alpha).toBe(1);
    const frames = Math.ceil((APP.resultDelaySeconds * 1000) / APP.maxFrameMs);
    for (let i = 0; i < frames + 1; i++) r.loop.frame(APP.maxFrameMs);
    expect(r.steps).toBe(3);
    expect(r.ended).toBe(1);
    r.loop.frame(APP.maxFrameMs);
    expect(r.ended).toBe(1);
  });

  it('counts the end delay in battle time, so fast-forward reaches the result sooner', () => {
    const r = rig();
    r.over = true;
    r.loop.timeScale = 60;
    r.loop.frame(100);
    expect(r.ended).toBe(1);
  });

  it('does not count the end delay while paused', () => {
    const r = rig();
    r.over = true;
    r.loop.paused = true;
    for (let i = 0; i < 40; i++) r.loop.frame(APP.maxFrameMs);
    expect(r.ended).toBe(0);
  });

  it('forgets everything on reset', () => {
    const r = rig();
    r.over = true;
    r.loop.frame(APP.maxFrameMs);
    r.loop.paused = true;
    r.loop.reset();
    expect(r.loop.paused).toBe(false);
    r.over = false;
    r.loop.frame(TICK_MS);
    expect(r.steps).toBe(1);
  });

  it('ignores a bad frame time', () => {
    const r = rig();
    r.loop.frame(Number.NaN);
    r.loop.frame(-5);
    expect(r.steps).toBe(0);
    expect(r.renders).toHaveLength(2);
  });
});
