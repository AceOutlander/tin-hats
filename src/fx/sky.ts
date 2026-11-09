/**
 * The view's side of scripted weather and time of day (FOUNDATIONS.md 4.7): how much of each weather is showing during
 * a crossfade, the veils and the light that follow from it, and drifting particle fields (snow, blizzard, dust, smoke,
 * fog banks). View only: it reads the sim's sky state and never writes it; its randomness is the view's own. No
 * Phaser, no DOM.
 */
import type { TimeOfDay, WeatherKind } from '../data/schema';
import { TIME_GRADES } from '../data/theatres';
import { VIEW } from '../data/view';
import { WEATHER_LOOKS, type DriftFieldLook } from '../data/weather';
import type { Rng01 } from './rng';

export interface Rgb01 {
  r: number;
  g: number;
  b: number;
}

function rgb01(hex: string): Rgb01 {
  const v = parseInt(hex.slice(1), 16);
  return { r: ((v >> 16) & 255) / 255, g: ((v >> 8) & 255) / 255, b: (v & 255) / 255 };
}

/** 0xRRGGBB of a 0..1 colour. */
export function rgbInt(c: Rgb01): number {
  const q = (v: number): number => Math.max(0, Math.min(255, Math.round(v * 255)));
  return (q(c.r) << 16) | (q(c.g) << 8) | q(c.b);
}

/** A veil: its colour and opacity. */
export interface Veil {
  color: Rgb01;
  alpha: number;
}

/**
 * Two veils laid one over the other at weights wa and wb (a crossfade): one veil of the combined opacity whose colour
 * is the alpha-weighted mix. Equal to `a` when wb is 0 and to `b` when wa is 0.
 */
export function mixVeil(a: Veil, wa: number, b: Veil, wb: number, out: Veil): Veil {
  const pa = a.alpha * wa;
  const pb = b.alpha * wb;
  const alpha = 1 - (1 - pa) * (1 - pb);
  const sum = pa + pb;
  const ka = sum > 0 ? pa / sum : 0.5;
  out.color.r = a.color.r * ka + b.color.r * (1 - ka);
  out.color.g = a.color.g * ka + b.color.g * (1 - ka);
  out.color.b = a.color.b * ka + b.color.b * (1 - ka);
  out.alpha = alpha;
  return out;
}

const SKY_VEIL: Record<WeatherKind, Veil> = {} as Record<WeatherKind, Veil>;
const SCENE_VEIL: Record<WeatherKind, Veil> = {} as Record<WeatherKind, Veil>;
for (const k of Object.keys(WEATHER_LOOKS) as WeatherKind[]) {
  SKY_VEIL[k] = { color: rgb01(WEATHER_LOOKS[k].skyTint), alpha: WEATHER_LOOKS[k].skyAlpha };
  SCENE_VEIL[k] = { color: rgb01(WEATHER_LOOKS[k].sceneTint), alpha: WEATHER_LOOKS[k].sceneAlpha };
}

/** The weather's veils during a crossfade from `from` to `to`, `k` of the way (0..1). */
export function weatherVeils(from: WeatherKind, to: WeatherKind, k: number, sky: Veil, scene: Veil): void {
  const wa = from === to ? 1 : 1 - k;
  const wb = from === to ? 0 : k;
  mixVeil(SKY_VEIL[from], wa, SKY_VEIL[to], wb, sky);
  mixVeil(SCENE_VEIL[from], wa, SCENE_VEIL[to], wb, scene);
}

/** How strongly weather `kind` shows during the crossfade (its share of the mix, 0..1). */
export function weatherWeight(kind: WeatherKind, from: WeatherKind, to: WeatherKind, k: number): number {
  if (from === to) return kind === from ? 1 : 0;
  if (kind === from) return 1 - k;
  if (kind === to) return k;
  return 0;
}

/** Brightness of a time of day's light (the mean of its land multiplier). */
export function timeBrightness(time: TimeOfDay): number {
  const m = TIME_GRADES[time].mul;
  return (m[0] + m[1] + m[2]) / 3;
}

