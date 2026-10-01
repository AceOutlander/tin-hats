/**
 * The few sprites the renderer draws for itself: a soft contact shadow and a
 * plain white square used (tinted and scaled) for bars, pips and overlays.
 */
import type { SpriteSpec } from '../art/types';

export const RENDER_KEYS = {
  /** Soft black ellipse, 64 x 16 wu, origin at its centre. */
  shadow: 'rd/shadow',
  /** Opaque white 8 x 8 wu square, origin at its centre. */
  white: 'rd/white',
  /** Same square with its origin at the top-left corner (full-screen overlays, bars). */
  whiteTL: 'rd/whiteTL',
} as const;

export const SHADOW_W = 64;
export const SHADOW_H = 16;
export const WHITE_SIZE = 8;

export function renderSprites(): SpriteSpec[] {
  return [
    {
      key: RENDER_KEYS.shadow,
      w: SHADOW_W,
      h: SHADOW_H,
      ax: 0.5,
      ay: 0.5,
      draw(ctx) {
        ctx.save();
        ctx.translate(SHADOW_W / 2, SHADOW_H / 2);
        ctx.scale(SHADOW_W / 2, SHADOW_H / 2);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(0.45, 'rgba(0,0,0,0.8)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      },
    },
    {
      key: RENDER_KEYS.white,
      w: WHITE_SIZE,
      h: WHITE_SIZE,
      ax: 0.5,
      ay: 0.5,
      draw(ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, WHITE_SIZE, WHITE_SIZE);
      },
    },
    {
      key: RENDER_KEYS.whiteTL,
      w: WHITE_SIZE,
      h: WHITE_SIZE,
      ax: 0,
      ay: 0,
      draw(ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, WHITE_SIZE, WHITE_SIZE);
      },
    },
  ];
}
