/**
 * The game loop: a fixed-step accumulator at the simulation tick rate, driven
 * by the view's frame handler. The loop knows nothing about Phaser or the DOM;
 * everything it touches comes in through LoopHooks, so it runs in unit tests.
 */
import { APP } from '../data/app';
import { CONFIG } from '../data/config';

export interface LoopHooks {
  /** Start of every frame, before any step (for example: send the controller input). */
  begin(): void;
  /** One simulation tick, followed by the view's afterStep and the app's event handling. */
  step(): void;
  /** True once the battle has ended. */
  over(): boolean;
  /** Draw. `alpha` is the position between the last two ticks; `dtSeconds` is battle seconds (0 while paused). */
  render(alpha: number, dtSeconds: number): void;
  /** Refresh the HUD from the battle. */
  hud(): void;
  /** Cosmetic effects on or off (off while fast-forwarding). */
  setEffects(enabled: boolean): void;
  /** The battle has been over for APP.resultDelaySeconds of battle time. Called once per battle. */
  endDelayElapsed(): void;
}

const TICK = 1 / CONFIG.tickRate;
/** Absorbs the rounding error of summing frame times, so exact multiples of a tick give whole steps. */
const EPSILON = 1e-9;

export class GameLoop {
  /** 1 = real time. Debug fast-forward raises it. */
  timeScale = 1;
  /** While true no steps run and the render time is zero. */
  paused = false;
  /** Smoothed milliseconds per simulation step and per render call. */
  stepMsAvg = 0;
  renderMsAvg = 0;
  /** Steps run in the most recent frame. */
  lastSteps = 0;

  private acc = 0;
  private overTime = 0;
  private endFired = false;
  private effects: boolean | null = null;

  constructor(
    private readonly hooks: LoopHooks,
    private readonly now: () => number = () => performance.now(),
  ) {}

  /** A new battle starts: forget the accumulator and the end-of-battle timer. */
  reset(): void {
    this.acc = 0;
    this.overTime = 0;
    this.endFired = false;
    this.effects = null;
    this.paused = false;
  }

  /** One rendered frame. `dtMs` is the real time since the previous frame. */
  frame(dtMs: number): void {
    const hooks = this.hooks;
    const real = Math.min(Math.max(Number.isFinite(dtMs) ? dtMs : 0, 0), APP.maxFrameMs) / 1000;
    const scale = this.paused ? 0 : Math.min(Math.max(this.timeScale, 0), APP.maxTimeScale);
    const dt = real * scale;

    const wantEffects = scale <= APP.effectsMaxTimeScale;
    if (wantEffects !== this.effects) {
      this.effects = wantEffects;
      hooks.setEffects(wantEffects);
    }

    hooks.begin();
    this.lastSteps = 0;
    if (dt > 0 && !hooks.over()) {
      this.acc += dt;
      let steps = 0;
      const t0 = this.now();
      while (this.acc + EPSILON >= TICK && steps < APP.maxStepsPerFrame && !hooks.over()) {
        hooks.step();
        this.acc -= TICK;
        steps++;
      }
      // Too far behind (a slow device or an extreme time scale): drop the rest instead of spiralling.
      if (steps >= APP.maxStepsPerFrame) this.acc = 0;
      this.lastSteps = steps;
      if (steps > 0) this.stepMsAvg += ((this.now() - t0) / steps - this.stepMsAvg) * APP.perfSmoothing;
    }

    const over = hooks.over();
    const t1 = this.now();
    hooks.render(over ? 1 : Math.max(0, this.acc / TICK), dt);
    this.renderMsAvg += (this.now() - t1 - this.renderMsAvg) * APP.perfSmoothing;
    hooks.hud();

    if (over) {
      this.overTime += dt;
      if (!this.endFired && this.overTime >= APP.resultDelaySeconds) {
        this.endFired = true;
        hooks.endDelayElapsed();
      }
    }
  }
}