/**
 * The time of day a mission's backdrop strips are painted in when its time changes: the brightest it uses, so the
 * others are a darker tint of it (a multiply can only darken).
 */
export function brightestTime(times: readonly TimeOfDay[]): TimeOfDay {
  let best = times[0];
  for (const t of times) if (timeBrightness(t) > timeBrightness(best)) best = t;
  return best;
}

/**
 * The multiply tint for land painted at `ref`, to look as it does at the crossfade from `from` to `to`, `k` of the
 * way: the ratio of the two lights per channel (never above 1), into `out`.
 */
export function landTint(ref: TimeOfDay, from: TimeOfDay, to: TimeOfDay, k: number, out: Rgb01): Rgb01 {
  const r = TIME_GRADES[ref].mul;
  const a = TIME_GRADES[from].mul;
  const b = TIME_GRADES[to].mul;
  const ch = (i: number): number => Math.min(1, (a[i] + (b[i] - a[i]) * k) / r[i]);
  out.r = ch(0);
  out.g = ch(1);
  out.b = ch(2);
  return out;
}

/** The night tint's opacity during the crossfade. */
export function nightTintAlpha(from: TimeOfDay, to: TimeOfDay, k: number): number {
  const a = TIME_GRADES[from].tintAlpha;
  return a + (TIME_GRADES[to].tintAlpha - a) * k;
}

/**
 * A field of drifting particles in screen space (wu): x in [0, width), y in the look's band. Fixed size, no allocation
 * after creation. The renderer draws particle i at (x[i] - parallax * camLeft wrapped to the width, y[i]).
 */
export class DriftField {
  readonly count: number;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly size: Float32Array;
  readonly alpha: Float32Array;
  private readonly vx: Float32Array;
  private readonly vy: Float32Array;
  private readonly phase: Float32Array;
  private readonly baseX: Float32Array;
  private t = 0;

  constructor(
    private readonly rng: Rng01,
    readonly width: number,
    readonly look: DriftFieldLook,
  ) {
    this.count = Math.max(1, Math.round((look.perScreen * width) / VIEW.screenWu));
    const n = this.count;
    this.x = new Float32Array(n);
    this.y = new Float32Array(n);
    this.size = new Float32Array(n);
    this.alpha = new Float32Array(n);
    this.vx = new Float32Array(n);
    this.vy = new Float32Array(n);
    this.phase = new Float32Array(n);
    this.baseX = new Float32Array(n);
    const between = (r: readonly [number, number]): number => r[0] + (r[1] - r[0]) * rng();
    for (let i = 0; i < n; i++) {
      this.baseX[i] = rng() * width;
      this.y[i] = look.y0 + (look.y1 - look.y0) * rng();
      this.vx[i] = between(look.vx);
      this.vy[i] = between(look.vy);
      this.size[i] = between(look.size);
      this.alpha[i] = between(look.alpha);
      this.phase[i] = rng() * Math.PI * 2;
      this.x[i] = this.baseX[i];
    }
  }

  /** Advance by dt seconds: drift, sway and wrap. */
  update(dt: number): void {
    if (!(dt > 0)) return;
    this.t += dt;
    const L = this.look;
    const w = this.width;
    const span = L.y1 - L.y0;
    const sway = L.wobbleHz * Math.PI * 2;
    for (let i = 0; i < this.count; i++) {
      let bx = this.baseX[i] + this.vx[i] * dt;
      let y = this.y[i] + this.vy[i] * dt;
      if (span > 0) {
        if (y > L.y1) {
          y -= span;
          bx = this.rng() * w;
        } else if (y < L.y0) {
          y += span;
        }
      }
      bx %= w;
      if (bx < 0) bx += w;
      this.baseX[i] = bx;
      this.y[i] = y;
      let x = bx + Math.sin(this.t * sway + this.phase[i]) * L.wobble;
      if (x >= w) x -= w;
      else if (x < 0) x += w;
      this.x[i] = x;
    }
  }
}
