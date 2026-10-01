/**
 * Flags: flat SpriteSpecs plus the pure wave function the renderer uses to
 * draw a flag as FLAG_LAYOUT.strips vertical strips.
 *
 * The German flag is a plain Balkenkreuz (straight-armed black cross with a
 * white outline) on field grey. No other symbol is drawn anywhere.
 */
import { ART_COLORS as C, FLAG_LAYOUT } from '../../data/artLayout';
import type { FactionLook } from '../../data/schema';
import { type Ctx, balkenkreuz, makeSpec, poly } from '../props/kit';
import type { SpriteSpec } from '../types';

export type FlagId = FactionLook['flag'];

export const FLAG_KEYS: Record<FlagId, string> = {
  unionJack: 'st/flag/unionJack',
  balkenkreuz: 'st/flag/balkenkreuz',
};

const FLAG_BOX = { w: FLAG_LAYOUT.w, h: FLAG_LAYOUT.h, ox: 0, oy: 0 };

/**
 * Union Flag with the proper construction, in units of h / 30: St Andrew's
 * white saltire 6 wide, St Patrick's red saltire 2 wide and counterchanged
 * (broad white stripe uppermost next to the hoist), St George's red cross 6
 * wide with a white fimbriation of 2.
 */
function paintUnionJack(ctx: Ctx): void {
  const w = FLAG_LAYOUT.w;
  const h = FLAG_LAYOUT.h;
  const u = h / 30;
  const cx = w / 2;
  const cy = h / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();
  ctx.fillStyle = C.flagBlue;
  ctx.fillRect(0, 0, w, h);

  // St Andrew: white diagonals, corner to corner.
  ctx.strokeStyle = C.flagWhite;
  ctx.lineWidth = 6 * u;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.moveTo(-w, -h);
  ctx.lineTo(2 * w, 2 * h);
  ctx.moveTo(2 * w, -h);
  ctx.lineTo(-w, 2 * h);
  ctx.stroke();

  // St Patrick: each red arm lies on one side of its diagonal's centre line,
  // rotating pinwheel fashion so the broad white is uppermost at the hoist.
  ctx.fillStyle = C.flagRed;
  const corners = [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ];
  for (const corner of corners) {
    let dx = corner[0] - cx;
    let dy = corner[1] - cy;
    const len = Math.hypot(dx, dy);
    dx /= len;
    dy /= len;
    const px = dy * 2 * u;
    const py = -dx * 2 * u;
    const far = len * 1.5;
    poly(ctx, [cx, cy, cx + dx * far, cy + dy * far, cx + dx * far + px, cy + dy * far + py, cx + px, cy + py]);
    ctx.fill();
  }

  // St George: white fimbriation, then the red cross.
  ctx.fillStyle = C.flagWhite;
  ctx.fillRect(0, cy - 5 * u, w, 10 * u);
  ctx.fillRect(cx - 5 * u, 0, 10 * u, h);
  ctx.fillStyle = C.flagRed;
  ctx.fillRect(0, cy - 3 * u, w, 6 * u);
  ctx.fillRect(cx - 3 * u, 0, 6 * u, h);
  ctx.restore();
}

function paintBalkenkreuzFlag(ctx: Ctx): void {
  const w = FLAG_LAYOUT.w;
  const h = FLAG_LAYOUT.h;
  ctx.fillStyle = C.flagFieldGrey;
  ctx.fillRect(0, 0, w, h);
  balkenkreuz(ctx, w / 2, h / 2, h * 0.6);
}

export function flagSpecs(): SpriteSpec[] {
  return [
    makeSpec(FLAG_KEYS.unionJack, FLAG_BOX, paintUnionJack),
    makeSpec(FLAG_KEYS.balkenkreuz, FLAG_BOX, paintBalkenkreuzFlag),
  ];
}

export interface FlagWave {
  /** Vertical offset of the strip in wu (positive = down). */
  dy: number;
  /** -1 (in the fold's shadow) .. +1 (catching the light). */
  shade: number;
}

const SCRATCH: FlagWave = { dy: 0, shade: 0 };
const TAU = Math.PI * 2;

/**
 * Shape of a waving flag at time t (seconds) for the vertical strip at u
 * (0 = hoist, 1 = fly). Pure, continuous in both arguments, pinned at the
 * hoist and exactly periodic in t with period FLAG_LAYOUT.wave.period.
 *
 * Without `out` the result is written to a shared scratch object: read it
 * before the next call. Nothing is allocated either way.
 */
export function flagWave(t: number, u: number, out: FlagWave = SCRATCH): FlagWave {
  const W = FLAG_LAYOUT.wave;
  const phase = (t / W.period) * TAU;
  const env = u * (2 - u);
  const a1 = TAU * W.waves1 * u - W.harmonic1 * phase;
  const a2 = TAU * W.waves2 * u - W.harmonic2 * phase + W.phase2;
  out.dy = env * (W.amp1 * Math.sin(a1) + W.amp2 * Math.sin(a2)) + W.droop * u * u * (1 + W.droopSway * Math.sin(phase));
  out.shade = (W.shade1 * Math.cos(a1) + W.shade2 * Math.cos(a2)) * (W.shadeBase + (1 - W.shadeBase) * env);
  return out;
}

/** Grey multiply tint (0xRRGGBB) for a strip with the given shade, for renderers that tint sprites. */
export function flagStripTint(shade: number): number {
  const W = FLAG_LAYOUT.wave;
  const level = Math.max(0, Math.min(255, Math.round(255 * (W.tintMid + W.tintSwing * shade))));
  return (level << 16) | (level << 8) | level;
}
