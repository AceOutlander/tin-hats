/**
 * Small allocation-free maths helpers for the figure pose system.
 * Angles are screen angles in a y-down space: direction (cos a, sin a), so a
 * positive change turns clockwise on screen (the same sense as a Phaser rotation).
 */

export const TAU = Math.PI * 2;
export const HALF_PI = Math.PI / 2;

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Smoothstep of t clamped to 0..1. */
export function smooth01(t: number): number {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

/** Smootherstep (zero velocity and acceleration at the ends). */
export function smoother01(t: number): number {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

/** Map v from [a, b] to a smoothstepped 0..1. */
export function ramp(v: number, a: number, b: number): number {
  return smooth01((v - a) / (b - a));
}

export function frac(x: number): number {
  return x - Math.floor(x);
}

/** Wrap an angle into [-PI, PI). */
export function wrapPi(a: number): number {
  return a - TAU * Math.floor((a + Math.PI) / TAU);
}

export function lerpAngle(a: number, b: number, t: number): number {
  return a + wrapPi(b - a) * t;
}

/** Smooth maximum: max(a, b) with the corner rounded over k. */
export function smoothMax(a: number, b: number, k: number): number {
  const d = a - b;
  return (a + b + Math.sqrt(d * d + k * k)) * 0.5;
}

/**
 * Critically damped spring toward `target` with time constant `tau` (about 5x
 * tau to settle). Exact for a constant target, so it is stable for any dt.
 */
export function springStep(
  val: Float64Array,
  vel: Float64Array,
  i: number,
  target: number,
  tau: number,
  dt: number,
): void {
  if (tau <= 1e-5) {
    val[i] = target;
    vel[i] = 0;
    return;
  }
  const w = 1 / tau;
  const x = val[i] - target;
  const v = vel[i];
  const k = v + w * x;
  const e = Math.exp(-w * dt);
  val[i] = target + (x + k * dt) * e;
  vel[i] = (v - w * k * dt) * e;
}

/** Deterministic hash of two numbers to [0, 1). */
export function hash01(a: number, b: number): number {
  let h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** Smooth 1D value noise in [-1, 1] (deterministic per seed). */
export function noise1(seed: number, t: number): number {
  const i = Math.floor(t);
  const f = t - i;
  const a = hash01(seed, i) * 2 - 1;
  const b = hash01(seed, i + 1) * 2 - 1;
  return a + (b - a) * (f * f * (3 - 2 * f));
}

/**
 * Sample a keyframed track [t0, v0, t1, v1, ...] with a Catmull-Rom curve
 * through the keys (held flat before the first and after the last key).
 */
export function sampleTrack(track: readonly number[], t: number): number {
  const n = track.length >> 1;
  if (n === 0) return 0;
  if (t <= track[0] || n === 1) return track[1];
  if (t >= track[(n - 1) * 2]) return track[(n - 1) * 2 + 1];
  let k = 0;
  while (k < n - 2 && t > track[(k + 1) * 2]) k++;
  const t1 = track[k * 2];
  const v1 = track[k * 2 + 1];
  const t2 = track[k * 2 + 2];
  const v2 = track[k * 2 + 3];
  const h = t2 - t1;
  const u = (t - t1) / h;
  // Tangents from neighbouring keys (zero at the ends so the track starts and stops gently).
  const m1 = k > 0 ? ((v2 - track[k * 2 - 1]) / (t2 - track[k * 2 - 2])) * h : 0;
  const m2 = k + 2 < n ? ((track[k * 2 + 5] - v1) / (track[k * 2 + 4] - t1)) * h : 0;
  const u2 = u * u;
  const u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * v1 + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * v2 + (u3 - u2) * m2;
}

/** Last key time of a track. */
export function trackEnd(track: readonly number[]): number {
  return track.length >= 2 ? track[track.length - 2] : 0;
}

/**
 * Two-bone IK from a root to a target. Writes the absolute screen angles of the
 * first and second bone into out[o] and out[o + 1]. bend = +1 puts the middle
 * joint on the side of the root-to-target direction turned clockwise (elbows:
 * behind and below a forward reach), -1 on the other side (knees: in front).
 * The reach is clamped so the bones never fully straighten or fold.
 */
export function solveIk(
  rx: number,
  ry: number,
  tx: number,
  ty: number,
  l1: number,
  l2: number,
  bend: number,
  reachMax: number,
  reachMin: number,
  out: Float64Array,
  o: number,
): void {
  const dx = tx - rx;
  const dy = ty - ry;
  let d = Math.sqrt(dx * dx + dy * dy);
  const base = d > 1e-6 ? Math.atan2(dy, dx) : Math.PI / 2;
  const total = l1 + l2;
  const lo = Math.max(Math.abs(l1 - l2) + 1e-3, total * reachMin);
  const hi = total * reachMax;
  d = clamp(d, lo, hi);
  const cosA = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const a1 = base + bend * Math.acos(cosA);
  const ex = rx + Math.cos(a1) * l1;
  const ey = ry + Math.sin(a1) * l1;
  const px = rx + Math.cos(base) * d;
  const py = ry + Math.sin(base) * d;
  out[o] = a1;
  out[o + 1] = Math.atan2(py - ey, px - ex);
}
