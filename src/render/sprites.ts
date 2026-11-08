/**
 * The few sprites the renderer draws for itself: a soft contact shadow and a
 * plain white square used (tinted and scaled) for bars, pips and overlays.
 */
import type { SpriteSpec } from '../art/types';
import { RENDER } from '../data/render';
import type { FactionId, Order } from '../data/schema';
import { SPEECH } from '../data/speech';

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
  /** A small, flat, dark-red pool (RENDER.blood.spriteW x spriteH wu, origin at its centre): see ./blood.ts. */
  blood: 'rd/blood',
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
    bloodSprite(),
    ...callinSprites(),
  ];
}

/** The blood pool: a few overlapping flat lobes, solid dark red in the middle and soft at the rim. */
function bloodSprite(): SpriteSpec {
  const B = RENDER.blood;
  return {
    key: RENDER_KEYS.blood,
    w: B.spriteW,
    h: B.spriteH,
    ax: 0.5,
    ay: 0.5,
    draw(ctx) {
      for (const [cx, rx, ry] of B.lobes) {
        ctx.save();
        ctx.translate(cx * B.spriteW, B.spriteH / 2);
        ctx.scale(rx * B.spriteW, ry * B.spriteH);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        g.addColorStop(0, B.core);
        g.addColorStop(B.coreStop, B.core);
        g.addColorStop(1, B.edge);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    },
  };
}

/* ------------------------------------------------------------------ */
/* New units and call-ins: flak puffs, the flame jet, speech bubbles, the boss banner */
/* ------------------------------------------------------------------ */

export const CALLIN_KEYS = {
  /** Dark flak burst, FLAK_SIZE wu across, origin at its centre. */
  flak: 'rd/flak',
} as const;

export const FLAK_SIZE = 40;
/** Flame tongue: FLAME_W long along +x from its origin at the nozzle, FLAME_H thick. */
export const FLAME_W = 64;
export const FLAME_H = 22;

export function flameKey(frame: number): string {
  return `rd/flame/${frame}`;
}

export function speechKey(faction: FactionId, order: Order, i: number): string {
  return `rd/speech/${faction}/${order}/${i}`;
}

/** Bubble width (wu) for a line: estimated from its length so no canvas is needed to lay it out. */
export function speechWidth(line: string): number {
  const S = RENDER.speech;
  return Math.ceil(line.length * S.charW + S.padX * 2);
}

/** Bubble height (wu) including its tail. */
export function speechHeight(): number {
  const S = RENDER.speech;
  return Math.ceil(S.font + S.padY * 2 + S.tail);
}

const SPEECH_ORDERS: readonly Order[] = ['fallBack', 'hold', 'advance'];

function speechSpecs(): SpriteSpec[] {
  const S = RENDER.speech;
  const out: SpriteSpec[] = [];
  for (const f of Object.keys(SPEECH) as FactionId[]) {
    for (const order of SPEECH_ORDERS) {
      const lines = SPEECH[f][order];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const w = speechWidth(line);
        const h = speechHeight();
        out.push({
          key: speechKey(f, order, i),
          w,
          h,
          // Origin at the tip of the tail (placed just above the speaker's head).
          ax: 0.5,
          ay: 1,
          draw(ctx) {
            const bh = h - S.tail;
            ctx.save();
            ctx.beginPath();
            const r = 6;
            ctx.moveTo(r + 1, 1);
            ctx.lineTo(w - r - 1, 1);
            ctx.quadraticCurveTo(w - 1, 1, w - 1, r + 1);
            ctx.lineTo(w - 1, bh - r);
            ctx.quadraticCurveTo(w - 1, bh, w - r - 1, bh);
            ctx.lineTo(w / 2 + 6, bh);
            ctx.lineTo(w / 2, h - 1);
            ctx.lineTo(w / 2 - 3, bh);
            ctx.lineTo(r + 1, bh);
            ctx.quadraticCurveTo(1, bh, 1, bh - r);
            ctx.lineTo(1, r + 1);
            ctx.quadraticCurveTo(1, 1, r + 1, 1);
            ctx.closePath();
            ctx.fillStyle = '#f2ead2';
            ctx.fill();
            ctx.lineWidth = 1.6;
            ctx.strokeStyle = '#2a2418';
            ctx.stroke();
            ctx.font = `bold ${S.font}px "Trebuchet MS", "Segoe UI", Arial, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#1d1a12';
            ctx.fillText(line, w / 2, bh / 2 + 0.5, w - S.padX * 2 + 4);
            ctx.restore();
          },
        });
      }
    }
  }
  return out;
}

function flakSpec(): SpriteSpec {
  return {
    key: CALLIN_KEYS.flak,
    w: FLAK_SIZE,
    h: FLAK_SIZE,
    ax: 0.5,
    ay: 0.5,
    draw(ctx) {
      const r = FLAK_SIZE / 2;
      // A few overlapping dark lobes with a hot core.
      const lobes: readonly [number, number, number][] = [
        [0, 0, 0.62],
        [-0.3, -0.18, 0.42],
        [0.32, -0.1, 0.4],
        [0.05, 0.3, 0.38],
      ];
      for (const [dx, dy, k] of lobes) {
        const g = ctx.createRadialGradient(r + dx * r, r + dy * r, 0, r + dx * r, r + dy * r, k * r);
        g.addColorStop(0, 'rgba(40,36,32,0.95)');
        g.addColorStop(0.7, 'rgba(48,44,40,0.75)');
        g.addColorStop(1, 'rgba(48,44,40,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, FLAK_SIZE, FLAK_SIZE);
      }
      ctx.fillStyle = 'rgba(255,190,90,0.55)';
      ctx.beginPath();
      ctx.arc(r, r, r * 0.14, 0, Math.PI * 2);
      ctx.fill();
    },
  };
}

function flameSpecs(): SpriteSpec[] {
  const out: SpriteSpec[] = [];
  for (let f = 0; f < RENDER.flame.frames; f++) {
    out.push({
      key: flameKey(f),
      w: FLAME_W,
      h: FLAME_H,
      ax: 0,
      ay: 0.5,
      draw(ctx) {
        const cy = FLAME_H / 2;
        // A tongue that billows out from the nozzle and rolls into a ball of fire at the far end; each frame wobbles.
        const wob = [0, 1.4, -1.2][f % 3];
        const r = cy - 1;
        const layers: readonly [string, number, number][] = [
          ['rgba(120,34,12,0.8)', 1, 1],
          ['rgba(236,104,22,0.95)', 0.74, 0.97],
          ['rgba(255,220,120,1)', 0.4, 0.9],
        ];
        for (const [color, k, len] of layers) {
          const end = FLAME_W * len;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.moveTo(0, cy - 1.2 * k);
          ctx.bezierCurveTo(end * 0.35, cy - 2.5 * k + wob, end * 0.6, cy - r * k - wob, end - r * k * 0.6, cy - r * k + wob);
          ctx.quadraticCurveTo(end, cy - r * k * 0.5, end, cy + wob * 0.5);
          ctx.quadraticCurveTo(end, cy + r * k * 0.6, end - r * k * 0.6, cy + r * k * 0.9 - wob);
          ctx.bezierCurveTo(end * 0.6, cy + r * k * 0.8 + wob, end * 0.35, cy + 2.5 * k, 0, cy + 1.2 * k);
          ctx.closePath();
          ctx.fill();
        }
      },
    });
  }
  return out;
}

/** Every sprite of the new units' and call-ins' effects. */
export function callinSprites(): SpriteSpec[] {
  return [flakSpec(), ...flameSpecs(), ...speechSpecs()];
}
