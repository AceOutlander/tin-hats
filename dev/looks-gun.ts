/**
 * Preview page for the HQ machine-gun positions (src/art/structures/hqGun.ts). Rasterises each SpriteSpec the way the
 * renderer will (textureScale x) and lays them out on ground lines with a real soldier figure for scale. See
 * looks-gun.html for the query parameters.
 */
import { HQ_GUN_LAYOUT } from '../src/data/looksGun';
import type { FactionId } from '../src/data/schema';
import type { HqGunStyle } from '../src/data/upgradeLooks';
import { VIEW } from '../src/data/view';
import { updateFigure } from '../src/art/figure/animate';
import { drawFigure2d } from '../src/art/figure/canvas';
import { createFigureAnim, createFigureInput } from '../src/art/figure/pose';
import { hqGunKey, hqGunSpecs, type HqGunState } from '../src/art/structures/hqGun';
import type { SpriteSpec } from '../src/art/types';

declare global {
  interface Window {
    __ready?: boolean;
  }
}

type Ctx = CanvasRenderingContext2D;

const SCENE_W = 1000;
const ROW_H = 132;
const STYLES: readonly HqGunStyle[] = ['gunner', 'emplacement', 'tripod', 'nest'];
const COLUMNS: readonly { faction: FactionId; state: HqGunState }[] = [
  { faction: 'british', state: 'intact' },
  { faction: 'british', state: 'ruin' },
  { faction: 'german', state: 'intact' },
  { faction: 'german', state: 'ruin' },
];

const params = new URLSearchParams(location.search);
const num = (name: string, fallback: number): number => {
  const raw = params.get(name);
  const v = raw === null ? NaN : Number(raw);
  return Number.isFinite(v) ? v : fallback;
};
// ?v=zoom,ox,oy is the same view in one parameter (handy where '&' is awkward, such as a Windows command line).
const packed = (params.get('v') ?? '').split(',').map(Number);
const zoom = packed[0] > 0 ? packed[0] : num('zoom', 1);
const viewOx = Number.isFinite(packed[1]) ? packed[1] : num('ox', 0);
const viewOy = Number.isFinite(packed[2]) ? packed[2] : num('oy', 0);
const showAnchors = params.get('anchors') !== '0';
const mirror = params.get('mirror') === '1';
const facing = mirror ? -1 : 1;
const bg = params.get('bg') ?? 'day';
const SKY: Record<string, [string, string, string]> = {
  day: ['#9ea28c', '#c3bd9d', '#6a603f'],
  dusk: ['#6d5a52', '#c08a62', '#4e4430'],
  dark: ['#171a17', '#262a24', '#1c1a12'],
};
const palette = SKY[bg] ?? SKY.day;

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
  if (!r) throw new Error(`no sprite with key ${key}`);
  const { spec } = r;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  ctx.drawImage(r.canvas, -spec.ax * spec.w, -spec.ay * spec.h, spec.w, spec.h);
  if (showAnchors) {
    ctx.strokeStyle = 'rgba(255,255,80,0.5)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(-spec.ax * spec.w, -spec.ay * spec.h, spec.w, spec.h);
  }
  ctx.restore();
}

function stage(ctx: Ctx, y0: number, y1: number, gy: number): void {
  const sky = ctx.createLinearGradient(0, y0, 0, gy - 30);
  sky.addColorStop(0, palette[0]);
  sky.addColorStop(1, palette[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, y0, SCENE_W, y1 - y0);
  ctx.fillStyle = palette[2];
  ctx.fillRect(0, gy - 20, SCENE_W, y1 - gy + 20);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(0, gy, SCENE_W, 0.6);
}

function label(ctx: Ctx, text: string, x: number, y: number): void {
  ctx.save();
  ctx.font = '9px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillText(text, x + 0.6, y + 0.6);
  ctx.fillStyle = '#e8e3cf';
  ctx.fillText(text, x, y);
  ctx.restore();
}

function marker(ctx: Ctx, x: number, y: number): void {
  ctx.save();
  ctx.strokeStyle = '#f33';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(x - 4, y);
  ctx.lineTo(x + 4, y);
  ctx.moveTo(x, y - 4);
  ctx.lineTo(x, y + 4);
  ctx.stroke();
  ctx.restore();
}

/** A real rifleman standing at ease, feet at (x, gy). */
function soldier(ctx: Ctx, faction: FactionId, x: number, gy: number): void {
  const anim = createFigureAnim('rifle', faction, 3);
  const input = createFigureInput('rifle');
  for (let i = 0; i < 60; i++) updateFigure(anim, input, 1 / 60);
  ctx.save();
  ctx.translate(x, gy);
  ctx.scale(facing, 1);
  drawFigure2d(ctx, anim);
  ctx.restore();
}

function render(): void {
  const canvas = document.getElementById('view') as HTMLCanvasElement;
  const dpr = Math.min(window.devicePixelRatio || 1, VIEW.maxDevicePixelRatio);
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  const k = (canvas.width / SCENE_W) * zoom;
  ctx.fillStyle = '#15160f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(k, 0, 0, k, -viewOx * k, -viewOy * k);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  STYLES.forEach((style, row) => {
    const y0 = row * ROW_H;
    const gy = y0 + ROW_H - 26;
    stage(ctx, y0, y0 + ROW_H, gy);
    const L = HQ_GUN_LAYOUT[style];
    COLUMNS.forEach((col, i) => {
      const cx = 130 + i * 250;
      soldier(ctx, col.faction, cx - facing * 92, gy);
      put(ctx, hqGunKey(style, col.faction, col.state), cx, gy);
      if (showAnchors) marker(ctx, cx + facing * L.muzzle.x, gy + L.muzzle.y);
      label(ctx, `${style} ${col.faction} ${col.state}`, cx, gy + 18);
    });
  });
}

function boot(): void {
  for (const style of STYLES) for (const faction of ['british', 'german'] as const) hqGunSpecs(style, faction).forEach(rasterise);
  render();
  window.addEventListener('resize', render);
  window.__ready = true;
}

boot();
