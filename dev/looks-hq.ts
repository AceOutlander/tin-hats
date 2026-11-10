/**
 * Preview of the HQ styles the Quartermaster "HQ health" upgrade shows: one nation per page, a row per upgrade stage
 * (tent, big tent, dugout, bunker) and a column per damage state, on a ground line with a 58 wu soldier for scale, the
 * nation's flag on the pole and an outline where the separate HQ gun-position sprite stands. See looks-hq.html.
 */
import { DAMAGE_STATES } from '../src/data/artLayout';
import { FACTIONS } from '../src/data/factions';
import { HQ_STYLE_LAYOUT } from '../src/data/looksHq';
import type { FactionId } from '../src/data/schema';
import { NATION_LOOKS, type HqStyle } from '../src/data/upgradeLooks';
import { VIEW } from '../src/data/view';
import { FLAG_KEYS, flagSpecs } from '../src/art/structures';
import { hqStyleKey, hqStyleSpecs } from '../src/art/structures/hqStyles';
import type { SpriteSpec } from '../src/art/types';

declare global {
  interface Window {
    __ready?: boolean;
  }
}

type Ctx = CanvasRenderingContext2D;

const SCENE_W = 1320;
const ROW_H = 250;
const COLS = [190, 630, 1070];

// ';' also separates parameters, so a URL can be passed through cmd.exe without quoting '&'.
const params = new URLSearchParams(location.search.replace(/;/g, '&'));
const num = (name: string, fallback: number): number => {
  const raw = params.get(name);
  const v = raw === null ? NaN : Number(raw);
  return Number.isFinite(v) ? v : fallback;
};
const fParam = params.get('f');
const faction: FactionId = fParam === 'german' || fParam === 'soviet' ? fParam : 'british';
const showAnchors = params.get('anchors') === '1';
const zoom = num('zoom', 1);
const viewOx = num('ox', 0);
const viewOy = num('oy', 0);
const onlyParam = params.get('only');
const styles: HqStyle[] = NATION_LOOKS[faction].hq.filter((s) => onlyParam === null || s === onlyParam);

const rasters = new Map<string, { spec: SpriteSpec; canvas: HTMLCanvasElement }>();

function rasterise(spec: SpriteSpec): void {
  const ts = VIEW.textureScale;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(spec.w * ts);
  canvas.height = Math.round(spec.h * ts);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  ctx.scale(ts, ts);
  spec.draw(ctx);
  rasters.set(spec.key, { spec, canvas });
}

function put(ctx: Ctx, key: string, x: number, y: number): void {
  const r = rasters.get(key);
  if (!r) throw new Error(`no sprite ${key}`);
  ctx.drawImage(r.canvas, x - r.spec.ax * r.spec.w, y - r.spec.ay * r.spec.h, r.spec.w, r.spec.h);
}

function label(ctx: Ctx, text: string, x: number, y: number): void {
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillText(text, x + 0.7, y + 0.7);
  ctx.fillStyle = '#e8e3cf';
  ctx.fillText(text, x, y);
}

/** Placeholder soldier: black, 58 wu tall, feet at (x, y), facing +x or -x. */
function soldier(ctx: Ctx, x: number, y: number, facing: number, tint: string): void {
  const h = VIEW.figureHeight;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  ctx.strokeStyle = '#0c0c0c';
  ctx.fillStyle = '#0c0c0c';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 4.3;
  const hip = -h * 0.44;
  const neck = -h * 0.8;
  ctx.beginPath();
  ctx.moveTo(-h * 0.08, 0);
  ctx.lineTo(0, hip);
  ctx.lineTo(h * 0.08, 0);
  ctx.moveTo(0, hip);
  ctx.lineTo(h * 0.03, neck);
  ctx.moveTo(h * 0.03, neck + 3);
  ctx.lineTo(h * 0.22, neck + h * 0.12);
  ctx.lineTo(h * 0.42, neck + h * 0.06);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(h * 0.12, neck + h * 0.14);
  ctx.lineTo(h * 0.62, neck + h * 0.03);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(h * 0.04, neck - h * 0.1, h * 0.085, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = tint;
  ctx.beginPath();
  ctx.ellipse(h * 0.04, neck - h * 0.13, h * 0.12, h * 0.07, 0, Math.PI, 0);
  ctx.fill();
  ctx.restore();
}

function marker(ctx: Ctx, x: number, y: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, 3.5, 0, Math.PI * 2);
  ctx.moveTo(x - 7, y);
  ctx.lineTo(x + 7, y);
  ctx.moveTo(x, y - 7);
  ctx.lineTo(x, y + 7);
  ctx.stroke();
}

