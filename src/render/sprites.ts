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
  /** A raindrop streak for the title storm: STREAK_W x STREAK_H wu, white, fading out toward its top; origin at its centre. */
  streak: 'rd/streak',
  /** A soft white disc fading to nothing at its rim (GLOW_SIZE wu across, origin at its centre): cold light, tinted. */
  glow: 'rd/glow',
} as const;

export const SHADOW_W = 64;
export const SHADOW_H = 16;
export const WHITE_SIZE = 8;
export const STREAK_W = 4;
export const STREAK_H = 32;
export const GLOW_SIZE = 64;

/** Glyphs of the floating "+N" text: the digits and the plus sign, drawn once with Canvas text. */
export const GLYPH_CHARS = '0123456789+';
export const GLYPH_W = 16;
export const GLYPH_H = 24;
/** Horizontal step between glyphs when a number is laid out (wu). */
export const GLYPH_ADVANCE = 11.5;

export function glyphKey(ch: string): string {
  return `rd/glyph/${ch}`;
}

function glyphSpecs(): SpriteSpec[] {
  const out: SpriteSpec[] = [];
  for (const ch of GLYPH_CHARS) {
    out.push({
      key: glyphKey(ch),
      w: GLYPH_W,
      h: GLYPH_H,
      ax: 0.5,
      ay: 0.5,
      draw(ctx) {
        ctx.font = 'bold 21px "Trebuchet MS", "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(32, 20, 6, 0.85)';
        ctx.strokeText(ch, GLYPH_W / 2, GLYPH_H / 2 + 1);
        ctx.fillStyle = '#ffd860';
        ctx.fillText(ch, GLYPH_W / 2, GLYPH_H / 2 + 1);
      },
    });
  }
  return out;
}

export function renderSprites(): SpriteSpec[] {
  return [
    ...glyphSpecs(),
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
    {
      key: RENDER_KEYS.streak,
      w: STREAK_W,
      h: STREAK_H,
      ax: 0.5,
      ay: 0.5,
      draw(ctx) {
        // A soft-sided line, clear at the top and brightest just above its leading (lower) end.
        const g = ctx.createLinearGradient(0, 0, 0, STREAK_H);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.75, 'rgba(255,255,255,0.75)');
        g.addColorStop(1, 'rgba(255,255,255,1)');
        ctx.fillStyle = g;
        ctx.fillRect(STREAK_W * 0.25, 0, STREAK_W * 0.5, STREAK_H);
        ctx.globalAlpha = 0.35;
        ctx.fillRect(0, 0, STREAK_W, STREAK_H);
        ctx.globalAlpha = 1;
      },
    },
    {
      key: RENDER_KEYS.glow,
      w: GLOW_SIZE,
      h: GLOW_SIZE,
      ax: 0.5,
      ay: 0.5,
      draw(ctx) {
        const r = GLOW_SIZE / 2;
        const g = ctx.createRadialGradient(r, r, 0, r, r, r);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, GLOW_SIZE, GLOW_SIZE);
      },
    },
  ];
}
