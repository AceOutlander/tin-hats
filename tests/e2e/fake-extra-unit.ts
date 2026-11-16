/**
 * A stand-in extra unit for the browser tests (src/platform/extraUnit.ts): the website's platform has none, so a test
 * page carries this made-up one, the "Champion" of tests/unit/extra-unit-made-up.ts, drawn here as a plain big
 * fighter with a blade. It must be on the page before the game's scripts run, so it goes in as an init script; the
 * game takes it only with `?debug=1`.
 */
import type { Page } from '@playwright/test';
import type { ExtraUnitStandIn } from '../../src/platform/extraUnit';
import type { ExtraUnitPicture } from '../../src/platform/types';
import { MADE_UP_EXTRA } from '../unit/extra-unit-made-up';

export const FAKE_EXTRA = { name: MADE_UP_EXTRA.name, label: MADE_UP_EXTRA.buttonName ?? MADE_UP_EXTRA.name, shouts: MADE_UP_EXTRA.shouts } as const;

export async function installFakeExtraUnit(page: Page): Promise<void> {
  await page.addInitScript((data) => {
    const W = 60;
    const H = 66;
    /** A big figure: `step` swings the legs, `blade` is the blade's angle, `fall` tips the whole body over (0..1). */
    const body = (ctx: CanvasRenderingContext2D, step: number, blade: number, fall: number): void => {
      ctx.save();
      ctx.translate(W / 2, H - 2);
      ctx.rotate((-fall * Math.PI) / 2);
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#2b2f36';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(0, -26);
      ctx.lineTo(-8 * step, 0);
      ctx.moveTo(0, -26);
      ctx.lineTo(8 * step, 0);
      ctx.stroke();
      ctx.fillStyle = '#7d8794';
      ctx.fillRect(-9, -50, 18, 26);
      ctx.fillStyle = '#c9a36a';
      ctx.beginPath();
      ctx.arc(0, -56, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#d9dde2';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(8, -42);
      ctx.lineTo(8 + Math.cos(blade) * 22, -42 + Math.sin(blade) * 22);
      ctx.stroke();
      ctx.restore();
    };
    const picture = (key: string, step: number, blade: number, fall: number): ExtraUnitPicture => ({ key, w: W, h: H, ax: 0.5, ay: 1, draw: (ctx) => body(ctx, step, blade, fall) });
    const up = -1.2;
    const pictures: ExtraUnitPicture[] = [
      picture('extra/made-up/idle/0', 0.4, up, 0),
      picture('extra/made-up/move/0', 1, up, 0),
      picture('extra/made-up/move/1', -1, up, 0),
      picture('extra/made-up/charge/0', 1, -0.2, 0),
      picture('extra/made-up/charge/1', -1, -0.2, 0),
      picture('extra/made-up/strike/0', 0.6, -0.8, 0),
      picture('extra/made-up/strike/1', 0.6, 0.5, 0),
      picture('extra/made-up/death/0', 0.4, up, 0.5),
      picture('extra/made-up/death/1', 0.4, up, 1),
    ];
    const made: ExtraUnitStandIn = {
      data,
      slot: {
        entitlement: 'made-up',
        art: {
          pictures,
          idle: { frames: ['extra/made-up/idle/0'], rate: 1 },
          move: { frames: ['extra/made-up/move/0', 'extra/made-up/move/1'], rate: 1 / 14 },
          charge: { frames: ['extra/made-up/charge/0', 'extra/made-up/charge/1'], rate: 1 / 14 },
          strike: { frames: ['extra/made-up/strike/0', 'extra/made-up/strike/1'], rate: 8 },
          death: { frames: ['extra/made-up/death/0', 'extra/made-up/death/1'], rate: 4 },
          height: 62,
          length: 34,
          reach: { x: 24, y: -40 },
          portrait(ctx, w, h) {
            const k = Math.min(w / W, h / H);
            ctx.translate((w - W * k) / 2, (h - H * k) / 2);
            ctx.scale(k, k);
            body(ctx, 0.4, up, 0);
          },
        },
      },
    };
    (window as unknown as { __TH_EXTRA_UNIT: ExtraUnitStandIn }).__TH_EXTRA_UNIT = made;
  }, MADE_UP_EXTRA);
}
