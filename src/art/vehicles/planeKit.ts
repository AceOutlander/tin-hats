/**
 * Shared pieces of the call-in aircraft (./planes for the British and German types, ./sovietPlanes for the Red Army's):
 * the nation's two-tone skin over a pale belly, national markings, the British fin flash and the propeller blur.
 */
import { ART_COLORS as C } from '../../data/artLayout';
import { FACTIONS } from '../../data/factions';
import type { FactionId } from '../../data/schema';
import { type Ctx, TAU, balkenkreuz, ellipse, inside, mix, redStar, rimmed } from '../props/kit';

export const RIM = '#9a9d8c';
export const BELLY = '#5d625a';

export interface Skin {
  body: string;
  top: string;
  rim: string;
}

export function skin(f: FactionId): Skin {
  const look = FACTIONS[f].look;
  return { body: mix(C.ink, look.tintDark, 0.5), top: mix(look.tintDark, look.tint, 0.35), rim: RIM };
}

function roundel(ctx: Ctx, x: number, y: number, r: number): void {
  const rings: readonly [number, string][] = [
    [1, '#e6dcb0'],
    [0.82, '#2b3d6b'],
    [0.5, '#e6dcb0'],
    [0.32, '#8c2a22'],
  ];
  for (const [k, c] of rings) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x, y, r * k, 0, TAU);
    ctx.fill();
  }
}

export function marking(ctx: Ctx, f: FactionId, x: number, y: number, r: number): void {
  const flag = FACTIONS[f].look.flag;
  if (flag === 'balkenkreuz') balkenkreuz(ctx, x, y, r * 1.7);
  else if (flag === 'sovietRed') redStar(ctx, x, y, r * 1.1);
  else roundel(ctx, x, y, r);
}

export function finFlash(ctx: Ctx, f: FactionId, x: number, y: number, w: number, h: number): void {
  // Only the British fin flash; Soviet aircraft wear their star on the fuselage and German ones the cross.
  if (FACTIONS[f].look.flag !== 'unionJack') return;
  const cols = ['#8c2a22', '#e6dcb0', '#2b3d6b'];
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = cols[i];
    ctx.fillRect(x + (i * w) / 3, y, w / 3 + 0.2, h);
  }
}

export function propBlur(ctx: Ctx, x: number, y: number, h: number): void {
  ctx.fillStyle = 'rgba(20,20,18,0.16)';
  ellipse(ctx, x, y, 3.4, h);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,20,18,0.22)';
  ellipse(ctx, x, y, 1.5, h * 0.96);
  ctx.fill();
}

/** Paints a body path with the nation's upper surfaces above `split` (y) and the pale belly below. */
export function twoTone(ctx: Ctx, path: (c: Ctx) => void, S: Skin, split: number, w: number): void {
  rimmed(ctx, path, S.body, S.rim, 0.2, 1.4);
  inside(ctx, path, () => {
    ctx.fillStyle = S.top;
    ctx.fillRect(-w, -60, w * 2, 60 + split - 4);
    ctx.fillStyle = BELLY;
    ctx.fillRect(-w, split + 2, w * 2, 60);
  });
}
