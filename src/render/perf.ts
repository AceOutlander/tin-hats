/**
 * Frame cost probe. Records, for every frame, the JS milliseconds spent in the
 * four phases of the frame handler and Phaser's draw, so tools/perf.ts (and
 * anyone with ?debug=1) can read exact per-frame numbers instead of smoothed
 * averages:
 *
 *   sim     everything the app does before it asks for the picture (input, the
 *           simulation steps and the view's afterStep) minus afterStep
 *   after   the view's afterStep: turning sim events into effects (all steps)
 *   render  view.render(): layout of every view and effect
 *   hud     what the app does after render (the HUD refresh)
 *   draw    Phaser's own draw (prerender to postrender); software WebGL makes
 *           this partly GPU time, so it is informational
 *
 * Samples go into fixed ring buffers; nothing allocates per frame. Frames played in fast-forward (effects off) are not recorded.
 */

const RING = 8192;

export interface PhaseStats {
  avg: number;
  p95: number;
  max: number;
}

export interface PerfReport {
  /** Frames recorded and the wall time they span (s). */
  frames: number;
  seconds: number;
  /** JS ms per frame. `js` = sim + after + render + hud (what the owner's 6 ms budget is about). */
  sim: PhaseStats;
  after: PhaseStats;
  render: PhaseStats;
  hud: PhaseStats;
  js: PhaseStats;
  draw: PhaseStats;
  /** Real ms between frames. */
  interval: PhaseStats;
  /** Sim steps per frame, on average. */
  stepsPerFrame: number;
}

function emptyStats(): PhaseStats {
  return { avg: 0, p95: 0, max: 0 };
}

function summarise(values: Float32Array, n: number): PhaseStats {
  if (n === 0) return emptyStats();
  const copy = values.slice(0, n).sort();
  let sum = 0;
  for (let i = 0; i < n; i++) sum += copy[i];
  return { avg: sum / n, p95: copy[Math.min(n - 1, Math.floor(n * 0.95))], max: copy[n - 1] };
}

export class FramePerf {
  private readonly sim = new Float32Array(RING);
  private readonly after = new Float32Array(RING);
  private readonly render = new Float32Array(RING);
  private readonly hud = new Float32Array(RING);
  private readonly js = new Float32Array(RING);
  private readonly draw = new Float32Array(RING);
  private readonly interval = new Float32Array(RING);
  private n = 0;
  private startedAt = 0;
  private endedAt = 0;

  private frameStart = 0;
  private renderStart = -1;
  private renderEnd = -1;
  private afterSum = 0;
  private drawStart = 0;
  private pending = false;
  private recording = true;
  private pendingInterval = 0;
  private steps = 0;
  private stepsTotal = 0;

  /** The Phaser scene update is about to call the frame handler. ecord false = leave this frame out (fast-forward). */
  beginFrame(now: number, record: boolean): void {
    this.recording = record;
    this.pendingInterval = this.frameStart > 0 ? now - this.frameStart : 0;
    this.frameStart = now;
    this.renderStart = -1;
    this.renderEnd = -1;
    this.afterSum = 0;
    this.steps = 0;
  }

  /** Real ms between the last two frame starts. */
  get lastInterval(): number {
    return this.pendingInterval;
  }

  beginRender(now: number): void {
    this.renderStart = now;
  }

  endRender(now: number): void {
    this.renderEnd = now;
  }

  /** One view.afterStep() took `ms` (one per sim step). */
  addAfterStep(ms: number): void {
    this.afterSum += ms;
    this.steps++;
  }

  /** The frame handler returned. */
  endFrame(now: number): void {
    this.pending = true;
    // Frames that never rendered (no battle shown) count as all sim time.
    if (this.renderStart < 0) {
      this.renderStart = now;
      this.renderEnd = now;
    }
    this.endedAt = now;
  }

  beginDraw(now: number): void {
    this.drawStart = now;
  }

  /** Phaser finished drawing: the frame's sample is complete. */
  endDraw(now: number): void {
    if (!this.pending) return;
    this.pending = false;
    if (!this.recording) return;
    const i = this.n % RING;
    if (this.n === 0) this.startedAt = this.frameStart;
    const sim = Math.max(0, this.renderStart - this.frameStart - this.afterSum);
    const render = Math.max(0, this.renderEnd - this.renderStart);
    const hud = Math.max(0, this.endedAt - this.renderEnd);
    this.sim[i] = sim;
    this.after[i] = this.afterSum;
    this.render[i] = render;
    this.hud[i] = hud;
    this.js[i] = sim + this.afterSum + render + hud;
    this.draw[i] = Math.max(0, now - this.drawStart);
    this.interval[i] = this.pendingInterval;
    this.stepsTotal += this.steps;
    this.n++;
  }

  reset(): void {
    this.n = 0;
    this.stepsTotal = 0;
    this.pending = false;
    this.startedAt = this.frameStart;
  }

  report(): PerfReport {
    const n = Math.min(this.n, RING);
    return {
      frames: this.n,
      seconds: Math.max(0, this.endedAt - this.startedAt) / 1000,
      sim: summarise(this.sim, n),
      after: summarise(this.after, n),
      render: summarise(this.render, n),
      hud: summarise(this.hud, n),
      js: summarise(this.js, n),
      draw: summarise(this.draw, n),
      interval: summarise(this.interval, n),
      stepsPerFrame: this.n > 0 ? this.stepsTotal / this.n : 0,
    };
  }
}
