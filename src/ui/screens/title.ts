/**
 * Title screen: the logo on a translucent plate over whatever the battlefield canvas is showing (the title storm,
 * src/app/menuStorm.ts). A few raindrops run down the front of the plate, drawn on a small canvas over it that never
 * takes a touch; they are faint and small so the lettering and both buttons stay fully readable.
 */
import type { PanelDropsState } from '../contracts';
import { add, button, el, stencil } from '../shell/dom';
import { helmetIcon } from '../shell/icons';
import type { ScreenFactory } from '../shell/types';

/** Size (px) of the pre-drawn drop head and trail images. */
const HEAD_W = 24;
const HEAD_H = 28;
const TRAIL_W = 8;
const TRAIL_H = 64;

function sprite(w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  paint(ctx);
  return canvas;
}

/** A bead of water on dark glass: a faint body with a darker lower rim and a sharp highlight. */
function paintHead(ctx: CanvasRenderingContext2D): void {
  const cx = HEAD_W / 2;
  const cy = HEAD_H * 0.55;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
  ctx.beginPath();
  ctx.ellipse(cx + 0.6, cy + 1.6, 9, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  const body = ctx.createRadialGradient(cx - 2, cy - 3, 1, cx, cy, 10);
  body.addColorStop(0, 'rgba(236, 244, 255, 0.5)');
  body.addColorStop(0.7, 'rgba(190, 206, 222, 0.22)');
  body.addColorStop(1, 'rgba(220, 232, 245, 0.45)');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(cx, cy, 8.5, 9.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.beginPath();
  ctx.ellipse(cx - 3, cy - 4, 2.2, 2.8, -0.4, 0, Math.PI * 2);
  ctx.fill();
}

/** The wet streak a sliding drop leaves: clear at the top, a little brighter toward the drop. */
function paintTrail(ctx: CanvasRenderingContext2D): void {
  const g = ctx.createLinearGradient(0, 0, 0, TRAIL_H);
  g.addColorStop(0, 'rgba(210, 222, 236, 0)');
  g.addColorStop(1, 'rgba(210, 222, 236, 0.4)');
  ctx.fillStyle = g;
  ctx.fillRect(TRAIL_W * 0.2, 0, TRAIL_W * 0.6, TRAIL_H);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
  ctx.fillRect(TRAIL_W * 0.8, 0, TRAIL_W * 0.15, TRAIL_H);
}

export const titleScreen: ScreenFactory = (ctx) => {
  const root = el('section', 'th-screen th-title');
  root.dataset.screen = 'title';

  const plate = el('div', 'th-plate th-title-plate');

  const logo = el('div', 'th-logo');
  const helmet = el('div', 'th-logo-helmet');
  helmet.append(helmetIcon());
  add(
    logo,
    helmet,
    stencil('h1', 'TIN HATS', 'th-logo-text'),
    el('p', 'th-type th-logo-tag', 'Western Europe & North Africa · 1940–45'),
  );

  const actions = el('div', 'th-title-actions');
  const play = button({
    testid: 'play',
    label: 'Play',
    className: 'th-btn-primary th-btn-big',
    onTap: () => {
      ctx.app.uiSound('confirm');
      ctx.go('campaign');
    },
  });
  play.dataset.primary = '';
  const settings = button({
    testid: 'settings',
    label: 'Settings',
    className: 'th-btn-big',
    onTap: () => {
      ctx.app.uiSound('click');
      ctx.session.settingsFrom = 'title';
      ctx.go('settings');
    },
  });
  add(actions, play, settings);

  // Raindrops running down the front of the plate.
  const rain = el('canvas', 'th-title-rain');
  rain.setAttribute('aria-hidden', 'true');
  rain.dataset.testid = 'title-rain';
  const pen = rain.getContext('2d');
  const head = sprite(HEAD_W, HEAD_H, paintHead);
  const trail = sprite(TRAIL_W, TRAIL_H, paintTrail);
  let w = 0;
  let h = 0;
  let seen = -1;

  function measure(): void {
    w = plate.clientWidth;
    h = plate.clientHeight;
    const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    rain.width = Math.max(1, Math.round(w * dpr));
    rain.height = Math.max(1, Math.round(h * dpr));
    if (pen) pen.setTransform(dpr, 0, 0, dpr, 0, 0);
    seen = -1;
  }

  function drawDrops(d: PanelDropsState): void {
    if (!pen || !head || !trail || d.version === seen) return;
    if (w === 0) measure();
    seen = d.version;
    pen.clearRect(0, 0, w, h);
    for (let i = 0; i < d.count; i++) {
      const a = d.alpha[i];
      if (a <= 0) continue;
      const x = d.x[i] * w;
      const y = d.y[i] * h;
      const r = d.size[i];
      const t = d.trail[i] * h;
      if (t > 1) {
        pen.globalAlpha = a * 0.7;
        pen.drawImage(trail, x - r * 0.5, y - t, r, t);
      }
      pen.globalAlpha = a;
      pen.drawImage(head, x - r * 1.2, y - r * 1.55, r * 2.4, r * 2.8);
    }
    pen.globalAlpha = 1;
  }

  add(plate, logo, actions, rain);
  const version = el('div', 'th-type th-version', ctx.opts.version ?? '');
  version.dataset.testid = 'version';
  add(root, plate, version);

  return { el: root, mounted: measure, resize: measure, drops: drawDrops };
};