function render(ctx: Ctx): void {
  const flag = FLAG_KEYS[FACTIONS[faction].look.flag];
  const tint = FACTIONS[faction].look.tint;
  styles.forEach((style, row) => {
    const y0 = row * ROW_H;
    const gy = y0 + ROW_H - 26;
    const sky = ctx.createLinearGradient(0, y0, 0, gy);
    sky.addColorStop(0, '#9ea28c');
    sky.addColorStop(1, '#c3bd9d');
    ctx.fillStyle = sky;
    ctx.fillRect(0, y0, SCENE_W, ROW_H);
    ctx.fillStyle = '#6a603f';
    ctx.fillRect(0, gy - 30, SCENE_W, ROW_H - (gy - 30 - y0));
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, gy - 30, SCENE_W, 3);
    const L = HQ_STYLE_LAYOUT[style];
    DAMAGE_STATES.forEach((state, col) => {
      const cx = COLS[col];
      put(ctx, hqStyleKey(style, faction, state), cx, gy);
      if (state !== 'ruin') put(ctx, flag, cx + L.flagTop.x, gy + L.flagTop.y);
      // Where the separate gun-position sprite goes (60 to 110 wu wide).
      ctx.strokeStyle = 'rgba(160,40,30,0.8)';
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1;
      ctx.strokeRect(cx + L.gunNest.x - 40, gy - 34, 80, 34);
      ctx.setLineDash([]);
      soldier(ctx, cx + L.doorX + 4, gy + 4, 1, tint);
      soldier(ctx, cx - L.bodyW / 2 - 6, gy + 10, -1, tint);
      label(ctx, `${style} / ${state}`, cx, gy + 22);
      if (showAnchors) {
        ctx.strokeStyle = '#ff4';
        ctx.strokeRect(cx + L.doorX - L.doorW / 2, gy - L.doorH, L.doorW, L.doorH);
        marker(ctx, cx + L.flagTop.x, gy + L.flagTop.y, '#4cf');
        marker(ctx, cx + L.flagBase.x, gy + L.flagBase.y, '#4cf');
        marker(ctx, cx + L.gunNest.x, gy + L.gunNest.y, '#f44');
        L.fires.forEach((p) => marker(ctx, cx + p.x, gy + p.y, '#f80'));
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.strokeRect(cx - L.box.ox, gy - L.box.oy, L.box.w, L.box.h);
        ctx.strokeRect(cx - L.bodyW / 2, gy - L.bodyH, L.bodyW, L.bodyH);
      }
    });
  });
}

function boot(): void {
  for (const spec of flagSpecs()) rasterise(spec);
  for (const style of styles) for (const spec of hqStyleSpecs(style, faction)) rasterise(spec);
  const canvas = document.getElementById('view') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  const draw = (): void => {
    const dpr = Math.min(window.devicePixelRatio || 1, VIEW.maxDevicePixelRatio);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    const k = (canvas.width / SCENE_W) * zoom;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#15160f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(k, 0, 0, k, -viewOx * k, -viewOy * k);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    render(ctx);
  };
  draw();
  window.addEventListener('resize', draw);
  window.__ready = true;
}

boot();
